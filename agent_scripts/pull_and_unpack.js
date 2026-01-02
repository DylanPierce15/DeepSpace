#!/usr/bin/env node

const { execSync } = require('child_process');

const room = process.argv[2];
if (!room || (!room.startsWith('room-') && room.toUpperCase() !== 'ALL')) {
  console.error(`
❌ Missing or invalid room argument

Usage:
  npm run pull <room-id>   Pull and unpack a specific room
  npm run pull ALL         Pull and unpack all rooms

Example:
  npm run pull room-abc123-def456
`);
  process.exit(1);
}

const isAll = room.toUpperCase() === 'ALL';
console.log(`📥 Pulling and unpacking: ${isAll ? 'ALL rooms' : room}`);

// Set MIYAGI_ROOM so the post-merge hook unpacks only that room
execSync('git pull', { 
  stdio: 'inherit',
  env: isAll ? process.env : { ...process.env, MIYAGI_ROOM: room }
});

console.log('✅ Done');

