pub mod application;
pub mod commands;
pub mod domain;
pub mod storage;

use application::{AttachmentService, ExchangeService};
use std::sync::Arc;
use storage::StorageManager;
use tauri::Manager;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .setup(|app| {
            let app_data_dir = app
                .path()
                .app_data_dir()
                .expect("Failed to get app data directory");

            let db_path = app_data_dir.join("lumen.db");
            let storage = Arc::new(
                StorageManager::new_at_path(&db_path).expect("Failed to initialize SQLite storage"),
            );
            let attachments = Arc::new(
                AttachmentService::new(storage.clone(), &app_data_dir)
                    .expect("Failed to initialize AttachmentService"),
            );
            let exchange = Arc::new(ExchangeService::new(storage.clone(), attachments.clone()));

            app.manage(storage);
            app.manage(attachments);
            app.manage(exchange);
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            commands::create_note,
            commands::get_note,
            commands::list_notes,
            commands::save_note,
            commands::delete_note,
            commands::restore_note,
            commands::duplicate_note,
            commands::toggle_pin,
            commands::toggle_favorite,
            commands::toggle_archive,
            commands::set_note_folder,
            commands::create_folder,
            commands::update_folder,
            commands::list_folders,
            commands::delete_folder,
            commands::get_settings,
            commands::update_settings,
            commands::get_data_directory,
            commands::list_snapshots,
            commands::create_snapshot,
            commands::restore_snapshot,
            commands::backup_database,
            commands::list_tags,
            commands::add_tag_to_note,
            commands::remove_tag_from_note,
            commands::get_note_tags,
            commands::add_attachment,
            commands::list_attachments,
            commands::get_attachment_data,
            commands::open_attachment,
            commands::delete_attachment,
            commands::export_note,
            commands::export_archive,
            commands::preview_import_archive,
            commands::import_archive,
        ])
        .run(tauri::generate_context!())
        .expect("error while running Lumen Notes desktop application");
}
