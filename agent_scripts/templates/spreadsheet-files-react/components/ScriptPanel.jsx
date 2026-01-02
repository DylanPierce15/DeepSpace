import React, { useState, useCallback, useRef, useEffect } from 'react';

/**
 * ScriptPanel - Edit and run JavaScript scripts (Light theme)
 */
export default function ScriptPanel({
  scriptPath,
  scriptContent,
  onSaveScript,
  onRunScript,
  lastResult
}) {
  const [localContent, setLocalContent] = useState('');
  const [isRunning, setIsRunning] = useState(false);
  const debounceRef = useRef(null);

  useEffect(() => {
    setLocalContent(scriptContent || getDefaultScript());
  }, [scriptPath, scriptContent]);

  const handleChange = useCallback((value) => {
    setLocalContent(value);
    
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      onSaveScript(value);
    }, 500);
  }, [onSaveScript]);

  const handleRun = useCallback(async () => {
    setIsRunning(true);
    try {
      await onRunScript(localContent);
    } finally {
      setIsRunning(false);
    }
  }, [localContent, onRunScript]);

  if (!scriptPath) {
    return (
      <div style={{
        flex: 1,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: '#f8fafc',
        color: '#94a3b8',
        fontSize: '14px',
        flexDirection: 'column',
        gap: '10px'
      }}>
        <span style={{ fontSize: '36px' }}>⚡</span>
        <span>Select a .js script to edit</span>
      </div>
    );
  }

  return (
    <div style={{
      flex: 1,
      display: 'flex',
      flexDirection: 'column',
      backgroundColor: '#fff',
      overflow: 'hidden'
    }}>
      {/* Toolbar */}
      <div style={{
        padding: '10px 14px',
        backgroundColor: '#fffbeb',
        borderBottom: '1px solid #fde68a',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <span style={{ fontSize: '14px' }}>⚡</span>
          <span style={{ color: '#92400e', fontSize: '13px', fontWeight: 600 }}>
            {scriptPath.split('/').pop()}
          </span>
        </div>
        <button
          onClick={handleRun}
          disabled={isRunning}
          style={{
            padding: '8px 16px',
            backgroundColor: isRunning ? '#94a3b8' : '#22c55e',
            border: 'none',
            borderRadius: '6px',
            color: 'white',
            fontSize: '12px',
            fontWeight: 600,
            cursor: isRunning ? 'wait' : 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '6px'
          }}
        >
          {isRunning ? '⏳ Running...' : '▶ Run Script'}
        </button>
      </div>

      {/* Editor */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        <textarea
          value={localContent}
          onChange={(e) => handleChange(e.target.value)}
          spellCheck={false}
          style={{
            flex: 1,
            padding: '16px',
            backgroundColor: '#fafafa',
            border: 'none',
            color: '#1e293b',
            fontFamily: '"JetBrains Mono", "Fira Code", "Monaco", monospace',
            fontSize: '13px',
            lineHeight: 1.7,
            resize: 'none',
            outline: 'none',
            tabSize: 2
          }}
        />
      </div>

      {/* Result panel */}
      {lastResult && (
        <div style={{
          padding: '12px 14px',
          backgroundColor: lastResult.success ? '#f0fdf4' : '#fef2f2',
          borderTop: lastResult.success ? '1px solid #bbf7d0' : '1px solid #fecaca',
          maxHeight: '100px',
          overflow: 'auto'
        }}>
          <div style={{
            color: lastResult.success ? '#166534' : '#991b1b',
            fontSize: '12px',
            fontFamily: 'monospace'
          }}>
            {lastResult.success ? '✓ ' : '✗ '}
            {lastResult.message}
          </div>
        </div>
      )}

      {/* Help */}
      <div style={{
        padding: '10px 14px',
        backgroundColor: '#f1f5f9',
        borderTop: '1px solid #e2e8f0',
        fontSize: '11px',
        color: '#64748b'
      }}>
        <strong>API:</strong> <code style={{ backgroundColor: '#e2e8f0', padding: '1px 4px', borderRadius: '3px' }}>data</code> (rows), 
        <code style={{ backgroundColor: '#e2e8f0', padding: '1px 4px', borderRadius: '3px', marginLeft: '4px' }}>columns</code> (names) 
        → return <code style={{ backgroundColor: '#e2e8f0', padding: '1px 4px', borderRadius: '3px' }}>{'{ data, columns }'}</code>
      </div>
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
