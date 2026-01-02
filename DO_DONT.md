### ✅ DO:
- **Preserve widget independence**: Each widget should work standalone
- **Use appropriate storage**: Local for widget-specific, global for shared data
- [CRITICAL] **Always persist important data**: Ask yourself "Would this survive a page refresh?" If no → use `useStorage` or `useGlobalStorage`. Never lose user data to ephemeral state.
- **Import React and hooks explicitly**: At the top of `template.jsx`, e.g. `import React, { useState, useEffect } from 'react'`.
- **Position widgets thoughtfully**: When creating new widgets, look at existing widget positions in `properties.json` files and place the new widget near related widgets (e.g., within 100-200px)
- **Maintain React best practices**: Proper hooks, state management, effects
- **Create meaningful integrations**: Widgets should enhance each other
- **Keep existing functionality**: Don't break current features unless requested
- **Use semantic global storage keys**: Clear, descriptive names like 'shared-tasks', 'user-preferences'
- **Work only inside the current room**: Modify files only under the active room directory (see Room Scope below).
- **Modify storage thoughtfully**: Always preserve entries in the storage when you expand it.
- **Keep functionality encapsulated and modular**: Use multiple helper files
- **Use explicit HTTP methods with endpoints**: `miyagiAPI.post('/generate-text', data)` — always use the `endpoint` from McAPI.yaml (with leading `/`)

### ❌ DON'T:
- **Break iframe isolation**: Widgets can't directly access each other
- **Remove essential hooks**: Keep `useState`, `useEffect`, `useMemo`, etc.
- **Create circular dependencies**: Avoid widgets that depend on each other in loops
- **Use complex external libraries**: Stick to React built-ins and provided hooks
- **Modify the compiled html**: only modify the JSX, as the HTML will be compiled
- **Forget export default**: Every widget MUST end with `export default ComponentName;` or it won't render
- **Put all the code in template.jsx**: Keep code modular
- **Attempt to modify properties.json or template.html**: These files will be handled by the system.
- **Attempt to run any git commands, they will not work**: The git logic will be handled by the system.
- **Use naked miyagiAPI() calls**: Always use `.post()` or `.get()` — e.g. `miyagiAPI.post('/generate-text', {...})`
- **Hallucinate API methods**: Don't invent methods like `miyagiAPI.generateText()` — use paths from McAPI.yaml
- **Forget the leading slash**: Use `/generate-text` not `generate-text` — match the `endpoint` field in McAPI.yaml
- **Assume response wrappers from other libraries**: The schema in McAPI.yaml shows EXACTLY what you get. Don't add extra layers from muscle memory — if the schema says `data.text`, write `response.data.text`.

### Available React Environment:
- **React 18**: Full hooks API (`useState`, `useEffect`, `useMemo`, `useCallback`, etc.)
- **Storage hooks**: `useStorage(key, default)`, `useGlobalStorage(key, default)`
- **I/O hooks**: `useInput(slotId, default)`, `useOutput(slotId)`
- **API Access**: `miyagiAPI.post(endpoint, data)`, `miyagiAPI.get(endpoint, params)` for integrations
- **Modern JavaScript**: ES6+, async/await, destructuring, etc.
