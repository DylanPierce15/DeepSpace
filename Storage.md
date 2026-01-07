# Storage System

---

#### 1. **Global Storage** (`useGlobalStorage` hook)
- **Scope**: Canvas-wide shared data
- **Purpose**: Data shared between ALL widgets on the canvas
- **Examples**: Shared task lists, calendar events, user preferences
- **Usage**: `const [data, setData] = useGlobalStorage('key', defaultValue)`
- **Real-time**: Changes propagate instantly to all widgets using the same key

---

#### 2. **File Storage** (`useFiles` hook)
- **Scope**: Canvas-wide, file-like data stored hierarchically
- **Purpose**: Store documents, notes, or structured content as "files" that can also be edited in the repository by the agent. This enables the agent to make changes to storage, since the agent has difficulty modifying storage directly, and is useful for cases in which the agent needs to create and modify documents.
- **Usage**: `const files = useFiles('notes/')` — prefix determines the file namespace
- **API**:
  - `files.read(path)` — read file content (returns string or null)
  - `files.write(path, content)` — write file content
  - `files.delete(path)` — delete file or folder
  - `files.exists(path)` — check if file exists
  - `files.list(path)` — list items in folder (folders end with `/`)
  - `files.ready` — boolean, true once storage is loaded
- **Key insight**: `useFiles` is a file-system API over global storage. Files are unpacked to `files/` in the repo for direct editing.

---

#### 3. **Local Storage** (`useStorage` hook)
- **Scope**: Widget-specific data
- **Purpose**: Private data that only affects one widget instance
- **Examples**: Form inputs, UI state, widget-specific settings
- **Usage**: `const [data, setData] = useStorage('key', defaultValue)`

---

### Further Insights
- Direct and functional updaters are supported for both `useStorage` and `useGlobalStorage`.
  - Direct examples:
    - `setPlants([...plants, newPlant])`
    - `setPlants(plants.map(p => p.id === id ? { ...p, status } : p))`
    - `setPlants(plants.filter(p => p.id !== id))`
  - Functional examples:
    - `setPlants(prev => [...(prev || []), newPlant])`
    - `setStore(prev => ({ ...(prev || {}), [id]: { ...prev?.[id], status } }))`
- Values must be JSON‑serializable; if a functional updater returns `undefined`, the update is ignored with a dev warning.
- Strict mode (optional): when `window.__MIYAGI_STORAGE_STRICT__ = true`, undefined updater results or serialization failures will throw instead of merely warning.
- Sorting: avoid mutating arrays in place when deriving lists for render.
  - Make a copy before sorting: `const base = filter === 'all' ? [...plants] : plants.filter(...); return base.sort(...);`
  - Never call `plants.sort(...)` directly; it mutates the stored array and can desync storage.

---

### Storage Patterns

Use these patterns to keep data durable, fast, and predictable across widgets and users in the same canvas.

#### Key namespacing (recommended)
- Use clear, stable, dotted keys: `domain.feature.subfeature`
  - Examples from F1 widget:
    - `f1.results.year` (active season)
    - `f1.results.rounds` (per-year, per-round results map)
    - `f1.results.view` (UI view: races/players/picks)
    - `f1.bets.selections` (per-year, per-round, per-email picks)
    - `f1.bets.email` (current user email for picks)
- Namespacing prevents collisions and helps future migrations.

#### Throttle/batch writes for fast UIs
- Avoid writing on every keystroke for large objects; debounce or batch where possible.
- Prefer smaller, composable keys over one giant blob if the data grows large.

#### Clear and migrate keys safely
- To clear a key: `setX(defaultValue)` or set to `{}`/`[]` as appropriate.
- For breaking changes, introduce a versioned key (e.g., `tasks.v2`) and migrate once on widget mount.

---

### Examples

Example (immutable nested update for picks):
```jsx
// Shared across widgets in the canvas
const [picksStore, setPicksStore] = useGlobalStorage('f1.bets.selections', {});

function setPick(year, round, email, d1, d2) {
  setPicksStore(prev => {
    const next = { ...(prev || {}) };
    const byYear = { ...(next[year] || {}) };
    const perRound = { ...(byYear[round] || {}) };
    perRound[email] = { picks: [d1 || '', d2 || ''] };
    byYear[round] = perRound;
    next[year] = byYear;
    return next;
  });
}
```

