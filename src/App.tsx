import { useState, useEffect, useRef, useMemo } from 'react';
import type { JSONContent } from '@tiptap/core';
import { Sidebar } from './components/sidebar/Sidebar';
import { NoteList } from './components/note-list/NoteList';
import { EditorView } from './components/editor/EditorView';
import { SettingsModal } from './components/settings/SettingsModal';
import { useNotesManager } from './app/useNotesManager';
import { ChevronLeft } from 'lucide-react';

export function App() {
  const {
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
    flushPendingSave,
    reloadNotes,
    setSortOrder,
    handleSaveSnapshot,
    snapshotToastMessage,
  } = useNotesManager();

  // Layout & Resizing
  const [sidebarWidth, setSidebarWidth] = useState(() => {
    const saved = localStorage.getItem('lumen_sidebar_width');
    const num = saved ? Number(saved) : 220;
    return num >= 180 && num <= 300 ? num : 220;
  });
  const [notelistWidth, setNotelistWidth] = useState(() => {
    const saved = localStorage.getItem('lumen_notelist_width');
    const num = saved ? Number(saved) : 300;
    return num >= 240 && num <= 420 ? num : 300;
  });
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const [windowWidth, setWindowWidth] = useState(window.innerWidth);
  const [showSettings, setShowSettings] = useState(false);
  const [theme, setTheme] = useState<'system' | 'light' | 'dark'>(() => {
    const saved = localStorage.getItem('lumen_theme');
    return saved === 'light' || saved === 'dark' || saved === 'system' ? saved : 'system';
  });

  const searchInputRef = useRef<HTMLInputElement>(null);

  // Persist panel widths
  useEffect(() => {
    localStorage.setItem('lumen_sidebar_width', String(sidebarWidth));
  }, [sidebarWidth]);

  useEffect(() => {
    localStorage.setItem('lumen_notelist_width', String(notelistWidth));
  }, [notelistWidth]);

  // Track window resizing for responsive breakpoints
  useEffect(() => {
    const handleResize = () => setWindowWidth(window.innerWidth);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Theme application
  useEffect(() => {
    const root = document.documentElement;
    if (theme === 'system') {
      const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
      root.setAttribute('data-theme', prefersDark ? 'dark' : 'light');
    } else {
      root.setAttribute('data-theme', theme);
    }
  }, [theme]);

  const handleThemeChange = (newTheme: 'system' | 'light' | 'dark') => {
    setTheme(newTheme);
    localStorage.setItem('lumen_theme', newTheme);
  };

  // Panel Divider Dragging
  const isDraggingSidebarRef = useRef(false);
  const isDraggingNotelistRef = useRef(false);

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (isDraggingSidebarRef.current) {
        const clamped = Math.max(180, Math.min(300, e.clientX));
        setSidebarWidth(clamped);
      } else if (isDraggingNotelistRef.current) {
        const currentSidebar = isSidebarCollapsed ? 0 : sidebarWidth;
        const clamped = Math.max(240, Math.min(420, e.clientX - currentSidebar));
        setNotelistWidth(clamped);
      }
    };

    const handleMouseUp = () => {
      isDraggingSidebarRef.current = false;
      isDraggingNotelistRef.current = false;
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [sidebarWidth, isSidebarCollapsed]);

  // Parse active document JSON
  const parsedContent: JSONContent | undefined = useMemo(() => {
    if (!activeNote?.document_json) return undefined;
    try {
      return JSON.parse(activeNote.document_json);
    } catch {
      return undefined;
    }
  }, [activeNote?.id, activeNote?.document_json]);

  // Disable default browser context menu (Print, Save as, Inspect, etc.)
  useEffect(() => {
    const handleContextMenu = (e: MouseEvent) => {
      e.preventDefault();
    };
    window.addEventListener('contextmenu', handleContextMenu);
    return () => window.removeEventListener('contextmenu', handleContextMenu);
  }, []);

  // Global Keyboard Shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const mod = e.ctrlKey || e.metaKey;

      if (mod && (e.key.toLowerCase() === 'n' || e.code === 'KeyN')) {
        e.preventDefault();
        if (activeView === 'trash') {
          setActiveView('all');
        }
        handleCreateNote();
      } else if (mod && (e.key === ',' || e.code === 'Comma')) {
        e.preventDefault();
        setShowSettings(true);
      } else if (mod && !e.shiftKey && (e.key.toLowerCase() === 's' || e.code === 'KeyS')) {
        e.preventDefault();
        handleSaveSnapshot();
      } else if (mod && !e.shiftKey && (e.key.toLowerCase() === 'f' || e.code === 'KeyF')) {
        const isEditorFocused = document.activeElement?.closest('.ProseMirror');
        if (!isEditorFocused) {
          e.preventDefault();
          e.stopPropagation();
          searchInputRef.current?.focus();
          searchInputRef.current?.select();
        }
      } else if (mod && e.shiftKey && (e.key.toLowerCase() === 's' || e.code === 'KeyS')) {
        e.preventDefault();
        setIsSidebarCollapsed((prev) => !prev);
      }
    };
    window.addEventListener('keydown', handleKeyDown, true);
    return () => window.removeEventListener('keydown', handleKeyDown, true);
  }, [handleCreateNote, handleSaveSnapshot, activeView, setActiveView]);

  // Mobile Single-Pane navigation state
  const isMobile = windowWidth < 800;
  const [mobilePane, setMobilePane] = useState<'list' | 'editor'>('list');

  // When note selected on mobile, navigate to editor
  const handleMobileSelectNote = (id: string) => {
    selectNote(id);
    if (isMobile) {
      setMobilePane('editor');
    }
  };

  return (
    <div className="app-shell" data-testid="app-shell">
      {/* 1. Sidebar Pane */}
      {!isSidebarCollapsed && (!isMobile || mobilePane === 'list') && (
        <>
          <aside
            className="pane-sidebar"
            style={{ width: `${sidebarWidth}px` }}
          >
            <Sidebar
              notes={notes}
              counts={sidebarCounts}
              folders={folders}
              activeView={activeView}
              selectedFolderId={selectedFolderId}
              onSelectView={setActiveView}
              onSelectFolder={setSelectedFolderId}
              onCreateFolder={handleCreateFolder}
              onDeleteFolder={handleDeleteFolder}
              onOpenSettings={() => setShowSettings(true)}
              onToggleCollapse={() => setIsSidebarCollapsed((prev) => !prev)}
            />
          </aside>
          <div
            className="resize-divider"
            onMouseDown={() => {
              isDraggingSidebarRef.current = true;
              document.body.style.cursor = 'col-resize';
              document.body.style.userSelect = 'none';
            }}
          />
        </>
      )}

      {/* 2. Notes List Pane */}
      {(!isMobile || mobilePane === 'list') && (
        <>
          <section
            className="pane-notelist"
            style={{ width: isMobile ? '100%' : `${notelistWidth}px` }}
          >
            <NoteList
              notes={notes}
              activeNoteId={activeNote?.id || null}
              activeView={activeView}
              searchQuery={searchQuery}
              sortBy={sortBy}
              sortOrder={sortOrder}
              isCreatingNote={isCreatingNote}
              isSidebarCollapsed={isSidebarCollapsed}
              onToggleSidebar={() => setIsSidebarCollapsed((prev) => !prev)}
              onToggleSortOrder={() => setSortOrder((prev) => (prev === 'asc' ? 'desc' : 'asc'))}
              searchInputRef={searchInputRef}
              onSelectNote={handleMobileSelectNote}
              onCreateNote={() => {
                if (activeView === 'trash') {
                  setActiveView('all');
                }
                handleCreateNote();
              }}
              onSearchChange={setSearchQuery}
              onSortChange={setSortBy}
              onTogglePin={handleTogglePin}
              onToggleFavorite={handleToggleFavorite}
              onToggleArchive={handleToggleArchive}
              onDeleteNote={handleDeleteNote}
              onRestoreNote={handleRestoreNote}
            />
          </section>
          {!isMobile && (
            <div
              className="resize-divider"
              onMouseDown={() => {
                isDraggingNotelistRef.current = true;
                document.body.style.cursor = 'col-resize';
                document.body.style.userSelect = 'none';
              }}
            />
          )}
        </>
      )}

      {/* 3. Editor Pane */}
      {(!isMobile || mobilePane === 'editor') && (
        <main className="pane-editor">
          {isMobile && (
            <div
              style={{
                height: '40px',
                padding: '0 12px',
                display: 'flex',
                alignItems: 'center',
                borderBottom: '1px solid var(--color-divider)',
                background: 'var(--color-editor-bg)',
              }}
            >
              <button
                type="button"
                className="sidebar-footer-btn"
                onClick={() => setMobilePane('list')}
              >
                <ChevronLeft size={16} />
                <span>Notes</span>
              </button>
            </div>
          )}

          {activeNote ? (
            <EditorView
              key={activeNote.id}
              noteId={activeNote.id}
              initialTitle={activeNote.title}
              initialContent={parsedContent}
              saveStatus={saveStatus}
              errorMessage={errorMessage}
              isTrash={activeView === 'trash' || !!activeNote.deleted_at}
              onRestoreNote={() => handleRestoreNote(activeNote.id)}
              onPermanentDeleteNote={() => handleDeleteNote(activeNote.id, true)}
              onContentChange={handleContentChange}
              onRetrySave={flushPendingSave}
              onReloadNote={reloadNotes}
              onSnapshotRestored={handleSnapshotRestored}
            />
          ) : (
            <div
              style={{
                flex: 1,
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                color: 'var(--color-secondary)',
                gap: '12px',
              }}
              data-testid="editor-empty-placeholder"
            >
              <span style={{ fontSize: '15px' }}>No Note Selected</span>
              <button
                type="button"
                onClick={handleCreateNote}
                style={{
                  padding: '6px 14px',
                  borderRadius: 'var(--radius-sm)',
                  border: 'none',
                  backgroundColor: 'var(--color-accent)',
                  color: '#FFFFFF',
                  cursor: 'pointer',
                  fontSize: '13px',
                  fontWeight: 600,
                }}
              >
                Create Note
              </button>
            </div>
          )}
        </main>
      )}

      {/* Manual Save Snapshot Toast Notification */}
      {snapshotToastMessage && (
        <div
          data-testid="snapshot-toast"
          style={{
            position: 'fixed',
            bottom: '24px',
            right: '24px',
            zIndex: 9999,
            backgroundColor: 'var(--color-main-bg)',
            border: '1px solid var(--color-divider)',
            borderRadius: '20px',
            padding: '8px 18px',
            color: 'var(--color-text)',
            fontSize: '13px',
            fontWeight: 500,
            boxShadow: '0 8px 24px rgba(0,0,0,0.3)',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            animation: 'fadeIn 0.2s ease-out',
          }}
        >
          <span style={{ color: 'var(--color-accent)' }}>●</span>
          <span>{snapshotToastMessage}</span>
        </div>
      )}

      <SettingsModal
        isOpen={showSettings}
        onClose={() => setShowSettings(false)}
        onThemeChange={handleThemeChange}
        onNotesImported={reloadNotes}
      />
    </div>
  );
}

export default App;
