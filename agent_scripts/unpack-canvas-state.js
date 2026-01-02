#!/usr/bin/env node

/**
 * Unpack Canvas State Script - Room-Centric Architecture
 * 
 * Processes all canvas-state.json files in the repository recursively.
 * Each room (root or subcanvas) is processed identically and generates:
 * - Widget directories (widget-{shapeId}/) with properties.json, template.jsx, template.html, storage.json
 * - Canvas metadata files (canvas-metadata.json) 
 * - Global storage files (global-storage.json)
 * - Canvas-link files (canvas-link-{shapeId}.json) in parent room directories
 * 
 * Usage: node unpack-canvas-state.js
 */

const fs = require('fs');
const path = require('path');

class CanvasStateUnpacker {
  constructor(rootDir = process.cwd()) {
    this.rootDir = rootDir;
    this.processedRooms = new Set();
    this.targetRoom = this.getTargetRoomFromContainerVars();
  }

  /**
   * Get target room from env var or container_vars.json
   */
  getTargetRoomFromContainerVars() {
    // Check env var first
    if (process.env.MIYAGI_ROOM) {
      return process.env.MIYAGI_ROOM;
    }
    // Fall back to container vars
    const containerVarsPath = '/app/container_vars.json';
    if (fs.existsSync(containerVarsPath)) {
      try {
        const containerVars = JSON.parse(fs.readFileSync(containerVarsPath, 'utf8'));
        return containerVars.currentRoom || null;
      } catch (e) {
        return null;
      }
    }
    return null;
  }

  /**
   * Main entry point
   */
  async run() {
    console.log('🚀 Starting canvas state unpacking...');
    
    if (this.targetRoom) {
      console.log(`🎯 Container vars found - will only unpack room: ${this.targetRoom}`);
    }
    
    try {
      const rootRoomName = await this.identifyRootRoom();
      const rootRoomPath = path.join(this.rootDir, rootRoomName);
      
      console.log(`🌐 Starting directory traversal from root: ${rootRoomName}`);
      await this.processRoomRecursively(rootRoomPath);
      console.log(`✅ Directory traversal completed. Processed ${this.processedRooms.size} rooms.`);

    } catch (error) {
      console.error('❌ Canvas state unpacking failed:', error);
      process.exit(1);
    }
  }

   // Identify the root room directory. Ensures there is exactly one root room in the repository
  async identifyRootRoom() {
    const entries = fs.readdirSync(this.rootDir, { withFileTypes: true });
    const rootRoomDirs = entries
      .filter(entry => entry.isDirectory() && entry.name.startsWith('room-'))
      .map(entry => entry.name);

    if (rootRoomDirs.length === 0) {
      throw new Error('❌ No root room directory found! Expected exactly one room-* directory in repository root.');
    }

    if (rootRoomDirs.length > 1) {
      throw new Error(`❌ Multiple root room directories found: ${rootRoomDirs.join(', ')}. Expected exactly one room-* directory in repository root.`);
    }

    const rootRoomName = rootRoomDirs[0];
    return rootRoomName;
  }

  /**
   * Process a room and all its subrooms recursively
   */
  async processRoomRecursively(roomPath) {
    const roomName = path.basename(roomPath);
    
    // Skip if already processed
    if (this.processedRooms.has(roomName)) {
      return;
    }
    
    // If targeting a specific room, only process that one
    const shouldProcess = !this.targetRoom || roomName === this.targetRoom;
    
    if (shouldProcess) {
    console.log(`📍 Processing room: ${roomName} at ${roomPath}`);
    
    // Find canvas-state.json
    const canvasStateFile = this.findCanvasStateFileForRoom(roomPath);
    if (!canvasStateFile) {
      console.warn(`⚠️ No canvas-state.json found for room: ${roomName} at ${roomPath}`);
      return;
    }
    
    this.processedRooms.add(roomName);
    
    // Clean room directory before unpacking (delete all managed items)
    await this.cleanRoomDirectory(roomPath);
    
    // Unpack fresh from canvas-state.json
    await this.unpackRoom(canvasStateFile);
    }
    
    // Always traverse subrooms to find the target (if we have one and haven't found it yet)
    if (!this.targetRoom || !this.processedRooms.has(this.targetRoom)) {
    const entries = fs.readdirSync(roomPath, { withFileTypes: true });
    for (const entry of entries) {
      if (entry.isDirectory() && entry.name.startsWith('room-')) {
        const subroomPath = path.join(roomPath, entry.name);
        await this.processRoomRecursively(subroomPath);
        }
      }
    }
  }


  findCanvasStateFileForRoom(roomPath) {
    const canvasStatePath = path.join(roomPath, 'canvas-state.json');
    console.log(`  🔍 Looking for: ${canvasStatePath}`);
    if (fs.existsSync(canvasStatePath)) {
      return canvasStatePath;
    }
    
    return null;
  }

