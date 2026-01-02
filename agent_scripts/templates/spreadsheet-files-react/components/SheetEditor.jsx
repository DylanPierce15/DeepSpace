import React, { useState, useCallback, useRef, useEffect } from 'react';
import { getColumnName } from '../utils/csvUtils';
import { getRange, isCellInRange, getIndexRange, mergeIntoSet, toggleInSet } from '../utils/selectionUtils';
import FormulaBar from './FormulaBar';
import ContextMenu from './ContextMenu';

/**
 * SheetEditor - Spreadsheet with proper event handling
 */
export default function SheetEditor({
  columns, data, onCellChange, onAddRow, onAddColumn,
  onDeleteRows, onDeleteColumns, onInsertRow, onInsertColumn,
  onMoveRow, onMoveColumn, onClearCells
}) {
  // Cell selection
  const [activeCell, setActiveCell] = useState({ row: 0, col: 0 });
  const [rangeEnd, setRangeEnd] = useState(null);
  
  // Row/column selection
  const [selectedRows, setSelectedRows] = useState(new Set());
  const [selectedCols, setSelectedCols] = useState(new Set());
  const [lastRowClick, setLastRowClick] = useState(null);
  const [lastColClick, setLastColClick] = useState(null);
  
  // Drag state
  const [dragState, setDragState] = useState(null); // { type: 'cell'|'row'|'column', startIndex }
  const [dropTarget, setDropTarget] = useState(null);
  
  // Edit state
  const [isEditMode, setIsEditMode] = useState(false);
  const [editValue, setEditValue] = useState('');
  const [originalValue, setOriginalValue] = useState('');
  
  // Context menu
  const [contextMenu, setContextMenu] = useState(null);
  
  const cellInputRef = useRef(null);
  const formulaInputRef = useRef(null);
  const containerRef = useRef(null);
  const editingInFormulaBar = useRef(false);

  const currentRange = rangeEnd ? getRange(activeCell, rangeEnd) : null;
  const storedValue = data[activeCell.row]?.[activeCell.col] ?? '';

  // Sync edit value
  useEffect(() => {
    if (!isEditMode) setEditValue(storedValue);
  }, [activeCell, storedValue, isEditMode]);

  // Focus input in edit mode
  useEffect(() => {
    if (isEditMode) {
      const input = editingInFormulaBar.current ? formulaInputRef.current : cellInputRef.current;
      if (input) input.focus();
    }
  }, [isEditMode]);

  // Global mouse up to end dragging
  useEffect(() => {
    const handleGlobalMouseUp = () => {
      if (dragState) {
        // Handle drop
        if (dragState.type === 'row' && dropTarget !== null && dragState.startIndex !== dropTarget) {
          onMoveRow?.(dragState.startIndex, dropTarget);
        } else if (dragState.type === 'column' && dropTarget !== null && dragState.startIndex !== dropTarget) {
          onMoveColumn?.(dragState.startIndex, dropTarget);
        }
        setDragState(null);
        setDropTarget(null);
      }
    };
    
    window.addEventListener('mouseup', handleGlobalMouseUp);
    return () => window.removeEventListener('mouseup', handleGlobalMouseUp);
  }, [dragState, dropTarget, onMoveRow, onMoveColumn]);

  // Focus container
  const focusContainer = useCallback(() => {
    setTimeout(() => containerRef.current?.focus(), 0);
  }, []);

  const clearSelection = useCallback(() => {
    setSelectedRows(new Set());
    setSelectedCols(new Set());
    setRangeEnd(null);
  }, []);

  const enterEditMode = useCallback((fromFormulaBar = false, initialValue = null) => {
    editingInFormulaBar.current = fromFormulaBar;
    setOriginalValue(storedValue);
    setEditValue(initialValue !== null ? initialValue : storedValue);
    setIsEditMode(true);
    clearSelection();
  }, [storedValue, clearSelection]);

  const commitEdit = useCallback(() => {
    if (isEditMode) {
      onCellChange(activeCell.row, activeCell.col, editValue);
      setIsEditMode(false);
      editingInFormulaBar.current = false;
      focusContainer();
    }
  }, [isEditMode, activeCell, editValue, onCellChange, focusContainer]);

  const cancelEdit = useCallback(() => {
    setEditValue(originalValue);
    setIsEditMode(false);
    editingInFormulaBar.current = false;
    focusContainer();
  }, [originalValue, focusContainer]);

  const navigateTo = useCallback((row, col, extendRange = false) => {
    const maxRow = Math.max(0, data.length - 1);
    const maxCol = Math.max(0, columns.length - 1);
    const newRow = Math.max(0, Math.min(row, maxRow));
    const newCol = Math.max(0, Math.min(col, maxCol));
    
    if (extendRange) {
      setRangeEnd({ row: newRow, col: newCol });
    } else {
      setActiveCell({ row: newRow, col: newCol });
      clearSelection();
    }
  }, [data.length, columns.length, clearSelection]);

  // DELETE HANDLER - this is called by keyboard
  const handleDelete = useCallback(() => {
    if (selectedRows.size > 0) {
      if (onDeleteRows) {
        onDeleteRows(Array.from(selectedRows).sort((a, b) => b - a));
      }
      setSelectedRows(new Set());
      return;
    }
    
    if (selectedCols.size > 0) {
      if (onDeleteColumns) {
        onDeleteColumns(Array.from(selectedCols).sort((a, b) => b - a));
      }
      setSelectedCols(new Set());
      return;
    }
    
    if (currentRange) {
      if (onClearCells) {
        onClearCells(currentRange);
      }
      setRangeEnd(null);
      return;
    }
    
    // Clear single cell
    onCellChange(activeCell.row, activeCell.col, '');
    setEditValue('');
  }, [selectedRows, selectedCols, currentRange, activeCell, onDeleteRows, onDeleteColumns, onClearCells, onCellChange]);

  // CELL EVENTS
  const handleCellMouseDown = useCallback((row, col, e) => {
    e.stopPropagation();
    if (isEditMode) commitEdit();
    setContextMenu(null);
    
    if (e.shiftKey) {
      setRangeEnd({ row, col });
      setSelectedRows(new Set());
      setSelectedCols(new Set());
    } else {
      setActiveCell({ row, col });
      clearSelection();
      setDragState({ type: 'cell', startRow: row, startCol: col });
    }
    focusContainer();
  }, [isEditMode, commitEdit, clearSelection, focusContainer]);

  const handleCellMouseEnter = useCallback((row, col) => {
    if (dragState?.type === 'cell') {
      setRangeEnd({ row, col });
    }
  }, [dragState]);

  const handleCellDoubleClick = useCallback((row, col, e) => {
    e.stopPropagation();
    setActiveCell({ row, col });
    enterEditMode(false);
  }, [enterEditMode]);

  const handleCellContextMenu = useCallback((e, row, col) => {
    e.preventDefault();
    e.stopPropagation();
    if (isEditMode) commitEdit();
    const inRange = currentRange && isCellInRange(row, col, currentRange);
    const isActive = activeCell.row === row && activeCell.col === col;
    if (!inRange && !isActive) {
      setActiveCell({ row, col });
      clearSelection();
    }
    setContextMenu({ x: e.clientX, y: e.clientY, type: 'cell', row, col });
  }, [isEditMode, commitEdit, currentRange, activeCell, clearSelection]);

  // ROW HEADER EVENTS
  const handleRowMouseDown = useCallback((rowIndex, e) => {
    e.stopPropagation();
    e.preventDefault();
    if (isEditMode) commitEdit();
    setContextMenu(null);
    
    if (e.shiftKey && lastRowClick !== null) {
      setSelectedRows(mergeIntoSet(selectedRows, getIndexRange(lastRowClick, rowIndex)));
    } else if (e.metaKey || e.ctrlKey) {
      setSelectedRows(toggleInSet(selectedRows, rowIndex));
      setLastRowClick(rowIndex);
    } else {
      setSelectedRows(new Set([rowIndex]));
      setLastRowClick(rowIndex);
      setDragState({ type: 'row', startIndex: rowIndex });
    }
    setSelectedCols(new Set());
    setRangeEnd(null);
    focusContainer();
  }, [isEditMode, commitEdit, lastRowClick, selectedRows, focusContainer]);

  const handleRowMouseEnter = useCallback((rowIndex) => {
    if (dragState?.type === 'row') {
      setDropTarget(rowIndex);
    }
  }, [dragState]);

  const handleRowContextMenu = useCallback((e, rowIndex) => {
    e.preventDefault();
    e.stopPropagation();
    if (!selectedRows.has(rowIndex)) {
      setSelectedRows(new Set([rowIndex]));
      setLastRowClick(rowIndex);
    }
    setSelectedCols(new Set());
    setContextMenu({ x: e.clientX, y: e.clientY, type: 'row', row: rowIndex });
  }, [selectedRows]);

  // COLUMN HEADER EVENTS
  const handleColMouseDown = useCallback((colIndex, e) => {
    e.stopPropagation();
    e.preventDefault();
    if (isEditMode) commitEdit();
    setContextMenu(null);
    
    if (e.shiftKey && lastColClick !== null) {
      setSelectedCols(mergeIntoSet(selectedCols, getIndexRange(lastColClick, colIndex)));
    } else if (e.metaKey || e.ctrlKey) {
      setSelectedCols(toggleInSet(selectedCols, colIndex));
      setLastColClick(colIndex);
    } else {
      setSelectedCols(new Set([colIndex]));
      setLastColClick(colIndex);
      setDragState({ type: 'column', startIndex: colIndex });
    }
    setSelectedRows(new Set());
    setRangeEnd(null);
    focusContainer();
  }, [isEditMode, commitEdit, lastColClick, selectedCols, focusContainer]);

  const handleColMouseEnter = useCallback((colIndex) => {
    if (dragState?.type === 'column') {
      setDropTarget(colIndex);
    }
  }, [dragState]);

  const handleColContextMenu = useCallback((e, colIndex) => {
    e.preventDefault();
    e.stopPropagation();
    if (!selectedCols.has(colIndex)) {
      setSelectedCols(new Set([colIndex]));
      setLastColClick(colIndex);
    }
    setSelectedRows(new Set());
    setContextMenu({ x: e.clientX, y: e.clientY, type: 'column', col: colIndex });
  }, [selectedCols]);

  // KEYBOARD HANDLERS
  const handleCellInputKeyDown = useCallback((e) => {
    if (e.key === 'Enter') { e.preventDefault(); commitEdit(); navigateTo(activeCell.row + 1, activeCell.col); }
    else if (e.key === 'Tab') { e.preventDefault(); commitEdit(); navigateTo(activeCell.row, activeCell.col + (e.shiftKey ? -1 : 1)); }
    else if (e.key === 'Escape') { e.preventDefault(); cancelEdit(); }
    else if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.key)) {
      e.preventDefault(); commitEdit();
      const d = { ArrowUp: [-1, 0], ArrowDown: [1, 0], ArrowLeft: [0, -1], ArrowRight: [0, 1] };
      navigateTo(activeCell.row + d[e.key][0], activeCell.col + d[e.key][1]);
    }
  }, [commitEdit, cancelEdit, navigateTo, activeCell]);

  const handleFormulaBarKeyDown = useCallback((e) => {
    if (e.key === 'Enter') { e.preventDefault(); commitEdit(); navigateTo(activeCell.row + 1, activeCell.col); }
    else if (e.key === 'Tab') { e.preventDefault(); commitEdit(); navigateTo(activeCell.row, activeCell.col + (e.shiftKey ? -1 : 1)); }
    else if (e.key === 'Escape') { e.preventDefault(); cancelEdit(); }
  }, [commitEdit, cancelEdit, navigateTo, activeCell]);

  // MAIN CONTAINER KEYBOARD HANDLER
  const handleContainerKeyDown = useCallback((e) => {
    // Don't handle if in edit mode
    if (isEditMode) return;
    
    const { row, col } = activeCell;
    const extend = e.shiftKey && !e.metaKey && !e.ctrlKey;
    
    switch (e.key) {
      case 'Delete':
      case 'Backspace':
        e.preventDefault();
        handleDelete();
        break;
      case 'ArrowUp':
        e.preventDefault();
        navigateTo(row - 1, col, extend);
        break;
      case 'ArrowDown':
        e.preventDefault();
        navigateTo(row + 1, col, extend);
        break;
      case 'ArrowLeft':
        e.preventDefault();
        navigateTo(row, col - 1, extend);
        break;
      case 'ArrowRight':
        e.preventDefault();
        navigateTo(row, col + 1, extend);
        break;
      case 'Tab':
        e.preventDefault();
        navigateTo(row, col + (e.shiftKey ? -1 : 1));
        break;
      case 'Enter':
      case 'F2':
        e.preventDefault();
        enterEditMode(false);
        break;
      default:
        if (e.key.length === 1 && !e.metaKey && !e.ctrlKey && !e.altKey) {
          e.preventDefault();
          enterEditMode(false, e.key);
        }
    }
  }, [isEditMode, activeCell, navigateTo, enterEditMode, handleDelete]);

  // Context menu items
  const getContextMenuItems = useCallback(() => {
    if (!contextMenu) return [];
    
    if (contextMenu.type === 'row') {
      const rows = Array.from(selectedRows).sort((a, b) => a - b);
      const firstRow = rows[0] ?? contextMenu.row;
      return [
        { icon: '⬆️', label: 'Insert Row Above', action: () => onInsertRow?.(firstRow) },
        { icon: '⬇️', label: 'Insert Row Below', action: () => onInsertRow?.(firstRow + 1) },
        { separator: true },
        { icon: '🗑️', label: `Delete ${selectedRows.size > 1 ? `${selectedRows.size} Rows` : 'Row'}`, action: handleDelete, danger: true }
      ];
    }
    
    if (contextMenu.type === 'column') {
      const cols = Array.from(selectedCols).sort((a, b) => a - b);
      const firstCol = cols[0] ?? contextMenu.col;
      return [
        { icon: '⬅️', label: 'Insert Column Left', action: () => onInsertColumn?.(firstCol) },
        { icon: '➡️', label: 'Insert Column Right', action: () => onInsertColumn?.(firstCol + 1) },
        { separator: true },
        { icon: '🗑️', label: `Delete ${selectedCols.size > 1 ? `${selectedCols.size} Columns` : 'Column'}`, action: handleDelete, danger: true }
      ];
    }
    
    return [
      { icon: '🧹', label: 'Clear Contents', action: handleDelete, shortcut: 'Del' },
      { separator: true },
      { icon: '⬆️', label: 'Insert Row Above', action: () => onInsertRow?.(activeCell.row) },
      { icon: '⬇️', label: 'Insert Row Below', action: () => onInsertRow?.(activeCell.row + 1) },
      { icon: '⬅️', label: 'Insert Column Left', action: () => onInsertColumn?.(activeCell.col) },
      { icon: '➡️', label: 'Insert Column Right', action: () => onInsertColumn?.(activeCell.col + 1) }
    ];
  }, [contextMenu, selectedRows, selectedCols, activeCell, handleDelete, onInsertRow, onInsertColumn]);

  const isCellHighlighted = useCallback((row, col) => {
    return selectedRows.has(row) || selectedCols.has(col) || (currentRange && isCellInRange(row, col, currentRange));
  }, [selectedRows, selectedCols, currentRange]);

  const selectionInfo = selectedRows.size > 0 
    ? `${selectedRows.size} row${selectedRows.size > 1 ? 's' : ''} selected • Press Delete to remove`
    : selectedCols.size > 0 
    ? `${selectedCols.size} column${selectedCols.size > 1 ? 's' : ''} selected • Press Delete to remove`
    : currentRange 
    ? `${currentRange.endRow - currentRange.startRow + 1}×${currentRange.endCol - currentRange.startCol + 1} cells • Press Delete to clear`
    : null;

  const cellRef = `${columns[activeCell.col] || getColumnName(activeCell.col)}${activeCell.row + 1}`;

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', backgroundColor: '#fff' }}>
      <FormulaBar
        ref={formulaInputRef}
        cellRef={cellRef}
        value={editValue}
        onChange={(e) => setEditValue(e.target.value)}
        onKeyDown={handleFormulaBarKeyDown}
        onFocus={() => !isEditMode ? enterEditMode(true) : (editingInFormulaBar.current = true)}
      />

      {/* Main grid container - this receives keyboard focus */}
      <div 
        ref={containerRef}
        tabIndex={0}
        onKeyDown={handleContainerKeyDown}
        onClick={() => focusContainer()}
        style={{ 
          flex: 1, 
          overflow: 'auto', 
          outline: 'none',
          cursor: dragState ? 'grabbing' : 'default', 
          userSelect: 'none' 
        }}
      >
        <table style={{ borderCollapse: 'collapse', tableLayout: 'fixed', minWidth: '100%' }}>
          <thead>
            <tr>
              <th style={styles.corner}>#</th>
              {columns.map((col, i) => {
                const isSelected = selectedCols.has(i);
                const isDropTarget = dragState?.type === 'column' && dropTarget === i && dragState.startIndex !== i;
                return (
                  <th 
                    key={i} 
                    style={{ 
                      ...styles.colHeader, 
                      backgroundColor: isSelected ? '#93c5fd' : '#f1f5f9',
                      cursor: isSelected ? 'grab' : 'pointer',
                      boxShadow: isDropTarget ? 'inset 3px 0 0 #2563eb' : undefined
                    }}
                    onMouseDown={(e) => handleColMouseDown(i, e)}
                    onMouseEnter={() => handleColMouseEnter(i)}
                    onContextMenu={(e) => handleColContextMenu(e, i)}
                  >
                    {col}
                  </th>
                );
              })}
              <th style={styles.addCol}><button onClick={onAddColumn} style={styles.addBtn}>+</button></th>
            </tr>
          </thead>
          <tbody>
            {data.map((row, ri) => {
              const isRowSelected = selectedRows.has(ri);
              const isDropTarget = dragState?.type === 'row' && dropTarget === ri && dragState.startIndex !== ri;
              return (
                <tr key={ri}>
                  <td 
                    style={{ 
                      ...styles.rowHeader, 
                      backgroundColor: isRowSelected ? '#93c5fd' : '#f8fafc',
                      cursor: isRowSelected ? 'grab' : 'pointer',
                      boxShadow: isDropTarget ? 'inset 0 3px 0 #2563eb' : undefined
                    }}
                    onMouseDown={(e) => handleRowMouseDown(ri, e)}
                    onMouseEnter={() => handleRowMouseEnter(ri)}
                    onContextMenu={(e) => handleRowContextMenu(e, ri)}
                  >
                    {ri + 1}
                  </td>
                  {columns.map((_, ci) => {
                    const value = row[ci] ?? '';
                    const isActive = activeCell.row === ri && activeCell.col === ci;
                    const isEditing = isActive && isEditMode;
                    const isHighlighted = isCellHighlighted(ri, ci);
                    
                    return (
                      <td
                        key={ci}
                        onMouseDown={(e) => handleCellMouseDown(ri, ci, e)}
                        onMouseEnter={() => handleCellMouseEnter(ri, ci)}
                        onDoubleClick={(e) => handleCellDoubleClick(ri, ci, e)}
                        onContextMenu={(e) => handleCellContextMenu(e, ri, ci)}
                        style={{
                          ...styles.cell,
                          border: isActive ? '2px solid #2563eb' : '1px solid #e2e8f0',
                          backgroundColor: isHighlighted ? '#dbeafe' : (isActive ? '#eff6ff' : '#fff'),
                          padding: isEditing ? 0 : undefined
                        }}
                      >
                        {isEditing ? (
                          <input
                            ref={cellInputRef}
                            type="text"
                            value={editValue}
                            onChange={(e) => setEditValue(e.target.value)}
                            onKeyDown={handleCellInputKeyDown}
                            style={styles.cellInput}
                          />
                        ) : (
                          <div style={styles.cellText}>{value}</div>
                        )}
                      </td>
                    );
                  })}
                  <td style={styles.emptyCol} />
                </tr>
              );
            })}
            <tr>
              <td colSpan={columns.length + 2} style={styles.addRowCell}>
                <button onClick={onAddRow} style={styles.addRowBtn}>+ Add Row</button>
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      {/* Status bar */}
      <div style={styles.statusBar}>
        <span>{selectionInfo || 'Ready'}</span>
      </div>

      {contextMenu && (
        <ContextMenu
          x={contextMenu.x}
          y={contextMenu.y}
          items={getContextMenuItems()}
          onClose={() => setContextMenu(null)}
        />
      )}

      <style>{`table, td, th { user-select: none; } ::selection { background: transparent; }`}</style>
    </div>
  );
}

