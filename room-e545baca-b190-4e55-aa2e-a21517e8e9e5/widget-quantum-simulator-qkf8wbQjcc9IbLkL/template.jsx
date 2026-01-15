import React, { useState, useEffect, useRef } from 'react';

const QuantumSimulator = () => {
  const [tailwindLoaded, setTailwindLoaded] = useState(false);
  const [qubits, setQubits] = useState([{ alpha: 1, beta: 0, id: 0 }]); // |0⟩ state
  const [selectedQubit, setSelectedQubit] = useState(0);
  const [circuit, setCircuit] = useState([]);
  const canvasRef = useRef(null);

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

  // Set body background
  useEffect(() => {
    document.body.style.background = '#ffffff';
    document.documentElement.style.minHeight = '100%';
    return () => {
      document.body.style.background = '';
      document.documentElement.style.minHeight = '';
    };
  }, []);

  // Draw Bloch sphere
  useEffect(() => {
    if (!canvasRef.current || !tailwindLoaded) return;

    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    const centerX = canvas.width / 2;
    const centerY = canvas.height / 2;
    const radius = 80;

    // Clear canvas
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Draw sphere outline
    ctx.strokeStyle = '#e0e0e0';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.arc(centerX, centerY, radius, 0, 2 * Math.PI);
    ctx.stroke();

    // Draw axes
    ctx.strokeStyle = '#d0d0d0';
    ctx.lineWidth = 1;
    
    // X axis
    ctx.beginPath();
    ctx.moveTo(centerX - radius - 10, centerY);
    ctx.lineTo(centerX + radius + 10, centerY);
    ctx.stroke();
    
    // Y axis (ellipse for 3D effect)
    ctx.beginPath();
    ctx.ellipse(centerX, centerY, radius, radius * 0.3, 0, 0, 2 * Math.PI);
    ctx.stroke();
    
    // Z axis
    ctx.beginPath();
    ctx.moveTo(centerX, centerY - radius - 10);
    ctx.lineTo(centerX, centerY + radius + 10);
    ctx.stroke();

    // Draw axis labels
    ctx.fillStyle = '#666666';
    ctx.font = '12px Inter, sans-serif';
    ctx.fillText('X', centerX + radius + 15, centerY + 5);
    ctx.fillText('Y', centerX + 5, centerY + radius * 0.3 + 15);
    ctx.fillText('|0⟩', centerX + 5, centerY - radius - 12);
    ctx.fillText('|1⟩', centerX + 5, centerY + radius + 20);

    // Calculate Bloch sphere coordinates for selected qubit
    const qubit = qubits[selectedQubit];
    const { alpha, beta } = qubit;
    
    // |ψ⟩ = α|0⟩ + β|1⟩
    // Bloch sphere: θ and φ
    const alphaMag = Math.sqrt(alpha.real ** 2 + alpha.imag ** 2);
    const betaMag = Math.sqrt(beta.real ** 2 + beta.imag ** 2);
    
    const theta = 2 * Math.acos(alphaMag);
    const phiAlpha = Math.atan2(alpha.imag || 0, alpha.real);
    const phiBeta = Math.atan2(beta.imag || 0, beta.real);
    const phi = phiBeta - phiAlpha;

    // Convert to 3D coordinates
    const x = Math.sin(theta) * Math.cos(phi);
    const y = Math.sin(theta) * Math.sin(phi);
    const z = Math.cos(theta);

    // Project to 2D
    const screenX = centerX + x * radius;
    const screenY = centerY - z * radius;

    // Draw state vector
    ctx.strokeStyle = '#6366f1';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(centerX, centerY);
    ctx.lineTo(screenX, screenY);
    ctx.stroke();

    // Draw state point
    ctx.fillStyle = '#6366f1';
    ctx.beginPath();
    ctx.arc(screenX, screenY, 6, 0, 2 * Math.PI);
    ctx.fill();

  }, [qubits, selectedQubit, tailwindLoaded]);

  // Quantum gates
  const gates = {
    X: { // Pauli-X (NOT gate)
      matrix: [[0, 1], [1, 0]],
      description: 'Bit flip',
      color: '#6366f1'
    },
    Y: { // Pauli-Y
      matrix: [[0, { real: 0, imag: -1 }], [{ real: 0, imag: 1 }, 0]],
      description: 'Y rotation',
      color: '#8b5cf6'
    },
    Z: { // Pauli-Z
      matrix: [[1, 0], [0, -1]],
      description: 'Phase flip',
      color: '#ec4899'
    },
    H: { // Hadamard
      matrix: [[1/Math.sqrt(2), 1/Math.sqrt(2)], [1/Math.sqrt(2), -1/Math.sqrt(2)]],
      description: 'Superposition',
      color: '#10b981'
    },
    S: { // Phase gate
      matrix: [[1, 0], [0, { real: 0, imag: 1 }]],
      description: 'Phase +90°',
      color: '#f59e0b'
    },
    T: { // π/8 gate
      matrix: [[1, 0], [0, { real: Math.cos(Math.PI/4), imag: Math.sin(Math.PI/4) }]],
      description: 'Phase +45°',
      color: '#ef4444'
    }
  };

  // Complex number multiplication
  const complexMult = (a, b) => {
    const aReal = typeof a === 'number' ? a : (a.real || 0);
    const aImag = typeof a === 'number' ? 0 : (a.imag || 0);
    const bReal = typeof b === 'number' ? b : (b.real || 0);
    const bImag = typeof b === 'number' ? 0 : (b.imag || 0);
    
    return {
      real: aReal * bReal - aImag * bImag,
      imag: aReal * bImag + aImag * bReal
    };
  };

  // Complex number addition
  const complexAdd = (a, b) => {
    const aReal = typeof a === 'number' ? a : (a.real || 0);
    const aImag = typeof a === 'number' ? 0 : (a.imag || 0);
    const bReal = typeof b === 'number' ? b : (b.real || 0);
    const bImag = typeof b === 'number' ? 0 : (b.imag || 0);
    
    return {
      real: aReal + bReal,
      imag: aImag + bImag
    };
  };

  // Apply gate to qubit
  const applyGate = (gateName) => {
    const gate = gates[gateName];
    const qubit = qubits[selectedQubit];
    
    // Matrix multiplication: [a', b'] = gate * [a, b]
    const newAlpha = complexAdd(
      complexMult(gate.matrix[0][0], qubit.alpha),
      complexMult(gate.matrix[0][1], qubit.beta)
    );
    
    const newBeta = complexAdd(
      complexMult(gate.matrix[1][0], qubit.alpha),
      complexMult(gate.matrix[1][1], qubit.beta)
    );

    // Update qubit
    const newQubits = [...qubits];
    newQubits[selectedQubit] = {
      ...qubit,
      alpha: newAlpha,
      beta: newBeta
    };
    setQubits(newQubits);

    // Add to circuit
    setCircuit(prev => [...prev, { gate: gateName, qubit: selectedQubit, time: Date.now() }]);
  };

  // Reset qubit to |0⟩
  const resetQubit = () => {
    const newQubits = [...qubits];
    newQubits[selectedQubit] = { alpha: { real: 1, imag: 0 }, beta: { real: 0, imag: 0 }, id: selectedQubit };
    setQubits(newQubits);
  };

  // Set qubit to |1⟩
  const setToOne = () => {
    const newQubits = [...qubits];
    newQubits[selectedQubit] = { alpha: { real: 0, imag: 0 }, beta: { real: 1, imag: 0 }, id: selectedQubit };
    setQubits(newQubits);
  };

  // Format complex number
  const formatComplex = (c) => {
    const real = typeof c === 'number' ? c : (c.real || 0);
    const imag = typeof c === 'number' ? 0 : (c.imag || 0);
    
    if (Math.abs(imag) < 0.0001) {
      return real.toFixed(3);
    }
    
    const sign = imag >= 0 ? '+' : '';
    return `${real.toFixed(3)}${sign}${imag.toFixed(3)}i`;
  };

  // Calculate probabilities
  const getProbabilities = () => {
    const qubit = qubits[selectedQubit];
    const alphaReal = typeof qubit.alpha === 'number' ? qubit.alpha : (qubit.alpha.real || 0);
    const alphaImag = typeof qubit.alpha === 'number' ? 0 : (qubit.alpha.imag || 0);
    const betaReal = typeof qubit.beta === 'number' ? qubit.beta : (qubit.beta.real || 0);
    const betaImag = typeof qubit.beta === 'number' ? 0 : (qubit.beta.imag || 0);
    
    const prob0 = alphaReal ** 2 + alphaImag ** 2;
    const prob1 = betaReal ** 2 + betaImag ** 2;
    
    return { prob0, prob1 };
  };

  if (!tailwindLoaded) {
    return <div style={{ padding: '20px', textAlign: 'center', fontFamily: 'Inter, sans-serif' }}>Loading...</div>;
  }

  const { prob0, prob1 } = getProbabilities();

  return (
    <div style={{ fontFamily: 'Inter, -apple-system, sans-serif' }} className="min-h-screen bg-white p-8">
      <div className="max-w-5xl mx-auto">
        {/* Header */}
        <div className="mb-12">
          <h1 className="text-3xl font-light text-gray-900 mb-2">Quantum Computing Simulator</h1>
          <p className="text-sm text-gray-500 font-light">Visualize quantum states and gate operations</p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Left Column: Bloch Sphere */}
          <div>
            <div className="bg-white rounded-2xl p-8" style={{ boxShadow: '0 20px 60px rgba(0,0,0,0.03)' }}>
              <h2 className="text-lg font-medium text-gray-900 mb-6">Bloch Sphere</h2>
              
              <div className="flex justify-center mb-6">
                <canvas 
                  ref={canvasRef} 
                  width="240" 
                  height="240"
                  className="border border-gray-100 rounded-xl"
                />
              </div>

              {/* State Vector */}
              <div className="bg-gray-50 rounded-xl p-6 mb-6">
                <div className="text-sm font-medium text-gray-700 mb-3">State Vector</div>
                <div className="font-mono text-sm text-gray-800">
                  |ψ⟩ = {formatComplex(qubits[selectedQubit].alpha)}|0⟩ + {formatComplex(qubits[selectedQubit].beta)}|1⟩
                </div>
              </div>

              {/* Probabilities */}
              <div className="space-y-3">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-gray-600 font-light">P(|0⟩)</span>
                  <span className="font-medium text-gray-900">{(prob0 * 100).toFixed(1)}%</span>
                </div>
                <div className="w-full bg-gray-100 rounded-full h-2">
                  <div 
                    className="bg-indigo-500 h-2 rounded-full transition-all duration-300"
                    style={{ width: `${prob0 * 100}%` }}
                  />
                </div>

                <div className="flex items-center justify-between text-sm pt-2">
                  <span className="text-gray-600 font-light">P(|1⟩)</span>
                  <span className="font-medium text-gray-900">{(prob1 * 100).toFixed(1)}%</span>
                </div>
                <div className="w-full bg-gray-100 rounded-full h-2">
                  <div 
                    className="bg-indigo-500 h-2 rounded-full transition-all duration-300"
                    style={{ width: `${prob1 * 100}%` }}
                  />
                </div>
              </div>

              {/* State Controls */}
              <div className="flex gap-3 mt-6">
                <button
                  onClick={resetQubit}
                  className="flex-1 px-4 py-3 bg-white text-gray-700 text-sm font-medium rounded-xl border border-gray-200 hover:bg-gray-50 transition-colors"
                >
                  |0⟩
                </button>
                <button
                  onClick={setToOne}
                  className="flex-1 px-4 py-3 bg-white text-gray-700 text-sm font-medium rounded-xl border border-gray-200 hover:bg-gray-50 transition-colors"
                >
                  |1⟩
                </button>
              </div>
            </div>
          </div>

          {/* Right Column: Quantum Gates */}
          <div>
            <div className="bg-white rounded-2xl p-8" style={{ boxShadow: '0 20px 60px rgba(0,0,0,0.03)' }}>
              <h2 className="text-lg font-medium text-gray-900 mb-6">Quantum Gates</h2>
              
              <div className="grid grid-cols-2 gap-3 mb-8">
                {Object.entries(gates).map(([name, gate]) => (
                  <button
                    key={name}
                    onClick={() => applyGate(name)}
                    className="px-6 py-4 rounded-xl text-white font-medium text-sm transition-all hover:scale-105 active:scale-95"
                    style={{ 
                      backgroundColor: gate.color,
                      boxShadow: '0 10px 30px rgba(0,0,0,0.1)'
                    }}
                  >
                    <div className="text-lg mb-1">{name}</div>
                    <div className="text-xs font-light opacity-90">{gate.description}</div>
                  </button>
                ))}
              </div>

              {/* Circuit History */}
              <div>
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-sm font-medium text-gray-900">Circuit History</h3>
                  {circuit.length > 0 && (
                    <button
                      onClick={() => setCircuit([])}
                      className="text-xs text-gray-500 hover:text-gray-700 font-light"
                    >
                      Clear
                    </button>
                  )}
                </div>
                
                <div className="bg-gray-50 rounded-xl p-4 min-h-[120px] max-h-[300px] overflow-y-auto">
                  {circuit.length === 0 ? (
                    <div className="text-sm text-gray-400 text-center py-8 font-light">
                      No gates applied yet
                    </div>
                  ) : (
                    <div className="flex flex-wrap gap-2">
                      {circuit.map((step, idx) => (
                        <div
                          key={step.time}
                          className="inline-flex items-center gap-2 px-3 py-2 bg-white rounded-lg text-sm border border-gray-200"
                        >
                          <span className="text-gray-400 font-light">{idx + 1}.</span>
                          <span 
                            className="font-medium"
                            style={{ color: gates[step.gate].color }}
                          >
                            {step.gate}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              {/* Gate Descriptions */}
              <div className="mt-8 pt-6 border-t border-gray-100">
                <h3 className="text-sm font-medium text-gray-900 mb-4">Gate Reference</h3>
                <div className="space-y-2 text-xs text-gray-600 font-light">
                  <div><span className="font-medium">X:</span> Pauli-X gate (NOT) - flips |0⟩ ↔ |1⟩</div>
                  <div><span className="font-medium">H:</span> Hadamard - creates equal superposition</div>
                  <div><span className="font-medium">Z:</span> Pauli-Z - adds phase to |1⟩</div>
                  <div><span className="font-medium">Y:</span> Pauli-Y - combination of X and Z</div>
                  <div><span className="font-medium">S:</span> Phase gate - adds 90° phase</div>
                  <div><span className="font-medium">T:</span> π/8 gate - adds 45° phase</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default QuantumSimulator;
