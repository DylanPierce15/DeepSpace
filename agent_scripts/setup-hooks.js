#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

console.log('🔧 Setting up Miyagi git hooks...');

// Define hook contents
const preCommitHook = `#!/bin/sh

# Miyagi Canvas Repository Pre-commit Hook
echo "🔨 Running Miyagi pre-commit hook..."

# Bundle JSX templates to HTML with esbuild
node agent_scripts/bundle-templates.js
if [ $? -ne 0 ]; then
  echo "❌ Bundling failed"
  exit 1
fi

# Generate canvas-state.json for all rooms
node agent_scripts/generate-canvas.js
if [ $? -ne 0 ]; then
  echo "❌ Canvas state generation failed"
  exit 1
fi

# Add generated files to the commit
git add .

echo "✅ Pre-commit hook completed successfully"
exit 0`;

const postMergeHook = `#!/bin/sh

# Miyagi Canvas Repository Post-merge Hook
echo "📦 Running Miyagi post-merge hook..."

# Unpack canvas-state.json into widget directories
node agent_scripts/unpack-canvas-state.js
if [ $? -ne 0 ]; then
  echo "❌ Canvas state unpacking failed"
  exit 1
fi

# Note: No need to bundle templates - the pre-commit hook ensures all commits
# have up-to-date template.html files, so pulling/merging gives us bundled files.

echo "✅ Post-merge hook completed successfully"
exit 0`;

async function setupHooks() {
  try {
    // Ensure .git/hooks directory exists
    const hooksDir = path.join('.git', 'hooks');
    if (!fs.existsSync(hooksDir)) {
      console.log('❌ .git/hooks directory not found. Make sure you are in a git repository.');
      process.exit(1);
    }

    // Create git hooks
    const preCommitPath = path.join(hooksDir, 'pre-commit');
    fs.writeFileSync(preCommitPath, preCommitHook);
    fs.chmodSync(preCommitPath, '755');
    console.log('✅ Created pre-commit hook');

    const postMergePath = path.join(hooksDir, 'post-merge');
    fs.writeFileSync(postMergePath, postMergeHook);
    fs.chmodSync(postMergePath, '755');
    console.log('✅ Created post-merge hook');

    console.log('🎉 Git hooks setup completed successfully!');
    console.log('');
    console.log('Hooks installed:');
    console.log('  • pre-commit: Bundles JSX templates and generates canvas-state.json');
    console.log('  • post-merge: Unpacks canvas-state.json into widget directories');
    console.log('');
    console.log('Your repository is now ready for automated canvas synchronization!');

  } catch (error) {
    console.error('❌ Failed to setup git hooks:', error.message);
    process.exit(1);
  }
}

// Run the setup
setupHooks();
