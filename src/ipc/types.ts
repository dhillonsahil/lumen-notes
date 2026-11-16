import type { JSONContent } from '@tiptap/core';

export type SaveStatus = 'saved' | 'saving' | 'dirty' | 'error';

export interface Note {
  id: string;
  title: string;
  document_json: string;
  document_version: number;
  plain_text: string;
  folder_id?: string | null;
  pinned: boolean;
  favorite: boolean;
  archived: boolean;
  created_at: string;
  modified_at: string;
  deleted_at?: string | null;
  revision: number;
}

export interface NoteSummary {
  id: string;
  title: string;
  plain_text_snippet: string;
  folder_id?: string | null;
  pinned: boolean;
  favorite: boolean;
  archived: boolean;
  created_at: string;
  modified_at: string;
  is_deleted: boolean;
  revision: number;
}

export interface NoteFilter {
  folder_id?: string | null;
  tag_id?: string | null;
  include_archived?: boolean;
  only_archived?: boolean;
  only_favorites?: boolean;
  only_pinned?: boolean;
  is_trash?: boolean;
  search_query?: string;
  sort_by?: 'modified_at' | 'created_at' | 'title';
  sort_order?: 'asc' | 'desc';
}

export interface SaveNotePayload {
  note_id: string;
  expected_revision: number;
  title: string;
  document_json: string;
  plain_text: string;
}

export interface SaveNoteResult {
  note_id: string;
  new_revision: number;
  modified_at: string;
}

export interface Folder {
  id: string;
  parent_id?: string | null;
  name: string;
  sort_order: number;
  created_at: string;
  modified_at: string;
}

export interface Tag {
  id: string;
  name: string;
  normalized_name: string;
}

export interface AppSettings {
  theme: 'system' | 'light' | 'dark';
  sidebar_width: number;
  notelist_width: number;
  autosave_interval_ms: number;
  default_sort_by: 'modified_at' | 'created_at' | 'title';
  default_sort_order: 'asc' | 'desc';
}

export interface Snapshot {
  id: string;
  note_id: string;
  document_json: string;
  document_version: number;
  title: string;
  created_at: string;
  revision: number;
  is_new?: boolean;
}

export interface Attachment {
  id: string;
  note_id: string;
  original_name: string;
  mime_type: string;
  size_bytes: number;
  relative_storage_path: string;
  checksum: string;
  created_at: string;
}

export interface ImportNotePreview {
  id: string;
  title: string;
  plain_text_snippet: string;
  has_collision: boolean;
  collision_type?: 'id_match' | 'title_match';
  attachments_count: number;
}

export interface ImportPreview {
  total_notes: number;
  total_attachments: number;
  notes: ImportNotePreview[];
}

export interface ImportResult {
  imported_count: number;
  skipped_count: number;
  overwritten_count: number;
}

export interface SidebarCounts {
  all: number;
  favorites: number;
  archive: number;
  trash: number;
  folders: Record<string, number>;
}

export interface ParsedNote extends Omit<Note, 'document_json'> {
  parsed_content: JSONContent;
}
