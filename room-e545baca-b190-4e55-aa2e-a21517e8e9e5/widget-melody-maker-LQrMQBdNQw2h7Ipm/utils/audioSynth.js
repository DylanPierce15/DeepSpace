// Improved audio synthesis with better piano sounds

export class PianoSynth {
  constructor(audioContext) {
    this.ctx = audioContext;
    this.activeNotes = new Map();
  }

  // Create a more realistic piano sound using multiple oscillators and ADSR envelope
startNote(noteNumber, velocity = 0.7) {
  if (this.activeNotes.has(noteNumber)) return;
  if (velocity < 0.001) return;

  const frequency = 440 * Math.pow(2, (noteNumber - 69) / 12);
  const now = this.ctx.currentTime;
  
  // Create oscillators with slightly detuned harmonics
  const fundamental = this.ctx.createOscillator();
  const harmonic1 = this.ctx.createOscillator();
  const harmonic2 = this.ctx.createOscillator();
  const harmonic3 = this.ctx.createOscillator();
  
  // Create hammer noise for attack
  const noise = this.ctx.createBufferSource();
  const noiseBuffer = this.ctx.createBuffer(1, this.ctx.sampleRate * 0.05, this.ctx.sampleRate);
  const noiseData = noiseBuffer.getChannelData(0);
  for (let i = 0; i < noiseData.length; i++) {
    noiseData[i] = (Math.random() * 2 - 1) * velocity;
  }
  noise.buffer = noiseBuffer;
  
  // Gains
  const mainGain = this.ctx.createGain();
  const harm1Gain = this.ctx.createGain();
  const harm2Gain = this.ctx.createGain();
  const harm3Gain = this.ctx.createGain();
  const noiseGain = this.ctx.createGain();
  
  // Dynamic filter - brighter for higher velocities and pitches
  const filter = this.ctx.createBiquadFilter();
  filter.type = 'lowpass';
  const baseFilterFreq = frequency * (3 + velocity * 4);
  filter.frequency.setValueAtTime(baseFilterFreq * 2, now);
  filter.frequency.exponentialRampToValueAtTime(baseFilterFreq, now + 0.1);
  filter.Q.value = 0.5 + velocity;
  
  // Noise filter (high-pass for click)
  const noiseFilter = this.ctx.createBiquadFilter();
  noiseFilter.type = 'highpass';
  noiseFilter.frequency.value = 2000;
  
  // Slightly detuned harmonics for more realistic sound
  fundamental.frequency.value = frequency;
  fundamental.type = 'triangle';
  
  harmonic1.frequency.value = frequency * 2.01;
  harmonic1.type = 'sine';
  
  harmonic2.frequency.value = frequency * 3.02;
  harmonic2.type = 'sine';
  
  harmonic3.frequency.value = frequency * 4.03;
  harmonic3.type = 'sine';
  
  // Connect everything
  fundamental.connect(mainGain);
  harmonic1.connect(harm1Gain);
  harmonic2.connect(harm2Gain);
  harmonic3.connect(harm3Gain);
  noise.connect(noiseFilter);
  noiseFilter.connect(noiseGain);
  
  mainGain.connect(filter);
  harm1Gain.connect(filter);
  harm2Gain.connect(filter);
  harm3Gain.connect(filter);
  noiseGain.connect(this.ctx.destination);
  
  filter.connect(this.ctx.destination);
  
  // Attack-Decay-Sustain envelope (Release handled by stopNote)
  const baseVolume = velocity * 0.25;
  const sustainLevel = baseVolume * 0.7; // Sustain at 70% of peak
  
  // Fundamental - attack, decay to sustain
  mainGain.gain.setValueAtTime(0.001, now);
  mainGain.gain.linearRampToValueAtTime(baseVolume, now + 0.005); // Fast attack
  mainGain.gain.exponentialRampToValueAtTime(Math.max(0.001, sustainLevel), now + 0.1); // Decay to sustain
  
  // Harmonics - more velocity-sensitive
  harm1Gain.gain.setValueAtTime(0.001, now);
  harm1Gain.gain.linearRampToValueAtTime(baseVolume * 0.4 * velocity, now + 0.005);
  harm1Gain.gain.exponentialRampToValueAtTime(Math.max(0.001, sustainLevel * 0.3 * velocity), now + 0.1);
  
  harm2Gain.gain.setValueAtTime(0.001, now);
  harm2Gain.gain.linearRampToValueAtTime(baseVolume * 0.25 * velocity, now + 0.005);
  harm2Gain.gain.exponentialRampToValueAtTime(Math.max(0.001, sustainLevel * 0.2 * velocity), now + 0.1);
  
  harm3Gain.gain.setValueAtTime(0.001, now);
  harm3Gain.gain.linearRampToValueAtTime(baseVolume * 0.15 * velocity, now + 0.005);
  harm3Gain.gain.exponentialRampToValueAtTime(Math.max(0.001, sustainLevel * 0.1 * velocity), now + 0.1);
  
  // Hammer noise (very short)
  noiseGain.gain.setValueAtTime(velocity * 0.05, now);
  noiseGain.gain.exponentialRampToValueAtTime(0.001, now + 0.02);
  
  // Start everything
  fundamental.start(now);
  harmonic1.start(now);
  harmonic2.start(now);
  harmonic3.start(now);
  noise.start(now);
  
  // Store the active note
  this.activeNotes.set(noteNumber, {
    oscillators: [fundamental, harmonic1, harmonic2, harmonic3],
    gains: [mainGain, harm1Gain, harm2Gain, harm3Gain, noiseGain],
    filter,
    noiseFilter
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
    // Skip playback if volume is too low
    if (velocity < 0.001) return;
    
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
    const baseVolume = Math.max(0.001, velocity * 0.3);
    const release = 0.2;
    
    // ADSR envelope - use Math.max to ensure values never reach 0
    mainGain.gain.setValueAtTime(0.001, now);
    mainGain.gain.linearRampToValueAtTime(baseVolume, now + 0.01);
    mainGain.gain.exponentialRampToValueAtTime(Math.max(0.001, baseVolume * 0.7), now + 0.05);
    mainGain.gain.setValueAtTime(Math.max(0.001, baseVolume * 0.7), now + duration - release);
    mainGain.gain.exponentialRampToValueAtTime(0.001, now + duration);
    
    harm1Gain.gain.setValueAtTime(0.001, now);
    harm1Gain.gain.linearRampToValueAtTime(Math.max(0.001, baseVolume * 0.3), now + 0.01);
    harm1Gain.gain.exponentialRampToValueAtTime(Math.max(0.001, baseVolume * 0.2), now + 0.05);
    harm1Gain.gain.setValueAtTime(Math.max(0.001, baseVolume * 0.2), now + duration - release);
    harm1Gain.gain.exponentialRampToValueAtTime(0.001, now + duration);
    
    harm2Gain.gain.setValueAtTime(0.001, now);
    harm2Gain.gain.linearRampToValueAtTime(Math.max(0.001, baseVolume * 0.15), now + 0.01);
    harm2Gain.gain.exponentialRampToValueAtTime(Math.max(0.001, baseVolume * 0.1), now + 0.05);
    harm2Gain.gain.setValueAtTime(Math.max(0.001, baseVolume * 0.1), now + duration - release);
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
  playKick(time = null, volume = 0.8) {
    // Skip if volume is too low
    if (volume < 0.001) return;
    
    const t = time || this.ctx.currentTime;
    
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    
    osc.connect(gain);
    gain.connect(this.ctx.destination);
    
    osc.frequency.setValueAtTime(150, t);
    osc.frequency.exponentialRampToValueAtTime(40, t + 0.1);
    
    gain.gain.setValueAtTime(Math.max(0.001, volume), t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.5);
    
    osc.start(t);
    osc.stop(t + 0.5);
  }

  // Snare drum
  playSnare(time = null, volume = 1.0) {
    // Skip if volume is too low
    if (volume < 0.001) return;
    
    const t = time || this.ctx.currentTime;
    const vol = Math.max(0.001, volume * 0.8);
    
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
    
    oscGain.gain.setValueAtTime(Math.max(0.001, 0.3 * vol), t);
    oscGain.gain.exponentialRampToValueAtTime(0.001, t + 0.1);
    
    noiseGain.gain.setValueAtTime(Math.max(0.001, 0.5 * vol), t);
    noiseGain.gain.exponentialRampToValueAtTime(0.001, t + 0.15);
    
    osc.start(t);
    osc.stop(t + 0.1);
    noise.start(t);
    noise.stop(t + 0.15);
  }

  // Hi-hat
  playHiHat(time = null, open = false, volume = 0.3) {
    // Skip if volume is too low
    if (volume < 0.001) return;
    
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
    gain.gain.setValueAtTime(Math.max(0.001, volume), t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + duration);
    
    noise.start(t);
    noise.stop(t + duration);
  }

  // Play drum pattern
  playDrumHit(drumType, volume = 0.7, time = null) {
    switch(drumType) {
      case 'kick':
        this.playKick(time, volume);
        break;
      case 'snare':
        this.playSnare(time, volume);
        break;
      case 'hihat':
        this.playHiHat(time, false, volume * 0.4);
        break;
      case 'openhat':
        this.playHiHat(time, true, volume * 0.4);
        break;
    }
  }
}
