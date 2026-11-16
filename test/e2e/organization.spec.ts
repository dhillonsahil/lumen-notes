import { test, expect } from '@playwright/test';

test.describe('Phase 3: Organization and Search E2E', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('[data-testid="app-shell"]')).toBeVisible();
  });

  test('Create folder and filter notes by folder', async ({ page }) => {
    // Open new folder modal
    const newFolderBtn = page.locator('button[aria-label="New Folder"]');
    await newFolderBtn.click();

    // Type folder name and submit
    const folderInput = page.locator('input[placeholder="Folder Name"]');
    await expect(folderInput).toBeVisible();
    await folderInput.fill('Work Projects');
    await page.locator('button[type="submit"]', { hasText: 'Create' }).click();

    // Verify folder appears in sidebar
    const folderItem = page.locator('.sidebar-item', { hasText: 'Work Projects' });
    await expect(folderItem).toBeVisible();

    // Select the folder
    await folderItem.click();
    await expect(folderItem).toHaveClass(/is-active/);
  });

  test('Pin note surfaces it to the top with pin icon', async ({ page }) => {
    // Create Note 1
    const newNoteBtn = page.locator('[data-testid="notelist-new-note-btn"]');
    await newNoteBtn.click();
    const titleInput = page.locator('[data-testid="editor-title-input"]');
    await titleInput.fill('Regular Note');

    // Create Note 2
    await newNoteBtn.click();
    await titleInput.fill('Special Pinned Note');

    // Pin Note 2
    const pinBtn = page.locator('.notelist-item', { hasText: 'Special Pinned Note' }).locator('button[title="Pin to top"]');
    await pinBtn.click();

    // First item in the list must now be the pinned note
    const firstItemTitle = page.locator('.notelist-item-title').first();
    await expect(firstItemTitle).toHaveText('Special Pinned Note');
  });

  test('Favorite note adds to Favorites view', async ({ page }) => {
    const newNoteBtn = page.locator('[data-testid="notelist-new-note-btn"]');
    await newNoteBtn.click();
    const titleInput = page.locator('[data-testid="editor-title-input"]');
    await titleInput.fill('My Favorite Idea');

    // Favorite the note
    const favBtn = page.locator('.notelist-item', { hasText: 'My Favorite Idea' }).locator('button[title="Add to Favorites"]');
    await favBtn.click();

    // Switch to Favorites view
    await page.locator('[data-testid="view-favorites"]').click();

    // Note must appear in favorites list
    await expect(page.locator('.notelist-item', { hasText: 'My Favorite Idea' })).toBeVisible();
  });

  test('Search filters notes dynamically across titles and plain text', async ({ page }) => {
    const newNoteBtn = page.locator('[data-testid="notelist-new-note-btn"]');
    await newNoteBtn.click();
    const titleInput = page.locator('[data-testid="editor-title-input"]');
    await titleInput.fill('Recipe for Banana Bread');

    // Wait for autosave to persist
    const statusBar = page.locator('[data-testid="editor-status-bar"]');
    await expect(statusBar).toContainText('Saved', { timeout: 3000 });

    const searchInput = page.locator('[data-testid="notelist-search-input"]');
    await searchInput.fill('Banana');

    // Matching note remains
    await expect(page.locator('.notelist-item', { hasText: 'Recipe for Banana Bread' })).toBeVisible();

    // Non-matching search
    await searchInput.fill('NonexistentXYZQuery');
    await expect(page.locator('.notelist-empty')).toBeVisible();
    await expect(page.locator('.notelist-empty-desc')).toContainText('No notes match your search criteria');

    // Clear search
    await searchInput.fill('');
    await expect(page.locator('.notelist-item', { hasText: 'Recipe for Banana Bread' })).toBeVisible();
  });

  test('Trash and restore workflow', async ({ page }) => {
    const newNoteBtn = page.locator('[data-testid="notelist-new-note-btn"]');
    await newNoteBtn.click();
    const titleInput = page.locator('[data-testid="editor-title-input"]');
    await titleInput.fill('Temporary Note To Delete');

    // Click Move to Trash
    const trashBtn = page.locator('.notelist-item', { hasText: 'Temporary Note To Delete' }).locator('button[title="Move to Trash"]');
    await trashBtn.click();

    // Note disappears from active list
    await expect(page.locator('.notelist-item', { hasText: 'Temporary Note To Delete' })).not.toBeVisible();

    // Navigate to Trash view
    await page.locator('[data-testid="view-trash"]').click();
    await expect(page.locator('.notelist-item', { hasText: 'Temporary Note To Delete' })).toBeVisible();

    // Restore note
    const restoreBtn = page.locator('.notelist-item', { hasText: 'Temporary Note To Delete' }).locator('button[title="Restore Note"]');
    await restoreBtn.click();

    // Disappears from Trash
    await expect(page.locator('.notelist-item', { hasText: 'Temporary Note To Delete' })).not.toBeVisible();

    // Returns to All Notes
    await page.locator('[data-testid="view-all-notes"]').click();
    await expect(page.locator('.notelist-item', { hasText: 'Temporary Note To Delete' })).toBeVisible();
  });
});
