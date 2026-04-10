# Feature Page Files Must Go in `src/pages/`

## Problem

A feature's frontend page file must be copied to `src/pages/<route>.tsx`, not to `src/features/<name>/...`. Putting it elsewhere results in a **404 "Page not found"** on the deployed app — the nav link exists but nothing renders at the URL.

## Why

The starter template uses [generouted](https://github.com/oedotme/generouted) for file-based routing with React Router. Generouted scans `src/pages/` at build time and generates routes from the filenames:

- `src/pages/home.tsx` → `/home`
- `src/pages/assistant.tsx` → `/assistant`
- `src/pages/items.tsx` → `/items`

If a feature copies its page to `src/features/ai-chat/AiChatPage.tsx`, generouted never sees it. The `add-feature.cjs` script wires the nav link into `src/nav.ts`, so clicking it navigates to `/assistant`, but no route matches and the SPA fallback shows the 404.

## The fix

In `feature.json`, set the `files[].dest` to `src/pages/<route>.tsx`:

```json
{
  "id": "ai-chat",
  "files": [
    { "src": "src/AiChatPage.tsx", "dest": "src/pages/assistant.tsx" }
  ],
  "route": {
    "path": "/assistant",
    "component": "AssistantPage",
    "protected": false
  }
}
```

The page component must use `export default`:

```tsx
export default function AssistantPage() {
  // ...
}
```

## Reference: existing working feature

`packages/create-deepspace/features/items/feature.json` uses the correct pattern:

```json
"files": [
  { "src": "src/ItemsPage.tsx", "dest": "src/pages/items.tsx" },
  ...
]
```

## How to spot this bug

- `deepspace add <feature>` succeeds, nav link appears, but visiting the route shows 404
- `src/features/<name>/` directory exists in the scaffolded app but `src/pages/<route>.tsx` does not
- `add-feature.cjs` output logs `Route: automatic (file-based routing via src/pages/)` — that message is aspirational, it only actually works if the page file was copied to `src/pages/`
