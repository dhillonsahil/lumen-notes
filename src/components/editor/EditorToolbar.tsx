import React, { useState, useRef, useEffect } from 'react';
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
  MoreHorizontal,
  FileDown,
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
  const [showMoreMenu, setShowMoreMenu] = useState(false);
  const moreMenuRef = useRef<HTMLDivElement>(null);
  const toolbarRef = useRef<HTMLDivElement>(null);
  const [toolbarWidth, setToolbarWidth] = useState<number>(1000);

  useEffect(() => {
    const el = toolbarRef.current;
    if (!el) return;

    if (typeof ResizeObserver === 'undefined') {
      setToolbarWidth(el.clientWidth || 800);
      return;
    }

    const observer = new ResizeObserver((entries) => {
      for (const entry of entries) {
        if (entry.contentBoxSize) {
          const width = entry.contentBoxSize[0]?.inlineSize ?? entry.contentRect.width;
          setToolbarWidth(width);
        } else {
          setToolbarWidth(entry.contentRect.width);
        }
      }
    });

    observer.observe(el);
    setToolbarWidth(el.clientWidth || 800);

    return () => observer.disconnect();
  }, []);

  const isFull = toolbarWidth >= 940;
  const isNarrow = toolbarWidth < 700;
  const showMoreButton = !isFull;

  useEffect(() => {
    if (!showMoreMenu) return;
    const handleClickOutside = (e: MouseEvent) => {
      if (moreMenuRef.current && !moreMenuRef.current.contains(e.target as Node)) {
        setShowMoreMenu(false);
      }
    };
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setShowMoreMenu(false);
    };
    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [showMoreMenu]);

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
    <div ref={toolbarRef} className="editor-toolbar" role="toolbar" aria-label="Editor Formatting Toolbar">
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
        {isFull && (
          <>
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
          </>
        )}

        {!isNarrow && <div className="toolbar-separator" />}

        {!isNarrow && (
          <>
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
          </>
        )}

        {isFull && (
          <>
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
          </>
        )}

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
        {onInsertImage && !isNarrow && (
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

        {onAttachClick && !isNarrow && (
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

        {onOpenSnapshots && !isNarrow && (
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

        {onExportNote && isFull && (
          <div style={{ position: 'relative', display: 'inline-flex', alignItems: 'center' }}>
            <select
              className="toolbar-export-select"
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

        {onToggleFind && !isNarrow && (
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

        {/* 3-Dot Responsive Overflow Menu: only rendered when not in full mode */}
        {showMoreButton && (
          <div style={{ position: 'relative' }} ref={moreMenuRef}>
            <button
              type="button"
              className={`toolbar-btn ${showMoreMenu ? 'is-active' : ''}`}
              onMouseDown={(e) => {
                e.preventDefault();
                setShowMoreMenu((prev) => !prev);
              }}
              title="More Options"
              aria-label="More Options"
              data-testid="toolbar-more-btn"
            >
              <MoreHorizontal size={16} />
            </button>

            {showMoreMenu && (
              <div className="toolbar-more-menu" data-testid="toolbar-more-menu">
                {onOpenSnapshots && (
                  <button
                    type="button"
                    className="toolbar-more-menu-item"
                    onClick={() => {
                      setShowMoreMenu(false);
                      onOpenSnapshots();
                    }}
                    data-testid="more-menu-history-btn"
                  >
                    <History size={15} />
                    <span>Version History & Snapshots</span>
                  </button>
                )}

                {isNarrow && onInsertImage && (
                  <button
                    type="button"
                    className="toolbar-more-menu-item"
                    onClick={() => {
                      setShowMoreMenu(false);
                      onInsertImage();
                    }}
                  >
                    <ImageIcon size={15} />
                    <span>Insert Image</span>
                  </button>
                )}

                {isNarrow && onAttachClick && (
                  <button
                    type="button"
                    className="toolbar-more-menu-item"
                    onClick={() => {
                      setShowMoreMenu(false);
                      onAttachClick();
                    }}
                  >
                    <Paperclip size={15} />
                    <span>Attach File</span>
                  </button>
                )}

                {isNarrow && onToggleFind && (
                  <button
                    type="button"
                    className={`toolbar-more-menu-item ${isFindOpen ? 'is-active' : ''}`}
                    onClick={() => {
                      setShowMoreMenu(false);
                      onToggleFind();
                    }}
                  >
                    <Search size={15} />
                    <span>Find in Note (Ctrl+F)</span>
                  </button>
                )}

                {/* Lists (when narrow) */}
                {isNarrow && (
                  <>
                    <div className="toolbar-more-menu-divider" />
                    <div className="toolbar-more-menu-section-title">Lists</div>
                    <button
                      type="button"
                      className={`toolbar-more-menu-item ${state.isBulletList ? 'is-active' : ''}`}
                      onClick={() => {
                        setShowMoreMenu(false);
                        executeToolbarAction(editor, 'bulletList');
                      }}
                    >
                      <List size={15} />
                      <span>Bulleted List</span>
                    </button>
                    <button
                      type="button"
                      className={`toolbar-more-menu-item ${state.isOrderedList ? 'is-active' : ''}`}
                      onClick={() => {
                        setShowMoreMenu(false);
                        executeToolbarAction(editor, 'orderedList');
                      }}
                    >
                      <ListOrdered size={15} />
                      <span>Numbered List</span>
                    </button>
                    <button
                      type="button"
                      className={`toolbar-more-menu-item ${state.isTaskList ? 'is-active' : ''}`}
                      onClick={() => {
                        setShowMoreMenu(false);
                        executeToolbarAction(editor, 'taskList');
                      }}
                    >
                      <CheckSquare size={15} />
                      <span>Checklist</span>
                    </button>
                  </>
                )}

                <div className="toolbar-more-menu-divider" />
                <div className="toolbar-more-menu-section-title">Formatting</div>

                <button
                  type="button"
                  className={`toolbar-more-menu-item ${state.isBlockquote ? 'is-active' : ''}`}
                  onClick={() => {
                    setShowMoreMenu(false);
                    executeToolbarAction(editor, 'blockquote');
                  }}
                >
                  <Quote size={15} />
                  <span>Blockquote</span>
                </button>

                <button
                  type="button"
                  className={`toolbar-more-menu-item ${state.isCodeBlock ? 'is-active' : ''}`}
                  onClick={() => {
                    setShowMoreMenu(false);
                    executeToolbarAction(editor, 'codeBlock');
                  }}
                >
                  <SquareCode size={15} />
                  <span>Code Block</span>
                </button>

                <button
                  type="button"
                  className="toolbar-more-menu-item"
                  onClick={() => {
                    setShowMoreMenu(false);
                    executeToolbarAction(editor, 'horizontalRule');
                  }}
                >
                  <Minus size={15} />
                  <span>Horizontal Rule</span>
                </button>

                <button
                  type="button"
                  className={`toolbar-more-menu-item ${state.isStrike ? 'is-active' : ''}`}
                  onClick={() => {
                    setShowMoreMenu(false);
                    executeToolbarAction(editor, 'strike');
                  }}
                >
                  <Strikethrough size={15} />
                  <span>Strikethrough</span>
                </button>

                <button
                  type="button"
                  className={`toolbar-more-menu-item ${state.isCode ? 'is-active' : ''}`}
                  onClick={() => {
                    setShowMoreMenu(false);
                    executeToolbarAction(editor, 'code');
                  }}
                >
                  <Code size={15} />
                  <span>Inline Code</span>
                </button>

                {onExportNote && (
                  <>
                    <div className="toolbar-more-menu-divider" />
                    <div className="toolbar-more-menu-section-title">Export Note</div>
                    <button
                      type="button"
                      className="toolbar-more-menu-item"
                      onClick={() => {
                        setShowMoreMenu(false);
                        onExportNote('txt');
                      }}
                    >
                      <FileDown size={15} />
                      <span>Plain Text (.txt)</span>
                    </button>
                    <button
                      type="button"
                      className="toolbar-more-menu-item"
                      onClick={() => {
                        setShowMoreMenu(false);
                        onExportNote('html');
                      }}
                    >
                      <FileDown size={15} />
                      <span>HTML (.html)</span>
                    </button>
                    <button
                      type="button"
                      className="toolbar-more-menu-item"
                      onClick={() => {
                        setShowMoreMenu(false);
                        onExportNote('json');
                      }}
                    >
                      <FileDown size={15} />
                      <span>JSON Archive (.json)</span>
                    </button>
                  </>
                )}
              </div>
            )}
          </div>
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
