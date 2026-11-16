# Lumen Notes Implementation Progress

## Status Legend
- **Not Started**: Work has not yet begun.
- **In Progress**: Active implementation or debugging.
- **Implemented**: Code written and passes local unit/type checks.
- **Verified**: Automated integration and regression checks completed successfully.

---

## Phase Matrix

| Phase | Description | Implementation Status | Verification Status | Notes |
|-------|-------------|-----------------------|---------------------|-------|
| **Phase 0** | Environment and Scaffold | Implemented | Verified | Environment audited (Win11 x64, Node 26, Rust 1.100, MSVC, WebView2 confirmed). Tauri v2 React+TS template scaffolded. Cargo check and npm typecheck green. |
| **Phase 1** | Editor Vertical Slice | Implemented | Verified | Tiptap rich-text integration complete. Verified all 12 editor proofs in real browser with Playwright: 3-paragraph typing, full-document select/delete/undo, word-level formatting, cursor-context styling, cross-block selection/replace, checklist toggle without Markdown artifacts. 13 Vitest unit tests + 4 Playwright E2E tests green. |
| **Phase 2** | Application Shell and Persistence | Implemented | Verified | Three-pane macOS Notes workspace, SQLite WAL migrations, Note CRUD, typed IPC client, 700ms autosave debounce with monotonic revision conflict protection, safe note switching with pending-save flush, exactly-once note creation. All unit, integration, and Playwright E2E tests green. |
| **Phase 3** | Organization and Search | Implemented | Verified | Folder hierarchy with cycle prevention, pin/favorite/archive toggles, soft delete/trash view/restore/permanent delete, real-time indexed search across titles & extracted plain text, sort orders. All Rust tests and Playwright E2E tests green. |
| **Phase 4** | Polished UI and Accessibility | Implemented | Verified | macOS Notes dark/light tokens, responsive 3-pane layout with mobile/tablet breakpoints, resizable panels with localStorage persistence, keyboard shortcuts (Ctrl+F search focus, Ctrl+N, Ctrl+, settings, Ctrl+Shift+S sidebar), Arrow key note-list navigation, tooltips, and accessible focus rings. All 4 Playwright E2E tests green. |
| **Phase 5** | Exchange and Attachments | Implemented | Verified | Scoped attachments in platform AppData/attachments with safe hashed paths & 25MB limits. Standalone HTML, plain text, and JSON note export. Archive JSON export/import preview modal with collision detection and duplicate strategy resolution (keep both, overwrite, skip). All Rust integration and Playwright E2E tests green. |
| **Phase 6** | Recovery and Backups | Implemented | Verified | Point-in-time version snapshots with rollback UI, localStorage emergency crash draft auto-recovery on session restoration, SQLite VACUUM snapshot backup command. All Rust integration and Playwright E2E tests green. |
| **Phase 7** | Hardening and Packaging | Implemented | Verified | Full regression run passed: `npm run typecheck`, 13 Vitest tests, 7 Rust integration tests (`cargo test`), 23 Playwright E2E tests in real browser. Production build verified with `npm run build` and `npx tauri build`, outputting standalone executable `lumen-notes.exe` and MSI/NSIS installer bundles. |

---

## Post-Phase Enhancements & UX Refinements (Verified)
1. **Borderless Writing Canvas**: Removed focus rectangles and outline borders from `.editor-title-input`, `.tiptap`, `.ProseMirror`, and content areas using targeted CSS overrides while preserving keyboard accessibility rings on interactive buttons.
2. **100% Canvas Height & Click-to-Focus**: Expanded `.editor-scroll-area`, `.editor-content-wrapper`, and `.tiptap` to stretch to 100% canvas height. Clicking any empty space on the scroll canvas automatically focuses the editor at the end of the text.
3. **Global Sidebar Counts Independent of Active View**: Decoupled sidebar counts from the filtered note list view. Replaced filtered count estimation with global multi-query aggregation (`reloadCounts`), ensuring All Notes, Favorites, Archive, Trash, and custom folder badges always show accurate database totals regardless of the active view.
4. **Version Snapshot Restore Conflict Resolution**: Fixed the snapshot restore revision conflict error (`Conflict: expected revision 14, but current is 15`) by setting content with `{ emitUpdate: false }`, cancelling pending debounced autosaves, and immediately committing the restored revision to state and local refs.
5. **Compact Attachment Drawer & Native OS App Launching**:
   - Relocated the `.editor-attachments` section to sit directly below the note title input and above the editor canvas with natural minimum height, preventing attachments from being pushed below empty space.
   - Added `open_attachment` Tauri backend command executing `cmd /C start` (Windows) or `xdg-open` (Linux). Clicking any non-image attachment chip directly opens the file in its default OS viewer (Acrobat, Word, Excel, VLC, etc.). Images open seamlessly in the interactive Lightbox.
6. **Export Destination Folder Picker**: Replaced blind browser downloads with the native File System Access API (`window.showSaveFilePicker`). Users can now browse and select the exact folder location and filename when exporting individual notes (Markdown, HTML, Plain Text, JSON) or full workspace backup archives.
7. **Custom macOS Notes-Style Context Menu**: Intercepted right-click events in the writing canvas and selection areas to present a tailored context menu with quick tools: Bold, Italic, Strikethrough, Code, Headings (H1/H2/H3), Bulleted & Numbered Lists, Task Lists, Blockquotes, Link insertion, Inline Image insertion, File Attachment, and Clipboard operations (Cut, Copy, Paste).
8. **Automated Verification**: Vitest (13/13 unit tests passed), Rust (`cargo test`, 7/7 passed), Playwright E2E in real browser (25/25 passed including right-click context menu and global sidebar count synchronization), and Tauri packaging (`npx tauri build`, 0 errors, release MSI and NSIS installers generated).