  /**
   * Process a single room's canvas-state.json file
   * Every room (root or subcanvas) is processed identically
   */
  async unpackRoom(canvasStateFilePath) {
    const roomDir = path.dirname(canvasStateFilePath);
    const roomName = path.basename(roomDir);
    
    console.log(`📄 Unpacking room: ${roomName} (${path.relative(this.rootDir, canvasStateFilePath)})`);

    try {
      // Read and parse this room's canvas state
      const canvasStateContent = fs.readFileSync(canvasStateFilePath, 'utf8');
      const canvasState = JSON.parse(canvasStateContent);

      // Collect metadata, canvas_storage, and buffer assets
      let documentData = null;
      const pages = [];
      let canvasStorageState = null;
      const referencedAssetIds = new Set();
      const bufferedAssets = [];

      // Single pass: process documents, buffer assets, collect assetId references from shapes
      for (const doc of canvasState.documents || []) {
        const result = await this.processDocument(doc, roomDir, referencedAssetIds, bufferedAssets);
        if (result) {
          if (result.type === 'document') documentData = result.data;
          else if (result.type === 'page') pages.push(result.data);
          else if (result.type === 'canvas_storage') canvasStorageState = result.data;
        }
      }

      // Now write only referenced assets
      for (const { state, lastChangedClock } of bufferedAssets) {
        if (referencedAssetIds.has(state.id)) {
          await this.writeAsset(state, lastChangedClock, roomDir);
        }
      }

      // Generate metadata files
      await this.generateCanvasMetadata(documentData, pages, canvasState, roomDir);
      await this.generateGlobalStorage(canvasStorageState, roomDir);
      
      // Process canvas_storage LAST - only writes storage.json for existing widget directories
      if (canvasStorageState) {
        await this.unpackCanvasStorage(canvasStorageState, roomDir);
      }

      console.log(`✅ Processed room: ${roomName}`);

    } catch (error) {
      console.error(`❌ Error unpacking room ${roomName} from ${canvasStateFilePath}:`, error);
      throw error;
    }
  }

  /**
   * Main document processor - dispatches based on typeName and writes files directly
   * Assets are buffered and assetId references are collected from shapes
   */
  async processDocument(document, roomDir, referencedAssetIds, bufferedAssets) {
    const { state, lastChangedClock } = document;
    
    switch (state.typeName) {
      case 'document':
        return { type: 'document', data: state };
      case 'page':
        return { type: 'page', data: { ...state, lastChangedClock } };
      case 'canvas_storage':
        return { type: 'canvas_storage', data: state };
      case 'shape':
        // Collect assetId reference if shape has one
        if (state.props?.assetId) {
          referencedAssetIds.add(state.props.assetId);
        }
        await this.unpackShape(state, lastChangedClock, roomDir);
        return null;
      case 'asset':
        // Buffer asset for later - will only write if referenced
        bufferedAssets.push({ state, lastChangedClock });
        return null;
      default:
        return null;
    }
  }

  /**
   * Unpack canvas_storage - writes storage.json files ONLY for existing widget directories
   * Called after all shapes are processed to avoid creating directories for deleted widgets
   */
  async unpackCanvasStorage(state, roomDir) {
    const widgetStorage = state.widgets || {};
    for (const [shapeId, storage] of Object.entries(widgetStorage)) {
      const widgetDirName = `widget-${shapeId.replace('shape:', '')}`;
      const widgetDir = path.join(roomDir, widgetDirName);
      
      // Only write storage.json if widget directory exists (widget shape was processed)
      if (fs.existsSync(widgetDir)) {
        const storagePath = path.join(widgetDir, 'storage.json');
        fs.writeFileSync(storagePath, JSON.stringify(storage, null, 2), 'utf8');
      }
      // Silently skip if widget directory doesn't exist (widget was deleted, storage is stale)
    }
  }

  /**
   * Unpack shape - dispatches based on shape type and writes files directly
   */
  async unpackShape(state, lastChangedClock, roomDir) {
    switch (state.type) {
      case 'miyagi-widget':
        await this.unpackMiyagiWidget(state, lastChangedClock, roomDir);
        break;
      case 'canvas-link':
        await this.unpackCanvasLink(state, lastChangedClock, roomDir);
        break;
      default:
        await this.unpackGeneralShape(state, lastChangedClock, roomDir);
    }
  }

