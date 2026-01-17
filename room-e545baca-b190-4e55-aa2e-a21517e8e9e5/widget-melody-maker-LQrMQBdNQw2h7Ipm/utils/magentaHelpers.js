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
 * Algorithmically smooth large melodic jumps
 */
export function smoothMelody(allMelody) {
  const polished = [];

  for (let i = 0; i < allMelody.length; i++) {
    const current = allMelody[i];
    const prev = i > 0 ? allMelody[i - 1] : null;
    const next = i < allMelody.length - 1 ? allMelody[i + 1] : null;

    // Smooth large jumps
    if (prev && next) {
      const prevNote = prev.notes[0];
      const currentNote = current.notes[0];
      const nextNote = next.notes[0];

      const jumpToPrev = Math.abs(currentNote - prevNote);
      const jumpToNext = Math.abs(currentNote - nextNote);

      // If jumps are too large, adjust slightly
      if (jumpToPrev > 7 || jumpToNext > 7) {
        const target = Math.round((prevNote + nextNote) / 2);
        const smoothed = Math.round((currentNote + target) / 2);

        polished.push({
          ...current,
          notes: [Math.max(60, Math.min(83, smoothed))]
        });
        continue;
      }
    }

    polished.push({ ...current });
  }

  return polished;
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
