#!/usr/bin/env bash
set -euo pipefail
# Publish @eudaimonicinc/deepspace and @eudaimonicinc/create-deepspace as private packages.
#
# Usage:
#   ./scripts/publish-private.sh                 # publish both
#   ./scripts/publish-private.sh deepspace       # publish one
#
# Requires NPM_TOKEN env var (automation token that bypasses 2FA).
#   export NPM_TOKEN=npm_xxx
#   ./scripts/publish-private.sh

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
SCOPE="@eudaimonicinc"

PACKAGES=("deepspace" "create-deepspace")
if [[ $# -gt 0 ]]; then
  PACKAGES=("$@")
fi

if [[ -z "${NPM_TOKEN:-}" ]]; then
  echo "✗ NPM_TOKEN is not set. Export it first:"
  echo "  export NPM_TOKEN=npm_xxx"
  exit 1
fi

# Build everything first
echo "→ Building packages..."
pnpm build --filter deepspace --filter create-deepspace

for PKG in "${PACKAGES[@]}"; do
  PKG_DIR="$ROOT/packages/$PKG"
  if [[ ! -d "$PKG_DIR" ]]; then
    echo "✗ Package directory not found: $PKG_DIR"
    exit 1
  fi

  VERSION=$(node -e "console.log(require('$PKG_DIR/package.json').version)")
  echo ""
  echo "→ Publishing $SCOPE/$PKG@$VERSION (private)..."

  # Pack the built package
  WORK=$(mktemp -d)
  cd "$PKG_DIR"
  npm pack --pack-destination "$WORK" --silent

  # Unpack, rename to scoped, strip prepublishOnly
  cd "$WORK"
  TARBALL=$(ls *.tgz)
  tar xzf "$TARBALL"
  cd package

  node -e "
    const pkg = require('./package.json');
    pkg.name = '$SCOPE/$PKG';
    delete pkg.scripts?.prepublishOnly;
    require('fs').writeFileSync('package.json', JSON.stringify(pkg, null, 2));
  "

  echo "//registry.npmjs.org/:_authToken=${NPM_TOKEN}" > .npmrc
  npm publish --access restricted
  rm -f .npmrc

  # Cleanup
  rm -rf "$WORK"
  echo "✓ $SCOPE/$PKG@$VERSION published"
done

echo ""
echo "✓ All done"
