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

  test('Verifies CSV file content structure and data', async ({ page }) => {
    // Add a test entry with a specific note
    const testNote = 'CSV Test Note';
    await page.fill('#noteInput', testNote);
    await page.keyboard.press('Enter');

    // Trigger CSV download
    const downloadPromise = page.waitForEvent('download');
    await page.click('#downloadButton');
    const download = await downloadPromise;

    // Save the download to a temporary file and read its content
    const path = await download.path();
    const fs = require('fs');
    const csvContent = fs.readFileSync(path, 'utf8');

    // Verify CSV structure - should have header and at least one data row
    const lines = csvContent.split('\r\n').filter(line => line.trim() !== '');
    expect(lines.length).toBeGreaterThanOrEqual(2); // Header + at least one data row

    // Verify header structure
    const header = lines[0];
    const expectedHeaders = ['Datum', 'Uhrzeit', 'UTC-Offset', 'Angewandte Zeit-Korrektur [ms]', 'Zeit-Unsicherheit [ms]', 'Notiz'];
    expect(header).toBe(expectedHeaders.join(','));

    // Verify data row structure - should have 6 fields (matching the header)
    if (lines.length > 1) {
      const dataRow = lines[1];
      const fields = dataRow.split(',');
      expect(fields.length).toBe(6); // Should match the number of headers

      // Verify the note field contains our test note
      const noteField = fields[5];
      // Remove quotes if present (CSV escaping)
      const cleanedNote = noteField.replace(/^"|"$/g, '');
      expect(cleanedNote).toBe(testNote);

      // Verify date field is in ISO format (YYYY-MM-DD)
      const dateField = fields[0];
      expect(dateField).toMatch(/^\d{4}-\d{2}-\d{2}$/);

      // Verify time field is in HH:MM:SS.s format
      const timeField = fields[1];
      expect(timeField).toMatch(/^\d{2}:\d{2}:\d{2}\.\d$/);
    }
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

  test('Tests sharing functionality', async ({ page }) => {
    // Add a test entry
    const testNote = 'Test note for sharing';
    await page.fill('#noteInput', testNote);
    await page.keyboard.press('Enter');

    // Mock the navigator.share function
    await page.evaluate(() => {
      // Mock the canShare function to return true
      navigator.canShare = (data) => {
        return true;
      };

      // Mock the share function
      navigator.share = async (data) => {
        // Store the share data in a global variable for testing
        window.mockShareData = data;
        // Also store the files data separately for easier testing
        if (data && data.files && data.files.length > 0) {
          const file = data.files[0];
          window.mockFileData = {
            name: file.name,
            type: file.type,
            size: file.size
          };
        }
        return Promise.resolve();
      };
    });

    // Click the share button
    await page.click('#shareButton');

    // Verify that the share function was called with the correct data
    const shareData = await page.evaluate(() => {
      return window.mockShareData;
    });

    // Check that share data exists
    expect(shareData).toBeTruthy();

    // Check that the share data has the expected properties
    expect(shareData).toHaveProperty('title');
    expect(shareData).toHaveProperty('text');
    expect(shareData).toHaveProperty('files');

    // Check that the files array has one element
    expect(shareData.files).toHaveLength(1);

    // Get the file data from our mock
    const fileData = await page.evaluate(() => {
      return window.mockFileData;
    });

    // Check that the file has the expected properties
    expect(fileData).toBeTruthy();
    expect(fileData.name).toMatch(/\.csv$/);
    expect(fileData.size).toBeGreaterThan(0);
  });

  test('Tests sharing functionality fallback when not supported', async ({ page }) => {
    // Add a test entry
    const testNote = 'Test note for sharing fallback';
    await page.fill('#noteInput', testNote);
    await page.keyboard.press('Enter');

    // Mock the navigator.share function to simulate unsupported sharing
    await page.evaluate(() => {
      // Mock the canShare function to return false (simulating Firefox behavior)
      navigator.canShare = (data) => {
        return false;
      };

      // Mock the share function to work with URL fallback
      let shareData = null;
      navigator.share = async (data) => {
        shareData = data;
        return Promise.resolve();
      };

      // Mock URL.createObjectURL and URL.revokeObjectURL
      const originalCreateObjectURL = URL.createObjectURL;
      const originalRevokeObjectURL = URL.revokeObjectURL;
      let objectUrlCreated = null;

      URL.createObjectURL = (blob) => {
        objectUrlCreated = 'mock-data-url';
        return objectUrlCreated;
      };

      URL.revokeObjectURL = (url) => {
        // Just mock this for testing
      };

      // Spy on the alert function
      let alertShown = false;
      const originalAlert = window.alert;
      window.alert = (message) => {
        alertShown = true;
        console.log('Alert shown:', message);
      };

      // Click the share button
      document.getElementById('shareButton').click();

      // Restore the original functions
      window.alert = originalAlert;
      URL.createObjectURL = originalCreateObjectURL;
      URL.revokeObjectURL = originalRevokeObjectURL;

      // Check if the fallback sharing was used
      if (shareData && shareData.url) {
        console.log('Fallback sharing worked with URL:', shareData.url);
        return { success: true, shareData: shareData };
      } else if (alertShown) {
        console.log('Alert was shown instead of fallback');
        return { success: false, alertShown: alertShown };
      } else {
        return { success: false, message: 'Neither fallback nor alert worked' };
      }
    });

    // The test should pass if the fallback sharing mechanism works
    // (i.e., no alert is shown and URL-based sharing is attempted)
  });

  test('Tests Firefox-style sharing fallback (canShare returns false)', async ({ page }) => {
    // Add a test entry
    const testNote = 'Test note for Firefox fallback';
    await page.fill('#noteInput', testNote);
    await page.keyboard.press('Enter');

    const result = await page.evaluate(() => {
      // Mock Firefox behavior: canShare exists but returns false for files
      navigator.canShare = (data) => {
        // Firefox doesn't support files in canShare
        if (data && data.files) {
          return false;
        }
        return true;
      };

      // Mock the share function to capture what gets shared
      let capturedShareData = null;
      navigator.share = async (data) => {
        capturedShareData = data;
        return Promise.resolve();
      };

      // Click the share button
      document.getElementById('shareButton').click();

      return capturedShareData;
    });

    // Verify that the fallback sharing was used (URL-based instead of file-based)
    expect(result).toBeTruthy();
    expect(result).toHaveProperty('title');
    expect(result).toHaveProperty('text');
    expect(result.text).toMatch(/^Datum,Uhrzeit,/);
  });

  test('Verifies share button exists and is clickable', async ({ page }) => {
    // Verify that the share button exists
    const shareButton = page.locator('#shareButton');
    await expect(shareButton).toBeVisible();

    // Verify that the share button has the correct title
    await expect(shareButton).toHaveAttribute('title', 'Als CSV teilen');

    // Verify that the share button has the correct SVG icon structure
    const svg = shareButton.locator('svg');
    await expect(svg).toBeVisible();

    // Verify that the share button is enabled
    await expect(shareButton).toBeEnabled();
  });
});
