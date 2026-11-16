use crate::domain::{Folder, error::AppError};
use chrono::Utc;
use rusqlite::{Connection, params};
use uuid::Uuid;

pub struct FolderRepository;

impl FolderRepository {
    pub fn create(
        conn: &Connection,
        name: &str,
        parent_id: Option<&str>,
    ) -> Result<Folder, AppError> {
        let trimmed_name = name.trim();
        if trimmed_name.is_empty() {
            return Err(AppError::ValidationError(
                "Folder name cannot be empty".to_string(),
            ));
        }

        if let Some(pid) = parent_id {
            // Verify parent exists
            let exists: bool = conn
                .query_row(
                    "SELECT EXISTS(SELECT 1 FROM folders WHERE id = ?1)",
                    params![pid],
                    |row| row.get(0),
                )
                .unwrap_or(false);

            if !exists {
                return Err(AppError::NotFound(format!(
                    "Parent folder {pid} does not exist"
                )));
            }
        }

        let id = Uuid::new_v4().to_string();
        let now = Utc::now().to_rfc3339();

        let max_sort: i64 = conn
            .query_row(
                "SELECT COALESCE(MAX(sort_order), 0) FROM folders WHERE parent_id IS ?1",
                params![parent_id],
                |row| row.get(0),
            )
            .unwrap_or(0);

        let sort_order = max_sort + 1;

        conn.execute(
            "INSERT INTO folders (id, parent_id, name, sort_order, created_at, modified_at)
             VALUES (?1, ?2, ?3, ?4, ?5, ?6)",
            params![id, parent_id, trimmed_name, sort_order, now, now],
        )?;

        Ok(Folder {
            id,
            parent_id: parent_id.map(|s| s.to_string()),
            name: trimmed_name.to_string(),
            sort_order,
            created_at: now.clone(),
            modified_at: now,
        })
    }

    pub fn update(
        conn: &Connection,
        id: &str,
        name: &str,
        new_parent_id: Option<&str>,
    ) -> Result<Folder, AppError> {
        let trimmed_name = name.trim();
        if trimmed_name.is_empty() {
            return Err(AppError::ValidationError(
                "Folder name cannot be empty".to_string(),
            ));
        }

        // Verify folder exists
        let folder = Self::get_by_id(conn, id)?
            .ok_or_else(|| AppError::NotFound(format!("Folder {id} not found")))?;

        // Cycle prevention: new_parent_id cannot be self
        if let Some(pid) = new_parent_id {
            if pid == id {
                return Err(AppError::FolderCycleDetected);
            }

            // Check if new_parent_id is a descendant of id
            let mut curr = Some(pid.to_string());
            while let Some(current_pid) = curr {
                if current_pid == id {
                    return Err(AppError::FolderCycleDetected);
                }
                let next_parent: Option<String> = conn
                    .query_row(
                        "SELECT parent_id FROM folders WHERE id = ?1",
                        params![current_pid],
                        |row| row.get(0),
                    )
                    .unwrap_or(None);
                curr = next_parent;
            }
        }

        let now = Utc::now().to_rfc3339();

        conn.execute(
            "UPDATE folders SET name = ?1, parent_id = ?2, modified_at = ?3 WHERE id = ?4",
            params![trimmed_name, new_parent_id, now, id],
        )?;

        Ok(Folder {
            id: id.to_string(),
            parent_id: new_parent_id.map(|s| s.to_string()),
            name: trimmed_name.to_string(),
            sort_order: folder.sort_order,
            created_at: folder.created_at,
            modified_at: now,
        })
    }

    pub fn get_by_id(conn: &Connection, id: &str) -> Result<Option<Folder>, AppError> {
        let mut stmt = conn.prepare(
            "SELECT id, parent_id, name, sort_order, created_at, modified_at
             FROM folders WHERE id = ?1",
        )?;

        let mut rows = stmt.query(params![id])?;
        if let Some(row) = rows.next()? {
            Ok(Some(Folder {
                id: row.get(0)?,
                parent_id: row.get(1)?,
                name: row.get(2)?,
                sort_order: row.get(3)?,
                created_at: row.get(4)?,
                modified_at: row.get(5)?,
            }))
        } else {
            Ok(None)
        }
    }

    pub fn list(conn: &Connection) -> Result<Vec<Folder>, AppError> {
        let mut stmt = conn.prepare(
            "SELECT id, parent_id, name, sort_order, created_at, modified_at
             FROM folders ORDER BY sort_order ASC, name COLLATE NOCASE ASC",
        )?;

        let mut rows = stmt.query([])?;
        let mut folders = Vec::new();

        while let Some(row) = rows.next()? {
            folders.push(Folder {
                id: row.get(0)?,
                parent_id: row.get(1)?,
                name: row.get(2)?,
                sort_order: row.get(3)?,
                created_at: row.get(4)?,
                modified_at: row.get(5)?,
            });
        }

        Ok(folders)
    }

    pub fn delete(conn: &Connection, id: &str) -> Result<(), AppError> {
        // Child folders have parent_id set to NULL automatically via FOREIGN KEY ON DELETE SET NULL
        // Notes have folder_id set to NULL automatically via FOREIGN KEY ON DELETE SET NULL
        let affected = conn.execute("DELETE FROM folders WHERE id = ?1", params![id])?;
        if affected == 0 {
            return Err(AppError::NotFound(format!("Folder {id} not found")));
        }
        Ok(())
    }
}
