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

    pub fn create_snapshot(
        storage: &StorageManager,
        note_id: &str,
        title: &str,
        document_json: &str,
        revision: i64,
    ) -> Result<Snapshot, AppError> {
        storage.with_conn(|conn| {
            SnapshotRepository::create(conn, note_id, title, document_json, 1, revision)
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
