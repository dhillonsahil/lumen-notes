use lumen_notes_lib::application::{AttachmentService, BackupService, ExchangeService};
use lumen_notes_lib::domain::{Note, NoteFilter};
use lumen_notes_lib::storage::StorageManager;
use lumen_notes_lib::storage::notes::NoteRepository;
use std::sync::Arc;
use tempfile::tempdir;

#[test]
fn test_attachment_lifecycle_and_safety() {
    let temp = tempdir().unwrap();
    let storage = Arc::new(StorageManager::new_in_memory().unwrap());
    let attachment_service = AttachmentService::new(storage.clone(), temp.path()).unwrap();

    // Create note
    let note = Note {
        id: "note-1".to_string(),
        title: "Test Note".to_string(),
        document_json: r#"{"type":"doc","content":[]}"#.to_string(),
        document_version: 1,
        plain_text: "".to_string(),
        folder_id: None,
        pinned: false,
        favorite: false,
        archived: false,
        created_at: "2026-01-01T00:00:00Z".to_string(),
        modified_at: "2026-01-01T00:00:00Z".to_string(),
        deleted_at: None,
        revision: 1,
    };
    storage
        .with_conn(|conn| NoteRepository::create(conn, &note))
        .unwrap();

    // 1. Add attachment
    let payload = b"Hello, this is a safe test attachment";
    let att = attachment_service
        .add_attachment("note-1", "../../etc/passwd.png", "image/png", payload)
        .unwrap();

    assert_eq!(att.original_name, "../../etc/passwd.png");
    // Ensure relative storage path is strictly derived from ID and does not contain ..
    assert!(!att.relative_storage_path.contains(".."));
    assert!(att.relative_storage_path.starts_with("attachments/"));
    assert_eq!(att.size_bytes, payload.len() as i64);

    // 2. Read attachment data
    let (read_att, data_b64) = attachment_service.get_attachment_data(&att.id).unwrap();
    assert_eq!(read_att.id, att.id);
    assert!(!data_b64.is_empty());

    // 3. List attachments
    let list = attachment_service.list_attachments("note-1").unwrap();
    assert_eq!(list.len(), 1);
    assert_eq!(list[0].id, att.id);

    // 4. Delete attachment
    let deleted = attachment_service.delete_attachment(&att.id).unwrap();
    assert!(deleted);
    let list_after = attachment_service.list_attachments("note-1").unwrap();
    assert_eq!(list_after.len(), 0);
}

#[test]
fn test_attachment_size_limit() {
    let temp = tempdir().unwrap();
    let storage = Arc::new(StorageManager::new_in_memory().unwrap());
    let attachment_service = AttachmentService::new(storage.clone(), temp.path()).unwrap();

    // Empty attachment rejected
    let empty_res = attachment_service.add_attachment("note-1", "test.txt", "text/plain", &[]);
    assert!(empty_res.is_err());

    // >25MB rejected
    let large_data = vec![0u8; 26 * 1024 * 1024];
    let large_res = attachment_service.add_attachment(
        "note-1",
        "large.bin",
        "application/octet-stream",
        &large_data,
    );
    assert!(large_res.is_err());
}

#[test]
fn test_export_and_import_archive_with_strategies() {
    let temp = tempdir().unwrap();
    let storage = Arc::new(StorageManager::new_in_memory().unwrap());
    let attachment_service =
        Arc::new(AttachmentService::new(storage.clone(), temp.path()).unwrap());
    let exchange_service = ExchangeService::new(storage.clone(), attachment_service.clone());

    // Seed note 1
    let note1 = Note {
        id: "note-orig-1".to_string(),
        title: "Original Note".to_string(),
        document_json: r#"{"type":"doc","content":[{"type":"paragraph","content":[{"type":"text","text":"Original content"}]}]}"#.to_string(),
        document_version: 1,
        plain_text: "Original content".to_string(),
        folder_id: None,
        pinned: false,
        favorite: false,
        archived: false,
        created_at: "2026-01-01T00:00:00Z".to_string(),
        modified_at: "2026-01-01T00:00:00Z".to_string(),
        deleted_at: None,
        revision: 1,
    };
    storage
        .with_conn(|conn| NoteRepository::create(conn, &note1))
        .unwrap();

    // 1. Export archive
    let archive_json = exchange_service.export_archive().unwrap();
    assert!(archive_json.contains("lumen-notes-archive"));
    assert!(archive_json.contains("Original Note"));

    // 2. Preview import against existing
    let summaries = storage
        .with_conn(|conn| NoteRepository::list(conn, &NoteFilter::default()))
        .unwrap();
    let preview = exchange_service
        .preview_import(&archive_json, &summaries)
        .unwrap();
    assert_eq!(preview.total_notes, 1);
    assert!(preview.notes[0].has_collision);

    // 3. Import with 'skip' -> skipped_count = 1
    let result_skip = exchange_service
        .import_archive(&archive_json, "skip")
        .unwrap();
    assert_eq!(result_skip.skipped_count, 1);
    assert_eq!(result_skip.imported_count, 0);

    // 4. Import with 'keep_both' -> imported_count = 1 with duplicate created
    let result_keep = exchange_service
        .import_archive(&archive_json, "keep_both")
        .unwrap();
    assert_eq!(result_keep.imported_count, 1);

    let all_notes = storage
        .with_conn(|conn| NoteRepository::list(conn, &NoteFilter::default()))
        .unwrap();
    assert_eq!(all_notes.len(), 2);
}

