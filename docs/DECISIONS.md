# Architectural Decision Records (ADRs)

## ADR-001: Local SQLite with Bundled Engine
- **Context**: Need reliable local storage with transactions, foreign keys, and zero external database server setup across Windows and Linux.
- **Decision**: Use `rusqlite` with the `bundled` feature flag. This compiles SQLite directly into the binary, ensuring consistent SQLite version and behavior regardless of host system libraries.
- **Consequences**: Self-contained executable, predictable WAL behavior, cross-platform reproducibility.

## ADR-002: Versioned Tiptap JSON as Canonical Storage
- **Context**: Rich text needs structured persistence, undo/redo support, checklists, formatting, and high fidelity. Raw HTML causes round-trip loss and parsing quirks; Markdown loses rich node metadata.
- **Decision**: Store `document_json` (versioned Tiptap document tree) along with `document_version = 1`. Derive plain text for fast SQLite FTS/LIKE indexing and note previews.
- **Consequences**: Exact fidelity for ProseMirror document schema. Schema migrations can be run on JSON if schema changes occur in future versions.

## ADR-003: Single Editor Instance with Reactive Document Switching
- **Context**: Creating a separate editor per paragraph or unmounting/remounting editor on every keystroke destroys cursor, selection, and performance.
- **Decision**: Mount a single Tiptap editor instance for the active note. On note switch, flush pending autosave, reset undo history, and set new content.
- **Consequences**: High performance, zero DOM thrashing, clean cursor preservation.

## ADR-004: Optimistic Concurrency Control via Revision Numbers
- **Context**: Autosave requests might arrive out of order, or switching notes rapidly could cause an older draft to overwrite newer data.
- **Decision**: Each note carries a monotonic `revision: i64`. Saves require `expected_revision`. Backend rejects saves if revision doesn't match current state.
- **Consequences**: Prevents lost updates and race conditions during rapid typing or note switching.

## ADR-005: Pure CSS Design Tokens
- **Context**: Clean macOS Notes aesthetic with high contrast, dark/light theme switching, and no heavy runtime CSS-in-JS dependencies.
- **Decision**: Use CSS custom properties (`tokens.css`) defining colors, typography, border-radii, and panel widths.
- **Consequences**: Instant theme changes, lightweight, predictable styling.

## ADR-006: Scoped Attachment Storage Derived from UUIDs
- **Context**: Attachments must not leak host filesystem paths, permit directory traversal (`..`), or execute arbitrary binaries.
- **Decision**: Store attachments strictly under `<app_data>/attachments/<uuid>.<ext>` with extension sanitized to alphanumeric characters (max 8 chars). Pass attachment data to frontend via base64 data URLs. Enforce maximum size of 25MB and verify SHA-256 checksums.
- **Consequences**: Complete containment within platform application data; zero arbitrary filesystem access from webview.

## ADR-007: Archive Import Collision Resolution
- **Context**: Importing a JSON archive may contain notes with identical UUIDs or matching titles to existing notes.
- **Decision**: Provide pre-import inspection modal displaying collisions and requiring explicit user choice: `keep_both` (generates fresh UUIDs and appends `(Imported)` to titles), `skip` (omits duplicates), or `overwrite` (replaces database note).
- **Consequences**: Never silently overwrites user data; guarantees predictability during backup restoration.

## ADR-008: Dual-Layer Crash Recovery
- **Context**: If the desktop process is forcefully terminated while dirty changes are pending, user work could be lost.
- **Decision**: In addition to debounced backend SQLite persistence, mirror in-flight edits to `localStorage['lumen_draft_' + noteId]`. On startup, if a dirty draft exists, display an emergency recovery banner to restore the uncommitted draft with one click. Clear the draft once persistent database confirmation is received.
- **Consequences**: Resilience against hard power-offs and unexpected OS termination.
