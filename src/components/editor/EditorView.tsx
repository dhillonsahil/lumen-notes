import React, { useEffect, useState, useRef, useCallback } from 'react';
import { useEditor, EditorContent } from '@tiptap/react';
import type { JSONContent } from '@tiptap/core';
import { getLumenEditorExtensions } from '../../editor/extensions';
import { sanitizePastedHtml } from '../../editor/clipboard';
import { extractPlainText, calculateDocumentStats } from '../../editor/document';
import { EditorToolbar } from './EditorToolbar';
import { SnapshotModal } from '../dialogs/SnapshotModal';
import { ipcClient } from '../../ipc/client';
import type { Attachment } from '../../ipc/types';
import {
  X,
  ChevronDown,
  ChevronUp,
  Trash2,
  FileText,
  Image as ImageIcon,
  Download,
} from 'lucide-react';

export type SaveStatus = 'saved' | 'saving' | 'dirty' | 'error';

export interface EditorViewProps {
  noteId?: string;
  initialTitle?: string;
  initialContent?: JSONContent;
  saveStatus?: SaveStatus;
  errorMessage?: string;
  onContentChange?: (title: string, content: JSONContent, plainText: string) => void;
  onRetrySave?: () => void;
  onReloadNote?: () => void;
}

const DEFAULT_DOC: JSONContent = {
  type: 'doc',
  content: [{ type: 'paragraph' }],
};