```jsx
// Season selection shared across widgets/users
const [year, setYear] = useGlobalStorage('f1.results.year', new Date().getFullYear());

// Per-year, per-round results (map: { [year]: { [round]: RoundData } })
const [roundStore, setRoundStore] = useGlobalStorage('f1.results.rounds', {});

// Bets: { [year]: { [round]: { [email]: { picks: string[] } } } }
const [picksStore, setPicksStore] = useGlobalStorage('f1.bets.selections', {});

// Update a user's picks immutably
function updatePicks(round, email, d1, d2) {
  setPicksStore(prev => {
    const next = { ...(prev || {}) };
    const byYear = { ...(next[year] || {}) };
    const perRound = { ...(byYear[round] || {}) };
    perRound[email] = { picks: [d1 || '', d2 || ''] };
    byYear[round] = perRound;
    next[year] = byYear;
    return next;
  });
}

// Derive computed data from storage with useMemo
const driverStandings = React.useMemo(() => {
  const season = roundStore?.[year] || {};
  const points = new Map();
  Object.values(season).forEach((round) => {
    (round?.results || []).forEach(r => {
      const key = r.driverCode || r.driverName;
      const prev = points.get(key) || { points: 0, name: r.driverName, constructor: r.constructor };
      prev.points += Number(r.points || 0);
      points.set(key, prev);
    });
  });
  return Array.from(points.entries())
    .map(([code, v]) => ({ code, ...v }))
    .sort((a, b) => b.points - a.points);
}, [roundStore, year]);
```

Example (useFiles for hierarchical notes app):
```jsx
const files = useFiles('notes/');
const [currentPath, setCurrentPath] = useState('');

// Config stored as JSON file
const config = useMemo(() => {
  const raw = files.read('config.json');
  if (!raw) return { currentNote: null };
  try { return JSON.parse(raw); } catch { return {}; }
}, [files]);

const writeConfig = (updates) => {
  files.write('config.json', JSON.stringify({ ...config, ...updates }, null, 2));
};

// List folder contents - folders end with '/', filter out config
const items = useMemo(() => {
  if (!files.ready) return [];
  return files.list(currentPath)
    .filter(name => name !== 'config.json')
    .map(name => ({
      name: name.endsWith('/') ? name.slice(0, -1) : name.replace('.md', ''),
      isFolder: name.endsWith('/'),
      fullPath: currentPath + name
    }));
}, [files, currentPath]);

// Read/write note content directly (no local state copy)
const noteContent = files.read(selectedNotePath) || '';
<textarea value={noteContent} onChange={(e) => files.write(selectedNotePath, e.target.value)} />

// Create nested structure
files.write('projects/.folder', '');  // Create folder placeholder
files.write('projects/todo.md', '# My Todo');
```

---

### Widget Communication Patterns
Widgets can collaborate using either global storage (broadcast) or I/O connections (point-to-point):

**Example 1: Task Management System (Global Storage)**
- Calendar widget reads `useGlobalStorage('tasks', [])` to show tasks with due dates
- Task Manager widget writes to the same `tasks` key
- Both widgets stay synchronized automatically
- Pattern: Shared state for collaborative editing

**Example 2: Data Pipeline (I/O Connections)**
- Search widget: `const sendResults = useOutput('results')` → searches and calls `sendResults(data)`
- Filter widget: `const results = useInput('results', [])` → receives, filters, then `sendFiltered(filtered)` via its own output
- Display widget: `const filtered = useInput('filtered-results', [])` → displays final data
- Pattern: Linear data transformation pipeline

**Example 3: Nutrition Tracking (Global Storage)**
- Nutrition Tracker stores goals in `useGlobalStorage('nutritional-goals', {})`
- Multiple nutrition widgets share meal history via `useGlobalStorage('meal-history', [])`
- Pattern: Multiple widgets reading/writing shared database

**Example 4: Notes App (File Storage)**
- Notes widget uses `useFiles('notes/')` for nested folder structure
- Each note is a file editable in repo or widget
- `files.list('projects/')` returns folder contents
- Pattern: File-based data with repository editing
