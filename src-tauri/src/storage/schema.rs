use rusqlite::{Connection, Result};

pub const CURRENT_SCHEMA_VERSION: i64 = 1;

pub fn initialize_database(conn: &mut Connection) -> Result<()> {
    // Enable WAL mode and foreign keys
    conn.execute_batch(
        "PRAGMA journal_mode = WAL;
         PRAGMA synchronous = NORMAL;
         PRAGMA foreign_keys = ON;
         PRAGMA busy_timeout = 5000;",
    )?;

    // Create schema version table
    conn.execute(
        "CREATE TABLE IF NOT EXISTS schema_version (
            version INTEGER PRIMARY KEY,
            applied_at TEXT NOT NULL
        );",
        [],
    )?;

    let current_version: i64 = conn
        .query_row(
            "SELECT COALESCE(MAX(version), 0) FROM schema_version",
            [],
            |row| row.get(0),
        )
        .unwrap_or(0);

    if current_version < 1 {
        apply_migration_v1(conn)?;
    }

    Ok(())
}

fn apply_migration_v1(conn: &mut Connection) -> Result<()> {
    let tx = conn.transaction()?;

    tx.execute_batch(
        "
        CREATE TABLE folders (
            id TEXT PRIMARY KEY,
            parent_id TEXT,
            name TEXT NOT NULL,
            sort_order INTEGER NOT NULL DEFAULT 0,
            created_at TEXT NOT NULL,
            modified_at TEXT NOT NULL,
            FOREIGN KEY (parent_id) REFERENCES folders(id) ON DELETE SET NULL
        );

        CREATE INDEX idx_folders_parent_id ON folders(parent_id);

        CREATE TABLE notes (
            id TEXT PRIMARY KEY,
            title TEXT NOT NULL DEFAULT '',
            document_json TEXT NOT NULL,
            document_version INTEGER NOT NULL DEFAULT 1,
            plain_text TEXT NOT NULL DEFAULT '',
            folder_id TEXT,
            pinned INTEGER NOT NULL DEFAULT 0,
            favorite INTEGER NOT NULL DEFAULT 0,
            archived INTEGER NOT NULL DEFAULT 0,
            created_at TEXT NOT NULL,
            modified_at TEXT NOT NULL,
            deleted_at TEXT,
            revision INTEGER NOT NULL DEFAULT 1,
            FOREIGN KEY (folder_id) REFERENCES folders(id) ON DELETE SET NULL
        );

        CREATE INDEX idx_notes_folder_id ON notes(folder_id);
        CREATE INDEX idx_notes_deleted_at ON notes(deleted_at);
        CREATE INDEX idx_notes_modified_at ON notes(modified_at);
        CREATE INDEX idx_notes_pinned ON notes(pinned);
        CREATE INDEX idx_notes_favorite ON notes(favorite);
        CREATE INDEX idx_notes_archived ON notes(archived);

        CREATE TABLE tags (
            id TEXT PRIMARY KEY,
            name TEXT NOT NULL UNIQUE,
            normalized_name TEXT NOT NULL UNIQUE
        );

        CREATE TABLE note_tags (
            note_id TEXT NOT NULL,
            tag_id TEXT NOT NULL,
            PRIMARY KEY (note_id, tag_id),
            FOREIGN KEY (note_id) REFERENCES notes(id) ON DELETE CASCADE,
            FOREIGN KEY (tag_id) REFERENCES tags(id) ON DELETE CASCADE
        );

        CREATE TABLE attachments (
            id TEXT PRIMARY KEY,
            note_id TEXT NOT NULL,
            original_name TEXT NOT NULL,
            mime_type TEXT NOT NULL,
            size_bytes INTEGER NOT NULL,
            relative_storage_path TEXT NOT NULL,
            checksum TEXT NOT NULL,
            created_at TEXT NOT NULL,
            FOREIGN KEY (note_id) REFERENCES notes(id) ON DELETE CASCADE
        );

        CREATE INDEX idx_attachments_note_id ON attachments(note_id);

        CREATE TABLE snapshots (
            id TEXT PRIMARY KEY,
            note_id TEXT NOT NULL,
            document_json TEXT NOT NULL,
            document_version INTEGER NOT NULL DEFAULT 1,
            title TEXT NOT NULL,
            created_at TEXT NOT NULL,
            revision INTEGER NOT NULL,
            FOREIGN KEY (note_id) REFERENCES notes(id) ON DELETE CASCADE
        );

        CREATE INDEX idx_snapshots_note_id ON snapshots(note_id);

        CREATE TABLE settings (
            key TEXT PRIMARY KEY,
            value TEXT NOT NULL
        );

        INSERT INTO schema_version (version, applied_at)
        VALUES (1, datetime('now'));
        ",
    )?;

    tx.commit()?;
    Ok(())
}
