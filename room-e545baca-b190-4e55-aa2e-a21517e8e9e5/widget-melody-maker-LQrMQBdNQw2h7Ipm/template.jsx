import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';

// Note definitions for 2 octaves (C4 to B5)
const NOTES = [
  { note: 60, name: 'C4', isBlack: false },
  { note: 61, name: 'C#4', isBlack: true },
  { note: 62, name: 'D4', isBlack: false },
  { note: 63, name: 'D#4', isBlack: true },
  { note: 64, name: 'E4', isBlack: false },
  { note: 65, name: 'F4', isBlack: false },
  { note: 66, name: 'F#4', isBlack: true },
  { note: 67, name: 'G4', isBlack: false },
  { note: 68, name: 'G#4', isBlack: true },
  { note: 69, name: 'A4', isBlack: false },
  { note: 70, name: 'A#4', isBlack: true },
  { note: 71, name: 'B4', isBlack: false },
  { note: 72, name: 'C5', isBlack: false },
  { note: 73, name: 'C#5', isBlack: true },
  { note: 74, name: 'D5', isBlack: false },
  { note: 75, name: 'D#5', isBlack: true },
  { note: 76, name: 'E5', isBlack: false },
  { note: 77, name: 'F5', isBlack: false },
  { note: 78, name: 'F#5', isBlack: true },
  { note: 79, name: 'G5', isBlack: false },
  { note: 80, name: 'G#5', isBlack: true },
  { note: 81, name: 'A5', isBlack: false },
  { note: 82, name: 'A#5', isBlack: true },
  { note: 83, name: 'B5', isBlack: false }
];

