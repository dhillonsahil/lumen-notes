import React, { useEffect, useState, useRef } from 'react';
import { X, Moon, Sun, Monitor, HardDrive, ShieldCheck, Download, Upload, Database } from 'lucide-react';
import { ipcClient } from '../../ipc/client';
import type { AppSettings, ImportPreview, ImportResult } from '../../ipc/types';
import { ImportPreviewModal } from '../dialogs/ImportPreviewModal';
import { saveFileWithLocationPicker } from '../../utils/fileExport';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  onThemeChange: (theme: 'system' | 'light' | 'dark') => void;
  onNotesImported?: () => void;
}

export const SettingsModal: React.FC<SettingsModalProps> = ({
  isOpen,
  onClose,
  onThemeChange,
  onNotesImported,
}) => {
  const [settings, setSettings] = useState<AppSettings>({
    theme: 'system',
    sidebar_width: 220,
    notelist_width: 300,
    autosave_interval_ms: 700,
    default_sort_by: 'modified_at',
    default_sort_order: 'desc',
  });
  const [dataPath, setDataPath] = useState<string>('Loading…');
  const [statusMessage, setStatusMessage] = useState<string | null>(null);

  // Import preview modal state
  const [importJson, setImportJson] = useState<string | null>(null);
  const [importPreview, setImportPreview] = useState<ImportPreview | null>(null);
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
  const importFileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isOpen) {
      ipcClient.getSettings().then(setSettings).catch(console.error);
      ipcClient
        .getDataDirectory()
        .then((path) => {
          setDataPath(path || 'Platform AppData directory');
        })
        .catch(console.error);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleThemeSelect = async (theme: 'system' | 'light' | 'dark') => {
    const updated = { ...settings, theme };
    setSettings(updated);
    onThemeChange(theme);
    await ipcClient.updateSettings(updated);
  };

  const handleExportArchive = async () => {
    try {
      const json = await ipcClient.exportArchive();
      const filename = `lumen-notes-backup-${new Date().toISOString().slice(0, 10)}.json`;
      await saveFileWithLocationPicker(json, filename, 'application/json', 'json');
      setStatusMessage('Notes archive exported successfully');
      setTimeout(() => setStatusMessage(null), 3500);
    } catch (err) {
      console.error('Export archive failed:', err);
      alert(err instanceof Error ? err.message : String(err));
    }
  };

  const handleImportFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async () => {
      const text = reader.result as string;
      try {
        const preview = await ipcClient.previewImportArchive(text);
        setImportJson(text);
        setImportPreview(preview);
        setIsImportModalOpen(true);
      } catch (err: unknown) {
        console.error('Failed to preview archive:', err);
        alert(`Invalid archive: ${err instanceof Error ? err.message : String(err)}`);
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  const handleConfirmImport = async (strategy: 'skip' | 'overwrite' | 'keep_both'): Promise<ImportResult> => {
    if (!importJson) throw new Error('No archive selected');
    return await ipcClient.importArchive(importJson, strategy);
  };

  const handleImportComplete = (result: ImportResult) => {
    setStatusMessage(
      `Imported ${result.imported_count} note(s), overwritten ${result.overwritten_count}, skipped ${result.skipped_count}.`
    );
    setTimeout(() => setStatusMessage(null), 5000);
    onNotesImported?.();
  };

  const handleBackupDatabase = async () => {
    try {
      const dest = `${dataPath}.backup-${Date.now()}`;
      await ipcClient.backupDatabase(dest);
      setStatusMessage(`Database snapshot verified and saved.`);
      setTimeout(() => setStatusMessage(null), 4000);
    } catch (err) {
      console.error('Backup database failed:', err);
      alert(err instanceof Error ? err.message : String(err));
    }
  };

  return (
    <>
      <div
        style={{
          position: 'fixed',
          inset: 0,
          backgroundColor: 'rgba(0,0,0,0.5)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 1000,
        }}
        data-testid="settings-modal"
      >
        <div
          style={{
            width: '480px',
            maxWidth: '90vw',
            maxHeight: '90vh',
            backgroundColor: 'var(--color-main-bg)',
            borderRadius: 'var(--radius-lg)',
            border: '1px solid var(--color-divider)',
            boxShadow: '0 12px 32px rgba(0,0,0,0.25)',
            overflow: 'hidden',
            display: 'flex',
            flexDirection: 'column',
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
            <span style={{ fontWeight: 600, fontSize: '15px' }}>Lumen Notes Preferences</span>
            <button
              type="button"
              className="sidebar-section-btn"
              onClick={onClose}
              title="Close"
            >
              <X size={16} />
            </button>
          </div>

          <div
            style={{
              padding: '20px',
              display: 'flex',
              flexDirection: 'column',
              gap: '20px',
              overflowY: 'auto',
            }}
          >
            {statusMessage && (
              <div
                style={{
                  padding: '8px 12px',
                  borderRadius: 'var(--radius-sm)',
                  backgroundColor: 'var(--color-accent-subtle)',
                  color: 'var(--color-accent)',
                  fontSize: '12px',
                  fontWeight: 500,
                }}
              >
                {statusMessage}
              </div>
            )}

            {/* Appearance / Theme */}
            <div>
              <div style={{ fontWeight: 600, fontSize: '13px', marginBottom: '8px' }}>
                Appearance
              </div>
              <div style={{ display: 'flex', gap: '10px' }}>
                <button
                  type="button"
                  onClick={() => handleThemeSelect('system')}
                  style={{
                    flex: 1,
                    padding: '8px',
                    borderRadius: 'var(--radius-sm)',
                    border: `1.5px solid ${settings.theme === 'system' ? 'var(--color-accent)' : 'var(--color-divider)'}`,
                    background: 'var(--color-hover)',
                    color: 'var(--color-text)',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    gap: '6px',
                    cursor: 'pointer',
                    fontSize: '12px',
                  }}
                >
                  <Monitor size={18} />
                  <span>System</span>
                </button>
                <button
                  type="button"
                  onClick={() => handleThemeSelect('light')}
                  style={{
                    flex: 1,
                    padding: '8px',
                    borderRadius: 'var(--radius-sm)',
                    border: `1.5px solid ${settings.theme === 'light' ? 'var(--color-accent)' : 'var(--color-divider)'}`,
                    background: 'var(--color-hover)',
                    color: 'var(--color-text)',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    gap: '6px',
                    cursor: 'pointer',
                    fontSize: '12px',
                  }}
                >
                  <Sun size={18} />
                  <span>Light</span>
                </button>
                <button
                  type="button"
                  onClick={() => handleThemeSelect('dark')}
                  style={{
                    flex: 1,
                    padding: '8px',
                    borderRadius: 'var(--radius-sm)',
                    border: `1.5px solid ${settings.theme === 'dark' ? 'var(--color-accent)' : 'var(--color-divider)'}`,
                    background: 'var(--color-hover)',
                    color: 'var(--color-text)',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    gap: '6px',
                    cursor: 'pointer',
                    fontSize: '12px',
                  }}
                >
                  <Moon size={18} />
                  <span>Dark</span>
                </button>
              </div>
            </div>

            {/* Archive & Exchange */}
            <div>
              <div style={{ fontWeight: 600, fontSize: '13px', marginBottom: '8px' }}>
                Archive & Exchange
              </div>
              <div style={{ display: 'flex', gap: '8px' }}>
                <button
                  type="button"
                  onClick={handleExportArchive}
                  style={{
                    flex: 1,
                    padding: '8px 12px',
                    borderRadius: 'var(--radius-sm)',
                    border: '1px solid var(--color-divider)',
                    backgroundColor: 'var(--color-hover)',
                    color: 'var(--color-text)',
                    cursor: 'pointer',
                    fontSize: '12px',
                    fontWeight: 500,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '6px',
                  }}
                  data-testid="export-archive-btn"
                >
                  <Download size={14} />
                  <span>Export Archive</span>
                </button>

                <button
                  type="button"
                  onClick={() => importFileInputRef.current?.click()}
                  style={{
                    flex: 1,
                    padding: '8px 12px',
                    borderRadius: 'var(--radius-sm)',
                    border: '1px solid var(--color-divider)',
                    backgroundColor: 'var(--color-hover)',
                    color: 'var(--color-text)',
                    cursor: 'pointer',
                    fontSize: '12px',
                    fontWeight: 500,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '6px',
                  }}
                  data-testid="import-archive-btn"
                >
                  <Upload size={14} />
                  <span>Import Archive</span>
                </button>

                <input
                  ref={importFileInputRef}
                  type="file"
                  accept=".json"
                  style={{ display: 'none' }}
                  onChange={handleImportFileSelect}
                  data-testid="import-file-input"
                />
              </div>
            </div>

            {/* Local Storage & Backup Details */}
            <div>
              <div
                style={{
                  fontWeight: 600,
                  fontSize: '13px',
                  marginBottom: '8px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <HardDrive size={15} />
                  <span>Database & Storage Location</span>
                </div>
                <button
                  type="button"
                  onClick={handleBackupDatabase}
                  style={{
                    padding: '3px 8px',
                    borderRadius: 'var(--radius-sm)',
                    border: '1px solid var(--color-divider)',
                    backgroundColor: 'transparent',
                    color: 'var(--color-accent)',
                    cursor: 'pointer',
                    fontSize: '11px',
                    fontWeight: 600,
                    display: 'flex',
                    alignItems: 'center',
                    gap: '4px',
                  }}
                  data-testid="backup-database-btn"
                >
                  <Database size={11} />
                  <span>Backup (VACUUM)</span>
                </button>
              </div>
              <div
                style={{
                  padding: '8px 10px',
                  backgroundColor: 'var(--color-hover)',
                  borderRadius: 'var(--radius-sm)',
                  fontSize: '11px',
                  fontFamily: 'var(--font-mono)',
                  color: 'var(--color-secondary)',
                  wordBreak: 'break-all',
                }}
                data-testid="settings-storage-path"
              >
                {dataPath}
              </div>
            </div>

            {/* Security & Privacy Notice */}
            <div
              style={{
                padding: '12px',
                borderRadius: 'var(--radius-sm)',
                border: '1px solid var(--color-divider)',
                fontSize: '12px',
                lineHeight: '1.4',
                color: 'var(--color-secondary)',
                display: 'flex',
                gap: '8px',
              }}
            >
              <ShieldCheck size={18} color="var(--color-accent)" style={{ flexShrink: 0 }} />
              <div>
                <strong>Local-First Guarantee:</strong> Lumen Notes stores all notes and attachments
                exclusively on this device. No telemetry, tracking, or cloud sync is active. The local
                SQLite database is stored standard unencrypted at rest; use operating system full-disk
                encryption for hardware protection.
              </div>
            </div>
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
                border: 'none',
                backgroundColor: 'var(--color-accent)',
                color: '#FFFFFF',
                cursor: 'pointer',
                fontSize: '13px',
                fontWeight: 600,
              }}
            >
              Done
            </button>
          </div>
        </div>
      </div>

      {/* Import Preview Modal */}
      <ImportPreviewModal
        isOpen={isImportModalOpen}
        preview={importPreview}
        onClose={() => setIsImportModalOpen(false)}
        onConfirmImport={handleConfirmImport}
        onImportComplete={handleImportComplete}
      />
    </>
  );
};
