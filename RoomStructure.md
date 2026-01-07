# File Structure of the Room

---

```
room-9ee0cdde-865f-47e8-b0a6-753dcf9108f6/      # Root canvas (your main workspace)
├── canvas-metadata.json                        # Canvas info, pages list, tldraw schema
├── canvas-state.json                           # Full tldraw snapshot (all shapes)
├── global-storage.json                         # Canvas-wide shared data
├── canvas-link-{shapeId}.json                  # Canvas-link to nested room (position, label)
│
├── files/                                      # File storage (room-level, not in widgets)
│   ├── notes/                                  # Example: Notepad widget files
│   │   ├── config.json                         # { currentNote, currentFolder }
│   │   ├── welcome.md                          # Note content (HTML)
│   │   ├── quick-notes.md
│   │   └── projects/                           # Nested folder
│   │       ├── .folder                         # Folder placeholder
│   │       └── project-alpha.md
│   ├── slides/                                 # Example slide deck widget files
│   ├── documents/                              # Example PDF generator files
│   └── sheets/                                 # Example spreadsheet files
│
├── room-252060fe-aabb-4c5d-.../                # Subcanvas (nested room)
│   ├── canvas-metadata.json
│   ├── canvas-state.json
│   ├── global-storage.json
│   ├── files/                                  # Each room has its own files/
│   └── widget-XUc7WesCe2PWoiEe/
│       ├── properties.json                     # Shape props (position, size, rotation, etc.)
│       ├── storage.json                        # Widget-specific persistent data
│       ├── template.jsx                        # React component source code (main entry point)
│       ├── template.html                       # Compiled HTML output (auto-generated)
│       ├── components/                         # Additional React components (optional)
│       └── utils/                              # Utility functions (optional)
│
└── widget-p0nDqOHs4tURnBGrIVwOV/                # Widget in root canvas
    ├── properties.json
    ├── storage.json
    ├── template.jsx
    ├── template.html
```

See `FileEditing.md` for detailed file editing instructions.
