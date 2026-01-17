import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { PianoSynth, DrumSynth } from './utils/audioSynth.js';

// Note definitions for 2 octaves (C4 to B5)
const NOTES = [
  { note: 60, name: 'C4', isBlack: false, key: 'a' },
  { note: 61, name: 'C#4', isBlack: true, key: 'w' },
  { note: 62, name: 'D4', isBlack: false, key: 's' },
  { note: 63, name: 'D#4', isBlack: true, key: 'e' },
  { note: 64, name: 'E4', isBlack: false, key: 'd' },
  { note: 65, name: 'F4', isBlack: false, key: 'f' },
  { note: 66, name: 'F#4', isBlack: true, key: 't' },
  { note: 67, name: 'G4', isBlack: false, key: 'g' },
  { note: 68, name: 'G#4', isBlack: true, key: 'y' },
  { note: 69, name: 'A4', isBlack: false, key: 'h' },
  { note: 70, name: 'A#4', isBlack: true, key: 'u' },
  { note: 71, name: 'B4', isBlack: false, key: 'j' },
  { note: 72, name: 'C5', isBlack: false, key: 'k' },
  { note: 73, name: 'C#5', isBlack: true, key: 'o' },
  { note: 74, name: 'D5', isBlack: false, key: 'l' },
  { note: 75, name: 'D#5', isBlack: true, key: 'p' },
  { note: 76, name: 'E5', isBlack: false, key: ';' },
  { note: 77, name: 'F5', isBlack: false, key: '\'' },
  { note: 78, name: 'F#5', isBlack: true, key: ']' },
  { note: 79, name: 'G5', isBlack: false, key: 'z' },
  { note: 80, name: 'G#5', isBlack: true, key: 'x' },
  { note: 81, name: 'A5', isBlack: false, key: 'c' },
  { note: 82, name: 'A#5', isBlack: true, key: 'v' },
  { note: 83, name: 'B5', isBlack: false, key: 'b' }
];

// Drum pad definitions
const DRUM_PADS = [
  { id: 'kick', name: 'Kick', key: 'a', row: 0, col: 0 },
  { id: 'snare', name: 'Snare', key: 's', row: 0, col: 1 },
  { id: 'hihat', name: 'Hi-Hat', key: 'd', row: 0, col: 2 },
  { id: 'openhat', name: 'Open Hat', key: 'f', row: 0, col: 3 },
  { id: 'kick', name: 'Kick 2', key: 'z', row: 1, col: 0 },
  { id: 'snare', name: 'Snare 2', key: 'x', row: 1, col: 1 },
  { id: 'hihat', name: 'HH 2', key: 'c', row: 1, col: 2 },
  { id: 'openhat', name: 'OH 2', key: 'v', row: 1, col: 3 }
];

// Elegant color palette
const COLORS = {
  accent: '#7c3aed', // Sophisticated purple
  accentLight: '#a78bfa',
  userNote: '#7c3aed',
  aiNote: '#818cf8',
  drum: '#ec4899', // Pink for drums
  text: {
    primary: '#1f2937',
    secondary: '#6b7280',
    tertiary: '#9ca3af'
  },
  border: '#f0f0f0',
  keyPressed: '#f3f4f6'
};