#[test]
fn test_snapshot_creation_and_restore() {
    let storage = Arc::new(StorageManager::new_in_memory().unwrap());

    let note = Note {
        id: "snap-note-1".to_string(),
        title: "Version 1 Title".to_string(),
        document_json: r#"{"type":"doc","content":[]}"#.to_string(),
        document_version: 1,
        plain_text: "Initial body".to_string(),
        folder_id: None,
        pinned: false,
        favorite: false,
        archived: false,
        created_at: "2026-01-01T00:00:00Z".to_string(),
        modified_at: "2026-01-01T00:00:00Z".to_string(),
        deleted_at: None,
        revision: 1,
    };
    storage
        .with_conn(|conn| NoteRepository::create(conn, &note))
        .unwrap();

    // Create snapshot
    let snap = BackupService::create_snapshot(
        &storage,
        &note.id,
        "Snapshot Title",
        r#"{"type":"doc","content":[{"type":"paragraph","content":[{"type":"text","text":"Initial body"}]}]}"#,
        1,
    )
    .unwrap();
    assert_eq!(snap.title, "Snapshot Title");
    assert!(snap.is_new);

    // List snapshots
    let snaps = BackupService::list_snapshots(&storage, &note.id).unwrap();
    assert_eq!(snaps.len(), 1);

    // Creating snapshot with identical content must not create a duplicate
    let duplicate = BackupService::create_snapshot(
        &storage,
        &note.id,
        "Snapshot Title",
        r#"{"type":"doc","content":[{"type":"paragraph","content":[{"type":"text","text":"Initial body"}]}]}"#,
        1,
    )
    .unwrap();
    assert_eq!(duplicate.id, snap.id);
    assert!(!duplicate.is_new);
    let snaps_after_dup = BackupService::list_snapshots(&storage, &note.id).unwrap();
    assert_eq!(snaps_after_dup.len(), 1);

    // Creating snapshot with only trailing whitespace in title and body must not create a duplicate
    let whitespace_dup = BackupService::create_snapshot(
        &storage,
        &note.id,
        "Snapshot Title   ",
        r#"{"type":"doc","content":[{"type":"paragraph","content":[{"type":"text","text":"Initial body   "}]},{"type":"paragraph"}]}"#,
        1,
    )
    .unwrap();
    assert_eq!(whitespace_dup.id, snap.id);
    assert!(!whitespace_dup.is_new);
    let snaps_after_ws = BackupService::list_snapshots(&storage, &note.id).unwrap();
    assert_eq!(snaps_after_ws.len(), 1);

    // Changing content creates a new snapshot
    let changed = BackupService::create_snapshot(
        &storage,
        &note.id,
        "Snapshot Title Changed",
        r#"{"type":"doc","content":[{"type":"paragraph","content":[{"type":"text","text":"Updated body"}]}]}"#,
        2,
    )
    .unwrap();
    assert_ne!(changed.id, snap.id);
    assert!(changed.is_new);
    let snaps_after_change = BackupService::list_snapshots(&storage, &note.id).unwrap();
    assert_eq!(snaps_after_change.len(), 2);

    // Restore snapshot
    let restored = BackupService::restore_snapshot(&storage, &snap.id).unwrap();
    assert_eq!(restored.title, "Snapshot Title");
    assert_eq!(restored.revision, 2);
}
