use crate::domain::{Snapshot, error::AppError};
use chrono::Utc;
use rusqlite::{Connection, params};
use uuid::Uuid;

pub struct SnapshotRepository;

impl SnapshotRepository {
    pub fn create(
        conn: &Connection,
        note_id: &str,
        title: &str,
        document_json: &str,
        document_version: i64,
        revision: i64,
    ) -> Result<Snapshot, AppError> {
        let id = Uuid::new_v4().to_string();
        let now = Utc::now().to_rfc3339();

        conn.execute(
            "INSERT INTO snapshots (id, note_id, title, document_json, document_version, created_at, revision)
             VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7)",
            params![id, note_id, title, document_json, document_version, now, revision],
        )?;

        Ok(Snapshot {
            id,
            note_id: note_id.to_string(),
            title: title.to_string(),
            document_json: document_json.to_string(),
            document_version,
            created_at: now,
            revision,
        })
    }

    pub fn list_for_note(conn: &Connection, note_id: &str) -> Result<Vec<Snapshot>, AppError> {
        let mut stmt = conn.prepare(
            "SELECT id, note_id, title, document_json, document_version, created_at, revision
             FROM snapshots WHERE note_id = ?1 ORDER BY revision DESC, created_at DESC",
        )?;

        let mut rows = stmt.query(params![note_id])?;
        let mut snapshots = Vec::new();

        while let Some(row) = rows.next()? {
            snapshots.push(Snapshot {
                id: row.get(0)?,
                note_id: row.get(1)?,
                title: row.get(2)?,
                document_json: row.get(3)?,
                document_version: row.get(4)?,
                created_at: row.get(5)?,
                revision: row.get(6)?,
            });
        }

        Ok(snapshots)
    }

    pub fn get_by_id(conn: &Connection, id: &str) -> Result<Option<Snapshot>, AppError> {
        let mut stmt = conn.prepare(
            "SELECT id, note_id, title, document_json, document_version, created_at, revision
             FROM snapshots WHERE id = ?1",
        )?;

        let mut rows = stmt.query(params![id])?;
        if let Some(row) = rows.next()? {
            Ok(Some(Snapshot {
                id: row.get(0)?,
                note_id: row.get(1)?,
                title: row.get(2)?,
                document_json: row.get(3)?,
                document_version: row.get(4)?,
                created_at: row.get(5)?,
                revision: row.get(6)?,
            }))
        } else {
            Ok(None)
        }
    }
}
