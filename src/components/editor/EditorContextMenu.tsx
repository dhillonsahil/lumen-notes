import React, { useEffect, useRef } from 'react';
import type { Editor } from '@tiptap/react';
import {
  Bold,
  Italic,
  Underline as UnderlineIcon,
  Strikethrough,
  Code,
  Link as LinkIcon,
  Heading1,
  Heading2,
  Pilcrow,
  CheckSquare,
  List,
  ListOrdered,
  Quote,
  Image as ImageIcon,
  Paperclip,
  Scissors,
  Copy,
  Clipboard,
} from 'lucide-react';

export interface EditorContextMenuProps {
  x: number;
  y: number;
  editor: Editor | null;
  onClose: () => void;
  onInsertImage?: () => void;
  onAttachFile?: () => void;
}

export const EditorContextMenu: React.FC<EditorContextMenuProps> = ({
  x,
  y,
  editor,
  onClose,
  onInsertImage,
  onAttachFile,
}) => {
  const menuRef = useRef<HTMLDivElement>(null);

  // Position clamping to keep the menu fully within viewport
  const menuWidth = 230;
  const menuHeight = 440;
  const posX = Math.min(x, window.innerWidth - menuWidth - 12);
  const posY = Math.min(y, window.innerHeight - menuHeight - 12);

  // Close menu on clicks outside, resize, or escape
  useEffect(() => {
    const handleMouseDown = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        onClose();
      }
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };

    const handleScroll = () => {
      onClose();
    };

    window.addEventListener('mousedown', handleMouseDown);
    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('scroll', handleScroll, true);

    return () => {
      window.removeEventListener('mousedown', handleMouseDown);
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('scroll', handleScroll, true);
    };
  }, [onClose]);

  if (!editor) return null;

  const hasSelection = !editor.state.selection.empty;
  const isBold = editor.isActive('bold');
  const isItalic = editor.isActive('italic');
  const isUnderline = editor.isActive('underline');
  const isStrike = editor.isActive('strike');
  const isCode = editor.isActive('code');
  const isLink = editor.isActive('link');
  const isH1 = editor.isActive('heading', { level: 1 });
  const isH2 = editor.isActive('heading', { level: 2 });
  const isBulletList = editor.isActive('bulletList');
  const isOrderedList = editor.isActive('orderedList');
  const isTaskList = editor.isActive('taskList');
  const isBlockquote = editor.isActive('blockquote');

  const handleAction = (callback: () => void) => {
    callback();
    onClose();
  };

  const handleCut = () => {
    handleAction(() => {
      document.execCommand('cut');
    });
  };

  const handleCopy = () => {
    handleAction(() => {
      document.execCommand('copy');
    });
  };

  const handlePaste = async () => {
    try {
      const text = await navigator.clipboard.readText();
      if (text) {
        editor.chain().focus().insertContent(text).run();
      }
    } catch {
      document.execCommand('paste');
    }
    onClose();
  };

  const handleToggleLink = () => {
    handleAction(() => {
      if (isLink) {
        editor.chain().focus().unsetLink().run();
      } else {
        const url = window.prompt('Enter link URL (https://...):');
        if (url && (url.startsWith('https://') || url.startsWith('http://') || url.startsWith('mailto:'))) {
          editor.chain().focus().setLink({ href: url }).run();
        }
      }
    });
  };

  return (
    <div
      ref={menuRef}
      className="editor-context-menu"
      style={{
        left: `${posX}px`,
        top: `${posY}px`,
      }}
      data-testid="editor-context-menu"
      onContextMenu={(e) => e.preventDefault()}
    >
      {/* Clipboard tools */}
      <div className="context-menu-section">
        <button
          type="button"
          className="context-menu-item"
          disabled={!hasSelection}
          onClick={handleCut}
        >
          <Scissors size={14} />
          <span className="context-menu-label">Cut</span>
          <span className="context-menu-shortcut">Ctrl+X</span>
        </button>
        <button
          type="button"
          className="context-menu-item"
          disabled={!hasSelection}
          onClick={handleCopy}
        >
          <Copy size={14} />
          <span className="context-menu-label">Copy</span>
          <span className="context-menu-shortcut">Ctrl+C</span>
        </button>
        <button
          type="button"
          className="context-menu-item"
          onClick={handlePaste}
        >
          <Clipboard size={14} />
          <span className="context-menu-label">Paste</span>
          <span className="context-menu-shortcut">Ctrl+V</span>
        </button>
      </div>

      <div className="context-menu-divider" />

      {/* Formatting tools */}
      <div className="context-menu-section">
        <button
          type="button"
          className={`context-menu-item ${isBold ? 'is-active' : ''}`}
          onClick={() => handleAction(() => editor.chain().focus().toggleBold().run())}
        >
          <Bold size={14} />
          <span className="context-menu-label">Bold</span>
          <span className="context-menu-shortcut">Ctrl+B</span>
        </button>
        <button
          type="button"
          className={`context-menu-item ${isItalic ? 'is-active' : ''}`}
          onClick={() => handleAction(() => editor.chain().focus().toggleItalic().run())}
        >
          <Italic size={14} />
          <span className="context-menu-label">Italic</span>
          <span className="context-menu-shortcut">Ctrl+I</span>
        </button>
        <button
          type="button"
          className={`context-menu-item ${isUnderline ? 'is-active' : ''}`}
          onClick={() => handleAction(() => editor.chain().focus().toggleUnderline().run())}
        >
          <UnderlineIcon size={14} />
          <span className="context-menu-label">Underline</span>
          <span className="context-menu-shortcut">Ctrl+U</span>
        </button>
        <button
          type="button"
          className={`context-menu-item ${isStrike ? 'is-active' : ''}`}
          onClick={() => handleAction(() => editor.chain().focus().toggleStrike().run())}
        >
          <Strikethrough size={14} />
          <span className="context-menu-label">Strikethrough</span>
        </button>
        <button
          type="button"
          className={`context-menu-item ${isCode ? 'is-active' : ''}`}
          onClick={() => handleAction(() => editor.chain().focus().toggleCode().run())}
        >
          <Code size={14} />
          <span className="context-menu-label">Inline Code</span>
        </button>
        <button
          type="button"
          className={`context-menu-item ${isLink ? 'is-active' : ''}`}
          onClick={handleToggleLink}
        >
          <LinkIcon size={14} />
          <span className="context-menu-label">{isLink ? 'Remove Link' : 'Add Link'}</span>
        </button>
      </div>

      <div className="context-menu-divider" />

      {/* Structure & Headings */}
      <div className="context-menu-section">
        <button
          type="button"
          className="context-menu-item"
          onClick={() => handleAction(() => editor.chain().focus().setParagraph().run())}
        >
          <Pilcrow size={14} />
          <span className="context-menu-label">Normal Text</span>
        </button>
        <button
          type="button"
          className={`context-menu-item ${isH1 ? 'is-active' : ''}`}
          onClick={() => handleAction(() => editor.chain().focus().toggleHeading({ level: 1 }).run())}
        >
          <Heading1 size={14} />
          <span className="context-menu-label">Heading 1</span>
        </button>
        <button
          type="button"
          className={`context-menu-item ${isH2 ? 'is-active' : ''}`}
          onClick={() => handleAction(() => editor.chain().focus().toggleHeading({ level: 2 }).run())}
        >
          <Heading2 size={14} />
          <span className="context-menu-label">Heading 2</span>
        </button>
        <button
          type="button"
          className={`context-menu-item ${isTaskList ? 'is-active' : ''}`}
          onClick={() => handleAction(() => editor.chain().focus().toggleTaskList().run())}
        >
          <CheckSquare size={14} />
          <span className="context-menu-label">Checklist</span>
        </button>
        <button
          type="button"
          className={`context-menu-item ${isBulletList ? 'is-active' : ''}`}
          onClick={() => handleAction(() => editor.chain().focus().toggleBulletList().run())}
        >
          <List size={14} />
          <span className="context-menu-label">Bullet List</span>
        </button>
        <button
          type="button"
          className={`context-menu-item ${isOrderedList ? 'is-active' : ''}`}
          onClick={() => handleAction(() => editor.chain().focus().toggleOrderedList().run())}
        >
          <ListOrdered size={14} />
          <span className="context-menu-label">Numbered List</span>
        </button>
        <button
          type="button"
          className={`context-menu-item ${isBlockquote ? 'is-active' : ''}`}
          onClick={() => handleAction(() => editor.chain().focus().toggleBlockquote().run())}
        >
          <Quote size={14} />
          <span className="context-menu-label">Quote Block</span>
        </button>
      </div>

      <div className="context-menu-divider" />

      {/* Media & Attachments */}
      <div className="context-menu-section">
        {onInsertImage && (
          <button
            type="button"
            className="context-menu-item"
            onClick={() => handleAction(onInsertImage)}
          >
            <ImageIcon size={14} />
            <span className="context-menu-label">Insert Image…</span>
          </button>
        )}
        {onAttachFile && (
          <button
            type="button"
            className="context-menu-item"
            onClick={() => handleAction(onAttachFile)}
          >
            <Paperclip size={14} />
            <span className="context-menu-label">Attach File…</span>
          </button>
        )}
      </div>
    </div>
  );
};
