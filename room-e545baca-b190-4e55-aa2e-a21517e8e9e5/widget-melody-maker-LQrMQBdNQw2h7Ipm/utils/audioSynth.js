// Improved audio synthesis with better piano sounds

export class PianoSynth {
  constructor(audioContext) {
    this.ctx = audioContext;
    this.activeNotes = new Map();
  }

  // Create a more realistic piano sound using multiple oscillators and ADSR envelope
  startNote(noteNumber, velocity = 0.7) {
    if (this.activeNotes.has(noteNumber)) return;

    const frequency = 440 * Math.pow(2, (noteNumber - 69) / 12);
    
    // Create multiple oscillators for richer sound
    const fundamental = this.ctx.createOscillator();
    const harmonic1 = this.ctx.createOscillator();
    const harmonic2 = this.ctx.createOscillator();
    
    // Main gain for the note
    const mainGain = this.ctx.createGain();
    const harm1Gain = this.ctx.createGain();
    const harm2Gain = this.ctx.createGain();
    
    // Create a bandpass filter for more natural tone
    const filter = this.ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = frequency * 4;
    filter.Q.value = 1;
    
    // Set up oscillators
    fundamental.frequency.value = frequency;
    fundamental.type = 'triangle'; // Warmer than sine
    
    harmonic1.frequency.value = frequency * 2; // Octave
    harmonic1.type = 'sine';
    
    harmonic2.frequency.value = frequency * 3; // Perfect fifth
    harmonic2.type = 'sine';
    
    // Connect oscillators through gains to filter
    fundamental.connect(mainGain);
    harmonic1.connect(harm1Gain);
    harmonic2.connect(harm2Gain);
    
    mainGain.connect(filter);
    harm1Gain.connect(filter);
    harm2Gain.connect(filter);
    
    filter.connect(this.ctx.destination);
    
    // Set gain levels for each harmonic
    const now = this.ctx.currentTime;
    const baseVolume = velocity * 0.3;
    
    // Attack-Decay-Sustain envelope
    mainGain.gain.setValueAtTime(0, now);
    mainGain.gain.linearRampToValueAtTime(baseVolume, now + 0.01); // Fast attack
    mainGain.gain.exponentialRampToValueAtTime(baseVolume * 0.7, now + 0.1); // Quick decay
    
    harm1Gain.gain.setValueAtTime(0, now);
    harm1Gain.gain.linearRampToValueAtTime(baseVolume * 0.3, now + 0.01);
    harm1Gain.gain.exponentialRampToValueAtTime(baseVolume * 0.2, now + 0.1);
    
    harm2Gain.gain.setValueAtTime(0, now);
    harm2Gain.gain.linearRampToValueAtTime(baseVolume * 0.15, now + 0.01);
    harm2Gain.gain.exponentialRampToValueAtTime(baseVolume * 0.1, now + 0.1);
    
    // Start oscillators
    fundamental.start(now);
    harmonic1.start(now);
    harmonic2.start(now);
    
    this.activeNotes.set(noteNumber, {
      oscillators: [fundamental, harmonic1, harmonic2],
      gains: [mainGain, harm1Gain, harm2Gain],
      filter
    });
  }

  stopNote(noteNumber) {
    const note = this.activeNotes.get(noteNumber);
    if (!note) return;

    const now = this.ctx.currentTime;
    
    // Release envelope
    note.gains.forEach(gain => {
      gain.gain.cancelScheduledValues(now);
      gain.gain.setValueAtTime(gain.gain.value, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.3); // 300ms release
    });
    
    // Stop oscillators after release
    note.oscillators.forEach(osc => {
      osc.stop(now + 0.3);
    });
    
    this.activeNotes.delete(noteNumber);
  }

