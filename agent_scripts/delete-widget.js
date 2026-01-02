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
 * Delete a widget directory and all its contents
 * @param {string} widgetDir - The widget directory name (e.g., 'widget-64jTHevUBL9azUJZ')
 */
function deleteWidget(widgetDir) {
  if (!widgetDir) {
    console.error('Error: Widget directory name is required');
    console.log('Usage: node delete-widget.js <widgetDir>');
    console.log('Arguments:');
    console.log('  widgetDir - The widget directory name to delete');
    console.log('Example: node delete-widget.js widget-64jTHevUBL9azUJZ');
    console.log('Note: Uses current room from container vars to find the room directory');
    process.exit(1);
  }

  // Get current room from container vars
  const containerVars = JSON.parse(fs.readFileSync('/app/container_vars.json', 'utf8'));
  const currentRoom = containerVars.currentRoom;
  if (!currentRoom) {
    console.error('Error: No current room set in container vars');
    console.log('Ensure current room is set before deleting widgets');
    process.exit(1);
  }

  // Find the room path
  console.log(`🔍 Searching for room: ${currentRoom}`);
  const roomPath = findRoomPath(currentRoom);
  
  if (!roomPath) {
    console.error(`Error: Could not find room directory for: ${currentRoom}`);
    console.log('Searched in: /app/workspace/repo');
    process.exit(1);
  }

  console.log(`✅ Found room at: ${roomPath}`);

  // Construct the widget path
  const widgetPath = path.join(roomPath, widgetDir);

  // Validate that the widget path exists
  if (!fs.existsSync(widgetPath)) {
    console.error(`Error: Widget directory does not exist: ${widgetPath}`);
    process.exit(1);
  }

  // Validate that this is actually a widget directory
  const dirName = path.basename(widgetPath);
  if (!dirName.startsWith('widget-')) {
    console.error(`Error: Directory does not appear to be a widget directory (should start with 'widget-'): ${dirName}`);
    process.exit(1);
  }

  // Additional validation - check if it contains expected widget files
  const expectedFiles = ['properties.json', 'storage.json', 'template.jsx'];
  const hasWidgetFiles = expectedFiles.some(file => fs.existsSync(path.join(widgetPath, file)));
  
  if (!hasWidgetFiles) {
    console.warn(`Warning: Directory ${dirName} doesn't contain expected widget files, but proceeding with deletion...`);
  }

  // Get widget info before deletion for logging
  const roomId = path.basename(roomPath);
  
  console.log(`Deleting widget directory: ${dirName}`);
  console.log(`Room Path: ${roomPath}`);
  console.log(`Room ID: ${roomId}`);
  console.log(`Widget Path: ${widgetPath}`);

  try {
    // List files that will be deleted
    const files = fs.readdirSync(widgetPath);
    console.log('\n📁 Files to be deleted:');
    files.forEach(file => {
      const filePath = path.join(widgetPath, file);
      const stats = fs.statSync(filePath);
      if (stats.isFile()) {
        console.log(`📄 ${file}`);
      } else if (stats.isDirectory()) {
        console.log(`📁 ${file}/`);
      }
    });

    // Recursively delete the widget directory
    fs.rmSync(widgetPath, { recursive: true, force: true });

    console.log('\n✅ Widget deleted successfully!');
    console.log(`🗑️  Removed: ${widgetPath}`);
    console.log(`\n🎯 Widget ${dirName} has been completely removed from ${roomId}`);

  } catch (error) {
    console.error('❌ Error deleting widget:', error);
    process.exit(1);
  }
}

// Parse command line arguments
const args = process.argv.slice(2);
const widgetDir = args[0];

// Run the deletion
deleteWidget(widgetDir);
