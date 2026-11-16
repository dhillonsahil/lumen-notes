import { invoke } from '@tauri-apps/api/core';
import type {
  Note,
  NoteSummary,
  NoteFilter,
  SaveNotePayload,
  SaveNoteResult,
  Folder,
  AppSettings,
  Snapshot,
  Tag,
  Attachment,
  ImportPreview,
  ImportResult,
} from './types';

// Check if running within a native Tauri runtime window
export function isTauriEnvironment(): boolean {
  return typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window;
}

// In-Memory Mock Adapter for browser-only runs and Playwright tests
class MockStorageAdapter {
  private notes: Map<string, Note> = new Map();
  private folders: Map<string, Folder> = new Map();
  private snapshots: Map<string, Snapshot[]> = new Map();
  private attachments: Map<string, Attachment> = new Map();
  private attachmentData: Map<string, string> = new Map();
  private settings: AppSettings = {
    theme: 'system',
    sidebar_width: 220,
    notelist_width: 300,
    autosave_interval_ms: 700,
    default_sort_by: 'modified_at',
    default_sort_order: 'desc',
  };

  constructor() {
    // Seed initial demo note
    const id = 'demo-note-1';
    const now = new Date().toISOString();
    this.notes.set(id, {
      id,
      title: 'Welcome to Lumen Notes',
      document_json: JSON.stringify({
        type: 'doc',
        content: [
          {
            type: 'paragraph',
            content: [{ type: 'text', text: 'Start writing your private, local-first notes.' }],
          },
        ],
      }),
      document_version: 1,
      plain_text: 'Start writing your private, local-first notes.',
      folder_id: null,
      pinned: false,
      favorite: false,
      archived: false,
      created_at: now,
      modified_at: now,
      deleted_at: null,
      revision: 1,
    });
  }

  createNote(title?: string, folder_id?: string): Note {
    const id = `note-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    const now = new Date().toISOString();
    const note: Note = {
      id,
      title: title || '',
      document_json: JSON.stringify({
        type: 'doc',
        content: [{ type: 'paragraph' }],
      }),
      document_version: 1,
      plain_text: '',
      folder_id: folder_id || null,
      pinned: false,
      favorite: false,
      archived: false,
      created_at: now,
      modified_at: now,
      deleted_at: null,
      revision: 1,
    };
    this.notes.set(id, note);
    return note;
  }

  getNote(id: string): Note | null {
    return this.notes.get(id) || null;
  }

  listNotes(filter: NoteFilter = {}): NoteSummary[] {
    const list: NoteSummary[] = [];
    for (const note of this.notes.values()) {
      if (filter.is_trash) {
        if (!note.deleted_at) continue;
      } else {
        if (note.deleted_at) continue;
      }

      if (filter.folder_id && note.folder_id !== filter.folder_id) continue;
      if (filter.only_favorites && !note.favorite) continue;
      if (filter.only_pinned && !note.pinned) continue;
      if (filter.only_archived && !note.archived) continue;
      if (!filter.include_archived && !filter.only_archived && note.archived) continue;

      if (filter.search_query?.trim()) {
        const q = filter.search_query.trim().toLowerCase();
        const matchTitle = note.title.toLowerCase().includes(q);
        const matchBody = note.plain_text.toLowerCase().includes(q);
        if (!matchTitle && !matchBody) continue;
      }

      const snippet =
        note.plain_text.length > 160
          ? `${note.plain_text.slice(0, 160)}…`
          : note.plain_text;

      list.push({
        id: note.id,
        title: note.title,
        plain_text_snippet: snippet,
        folder_id: note.folder_id,
        pinned: note.pinned,
        favorite: note.favorite,
        archived: note.archived,
        created_at: note.created_at,
        modified_at: note.modified_at,
        is_deleted: !!note.deleted_at,
        revision: note.revision,
      });
    }

    list.sort((a, b) => {
      if (a.pinned !== b.pinned) return a.pinned ? -1 : 1;
      return new Date(b.modified_at).getTime() - new Date(a.modified_at).getTime();
    });

    return list;
  }

  saveNote(payload: SaveNotePayload): SaveNoteResult {
    const note = this.notes.get(payload.note_id);
    if (!note) throw new Error(`Note ${payload.note_id} not found`);

    if (payload.expected_revision !== note.revision) {
      throw new Error(`Revision conflict: expected ${payload.expected_revision}, current ${note.revision}`);
    }

    const newRev = note.revision + 1;
    const now = new Date().toISOString();
    note.title = payload.title;
    note.document_json = payload.document_json;
    note.plain_text = payload.plain_text;
    note.modified_at = now;
    note.revision = newRev;

    return {
      note_id: note.id,
      new_revision: newRev,
      modified_at: now,
    };
  }

  deleteNote(id: string, permanent: boolean): void {
    const note = this.notes.get(id);
    if (!note) throw new Error(`Note ${id} not found`);
    if (permanent) {
      this.notes.delete(id);
    } else {
      note.deleted_at = new Date().toISOString();
    }
  }

  restoreNote(id: string): void {
    const note = this.notes.get(id);
    if (!note) throw new Error(`Note ${id} not found`);
    note.deleted_at = null;
  }

  duplicateNote(id: string): Note {
    const note = this.notes.get(id);
    if (!note) throw new Error(`Note ${id} not found`);
    const newId = `note-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    const now = new Date().toISOString();
    const copy: Note = {
      ...note,
      id: newId,
      title: note.title ? `Copy of ${note.title}` : 'Copy of Note',
      created_at: now,
      modified_at: now,
      deleted_at: null,
      pinned: false,
      revision: 1,
    };
    this.notes.set(newId, copy);
    return copy;
  }

