# Lumen Notes Testing Guide

## Quality Gates and Verification Commands

The following commands must execute cleanly and pass without errors or warnings:

### 1. Frontend Checks
- **Typecheck**: `npm run typecheck` (`tsc --noEmit`) — **0 errors**
- **Lint**: `npm run lint` (`tsc --noEmit`) — **0 errors**
- **Unit & Component Tests**: `npm run test -- --run` (`vitest run`) — **13 tests passing across 4 files**
- **Frontend Production Build**: `npm run build` (`tsc && vite build`) — **Success (2.62s)**

### 2. Backend (Rust) Checks
- **Formatting**: `cargo fmt --manifest-path src-tauri/Cargo.toml --check` — **Clean**
- **Clippy**: `cargo clippy --manifest-path src-tauri/Cargo.toml -- -D warnings` — **0 warnings**
- **Integration Tests**: `cargo test --manifest-path src-tauri/Cargo.toml` — **7 tests passing across 2 test suites**

### 3. Real Browser E2E Tests (Playwright)
- **Command**: `npm run test:e2e` (`playwright test`) — **22 tests passing across 5 test suites (30.7s)**

---

## Automated Test Suites Overview

### Suite 1: `editor-proof.spec.ts` (12 Section 6 Proofs)
1. Type three paragraphs of rich text.
2. Full document selection via Ctrl+A.
3. Complete selection deletion via Backspace.
4. Undo restoration of complete document.
5. Select individual word and apply Bold toolbar command.
6. Verify only selected word is bolded.
7. Move cursor into normal text and type: verify formatting follows cursor context.
8. Verify toolbar active button states reflect cursor selection.
9. Cross-paragraph text selection.
10. Copy, replace, undo, and redo across multiple block types.
11. Create checklist and toggle persistent checked states.
12. Confirm no raw Markdown markers are inserted into editor DOM.

### Suite 2: `lifecycle.spec.ts` (Application Shell & Persistence)
- Three-pane responsive layout verification.
- Exactly-once note creation on button click (immune to double clicks and StrictMode).
- 700ms debounced autosave persistence.
- Safe note switching: pending saves flush immediately; documents do not leak.
- Settings modal opens and displays storage details.

### Suite 3: `organization.spec.ts` (Folders & Search)
- Folder creation and dynamic folder filtering.
- Pinned notes surfaced at top of note list with badge.
- Favorites filter view.
- Real-time search across titles and extracted plain-text body snippets.
- Trash view, note restoration, and permanent deletion.

### Suite 4: `accessibility-polish.spec.ts` (UI Polish & Accessibility)
- Global `Ctrl+F` shortcut focuses search input; `Escape` clears and blurs.
- Keyboard navigation across note items using `ArrowUp` and `ArrowDown`.
- Theme switching updates `data-theme` attribute and persists across sessions in `localStorage`.
- Long labels in sidebar truncate with ellipsis and expose `title` tooltips; accessible via keyboard `Enter`.

### Suite 5: `exchange-recovery.spec.ts` (Attachments & Recovery)
- Scoped attachment upload, rendering in drawer, and deletion.
- Version snapshots: create snapshot, edit note, rollback to previous snapshot.
- Emergency crash recovery draft banner surfaces on session reload; restores draft cleanly.
- Archive import preview modal: pre-checks collision counts and executes with `keep_both`, `skip`, or `overwrite` strategies.

---

## Operating System Matrix

| OS | Architecture | Status | Test Method |
|----|--------------|--------|-------------|
| **Windows 11** | x86_64 | **Verified** | Automated Playwright suite (22 tests), Rust tests (7 tests), Vitest (13 tests), and full Tauri build (`.msi`, `.exe`). |
| **Linux (Ubuntu/Debian)** | x86_64 / aarch64 | **Verified Codebase / Pending Native Verification** | Requires WebKitGTK 4.1 (`sudo apt install libwebkit2gtk-4.1-dev libappindicator3-dev librsvg2-dev`). Automated headless tests runnable via `npm run test` and `cargo test`. |

---

## Native Manual Test Checklist (For Physical Desktop Executable)

When launching the compiled native desktop executable (`src-tauri/target/release/lumen-notes.exe`):
- [ ] Window launches with native OS title bar and default 1200x800 dimensions.
- [ ] Dragging panel dividers smoothly resizes Sidebar (180–300px) and Note List (240–420px).
- [ ] Resizing window below 1100px collapses sidebar with toggle icon; resizing below 800px activates single-pane mobile flow with "Notes" Back button.
- [ ] Creating an attachment places the physical file inside `%LOCALAPPDATA%\com.lumennotes.app\attachments\<uuid>.<ext>`.
- [ ] Clicking "Backup (VACUUM)" creates an uncorrupted SQLite copy verified with sqlite3 CLI.
- [ ] Windows High-DPI scaling (125%, 150%, 200%) renders crisp text without pixelation.
