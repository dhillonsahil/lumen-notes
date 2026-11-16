use crate::domain::{Tag, error::AppError};
use rusqlite::{Connection, params};
use uuid::Uuid;

pub struct TagRepository;

impl TagRepository {
    pub fn list(conn: &Connection) -> Result<Vec<Tag>, AppError> {
        let mut stmt = conn.prepare(
            "SELECT id, name, normalized_name FROM tags ORDER BY name COLLATE NOCASE ASC",
        )?;
        let mut rows = stmt.query([])?;
        let mut tags = Vec::new();
        while let Some(row) = rows.next()? {
            tags.push(Tag {
                id: row.get(0)?,
                name: row.get(1)?,
                normalized_name: row.get(2)?,
            });
        }
        Ok(tags)
    }

    pub fn get_or_create(conn: &Connection, name: &str) -> Result<Tag, AppError> {
        let trimmed = name.trim();
        if trimmed.is_empty() {
            return Err(AppError::ValidationError(
                "Tag name cannot be empty".to_string(),
            ));
        }
        let normalized = trimmed.to_lowercase();

        let existing: Option<Tag> = conn
            .query_row(
                "SELECT id, name, normalized_name FROM tags WHERE normalized_name = ?1",
                params![normalized],
                |row| {
                    Ok(Tag {
                        id: row.get(0)?,
                        name: row.get(1)?,
                        normalized_name: row.get(2)?,
                    })
                },
            )
            .ok();

        if let Some(tag) = existing {
            return Ok(tag);
        }

        let id = Uuid::new_v4().to_string();
        conn.execute(
            "INSERT INTO tags (id, name, normalized_name) VALUES (?1, ?2, ?3)",
            params![id, trimmed, normalized],
        )?;

        Ok(Tag {
            id,
            name: trimmed.to_string(),
            normalized_name: normalized,
        })
    }

    pub fn add_to_note(conn: &Connection, note_id: &str, tag_id: &str) -> Result<(), AppError> {
        conn.execute(
            "INSERT OR IGNORE INTO note_tags (note_id, tag_id) VALUES (?1, ?2)",
            params![note_id, tag_id],
        )?;
        Ok(())
    }

    pub fn remove_from_note(
        conn: &Connection,
        note_id: &str,
        tag_id: &str,
    ) -> Result<(), AppError> {
        conn.execute(
            "DELETE FROM note_tags WHERE note_id = ?1 AND tag_id = ?2",
            params![note_id, tag_id],
        )?;
        Ok(())
    }

    pub fn get_for_note(conn: &Connection, note_id: &str) -> Result<Vec<Tag>, AppError> {
        let mut stmt = conn.prepare(
            "SELECT t.id, t.name, t.normalized_name
             FROM tags t
             JOIN note_tags nt ON t.id = nt.tag_id
             WHERE nt.note_id = ?1
             ORDER BY t.name COLLATE NOCASE ASC",
        )?;
        let mut rows = stmt.query(params![note_id])?;
        let mut tags = Vec::new();
        while let Some(row) = rows.next()? {
            tags.push(Tag {
                id: row.get(0)?,
                name: row.get(1)?,
                normalized_name: row.get(2)?,
            });
        }
        Ok(tags)
    }
}