  togglePin(id: string): boolean {
    const note = this.notes.get(id);
    if (!note) throw new Error(`Note ${id} not found`);
    note.pinned = !note.pinned;
    return note.pinned;
  }

  toggleFavorite(id: string): boolean {
    const note = this.notes.get(id);
    if (!note) throw new Error(`Note ${id} not found`);
    note.favorite = !note.favorite;
    return note.favorite;
  }

  toggleArchive(id: string): boolean {
    const note = this.notes.get(id);
    if (!note) throw new Error(`Note ${id} not found`);
    note.archived = !note.archived;
    return note.archived;
  }

  createFolder(name: string, parent_id?: string): Folder {
    const id = `folder-${Date.now()}`;
    const now = new Date().toISOString();
    const folder: Folder = {
      id,
      name,
      parent_id: parent_id || null,
      sort_order: this.folders.size + 1,
      created_at: now,
      modified_at: now,
    };
    this.folders.set(id, folder);
    return folder;
  }

  updateFolder(id: string, name: string, parent_id?: string): Folder {
    const folder = this.folders.get(id);
    if (!folder) throw new Error(`Folder ${id} not found`);
    if (parent_id === id) throw new Error('Folder cycle detected');
    folder.name = name;
    folder.parent_id = parent_id || null;
    folder.modified_at = new Date().toISOString();
    return folder;
  }

  listFolders(): Folder[] {
    return Array.from(this.folders.values());
  }

  deleteFolder(id: string): void {
    this.folders.delete(id);
    for (const note of this.notes.values()) {
      if (note.folder_id === id) note.folder_id = null;
    }
  }

  listTags(): Tag[] {
    return [
      { id: 'tag-1', name: 'Work', normalized_name: 'work' },
      { id: 'tag-2', name: 'Personal', normalized_name: 'personal' },
    ];
  }

  addTagToNote(_noteId: string, tagName: string): Tag {
    const id = `tag-${Date.now()}`;
    return { id, name: tagName, normalized_name: tagName.toLowerCase() };
  }

  removeTagFromNote(_noteId: string, _tagId: string): void {}

  getNoteTags(_noteId: string): Tag[] {
    return [];
  }

  getSettings(): AppSettings {
    return { ...this.settings };
  }

  updateSettings(settings: AppSettings): void {
    this.settings = { ...settings };
  }

  listSnapshots(noteId: string): Snapshot[] {
    return this.snapshots.get(noteId) || [];
  }

  createSnapshot(noteId: string): Snapshot {
    const note = this.notes.get(noteId);
    if (!note) throw new Error(`Note ${noteId} not found`);
    const snap: Snapshot = {
      id: `snap-${Date.now()}`,
      note_id: noteId,
      title: note.title,
      document_json: note.document_json,
      document_version: note.document_version,
      created_at: new Date().toISOString(),
      revision: note.revision,
    };
    const list = this.snapshots.get(noteId) || [];
    list.unshift(snap);
    this.snapshots.set(noteId, list);
    return snap;
  }

