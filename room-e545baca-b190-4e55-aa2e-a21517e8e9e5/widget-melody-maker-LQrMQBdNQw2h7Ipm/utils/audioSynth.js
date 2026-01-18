// Improved audio synthesis with style-based timbres

// Style-specific sound profiles
const STYLE_PROFILES = {
  balanced: {
    name: 'Balanced Piano',
    oscillatorType: 'triangle',
    attack: 0.005,
    decay: 0.1,
    sustain: 0.7,
    release: 0.3,
    filterFreqMultiplier: 3,
    filterQ: 0.5,
    harmonics: [
      { freq: 2.01, gain: 0.4, type: 'sine' },
      { freq: 3.02, gain: 0.25, type: 'sine' },
      { freq: 4.03, gain: 0.15, type: 'sine' }
    ],
    noiseAmount: 0.05
  },
  classical: {
    name: 'Rich Grand Piano',
    oscillatorType: 'triangle',
    attack: 0.008,
    decay: 0.15,
    sustain: 0.8,
    release: 0.5,
    filterFreqMultiplier: 4,
    filterQ: 1.2,
    harmonics: [
      { freq: 2.0, gain: 0.5, type: 'sine' },
      { freq: 3.0, gain: 0.35, type: 'sine' },
      { freq: 4.0, gain: 0.25, type: 'sine' },
      { freq: 5.0, gain: 0.15, type: 'sine' }
    ],
    noiseAmount: 0.03
  },
  jazz: {
    name: 'Mellow Jazz Piano',
    oscillatorType: 'sine',
    attack: 0.01,
    decay: 0.12,
    sustain: 0.6,
    release: 0.4,
    filterFreqMultiplier: 2.5,
    filterQ: 0.8,
    harmonics: [
      { freq: 2.0, gain: 0.35, type: 'sine' },
      { freq: 3.0, gain: 0.2, type: 'sine' },
      { freq: 4.0, gain: 0.1, type: 'sine' }
    ],
    noiseAmount: 0.04
  },
  pop: {
    name: 'Bright Pop Piano',
    oscillatorType: 'triangle',
    attack: 0.003,
    decay: 0.08,
    sustain: 0.65,
    release: 0.25,
    filterFreqMultiplier: 4.5,
    filterQ: 1.5,
    harmonics: [
      { freq: 2.0, gain: 0.45, type: 'sine' },
      { freq: 3.0, gain: 0.3, type: 'sine' },
      { freq: 4.0, gain: 0.2, type: 'sine' }
    ],
    noiseAmount: 0.06
  },
  electronic: {
    name: 'Synth Lead',
    oscillatorType: 'sawtooth',
    attack: 0.001,
    decay: 0.05,
    sustain: 0.5,
    release: 0.15,
    filterFreqMultiplier: 6,
    filterQ: 2.0,
    harmonics: [
      { freq: 1.99, gain: 0.5, type: 'square' },
      { freq: 3.01, gain: 0.35, type: 'sawtooth' },
      { freq: 4.02, gain: 0.2, type: 'sine' }
    ],
    noiseAmount: 0.02
  },
  ambient: {
    name: 'Soft Pad',
    oscillatorType: 'sine',
    attack: 0.08,
    decay: 0.25,
    sustain: 0.9,
    release: 0.8,
    filterFreqMultiplier: 2,
    filterQ: 0.3,
    harmonics: [
      { freq: 2.0, gain: 0.6, type: 'sine' },
      { freq: 3.0, gain: 0.5, type: 'sine' },
      { freq: 4.0, gain: 0.4, type: 'sine' },
      { freq: 5.0, gain: 0.3, type: 'sine' }
    ],
    noiseAmount: 0.01
  }
};

export class PianoSynth {
  constructor(audioContext, style = 'balanced') {
    this.ctx = audioContext;
    this.activeNotes = new Map();
    this.style = style;
    this.profile = STYLE_PROFILES[style] || STYLE_PROFILES.balanced;
  }

  // Change style on the fly
  setStyle(style) {
    this.style = style;
    this.profile = STYLE_PROFILES[style] || STYLE_PROFILES.balanced;
  }

