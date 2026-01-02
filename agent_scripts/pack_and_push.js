#!/usr/bin/env node

const { execSync } = require('child_process');

const room = process.argv[2];
if (!room || (!room.startsWith('room-') && room.toUpperCase() !== 'ALL')) {
  console.error(`
❌ Missing or invalid room argument

Usage:
  npm run push <room-id>   Bundle, generate, and push a specific room
  npm run push ALL         Bundle, generate, and push all rooms

Example:
  npm run push room-abc123-def456
`);
  process.exit(1);
}

const isAll = room.toUpperCase() === 'ALL';
console.log(`📤 Packing and pushing: ${isAll ? 'ALL rooms' : room}`);

const env = isAll ? process.env : { ...process.env, MIYAGI_ROOM: room };

execSync('git add .', { stdio: 'inherit', env });

try {
  // Pre-commit hook will bundle and generate with MIYAGI_ROOM set
  execSync(`git commit -m "Update ${isAll ? 'all rooms' : room}"`, { stdio: 'inherit', env });
} catch (e) {
  console.log('ℹ️  No changes to commit');
}

execSync('git push --force', { stdio: 'inherit', env });

console.log('✅ Done');

