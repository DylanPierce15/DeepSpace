// Standalone widget positioning module for agent use in Docker.
// Originally extracted from apps/web/components/canvas/services/widgetPositioning.ts
// Maintained manually as a stable dependency for agent scripts.

const fs = require('fs');
const path = require('path');

const DEFAULT_PADDING = 20;
const DEFAULT_CANVAS_MARGIN = 50;
const DEFAULT_SPIRAL_STEP = 50;
const DEFAULT_MAX_SPIRAL_RADIUS = 2000;
const DEFAULT_MAX_SPIRAL_ATTEMPTS = 10000;
const EMPTY_ROOM_ANCHOR_POSITION = { x: 1200, y: 400 };

// 4 fallback positions: one in each corner of the canvas
const FALLBACK_POSITIONS = [
  { x: 2000, y: 200 },   // Top-right
  { x: -500, y: 200 },   // Top-left
  { x: 2000, y: 2000 },  // Bottom-right
  { x: -500, y: 2000 },  // Bottom-left
];

/**
 * Finds the next available position for a widget, avoiding collisions with existing widgets.
 * Uses multiple strategies: preferred position, spiral search, infinite canvas areas, smart gaps, and emergency fallbacks.
 * @param {Array<{x: number, y: number, w: number, h: number}>} existingWidgets - Array of existing widget rectangles
 * @param {{w: number, h: number}} widgetSize - Size of the widget to place
 * @param {Object} options - Positioning options
 * @param {number} [options.padding] - Padding between widgets (default: 20)
 * @param {number} [options.canvasMargin] - Minimum margin from canvas edge (default: 50)
 * @param {{x: number, y: number}} [options.preferredPosition] - Preferred position for the widget
 * @returns {{x: number, y: number, w: number, h: number, wasAdjusted: boolean, adjustmentReason?: string}}
 */
function findNextWidgetPosition(existingWidgets, widgetSize, options = {}) {
  const padding = options.padding ?? DEFAULT_PADDING;
  const canvasMargin = options.canvasMargin ?? DEFAULT_CANVAS_MARGIN;
  const spiralStep = options.spiralStep ?? DEFAULT_SPIRAL_STEP;
  const maxSpiralRadius = options.maxSpiralRadius ?? DEFAULT_MAX_SPIRAL_RADIUS;
  const maxSpiralAttempts = options.maxSpiralAttempts ?? DEFAULT_MAX_SPIRAL_ATTEMPTS;
  const infiniteCanvasAreas = options.infiniteCanvasAreas ?? FALLBACK_POSITIONS;
  
  const startPosition = getStartingPosition(options.preferredPosition, canvasMargin);
  if (isPositionAvailable(existingWidgets, startPosition, widgetSize, padding)) {
    return { ...startPosition, ...widgetSize, wasAdjusted: false };
  }
  
  const spiralPosition = findPositionWithSpiralSearch({
    existingWidgets,
    startPosition,
    widgetSize,
    padding,
    step: spiralStep,
    maxRadius: maxSpiralRadius,
    maxAttempts: maxSpiralAttempts,
  });
  if (spiralPosition) {
    return { ...spiralPosition, ...widgetSize, wasAdjusted: true, adjustmentReason: "Moved to avoid collision with existing widgets" };
  }
  
  for (const area of infiniteCanvasAreas) {
    const candidate = ensureMargin(area, canvasMargin);
    if (isPositionAvailable(existingWidgets, candidate, widgetSize, padding)) {
      return { ...candidate, ...widgetSize, wasAdjusted: true, adjustmentReason: "Placed in open area of infinite canvas" };
    }
  }
  
  const smartGapPosition = findSmartGapPosition(existingWidgets, widgetSize, padding);
  if (smartGapPosition) {
    return { ...smartGapPosition, ...widgetSize, wasAdjusted: true, adjustmentReason: "Found optimal gap between existing widgets" };
  }
  
  const emergencyPosition = getEmergencyPosition(existingWidgets, widgetSize, padding);
  return { ...emergencyPosition, ...widgetSize, wasAdjusted: true, adjustmentReason: "Used emergency positioning due to high canvas density" };
}
/**
 * Gets the starting position for widget placement.
 * @param {{x: number, y: number}|null} preferredPosition - User's preferred position, or null for default
 * @param {number} canvasMargin - Minimum margin from canvas edge
 * @returns {{x: number, y: number}} Starting position
 */
