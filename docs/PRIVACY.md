# Lumen Notes Privacy and Security Policy

## Offline-First Guarantee
Lumen Notes is engineered strictly for local execution:
- **No Cloud Sync or Remote Servers**: All note data, attachments, and configurations reside exclusively on the user's local disk.
- **No Analytics or Telemetry**: No tracking scripts, pingbacks, or background error reporters are included.
- **No Remote Font or CDN Loading**: All fonts use local system sans-serif font stacks; all icons are bundled SVGs (`lucide-react`).
- **No Third-Party AI Services**: Notes are never transmitted to LLM APIs or cloud processors.

## Local Storage Details
- **Application Database**:
  - Windows: `%LOCALAPPDATA%\com.lumennotes.app\lumen.db`
  - Linux: `~/.local/share/com.lumennotes.app/lumen.db`
- **Encryption Status**:
  - The local SQLite database is stored unencrypted at rest (plain SQLite with WAL). Lumen Notes makes no claim of built-in cryptographic encryption of the database file. If disk encryption is desired, OS-level encryption (BitLocker, LUKS) is recommended.
- **Attachment Storage**:
  - Attachments are stored with UUID-derived filenames inside the application data directory (`attachments/`).
  - Raw client file paths are never trusted as storage paths, preventing path traversal attacks.

## Desktop Security & Tauri Capabilities
- Scoped IPC: Only dedicated, explicitly validated Tauri commands are registered.
- No arbitrary filesystem or shell access is exposed to the frontend.
- Strict CSP prevents loading external scripts, styles, or iframes.
- External URLs: Links in notes are validated against approved schemes (`https://`, `http://`, `mailto:`) and only opened upon explicit user interaction via Tauri's opener plugin. Unsafe schemes (`javascript:`, `file:`, `data:`) are strictly blocked.
- Diagnostic logs do not write note document contents or personal information.

## Backup and Export Privacy Implications
- **JSON Archives**: Exporting a JSON archive bundles note titles, full rich-text document JSON, metadata, and attachment payloads in plain, unencrypted JSON format. Store archives in secure or encrypted locations.
- **HTML / Text Exports**: Exports are generated client-side and saved directly to the user's local Downloads/chosen folder without remote server intermediary.
- **Database Backups (VACUUM)**: Snapshot backups produce standard unencrypted SQLite database files. Use operating system file permissions or volume encryption to protect them.
