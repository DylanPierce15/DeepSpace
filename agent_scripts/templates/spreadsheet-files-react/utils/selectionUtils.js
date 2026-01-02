/**
 * Selection utilities for spreadsheet
 */

// Get range between two points (inclusive)
export function getRange(start, end) {
  return {
    startRow: Math.min(start.row, end.row),
    endRow: Math.max(start.row, end.row),
    startCol: Math.min(start.col, end.col),
    endCol: Math.max(start.col, end.col)
  };
}

// Check if cell is in range
export function isCellInRange(row, col, range) {
  if (!range) return false;
  return row >= range.startRow && row <= range.endRow &&
         col >= range.startCol && col <= range.endCol;
}

// Check if cell is in any of the ranges
export function isCellInRanges(row, col, ranges) {
  return ranges.some(range => isCellInRange(row, col, range));
}

// Check if row is fully selected
export function isRowSelected(rowIndex, selectedRows) {
  return selectedRows.has(rowIndex);
}

// Check if column is fully selected  
export function isColSelected(colIndex, selectedCols) {
  return selectedCols.has(colIndex);
}

// Get array of indices from start to end (inclusive)
export function getIndexRange(start, end) {
  const min = Math.min(start, end);
  const max = Math.max(start, end);
  const result = [];
  for (let i = min; i <= max; i++) {
    result.push(i);
  }
  return result;
}

// Merge new indices into existing set
export function mergeIntoSet(existingSet, indices) {
  const newSet = new Set(existingSet);
  indices.forEach(i => newSet.add(i));
  return newSet;
}

// Toggle index in set
export function toggleInSet(existingSet, index) {
  const newSet = new Set(existingSet);
  if (newSet.has(index)) {
    newSet.delete(index);
  } else {
    newSet.add(index);
  }
  return newSet;
}

