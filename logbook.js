// Constants
const DELETE_TRIGGER = 'xxx';
const STORAGE_KEY = 'timeLogs';
const TITLE_STORAGE_KEY = 'timeLoggerTitle';

// DOM Elements
const elements = {
    timeList: document.getElementById('timeList'),
    noteInput: document.getElementById('noteInput'),
    logTimeButton: document.getElementById('logTimeButton'),
    clearButton: document.getElementById('clearButton'),
    downloadButton: document.getElementById('downloadButton'),
    shareButton: document.getElementById('shareButton'),
    editableTitle: document.getElementById('editableTitle')
};

// --- Helper Functions ---
function sanitizeFilename(title) {
    return title.replace(/[\\/:*?"<>| (){}\[\]]\n\r/g, '_');
}

function getUtcOffset() {
    const offset = -new Date().getTimezoneOffset();
    const sign = offset >= 0 ? '+' : '-';
    return `${sign}${offset}m`;
}

function escapeCsvField(field) {
    if (field.includes('"') || field.includes(',') || field.includes('\n')) {
        return '"' + field.replace(/"/g, '""') + '"';
    }
    return field;
}

function getCurrentDateTime() {
    const now = new Date();
    // Get PTB correction values if available
    const delta = typeof window.ptbDelta !== 'undefined' ? window.ptbDelta : 0;
    const uncertainty = typeof window.ptbUncertainty !== 'undefined' ? window.ptbUncertainty : 0;

    // Apply PTB correction to the timestamp
    const correctedTime = new Date(now.getTime() - delta);

    return {
        date: correctedTime.toISOString().split('T')[0],
        time: correctedTime.toLocaleTimeString('en-US', {
            hour12: false,
            hour: "2-digit",
            minute: "2-digit",
            second: "2-digit",
            fractionalSecondDigits: 1
        }),
        utcOffset: getUtcOffset(),
        clockCorrection: `${delta}`,
        clockUncertainty: `${uncertainty}`
    };
}

// --- Core Functions ---
function createTimeEntryElement(log, tabindex) {
    const entry = document.createElement('div');
    entry.className = 'timeEntry';
    entry.dataset.id = log.id;

    const dateSpan = document.createElement('span');
    dateSpan.textContent = log.date;

    const timeSpan = document.createElement('span');
    timeSpan.textContent = log.time;

    const note = document.createElement('input');
    note.type = 'text';
    note.value = log.note;
    note.placeholder = 'Notiz bearbeiten...';
    note.tabIndex = tabindex + 2;
    note.title = "Eintrag löschen: Notiz auf 'xxx' setzen und bestätigen";

    note.addEventListener('change', () => handleNoteChange(note, log));

    entry.appendChild(dateSpan);
    entry.appendChild(timeSpan);
    entry.appendChild(note);

    return entry;
}

function handleNoteChange(input, log) {
    const logs = JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]');
    const index = logs.findIndex(x => x.id === log.id);

    if (input.value === DELETE_TRIGGER) {
        if (confirm(`Möchtest du den Eintrag ${index + 1} vom ${log.date} um ${log.time} wirklich löschen?`)) {
            logs.splice(index, 1);
            localStorage.setItem(STORAGE_KEY, JSON.stringify(logs));
            loadTimeLogs();
        } else {
            input.value = log.note;
        }
    } else {
        logs[index].note = input.value;
        localStorage.setItem(STORAGE_KEY, JSON.stringify(logs));
    }
}

function loadTimeLogs() {
    elements.timeList.innerHTML = '';
    const logs = JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]');

    logs.slice().forEach((log, i) => {
        const entry = createTimeEntryElement(log, i);
        elements.timeList.prepend(entry);
    });

    elements.timeList.scrollTop = 0;
}

function logTime(focusInput = false) {
    const { date, time, utcOffset, clockCorrection, clockUncertainty } = getCurrentDateTime();
    const note = elements.noteInput.value;

    const logs = JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]');
    const newLog = {
        id: Date.now(),
        date,
        time,
        utcOffset,
        clockCorrection,
        clockUncertainty,
        note,
    };

    logs.push(newLog);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(logs));

    const entry = createTimeEntryElement(newLog, logs.length);
    elements.timeList.prepend(entry);

    elements.noteInput.value = '';
    if (focusInput) {
        elements.noteInput.focus();
    } else {
        elements.noteInput.blur();
    }

    elements.timeList.scrollTop = 0;
    elements.noteInput.scrollIntoView({ behavior: 'smooth', block: 'end' });
}