function getStartingPosition(preferredPosition, canvasMargin) {
  if (preferredPosition) {
    return preferredPosition;
  }
  return {
    x: Math.max(canvasMargin, EMPTY_ROOM_ANCHOR_POSITION.x),
    y: Math.max(canvasMargin, EMPTY_ROOM_ANCHOR_POSITION.y),
  };
}
/**
 * Ensures a position respects the minimum canvas margin.
 * @param {{x: number, y: number}} position - Position to adjust
 * @param {number} canvasMargin - Minimum margin from canvas edge
 * @returns {{x: number, y: number}} Position with at least canvasMargin distance from origin
 */
function ensureMargin(position, canvasMargin) {
  return {
    x: Math.max(canvasMargin, position.x),
    y: Math.max(canvasMargin, position.y)
  };
}
/**
 * Checks if a position is available (no collisions with existing widgets).
 * @param {Array<{x: number, y: number, w: number, h: number}>} existingWidgets - Array of existing widgets
 * @param {{x: number, y: number}} position - Position to check
 * @param {{w: number, h: number}} widgetSize - Size of the widget
 * @param {number} padding - Padding between widgets
 * @returns {boolean} True if position is available, false if there's a collision
 */
function isPositionAvailable(existingWidgets, position, widgetSize, padding) {
  const candidateBounds = expandBounds({ ...position, ...widgetSize }, padding);
  return existingWidgets.every((widget) => {
    const widgetBounds = expandBounds(widget, padding);
    return !boundsOverlap(candidateBounds, widgetBounds);
  });
}
/**
 * Expands widget bounds by adding padding on all sides.
 * @param {{x: number, y: number, w: number, h: number}} widget - Widget rectangle
 * @param {number} padding - Padding to add
 * @returns {{left: number, right: number, top: number, bottom: number}} Expanded bounds
 */
function expandBounds(widget, padding) {
  return {
    left: widget.x - padding,
    right: widget.x + widget.w + padding,
    top: widget.y - padding,
    bottom: widget.y + widget.h + padding
  };
}

/**
 * Checks if two rectangular bounds overlap.
 * @param {{left: number, right: number, top: number, bottom: number}} a - First bounds
 * @param {{left: number, right: number, top: number, bottom: number}} b - Second bounds
 * @returns {boolean} True if bounds overlap, false otherwise
 */
function boundsOverlap(a, b) {
  return !(a.right <= b.left || a.left >= b.right || a.bottom <= b.top || a.top >= b.bottom);
}
/**
 * Searches for an available position using a spiral pattern starting from a given position.
 * @param {Object} params - Spiral search parameters
 * @param {Array<{x: number, y: number, w: number, h: number}>} params.existingWidgets - Existing widgets to avoid
 * @param {{x: number, y: number}} params.startPosition - Starting position for the spiral
 * @param {{w: number, h: number}} params.widgetSize - Size of the widget to place
 * @param {number} params.padding - Padding between widgets
 * @param {number} params.step - Step size for spiral movement
 * @param {number} params.maxRadius - Maximum radius to search
 * @param {number} params.maxAttempts - Maximum number of positions to try
 * @returns {{x: number, y: number}|null} Available position, or null if none found
 */
