const { test, expect } = require('@playwright/test');

const testNote = 'Test note for Playwright';
const deleteTrigger = 'xxx';
const editedNote = 'Edited note';

test.describe('Time Logger PWA', () => {
  // Vor jedem Test: App öffnen
  test.beforeEach(async ({ page }) => {
    await page.goto('http://localhost:3000/logbook.html');
  });

  test('Adds a new entry with Enter key', async ({ page }) => {
    await page.fill('#noteInput', testNote);
    await page.keyboard.press('Enter');
    await expect(page.locator('.timeEntry')).toHaveCount(1);
    await expect(page.locator('.timeEntry span').first()).toContainText(new Date().toISOString().split('T')[0]);
    await expect(page.locator('.timeEntry input').first()).toHaveValue(testNote);
  });

  test('Adds a new entry with "Log Time" button', async ({ page }) => {
    await page.fill('#noteInput', testNote);
    await page.click('#logTimeButton');
    await expect(page.locator('.timeEntry')).toHaveCount(1);
    await expect(page.locator('.timeEntry input').first()).toHaveValue(testNote);
  });

  test('Edits an existing note', async ({ page }) => {
    await page.fill('#noteInput', testNote);
    await page.keyboard.press('Enter');
    await page.locator('.timeEntry input').first().fill(editedNote);
    await page.keyboard.press('Enter');
    await expect(page.locator('.timeEntry input').first()).toHaveValue(editedNote);
  });

  test('Deletes an entry with confirmation', async ({ page }) => {
    await page.fill('#noteInput', testNote);
    await page.keyboard.press('Enter');
    await expect(page.locator('.timeEntry')).toHaveCount(1);

    page.on('dialog', dialog => dialog.accept());
    await page.locator('.timeEntry input').first().fill(deleteTrigger);
    await page.keyboard.press('Enter');
    await expect(page.locator('.timeEntry')).toHaveCount(0);
  });

  test('Cancels deletion of an entry', async ({ page }) => {
    await page.fill('#noteInput', testNote);
    await page.keyboard.press('Enter');
    await expect(page.locator('.timeEntry')).toHaveCount(1);

    page.on('dialog', dialog => dialog.dismiss());
    await page.locator('.timeEntry input').first().fill(deleteTrigger);
    await page.keyboard.press('Enter');
    await expect(page.locator('.timeEntry input').first()).toHaveValue(testNote); // Wert bleibt erhalten
  });

  test('Clears all entries', async ({ page }) => {
    await page.fill('#noteInput', testNote);
    await page.keyboard.press('Enter');
    await page.fill('#noteInput', 'Second note');
    await page.keyboard.press('Enter');
    await expect(page.locator('.timeEntry')).toHaveCount(2);

    page.on('dialog', dialog => dialog.accept());
    await page.click('#clearButton');
    await expect(page.locator('.timeEntry')).toHaveCount(0);
  });

  test('Edits the log title', async ({ page }) => {
    const newTitle = 'My Custom Logbook';
    await page.locator('#editableTitle').click();
    await page.locator('#editableTitle').fill(newTitle);
    await page.keyboard.press('Enter');
    await expect(page.locator('#editableTitle')).toHaveText(newTitle);
  });

  test('Removes focus from input after button click', async ({ page }) => {
    await page.fill('#noteInput', testNote);
    await page.click('#logTimeButton');
    await expect(page.locator('#noteInput')).not.toBeFocused();
  });

  test('Keeps focus on input after Enter key', async ({ page }) => {
    await page.fill('#noteInput', testNote);
    await page.keyboard.press('Enter');
    await expect(page.locator('#noteInput')).toBeFocused();
  });

  test('Shows download dialog on CSV export', async ({ page }) => {
    await page.fill('#noteInput', testNote);
    await page.keyboard.press('Enter');

    const downloadPromise = page.waitForEvent('download');
    await page.click('#downloadButton');
    const download = await downloadPromise;
    expect(download.suggestedFilename()).toMatch(/\.csv$/);
  });
});
