import React, { useEffect, useState } from 'react';
import { X, History, RotateCcw, Plus, Check } from 'lucide-react';
import { ipcClient } from '../../ipc/client';
import type { Note, Snapshot } from '../../ipc/types';
import { ConfirmModal } from './ConfirmModal';

interface SnapshotModalProps {
  isOpen: boolean;
  noteId: string;
  onClose: () => void;
  onSnapshotRestored: (restored: Note) => void;
}

export const SnapshotModal: React.FC<SnapshotModalProps> = ({
  isOpen,
  noteId,
  onClose,
  onSnapshotRestored,
}) => {
  const [snapshots, setSnapshots] = useState<Snapshot[]>([]);
  const [loading, setLoading] = useState(false);
  const [restoringId, setRestoringId] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [restoreTarget, setConfirmRestoreTarget] = useState<{ snapshot: Snapshot; versionNumber: number } | null>(null);

  const loadSnapshots = async () => {
    setLoading(true);
    try {
      const list = await ipcClient.listSnapshots(noteId);
      setSnapshots(list);
    } catch (err) {
      console.error('Failed to load snapshots:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen && noteId) {
      loadSnapshots();
    }
  }, [isOpen, noteId]);

  if (!isOpen) return null;

  const handleCreateSnapshot = async () => {
    try {
      const snap = await ipcClient.createSnapshot(noteId);
      if (snap.is_new) {
        setSuccessMessage('Snapshot created successfully');
      } else {
        setSuccessMessage('No changes to save — snapshot already up to date');
      }
      setTimeout(() => setSuccessMessage(null), 3000);
      await loadSnapshots();
    } catch (err) {
      console.error('Failed to create snapshot:', err);
    }
  };

  const handleRestore = (snapshot: Snapshot, versionNumber: number) => {
    setConfirmRestoreTarget({ snapshot, versionNumber });
  };

  const executeRestore = async (snapshot: Snapshot) => {
    setRestoringId(snapshot.id);
    try {
      const restored = await ipcClient.restoreSnapshot(snapshot.id);
      onSnapshotRestored(restored);
      onClose();
    } catch (err) {
      console.error('Failed to restore snapshot:', err);
    } finally {
      setRestoringId(null);
      setConfirmRestoreTarget(null);
    }
  };

  const formatTimestamp = (iso: string) => {
    try {
      const d = new Date(iso);
      return `${d.toLocaleDateString()} ${d.toLocaleTimeString()}`;
    } catch {
      return iso;
    }
  };

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        backgroundColor: 'rgba(0,0,0,0.5)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 1100,
      }}
      data-testid="snapshot-modal"
    >
      <div
        style={{
          width: '480px',
          maxWidth: '90vw',
          maxHeight: '80vh',
          backgroundColor: 'var(--color-main-bg)',
          borderRadius: 'var(--radius-lg)',
          border: '1px solid var(--color-divider)',
          boxShadow: '0 12px 32px rgba(0,0,0,0.25)',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
        }}
      >
        <div
          style={{
            height: '48px',
            padding: '0 16px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            borderBottom: '1px solid var(--color-divider)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontWeight: 600 }}>
            <History size={18} color="var(--color-accent)" />
            <span>Note Version History</span>
          </div>
          <button type="button" className="sidebar-section-btn" onClick={onClose} title="Close">
            <X size={16} />
          </button>
        </div>

        <div style={{ padding: '16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--color-divider)' }}>
          <span style={{ fontSize: '13px', color: 'var(--color-secondary)' }}>
            Capture points in time or restore earlier revisions.
          </span>
          <button
            type="button"
            onClick={handleCreateSnapshot}
            style={{
              padding: '6px 12px',
              borderRadius: 'var(--radius-sm)',
              border: 'none',
              backgroundColor: 'var(--color-accent)',
              color: '#FFFFFF',
              cursor: 'pointer',
              fontSize: '12px',
              fontWeight: 600,
              display: 'flex',
              alignItems: 'center',
              gap: '4px',
            }}
            data-testid="create-snapshot-btn"
          >
            <Plus size={14} />
            <span>Snapshot</span>
          </button>
        </div>

        {successMessage && (
          <div
            style={{
              padding: '8px 16px',
              backgroundColor: 'var(--color-accent-subtle)',
              color: 'var(--color-accent)',
              fontSize: '12px',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
            }}
          >
            <Check size={14} />
            <span>{successMessage}</span>
          </div>
        )}

        <div style={{ flex: 1, overflowY: 'auto', padding: '16px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
          {loading ? (
            <div style={{ padding: '24px', textAlign: 'center', color: 'var(--color-secondary)', fontSize: '13px' }}>
              Loading version history…
            </div>
          ) : snapshots.length === 0 ? (
            <div style={{ padding: '24px', textAlign: 'center', color: 'var(--color-secondary)', fontSize: '13px' }}>
              No snapshots created yet. Click "Snapshot" above to save the current version.
            </div>
          ) : (
            snapshots.map((snap, index) => {
              const versionNumber = snapshots.length - index;
              return (
                <div
                  key={snap.id}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '10px 12px',
                    borderRadius: 'var(--radius-sm)',
                    backgroundColor: 'var(--color-hover)',
                    border: '1px solid var(--color-divider)',
                  }}
                  data-testid={`snapshot-item-${snap.id}`}
                >
                  <div>
                    <div style={{ fontWeight: 600, fontSize: '13px', color: 'var(--color-text)' }}>
                      Version {versionNumber} · {snap.title || 'Untitled'}
                    </div>
                    <div style={{ fontSize: '11px', color: 'var(--color-secondary)', marginTop: '2px' }}>
                      {formatTimestamp(snap.created_at)}
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={() => handleRestore(snap, versionNumber)}
                    disabled={restoringId === snap.id}
                    style={{
                      padding: '4px 10px',
                      borderRadius: 'var(--radius-sm)',
                      border: '1px solid var(--color-divider)',
                      backgroundColor: 'var(--color-main-bg)',
                      color: 'var(--color-text)',
                      cursor: 'pointer',
                      fontSize: '12px',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '4px',
                    }}
                    data-testid={`restore-snapshot-btn-${snap.id}`}
                  >
                    <RotateCcw size={12} />
                    <span>Restore</span>
                  </button>
                </div>
              );
            })
          )}
        </div>

        <div
          style={{
            padding: '12px 16px',
            borderTop: '1px solid var(--color-divider)',
            display: 'flex',
            justifyContent: 'flex-end',
          }}
        >
          <button
            type="button"
            onClick={onClose}
            style={{
              padding: '6px 14px',
              borderRadius: 'var(--radius-sm)',
              border: '1px solid var(--color-divider)',
              background: 'transparent',
              color: 'var(--color-text)',
              cursor: 'pointer',
              fontSize: '13px',
            }}
          >
            Done
          </button>
        </div>
      </div>

      <ConfirmModal
        isOpen={!!restoreTarget}
        title="Restore Version Snapshot?"
        message={`Restore note to Version ${restoreTarget?.versionNumber}? Your current draft will be replaced with this version.`}
        confirmLabel="Restore Version"
        cancelLabel="Cancel"
        isDestructive={false}
        icon="restore"
        onConfirm={() => {
          if (restoreTarget) executeRestore(restoreTarget.snapshot);
        }}
        onCancel={() => setConfirmRestoreTarget(null)}
      />
    </div>
  );
};
