import type { Editor } from '@tiptap/react';
import { isValidExternalUrl } from './document';

export interface EditorToolbarState {
  canUndo: boolean;
  canRedo: boolean;
  isBold: boolean;
  isItalic: boolean;
  isUnderline: boolean;
  isStrike: boolean;
  isCode: boolean;
  isHeading1: boolean;
  isHeading2: boolean;
  isHeading3: boolean;
  isParagraph: boolean;
  isBulletList: boolean;
  isOrderedList: boolean;
  isTaskList: boolean;
  isBlockquote: boolean;
  isCodeBlock: boolean;
  isLink: boolean;
  currentLinkUrl?: string;
}

export function getToolbarState(editor: Editor | null): EditorToolbarState {
  if (!editor || editor.isDestroyed) {
    return {
      canUndo: false,
      canRedo: false,
      isBold: false,
      isItalic: false,
      isUnderline: false,
      isStrike: false,
      isCode: false,
      isHeading1: false,
      isHeading2: false,
      isHeading3: false,
      isParagraph: false,
      isBulletList: false,
      isOrderedList: false,
      isTaskList: false,
      isBlockquote: false,
      isCodeBlock: false,
      isLink: false,
    };
  }

  const linkAttrs = editor.getAttributes('link');

  return {
    canUndo: editor.can().undo(),
    canRedo: editor.can().redo(),
    isBold: editor.isActive('bold'),
    isItalic: editor.isActive('italic'),
    isUnderline: editor.isActive('underline'),
    isStrike: editor.isActive('strike'),
    isCode: editor.isActive('code'),
    isHeading1: editor.isActive('heading', { level: 1 }),
    isHeading2: editor.isActive('heading', { level: 2 }),
    isHeading3: editor.isActive('heading', { level: 3 }),
    isParagraph: editor.isActive('paragraph'),
    isBulletList: editor.isActive('bulletList'),
    isOrderedList: editor.isActive('orderedList'),
    isTaskList: editor.isActive('taskList'),
    isBlockquote: editor.isActive('blockquote'),
    isCodeBlock: editor.isActive('codeBlock'),
    isLink: editor.isActive('link'),
    currentLinkUrl: linkAttrs?.href,
  };
}

export function executeToolbarAction(editor: Editor | null, action: string, value?: unknown): void {
  if (!editor || editor.isDestroyed) return;

  if (action === 'undo') {
    editor.commands.undo();
    return;
  }

  if (action === 'redo') {
    editor.commands.redo();
    return;
  }

  const chain = editor.chain().focus();

  switch (action) {
    case 'bold':
      chain.toggleBold().run();
      break;
    case 'italic':
      chain.toggleItalic().run();
      break;
    case 'underline':
      chain.toggleUnderline().run();
      break;
    case 'strike':
      chain.toggleStrike().run();
      break;
    case 'code':
      chain.toggleCode().run();
      break;
    case 'heading1':
      chain.toggleHeading({ level: 1 }).run();
      break;
    case 'heading2':
      chain.toggleHeading({ level: 2 }).run();
      break;
    case 'heading3':
      chain.toggleHeading({ level: 3 }).run();
      break;
    case 'paragraph':
      chain.setParagraph().run();
      break;
    case 'bulletList':
      chain.toggleBulletList().run();
      break;
    case 'orderedList':
      chain.toggleOrderedList().run();
      break;
    case 'taskList':
      chain.toggleTaskList().run();
      break;
    case 'blockquote':
      chain.toggleBlockquote().run();
      break;
    case 'codeBlock':
      chain.toggleCodeBlock().run();
      break;
    case 'horizontalRule':
      chain.setHorizontalRule().run();
      break;
    case 'setLink':
      if (typeof value === 'string' && isValidExternalUrl(value)) {
        chain.setLink({ href: value }).run();
      }
      break;
    case 'unsetLink':
      chain.unsetLink().run();
      break;
  }
}
