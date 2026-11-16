import { useState, useEffect, useRef, useMemo } from 'react';
import type { JSONContent } from '@tiptap/core';
import { Sidebar } from './components/sidebar/Sidebar';
import { NoteList } from './components/note-list/NoteList';
import { EditorView } from './components/editor/EditorView';
import { SettingsModal } from './components/settings/SettingsModal';
import { useNotesManager } from './app/useNotesManager';
import { ChevronLeft, PanelLeftClose, PanelLeftOpen } from 'lucide-react';

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
    flushPendingSave,
    reloadNotes,
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

  // Global Keyboard Shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const mod = e.ctrlKey || e.metaKey;

      if (mod && (e.key.toLowerCase() === 'n' || e.code === 'KeyN')) {
        e.preventDefault();
        handleCreateNote();
      } else if (mod && (e.key === ',' || e.code === 'Comma')) {
        e.preventDefault();
        setShowSettings(true);
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
  }, [handleCreateNote]);

  // Mobile Single-Pane navigation state
  const isMobile = windowWidth < 800;
  const isTablet = windowWidth >= 800 && windowWidth < 1100;
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
      {(!isMobile && (!isTablet || !isSidebarCollapsed)) && (
        <>
          <aside
            className="pane-sidebar"
            style={{ width: `${sidebarWidth}px` }}
          >
            <Sidebar
              notes={notes}
              folders={folders}
              activeView={activeView}
              selectedFolderId={selectedFolderId}
              onSelectView={setActiveView}
              onSelectFolder={setSelectedFolderId}
              onCreateFolder={handleCreateFolder}
              onDeleteFolder={handleDeleteFolder}
              onOpenSettings={() => setShowSettings(true)}
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
            {isTablet && (
              <div
                style={{
                  height: '36px',
                  padding: '0 12px',
                  display: 'flex',
                  alignItems: 'center',
                  borderBottom: '1px solid var(--color-divider)',
                }}
              >
                <button
                  type="button"
                  className="sidebar-section-btn"
                  onClick={() => setIsSidebarCollapsed((prev) => !prev)}
                  title={isSidebarCollapsed ? 'Open Sidebar' : 'Close Sidebar'}
                >
                  {isSidebarCollapsed ? <PanelLeftOpen size={16} /> : <PanelLeftClose size={16} />}
                </button>
              </div>
            )}
            <NoteList
              notes={notes}
              activeNoteId={activeNote?.id || null}
              activeView={activeView}
              searchQuery={searchQuery}
              sortBy={sortBy}
              sortOrder={sortOrder}
              isCreatingNote={isCreatingNote}
              searchInputRef={searchInputRef}
              onSelectNote={handleMobileSelectNote}
              onCreateNote={handleCreateNote}
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
              onContentChange={handleContentChange}
              onRetrySave={flushPendingSave}
              onReloadNote={reloadNotes}
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