function findPositionWithSpiralSearch(params) {
  const { existingWidgets, startPosition, widgetSize, padding, step, maxRadius, maxAttempts } = params;
  let attempts = 0;
  let currentX = startPosition.x;
  let currentY = startPosition.y;
  let direction = 0;
  let legLength = 1;
  let stepsTakenInLeg = 0;
  let legsCompleted = 0;
  while (attempts < maxAttempts) {
    switch (direction) {
      case 0:
        currentX += step;
        break;
      case 1:
        currentY += step;
        break;
      case 2:
        currentX -= step;
        break;
      default:
        currentY -= step;
        break;
    }
    attempts += 1;
    
    const distanceFromStart = Math.max(Math.abs(currentX - startPosition.x), Math.abs(currentY - startPosition.y));
    if (distanceFromStart > maxRadius) {
      break;
    }
    if (isPositionAvailable(existingWidgets, { x: currentX, y: currentY }, widgetSize, padding)) {
      return { x: currentX, y: currentY };
    }
    stepsTakenInLeg += 1;
    if (stepsTakenInLeg >= legLength) {
      direction = (direction + 1) % 4;
      stepsTakenInLeg = 0;
      legsCompleted += 1;
      if (legsCompleted % 2 === 0) {
        legLength += 1;
      }
    }
  }
  return null;
}
/**
 * Finds an optimal gap position between existing widgets.
 * @param {Array<{x: number, y: number, w: number, h: number}>} existingWidgets - Existing widgets
 * @param {{w: number, h: number}} widgetSize - Size of the widget to place
 * @param {number} padding - Padding between widgets
 * @returns {{x: number, y: number}|null} Available gap position, or null if none found
 */
function findSmartGapPosition(existingWidgets, widgetSize, padding) {
  if (existingWidgets.length === 0) {
    return { ...EMPTY_ROOM_ANCHOR_POSITION };
  }
  const minX = Math.min(...existingWidgets.map((w) => w.x));
  const maxX = Math.max(...existingWidgets.map((w) => w.x + w.w));
  const minY = Math.min(...existingWidgets.map((w) => w.y));
  const maxY = Math.max(...existingWidgets.map((w) => w.y + w.h));
  const candidates = [
    { x: maxX + padding, y: minY },
    { x: maxX + padding, y: (minY + maxY) / 2 - widgetSize.h / 2 },
    { x: maxX + padding, y: maxY - widgetSize.h },
    { x: minX - widgetSize.w - padding, y: minY },
    { x: minX - widgetSize.w - padding, y: (minY + maxY) / 2 - widgetSize.h / 2 },
    { x: minX - widgetSize.w - padding, y: maxY - widgetSize.h },
    { x: minX, y: maxY + padding },
    { x: (minX + maxX) / 2 - widgetSize.w / 2, y: maxY + padding },
    { x: maxX - widgetSize.w, y: maxY + padding },
    { x: minX, y: minY - widgetSize.h - padding },
    { x: (minX + maxX) / 2 - widgetSize.w / 2, y: minY - widgetSize.h - padding },
    { x: maxX - widgetSize.w, y: minY - widgetSize.h - padding }
  ];
  for (const candidate of candidates) {
    if (isPositionAvailable(existingWidgets, candidate, widgetSize, padding)) {
      return candidate;
    }
  }
  return null;
}
/**
 * Gets an emergency fallback position when all other strategies fail.
 * @param {Array<{x: number, y: number, w: number, h: number}>} existingWidgets - Existing widgets
 * @param {{w: number, h: number}} widgetSize - Size of the widget to place
 * @param {number} padding - Padding between widgets
 * @returns {{x: number, y: number}} Emergency fallback position
 */
function getEmergencyPosition(existingWidgets, widgetSize, padding) {
  for (const position of FALLBACK_POSITIONS) {
    if (isPositionAvailable(existingWidgets, position, widgetSize, padding)) {
      return { ...position };
    }
  }
  
  if (isPositionAvailable(existingWidgets, EMPTY_ROOM_ANCHOR_POSITION, widgetSize, padding)) {
    return { ...EMPTY_ROOM_ANCHOR_POSITION };
  }
  
  return {
    x: existingWidgets.length === 0 ? EMPTY_ROOM_ANCHOR_POSITION.x : existingWidgets[0].x + widgetSize.w + padding,
    y: existingWidgets.length === 0 ? EMPTY_ROOM_ANCHOR_POSITION.y : existingWidgets[0].y
  };
}

