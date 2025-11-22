# Time Logger PWA – Requirements

---

## **Core Functionality**
- **Log timestamps** with date, time, and notes.
- **Persist data** in `localStorage` to retain entries between sessions.
- **Progressive Web App (PWA)** support:
  - Service Worker for offline functionality.
  - Web App Manifest for installability.
- **Responsive design** for mobile and desktop devices.

---

## **User Interface**
- **Input field** for notes, supporting the **Enter key** to add entries.
- **"Log Time" button** to manually add entries.
- **List of entries** in reverse chronological order (newest first).
- **Editable notes** for each entry.
- **Delete entries** by setting the note to `"xxx"` (case-sensitive).
  - **Confirmation dialog** showing the date and time of the entry to be deleted.
- **Tooltip** on note fields: *"Delete entry: Set note to 'xxx' and confirm"*.
- **"Clear All" button** to delete all entries, with a confirmation dialog.
- **"Export to CSV" button** with a meaningful filename (title + date + time).
- **Editable title** for the log page (saved in `localStorage`).

---

## **Behavioral Requirements**
- **No focus on the note input field** after clicking the "Log Time" button.
- **Focus on the note input field** after pressing the Enter key.
- **Sanitize filenames** during CSV export (remove invalid characters).
- **Keyboard-friendly**:
  - Enter key adds a new entry.
  - Mobile keyboards show a "Send" button (`enterkeyhint="send"`).
- **Scroll behavior**:
  - New entries are scrolled into view (`scrollIntoView`).
- **Prevent scrolling issues** on mobile devices when the keyboard is open.

---

## **Data Structure**
- **Entry object**:
  ```json
  {
    "id": "integer",
    "date": "YYYY-MM-DD",
    "time": "hh\:mm\:ss",
    "note": "string",
    "utcOffset": "±minutes"
  }
  ```
- Data storage in localStorage under the key "timeLogs".

---

## Technical Requirements
- Code maintainability:
  - Deduplicated logic (e.g., reusable functions for creating entries).
  - Modular structure (separate helper functions, core logic, and UI).
  - Constants for magic strings (e.g., "xxx" as the delete trigger).
  - Clear comments and structure for readability.
- Service Worker registration for offline support.
- Input validation for filenames and notes.
- Prevent default behavior on Enter key to avoid line breaks on mobile devices.
