import React, { useState, useEffect } from 'react';

function IOTestWidget() {
  // 2 Inputs
  const input1 = useInput('input-slot-1', '');
  const input2 = useInput('input-slot-2', '');
  
  // 2 Outputs
  const setOutput1 = useOutput('output-slot-1');
  const setOutput2 = useOutput('output-slot-2');
  
  const [result1, setResult1] = useState('');
  const [result2, setResult2] = useState('');
  
  // Process inputs when they change
  useEffect(() => {
    if (input1 || input2) {
      // Output 1: Combine both inputs
      const combined = `Combined: ${input1 || '(empty)'} + ${input2 || '(empty)'}`;
      setResult1(combined);
      setOutput1(combined);
      
      // Output 2: Count characters
      const count = `Total characters: ${(input1.length + input2.length)}`;
      setResult2(count);
      setOutput2(count);
    }
  }, [input1, input2]);
  
  return (
    <div style={{
      padding: '16px',
      fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
      background: '#ffffff',
      minHeight: '100vh',
      display: 'flex',
      flexDirection: 'column',
      gap: '12px'
    }}>
      <div style={{ fontSize: '16px', fontWeight: '600', color: '#1f2937' }}>
        🧪 IO Test Widget (2×2)
      </div>
      
      {/* Inputs Display */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
        <div style={{
          padding: '10px',
          background: '#eff6ff',
          border: '1px solid #bfdbfe',
          borderRadius: '6px',
          fontSize: '13px'
        }}>
          <strong>Input 1:</strong> {input1 || '(waiting for connection...)'}
        </div>
        
        <div style={{
          padding: '10px',
          background: '#eff6ff',
          border: '1px solid #bfdbfe',
          borderRadius: '6px',
          fontSize: '13px'
        }}>
          <strong>Input 2:</strong> {input2 || '(waiting for connection...)'}
        </div>
      </div>
      
      <div style={{
        height: '1px',
        background: '#e5e7eb',
        margin: '8px 0'
      }} />
      
      {/* Outputs Display */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
        <div style={{
          padding: '10px',
          background: '#fef2f2',
          border: '1px solid #fecaca',
          borderRadius: '6px',
          fontSize: '13px'
        }}>
          <strong>Output 1:</strong> {result1 || '(no inputs yet)'}
        </div>
        
        <div style={{
          padding: '10px',
          background: '#fef2f2',
          border: '1px solid #fecaca',
          borderRadius: '6px',
          fontSize: '13px'
        }}>
          <strong>Output 2:</strong> {result2 || '(no inputs yet)'}
        </div>
      </div>
      
      <div style={{
        marginTop: 'auto',
        padding: '10px',
        background: '#f9fafb',
        borderRadius: '6px',
        fontSize: '11px',
        color: '#6b7280'
      }}>
        <strong>Auto-Detected:</strong> 2 input slots, 2 output slots
      </div>
    </div>
  );
}

export default IOTestWidget;

