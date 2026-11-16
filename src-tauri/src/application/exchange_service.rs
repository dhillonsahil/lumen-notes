use crate::application::attachment_service::AttachmentService;
use crate::domain::{Note, NoteFilter, NoteSummary, SaveNotePayload, error::AppError};
use crate::storage::StorageManager;
use crate::storage::notes::NoteRepository;
use crate::storage::tags::TagRepository;
use base64::prelude::*;
use chrono::Utc;
use serde::{Deserialize, Serialize};
use std::sync::Arc;
use uuid::Uuid;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ExportedAttachment {
    pub id: String,
    pub original_name: String,
    pub mime_type: String,
    pub size_bytes: i64,
    pub checksum: String,
    pub data_base64: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ExportedNote {
    pub id: String,
    pub title: String,
    pub document_json: String,
    pub document_version: i64,
    pub plain_text: String,
    pub pinned: bool,
    pub favorite: bool,
    pub archived: bool,
    pub created_at: String,
    pub modified_at: String,
    pub tags: Vec<String>,
    pub attachments: Vec<ExportedAttachment>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct LumenArchive {
    pub format: String,
    pub version: i64,
    pub exported_at: String,
    pub notes: Vec<ExportedNote>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ImportNotePreview {
    pub id: String,
    pub title: String,
    pub plain_text_snippet: String,
    pub has_collision: bool,
    pub collision_type: Option<String>, // "id_match" | "title_match"
    pub attachments_count: usize,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ImportPreview {
    pub total_notes: usize,
    pub total_attachments: usize,
    pub notes: Vec<ImportNotePreview>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ImportResult {
    pub imported_count: usize,
    pub skipped_count: usize,
    pub overwritten_count: usize,
}

pub struct ExchangeService {
    storage: Arc<StorageManager>,
    attachment_service: Arc<AttachmentService>,
}

impl ExchangeService {
    pub fn new(storage: Arc<StorageManager>, attachment_service: Arc<AttachmentService>) -> Self {
        Self {
            storage,
            attachment_service,
        }
    }

    pub fn export_note_txt(&self, note: &Note) -> String {
        format!("{}\n\n{}", note.title, note.plain_text)
    }

    pub fn export_note_html(&self, note: &Note) -> String {
        let title_escaped = html_escape(&note.title);
        let body_escaped = html_escape(&note.plain_text).replace('\n', "<br/>\n");

        format!(
            r#"<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <title>{}</title>
  <style>
    body {{
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
      max-width: 760px;
      margin: 40px auto;
      padding: 0 20px;
      line-height: 1.6;
      color: #202023;
      background: #FFFFFF;
    }}
    h1 {{ font-size: 28px; font-weight: 700; margin-bottom: 16px; }}
    .meta {{ font-size: 13px; color: #64646B; margin-bottom: 24px; border-bottom: 1px solid #DEDEE3; padding-bottom: 8px; }}
    .content {{ font-size: 16px; white-space: pre-wrap; }}
  </style>
</head>
<body>
  <h1>{}</h1>
  <div class="meta">Created: {} · Modified: {}</div>
  <div class="content">{}</div>
</body>
</html>"#,
            title_escaped, title_escaped, note.created_at, note.modified_at, body_escaped
        )
    }

    pub fn export_archive(&self) -> Result<String, AppError> {
        let notes = self.storage.with_conn(|conn| {
            NoteRepository::list(
                conn,
                &NoteFilter {
                    is_trash: Some(false),
                    ..Default::default()
                },
            )
        })?;

        let mut exported_notes = Vec::new();

        for summary in notes {
            let note = self
                .storage
                .with_conn(|conn| NoteRepository::get_by_id(conn, &summary.id))?
                .ok_or_else(|| AppError::NotFound(format!("Note {} not found", summary.id)))?;

            let tags = self
                .storage
                .with_conn(|conn| TagRepository::get_for_note(conn, &note.id))?
                .into_iter()
                .map(|t| t.name)
                .collect();

            let atts = self.attachment_service.list_attachments(&note.id)?;
            let mut exported_atts = Vec::new();

            for att in atts {
                if let Ok((_, data_b64)) = self.attachment_service.get_attachment_data(&att.id) {
                    exported_atts.push(ExportedAttachment {
                        id: att.id,
                        original_name: att.original_name,
                        mime_type: att.mime_type,
                        size_bytes: att.size_bytes,
                        checksum: att.checksum,
                        data_base64: data_b64,
                    });
                }
            }

            exported_notes.push(ExportedNote {
                id: note.id,
                title: note.title,
                document_json: note.document_json,
                document_version: note.document_version,
                plain_text: note.plain_text,
                pinned: note.pinned,
                favorite: note.favorite,
                archived: note.archived,
                created_at: note.created_at,
                modified_at: note.modified_at,
                tags,
                attachments: exported_atts,
            });
        }

        let archive = LumenArchive {
            format: "lumen-notes-archive".to_string(),
            version: 1,
            exported_at: Utc::now().to_rfc3339(),
            notes: exported_notes,
        };

        serde_json::to_string_pretty(&archive)
            .map_err(|e| AppError::ValidationError(format!("Failed to serialize archive: {}", e)))
    }

    pub fn preview_import(
        &self,
        archive_json: &str,
        existing_notes: &[NoteSummary],
    ) -> Result<ImportPreview, AppError> {
        let archive: LumenArchive = serde_json::from_str(archive_json)
            .map_err(|e| AppError::ValidationError(format!("Invalid archive format: {}", e)))?;

        if archive.format != "lumen-notes-archive" {
            return Err(AppError::ValidationError(
                "Invalid archive format header".to_string(),
            ));
        }

        let mut total_attachments = 0;
        let mut previews = Vec::new();

        for note in &archive.notes {
            total_attachments += note.attachments.len();

            let id_match = existing_notes.iter().any(|n| n.id == note.id);
            let title_match = existing_notes.iter().any(|n| n.title == note.title);

            let (has_collision, collision_type) = if id_match {
                (true, Some("id_match".to_string()))
            } else if title_match {
                (true, Some("title_match".to_string()))
            } else {
                (false, None)
            };

            let snippet = if note.plain_text.len() > 100 {
                format!("{}…", &note.plain_text[..100])
            } else {
                note.plain_text.clone()
            };

            previews.push(ImportNotePreview {
                id: note.id.clone(),
                title: note.title.clone(),
                plain_text_snippet: snippet,
                has_collision,
                collision_type,
                attachments_count: note.attachments.len(),
            });
        }

        Ok(ImportPreview {
            total_notes: archive.notes.len(),
            total_attachments,
            notes: previews,
        })
    }

    pub fn import_archive(
        &self,
        archive_json: &str,
        strategy: &str, // "skip" | "overwrite" | "keep_both"
    ) -> Result<ImportResult, AppError> {
        let archive: LumenArchive = serde_json::from_str(archive_json)
            .map_err(|e| AppError::ValidationError(format!("Invalid archive format: {}", e)))?;

        let mut imported_count = 0;
        let mut skipped_count = 0;
        let mut overwritten_count = 0;

        for note in archive.notes {
            // Verify valid JSON
            let _val: serde_json::Value =
                serde_json::from_str(&note.document_json).map_err(|e| {
                    AppError::ValidationError(format!("Invalid note JSON document: {}", e))
                })?;

            let existing = self
                .storage
                .with_conn(|conn| NoteRepository::get_by_id(conn, &note.id))?;

            if let Some(existing_note) = existing {
                match strategy {
                    "skip" => {
                        skipped_count += 1;
                        continue;
                    }
                    "overwrite" => {
                        self.storage.with_conn(|conn| {
                            NoteRepository::save(
                                conn,
                                &SaveNotePayload {
                                    note_id: existing_note.id.clone(),
                                    expected_revision: existing_note.revision,
                                    title: note.title.clone(),
                                    document_json: note.document_json.clone(),
                                    plain_text: note.plain_text.clone(),
                                },
                            )
                        })?;
                        overwritten_count += 1;
                    }
                    _ => {
                        // "keep_both": create note with new UUID
                        let new_id = Uuid::new_v4().to_string();
                        let title = format!("{} (Imported)", note.title);
                        let new_note = Note {
                            id: new_id.clone(),
                            title,
                            document_json: note.document_json.clone(),
                            document_version: note.document_version,
                            plain_text: note.plain_text.clone(),
                            folder_id: None,
                            pinned: note.pinned,
                            favorite: note.favorite,
                            archived: note.archived,
                            created_at: note.created_at.clone(),
                            modified_at: Utc::now().to_rfc3339(),
                            deleted_at: None,
                            revision: 1,
                        };

                        self.storage
                            .with_conn(|conn| NoteRepository::create(conn, &new_note))?;

                        for att in note.attachments {
                            if let Ok(bytes) = BASE64_STANDARD.decode(&att.data_base64) {
                                let _ = self.attachment_service.add_attachment(
                                    &new_id,
                                    &att.original_name,
                                    &att.mime_type,
                                    &bytes,
                                );
                            }
                        }
                        imported_count += 1;
                        continue;
                    }
                }
            } else {
                // Note does not exist: import directly
                let imported_note = Note {
                    id: note.id.clone(),
                    title: note.title.clone(),
                    document_json: note.document_json.clone(),
                    document_version: note.document_version,
                    plain_text: note.plain_text.clone(),
                    folder_id: None,
                    pinned: note.pinned,
                    favorite: note.favorite,
                    archived: note.archived,
                    created_at: note.created_at.clone(),
                    modified_at: note.modified_at.clone(),
                    deleted_at: None,
                    revision: 1,
                };

                self.storage
                    .with_conn(|conn| NoteRepository::create(conn, &imported_note))?;
                imported_count += 1;
            }

            // Import attachments for the note
            for att in note.attachments {
                if let Ok(bytes) = BASE64_STANDARD.decode(&att.data_base64) {
                    let _ = self.attachment_service.add_attachment(
                        &note.id,
                        &att.original_name,
                        &att.mime_type,
                        &bytes,
                    );
                }
            }
        }

        Ok(ImportResult {
            imported_count,
            skipped_count,
            overwritten_count,
        })
    }
}

fn html_escape(s: &str) -> String {
    s.replace('&', "&amp;")
        .replace('<', "&lt;")
        .replace('>', "&gt;")
        .replace('"', "&quot;")
        .replace('\'', "&#39;")
}
