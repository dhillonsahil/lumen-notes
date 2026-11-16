import { test, expect } from '@playwright/test';

test.describe('Phase 4: Polished UI and Accessibility', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.waitForSelector('[data-testid="app-shell"]');
  });

  test('Ctrl+F shortcut focuses the search input', async ({ page }) => {
    const searchInput = page.locator('[data-testid="notelist-search-input"]');
    await expect(searchInput).not.toBeFocused();

    // Focus on the notelist container
    await page.locator('[data-testid="notelist-pane"]').click();

    // Press Control+f
    await page.keyboard.press('Control+f');
    await expect(searchInput).toBeFocused();

    // Type query and press Escape to clear & blur
    await page.keyboard.type('Meeting');
    await expect(searchInput).toHaveValue('Meeting');
    await page.keyboard.press('Escape');
    await expect(searchInput).toHaveValue('');
  });

  test('Keyboard navigation across note list items with Arrow keys', async ({ page }) => {
    // Initial sample note exists
    const initialItems = page.locator('.notelist-item');
    const initialCount = await initialItems.count();

    // Create Note 1
    const newNoteBtn = page.locator('[data-testid="notelist-new-note-btn"]');
    await newNoteBtn.click();
    const title1 = page.locator('[data-testid="editor-title-input"]');
    await title1.fill('First Note');
    await page.locator('.ProseMirror').click();
    await page.keyboard.type('Content 1');
    await expect(page.locator('.status-badge')).toContainText('Saved');

    // Create Note 2
    await newNoteBtn.click();
    const title2 = page.locator('[data-testid="editor-title-input"]');
    await title2.fill('Second Note');
    await page.locator('.ProseMirror').click();
    await page.keyboard.type('Content 2');
    await expect(page.locator('.status-badge')).toContainText('Saved');

    const items = page.locator('.notelist-item');
    await expect(items).toHaveCount(initialCount + 2);

    // Focus the first item in the list (the newest note: Second Note)
    await items.first().focus();
    // Use ArrowDown to navigate to the second note (First Note)
    await page.keyboard.press('ArrowDown');
    await expect(page.locator('[data-testid="editor-title-input"]')).toHaveValue('First Note');

    // Use ArrowUp to navigate back
    await page.keyboard.press('ArrowUp');
    await expect(page.locator('[data-testid="editor-title-input"]')).toHaveValue('Second Note');
  });

  test('Theme switching updates data-theme attribute and persists in localStorage', async ({ page }) => {
    const settingsBtn = page.locator('[data-testid="sidebar-settings-btn"]');
    await settingsBtn.click();
    await expect(page.locator('[data-testid="settings-modal"]')).toBeVisible();

    // Select Dark theme
    const darkBtn = page.getByRole('button', { name: 'Dark' });
    await darkBtn.click();
    const rootTheme = await page.evaluate(() => document.documentElement.getAttribute('data-theme'));
    expect(rootTheme).toBe('dark');

    const savedTheme = await page.evaluate(() => localStorage.getItem('lumen_theme'));
    expect(savedTheme).toBe('dark');

    // Select Light theme
    const lightBtn = page.getByRole('button', { name: 'Light' });
    await lightBtn.click();
    const rootThemeLight = await page.evaluate(() => document.documentElement.getAttribute('data-theme'));
    expect(rootThemeLight).toBe('light');

    const savedThemeLight = await page.evaluate(() => localStorage.getItem('lumen_theme'));
    expect(savedThemeLight).toBe('light');

    // Close settings
    await page.getByRole('button', { name: 'Done' }).click();
    await expect(page.locator('[data-testid="settings-modal"]')).not.toBeVisible();
  });

  test('Folder items have title tooltips and keyboard accessibility', async ({ page }) => {
    const newFolderBtn = page.locator('[aria-label="New Folder"]');
    await newFolderBtn.click();
    const folderInput = page.locator('input[placeholder="Folder Name"]');
    await folderInput.fill('A Very Long Folder Name That Will Be Truncated With Ellipsis');
    await page.locator('button[type="submit"]:has-text("Create")').click();

    const folderItem = page.locator('.sidebar-item:has-text("A Very Long Folder Name")');
    await expect(folderItem).toBeVisible();
    await expect(folderItem).toHaveAttribute('title', 'A Very Long Folder Name That Will Be Truncated With Ellipsis');

    // Navigate to folder via keyboard
    await folderItem.focus();
    await page.keyboard.press('Enter');
    await expect(folderItem).toHaveClass(/is-active/);
  });
});
