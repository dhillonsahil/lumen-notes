/**
 * Reusable utility to save an exported note or archive file.
 * Uses the native File System Access API (showSaveFilePicker) when available
 * so the user can select their preferred folder and filename, falling back
 * to standard browser download if unsupported or restricted.
 */
export async function saveFileWithLocationPicker(
  content: string,
  suggestedName: string,
  contentType: string,
  fileExtension: string
): Promise<void> {
  interface SaveFilePickerOptions {
    suggestedName?: string;
    types?: Array<{
      description?: string;
      accept: Record<string, string[]>;
    }>;
  }

  interface FileSystemWritableFileStream {
    write(data: string | Blob | BufferSource): Promise<void>;
    close(): Promise<void>;
  }

  interface FileSystemFileHandle {
    createWritable(): Promise<FileSystemWritableFileStream>;
  }

  const win = window as unknown as {
    showSaveFilePicker?: (options?: SaveFilePickerOptions) => Promise<FileSystemFileHandle>;
  };

  if (typeof win.showSaveFilePicker === 'function') {
    try {
      const handle = await win.showSaveFilePicker({
        suggestedName,
        types: [
          {
            description: `${fileExtension.toUpperCase()} File (*.${fileExtension})`,
            accept: {
              [contentType]: [`.${fileExtension}`],
            },
          },
        ],
      });
      const writable = await handle.createWritable();
      await writable.write(content);
      await writable.close();
      return;
    } catch (err: unknown) {
      if (err && typeof err === 'object' && 'name' in err && err.name === 'AbortError') {
        // User deliberately cancelled the file picker dialog
        return;
      }
      console.warn('showSaveFilePicker was rejected or failed, falling back to download:', err);
    }
  }

  // Standard fallback
  const blob = new Blob([content], { type: contentType });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = suggestedName;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
