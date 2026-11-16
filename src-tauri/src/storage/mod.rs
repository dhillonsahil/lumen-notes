pub mod attachments;
pub mod folders;
pub mod notes;
pub mod schema;
pub mod settings;
pub mod snapshots;
pub mod tags;

use crate::domain::error::AppError;
use rusqlite::Connection;
use std::path::{Path, PathBuf};
use std::sync::Mutex;

pub struct StorageManager {
    conn: Mutex<Connection>,
    db_path: Option<PathBuf>,
}

impl StorageManager {
    pub fn new_in_memory() -> Result<Self, AppError> {
        let mut conn = Connection::open_in_memory()?;
        schema::initialize_database(&mut conn)?;
        Ok(Self {
            conn: Mutex::new(conn),
            db_path: None,
        })
    }

    pub fn new_at_path(path: &Path) -> Result<Self, AppError> {
        if let Some(parent) = path.parent() {
            std::fs::create_dir_all(parent)?;
        }
        let mut conn = Connection::open(path)?;
        schema::initialize_database(&mut conn)?;
        Ok(Self {
            conn: Mutex::new(conn),
            db_path: Some(path.to_path_buf()),
        })
    }

    pub fn get_db_path(&self) -> Option<String> {
        self.db_path
            .as_ref()
            .map(|p| p.to_string_lossy().to_string())
    }

    pub fn with_conn<F, R>(&self, f: F) -> Result<R, AppError>
    where
        F: FnOnce(&Connection) -> Result<R, AppError>,
    {
        let conn = self
            .conn
            .lock()
            .map_err(|e| AppError::StorageError(e.to_string()))?;
        f(&conn)
    }

    pub fn with_mut_conn<F, R>(&self, f: F) -> Result<R, AppError>
    where
        F: FnOnce(&mut Connection) -> Result<R, AppError>,
    {
        let mut conn = self
            .conn
            .lock()
            .map_err(|e| AppError::StorageError(e.to_string()))?;
        f(&mut conn)
    }
}
