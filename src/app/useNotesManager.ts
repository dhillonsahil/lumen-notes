import { useState, useEffect, useRef, useCallback } from 'react';
import type { JSONContent } from '@tiptap/core';
import { ipcClient } from '../ipc/client';
import type { Note, NoteSummary, Folder, NoteFilter, SaveStatus, SidebarCounts } from '../ipc/types';

export function useNotesManager() {
  const [notes, setNotes] = useState<NoteSummary[]>([]);
  const [folders, setFolders] = useState<Folder[]>([]);
  const [sidebarCounts, setSidebarCounts] = useState<SidebarCounts>({
    all: 0,
    favorites: 0,
    archive: 0,
    trash: 0,
    folders: {},
  });
  const [activeNote, setActiveNote] = useState<Note | null>(null);
  const [activeView, setActiveView] = useState<'all' | 'favorites' | 'archive' | 'trash'>('all');
  const [selectedFolderId, setSelectedFolderId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState<'modified_at' | 'created_at' | 'title'>('modified_at');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
  const [saveStatus, setSaveStatus] = useState<SaveStatus>('saved');
  const [errorMessage, setErrorMessage] = useState<string | undefined>(undefined);
  const [isCreatingNote, setIsCreatingNote] = useState(false);
  const [snapshotToastMessage, setSnapshotToastMessage] = useState<string | null>(null);

  // Refs for race-condition and debounce protection
  const activeNoteRef = useRef<Note | null>(null);
  activeNoteRef.current = activeNote;

  const pendingSaveTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pendingSaveDataRef = useRef<{
    noteId: string;
    title: string;
    content: JSONContent;
    plainText: string;
    expectedRevision: number;
  } | null>(null);

  const activeLoadingNoteIdRef = useRef<string | null>(null);
  const isCreatingNoteRef = useRef(false);

  // Load Folders
  const reloadFolders = useCallback(async () => {
    try {
      const list = await ipcClient.listFolders();
      setFolders(list);
    } catch (err) {
      console.error('Failed to load folders:', err);
    }
  }, []);

  // Load Notes with current filter
  const reloadNotes = useCallback(async () => {
    try {
      const filter: NoteFilter = {
        sort_by: sortBy,
        sort_order: sortOrder,
        search_query: searchQuery.trim() || undefined,
      };

      if (activeView === 'trash') {
        filter.is_trash = true;
      } else {
        filter.is_trash = false;
        if (activeView === 'favorites') {
          filter.only_favorites = true;
          filter.include_archived = false;
        } else if (activeView === 'archive') {
          filter.only_archived = true;
        } else {
          filter.include_archived = false;
        }

        if (selectedFolderId) {
          filter.folder_id = selectedFolderId;
        }
      }

      const list = await ipcClient.listNotes(filter);
      setNotes(list);

      // If active note is not in list or null, select first note if available
      if (list.length > 0) {
        if (!activeNoteRef.current || !list.some((n) => n.id === activeNoteRef.current?.id)) {
          selectNote(list[0].id);
        }
      } else {
        setActiveNote(null);
      }
    } catch (err) {
      console.error('Failed to reload notes:', err);
    }
  }, [activeView, selectedFolderId, searchQuery, sortBy, sortOrder]);

  // Load Sidebar Counts across entire database
  const reloadCounts = useCallback(async () => {
    try {
      const [activeNotes, trashNotes] = await Promise.all([
        ipcClient.listNotes({ is_trash: false, include_archived: true }),
        ipcClient.listNotes({ is_trash: true }),
      ]);

      const foldersCount: Record<string, number> = {};
      let all = 0;
      let favorites = 0;
      let archive = 0;

      for (const n of activeNotes) {
        if (!n.archived) all++;
        if (n.favorite) favorites++;
        if (n.archived) archive++;
        if (n.folder_id) {
          foldersCount[n.folder_id] = (foldersCount[n.folder_id] || 0) + 1;
        }
      }

      setSidebarCounts({
        all,
        favorites,
        archive,
        trash: trashNotes.length,
        folders: foldersCount,
      });
    } catch (err) {
      console.error('Failed to reload sidebar counts:', err);
    }
  }, []);

  // Initial load on mount
  useEffect(() => {
    reloadFolders();
    reloadNotes();
    reloadCounts();
  }, [reloadFolders, reloadNotes, reloadCounts]);

  // Flush any pending save immediately
  const flushPendingSave = useCallback(async () => {
    if (pendingSaveTimeoutRef.current) {
      clearTimeout(pendingSaveTimeoutRef.current);
      pendingSaveTimeoutRef.current = null;
    }

    const pending = pendingSaveDataRef.current;
    if (!pending) return;

    try {
      setSaveStatus('saving');
      const result = await ipcClient.saveNote({
        note_id: pending.noteId,
        expected_revision: pending.expectedRevision,
        title: pending.title,
        document_json: JSON.stringify(pending.content),
        plain_text: pending.plainText,
      });

      // Update active note revision if still on that note
      if (activeNoteRef.current?.id === pending.noteId) {
        setActiveNote((prev) =>
          prev ? { ...prev, revision: result.new_revision, modified_at: result.modified_at } : null
        );
      }

      // Update in note list
      setNotes((prev) =>
        prev.map((n) =>
          n.id === pending.noteId
            ? {
                ...n,
                title: pending.title,
                plain_text_snippet: pending.plainText.slice(0, 160),
                modified_at: result.modified_at,
                revision: result.new_revision,
              }
            : n
        )
      );

      pendingSaveDataRef.current = null;
      setSaveStatus('saved');
      setErrorMessage(undefined);
    } catch (err: unknown) {
      console.error('Save failed:', err);
      setSaveStatus('error');
      setErrorMessage(err instanceof Error ? err.message : String(err));
      // Content is preserved in pendingSaveDataRef for retry
    }
  }, []);

  // Safe Note Selection: flush pending save before switching
  const selectNote = useCallback(
    async (id: string) => {
      if (activeNoteRef.current?.id === id) return;

      // 1. Flush any pending autosave on current note
      await flushPendingSave();

      // 2. Race condition protection: mark loading target
      activeLoadingNoteIdRef.current = id;

      try {
        const note = await ipcClient.getNote(id);
        // Only apply if the user hasn't switched to a different note while loading
        if (activeLoadingNoteIdRef.current === id && note) {
          setActiveNote(note);
          setSaveStatus('saved');
          setErrorMessage(undefined);
        }
      } catch (err) {
        console.error('Failed to load note:', err);
      }
    },
    [flushPendingSave]
  );

  // Content Change Handler with 700ms Autosave debounce
  const handleContentChange = useCallback(
    (title: string, content: JSONContent, plainText: string) => {
      const current = activeNoteRef.current;
      if (!current) return;

      // Update local state and show dirty immediately
      setSaveStatus('dirty');
      setErrorMessage(undefined);

      // Immediately update title & preview snippet in local notes list for responsive UI
      setNotes((prev) =>
        prev.map((n) =>
          n.id === current.id
            ? {
                ...n,
                title,
                plain_text_snippet: plainText.slice(0, 160),
              }
            : n
        )
      );

      // Record pending save payload with current expected revision
      pendingSaveDataRef.current = {
        noteId: current.id,
        title,
        content,
        plainText,
        expectedRevision: current.revision,
      };

      // Clear existing timer
      if (pendingSaveTimeoutRef.current) {
        clearTimeout(pendingSaveTimeoutRef.current);
      }

      // 700ms debounce
      pendingSaveTimeoutRef.current = setTimeout(() => {
        flushPendingSave();
      }, 700);
    },
    [flushPendingSave]
  );

  // Explicit Note Creation: exactly once, protected against double clicks
  const handleCreateNote = useCallback(async () => {
    if (isCreatingNoteRef.current) return;
    isCreatingNoteRef.current = true;
    setIsCreatingNote(true);

    try {
      await flushPendingSave();
      const newNote = await ipcClient.createNote('', selectedFolderId || undefined);

      // Add to list at the beginning
      setNotes((prev) => [
        {
          id: newNote.id,
          title: newNote.title,
          plain_text_snippet: '',
          folder_id: newNote.folder_id,
          pinned: false,
          favorite: false,
          archived: false,
          created_at: newNote.created_at,
          modified_at: newNote.modified_at,
          is_deleted: false,
          revision: newNote.revision,
        },
        ...prev,
      ]);

      activeLoadingNoteIdRef.current = newNote.id;
      setActiveNote(newNote);
      setSaveStatus('saved');
      setErrorMessage(undefined);
      reloadCounts();
    } catch (err) {
      console.error('Failed to create note:', err);
    } finally {
      isCreatingNoteRef.current = false;
      setIsCreatingNote(false);
    }
  }, [selectedFolderId, flushPendingSave, reloadCounts]);

  // Note Actions
  const handleDeleteNote = useCallback(
    async (id: string, permanent: boolean = false) => {
      try {
        await ipcClient.deleteNote(id, permanent);
        setNotes((prev) => prev.filter((n) => n.id !== id));
        if (activeNoteRef.current?.id === id) {
          setActiveNote(null);
        }
        reloadCounts();
      } catch (err) {
        console.error('Failed to delete note:', err);
      }
    },
    [reloadCounts]
  );

  const handleRestoreNote = useCallback(
    async (id: string) => {
      try {
        await ipcClient.restoreNote(id);
        reloadNotes();
        reloadCounts();
      } catch (err) {
        console.error('Failed to restore note:', err);
      }
    },
    [reloadNotes, reloadCounts]
  );

  const handleTogglePin = useCallback(async (id: string) => {
    try {
      const isPinned = await ipcClient.togglePin(id);
      setNotes((prev) => {
        const updated = prev.map((n) => (n.id === id ? { ...n, pinned: isPinned } : n));
        return [...updated].sort((a, b) => {
          if (a.pinned !== b.pinned) return a.pinned ? -1 : 1;
          return 0;
        });
      });
      if (activeNoteRef.current?.id === id) {
        setActiveNote((prev) => (prev ? { ...prev, pinned: isPinned } : null));
      }
      await reloadNotes();
    } catch (err) {
      console.error('Failed to toggle pin:', err);
    }
  }, [reloadNotes]);

  const handleToggleFavorite = useCallback(async (id: string) => {
    try {
      const isFav = await ipcClient.toggleFavorite(id);
      setNotes((prev) =>
        prev.map((n) => (n.id === id ? { ...n, favorite: isFav } : n))
      );
      if (activeNoteRef.current?.id === id) {
        setActiveNote((prev) => (prev ? { ...prev, favorite: isFav } : null));
      }
      reloadCounts();
    } catch (err) {
      console.error('Failed to toggle favorite:', err);
    }
  }, [reloadCounts]);

  const handleToggleArchive = useCallback(
    async (id: string) => {
      try {
        const isArc = await ipcClient.toggleArchive(id);
        setNotes((prev) =>
          prev.map((n) => (n.id === id ? { ...n, archived: isArc } : n))
        );
        if (activeNoteRef.current?.id === id) {
          setActiveNote((prev) => (prev ? { ...prev, archived: isArc } : null));
        }
        reloadNotes();
        reloadCounts();
      } catch (err) {
        console.error('Failed to toggle archive:', err);
      }
    },
    [reloadNotes, reloadCounts]
  );

  // Snapshot restoration handler without revision conflict
  const handleSnapshotRestored = useCallback(
    (restored: Note) => {
      if (pendingSaveTimeoutRef.current) {
        clearTimeout(pendingSaveTimeoutRef.current);
        pendingSaveTimeoutRef.current = null;
      }
      pendingSaveDataRef.current = null;

      activeNoteRef.current = restored;
      setActiveNote(restored);
      setSaveStatus('saved');
      setErrorMessage(undefined);

      setNotes((prev) =>
        prev.map((n) =>
          n.id === restored.id
            ? {
                ...n,
                title: restored.title,
                plain_text_snippet: restored.plain_text.slice(0, 160),
                revision: restored.revision,
              }
            : n
        )
      );
      reloadCounts();
    },
    [reloadCounts]
  );

  // Folder Actions
  const handleCreateFolder = useCallback(
    async (name: string, parentId?: string) => {
      try {
        const folder = await ipcClient.createFolder(name, parentId);
        setFolders((prev) => [...prev, folder]);
        return folder;
      } catch (err) {
        console.error('Failed to create folder:', err);
        throw err;
      }
    },
    []
  );

  const handleDeleteFolder = useCallback(
    async (id: string) => {
      try {
        await ipcClient.deleteFolder(id);
        setFolders((prev) => prev.filter((f) => f.id !== id));
        if (selectedFolderId === id) {
          setSelectedFolderId(null);
        }
        reloadNotes();
      } catch (err) {
        console.error('Failed to delete folder:', err);
      }
    },
    [selectedFolderId, reloadNotes]
  );

  // Manual Save & Snapshot Creation (Ctrl+S)
  const handleSaveSnapshot = useCallback(async () => {
    const active = activeNoteRef.current;
    if (!active) return;

    // 1. Flush any pending edits to database first
    await flushPendingSave();

    // 2. Fetch fresh note state to ensure revision is accurate
    const currentNoteId = activeNoteRef.current?.id || active.id;
    try {
      setSaveStatus('saving');
      const snap = await ipcClient.createSnapshot(currentNoteId);
      setSaveStatus('saved');
      if (snap.is_new) {
        setSnapshotToastMessage('Snapshot saved to Version History');
      } else {
        setSnapshotToastMessage('No changes to save — snapshot already up to date');
      }
      setTimeout(() => setSnapshotToastMessage(null), 3000);
    } catch (err: unknown) {
      console.error('Failed to create snapshot on manual save:', err);
      setSaveStatus('error');
      setErrorMessage(err instanceof Error ? err.message : String(err));
    }
  }, [flushPendingSave]);

  return {
    notes,
    folders,
    activeNote,
    activeView,
    selectedFolderId,
    searchQuery,
    sortBy,
    sortOrder,
    saveStatus,
    errorMessage,
    isCreatingNote,
    setActiveView,
    setSelectedFolderId,
    setSearchQuery,
    setSortBy,
    setSortOrder,
    selectNote,
    handleContentChange,
    handleCreateNote,
    handleDeleteNote,
    handleRestoreNote,
    handleTogglePin,
    handleToggleFavorite,
    handleToggleArchive,
    handleCreateFolder,
    handleDeleteFolder,
    handleSnapshotRestored,
    sidebarCounts,
    reloadCounts,
    flushPendingSave,
    reloadNotes,
    handleSaveSnapshot,
    snapshotToastMessage,
  };
}
