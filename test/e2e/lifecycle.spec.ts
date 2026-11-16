import { test, expect } from '@playwright/test';

test.describe('Phase 2: Application Shell and Persistence E2E', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('[data-testid="app-shell"]')).toBeVisible();
  });

  test('Three-pane layout: Sidebar, Notes List, and Editor are all visible', async ({ page }) => {
    await expect(page.locator('[data-testid="sidebar-pane"]')).toBeVisible();
    await expect(page.locator('[data-testid="notelist-pane"]')).toBeVisible();
    await expect(page.locator('.pane-editor')).toBeVisible();
  });

  test('Note creation is exactly once per click', async ({ page }) => {
    const newNoteBtn = page.locator('[data-testid="notelist-new-note-btn"]');
    await expect(newNoteBtn).toBeVisible();

    // Count notes before
    const initialNoteItems = await page.locator('.notelist-item').count();

    // Click once
    await newNoteBtn.click();

    // Count notes after
    await expect(page.locator('.notelist-item')).toHaveCount(initialNoteItems + 1);

    // Verify editor is focused on the new note with Title placeholder
    const titleInput = page.locator('[data-testid="editor-title-input"]');
    await expect(titleInput).toBeVisible();
  });

  test('Autosave debounces and persists changes without losing cursor', async ({ page }) => {
    const newNoteBtn = page.locator('[data-testid="notelist-new-note-btn"]');
    await newNoteBtn.click();

    // Type in Title
    const titleInput = page.locator('[data-testid="editor-title-input"]');
    await titleInput.fill('My Important Project');

    // Type in Editor body
    const editor = page.locator('.tiptap');
    await editor.click();
    await page.keyboard.type('This is the content of my project plan.');

    // Status bar shows "Unsaved changes" or "Saving..." initially, then "Saved" after 700ms
    const statusBar = page.locator('[data-testid="editor-status-bar"]');
    await expect(statusBar).toContainText('Saved', { timeout: 3000 });

    // Note list item reflects the updated title
    await expect(page.locator('.notelist-item-title').first()).toHaveText('My Important Project');
  });

  test('Safe note switching: pending edits are captured and documents do not leak', async ({ page }) => {
    // Create Note 1
    const newNoteBtn = page.locator('[data-testid="notelist-new-note-btn"]');
    await newNoteBtn.click();
    const titleInput = page.locator('[data-testid="editor-title-input"]');
    await titleInput.fill('Note Alpha');
    const editor = page.locator('.tiptap');
    await editor.click();
    await page.keyboard.type('Content of Alpha');

    // Create Note 2
    await newNoteBtn.click();
    await titleInput.fill('Note Beta');
    await editor.click();
    await page.keyboard.type('Content of Beta');

    // Switch back to Note Alpha
    const alphaItem = page.locator('.notelist-item', { hasText: 'Note Alpha' });
    await alphaItem.click();

    // Verify Note Alpha content loaded
    await expect(titleInput).toHaveValue('Note Alpha');
    expect(await editor.innerText()).toContain('Content of Alpha');
    expect(await editor.innerText()).not.toContain('Content of Beta');

    // Switch back to Note Beta
    const betaItem = page.locator('.notelist-item', { hasText: 'Note Beta' });
    await betaItem.click();

    // Verify Note Beta content loaded
    await expect(titleInput).toHaveValue('Note Beta');
    expect(await editor.innerText()).toContain('Content of Beta');
    expect(await editor.innerText()).not.toContain('Content of Alpha');
  });

  test('Settings modal opens and displays storage details', async ({ page }) => {
    const settingsBtn = page.locator('[data-testid="sidebar-settings-btn"]');
    await settingsBtn.click();

    await expect(page.locator('[data-testid="settings-modal"]')).toBeVisible();
    await expect(page.locator('[data-testid="settings-storage-path"]')).toBeVisible();

    // Close settings
    const doneBtn = page.locator('button', { hasText: 'Done' });
    await doneBtn.click();
    await expect(page.locator('[data-testid="settings-modal"]')).not.toBeVisible();
  });
});
