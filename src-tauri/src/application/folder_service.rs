use crate::domain::{Folder, error::AppError};
use crate::storage::{StorageManager, folders::FolderRepository};

pub struct FolderService;

impl FolderService {
    pub fn create_folder(
        storage: &StorageManager,
        name: String,
        parent_id: Option<String>,
    ) -> Result<Folder, AppError> {
        storage.with_conn(|conn| FolderRepository::create(conn, &name, parent_id.as_deref()))
    }

    pub fn update_folder(
        storage: &StorageManager,
        id: String,
        name: String,
        parent_id: Option<String>,
    ) -> Result<Folder, AppError> {
        storage.with_conn(|conn| FolderRepository::update(conn, &id, &name, parent_id.as_deref()))
    }

    pub fn list_folders(storage: &StorageManager) -> Result<Vec<Folder>, AppError> {
        storage.with_conn(FolderRepository::list)
    }

    pub fn delete_folder(storage: &StorageManager, id: String) -> Result<(), AppError> {
        storage.with_conn(|conn| FolderRepository::delete(conn, &id))
    }
}