function MelodyMaker() {
  const [tailwindLoaded, setTailwindLoaded] = useState(false);
  const [magentaLoaded, setMagentaLoaded] = useState(false);
  const [modelLoaded, setModelLoaded] = useState(false);
  const [modelError, setModelError] = useState(null);
  
  // Storage for melody notes - now storing sequences with timing
  const [userSequence, setUserSequence] = useStorage('userSequence', []);
  const [aiSequence, setAiSequence] = useStorage('aiSequence', []);
  const [tempo, setTempo] = useStorage('tempo', 120);
  const [instrument, setInstrument] = useStorage('instrument', 'piano'); // 'piano' or 'drums'
  
  // UI state
  const [isPlaying, setIsPlaying] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [pressedKeys, setPressedKeys] = useState(new Set());
  const [activeNotes, setActiveNotes] = useState(new Set());
  const [currentChord, setCurrentChord] = useState([]);
  const [activeDrums, setActiveDrums] = useState(new Set());
  
  // Refs
  const audioContextRef = useRef(null);
  const pianoSynthRef = useRef(null);
  const drumSynthRef = useRef(null);
  const musicRNNRef = useRef(null);
  const drumRNNRef = useRef(null);
  const playbackTimeoutRef = useRef(null);
  const keyDownRef = useRef(new Set());

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
    
    if (!document.getElementById('magenta-music-script')) {
      const script = document.createElement('script');
      script.id = 'magenta-music-script';
      script.src = 'https://cdn.jsdelivr.net/npm/@magenta/music@^1.23.1';
      script.onload = () => {
        console.log('Magenta.js loaded');
        setTimeout(() => setMagentaLoaded(true), 200);
      };
      script.onerror = () => {
        console.error('Failed to load Magenta.js');
        setModelError('Failed to load Magenta.js library');
      };
      document.head.appendChild(script);
    } else {
      setMagentaLoaded(true);
    }
  }, [tailwindLoaded]);

  // Initialize Audio Context and Synths
  useEffect(() => {
    if (magentaLoaded && !audioContextRef.current) {
      audioContextRef.current = new (window.AudioContext || window.webkitAudioContext)();
      pianoSynthRef.current = new PianoSynth(audioContextRef.current);
      drumSynthRef.current = new DrumSynth(audioContextRef.current);
    }
  }, [magentaLoaded]);

  // Initialize Magenta models (MusicRNN and DrumRNN)
  useEffect(() => {
    if (!magentaLoaded || modelLoaded || (musicRNNRef.current && drumRNNRef.current)) return;
    
    const initModels = async () => {
      try {
        console.log('Initializing Magenta models...');
        
        // Check if mm is available
        if (!window.mm) {
          throw new Error('Magenta Music library not loaded properly');
        }
        
        // Initialize MusicRNN for melody generation
        if (window.mm.MusicRNN) {
          const musicModel = new window.mm.MusicRNN(
            'https://storage.googleapis.com/magentadata/js/checkpoints/music_rnn/basic_rnn'
          );
          await musicModel.initialize();
          musicRNNRef.current = musicModel;
          console.log('MusicRNN model loaded successfully');
        }
        
        // Initialize DrumRNN for drum pattern generation
        if (window.mm.MusicRNN) {
          const drumModel = new window.mm.MusicRNN(
            'https://storage.googleapis.com/magentadata/js/checkpoints/music_rnn/drum_kit_rnn'
          );
          await drumModel.initialize();
          drumRNNRef.current = drumModel;
          console.log('DrumRNN model loaded successfully');
        }
        
        setModelLoaded(true);
      } catch (error) {
        console.error('Error loading models:', error);
        setModelError(`Model loading failed: ${error.message}`);
        // Fall back to algorithmic generation
        setModelLoaded(true);
      }
    };
    
    initModels();
  }, [magentaLoaded, modelLoaded]);

  // Start playing a note (for chord support)
  const startNote = useCallback((noteNumber) => {
    if (!pianoSynthRef.current) return;
    pianoSynthRef.current.startNote(noteNumber);
    setActiveNotes(prev => new Set([...prev, noteNumber]));
  }, []);

  // Stop playing a note
  const stopNote = useCallback((noteNumber) => {
    if (!pianoSynthRef.current) return;
    pianoSynthRef.current.stopNote(noteNumber);
    setActiveNotes(prev => {
      const next = new Set(prev);
      next.delete(noteNumber);
      return next;
    });
  }, []);

  // Play a chord (multiple notes) for playback
  const playChord = useCallback((notes, duration = 0.5) => {
    if (!pianoSynthRef.current) return;
    notes.forEach(noteNumber => {
      pianoSynthRef.current.playNote(noteNumber, duration);
    });
  }, []);

  // Play drum hit
  const playDrum = useCallback((drumType) => {
    if (!drumSynthRef.current) return;
    drumSynthRef.current.playDrumHit(drumType);
    setActiveDrums(prev => new Set([...prev, drumType]));
    setTimeout(() => {
      setActiveDrums(prev => {
        const next = new Set(prev);
        next.delete(drumType);
        return next;
      });
    }, 100);
  }, []);

  // Record current chord to sequence
  const recordChord = useCallback(() => {
    if (currentChord.length === 0) return;
    
    setUserSequence(prev => [...prev, { 
      notes: [...currentChord], 
      time: Date.now(),
      isChord: currentChord.length > 1,
      instrument: 'piano'
    }]);
    
    setCurrentChord([]);
  }, [currentChord]);

  // Record drum hit
  const recordDrum = useCallback((drumType) => {
    setUserSequence(prev => [...prev, {
      drumType,
      time: Date.now(),
      instrument: 'drums'
    }]);
  }, []);

  // Generate AI continuation using Magenta MusicRNN or DrumRNN
  const generateMelody = useCallback(async () => {
    if (userSequence.length < 4) {
      alert(`Please input at least 4 ${instrument === 'drums' ? 'drum hits' : 'notes/chords'} before generating AI continuation`);
      return;
    }
    
    setIsGenerating(true);
    
    try {
      // Check if we're in drum mode
      if (instrument === 'drums' && drumRNNRef.current) {
        console.log('Generating drum pattern with DrumRNN...');
        
        // Convert user drum sequence to NoteSequence format for DrumRNN
        const inputSequence = {
          notes: [],
          totalTime: 0,
          quantizationInfo: { stepsPerQuarter: 4 }
        };
        
        let cumulativeTime = 0;
        const stepDuration = 0.25; // 16th notes
        
        userSequence.forEach((item, idx) => {
          if (item.instrument === 'drums' && item.drumType) {
            // Map drum types to MIDI drum notes
            const drumMidiMap = {
              'kick': 36,
              'snare': 38,
              'hihat': 42,
              'openhat': 46
            };
            
            const pitch = drumMidiMap[item.drumType] || 36;
            inputSequence.notes.push({
              pitch,
              quantizedStartStep: idx * 4,
              quantizedEndStep: idx * 4 + 1,
              isDrum: true,
              velocity: 100
            });
          }
          cumulativeTime += stepDuration;
        });
        
        inputSequence.totalTime = cumulativeTime;
        inputSequence.totalQuantizedSteps = Math.ceil(cumulativeTime / stepDuration);
        
        // Generate continuation
        const result = await drumRNNRef.current.continueSequence(
          inputSequence,
          32, // steps to generate
          1.0 // temperature
        );
        
        // Convert result back to our format
        const generated = [];
        const userEndStep = inputSequence.totalQuantizedSteps;
        
        result.notes
          .filter(note => note.quantizedStartStep >= userEndStep)
          .forEach(note => {
            const drumTypeMap = {
              36: 'kick',
              38: 'snare',
              42: 'hihat',
              46: 'openhat'
            };
            const drumType = drumTypeMap[note.pitch] || 'kick';
            
            generated.push({
              drumType,
              time: Date.now() + (note.quantizedStartStep - userEndStep) * stepDuration * 1000,
              instrument: 'drums'
            });
          });
        
        setAiSequence(generated);
        console.log('Generated', generated.length, 'drum hits with DrumRNN');
      } else if (instrument === 'piano' && musicRNNRef.current) {
        // Use actual Magenta MusicRNN model
        console.log('Generating with MusicRNN...');
        
        // Convert user sequence to NoteSequence format
        const inputSequence = {
          notes: [],
          totalTime: 0
        };
        
        let cumulativeTime = 0;
        userSequence.forEach((item, idx) => {
          const noteDuration = 0.5; // Half second per note/chord
          
          item.notes.forEach(noteNumber => {
            inputSequence.notes.push({
              pitch: noteNumber,
              startTime: cumulativeTime,
              endTime: cumulativeTime + noteDuration,
              velocity: 80
            });
          });
          
          cumulativeTime += noteDuration;
        });
        
        inputSequence.totalTime = cumulativeTime;
        
        // Generate continuation
        const result = await musicRNNRef.current.continueSequence(
          inputSequence,
          16, // steps to generate
          1.0 // temperature
        );
        
        // Convert result back to our format
        const generated = [];
        const userEndTime = inputSequence.totalTime;
        
        result.notes
          .filter(note => note.startTime >= userEndTime)
          .forEach(note => {
            generated.push({
              notes: [note.pitch],
              time: Date.now() + (note.startTime - userEndTime) * 1000,
              isChord: false
            });
          });
        
        setAiSequence(generated);
        console.log('Generated', generated.length, 'notes with MusicRNN');
      } else {
        // Fallback to algorithmic generation
        console.log('Using fallback algorithm...');
        
        if (instrument === 'drums') {
          // Simple drum pattern generation
          const generated = [];
          const drumTypes = ['kick', 'snare', 'hihat', 'openhat'];
          
          for (let i = 0; i < 16; i++) {
            // Basic pattern: kick on 1 and 3, snare on 2 and 4, hihat on all beats
            let drumType;
            if (i % 4 === 0 || i % 4 === 2) {
              drumType = 'kick';
            } else if (i % 4 === 1 || i % 4 === 3) {
              drumType = 'snare';
            } else {
              drumType = Math.random() < 0.7 ? 'hihat' : 'openhat';
            }
            
            generated.push({
              drumType,
              time: Date.now() + i * 100,
              instrument: 'drums'
            });
          }
          
          setAiSequence(generated);
        } else {
          // Melodic generation
          const lastItem = userSequence[userSequence.length - 1];
          const lastNote = lastItem.notes ? lastItem.notes[0] : 60;
          const generated = [];
          
          const numNotes = 8 + Math.floor(Math.random() * 5);
          let currentNote = lastNote;
          
          for (let i = 0; i < numNotes; i++) {
            const interval = Math.random() < 0.7 
              ? (Math.random() < 0.5 ? 2 : -2)
              : (Math.random() < 0.5 ? 5 : -5);
            
            currentNote = Math.max(60, Math.min(83, currentNote + interval));
            generated.push({ 
              notes: [currentNote], 
              time: Date.now() + i * 100,
              isChord: false,
              instrument: 'piano'
            });
          }
          
          setAiSequence(generated);
        }
      }
      
      setIsGenerating(false);
    } catch (error) {
      console.error('Generation error:', error);
      alert('Failed to generate. Using fallback algorithm.');
      
      // Fallback
      if (instrument === 'drums') {
        const generated = [];
        const drumTypes = ['kick', 'snare', 'hihat'];
        for (let i = 0; i < 16; i++) {
          generated.push({
            drumType: drumTypes[i % 3],
            time: Date.now() + i * 100,
            instrument: 'drums'
          });
        }
        setAiSequence(generated);
      } else {
        const lastItem = userSequence[userSequence.length - 1];
        const lastNote = lastItem.notes ? lastItem.notes[0] : 60;
        const generated = [];
        
        for (let i = 0; i < 12; i++) {
          const interval = Math.random() < 0.7 ? 2 : 5;
          const nextNote = Math.max(60, Math.min(83, lastNote + interval * (Math.random() < 0.5 ? 1 : -1)));
          generated.push({ 
            notes: [nextNote], 
            time: Date.now() + i * 100,
            isChord: false,
            instrument: 'piano'
          });
        }
        
        setAiSequence(generated);
      }
      
      setIsGenerating(false);
    }
  }, [userSequence, instrument]);

  // Play the complete melody/pattern
  const playMelody = useCallback(() => {
    if (isPlaying) return;
    if (userSequence.length === 0 && aiSequence.length === 0) return;
    
    setIsPlaying(true);
    
    const allItems = [...userSequence, ...aiSequence];
    const noteDuration = 60 / tempo; // Duration in seconds based on tempo
    
    allItems.forEach((item, index) => {
      const timeout = setTimeout(() => {
        if (item.instrument === 'drums' && item.drumType) {
          // Play drum hit
          drumSynthRef.current?.playDrumHit(item.drumType);
          setActiveDrums(new Set([item.drumType]));
          setTimeout(() => setActiveDrums(new Set()), 100);
        } else if (item.notes) {
          // Play piano notes/chord
          playChord(item.notes, noteDuration * 0.8);
          setActiveNotes(new Set(item.notes));
          setTimeout(() => setActiveNotes(new Set()), noteDuration * 800);
        }
        
        if (index === allItems.length - 1) {
          setTimeout(() => setIsPlaying(false), noteDuration * 1000);
        }
      }, index * noteDuration * 1000);
      
      if (playbackTimeoutRef.current) {
        playbackTimeoutRef.current.push(timeout);
      }
    });
  }, [userSequence, aiSequence, tempo, playChord, isPlaying]);

  // Stop playback
  const stopPlayback = useCallback(() => {
    if (playbackTimeoutRef.current) {
      playbackTimeoutRef.current.forEach(t => clearTimeout(t));
      playbackTimeoutRef.current = [];
    }
    setIsPlaying(false);
    setActiveNotes(new Set());
  }, []);

  // Clear all notes
  const clearAll = useCallback(() => {
    stopPlayback();
    setUserSequence([]);
    setAiSequence([]);
  }, [stopPlayback]);

  // Regenerate AI notes
  const regenerate = useCallback(() => {
    setAiSequence([]);
    generateMelody();
  }, [generateMelody]);

  // Handle mouse/touch down on piano key
  const handleKeyDown = useCallback((noteNumber) => {
    if (isPlaying || instrument !== 'piano') return;
    startNote(noteNumber);
    setPressedKeys(prev => new Set([...prev, noteNumber]));
    setCurrentChord(prev => [...prev, noteNumber]);
  }, [isPlaying, startNote, instrument]);

  // Handle mouse/touch up on piano key
  const handleKeyUp = useCallback((noteNumber) => {
    if (instrument !== 'piano') return;
    stopNote(noteNumber);
    setPressedKeys(prev => {
      const next = new Set(prev);
      next.delete(noteNumber);
      return next;
    });
  }, [stopNote, instrument]);

  // Handle drum pad hit
  const handleDrumHit = useCallback((drumType) => {
    if (isPlaying || instrument !== 'drums') return;
    playDrum(drumType);
    recordDrum(drumType);
  }, [isPlaying, playDrum, recordDrum, instrument]);

  // Physical keyboard support
  useEffect(() => {
    const handlePhysicalKeyDown = (e) => {
      if (isPlaying) return;
      if (e.repeat) return; // Ignore key repeat
      
      const key = e.key.toLowerCase();
      
      if (instrument === 'piano') {
        const noteData = NOTES.find(n => n.key === key);
        
        if (noteData && !keyDownRef.current.has(key)) {
          e.preventDefault();
          keyDownRef.current.add(key);
          startNote(noteData.note);
          setPressedKeys(prev => new Set([...prev, noteData.note]));
          setCurrentChord(prev => [...prev, noteData.note]);
        }
      } else if (instrument === 'drums') {
        const drumPad = DRUM_PADS.find(d => d.key === key);
        
        if (drumPad && !keyDownRef.current.has(key)) {
          e.preventDefault();
          keyDownRef.current.add(key);
          handleDrumHit(drumPad.id);
        }
      }
    };
    
    const handlePhysicalKeyUp = (e) => {
      const key = e.key.toLowerCase();
      
      if (instrument === 'piano') {
        const noteData = NOTES.find(n => n.key === key);
        
        if (noteData && keyDownRef.current.has(key)) {
          e.preventDefault();
          keyDownRef.current.delete(key);
          stopNote(noteData.note);
          setPressedKeys(prev => {
            const next = new Set(prev);
            next.delete(noteData.note);
            return next;
          });
          
          // Record chord when all keys released
          if (keyDownRef.current.size === 0 && currentChord.length > 0) {
            recordChord();
          }
        }
        
        // Space bar to record current chord
        if (e.key === ' ' && currentChord.length > 0) {
          e.preventDefault();
          recordChord();
        }
      } else if (instrument === 'drums') {
        const drumPad = DRUM_PADS.find(d => d.key === key);
        
        if (drumPad && keyDownRef.current.has(key)) {
          e.preventDefault();
          keyDownRef.current.delete(key);
        }
      }
    };
    
    window.addEventListener('keydown', handlePhysicalKeyDown);
    window.addEventListener('keyup', handlePhysicalKeyUp);
    
    return () => {
      window.removeEventListener('keydown', handlePhysicalKeyDown);
      window.removeEventListener('keyup', handlePhysicalKeyUp);
    };
  }, [isPlaying, instrument, startNote, stopNote, currentChord, recordChord, handleDrumHit]);

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

  if (!magentaLoaded || !modelLoaded) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center">
        <div className="text-center">
          <div className="text-lg font-light mb-2" style={{ color: COLORS.text.primary }}>
            Loading Magenta.js AI Model...
          </div>
          <div className="text-sm font-light" style={{ color: COLORS.text.tertiary }}>
            {modelError ? modelError : 'This may take a moment'}
          </div>
        </div>
      </div>
    );
  }

  const allSequence = [...userSequence, ...aiSequence];
  const canGenerate = userSequence.length >= 4 && !isGenerating;
  const canPlay = allSequence.length > 0 && !isPlaying;
  
  // Count total notes
  const userNoteCount = userSequence.reduce((sum, item) => sum + item.notes.length, 0);
  const aiNoteCount = aiSequence.reduce((sum, item) => sum + item.notes.length, 0);

  return (
    <div className="min-h-screen bg-white p-8">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="mb-12">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h1 className="text-4xl font-light mb-3" style={{ color: COLORS.text.primary }}>
                Melody Maker
              </h1>
              <p className="font-light" style={{ color: COLORS.text.secondary }}>
                Create melodies and chords - let AI complete them with Magenta.js
              </p>
            </div>
            
            {/* Instrument Selector */}
            <div className="flex gap-2">
              <button
                onClick={() => {
                  setInstrument('piano');
                  setUserSequence([]);
                  setAiSequence([]);
                }}
                className="px-6 py-3 rounded-xl font-medium transition-all"
                style={{
                  backgroundColor: instrument === 'piano' ? COLORS.accent : 'white',
                  color: instrument === 'piano' ? 'white' : COLORS.text.secondary,
                  border: `1px solid ${instrument === 'piano' ? COLORS.accent : COLORS.border}`,
                  boxShadow: instrument === 'piano' ? `0 10px 30px ${COLORS.accent}20` : 'none'
                }}
              >
                {'\u{1F3B9}'} Piano
              </button>
              <button
                onClick={() => {
                  setInstrument('drums');
                  setUserSequence([]);
                  setAiSequence([]);
                }}
                className="px-6 py-3 rounded-xl font-medium transition-all"
                style={{
                  backgroundColor: instrument === 'drums' ? COLORS.drum : 'white',
                  color: instrument === 'drums' ? 'white' : COLORS.text.secondary,
                  border: `1px solid ${instrument === 'drums' ? COLORS.drum : COLORS.border}`,
                  boxShadow: instrument === 'drums' ? `0 10px 30px ${COLORS.drum}20` : 'none'
                }}
              >
                {'\u{1F941}'} Drums
              </button>
            </div>
          </div>
        </div>

        {/* Current Chord Preview (Piano mode only) */}
        {instrument === 'piano' && currentChord.length > 0 && (
          <div className="mb-6 bg-white rounded-xl p-6" style={{
            boxShadow: '0 20px 60px rgba(0, 0, 0, 0.03)',
            border: `1px solid ${COLORS.border}`
          }}>
            <div className="text-xs font-medium mb-3 tracking-wide uppercase" style={{ color: COLORS.text.secondary }}>
              Current Chord (Release keys to record)
            </div>
            <div className="flex gap-2">
              {currentChord.map((note, idx) => (
                <div
                  key={idx}
                  className="px-4 py-2 rounded-lg text-sm font-medium text-white"
                  style={{ backgroundColor: COLORS.accent }}
                >
                  {NOTES.find(n => n.note === note)?.name}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Piano Roll Visualization */}
        <div className="mb-12 bg-white rounded-xl p-8" style={{
          boxShadow: '0 20px 60px rgba(0, 0, 0, 0.03)',
          border: `1px solid ${COLORS.border}`
        }}>
          <h2 className="text-xs font-medium mb-6 tracking-wide uppercase" style={{ color: COLORS.text.secondary }}>
            Melody Timeline
          </h2>
          
          {allSequence.length === 0 ? (
            <div className="text-center py-16 font-light" style={{ color: COLORS.text.tertiary }}>
              {instrument === 'piano' 
                ? 'Press piano keys below or use your keyboard (A-B keys) to start'
                : 'Hit drum pads below or use your keyboard (A-V keys) to start'}
            </div>
          ) : (
            <div className="flex items-start gap-2 flex-wrap">
              {userSequence.map((item, idx) => {
                if (item.instrument === 'drums') {
                  return (
                    <div
                      key={`user-${idx}`}
                      className="flex flex-col items-center gap-2"
                    >
                      <div
                        className="px-4 py-3 rounded-lg flex items-center justify-center text-xs font-bold text-white uppercase"
                        style={{
                          backgroundColor: COLORS.drum,
                          boxShadow: activeDrums.has(item.drumType) ? `0 4px 12px ${COLORS.drum}40` : 'none',
                          transform: activeDrums.has(item.drumType) ? 'scale(1.05)' : 'scale(1)',
                          transition: 'all 0.15s',
                          minWidth: '60px'
                        }}
                      >
                        {item.drumType}
                      </div>
                      <div className="text-xs font-light" style={{ color: COLORS.text.tertiary }}>
                        You
                      </div>
                    </div>
                  );
                }
                
                return (
                  <div
                    key={`user-${idx}`}
                    className="flex flex-col items-center gap-2"
                  >
                    <div className="flex flex-col gap-1">
                      {item.notes?.map((note, noteIdx) => (
                        <div
                          key={noteIdx}
                          className="px-3 py-2 rounded-lg flex items-center justify-center text-xs font-medium text-white"
                          style={{
                            backgroundColor: COLORS.userNote,
                            boxShadow: activeNotes.has(note) ? `0 4px 12px ${COLORS.userNote}40` : 'none',
                            transform: activeNotes.has(note) ? 'scale(1.05)' : 'scale(1)',
                            transition: 'all 0.15s',
                            minWidth: '48px'
                          }}
                        >
                          {NOTES.find(n => n.note === note)?.name}
                        </div>
                      ))}
                    </div>
                    <div className="text-xs font-light" style={{ color: COLORS.text.tertiary }}>
                      {item.isChord ? 'Chord' : 'You'}
                    </div>
                  </div>
                );
              })}
              
              {aiSequence.length > 0 && (
                <div className="w-px h-16 mx-2" style={{ backgroundColor: COLORS.border }}></div>
              )}
              
              {aiSequence.map((item, idx) => {
                if (item.instrument === 'drums') {
                  return (
                    <div
                      key={`ai-${idx}`}
                      className="flex flex-col items-center gap-2"
                    >
                      <div
                        className="px-4 py-3 rounded-lg flex items-center justify-center text-xs font-bold text-white uppercase"
                        style={{
                          backgroundColor: COLORS.aiNote,
                          boxShadow: activeDrums.has(item.drumType) ? `0 4px 12px ${COLORS.aiNote}40` : 'none',
                          transform: activeDrums.has(item.drumType) ? 'scale(1.05)' : 'scale(1)',
                          transition: 'all 0.15s',
                          minWidth: '60px'
                        }}
                      >
                        {item.drumType}
                      </div>
                      <div className="text-xs font-light" style={{ color: COLORS.text.tertiary }}>
                        AI
                      </div>
                    </div>
                  );
                }
                
                return (
                  <div
                    key={`ai-${idx}`}
                    className="flex flex-col items-center gap-2"
                  >
                    <div className="flex flex-col gap-1">
                      {item.notes?.map((note, noteIdx) => (
                        <div
                          key={noteIdx}
                          className="px-3 py-2 rounded-lg flex items-center justify-center text-xs font-medium text-white"
                          style={{
                            backgroundColor: COLORS.aiNote,
                            boxShadow: activeNotes.has(note) ? `0 4px 12px ${COLORS.aiNote}40` : 'none',
                            transform: activeNotes.has(note) ? 'scale(1.05)' : 'scale(1)',
                            transition: 'all 0.15s',
                            minWidth: '48px'
                          }}
                        >
                          {NOTES.find(n => n.note === note)?.name}
                        </div>
                      ))}
                    </div>
                    <div className="text-xs font-light" style={{ color: COLORS.text.tertiary }}>
                      AI
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Control Panel */}
        <div className="mb-12 bg-white rounded-xl p-8" style={{
          boxShadow: '0 20px 60px rgba(0, 0, 0, 0.03)',
          border: `1px solid ${COLORS.border}`
        }}>
          <div className="flex flex-wrap gap-4 items-center justify-between mb-6">
            <div className="flex gap-3 flex-wrap">
              <button
                onClick={canPlay ? playMelody : stopPlayback}
                disabled={allSequence.length === 0}
                className="px-8 py-3 rounded-xl font-medium transition-all disabled:opacity-30 disabled:cursor-not-allowed"
                style={{
                  backgroundColor: isPlaying ? '#ef4444' : COLORS.accent,
                  color: 'white',
                  boxShadow: `0 10px 30px ${COLORS.accent}20`
                }}
              >
                {isPlaying ? 'Stop' : 'Play'}
              </button>
              
              <button
                onClick={generateMelody}
                disabled={!canGenerate}
                className="px-8 py-3 rounded-xl font-medium transition-all disabled:opacity-30 disabled:cursor-not-allowed"
                style={{
                  backgroundColor: COLORS.accentLight,
                  color: 'white',
                  boxShadow: `0 10px 30px ${COLORS.accentLight}20`
                }}
              >
                {isGenerating ? 'Generating...' : 'Complete with AI'}
              </button>
              
              {aiSequence.length > 0 && (
                <button
                  onClick={regenerate}
                  disabled={isGenerating}
                  className="px-6 py-3 rounded-xl font-medium transition-all"
                  style={{
                    border: `1px solid ${COLORS.border}`,
                    color: COLORS.text.secondary
                  }}
                >
                  Regenerate
                </button>
              )}
              
              <button
                onClick={clearAll}
                className="px-6 py-3 rounded-xl font-medium transition-all"
                style={{
                  border: `1px solid ${COLORS.border}`,
                  color: COLORS.text.secondary
                }}
              >
                Clear All
              </button>
            </div>

            {/* Tempo Control */}
            <div className="flex items-center gap-4">
              <label className="text-xs font-medium tracking-wide" style={{ color: COLORS.text.secondary }}>
                TEMPO
              </label>
              <input
                type="range"
                min="60"
                max="200"
                value={tempo}
                onChange={(e) => setTempo(Number(e.target.value))}
                className="w-32"
                style={{ accentColor: COLORS.accent }}
              />
              <span className="text-sm font-medium w-16" style={{ color: COLORS.text.primary }}>
                {tempo} BPM
              </span>
            </div>
          </div>

          {/* Status */}
          <div className="text-sm font-light" style={{ color: COLORS.text.secondary }}>
            {userSequence.length === 0 && (instrument === 'piano' 
              ? 'Start by pressing piano keys or using your keyboard (A-B keys)'
              : 'Start by hitting drum pads or using your keyboard (A-V keys)')}
            {userSequence.length > 0 && userSequence.length < 4 && `${userSequence.length} items recorded - need ${4 - userSequence.length} more for AI completion`}
            {userSequence.length >= 4 && aiSequence.length === 0 && 'Ready for AI completion!'}
            {aiSequence.length > 0 && (instrument === 'piano'
              ? `Complete sequence: ${userNoteCount} user notes + ${aiNoteCount} AI notes`
              : `Complete pattern: ${userSequence.length} user hits + ${aiSequence.length} AI hits`)}
          </div>
          
          {((instrument === 'piano' && musicRNNRef.current) || (instrument === 'drums' && drumRNNRef.current)) && (
            <div className="mt-3 text-xs font-light" style={{ color: COLORS.text.tertiary }}>
              {'\u{2713}'} Using Magenta {instrument === 'piano' ? 'MusicRNN' : 'DrumRNN'} model for generation
            </div>
          )}
        </div>

        {/* Piano Keyboard */}
        {instrument === 'piano' && (
          <div className="bg-white rounded-xl p-8" style={{
            boxShadow: '0 20px 60px rgba(0, 0, 0, 0.03)',
            border: `1px solid ${COLORS.border}`
          }}>
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xs font-medium tracking-wide uppercase" style={{ color: COLORS.text.secondary }}>
                Piano Keyboard
              </h2>
              <div className="text-xs font-light" style={{ color: COLORS.text.tertiary }}>
                Hold multiple keys for chords
              </div>
            </div>
          
          <div className="relative flex justify-center mb-4">
            <div className="relative inline-flex">
              {/* White keys */}
              <div className="flex">
                {NOTES.filter(n => !n.isBlack).map((noteData) => {
                  const isPressed = pressedKeys.has(noteData.note) || activeNotes.has(noteData.note);
                  return (
                    <button
                      key={noteData.note}
                      onMouseDown={() => handleKeyDown(noteData.note)}
                      onMouseUp={() => handleKeyUp(noteData.note)}
                      onMouseLeave={() => handleKeyUp(noteData.note)}
                      onTouchStart={(e) => { e.preventDefault(); handleKeyDown(noteData.note); }}
                      onTouchEnd={(e) => { e.preventDefault(); handleKeyUp(noteData.note); }}
                      disabled={isPlaying}
                      className="relative transition-all disabled:cursor-not-allowed"
                      style={{
                        width: '56px',
                        height: '240px',
                        backgroundColor: isPressed ? COLORS.keyPressed : 'white',
                        transform: isPressed ? 'translateY(2px)' : 'none',
                        boxShadow: isPressed ? 'inset 0 2px 4px rgba(0,0,0,0.1)' : '0 4px 0 rgba(0,0,0,0.05)',
                        border: `1px solid ${COLORS.border}`,
                        borderBottom: isPressed ? 'none' : `4px solid ${COLORS.border}`
                      }}
                    >
                      <div className="absolute top-3 left-0 right-0 text-center">
                        <div className="text-xs font-bold mb-1" style={{ 
                          color: isPressed ? COLORS.accent : COLORS.text.tertiary,
                          textTransform: 'uppercase'
                        }}>
                          {noteData.key}
                        </div>
                      </div>
                      <span className="absolute bottom-3 left-0 right-0 text-center text-xs font-medium" style={{
                        color: COLORS.text.tertiary
                      }}>
                        {noteData.name}
                      </span>
                    </button>
                  );
                })}
              </div>
              
              {/* Black keys */}
              <div className="absolute top-0 left-0 right-0 flex pointer-events-none">
                {NOTES.map((noteData, idx) => {
                  if (!noteData.isBlack) return null;
                  
                  const whiteKeysBefore = NOTES.slice(0, idx).filter(n => !n.isBlack).length;
                  const leftPos = whiteKeysBefore * 56 - 20;
                  const isPressed = pressedKeys.has(noteData.note) || activeNotes.has(noteData.note);
                  
                  return (
                    <button
                      key={noteData.note}
                      onMouseDown={() => handleKeyDown(noteData.note)}
                      onMouseUp={() => handleKeyUp(noteData.note)}
                      onMouseLeave={() => handleKeyUp(noteData.note)}
                      onTouchStart={(e) => { e.preventDefault(); handleKeyDown(noteData.note); }}
                      onTouchEnd={(e) => { e.preventDefault(); handleKeyUp(noteData.note); }}
                      disabled={isPlaying}
                      className="absolute pointer-events-auto border-none transition-all disabled:cursor-not-allowed"
                      style={{
                        width: '40px',
                        height: '150px',
                        backgroundColor: isPressed ? '#4b5563' : '#1f2937',
                        left: `${leftPos}px`,
                        transform: isPressed ? 'translateY(2px)' : 'none',
                        boxShadow: isPressed ? 'inset 0 2px 4px rgba(0,0,0,0.3)' : '0 4px 0 rgba(0,0,0,0.3)',
                        zIndex: 10,
                        borderRadius: '0 0 4px 4px'
                      }}
                    >
                      <div className="absolute top-2 left-0 right-0 text-center">
                        <div className="text-xs font-bold mb-1" style={{ 
                          color: isPressed ? COLORS.accentLight : 'rgba(255,255,255,0.4)',
                          textTransform: 'uppercase'
                        }}>
                          {noteData.key}
                        </div>
                      </div>
                      <span className="absolute bottom-2 left-0 right-0 text-center text-xs font-medium" style={{
                        color: 'rgba(255,255,255,0.6)'
                      }}>
                        {noteData.name}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
          
            {/* Keyboard mapping hint */}
            <div className="text-center text-xs font-light mt-6" style={{ color: COLORS.text.tertiary }}>
              Use your keyboard: A-B keys map to piano keys • Hold multiple for chords • Release to record
            </div>
          </div>
        )}

        {/* Drum Pads */}
        {instrument === 'drums' && (
          <div className="bg-white rounded-xl p-8" style={{
            boxShadow: '0 20px 60px rgba(0, 0, 0, 0.03)',
            border: `1px solid ${COLORS.border}`
          }}>
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xs font-medium tracking-wide uppercase" style={{ color: COLORS.text.secondary }}>
                Drum Pads
              </h2>
              <div className="text-xs font-light" style={{ color: COLORS.text.tertiary }}>
                Click pads or use keyboard
              </div>
            </div>
            
            <div className="flex flex-col gap-4 max-w-2xl mx-auto">
              {[0, 1].map(row => (
                <div key={row} className="flex gap-4 justify-center">
                  {DRUM_PADS.filter(pad => pad.row === row).map(pad => {
                    const isActive = activeDrums.has(pad.id);
                    return (
                      <button
                        key={`${pad.id}-${pad.key}`}
                        onClick={() => handleDrumHit(pad.id)}
                        disabled={isPlaying}
                        className="relative transition-all disabled:cursor-not-allowed disabled:opacity-50"
                        style={{
                          width: '140px',
                          height: '140px',
                          backgroundColor: isActive ? COLORS.drum : 'white',
                          border: `2px solid ${isActive ? COLORS.drum : COLORS.border}`,
                          borderRadius: '16px',
                          transform: isActive ? 'scale(0.95)' : 'scale(1)',
                          boxShadow: isActive ? `0 8px 24px ${COLORS.drum}30` : '0 4px 12px rgba(0,0,0,0.05)'
                        }}
                      >
                        <div className="absolute top-3 left-3">
                          <div className="text-xs font-bold px-2 py-1 rounded" style={{
                            backgroundColor: isActive ? 'rgba(255,255,255,0.3)' : COLORS.keyPressed,
                            color: isActive ? 'white' : COLORS.text.tertiary
                          }}>
                            {pad.key.toUpperCase()}
                          </div>
                        </div>
                        <div className="text-lg font-bold mb-1" style={{
                          color: isActive ? 'white' : COLORS.text.primary
                        }}>
                          {pad.name}
                        </div>
                        <div className="text-xs font-light uppercase" style={{
                          color: isActive ? 'rgba(255,255,255,0.8)' : COLORS.text.tertiary
                        }}>
                          {pad.id}
                        </div>
                      </button>
                    );
                  })}
                </div>
              ))}
            </div>
            
            {/* Keyboard mapping hint */}
            <div className="text-center text-xs font-light mt-6" style={{ color: COLORS.text.tertiary }}>
              Use your keyboard: A, S, D, F (top row) • Z, X, C, V (bottom row) • Auto-records on hit
            </div>
          </div>
        )}

        {/* Legend */}
        <div className="mt-8 flex justify-center gap-8 text-sm font-light" style={{ color: COLORS.text.secondary }}>
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 rounded" style={{ backgroundColor: instrument === 'piano' ? COLORS.userNote : COLORS.drum }}></div>
            <span>Your Input</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 rounded" style={{ backgroundColor: COLORS.aiNote }}></div>
            <span>AI Generated</span>
          </div>
        </div>
      </div>
    </div>
  );
}

export default MelodyMaker;
