import React, { useState } from 'react';
import type { Editor } from '@tiptap/react';
import {
  Undo,
  Redo,
  Bold,
  Italic,
  Underline as UnderlineIcon,
  Strikethrough,
  Code,
  List,
  ListOrdered,
  CheckSquare,
  Quote,
  SquareCode,
  Minus,
  Link as LinkIcon,
  Unlink,
  Search,
  Paperclip,
  History,
  Image as ImageIcon,
} from 'lucide-react';
import { getToolbarState, executeToolbarAction } from '../../editor/commands';
import { isValidExternalUrl } from '../../editor/document';

interface EditorToolbarProps {
  editor: Editor | null;
  onToggleFind?: () => void;
  isFindOpen?: boolean;
  onAttachClick?: () => void;
  onInsertImage?: () => void;
  onOpenSnapshots?: () => void;
  onExportNote?: (format: 'txt' | 'html' | 'json') => void;
}

export const EditorToolbar: React.FC<EditorToolbarProps> = ({
  editor,
  onToggleFind,
  isFindOpen,
  onAttachClick,
  onInsertImage,
  onOpenSnapshots,
  onExportNote,
}) => {
  const state = getToolbarState(editor);
  const [showLinkDialog, setShowLinkDialog] = useState(false);
  const [linkInput, setLinkInput] = useState('');
  const [linkError, setLinkError] = useState('');

  const handleAction = (e: React.MouseEvent, action: string, value?: unknown) => {
    // Crucial: preventDefault so the ProseMirror editor does not lose selection/focus!
    e.preventDefault();
    executeToolbarAction(editor, action, value);
  };

  const handleStyleChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const val = e.target.value;
    if (val === 'p') {
      executeToolbarAction(editor, 'paragraph');
    } else if (val === 'h1') {
      executeToolbarAction(editor, 'heading1');
    } else if (val === 'h2') {
      executeToolbarAction(editor, 'heading2');
    } else if (val === 'h3') {
      executeToolbarAction(editor, 'heading3');
    }
  };

  const getCurrentStyleValue = (): string => {
    if (state.isHeading1) return 'h1';
    if (state.isHeading2) return 'h2';
    if (state.isHeading3) return 'h3';
    return 'p';
  };

  const openLinkDialog = (e: React.MouseEvent) => {
    e.preventDefault();
    setLinkInput(state.currentLinkUrl || '');
    setLinkError('');
    setShowLinkDialog(true);
  };

  const applyLink = (e: React.FormEvent) => {
    e.preventDefault();
    if (!linkInput.trim()) {
      executeToolbarAction(editor, 'unsetLink');
      setShowLinkDialog(false);
      return;
    }
    if (!isValidExternalUrl(linkInput.trim())) {
      setLinkError('Allowed schemes: https://, http://, mailto:');
      return;
    }
    executeToolbarAction(editor, 'setLink', linkInput.trim());
    setShowLinkDialog(false);
  };

  return (
    <div className="editor-toolbar" role="toolbar" aria-label="Editor Formatting Toolbar">
      <div className="toolbar-group">
        <button
          type="button"
          className="toolbar-btn"
          disabled={!state.canUndo}
          onMouseDown={(e) => handleAction(e, 'undo')}
          title="Undo (Ctrl+Z)"
          aria-label="Undo"
        >
          <Undo size={16} />
        </button>
        <button
          type="button"
          className="toolbar-btn"
          disabled={!state.canRedo}
          onMouseDown={(e) => handleAction(e, 'redo')}
          title="Redo (Ctrl+Y)"
          aria-label="Redo"
        >
          <Redo size={16} />
        </button>

        <div className="toolbar-separator" />

        <select
          className="toolbar-select"
          value={getCurrentStyleValue()}
          onChange={handleStyleChange}
          aria-label="Text Style"
          title="Text Style"
        >
          <option value="p">Paragraph</option>
          <option value="h1">Heading 1</option>
          <option value="h2">Heading 2</option>
          <option value="h3">Heading 3</option>
        </select>

        <div className="toolbar-separator" />

        <button
          type="button"
          className={`toolbar-btn ${state.isBold ? 'is-active' : ''}`}
          onMouseDown={(e) => handleAction(e, 'bold')}
          title="Bold (Ctrl+B)"
          aria-label="Bold"
          aria-pressed={state.isBold}
        >
          <Bold size={16} />
        </button>
        <button
          type="button"
          className={`toolbar-btn ${state.isItalic ? 'is-active' : ''}`}
          onMouseDown={(e) => handleAction(e, 'italic')}
          title="Italic (Ctrl+I)"
          aria-label="Italic"
          aria-pressed={state.isItalic}
        >
          <Italic size={16} />
        </button>
        <button
          type="button"
          className={`toolbar-btn ${state.isUnderline ? 'is-active' : ''}`}
          onMouseDown={(e) => handleAction(e, 'underline')}
          title="Underline (Ctrl+U)"
          aria-label="Underline"
          aria-pressed={state.isUnderline}
        >
          <UnderlineIcon size={16} />
        </button>
        <button
          type="button"
          className={`toolbar-btn ${state.isStrike ? 'is-active' : ''}`}
          onMouseDown={(e) => handleAction(e, 'strike')}
          title="Strikethrough"
          aria-label="Strikethrough"
          aria-pressed={state.isStrike}
        >
          <Strikethrough size={16} />
        </button>
        <button
          type="button"
          className={`toolbar-btn ${state.isCode ? 'is-active' : ''}`}
          onMouseDown={(e) => handleAction(e, 'code')}
          title="Inline Code"
          aria-label="Inline Code"
          aria-pressed={state.isCode}
        >
          <Code size={16} />
        </button>

        <div className="toolbar-separator" />

        <button
          type="button"
          className={`toolbar-btn ${state.isBulletList ? 'is-active' : ''}`}
          onMouseDown={(e) => handleAction(e, 'bulletList')}
          title="Bulleted List"
          aria-label="Bulleted List"
          aria-pressed={state.isBulletList}
        >
          <List size={16} />
        </button>
        <button
          type="button"
          className={`toolbar-btn ${state.isOrderedList ? 'is-active' : ''}`}
          onMouseDown={(e) => handleAction(e, 'orderedList')}
          title="Numbered List"
          aria-label="Numbered List"
          aria-pressed={state.isOrderedList}
        >
          <ListOrdered size={16} />
        </button>
        <button
          type="button"
          className={`toolbar-btn ${state.isTaskList ? 'is-active' : ''}`}
          onMouseDown={(e) => handleAction(e, 'taskList')}
          title="Checklist"
          aria-label="Checklist"
          aria-pressed={state.isTaskList}
        >
          <CheckSquare size={16} />
        </button>

        <div className="toolbar-separator" />

        <button
          type="button"
          className={`toolbar-btn ${state.isBlockquote ? 'is-active' : ''}`}
          onMouseDown={(e) => handleAction(e, 'blockquote')}
          title="Block Quote"
          aria-label="Block Quote"
          aria-pressed={state.isBlockquote}
        >
          <Quote size={16} />
        </button>
        <button
          type="button"
          className={`toolbar-btn ${state.isCodeBlock ? 'is-active' : ''}`}
          onMouseDown={(e) => handleAction(e, 'codeBlock')}
          title="Code Block"
          aria-label="Code Block"
          aria-pressed={state.isCodeBlock}
        >
          <SquareCode size={16} />
        </button>
        <button
          type="button"
          className="toolbar-btn"
          onMouseDown={(e) => handleAction(e, 'horizontalRule')}
          title="Horizontal Rule"
          aria-label="Horizontal Rule"
        >
          <Minus size={16} />
        </button>

        <div className="toolbar-separator" />

        <button
          type="button"
          className={`toolbar-btn ${state.isLink ? 'is-active' : ''}`}
          onMouseDown={openLinkDialog}
          title={state.isLink ? 'Edit Link' : 'Insert Link'}
          aria-label="Link"
        >
          <LinkIcon size={16} />
        </button>
        {state.isLink && (
          <button
            type="button"
            className="toolbar-btn"
            onMouseDown={(e) => handleAction(e, 'unsetLink')}
            title="Remove Link"
            aria-label="Remove Link"
          >
            <Unlink size={16} />
          </button>
        )}
      </div>

      <div className="toolbar-group">
        {onInsertImage && (
          <button
            type="button"
            className="toolbar-btn"
            onMouseDown={(e) => {
              e.preventDefault();
              onInsertImage();
            }}
            title="Insert image at cursor"
            aria-label="Insert image"
            data-testid="toolbar-insert-image-btn"
          >
            <ImageIcon size={16} />
          </button>
        )}

        {onAttachClick && (
          <button
            type="button"
            className="toolbar-btn"
            onMouseDown={(e) => {
              e.preventDefault();
              onAttachClick();
            }}
            title="Attach file (max 25MB)"
            aria-label="Attach file"
            data-testid="toolbar-attach-btn"
          >
            <Paperclip size={16} />
          </button>
        )}

        {onOpenSnapshots && (
          <button
            type="button"
            className="toolbar-btn"
            onMouseDown={(e) => {
              e.preventDefault();
              onOpenSnapshots();
            }}
            title="Version History & Snapshots"
            aria-label="Version history"
            data-testid="toolbar-history-btn"
          >
            <History size={16} />
          </button>
        )}

        {onExportNote && (
          <div style={{ position: 'relative', display: 'inline-flex', alignItems: 'center' }}>
            <select
              style={{
                height: '28px',
                fontSize: '11px',
                borderRadius: 'var(--radius-sm)',
                border: '1px solid var(--color-divider)',
                background: 'transparent',
                color: 'var(--color-secondary)',
                padding: '0 4px',
                cursor: 'pointer',
                outline: 'none',
              }}
              onChange={(e) => {
                if (e.target.value) {
                  onExportNote(e.target.value as 'txt' | 'html' | 'json');
                  e.target.value = '';
                }
              }}
              defaultValue=""
              aria-label="Export note"
              data-testid="toolbar-export-select"
            >
              <option value="" disabled>Export…</option>
              <option value="txt">Plain Text (.txt)</option>
              <option value="html">HTML (.html)</option>
              <option value="json">JSON (.json)</option>
            </select>
          </div>
        )}

        {onToggleFind && (
          <button
            type="button"
            className={`toolbar-btn ${isFindOpen ? 'is-active' : ''}`}
            onMouseDown={(e) => {
              e.preventDefault();
              onToggleFind();
            }}
            title="Find in note (Ctrl+F)"
            aria-label="Find in note"
          >
            <Search size={16} />
          </button>
        )}
      </div>

      {showLinkDialog && (
        <div
          style={{
            position: 'absolute',
            top: '56px',
            left: '260px',
            backgroundColor: 'var(--color-editor-bg)',
            border: '1px solid var(--color-divider)',
            borderRadius: 'var(--radius-md)',
            boxShadow: '0 4px 16px rgba(0,0,0,0.2)',
            padding: '12px',
            zIndex: 100,
            minWidth: '280px',
          }}
        >
          <form onSubmit={applyLink}>
            <div style={{ fontSize: '12px', fontWeight: 600, marginBottom: '6px' }}>Insert Link</div>
            <input
              type="text"
              value={linkInput}
              onChange={(e) => setLinkInput(e.target.value)}
              placeholder="https://example.com"
              style={{
                width: '100%',
                height: '28px',
                padding: '0 8px',
                boxSizing: 'border-box',
                borderRadius: '4px',
                border: '1px solid var(--color-divider)',
                backgroundColor: 'var(--color-main-bg)',
                color: 'var(--color-text)',
                fontSize: '13px',
                marginBottom: '6px',
              }}
              autoFocus
            />
            {linkError && (
              <div style={{ color: 'var(--color-danger)', fontSize: '11px', marginBottom: '6px' }}>
                {linkError}
              </div>
            )}
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '6px' }}>
              <button
                type="button"
                onClick={() => setShowLinkDialog(false)}
                style={{
                  padding: '4px 8px',
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
                  padding: '4px 10px',
                  borderRadius: '4px',
                  border: 'none',
                  backgroundColor: 'var(--color-accent)',
                  color: '#FFFFFF',
                  cursor: 'pointer',
                  fontSize: '12px',
                  fontWeight: 600,
                }}
              >
                Apply
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
};