const styles = {
  corner: { padding: '8px 12px', backgroundColor: '#f1f5f9', border: '1px solid #e2e8f0', color: '#64748b', fontSize: '11px', fontWeight: 600, position: 'sticky', top: 0, left: 0, zIndex: 3, width: '50px' },
  colHeader: { padding: '8px 14px', border: '1px solid #e2e8f0', color: '#374151', fontSize: '12px', fontWeight: 600, position: 'sticky', top: 0, zIndex: 2, width: '120px', textAlign: 'left' },
  addCol: { padding: '6px 10px', backgroundColor: '#f1f5f9', border: '1px solid #e2e8f0', position: 'sticky', top: 0, zIndex: 2, width: '40px' },
  addBtn: { background: 'none', border: 'none', color: '#94a3b8', cursor: 'pointer', fontSize: '16px' },
  rowHeader: { padding: '6px 12px', border: '1px solid #e2e8f0', color: '#64748b', fontSize: '11px', textAlign: 'center', position: 'sticky', left: 0, zIndex: 1, fontWeight: 500 },
  cell: { padding: 0, height: '32px', cursor: 'cell', overflow: 'hidden' },
  cellText: { padding: '6px 10px', fontSize: '13px', color: '#1e293b', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' },
  cellInput: { width: '100%', height: '100%', padding: '6px 10px', border: 'none', fontSize: '13px', outline: 'none', backgroundColor: 'transparent', boxSizing: 'border-box' },
  emptyCol: { border: '1px solid #e2e8f0', backgroundColor: '#fafafa' },
  addRowCell: { padding: '8px', backgroundColor: '#f8fafc', border: '1px solid #e2e8f0', textAlign: 'center' },
  addRowBtn: { padding: '6px 16px', backgroundColor: '#fff', border: '1px solid #d1d5db', borderRadius: '4px', color: '#374151', fontSize: '12px', cursor: 'pointer' },
  statusBar: { padding: '8px 12px', backgroundColor: '#f1f5f9', borderTop: '1px solid #e2e8f0', fontSize: '12px', color: '#374151', fontWeight: 500 }
};
