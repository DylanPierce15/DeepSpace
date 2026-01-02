# Editing Widget Files (useFiles)

## Overview

Some widgets use file-based storage via the `useFiles` hook. These files are stored in a `files/` directory at the room level (not inside widget directories).

## File Location

Files are stored at the room level:
```
room-xxx/
├── files/           ← Correct location
│   ├── notes/
│   ├── slides/
│   ├── sheets/
│   └── documents/
├── widget-notepad-xxx/
└── canvas-state.json
```

## File Namespaces by Widget Type

| Widget Type | Namespace | Example Path |
|-------------|-----------|--------------|
| Notepad Pro | `notes/` | `files/notes/welcome.md` |
| Slide Deck | `slides/` | `files/slides/my-deck/slide-1.html` |
| PDF Generator | `documents/` | `files/documents/report/page-1.html` |
| Spreadsheet | `sheets/` | `files/sheets/data.csv` |

## How to Edit Files

### 1. Find the Current Room
The current room is in `/app/container_vars.json` under `currentRoom`.

### 2. Locate the Files Directory
```
/app/workspace/repo/<currentRoom>/files/
```

### 3. Edit Files Using File Tools
Use `read_file` and `write` tools to modify files. Do not use shell commands.

**Note** (`files/notes/new-note.md`):
```html
<h1>My New Note</h1>
<p>Content here...</p>
```

**Spreadsheet** (`files/sheets/data.csv`):
```csv
Name,Value,Category
Item A,100,Type1
```

**Slide** (`files/slides/my-deck/slide-1.html`):
```html
<div style="padding: 60px; background: #1e293b; height: 100%;">
  <h1 style="color: white;">Title</h1>
</div>
```

### 4. Config Files
When adding items, update the relevant config:

- `files/notes/config.json` — `{ currentNote, currentFolder }`
- `files/slides/config.json` — `{ currentDeckId, deckOrder }`
- `files/slides/<deck>/deck.json` — `{ title, slideOrder, currentSlideIndex }`
- `files/documents/config.json` — `{ currentDoc, docOrder }`
- `files/documents/<doc>/meta.json` — `{ title, pageOrder }`
- `files/sheets/config.json` — `{ currentFile }`

## Example File Formats

| File Type | Format | Extension |
|-----------|--------|-----------|
| Notes | HTML | `.md` |
| Slides | HTML | `.html` |
| PDF Pages | HTML (816x1056px) | `.html` |
| Spreadsheets | CSV | `.csv` |
| Scripts | JavaScript | `.js` |
| Config | JSON | `.json` |
