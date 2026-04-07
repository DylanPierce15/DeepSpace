# Migrating a Miyagi3 App to DeepSpace SDK

Guide for porting an existing Miyagi3 miniapp-sync app to the new DeepSpace SDK architecture (generouted routing, Cloudflare Vite plugin, feature conventions).

## 1. Create the repo

```bash
gh repo create deepdotspace/<app-name> --private --description "<description>" --clone --add-readme
mv ./<app-name> ~/GitHub/<app-name>
gh repo edit deepdotspace/<app-name> --add-topic deepspace-app
```

## 2. Scaffold a fresh DeepSpace app

```bash
cd ~/GitHub/<app-name>
~/GitHub/deepspace-sdk/packages/create-deepspace/dist/index.js <app-name> --local ~/GitHub/deepspace-sdk
```

This gives you the new architecture: generouted file-based routing, `_app.tsx` providers, `nav.ts`, Cloudflare Vite plugin, etc.

## 3. Copy old source as reference

```bash
SRC=~/GitHub/Miyagi3/apps/miniapp-sync/apps/<old-app-dir>
mkdir -p ~/GitHub/<app-name>/old-code
cp -R "$SRC/src" ~/GitHub/<app-name>/old-code/src
cp "$SRC/worker.ts" ~/GitHub/<app-name>/old-code/worker.ts
cp -R "$SRC/tests" ~/GitHub/<app-name>/old-code/tests 2>/dev/null || true
```

## 4. Adapt the code

Key differences between old and new architecture:

| Old (Miyagi3) | New (DeepSpace SDK) |
|---|---|
| `App.tsx` + `AppShell.tsx` + `pages.ts` | `src/pages/_app.tsx` (providers + nav) |
| Manual route registration in `pages.ts` | File-based routing via generouted (`src/pages/`) |
| `BrowserRouter` in `main.tsx` | `<Routes />` from `@generouted/react-router` |
| Nav items in `pages.ts` | Nav items in `src/nav.ts` |
| Components in `src/components/` | Same — `src/components/` |
| Schemas in `src/schemas.ts` | Same — `src/schemas.ts` |
| Custom UI components | Use `deepspace` SDK UI components where possible |
| `wrangler dev` + `vite dev` (two processes) | `npx deepspace dev` (single process via Cloudflare Vite plugin) |
| `esbuild` worker bundle | `vite build` bundles worker via Cloudflare Vite plugin |

### Migration steps

1. **Schemas**: Copy schema definitions to `src/schemas/` and import them in `src/schemas.ts`
2. **Pages**: Move page components to `src/pages/<name>.tsx` (default export required)
3. **Components**: Copy to `src/components/`, update imports from `deepspace` SDK where duplicated
4. **Hooks**: Copy to `src/hooks/`
5. **Worker**: The scaffolded `worker.ts` should work as-is — only update if you added custom routes
6. **Nav**: Add entries to `src/nav.ts`
7. **Styles**: Merge any custom CSS into `src/styles.css`

## 5. Test locally

```bash
npx deepspace login
npx deepspace dev
```

## 6. Deploy

```bash
npx deepspace deploy
```

## 7. Clean up

```bash
rm -rf old-code
```
