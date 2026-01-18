// Helper functions for Magenta.js AI generation

/**
 * Convert user sequence to quantized NoteSequence format for MusicRNN
 */
export function convertToQuantizedSequence(sequence, stepsPerQuarter = 4, qpm = 120) {
  const inputSequence = {
    notes: [],
    totalQuantizedSteps: 0,
    quantizationInfo: {
      stepsPerQuarter: stepsPerQuarter
    }
  };

  let currentStep = 0;
  sequence.forEach((item) => {
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
  return inputSequence;
}

/**
 * Convert MusicRNN result back to our melody format
 */
export function convertFromQuantizedSequence(result, filterFromStep = 0, stepsPerQuarter = 4, qpm = 120) {
  const generated = [];

  result.notes
    .filter(note => note.quantizedStartStep >= filterFromStep)
    .forEach((note) => {
      const durationInSteps = note.quantizedEndStep - note.quantizedStartStep;
      const duration = (durationInSteps * 60) / (qpm * stepsPerQuarter);
      const relativeStep = note.quantizedStartStep - filterFromStep;
      const relativeTime = (relativeStep * 60) / (qpm * stepsPerQuarter);

      generated.push({
        notes: [note.pitch],
        time: Date.now() + relativeTime * 1000,
        duration,
        isChord: false
      });
    });

  return generated;
}

/**
 * Generate algorithmic melody continuation
 */
export function generateAlgorithmicMelody(userSequence, numNotes = 12) {
  const lastItem = userSequence[userSequence.length - 1];
  const lastNote = lastItem.notes ? lastItem.notes[0] : 60;
  const generated = [];

  // Create a more musical fallback with scale-based movement
  const scale = [0, 2, 4, 5, 7, 9, 11]; // Major scale intervals
  let currentNote = lastNote;

  for (let i = 0; i < numNotes; i++) {
    // Move by scale degrees
    const direction = Math.random() < 0.6 ? 1 : -1;
    const steps = Math.random() < 0.7 ? 1 : 2;

    // Add some melodic jumps occasionally
    if (Math.random() < 0.2) {
      currentNote += direction * (scale[Math.floor(Math.random() * scale.length)]);
    } else {
      currentNote += direction * steps;
    }

    currentNote = Math.max(60, Math.min(83, currentNote));

    generated.push({
      notes: [currentNote],
      time: Date.now() + i * 100,
      duration: 0.3 + Math.random() * 0.4, // Vary duration
      isChord: false
    });
  }

  return generated;
}

/**
 * Algorithmically smooth and improve melodic flow
 * Enhanced version with multiple passes and better musical logic
 */
export function smoothMelody(allMelody) {
  if (allMelody.length === 0) return [];
  
  let polished = allMelody.map(item => ({ ...item }));

  // Pass 1: Smooth large melodic jumps
  for (let i = 1; i < polished.length - 1; i++) {
    const prev = polished[i - 1];
    const current = polished[i];
    const next = polished[i + 1];

    const prevNote = prev.notes[0];
    const currentNote = current.notes[0];
    const nextNote = next.notes[0];

    const jumpToPrev = Math.abs(currentNote - prevNote);
    const jumpToNext = Math.abs(currentNote - nextNote);

    // If both jumps are large (>7 semitones), smooth the current note
    if (jumpToPrev > 7 && jumpToNext > 7) {
      const target = Math.round((prevNote + nextNote) / 2);
      const smoothed = Math.round((currentNote * 0.3 + target * 0.7));
      polished[i] = {
        ...current,
        notes: [Math.max(60, Math.min(83, smoothed))]
      };
    }
  }

  // Pass 2: Add stepwise motion where there are large gaps
  const expanded = [];
  for (let i = 0; i < polished.length; i++) {
    expanded.push(polished[i]);
    
    if (i < polished.length - 1) {
      const currentNote = polished[i].notes[0];
      const nextNote = polished[i + 1].notes[0];
      const gap = nextNote - currentNote;
      
      // If gap is very large (>12 semitones = octave), add a passing note
      if (Math.abs(gap) > 12) {
        const direction = gap > 0 ? 1 : -1;
        const passingNote = currentNote + direction * Math.floor(Math.abs(gap) / 2);
        const avgDuration = (polished[i].duration + polished[i + 1].duration) / 2;
        
        expanded.push({
          notes: [passingNote],
          time: Date.now(),
          duration: avgDuration * 0.7,
          isChord: false
        });
      }
    }
  }
  
  // Pass 3: Smooth duration variations (make rhythm more consistent)
  for (let i = 0; i < expanded.length; i++) {
    if (i > 0 && i < expanded.length - 1) {
      const prevDur = expanded[i - 1].duration || 0.5;
      const currentDur = expanded[i].duration || 0.5;
      const nextDur = expanded[i + 1].duration || 0.5;
      
      // If current duration is very different from neighbors, smooth it
      const avgNeighborDur = (prevDur + nextDur) / 2;
      if (Math.abs(currentDur - avgNeighborDur) > 0.3) {
        expanded[i].duration = currentDur * 0.5 + avgNeighborDur * 0.5;
      }
    }
  }

  // Pass 4: Snap to scale (C major for simplicity)
  const cMajorScale = [60, 62, 64, 65, 67, 69, 71, 72, 74, 76, 77, 79, 81, 83]; // C4 to B5 in C major
  
  for (let i = 0; i < expanded.length; i++) {
    const currentNote = expanded[i].notes[0];
    
    // Find closest scale note
    let closestNote = cMajorScale[0];
    let minDist = Math.abs(currentNote - closestNote);
    
    for (const scaleNote of cMajorScale) {
      const dist = Math.abs(currentNote - scaleNote);
      if (dist < minDist) {
        minDist = dist;
        closestNote = scaleNote;
      }
    }
    
    // Only snap if within 2 semitones of a scale note
    if (minDist <= 2) {
      expanded[i].notes = [closestNote];
    }
  }

  // Pass 5: Add slight variation to prevent monotony
  for (let i = 2; i < expanded.length - 2; i++) {
    const prev = expanded[i - 1].notes[0];
    const current = expanded[i].notes[0];
    const next = expanded[i + 1].notes[0];
    
    // If three consecutive notes are the same, add slight variation to middle
    if (prev === current && current === next) {
      const variation = Math.random() < 0.5 ? 2 : -2; // +/- 2 semitones
      expanded[i].notes = [Math.max(60, Math.min(83, current + variation))];
    }
  }

  return expanded;
}

/**
 * Generate melody name suggestions based on characteristics
 */
export function generateNameSuggestion(userSequence, aiMelody, aiDrums) {
  const allMelody = [...userSequence, ...aiMelody];
  if (allMelody.length === 0) return 'My Melody';

  // Analyze melody characteristics
  const noteCount = allMelody.reduce((sum, item) => sum + (item.notes?.length || 0), 0);
  const hasDrums = aiDrums.length > 0;
  const avgPitch = allMelody.reduce((sum, item) => sum + (item.notes?.[0] || 60), 0) / allMelody.length;
  const totalDuration = allMelody.reduce((sum, item) => sum + (item.duration || 0.5), 0);

  // Descriptive words based on characteristics
  const tempoWords = totalDuration > 10 ? ['Long', 'Extended', 'Epic'] : totalDuration > 5 ? ['Medium', 'Flowing'] : ['Short', 'Quick', 'Brief'];
  const pitchWords = avgPitch > 72 ? ['High', 'Bright', 'Soprano'] : avgPitch < 66 ? ['Low', 'Deep', 'Bass'] : ['Mid', 'Balanced'];
  const styleWords = hasDrums ? ['Rhythmic', 'Groovy', 'Beat'] : ['Melodic', 'Pure', 'Simple'];
  const moodWords = ['Calm', 'Happy', 'Dreamy', 'Jazzy', 'Peaceful', 'Upbeat', 'Smooth', 'Gentle'];

  // Random selection
  const tempo = tempoWords[Math.floor(Math.random() * tempoWords.length)];
  const mood = moodWords[Math.floor(Math.random() * moodWords.length)];
  const style = styleWords[Math.floor(Math.random() * styleWords.length)];
  const pitch = pitchWords[0];

  const suggestions = [
    `${mood} ${style}`,
    `${tempo} ${mood} Melody`,
    `${style} Composition`,
    `${mood} ${pitch} Notes`,
    `${tempo} ${style}`
  ];

  return suggestions[Math.floor(Math.random() * suggestions.length)];
}
