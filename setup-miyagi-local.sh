#!/bin/bash
# Miyagi Local Development Setup Script
# This script prepares your cloned Miyagi canvas repository for local development

set -e  # Exit on any error

echo "🚀 Setting up Miyagi canvas repository for local development..."
echo ""

# Check if we're in a git repository
if [ ! -d ".git" ]; then
  echo "❌ Error: Not in a git repository. Please run this script from the repository root."
  exit 1
fi

# Check if agent_scripts directory exists
if [ ! -d "agent_scripts" ]; then
  echo "❌ Error: agent_scripts directory not found. This doesn't appear to be a Miyagi canvas repository."
  exit 1
fi

echo "📦 Installing agent_scripts dependencies..."
cd agent_scripts

# Check if Node.js is available
if ! command -v node &> /dev/null; then
  echo "❌ Error: Node.js is not installed. Please install Node.js to continue."
  exit 1
fi

# Install dependencies
if ! npm install; then
  echo "❌ Error: Failed to install dependencies"
  exit 1
fi
echo "✅ Dependencies installed"
echo ""

# Go back to repository root to setup git hooks
cd ..

# Setup git hooks
echo "🔧 Setting up git hooks..."
if ! node agent_scripts/setup-hooks.js; then
  echo "❌ Error: Failed to setup git hooks"
  exit 1
fi
echo ""

echo "🔧 Unpacking canvas state..."
if ! node agent_scripts/unpack-canvas-state.js; then
  echo "❌ Error: Failed to unpack canvas state"
  exit 1
fi
echo ""

echo "🔧 Pushing canvas state to DeepSpace..."
if ! git add .; then
  echo "❌ Error: Failed to stage changes for commit"
  exit 1
fi

if ! git commit -m "chore(setup): push unpacked canvas state"; then
  echo "ℹ️  No changes to commit, proceeding to push (or prior error)"
fi

if ! git push --force; then
  echo "❌ Error: Failed to push to remote repository"
  exit 1
fi

echo ""

echo "🎉 Setup complete! Your Miyagi canvas repository is ready for local development."
echo ""
echo "What the setup did:"
echo "  • Installed agent_scripts dependencies (esbuild, etc.)"
echo "  • Created git hooks for automatic canvas synchronization:"
echo "    - pre-commit: Compiles JSX and generates canvas-state.json"
echo "    - post-merge: Unpacks canvas-state.json into widget directories"
echo ""
echo "You're all set! The git hooks will automatically handle canvas synchronization."
