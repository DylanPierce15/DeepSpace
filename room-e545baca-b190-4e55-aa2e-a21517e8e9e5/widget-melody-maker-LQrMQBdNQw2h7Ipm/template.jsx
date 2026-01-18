import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { PianoSynth, DrumSynth } from './utils/audioSynth.js';
import { NOTES, COLORS } from './utils/constants.js';
import { 
  convertToQuantizedSequence, 
  convertFromQuantizedSequence,
  generateAlgorithmicMelody,
  smoothMelody,
  generateNameSuggestion,
  getStyleConfig
} from './utils/magentaHelpers.js';
import CurrentChord from './components/CurrentChord.jsx';
import SaveDialog from './components/SaveDialog.jsx';
import Library from './components/Library.jsx';
import MelodyTimeline from './components/MelodyTimeline.jsx';
import ControlPanel from './components/ControlPanel.jsx';
import Piano from './components/Piano.jsx';

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
  const [prePolishBackup, setPrePolishBackup] = useStorage('prePolishBackup', null);
  const [pianoVolume, setPianoVolume] = useStorage('pianoVolume', 0.7);
  const [drumVolume, setDrumVolume] = useStorage('drumVolume', 0.7);
  
  // Melody library using useFiles
  const melodiesFiles = useFiles('melodies');
  
  // UI state
  const [isPlaying, setIsPlaying] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isGeneratingDrums, setIsGeneratingDrums] = useState(false);
  const [isPolishing, setIsPolishing] = useState(false);
  const [activeTab, setActiveTab] = useState('piano'); // 'piano' or 'library'
  const [saveName, setSaveName] = useState('');
  const [showSaveDialog, setShowSaveDialog] = useState(false);
  const [isTyping, setIsTyping] = useState(false);
  const [playFromIndex, setPlayFromIndex] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [showFavoritesOnly, setShowFavoritesOnly] = useState(false);
  const [pressedKeys, setPressedKeys] = useState(new Set());
  const [activeNotes, setActiveNotes] = useState(new Set());
  const [currentChord, setCurrentChord] = useState([]);
  const [noteStartTimes, setNoteStartTimes] = useState(new Map());
  const [activeDrums, setActiveDrums] = useState(new Set());
  const [selectedNotes, setSelectedNotes] = useState(new Set());
  const [shiftKeyPressed, setShiftKeyPressed] = useState(false);
  const [musicStyle, setMusicStyle] = useStorage('musicStyle', 'balanced');
  
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
      pianoSynthRef.current = new PianoSynth(audioContextRef.current, musicStyle);
      drumSynthRef.current = new DrumSynth(audioContextRef.current);
    }
  }, [magentaLoaded, musicStyle]);

  // Update synth style when music style changes
  useEffect(() => {
    if (pianoSynthRef.current) {
      pianoSynthRef.current.setStyle(musicStyle);
    }
  }, [musicStyle]);

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
    pianoSynthRef.current.startNote(noteNumber, pianoVolume);
    setActiveNotes(prev => new Set([...prev, noteNumber]));
    setNoteStartTimes(prev => new Map(prev).set(noteNumber, Date.now()));
  }, [pianoVolume]);

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
      pianoSynthRef.current.playNote(noteNumber, duration, pianoVolume);
    });
  }, [pianoVolume]);

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
    console.log('Generate melody called, userSequence length:', userSequence.length);
    
    if (userSequence.length < 4) {
      alert('Please input at least 4 notes/chords before generating AI continuation');
      return;
    }
    
    setIsGenerating(true);
    console.log('Starting generation...');
    
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
        
        // Generate continuation with style-based temperature
        const styleConfig = getStyleConfig(musicStyle);
        const stepsToGenerate = musicStyle === 'ambient' ? 24 : musicStyle === 'electronic' ? 40 : 32;
        
        const result = await musicRNNRef.current.continueSequence(
          inputSequence,
          stepsToGenerate,
          styleConfig.temperature
        );
        
        console.log('continueSequence completed');
        
        console.log('MusicRNN result:', result);
        console.log('Total notes in result:', result.notes.length);
        console.log('User sequence ended at step:', inputSequence.totalQuantizedSteps);
        
        // Convert result back to our format
        const generated = [];
        const userEndStep = inputSequence.totalQuantizedSteps;
        
        // Filter for new notes that come after user input
        const newNotes = result.notes.filter(note => note.quantizedStartStep >= userEndStep);
        console.log('Notes after user input:', newNotes.length);
        
        // If no new notes were generated (MusicRNN sometimes does this), generate fallback
        if (newNotes.length === 0) {
          console.log('MusicRNN returned 0 new notes, using fallback');
          throw new Error('No new notes generated by MusicRNN');
        }
        
        // Group simultaneous notes into chords
        const notesByTime = new Map();
        newNotes.forEach((note) => {
          const startStep = note.quantizedStartStep;
          if (!notesByTime.has(startStep)) {
            notesByTime.set(startStep, []);
          }
          notesByTime.get(startStep).push(note);
        });
        
        // Convert to our format, preserving chords
        notesByTime.forEach((notesAtTime, startStep) => {
          const durationInSteps = notesAtTime[0].quantizedEndStep - notesAtTime[0].quantizedStartStep;
          const duration = (durationInSteps * 60) / (qpm * stepsPerQuarter);
          const relativeStep = startStep - userEndStep;
          const relativeTime = (relativeStep * 60) / (qpm * stepsPerQuarter);
          
          generated.push({
            notes: notesAtTime.map(n => n.pitch),
            time: Date.now() + relativeTime * 1000,
            duration,
            isChord: notesAtTime.length > 1
          });
        });
        
        setAiMelody(generated);
        console.log('Successfully generated', generated.length, 'notes with MusicRNN');
      } else {
        // Fallback to algorithmic generation with style support
        console.log('MusicRNN not available, using style-based fallback algorithm...');
        const numNotes = musicStyle === 'ambient' ? 6 : musicStyle === 'electronic' ? 16 : 12;
        const generated = generateAlgorithmicMelody(userSequence, numNotes, musicStyle);
        setAiMelody(generated);
        console.log('Style-based fallback algorithm generated', generated.length, 'notes with style:', musicStyle);
      }
      
      setIsGenerating(false);
      console.log('Generation complete');
    } catch (error) {
      console.error('Melody generation error:', error);
      console.error('Error stack:', error.stack);
      
      // Always use fallback on error with style support
      console.log('Using style-based fallback algorithm due to error');
      const numNotes = musicStyle === 'ambient' ? 6 : musicStyle === 'electronic' ? 16 : 12;
      const generated = generateAlgorithmicMelody(userSequence, numNotes, musicStyle);
      setAiMelody(generated);
      setIsGenerating(false);
      console.log('Fallback complete with', generated.length, 'notes');
    }
  }, [userSequence, musicStyle]);

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

  // Play the complete melody with drums (optionally from a specific index)
  const playMelody = useCallback((startIndex = 0) => {
    if (isPlaying) return;
    
    const allMelody = [...userSequence, ...aiMelody];
    if (allMelody.length === 0) return;
    
    setIsPlaying(true);
    setPlayFromIndex(null);
    
    // Calculate offset if starting from a specific index
    let startOffset = 0;
    for (let i = 0; i < startIndex; i++) {
      startOffset += allMelody[i].duration || 0.5;
    }
    
    // Calculate total melody duration from start point
    let totalMelodyDuration = 0;
    allMelody.slice(startIndex).forEach(item => {
      totalMelodyDuration += item.duration || 0.5;
    });
    
    // Play melody notes with actual durations
    let cumulativeTime = 0;
    
    allMelody.slice(startIndex).forEach((item, index) => {
      if (item.notes) {
        const duration = item.duration || 0.5;
        
        const timeout = setTimeout(() => {
          playChord(item.notes, duration);
          setActiveNotes(new Set(item.notes));
          setTimeout(() => setActiveNotes(new Set()), duration * 900);
        }, cumulativeTime * 1000);
        
        playbackTimeoutRef.current.push(timeout);
        cumulativeTime += duration;
      }
    });
    
    // Play drum accompaniment - loop to match melody duration
    if (aiDrums.length > 0 && drumSynthRef.current) {
      console.log('Setting up drum playback for', aiDrums.length, 'drum hits');
      
      // Calculate drum pattern duration by finding the max relative time
      // Drums are generated with timestamps, convert to relative positions
      const drumStartTime = Math.min(...aiDrums.map(d => d.time));
      const drumEndTime = Math.max(...aiDrums.map(d => d.time));
      const drumPatternDuration = (drumEndTime - drumStartTime) / 1000;
      
      console.log('Drum pattern duration:', drumPatternDuration, 'seconds');
      console.log('Total melody duration:', totalMelodyDuration, 'seconds');
      
      // Create drum schedule with relative timing (from 0)
      const drumSchedule = aiDrums.map(drum => ({
        drumType: drum.drumType,
        relativeTime: (drum.time - drumStartTime) / 1000
      }));
      
      // Loop drums to fill melody duration
      const loops = Math.max(1, Math.ceil(totalMelodyDuration / Math.max(drumPatternDuration, 0.5)));
      console.log('Looping drums', loops, 'times');
      
      for (let loop = 0; loop < loops; loop++) {
        const loopOffset = loop * (drumPatternDuration || 0.5);
        
        drumSchedule.forEach((drum, idx) => {
          const playTime = drum.relativeTime + loopOffset;
          
          // Only schedule if within melody duration
          if (playTime < totalMelodyDuration) {
            const timeout = setTimeout(() => {
              drumSynthRef.current?.playDrumHit(drum.drumType, drumVolume);
              setActiveDrums(new Set([drum.drumType]));
              setTimeout(() => setActiveDrums(new Set()), 100);
            }, playTime * 1000);
            
            playbackTimeoutRef.current.push(timeout);
          }
        });
      }
      
      console.log('Scheduled', playbackTimeoutRef.current.length - allMelody.slice(startIndex).length - 1, 'drum hits');
    }
    
    // Stop playing after all notes finish
    const stopTimeout = setTimeout(() => {
      setIsPlaying(false);
    }, totalMelodyDuration * 1000 + 500);
    
    playbackTimeoutRef.current.push(stopTimeout);
  }, [userSequence, aiMelody, aiDrums, playChord, isPlaying]);

  // Stop playback
  const stopPlayback = useCallback(() => {
    if (playbackTimeoutRef.current) {
      playbackTimeoutRef.current.forEach(t => clearTimeout(t));
      playbackTimeoutRef.current = [];
    }
    // Stop all active piano notes
    if (pianoSynthRef.current) {
      pianoSynthRef.current.stopAllNotes();
    }
    setIsPlaying(false);
    setActiveNotes(new Set());
    setActiveDrums(new Set());
  }, []);

  // Clear all notes
  const clearAll = useCallback(() => {
    const allMelody = [...userSequence, ...aiMelody];
    if (allMelody.length === 0) return;
    
    if (confirm('Clear all notes and drums? This cannot be undone.')) {
      stopPlayback();
      setUserSequence([]);
      setAiMelody([]);
      setAiDrums([]);
      setPrePolishBackup(null);
    }
  }, [stopPlayback, userSequence, aiMelody]);

  // Delete a specific note from user sequence
  const deleteNote = useCallback((index) => {
    setUserSequence(prev => prev.filter((_, i) => i !== index));
  }, []);

  // Delete a specific note from AI melody
  const deleteAiNote = useCallback((index) => {
    setAiMelody(prev => prev.filter((_, i) => i !== index));
  }, []);

  // Regenerate AI melody
  const regenerateMelody = useCallback(() => {
    setAiMelody([]);
    generateMelody();
  }, [generateMelody]);

  // Clear drums
  const clearDrums = useCallback(() => {
    setAiDrums([]);
  }, []);

  // Polish with AI - refine the entire melody for better flow
  const polishMelody = useCallback(async () => {
    const allMelody = [...userSequence, ...aiMelody];
    if (allMelody.length < 4) {
      alert('Need at least 4 notes to polish');
      return;
    }

    setIsPolishing(true);
    console.log('Starting polish with', allMelody.length, 'notes');
    console.log('User sequence length:', userSequence.length);
    console.log('AI melody length:', aiMelody.length);

    // Backup current state
    setPrePolishBackup({
      userSequence: [...userSequence],
      aiMelody: [...aiMelody]
    });

    try {
      let useMusicRNN = false;
      let polished = [];

      // Try MusicRNN first
      if (musicRNNRef.current) {
        try {
          console.log('Attempting polish with MusicRNN...');
          
          const inputSequence = convertToQuantizedSequence(allMelody);
          console.log('Polish input has', inputSequence.notes.length, 'notes');

          const result = await musicRNNRef.current.continueSequence(
            inputSequence,
            8,
            0.8
          );

          console.log('MusicRNN polish result has', result.notes.length, 'notes');

          // Only use MusicRNN result if it's reasonable
          if (result.notes.length >= 3) {
            polished = convertFromQuantizedSequence(result, 0);
            useMusicRNN = true;
            console.log('MusicRNN polish successful with', polished.length, 'notes');
          } else {
            console.log('MusicRNN result too short, falling back to algorithm');
          }
        } catch (rnnError) {
          console.log('MusicRNN polish error, falling back to algorithm:', rnnError.message);
        }
      }

      // If MusicRNN didn't work or isn't available, use algorithmic smoothing
      if (!useMusicRNN) {
        console.log('Using algorithmic polish...');
        polished = smoothMelody(allMelody);
        console.log('Algorithmic polish complete with', polished.length, 'notes');
      }

      // Apply the polished result (from either method)
      if (polished.length > 0) {
        const totalOriginal = userSequence.length + aiMelody.length;
        const userRatio = userSequence.length / totalOriginal;
        const splitPoint = Math.round(polished.length * userRatio);
        
        const polishedUser = polished.slice(0, splitPoint);
        const polishedAI = polished.slice(splitPoint);
        
        console.log('Final split: user =', polishedUser.length, ', AI =', polishedAI.length);

        setUserSequence(polishedUser);
        setAiMelody(polishedAI);
        console.log('Polish applied successfully');
      } else {
        throw new Error('Polish resulted in no notes');
      }

      setIsPolishing(false);
    } catch (error) {
      console.error('Polish error:', error);
      console.error('Error details:', error.message);
      
      // Restore from backup on error
      if (prePolishBackup) {
        console.log('Restoring from backup due to error');
        setUserSequence(prePolishBackup.userSequence);
        setAiMelody(prePolishBackup.aiMelody);
      }
      
      alert('Polish failed. Original melody restored.');
      setPrePolishBackup(null);
      setIsPolishing(false);
    }
  }, [userSequence, aiMelody, musicRNNRef, prePolishBackup]);

  // Undo polish - restore pre-polished version
  const undoPolish = useCallback(() => {
    if (prePolishBackup) {
      setUserSequence(prePolishBackup.userSequence);
      setAiMelody(prePolishBackup.aiMelody);
      setPrePolishBackup(null);
      console.log('Restored pre-polished version');
    }
  }, [prePolishBackup]);

  // Toggle note selection (for duplication and transposition)
  const toggleNoteSelection = useCallback((index, isAi = false) => {
    setSelectedNotes(prev => {
      const next = new Set(prev);
      const key = isAi ? `ai-${index}` : `user-${index}`;
      if (next.has(key)) {
        next.delete(key);
      } else {
        next.add(key);
      }
      return next;
    });
  }, []);

  // Clear selection
  const clearSelection = useCallback(() => {
    setSelectedNotes(new Set());
  }, []);

  // Duplicate selected notes
  const duplicateSelected = useCallback(() => {
    if (selectedNotes.size === 0) {
      alert('Select notes first by Ctrl/Cmd+Click');
      return;
    }

    const userIndices = Array.from(selectedNotes)
      .filter(key => key.startsWith('user-'))
      .map(key => parseInt(key.replace('user-', '')))
      .sort((a, b) => a - b);

    const aiIndices = Array.from(selectedNotes)
      .filter(key => key.startsWith('ai-'))
      .map(key => parseInt(key.replace('ai-', '')))
      .sort((a, b) => a - b);

    if (userIndices.length > 0) {
      const toDuplicate = userIndices.map(idx => ({ ...userSequence[idx] }));
      setUserSequence(prev => [...prev, ...toDuplicate]);
    }

    if (aiIndices.length > 0) {
      const toDuplicate = aiIndices.map(idx => ({ ...aiMelody[idx] }));
      setAiMelody(prev => [...prev, ...toDuplicate]);
    }

    clearSelection();
  }, [selectedNotes, userSequence, aiMelody, clearSelection]);

  // Shift entire melody up or down by semitones
  const shiftMelody = useCallback((semitones) => {
    const shiftNote = (note) => Math.max(60, Math.min(83, note + semitones));

    setUserSequence(prev => prev.map(item => ({
      ...item,
      notes: item.notes.map(shiftNote)
    })));

    setAiMelody(prev => prev.map(item => ({
      ...item,
      notes: item.notes.map(shiftNote)
    })));
  }, []);

  // Shift selected notes
  const shiftSelected = useCallback((semitones) => {
    if (selectedNotes.size === 0) {
      // If nothing selected, shift entire melody
      shiftMelody(semitones);
      return;
    }

    const shiftNote = (note) => Math.max(60, Math.min(83, note + semitones));

    const userIndices = Array.from(selectedNotes)
      .filter(key => key.startsWith('user-'))
      .map(key => parseInt(key.replace('user-', '')));

    const aiIndices = Array.from(selectedNotes)
      .filter(key => key.startsWith('ai-'))
      .map(key => parseInt(key.replace('ai-', '')));

    if (userIndices.length > 0) {
      setUserSequence(prev => prev.map((item, idx) => {
        if (userIndices.includes(idx)) {
          return { ...item, notes: item.notes.map(shiftNote) };
        }
        return item;
      }));
    }

    if (aiIndices.length > 0) {
      setAiMelody(prev => prev.map((item, idx) => {
        if (aiIndices.includes(idx)) {
          return { ...item, notes: item.notes.map(shiftNote) };
        }
        return item;
      }));
    }
  }, [selectedNotes, shiftMelody]);


  // Save current melody to library
  const saveMelody = useCallback(() => {
    if (!saveName.trim()) {
      alert('Please enter a name for your melody');
      return;
    }

    const allMelody = [...userSequence, ...aiMelody];
    if (allMelody.length === 0) {
      alert('No melody to save');
      return;
    }

    const melodyData = {
      name: saveName.trim(),
      userSequence: [...userSequence],
      aiMelody: [...aiMelody],
      aiDrums: [...aiDrums],
      tempo,
      createdAt: new Date().toISOString(),
      noteCount: allMelody.reduce((sum, item) => sum + (item.notes?.length || 0), 0),
      drumCount: aiDrums.length,
      favorite: false
    };

    // Generate a unique ID
    const id = `melody-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    
    melodiesFiles.write(id, melodyData);
    console.log('Saved melody with ID:', id);
    console.log('Melody data:', melodyData);
    
    // Verify it was saved
    const verification = melodiesFiles.read(id);
    console.log('Verification read:', verification);
    
    setSaveName('');
    setShowSaveDialog(false);
  }, [saveName, userSequence, aiMelody, aiDrums, tempo, melodiesFiles]);

  // Load melody from library
  const loadMelody = useCallback((id) => {
    const melody = melodiesFiles.read(id);
    if (melody) {
      setUserSequence(melody.userSequence || []);
      setAiMelody(melody.aiMelody || []);
      setAiDrums(melody.aiDrums || []);
      setTempo(melody.tempo || 120);
      setPrePolishBackup(null);
      setActiveTab('piano');
      console.log('Loaded melody:', melody.name);
    }
  }, [melodiesFiles]);

  // Delete melody from library
  const deleteMelody = useCallback((id) => {
    melodiesFiles.delete(id);
    console.log('Deleted melody:', id);
  }, [melodiesFiles]);

  // Toggle favorite status
  const toggleFavorite = useCallback((id) => {
    const melody = melodiesFiles.read(id);
    console.log('Toggling favorite for ID:', id);
    console.log('Current melody data:', melody);
    if (melody) {
      const updated = { ...melody, favorite: !melody.favorite };
      melodiesFiles.write(id, updated);
      console.log('Updated favorite status:', updated.favorite);
      
      // Verify update
      const verification = melodiesFiles.read(id);
      console.log('Verification after toggle:', verification);
    }
  }, [melodiesFiles]);

  // Get all saved melodies with filtering
  const savedMelodies = useMemo(() => {
    let melodies = melodiesFiles.list()
      .map(id => {
        const data = melodiesFiles.read(id);
        console.log('Reading melody:', id, data);
        return { id, ...data };
      })
      .filter(m => m.name) // Filter out corrupted entries
      .sort((a, b) => {
        const dateA = a.createdAt ? new Date(a.createdAt).getTime() : 0;
        const dateB = b.createdAt ? new Date(b.createdAt).getTime() : 0;
        return dateB - dateA;
      });
    
    // Filter by search query
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      melodies = melodies.filter(m => 
        m.name?.toLowerCase().includes(query)
      );
    }
    
    // Filter by favorites
    if (showFavoritesOnly) {
      melodies = melodies.filter(m => m.favorite);
    }
    
    return melodies;
  }, [melodiesFiles, searchQuery, showFavoritesOnly]);

  // Count favorites
  const favoritesCount = useMemo(() => {
    return melodiesFiles.list()
      .map(id => melodiesFiles.read(id))
      .filter(m => m.favorite).length;
  }, [melodiesFiles]);

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
      if (isTyping) return; // Don't play piano while typing in input fields
      
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
  }, [isPlaying, startNote, stopNote, currentChord, recordChord, isTyping]);

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
  // Show polish button if we have a complete melody (both user + AI parts)
  const canPolish = allMelody.length >= 4 && aiMelody.length > 0 && !isPolishing;
  
  // Count total notes
  const userNoteCount = userSequence.reduce((sum, item) => sum + (item.notes?.length || 0), 0);
  const aiNoteCount = aiMelody.reduce((sum, item) => sum + (item.notes?.length || 0), 0);

  return (
    <div className="min-h-screen p-6" style={{ background: COLORS.bg }}>
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-5 flex items-center justify-between flex-wrap gap-3">
          <div>
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
          <div className="flex gap-2">
            <button
              onClick={() => {
                setShowSaveDialog(true);
                setSaveName(generateNameSuggestion(userSequence, aiMelody, aiDrums));
              }}
              disabled={userSequence.length === 0}
              className="px-5 py-2 transition-all disabled:opacity-30 disabled:cursor-not-allowed"
              style={{
                background: COLORS.sage,
                color: COLORS.white,
                borderRadius: '12px 12px 4px 12px',
                border: 'none',
                fontFamily: 'system-ui, -apple-system, sans-serif',
                fontWeight: '500',
                fontSize: '0.9rem',
                boxShadow: `0 2px 8px ${COLORS.shadow}`
              }}
            >
              Save
            </button>
            <button
              onClick={() => setActiveTab(activeTab === 'library' ? 'piano' : 'library')}
              className="px-5 py-2 transition-all"
              style={{
                background: activeTab === 'library' ? COLORS.warmBrown : COLORS.bgLight,
                color: activeTab === 'library' ? COLORS.white : COLORS.text.secondary,
                borderRadius: '12px 4px 12px 12px',
                border: `2px solid ${COLORS.bg}`,
                fontFamily: 'system-ui, -apple-system, sans-serif',
                fontWeight: '500',
                fontSize: '0.9rem',
                boxShadow: `0 2px 8px ${COLORS.shadow}`
              }}
            >
              Library ({savedMelodies.length})
            </button>
          </div>
        </div>

        {/* Save Dialog */}
        {showSaveDialog && (
          <SaveDialog
            saveName={saveName}
            setSaveName={setSaveName}
            onSave={saveMelody}
            onCancel={() => { setShowSaveDialog(false); setSaveName(''); }}
            onSuggestName={() => setSaveName(generateNameSuggestion(userSequence, aiMelody, aiDrums))}
            onFocus={() => setIsTyping(true)}
            onBlur={() => setIsTyping(false)}
            colors={COLORS}
          />
        )}


        {/* Music Style Selector */}
        <div className="mb-4 p-5" style={{
          background: COLORS.cardBg,
          borderRadius: '24px 24px 8px 24px',
          boxShadow: `0 4px 16px ${COLORS.shadow}`
        }}>
          <div className="flex items-center gap-4 flex-wrap">
            <div className="text-xs uppercase" style={{ 
              color: COLORS.text.tertiary,
              fontFamily: 'system-ui, -apple-system, sans-serif',
              fontWeight: '500',
              letterSpacing: '0.08em'
            }}>
              Music Style:
            </div>
            {['balanced', 'classical', 'jazz', 'pop', 'electronic', 'ambient'].map((style) => (
              <button
                key={style}
                onClick={() => setMusicStyle(style)}
                className="px-4 py-2 transition-all"
                style={{
                  background: musicStyle === style ? COLORS.sage : COLORS.bgLight,
                  color: musicStyle === style ? COLORS.white : COLORS.text.secondary,
                  borderRadius: style === 'balanced' ? '12px 12px 4px 12px' : 
                               style === 'classical' ? '12px 4px 12px 12px' :
                               style === 'jazz' ? '4px 12px 12px 12px' :
                               style === 'pop' ? '12px 12px 12px 4px' :
                               style === 'electronic' ? '4px 12px 4px 12px' : '12px 4px 12px 4px',
                  border: musicStyle === style ? 'none' : `2px solid ${COLORS.bg}`,
                  fontFamily: 'system-ui, -apple-system, sans-serif',
                  fontWeight: '500',
                  fontSize: '0.85rem',
                  textTransform: 'capitalize',
                  boxShadow: musicStyle === style ? `0 2px 8px ${COLORS.shadow}` : 'none'
                }}
              >
                {style}
              </button>
            ))}
          </div>
          <div className="mt-3 text-xs" style={{ 
            color: COLORS.text.tertiary,
            fontFamily: 'system-ui, -apple-system, sans-serif',
            lineHeight: '1.5'
          }}>
            {musicStyle === 'classical' && (
              <>
                <strong style={{ color: COLORS.text.secondary }}>Sound:</strong> Rich grand piano with resonant harmonics and long sustain
                <br />
                <strong style={{ color: COLORS.text.secondary }}>Style:</strong> Smooth, stepwise motion with rich chords (40% chord probability)
              </>
            )}
            {musicStyle === 'jazz' && (
              <>
                <strong style={{ color: COLORS.text.secondary }}>Sound:</strong> Mellow piano with soft attack and warm tone
                <br />
                <strong style={{ color: COLORS.text.secondary }}>Style:</strong> Complex harmonies with syncopation and frequent chords (50%)
              </>
            )}
            {musicStyle === 'pop' && (
              <>
                <strong style={{ color: COLORS.text.secondary }}>Sound:</strong> Bright, punchy piano with crisp attack
                <br />
                <strong style={{ color: COLORS.text.secondary }}>Style:</strong> Catchy melodies with moderate chord use (35%)
              </>
            )}
            {musicStyle === 'electronic' && (
              <>
                <strong style={{ color: COLORS.text.secondary }}>Sound:</strong> Sharp synth lead with fast attack and bright harmonics
                <br />
                <strong style={{ color: COLORS.text.secondary }}>Style:</strong> Energetic, rhythmic patterns with fewer chords (15%)
              </>
            )}
            {musicStyle === 'ambient' && (
              <>
                <strong style={{ color: COLORS.text.secondary }}>Sound:</strong> Soft pad with slow attack, heavy sustain and reverberant tone
                <br />
                <strong style={{ color: COLORS.text.secondary }}>Style:</strong> Atmospheric with sustained chords (60%) and gentle motion
              </>
            )}
            {musicStyle === 'balanced' && (
              <>
                <strong style={{ color: COLORS.text.secondary }}>Sound:</strong> Versatile piano tone suitable for most styles
                <br />
                <strong style={{ color: COLORS.text.secondary }}>Style:</strong> Moderate chord use (25%) and balanced melodic motion
              </>
            )}
          </div>
        </div>

        {/* Current Chord Preview */}
        <CurrentChord currentChord={currentChord} colors={COLORS} />

        {/* Melody Timeline */}
        <MelodyTimeline
          userSequence={userSequence}
          aiMelody={aiMelody}
          aiDrums={aiDrums}
          activeNotes={activeNotes}
          activeDrums={activeDrums}
          playFromIndex={playFromIndex}
          selectedNotes={selectedNotes}
          onNoteClick={(idx) => setPlayFromIndex(idx)}
          onNoteDoubleClick={deleteNote}
          onAiNoteDoubleClick={deleteAiNote}
          onToggleSelection={toggleNoteSelection}
          colors={COLORS}
        />

        {/* Control Panel */}
        <ControlPanel
          pianoVolume={pianoVolume}
          drumVolume={drumVolume}
          setPianoVolume={setPianoVolume}
          setDrumVolume={setDrumVolume}
          isPlaying={isPlaying}
          isGenerating={isGenerating}
          isGeneratingDrums={isGeneratingDrums}
          isPolishing={isPolishing}
          canPlay={canPlay}
          canGenerate={canGenerate}
          canGenerateDrums={canGenerateDrums}
          canPolish={canPolish}
          playFromIndex={playFromIndex}
          prePolishBackup={prePolishBackup}
          aiMelody={aiMelody}
          aiDrums={aiDrums}
          userNoteCount={userNoteCount}
          aiNoteCount={aiNoteCount}
          userSequence={userSequence}
          musicRNNRef={musicRNNRef}
          drumRNNRef={drumRNNRef}
          selectedNotes={selectedNotes}
          onPlay={() => {
            if (playFromIndex !== null) {
              playMelody(playFromIndex);
            } else {
              playMelody(0);
            }
          }}
          onStopPlayback={stopPlayback}
          onGenerateMelody={generateMelody}
          onGenerateDrums={generateDrums}
          onPolishMelody={polishMelody}
          onUndoPolish={undoPolish}
          onRegenerateMelody={regenerateMelody}
          onClearDrums={clearDrums}
          onClearAll={clearAll}
          onShiftUp={() => shiftSelected(1)}
          onShiftDown={() => shiftSelected(-1)}
          onDuplicateSelected={duplicateSelected}
          onClearSelection={clearSelection}
          colors={COLORS}
        />

        {/* Tab Content */}
        {activeTab === 'piano' ? (
          <Piano
            pressedKeys={pressedKeys}
            activeNotes={activeNotes}
            isPlaying={isPlaying}
            onKeyDown={handleKeyDown}
            onKeyUp={handleKeyUp}
            colors={COLORS}
          />
        ) : (
          <Library
            savedMelodies={savedMelodies}
            searchQuery={searchQuery}
            setSearchQuery={setSearchQuery}
            showFavoritesOnly={showFavoritesOnly}
            setShowFavoritesOnly={setShowFavoritesOnly}
            favoritesCount={favoritesCount}
            onLoad={loadMelody}
            onDelete={deleteMelody}
            onToggleFavorite={toggleFavorite}
            onFocusSearch={() => setIsTyping(true)}
            onBlurSearch={() => setIsTyping(false)}
            colors={COLORS}
          />
        )}

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
