#!/usr/bin/env node

/**
 * Index Validator Module
 * Validates fractional indices for tldraw widgets
 * 
 * Ensures all indices comply with fractional-indexing rules:
 * - No trailing zeros (except 'a0')
 * - Valid variable-length integer parts (a=2 chars, b=3 chars, etc.)
 * - Proper base-62 encoding (0-9, A-Z, a-z)
 */

const fs = require('fs');
const path = require('path');
const { generateKeyBetween } = require('jittered-fractional-indexing');

/**
 * Simple Index Validator
 * Validates and fixes fractional indices to ensure they follow tldraw rules
 */
class IndexValidator {
  /**
   * Validate a single index using the fractional-indexing library
   * @param {string} index - The index to validate
   * @returns {boolean} - True if valid, false otherwise
   */
  isValidIndex(index) {
    try {
      // Use the library's own validation by attempting to use the index
      generateKeyBetween(index, null, { jitterBits: 0 });
      return true;
    } catch (error) {
      return false;
    }
  }

  /**
   * Generate a fixed index keeping only the first character
   * @param {string} invalidIndex - The invalid index to fix
   * @returns {string} - A new valid index
   */
  generateFixedIndex(invalidIndex) {
    // Keep only the first character
    const firstChar = invalidIndex.charAt(0) || 'a';
    
    // Generate 5 random base-62 characters (no trailing zeros)
    const base62 = '123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz';
    let randomPart = '';
    for (let i = 0; i < 5; i++) {
      randomPart += base62.charAt(Math.floor(Math.random() * base62.length));
    }
    
    return firstChar + randomPart;
  }

  /**
   * Validate and fix all widget indices in a room directory
   * @param {string} roomDir - Path to the room directory
   * @returns {Object} - Summary of validation results
   */
  validateAndFixRoomIndices(roomDir) {
    const roomName = path.basename(roomDir);
    const results = {
      roomName,
      totalWidgets: 0,
      invalidIndices: [],
      fixed: []
    };

    try {
      // Validate widget properties.json files
      const entries = fs.readdirSync(roomDir, { withFileTypes: true });
      const widgetDirs = entries.filter(e => e.isDirectory() && e.name.startsWith('widget-'));
      
      results.totalWidgets = widgetDirs.length;

      for (const widgetDir of widgetDirs) {
        const propertiesPath = path.join(roomDir, widgetDir.name, 'properties.json');
        
        if (!fs.existsSync(propertiesPath)) {
          continue;
        }

        try {
          const properties = JSON.parse(fs.readFileSync(propertiesPath, 'utf8'));
          const originalIndex = properties.index;
          
          if (!originalIndex) {
            console.warn(`⚠️  Widget ${widgetDir.name} has no index, skipping`);
            continue;
          }

          // Check if it's valid according to fractional-indexing rules
          if (!this.isValidIndex(originalIndex)) {
            // Generate a fixed index
            const fixedIndex = this.generateFixedIndex(originalIndex);
            
            // Update the properties.json file
            properties.index = fixedIndex;
            fs.writeFileSync(propertiesPath, JSON.stringify(properties, null, 2), 'utf8');
            
            results.invalidIndices.push({ widget: widgetDir.name, index: originalIndex });
            results.fixed.push({
              widget: widgetDir.name,
              originalIndex,
              fixedIndex,
              reason: 'invalid format (e.g., trailing zero)'
            });
            
            console.log(`  🔧 Fixed ${widgetDir.name}: ${originalIndex} → ${fixedIndex} (invalid format)`);
          }

        } catch (error) {
          console.error(`❌ Error processing ${widgetDir.name}/properties.json:`, error.message);
        }
      }

    } catch (error) {
      console.error(`❌ Error validating indices in room ${roomName}:`, error.message);
    }

    return results;
  }

  /**
   * Get the next valid index for a new widget in a room
   * Reads existing widget indices and generates the next one
   * @param {string} roomPath - The path to the room directory
   * @returns {string} - A valid next index
   */
  getNextWidgetIndex(roomPath) {
    try {
      // Find all widget-* directories in the room
      const entries = fs.readdirSync(roomPath, { withFileTypes: true });
      const widgetDirs = entries.filter(e => e.isDirectory() && e.name.startsWith('widget-'));
      
      // Collect all indices from existing widgets
      const indices = [];
      
      // Get indices from widget properties.json files only
      for (const dir of widgetDirs) {
        const propertiesPath = path.join(roomPath, dir.name, 'properties.json');
        if (fs.existsSync(propertiesPath)) {
          try {
            const properties = JSON.parse(fs.readFileSync(propertiesPath, 'utf8'));
            if (properties.index) {
              indices.push(properties.index);
            }
          } catch (error) {
            // Skip invalid files
          }
        }
      }
      
      // Sort indices lexicographically (how tldraw sorts them)
      indices.sort();
      
      // Get the highest index
      const highestIndex = indices.length > 0 ? indices[indices.length - 1] : null;
      
      // Generate the next index using fractional indexing
      const nextIndex = generateKeyBetween(highestIndex, null, { jitterBits: 0 });
      
      console.log(`📊 Index calculation: Found ${widgetDirs.length} widgets, highest: ${highestIndex || 'none'}, next: ${nextIndex}`);
      
      return nextIndex;
    } catch (error) {
      console.warn('⚠️  Could not calculate next index, using default:', error.message);
      return 'a1'; // fallback
    }
  }
}

module.exports = { IndexValidator };
