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

  test('Persists 3 entries in localStorage', async ({ page, context }) => {
    // Add 3 entries
    const notes = ['First note', 'Second note', 'Third note'];
    for (const note of notes) {
      await page.fill('#noteInput', note);
      await page.keyboard.press('Enter');
      await expect(page.locator('.timeEntry')).toHaveCount(notes.indexOf(note) + 1);
    }

    // Verify entries are visible in the UI
    const entries = page.locator('.timeEntry');
    await expect(entries).toHaveCount(3);

    // Verify entries are persisted in localStorage
    const localStorage = await page.evaluate(() => {
      return JSON.parse(localStorage.getItem('timeLogs') || '[]');
    });

    // Check that localStorage has 3 entries
    expect(localStorage).toHaveLength(3);

    // Verify the content of each entry
    notes.forEach((note, index) => {
      expect(localStorage[index].note).toBe(note);
      expect(localStorage[index].date).toBeDefined();
      expect(localStorage[index].time).toBeDefined();
    });

    // Reload the page to ensure persistence
    await page.reload();

    // Verify entries are still there after reload
    await expect(page.locator('.timeEntry')).toHaveCount(3);

    // Verify localStorage still has 3 entries
    const reloadedStorage = await page.evaluate(() => {
      return JSON.parse(localStorage.getItem('timeLogs') || '[]');
    });
    expect(reloadedStorage).toHaveLength(3);

    // Verify the notes match
    reloadedStorage.forEach((entry, index) => {
      expect(entry.note).toBe(notes[index]);
    });
  });

  test('Persist four delete one', async ({ page, context }) => {
    const notes = ['First note', 'Second note', 'Third note', 'Fourth note'];
    for (const note of notes) {
      await page.fill('#noteInput', note);
      await page.keyboard.press('Enter');
      await expect(page.locator('.timeEntry')).toHaveCount(notes.indexOf(note) + 1);
    }

    // Verify entries are visible in the UI
    const entries = page.locator('.timeEntry');
    await expect(entries).toHaveCount(4);

    // Verify entries are persisted in localStorage
    const t0storage = await page.evaluate(() => {
      return JSON.parse(localStorage.getItem('timeLogs') || '[]');
    });

    expect(t0storage).toHaveLength(4);

    // Verify the content of each entry
    notes.forEach((note, index) => {
      expect(t0storage[index].note).toBe(note);
      expect(t0storage[index].date).toBeDefined();
      expect(t0storage[index].time).toBeDefined();
    });

    page.on('dialog', dialog => dialog.accept());
    await page.locator('.timeEntry input').nth(1).fill(deleteTrigger);
    await page.keyboard.press('Enter');

    await expect(page.locator('.timeEntry')).toHaveCount(3);
    const t1storage = await page.evaluate(() => {
      return JSON.parse(localStorage.getItem('timeLogs') || '[]');
    });
    await expect(t1storage).toHaveLength(3);

    notes.filter(((_, index) => index != 2)).forEach((note, index) => {
      expect(t1storage[index].note).toBe(note);
      expect(t1storage[index].date).toBeDefined();
      expect(t1storage[index].time).toBeDefined();
    });

    // Reload the page to ensure persistence
    await page.reload();

    // Verify entries are still there after reload
    await expect(page.locator('.timeEntry')).toHaveCount(3);

    const reloadedStorage = await page.evaluate(() => {
      return JSON.parse(localStorage.getItem('timeLogs') || '[]');
    });
    expect(reloadedStorage).toHaveLength(3);

    // Verify the notes match
    reloadedStorage.filter(((_, index) => index != 2)).forEach((entry, index) => {
      expect(entry.note).toBe(notes[index]);
    });
  });


  test('Shows "Send" key on mobile keyboard for noteInput', async ({ page }) => {
    // // Set the viewport to a mobile device size (e.g., iPhone 12)
    // await page.setViewportSize({ width: 375, height: 812 });

    // // Navigate to the app
    // await page.goto('http://localhost:3000/logbook.html');

    // Focus the note input field
    await page.focus('#noteInput');

    // Verify the input field has the correct enterkeyhint attribute
    const enterKeyHint = await page.getAttribute('#noteInput', 'enterkeyhint');
    expect(enterKeyHint).toBe('send');

    // Verify the input mode is set to text
    const inputMode = await page.getAttribute('#noteInput', 'inputmode');
    expect(inputMode).toBe('text');
  });

  test('Input field remains visible when focused (simulating virtual keyboard)', async ({ page }) => {
    await page.setViewportSize({ width: 400, height: 600 });

    for (let i = 0; i < 15; i++) {
      await page.fill('#noteInput', `Note ${i + 1}`);
      await page.keyboard.press('Enter');
    }

    await page.focus('#noteInput');

    // Verify the input field is scrolled into view
    await expect(page.locator('#noteInput')).toBeInViewport();

    // Verify the input field is not obscured by checking its position
    const inputBox = await page.locator('#noteInput').boundingBox();
    expect(inputBox.y).toBeGreaterThan(0); // Not hidden above the viewport
    expect(inputBox.y + inputBox.height).toBeLessThan(600); // Not hidden below the viewport

    // Verify the input field is still usable
    await page.fill('#noteInput', 'Test note with keyboard open');
    await expect(page.locator('#noteInput')).toHaveValue('Test note with keyboard open');
  });
});
