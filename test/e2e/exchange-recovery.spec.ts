import { test, expect } from '@playwright/test';

test.describe('Phase 5 & 6: Exchange, Attachments, and Recovery', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.waitForSelector('[data-testid="app-shell"]');
  });

  test('Attachments lifecycle: upload, view in drawer, click to open in lightbox, and delete', async ({ page }) => {
    // Select default note
    const firstItem = page.locator('.notelist-item').first();
    await firstItem.click();

    // Attach a file via hidden file input
    const fileInput = page.locator('[data-testid="attachment-file-input"]');
    await fileInput.setInputFiles({
      name: 'diagram.png',
      mimeType: 'image/png',
      buffer: Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==', 'base64'),
    });

    // Check that attachments drawer appears with the chip
    const drawer = page.locator('[data-testid="attachments-drawer"]');
    await expect(drawer).toBeVisible();
    const chip = drawer.locator('.attachment-chip').first();
    await expect(chip).toBeVisible();
    await expect(drawer.locator('.attachment-chip-name')).toHaveText('diagram.png');

    // Clicking the attachment chip opens the Lightbox Viewer
    await chip.click();
    const lightbox = page.locator('[data-testid="attachment-lightbox"]');
    await expect(lightbox).toBeVisible();
    await expect(lightbox.locator('.editor-lightbox-title')).toContainText('diagram.png');

    // Close the lightbox via close button
    const closeBtn = lightbox.locator('.editor-lightbox-btn.close');
    await closeBtn.click();
    await expect(lightbox).not.toBeVisible();

    // Delete attachment via stylish ConfirmModal
    const deleteBtn = drawer.locator('.attachment-chip-btn').first();
    await deleteBtn.click();
    const confirmModal = page.locator('[data-testid="confirm-modal"]');
    await expect(confirmModal).toBeVisible();
    await page.locator('[data-testid="confirm-modal-confirm"]').click();
    await expect(drawer).not.toBeVisible();
  });

  test('Version Snapshots: create snapshot, edit note, and rollback', async ({ page }) => {
    // Ensure active note
    const firstItem = page.locator('.notelist-item').first();
    await firstItem.click();

    const titleInput = page.locator('[data-testid="editor-title-input"]');
    await titleInput.fill('Snapshot Baseline Title');
    await page.locator('.ProseMirror').click();
    await page.keyboard.type('Baseline content.');
    await expect(page.locator('.status-badge')).toContainText('Saved');

    // Open snapshot history modal
    const historyBtn = page.locator('[data-testid="toolbar-history-btn"]');
    await historyBtn.click();
    const modal = page.locator('[data-testid="snapshot-modal"]');
    await expect(modal).toBeVisible();

    // Create a snapshot
    const createBtn = page.locator('[data-testid="create-snapshot-btn"]');
    await createBtn.click();
    await expect(modal.locator('text=Snapshot Baseline Title')).toBeVisible();

    // Close modal
    await modal.getByRole('button', { name: 'Done' }).click();
    await expect(modal).not.toBeVisible();

    // Change title and content
    await titleInput.fill('Modified After Snapshot');
    await page.locator('.ProseMirror').click();
    await page.keyboard.type(' Extra modified text.');
    await expect(page.locator('.status-badge')).toContainText('Saved');

    // Reopen snapshots modal and restore
    await historyBtn.click();
    await expect(modal).toBeVisible();

    const restoreBtn = modal.locator('button:has-text("Restore")').first();
    await restoreBtn.click();

    // Confirm restore via custom modal
    const confirmRestoreModal = page.locator('[data-testid="confirm-modal"]');
    await expect(confirmRestoreModal).toBeVisible();
    await page.locator('[data-testid="confirm-modal-confirm"]').click();

    // Title should be restored to baseline
    await expect(titleInput).toHaveValue('Snapshot Baseline Title');
  });

  test('Emergency Crash Recovery draft restoration', async ({ page }) => {
    // Set an emergency draft in localStorage for demo-note-1
    await page.evaluate(() => {
      localStorage.setItem(
        'lumen_draft_demo-note-1',
        JSON.stringify({
          title: 'Emergency Recovered Title',
          document_json: JSON.stringify({
            type: 'doc',
            content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Recovered body' }] }],
          }),
          time: Date.now(),
        })
      );
    });

    // Reload page
    await page.reload();
    await page.waitForSelector('[data-testid="app-shell"]');

    // Select the note
    await page.locator('.notelist-item').first().click();

    // Emergency draft banner should be visible
    const banner = page.locator('[data-testid="emergency-draft-banner"]');
    await expect(banner).toBeVisible();

    // Click Restore Draft
    const restoreDraftBtn = page.locator('[data-testid="restore-draft-btn"]');
    await restoreDraftBtn.click();

    // Active title and content should be restored
    await expect(page.locator('[data-testid="editor-title-input"]')).toHaveValue('Emergency Recovered Title');
    await expect(page.locator('.ProseMirror')).toContainText('Recovered body');
    await expect(banner).not.toBeVisible();
  });

  test('Archive Import Preview and execution with collision choices', async ({ page }) => {
    // Open settings
    const settingsBtn = page.locator('[data-testid="sidebar-settings-btn"]');
    await settingsBtn.click();
    await expect(page.locator('[data-testid="settings-modal"]')).toBeVisible();

    // Prepare archive JSON with an existing note title and a new note
    const archiveData = {
      format: 'lumen-notes-archive',
      version: 1,
      exported_at: new Date().toISOString(),
      notes: [
        {
          id: 'imported-note-1',
          title: 'Welcome to Lumen Notes', // duplicate title collision!
          document_json: JSON.stringify({ type: 'doc', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Colliding note' }] }] }),
          document_version: 1,
          plain_text: 'Colliding note',
          pinned: false,
          favorite: false,
          archived: false,
          created_at: new Date().toISOString(),
          modified_at: new Date().toISOString(),
          tags: [],
          attachments: [],
        },
        {
          id: 'imported-note-2',
          title: 'Brand New Imported Note',
          document_json: JSON.stringify({ type: 'doc', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Brand new note' }] }] }),
          document_version: 1,
          plain_text: 'Brand new note',
          pinned: true,
          favorite: true,
          archived: false,
          created_at: new Date().toISOString(),
          modified_at: new Date().toISOString(),
          tags: [],
          attachments: [],
        },
      ],
    };

    // Trigger file import
    const importInput = page.locator('[data-testid="import-file-input"]');
    await importInput.setInputFiles({
      name: 'lumen-archive.json',
      mimeType: 'application/json',
      buffer: Buffer.from(JSON.stringify(archiveData), 'utf-8'),
    });

    // Import Preview Modal should open
    const previewModal = page.locator('[data-testid="import-preview-modal"]');
    await expect(previewModal).toBeVisible();
    await expect(previewModal).toContainText('Archive contains 2 notes');
    await expect(previewModal).toContainText('share matching IDs or titles');

    // Confirm import with Keep Both
    const confirmBtn = page.locator('[data-testid="confirm-import-btn"]');
    await confirmBtn.click();
    await expect(previewModal).not.toBeVisible();

    // Close Settings
    await page.getByRole('button', { name: 'Done' }).click();

    // Both new notes should appear in the note list
    await expect(page.locator('.notelist-item:has-text("Brand New Imported Note")')).toBeVisible();
  });

  test('Inline image insertion and canvas click-to-focus', async ({ page }) => {
    const firstItem = page.locator('.notelist-item').first();
    await firstItem.click();

    // Verify insert image toolbar button exists
    const insertImageBtn = page.locator('[data-testid="toolbar-insert-image-btn"]');
    await expect(insertImageBtn).toBeVisible();

    // Insert inline image via hidden input
    const inlineInput = page.locator('[data-testid="inline-image-file-input"]');
    await inlineInput.setInputFiles({
      name: 'screenshot.png',
      mimeType: 'image/png',
      buffer: Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==', 'base64'),
    });

    // Verify inline image element is placed inside the Tiptap ProseMirror document
    const inlineImg = page.locator('.tiptap img.editor-inline-image');
    await expect(inlineImg).toBeVisible();

    // Clicking the inline image opens the Lightbox Viewer
    await inlineImg.click();
    const lightbox = page.locator('[data-testid="attachment-lightbox"]');
    await expect(lightbox).toBeVisible();
    await expect(lightbox.locator('.editor-lightbox-title')).toContainText('screenshot.png');

    // Press Escape to dismiss lightbox
    await page.keyboard.press('Escape');
    await expect(lightbox).not.toBeVisible();

    // Click canvas below text to verify click-to-focus
    const scrollArea = page.locator('.editor-scroll-area');
    await scrollArea.click({ position: { x: 100, y: 400 } });
    await expect(page.locator('.ProseMirror-focused')).toBeVisible();
  });

  test('Ctrl+S manual save triggers snapshot creation and deduplicates identical saves or trailing spaces', async ({ page }) => {
    // Select default note
    const firstItem = page.locator('.notelist-item').first();
    await firstItem.click();

    // Type content
    await page.locator('.ProseMirror').click();
    await page.keyboard.type(' Important milestone update.');

    // 1. First Ctrl+S creates a snapshot
    await page.keyboard.press('Control+s');
    const toast = page.locator('[data-testid="snapshot-toast"]');
    await expect(toast).toBeVisible();
    await expect(toast).toContainText('Snapshot saved');

    // 2. Second Ctrl+S with no changes must notify that snapshot is already up to date
    await page.keyboard.press('Control+s');
    await expect(toast).toBeVisible();
    await expect(toast).toContainText('already up to date');

    // 3. Adding trailing spaces and saving must also deduplicate without creating a redundant snapshot
    await page.keyboard.type('     ');
    await page.keyboard.press('Control+s');
    await expect(toast).toBeVisible();
    await expect(toast).toContainText('already up to date');

    // 4. Typing a real character must create a new snapshot
    await page.keyboard.type('New character added');
    await page.keyboard.press('Control+s');
    await expect(toast).toBeVisible();
    await expect(toast).toContainText('Snapshot saved');
  });

  test('Toolbar 3-dot overflow menu, sidebar toggle, and sort order controls', async ({ page }) => {
    // Select default note
    const firstItem = page.locator('.notelist-item').first();
    await firstItem.click();

    // 1. Sidebar toggle button
    const sidebarToggleBtn = page.locator('[data-testid="notelist-sidebar-toggle-btn"]');
    await expect(sidebarToggleBtn).toBeVisible();
    await sidebarToggleBtn.click();
    // Sidebar should be collapsed
    await expect(page.locator('[data-testid="sidebar-pane"]')).not.toBeVisible();
    // Re-open sidebar
    await sidebarToggleBtn.click();
    await expect(page.locator('[data-testid="sidebar-pane"]')).toBeVisible();

    // 2. Sort order toggle button
    const sortOrderBtn = page.locator('[data-testid="notelist-sort-order-btn"]');
    await expect(sortOrderBtn).toBeVisible();
    await sortOrderBtn.click();

    // 3. Toolbar 3-dot overflow menu
    const moreBtn = page.locator('[data-testid="toolbar-more-btn"]');
    await expect(moreBtn).toBeVisible();
    await moreBtn.click();
    const moreMenu = page.locator('[data-testid="toolbar-more-menu"]');
    await expect(moreMenu).toBeVisible();

    // Click Version History from 3-dot menu
    await moreMenu.locator('[data-testid="more-menu-history-btn"]').click();
    const modal = page.locator('[data-testid="snapshot-modal"]');
    await expect(modal).toBeVisible();
    await modal.getByRole('button', { name: 'Done' }).click();
    await expect(modal).not.toBeVisible();
  });
});