  // Stop all playing notes immediately
  stopAllNotes() {
    const now = this.ctx.currentTime;
    
    this.activeNotes.forEach((note, noteNumber) => {
      // Quick release envelope
      note.gains.forEach(gain => {
        gain.gain.cancelScheduledValues(now);
        gain.gain.setValueAtTime(gain.gain.value, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.05); // 50ms quick release
      });
      
      // Stop oscillators after quick release
      note.oscillators.forEach(osc => {
        try {
          osc.stop(now + 0.05);
        } catch (e) {
          // Oscillator might already be stopped
        }
      });
    });
    
    this.activeNotes.clear();
  }

  // Create style-specific sound using profile settings
startNote(noteNumber, velocity = 0.7) {
  if (this.activeNotes.has(noteNumber)) return;
  if (velocity < 0.001) return;

  const frequency = 440 * Math.pow(2, (noteNumber - 69) / 12);
  const now = this.ctx.currentTime;
  const profile = this.profile;
  
  // Create fundamental oscillator with style-specific type
  const fundamental = this.ctx.createOscillator();
  fundamental.frequency.value = frequency;
  fundamental.type = profile.oscillatorType;
  
  // Create harmonic oscillators based on profile
  const harmonicOscillators = [];
  const harmonicGains = [];
  
  profile.harmonics.forEach((harmonic) => {
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    
    osc.frequency.value = frequency * harmonic.freq;
    osc.type = harmonic.type;
    
    osc.connect(gain);
    harmonicOscillators.push(osc);
    harmonicGains.push({ node: gain, baseGain: harmonic.gain });
  });
  
  // Create hammer/attack noise
  const noise = this.ctx.createBufferSource();
  const noiseBuffer = this.ctx.createBuffer(1, this.ctx.sampleRate * 0.05, this.ctx.sampleRate);
  const noiseData = noiseBuffer.getChannelData(0);
  for (let i = 0; i < noiseData.length; i++) {
    noiseData[i] = (Math.random() * 2 - 1) * velocity;
  }
  noise.buffer = noiseBuffer;
  
  // Gains
  const mainGain = this.ctx.createGain();
  const noiseGain = this.ctx.createGain();
  
  // Style-specific filter
  const filter = this.ctx.createBiquadFilter();
  filter.type = 'lowpass';
  const baseFilterFreq = frequency * (profile.filterFreqMultiplier + velocity * 2);
  filter.frequency.setValueAtTime(baseFilterFreq * 1.5, now);
  filter.frequency.exponentialRampToValueAtTime(Math.max(100, baseFilterFreq), now + profile.decay);
  filter.Q.value = profile.filterQ + (velocity * 0.5);
  
  // Noise filter
  const noiseFilter = this.ctx.createBiquadFilter();
  noiseFilter.type = 'highpass';
  noiseFilter.frequency.value = 2000;
  
  // Connect fundamental
  fundamental.connect(mainGain);
  
  // Connect harmonics
  harmonicGains.forEach(hg => hg.node.connect(filter));
  
  // Connect noise
  noise.connect(noiseFilter);
  noiseFilter.connect(noiseGain);
  
  // Main connections
  mainGain.connect(filter);
  noiseGain.connect(this.ctx.destination);
  filter.connect(this.ctx.destination);
  
  // Style-specific ADSR envelope
  const baseVolume = velocity * 0.25;
  const sustainLevel = baseVolume * profile.sustain;
  
  // Fundamental envelope
  mainGain.gain.setValueAtTime(0.001, now);
  mainGain.gain.linearRampToValueAtTime(baseVolume, now + profile.attack);
  mainGain.gain.exponentialRampToValueAtTime(Math.max(0.001, sustainLevel), now + profile.attack + profile.decay);
  
  // Harmonic envelopes
  harmonicGains.forEach(hg => {
    const harmGain = baseVolume * hg.baseGain * velocity;
    const harmSustain = harmGain * profile.sustain;
    
    hg.node.gain.setValueAtTime(0.001, now);
    hg.node.gain.linearRampToValueAtTime(harmGain, now + profile.attack);
    hg.node.gain.exponentialRampToValueAtTime(Math.max(0.001, harmSustain), now + profile.attack + profile.decay);
  });
  
  // Noise envelope
  noiseGain.gain.setValueAtTime(velocity * profile.noiseAmount, now);
  noiseGain.gain.exponentialRampToValueAtTime(0.001, now + 0.02);
  
  // Start all oscillators
  fundamental.start(now);
  harmonicOscillators.forEach(osc => osc.start(now));
  noise.start(now);
  
  // Store the active note
  this.activeNotes.set(noteNumber, {
    oscillators: [fundamental, ...harmonicOscillators],
    gains: [mainGain, ...harmonicGains.map(hg => hg.node), noiseGain],
    filter,
    noiseFilter
  });
}
  stopNote(noteNumber) {
    const note = this.activeNotes.get(noteNumber);
    if (!note) return;

    const now = this.ctx.currentTime;
    const releaseTime = this.profile.release;
    
    // Style-specific release envelope
    note.gains.forEach(gain => {
      gain.gain.cancelScheduledValues(now);
      gain.gain.setValueAtTime(gain.gain.value, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + releaseTime);
    });
    
    // Stop oscillators after release
    note.oscillators.forEach(osc => {
      osc.stop(now + releaseTime);
    });
    
    this.activeNotes.delete(noteNumber);
  }

