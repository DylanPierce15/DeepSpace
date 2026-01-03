#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

/**
 * Fetch image from main API and save to .chat-attachments for agent vision
 * @param {string} assetId - The asset ID (e.g., GM2wo-KippGsBKzYPvYv3)
 */
async function inspectImage(assetId) {
  if (!assetId) {
    console.error('❌ Error: Asset ID is required');
    console.log('Usage: node inspect-image.js <asset_id>');
    console.log('Example: node inspect-image.js GM2wo-KippGsBKzYPvYv3');
    process.exit(1);
  }

  // Get current room and userId from container vars
  let roomPath;
  let currentRoom;
  let userId;
  try {
    const containerVars = JSON.parse(fs.readFileSync('/app/container_vars.json', 'utf8'));
    currentRoom = containerVars.currentRoom;
    userId = containerVars.userId;
    if (!currentRoom) {
      console.error('❌ Error: No current room set in container vars');
      process.exit(1);
    }
    if (!userId) {
      console.error('❌ Error: No userId set in container vars');
      process.exit(1);
    }
    roomPath = findRoomPath(currentRoom);
    if (!roomPath) {
      console.error(`❌ Error: Could not find room directory for: ${currentRoom}`);
      process.exit(1);
    }
  } catch (err) {
    console.error('❌ Error reading container vars:', err.message);
    process.exit(1);
  }

  // Find the asset JSON file to get the upload URL
  const assetJsonPath = findAssetJson(roomPath, assetId);
  if (!assetJsonPath) {
    console.error(`❌ Error: Could not find general-asset-image-${assetId}.json in room`);
    console.log('Make sure the asset ID is correct and exists in the current room.');
    process.exit(1);
  }

  // Read asset metadata
  let assetMeta;
  try {
    assetMeta = JSON.parse(fs.readFileSync(assetJsonPath, 'utf8'));
  } catch (err) {
    console.error(`❌ Error reading asset JSON: ${err.message}`);
    process.exit(1);
  }

  const srcUrl = assetMeta.props?.src;
  if (!srcUrl) {
    console.error('❌ Error: Asset has no src URL');
    process.exit(1);
  }

  // Extract upload ID from URL (e.g., http://localhost:8787/api/uploads/bc16fbf9-...)
  const uploadIdMatch = srcUrl.match(/\/api\/uploads\/([a-f0-9-]+)/i);
  if (!uploadIdMatch) {
    console.error('❌ Error: Could not extract upload ID from src URL');
    console.log(`URL: ${srcUrl}`);
    process.exit(1);
  }
  const uploadId = uploadIdMatch[1];

  // Get canvas-sync URL and secret from environment
  const apiUrl = process.env.DOCKER_CANVAS_SYNC_URL;
  const internalSecret = process.env.INTERNAL_STORAGE_HMAC_SECRET;
  
  if (!internalSecret) {
    console.error('❌ Error: INTERNAL_STORAGE_HMAC_SECRET not set');
    process.exit(1);
  }

  console.log(`🔍 Fetching image: ${assetId}`);
  console.log(`📍 Upload ID: ${uploadId}`);
  console.log(`🏠 Room ID: ${currentRoom}`);

  try {
    // Fetch image from main API (with authorization)
    const response = await fetchImage(apiUrl, uploadId, userId, currentRoom);
    
    if (!response.success) {
      console.error(`❌ Error fetching image: ${response.error}`);
      process.exit(1);
    }

    // Determine file extension from content type
    const ext = getExtensionFromMime(response.contentType);
    
    // Save to .canvas-images
    const imagesDir = path.join(roomPath, '.canvas-images');
    fs.mkdirSync(imagesDir, { recursive: true });
    
    const filename = `${assetId}${ext}`;
    const filepath = path.join(imagesDir, filename);
    
    // Decode base64 and save
    const buffer = Buffer.from(response.base64, 'base64');
    fs.writeFileSync(filepath, buffer);

    console.log(`✅ Image saved to: ${filepath}`);
    console.log(`📐 Size: ${(buffer.length / 1024).toFixed(1)} KB`);
    console.log(`📄 Type: ${response.contentType}`);
    console.log('');
    console.log(`💡 To view the image contents, use: Read ${filepath}`);

  } catch (err) {
    console.error(`❌ Error: ${err.message}`);
    process.exit(1);
  }
}

function findRoomPath(roomName) {
  const { execSync } = require('child_process');
  try {
    const result = execSync(`find /app/workspace/repo -type d -name "${roomName}" 2>/dev/null`, { encoding: 'utf8' }).trim();
    return result ? result.split('\n')[0] : null;
  } catch {
    return null;
  }
}

function findAssetJson(roomPath, assetId) {
  const filename = `general-asset-image-${assetId}.json`;
  const directPath = path.join(roomPath, filename);
  if (fs.existsSync(directPath)) {
    return directPath;
  }
  
  // Search recursively
  const { execSync } = require('child_process');
  try {
    const result = execSync(`find "${roomPath}" -name "${filename}" 2>/dev/null`, { encoding: 'utf8' }).trim();
    return result ? result.split('\n')[0] : null;
  } catch {
    return null;
  }
}

async function fetchImage(apiUrl, uploadId, userId, roomId) {
  const { signInternalRequestBody } = require('/app/src/internal-auth');
  const url = `${apiUrl}/api/agent/fetch-image`;
  const body = { uploadId, userId, roomId };
  const { payload, headers } = await signInternalRequestBody(body);

  console.log(`📡 Request: ${url}`);
  console.log(`📡 User ID: ${userId || 'NOT SET'}`);
  console.log(`📡 Room ID: ${roomId || 'NOT SET'}`);

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-internal-worker': 'agentapi',
      ...headers,
    },
    body: payload,
  });

  const data = await response.text();
  console.log(`📡 Response status: ${response.status}`);

  try {
    const json = JSON.parse(data);
    if (!response.ok) {
      console.log(`📡 Error response: ${JSON.stringify(json)}`);
      return { success: false, error: json.error || `HTTP ${response.status}` };
    }
    return {
      success: true,
      base64: json.base64,
      contentType: json.contentType,
    };
  } catch (e) {
    console.log(`📡 Parse error. Raw response (first 200 chars): ${data.substring(0, 200)}`);
    return { success: false, error: `Invalid response: ${e.message}` };
  }
}

function getExtensionFromMime(mimeType) {
  const map = {
    'image/png': '.png',
    'image/jpeg': '.jpg',
    'image/gif': '.gif',
    'image/webp': '.webp',
    'image/svg+xml': '.svg',
    'image/bmp': '.bmp',
  };
  return map[mimeType] || '.bin';
}

// Run
const args = process.argv.slice(2);
inspectImage(args[0]);