  // Play a note for a fixed duration (for playback)
  playNote(noteNumber, duration = 0.5, velocity = 0.7) {
    const frequency = 440 * Math.pow(2, (noteNumber - 69) / 12);
    
    const fundamental = this.ctx.createOscillator();
    const harmonic1 = this.ctx.createOscillator();
    const harmonic2 = this.ctx.createOscillator();
    
    const mainGain = this.ctx.createGain();
    const harm1Gain = this.ctx.createGain();
    const harm2Gain = this.ctx.createGain();
    
    const filter = this.ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = frequency * 4;
    filter.Q.value = 1;
    
    fundamental.frequency.value = frequency;
    fundamental.type = 'triangle';
    harmonic1.frequency.value = frequency * 2;
    harmonic1.type = 'sine';
    harmonic2.frequency.value = frequency * 3;
    harmonic2.type = 'sine';
    
    fundamental.connect(mainGain);
    harmonic1.connect(harm1Gain);
    harmonic2.connect(harm2Gain);
    
    mainGain.connect(filter);
    harm1Gain.connect(filter);
    harm2Gain.connect(filter);
    filter.connect(this.ctx.destination);
    
    const now = this.ctx.currentTime;
    const baseVolume = velocity * 0.3;
    const release = 0.2;
    
    // ADSR envelope
    mainGain.gain.setValueAtTime(0, now);
    mainGain.gain.linearRampToValueAtTime(baseVolume, now + 0.01);
    mainGain.gain.exponentialRampToValueAtTime(baseVolume * 0.7, now + 0.05);
    mainGain.gain.setValueAtTime(baseVolume * 0.7, now + duration - release);
    mainGain.gain.exponentialRampToValueAtTime(0.001, now + duration);
    
    harm1Gain.gain.setValueAtTime(0, now);
    harm1Gain.gain.linearRampToValueAtTime(baseVolume * 0.3, now + 0.01);
    harm1Gain.gain.exponentialRampToValueAtTime(baseVolume * 0.2, now + 0.05);
    harm1Gain.gain.setValueAtTime(baseVolume * 0.2, now + duration - release);
    harm1Gain.gain.exponentialRampToValueAtTime(0.001, now + duration);
    
    harm2Gain.gain.setValueAtTime(0, now);
    harm2Gain.gain.linearRampToValueAtTime(baseVolume * 0.15, now + 0.01);
    harm2Gain.gain.exponentialRampToValueAtTime(baseVolume * 0.1, now + 0.05);
    harm2Gain.gain.setValueAtTime(baseVolume * 0.1, now + duration - release);
    harm2Gain.gain.exponentialRampToValueAtTime(0.001, now + duration);
    
    fundamental.start(now);
    harmonic1.start(now);
    harmonic2.start(now);
    
    fundamental.stop(now + duration);
    harmonic1.stop(now + duration);
    harmonic2.stop(now + duration);
  }
}

export class DrumSynth {
  constructor(audioContext) {
    this.ctx = audioContext;
  }

  // Kick drum
  playKick(time = null) {
    const t = time || this.ctx.currentTime;
    
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    
    osc.connect(gain);
    gain.connect(this.ctx.destination);
    
    osc.frequency.setValueAtTime(150, t);
    osc.frequency.exponentialRampToValueAtTime(40, t + 0.1);
    
    gain.gain.setValueAtTime(0.8, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.5);
    
    osc.start(t);
    osc.stop(t + 0.5);
  }

  // Snare drum
  playSnare(time = null) {
    const t = time || this.ctx.currentTime;
    
    // Tone component
    const osc = this.ctx.createOscillator();
    const oscGain = this.ctx.createGain();
    osc.type = 'triangle';
    osc.frequency.value = 200;
    osc.connect(oscGain);
    
    // Noise component
    const bufferSize = this.ctx.sampleRate * 0.1;
    const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      data[i] = Math.random() * 2 - 1;
    }
    
    const noise = this.ctx.createBufferSource();
    noise.buffer = buffer;
    const noiseGain = this.ctx.createGain();
    const noiseFilter = this.ctx.createBiquadFilter();
    noiseFilter.type = 'highpass';
    noiseFilter.frequency.value = 1000;
    
    noise.connect(noiseFilter);
    noiseFilter.connect(noiseGain);
    
    // Mix gains
    const mixGain = this.ctx.createGain();
    oscGain.connect(mixGain);
    noiseGain.connect(mixGain);
    mixGain.connect(this.ctx.destination);
    
    oscGain.gain.setValueAtTime(0.3, t);
    oscGain.gain.exponentialRampToValueAtTime(0.001, t + 0.1);
    
    noiseGain.gain.setValueAtTime(0.5, t);
    noiseGain.gain.exponentialRampToValueAtTime(0.001, t + 0.15);
    
    osc.start(t);
    osc.stop(t + 0.1);
    noise.start(t);
    noise.stop(t + 0.15);
  }

  // Hi-hat
  playHiHat(time = null, open = false) {
    const t = time || this.ctx.currentTime;
    
    const bufferSize = this.ctx.sampleRate * 0.05;
    const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      data[i] = Math.random() * 2 - 1;
    }
    
    const noise = this.ctx.createBufferSource();
    noise.buffer = buffer;
    
    const filter = this.ctx.createBiquadFilter();
    filter.type = 'highpass';
    filter.frequency.value = 7000;
    
    const gain = this.ctx.createGain();
    
    noise.connect(filter);
    filter.connect(gain);
    gain.connect(this.ctx.destination);
    
    const duration = open ? 0.3 : 0.05;
    gain.gain.setValueAtTime(0.3, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + duration);
    
    noise.start(t);
    noise.stop(t + duration);
  }

  // Play drum pattern
  playDrumHit(drumType, time = null) {
    switch(drumType) {
      case 'kick':
        this.playKick(time);
        break;
      case 'snare':
        this.playSnare(time);
        break;
      case 'hihat':
        this.playHiHat(time, false);
        break;
      case 'openhat':
        this.playHiHat(time, true);
        break;
    }
  }
}