  // Play a note for a fixed duration (for playback) - uses style profile
  playNote(noteNumber, duration = 0.5, velocity = 0.7) {
    if (velocity < 0.001) return;
    
    const frequency = 440 * Math.pow(2, (noteNumber - 69) / 12);
    const now = this.ctx.currentTime;
    const profile = this.profile;
    
    // Create fundamental
    const fundamental = this.ctx.createOscillator();
    fundamental.frequency.value = frequency;
    fundamental.type = profile.oscillatorType;
    
    // Create harmonics based on profile
    const harmonicOscillators = [];
    const harmonicGains = [];
    
    profile.harmonics.forEach((harmonic) => {
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      
      osc.frequency.value = frequency * harmonic.freq;
      osc.type = harmonic.type;
      
      osc.connect(gain);
      harmonicOscillators.push(osc);
      harmonicGains.push({ node: gain, baseGain: harmonic.gain });
    });
    
    const mainGain = this.ctx.createGain();
    
    // Style-specific filter
    const filter = this.ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = frequency * profile.filterFreqMultiplier;
    filter.Q.value = profile.filterQ;
    
    // Connect
    fundamental.connect(mainGain);
    harmonicGains.forEach(hg => hg.node.connect(filter));
    mainGain.connect(filter);
    filter.connect(this.ctx.destination);
    
    const baseVolume = Math.max(0.001, velocity * 0.3);
    const sustainLevel = baseVolume * profile.sustain;
    const releaseTime = Math.min(profile.release, duration * 0.4);
    
    // ADSR envelope for fundamental
    mainGain.gain.setValueAtTime(0.001, now);
    mainGain.gain.linearRampToValueAtTime(baseVolume, now + profile.attack);
    mainGain.gain.exponentialRampToValueAtTime(Math.max(0.001, sustainLevel), now + profile.attack + profile.decay);
    mainGain.gain.setValueAtTime(Math.max(0.001, sustainLevel), now + duration - releaseTime);
    mainGain.gain.exponentialRampToValueAtTime(0.001, now + duration);
    
    // ADSR for harmonics
    harmonicGains.forEach(hg => {
      const harmGain = baseVolume * hg.baseGain;
      const harmSustain = harmGain * profile.sustain;
      
      hg.node.gain.setValueAtTime(0.001, now);
      hg.node.gain.linearRampToValueAtTime(harmGain, now + profile.attack);
      hg.node.gain.exponentialRampToValueAtTime(Math.max(0.001, harmSustain), now + profile.attack + profile.decay);
      hg.node.gain.setValueAtTime(Math.max(0.001, harmSustain), now + duration - releaseTime);
      hg.node.gain.exponentialRampToValueAtTime(0.001, now + duration);
    });
    
    // Start all
    fundamental.start(now);
    harmonicOscillators.forEach(osc => osc.start(now));
    
    // Stop all
    fundamental.stop(now + duration);
    harmonicOscillators.forEach(osc => osc.stop(now + duration));
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
