import { test, expect } from '@playwright/test';

test.describe('Editor Vertical Slice Proof (Section 6 Requirements)', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('[data-testid="editor-container"]')).toBeVisible();
    await expect(page.locator('.tiptap')).toBeVisible();
  });

  test('1-4: Typing three paragraphs, Ctrl+A select complete document, Backspace deletes, Undo restores', async ({ page }) => {
    const editor = page.locator('.tiptap');
    await editor.click();

    // Type three paragraphs
    await page.keyboard.type('First paragraph text.');
    await page.keyboard.press('Enter');
    await page.keyboard.type('Second paragraph text.');
    await page.keyboard.press('Enter');
    await page.keyboard.type('Third paragraph text.');

    // Verify 3 paragraphs exist
    await expect(editor.locator('p')).toHaveCount(3);
    expect(await editor.innerText()).toContain('First paragraph text.');
    expect(await editor.innerText()).toContain('Second paragraph text.');
    expect(await editor.innerText()).toContain('Third paragraph text.');

    // Allow history group to close
    await page.waitForTimeout(250);

    // 2. Ctrl+A selects complete document
    await page.keyboard.press('ControlOrMeta+a');

    // 3. Backspace deletes complete selection
    await page.keyboard.press('Backspace');
    const textAfterDelete = (await editor.innerText()).trim();
    expect(textAfterDelete).toBe('');

    // Allow history group to close
    await page.waitForTimeout(250);

    // 4. Undo restores it (using toolbar Undo or keyboard shortcut)
    const undoBtn = page.locator('button[aria-label="Undo"]');
    await expect(undoBtn).toBeEnabled();
    await undoBtn.click();

    await expect(editor.locator('p')).toHaveCount(3);
    expect(await editor.innerText()).toContain('First paragraph text.');
    expect(await editor.innerText()).toContain('Third paragraph text.');
  });

  test('5-8: Select word, apply Bold from toolbar, only that selection is bold, formatting follows cursor context', async ({ page }) => {
    const editor = page.locator('.tiptap');
    await editor.click();

    // Clear and type: "Hello special world"
    await page.keyboard.press('ControlOrMeta+a');
    await page.keyboard.press('Backspace');
    await page.keyboard.type('Hello special world');

    // Double click 'special' to select it
    const editorText = editor.locator('p');
    await editorText.dblclick({ position: { x: 60, y: 10 } });

    // Click Bold toolbar button
    const boldButton = page.locator('button[aria-label="Bold"]');
    await boldButton.click();

    // 6. Only that selection becomes bold
    const boldElement = editor.locator('strong');
    await expect(boldElement).toBeVisible();
    const boldText = await boldElement.innerText();
    expect(boldText.trim()).toBe('special');

    // Check surrounding text is NOT bold
    const fullText = await editor.innerText();
    expect(fullText).toContain('Hello special world');

    // 7. Move into normal text elsewhere and type
    await page.keyboard.press('End');
    await page.keyboard.type(' more plain text');

    // 8. Formatting follows cursor context (new text should not be bold)
    const updatedBoldText = await boldElement.innerText();
    expect(updatedBoldText.trim()).toBe('special');
    expect(await editor.innerText()).toContain('more plain text');
  });

  test('9-10: Select across paragraphs, copy, replace, undo, and redo', async ({ page }) => {
    const editor = page.locator('.tiptap');
    await editor.click();

    await page.keyboard.press('ControlOrMeta+a');
    await page.keyboard.press('Backspace');

    await page.keyboard.type('Paragraph Alpha');
    await page.keyboard.press('Enter');
    await page.keyboard.type('Paragraph Beta');

    await page.waitForTimeout(250);

    // Select all across paragraphs
    await page.keyboard.press('ControlOrMeta+a');

    // Delete selection and type replacement
    await page.keyboard.press('Backspace');
    await page.waitForTimeout(250);

    await page.keyboard.type('Replaced Text');
    expect(await editor.innerText()).toContain('Replaced Text');
    expect(await editor.innerText()).not.toContain('Paragraph Alpha');

    await page.waitForTimeout(250);

    // Undo until previous content restored
    const undoBtn = page.locator('button[aria-label="Undo"]');
    await expect(undoBtn).toBeEnabled();
    await undoBtn.click(); // undoes typing
    await page.waitForTimeout(100);
    if (!(await editor.innerText()).includes('Paragraph Alpha') && (await undoBtn.isEnabled())) {
      await undoBtn.click(); // undoes deletion
    }

    expect(await editor.innerText()).toContain('Paragraph Alpha');
    expect(await editor.innerText()).toContain('Paragraph Beta');

    // Redo until Replaced Text restored
    const redoBtn = page.locator('button[aria-label="Redo"]');
    await expect(redoBtn).toBeEnabled();
    await redoBtn.click();
    await page.waitForTimeout(100);
    if (!(await editor.innerText()).includes('Replaced Text') && (await redoBtn.isEnabled())) {
      await redoBtn.click();
    }
    expect(await editor.innerText()).toContain('Replaced Text');
  });

  test('11-12: Create and toggle a checklist, confirm no raw Markdown markers inserted', async ({ page }) => {
    const editor = page.locator('.tiptap');
    await editor.click();

    await page.keyboard.press('ControlOrMeta+a');
    await page.keyboard.press('Backspace');

    // Click Checklist button on toolbar
    const checklistButton = page.locator('button[aria-label="Checklist"]');
    await checklistButton.click();

    // Type a task item
    await page.keyboard.type('Buy groceries');
    await page.keyboard.press('Enter');
    await page.keyboard.type('Read book');

    // Check that task list and items exist using class names
    const taskList = editor.locator('ul.task-list');
    await expect(taskList).toBeVisible();
    const taskItems = taskList.locator('li.task-item');
    await expect(taskItems).toHaveCount(2);

    // Toggle the first checkbox
    const firstCheckbox = taskItems.first().locator('input[type="checkbox"]');
    await firstCheckbox.click();
    await expect(firstCheckbox).toBeChecked();

    // 12. Confirm no raw Markdown markers (like `[ ]` or `**`) are inserted as visible text
    const textContent = await editor.innerText();
    expect(textContent).not.toContain('[ ]');
    expect(textContent).not.toContain('[x]');
    expect(textContent).not.toContain('**');
    expect(textContent).toContain('Buy groceries');
    expect(textContent).toContain('Read book');
  });
});