  restoreSnapshot(snapshotId: string): Note {
    for (const [noteId, snaps] of this.snapshots.entries()) {
      const found = snaps.find((s) => s.id === snapshotId);
      if (found) {
        const note = this.notes.get(noteId);
        if (note) {
          note.title = found.title;
          note.document_json = found.document_json;
          note.revision += 1;
          note.modified_at = new Date().toISOString();
          return { ...note };
        }
      }
    }
    throw new Error(`Snapshot ${snapshotId} not found`);
  }

  addAttachment(
    noteId: string,
    originalName: string,
    mimeType: string,
    dataBase64: string
  ): Attachment {
    const id = `att-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`;
    const ext = originalName.split('.').pop() || 'bin';
    const att: Attachment = {
      id,
      note_id: noteId,
      original_name: originalName,
      mime_type: mimeType,
      size_bytes: Math.floor((dataBase64.length * 3) / 4),
      relative_storage_path: `attachments/${id}.${ext}`,
      checksum: 'mock-sha256-checksum',
      created_at: new Date().toISOString(),
    };
    this.attachments.set(id, att);
    this.attachmentData.set(id, dataBase64);
    return att;
  }

  listAttachments(noteId: string): Attachment[] {
    return Array.from(this.attachments.values()).filter((a) => a.note_id === noteId);
  }

  getAttachmentData(id: string): string {
    const att = this.attachments.get(id);
    const data = this.attachmentData.get(id) || '';
    if (!att) throw new Error(`Attachment ${id} not found`);
    return `data:${att.mime_type};base64,${data}`;
  }

  openAttachment(id: string): void {
    const dataUrl = this.getAttachmentData(id);
    const att = this.attachments.get(id);
    const a = document.createElement('a');
    a.href = dataUrl;
    a.download = att?.original_name || 'attachment';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  }

  deleteAttachment(id: string): void {
    this.attachments.delete(id);
    this.attachmentData.delete(id);
  }

  exportNote(noteId: string, format: 'txt' | 'html' | 'json'): string {
    const note = this.notes.get(noteId);
    if (!note) throw new Error(`Note ${noteId} not found`);
    if (format === 'txt') {
      return `${note.title}\n\n${note.plain_text}`;
    }
    if (format === 'html') {
      return `<!DOCTYPE html><html><head><meta charset="utf-8"><title>${note.title}</title></head><body><h1>${note.title}</h1><div>${note.plain_text.replace(/\n/g, '<br/>')}</div></body></html>`;
    }
    return JSON.stringify(note, null, 2);
  }

  exportArchive(): string {
    const notes = Array.from(this.notes.values())
      .filter((n) => !n.deleted_at && !n.archived)
      .map((n) => ({
        ...n,
        tags: [],
        attachments: this.listAttachments(n.id).map((a) => ({
          id: a.id,
          original_name: a.original_name,
          mime_type: a.mime_type,
          size_bytes: a.size_bytes,
          checksum: a.checksum,
          data_base64: this.attachmentData.get(a.id) || '',
        })),
      }));

    return JSON.stringify(
      {
        format: 'lumen-notes-archive',
        version: 1,
        exported_at: new Date().toISOString(),
        notes,
      },
      null,
      2
    );
  }

  previewImportArchive(archiveJson: string): ImportPreview {
    const archive = JSON.parse(archiveJson);
    const notes: Note[] = Array.from(this.notes.values());
    const previews = (archive.notes || []).map((n: Note) => {
      const idMatch = notes.some((ex) => ex.id === n.id);
      const titleMatch = notes.some((ex) => ex.title === n.title);
      return {
        id: n.id,
        title: n.title,
        plain_text_snippet: n.plain_text ? n.plain_text.substring(0, 100) : '',
        has_collision: idMatch || titleMatch,
        collision_type: idMatch ? 'id_match' : titleMatch ? 'title_match' : undefined,
        attachments_count: 0,
      };
    });

    return {
      total_notes: previews.length,
      total_attachments: 0,
      notes: previews,
    };
  }

  importArchive(archiveJson: string, strategy: 'skip' | 'overwrite' | 'keep_both'): ImportResult {
    const archive = JSON.parse(archiveJson);
    let imported_count = 0;
    let skipped_count = 0;
    let overwritten_count = 0;

    for (const note of archive.notes || []) {
      const existing = this.notes.get(note.id);
      if (existing) {
        if (strategy === 'skip') {
          skipped_count++;
          continue;
        } else if (strategy === 'overwrite') {
          this.notes.set(note.id, { ...note, revision: existing.revision + 1, modified_at: new Date().toISOString() });
          overwritten_count++;
        } else {
          // keep_both
          const newId = `imported-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`;
          this.notes.set(newId, { ...note, id: newId, title: `${note.title} (Imported)`, revision: 1 });
          imported_count++;
        }
      } else {
        this.notes.set(note.id, { ...note, revision: 1 });
        imported_count++;
      }
    }

    return { imported_count, skipped_count, overwritten_count };
  }
}