  /**
   * Unpack miyagi-widget - creates widget directory with all files
   */
  async unpackMiyagiWidget(state, lastChangedClock, roomDir) {
    const shapeId = state.id;
    const shapeIdClean = shapeId.replace('shape:', '');
    const widgetDir = path.join(roomDir, `widget-${shapeIdClean}`);

    if (!fs.existsSync(widgetDir)) {
      fs.mkdirSync(widgetDir, { recursive: true });
    }

    // Write properties.json
    const properties = {
      shapeId,
      widgetId: state.props?.widgetId,
      templateHandle: state.props?.templateHandle,
      templateName: state.props?.templateName,
      icon: state.props?.icon,
      position: { x: state.x, y: state.y },
      size: { w: state.props?.w, h: state.props?.h },
      rotation: state.rotation,
      opacity: state.opacity,
      isLocked: state.isLocked,
      color: state.props?.color,
      zoomScale: state.props?.zoomScale,
      isFullscreen: state.props?.isFullscreen,
      savedJsxContentHash: state.props?.savedJsxContentHash,
      meta: state.meta,
      parentId: state.parentId,
      index: state.index,
      lastChangedClock
    };
    fs.writeFileSync(path.join(widgetDir, 'properties.json'), JSON.stringify(properties, null, 2), 'utf8');

    // Write template files
    fs.writeFileSync(path.join(widgetDir, 'template.jsx'), state.props?.jsxContent || '', 'utf8');
    fs.writeFileSync(path.join(widgetDir, 'template.html'), state.props?.htmlContent || '', 'utf8');

    // Write source files if present
    if (state.props?.sources && typeof state.props.sources === 'object') {
      for (const [relPath, code] of Object.entries(state.props.sources)) {
        const safeRel = relPath.replace(/^\/+/, '').replace(/\\/g, '/');
        const outPath = path.join(widgetDir, safeRel);
        const outDir = path.dirname(outPath);
        if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });
        fs.writeFileSync(outPath, String(code), 'utf8');
      }
    }

    console.log(`    🧩 Generated: ${path.relative(this.rootDir, widgetDir)}/`);
  }

  /**
   * Unpack canvas-link - writes canvas-link-{id}.json in parent directory
   */
  async unpackCanvasLink(state, lastChangedClock, roomDir) {
    const targetCanvasId = state.props?.targetCanvasId;
    if (!targetCanvasId) {
      console.warn(`⚠️ Canvas-link ${state.id} has no targetCanvasId`);
      return;
    }

    const targetRoomDir = path.join(roomDir, targetCanvasId);
    if (!fs.existsSync(targetRoomDir)) {
      console.warn(`⚠️ Target room not found: ${targetCanvasId}`);
      return;
    }

    const shapeId = state.id.replace('shape:', '');
    const canvasLinkPath = path.join(roomDir, `canvas-link-${shapeId}.json`);

    const canvasLinkData = {
      shapeId: state.id,
      targetCanvasId,
      label: state.props?.label || 'Canvas Link',
      linkType: state.props?.linkType || 'realfile',
      position: { x: state.x, y: state.y },
      size: { w: state.props?.w || 400, h: state.props?.h || 400 },
      rotation: state.rotation,
      opacity: state.opacity,
      isLocked: state.isLocked,
      meta: state.meta,
      parentId: state.parentId,
      index: state.index,
      lastChangedClock,
      generatedAt: new Date().toISOString()
    };

    fs.writeFileSync(canvasLinkPath, JSON.stringify(canvasLinkData, null, 2), 'utf8');
    console.log(`    🔗 Generated: ${path.relative(this.rootDir, canvasLinkPath)}`);
  }

  /**
   * Unpack general shape - writes general-shape-{type}-{id}.json
   */
  async unpackGeneralShape(state, lastChangedClock, roomDir) {
    const objectIdClean = state.id.replace('shape:', '');
    const objectFileName = `general-shape-${state.type}-${objectIdClean}.json`;
    const objectFilePath = path.join(roomDir, objectFileName);

    const objectData = {
      ...state,
      generatedAt: new Date().toISOString()
    };

    fs.writeFileSync(objectFilePath, JSON.stringify(objectData, null, 2), 'utf8');
    console.log(`    🔷 Generated: ${path.relative(this.rootDir, objectFilePath)}`);
  }

  /**
   * Write asset - writes general-asset-{type}-{id}.json (only called for referenced assets)
   */
  async writeAsset(state, lastChangedClock, roomDir) {
    const objectIdClean = state.id.replace('asset:', '');
    const objectFileName = `general-asset-${state.type}-${objectIdClean}.json`;
    const objectFilePath = path.join(roomDir, objectFileName);

    const objectData = {
      ...state,
      generatedAt: new Date().toISOString()
    };

    fs.writeFileSync(objectFilePath, JSON.stringify(objectData, null, 2), 'utf8');
    console.log(`    📎 Generated: ${path.relative(this.rootDir, objectFilePath)}`);
  }


  /**
   * Generate canvas-metadata.json
   */
  async generateCanvasMetadata(documentData, pages, canvasState, canvasDir) {
    const metadata = {
      document: documentData,
      pages: pages,
      schema: canvasState.schema,
      generatedAt: new Date().toISOString(),
      clock: canvasState.clock,
      documentClock: canvasState.documentClock,
      tombstones: canvasState.tombstones || {},
      tombstoneHistoryStartsAtClock: canvasState.tombstoneHistoryStartsAtClock || 1
    };

    const metadataPath = path.join(canvasDir, 'canvas-metadata.json');
    fs.writeFileSync(metadataPath, JSON.stringify(metadata, null, 2), 'utf8');
    console.log(`  📋 Generated: ${path.relative(this.rootDir, metadataPath)}`);
  }

  /**
   * Generate global-storage.json for this room
   * Also unpacks files/* keys into files/ folder as actual files
   */
  async generateGlobalStorage(canvasStorageData, canvasDir) {
    const globalStorage = canvasStorageData?.global || {};
    
    // Write the original global-storage.json (for backwards compatibility)
    const globalStoragePath = path.join(canvasDir, 'global-storage.json');
    fs.writeFileSync(globalStoragePath, JSON.stringify(globalStorage, null, 2), 'utf8');
    console.log(`  🌐 Generated: ${path.relative(this.rootDir, globalStoragePath)}`);
    
    // Unpack files/* keys into files/ folder as actual files
    await this.unpackFilesToFilesystem(globalStorage, canvasDir);
  }

  /**
   * Unpack files/* keys from global storage into actual files under files/
   * This makes it easy to edit files directly in the filesystem
   * 
   * Strategy:
   * - Keys starting with "files/" are unpacked as actual files
   * - The key path after "files/" becomes the file path
   * - Content is written directly (string as-is, objects as JSON)
   */
  async unpackFilesToFilesystem(globalStorage, canvasDir) {
    const FILES_PREFIX = 'files/';
    const filesDir = path.join(canvasDir, 'files');
    
    // Note: files/ directory is cleaned in cleanRoomDirectory()
    
    let unpackedCount = 0;
    
    for (const [key, rawValue] of Object.entries(globalStorage)) {
      // Skip non-files keys
      if (!key.startsWith(FILES_PREFIX)) {
        continue;
      }
      
      // Determine content to write:
      // Values in global storage are JSON-stringified, so we parse them first
      // - If parsed result is a string (text files like .md, .html, .csv) -> write directly
      // - If parsed result is an object (config.json, meta.json) -> format as JSON
      let content;
      if (typeof rawValue === 'string') {
        try {
          const parsed = JSON.parse(rawValue);
          if (typeof parsed === 'string') {
            // Text file content - write directly
            content = parsed;
          } else {
            // Object/array - format as pretty JSON
            content = JSON.stringify(parsed, null, 2);
          }
        } catch (e) {
          // Not valid JSON - write raw string
          content = rawValue;
        }
      } else {
        // Already an object - stringify it
        content = JSON.stringify(rawValue, null, 2);
      }
      
      // Get the file path (remove 'files/' prefix)
      const filePath = key.slice(FILES_PREFIX.length);
      const fullPath = path.join(filesDir, filePath);
      
      // Ensure parent directory exists (needed for nested paths like notes/projects/note.md)
      fs.mkdirSync(path.dirname(fullPath), { recursive: true });
      
      fs.writeFileSync(fullPath, content, 'utf8');
      unpackedCount++;
    }
    
    // Always log for debugging (even if 0 files unpacked)
    console.log(`  📄 Unpacked ${unpackedCount} files to: ${path.relative(this.rootDir, filesDir)}/`);
  }

  /**
   * Sanitize a string for use as a filename
   */
  sanitizeFileName(name) {
    return name.replace(/[<>:"/\\|?*]/g, '_').replace(/\s+/g, '_');
  }


  async cleanRoomDirectory(roomPath) {
    const entries = fs.readdirSync(roomPath, { withFileTypes: true });
    
    for (const entry of entries) {
      const fullPath = path.join(roomPath, entry.name);
      
      if (entry.isDirectory()) {
        if (entry.name.startsWith('widget-') || entry.name === 'files') {
          fs.rmSync(fullPath, { recursive: true, force: true });
        }
      } else if (entry.isFile()) {
        if ((entry.name.startsWith('general-shape-') || 
             entry.name.startsWith('general-asset-') || 
             entry.name.startsWith('canvas-link-')) && 
            entry.name.endsWith('.json')) {
          fs.rmSync(fullPath, { force: true });
        }
      }
    }
  }
}

// Auto-execute when run directly
if (require.main === module) {
  const unpacker = new CanvasStateUnpacker();
  unpacker.run().catch(error => {
    console.error('❌ Unpack failed:', error);
    process.exit(1);
  });
}

module.exports = CanvasStateUnpacker;
