import StarterKit from '@tiptap/starter-kit';
import TaskList from '@tiptap/extension-task-list';
import TaskItem from '@tiptap/extension-task-item';
import Placeholder from '@tiptap/extension-placeholder';
import Image from '@tiptap/extension-image';
import type { AnyExtension } from '@tiptap/core';

export interface LumenEditorExtensionsOptions {
  placeholder?: string;
}

/**
 * Creates and configures the Tiptap extensions for Lumen Notes.
 *
 * Avoids registering duplicate extensions already supplied by StarterKit
 * (StarterKit in Tiptap 3 includes Bold, Italic, Underline, Strike, Code,
 * CodeBlock, Blockquote, BulletList, OrderedList, HorizontalRule, Link, UndoRedo, etc.).
 */
export function getLumenEditorExtensions(options: LumenEditorExtensionsOptions = {}): AnyExtension[] {
  return [
    StarterKit.configure({
      heading: {
        levels: [1, 2, 3],
      },
      link: {
        openOnClick: false,
        autolink: false,
        HTMLAttributes: {
          rel: 'noopener noreferrer',
          target: '_blank',
          class: 'editor-link',
        },
      },
      dropcursor: {
        color: 'var(--color-accent)',
        width: 2,
      },
      // Responsive undo/redo history grouping
      undoRedo: {
        newGroupDelay: 200,
      },
    }),
    TaskList.configure({
      HTMLAttributes: {
        class: 'task-list',
      },
    }),
    TaskItem.configure({
      nested: true,
      HTMLAttributes: {
        class: 'task-item',
      },
    }),
    Placeholder.configure({
      placeholder: options.placeholder || 'Start writing...',
      emptyEditorClass: 'is-editor-empty',
      emptyNodeClass: 'is-empty',
    }),
    Image.configure({
      inline: true,
      allowBase64: true,
      HTMLAttributes: {
        class: 'editor-inline-image',
      },
    }),
  ];
}