const mockAdapter = new MockStorageAdapter();

export const ipcClient = {
  async createNote(title?: string, folder_id?: string): Promise<Note> {
    if (isTauriEnvironment()) {
      return await invoke<Note>('create_note', { title, folderId: folder_id });
    }
    return mockAdapter.createNote(title, folder_id);
  },

  async getNote(id: string): Promise<Note | null> {
    if (isTauriEnvironment()) {
      return await invoke<Note | null>('get_note', { id });
    }
    return mockAdapter.getNote(id);
  },

  async listNotes(filter?: NoteFilter): Promise<NoteSummary[]> {
    if (isTauriEnvironment()) {
      return await invoke<NoteSummary[]>('list_notes', { filter });
    }
    return mockAdapter.listNotes(filter);
  },

  async saveNote(payload: SaveNotePayload): Promise<SaveNoteResult> {
    if (isTauriEnvironment()) {
      return await invoke<SaveNoteResult>('save_note', { payload });
    }
    return mockAdapter.saveNote(payload);
  },

  async deleteNote(id: string, permanent: boolean = false): Promise<void> {
    if (isTauriEnvironment()) {
      return await invoke<void>('delete_note', { id, permanent });
    }
    mockAdapter.deleteNote(id, permanent);
  },

  async restoreNote(id: string): Promise<void> {
    if (isTauriEnvironment()) {
      return await invoke<void>('restore_note', { id });
    }
    mockAdapter.restoreNote(id);
  },

  async duplicateNote(id: string): Promise<Note> {
    if (isTauriEnvironment()) {
      return await invoke<Note>('duplicate_note', { id });
    }
    return mockAdapter.duplicateNote(id);
  },

  async togglePin(id: string): Promise<boolean> {
    if (isTauriEnvironment()) {
      return await invoke<boolean>('toggle_pin', { id });
    }
    return mockAdapter.togglePin(id);
  },

  async toggleFavorite(id: string): Promise<boolean> {
    if (isTauriEnvironment()) {
      return await invoke<boolean>('toggle_favorite', { id });
    }
    return mockAdapter.toggleFavorite(id);
  },

  async toggleArchive(id: string): Promise<boolean> {
    if (isTauriEnvironment()) {
      return await invoke<boolean>('toggle_archive', { id });
    }
    return mockAdapter.toggleArchive(id);
  },

  async setNoteFolder(note_id: string, folder_id?: string | null): Promise<void> {
    if (isTauriEnvironment()) {
      return await invoke<void>('set_note_folder', { noteId: note_id, folderId: folder_id });
    }
    const note = mockAdapter.getNote(note_id);
    if (note) note.folder_id = folder_id || null;
  },

  async createFolder(name: string, parent_id?: string): Promise<Folder> {
    if (isTauriEnvironment()) {
      return await invoke<Folder>('create_folder', { name, parentId: parent_id });
    }
    return mockAdapter.createFolder(name, parent_id);
  },

  async updateFolder(id: string, name: string, parent_id?: string): Promise<Folder> {
    if (isTauriEnvironment()) {
      return await invoke<Folder>('update_folder', { id, name, parentId: parent_id });
    }
    return mockAdapter.updateFolder(id, name, parent_id);
  },

  async listFolders(): Promise<Folder[]> {
    if (isTauriEnvironment()) {
      return await invoke<Folder[]>('list_folders');
    }
    return mockAdapter.listFolders();
  },

  async deleteFolder(id: string): Promise<void> {
    if (isTauriEnvironment()) {
      return await invoke<void>('delete_folder', { id });
    }
    mockAdapter.deleteFolder(id);
  },

  async getSettings(): Promise<AppSettings> {
    if (isTauriEnvironment()) {
      return await invoke<AppSettings>('get_settings');
    }
    return mockAdapter.getSettings();
  },

  async updateSettings(settings: AppSettings): Promise<void> {
    if (isTauriEnvironment()) {
      return await invoke<void>('update_settings', { settings });
    }
    mockAdapter.updateSettings(settings);
  },

  async getDataDirectory(): Promise<string | null> {
    if (isTauriEnvironment()) {
      return await invoke<string | null>('get_data_directory');
    }
    return '/mock/appdata/com.lumennotes.app/lumen.db';
  },

  async listSnapshots(noteId: string): Promise<Snapshot[]> {
    if (isTauriEnvironment()) {
      return await invoke<Snapshot[]>('list_snapshots', { noteId });
    }
    return mockAdapter.listSnapshots(noteId);
  },

  async listTags(): Promise<Tag[]> {
    if (isTauriEnvironment()) {
      return await invoke<Tag[]>('list_tags');
    }
    return mockAdapter.listTags();
  },

  async addTagToNote(noteId: string, tagName: string): Promise<Tag> {
    if (isTauriEnvironment()) {
      return await invoke<Tag>('add_tag_to_note', { noteId, tagName });
    }
    return mockAdapter.addTagToNote(noteId, tagName);
  },

  async removeTagFromNote(noteId: string, tagId: string): Promise<void> {
    if (isTauriEnvironment()) {
      return await invoke<void>('remove_tag_from_note', { noteId, tagId });
    }
    mockAdapter.removeTagFromNote(noteId, tagId);
  },

  async getNoteTags(noteId: string): Promise<Tag[]> {
    if (isTauriEnvironment()) {
      return await invoke<Tag[]>('get_note_tags', { noteId });
    }
    return mockAdapter.getNoteTags(noteId);
  },

  async createSnapshot(noteId: string): Promise<Snapshot> {
    if (isTauriEnvironment()) {
      return await invoke<Snapshot>('create_snapshot', { noteId });
    }
    return mockAdapter.createSnapshot(noteId);
  },

  async restoreSnapshot(snapshotId: string): Promise<Note> {
    if (isTauriEnvironment()) {
      return await invoke<Note>('restore_snapshot', { snapshotId });
    }
    return mockAdapter.restoreSnapshot(snapshotId);
  },

  async backupDatabase(destinationPath: string): Promise<string> {
    if (isTauriEnvironment()) {
      return await invoke<string>('backup_database', { destinationPath });
    }
    return 'mock-backup-checksum';
  },

  async addAttachment(
    noteId: string,
    originalName: string,
    mimeType: string,
    dataBase64: string
  ): Promise<Attachment> {
    if (isTauriEnvironment()) {
      return await invoke<Attachment>('add_attachment', {
        noteId,
        originalName,
        mimeType,
        dataBase64,
      });
    }
    return mockAdapter.addAttachment(noteId, originalName, mimeType, dataBase64);
  },

  async listAttachments(noteId: string): Promise<Attachment[]> {
    if (isTauriEnvironment()) {
      return await invoke<Attachment[]>('list_attachments', { noteId });
    }
    return mockAdapter.listAttachments(noteId);
  },

  async getAttachmentData(id: string): Promise<string> {
    if (isTauriEnvironment()) {
      return await invoke<string>('get_attachment_data', { id });
    }
    return mockAdapter.getAttachmentData(id);
  },

  async openAttachment(id: string): Promise<void> {
    if (isTauriEnvironment()) {
      return await invoke<void>('open_attachment', { id });
    }
    mockAdapter.openAttachment(id);
  },

  async deleteAttachment(id: string): Promise<void> {
    if (isTauriEnvironment()) {
      return await invoke<void>('delete_attachment', { id });
    }
    mockAdapter.deleteAttachment(id);
  },

  async exportNote(noteId: string, format: 'txt' | 'html' | 'json'): Promise<string> {
    if (isTauriEnvironment()) {
      return await invoke<string>('export_note', { noteId, format });
    }
    return mockAdapter.exportNote(noteId, format);
  },

  async exportArchive(): Promise<string> {
    if (isTauriEnvironment()) {
      return await invoke<string>('export_archive');
    }
    return mockAdapter.exportArchive();
  },

  async previewImportArchive(archiveJson: string): Promise<ImportPreview> {
    if (isTauriEnvironment()) {
      return await invoke<ImportPreview>('preview_import_archive', { archiveJson });
    }
    return mockAdapter.previewImportArchive(archiveJson);
  },

  async importArchive(
    archiveJson: string,
    strategy: 'skip' | 'overwrite' | 'keep_both'
  ): Promise<ImportResult> {
    if (isTauriEnvironment()) {
      return await invoke<ImportResult>('import_archive', { archiveJson, strategy });
    }
    return mockAdapter.importArchive(archiveJson, strategy);
  },
};
