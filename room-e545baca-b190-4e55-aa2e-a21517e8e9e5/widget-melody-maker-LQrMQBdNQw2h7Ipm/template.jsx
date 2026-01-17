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

// Natural/Organic color palette - darker earth tones
const COLORS = {
  sage: '#5a7353', // Deep forest green
  sageLight: '#6d8765',
  sageDark: '#475a42',
  terracotta: '#b05a3c', // Burnt terracotta
  terracottaLight: '#c97456',
  warmBrown: '#6b5434', // Rich brown
  warmBrownLight: '#8b6f47',
  bg: '#2d2620', // Deep warm brown background
  bgLight: '#3d362f',
  cardBg: '#4a4239', // Warm dark card background
  cream: '#c9b99a', // Warm beige
  creamDark: '#a89978',
  text: {
    primary: '#e8dcc9', // Light cream for text
    secondary: '#c9b99a',
    tertiary: '#a89978'
  },
  white: '#fdfcfa',
  shadow: 'rgba(0, 0, 0, 0.3)' // Deeper shadow
};

function MelodyMaker() {
  const [tailwindLoaded, setTailwindLoaded] = useState(false);
  const [magentaLoaded, setMagentaLoaded] = useState(false);
  const [modelLoaded, setModelLoaded] = useState(false);
  const [modelError, setModelError] = useState(null);
  
  // Storage for melody notes - now storing sequences with timing and duration
  const [userSequence, setUserSequence] = useStorage('userSequence', []);
  const [aiMelody, setAiMelody] = useStorage('aiMelody', []);
  const [aiDrums, setAiDrums] = useStorage('aiDrums', []);
  const [tempo, setTempo] = useStorage('tempo', 120);
  
  // UI state
  const [isPlaying, setIsPlaying] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isGeneratingDrums, setIsGeneratingDrums] = useState(false);
  const [pressedKeys, setPressedKeys] = useState(new Set());
  const [activeNotes, setActiveNotes] = useState(new Set());
  const [currentChord, setCurrentChord] = useState([]);
  const [noteStartTimes, setNoteStartTimes] = useState(new Map());
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

  // Apply dark warm background with subtle texture
  useEffect(() => {
    document.body.style.background = COLORS.bg;
    document.body.style.backgroundImage = `
      repeating-linear-gradient(
        90deg,
        transparent,
        transparent 2px,
        rgba(0, 0, 0, 0.1) 2px,
        rgba(0, 0, 0, 0.1) 4px
      ),
      repeating-linear-gradient(
        0deg,
        transparent,
        transparent 2px,
        rgba(0, 0, 0, 0.1) 2px,
        rgba(0, 0, 0, 0.1) 4px
      )
    `;
    document.documentElement.style.minHeight = '100%';
    return () => {
      document.body.style.background = '';
      document.body.style.backgroundImage = '';
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
    setNoteStartTimes(prev => new Map(prev).set(noteNumber, Date.now()));
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

  // Play a chord (multiple notes) for playback with specific duration
  const playChord = useCallback((notes, duration = 0.5) => {
    if (!pianoSynthRef.current) return;
    notes.forEach(noteNumber => {
      pianoSynthRef.current.playNote(noteNumber, duration, 0.7);
    });
  }, []);

  // Record current chord to sequence with duration
  const recordChord = useCallback(() => {
    if (currentChord.length === 0) return;
    
    // Calculate duration based on how long the first note was held
    const now = Date.now();
    const startTime = noteStartTimes.get(currentChord[0]) || now;
    const duration = Math.max(0.1, (now - startTime) / 1000); // Duration in seconds, minimum 0.1s
    
    setUserSequence(prev => [...prev, { 
      notes: [...currentChord], 
      time: now,
      duration,
      isChord: currentChord.length > 1
    }]);
    
    setCurrentChord([]);
    // Clear start times for recorded notes
    setNoteStartTimes(prev => {
      const next = new Map(prev);
      currentChord.forEach(note => next.delete(note));
      return next;
    });
  }, [currentChord, noteStartTimes]);

  // Generate AI melody continuation using Magenta MusicRNN
  const generateMelody = useCallback(async () => {
    if (userSequence.length < 4) {
      alert('Please input at least 4 notes/chords before generating AI continuation');
      return;
    }
    
    setIsGenerating(true);
    
    try {
      if (musicRNNRef.current) {
        // Use actual Magenta MusicRNN model
        console.log('Generating melody with MusicRNN...');
        
        // Convert user sequence to quantized NoteSequence format
        const stepsPerQuarter = 4;
        const qpm = 120;
        const inputSequence = {
          notes: [],
          totalQuantizedSteps: 0,
          quantizationInfo: {
            stepsPerQuarter: stepsPerQuarter
          }
        };
        
        let currentStep = 0;
        userSequence.forEach((item) => {
          const noteDuration = item.duration || 0.5;
          const durationInSteps = Math.max(1, Math.round((noteDuration * qpm * stepsPerQuarter) / 60));
          
          if (item.notes) {
            item.notes.forEach(noteNumber => {
              inputSequence.notes.push({
                pitch: noteNumber,
                quantizedStartStep: currentStep,
                quantizedEndStep: currentStep + durationInSteps,
                velocity: 80
              });
            });
          }
          
          currentStep += durationInSteps;
        });
        
        inputSequence.totalQuantizedSteps = currentStep;
        
        console.log('Input sequence:', inputSequence);
        
        // Generate continuation with temperature
        const result = await musicRNNRef.current.continueSequence(
          inputSequence,
          20, // steps to generate  
          1.1 // temperature (higher = more creative)
        );
        
        console.log('MusicRNN result:', result);
        
        // Convert result back to our format
        const generated = [];
        const userEndStep = inputSequence.totalQuantizedSteps;
        
        result.notes
          .filter(note => note.quantizedStartStep >= userEndStep)
          .forEach((note) => {
            const durationInSteps = note.quantizedEndStep - note.quantizedStartStep;
            const duration = (durationInSteps * 60) / (qpm * stepsPerQuarter);
            const relativeStep = note.quantizedStartStep - userEndStep;
            const relativeTime = (relativeStep * 60) / (qpm * stepsPerQuarter);
            
            generated.push({
              notes: [note.pitch],
              time: Date.now() + relativeTime * 1000,
              duration,
              isChord: false
            });
          });
        
        setAiMelody(generated);
        console.log('Generated', generated.length, 'notes with MusicRNN');
      } else {
        // Fallback to algorithmic generation
        console.log('MusicRNN not available, using fallback algorithm...');
        
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
            duration: 0.5,
            isChord: false
          });
        }
        
        setAiMelody(generated);
      }
      
      setIsGenerating(false);
    } catch (error) {
      console.error('Melody generation error:', error);
      alert(`Failed to generate melody: ${error.message}. Using fallback algorithm.`);
      
      // Fallback
      const lastItem = userSequence[userSequence.length - 1];
      const lastNote = lastItem.notes ? lastItem.notes[0] : 60;
      const generated = [];
      
      for (let i = 0; i < 12; i++) {
        const interval = Math.random() < 0.7 ? 2 : 5;
        const nextNote = Math.max(60, Math.min(83, lastNote + interval * (Math.random() < 0.5 ? 1 : -1)));
        generated.push({ 
          notes: [nextNote], 
          time: Date.now() + i * 100,
          duration: 0.5,
          isChord: false
        });
      }
      
      setAiMelody(generated);
      setIsGenerating(false);
    }
  }, [userSequence]);

  // Generate AI drum accompaniment on top of the melody
  const generateDrums = useCallback(async () => {
    const totalSequence = [...userSequence, ...aiMelody];
    if (totalSequence.length === 0) {
      alert('Create a melody first before adding drums');
      return;
    }
    
    setIsGeneratingDrums(true);
    
    try {
      if (drumRNNRef.current) {
        console.log('Generating drum accompaniment with DrumRNN...');
        
        // Calculate total duration of the melody
        let totalTime = 0;
        totalSequence.forEach(item => {
          totalTime += item.duration || 0.5;
        });
        
        // Create a simple seed pattern for DrumRNN
        const seedPattern = {
          notes: [
            { pitch: 36, quantizedStartStep: 0, quantizedEndStep: 1, isDrum: true, velocity: 100 }, // Kick
            { pitch: 42, quantizedStartStep: 1, quantizedEndStep: 2, isDrum: true, velocity: 80 },  // HiHat
            { pitch: 38, quantizedStartStep: 2, quantizedEndStep: 3, isDrum: true, velocity: 100 }, // Snare
            { pitch: 42, quantizedStartStep: 3, quantizedEndStep: 4, isDrum: true, velocity: 80 }   // HiHat
          ],
          totalTime: 1.0,
          totalQuantizedSteps: 4,
          quantizationInfo: { stepsPerQuarter: 4 }
        };
        
        // Generate drum pattern matching the melody length
        const stepsToGenerate = Math.ceil(totalTime * 4); // 4 steps per second
        const result = await drumRNNRef.current.continueSequence(
          seedPattern,
          stepsToGenerate,
          1.0
        );
        
        // Convert result to our format
        const generated = [];
        const stepDuration = 0.25;
        
        result.notes
          .filter(note => note.quantizedStartStep >= 4) // Skip seed
          .forEach(note => {
            const drumTypeMap = {
              36: 'kick',
              38: 'snare',
              42: 'hihat',
              46: 'openhat'
            };
            const drumType = drumTypeMap[note.pitch] || 'hihat';
            
            generated.push({
              drumType,
              time: Date.now() + (note.quantizedStartStep - 4) * stepDuration * 1000,
              duration: stepDuration
            });
          });
        
        setAiDrums(generated);
        console.log('Generated', generated.length, 'drum hits with DrumRNN');
      } else {
        // Fallback: Create a simple drum pattern
        console.log('DrumRNN not available, using algorithmic drums...');
        
        let totalTime = 0;
        totalSequence.forEach(item => {
          totalTime += item.duration || 0.5;
        });
        
        const generated = [];
        const beatsPerBar = 4;
        const numBeats = Math.ceil(totalTime * 2); // 2 beats per second (120 BPM)
        
        for (let i = 0; i < numBeats; i++) {
          const beatTime = i * 0.5;
          
          // Kick on 1 and 3
          if (i % 4 === 0 || i % 4 === 2) {
            generated.push({
              drumType: 'kick',
              time: Date.now() + beatTime * 1000,
              duration: 0.1
            });
          }
          
          // Snare on 2 and 4
          if (i % 4 === 1 || i % 4 === 3) {
            generated.push({
              drumType: 'snare',
              time: Date.now() + beatTime * 1000,
              duration: 0.1
            });
          }
          
          // Hi-hat on every beat
          generated.push({
            drumType: 'hihat',
            time: Date.now() + beatTime * 1000,
            duration: 0.1
          });
        }
        
        setAiDrums(generated);
      }
      
      setIsGeneratingDrums(false);
    } catch (error) {
      console.error('Drum generation error:', error);
      alert(`Failed to generate drums: ${error.message}`);
      setIsGeneratingDrums(false);
    }
  }, [userSequence, aiMelody]);

  // Play the complete melody with drums
  const playMelody = useCallback(() => {
    if (isPlaying) return;
    
    const allMelody = [...userSequence, ...aiMelody];
    if (allMelody.length === 0) return;
    
    setIsPlaying(true);
    
    // Play melody notes with actual durations
    let cumulativeTime = 0;
    let maxTime = 0;
    
    allMelody.forEach((item, index) => {
      if (item.notes) {
        const duration = item.duration || 0.5;
        maxTime = cumulativeTime + duration;
        
        const timeout = setTimeout(() => {
          playChord(item.notes, duration);
          setActiveNotes(new Set(item.notes));
          setTimeout(() => setActiveNotes(new Set()), duration * 900);
        }, cumulativeTime * 1000);
        
        playbackTimeoutRef.current.push(timeout);
        cumulativeTime += duration;
      }
    });
    
    // Play drum accompaniment if available
    if (aiDrums.length > 0) {
      aiDrums.forEach(drum => {
        const relativeTime = (drum.time - Date.now()) / 1000;
        if (relativeTime < maxTime) {
          const timeout = setTimeout(() => {
            drumSynthRef.current?.playDrumHit(drum.drumType);
            setActiveDrums(new Set([drum.drumType]));
            setTimeout(() => setActiveDrums(new Set()), 100);
          }, Math.max(0, relativeTime * 1000));
          
          playbackTimeoutRef.current.push(timeout);
        }
      });
    }
    
    // Stop playing after all notes finish
    const stopTimeout = setTimeout(() => {
      setIsPlaying(false);
    }, maxTime * 1000 + 500);
    
    playbackTimeoutRef.current.push(stopTimeout);
  }, [userSequence, aiMelody, aiDrums, playChord, isPlaying]);

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
    setAiMelody([]);
    setAiDrums([]);
  }, [stopPlayback]);

  // Regenerate AI melody
  const regenerateMelody = useCallback(() => {
    setAiMelody([]);
    generateMelody();
  }, [generateMelody]);

  // Clear drums
  const clearDrums = useCallback(() => {
    setAiDrums([]);
  }, []);

  // Handle mouse/touch down on piano key
  const handleKeyDown = useCallback((noteNumber) => {
    if (isPlaying) return;
    startNote(noteNumber);
    setPressedKeys(prev => new Set([...prev, noteNumber]));
    setCurrentChord(prev => [...prev, noteNumber]);
  }, [isPlaying, startNote]);

  // Handle mouse/touch up on piano key
  const handleKeyUp = useCallback((noteNumber) => {
    stopNote(noteNumber);
    setPressedKeys(prev => {
      const next = new Set(prev);
      next.delete(noteNumber);
      return next;
    });
  }, [stopNote]);

  // Physical keyboard support
  useEffect(() => {
    const handlePhysicalKeyDown = (e) => {
      if (isPlaying) return;
      if (e.repeat) return; // Ignore key repeat
      
      const key = e.key.toLowerCase();
      const noteData = NOTES.find(n => n.key === key);
      
      if (noteData && !keyDownRef.current.has(key)) {
        e.preventDefault();
        keyDownRef.current.add(key);
        startNote(noteData.note);
        setPressedKeys(prev => new Set([...prev, noteData.note]));
        setCurrentChord(prev => [...prev, noteData.note]);
      }
    };
    
    const handlePhysicalKeyUp = (e) => {
      const key = e.key.toLowerCase();
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
    };
    
    window.addEventListener('keydown', handlePhysicalKeyDown);
    window.addEventListener('keyup', handlePhysicalKeyUp);
    
    return () => {
      window.removeEventListener('keydown', handlePhysicalKeyDown);
      window.removeEventListener('keyup', handlePhysicalKeyUp);
    };
  }, [isPlaying, startNote, stopNote, currentChord, recordChord]);

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
      <div className="min-h-screen flex items-center justify-center" style={{ background: COLORS.bg }}>
        <div className="text-center px-8 py-12 rounded-[32px]" style={{
          background: COLORS.cardBg,
          boxShadow: `0 8px 32px ${COLORS.shadow}`
        }}>
          <div className="text-lg mb-2" style={{ 
            color: COLORS.text.primary,
            fontFamily: 'system-ui, -apple-system, sans-serif',
            fontWeight: '500'
          }}>
            Loading Magenta.js AI Model...
          </div>
          <div className="text-sm" style={{ 
            color: COLORS.text.tertiary,
            fontFamily: 'system-ui, -apple-system, sans-serif'
          }}>
            {modelError ? modelError : 'This may take a moment'}
          </div>
        </div>
      </div>
    );
  }

  const allMelody = [...userSequence, ...aiMelody];
  const canGenerate = userSequence.length >= 4 && !isGenerating;
  const canGenerateDrums = allMelody.length > 0 && !isGeneratingDrums;
  const canPlay = allMelody.length > 0 && !isPlaying;
  
  // Count total notes
  const userNoteCount = userSequence.reduce((sum, item) => sum + (item.notes?.length || 0), 0);
  const aiNoteCount = aiMelody.reduce((sum, item) => sum + (item.notes?.length || 0), 0);

  return (
    <div className="min-h-screen p-6" style={{ background: COLORS.bg }}>
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-5">
          <h1 className="text-3xl mb-2" style={{ 
            color: COLORS.text.primary,
            fontFamily: 'system-ui, -apple-system, sans-serif',
            fontWeight: '600',
            letterSpacing: '-0.02em'
          }}>
            Melody Maker
          </h1>
          <p style={{ 
            color: COLORS.text.secondary,
            fontFamily: 'system-ui, -apple-system, sans-serif',
            fontSize: '0.95rem'
          }}>
            Create melodies - let AI complete them and add drum accompaniment with Magenta.js
          </p>
        </div>

        {/* Current Chord Preview - Fixed height to prevent layout shift */}
        <div className="mb-4 p-5" style={{
          background: COLORS.cardBg,
          borderRadius: '24px 24px 8px 24px',
          boxShadow: `0 4px 16px ${COLORS.shadow}`,
          minHeight: '100px'
        }}>
          {currentChord.length > 0 ? (
            <>
              <div className="text-xs mb-3 uppercase" style={{ 
                color: COLORS.text.secondary,
                letterSpacing: '0.08em',
                fontFamily: 'system-ui, -apple-system, sans-serif',
                fontWeight: '500'
              }}>
                Current Chord (Release keys to record)
              </div>
              <div className="flex gap-2 flex-wrap">
                {currentChord.map((note, idx) => (
                  <div
                    key={idx}
                    className="px-4 py-2 text-sm"
                    style={{ 
                      backgroundColor: COLORS.sage,
                      color: COLORS.white,
                      borderRadius: idx % 2 === 0 ? '16px 16px 4px 16px' : '16px 4px 16px 16px',
                      fontFamily: 'system-ui, -apple-system, sans-serif',
                      fontWeight: '500',
                      boxShadow: `0 2px 8px ${COLORS.shadow}`
                    }}
                  >
                    {NOTES.find(n => n.note === note)?.name}
                  </div>
                ))}
              </div>
            </>
          ) : (
            <div className="text-xs uppercase flex items-center justify-center h-full" style={{ 
              color: COLORS.text.tertiary,
              letterSpacing: '0.08em',
              fontFamily: 'system-ui, -apple-system, sans-serif',
              fontWeight: '500'
            }}>
              Press keys to play notes
            </div>
          )}
        </div>

        {/* Piano Roll Visualization */}
        <div className="mb-4 p-6" style={{
          background: COLORS.cardBg,
          borderRadius: '32px 8px 32px 32px',
          boxShadow: `0 6px 24px ${COLORS.shadow}`
        }}>
          <h2 className="text-xs mb-4 tracking-wide uppercase" style={{ 
            color: COLORS.text.secondary,
            letterSpacing: '0.08em',
            fontFamily: 'system-ui, -apple-system, sans-serif',
            fontWeight: '500'
          }}>
            Melody Timeline
          </h2>
          
          {allMelody.length === 0 ? (
            <div className="text-center py-12" style={{ 
              color: COLORS.text.tertiary,
              fontFamily: 'system-ui, -apple-system, sans-serif'
            }}>
              Press piano keys below or use your keyboard (A-B keys) to start
            </div>
          ) : (
            <div>
              {/* Melody Timeline */}
              <div className="mb-4">
                <div className="text-xs mb-2 uppercase" style={{ 
                  color: COLORS.text.tertiary,
                  letterSpacing: '0.08em',
                  fontFamily: 'system-ui, -apple-system, sans-serif',
                  fontWeight: '500'
                }}>
                  Melody
                </div>
                <div className="flex items-start gap-2 flex-wrap">
                  {userSequence.map((item, idx) => (
                    <div
                      key={`user-${idx}`}
                      className="flex flex-col items-center gap-2"
                    >
                      <div className="flex flex-col gap-1">
                        {item.notes?.map((note, noteIdx) => (
                          <div
                            key={noteIdx}
                            className="px-3 py-2 flex items-center justify-center text-xs"
                            style={{
                              backgroundColor: COLORS.sage,
                              color: COLORS.white,
                              borderRadius: (idx + noteIdx) % 3 === 0 ? '12px 12px 4px 12px' : (idx + noteIdx) % 3 === 1 ? '12px 4px 12px 12px' : '4px 12px 12px 12px',
                              boxShadow: activeNotes.has(note) ? `0 4px 16px ${COLORS.sage}80` : `0 2px 6px ${COLORS.shadow}`,
                              transform: activeNotes.has(note) ? 'scale(1.08)' : 'scale(1)',
                              transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
                              minWidth: '46px',
                              fontFamily: 'system-ui, -apple-system, sans-serif',
                              fontWeight: '500'
                            }}
                          >
                            {NOTES.find(n => n.note === note)?.name}
                          </div>
                        ))}
                      </div>
                      <div className="text-xs" style={{ 
                        color: COLORS.text.tertiary,
                        fontFamily: 'system-ui, -apple-system, sans-serif'
                      }}>
                        {item.isChord ? 'Chord' : 'You'}
                      </div>
                    </div>
                  ))}
                  
                  {aiMelody.length > 0 && (
                    <div className="w-px h-14 mx-2" style={{ 
                      background: `linear-gradient(to bottom, ${COLORS.creamDark}, transparent, ${COLORS.creamDark})`
                    }}></div>
                  )}
                  
                  {aiMelody.map((item, idx) => (
                    <div
                      key={`ai-${idx}`}
                      className="flex flex-col items-center gap-2"
                    >
                      <div className="flex flex-col gap-1">
                        {item.notes?.map((note, noteIdx) => (
                          <div
                            key={noteIdx}
                            className="px-3 py-2 flex items-center justify-center text-xs"
                            style={{
                              backgroundColor: COLORS.warmBrown,
                              color: COLORS.white,
                              borderRadius: (idx + noteIdx) % 3 === 0 ? '12px 4px 12px 12px' : (idx + noteIdx) % 3 === 1 ? '4px 12px 12px 12px' : '12px 12px 4px 12px',
                              boxShadow: activeNotes.has(note) ? `0 4px 16px ${COLORS.warmBrown}80` : `0 2px 6px ${COLORS.shadow}`,
                              transform: activeNotes.has(note) ? 'scale(1.08)' : 'scale(1)',
                              transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
                              minWidth: '46px',
                              fontFamily: 'system-ui, -apple-system, sans-serif',
                              fontWeight: '500'
                            }}
                          >
                            {NOTES.find(n => n.note === note)?.name}
                          </div>
                        ))}
                      </div>
                      <div className="text-xs" style={{ 
                        color: COLORS.text.tertiary,
                        fontFamily: 'system-ui, -apple-system, sans-serif'
                      }}>
                        AI
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Drum Timeline */}
              {aiDrums.length > 0 && (
                <div className="mt-5 pt-5" style={{ 
                  borderTop: `2px solid ${COLORS.creamDark}`
                }}>
                  <div className="text-xs mb-2 uppercase" style={{ 
                    color: COLORS.text.tertiary,
                    letterSpacing: '0.08em',
                    fontFamily: 'system-ui, -apple-system, sans-serif',
                    fontWeight: '500'
                  }}>
                    Drums (AI Generated)
                  </div>
                  <div className="flex items-start gap-2 flex-wrap">
                    {aiDrums.slice(0, 32).map((drum, idx) => (
                      <div
                        key={`drum-${idx}`}
                        className="flex flex-col items-center gap-2"
                      >
                        <div
                          className="px-3 py-2 flex items-center justify-center text-xs uppercase"
                          style={{
                            backgroundColor: COLORS.terracotta,
                            color: COLORS.white,
                            borderRadius: idx % 4 === 0 ? '12px 4px 12px 4px' : idx % 4 === 1 ? '4px 12px 4px 12px' : idx % 4 === 2 ? '12px 12px 4px 4px' : '4px 4px 12px 12px',
                            boxShadow: activeDrums.has(drum.drumType) ? `0 4px 16px ${COLORS.terracotta}80` : `0 2px 6px ${COLORS.shadow}`,
                            transform: activeDrums.has(drum.drumType) ? 'scale(1.08)' : 'scale(1)',
                            transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
                            minWidth: '50px',
                            fontFamily: 'system-ui, -apple-system, sans-serif',
                            fontWeight: '600',
                            letterSpacing: '0.05em'
                          }}
                        >
                          {drum.drumType === 'hihat' ? 'HH' : drum.drumType === 'openhat' ? 'OH' : drum.drumType[0].toUpperCase()}
                        </div>
                      </div>
                    ))}
                    {aiDrums.length > 32 && (
                      <div className="px-3 py-2 text-xs" style={{ 
                        color: COLORS.text.tertiary,
                        fontFamily: 'system-ui, -apple-system, sans-serif'
                      }}>
                        +{aiDrums.length - 32} more
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Control Panel */}
        <div className="mb-4 p-6" style={{
          background: COLORS.cardBg,
          borderRadius: '8px 32px 32px 32px',
          boxShadow: `0 6px 24px ${COLORS.shadow}`
        }}>
          <div className="flex flex-wrap gap-3 items-center mb-5">
            <button
              onClick={canPlay ? playMelody : stopPlayback}
              disabled={allMelody.length === 0}
              className="px-7 py-3 transition-all disabled:opacity-30 disabled:cursor-not-allowed"
              style={{
                backgroundColor: isPlaying ? COLORS.terracotta : COLORS.sage,
                color: COLORS.white,
                borderRadius: '20px 20px 4px 20px',
                boxShadow: `0 4px 12px ${COLORS.shadow}`,
                fontFamily: 'system-ui, -apple-system, sans-serif',
                fontWeight: '500',
                fontSize: '0.95rem',
                border: 'none'
              }}
            >
              {isPlaying ? 'Stop' : 'Play'}
            </button>
            
            <button
              onClick={generateMelody}
              disabled={!canGenerate}
              className="px-7 py-3 transition-all disabled:opacity-30 disabled:cursor-not-allowed"
              style={{
                backgroundColor: COLORS.warmBrown,
                color: COLORS.white,
                borderRadius: '20px 4px 20px 20px',
                boxShadow: `0 4px 12px ${COLORS.shadow}`,
                fontFamily: 'system-ui, -apple-system, sans-serif',
                fontWeight: '500',
                fontSize: '0.95rem',
                border: 'none'
              }}
            >
              {isGenerating ? 'Generating...' : 'Complete Melody'}
            </button>
            
            <button
              onClick={generateDrums}
              disabled={!canGenerateDrums}
              className="px-7 py-3 transition-all disabled:opacity-30 disabled:cursor-not-allowed"
              style={{
                backgroundColor: COLORS.terracotta,
                color: COLORS.white,
                borderRadius: '4px 20px 20px 20px',
                boxShadow: `0 4px 12px ${COLORS.shadow}`,
                fontFamily: 'system-ui, -apple-system, sans-serif',
                fontWeight: '500',
                fontSize: '0.95rem',
                border: 'none'
              }}
            >
              {isGeneratingDrums ? 'Generating...' : aiDrums.length > 0 ? 'Regenerate Drums' : 'Add Drums'}
            </button>
            
            {aiMelody.length > 0 && (
              <button
                onClick={regenerateMelody}
                disabled={isGenerating}
                className="px-6 py-3 transition-all"
              style={{
                background: COLORS.bgLight,
                color: COLORS.text.secondary,
                borderRadius: '16px 16px 4px 16px',
                border: `2px solid ${COLORS.bg}`,
                  fontFamily: 'system-ui, -apple-system, sans-serif',
                  fontWeight: '500',
                  fontSize: '0.9rem'
                }}
              >
                Regenerate
              </button>
            )}
            
            {aiDrums.length > 0 && (
              <button
                onClick={clearDrums}
                className="px-6 py-3 transition-all"
              style={{
                background: COLORS.bgLight,
                color: COLORS.text.secondary,
                borderRadius: '16px 4px 16px 16px',
                border: `2px solid ${COLORS.bg}`,
                  fontFamily: 'system-ui, -apple-system, sans-serif',
                  fontWeight: '500',
                  fontSize: '0.9rem'
                }}
              >
                Clear Drums
              </button>
            )}
            
            <button
              onClick={clearAll}
              className="px-6 py-3 transition-all"
              style={{
                background: COLORS.bgLight,
                color: COLORS.text.secondary,
                borderRadius: '4px 16px 16px 16px',
                border: `2px solid ${COLORS.bg}`,
                fontFamily: 'system-ui, -apple-system, sans-serif',
                fontWeight: '500',
                fontSize: '0.9rem'
              }}
            >
              Clear All
            </button>
          </div>

          {/* Status */}
          <div className="text-sm" style={{ 
            color: COLORS.text.secondary,
            fontFamily: 'system-ui, -apple-system, sans-serif'
          }}>
            {userSequence.length === 0 && 'Start by pressing piano keys or using your keyboard (A-B keys)'}
            {userSequence.length > 0 && userSequence.length < 4 && `${userSequence.length} notes/chords recorded - need ${4 - userSequence.length} more for AI completion`}
            {userSequence.length >= 4 && aiMelody.length === 0 && 'Ready for AI melody completion!'}
            {aiMelody.length > 0 && !aiDrums.length && 'Melody complete! Click "Add Drums" for AI accompaniment'}
            {aiMelody.length > 0 && aiDrums.length > 0 && `Complete composition: ${userNoteCount} user notes + ${aiNoteCount} AI notes + ${aiDrums.length} drum hits`}
          </div>
          
          {musicRNNRef.current && (
            <div className="mt-3 text-xs" style={{ 
              color: COLORS.text.tertiary,
              fontFamily: 'system-ui, -apple-system, sans-serif'
            }}>
              {'\u{2713}'} Using Magenta MusicRNN{drumRNNRef.current ? ' and DrumRNN' : ''} for generation
            </div>
          )}
        </div>

        {/* Piano Keyboard */}
        <div className="p-6" style={{
          background: COLORS.cardBg,
          borderRadius: '32px 32px 8px 8px',
          boxShadow: `0 6px 24px ${COLORS.shadow}`
        }}>
          <div className="flex items-center justify-between mb-5 flex-wrap gap-2">
            <h2 className="text-xs tracking-wide uppercase" style={{ 
              color: COLORS.text.secondary,
              letterSpacing: '0.08em',
              fontFamily: 'system-ui, -apple-system, sans-serif',
              fontWeight: '500'
            }}>
              Piano Keyboard
            </h2>
            <div className="text-xs" style={{ 
              color: COLORS.text.tertiary,
              fontFamily: 'system-ui, -apple-system, sans-serif'
            }}>
              Hold multiple keys for chords - hold time matters!
            </div>
          </div>
          
          <div className="relative flex justify-center mb-4 overflow-x-auto pb-2">
            <div className="relative inline-flex">
              {/* White keys */}
              <div className="flex">
                {NOTES.filter(n => !n.isBlack).map((noteData, whiteIdx) => {
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
                        width: '52px',
                        height: '200px',
                        backgroundColor: isPressed ? COLORS.sageLight : COLORS.cream,
                        transform: isPressed ? 'translateY(2px)' : 'none',
                        boxShadow: isPressed ? `inset 0 3px 8px ${COLORS.shadow}` : `0 3px 8px ${COLORS.shadow}`,
                        border: `2px solid ${COLORS.creamDark}`,
                        borderBottom: isPressed ? `2px solid ${COLORS.creamDark}` : `4px solid ${COLORS.creamDark}`,
                        borderRadius: whiteIdx % 3 === 0 ? '8px 8px 8px 8px' : whiteIdx % 3 === 1 ? '8px 8px 4px 8px' : '8px 8px 8px 4px'
                      }}
                    >
                      <div className="absolute top-3 left-0 right-0 text-center">
                        <div className="text-xs mb-1" style={{ 
                          color: isPressed ? COLORS.white : COLORS.warmBrown,
                          textTransform: 'uppercase',
                          fontFamily: 'system-ui, -apple-system, sans-serif',
                          fontWeight: '600'
                        }}>
                          {noteData.key}
                        </div>
                      </div>
                      <span className="absolute bottom-3 left-0 right-0 text-center text-xs" style={{
                        color: COLORS.warmBrown,
                        fontFamily: 'system-ui, -apple-system, sans-serif',
                        fontWeight: '500'
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
                  const leftPos = whiteKeysBefore * 52 - 18;
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
                        width: '36px',
                        height: '130px',
                        backgroundColor: isPressed ? COLORS.warmBrownLight : '#1a1612',
                        left: `${leftPos}px`,
                        transform: isPressed ? 'translateY(2px)' : 'none',
                        boxShadow: isPressed ? `inset 0 3px 8px rgba(0,0,0,0.4)` : `0 4px 12px ${COLORS.shadow}, 0 2px 4px rgba(0,0,0,0.3)`,
                        zIndex: 10,
                        borderRadius: whiteKeysBefore % 3 === 0 ? '4px 4px 8px 4px' : whiteKeysBefore % 3 === 1 ? '4px 4px 4px 8px' : '8px 4px 4px 4px',
                        border: `2px solid #0d0a08`
                      }}
                    >
                      <div className="absolute top-2 left-0 right-0 text-center">
                        <div className="text-xs mb-1" style={{ 
                          color: isPressed ? COLORS.cream : 'rgba(255,255,255,0.5)',
                          textTransform: 'uppercase',
                          fontFamily: 'system-ui, -apple-system, sans-serif',
                          fontWeight: '600'
                        }}>
                          {noteData.key}
                        </div>
                      </div>
                      <span className="absolute bottom-2 left-0 right-0 text-center text-xs" style={{
                        color: 'rgba(255,255,255,0.6)',
                        fontFamily: 'system-ui, -apple-system, sans-serif',
                        fontWeight: '500'
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
          <div className="text-center text-xs mt-5" style={{ 
            color: COLORS.text.tertiary,
            fontFamily: 'system-ui, -apple-system, sans-serif'
          }}>
            Use your keyboard: A-B keys map to piano keys • Hold multiple for chords • Hold time = note duration • Release to record
          </div>
        </div>

        {/* Legend */}
        <div className="mt-6 flex justify-center gap-6 text-sm flex-wrap" style={{ 
          color: COLORS.text.secondary,
          fontFamily: 'system-ui, -apple-system, sans-serif'
        }}>
          <div className="flex items-center gap-2">
            <div className="w-5 h-5" style={{ 
              backgroundColor: COLORS.sage,
              borderRadius: '8px 8px 2px 8px',
              boxShadow: `0 2px 4px ${COLORS.shadow}`
            }}></div>
            <span>Your Melody</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-5 h-5" style={{ 
              backgroundColor: COLORS.warmBrown,
              borderRadius: '8px 2px 8px 8px',
              boxShadow: `0 2px 4px ${COLORS.shadow}`
            }}></div>
            <span>AI Melody</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-5 h-5" style={{ 
              backgroundColor: COLORS.terracotta,
              borderRadius: '2px 8px 8px 8px',
              boxShadow: `0 2px 4px ${COLORS.shadow}`
            }}></div>
            <span>AI Drums</span>
          </div>
        </div>
      </div>
    </div>
  );
}

export default MelodyMaker;
