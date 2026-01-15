import React, { useState, useEffect, useRef } from 'react';

const QuantumSimulator = () => {
  const [tailwindLoaded, setTailwindLoaded] = useState(false);
  const [qubits, setQubits] = useState([{ alpha: { real: 1, imag: 0 }, beta: { real: 0, imag: 0 }, id: 0 }]);
  const [selectedQubit, setSelectedQubit] = useState(0);
  const [circuit, setCircuit] = useState([]);
  const [animatingGate, setAnimatingGate] = useState(null);
  const [showPhase, setShowPhase] = useState(true);
  const blochCanvasRef = useRef(null);
  const waveCanvasRef = useRef(null);
  const animationRef = useRef(null);

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

  // Quantum gates with enhanced visual properties
  const gates = {
    X: {
      matrix: [[0, 1], [1, 0]],
      description: 'Bit flip',
      color: '#3b82f6',
      glow: 'rgba(59, 130, 246, 0.5)',
      icon: '↕️'
    },
    H: {
      matrix: [[1/Math.sqrt(2), 1/Math.sqrt(2)], [1/Math.sqrt(2), -1/Math.sqrt(2)]],
      description: 'Superposition',
      color: '#10b981',
      glow: 'rgba(16, 185, 129, 0.5)',
      icon: '⚡'
    },
    Y: {
      matrix: [[0, { real: 0, imag: -1 }], [{ real: 0, imag: 1 }, 0]],
      description: 'Y rotation',
      color: '#8b5cf6',
      glow: 'rgba(139, 92, 246, 0.5)',
      icon: '🔄'
    },
    Z: {
      matrix: [[1, 0], [0, -1]],
      description: 'Phase flip',
      color: '#ec4899',
      glow: 'rgba(236, 72, 153, 0.5)',
      icon: '⭮'
    },
    S: {
      matrix: [[1, 0], [0, { real: 0, imag: 1 }]],
      description: 'Phase +90°',
      color: '#f59e0b',
      glow: 'rgba(245, 158, 11, 0.5)',
      icon: '↻'
    },
    T: {
      matrix: [[1, 0], [0, { real: Math.cos(Math.PI/4), imag: Math.sin(Math.PI/4) }]],
      description: 'Phase +45°',
      color: '#ef4444',
      glow: 'rgba(239, 68, 68, 0.5)',
      icon: '↺'
    }
  };

  // Complex number operations
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

  // Apply gate with animation
  const applyGate = (gateName) => {
    const gate = gates[gateName];
    const qubit = qubits[selectedQubit];
    
    setAnimatingGate(gateName);
    setTimeout(() => setAnimatingGate(null), 500);
    
    const newAlpha = complexAdd(
      complexMult(gate.matrix[0][0], qubit.alpha),
      complexMult(gate.matrix[0][1], qubit.beta)
    );
    
    const newBeta = complexAdd(
      complexMult(gate.matrix[1][0], qubit.alpha),
      complexMult(gate.matrix[1][1], qubit.beta)
    );

    const newQubits = [...qubits];
    newQubits[selectedQubit] = {
      ...qubit,
      alpha: newAlpha,
      beta: newBeta
    };
    setQubits(newQubits);
    setCircuit(prev => [...prev, { gate: gateName, qubit: selectedQubit, time: Date.now() }]);
  };

  // Draw enhanced Bloch sphere with animation
  useEffect(() => {
    if (!blochCanvasRef.current || !tailwindLoaded) return;

    const canvas = blochCanvasRef.current;
    const ctx = canvas.getContext('2d');
    const centerX = canvas.width / 2;
    const centerY = canvas.height / 2;
    const radius = 100;
    let animationFrame = 0;

    const animate = () => {
      animationFrame++;
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      // Gradient background
      const bgGradient = ctx.createRadialGradient(centerX, centerY, 0, centerX, centerY, radius * 1.5);
      bgGradient.addColorStop(0, 'rgba(99, 102, 241, 0.05)');
      bgGradient.addColorStop(1, 'rgba(0, 0, 0, 0)');
      ctx.fillStyle = bgGradient;
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      // Draw sphere with gradient
      const sphereGradient = ctx.createRadialGradient(centerX - 30, centerY - 30, 0, centerX, centerY, radius);
      sphereGradient.addColorStop(0, 'rgba(99, 102, 241, 0.15)');
      sphereGradient.addColorStop(1, 'rgba(99, 102, 241, 0.03)');
      ctx.fillStyle = sphereGradient;
      ctx.beginPath();
      ctx.arc(centerX, centerY, radius, 0, 2 * Math.PI);
      ctx.fill();

      // Sphere outline with glow
      ctx.strokeStyle = 'rgba(139, 92, 246, 0.4)';
      ctx.lineWidth = 2;
      ctx.shadowBlur = 10;
      ctx.shadowColor = 'rgba(139, 92, 246, 0.5)';
      ctx.beginPath();
      ctx.arc(centerX, centerY, radius, 0, 2 * Math.PI);
      ctx.stroke();
      ctx.shadowBlur = 0;

      // Draw grid lines
      ctx.strokeStyle = 'rgba(139, 92, 246, 0.15)';
      ctx.lineWidth = 1;
      
      // Latitude lines
      for (let i = -2; i <= 2; i++) {
        if (i === 0) continue;
        const y = centerY + (i * radius / 3);
        const r = Math.sqrt(radius * radius - (i * radius / 3) ** 2);
        ctx.beginPath();
        ctx.ellipse(centerX, y, r, r * 0.3, 0, 0, 2 * Math.PI);
        ctx.stroke();
      }

      // Axes with glow
      ctx.strokeStyle = 'rgba(167, 139, 250, 0.6)';
      ctx.lineWidth = 2;
      ctx.shadowBlur = 8;
      ctx.shadowColor = 'rgba(167, 139, 250, 0.8)';
      
      // X axis
      ctx.beginPath();
      ctx.moveTo(centerX - radius - 15, centerY);
      ctx.lineTo(centerX + radius + 15, centerY);
      ctx.stroke();
      
      // Y axis
      ctx.beginPath();
      ctx.ellipse(centerX, centerY, radius, radius * 0.3, 0, 0, 2 * Math.PI);
      ctx.stroke();
      
      // Z axis
      ctx.beginPath();
      ctx.moveTo(centerX, centerY - radius - 15);
      ctx.lineTo(centerX, centerY + radius + 15);
      ctx.stroke();
      
      ctx.shadowBlur = 0;

      // Axis labels with glow
      ctx.fillStyle = '#a78bfa';
      ctx.font = 'bold 14px Inter, sans-serif';
      ctx.shadowBlur = 4;
      ctx.shadowColor = 'rgba(167, 139, 250, 0.8)';
      ctx.fillText('X', centerX + radius + 20, centerY + 5);
      ctx.fillText('Y', centerX + 5, centerY + radius * 0.3 + 20);
      ctx.fillText('|0⟩', centerX + 8, centerY - radius - 18);
      ctx.fillText('|1⟩', centerX + 8, centerY + radius + 25);
      ctx.shadowBlur = 0;

      // Calculate state position
      const qubit = qubits[selectedQubit];
      const { alpha, beta } = qubit;
      
      const alphaMag = Math.sqrt((alpha.real || alpha) ** 2 + (alpha.imag || 0) ** 2);
      const betaMag = Math.sqrt((beta.real || beta) ** 2 + (beta.imag || 0) ** 2);
      
      const theta = 2 * Math.acos(Math.min(1, alphaMag));
      const phiAlpha = Math.atan2(alpha.imag || 0, alpha.real || alpha);
      const phiBeta = Math.atan2(beta.imag || 0, beta.real || beta);
      const phi = phiBeta - phiAlpha;

      const x = Math.sin(theta) * Math.cos(phi);
      const y = Math.sin(theta) * Math.sin(phi);
      const z = Math.cos(theta);

      const screenX = centerX + x * radius;
      const screenY = centerY - z * radius;

      // Draw state vector with gradient and glow
      const vectorGradient = ctx.createLinearGradient(centerX, centerY, screenX, screenY);
      vectorGradient.addColorStop(0, 'rgba(99, 102, 241, 0.8)');
      vectorGradient.addColorStop(1, '#6366f1');
      ctx.strokeStyle = vectorGradient;
      ctx.lineWidth = 3;
      ctx.shadowBlur = 15;
      ctx.shadowColor = 'rgba(99, 102, 241, 0.6)';
      ctx.beginPath();
      ctx.moveTo(centerX, centerY);
      ctx.lineTo(screenX, screenY);
      ctx.stroke();

      // Animated particles along vector
      if (animatingGate) {
        for (let i = 0; i < 3; i++) {
          const t = ((animationFrame * 0.05 + i * 0.3) % 1);
          const px = centerX + (screenX - centerX) * t;
          const py = centerY + (screenY - centerY) * t;
          
          ctx.fillStyle = `rgba(99, 102, 241, ${1 - t})`;
          ctx.shadowBlur = 10;
          ctx.shadowColor = 'rgba(99, 102, 241, 0.8)';
          ctx.beginPath();
          ctx.arc(px, py, 3, 0, 2 * Math.PI);
          ctx.fill();
        }
      }

      // State point with pulse
      const pulse = Math.sin(animationFrame * 0.1) * 2 + 8;
      const pointGradient = ctx.createRadialGradient(screenX, screenY, 0, screenX, screenY, pulse);
      pointGradient.addColorStop(0, '#6366f1');
      pointGradient.addColorStop(0.5, 'rgba(99, 102, 241, 0.8)');
      pointGradient.addColorStop(1, 'rgba(99, 102, 241, 0)');
      
      ctx.fillStyle = pointGradient;
      ctx.shadowBlur = 20;
      ctx.shadowColor = 'rgba(99, 102, 241, 0.8)';
      ctx.beginPath();
      ctx.arc(screenX, screenY, pulse, 0, 2 * Math.PI);
      ctx.fill();
      
      ctx.fillStyle = '#ffffff';
      ctx.shadowBlur = 10;
      ctx.beginPath();
      ctx.arc(screenX, screenY, 4, 0, 2 * Math.PI);
      ctx.fill();
      
      ctx.shadowBlur = 0;

      animationRef.current = requestAnimationFrame(animate);
    };

    animate();

    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
    };
  }, [qubits, selectedQubit, tailwindLoaded, animatingGate]);

  // Draw probability waveform
  useEffect(() => {
    if (!waveCanvasRef.current || !tailwindLoaded) return;

    const canvas = waveCanvasRef.current;
    const ctx = canvas.getContext('2d');
    const width = canvas.width;
    const height = canvas.height;

    ctx.clearRect(0, 0, width, height);

    const qubit = qubits[selectedQubit];
    const alphaReal = typeof qubit.alpha === 'number' ? qubit.alpha : (qubit.alpha.real || 0);
    const alphaImag = typeof qubit.alpha === 'number' ? 0 : (qubit.alpha.imag || 0);
    const betaReal = typeof qubit.beta === 'number' ? qubit.beta : (qubit.beta.real || 0);
    const betaImag = typeof qubit.beta === 'number' ? 0 : (qubit.beta.imag || 0);
    
    const prob0 = alphaReal ** 2 + alphaImag ** 2;
    const prob1 = betaReal ** 2 + betaImag ** 2;

    // Draw |0⟩ waveform
    const barWidth = (width / 2) - 30;
    const maxHeight = height - 40;

    // |0⟩ bar
    const height0 = prob0 * maxHeight;
    const gradient0 = ctx.createLinearGradient(0, height - height0, 0, height);
    gradient0.addColorStop(0, '#6366f1');
    gradient0.addColorStop(1, 'rgba(99, 102, 241, 0.6)');
    
    ctx.fillStyle = gradient0;
    ctx.shadowBlur = 20;
    ctx.shadowColor = 'rgba(99, 102, 241, 0.5)';
    ctx.fillRect(40, height - height0 - 20, barWidth, height0);
    ctx.shadowBlur = 0;

    // |1⟩ bar
    const height1 = prob1 * maxHeight;
    const gradient1 = ctx.createLinearGradient(0, height - height1, 0, height);
    gradient1.addColorStop(0, '#ec4899');
    gradient1.addColorStop(1, 'rgba(236, 72, 153, 0.6)');
    
    ctx.fillStyle = gradient1;
    ctx.shadowBlur = 20;
    ctx.shadowColor = 'rgba(236, 72, 153, 0.5)';
    ctx.fillRect(width / 2 + 20, height - height1 - 20, barWidth, height1);
    ctx.shadowBlur = 0;

    // Labels
    ctx.fillStyle = '#a78bfa';
    ctx.font = 'bold 16px Inter, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('|0⟩', 40 + barWidth / 2, height - 5);
    ctx.fillText('|1⟩', width / 2 + 20 + barWidth / 2, height - 5);

    // Probability values
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 20px Inter, sans-serif';
    ctx.fillText(`${(prob0 * 100).toFixed(1)}%`, 40 + barWidth / 2, height - height0 - 30);
    ctx.fillText(`${(prob1 * 100).toFixed(1)}%`, width / 2 + 20 + barWidth / 2, height - height1 - 30);

  }, [qubits, selectedQubit, tailwindLoaded]);

  const resetQubit = () => {
    const newQubits = [...qubits];
    newQubits[selectedQubit] = { alpha: { real: 1, imag: 0 }, beta: { real: 0, imag: 0 }, id: selectedQubit };
    setQubits(newQubits);
  };

  const setToOne = () => {
    const newQubits = [...qubits];
    newQubits[selectedQubit] = { alpha: { real: 0, imag: 0 }, beta: { real: 1, imag: 0 }, id: selectedQubit };
    setQubits(newQubits);
  };

  const formatComplex = (c) => {
    const real = typeof c === 'number' ? c : (c.real || 0);
    const imag = typeof c === 'number' ? 0 : (c.imag || 0);
    
    if (Math.abs(imag) < 0.0001) {
      return real.toFixed(3);
    }
    
    const sign = imag >= 0 ? '+' : '';
    return `${real.toFixed(3)}${sign}${imag.toFixed(3)}i`;
  };

  if (!tailwindLoaded) {
    return <div style={{ padding: '20px', textAlign: 'center', fontFamily: 'Inter, sans-serif', color: '#fff' }}>Loading...</div>;
  }

  const qubit = qubits[selectedQubit];
  const alphaPhase = Math.atan2(qubit.alpha.imag || 0, qubit.alpha.real || qubit.alpha) * 180 / Math.PI;
  const betaPhase = Math.atan2(qubit.beta.imag || 0, qubit.beta.real || qubit.beta) * 180 / Math.PI;

  return (
    <div style={{ fontFamily: 'Inter, -apple-system, sans-serif' }} className="min-h-screen p-8">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-4xl font-bold text-white mb-2" style={{ textShadow: '0 0 30px rgba(99, 102, 241, 0.5)' }}>
            Quantum Computing Simulator
          </h1>
          <p className="text-lg text-purple-300 font-light">Visualize quantum states and gate operations in real-time</p>
        </div>

        <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
          {/* Bloch Sphere */}
          <div className="xl:col-span-1">
            <div 
              className="rounded-3xl p-6 backdrop-blur-sm border border-purple-500/20"
              style={{ 
                background: 'linear-gradient(135deg, rgba(30, 41, 59, 0.8) 0%, rgba(15, 23, 42, 0.9) 100%)',
                boxShadow: '0 20px 60px rgba(0, 0, 0, 0.5), inset 0 0 60px rgba(139, 92, 246, 0.05)'
              }}
            >
              <h2 className="text-xl font-bold text-white mb-4 flex items-center gap-2">
                <span>🌐</span> Bloch Sphere
              </h2>
              
              <canvas 
                ref={blochCanvasRef} 
                width="320" 
                height="320"
                className="w-full rounded-2xl"
                style={{ background: 'rgba(0, 0, 0, 0.3)' }}
              />

              {/* State Info */}
              <div className="mt-6 space-y-4">
                <div 
                  className="rounded-xl p-4 border border-purple-500/30"
                  style={{ background: 'rgba(139, 92, 246, 0.1)' }}
                >
                  <div className="text-sm font-medium text-purple-300 mb-2">State Vector</div>
                  <div className="font-mono text-sm text-white">
                    |ψ⟩ = {formatComplex(qubit.alpha)}|0⟩ + {formatComplex(qubit.beta)}|1⟩
                  </div>
                </div>

                {showPhase && (
                  <div 
                    className="rounded-xl p-4 border border-purple-500/30"
                    style={{ background: 'rgba(139, 92, 246, 0.1)' }}
                  >
                    <div className="text-sm font-medium text-purple-300 mb-2">Phase Angles</div>
                    <div className="space-y-1 text-sm text-gray-300">
                      <div>α phase: {alphaPhase.toFixed(1)}°</div>
                      <div>β phase: {betaPhase.toFixed(1)}°</div>
                    </div>
                  </div>
                )}

                <div className="flex gap-3">
                  <button
                    onClick={resetQubit}
                    className="flex-1 px-4 py-3 rounded-xl font-medium text-white transition-all hover:scale-105 active:scale-95"
                    style={{ 
                      background: 'linear-gradient(135deg, #6366f1 0%, #4f46e5 100%)',
                      boxShadow: '0 10px 30px rgba(99, 102, 241, 0.3)'
                    }}
                  >
                    Reset |0⟩
                  </button>
                  <button
                    onClick={setToOne}
                    className="flex-1 px-4 py-3 rounded-xl font-medium text-white transition-all hover:scale-105 active:scale-95"
                    style={{ 
                      background: 'linear-gradient(135deg, #ec4899 0%, #db2777 100%)',
                      boxShadow: '0 10px 30px rgba(236, 72, 153, 0.3)'
                    }}
                  >
                    Set |1⟩
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* Center Column: Gates and Circuit */}
          <div className="xl:col-span-1 space-y-6">
            {/* Quantum Gates */}
            <div 
              className="rounded-3xl p-6 backdrop-blur-sm border border-purple-500/20"
              style={{ 
                background: 'linear-gradient(135deg, rgba(30, 41, 59, 0.8) 0%, rgba(15, 23, 42, 0.9) 100%)',
                boxShadow: '0 20px 60px rgba(0, 0, 0, 0.5), inset 0 0 60px rgba(139, 92, 246, 0.05)'
              }}
            >
              <h2 className="text-xl font-bold text-white mb-4 flex items-center gap-2">
                <span>⚛️</span> Quantum Gates
              </h2>
              
              <div className="grid grid-cols-2 gap-3">
                {Object.entries(gates).map(([name, gate]) => (
                  <button
                    key={name}
                    onClick={() => applyGate(name)}
                    className={`px-4 py-4 rounded-xl text-white font-bold transition-all hover:scale-105 active:scale-95 ${
                      animatingGate === name ? 'animate-pulse' : ''
                    }`}
                    style={{ 
                      background: `linear-gradient(135deg, ${gate.color} 0%, ${gate.color}dd 100%)`,
                      boxShadow: `0 10px 30px ${gate.glow}, inset 0 0 20px rgba(255, 255, 255, 0.1)`,
                      border: `1px solid ${gate.color}44`
                    }}
                  >
                    <div className="text-2xl mb-1">{name}</div>
                    <div className="text-xs font-normal opacity-90">{gate.description}</div>
                  </button>
                ))}
              </div>

              {/* Gate Reference */}
              <div className="mt-6 pt-6 border-t border-purple-500/20">
                <h3 className="text-sm font-bold text-purple-300 mb-3">Gate Reference</h3>
                <div className="space-y-2 text-xs text-gray-400">
                  <div><span className="text-blue-400 font-bold">X:</span> Bit flip - rotates around X-axis</div>
                  <div><span className="text-green-400 font-bold">H:</span> Creates superposition state</div>
                  <div><span className="text-pink-400 font-bold">Z:</span> Phase flip - rotates around Z-axis</div>
                  <div><span className="text-purple-400 font-bold">Y:</span> Rotates around Y-axis</div>
                  <div><span className="text-amber-400 font-bold">S:</span> √Z gate - 90° phase shift</div>
                  <div><span className="text-red-400 font-bold">T:</span> √S gate - 45° phase shift</div>
                </div>
              </div>
            </div>

            {/* Circuit History */}
            <div 
              className="rounded-3xl p-6 backdrop-blur-sm border border-purple-500/20"
              style={{ 
                background: 'linear-gradient(135deg, rgba(30, 41, 59, 0.8) 0%, rgba(15, 23, 42, 0.9) 100%)',
                boxShadow: '0 20px 60px rgba(0, 0, 0, 0.5), inset 0 0 60px rgba(139, 92, 246, 0.05)'
              }}
            >
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-xl font-bold text-white flex items-center gap-2">
                  <span>🔌</span> Circuit
                </h3>
                {circuit.length > 0 && (
                  <button
                    onClick={() => setCircuit([])}
                    className="text-xs text-purple-400 hover:text-purple-300 font-medium px-3 py-1 rounded-lg"
                    style={{ background: 'rgba(139, 92, 246, 0.2)' }}
                  >
                    Clear
                  </button>
                )}
              </div>
              
              <div 
                className="rounded-xl p-4 min-h-[100px] max-h-[200px] overflow-y-auto"
                style={{ background: 'rgba(0, 0, 0, 0.3)' }}
              >
                {circuit.length === 0 ? (
                  <div className="text-sm text-gray-500 text-center py-8">
                    Apply gates to build a circuit
                  </div>
                ) : (
                  <div className="flex flex-wrap gap-2">
                    {circuit.map((step, idx) => (
                      <div
                        key={step.time}
                        className="inline-flex items-center gap-2 px-4 py-2 rounded-lg font-medium text-white"
                        style={{ 
                          background: `linear-gradient(135deg, ${gates[step.gate].color}44 0%, ${gates[step.gate].color}22 100%)`,
                          border: `1px solid ${gates[step.gate].color}66`,
                          boxShadow: `0 4px 12px ${gates[step.gate].glow}`
                        }}
                      >
                        <span className="text-gray-400 text-xs">{idx + 1}</span>
                        <span style={{ color: gates[step.gate].color }}>{step.gate}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Probability Visualization */}
          <div className="xl:col-span-1">
            <div 
              className="rounded-3xl p-6 backdrop-blur-sm border border-purple-500/20"
              style={{ 
                background: 'linear-gradient(135deg, rgba(30, 41, 59, 0.8) 0%, rgba(15, 23, 42, 0.9) 100%)',
                boxShadow: '0 20px 60px rgba(0, 0, 0, 0.5), inset 0 0 60px rgba(139, 92, 246, 0.05)'
              }}
            >
              <h2 className="text-xl font-bold text-white mb-4 flex items-center gap-2">
                <span>📊</span> Measurement Probabilities
              </h2>
              
              <canvas 
                ref={waveCanvasRef} 
                width="400" 
                height="300"
                className="w-full rounded-2xl"
                style={{ background: 'rgba(0, 0, 0, 0.3)' }}
              />

              <div className="mt-6 space-y-4">
                <div 
                  className="rounded-xl p-4 border border-blue-500/30"
                  style={{ background: 'rgba(99, 102, 241, 0.1)' }}
                >
                  <div className="text-sm font-medium text-blue-300 mb-2">Collapse to |0⟩</div>
                  <div className="text-2xl font-bold text-white">
                    {(Math.sqrt((qubit.alpha.real || qubit.alpha) ** 2 + (qubit.alpha.imag || 0) ** 2) ** 2 * 100).toFixed(1)}%
                  </div>
                  <div className="text-xs text-gray-400 mt-1">Amplitude: {formatComplex(qubit.alpha)}</div>
                </div>

                <div 
                  className="rounded-xl p-4 border border-pink-500/30"
                  style={{ background: 'rgba(236, 72, 153, 0.1)' }}
                >
                  <div className="text-sm font-medium text-pink-300 mb-2">Collapse to |1⟩</div>
                  <div className="text-2xl font-bold text-white">
                    {(Math.sqrt((qubit.beta.real || qubit.beta) ** 2 + (qubit.beta.imag || 0) ** 2) ** 2 * 100).toFixed(1)}%
                  </div>
                  <div className="text-xs text-gray-400 mt-1">Amplitude: {formatComplex(qubit.beta)}</div>
                </div>

                <button
                  onClick={() => setShowPhase(!showPhase)}
                  className="w-full px-4 py-2 rounded-xl text-sm font-medium text-purple-300 transition-all hover:bg-purple-500/20"
                  style={{ background: 'rgba(139, 92, 246, 0.1)', border: '1px solid rgba(139, 92, 246, 0.3)' }}
                >
                  {showPhase ? 'Hide' : 'Show'} Phase Information
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default QuantumSimulator;
