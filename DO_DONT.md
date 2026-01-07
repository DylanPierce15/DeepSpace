# Do's and Don'ts

---

### ✅ DO:

- **Preserve widget independence**: Each widget should work standalone
- **Use appropriate storage**: Local for widget-specific, global for shared data
- **Always persist important data**: Ask "Would this survive a page refresh?" If no → use `useStorage` or `useGlobalStorage`
- **Import React and hooks explicitly**: At the top of `template.jsx`, e.g. `import React, { useState, useEffect } from 'react'`
- **Keep existing functionality**: Don't break current features unless requested
- **Use semantic global storage keys**: Clear names like `'shared-tasks'`, `'user-preferences'`
- **Work only inside the current room**: Modify files only under the active room directory
- **Preserve storage entries**: When expanding storage, don't overwrite existing data
- **Use explicit HTTP methods**: `miyagiAPI.post('/endpoint', data)` — always use paths from McAPI.yaml

---

### ❌ DON'T:

- **Break iframe isolation**: Widgets run in separate iframes and cannot directly access each other's DOM or state
- **Remove essential hooks**: Keep `useState`, `useEffect`, `useMemo`, etc. — they're required for React to work
- **Create circular dependencies**: Widgets depending on each other in loops cause infinite re-renders
- **Use complex external libraries**: Stick to React built-ins and provided hooks — external libs won't load
- **Modify compiled HTML**: Only modify JSX — `template.html` is auto-generated and will be overwritten
- **Forget `export default`**: Every widget MUST end with `export default ComponentName;` or it won't render
- **Put all code in template.jsx**: Split into `components/` and `utils/` for maintainability
- **Modify `properties.json` or `template.html`**: System-managed files — your changes will be lost
- **Run git commands**: Git is handled automatically — manual git commands will fail
- **Use naked `miyagiAPI()` calls**: Always use `.post()` or `.get()` methods
- **Hallucinate API methods**: Don't invent methods like `miyagiAPI.generateText()` — use paths from McAPI.yaml
- **Forget the leading slash**: Use `/generate-text` not `generate-text`
- **Assume response wrappers from other libraries**: The schema in McAPI.yaml shows EXACTLY what you get. Don't add extra layers from muscle memory — if the schema says `data.text`, write `response.data.text`.