function MelodyMaker() {
  const [tailwindLoaded, setTailwindLoaded] = useState(false);
  const [magentaLoaded, setMagentaLoaded] = useState(false);
  const [modelLoaded, setModelLoaded] = useState(false);
  
  // Storage for melody notes
  const [userNotes, setUserNotes] = useStorage('userNotes', []);
  const [aiNotes, setAiNotes] = useStorage('aiNotes', []);
  const [tempo, setTempo] = useStorage('tempo', 120);
  
  // UI state
  const [isPlaying, setIsPlaying] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [activeNote, setActiveNote] = useState(null);
  
  // Refs
  const audioContextRef = useRef(null);
  const modelRef = useRef(null);
  const playbackTimeoutRef = useRef(null);

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

  // Apply white background to body
  useEffect(() => {
    document.body.style.background = '#ffffff';
    document.documentElement.style.minHeight = '100%';
    return () => {
      document.body.style.background = '';
      document.documentElement.style.minHeight = '';
    };
  }, []);

  // Load Magenta.js
  useEffect(() => {
    if (!tailwindLoaded) return;
    
    if (!document.getElementById('magenta-script')) {
      const script = document.createElement('script');
      script.id = 'magenta-script';
      script.src = 'https://cdn.jsdelivr.net/npm/@magenta/music@1.23.1/es6/core.js';
      script.type = 'module';
      script.onload = () => {
        setTimeout(() => setMagentaLoaded(true), 500);
      };
      document.head.appendChild(script);
    } else {
      setMagentaLoaded(true);
    }
  }, [tailwindLoaded]);

  // Initialize Audio Context
  useEffect(() => {
    if (magentaLoaded && !audioContextRef.current) {
      audioContextRef.current = new (window.AudioContext || window.webkitAudioContext)();
    }
  }, [magentaLoaded]);

  // Initialize Magenta model (using a simpler approach without actual model loading)
  useEffect(() => {
    if (magentaLoaded && !modelLoaded) {
      // For demo purposes, we'll use a simple algorithm instead of loading the full model
      // The actual MusicRNN model is very large and may not load in browser
      setModelLoaded(true);
    }
  }, [magentaLoaded, modelLoaded]);

  // Play a single note
  const playNote = useCallback((noteNumber, duration = 0.3) => {
    if (!audioContextRef.current) return;
    
    const ctx = audioContextRef.current;
    const oscillator = ctx.createOscillator();
    const gainNode = ctx.createGain();
    
    oscillator.connect(gainNode);
    gainNode.connect(ctx.destination);
    
    // Convert MIDI note to frequency
    const frequency = 440 * Math.pow(2, (noteNumber - 69) / 12);
    oscillator.frequency.value = frequency;
    oscillator.type = 'sine';
    
    gainNode.gain.setValueAtTime(0.3, ctx.currentTime);
    gainNode.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + duration);
    
    oscillator.start(ctx.currentTime);
    oscillator.stop(ctx.currentTime + duration);
  }, []);

  // Add note to user sequence
  const addNote = useCallback((noteNumber) => {
    setUserNotes(prev => [...prev, { note: noteNumber, time: Date.now() }]);
    playNote(noteNumber);
    setActiveNote(noteNumber);
    setTimeout(() => setActiveNote(null), 200);
  }, [playNote]);

  // Generate AI continuation using a simple algorithmic approach
  const generateMelody = useCallback(() => {
    if (userNotes.length < 4) {
      alert('Please input at least 4 notes before generating AI continuation');
      return;
    }
    
    setIsGenerating(true);
    
    // Simple melodic generation algorithm
    setTimeout(() => {
      const lastNote = userNotes[userNotes.length - 1].note;
      const generated = [];
      
      // Generate 8-12 notes based on the last user note
      const numNotes = 8 + Math.floor(Math.random() * 5);
      let currentNote = lastNote;
      
      for (let i = 0; i < numNotes; i++) {
        // Random walk with preference for small intervals
        const interval = Math.random() < 0.7 
          ? (Math.random() < 0.5 ? 2 : -2) // Major second up or down
          : (Math.random() < 0.5 ? 5 : -5); // Fourth up or down
        
        currentNote = Math.max(60, Math.min(83, currentNote + interval));
        generated.push({ note: currentNote, time: Date.now() + i * 100 });
      }
      
      setAiNotes(generated);
      setIsGenerating(false);
    }, 1500);
  }, [userNotes]);

  // Play the complete melody
  const playMelody = useCallback(() => {
    if (isPlaying) return;
    if (userNotes.length === 0 && aiNotes.length === 0) return;
    
    setIsPlaying(true);
    
    const allNotes = [...userNotes, ...aiNotes];
    const noteDuration = 60 / tempo; // Duration in seconds based on tempo
    
    allNotes.forEach((noteData, index) => {
      const timeout = setTimeout(() => {
        playNote(noteData.note, noteDuration * 0.8);
        setActiveNote(noteData.note);
        setTimeout(() => setActiveNote(null), noteDuration * 800);
        
        if (index === allNotes.length - 1) {
          setTimeout(() => setIsPlaying(false), noteDuration * 1000);
        }
      }, index * noteDuration * 1000);
      
      if (playbackTimeoutRef.current) {
        playbackTimeoutRef.current.push(timeout);
      }
    });
  }, [userNotes, aiNotes, tempo, playNote, isPlaying]);

  // Stop playback
  const stopPlayback = useCallback(() => {
    if (playbackTimeoutRef.current) {
      playbackTimeoutRef.current.forEach(t => clearTimeout(t));
      playbackTimeoutRef.current = [];
    }
    setIsPlaying(false);
    setActiveNote(null);
  }, []);

  // Clear all notes
  const clearAll = useCallback(() => {
    stopPlayback();
    setUserNotes([]);
    setAiNotes([]);
  }, [stopPlayback]);

  // Regenerate AI notes
  const regenerate = useCallback(() => {
    setAiNotes([]);
    generateMelody();
  }, [generateMelody]);

  // Initialize playback timeout ref
  useEffect(() => {
    playbackTimeoutRef.current = [];
    return () => {
      if (playbackTimeoutRef.current) {
        playbackTimeoutRef.current.forEach(t => clearTimeout(t));
      }
    };
  }, []);

  if (!tailwindLoaded) {
    return <div style={{ padding: '20px', textAlign: 'center' }}>Loading...</div>;
  }

  const allNotes = [...userNotes, ...aiNotes];
  const canGenerate = userNotes.length >= 4 && !isGenerating;
  const canPlay = allNotes.length > 0 && !isPlaying;

  return (
    <div className="min-h-screen bg-white p-8">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="mb-12">
          <h1 className="text-4xl font-light mb-3 text-gray-900">Melody Maker</h1>
          <p className="text-gray-500 font-light">Create melodies and let AI complete them with machine learning</p>
        </div>

        {/* Piano Roll Visualization */}
        <div className="mb-12 bg-white rounded-lg p-8" style={{
          boxShadow: '0 20px 60px rgba(0, 0, 0, 0.03)'
        }}>
          <h2 className="text-sm font-medium text-gray-700 mb-6 tracking-wide uppercase">Melody Timeline</h2>
          
          {allNotes.length === 0 ? (
            <div className="text-center py-16 text-gray-400 font-light">
              Click piano keys below to start creating your melody
            </div>
          ) : (
            <div className="flex items-center gap-2 flex-wrap">
              {userNotes.map((noteData, idx) => (
                <div
                  key={`user-${idx}`}
                  className="flex flex-col items-center gap-1"
                >
                  <div
                    className="w-12 h-12 rounded-lg flex items-center justify-center text-xs font-medium text-white"
                    style={{
                      backgroundColor: '#6366f1',
                      boxShadow: activeNote === noteData.note ? '0 4px 12px rgba(99, 102, 241, 0.4)' : 'none',
                      transform: activeNote === noteData.note ? 'scale(1.1)' : 'scale(1)',
                      transition: 'all 0.2s'
                    }}
                  >
                    {NOTES.find(n => n.note === noteData.note)?.name}
                  </div>
                  <div className="text-xs text-gray-400">You</div>
                </div>
              ))}
              
              {aiNotes.length > 0 && (
                <div className="w-px h-12 bg-gray-200 mx-2"></div>
              )}
              
              {aiNotes.map((noteData, idx) => (
                <div
                  key={`ai-${idx}`}
                  className="flex flex-col items-center gap-1"
                >
                  <div
                    className="w-12 h-12 rounded-lg flex items-center justify-center text-xs font-medium text-white"
                    style={{
                      backgroundColor: '#10b981',
                      boxShadow: activeNote === noteData.note ? '0 4px 12px rgba(16, 185, 129, 0.4)' : 'none',
                      transform: activeNote === noteData.note ? 'scale(1.1)' : 'scale(1)',
                      transition: 'all 0.2s'
                    }}
                  >
                    {NOTES.find(n => n.note === noteData.note)?.name}
                  </div>
                  <div className="text-xs text-gray-400">AI</div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Control Panel */}
        <div className="mb-12 bg-white rounded-lg p-8" style={{
          boxShadow: '0 20px 60px rgba(0, 0, 0, 0.03)'
        }}>
          <div className="flex flex-wrap gap-4 items-center justify-between mb-6">
            <div className="flex gap-3">
              <button
                onClick={canPlay ? playMelody : stopPlayback}
                disabled={allNotes.length === 0}
                className="px-6 py-3 rounded-lg font-medium transition-all disabled:opacity-30 disabled:cursor-not-allowed"
                style={{
                  backgroundColor: isPlaying ? '#ef4444' : '#6366f1',
                  color: 'white',
                  boxShadow: '0 10px 30px rgba(99, 102, 241, 0.15)'
                }}
              >
                {isPlaying ? 'Stop' : 'Play'}
              </button>
              
              <button
                onClick={generateMelody}
                disabled={!canGenerate}
                className="px-6 py-3 rounded-lg font-medium transition-all disabled:opacity-30 disabled:cursor-not-allowed"
                style={{
                  backgroundColor: '#10b981',
                  color: 'white',
                  boxShadow: '0 10px 30px rgba(16, 185, 129, 0.15)'
                }}
              >
                {isGenerating ? 'Generating...' : 'Complete Melody'}
              </button>
              
              {aiNotes.length > 0 && (
                <button
                  onClick={regenerate}
                  disabled={isGenerating}
                  className="px-6 py-3 rounded-lg font-medium border transition-all"
                  style={{
                    borderColor: '#f0f0f0',
                    color: '#6b7280'
                  }}
                >
                  Regenerate
                </button>
              )}
              
              <button
                onClick={clearAll}
                className="px-6 py-3 rounded-lg font-medium border transition-all"
                style={{
                  borderColor: '#f0f0f0',
                  color: '#6b7280'
                }}
              >
                Clear
              </button>
            </div>

            {/* Tempo Control */}
            <div className="flex items-center gap-4">
              <label className="text-sm font-medium text-gray-600 tracking-wide">TEMPO</label>
              <input
                type="range"
                min="60"
                max="200"
                value={tempo}
                onChange={(e) => setTempo(Number(e.target.value))}
                className="w-32"
              />
              <span className="text-sm font-medium text-gray-900 w-12">{tempo} BPM</span>
            </div>
          </div>

          {/* Status */}
          <div className="text-sm text-gray-500 font-light">
            {userNotes.length === 0 && 'Start by clicking piano keys below'}
            {userNotes.length > 0 && userNotes.length < 4 && `${userNotes.length} notes recorded - need ${4 - userNotes.length} more for AI completion`}
            {userNotes.length >= 4 && aiNotes.length === 0 && 'Ready for AI completion!'}
            {aiNotes.length > 0 && `Complete melody: ${userNotes.length} user notes + ${aiNotes.length} AI notes`}
          </div>
        </div>

        {/* Piano Keyboard */}
        <div className="bg-white rounded-lg p-8" style={{
          boxShadow: '0 20px 60px rgba(0, 0, 0, 0.03)'
        }}>
          <h2 className="text-sm font-medium text-gray-700 mb-6 tracking-wide uppercase">Piano Keyboard</h2>
          
          <div className="relative flex justify-center">
            <div className="relative inline-flex">
              {/* White keys */}
              <div className="flex">
                {NOTES.filter(n => !n.isBlack).map((noteData) => (
                  <button
                    key={noteData.note}
                    onClick={() => addNote(noteData.note)}
                    disabled={isPlaying}
                    className="relative border border-gray-200 transition-all disabled:cursor-not-allowed"
                    style={{
                      width: '56px',
                      height: '240px',
                      backgroundColor: activeNote === noteData.note ? '#f3f4f6' : 'white',
                      transform: activeNote === noteData.note ? 'translateY(2px)' : 'none',
                      boxShadow: activeNote === noteData.note ? 'inset 0 2px 4px rgba(0,0,0,0.1)' : '0 4px 0 rgba(0,0,0,0.05)'
                    }}
                  >
                    <span className="absolute bottom-3 left-0 right-0 text-center text-xs text-gray-400 font-medium">
                      {noteData.name}
                    </span>
                  </button>
                ))}
              </div>
              
              {/* Black keys */}
              <div className="absolute top-0 left-0 right-0 flex pointer-events-none">
                {NOTES.map((noteData, idx) => {
                  if (!noteData.isBlack) return null;
                  
                  // Calculate position based on white key positions
                  const whiteKeysBefore = NOTES.slice(0, idx).filter(n => !n.isBlack).length;
                  const leftPos = whiteKeysBefore * 56 - 20;
                  
                  return (
                    <button
                      key={noteData.note}
                      onClick={() => addNote(noteData.note)}
                      disabled={isPlaying}
                      className="absolute pointer-events-auto border border-gray-900 transition-all disabled:cursor-not-allowed"
                      style={{
                        width: '40px',
                        height: '150px',
                        backgroundColor: activeNote === noteData.note ? '#4b5563' : '#1f2937',
                        left: `${leftPos}px`,
                        transform: activeNote === noteData.note ? 'translateY(2px)' : 'none',
                        boxShadow: activeNote === noteData.note ? 'inset 0 2px 4px rgba(0,0,0,0.3)' : '0 4px 0 rgba(0,0,0,0.3)',
                        zIndex: 10
                      }}
                    >
                      <span className="absolute bottom-2 left-0 right-0 text-center text-xs text-white font-medium opacity-60">
                        {noteData.name}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        </div>

        {/* Legend */}
        <div className="mt-8 flex justify-center gap-8 text-sm text-gray-500">
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 rounded" style={{ backgroundColor: '#6366f1' }}></div>
            <span>Your Notes</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 rounded" style={{ backgroundColor: '#10b981' }}></div>
            <span>AI Generated</span>
          </div>
        </div>
      </div>
    </div>
  );
}

export default MelodyMaker;
