import React, { useState } from 'react';
import { X, AlertTriangle, FileArchive, Check } from 'lucide-react';
import type { ImportPreview, ImportResult } from '../../ipc/types';

interface ImportPreviewModalProps {
  isOpen: boolean;
  preview: ImportPreview | null;
  onClose: () => void;
  onConfirmImport: (strategy: 'skip' | 'overwrite' | 'keep_both') => Promise<ImportResult>;
  onImportComplete: (result: ImportResult) => void;
}

export const ImportPreviewModal: React.FC<ImportPreviewModalProps> = ({
  isOpen,
  preview,
  onClose,
  onConfirmImport,
  onImportComplete,
}) => {
  const [strategy, setStrategy] = useState<'skip' | 'overwrite' | 'keep_both'>('keep_both');
  const [isImporting, setIsImporting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen || !preview) return null;

  const collisionCount = preview.notes.filter((n) => n.has_collision).length;

  const handleImport = async () => {
    setIsImporting(true);
    setError(null);
    try {
      const result = await onConfirmImport(strategy);
      onImportComplete(result);
      onClose();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setIsImporting(false);
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
      data-testid="import-preview-modal"
    >
      <div
        style={{
          width: '520px',
          maxWidth: '90vw',
          maxHeight: '85vh',
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
            <FileArchive size={18} color="var(--color-accent)" />
            <span>Import Notes Archive</span>
          </div>
          <button type="button" className="sidebar-section-btn" onClick={onClose} title="Close">
            <X size={16} />
          </button>
        </div>

        <div style={{ padding: '16px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <div>
            <div style={{ fontSize: '13px', color: 'var(--color-text)', marginBottom: '4px' }}>
              Archive contains <strong>{preview.total_notes}</strong> note{preview.total_notes === 1 ? '' : 's'} and{' '}
              <strong>{preview.total_attachments}</strong> attachment{preview.total_attachments === 1 ? '' : 's'}.
            </div>
            {collisionCount > 0 && (
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  backgroundColor: 'var(--color-accent-subtle)',
                  padding: '8px 12px',
                  borderRadius: 'var(--radius-sm)',
                  fontSize: '12px',
                  color: 'var(--color-accent)',
                  marginTop: '8px',
                }}
              >
                <AlertTriangle size={16} />
                <span>
                  {collisionCount} existing note{collisionCount === 1 ? '' : 's'} share matching IDs or titles.
                </span>
              </div>
            )}
          </div>

          <div>
            <div style={{ fontSize: '12px', fontWeight: 600, textTransform: 'uppercase', color: 'var(--color-secondary)', marginBottom: '8px' }}>
              Duplicate Resolution Strategy
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <label
                style={{
                  display: 'flex',
                  alignItems: 'flex-start',
                  gap: '10px',
                  padding: '10px',
                  borderRadius: 'var(--radius-sm)',
                  border: `1px solid ${strategy === 'keep_both' ? 'var(--color-accent)' : 'var(--color-divider)'}`,
                  background: 'var(--color-hover)',
                  cursor: 'pointer',
                  fontSize: '13px',
                }}
              >
                <input
                  type="radio"
                  name="import-strategy"
                  value="keep_both"
                  checked={strategy === 'keep_both'}
                  onChange={() => setStrategy('keep_both')}
                  style={{ marginTop: '2px' }}
                />
                <div>
                  <strong>Keep Both (Recommended)</strong>
                  <div style={{ fontSize: '11px', color: 'var(--color-secondary)' }}>
                    Creates fresh copies of matching notes without overwriting existing data.
                  </div>
                </div>
              </label>

              <label
                style={{
                  display: 'flex',
                  alignItems: 'flex-start',
                  gap: '10px',
                  padding: '10px',
                  borderRadius: 'var(--radius-sm)',
                  border: `1px solid ${strategy === 'skip' ? 'var(--color-accent)' : 'var(--color-divider)'}`,
                  background: 'var(--color-hover)',
                  cursor: 'pointer',
                  fontSize: '13px',
                }}
              >
                <input
                  type="radio"
                  name="import-strategy"
                  value="skip"
                  checked={strategy === 'skip'}
                  onChange={() => setStrategy('skip')}
                  style={{ marginTop: '2px' }}
                />
                <div>
                  <strong>Skip Duplicates</strong>
                  <div style={{ fontSize: '11px', color: 'var(--color-secondary)' }}>
                    Existing notes will be left untouched; only non-conflicting notes are imported.
                  </div>
                </div>
              </label>

              <label
                style={{
                  display: 'flex',
                  alignItems: 'flex-start',
                  gap: '10px',
                  padding: '10px',
                  borderRadius: 'var(--radius-sm)',
                  border: `1px solid ${strategy === 'overwrite' ? 'var(--color-accent)' : 'var(--color-divider)'}`,
                  background: 'var(--color-hover)',
                  cursor: 'pointer',
                  fontSize: '13px',
                }}
              >
                <input
                  type="radio"
                  name="import-strategy"
                  value="overwrite"
                  checked={strategy === 'overwrite'}
                  onChange={() => setStrategy('overwrite')}
                  style={{ marginTop: '2px' }}
                />
                <div>
                  <strong>Overwrite Existing</strong>
                  <div style={{ fontSize: '11px', color: 'var(--color-secondary)' }}>
                    Replaces existing notes with the versions from the archive.
                  </div>
                </div>
              </label>
            </div>
          </div>

          {/* Notes preview list */}
          <div>
            <div style={{ fontSize: '12px', fontWeight: 600, textTransform: 'uppercase', color: 'var(--color-secondary)', marginBottom: '8px' }}>
              Archive Notes
            </div>
            <div
              style={{
                maxHeight: '160px',
                overflowY: 'auto',
                border: '1px solid var(--color-divider)',
                borderRadius: 'var(--radius-sm)',
              }}
            >
              {preview.notes.map((n) => (
                <div
                  key={n.id}
                  style={{
                    padding: '8px 12px',
                    borderBottom: '1px solid var(--color-divider)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    fontSize: '13px',
                  }}
                >
                  <span style={{ fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {n.title || 'Untitled Note'}
                  </span>
                  {n.has_collision && (
                    <span
                      style={{
                        fontSize: '10px',
                        padding: '2px 6px',
                        borderRadius: '10px',
                        backgroundColor: 'var(--color-accent-subtle)',
                        color: 'var(--color-accent)',
                        fontWeight: 600,
                      }}
                    >
                      Duplicate
                    </span>
                  )}
                </div>
              ))}
            </div>
          </div>

          {error && (
            <div style={{ color: 'var(--color-danger)', fontSize: '12px' }}>
              {error}
            </div>
          )}
        </div>

        <div
          style={{
            padding: '12px 16px',
            borderTop: '1px solid var(--color-divider)',
            display: 'flex',
            justifyContent: 'flex-end',
            gap: '8px',
          }}
        >
          <button
            type="button"
            onClick={onClose}
            disabled={isImporting}
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
            Cancel
          </button>
          <button
            type="button"
            onClick={handleImport}
            disabled={isImporting}
            style={{
              padding: '6px 16px',
              borderRadius: 'var(--radius-sm)',
              border: 'none',
              backgroundColor: 'var(--color-accent)',
              color: '#FFFFFF',
              cursor: 'pointer',
              fontSize: '13px',
              fontWeight: 600,
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
            }}
            data-testid="confirm-import-btn"
          >
            <Check size={14} />
            <span>{isImporting ? 'Importing…' : 'Import Notes'}</span>
          </button>
        </div>
      </div>
    </div>
  );
};
