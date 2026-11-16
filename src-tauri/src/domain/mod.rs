pub mod error;
pub use error::AppError;
use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct Note {
    pub id: String,
    pub title: String,
    pub document_json: String,
    pub document_version: i64,
    pub plain_text: String,
    pub folder_id: Option<String>,
    pub pinned: bool,
    pub favorite: bool,
    pub archived: bool,
    pub created_at: String,
    pub modified_at: String,
    pub deleted_at: Option<String>,
    pub revision: i64,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct NoteSummary {
    pub id: String,
    pub title: String,
    pub plain_text_snippet: String,
    pub folder_id: Option<String>,
    pub pinned: bool,
    pub favorite: bool,
    pub archived: bool,
    pub created_at: String,
    pub modified_at: String,
    pub is_deleted: bool,
    pub revision: i64,
}

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct NoteFilter {
    pub folder_id: Option<String>,
    pub tag_id: Option<String>,
    pub include_archived: Option<bool>,
    pub only_archived: Option<bool>,
    pub only_favorites: Option<bool>,
    pub only_pinned: Option<bool>,
    pub is_trash: Option<bool>,
    pub search_query: Option<String>,
    pub sort_by: Option<String>, // "modified_at" | "created_at" | "title"
    pub sort_order: Option<String>, // "asc" | "desc"
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SaveNotePayload {
    pub note_id: String,
    pub expected_revision: i64,
    pub title: String,
    pub document_json: String,
    pub plain_text: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SaveNoteResult {
    pub note_id: String,
    pub new_revision: i64,
    pub modified_at: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct Folder {
    pub id: String,
    pub parent_id: Option<String>,
    pub name: String,
    pub sort_order: i64,
    pub created_at: String,
    pub modified_at: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct Tag {
    pub id: String,
    pub name: String,
    pub normalized_name: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct Attachment {
    pub id: String,
    pub note_id: String,
    pub original_name: String,
    pub mime_type: String,
    pub size_bytes: i64,
    pub relative_storage_path: String,
    pub checksum: String,
    pub created_at: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct Snapshot {
    pub id: String,
    pub note_id: String,
    pub document_json: String,
    pub document_version: i64,
    pub title: String,
    pub created_at: String,
    pub revision: i64,
    #[serde(default)]
    pub is_new: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AppSettings {
    pub theme: String, // "system" | "light" | "dark"
    pub sidebar_width: f64,
    pub notelist_width: f64,
    pub autosave_interval_ms: u64,
    pub default_sort_by: String,
    pub default_sort_order: String,
}

impl Default for AppSettings {
    fn default() -> Self {
        Self {
            theme: "system".to_string(),
            sidebar_width: 220.0,
            notelist_width: 300.0,
            autosave_interval_ms: 700,
            default_sort_by: "modified_at".to_string(),
            default_sort_order: "desc".to_string(),
        }
    }
}
