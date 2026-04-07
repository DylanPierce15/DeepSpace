# Rescaffolding a Test App

Clean, rebuild, and rescaffold `test-app-1` from the monorepo.

```bash
# 1. Build SDK + scaffolder
cd ~/GitHub/deepspace-sdk
pnpm build --filter deepspace --filter create-deepspace

# 2. Clean the test app (preserves .git)
cd ~/GitHub/test-app-1
ls -A | grep -v '^\.\(git\|gitignore\|gitattributes\)$' | grep -v '^README.md$' | xargs rm -rf

# 3. Scaffold in-place
~/GitHub/deepspace-sdk/packages/create-deepspace/dist/index.js test-app-1 --local ~/GitHub/deepspace-sdk

# 4. Add features
npx deepspace add testing
npx deepspace add canvas
npx deepspace add docs

# 5. Test locally
npx deepspace login   # if not already logged in
npx deepspace dev

# 6. Deploy
npx deepspace deploy
```
