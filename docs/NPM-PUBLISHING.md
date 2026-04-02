# Publishing to npm

## Package

The SDK is published as a single `deepspace` package on npm.

- npm page: https://www.npmjs.com/package/deepspace
- Owner: `eudaimonicinc`

## Publishing

1. Create a granular access token at https://www.npmjs.com/settings/eudaimonicinc/tokens/create
   - Permissions: Read and Write
   - Packages: All packages

2. Add the token to a local `.npmrc` in the package directory:

```
//registry.npmjs.org/:_authToken=YOUR_TOKEN
```

3. Publish:

```bash
npm publish
```

**Do not commit `.npmrc` files containing tokens.**

## Future: Trusted Publishing

For CI/CD, set up npm Trusted Publishing with GitHub Actions (OIDC-based, no secrets needed).
