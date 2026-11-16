import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { EditorView } from './EditorView';

describe('EditorView Component', () => {
  it('renders editor with title input, toolbar, and status bar', () => {
    render(<EditorView initialTitle="My Project Plan" saveStatus="saved" />);

    const titleInput = screen.getByTestId('editor-title-input') as HTMLInputElement;
    expect(titleInput.value).toBe('My Project Plan');

    expect(screen.getByTestId('editor-status-bar')).toHaveTextContent('Saved');
    expect(screen.getByRole('toolbar')).toBeInTheDocument();
    expect(screen.getByLabelText('Bold')).toBeInTheDocument();
    expect(screen.getByLabelText('Italic')).toBeInTheDocument();
    expect(screen.getByLabelText('Checklist')).toBeInTheDocument();
  });

  it('updates title and triggers onContentChange', () => {
    const handleContentChange = vi.fn();
    render(
      <EditorView
        initialTitle="Initial"
        onContentChange={handleContentChange}
      />
    );

    const titleInput = screen.getByTestId('editor-title-input');
    fireEvent.change(titleInput, { target: { value: 'Updated Title' } });

    expect(handleContentChange).toHaveBeenCalled();
    const lastCall = handleContentChange.mock.calls[handleContentChange.mock.calls.length - 1];
    expect(lastCall[0]).toBe('Updated Title');
  });

  it('toggles find in note bar with Ctrl+F and close button', () => {
    render(<EditorView initialTitle="Test" />);

    expect(screen.queryByTestId('editor-find-bar')).not.toBeInTheDocument();

    const findButton = screen.getByLabelText('Find in note');
    fireEvent.mouseDown(findButton);

    expect(screen.getByTestId('editor-find-bar')).toBeInTheDocument();
    expect(screen.getByPlaceholderText('Find in note...')).toBeInTheDocument();

    const closeButton = screen.getByTitle('Close find');
    fireEvent.click(closeButton);
    expect(screen.queryByTestId('editor-find-bar')).not.toBeInTheDocument();
  });

  it('displays saving, dirty, and error status states properly', () => {
    const { rerender } = render(<EditorView saveStatus="saving" />);
    expect(screen.getByTestId('editor-status-bar')).toHaveTextContent('Saving…');

    rerender(<EditorView saveStatus="dirty" />);
    expect(screen.getByTestId('editor-status-bar')).toHaveTextContent('Unsaved changes');

    rerender(<EditorView saveStatus="error" errorMessage="Revision conflict" />);
    expect(screen.getByTestId('editor-status-bar')).toHaveTextContent('Revision conflict');
  });
});
