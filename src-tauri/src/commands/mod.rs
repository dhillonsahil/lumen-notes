use crate::application::{
    AttachmentService, BackupService, ExchangeService, FolderService, NoteService,
    exchange_service::{ImportPreview, ImportResult},
};
use crate::domain::{
    AppSettings, Attachment, Folder, Note, NoteFilter, NoteSummary, SaveNotePayload,
    SaveNoteResult, Snapshot, Tag,
};
use crate::storage::{StorageManager, tags::TagRepository};
use base64::prelude::*;
use std::sync::Arc;
use tauri::State;

#[tauri::command]
pub fn create_note(
    storage: State<Arc<StorageManager>>,
    title: Option<String>,
    folder_id: Option<String>,
) -> Result<Note, String> {
    NoteService::create_note(&storage, title, folder_id).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn get_note(storage: State<Arc<StorageManager>>, id: String) -> Result<Option<Note>, String> {
    NoteService::get_note(&storage, &id).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn list_notes(
    storage: State<Arc<StorageManager>>,
    filter: Option<NoteFilter>,
) -> Result<Vec<NoteSummary>, String> {
    let filter = filter.unwrap_or_default();
    NoteService::list_notes(&storage, filter).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn save_note(
    storage: State<Arc<StorageManager>>,
    payload: SaveNotePayload,
) -> Result<SaveNoteResult, String> {
    NoteService::save_note(&storage, payload).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn delete_note(
    storage: State<Arc<StorageManager>>,
    id: String,
    permanent: bool,
) -> Result<(), String> {
    NoteService::delete_note(&storage, &id, permanent).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn restore_note(storage: State<Arc<StorageManager>>, id: String) -> Result<(), String> {
    NoteService::restore_note(&storage, &id).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn duplicate_note(storage: State<Arc<StorageManager>>, id: String) -> Result<Note, String> {
    NoteService::duplicate_note(&storage, &id).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn toggle_pin(storage: State<Arc<StorageManager>>, id: String) -> Result<bool, String> {
    NoteService::toggle_pin(&storage, &id).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn toggle_favorite(storage: State<Arc<StorageManager>>, id: String) -> Result<bool, String> {
    NoteService::toggle_favorite(&storage, &id).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn toggle_archive(storage: State<Arc<StorageManager>>, id: String) -> Result<bool, String> {
    NoteService::toggle_archive(&storage, &id).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn set_note_folder(
    storage: State<Arc<StorageManager>>,
    id: String,
    folder_id: Option<String>,
) -> Result<(), String> {
    NoteService::set_folder(&storage, &id, folder_id).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn create_folder(
    storage: State<Arc<StorageManager>>,
    name: String,
    parent_id: Option<String>,
) -> Result<Folder, String> {
    FolderService::create_folder(&storage, name, parent_id).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn update_folder(
    storage: State<Arc<StorageManager>>,
    id: String,
    name: String,
) -> Result<Folder, String> {
    FolderService::update_folder(&storage, id, name, None).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn list_folders(storage: State<Arc<StorageManager>>) -> Result<Vec<Folder>, String> {
    FolderService::list_folders(&storage).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn delete_folder(storage: State<Arc<StorageManager>>, id: String) -> Result<(), String> {
    FolderService::delete_folder(&storage, id).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn get_settings(storage: State<Arc<StorageManager>>) -> Result<AppSettings, String> {
    Ok(BackupService::get_settings(&storage))
}

#[tauri::command]
pub fn update_settings(
    storage: State<Arc<StorageManager>>,
    settings: AppSettings,
) -> Result<(), String> {
    BackupService::update_settings(&storage, settings).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn get_data_directory(storage: State<Arc<StorageManager>>) -> Result<Option<String>, String> {
    Ok(storage.get_db_path())
}

#[tauri::command]
pub fn list_snapshots(
    storage: State<Arc<StorageManager>>,
    note_id: String,
) -> Result<Vec<Snapshot>, String> {
    BackupService::list_snapshots(&storage, &note_id).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn create_snapshot(
    storage: State<Arc<StorageManager>>,
    note_id: String,
) -> Result<Snapshot, String> {
    let note = NoteService::get_note(&storage, &note_id)
        .map_err(|e| e.to_string())?
        .ok_or_else(|| format!("Note {} not found", note_id))?;

    BackupService::create_snapshot(
        &storage,
        &note.id,
        &note.title,
        &note.document_json,
        note.revision,
    )
    .map_err(|e| e.to_string())
}

#[tauri::command]
pub fn restore_snapshot(
    storage: State<Arc<StorageManager>>,
    snapshot_id: String,
) -> Result<Note, String> {
    BackupService::restore_snapshot(&storage, &snapshot_id).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn backup_database(
    storage: State<Arc<StorageManager>>,
    destination_path: String,
) -> Result<String, String> {
    let path = std::path::Path::new(&destination_path);
    BackupService::backup_database(&storage, path).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn list_tags(storage: State<Arc<StorageManager>>) -> Result<Vec<Tag>, String> {
    storage
        .with_conn(TagRepository::list)
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub fn add_tag_to_note(
    storage: State<Arc<StorageManager>>,
    note_id: String,
    tag_name: String,
) -> Result<Tag, String> {
    storage
        .with_conn(|conn| {
            let tag = TagRepository::get_or_create(conn, &tag_name)?;
            TagRepository::add_to_note(conn, &note_id, &tag.id)?;
            Ok(tag)
        })
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub fn remove_tag_from_note(
    storage: State<Arc<StorageManager>>,
    note_id: String,
    tag_id: String,
) -> Result<(), String> {
    storage
        .with_conn(|conn| TagRepository::remove_from_note(conn, &note_id, &tag_id))
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub fn get_note_tags(
    storage: State<Arc<StorageManager>>,
    note_id: String,
) -> Result<Vec<Tag>, String> {
    storage
        .with_conn(|conn| TagRepository::get_for_note(conn, &note_id))
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub fn add_attachment(
    attachments: State<Arc<AttachmentService>>,
    note_id: String,
    original_name: String,
    mime_type: String,
    data_base64: String,
) -> Result<Attachment, String> {
    let bytes = BASE64_STANDARD
        .decode(&data_base64)
        .map_err(|e| format!("Invalid base64 attachment data: {}", e))?;
    attachments
        .add_attachment(&note_id, &original_name, &mime_type, &bytes)
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub fn list_attachments(
    attachments: State<Arc<AttachmentService>>,
    note_id: String,
) -> Result<Vec<Attachment>, String> {
    attachments
        .list_attachments(&note_id)
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub fn get_attachment_data(
    attachments: State<Arc<AttachmentService>>,
    id: String,
) -> Result<String, String> {
    let (att, data_b64) = attachments
        .get_attachment_data(&id)
        .map_err(|e| e.to_string())?;
    Ok(format!("data:{};base64,{}", att.mime_type, data_b64))
}

#[tauri::command]
pub fn delete_attachment(
    attachments: State<Arc<AttachmentService>>,
    id: String,
) -> Result<(), String> {
    attachments
        .delete_attachment(&id)
        .map(|_| ())
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub fn open_attachment(
    attachments: State<Arc<AttachmentService>>,
    id: String,
) -> Result<(), String> {
    attachments
        .open_attachment(&id)
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub fn export_note(
    storage: State<Arc<StorageManager>>,
    exchange: State<Arc<ExchangeService>>,
    note_id: String,
    format: String,
) -> Result<String, String> {
    let note = NoteService::get_note(&storage, &note_id)
        .map_err(|e| e.to_string())?
        .ok_or_else(|| format!("Note {} not found", note_id))?;

    match format.as_str() {
        "txt" => Ok(exchange.export_note_txt(&note)),
        "html" => Ok(exchange.export_note_html(&note)),
        _ => serde_json::to_string_pretty(&note).map_err(|e| e.to_string()),
    }
}

#[tauri::command]
pub fn export_archive(exchange: State<Arc<ExchangeService>>) -> Result<String, String> {
    exchange.export_archive().map_err(|e| e.to_string())
}

#[tauri::command]
pub fn preview_import_archive(
    storage: State<Arc<StorageManager>>,
    exchange: State<Arc<ExchangeService>>,
    archive_json: String,
) -> Result<ImportPreview, String> {
    let existing_notes = NoteService::list_notes(
        &storage,
        NoteFilter {
            is_trash: Some(false),
            ..Default::default()
        },
    )
    .map_err(|e| e.to_string())?;

    exchange
        .preview_import(&archive_json, &existing_notes)
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub fn import_archive(
    exchange: State<Arc<ExchangeService>>,
    archive_json: String,
    strategy: String,
) -> Result<ImportResult, String> {
    exchange
        .import_archive(&archive_json, &strategy)
        .map_err(|e| e.to_string())
}
