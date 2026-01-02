import React from 'react';

/**
 * HeaderBar - Shows current file and actions
 * Fixed height to prevent layout shifts
 */
export default function HeaderBar({
  currentFile,
  fileType,
  onExportCSV,
  onImportCSV
}) {
  const fileName = currentFile ? currentFile.split('/').pop() : 'No file selected';

  return (
    <div style={{
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      padding: '10px 16px',
      backgroundColor: '#f8fafc',
      borderBottom: '1px solid #e2e8f0',
      height: '48px',
      minHeight: '48px',
      maxHeight: '48px'
    }}>
      {/* Left: File info */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '10px', minWidth: 0 }}>
        <span style={{ fontSize: '16px', flexShrink: 0 }}>
          {fileType === 'csv' ? '📊' : fileType === 'js' ? '⚡' : '📄'}
        </span>
        <span style={{
          color: '#1e293b',
          fontSize: '14px',
          fontWeight: 600,
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap'
        }}>
          {fileName}
        </span>
        {fileType && (
          <span style={{
            padding: '3px 8px',
            backgroundColor: fileType === 'csv' ? '#dbeafe' : '#fef3c7',
            color: fileType === 'csv' ? '#1d4ed8' : '#b45309',
            borderRadius: '4px',
            fontSize: '10px',
            fontWeight: 700,
            textTransform: 'uppercase',
            flexShrink: 0
          }}>
            {fileType}
          </span>
        )}
      </div>

      {/* Right: Actions */}
      {fileType === 'csv' && (
        <div style={{ display: 'flex', gap: '8px', flexShrink: 0 }}>
          <label style={{
            padding: '6px 12px',
            backgroundColor: '#fff',
            border: '1px solid #e2e8f0',
            borderRadius: '6px',
            color: '#475569',
            fontSize: '12px',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
            fontWeight: 500
          }}>
            ↑ Import
            <input
              type="file"
              accept=".csv"
              onChange={onImportCSV}
              style={{ display: 'none' }}
            />
          </label>
          <button
            onClick={onExportCSV}
            style={{
              padding: '6px 12px',
              backgroundColor: '#fff',
              border: '1px solid #e2e8f0',
              borderRadius: '6px',
              color: '#475569',
              fontSize: '12px',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              fontWeight: 500
            }}
          >
            ↓ Export
          </button>
        </div>
      )}
    </div>
  );
}
