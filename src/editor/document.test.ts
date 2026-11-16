import { describe, it, expect } from 'vitest';
import {
  createEmptyDocument,
  extractPlainText,
  deriveDisplayTitle,
  calculateDocumentStats,
  isValidExternalUrl,
  CURRENT_DOCUMENT_VERSION,
} from './document';

describe('document utilities', () => {
  it('creates empty document with version 1 schema', () => {
    const doc = createEmptyDocument();
    expect(doc.type).toBe('doc');
    expect(doc.content).toHaveLength(1);
    expect(doc.content?.[0].type).toBe('paragraph');
    expect(CURRENT_DOCUMENT_VERSION).toBe(1);
  });

  it('extracts plain text across paragraphs and headings', () => {
    const sampleDoc = {
      type: 'doc',
      content: [
        {
          type: 'heading',
          attrs: { level: 1 },
          content: [{ type: 'text', text: 'My Meeting Notes' }],
        },
        {
          type: 'paragraph',
          content: [
            { type: 'text', text: 'First paragraph with ' },
            { type: 'text', marks: [{ type: 'bold' }], text: 'bold' },
            { type: 'text', text: ' text.' },
          ],
        },
        {
          type: 'paragraph',
          content: [{ type: 'text', text: 'Second paragraph.' }],
        },
      ],
    };

    const text = extractPlainText(sampleDoc);
    expect(text).toContain('My Meeting Notes');
    expect(text).toContain('First paragraph with bold text.');
    expect(text).toContain('Second paragraph.');
  });

  it('derives display title when title is empty', () => {
    expect(deriveDisplayTitle('', 'Meeting on Tuesday\nAction items below')).toBe('Meeting on Tuesday');
    expect(deriveDisplayTitle('   ', '\n\nFirst actual line\nSecond line')).toBe('First actual line');
    expect(deriveDisplayTitle('Explicit Title', 'Body text')).toBe('Explicit Title');
    expect(deriveDisplayTitle('', '')).toBe('New Note');
  });

  it('calculates word and character counts correctly', () => {
    const stats = calculateDocumentStats('Hello world from Lumen Notes!');
    expect(stats.words).toBe(5);
    expect(stats.characters).toBe(29);

    const emptyStats = calculateDocumentStats('');
    expect(emptyStats.words).toBe(0);
    expect(emptyStats.characters).toBe(0);
  });

  it('validates allowed URL schemes and rejects unsafe ones', () => {
    expect(isValidExternalUrl('https://example.com')).toBe(true);
    expect(isValidExternalUrl('http://localhost:3000')).toBe(true);
    expect(isValidExternalUrl('mailto:support@example.com')).toBe(true);

    expect(isValidExternalUrl('javascript:alert(1)')).toBe(false);
    expect(isValidExternalUrl('file:///etc/passwd')).toBe(false);
    expect(isValidExternalUrl('data:text/html,test')).toBe(false);
    expect(isValidExternalUrl('not-a-valid-url')).toBe(false);
  });
});
