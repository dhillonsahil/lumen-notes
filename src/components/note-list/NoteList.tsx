import React from 'react';
import {
  Search,
  Plus,
  Pin,
  Star,
  Archive,
  Trash2,
  RotateCcw,
} from 'lucide-react';
import type { NoteSummary } from '../../ipc/types';

interface NoteListProps {
  notes: NoteSummary[];
  activeNoteId: string | null;
  activeView: 'all' | 'favorites' | 'archive' | 'trash';
  searchQuery: string;
  sortBy: 'modified_at' | 'created_at' | 'title';
  sortOrder: 'asc' | 'desc';
  isCreatingNote?: boolean;
  searchInputRef?: React.RefObject<HTMLInputElement | null>;
  onSelectNote: (id: string) => void;
  onCreateNote: () => void;
  onSearchChange: (query: string) => void;
  onSortChange: (sortBy: 'modified_at' | 'created_at' | 'title') => void;
  onTogglePin?: (id: string) => void;
  onToggleFavorite?: (id: string) => void;
  onToggleArchive?: (id: string) => void;
  onDeleteNote: (id: string, permanent?: boolean) => void;
  onRestoreNote?: (id: string) => void;
}

export const NoteList: React.FC<NoteListProps> = ({
  notes,
  activeNoteId,
  activeView,
  searchQuery,
  sortBy,
  isCreatingNote,
  searchInputRef,
  onSelectNote,
  onCreateNote,
  onSearchChange,
  onSortChange,
  onTogglePin,
  onToggleFavorite,
  onToggleArchive,
  onDeleteNote,
  onRestoreNote,
}) => {
  const formatDate = (isoString: string): string => {
    try {
      const date = new Date(isoString);
      const now = new Date();
      const isToday =
        date.getDate() === now.getDate() &&
        date.getMonth() === now.getMonth() &&
        date.getFullYear() === now.getFullYear();

      if (isToday) {
        return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
      }
      return date.toLocaleDateString([], { month: 'short', day: 'numeric' });
    } catch {
      return '';
    }
  };

  const getDisplayTitle = (note: NoteSummary): string => {
    const trimmed = note.title.trim();
    if (trimmed.length > 0) return trimmed;
    const firstLine = note.plain_text_snippet
      .split('\n')
      .map((l) => l.trim())
      .find((l) => l.length > 0);
    return firstLine || 'New Note';
  };

  return (
    <div className="notelist-container" data-testid="notelist-pane">
      <div className="notelist-header">
        <div className="notelist-search-wrapper">
          <Search size={14} className="notelist-search-icon" />
          <input
            ref={searchInputRef}
            type="text"
            className="notelist-search-input"
            placeholder="Search notes... (Ctrl+F)"
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Escape') {
                onSearchChange('');
                e.currentTarget.blur();
              }
            }}
            data-testid="notelist-search-input"
            aria-label="Search notes"
          />
        </div>

        <div className="notelist-actions">
          <select
            className="notelist-sort-select"
            value={sortBy}
            onChange={(e) =>
              onSortChange(e.target.value as 'modified_at' | 'created_at' | 'title')
            }
            title="Sort Notes"
            aria-label="Sort Notes"
          >
            <option value="modified_at">Date</option>
            <option value="title">Title</option>
            <option value="created_at">Created</option>
          </select>

          {activeView !== 'trash' && (
            <button
              type="button"
              className="notelist-new-btn"
              onClick={onCreateNote}
              disabled={isCreatingNote}
              title="New Note (Ctrl+N)"
              aria-label="New Note"
              data-testid="notelist-new-note-btn"
            >
              <Plus size={16} />
            </button>
          )}
        </div>
      </div>

      <div className="notelist-items" role="listbox" aria-label="Notes List">
        {notes.map((note, index) => {
          const isSelected = activeNoteId === note.id;
          const displayTitle = getDisplayTitle(note);

          const handleItemKeyDown = (e: React.KeyboardEvent) => {
            if (e.key === 'ArrowDown') {
              e.preventDefault();
              const nextIndex = Math.min(notes.length - 1, index + 1);
              const nextEl = document.querySelector<HTMLElement>(
                `[data-testid="notelist-item-${notes[nextIndex].id}"]`
              );
              nextEl?.focus();
              onSelectNote(notes[nextIndex].id);
            } else if (e.key === 'ArrowUp') {
              e.preventDefault();
              const prevIndex = Math.max(0, index - 1);
              const prevEl = document.querySelector<HTMLElement>(
                `[data-testid="notelist-item-${notes[prevIndex].id}"]`
              );
              prevEl?.focus();
              onSelectNote(notes[prevIndex].id);
            } else if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault();
              onSelectNote(note.id);
            } else if (e.key === 'Delete' || e.key === 'Backspace') {
              // Delete key to trash or permanently delete
              e.preventDefault();
              if (activeView === 'trash') {
                if (window.confirm('Permanently delete this note? This action cannot be undone.')) {
                  onDeleteNote(note.id, true);
                }
              } else {
                onDeleteNote(note.id, false);
              }
            }
          };

          return (
            <div
              key={note.id}
              role="option"
              tabIndex={0}
              aria-selected={isSelected}
              className={`notelist-item ${isSelected ? 'is-selected' : ''}`}
              onClick={() => onSelectNote(note.id)}
              onKeyDown={handleItemKeyDown}
              title={displayTitle}
              data-testid={`notelist-item-${note.id}`}
            >
              <div className="notelist-item-header">
                <span className="notelist-item-title">{displayTitle}</span>
                <div className="notelist-item-badges">
                  {note.pinned && <Pin size={12} className="badge-icon" fill="currentColor" />}
                  {note.favorite && <Star size={12} className="badge-icon" fill="currentColor" />}
                  {note.archived && <Archive size={12} className="badge-icon" />}
                </div>
              </div>

              <div className="notelist-item-meta">
                <span>{formatDate(note.modified_at)}</span>
                {note.plain_text_snippet && <span>·</span>}
                <span className="notelist-item-snippet">{note.plain_text_snippet}</span>
              </div>

              <div
                style={{
                  display: 'flex',
                  justifyContent: 'flex-end',
                  gap: '6px',
                  marginTop: '2px',
                }}
              >
                {activeView === 'trash' ? (
                  <>
                    <button
                      type="button"
                      className="sidebar-section-btn"
                      onClick={(e) => {
                        e.stopPropagation();
                        onRestoreNote?.(note.id);
                      }}
                      title="Restore Note"
                      aria-label="Restore Note"
                    >
                      <RotateCcw size={12} />
                    </button>
                    <button
                      type="button"
                      className="sidebar-section-btn"
                      onClick={(e) => {
                        e.stopPropagation();
                        if (window.confirm('Permanently delete this note? This action cannot be undone.')) {
                          onDeleteNote(note.id, true);
                        }
                      }}
                      title="Delete Permanently"
                      aria-label="Delete Permanently"
                    >
                      <Trash2 size={12} />
                    </button>
                  </>
                ) : (
                  <>
                    {onTogglePin && (
                      <button
                        type="button"
                        className="sidebar-section-btn"
                        onClick={(e) => {
                          e.stopPropagation();
                          onTogglePin(note.id);
                        }}
                        title={note.pinned ? 'Unpin' : 'Pin to top'}
                      >
                        <Pin size={12} fill={note.pinned ? 'currentColor' : 'none'} />
                      </button>
                    )}
                    {onToggleFavorite && (
                      <button
                        type="button"
                        className="sidebar-section-btn"
                        onClick={(e) => {
                          e.stopPropagation();
                          onToggleFavorite(note.id);
                        }}
                        title={note.favorite ? 'Unfavorite' : 'Add to Favorites'}
                      >
                        <Star size={12} fill={note.favorite ? 'currentColor' : 'none'} />
                      </button>
                    )}
                    {onToggleArchive && (
                      <button
                        type="button"
                        className="sidebar-section-btn"
                        onClick={(e) => {
                          e.stopPropagation();
                          onToggleArchive(note.id);
                        }}
                        title={note.archived ? 'Unarchive' : 'Archive'}
                      >
                        <Archive size={12} />
                      </button>
                    )}
                    <button
                      type="button"
                      className="sidebar-section-btn"
                      onClick={(e) => {
                        e.stopPropagation();
                        onDeleteNote(note.id, false);
                      }}
                      title="Move to Trash"
                      aria-label="Move to Trash"
                    >
                      <Trash2 size={12} />
                    </button>
                  </>
                )}
              </div>
            </div>
          );
        })}

        {notes.length === 0 && (
          <div className="notelist-empty">
            <span className="notelist-empty-title">No Notes</span>
            <span className="notelist-empty-desc">
              {searchQuery
                ? 'No notes match your search criteria'
                : activeView === 'trash'
                ? 'Trash is empty'
                : activeView === 'favorites'
                ? 'No favorite notes yet'
                : activeView === 'archive'
                ? 'No archived notes'
                : 'Click + to create your first note'}
            </span>
          </div>
        )}
      </div>
    </div>
  );
};