/**
 * Wrapper function for room-based widget positioning.
 * @param {Object} args - Positioning arguments
 * @param {Array<{x: number, y: number, w: number, h: number}>} args.existingWidgets - Existing widgets
 * @param {{w: number, h: number}} args.size - Widget size
 * @param {{x: number, y: number}} [args.preferredPosition] - Preferred position
 * @param {number} [args.padding] - Padding between widgets
 * @returns {{x: number, y: number, w: number, h: number, wasAdjusted: boolean, adjustmentReason?: string}}
 */
function findNextWidgetPositionForRoom(args) {
  return findNextWidgetPosition(args.existingWidgets, args.size, {
    preferredPosition: args.preferredPosition,
    padding: args.padding,
  });
}

/**
 * Collects all widget rectangles from a room directory.
 * Includes widgets, canvas-links, and file shapes from canvas-state.json.
 * @param {string} roomPath - Path to the room directory
 * @returns {Array<{x: number, y: number, w: number, h: number}>} Array of widget rectangles
 */
function collectRoomWidgetRectangles(roomPath) {
  const rectangles = [];

  try {
    const entries = fs.readdirSync(roomPath, { withFileTypes: true });
    
    // 1. Collect widgets (widget-*/properties.json)
    for (const entry of entries) {
      if (!entry.isDirectory() || !entry.name.startsWith('widget-')) {
        continue;
      }

      const propertiesPath = path.join(roomPath, entry.name, 'properties.json');
      if (!fs.existsSync(propertiesPath)) {
        continue;
      }

      try {
        const properties = JSON.parse(fs.readFileSync(propertiesPath, 'utf8'));

        const x = properties?.position?.x;
        const y = properties?.position?.y;
        const w = properties?.size?.w;
        const h = properties?.size?.h;

        if ([x, y, w, h].every((value) => typeof value === 'number')) {
          rectangles.push({ x, y, w, h });
        }
      } catch (error) {
        console.warn(`Warning: Could not parse widget rectangle for ${entry.name}`, error.message);
      }
    }

    // 2. Collect canvas-links (nested canvases: room-*/canvas-link-info.json)
    for (const entry of entries) {
      if (!entry.isDirectory() || !entry.name.startsWith('room-')) {
        continue;
      }

      const canvasLinkInfoPath = path.join(roomPath, entry.name, 'canvas-link-info.json');
      if (!fs.existsSync(canvasLinkInfoPath)) {
        continue;
      }

      try {
        const canvasLinkInfo = JSON.parse(fs.readFileSync(canvasLinkInfoPath, 'utf8'));

        const x = canvasLinkInfo?.position?.x;
        const y = canvasLinkInfo?.position?.y;
        const w = canvasLinkInfo?.size?.w;
        const h = canvasLinkInfo?.size?.h;

        if ([x, y, w, h].every((value) => typeof value === 'number')) {
          rectangles.push({ x, y, w, h });
        }
      } catch (error) {
        console.warn(`Warning: Could not parse canvas-link rectangle for ${entry.name}`, error.message);
      }
    }

    // 3. Collect files and other shapes from canvas-state.json (if it exists)
    const canvasStatePath = path.join(roomPath, 'canvas-state.json');
    if (fs.existsSync(canvasStatePath)) {
      try {
        const canvasState = JSON.parse(fs.readFileSync(canvasStatePath, 'utf8'));
        
        // Look for file shapes and other non-widget shapes in the canvas state
        if (canvasState?.documents && Array.isArray(canvasState.documents)) {
          for (const doc of canvasState.documents) {
            const state = doc.state;
            // Skip widgets (they're already collected from widget-* directories)
            // Skip canvas-links (they're already collected from room-* directories)
            if (state?.typeName === 'shape' && 
                state?.type !== 'miyagi-widget' && 
                state?.type !== 'canvas-link') {
              
              // For file shapes and other shapes, extract position and size
              const x = state?.x;
              const y = state?.y;
              const w = state?.props?.w || state?.props?.width;
              const h = state?.props?.h || state?.props?.height;

              if ([x, y, w, h].every((value) => typeof value === 'number')) {
                rectangles.push({ x, y, w, h });
              }
            }
          }
        }
      } catch (error) {
        console.warn('Warning: Could not parse canvas-state.json for file shapes:', error.message);
      }
    }
  } catch (error) {
    console.warn('Warning: Unable to inspect existing rectangles:', error.message);
  }

  return rectangles;
}

