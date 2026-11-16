use crate::domain::{AppSettings, Snapshot, error::AppError};
use crate::storage::{StorageManager, settings::SettingsRepository, snapshots::SnapshotRepository};
use sha2::{Digest, Sha256};
use std::path::Path;

pub struct BackupService;

impl BackupService {
    pub fn get_settings(storage: &StorageManager) -> AppSettings {
        storage
            .with_conn(|conn| Ok(SettingsRepository::get(conn)))
            .unwrap_or_default()
    }

    pub fn update_settings(
        storage: &StorageManager,
        settings: AppSettings,
    ) -> Result<(), AppError> {
        storage.with_conn(|conn| SettingsRepository::set(conn, &settings))
    }

    pub fn list_snapshots(
        storage: &StorageManager,
        note_id: &str,
    ) -> Result<Vec<Snapshot>, AppError> {
        storage.with_conn(|conn| SnapshotRepository::list_for_note(conn, note_id))
    }

    pub fn is_snapshot_content_identical(
        latest: &Snapshot,
        new_title: &str,
        new_document_json: &str,
    ) -> bool {
        // Compare trimmed titles
        if latest.title.trim_end() != new_title.trim_end() {
            return false;
        }

        // Fast path: exact match or trimmed exact match
        if latest.document_json.trim_end() == new_document_json.trim_end() {
            return true;
        }

        // Parse both as serde_json::Value and normalize trailing empty blocks and trailing whitespace
        let parse_latest = serde_json::from_str::<serde_json::Value>(&latest.document_json);
        let parse_new = serde_json::from_str::<serde_json::Value>(new_document_json);

        if let (Ok(mut val_latest), Ok(mut val_new)) = (parse_latest, parse_new) {
            Self::normalize_doc_value(&mut val_latest);
            Self::normalize_doc_value(&mut val_new);
            val_latest == val_new
        } else {
            false
        }
    }

    fn normalize_doc_value(val: &mut serde_json::Value) {
        if let serde_json::Value::Object(map) = val {
            if let Some(serde_json::Value::Array(content)) = map.get_mut("content") {
                for child in content.iter_mut() {
                    Self::normalize_doc_value(child);
                }
                // Strip trailing empty/whitespace blocks at the end of the content array
                while let Some(last) = content.last() {
                    if Self::is_empty_or_whitespace_node(last) {
                        content.pop();
                    } else {
                        break;
                    }
                }
                // Trim trailing whitespace from the last remaining text node
                if let Some(last) = content.last_mut() {
                    Self::trim_end_last_text(last);
                }
            }
        }
    }

    fn is_empty_or_whitespace_node(val: &serde_json::Value) -> bool {
        if let serde_json::Value::Object(map) = val {
            let node_type = map.get("type").and_then(|v| v.as_str()).unwrap_or("");
            if node_type == "paragraph" {
                match map.get("content") {
                    None => true,
                    Some(serde_json::Value::Array(arr)) => {
                        arr.is_empty() || arr.iter().all(Self::is_empty_or_whitespace_node)
                    }
                    _ => false,
                }
            } else if node_type == "text" {
                map.get("text")
                    .and_then(|v| v.as_str())
                    .map(|s| s.trim().is_empty())
                    .unwrap_or(true)
            } else {
                false
            }
        } else {
            false
        }
    }

    fn trim_end_last_text(val: &mut serde_json::Value) {
        if let serde_json::Value::Object(map) = val {
            if let Some(serde_json::Value::Array(content)) = map.get_mut("content") {
                if let Some(last) = content.last_mut() {
                    Self::trim_end_last_text(last);
                }
            } else if let Some(serde_json::Value::String(text)) = map.get_mut("text") {
                *text = text.trim_end().to_string();
            }
        }
    }

    pub fn create_snapshot(
        storage: &StorageManager,
        note_id: &str,
        title: &str,
        document_json: &str,
        revision: i64,
    ) -> Result<Snapshot, AppError> {
        let existing = Self::list_snapshots(storage, note_id)?;
        if let Some(latest) = existing.first() {
            if Self::is_snapshot_content_identical(latest, title, document_json) {
                let mut snap = latest.clone();
                snap.is_new = false;
                return Ok(snap);
            }
        }

        storage.with_conn(|conn| {
            let mut snap = SnapshotRepository::create(conn, note_id, title, document_json, 1, revision)?;
            snap.is_new = true;
            Ok(snap)
        })
    }

    pub fn restore_snapshot(
        storage: &StorageManager,
        snapshot_id: &str,
    ) -> Result<crate::domain::Note, AppError> {
        let snapshot = storage
            .with_conn(|conn| SnapshotRepository::get_by_id(conn, snapshot_id))?
            .ok_or_else(|| AppError::NotFound(format!("Snapshot {} not found", snapshot_id)))?;

        let note = storage
            .with_conn(|conn| {
                crate::storage::notes::NoteRepository::get_by_id(conn, &snapshot.note_id)
            })?
            .ok_or_else(|| AppError::NotFound(format!("Note {} not found", snapshot.note_id)))?;

        // Save note using snapshot's title and document
        storage.with_conn(|conn| {
            crate::storage::notes::NoteRepository::save(
                conn,
                &crate::domain::SaveNotePayload {
                    note_id: note.id.clone(),
                    expected_revision: note.revision,
                    title: snapshot.title.clone(),
                    document_json: snapshot.document_json.clone(),
                    plain_text: snapshot.title.clone(),
                },
            )
        })?;

        storage
            .with_conn(|conn| crate::storage::notes::NoteRepository::get_by_id(conn, &note.id))?
            .ok_or_else(|| AppError::NotFound("Restored note not found".to_string()))
    }

    /// Creates a transactionally consistent SQLite backup using SQLite's VACUUM INTO command.
    /// Does not copy live WAL files uncheckpointed.
    pub fn backup_database(
        storage: &StorageManager,
        destination: &Path,
    ) -> Result<String, AppError> {
        if destination.exists() {
            std::fs::remove_file(destination)?;
        }

        let dest_str = destination.to_string_lossy().to_string();

        storage.with_conn(|conn| {
            conn.execute("VACUUM INTO ?1", rusqlite::params![dest_str])
                .map_err(|e| AppError::StorageError(format!("VACUUM backup failed: {e}")))?;
            Ok(())
        })?;

        // Calculate backup checksum
        let backup_bytes = std::fs::read(destination)?;
        let mut hasher = Sha256::new();
        hasher.update(&backup_bytes);
        let checksum = format!("{:x}", hasher.finalize());

        Ok(checksum)
    }
}
