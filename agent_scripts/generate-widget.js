#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const { IndexValidator } = require('./index-validator');
const { defaultSizeForTemplate, computePlacement, collectRoomWidgetRectangles } = require('./widget-positioning');

/**
 * Generate a random shape ID similar to tldraw's format with template handle prefix
 * @param {string} templateHandle - Template handle to prefix the shape ID with
 * @returns {string} Shape ID like "shape:notepad-Y59wm6acnQvwpBlp"
 */
function generateShapeId(templateHandle) {
  // Generate 16 character random string similar to tldraw format
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  let result = '';
  for (let i = 0; i < 16; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  // Format: shape:templateHandle-uniqueId (matches frontend and backend)
  return `shape:${templateHandle}-${result}`;
}

/**
 * Read page ID from canvas metadata
 * @param {string} roomPath - The absolute path to the room directory
 * @returns {string} The page ID from canvas metadata, or 'page:page' as fallback
 */
function getPageIdFromMetadata(roomPath) {
  try {
    const metadataPath = path.join(roomPath, 'canvas-metadata.json');
    if (fs.existsSync(metadataPath)) {
      const metadata = JSON.parse(fs.readFileSync(metadataPath, 'utf8'));
      if (metadata.pages && metadata.pages.length > 0) {
        return metadata.pages[0].id;
      }
    }
  } catch (error) {
    console.warn('Warning: Could not read canvas metadata, using default page ID');
  }
  return 'page:page'; // fallback
}

/**
 * Get the canvas mode for a room by reading canvas metadata
 * @param {string} roomPath - The absolute path to the room directory
 * @returns {string} Canvas mode: 'dock' or 'canvas' (default)
 */
function getCanvasMode(roomPath) {
  try {
    const metadataPath = path.join(roomPath, 'canvas-metadata.json');
    if (fs.existsSync(metadataPath)) {
      const metadata = JSON.parse(fs.readFileSync(metadataPath, 'utf8'));
      const canvasMode = metadata?.canvas?.canvasMode || metadata?.canvasMode || 'freeform';
      // Normalize to 'canvas' for freeform/default mode (desktop mode deprecated)
      return canvasMode === 'dock' ? 'dock' : 'canvas';
    }
  } catch (error) {
    console.warn('Warning: Could not read canvas metadata to detect canvas mode, defaulting to canvas');
  }
  return 'canvas';
}

/**
 * Get the next index for a new widget by finding all existing widget indices in the room
 * Uses IndexValidator for proper index generation
 * @param {string} roomPath - The path to the room directory
 * @returns {string} The next index to use for the new widget
 */
function getNextWidgetIndex(roomPath) {
  const validator = new IndexValidator();
  return validator.getNextWidgetIndex(roomPath);
}

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
 * Generate widget directory and files
 * @param {string} templateHandle - Template handle (required)
 * @param {string} roomPath - The path to the room directory (optional)
 */
function generateWidget(templateHandle, roomPath) {
  if (!templateHandle) {
    console.error('Error: templateHandle is required');
    console.log('Usage: node generate-widget.js <templateHandle> [roomPath]');
    console.log('Arguments:');
    console.log('  templateHandle - The template handle (e.g., my-widget)');
    console.log('  roomPath       - The path to the room directory (optional)');
    console.log('                   If not provided, uses current room from container vars');
    console.log('Example: node generate-widget.js my-template /path/to/room-12345');
    console.log('Note: If no roomPath provided, uses current room from container vars');
    process.exit(1);
  }

  // If no roomPath provided, try to find it using current room from container vars
  if (!roomPath) {
    // Get current room from container vars
    const containerVars = JSON.parse(fs.readFileSync('/app/container_vars.json', 'utf8'));
    const currentRoom = containerVars.currentRoom;
    if (!currentRoom) {
      console.error('Error: No roomPath provided and no current room set in container vars');
      console.log('Either provide roomPath as second argument or ensure current room is set');
      process.exit(1);
    }

    console.log(`🔍 Searching for room: ${currentRoom}`);
    roomPath = findRoomPath(currentRoom);
    
    if (!roomPath) {
      console.error(`Error: Could not find room directory for: ${currentRoom}`);
      console.log('Searched in: /app/workspace/repo');
      process.exit(1);
    }

    console.log(`✅ Found room at: ${roomPath}`);
  }

  // Validate that the room path exists
  if (!fs.existsSync(roomPath)) {
    console.error(`Error: Room directory does not exist: ${roomPath}`);
    process.exit(1);
  }

  if (!fs.statSync(roomPath).isDirectory()) {
    console.error(`Error: Room path is not a directory: ${roomPath}`);
    process.exit(1);
  }

  // Extract room ID from the path
  const roomId = path.basename(roomPath);

  // Get the page ID from canvas metadata
  const pageId = getPageIdFromMetadata(roomPath);
  
  const rectangles = collectRoomWidgetRectangles(roomPath);
  const shapeId = generateShapeId(templateHandle);
  // Calculate the next index for this widget
  const nextIndex = getNextWidgetIndex(roomPath);
  const defaultSize = defaultSizeForTemplate(templateHandle);
  
  const widgetId = `${templateHandle}_${Date.now()}`;
  const dirName = `widget-${shapeId.replace('shape:', '')}`;
  
  // Create widget directory in the specified room directory
  const dirPath = path.join(roomPath, dirName);

  console.log(`Creating widget directory: ${dirName}`);
  console.log(`Room Path: ${roomPath}`);
  console.log(`Room ID: ${roomId}`);
  console.log(`Page ID: ${pageId}`);
  console.log(`Shape ID: ${shapeId}`);
  console.log(`Widget Index: ${nextIndex}`);
  console.log(`Template Handle: ${templateHandle}`);

  // Create directory
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true });
  } else {
    console.warn(`Directory ${dirName} already exists, files will be overwritten`);
  }

  // If a library template with this handle exists, copy its sources
  const libRoot = path.join('/app/workspace/repo', 'agent_scripts', 'templates');
  const libWidgetPath = path.join(libRoot, templateHandle);
  let usedLibrary = false;
  if (fs.existsSync(libWidgetPath) && fs.statSync(libWidgetPath).isDirectory()) {
    console.log(`📚 Using library template: ${templateHandle}`);
    // copy everything except compiled html and library properties.json
    const copyDir = (src, dest) => {
      const entries = fs.readdirSync(src, { withFileTypes: true });
      for (const e of entries) {
        const s = path.join(src, e.name);
        const d = path.join(dest, e.name);
        if (e.isDirectory()) {
          if (!fs.existsSync(d)) fs.mkdirSync(d, { recursive: true });
          copyDir(s, d);
        } else if (e.isFile()) {
          if (e.name === 'template.html' || e.name === 'properties.json') continue;
          fs.copyFileSync(s, d);
        }
      }
    };
    copyDir(libWidgetPath, dirPath);
    usedLibrary = true;
  } else {
    console.log(`🧩 No library template found for '${templateHandle}'. Creating a minimal skeleton.`);
    // Minimal template skeleton (explicit imports)
    const skeleton = `import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';

function ${toComponentName(templateHandle)}() {
  const [tailwindLoaded, setTailwindLoaded] = useState(false);
  const [state, setState] = useState(null);

  useEffect(() => {
    // Load Tailwind CSS
    if (!document.getElementById('tailwind-script')) {
      const tailwindScript = document.createElement('script');
      tailwindScript.id = 'tailwind-script';
      tailwindScript.src = 'https://cdn.tailwindcss.com';
      tailwindScript.onload = () => {
        // Give Tailwind a moment to process the DOM
        setTimeout(() => setTailwindLoaded(true), 100);
      };
      document.head.appendChild(tailwindScript);
    } else {
      setTailwindLoaded(true);
    }
  }, []);

  // ⚠️ IMPORTANT: For ANY background (including white) on scrollable widgets,
  // Tailwind's min-h-screen only covers the initial viewport. Scrolling reveals
  // the iframe's default background. Apply backgrounds to document.body instead:
  // useEffect(() => {
  //   document.body.style.background = '#ffffff'; // or any color/gradient
  //   document.documentElement.style.minHeight = '100%';
  //   return () => { document.body.style.background = ''; document.documentElement.style.minHeight = ''; };
  // }, []);

  // ⚠️ FORM ELEMENTS: For dropdown/select functionality, always build custom
  // dropdown components rather than native <select> elements. Native selects
  // render differently across Safari, Chrome, and Firefox. Use buttons/divs
  // with state management and click-outside handling for full styling control.

  if (!tailwindLoaded) {
    return <div style={{ padding: '20px', textAlign: 'center' }}>Loading...</div>;
  }

  return (
    <div className="p-4">
      <h3 className="text-lg font-bold mb-2">${templateHandle}</h3>
      <div className="text-sm text-gray-600">
        Replace this with your widget UI. Make sure you are modular and keep the code DRY. 
        You can add additional components inside the widget directory.
      </div>
    </div>
  );
}

export default ${toComponentName(templateHandle)};
`;
    fs.writeFileSync(path.join(dirPath, 'template.jsx'), skeleton);
  }

  // Create storage.json with widget config
  const widgetConfig = {
    roomId: roomId,
    pageId: pageId, 
    shapeId: shapeId,
    templateHandle: templateHandle
  };
  
  const storageJson = {
    "__widget_config": JSON.stringify(widgetConfig)
  };

  // Create properties.json
  const canvasMode = getCanvasMode(roomPath);
  const placement = computePlacement(rectangles, defaultSize, { mode: canvasMode });

  const propertiesJson = {
    shapeId: shapeId,
    widgetId: widgetId,
    templateHandle: templateHandle,
    position: {
        x: placement.position.x,
        y: placement.position.y
    },
    size: {
      w: placement.size.w,
      h: placement.size.h
    },
    rotation: 0,
    opacity: 1,
    isLocked: false,
    color: "black",
    zoomScale: 1,
    savedJsxContentHash: "initial",
    meta: {
      initializationState: "ready"
    },
    parentId: pageId,
    index: nextIndex,
    lastChangedClock: 1676
  };

  // Write files
  try {
    // storage.json: carry widget config (optional for debugging)
    fs.writeFileSync(path.join(dirPath, 'storage.json'), JSON.stringify(storageJson, null, 2));
    fs.writeFileSync(path.join(dirPath, 'properties.json'), JSON.stringify(propertiesJson, null, 2));

    console.log('\n✅ Widget files created successfully:');
    console.log(`📁 Directory: ${dirPath}`);
    console.log(`📄 template.jsx - React component ${usedLibrary ? '(from library)' : '(skeleton)'} `);
    console.log(`📄 storage.json - Widget storage configuration`);
    console.log(`📄 properties.json - Widget properties and metadata`);
    console.log(`\n🎯 Next steps:`);
    console.log(`1. Edit template.jsx to implement your widget logic.`);
    console.log(`2. Commit changes. Hooks will bundle and update canvas-state automatically.`);
    console.log(`3. Shape ID: ${shapeId}`);

  } catch (error) {
    console.error('Error creating files:', error);
    process.exit(1);
  }
}

function toComponentName(handle) {
  try {
    const base = String(handle || 'Widget')
      .replace(/[^a-zA-Z0-9]+/g, ' ')
      .trim()
      .split(/\s+/)
      .map(s => s.charAt(0).toUpperCase() + s.slice(1))
      .join('');
    return /[A-Za-z]/.test(base.charAt(0)) ? base : `W${base}`;
  } catch {
    return 'Widget';
  }
}

// Parse command line arguments
const args = process.argv.slice(2);
const templateHandle = args[0];
const roomPath = args[1]; // Optional

// Run the generator
generateWidget(templateHandle, roomPath);