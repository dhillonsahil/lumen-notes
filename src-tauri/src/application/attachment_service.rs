use crate::domain::{Attachment, error::AppError};
use crate::storage::StorageManager;
use crate::storage::attachments::AttachmentRepository;
use base64::prelude::*;
use chrono::Utc;
use sha2::{Digest, Sha256};
use std::fs;
use std::path::{Path, PathBuf};
use std::sync::Arc;
use uuid::Uuid;

const MAX_ATTACHMENT_SIZE: usize = 25 * 1024 * 1024; // 25 MB

pub struct AttachmentService {
    storage: Arc<StorageManager>,
    attachments_dir: PathBuf,
}

impl AttachmentService {
    pub fn new(storage: Arc<StorageManager>, data_dir: &Path) -> Result<Self, AppError> {
        let attachments_dir = data_dir.join("attachments");
        fs::create_dir_all(&attachments_dir)?;
        Ok(Self {
            storage,
            attachments_dir,
        })
    }

    pub fn get_attachments_dir(&self) -> &Path {
        &self.attachments_dir
    }

    pub fn add_attachment(
        &self,
        note_id: &str,
        original_name: &str,
        mime_type: &str,
        data: &[u8],
    ) -> Result<Attachment, AppError> {
        if data.is_empty() {
            return Err(AppError::ValidationError(
                "Attachment cannot be empty".to_string(),
            ));
        }
        if data.len() > MAX_ATTACHMENT_SIZE {
            return Err(AppError::ValidationError(format!(
                "Attachment exceeds maximum allowed size of 25MB (got {} bytes)",
                data.len()
            )));
        }

        // Compute SHA-256
        let mut hasher = Sha256::new();
        hasher.update(data);
        let checksum = format!("{:x}", hasher.finalize());

        let id = Uuid::new_v4().to_string();

        // Extract safe alphanumeric extension (max 8 chars)
        let ext = Path::new(original_name)
            .extension()
            .and_then(|s| s.to_str())
            .map(|s| {
                s.chars()
                    .filter(|c| c.is_alphanumeric())
                    .take(8)
                    .collect::<String>()
            })
            .filter(|s| !s.is_empty())
            .unwrap_or_else(|| "bin".to_string());

        let filename = format!("{}.{}", id, ext);
        let target_path = self.attachments_dir.join(&filename);
        let relative_storage_path = format!("attachments/{}", filename);

        // Write file to disk
        fs::write(&target_path, data)?;

        let attachment = Attachment {
            id,
            note_id: note_id.to_string(),
            original_name: original_name.to_string(),
            mime_type: mime_type.to_string(),
            size_bytes: data.len() as i64,
            relative_storage_path,
            checksum,
            created_at: Utc::now().to_rfc3339(),
        };

        // Insert into database
        self.storage
            .with_conn(|conn| AttachmentRepository::create(conn, &attachment))?;

        Ok(attachment)
    }

    pub fn list_attachments(&self, note_id: &str) -> Result<Vec<Attachment>, AppError> {
        self.storage
            .with_conn(|conn| AttachmentRepository::list_for_note(conn, note_id))
    }

    pub fn get_attachment_data(&self, id: &str) -> Result<(Attachment, String), AppError> {
        let attachment = self
            .storage
            .with_conn(|conn| AttachmentRepository::get(conn, id))?
            .ok_or_else(|| AppError::NotFound(format!("Attachment '{}' not found", id)))?;

        // Storage path is strictly derived from ID and extension
        let ext = Path::new(&attachment.relative_storage_path)
            .extension()
            .and_then(|s| s.to_str())
            .unwrap_or("bin");
        let safe_filename = format!("{}.{}", attachment.id, ext);
        let path = self.attachments_dir.join(safe_filename);

        if !path.exists() {
            return Err(AppError::NotFound(
                "Attachment file not found on disk".to_string(),
            ));
        }

        let bytes = fs::read(&path)?;
        let encoded = BASE64_STANDARD.encode(&bytes);

        Ok((attachment, encoded))
    }

    pub fn delete_attachment(&self, id: &str) -> Result<bool, AppError> {
        let attachment = self
            .storage
            .with_conn(|conn| AttachmentRepository::get(conn, id))?;

        if let Some(att) = attachment {
            let ext = Path::new(&att.relative_storage_path)
                .extension()
                .and_then(|s| s.to_str())
                .unwrap_or("bin");
            let safe_filename = format!("{}.{}", att.id, ext);
            let path = self.attachments_dir.join(safe_filename);
            let _ = fs::remove_file(path);

            self.storage
                .with_conn(|conn| AttachmentRepository::delete(conn, id))
        } else {
            Ok(false)
        }
    }

    pub fn open_attachment(&self, id: &str) -> Result<(), AppError> {
        let attachment = self
            .storage
            .with_conn(|conn| AttachmentRepository::get(conn, id))?
            .ok_or_else(|| AppError::NotFound(format!("Attachment '{}' not found", id)))?;

        let ext = Path::new(&attachment.relative_storage_path)
            .extension()
            .and_then(|s| s.to_str())
            .unwrap_or("bin");
        let safe_filename = format!("{}.{}", attachment.id, ext);
        let path = self.attachments_dir.join(safe_filename);

        if !path.exists() {
            return Err(AppError::NotFound("Attachment file not found on disk".to_string()));
        }

        #[cfg(target_os = "windows")]
        {
            use std::os::windows::process::CommandExt;
            const CREATE_NO_WINDOW: u32 = 0x08000000;
            std::process::Command::new("cmd")
                .args(["/C", "start", "", &path.to_string_lossy()])
                .creation_flags(CREATE_NO_WINDOW)
                .spawn()
                .map_err(|e| AppError::IoError(format!("Failed to open file: {}", e)))?;
        }
        #[cfg(target_os = "linux")]
        {
            std::process::Command::new("xdg-open")
                .arg(&path)
                .spawn()
                .map_err(|e| AppError::IoError(format!("Failed to open file: {}", e)))?;
        }
        #[cfg(target_os = "macos")]
        {
            std::process::Command::new("open")
                .arg(&path)
                .spawn()
                .map_err(|e| AppError::IoError(format!("Failed to open file: {}", e)))?;
        }

        Ok(())
    }
}
