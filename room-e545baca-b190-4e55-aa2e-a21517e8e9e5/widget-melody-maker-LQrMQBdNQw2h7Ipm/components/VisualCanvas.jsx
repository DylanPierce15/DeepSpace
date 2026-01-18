import React, { useEffect, useRef, useState } from 'react';

function VisualCanvas({ activeNotes, activeDrums, isPlaying, colors }) {
  const canvasRef = useRef(null);
  const particlesRef = useRef([]);
  const animationRef = useRef(null);
  const drumEffectsRef = useRef([]);
  const [debugInfo, setDebugInfo] = useState({ particles: 0, drums: 0, notes: 0 });
  const widthRef = useRef(0);
  const heightRef = useRef(0);

  // Map MIDI note to color (hue in HSL)
  const noteToColor = (noteNumber) => {
    // Middle C (60) = 180° (cyan), mapping octaves across spectrum
    // Lower notes = cooler colors (blues/purples), higher = warmer (yellows/reds)
    const normalizedNote = ((noteNumber - 60) / 24) * 360; // Map 2 octaves to full spectrum
    let hue = (normalizedNote + 180) % 360; // Shift so middle C is cyan
    return hue;
  };

  // Create particle for a note
  const createNoteParticle = (noteNumber) => {
    const width = widthRef.current;
    const height = heightRef.current;
    
    if (width === 0 || height === 0) return null;
    
    const hue = noteToColor(noteNumber);
    const size = 20 + Math.random() * 30;
    const x = (width / 2) + (Math.random() - 0.5) * 200;
    const y = (height / 2) + (Math.random() - 0.5) * 200;
    
    console.log(`[VisualCanvas] Creating particle for note ${noteNumber} at (${x.toFixed(0)}, ${y.toFixed(0)}) with hue ${hue.toFixed(0)}`);
    
    return {
      x,
      y,
      size,
      hue,
      saturation: 70 + Math.random() * 30,
      lightness: 50 + Math.random() * 20,
      alpha: 1,
      vx: (Math.random() - 0.5) * 2,
      vy: (Math.random() - 0.5) * 2,
      life: 120, // 2 seconds at 60fps
      maxLife: 120,
      noteNumber,
      pulsePhase: Math.random() * Math.PI * 2,
      rotationSpeed: (Math.random() - 0.5) * 0.05
    };
  };

  // Create drum effect
  const createDrumEffect = (drumType) => {
    const width = widthRef.current;
    const height = heightRef.current;
    
    if (width === 0 || height === 0) return null;
    
    // Different visual effects for different drum types
    let color, size, pattern;
    switch(drumType) {
      case 'kick':
        color = { h: 0, s: 80, l: 50 }; // Red
        size = 100;
        pattern = 'ring';
        break;
      case 'snare':
        color = { h: 200, s: 80, l: 60 }; // Cyan
        size = 60;
        pattern = 'burst';
        break;
      case 'hihat':
        color = { h: 60, s: 80, l: 70 }; // Yellow
        size = 40;
        pattern = 'sparkle';
        break;
      case 'openhat':
        color = { h: 120, s: 80, l: 65 }; // Green
        size = 50;
        pattern = 'wave';
        break;
      default:
        color = { h: 180, s: 70, l: 60 };
        size = 50;
        pattern = 'ring';
    }
    
    console.log(`[VisualCanvas] Creating ${drumType} drum effect`);
    
    return {
      x: width / 2,
      y: height / 2,
      size,
      color,
      alpha: 0.8,
      life: 30,
      maxLife: 30,
      pattern,
      rotation: 0
    };
  };

  // Handle active notes changes
  useEffect(() => {
    console.log('[VisualCanvas] Active notes changed:', Array.from(activeNotes));
    
    activeNotes.forEach(noteNumber => {
      // Check if we already have a particle for this note
      const exists = particlesRef.current.some(p => p.noteNumber === noteNumber && p.life > 60);
      if (!exists) {
        const particle = createNoteParticle(noteNumber);
        if (particle) {
          particlesRef.current.push(particle);
          console.log('[VisualCanvas] Added particle. Total particles:', particlesRef.current.length);
        }
      }
    });
  }, [activeNotes]);

  // Handle drum hits
  useEffect(() => {
    console.log('[VisualCanvas] Active drums changed:', Array.from(activeDrums));
    
    activeDrums.forEach(drumType => {
      const effect = createDrumEffect(drumType);
      if (effect) {
        drumEffectsRef.current.push(effect);
        console.log('[VisualCanvas] Added drum effect. Total effects:', drumEffectsRef.current.length);
      }
    });
  }, [activeDrums]);

  // Animation loop
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) {
      console.log('[VisualCanvas] Canvas ref not available');
      return;
    }

    const ctx = canvas.getContext('2d');
    console.log('[VisualCanvas] Animation loop starting. Canvas:', canvas.width, 'x', canvas.height);
    
    // Set canvas size
    const resize = () => {
      const rect = canvas.getBoundingClientRect();
      canvas.width = rect.width * window.devicePixelRatio;
      canvas.height = rect.height * window.devicePixelRatio;
      widthRef.current = rect.width;
      heightRef.current = rect.height;
      ctx.scale(window.devicePixelRatio, window.devicePixelRatio);
      console.log('[VisualCanvas] Canvas resized to:', rect.width, 'x', rect.height);
    };
    resize();
    window.addEventListener('resize', resize);

    let frameCount = 0;
    const animate = () => {
      const width = widthRef.current;
      const height = heightRef.current;
      
      frameCount++;
      if (frameCount % 60 === 0) {
        console.log('[VisualCanvas] Frame', frameCount, '- Particles:', particlesRef.current.length, 'Drums:', drumEffectsRef.current.length);
      }
      
      // Clear with fade effect
      ctx.fillStyle = 'rgba(26, 24, 23, 0.15)';
      ctx.fillRect(0, 0, width, height);
      
      // Update and draw particles
      particlesRef.current = particlesRef.current.filter(particle => {
        particle.life--;
        const lifeRatio = particle.life / particle.maxLife;
        particle.alpha = Math.max(0, lifeRatio);
        
        // Update position with physics
        particle.x += particle.vx;
        particle.y += particle.vy;
        particle.vx *= 0.98; // Friction
        particle.vy *= 0.98;
        
        // Pulse effect
        particle.pulsePhase += 0.1;
        const pulse = Math.sin(particle.pulsePhase) * 0.2 + 1;
        
        // Draw particle with glow effect
        const displaySize = particle.size * lifeRatio * pulse;
        
        // Outer glow
        ctx.save();
        ctx.globalAlpha = particle.alpha * 0.3;
        const gradient = ctx.createRadialGradient(
          particle.x, particle.y, 0,
          particle.x, particle.y, displaySize * 1.5
        );
        gradient.addColorStop(0, `hsla(${particle.hue}, ${particle.saturation}%, ${particle.lightness}%, ${particle.alpha})`);
        gradient.addColorStop(1, `hsla(${particle.hue}, ${particle.saturation}%, ${particle.lightness}%, 0)`);
        ctx.fillStyle = gradient;
        ctx.beginPath();
        ctx.arc(particle.x, particle.y, displaySize * 1.5, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
        
        // Inner bright core
        ctx.save();
        ctx.globalAlpha = particle.alpha * 0.8;
        ctx.fillStyle = `hsla(${particle.hue}, ${particle.saturation}%, ${Math.min(particle.lightness + 20, 90)}%, ${particle.alpha})`;
        ctx.beginPath();
        ctx.arc(particle.x, particle.y, displaySize * 0.6, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
        
        // Keep particle if still alive
        return particle.life > 0;
      });
      
      // Update and draw drum effects
      drumEffectsRef.current = drumEffectsRef.current.filter(effect => {
        effect.life--;
        const lifeRatio = effect.life / effect.maxLife;
        effect.alpha = Math.max(0, lifeRatio * 0.6);
        effect.rotation += 0.05;
        
        ctx.save();
        ctx.globalAlpha = effect.alpha;
        ctx.translate(effect.x, effect.y);
        ctx.rotate(effect.rotation);
        
        const currentSize = effect.size * (1 + (1 - lifeRatio) * 2);
        
        if (effect.pattern === 'ring') {
          // Expanding ring
          ctx.strokeStyle = `hsl(${effect.color.h}, ${effect.color.s}%, ${effect.color.l}%)`;
          ctx.lineWidth = 8 * lifeRatio;
          ctx.beginPath();
          ctx.arc(0, 0, currentSize, 0, Math.PI * 2);
          ctx.stroke();
        } else if (effect.pattern === 'burst') {
          // Radiating lines
          ctx.strokeStyle = `hsl(${effect.color.h}, ${effect.color.s}%, ${effect.color.l}%)`;
          ctx.lineWidth = 4 * lifeRatio;
          const lines = 12;
          for (let i = 0; i < lines; i++) {
            const angle = (Math.PI * 2 * i) / lines;
            ctx.beginPath();
            ctx.moveTo(0, 0);
            ctx.lineTo(Math.cos(angle) * currentSize, Math.sin(angle) * currentSize);
            ctx.stroke();
          }
        } else if (effect.pattern === 'sparkle') {
          // Scattered dots
          ctx.fillStyle = `hsl(${effect.color.h}, ${effect.color.s}%, ${effect.color.l}%)`;
          const dots = 20;
          for (let i = 0; i < dots; i++) {
            const angle = (Math.PI * 2 * i) / dots;
            const distance = currentSize * (0.5 + Math.random() * 0.5);
            const size = 3 + Math.random() * 5;
            ctx.beginPath();
            ctx.arc(
              Math.cos(angle) * distance,
              Math.sin(angle) * distance,
              size * lifeRatio,
              0,
              Math.PI * 2
            );
            ctx.fill();
          }
        } else if (effect.pattern === 'wave') {
          // Wavy circle
          ctx.strokeStyle = `hsl(${effect.color.h}, ${effect.color.s}%, ${effect.color.l}%)`;
          ctx.lineWidth = 5 * lifeRatio;
          ctx.beginPath();
          const segments = 50;
          for (let i = 0; i <= segments; i++) {
            const angle = (Math.PI * 2 * i) / segments;
            const wave = Math.sin(angle * 5 + effect.rotation * 3) * 10;
            const distance = currentSize + wave;
            const x = Math.cos(angle) * distance;
            const y = Math.sin(angle) * distance;
            if (i === 0) {
              ctx.moveTo(x, y);
            } else {
              ctx.lineTo(x, y);
            }
          }
          ctx.closePath();
          ctx.stroke();
        }
        
        ctx.restore();
        
        return effect.life > 0;
      });
      
      // Update debug info every 60 frames
      if (frameCount % 60 === 0) {
        setDebugInfo({
          particles: particlesRef.current.length,
          drums: drumEffectsRef.current.length,
          notes: activeNotes.size
        });
      }
      
      animationRef.current = requestAnimationFrame(animate);
    };

    animate();
    console.log('[VisualCanvas] Animation started');

    return () => {
      console.log('[VisualCanvas] Cleaning up animation');
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
      window.removeEventListener('resize', resize);
    };
  }, [activeNotes]);

  return (
    <div style={{
      background: colors.cardBg,
      borderRadius: '24px 8px 24px 24px',
      boxShadow: `0 4px 16px ${colors.shadow}`,
      overflow: 'hidden',
      position: 'relative'
    }}>
      <div style={{
        padding: '16px 20px',
        borderBottom: `1px solid ${colors.bg}`,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between'
      }}>
        <div>
          <div style={{
            color: colors.text.primary,
            fontFamily: 'system-ui, -apple-system, sans-serif',
            fontWeight: '600',
            fontSize: '1rem',
            marginBottom: '4px'
          }}>
            Visual Art
          </div>
          <div style={{
            color: colors.text.tertiary,
            fontFamily: 'system-ui, -apple-system, sans-serif',
            fontSize: '0.8rem'
          }}>
            Real-time generative visuals powered by your melody
          </div>
        </div>
        <div style={{
          color: colors.text.secondary,
          fontFamily: 'system-ui, -apple-system, sans-serif',
          fontSize: '0.75rem',
          padding: '6px 12px',
          background: colors.bgLight,
          borderRadius: '8px 8px 2px 8px',
          border: `1px solid ${colors.bg}`
        }}>
          Magenta Art
        </div>
      </div>
      <canvas
        ref={canvasRef}
        style={{
          width: '100%',
          height: '400px',
          display: 'block',
          background: `linear-gradient(135deg, ${colors.bg} 0%, rgba(26, 24, 23, 0.9) 100%)`
        }}
      />
      <div style={{
        padding: '12px 20px',
        borderTop: `1px solid ${colors.bg}`,
        display: 'flex',
        gap: '16px',
        flexWrap: 'wrap',
        fontSize: '0.75rem',
        color: colors.text.tertiary,
        fontFamily: 'system-ui, -apple-system, sans-serif'
      }}>
        <div className="flex items-center gap-2">
          <div style={{
            width: '12px',
            height: '12px',
            borderRadius: '50%',
            background: 'linear-gradient(135deg, hsl(240, 80%, 60%), hsl(0, 80%, 60%))'
          }}></div>
          <span>Note colors map to pitch (low = cool, high = warm)</span>
        </div>
        <div className="flex items-center gap-2">
          <div style={{
            width: '12px',
            height: '12px',
            borderRadius: '50%',
            background: 'hsl(0, 80%, 50%)',
            boxShadow: '0 0 8px hsla(0, 80%, 50%, 0.6)'
          }}></div>
          <span>Drum hits create percussive visual effects</span>
        </div>
        <div style={{
          marginLeft: 'auto',
          fontSize: '0.7rem',
          opacity: 0.6,
          fontFamily: 'monospace'
        }}>
          P:{debugInfo.particles} D:{debugInfo.drums} N:{debugInfo.notes}
        </div>
      </div>
    </div>
  );
}

export default VisualCanvas;
