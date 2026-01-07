# Hooks

---

**useStorage(key, defaultValue)** - Widget-local storage
- Returns: `[value, setValue]`
- Scope: Single widget instance only
- Persists across widget reloads
- Similar to React useState but persistent

**useGlobalStorage(key, defaultValue)** - Canvas-wide shared storage
- Returns: `[value, setValue]`
- Scope: All widgets in the canvas
- Changes propagate instantly to all subscribers
- Perfect for shared application state

---

**useFiles(namespace)** - File-system API over global storage
- Returns: `files` object with methods: `read`, `write`, `delete`, `exists`, `list`, `ready`
- Scope: Canvas-wide (stored in global storage under namespace)
- Use when data is complex or there are many entries (slide decks, task managers, documents)
- Agent can modify files directly in the repository

---

**useInput(slotId, defaultValue)** - Receive data from connected outputs
- Returns: `value` (read-only)
- Receives data when connected output widgets call their `sendValue()`
- Persists to widget storage
- Automatically updates when connected outputs change

---

**useOutput(slotId)** - Send data to connected inputs
- Returns: `sendValue` function
- Call `sendValue(data)` to push data to all connected inputs
- Creates point-to-point data flow between widgets
- Data is JSON-serializable