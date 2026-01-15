import React, { useState, useEffect } from 'react';

const QuantumCircuitBuilder = () => {
  const [tailwindLoaded, setTailwindLoaded] = useState(false);
  const [circuit, setCircuit] = useState([]);
  const [autoExecute, setAutoExecute] = useState(true);
  const [sharedCircuit, setSharedCircuit] = useGlobalStorage('quantum-circuit', null);

  // Load Tailwind CSS
  useEffect(() => {
    if (!document.getElementById('tailwind-script')) {
      const tailwindScript = document.createElement('script');
      tailwindScript.id = 'tailwind-script';
      tailwindScript.src = 'https://cdn.tailwindcss.com';
      tailwindScript.onload = () => {
        setTimeout(() => setTailwindLoaded(true), 100);
      };
      document.head.appendChild(tailwindScript);
    } else {
      setTailwindLoaded(true);
    }
  }, []);

  // Set body background to dark
  useEffect(() => {
    document.body.style.background = 'linear-gradient(135deg, #0f172a 0%, #1e293b 100%)';
    document.documentElement.style.minHeight = '100%';
    return () => {
      document.body.style.background = '';
      document.documentElement.style.minHeight = '';
    };
  }, []);

  // Auto-execute circuit when it changes
  useEffect(() => {
    if (autoExecute && circuit.length > 0) {
      setSharedCircuit({ circuit, timestamp: Date.now() });
    }
  }, [circuit, autoExecute]);

  // Available quantum gates
  const gates = [
    { name: 'H', label: 'Hadamard', description: 'Creates superposition', color: '#10b981', emoji: '⚡' },
    { name: 'X', label: 'Pauli-X', description: 'Bit flip (NOT)', color: '#3b82f6', emoji: '↕️' },
    { name: 'Y', label: 'Pauli-Y', description: 'Y rotation', color: '#8b5cf6', emoji: '🔄' },
    { name: 'Z', label: 'Pauli-Z', description: 'Phase flip', color: '#ec4899', emoji: '⭮' },
    { name: 'S', label: 'Phase', description: '+90° phase shift', color: '#f59e0b', emoji: '↻' },
    { name: 'T', label: 'T Gate', description: '+45° phase shift', color: '#ef4444', emoji: '↺' }
  ];

  const addGate = (gateName) => {
    setCircuit(prev => [...prev, { id: Date.now(), gate: gateName }]);
  };

  const removeGate = (id) => {
    setCircuit(prev => prev.filter(g => g.id !== id));
  };

  const clearCircuit = () => {
    setCircuit([]);
    setSharedCircuit(null);
  };

  const executeCircuit = () => {
    setSharedCircuit({ circuit, timestamp: Date.now() });
  };

  const moveGate = (index, direction) => {
    const newCircuit = [...circuit];
    const newIndex = index + direction;
    if (newIndex >= 0 && newIndex < newCircuit.length) {
      [newCircuit[index], newCircuit[newIndex]] = [newCircuit[newIndex], newCircuit[index]];
      setCircuit(newCircuit);
    }
  };

  const getGateInfo = (gateName) => {
    return gates.find(g => g.name === gateName) || { color: '#666', emoji: '•' };
  };

  if (!tailwindLoaded) {
    return <div style={{ padding: '20px', textAlign: 'center', fontFamily: 'Inter, sans-serif', color: '#fff' }}>Loading...</div>;
  }

  return (
    <div style={{ fontFamily: 'Inter, -apple-system, sans-serif' }} className="min-h-screen p-8">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-4xl font-bold text-white mb-2" style={{ textShadow: '0 0 30px rgba(99, 102, 241, 0.5)' }}>
            Quantum Circuit Builder
          </h1>
          <p className="text-lg text-purple-300 font-light">Design quantum circuits and send them to the simulator</p>
        </div>

        {/* Gate Palette */}
        <div 
          className="rounded-3xl p-8 mb-6 backdrop-blur-sm border border-purple-500/20"
          style={{ 
            background: 'linear-gradient(135deg, rgba(30, 41, 59, 0.8) 0%, rgba(15, 23, 42, 0.9) 100%)',
            boxShadow: '0 20px 60px rgba(0, 0, 0, 0.5), inset 0 0 60px rgba(139, 92, 246, 0.05)'
          }}
        >
          <h2 className="text-xl font-bold text-white mb-4">Gate Palette</h2>
          <p className="text-sm text-purple-300 mb-6 font-light">Click a gate to add it to your circuit</p>
          
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
            {gates.map(gate => (
              <button
                key={gate.name}
                onClick={() => addGate(gate.name)}
                className="px-6 py-4 rounded-xl text-white font-bold transition-all hover:scale-105 active:scale-95"
                style={{ 
                  background: `linear-gradient(135deg, ${gate.color} 0%, ${gate.color}dd 100%)`,
                  boxShadow: `0 10px 30px rgba(0,0,0,0.3), inset 0 0 20px rgba(255, 255, 255, 0.1)`,
                  border: `1px solid ${gate.color}44`
                }}
              >
                <div className="text-2xl mb-1">{gate.name}</div>
                <div className="text-xs font-normal opacity-90">{gate.label}</div>
              </button>
            ))}
          </div>

          {/* Gate Descriptions */}
          <div className="mt-6 pt-6 border-t border-purple-500/20">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs text-gray-400">
              {gates.map(gate => (
                <div key={gate.name} className="flex items-start gap-2">
                  <span className="font-bold" style={{ color: gate.color }}>{gate.name}:</span>
                  <span className="font-light">{gate.description}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Circuit Display */}
        <div 
          className="rounded-3xl p-8 mb-6 backdrop-blur-sm border border-purple-500/20"
          style={{ 
            background: 'linear-gradient(135deg, rgba(30, 41, 59, 0.8) 0%, rgba(15, 23, 42, 0.9) 100%)',
            boxShadow: '0 20px 60px rgba(0, 0, 0, 0.5), inset 0 0 60px rgba(139, 92, 246, 0.05)'
          }}
        >
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-xl font-bold text-white">Circuit</h2>
              <p className="text-sm text-purple-300 font-light mt-1">
                {circuit.length} gate{circuit.length !== 1 ? 's' : ''} in sequence
              </p>
            </div>
            {circuit.length > 0 && (
              <button
                onClick={clearCircuit}
                className="px-4 py-2 text-sm text-purple-400 hover:text-purple-300 font-medium rounded-lg"
                style={{ background: 'rgba(139, 92, 246, 0.2)' }}
              >
                Clear All
              </button>
            )}
          </div>

          {circuit.length === 0 ? (
            <div className="text-center py-12 text-gray-500 font-light">
              <div className="text-4xl mb-3">⚛️</div>
              <div className="text-sm text-gray-400">No gates added yet</div>
              <div className="text-xs mt-1 text-gray-500">Click a gate above to start building</div>
            </div>
          ) : (
            <div className="space-y-3">
              {/* Circuit Visualization Line */}
              <div className="flex items-center gap-2 overflow-x-auto pb-4">
                <div className="text-xs text-purple-400 font-bold whitespace-nowrap mr-2">|ψ⟩ →</div>
                {circuit.map((item, index) => {
                  const gateInfo = getGateInfo(item.gate);
                  return (
                    <React.Fragment key={item.id}>
                      <div 
                        className="flex-shrink-0 w-16 h-16 rounded-lg flex items-center justify-center text-white font-bold text-xl"
                        style={{ 
                          background: `linear-gradient(135deg, ${gateInfo.color} 0%, ${gateInfo.color}dd 100%)`,
                          boxShadow: `0 4px 12px rgba(0,0,0,0.3), inset 0 0 10px rgba(255, 255, 255, 0.1)`
                        }}
                      >
                        {item.gate}
                      </div>
                      {index < circuit.length - 1 && (
                        <div className="flex-shrink-0 w-8 h-0.5 bg-purple-500/30"></div>
                      )}
                    </React.Fragment>
                  );
                })}
                <div className="text-xs text-purple-400 font-bold whitespace-nowrap ml-2">→ |ψ'⟩</div>
              </div>

              {/* Gate List with Controls */}
              <div className="space-y-2">
                {circuit.map((item, index) => {
                  const gateInfo = getGateInfo(item.gate);
                  return (
                    <div
                      key={item.id}
                      className="flex items-center gap-3 p-4 rounded-xl border border-purple-500/20"
                      style={{ background: 'rgba(0, 0, 0, 0.3)' }}
                    >
                      <div className="flex items-center gap-3 flex-1">
                        <div className="text-xs text-gray-500 font-medium w-8">#{index + 1}</div>
                        <div 
                          className="w-10 h-10 rounded-lg flex items-center justify-center text-white font-bold"
                          style={{ 
                            background: `linear-gradient(135deg, ${gateInfo.color} 0%, ${gateInfo.color}dd 100%)`,
                            boxShadow: `0 2px 8px rgba(0,0,0,0.3)`
                          }}
                        >
                          {item.gate}
                        </div>
                        <div className="flex-1">
                          <div className="text-sm font-medium text-white">
                            {gates.find(g => g.name === item.gate)?.label}
                          </div>
                          <div className="text-xs text-gray-400 font-light">
                            {gates.find(g => g.name === item.gate)?.description}
                          </div>
                        </div>
                      </div>

                      {/* Controls */}
                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => moveGate(index, -1)}
                          disabled={index === 0}
                          className="p-2 text-purple-400 hover:text-purple-300 disabled:opacity-30 disabled:cursor-not-allowed"
                          title="Move earlier"
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                          </svg>
                        </button>
                        <button
                          onClick={() => moveGate(index, 1)}
                          disabled={index === circuit.length - 1}
                          className="p-2 text-purple-400 hover:text-purple-300 disabled:opacity-30 disabled:cursor-not-allowed"
                          title="Move later"
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                          </svg>
                        </button>
                        <button
                          onClick={() => removeGate(item.id)}
                          className="p-2 text-red-400 hover:text-red-300 ml-2"
                          title="Remove gate"
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                          </svg>
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        {/* Controls */}
        <div 
          className="rounded-3xl p-8 backdrop-blur-sm border border-purple-500/20"
          style={{ 
            background: 'linear-gradient(135deg, rgba(30, 41, 59, 0.8) 0%, rgba(15, 23, 42, 0.9) 100%)',
            boxShadow: '0 20px 60px rgba(0, 0, 0, 0.5), inset 0 0 60px rgba(139, 92, 246, 0.05)'
          }}
        >
          <div className="flex items-center justify-between mb-6">
            <div>
              <h2 className="text-xl font-bold text-white">Execution</h2>
              <p className="text-sm text-purple-300 font-light mt-1">Send circuit to quantum simulator</p>
            </div>
            
            <label className="flex items-center gap-3 cursor-pointer">
              <span className="text-sm text-purple-300 font-light">Auto-execute</span>
              <div className="relative">
                <input
                  type="checkbox"
                  checked={autoExecute}
                  onChange={(e) => setAutoExecute(e.target.checked)}
                  className="sr-only peer"
                />
                <div className="w-11 h-6 bg-purple-900/50 rounded-full peer peer-checked:bg-indigo-500 transition-colors"></div>
                <div className="absolute left-1 top-1 w-4 h-4 bg-white rounded-full transition-transform peer-checked:translate-x-5"></div>
              </div>
            </label>
          </div>

          {!autoExecute && circuit.length > 0 && (
            <button
              onClick={executeCircuit}
              className="w-full px-6 py-4 text-white rounded-xl font-medium hover:scale-105 active:scale-95 transition-all"
              style={{ 
                background: 'linear-gradient(135deg, #6366f1 0%, #4f46e5 100%)',
                boxShadow: '0 10px 30px rgba(99, 102, 241, 0.3)'
              }}
            >
              Execute Circuit
            </button>
          )}

          {autoExecute && (
            <div className="text-center py-3 text-sm text-purple-300 font-light">
              Circuit automatically sends to simulator as you build
            </div>
          )}

          {/* Connection Status */}
          <div className="mt-6 pt-6 border-t border-purple-500/20">
            <div className="flex items-center gap-2 text-xs text-purple-300">
              <div className="w-2 h-2 bg-green-400 rounded-full animate-pulse"></div>
              <span className="font-light">Broadcasting to quantum simulator</span>
            </div>
            <p className="text-xs text-gray-400 font-light mt-2">
              Circuits are automatically shared with all quantum simulator widgets on this canvas
            </p>
          </div>
        </div>

        {/* Famous Quantum Circuits */}
        <div 
          className="mt-6 rounded-3xl p-8 backdrop-blur-sm border border-purple-500/20"
          style={{ 
            background: 'linear-gradient(135deg, rgba(30, 41, 59, 0.8) 0%, rgba(15, 23, 42, 0.9) 100%)',
            boxShadow: '0 20px 60px rgba(0, 0, 0, 0.5), inset 0 0 60px rgba(139, 92, 246, 0.05)'
          }}
        >
          <h2 className="text-xl font-bold text-white mb-4">Quick Start Circuits</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <button
              onClick={() => setCircuit([
                { id: Date.now(), gate: 'H' }
              ])}
              className="text-left px-4 py-3 rounded-xl border border-purple-500/20 hover:bg-purple-500/10 transition-all"
              style={{ background: 'rgba(0, 0, 0, 0.3)' }}
            >
              <div className="text-sm font-medium text-white">Equal Superposition</div>
              <div className="text-xs text-purple-300 font-light mt-1">H → Creates 50/50 state</div>
            </button>
            
            <button
              onClick={() => setCircuit([
                { id: Date.now(), gate: 'X' }
              ])}
              className="text-left px-4 py-3 rounded-xl border border-purple-500/20 hover:bg-purple-500/10 transition-all"
              style={{ background: 'rgba(0, 0, 0, 0.3)' }}
            >
              <div className="text-sm font-medium text-white">Bit Flip</div>
              <div className="text-xs text-purple-300 font-light mt-1">X → Flips |0⟩ to |1⟩</div>
            </button>
            
            <button
              onClick={() => setCircuit([
                { id: Date.now(), gate: 'H' },
                { id: Date.now() + 1, gate: 'T' },
                { id: Date.now() + 2, gate: 'H' }
              ])}
              className="text-left px-4 py-3 rounded-xl border border-purple-500/20 hover:bg-purple-500/10 transition-all"
              style={{ background: 'rgba(0, 0, 0, 0.3)' }}
            >
              <div className="text-sm font-medium text-white">Phase Rotation</div>
              <div className="text-xs text-purple-300 font-light mt-1">H → T → H</div>
            </button>
            
            <button
              onClick={() => setCircuit([
                { id: Date.now(), gate: 'H' },
                { id: Date.now() + 1, gate: 'S' },
                { id: Date.now() + 2, gate: 'H' }
              ])}
              className="text-left px-4 py-3 rounded-xl border border-purple-500/20 hover:bg-purple-500/10 transition-all"
              style={{ background: 'rgba(0, 0, 0, 0.3)' }}
            >
              <div className="text-sm font-medium text-white">S Gate Demo</div>
              <div className="text-xs text-purple-300 font-light mt-1">H → S → H</div>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default QuantumCircuitBuilder;
