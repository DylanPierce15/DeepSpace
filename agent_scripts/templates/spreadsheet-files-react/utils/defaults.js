/**
 * Default files for Spreadsheet widget initialization
 */

export const DEFAULT_CONFIG = {
  currentFile: 'sample-data.csv'
};

export const DEFAULT_CSV = `Product,Price,Quantity,Category
Widget A,29.99,100,Electronics
Widget B,49.99,75,Electronics
Gadget X,19.99,200,Accessories
Gadget Y,39.99,50,Accessories
Tool Z,99.99,25,Tools`;

export const DEFAULT_SCRIPT = `// Example Script - Adds a Total column
// This script runs on the current CSV data

// data is a 2D array: first row is headers, rest are data rows
const headers = data[0];
const rows = data.slice(1);

// Add Total header
headers.push('Total');

// Calculate Price × Quantity for each row
rows.forEach(row => {
  const price = parseFloat(row[1]) || 0;
  const qty = parseFloat(row[2]) || 0;
  row.push((price * qty).toFixed(2));
});

// Return the modified data
return [headers, ...rows];`;

/**
 * Initialize default files for a new spreadsheet widget
 * @param {Object} files - useFiles hook instance
 */
export function initializeDefaults(files) {
  files.write('config.json', JSON.stringify(DEFAULT_CONFIG, null, 2));
  files.write('sample-data.csv', DEFAULT_CSV);
  files.write('scripts/add-total.js', DEFAULT_SCRIPT);
}

