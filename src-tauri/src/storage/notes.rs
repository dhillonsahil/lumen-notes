use crate::domain::{
    Note, NoteFilter, NoteSummary, SaveNotePayload, SaveNoteResult, error::AppError,
};
use chrono::Utc;
use rusqlite::{Connection, params};

pub struct NoteRepository;

impl NoteRepository {
    pub fn create(conn: &Connection, note: &Note) -> Result<Note, AppError> {
        conn.execute(
            "INSERT INTO notes (
                id, title, document_json, document_version, plain_text,
                folder_id, pinned, favorite, archived, created_at, modified_at,
                deleted_at, revision
            ) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, ?13)",
            params![
                note.id,
                note.title,
                note.document_json,
                note.document_version,
                note.plain_text,
                note.folder_id,
                if note.pinned { 1 } else { 0 },
                if note.favorite { 1 } else { 0 },
                if note.archived { 1 } else { 0 },
                note.created_at,
                note.modified_at,
                note.deleted_at,
                note.revision,
            ],
        )?;

        Ok(note.clone())
    }

    pub fn get_by_id(conn: &Connection, id: &str) -> Result<Option<Note>, AppError> {
        let mut stmt = conn.prepare(
            "SELECT id, title, document_json, document_version, plain_text,
                    folder_id, pinned, favorite, archived, created_at, modified_at,
                    deleted_at, revision
             FROM notes WHERE id = ?1",
        )?;

        let mut rows = stmt.query(params![id])?;

        if let Some(row) = rows.next()? {
            let pinned: i64 = row.get(6)?;
            let favorite: i64 = row.get(7)?;
            let archived: i64 = row.get(8)?;

            Ok(Some(Note {
                id: row.get(0)?,
                title: row.get(1)?,
                document_json: row.get(2)?,
                document_version: row.get(3)?,
                plain_text: row.get(4)?,
                folder_id: row.get(5)?,
                pinned: pinned != 0,
                favorite: favorite != 0,
                archived: archived != 0,
                created_at: row.get(9)?,
                modified_at: row.get(10)?,
                deleted_at: row.get(11)?,
                revision: row.get(12)?,
            }))
        } else {
            Ok(None)
        }
    }

    pub fn list(conn: &Connection, filter: &NoteFilter) -> Result<Vec<NoteSummary>, AppError> {
        let mut query = String::from(
            "SELECT id, title, plain_text, folder_id, pinned, favorite, archived,
                    created_at, modified_at, deleted_at, revision
             FROM notes WHERE 1=1",
        );

        let mut params_vec: Vec<Box<dyn rusqlite::ToSql>> = Vec::new();

        if let Some(is_trash) = filter.is_trash {
            if is_trash {
                query.push_str(" AND deleted_at IS NOT NULL");
            } else {
                query.push_str(" AND deleted_at IS NULL");
            }
        } else {
            query.push_str(" AND deleted_at IS NULL");
        }

        if let Some(folder_id) = &filter.folder_id {
            params_vec.push(Box::new(folder_id.clone()));
            query.push_str(&format!(" AND folder_id = ?{}", params_vec.len()));
        }

        if filter.only_favorites == Some(true) {
            query.push_str(" AND favorite = 1");
        }

        if filter.only_pinned == Some(true) {
            query.push_str(" AND pinned = 1");
        }

        if filter.only_archived == Some(true) {
            query.push_str(" AND archived = 1");
        } else if filter.include_archived == Some(false) {
            query.push_str(" AND archived = 0");
        }

        if let Some(search) = &filter.search_query {
            let trimmed = search.trim();
            if !trimmed.is_empty() {
                let pattern = format!("%{trimmed}%");
                params_vec.push(Box::new(pattern.clone()));
                let p1 = params_vec.len();
                params_vec.push(Box::new(pattern));
                let p2 = params_vec.len();
                query.push_str(&format!(" AND (title LIKE ?{p1} OR plain_text LIKE ?{p2})"));
            }
        }

        // Sorting: pinned notes always surface at the top first, then user sort
        query.push_str(" ORDER BY pinned DESC");

        let sort_order = if filter.sort_order.as_deref() == Some("asc") {
            "ASC"
        } else {
            "DESC"
        };

        match filter.sort_by.as_deref() {
            Some("created_at") => query.push_str(&format!(", created_at {sort_order}")),
            Some("title") => query.push_str(&format!(", title COLLATE NOCASE {sort_order}")),
            _ => query.push_str(&format!(", modified_at {sort_order}")),
        }

        let mut stmt = conn.prepare(&query)?;
        let param_refs: Vec<&dyn rusqlite::ToSql> = params_vec.iter().map(|b| b.as_ref()).collect();

        let mut rows = stmt.query(param_refs.as_slice())?;
        let mut summaries = Vec::new();

        while let Some(row) = rows.next()? {
            let plain_text: String = row.get(2)?;
            let snippet = if plain_text.len() > 160 {
                let end = plain_text
                    .char_indices()
                    .map(|(i, _)| i)
                    .nth(160)
                    .unwrap_or(plain_text.len());
                format!("{}…", &plain_text[..end])
            } else {
                plain_text
            };

            let pinned: i64 = row.get(4)?;
            let favorite: i64 = row.get(5)?;
            let archived: i64 = row.get(6)?;
            let deleted_at: Option<String> = row.get(9)?;

            summaries.push(NoteSummary {
                id: row.get(0)?,
                title: row.get(1)?,
                plain_text_snippet: snippet,
                folder_id: row.get(3)?,
                pinned: pinned != 0,
                favorite: favorite != 0,
                archived: archived != 0,
                created_at: row.get(7)?,
                modified_at: row.get(8)?,
                is_deleted: deleted_at.is_some(),
                revision: row.get(10)?,
            });
        }

        Ok(summaries)
    }

    pub fn save(conn: &Connection, payload: &SaveNotePayload) -> Result<SaveNoteResult, AppError> {
        let (current_rev,): (i64,) = conn
            .query_row(
                "SELECT revision FROM notes WHERE id = ?1",
                params![payload.note_id],
                |row| Ok((row.get(0)?,)),
            )
            .map_err(|err| match err {
                rusqlite::Error::QueryReturnedNoRows => {
                    AppError::NotFound(format!("Note {} not found", payload.note_id))
                }
                other => AppError::StorageError(other.to_string()),
            })?;

        if payload.expected_revision != current_rev {
            return Err(AppError::RevisionConflict {
                expected: payload.expected_revision,
                actual: current_rev,
            });
        }

        let new_revision = current_rev + 1;
        let modified_at = Utc::now().to_rfc3339();

        let affected = conn.execute(
            "UPDATE notes
             SET title = ?1,
                 document_json = ?2,
                 plain_text = ?3,
                 modified_at = ?4,
                 revision = ?5
             WHERE id = ?6 AND revision = ?7",
            params![
                payload.title,
                payload.document_json,
                payload.plain_text,
                modified_at,
                new_revision,
                payload.note_id,
                current_rev,
            ],
        )?;

        if affected == 0 {
            return Err(AppError::RevisionConflict {
                expected: payload.expected_revision,
                actual: current_rev,
            });
        }

        Ok(SaveNoteResult {
            note_id: payload.note_id.clone(),
            new_revision,
            modified_at,
        })
    }

    pub fn delete(conn: &Connection, id: &str, permanent: bool) -> Result<(), AppError> {
        if permanent {
            let affected = conn.execute("DELETE FROM notes WHERE id = ?1", params![id])?;
            if affected == 0 {
                return Err(AppError::NotFound(format!("Note {id} not found")));
            }
        } else {
            let now = Utc::now().to_rfc3339();
            let affected = conn.execute(
                "UPDATE notes SET deleted_at = ?1 WHERE id = ?2 AND deleted_at IS NULL",
                params![now, id],
            )?;
            if affected == 0 {
                return Err(AppError::NotFound(format!(
                    "Note {id} not found or already deleted"
                )));
            }
        }
        Ok(())
    }

    pub fn restore(conn: &Connection, id: &str) -> Result<(), AppError> {
        let affected = conn.execute(
            "UPDATE notes SET deleted_at = NULL WHERE id = ?1 AND deleted_at IS NOT NULL",
            params![id],
        )?;
        if affected == 0 {
            return Err(AppError::NotFound(format!("Note {id} not found in trash")));
        }
        Ok(())
    }

    pub fn toggle_pin(conn: &Connection, id: &str) -> Result<bool, AppError> {
        let (current_pinned,): (i64,) = conn
            .query_row(
                "SELECT pinned FROM notes WHERE id = ?1",
                params![id],
                |row| Ok((row.get(0)?,)),
            )
            .map_err(|_| AppError::NotFound(format!("Note {id} not found")))?;

        let new_pinned = if current_pinned == 0 { 1 } else { 0 };
        conn.execute(
            "UPDATE notes SET pinned = ?1 WHERE id = ?2",
            params![new_pinned, id],
        )?;
        Ok(new_pinned != 0)
    }

    pub fn toggle_favorite(conn: &Connection, id: &str) -> Result<bool, AppError> {
        let (current_fav,): (i64,) = conn
            .query_row(
                "SELECT favorite FROM notes WHERE id = ?1",
                params![id],
                |row| Ok((row.get(0)?,)),
            )
            .map_err(|_| AppError::NotFound(format!("Note {id} not found")))?;

        let new_fav = if current_fav == 0 { 1 } else { 0 };
        conn.execute(
            "UPDATE notes SET favorite = ?1 WHERE id = ?2",
            params![new_fav, id],
        )?;
        Ok(new_fav != 0)
    }

    pub fn toggle_archive(conn: &Connection, id: &str) -> Result<bool, AppError> {
        let (current_arc,): (i64,) = conn
            .query_row(
                "SELECT archived FROM notes WHERE id = ?1",
                params![id],
                |row| Ok((row.get(0)?,)),
            )
            .map_err(|_| AppError::NotFound(format!("Note {id} not found")))?;

        let new_arc = if current_arc == 0 { 1 } else { 0 };
        conn.execute(
            "UPDATE notes SET archived = ?1 WHERE id = ?2",
            params![new_arc, id],
        )?;
        Ok(new_arc != 0)
    }

    pub fn set_folder(
        conn: &Connection,
        note_id: &str,
        folder_id: Option<&str>,
    ) -> Result<(), AppError> {
        conn.execute(
            "UPDATE notes SET folder_id = ?1 WHERE id = ?2",
            params![folder_id, note_id],
        )?;
        Ok(())
    }
}
