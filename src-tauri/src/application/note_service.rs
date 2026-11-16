use crate::domain::{
    Note, NoteFilter, NoteSummary, SaveNotePayload, SaveNoteResult, error::AppError,
};
use crate::storage::{StorageManager, notes::NoteRepository, snapshots::SnapshotRepository};
use chrono::Utc;
use uuid::Uuid;

pub struct NoteService;

impl NoteService {
    pub fn create_note(
        storage: &StorageManager,
        title: Option<String>,
        folder_id: Option<String>,
    ) -> Result<Note, AppError> {
        let id = Uuid::new_v4().to_string();
        let now = Utc::now().to_rfc3339();
        let initial_title = title.unwrap_or_default();
        let initial_doc = serde_json::json!({
            "type": "doc",
            "content": [{ "type": "paragraph" }]
        })
        .to_string();

        let note = Note {
            id,
            title: initial_title,
            document_json: initial_doc,
            document_version: 1,
            plain_text: String::new(),
            folder_id,
            pinned: false,
            favorite: false,
            archived: false,
            created_at: now.clone(),
            modified_at: now,
            deleted_at: None,
            revision: 1,
        };

        storage.with_conn(|conn| NoteRepository::create(conn, &note))
    }

    pub fn get_note(storage: &StorageManager, id: &str) -> Result<Option<Note>, AppError> {
        if id.trim().is_empty() {
            return Err(AppError::ValidationError(
                "Note ID cannot be empty".to_string(),
            ));
        }
        storage.with_conn(|conn| NoteRepository::get_by_id(conn, id))
    }

    pub fn list_notes(
        storage: &StorageManager,
        filter: NoteFilter,
    ) -> Result<Vec<NoteSummary>, AppError> {
        storage.with_conn(|conn| NoteRepository::list(conn, &filter))
    }

    pub fn save_note(
        storage: &StorageManager,
        payload: SaveNotePayload,
    ) -> Result<SaveNoteResult, AppError> {
        if payload.note_id.trim().is_empty() {
            return Err(AppError::ValidationError(
                "Note ID cannot be empty".to_string(),
            ));
        }
        if payload.expected_revision < 1 {
            return Err(AppError::ValidationError(
                "Expected revision must be positive".to_string(),
            ));
        }

        // Validate JSON payload
        if serde_json::from_str::<serde_json::Value>(&payload.document_json).is_err() {
            return Err(AppError::ValidationError(
                "Invalid document JSON payload".to_string(),
            ));
        }

        let result = storage.with_conn(|conn| NoteRepository::save(conn, &payload))?;

        // Periodic snapshot creation for safety (every 10 revisions)
        if result.new_revision % 10 == 0 {
            let _ = storage.with_conn(|conn| {
                SnapshotRepository::create(
                    conn,
                    &payload.note_id,
                    &payload.title,
                    &payload.document_json,
                    1,
                    result.new_revision,
                )
            });
        }

        Ok(result)
    }

    pub fn delete_note(
        storage: &StorageManager,
        id: &str,
        permanent: bool,
    ) -> Result<(), AppError> {
        storage.with_conn(|conn| NoteRepository::delete(conn, id, permanent))
    }

    pub fn restore_note(storage: &StorageManager, id: &str) -> Result<(), AppError> {
        storage.with_conn(|conn| NoteRepository::restore(conn, id))
    }

    pub fn duplicate_note(storage: &StorageManager, id: &str) -> Result<Note, AppError> {
        let original = Self::get_note(storage, id)?
            .ok_or_else(|| AppError::NotFound(format!("Note {id} not found")))?;

        let new_id = Uuid::new_v4().to_string();
        let now = Utc::now().to_rfc3339();
        let new_title = if original.title.is_empty() {
            "Copy of Note".to_string()
        } else {
            format!("Copy of {}", original.title)
        };

        let new_note = Note {
            id: new_id,
            title: new_title,
            document_json: original.document_json,
            document_version: original.document_version,
            plain_text: original.plain_text,
            folder_id: original.folder_id,
            pinned: false,
            favorite: original.favorite,
            archived: false,
            created_at: now.clone(),
            modified_at: now,
            deleted_at: None,
            revision: 1,
        };

        storage.with_conn(|conn| NoteRepository::create(conn, &new_note))
    }

    pub fn toggle_pin(storage: &StorageManager, id: &str) -> Result<bool, AppError> {
        storage.with_conn(|conn| NoteRepository::toggle_pin(conn, id))
    }

    pub fn toggle_favorite(storage: &StorageManager, id: &str) -> Result<bool, AppError> {
        storage.with_conn(|conn| NoteRepository::toggle_favorite(conn, id))
    }

    pub fn toggle_archive(storage: &StorageManager, id: &str) -> Result<bool, AppError> {
        storage.with_conn(|conn| NoteRepository::toggle_archive(conn, id))
    }

    pub fn set_folder(
        storage: &StorageManager,
        note_id: &str,
        folder_id: Option<String>,
    ) -> Result<(), AppError> {
        storage.with_conn(|conn| NoteRepository::set_folder(conn, note_id, folder_id.as_deref()))
    }
}
