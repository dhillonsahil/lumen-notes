import { describe, it, expect } from 'vitest';
import { Editor } from '@tiptap/core';
import StarterKit from '@tiptap/starter-kit';

describe('Tiptap Undo/Redo behavior', () => {
  it('undoes backspace deletion of three paragraphs', () => {
    const editor = new Editor({
      extensions: [StarterKit],
      content: '<p>First</p><p>Second</p><p>Third</p>',
    });

    expect(editor.getText()).toContain('First\n\nSecond\n\nThird');

    // Select all and delete
    editor.commands.selectAll();
    editor.commands.deleteSelection();
    expect(editor.getText().trim()).toBe('');

    expect(editor.can().undo()).toBe(true);
    editor.commands.undo();

    expect(editor.getText()).toContain('First');
    expect(editor.getText()).toContain('Second');
    expect(editor.getText()).toContain('Third');
  });
});