/**
 * Gets the default size for a widget template.
 * @param {string} templateHandle - Template handle/identifier
 * @returns {{w: number, h: number}} Default widget size (defaults to 300x200 if not found)
 */
function defaultSizeForTemplate(templateHandle) {
  const libRoot = path.join('/app/workspace/repo', 'agent_scripts', 'templates');
  const propertiesPath = path.join(libRoot, templateHandle, 'properties.json');

  try {
    if (fs.existsSync(propertiesPath)) {
      const properties = JSON.parse(fs.readFileSync(propertiesPath, 'utf8'));
      const width = properties?.defaultSize?.width;
      const height = properties?.defaultSize?.height;
      if (typeof width === 'number' && typeof height === 'number') {
        return { w: width, h: height };
      }
    }
  } catch (error) {
    console.warn(`Warning: Could not read default size for template '${templateHandle}':`, error.message);
  }

  return { w: 700, h: 600 };
}

/**
 * Computes the optimal placement for a new widget in a room.
 * @param {Array<{x: number, y: number, w: number, h: number}>} rectangles - Existing widget rectangles
 * @param {{w: number, h: number}} size - Size of the widget to place
 * @param {Object} [options] - Placement options
 * @param {string} [options.mode] - Canvas mode: 'dock' or 'canvas' (default)
 * @returns {{position: {x: number, y: number}, size: {w: number, h: number}}} Placement result
 */
function computePlacement(rectangles, size, options = {}) {
  const mode = options.mode || 'canvas';
  
  // In dock mode: ignore overlaps and always place at center
  if (mode === 'dock') {
    const centerPosition = EMPTY_ROOM_ANCHOR_POSITION;
    const position = {
      x: centerPosition.x - size.w / 2,
      y: centerPosition.y - size.h / 2,
    };
    return { position, size };
  }
  
  // Determine preferred position based on existing widgets
  let preferredPosition;
  if (rectangles.length === 0) {
    // First widget: use a nice starting position
    preferredPosition = EMPTY_ROOM_ANCHOR_POSITION;
  } else {
    // Calculate the center of all existing widgets/canvases/files
    // This gives us a natural focal point for placing new widgets
    let minX = Infinity;
    let maxX = -Infinity;
    let minY = Infinity;
    let maxY = -Infinity;
    
    for (const rect of rectangles) {
      const left = rect.x;
      const right = rect.x + rect.w;
      const top = rect.y;
      const bottom = rect.y + rect.h;
      
      if (left < minX) minX = left;
      if (right > maxX) maxX = right;
      if (top < minY) minY = top;
      if (bottom > maxY) maxY = bottom;
    }
    
    // Calculate center point of the bounding box containing all widgets
    const centerX = (minX + maxX) / 2;
    const centerY = (minY + maxY) / 2;
    
    // Use the center as preferred position (will be adjusted by collision detection)
    preferredPosition = {
      x: centerX - size.w / 2, // Center the new widget on the center point
      y: centerY - size.h / 2,
    };
  }

  const placement = findNextWidgetPositionForRoom({
    existingWidgets: rectangles,
    size,
    preferredPosition,
    padding: DEFAULT_PADDING,
  });

  if (!placement) {
    const fallback = preferredPosition ?? EMPTY_ROOM_ANCHOR_POSITION;
    return { position: fallback, size };
  }

  return { position: { x: placement.x, y: placement.y }, size };
}

// Export only functions used by external scripts
module.exports = {
  collectRoomWidgetRectangles,
  defaultSizeForTemplate,
  computePlacement,
};
