/**
 * CSV Utilities
 * Simple CSV parsing/serialization without external dependencies
 */

/**
 * Parse CSV string to array of row arrays
 * Handles quoted fields with commas and newlines
 */
export function parseCSV(csvString) {
  if (!csvString || !csvString.trim()) {
    return { columns: ['A', 'B', 'C'], data: [['', '', '']] };
  }

  const rows = [];
  let currentRow = [];
  let currentField = '';
  let inQuotes = false;

  for (let i = 0; i < csvString.length; i++) {
    const char = csvString[i];
    const nextChar = csvString[i + 1];

    if (inQuotes) {
      if (char === '"' && nextChar === '"') {
        currentField += '"';
        i++; // Skip next quote
      } else if (char === '"') {
        inQuotes = false;
      } else {
        currentField += char;
      }
    } else {
      if (char === '"') {
        inQuotes = true;
      } else if (char === ',') {
        currentRow.push(currentField);
        currentField = '';
      } else if (char === '\n' || (char === '\r' && nextChar === '\n')) {
        currentRow.push(currentField);
        // Keep the row if it has any fields (even empty ones)
        // Only skip completely empty lines (no commas at all)
        if (currentRow.length > 0) {
          rows.push(currentRow);
        }
        currentRow = [];
        currentField = '';
        if (char === '\r') i++; // Skip \n after \r
      } else if (char !== '\r') {
        currentField += char;
      }
    }
  }

  // Handle last field/row
  currentRow.push(currentField);
  if (currentRow.length > 0) {
    rows.push(currentRow);
  }

  if (rows.length === 0) {
    return { columns: ['A', 'B', 'C'], data: [['', '', '']] };
  }

  // First row is headers/columns
  const columns = rows[0];
  const data = rows.slice(1);

  // Ensure all rows have same length
  const maxCols = Math.max(columns.length, ...data.map(r => r.length));
  const normalizedColumns = [...columns];
  while (normalizedColumns.length < maxCols) {
    normalizedColumns.push(getColumnName(normalizedColumns.length));
  }

  const normalizedData = data.map(row => {
    const newRow = [...row];
    while (newRow.length < maxCols) newRow.push('');
    return newRow;
  });

  // Return data, or single empty row if no data rows exist
  return { 
    columns: normalizedColumns, 
    data: normalizedData.length > 0 ? normalizedData : [] 
  };
}

/**
 * Serialize data back to CSV string
 */
export function serializeCSV(columns, data) {
  const escapeField = (field) => {
    const str = String(field ?? '');
    if (str.includes(',') || str.includes('"') || str.includes('\n')) {
      return '"' + str.replace(/"/g, '""') + '"';
    }
    return str;
  };

  const headerRow = columns.map(escapeField).join(',');
  const dataRows = data.map(row => row.map(escapeField).join(','));

  return [headerRow, ...dataRows].join('\n');
}

/**
 * Get Excel-style column name (A, B, ..., Z, AA, AB, ...)
 */
export function getColumnName(index) {
  let name = '';
  let i = index;
  while (i >= 0) {
    name = String.fromCharCode(65 + (i % 26)) + name;
    i = Math.floor(i / 26) - 1;
  }
  return name;
}

/**
 * Parse column name to index (A=0, B=1, ..., AA=26)
 */
export function getColumnIndex(name) {
  let index = 0;
  for (let i = 0; i < name.length; i++) {
    index = index * 26 + (name.charCodeAt(i) - 64);
  }
  return index - 1;
}

/**
 * Create empty sheet with given dimensions
 */
export function createEmptySheet(rows = 10, cols = 5) {
  const columns = Array.from({ length: cols }, (_, i) => getColumnName(i));
  const data = Array.from({ length: rows }, () => Array(cols).fill(''));
  return { columns, data };
}
