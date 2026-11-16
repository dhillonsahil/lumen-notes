use crate::domain::{Attachment, error::AppError};
use rusqlite::{Connection, params};

pub struct AttachmentRepository;

impl AttachmentRepository {
    pub fn create(conn: &Connection, attachment: &Attachment) -> Result<(), AppError> {
        conn.execute(
            "INSERT INTO attachments (id, note_id, original_name, mime_type, size_bytes, relative_storage_path, checksum, created_at)
             VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8)",
            params![
                attachment.id,
                attachment.note_id,
                attachment.original_name,
                attachment.mime_type,
                attachment.size_bytes,
                attachment.relative_storage_path,
                attachment.checksum,
                attachment.created_at,
            ],
        )?;
        Ok(())
    }

    pub fn get(conn: &Connection, id: &str) -> Result<Option<Attachment>, AppError> {
        let mut stmt = conn.prepare(
            "SELECT id, note_id, original_name, mime_type, size_bytes, relative_storage_path, checksum, created_at
             FROM attachments WHERE id = ?1",
        )?;
        let mut rows = stmt.query(params![id])?;
        if let Some(row) = rows.next()? {
            Ok(Some(Attachment {
                id: row.get(0)?,
                note_id: row.get(1)?,
                original_name: row.get(2)?,
                mime_type: row.get(3)?,
                size_bytes: row.get(4)?,
                relative_storage_path: row.get(5)?,
                checksum: row.get(6)?,
                created_at: row.get(7)?,
            }))
        } else {
            Ok(None)
        }
    }

    pub fn list_for_note(conn: &Connection, note_id: &str) -> Result<Vec<Attachment>, AppError> {
        let mut stmt = conn.prepare(
            "SELECT id, note_id, original_name, mime_type, size_bytes, relative_storage_path, checksum, created_at
             FROM attachments WHERE note_id = ?1 ORDER BY created_at ASC",
        )?;
        let mut rows = stmt.query(params![note_id])?;
        let mut attachments = Vec::new();
        while let Some(row) = rows.next()? {
            attachments.push(Attachment {
                id: row.get(0)?,
                note_id: row.get(1)?,
                original_name: row.get(2)?,
                mime_type: row.get(3)?,
                size_bytes: row.get(4)?,
                relative_storage_path: row.get(5)?,
                checksum: row.get(6)?,
                created_at: row.get(7)?,
            });
        }
        Ok(attachments)
    }

    pub fn delete(conn: &Connection, id: &str) -> Result<bool, AppError> {
        let rows = conn.execute("DELETE FROM attachments WHERE id = ?1", params![id])?;
        Ok(rows > 0)
    }
}
