import React, { useState } from 'react';
import {
  FileText,
  Star,
  Archive,
  Trash2,
  Folder as FolderIcon,
  Plus,
  Settings as SettingsIcon,
  PanelLeftClose,
} from 'lucide-react';
import type { Folder, NoteSummary, SidebarCounts } from '../../ipc/types';
import { ConfirmModal } from '../dialogs/ConfirmModal';

interface SidebarProps {
  notes: NoteSummary[];
  counts?: SidebarCounts;
  folders: Folder[];
  activeView: 'all' | 'favorites' | 'archive' | 'trash';
  selectedFolderId: string | null;
  onSelectView: (view: 'all' | 'favorites' | 'archive' | 'trash') => void;
  onSelectFolder: (folderId: string | null) => void;
  onCreateFolder: (name: string, parentId?: string) => Promise<unknown>;
  onDeleteFolder: (folderId: string) => void;
  onOpenSettings: () => void;
  onToggleCollapse?: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({
  notes,
  counts,
  folders,
  activeView,
  selectedFolderId,
  onSelectView,
  onSelectFolder,
  onCreateFolder,
  onDeleteFolder,
  onOpenSettings,
  onToggleCollapse,
}) => {
  const [showNewFolderModal, setShowNewFolderModal] = useState(false);
  const [newFolderName, setNewFolderName] = useState('');
  const [folderError, setFolderError] = useState('');
  const [deleteFolderTarget, setDeleteFolderTarget] = useState<{ id: string; name: string } | null>(null);

  // Counts (Prefer accurate global counts across entire database, fallback to filtered notes)
  const allCount = counts ? counts.all : notes.filter((n) => !n.is_deleted && !n.archived).length;
  const favoritesCount = counts ? counts.favorites : notes.filter((n) => !n.is_deleted && n.favorite).length;
  const archiveCount = counts ? counts.archive : notes.filter((n) => !n.is_deleted && n.archived).length;
  const trashCount = counts ? counts.trash : notes.filter((n) => n.is_deleted).length;

  const handleCreateFolderSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newFolderName.trim()) {
      setFolderError('Folder name cannot be empty');
      return;
    }
    try {
      await onCreateFolder(newFolderName.trim());
      setNewFolderName('');
      setFolderError('');
      setShowNewFolderModal(false);
    } catch (err: unknown) {
      setFolderError(err instanceof Error ? err.message : String(err));
    }
  };

  return (
    <aside className="sidebar-container" data-testid="sidebar-pane">
      <div className="sidebar-header" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div className="sidebar-title">
          <img src="/icon.svg" alt="Lumen Notes" style={{ width: 22, height: 22, borderRadius: 5, display: 'block' }} />
          <span>Lumen Notes</span>
        </div>
        {onToggleCollapse && (
          <button
            type="button"
            className="sidebar-section-btn"
            onClick={onToggleCollapse}
            title="Hide Sidebar (Ctrl+Shift+S)"
            aria-label="Hide Sidebar"
            data-testid="sidebar-collapse-btn"
          >
            <PanelLeftClose size={16} />
          </button>
        )}
      </div>

      <nav className="sidebar-nav">
        <div>
          <div className="sidebar-section-title">Views</div>
          <ul className="sidebar-list">
            <li
              tabIndex={0}
              role="button"
              className={`sidebar-item ${activeView === 'all' && selectedFolderId === null ? 'is-active' : ''}`}
              onClick={() => {
                onSelectFolder(null);
                onSelectView('all');
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  onSelectFolder(null);
                  onSelectView('all');
                }
              }}
              data-testid="view-all-notes"
            >
              <div className="sidebar-item-left">
                <FileText size={16} />
                <span className="sidebar-item-label">All Notes</span>
              </div>
              <span className="sidebar-count">{allCount}</span>
            </li>
            <li
              tabIndex={0}
              role="button"
              className={`sidebar-item ${activeView === 'favorites' ? 'is-active' : ''}`}
              onClick={() => {
                onSelectFolder(null);
                onSelectView('favorites');
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  onSelectFolder(null);
                  onSelectView('favorites');
                }
              }}
              data-testid="view-favorites"
            >
              <div className="sidebar-item-left">
                <Star size={16} />
                <span className="sidebar-item-label">Favorites</span>
              </div>
              <span className="sidebar-count">{favoritesCount}</span>
            </li>
            <li
              tabIndex={0}
              role="button"
              className={`sidebar-item ${activeView === 'archive' ? 'is-active' : ''}`}
              onClick={() => {
                onSelectFolder(null);
                onSelectView('archive');
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  onSelectFolder(null);
                  onSelectView('archive');
                }
              }}
              data-testid="view-archive"
            >
              <div className="sidebar-item-left">
                <Archive size={16} />
                <span className="sidebar-item-label">Archive</span>
              </div>
              <span className="sidebar-count">{archiveCount}</span>
            </li>
            <li
              tabIndex={0}
              role="button"
              className={`sidebar-item ${activeView === 'trash' ? 'is-active' : ''}`}
              onClick={() => {
                onSelectFolder(null);
                onSelectView('trash');
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  onSelectFolder(null);
                  onSelectView('trash');
                }
              }}
              data-testid="view-trash"
            >
              <div className="sidebar-item-left">
                <Trash2 size={16} />
                <span className="sidebar-item-label">Trash</span>
              </div>
              <span className="sidebar-count">{trashCount}</span>
            </li>
          </ul>
        </div>

        <div>
          <div className="sidebar-section-title">
            <span>Folders</span>
            <button
              type="button"
              className="sidebar-section-btn"
              onClick={() => setShowNewFolderModal(true)}
              title="New Folder"
              aria-label="New Folder"
            >
              <Plus size={14} />
            </button>
          </div>

          <ul className="sidebar-list">
            {folders.map((folder) => {
              const count = counts
                ? (counts.folders[folder.id] ?? 0)
                : notes.filter((n) => n.folder_id === folder.id && !n.is_deleted).length;
              const isSelected = selectedFolderId === folder.id;

              return (
                <li
                  key={folder.id}
                  tabIndex={0}
                  role="button"
                  className={`sidebar-item ${isSelected ? 'is-active' : ''}`}
                  onClick={() => {
                    onSelectView('all');
                    onSelectFolder(folder.id);
                  }}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      onSelectView('all');
                      onSelectFolder(folder.id);
                    }
                  }}
                  title={folder.name}
                  data-testid={`folder-item-${folder.id}`}
                >
                  <div className="sidebar-item-left">
                    <FolderIcon size={16} />
                    <span className="sidebar-item-label">{folder.name}</span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                    <span className="sidebar-count">{count}</span>
                    <button
                      type="button"
                      className="sidebar-section-btn"
                      onClick={(e) => {
                        e.stopPropagation();
                        setDeleteFolderTarget({ id: folder.id, name: folder.name });
                      }}
                      title="Delete folder"
                      aria-label={`Delete folder ${folder.name}`}
                      data-testid={`delete-folder-btn-${folder.id}`}
                    >
                      <Trash2 size={12} />
                    </button>
                  </div>
                </li>
              );
            })}
            {folders.length === 0 && (
              <li style={{ padding: '6px 8px', fontSize: '12px', color: 'var(--color-secondary)' }}>
                No folders created
              </li>
            )}
          </ul>
        </div>
      </nav>

      <div className="sidebar-footer">
        <button
          type="button"
          className="sidebar-footer-btn"
          onClick={onOpenSettings}
          data-testid="sidebar-settings-btn"
        >
          <SettingsIcon size={16} />
          <span>Settings</span>
        </button>
      </div>

      {showNewFolderModal && (
        <div
          style={{
            position: 'absolute',
            inset: 0,
            backgroundColor: 'rgba(0,0,0,0.4)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 100,
          }}
        >
          <div
            style={{
              backgroundColor: 'var(--color-main-bg)',
              border: '1px solid var(--color-divider)',
              borderRadius: 'var(--radius-md)',
              padding: '16px',
              width: '280px',
              boxShadow: '0 8px 24px rgba(0,0,0,0.2)',
            }}
          >
            <form onSubmit={handleCreateFolderSubmit}>
              <div style={{ fontWeight: 600, fontSize: '14px', marginBottom: '10px' }}>
                New Folder
              </div>
              <input
                type="text"
                value={newFolderName}
                onChange={(e) => setNewFolderName(e.target.value)}
                placeholder="Folder Name"
                style={{
                  width: '100%',
                  height: '30px',
                  padding: '0 8px',
                  borderRadius: '4px',
                  border: '1px solid var(--color-divider)',
                  backgroundColor: 'var(--color-hover)',
                  color: 'var(--color-text)',
                  fontSize: '13px',
                  outline: 'none',
                  marginBottom: '6px',
                  boxSizing: 'border-box',
                }}
                autoFocus
              />
              {folderError && (
                <div style={{ color: 'var(--color-danger)', fontSize: '11px', marginBottom: '8px' }}>
                  {folderError}
                </div>
              )}
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
                <button
                  type="button"
                  onClick={() => {
                    setShowNewFolderModal(false);
                    setFolderError('');
                  }}
                  style={{
                    padding: '4px 10px',
                    borderRadius: '4px',
                    border: 'none',
                    background: 'transparent',
                    color: 'var(--color-secondary)',
                    cursor: 'pointer',
                    fontSize: '12px',
                  }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  style={{
                    padding: '4px 12px',
                    borderRadius: '4px',
                    border: 'none',
                    backgroundColor: 'var(--color-accent)',
                    color: '#FFFFFF',
                    cursor: 'pointer',
                    fontSize: '12px',
                    fontWeight: 600,
                  }}
                >
                  Create
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
      {/* Folder Delete Confirmation Modal */}
      <ConfirmModal
        isOpen={!!deleteFolderTarget}
        title={`Delete "${deleteFolderTarget?.name}"?`}
        message="Deleting this folder will not delete the notes inside it. They will remain accessible in All Notes."
        confirmLabel="Delete Folder"
        cancelLabel="Cancel"
        isDestructive={true}
        icon="trash"
        onConfirm={() => {
          if (deleteFolderTarget) {
            onDeleteFolder(deleteFolderTarget.id);
          }
          setDeleteFolderTarget(null);
        }}
        onCancel={() => setDeleteFolderTarget(null)}
      />
    </aside>
  );
};