function clearLogs() {
    if (confirm('Möchtest du wirklich alle Einträge löschen?')) {
        localStorage.removeItem(STORAGE_KEY);
        loadTimeLogs();
    }
}

function generateCSV() {
    const logs = JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]');
    let csvContent = "Datum,Uhrzeit,UTC-Offset,Angewandte Zeit-Korrektur [ms],Zeit-Unsicherheit [ms],Notiz\r\n";
    logs.forEach(log => {
        const row = [
            escapeCsvField(log.date),
            escapeCsvField(log.time),
            escapeCsvField(log.utcOffset),
            escapeCsvField(log.clockCorrection || ''),
            escapeCsvField(log.clockUncertainty || ''),
            escapeCsvField(log.note)
        ].join(',');
        csvContent += row + "\r\n";
    });

    const now = new Date();
    const datePart = now.toISOString().split('T')[0];
    const timePart = now.toTimeString().split(' ')[0].replace(/:/g, '');
    const title = elements.editableTitle.textContent.trim();
    const sanitizedTitle = sanitizeFilename(title);
    const filename = `${sanitizedTitle}_${datePart}_${timePart}.csv`;

    return {content: csvContent, name: filename, title: title};
}

function downloadCSV() {
    const csv = generateCSV();
    const encodedUri = encodeURI("data:text/csv;charset=utf-8," + csv.content);

    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", csv.name);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
}

function shareCSV() {
    const csv = generateCSV();
    const blob = new Blob([csv.content], { type: 'text/csv' });
    const file = new File([blob], csv.file, { type: 'text/csv' });

    if (navigator.canShare && navigator.canShare({ files: [file] })) {
        try {
            navigator.share({
                title: csv.title,
                text: 'Hier ist mein Protokoll als CSV-Datei:',
                files: [file],
            });
        } catch (error) {
            if (error.name !== 'AbortError') {
                console.error('Teilen fehlgeschlagen:', error);
                alert('Teilen fehlgeschlagen: ' + error);
            }
        }
    } else {
        alert('Fehler beim Teilen!  Versuchen sie es mit dem Download.');
    }
}

function saveTitle() {
    const title = elements.editableTitle.textContent.trim();
    localStorage.setItem(TITLE_STORAGE_KEY, title);
}

function loadTitle() {
    const savedTitle = localStorage.getItem(TITLE_STORAGE_KEY);
    if (savedTitle) {
        elements.editableTitle.textContent = savedTitle;
    }
}

// --- Event Listeners ---
function setupEventListeners() {
    elements.logTimeButton.addEventListener('click', () => logTime(false));
    elements.clearButton.addEventListener('click', clearLogs);
    elements.downloadButton.addEventListener('click', downloadCSV);
    elements.shareButton.addEventListener('click', shareCSV);

    elements.editableTitle.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
            e.preventDefault();
            elements.editableTitle.blur();
            saveTitle();
        }
    });

    elements.editableTitle.addEventListener('blur', saveTitle);

    elements.noteInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
            logTime(true);
        }
    });
    elements.noteInput.addEventListener('focus', () => {
        elements.noteInput.scrollIntoView({ behavior: 'smooth', block: 'end' });
    });
    window.visualViewport.addEventListener('resize', () => {
        if (elements.noteInput.matches(':focus')) {
            elements.noteInput.scrollIntoView({ behavior: 'smooth', block: 'end' });
        }
    });
}

// --- Service Worker ---
function registerServiceWorker() {
    if ('serviceWorker' in navigator) {
        window.addEventListener('load', () => {
            navigator.serviceWorker.register('/sw.js')
                .then(registration => console.log('ServiceWorker registration successful'))
                .catch(err => console.log('ServiceWorker registration failed: ', err));
        });
    }
}

// --- Initialization ---
function init() {
    registerServiceWorker();
    loadTitle();
    loadTimeLogs();
    setupEventListeners();
    elements.noteInput.focus();
}

// Start the app
init();
