# Miyagi Canvas Repository

This is your personal Miyagi canvas repository, where all your canvases and widgets live.

---

## Quick Start

### 1. Setup (Run Once After Cloning)

```bash
npm run setup
```

This installs dependencies and configures git hooks for automatic synchronization.

---

### 2. Pull Changes from the App

```bash
npm run pull ALL
```

**Before running this:** Click the **History** button in the top-right panel of the Miyagi app to save your canvas changes.

This downloads the latest canvas state from the app to your local repository.

```bash
npm run pull room-abc123   # Pull a specific room only
npm run pull ALL           # Pull all rooms
```

---

### 3. Push Changes to the App

```bash
npm run push ALL
```

This uploads your local changes (widget edits, new widgets, etc.) back to the Miyagi app.

```bash
npm run push room-abc123   # Push a specific room only
npm run push ALL           # Push all rooms
```

---

## Typical Workflow

1. **Save in app:** Click the **History** button in the top-right panel
2. **Pull:** `npm run pull ALL`
3. **Edit:** Make changes to widget files locally
4. **Push:** `npm run push ALL`
5. **Refresh:** Your changes appear in the Miyagi app

---

<details>
<summary><strong>What's in this repository?</strong></summary>

- **agent_scripts/** - Helper scripts for widget compilation and canvas management
  - Template bundling (JSX → HTML)
  - Canvas state synchronization
  - Widget generation and management
- **Your widget directories** - Each widget you create will have its own directory
- **canvas-state.json** - Serialized state of all your canvases (auto-generated)
- See `RoomStructure.md` for a schematic of how rooms are structured

</details>

<details>
<summary><strong>Git Hooks</strong></summary>

- **git commit**: Automatically compiles JSX templates, tracks all existing shapes, and generates canvas-state.json
- **git pull**: Automatically unpacks canvas-state.json into widget directories, shape directories, storage and metadata

</details>

<details>
<summary><strong>Manual Commands</strong></summary>

If you need to run the build steps manually:

```bash
# Compile JSX templates to HTML
node agent_scripts/bundle-templates.js

# Generate canvas-state.json from all widget directories
node agent_scripts/generate-canvas.js

# Unpack canvas-state.json into widget directories
node agent_scripts/unpack-canvas-state.js

# Create a widget (handles widget naming and creates skeleton)
node agent_scripts/generate-widget.js $WIDGET_ID $ROOM_ID
```

</details>

<details>
<summary><strong>Important Notes</strong></summary>

- Don't manually edit `canvas-state.json` - it's auto-generated
- Don't manually edit `canvas-metadata.json` - it's auto-generated
- Avoid simultaneous interaction with both the repo and the app as this **WILL** lead to merge conflicts. This is handled for you when using the chat feature of the app, but there is no conflict resolution logic here.

</details>
