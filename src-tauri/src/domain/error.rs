use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(tag = "kind", content = "details")]
pub enum AppError {
    NotFound(String),
    RevisionConflict { expected: i64, actual: i64 },
    ValidationError(String),
    FolderCycleDetected,
    StorageError(String),
    IoError(String),
}

impl std::fmt::Display for AppError {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            AppError::NotFound(msg) => write!(f, "Not found: {msg}"),
            AppError::RevisionConflict { expected, actual } => {
                write!(
                    f,
                    "Conflict: expected revision {expected}, but current is {actual}"
                )
            }
            AppError::ValidationError(msg) => write!(f, "Validation error: {msg}"),
            AppError::FolderCycleDetected => write!(f, "Folder hierarchy cycle detected"),
            AppError::StorageError(msg) => write!(f, "Storage error: {msg}"),
            AppError::IoError(msg) => write!(f, "IO error: {msg}"),
        }
    }
}

impl std::error::Error for AppError {}

impl From<rusqlite::Error> for AppError {
    fn from(err: rusqlite::Error) -> Self {
        AppError::StorageError(err.to_string())
    }
}

impl From<std::io::Error> for AppError {
    fn from(err: std::io::Error) -> Self {
        AppError::IoError(err.to_string())
    }
}
