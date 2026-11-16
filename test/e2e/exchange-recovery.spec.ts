import { test, expect } from '@playwright/test';

test.describe('Phase 5 & 6: Exchange, Attachments, and Recovery', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.waitForSelector('[data-testid="app-shell"]');
  });

  test('Attachments lifecycle: upload, view in drawer, and delete', async ({ page }) => {
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
    const chip = drawer.locator('.attachment-chip-name');
    await expect(chip).toHaveText('diagram.png');

    // Delete attachment
    page.on('dialog', (dialog) => dialog.accept());
    const deleteBtn = drawer.locator('.attachment-chip-btn').first();
    await deleteBtn.click();
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

    page.on('dialog', (dialog) => dialog.accept());
    const restoreBtn = modal.locator('button:has-text("Restore")').first();
    await restoreBtn.click();

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
});
