#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

/**
 * Find the full path to a room directory by searching for it
 * @param {string} roomName - The room name to search for
 * @returns {string|null} The full path to the room directory, or null if not found
 */
function findRoomPath(roomName) {
  const { execSync } = require('child_process');
  
  try {
    // Use find command to search for directory under /app/workspace/repo
    const findCommand = `find /app/workspace/repo -type d -name "${roomName}" 2>/dev/null`;
    const result = execSync(findCommand, { encoding: 'utf8' }).trim();
    
    if (result) {
      // Return the first match (there should only be one)
      const paths = result.split('\n');
      return paths[0];
    }
    
    return null;
  } catch (error) {
    // If find command fails, return null
    return null;
  }
}

/**
 * Count occurrences of 'room-' in a path to determine if it's a root room
 * @param {string} roomPath - The absolute path to the room directory
 * @returns {number} Number of 'room-' occurrences in the path
 */
function countRoomOccurrences(roomPath) {
  const pathParts = roomPath.split(path.sep);
  let count = 0;
  
  for (const part of pathParts) {
    if (part.startsWith('room-')) {
      count++;
    }
  }
  return count;
}

/**
 * Delete a canvas directory and all its contents
 * @param {string} canvasDir - The canvas directory name (e.g., 'room-subcanvas123')
 */
function deleteRoom(canvasDir) {
  if (!canvasDir) {
    console.error('Error: Canvas directory name is required');
    console.log('Usage: node delete-room.js <canvasDir>');
    console.log('Arguments:');
    console.log('  canvasDir - The canvas directory name to delete');
    console.log('Example: node delete-room.js room-subcanvas123');
    console.log('Note: Uses current room from container vars to find the parent room directory');
    process.exit(1);
  }

  // Get current room from container vars
  const containerVars = JSON.parse(fs.readFileSync('/app/container_vars.json', 'utf8'));
  const currentRoom = containerVars.currentRoom;
  if (!currentRoom) {
    console.error('Error: No current room set in container vars');
    console.log('Ensure current room is set before deleting canvas rooms');
    process.exit(1);
  }

  // Find the room path
  console.log(`🔍 Searching for parent room: ${currentRoom}`);
  const parentRoomPath = findRoomPath(currentRoom);
  
  if (!parentRoomPath) {
    console.error(`Error: Could not find parent room directory for: ${currentRoom}`);
    console.log('Searched in: /app/workspace/repo');
    process.exit(1);
  }

  console.log(`✅ Found parent room at: ${parentRoomPath}`);

  // Construct the canvas path
  const roomPath = path.join(parentRoomPath, canvasDir);

  // Validate that the room path exists
  if (!fs.existsSync(roomPath)) {
    console.error(`Error: Room directory does not exist: ${roomPath}`);
    process.exit(1);
  }

  // Validate that this is actually a room directory
  const dirName = path.basename(roomPath);
  if (!dirName.startsWith('room-')) {
    console.error(`Error: Directory does not appear to be a room directory (should start with 'room-'): ${dirName}`);
    process.exit(1);
  }

  // Safety check: Prevent deletion of root room
  const roomCount = countRoomOccurrences(roomPath);
  if (roomCount < 2) {
    console.error(`Error: Cannot delete root room. Path must contain at least 2 'room-' directories.`);
    console.error(`Current path contains ${roomCount} 'room-' director${roomCount === 1 ? 'y' : 'ies'}: ${roomPath}`);
    console.error('This safety check prevents accidental deletion of the main room.');
    process.exit(1);
  }

  console.log(`Deleting room directory: ${dirName}`);
  console.log(`Room Path: ${roomPath}`);
  console.log(`Room Count in Path: ${roomCount} (safe to delete)`);

  try {
    // Recursively delete the room directory
    fs.rmSync(roomPath, { recursive: true, force: true });

    console.log('\n✅ Room deleted successfully!');
    console.log(`🗑️  Removed: ${roomPath}`);
    console.log(`\n🎯 Room ${dirName} has been permanently deleted`);

  } catch (error) {
    console.error('❌ Error deleting room:', error);
    process.exit(1);
  }
}

// Parse command line arguments
const args = process.argv.slice(2);
const canvasDir = args[0];

// Run the deletion
deleteRoom(canvasDir);

