import type { JSONContent } from '@tiptap/core';

export const CURRENT_DOCUMENT_VERSION = 1;

export interface LumenDocument {
  version: number;
  content: JSONContent;
}

/**
 * Creates an empty canonical document structure.
 */
export function createEmptyDocument(): JSONContent {
  return {
    type: 'doc',
    content: [
      {
        type: 'paragraph',
      },
    ],
  };
}

/**
 * Safely extracts plain text from a Tiptap JSONContent node tree.
 * Preserves paragraph breaks and handles list items cleanly.
 */
export function extractPlainText(content: JSONContent | null | undefined): string {
  if (!content) return '';

  const chunks: string[] = [];

  function traverse(node: JSONContent) {
    if (node.type === 'text' && typeof node.text === 'string') {
      chunks.push(node.text);
    }

    if (node.content && Array.isArray(node.content)) {
      for (const child of node.content) {
        traverse(child);
      }
      // Add newline after block nodes
      if (
        node.type === 'paragraph' ||
        node.type === 'heading' ||
        node.type === 'taskItem' ||
        node.type === 'listItem' ||
        node.type === 'blockquote' ||
        node.type === 'codeBlock'
      ) {
        chunks.push('\n');
      }
    }
  }

  traverse(content);
  return chunks.join('').trim();
}

/**
 * Derives a display title for a note if its title is empty.
 * Uses the first non-empty line of the body text.
 */
export function deriveDisplayTitle(title: string, plainText: string): string {
  const trimmed = title.trim();
  if (trimmed.length > 0) {
    return trimmed;
  }
  const firstLine = plainText
    .split('\n')
    .map((l) => l.trim())
    .find((l) => l.length > 0);

  return firstLine || 'New Note';
}

/**
 * Calculates word and character statistics.
 */
export function calculateDocumentStats(plainText: string): { words: number; characters: number } {
  const characters = plainText.length;
  const trimmed = plainText.trim();
  const words = trimmed ? trimmed.split(/\s+/).filter(Boolean).length : 0;
  return { words, characters };
}

/**
 * Validates external link URLs against allowed schemes.
 * Blocks unsafe schemes like javascript:, file:, data:, etc.
 */
export function isValidExternalUrl(url: string): boolean {
  if (!url || typeof url !== 'string') return false;
  const trimmed = url.trim();

  // Allowed schemes: http, https, mailto
  try {
    const parsed = new URL(trimmed);
    const protocol = parsed.protocol.toLowerCase();
    return protocol === 'https:' || protocol === 'http:' || protocol === 'mailto:';
  } catch {
    // Relative or invalid URL
    return false;
  }
}
