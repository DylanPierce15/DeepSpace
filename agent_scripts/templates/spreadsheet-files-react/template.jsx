import React, { useState, useCallback, useMemo, useEffect, useRef } from 'react';
import FileSidebar from './components/FileSidebar';
import SheetEditor from './components/SheetEditor';
import ScriptPanel from './components/ScriptPanel';
import HeaderBar from './components/HeaderBar';
import { parseCSV, serializeCSV, createEmptySheet, getColumnName } from './utils/csvUtils';
import { initializeDefaults } from './utils/defaults';

/**
 * Spreadsheet Widget
 * 
 * A simple spreadsheet editor with:
 * - CSV file storage (pandas-compatible)
 * - Nested folder structure
 * - JavaScript scripts for data transformation
 * 
 * File Structure:
 * files/sheets/
 * ├── config.json              # { currentFile }
 * ├── data.csv                 # Spreadsheet data
 * └── scripts/
 *     └── transform.js         # Data transformation script
 */

function SpreadsheetWidget() {
  const files = useFiles('sheets/');
  const [currentFile, setCurrentFile] = useState(null);
  const [scriptResult, setScriptResult] = useState(null);
  const initRef = useRef(false);

  // Get file type from extension
  const fileType = useMemo(() => {
    if (!currentFile) return null;
    if (currentFile.endsWith('.csv')) return 'csv';
    if (currentFile.endsWith('.js')) return 'js';
    return null;
  }, [currentFile]);

  // Read config
  const config = useMemo(() => {
    const raw = files.read('config.json');
    if (!raw) return {};
    try {
      return typeof raw === 'string' ? JSON.parse(raw) : raw;
    } catch {
      return {};
    }
  }, [files]);

  const writeConfig = useCallback((updates) => {
    const newConfig = { ...config, ...updates };
    files.write('config.json', JSON.stringify(newConfig, null, 2));
  }, [files, config]);

  // Parse current CSV - returns columns and data arrays
  const sheetData = useMemo(() => {
    if (fileType !== 'csv' || !currentFile) return null;
    const content = files.read(currentFile);
    if (!content) {
      return { columns: ['A', 'B', 'C', 'D'], data: [['', '', '', '']] };
    }
    return parseCSV(content);
  }, [files, currentFile, fileType]);

  // Get current script content
  const scriptContent = useMemo(() => {
    if (fileType !== 'js' || !currentFile) return null;
    return files.read(currentFile) || '';
  }, [files, currentFile, fileType]);

  // Handle file selection
  const handleSelectFile = useCallback((path) => {
    setCurrentFile(path);
    writeConfig({ currentFile: path });
    setScriptResult(null);
  }, [writeConfig]);

  // Create new file
  const handleCreateFile = useCallback((type, folderPath = '') => {
    const timestamp = Date.now();
    const name = type === 'csv' 
      ? `sheet-${timestamp}.csv` 
      : `script-${timestamp}.js`;
    const path = folderPath + name;

    if (type === 'csv') {
      const { columns, data } = createEmptySheet(5, 4);
      files.write(path, serializeCSV(columns, data));
    } else {
      files.write(path, getDefaultScript());
    }

    setCurrentFile(path);
    writeConfig({ currentFile: path });
  }, [files, writeConfig]);

  // Delete file
  const handleDeleteFile = useCallback((path) => {
    files.delete(path);
    if (currentFile === path || currentFile?.startsWith(path)) {
      setCurrentFile(null);
      writeConfig({ currentFile: null });
    }
  }, [files, currentFile, writeConfig]);

  // Cell editing - rebuild entire CSV and save
  const handleCellChange = useCallback((rowIndex, colIndex, value) => {
    if (!sheetData || fileType !== 'csv' || !currentFile) return;
    
    // Clone data
    const newData = sheetData.data.map(row => [...row]);
    
    // Ensure row exists
    while (newData.length <= rowIndex) {
      newData.push(Array(sheetData.columns.length).fill(''));
    }
    
    // Ensure column exists in row
    while (newData[rowIndex].length <= colIndex) {
      newData[rowIndex].push('');
    }
    
    // Update cell
    newData[rowIndex][colIndex] = value;
    
    // Save
    const csv = serializeCSV(sheetData.columns, newData);
    files.write(currentFile, csv);
  }, [files, currentFile, sheetData, fileType]);

  // Add row
  const handleAddRow = useCallback(() => {
    if (!sheetData || fileType !== 'csv' || !currentFile) return;
    
    const newRow = Array(sheetData.columns.length).fill('');
    const newData = [...sheetData.data, newRow];
    
    const csv = serializeCSV(sheetData.columns, newData);
    files.write(currentFile, csv);
  }, [files, currentFile, sheetData, fileType]);

  // Add column
  const handleAddColumn = useCallback(() => {
    if (!sheetData || fileType !== 'csv' || !currentFile) return;
    
    const newColName = getColumnName(sheetData.columns.length);
    const newColumns = [...sheetData.columns, newColName];
    const newData = sheetData.data.map(row => [...row, '']);
    
    const csv = serializeCSV(newColumns, newData);
    files.write(currentFile, csv);
  }, [files, currentFile, sheetData, fileType]);

  // Delete rows (indices should be sorted descending to avoid index shifting issues)
  const handleDeleteRows = useCallback((rowIndices) => {
    if (!sheetData || fileType !== 'csv' || !currentFile) return;
    if (rowIndices.length === 0) return;
    
    // Filter out the rows to delete
    const indicesToDelete = new Set(rowIndices);
    const newData = sheetData.data.filter((_, index) => !indicesToDelete.has(index));
    
    // Ensure at least one row remains
    if (newData.length === 0) {
      newData.push(Array(sheetData.columns.length).fill(''));
    }
    
    const csv = serializeCSV(sheetData.columns, newData);
    files.write(currentFile, csv);
  }, [files, currentFile, sheetData, fileType]);

  // Delete columns (indices should be sorted descending to avoid index shifting issues)
  const handleDeleteColumns = useCallback((colIndices) => {
    if (!sheetData || fileType !== 'csv' || !currentFile) return;
    if (colIndices.length === 0) return;
    
    // Filter out the columns to delete
    const indicesToDelete = new Set(colIndices);
    const newColumns = sheetData.columns.filter((_, index) => !indicesToDelete.has(index));
    const newData = sheetData.data.map(row => 
      row.filter((_, index) => !indicesToDelete.has(index))
    );
    
    // Ensure at least one column remains
    if (newColumns.length === 0) {
      newColumns.push('A');
      newData.forEach(row => row.push(''));
    }
    
    const csv = serializeCSV(newColumns, newData);
    files.write(currentFile, csv);
  }, [files, currentFile, sheetData, fileType]);

  // Insert row at index
  const handleInsertRow = useCallback((atIndex) => {
    if (!sheetData || fileType !== 'csv' || !currentFile) return;
    
    const newRow = Array(sheetData.columns.length).fill('');
    const newData = [...sheetData.data];
    newData.splice(atIndex, 0, newRow);
    
    const csv = serializeCSV(sheetData.columns, newData);
    files.write(currentFile, csv);
  }, [files, currentFile, sheetData, fileType]);

  // Insert column at index
  const handleInsertColumn = useCallback((atIndex) => {
    if (!sheetData || fileType !== 'csv' || !currentFile) return;
    
    const newColName = getColumnName(sheetData.columns.length);
    const newColumns = [...sheetData.columns];
    newColumns.splice(atIndex, 0, newColName);
    
    const newData = sheetData.data.map(row => {
      const newRow = [...row];
      newRow.splice(atIndex, 0, '');
      return newRow;
    });
    
    const csv = serializeCSV(newColumns, newData);
    files.write(currentFile, csv);
  }, [files, currentFile, sheetData, fileType]);

  // Move row from one position to another
  const handleMoveRow = useCallback((fromIndex, toIndex) => {
    if (!sheetData || fileType !== 'csv' || !currentFile) return;
    if (fromIndex === toIndex) return;
    
    const newData = [...sheetData.data];
    const [movedRow] = newData.splice(fromIndex, 1);
    newData.splice(toIndex > fromIndex ? toIndex - 1 : toIndex, 0, movedRow);
    
    const csv = serializeCSV(sheetData.columns, newData);
    files.write(currentFile, csv);
  }, [files, currentFile, sheetData, fileType]);

  // Move column from one position to another
  const handleMoveColumn = useCallback((fromIndex, toIndex) => {
    if (!sheetData || fileType !== 'csv' || !currentFile) return;
    if (fromIndex === toIndex) return;
    
    const newColumns = [...sheetData.columns];
    const [movedCol] = newColumns.splice(fromIndex, 1);
    newColumns.splice(toIndex > fromIndex ? toIndex - 1 : toIndex, 0, movedCol);
    
    const newData = sheetData.data.map(row => {
      const newRow = [...row];
      const [movedCell] = newRow.splice(fromIndex, 1);
      newRow.splice(toIndex > fromIndex ? toIndex - 1 : toIndex, 0, movedCell);
      return newRow;
    });
    
    const csv = serializeCSV(newColumns, newData);
    files.write(currentFile, csv);
  }, [files, currentFile, sheetData, fileType]);

  // Clear cells in range
  const handleClearCells = useCallback((range) => {
    if (!sheetData || fileType !== 'csv' || !currentFile) return;
    
    const newData = sheetData.data.map((row, ri) => {
      if (ri >= range.startRow && ri <= range.endRow) {
        return row.map((cell, ci) => {
          if (ci >= range.startCol && ci <= range.endCol) {
            return '';
          }
          return cell;
        });
      }
      return row;
    });
    
    const csv = serializeCSV(sheetData.columns, newData);
    files.write(currentFile, csv);
  }, [files, currentFile, sheetData, fileType]);

  // Save script
  const handleSaveScript = useCallback((content) => {
    if (fileType !== 'js' || !currentFile) return;
    files.write(currentFile, content);
  }, [files, currentFile, fileType]);

  // Find all CSV files recursively
  const findAllCSVFiles = useCallback((path = '') => {
    const results = [];
    const items = files.list(path);
    
    items.forEach(item => {
      if (item.endsWith('/')) {
        // It's a folder - recurse
        results.push(...findAllCSVFiles(path + item));
      } else if (item.endsWith('.csv')) {
        results.push(path + item);
      }
    });
    
    return results;
  }, [files]);

  // Run script on current or first available sheet
  const handleRunScript = useCallback(async (scriptCode) => {
    // Find a CSV file to run on
    let targetCSV = config.lastEditedSheet;
    if (!targetCSV || !files.exists(targetCSV)) {
      const allCSVFiles = findAllCSVFiles();
      targetCSV = allCSVFiles[0];
    }

    if (!targetCSV) {
      setScriptResult({ success: false, message: 'No spreadsheet found to run script on' });
      return;
    }

    try {
      const csvContent = files.read(targetCSV);
      const { columns, data } = parseCSV(csvContent);

      // Create sandboxed function
      const fn = new Function('data', 'columns', scriptCode);
      const result = fn(data.map(r => [...r]), [...columns]);

      // Handle result
      let newData = data;
      let newColumns = columns;

      if (result) {
        if (result.data) newData = result.data;
        else if (Array.isArray(result)) newData = result;
        if (result.columns) newColumns = result.columns;
      }

      // Write back
      files.write(targetCSV, serializeCSV(newColumns, newData));
      
      setScriptResult({
        success: true,
        message: `Updated ${targetCSV}: ${newData.length} rows, ${newColumns.length} columns`
      });
    } catch (error) {
      setScriptResult({
        success: false,
        message: error.message || 'Script execution failed'
      });
    }
  }, [files, config, findAllCSVFiles]);

  // Export CSV
  const handleExportCSV = useCallback(() => {
    if (!sheetData || !currentFile) return;
    const csv = serializeCSV(sheetData.columns, sheetData.data);
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = currentFile.split('/').pop();
    a.click();
    URL.revokeObjectURL(url);
  }, [sheetData, currentFile]);

  // Import CSV
  const handleImportCSV = useCallback((e) => {
    const file = e.target.files?.[0];
    if (!file || !currentFile) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const content = event.target?.result;
      if (typeof content === 'string') {
        files.write(currentFile, content);
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  }, [files, currentFile]);

  // Light background
  useEffect(() => {
    document.body.style.background = '#ffffff';
    document.body.style.margin = '0';
    return () => {
      document.body.style.background = '';
      document.body.style.margin = '';
    };
  }, []);

  // Initialize with default sheet if empty
  useEffect(() => {
    if (!files.ready) return;
    if (initRef.current) return;

    const allCSV = findAllCSVFiles();
    const hasFiles = allCSV.length > 0;
    
    if (!hasFiles) {
      initRef.current = true;
      initializeDefaults(files);
      setCurrentFile('sample-data.csv');
    } else if (config.currentFile && files.exists(config.currentFile)) {
      setCurrentFile(config.currentFile);
      initRef.current = true;
    } else {
      if (allCSV[0]) {
        setCurrentFile(allCSV[0]);
        initRef.current = true;
      }
    }
  }, [files.ready, files, config, writeConfig, findAllCSVFiles]);

  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      height: '100%',
      width: '100%',
      fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
      backgroundColor: '#fff',
      overflow: 'hidden'
    }}>
      <HeaderBar
        currentFile={currentFile}
        fileType={fileType}
        onExportCSV={handleExportCSV}
        onImportCSV={handleImportCSV}
      />

      <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>
        <FileSidebar
          files={files}
          currentFile={currentFile}
          onSelectFile={handleSelectFile}
          onCreateFile={handleCreateFile}
          onDeleteFile={handleDeleteFile}
        />

        {/* Main content area */}
        {fileType === 'csv' && sheetData && (
          <SheetEditor
            columns={sheetData.columns}
            data={sheetData.data}
            onCellChange={handleCellChange}
            onAddRow={handleAddRow}
            onAddColumn={handleAddColumn}
            onDeleteRows={handleDeleteRows}
            onDeleteColumns={handleDeleteColumns}
            onInsertRow={handleInsertRow}
            onInsertColumn={handleInsertColumn}
            onMoveRow={handleMoveRow}
            onMoveColumn={handleMoveColumn}
            onClearCells={handleClearCells}
          />
        )}

        {fileType === 'js' && (
          <ScriptPanel
            scriptPath={currentFile}
            scriptContent={scriptContent}
            onSaveScript={handleSaveScript}
            onRunScript={handleRunScript}
            lastResult={scriptResult}
          />
        )}

        {!fileType && (
          <div style={{
            flex: 1,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: '#94a3b8',
            fontSize: '14px',
            flexDirection: 'column',
            gap: '12px',
            backgroundColor: '#f8fafc'
          }}>
            <span style={{ fontSize: '48px', opacity: 0.4 }}>📊</span>
            <span>Select or create a spreadsheet</span>
          </div>
        )}
      </div>

      <style>{`
        * { box-sizing: border-box; }
        ::-webkit-scrollbar { width: 8px; height: 8px; }
        ::-webkit-scrollbar-track { background: #f1f5f9; }
        ::-webkit-scrollbar-thumb { background: #cbd5e1; border-radius: 4px; }
        ::-webkit-scrollbar-thumb:hover { background: #94a3b8; }
      `}</style>
    </div>
  );
}

function getDefaultScript() {
  return `// Transform spreadsheet data
// Available: data (array of rows), columns (array of names)
// Return: { data, columns } or just data

// Example: Filter rows where column A is not empty
// data = data.filter(row => row[0] !== '');

// Example: Add computed column
// columns.push('Total');
// data.forEach(row => {
//   row.push(Number(row[1]) * Number(row[2]));
// });

return { data, columns };
`;
}

export default SpreadsheetWidget;