export const EditorView: React.FC<EditorViewProps> = ({
  noteId,
  initialTitle = '',
  initialContent,
  saveStatus = 'saved',
  errorMessage,
  onContentChange,
  onRetrySave,
  onReloadNote,
}) => {
  const [title, setTitle] = useState(initialTitle);
  const [isFindOpen, setIsFindOpen] = useState(false);
  const [findQuery, setFindQuery] = useState('');
  const [findMatches, setFindMatches] = useState<number>(0);
  const [currentMatchIndex, setCurrentMatchIndex] = useState<number>(0);
  const [, setToolbarUpdateCounter] = useState(0);

  // Attachments state
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const [attachmentThumbnails, setAttachmentThumbnails] = useState<Record<string, string>>({});
  const fileInputRef = useRef<HTMLInputElement>(null);
  const inlineImageInputRef = useRef<HTMLInputElement>(null);

  // Lightbox viewer state
  const [lightboxItem, setLightboxItem] = useState<{
    name: string;
    url: string;
    sizeBytes?: number;
  } | null>(null);

  // Snapshots state
  const [isSnapshotModalOpen, setIsSnapshotModalOpen] = useState(false);

  // Emergency crash recovery draft state
  const [emergencyDraft, setEmergencyDraft] = useState<{ title: string; document_json: string } | null>(null);
  const prevSaveStatusRef = useRef(saveStatus);

  const titleRef = useRef(title);
  titleRef.current = title;

  // Track the active noteId to only reload content when noteId changes
  const activeNoteIdRef = useRef(noteId);
  const isSettingContentRef = useRef(false);

  const editor = useEditor({
    extensions: getLumenEditorExtensions(),
    content: initialContent || DEFAULT_DOC,
    editorProps: {
      transformPastedHTML(html) {
        return sanitizePastedHtml(html);
      },
      handlePaste(_view, event) {
        const items = event.clipboardData?.items;
        if (items) {
          for (let i = 0; i < items.length; i++) {
            if (items[i].type.indexOf('image') !== -1) {
              const file = items[i].getAsFile();
              if (file) {
                const reader = new FileReader();
                reader.onload = () => {
                  const dataUrl = reader.result as string;
                  editor?.chain().focus().setImage({ src: dataUrl, alt: file.name || 'Pasted Image' }).run();
                };
                reader.readAsDataURL(file);
                return true;
              }
            }
          }
        }
        const plainText = event.clipboardData?.getData('text/plain');
        if (plainText && !event.clipboardData?.types.includes('text/html')) {
          return false;
        }
        return false;
      },
    },
    onUpdate({ editor }) {
      if (isSettingContentRef.current) return;
      setToolbarUpdateCounter((c) => c + 1);

      const json = editor.getJSON();
      const plain = extractPlainText(json);
      onContentChange?.(titleRef.current, json, plain);

      // Save emergency crash recovery draft
      if (noteId) {
        localStorage.setItem(
          `lumen_draft_${noteId}`,
          JSON.stringify({ title: titleRef.current, document_json: JSON.stringify(json), time: Date.now() })
        );
      }
    },
    onSelectionUpdate() {
      setToolbarUpdateCounter((c) => c + 1);
    },
    onTransaction() {
      setToolbarUpdateCounter((c) => c + 1);
    },
  });

  // Check for emergency draft on mount or noteId change
  useEffect(() => {
    if (noteId) {
      const savedDraft = localStorage.getItem(`lumen_draft_${noteId}`);
      if (savedDraft) {
        try {
          const parsed = JSON.parse(savedDraft);
          setEmergencyDraft(parsed);
        } catch {
          setEmergencyDraft(null);
        }
      } else {
        setEmergencyDraft(null);
      }
    }
  }, [noteId]);

  // When noteId changes, update title, reset content
  useEffect(() => {
    if (activeNoteIdRef.current !== noteId) {
      activeNoteIdRef.current = noteId;
      setTitle(initialTitle);

      if (editor) {
        isSettingContentRef.current = true;
        editor.commands.setContent(initialContent || DEFAULT_DOC, { emitUpdate: false });
        isSettingContentRef.current = false;
        setToolbarUpdateCounter((c) => c + 1);
      }
    }
  }, [noteId, initialTitle, initialContent, editor]);

  // Load attachments
  const loadAttachments = useCallback(async () => {
    if (!noteId) return;
    try {
      const atts = await ipcClient.listAttachments(noteId);
      setAttachments(atts);
      const thumbs: Record<string, string> = {};
      for (const a of atts) {
        if (a.mime_type.startsWith('image/')) {
          try {
            const dataUrl = await ipcClient.getAttachmentData(a.id);
            thumbs[a.id] = dataUrl;
          } catch (err) {
            console.error('Failed to load attachment thumbnail:', err);
          }
        }
      }
      setAttachmentThumbnails(thumbs);
    } catch (err) {
      console.error('Failed to list attachments:', err);
    }
  }, [noteId]);

  useEffect(() => {
    loadAttachments();
  }, [loadAttachments]);

  // Clear emergency draft only after an active save succeeds
  useEffect(() => {
    if (prevSaveStatusRef.current === 'saving' && saveStatus === 'saved' && noteId) {
      localStorage.removeItem(`lumen_draft_${noteId}`);
    }
    prevSaveStatusRef.current = saveStatus;
  }, [saveStatus, noteId]);

  const handleTitleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newTitle = e.target.value;
    setTitle(newTitle);
    if (editor) {
      const json = editor.getJSON();
      const plain = extractPlainText(json);
      onContentChange?.(newTitle, json, plain);
      if (noteId) {
        localStorage.setItem(
          `lumen_draft_${noteId}`,
          JSON.stringify({ title: newTitle, document_json: JSON.stringify(json), time: Date.now() })
        );
      }
    }
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !noteId) return;

    const reader = new FileReader();
    reader.onload = async () => {
      const result = reader.result as string;
      const base64 = result.includes(',') ? result.split(',')[1] : result;
      try {
        const newAtt = await ipcClient.addAttachment(
          noteId,
          file.name,
          file.type || 'application/octet-stream',
          base64
        );
        setAttachments((prev) => [...prev, newAtt]);
        if (newAtt.mime_type.startsWith('image/')) {
          setAttachmentThumbnails((prev) => ({ ...prev, [newAtt.id]: result }));
        }
      } catch (err: unknown) {
        console.error('Attachment upload failed:', err);
        alert(err instanceof Error ? err.message : String(err));
      }
    };
    reader.readAsDataURL(file);
    e.target.value = '';
  };

  const handleInsertInlineImage = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !editor) return;

    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = reader.result as string;
      editor.chain().focus().setImage({ src: dataUrl, alt: file.name }).run();
    };
    reader.readAsDataURL(file);
    e.target.value = '';
  };

  const handleOpenAttachment = async (att: Attachment) => {
    try {
      const dataUrl = await ipcClient.getAttachmentData(att.id);
      if (att.mime_type.startsWith('image/')) {
        setLightboxItem({
          name: att.original_name,
          url: dataUrl,
          sizeBytes: att.size_bytes,
        });
      } else {
        const a = document.createElement('a');
        a.href = dataUrl;
        a.download = att.original_name;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
      }
    } catch (err) {
      console.error('Failed to open attachment:', err);
      alert('Failed to open attachment: ' + (err instanceof Error ? err.message : String(err)));
    }
  };

  const handleDeleteAttachment = async (id: string) => {
    if (window.confirm('Delete this attachment?')) {
      try {
        await ipcClient.deleteAttachment(id);
        setAttachments((prev) => prev.filter((a) => a.id !== id));
      } catch (err) {
        console.error('Failed to delete attachment:', err);
      }
    }
  };

  const handleExportNote = async (format: 'txt' | 'html' | 'json') => {
    if (!noteId) return;
    try {
      const content = await ipcClient.exportNote(noteId, format);
      const mime =
        format === 'html'
          ? 'text/html'
          : format === 'json'
          ? 'application/json'
          : 'text/plain';
      const blob = new Blob([content], { type: mime });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${title || 'note'}.${format}`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error('Failed to export note:', err);
    }
  };

  // Keyboard shortcut for Find in note and Lightbox Escape
  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (lightboxItem) {
          setLightboxItem(null);
          return;
        }
        if (isFindOpen) {
          setIsFindOpen(false);
          return;
        }
      }
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'f') {
        e.preventDefault();
        setIsFindOpen((prev) => !prev);
      }
    },
    [isFindOpen, lightboxItem]
  );

  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleKeyDown]);

  // Click on canvas / empty space focuses editor at the end
  const handleScrollAreaClick = (e: React.MouseEvent<HTMLDivElement>) => {
    const target = e.target as HTMLElement;

    // If clicked on an image inside the editor, open lightbox viewer
    if (target.tagName.toLowerCase() === 'img') {
      const img = target as HTMLImageElement;
      setLightboxItem({
        name: img.alt || 'Inline Image',
        url: img.src,
      });
      return;
    }

    // If clicked inside interactive controls (inputs, buttons, chip, banners, find bar)
    if (
      target.closest(
        '.editor-title-input, .editor-attachments, button, input, .editor-draft-banner, .editor-find-bar'
      )
    ) {
      return;
    }

    // If clicked on empty space in scroll area or content wrapper, focus editor at end
    if (
      target.classList.contains('editor-scroll-area') ||
      target.classList.contains('editor-content-wrapper') ||
      target.getAttribute('data-testid') === 'editor-content' ||
      target.classList.contains('tiptap')
    ) {
      editor?.commands.focus('end');
    }
  };

  // Find logic in document plain text
  useEffect(() => {
    if (!editor || !isFindOpen || !findQuery.trim()) {
      setFindMatches(0);
      setCurrentMatchIndex(0);
      return;
    }
    const plain = extractPlainText(editor.getJSON());
    const regex = new RegExp(findQuery.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gi');
    const matches = plain.match(regex);
    setFindMatches(matches ? matches.length : 0);
    setCurrentMatchIndex(matches && matches.length > 0 ? 1 : 0);
  }, [editor, findQuery, isFindOpen]);

  // Document stats
  const plainText = editor ? extractPlainText(editor.getJSON()) : '';
  const stats = calculateDocumentStats(plainText);

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  return (
    <div className="editor-container" data-testid="editor-container">
      <EditorToolbar
        editor={editor}
        onToggleFind={() => setIsFindOpen((prev) => !prev)}
        isFindOpen={isFindOpen}
        onAttachClick={() => fileInputRef.current?.click()}
        onInsertImage={() => inlineImageInputRef.current?.click()}
        onOpenSnapshots={() => setIsSnapshotModalOpen(true)}
        onExportNote={handleExportNote}
      />

      {/* Hidden file input for attachments */}
      <input
        ref={fileInputRef}
        type="file"
        style={{ display: 'none' }}
        onChange={handleFileUpload}
        data-testid="attachment-file-input"
      />

      {/* Hidden file input for inline images */}
      <input
        ref={inlineImageInputRef}
        type="file"
        accept="image/*"
        style={{ display: 'none' }}
        onChange={handleInsertInlineImage}
        data-testid="inline-image-file-input"
      />

      {/* Emergency Crash Recovery Banner */}
      {emergencyDraft && (
        <div className="editor-draft-banner" data-testid="emergency-draft-banner">
          <span>Unsaved emergency recovery draft found from previous session.</span>
          <div style={{ display: 'flex', gap: '8px' }}>
            <button
              type="button"
              onClick={() => {
                setTitle(emergencyDraft.title);
                try {
                  const parsed = JSON.parse(emergencyDraft.document_json);
                  editor?.commands.setContent(parsed);
                } catch {}
                if (noteId) localStorage.removeItem(`lumen_draft_${noteId}`);
                setEmergencyDraft(null);
              }}
              style={{
                padding: '2px 8px',
                borderRadius: 'var(--radius-sm)',
                border: 'none',
                backgroundColor: 'var(--color-accent)',
                color: '#FFFFFF',
                cursor: 'pointer',
                fontSize: '11px',
                fontWeight: 600,
              }}
              data-testid="restore-draft-btn"
            >
              Restore Draft
            </button>
            <button
              type="button"
              onClick={() => {
                if (noteId) localStorage.removeItem(`lumen_draft_${noteId}`);
                setEmergencyDraft(null);
              }}
              style={{
                padding: '2px 8px',
                borderRadius: 'var(--radius-sm)',
                border: '1px solid var(--color-divider)',
                background: 'transparent',
                color: 'var(--color-secondary)',
                cursor: 'pointer',
                fontSize: '11px',
              }}
            >
              Discard
            </button>
          </div>
        </div>
      )}

      {isFindOpen && (
        <div className="editor-find-bar" data-testid="editor-find-bar">
          <input
            type="text"
            className="find-input"
            placeholder="Find in note..."
            value={findQuery}
            onChange={(e) => setFindQuery(e.target.value)}
            autoFocus
          />
          <span className="find-stats">
            {findMatches > 0
              ? `${currentMatchIndex} of ${findMatches}`
              : findQuery
              ? 'No matches'
              : ''}
          </span>
          <button
            type="button"
            className="toolbar-btn"
            disabled={findMatches === 0}
            onClick={() =>
              setCurrentMatchIndex((prev) => (prev > 1 ? prev - 1 : findMatches))
            }
            title="Previous match"
          >
            <ChevronUp size={14} />
          </button>
          <button
            type="button"
            className="toolbar-btn"
            disabled={findMatches === 0}
            onClick={() =>
              setCurrentMatchIndex((prev) => (prev < findMatches ? prev + 1 : 1))
            }
            title="Next match"
          >
            <ChevronDown size={14} />
          </button>
          <button
            type="button"
            className="toolbar-btn"
            onClick={() => setIsFindOpen(false)}
            title="Close find"
          >
            <X size={14} />
          </button>
        </div>
      )}

      <div className="editor-scroll-area" onClick={handleScrollAreaClick}>
        <div className="editor-content-wrapper">
          <input
            type="text"
            className="editor-title-input"
            placeholder="Title"
            value={title}
            onChange={handleTitleChange}
            data-testid="editor-title-input"
            aria-label="Note Title"
          />
          <EditorContent editor={editor} data-testid="editor-content" />

          {/* Attachments Section */}
          {attachments.length > 0 && (
            <div className="editor-attachments" data-testid="attachments-drawer">
              {attachments.map((att) => (
                <div
                  key={att.id}
                  className="attachment-chip"
                  data-testid={`attachment-chip-${att.id}`}
                  onClick={() => handleOpenAttachment(att)}
                  role="button"
                  tabIndex={0}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      handleOpenAttachment(att);
                    }
                  }}
                  title={`Click to open ${att.original_name}`}
                >
                  {attachmentThumbnails[att.id] ? (
                    <img
                      src={attachmentThumbnails[att.id]}
                      alt={att.original_name}
                      className="attachment-thumbnail"
                    />
                  ) : (
                    <FileText size={14} color="var(--color-secondary)" />
                  )}
                  <span className="attachment-chip-name" title={att.original_name}>
                    {att.original_name}
                  </span>
                  <span className="attachment-chip-size">({formatFileSize(att.size_bytes)})</span>
                  <button
                    type="button"
                    className="attachment-chip-btn"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleDeleteAttachment(att.id);
                    }}
                    title="Remove attachment"
                    aria-label={`Remove attachment ${att.original_name}`}
                  >
                    <Trash2 size={12} />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      <div className="editor-status-bar" data-testid="editor-status-bar">
        <div className="status-left">
          <div className="status-badge">
            <span className={`status-indicator ${saveStatus}`} />
            <span>
              {saveStatus === 'saved' && 'Saved'}
              {saveStatus === 'saving' && 'Saving…'}
              {saveStatus === 'dirty' && 'Unsaved changes'}
              {saveStatus === 'error' && (errorMessage || 'Save error')}
            </span>
            {saveStatus === 'error' && onRetrySave && (
              <button
                type="button"
                onClick={onRetrySave}
                style={{
                  background: 'none',
                  border: 'none',
                  color: 'var(--color-accent)',
                  cursor: 'pointer',
                  textDecoration: 'underline',
                  fontSize: '11px',
                  marginLeft: '4px',
                }}
              >
                Retry
              </button>
            )}
          </div>
        </div>

        <div className="status-right">
          <span>
            {stats.words} {stats.words === 1 ? 'word' : 'words'} ·{' '}
            {stats.characters} {stats.characters === 1 ? 'character' : 'characters'}
          </span>
        </div>
      </div>

      {/* Snapshots Modal */}
      {noteId && (
        <SnapshotModal
          isOpen={isSnapshotModalOpen}
          noteId={noteId}
          onClose={() => setIsSnapshotModalOpen(false)}
          onSnapshotRestored={(restored) => {
            setTitle(restored.title);
            try {
              const json = JSON.parse(restored.document_json);
              editor?.commands.setContent(json);
            } catch {}
            onReloadNote?.();
            loadAttachments();
          }}
        />
      )}

      {/* Lightbox Image / Attachment Modal */}
      {lightboxItem && (
        <div
          className="editor-lightbox-overlay"
          data-testid="attachment-lightbox"
          onClick={() => setLightboxItem(null)}
        >
          <div
            className="editor-lightbox-card"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="editor-lightbox-header">
              <div className="editor-lightbox-title" title={lightboxItem.name}>
                <ImageIcon size={16} />
                <span>{lightboxItem.name}</span>
                {lightboxItem.sizeBytes !== undefined && (
                  <span className="editor-lightbox-size">
                    ({formatFileSize(lightboxItem.sizeBytes)})
                  </span>
                )}
              </div>
              <div className="editor-lightbox-actions">
                <a
                  href={lightboxItem.url}
                  download={lightboxItem.name}
                  className="editor-lightbox-btn"
                  title="Download file"
                >
                  <Download size={14} />
                  <span>Save</span>
                </a>
                <button
                  type="button"
                  className="editor-lightbox-btn close"
                  onClick={() => setLightboxItem(null)}
                  title="Close viewer"
                  aria-label="Close viewer"
                >
                  <X size={16} />
                </button>
              </div>
            </div>
            <div className="editor-lightbox-body">
              <img
                src={lightboxItem.url}
                alt={lightboxItem.name}
                className="editor-lightbox-img"
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
