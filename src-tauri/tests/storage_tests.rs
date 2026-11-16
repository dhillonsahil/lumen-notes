use lumen_notes_lib::application::{FolderService, NoteService};
use lumen_notes_lib::domain::{NoteFilter, SaveNotePayload, error::AppError};
use lumen_notes_lib::storage::StorageManager;

#[test]
fn test_note_lifecycle_and_revisions() {
    let storage = StorageManager::new_in_memory().expect("in-memory db");

    // 1. Create note (exactly once)
    let note = NoteService::create_note(&storage, Some("First Note".to_string()), None)
        .expect("create note");
    assert_eq!(note.title, "First Note");
    assert_eq!(note.revision, 1);
    assert!(!note.id.is_empty());

    // 2. Save note with valid expected revision
    let save_payload = SaveNotePayload {
        note_id: note.id.clone(),
        expected_revision: 1,
        title: "Updated First Note".to_string(),
        document_json: r#"{"type":"doc","content":[{"type":"paragraph"}]}"#.to_string(),
        plain_text: "Updated First Note content".to_string(),
    };
    let result = NoteService::save_note(&storage, save_payload).expect("save note");
    assert_eq!(result.new_revision, 2);

    // 3. Stale save rejection (trying to save with revision 1 again)
    let stale_payload = SaveNotePayload {
        note_id: note.id.clone(),
        expected_revision: 1,
        title: "Stale write".to_string(),
        document_json: r#"{"type":"doc","content":[]}"#.to_string(),
        plain_text: "Stale write".to_string(),
    };
    let conflict = NoteService::save_note(&storage, stale_payload);
    match conflict {
        Err(AppError::RevisionConflict { expected, actual }) => {
            assert_eq!(expected, 1);
            assert_eq!(actual, 2);
        }
        other => panic!("Expected RevisionConflict, got {other:?}"),
    }

    // 4. Soft delete, trash listing, and restore
    NoteService::delete_note(&storage, &note.id, false).expect("soft delete");

    let active_notes = NoteService::list_notes(
        &storage,
        NoteFilter {
            is_trash: Some(false),
            ..Default::default()
        },
    )
    .expect("list active");
    assert_eq!(active_notes.len(), 0);

    let trash_notes = NoteService::list_notes(
        &storage,
        NoteFilter {
            is_trash: Some(true),
            ..Default::default()
        },
    )
    .expect("list trash");
    assert_eq!(trash_notes.len(), 1);
    assert_eq!(trash_notes[0].id, note.id);

    // Restore note
    NoteService::restore_note(&storage, &note.id).expect("restore");
    let restored = NoteService::get_note(&storage, &note.id)
        .expect("get note")
        .expect("must exist");
    assert!(restored.deleted_at.is_none());
}

#[test]
fn test_folder_hierarchy_and_cycle_prevention() {
    let storage = StorageManager::new_in_memory().expect("in-memory db");

    let f_a =
        FolderService::create_folder(&storage, "Folder A".to_string(), None).expect("create A");
    let f_b = FolderService::create_folder(&storage, "Folder B".to_string(), Some(f_a.id.clone()))
        .expect("create B under A");
    let f_c = FolderService::create_folder(&storage, "Folder C".to_string(), Some(f_b.id.clone()))
        .expect("create C under B");

    // Attempt to make A a child of C (would create cycle: A -> B -> C -> A)
    let cycle_err = FolderService::update_folder(
        &storage,
        f_a.id.clone(),
        "Folder A (cyclic)".to_string(),
        Some(f_c.id.clone()),
    );
    match cycle_err {
        Err(AppError::FolderCycleDetected) => (),
        other => panic!("Expected FolderCycleDetected, got {other:?}"),
    }

    // Attempt to make A a child of itself
    let self_err = FolderService::update_folder(
        &storage,
        f_a.id.clone(),
        "Folder A (self)".to_string(),
        Some(f_a.id.clone()),
    );
    match self_err {
        Err(AppError::FolderCycleDetected) => (),
        other => panic!("Expected FolderCycleDetected, got {other:?}"),
    }
}

#[test]
fn test_tag_operations() {
    let storage = StorageManager::new_in_memory().expect("in-memory db");

    let note = NoteService::create_note(&storage, Some("Tagged Note".to_string()), None)
        .expect("create note");

    storage
        .with_conn(|conn| {
            let tag1 = lumen_notes_lib::storage::tags::TagRepository::get_or_create(conn, "Rust")?;
            let tag2 =
                lumen_notes_lib::storage::tags::TagRepository::get_or_create(conn, "desktop")?;
            lumen_notes_lib::storage::tags::TagRepository::add_to_note(conn, &note.id, &tag1.id)?;
            lumen_notes_lib::storage::tags::TagRepository::add_to_note(conn, &note.id, &tag2.id)?;

            let note_tags =
                lumen_notes_lib::storage::tags::TagRepository::get_for_note(conn, &note.id)?;
            assert_eq!(note_tags.len(), 2);

            lumen_notes_lib::storage::tags::TagRepository::remove_from_note(
                conn, &note.id, &tag1.id,
            )?;
            let remaining_tags =
                lumen_notes_lib::storage::tags::TagRepository::get_for_note(conn, &note.id)?;
            assert_eq!(remaining_tags.len(), 1);
            assert_eq!(remaining_tags[0].name, "desktop");

            Ok(())
        })
        .expect("tag operations");
}
