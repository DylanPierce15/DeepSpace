import React, { useEffect, useRef, useState, useCallback } from 'react';

const COLOR_PALETTES = {
  rainbow: { name: 'Rainbow', colors: null }, // null = random HSV
  ocean: { name: 'Ocean', colors: [[0, 0.4, 0.8], [0, 0.6, 0.9], [0.1, 0.7, 0.7], [0.2, 0.5, 0.6]] },
  fire: { name: 'Fire', colors: [[1, 0.3, 0], [1, 0.5, 0], [1, 0.1, 0], [0.9, 0.2, 0.1]] },
  neon: { name: 'Neon', colors: [[1, 0, 0.8], [0, 1, 0.8], [0.2, 0.8, 1], [1, 0.2, 0.6]] },
  forest: { name: 'Forest', colors: [[0.1, 0.5, 0.2], [0.2, 0.6, 0.1], [0.3, 0.4, 0.1], [0.1, 0.3, 0.2]] },
  sunset: { name: 'Sunset', colors: [[1, 0.4, 0.2], [1, 0.2, 0.3], [0.8, 0.3, 0.5], [0.6, 0.2, 0.4]] },
  mono: { name: 'Monochrome', colors: [[0.8, 0.8, 0.8], [0.6, 0.6, 0.6], [0.9, 0.9, 0.9], [0.7, 0.7, 0.7]] },
  galaxy: { name: 'Galaxy', colors: [[0.4, 0.1, 0.8], [0.6, 0.2, 0.9], [0.2, 0.1, 0.6], [0.8, 0.3, 0.9]] },
};

const PRESETS = {
  default: { name: 'Default', config: { DENSITY_DISSIPATION: 1.0, VELOCITY_DISSIPATION: 0.2, PRESSURE: 0.8, CURL: 30, SPLAT_RADIUS: 0.12, SPLAT_FORCE: 6000, BLOOM: true, BLOOM_INTENSITY: 0.8, SUNRAYS: true } },
  calm: { name: 'Calm', config: { DENSITY_DISSIPATION: 0.5, VELOCITY_DISSIPATION: 0.5, PRESSURE: 0.9, CURL: 10, SPLAT_RADIUS: 0.2, SPLAT_FORCE: 3000, BLOOM: true, BLOOM_INTENSITY: 0.5, SUNRAYS: true } },
  chaotic: { name: 'Chaotic', config: { DENSITY_DISSIPATION: 0.3, VELOCITY_DISSIPATION: 0.1, PRESSURE: 0.5, CURL: 50, SPLAT_RADIUS: 0.08, SPLAT_FORCE: 8000, BLOOM: true, BLOOM_INTENSITY: 1.2, SUNRAYS: false } },
  ink: { name: 'Ink', config: { DENSITY_DISSIPATION: 0.6, VELOCITY_DISSIPATION: 0.9, PRESSURE: 0.95, CURL: 5, SPLAT_RADIUS: 0.15, SPLAT_FORCE: 4000, BLOOM: false, BLOOM_INTENSITY: 0, SUNRAYS: false } },
  smoke: { name: 'Smoke', config: { DENSITY_DISSIPATION: 2.0, VELOCITY_DISSIPATION: 0.8, PRESSURE: 0.7, CURL: 20, SPLAT_RADIUS: 0.25, SPLAT_FORCE: 2000, BLOOM: true, BLOOM_INTENSITY: 0.3, SUNRAYS: true } },
  liquid: { name: 'Liquid', config: { DENSITY_DISSIPATION: 0.2, VELOCITY_DISSIPATION: 0.05, PRESSURE: 0.6, CURL: 35, SPLAT_RADIUS: 0.1, SPLAT_FORCE: 7000, BLOOM: true, BLOOM_INTENSITY: 1.0, SUNRAYS: false } },
};

// Standalone Slider Component
function SliderControl({ label, value, min, max, step, decimals = 0, onChange }) {
  const percentage = ((value - min) / (max - min)) * 100;
  const thumbRef = useRef(null);
  const trackRef = useRef(null);
  
  const handleInteraction = useCallback((e) => {
    e.preventDefault();
    e.stopPropagation();
    
    const track = trackRef.current;
    if (!track) return;
    
    const rect = track.getBoundingClientRect();
    const thumb = thumbRef.current;
    
    const updateValue = (clientX) => {
      const x = Math.max(0, Math.min(clientX - rect.left, rect.width));
      const ratio = x / rect.width;
      const newValue = min + ratio * (max - min);
      const steppedValue = Math.round(newValue / step) * step;
      const clampedValue = Math.max(min, Math.min(max, parseFloat(steppedValue.toFixed(10))));
      onChange(clampedValue);
    };
    
    // Get initial position
    const clientX = e.type.includes('touch') ? e.touches[0].clientX : e.clientX;
    updateValue(clientX);
    
    // Visual feedback
    if (thumb) {
      thumb.style.background = '#0ea5e9';
      thumb.style.transform = 'scale(1.15)';
    }
    
    const handleMove = (moveEvent) => {
      const moveX = moveEvent.type.includes('touch') 
        ? moveEvent.touches[0]?.clientX 
        : moveEvent.clientX;
      if (moveX !== undefined) {
        updateValue(moveX);
      }
    };
    
    const handleEnd = () => {
      if (thumb) {
        thumb.style.background = '#f8f8f8';
        thumb.style.transform = 'scale(1)';
      }
      document.removeEventListener('mousemove', handleMove);
      document.removeEventListener('mouseup', handleEnd);
      document.removeEventListener('touchmove', handleMove);
      document.removeEventListener('touchend', handleEnd);
    };
    
    document.addEventListener('mousemove', handleMove);
    document.addEventListener('mouseup', handleEnd);
    document.addEventListener('touchmove', handleMove, { passive: true });
    document.addEventListener('touchend', handleEnd);
  }, [min, max, step, onChange]);
  
  return (
    <div style={{ marginBottom: '14px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', color: '#94a3b8', marginBottom: '8px' }}>
        <span>{label}</span>
        <span style={{ color: '#64748b', fontFamily: 'monospace' }}>{decimals ? value.toFixed(decimals) : value}</span>
      </div>
      {/* Custom slider track */}
      <div 
        ref={trackRef}
        onMouseDown={handleInteraction}
        onTouchStart={handleInteraction}
        style={{
          position: 'relative',
          height: '24px',
          display: 'flex',
          alignItems: 'center',
          cursor: 'pointer',
          touchAction: 'none',
          userSelect: 'none'
        }}
      >
        {/* Track background */}
        <div style={{
          position: 'absolute',
          left: 0,
          right: 0,
          height: '6px',
          borderRadius: '3px',
          background: '#1e293b',
          pointerEvents: 'none'
        }}>
          {/* Filled track */}
          <div style={{
            width: `${percentage}%`,
            height: '100%',
            borderRadius: '3px',
            background: '#0ea5e9'
          }} />
        </div>
        {/* Thumb */}
        <div 
          ref={thumbRef}
          style={{
            position: 'absolute',
            left: `calc(${percentage}% - 8px)`,
            width: '16px',
            height: '16px',
            borderRadius: '50%',
            background: '#f8f8f8',
            border: '2px solid #0ea5e9',
            boxShadow: '0 2px 6px rgba(0,0,0,0.4)',
            transition: 'background 0.15s ease, transform 0.15s ease',
            pointerEvents: 'none'
          }} 
        />
      </div>
    </div>
  );
}

function WebglFluidSimulation() {
  const canvasRef = useRef(null);
  const [showControls, setShowControls] = useState(false);
  const [showFPS, setShowFPS] = useState(false);
  const [fps, setFps] = useState(0);
  const [autoSplat, setAutoSplat] = useState(false);
  const [colorPalette, setColorPalette] = useState('rainbow');
  const [config, setConfig] = useState({
    SIM_RESOLUTION: 128,
    DYE_RESOLUTION: 1024,
    DENSITY_DISSIPATION: 1.0,
    VELOCITY_DISSIPATION: 0.2,
    PRESSURE: 0.8,
    PRESSURE_ITERATIONS: 20,
    CURL: 30,
    SPLAT_RADIUS: 0.12,
    SPLAT_FORCE: 6000,
    SHADING: true,
    COLORFUL: true,
    PAUSED: false,
    BLOOM: true,
    BLOOM_INTENSITY: 0.8,
    BLOOM_THRESHOLD: 0.6,
    SUNRAYS: true,
    SUNRAYS_WEIGHT: 1.0,
  });
  const configRef = useRef(config);
  const colorPaletteRef = useRef(colorPalette);
  const autoSplatRef = useRef(autoSplat);
  
  useEffect(() => { configRef.current = config; }, [config]);
  useEffect(() => { colorPaletteRef.current = colorPalette; }, [colorPalette]);
  useEffect(() => { autoSplatRef.current = autoSplat; }, [autoSplat]);

  useEffect(() => {
    document.body.style.background = '#0a0a0a';
    document.body.style.margin = '0';
    document.body.style.overflow = 'hidden';
    
    return () => {
      document.body.style.background = '';
      document.body.style.margin = '';
      document.body.style.overflow = '';
    };
  }, []);

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.target.tagName === 'INPUT') return;
      switch (e.key.toLowerCase()) {
        case ' ':
          e.preventDefault();
          setConfig(prev => ({ ...prev, PAUSED: !prev.PAUSED }));
          break;
        case 'r':
          if (window._fluidSplats) window._fluidSplats(parseInt(Math.random() * 15) + 5);
          break;
        case 'c':
          if (window._fluidClear) {
            window._fluidClear();
            if (window._fluidRender) window._fluidRender();
          }
          break;
        case 's':
          if (e.ctrlKey || e.metaKey) {
            e.preventDefault();
            handleScreenshot();
          } else {
            setShowControls(prev => !prev);
          }
          break;
        case 'a':
          setAutoSplat(prev => !prev);
          break;
        case 'f':
          setShowFPS(prev => !prev);
          break;
        case 'escape':
          setShowControls(false);
          break;
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  const handleScreenshot = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const link = document.createElement('a');
    link.download = `fluid-${Date.now()}.png`;
    link.href = canvas.toDataURL('image/png');
    link.click();
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    let isContextLost = false;

    function resizeCanvas() {
      const width = canvas.clientWidth;
      const height = canvas.clientHeight;
      if (canvas.width !== width || canvas.height !== height) {
        canvas.width = width;
        canvas.height = height;
        return true;
      }
      return false;
    }
    resizeCanvas();

    const params = { alpha: true, depth: false, stencil: false, antialias: false, preserveDrawingBuffer: true };
    let gl = canvas.getContext('webgl2', params);
    const isWebGL2 = !!gl;
    if (!isWebGL2) {
      gl = canvas.getContext('webgl', params) || canvas.getContext('experimental-webgl', params);
    }
    if (!gl) return;

    // Handle WebGL context loss and restoration
    const handleContextLost = (e) => {
      e.preventDefault();
      isContextLost = true;
    };

    const handleContextRestored = () => {
      isContextLost = false;
      // Context restored - the effect will need to re-run to reinitialize
    };

    canvas.addEventListener('webglcontextlost', handleContextLost);
    canvas.addEventListener('webglcontextrestored', handleContextRestored);

    let halfFloat, supportLinearFiltering;
    if (isWebGL2) {
      gl.getExtension('EXT_color_buffer_float');
      supportLinearFiltering = gl.getExtension('OES_texture_float_linear');
    } else {
      halfFloat = gl.getExtension('OES_texture_half_float');
      supportLinearFiltering = gl.getExtension('OES_texture_half_float_linear');
    }
    gl.clearColor(0.0, 0.0, 0.0, 1.0);
    const halfFloatTexType = isWebGL2 ? gl.HALF_FLOAT : (halfFloat ? halfFloat.HALF_FLOAT_OES : null);
    if (!halfFloatTexType) return;

    function getSupportedFormat(gl, internalFormat, format, type) {
      if (!supportRenderTextureFormat(gl, internalFormat, format, type)) {
        if (isWebGL2) {
          switch (internalFormat) {
            case gl.R16F: return getSupportedFormat(gl, gl.RG16F, gl.RG, type);
            case gl.RG16F: return getSupportedFormat(gl, gl.RGBA16F, gl.RGBA, type);
            default: return null;
          }
        }
        return null;
      }
      return { internalFormat, format };
    }

    function supportRenderTextureFormat(gl, internalFormat, format, type) {
      const texture = gl.createTexture();
      gl.bindTexture(gl.TEXTURE_2D, texture);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
      gl.texImage2D(gl.TEXTURE_2D, 0, internalFormat, 4, 4, 0, format, type, null);
      const fbo = gl.createFramebuffer();
      gl.bindFramebuffer(gl.FRAMEBUFFER, fbo);
      gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, texture, 0);
      const status = gl.checkFramebufferStatus(gl.FRAMEBUFFER);
      gl.deleteTexture(texture);
      gl.deleteFramebuffer(fbo);
      return status === gl.FRAMEBUFFER_COMPLETE;
    }

    let formatRGBA, formatRG, formatR;
    if (isWebGL2) {
      formatRGBA = getSupportedFormat(gl, gl.RGBA16F, gl.RGBA, halfFloatTexType);
      formatRG = getSupportedFormat(gl, gl.RG16F, gl.RG, halfFloatTexType);
      formatR = getSupportedFormat(gl, gl.R16F, gl.RED, halfFloatTexType);
    }
    if (!formatRGBA) {
      formatRGBA = { internalFormat: gl.RGBA, format: gl.RGBA };
      formatRG = { internalFormat: gl.RGBA, format: gl.RGBA };
      formatR = { internalFormat: gl.RGBA, format: gl.RGBA };
    }

    const baseVertexShader = compileShader(gl.VERTEX_SHADER, `
      precision highp float;
      attribute vec2 aPosition;
      varying vec2 vUv;
      varying vec2 vL;
      varying vec2 vR;
      varying vec2 vT;
      varying vec2 vB;
      uniform vec2 texelSize;
      void main () {
        vUv = aPosition * 0.5 + 0.5;
        vL = vUv - vec2(texelSize.x, 0.0);
        vR = vUv + vec2(texelSize.x, 0.0);
        vT = vUv + vec2(0.0, texelSize.y);
        vB = vUv - vec2(0.0, texelSize.y);
        gl_Position = vec4(aPosition, 0.0, 1.0);
      }
    `);

    const blurVertexShader = compileShader(gl.VERTEX_SHADER, `
      precision highp float;
      attribute vec2 aPosition;
      varying vec2 vUv;
      varying vec2 vL;
      varying vec2 vR;
      uniform vec2 texelSize;
      void main () {
        vUv = aPosition * 0.5 + 0.5;
        float offset = 1.33333333;
        vL = vUv - texelSize * offset;
        vR = vUv + texelSize * offset;
        gl_Position = vec4(aPosition, 0.0, 1.0);
      }
    `);

    const blurShader = compileShader(gl.FRAGMENT_SHADER, `
      precision mediump float;
      precision mediump sampler2D;
      varying vec2 vUv;
      varying vec2 vL;
      varying vec2 vR;
      uniform sampler2D uTexture;
      void main () {
        vec4 sum = texture2D(uTexture, vUv) * 0.29411764;
        sum += texture2D(uTexture, vL) * 0.35294117;
        sum += texture2D(uTexture, vR) * 0.35294117;
        gl_FragColor = sum;
      }
    `);

    const copyShader = compileShader(gl.FRAGMENT_SHADER, `
      precision mediump float;
      precision mediump sampler2D;
      varying highp vec2 vUv;
      uniform sampler2D uTexture;
      void main () {
        gl_FragColor = texture2D(uTexture, vUv);
      }
    `);

    const clearShader = compileShader(gl.FRAGMENT_SHADER, `
      precision mediump float;
      precision mediump sampler2D;
      varying highp vec2 vUv;
      uniform sampler2D uTexture;
      uniform float value;
      void main () {
        gl_FragColor = value * texture2D(uTexture, vUv);
      }
    `);

    const bloomPrefilterShader = compileShader(gl.FRAGMENT_SHADER, `
      precision mediump float;
      precision mediump sampler2D;
      varying vec2 vUv;
      uniform sampler2D uTexture;
      uniform vec3 curve;
      uniform float threshold;
      void main () {
        vec3 c = texture2D(uTexture, vUv).rgb;
        float br = max(c.r, max(c.g, c.b));
        float rq = clamp(br - curve.x, 0.0, curve.y);
        rq = curve.z * rq * rq;
        c *= max(rq, br - threshold) / max(br, 0.0001);
        gl_FragColor = vec4(c, 0.0);
      }
    `);

    const bloomBlurShader = compileShader(gl.FRAGMENT_SHADER, `
      precision mediump float;
      precision mediump sampler2D;
      varying vec2 vL;
      varying vec2 vR;
      varying vec2 vUv;
      uniform sampler2D uTexture;
      void main () {
        vec4 sum = vec4(0.0);
        sum += texture2D(uTexture, vL) * 0.5;
        sum += texture2D(uTexture, vUv) * 0.5;
        sum += texture2D(uTexture, vR) * 0.5;
        gl_FragColor = sum / 1.5;
      }
    `);

    const bloomFinalShader = compileShader(gl.FRAGMENT_SHADER, `
      precision mediump float;
      precision mediump sampler2D;
      varying vec2 vUv;
      uniform sampler2D uTexture;
      uniform float intensity;
      void main () {
        gl_FragColor = texture2D(uTexture, vUv) * intensity;
      }
    `);

    const sunraysMaskShader = compileShader(gl.FRAGMENT_SHADER, `
      precision highp float;
      precision highp sampler2D;
      varying vec2 vUv;
      uniform sampler2D uTexture;
      void main () {
        vec4 c = texture2D(uTexture, vUv);
        float br = max(c.r, max(c.g, c.b));
        c.a = 1.0 - min(max(br * 20.0, 0.0), 0.8);
        gl_FragColor = c;
      }
    `);

    const sunraysShader = compileShader(gl.FRAGMENT_SHADER, `
      precision highp float;
      precision highp sampler2D;
      varying vec2 vUv;
      uniform sampler2D uTexture;
      uniform float weight;
      #define ITERATIONS 16
      void main () {
        float Density = 0.3;
        float Decay = 0.95;
        float Exposure = 0.7;
        vec2 coord = vUv;
        vec2 dir = vUv - 0.5;
        dir *= 1.0 / float(ITERATIONS) * Density;
        float illuminationDecay = 1.0;
        float color = texture2D(uTexture, vUv).a;
        for (int i = 0; i < ITERATIONS; i++) {
          coord -= dir;
          float col = texture2D(uTexture, coord).a;
          color += col * illuminationDecay * weight;
          illuminationDecay *= Decay;
        }
        gl_FragColor = vec4(color * Exposure, color * Exposure, color * Exposure, 1.0);
      }
    `);

    const displayShaderSource = `
      precision highp float;
      precision highp sampler2D;
      varying vec2 vUv;
      varying vec2 vL;
      varying vec2 vR;
      varying vec2 vT;
      varying vec2 vB;
      uniform sampler2D uTexture;
      uniform sampler2D uBloom;
      uniform sampler2D uSunrays;
      uniform vec2 texelSize;
      vec3 linearToGamma (vec3 color) {
        color = max(color, vec3(0));
        return max(1.055 * pow(color, vec3(0.416666667)) - 0.055, vec3(0));
      }
      void main () {
        vec3 c = texture2D(uTexture, vUv).rgb;
        #ifdef SHADING
          vec3 lc = texture2D(uTexture, vL).rgb;
          vec3 rc = texture2D(uTexture, vR).rgb;
          vec3 tc = texture2D(uTexture, vT).rgb;
          vec3 bc = texture2D(uTexture, vB).rgb;
          float dx = length(rc) - length(lc);
          float dy = length(tc) - length(bc);
          vec3 n = normalize(vec3(dx, dy, length(texelSize)));
          vec3 l = vec3(0.0, 0.0, 1.0);
          float diffuse = clamp(dot(n, l) + 0.7, 0.7, 1.0);
          c *= diffuse;
        #endif
        #ifdef BLOOM
          vec3 bloom = texture2D(uBloom, vUv).rgb;
          c += bloom;
        #endif
        #ifdef SUNRAYS
          float sunrays = texture2D(uSunrays, vUv).r;
          c *= 1.0 + sunrays * 0.4;
        #endif
        float a = max(c.r, max(c.g, c.b));
        gl_FragColor = vec4(linearToGamma(c), a);
      }
    `;

    const splatShader = compileShader(gl.FRAGMENT_SHADER, `
      precision highp float;
      precision highp sampler2D;
      varying vec2 vUv;
      uniform sampler2D uTarget;
      uniform float aspectRatio;
      uniform vec3 color;
      uniform vec2 point;
      uniform float radius;
      void main () {
        vec2 p = vUv - point.xy;
        p.x *= aspectRatio;
        vec3 splat = exp(-dot(p, p) / radius) * color;
        vec3 base = texture2D(uTarget, vUv).xyz;
        gl_FragColor = vec4(base + splat, 1.0);
      }
    `);

    const advectionShader = compileShader(gl.FRAGMENT_SHADER, `
      precision highp float;
      precision highp sampler2D;
      varying vec2 vUv;
      uniform sampler2D uVelocity;
      uniform sampler2D uSource;
      uniform vec2 texelSize;
      uniform vec2 dyeTexelSize;
      uniform float dt;
      uniform float dissipation;
      vec4 bilerp (sampler2D sam, vec2 uv, vec2 tsize) {
        vec2 st = uv / tsize - 0.5;
        vec2 iuv = floor(st);
        vec2 fuv = fract(st);
        vec4 a = texture2D(sam, (iuv + vec2(0.5, 0.5)) * tsize);
        vec4 b = texture2D(sam, (iuv + vec2(1.5, 0.5)) * tsize);
        vec4 c = texture2D(sam, (iuv + vec2(0.5, 1.5)) * tsize);
        vec4 d = texture2D(sam, (iuv + vec2(1.5, 1.5)) * tsize);
        return mix(mix(a, b, fuv.x), mix(c, d, fuv.x), fuv.y);
      }
      void main () {
        vec2 coord = vUv - dt * bilerp(uVelocity, vUv, texelSize).xy * texelSize;
        vec4 result = bilerp(uSource, coord, dyeTexelSize);
        float decay = 1.0 + dissipation * dt;
        gl_FragColor = result / decay;
      }
    `);

    const divergenceShader = compileShader(gl.FRAGMENT_SHADER, `
      precision mediump float;
      precision mediump sampler2D;
      varying highp vec2 vUv;
      varying highp vec2 vL;
      varying highp vec2 vR;
      varying highp vec2 vT;
      varying highp vec2 vB;
      uniform sampler2D uVelocity;
      void main () {
        float L = texture2D(uVelocity, vL).x;
        float R = texture2D(uVelocity, vR).x;
        float T = texture2D(uVelocity, vT).y;
        float B = texture2D(uVelocity, vB).y;
        vec2 C = texture2D(uVelocity, vUv).xy;
        if (vL.x < 0.0) { L = -C.x; }
        if (vR.x > 1.0) { R = -C.x; }
        if (vT.y > 1.0) { T = -C.y; }
        if (vB.y < 0.0) { B = -C.y; }
        float div = 0.5 * (R - L + T - B);
        gl_FragColor = vec4(div, 0.0, 0.0, 1.0);
      }
    `);

    const curlShader = compileShader(gl.FRAGMENT_SHADER, `
      precision mediump float;
      precision mediump sampler2D;
      varying highp vec2 vUv;
      varying highp vec2 vL;
      varying highp vec2 vR;
      varying highp vec2 vT;
      varying highp vec2 vB;
      uniform sampler2D uVelocity;
      void main () {
        float L = texture2D(uVelocity, vL).y;
        float R = texture2D(uVelocity, vR).y;
        float T = texture2D(uVelocity, vT).x;
        float B = texture2D(uVelocity, vB).x;
        float vorticity = R - L - T + B;
        gl_FragColor = vec4(0.5 * vorticity, 0.0, 0.0, 1.0);
      }
    `);

    const vorticityShader = compileShader(gl.FRAGMENT_SHADER, `
      precision highp float;
      precision highp sampler2D;
      varying vec2 vUv;
      varying vec2 vL;
      varying vec2 vR;
      varying vec2 vT;
      varying vec2 vB;
      uniform sampler2D uVelocity;
      uniform sampler2D uCurl;
      uniform float curl;
      uniform float dt;
      void main () {
        float L = texture2D(uCurl, vL).x;
        float R = texture2D(uCurl, vR).x;
        float T = texture2D(uCurl, vT).x;
        float B = texture2D(uCurl, vB).x;
        float C = texture2D(uCurl, vUv).x;
        vec2 force = 0.5 * vec2(abs(T) - abs(B), abs(R) - abs(L));
        force /= length(force) + 0.0001;
        force *= curl * C;
        force.y *= -1.0;
        vec2 velocity = texture2D(uVelocity, vUv).xy;
        velocity += force * dt;
        gl_FragColor = vec4(velocity, 0.0, 1.0);
      }
    `);

    const pressureShader = compileShader(gl.FRAGMENT_SHADER, `
      precision mediump float;
      precision mediump sampler2D;
      varying highp vec2 vUv;
      varying highp vec2 vL;
      varying highp vec2 vR;
      varying highp vec2 vT;
      varying highp vec2 vB;
      uniform sampler2D uPressure;
      uniform sampler2D uDivergence;
      void main () {
        float L = texture2D(uPressure, vL).x;
        float R = texture2D(uPressure, vR).x;
        float T = texture2D(uPressure, vT).x;
        float B = texture2D(uPressure, vB).x;
        float C = texture2D(uPressure, vUv).x;
        float divergence = texture2D(uDivergence, vUv).x;
        float pressure = (L + R + B + T - divergence) * 0.25;
        gl_FragColor = vec4(pressure, 0.0, 0.0, 1.0);
      }
    `);

    const gradientSubtractShader = compileShader(gl.FRAGMENT_SHADER, `
      precision mediump float;
      precision mediump sampler2D;
      varying highp vec2 vUv;
      varying highp vec2 vL;
      varying highp vec2 vR;
      varying highp vec2 vT;
      varying highp vec2 vB;
      uniform sampler2D uPressure;
      uniform sampler2D uVelocity;
      void main () {
        float L = texture2D(uPressure, vL).x;
        float R = texture2D(uPressure, vR).x;
        float T = texture2D(uPressure, vT).x;
        float B = texture2D(uPressure, vB).x;
        vec2 velocity = texture2D(uVelocity, vUv).xy;
        velocity.xy -= vec2(R - L, T - B);
        gl_FragColor = vec4(velocity, 0.0, 1.0);
      }
    `);

    function compileShader(type, source) {
      const shader = gl.createShader(type);
      gl.shaderSource(shader, source);
      gl.compileShader(shader);
      if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
        console.error('Shader compile error:', gl.getShaderInfoLog(shader));
        gl.deleteShader(shader);
        return null;
      }
      return shader;
    }

    function createProgram(vertexShader, fragmentShader) {
      const program = gl.createProgram();
      gl.attachShader(program, vertexShader);
      gl.attachShader(program, fragmentShader);
      gl.linkProgram(program);
      if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
        console.error('Program link error:', gl.getProgramInfoLog(program));
        return null;
      }
      return program;
    }

    function getUniforms(program) {
      const uniforms = {};
      const uniformCount = gl.getProgramParameter(program, gl.ACTIVE_UNIFORMS);
      for (let i = 0; i < uniformCount; i++) {
        const uniformName = gl.getActiveUniform(program, i).name;
        uniforms[uniformName] = gl.getUniformLocation(program, uniformName);
      }
      return uniforms;
    }

    class Program {
      constructor(vertexShader, fragmentShader) {
        this.program = createProgram(vertexShader, fragmentShader);
        this.uniforms = this.program ? getUniforms(this.program) : {};
      }
      bind() { gl.useProgram(this.program); }
    }

    class Material {
      constructor(vertexShader, fragmentShaderSource) {
        this.vertexShader = vertexShader;
        this.fragmentShaderSource = fragmentShaderSource;
        this.programs = {};
        this.activeProgram = null;
        this.uniforms = {};
      }
      setKeywords(keywords) {
        let hash = keywords.length > 0 ? keywords.join('_') : 'none';
        let program = this.programs[hash];
        if (!program) {
          const defines = keywords.map(k => '#define ' + k).join('\n') + '\n';
          const fragmentShader = compileShader(gl.FRAGMENT_SHADER, defines + this.fragmentShaderSource);
          program = createProgram(this.vertexShader, fragmentShader);
          this.programs[hash] = program;
        }
        if (program !== this.activeProgram) {
          this.uniforms = getUniforms(program);
          this.activeProgram = program;
        }
      }
      bind() { gl.useProgram(this.activeProgram); }
    }

    const blurProgram = new Program(blurVertexShader, blurShader);
    const copyProgram = new Program(baseVertexShader, copyShader);
    const clearProgram = new Program(baseVertexShader, clearShader);
    const bloomPrefilterProgram = new Program(baseVertexShader, bloomPrefilterShader);
    const bloomBlurProgram = new Program(blurVertexShader, bloomBlurShader);
    const bloomFinalProgram = new Program(baseVertexShader, bloomFinalShader);
    const sunraysMaskProgram = new Program(baseVertexShader, sunraysMaskShader);
    const sunraysProgram = new Program(baseVertexShader, sunraysShader);
    const splatProgram = new Program(baseVertexShader, splatShader);
    const advectionProgram = new Program(baseVertexShader, advectionShader);
    const divergenceProgram = new Program(baseVertexShader, divergenceShader);
    const curlProgram = new Program(baseVertexShader, curlShader);
    const vorticityProgram = new Program(baseVertexShader, vorticityShader);
    const pressureProgram = new Program(baseVertexShader, pressureShader);
    const gradienSubtractProgram = new Program(baseVertexShader, gradientSubtractShader);
    const displayMaterial = new Material(baseVertexShader, displayShaderSource);

    // --- CHANGED: Assigned buffers to variables for cleanup ---
    const blitQuadVBO = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, blitQuadVBO);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, -1, 1, 1, 1, 1, -1]), gl.STATIC_DRAW);
    
    const blitQuadEBO = gl.createBuffer();
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, blitQuadEBO);
    gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, new Uint16Array([0, 1, 2, 0, 2, 3]), gl.STATIC_DRAW);
    // --------------------------------------------------------
    
    gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);
    gl.enableVertexAttribArray(0);

    // Restore GL buffer state - important after resize operations
    function restoreGLState() {
      gl.bindBuffer(gl.ARRAY_BUFFER, blitQuadVBO);
      gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, blitQuadEBO);
      gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);
      gl.enableVertexAttribArray(0);
    }

    function blit(target, clear = false) {
      if (target == null) {
        gl.viewport(0, 0, gl.drawingBufferWidth, gl.drawingBufferHeight);
        gl.bindFramebuffer(gl.FRAMEBUFFER, null);
      } else {
        gl.viewport(0, 0, target.width, target.height);
        gl.bindFramebuffer(gl.FRAMEBUFFER, target.fbo);
      }
      if (clear) {
        gl.clearColor(0.0, 0.0, 0.0, 1.0);
        gl.clear(gl.COLOR_BUFFER_BIT);
      }
      // Ensure buffers are bound before drawing
      gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, blitQuadEBO);
      gl.drawElements(gl.TRIANGLES, 6, gl.UNSIGNED_SHORT, 0);
    }

    function createFBO(w, h, internalFormat, format, type, param) {
      gl.activeTexture(gl.TEXTURE0);
      const texture = gl.createTexture();
      gl.bindTexture(gl.TEXTURE_2D, texture);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, param);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, param);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
      gl.texImage2D(gl.TEXTURE_2D, 0, internalFormat, w, h, 0, format, type, null);
      const fbo = gl.createFramebuffer();
      gl.bindFramebuffer(gl.FRAMEBUFFER, fbo);
      gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, texture, 0);
      gl.viewport(0, 0, w, h);
      gl.clear(gl.COLOR_BUFFER_BIT);
      return {
        texture, fbo, width: w, height: h,
        texelSizeX: 1.0 / w, texelSizeY: 1.0 / h,
        attach(id) {
          gl.activeTexture(gl.TEXTURE0 + id);
          gl.bindTexture(gl.TEXTURE_2D, texture);
          return id;
        }
      };
    }

    function createDoubleFBO(w, h, internalFormat, format, type, param) {
      let fbo1 = createFBO(w, h, internalFormat, format, type, param);
      let fbo2 = createFBO(w, h, internalFormat, format, type, param);
      return {
        width: w, height: h,
        texelSizeX: fbo1.texelSizeX, texelSizeY: fbo1.texelSizeY,
        get read() { return fbo1; },
        set read(value) { fbo1 = value; },
        get write() { return fbo2; },
        set write(value) { fbo2 = value; },
        swap() { const temp = fbo1; fbo1 = fbo2; fbo2 = temp; }
      };
    }

    function resizeFBO(target, w, h, internalFormat, format, type, param) {
      // Disable blending during copy to prevent progressive darkening
      gl.disable(gl.BLEND);
      const newFBO = createFBO(w, h, internalFormat, format, type, param);
      copyProgram.bind();
      gl.uniform1i(copyProgram.uniforms.uTexture, target.attach(0));
      blit(newFBO);
      return newFBO;
    }

    function resizeDoubleFBO(target, w, h, internalFormat, format, type, param) {
      if (target.width === w && target.height === h) return target;
      target.read = resizeFBO(target.read, w, h, internalFormat, format, type, param);
      target.write = createFBO(w, h, internalFormat, format, type, param);
      target.width = w;
      target.height = h;
      target.texelSizeX = 1.0 / w;
      target.texelSizeY = 1.0 / h;
      return target;
    }

    function getResolution(resolution) {
      let aspectRatio = gl.drawingBufferWidth / gl.drawingBufferHeight;
      if (aspectRatio < 1) aspectRatio = 1.0 / aspectRatio;
      const min = Math.round(resolution);
      const max = Math.round(resolution * aspectRatio);
      if (gl.drawingBufferWidth > gl.drawingBufferHeight) return { width: max, height: min };
      return { width: min, height: max };
    }

    const texType = halfFloatTexType;
    const filtering = supportLinearFiltering ? gl.LINEAR : gl.NEAREST;

    let simRes = getResolution(configRef.current.SIM_RESOLUTION);
    let dyeRes = getResolution(configRef.current.DYE_RESOLUTION);
    let bloomRes = getResolution(256);
    let sunraysRes = getResolution(196);

    let dye = createDoubleFBO(dyeRes.width, dyeRes.height, formatRGBA.internalFormat, formatRGBA.format, texType, filtering);
    let velocity = createDoubleFBO(simRes.width, simRes.height, formatRG.internalFormat, formatRG.format, texType, filtering);
    let divergence = createFBO(simRes.width, simRes.height, formatR.internalFormat, formatR.format, texType, gl.NEAREST);
    let curl = createFBO(simRes.width, simRes.height, formatR.internalFormat, formatR.format, texType, gl.NEAREST);
    let pressure = createDoubleFBO(simRes.width, simRes.height, formatR.internalFormat, formatR.format, texType, gl.NEAREST);

    let bloom = createFBO(bloomRes.width, bloomRes.height, formatRGBA.internalFormat, formatRGBA.format, texType, filtering);
    let bloomFramebuffers = [];
    for (let i = 0; i < 8; i++) {
      const w = Math.max(2, bloomRes.width >> (i + 1));
      const h = Math.max(2, bloomRes.height >> (i + 1));
      bloomFramebuffers.push(createFBO(w, h, formatRGBA.internalFormat, formatRGBA.format, texType, filtering));
    }

    let sunrays = createFBO(sunraysRes.width, sunraysRes.height, formatR.internalFormat, formatR.format, texType, filtering);
    let sunraysTemp = createFBO(sunraysRes.width, sunraysRes.height, formatR.internalFormat, formatR.format, texType, filtering);

    class PointerPrototype {
      constructor() {
        this.id = -1;
        this.texcoordX = 0;
        this.texcoordY = 0;
        this.prevTexcoordX = 0;
        this.prevTexcoordY = 0;
        this.deltaX = 0;
        this.deltaY = 0;
        this.down = false;
        this.moved = false;
        this.color = [30, 0, 300];
      }
    }

    const pointers = [new PointerPrototype()];

    function HSVtoRGB(h, s, v) {
      let r, g, b;
      const i = Math.floor(h * 6);
      const f = h * 6 - i;
      const p = v * (1 - s);
      const q = v * (1 - f * s);
      const t = v * (1 - (1 - f) * s);
      switch (i % 6) {
        case 0: r = v; g = t; b = p; break;
        case 1: r = q; g = v; b = p; break;
        case 2: r = p; g = v; b = t; break;
        case 3: r = p; g = q; b = v; break;
        case 4: r = t; g = p; b = v; break;
        case 5: r = v; g = p; b = q; break;
        default: r = 0; g = 0; b = 0;
      }
      return { r, g, b };
    }

    function generateColor() {
      const palette = COLOR_PALETTES[colorPaletteRef.current];
      let c;
      if (palette.colors) {
        const randomColor = palette.colors[Math.floor(Math.random() * palette.colors.length)];
        c = { r: randomColor[0], g: randomColor[1], b: randomColor[2] };
      } else {
        c = HSVtoRGB(Math.random(), 1.0, 1.0);
      }
      c.r *= 0.15;
      c.g *= 0.15;
      c.b *= 0.15;
      return c;
    }

    function correctRadius(radius) {
      const aspectRatio = canvas.width / canvas.height;
      if (aspectRatio > 1) radius *= aspectRatio;
      return radius;
    }

    function splat(x, y, dx, dy, color) {
      splatProgram.bind();
      gl.uniform1i(splatProgram.uniforms.uTarget, velocity.read.attach(0));
      gl.uniform1f(splatProgram.uniforms.aspectRatio, canvas.width / canvas.height);
      gl.uniform2f(splatProgram.uniforms.point, x, y);
      gl.uniform3f(splatProgram.uniforms.color, dx, dy, 0.0);
      gl.uniform1f(splatProgram.uniforms.radius, correctRadius(configRef.current.SPLAT_RADIUS / 100.0));
      blit(velocity.write);
      velocity.swap();

      gl.uniform1i(splatProgram.uniforms.uTarget, dye.read.attach(0));
      gl.uniform3f(splatProgram.uniforms.color, color.r, color.g, color.b);
      blit(dye.write);
      dye.swap();
    }

    function splatPointer(pointer) {
      const dx = pointer.deltaX * configRef.current.SPLAT_FORCE;
      const dy = pointer.deltaY * configRef.current.SPLAT_FORCE;
      splat(pointer.texcoordX, pointer.texcoordY, dx, dy, pointer.color);
    }

    function multipleSplats(amount) {
      for (let i = 0; i < amount; i++) {
        const color = generateColor();
        color.r *= 4.0;
        color.g *= 4.0;
        color.b *= 4.0;
        const x = Math.random();
        const y = Math.random();
        const dx = 800 * (Math.random() - 0.5);
        const dy = 800 * (Math.random() - 0.5);
        splat(x, y, dx, dy, color);
      }
    }

    function clearCanvas() {
      gl.disable(gl.BLEND);
      gl.clearColor(0.0, 0.0, 0.0, 1.0);
      
      // Helper to clear an FBO
      function clearFBO(fbo) {
        gl.bindFramebuffer(gl.FRAMEBUFFER, fbo.fbo);
        gl.viewport(0, 0, fbo.width, fbo.height);
        gl.clear(gl.COLOR_BUFFER_BIT);
      }
      
      // Clear dye (both read and write)
      clearFBO(dye.read);
      clearFBO(dye.write);
      
      // Clear velocity (both read and write)
      clearFBO(velocity.read);
      clearFBO(velocity.write);
      
      // Clear pressure (both read and write)
      clearFBO(pressure.read);
      clearFBO(pressure.write);
      
      // Clear curl and divergence
      clearFBO(curl);
      clearFBO(divergence);
      
      // Clear bloom buffers
      clearFBO(bloom);
      bloomFramebuffers.forEach(fbo => clearFBO(fbo));
      
      // Clear sunrays buffers
      clearFBO(sunrays);
      clearFBO(sunraysTemp);
      
      // Reset to default framebuffer and clear main canvas
      gl.bindFramebuffer(gl.FRAMEBUFFER, null);
      gl.viewport(0, 0, gl.drawingBufferWidth, gl.drawingBufferHeight);
      gl.clear(gl.COLOR_BUFFER_BIT);
      
      // Force a fresh render with cleared state
      gl.enable(gl.BLEND);
    }

    function updatePointerDownData(pointer, id, posX, posY) {
      pointer.id = id;
      pointer.down = true;
      pointer.moved = false;
      pointer.texcoordX = posX / canvas.width;
      pointer.texcoordY = 1.0 - posY / canvas.height;
      pointer.prevTexcoordX = pointer.texcoordX;
      pointer.prevTexcoordY = pointer.texcoordY;
      pointer.deltaX = 0;
      pointer.deltaY = 0;
      pointer.color = generateColor();
    }

    function updatePointerMoveData(pointer, posX, posY) {
      pointer.prevTexcoordX = pointer.texcoordX;
      pointer.prevTexcoordY = pointer.texcoordY;
      pointer.texcoordX = posX / canvas.width;
      pointer.texcoordY = 1.0 - posY / canvas.height;
      const aspectRatio = canvas.width / canvas.height;
      pointer.deltaX = (pointer.texcoordX - pointer.prevTexcoordX) * (aspectRatio < 1 ? aspectRatio : 1);
      pointer.deltaY = (pointer.texcoordY - pointer.prevTexcoordY) * (aspectRatio > 1 ? 1 / aspectRatio : 1);
      pointer.moved = Math.abs(pointer.deltaX) > 0 || Math.abs(pointer.deltaY) > 0;
    }

    // --- REPLACED EVENT LISTENERS (START) ---
    const handleMouseDown = (e) => {
      const rect = canvas.getBoundingClientRect();
      updatePointerDownData(pointers[0], -1, e.clientX - rect.left, e.clientY - rect.top);
    };

    const handleMouseMove = (e) => {
      const rect = canvas.getBoundingClientRect();
      if (!pointers[0].down) return;
      updatePointerMoveData(pointers[0], e.clientX - rect.left, e.clientY - rect.top);
    };

    const handleMouseUp = () => { 
      pointers[0].down = false; 
    };

    const handleTouchStart = (e) => {
      e.preventDefault();
      const touches = e.targetTouches;
      const rect = canvas.getBoundingClientRect();
      while (pointers.length < touches.length) pointers.push(new PointerPrototype());
      for (let i = 0; i < touches.length; i++) {
        updatePointerDownData(pointers[i], touches[i].identifier, touches[i].clientX - rect.left, touches[i].clientY - rect.top);
      }
    };

    const handleTouchMove = (e) => {
      e.preventDefault();
      const touches = e.targetTouches;
      const rect = canvas.getBoundingClientRect();
      for (let i = 0; i < touches.length; i++) {
        if (!pointers[i].down) continue;
        updatePointerMoveData(pointers[i], touches[i].clientX - rect.left, touches[i].clientY - rect.top);
      }
    };

    const handleTouchEnd = (e) => {
      const touches = e.changedTouches;
      for (let i = 0; i < touches.length; i++) {
        const pointer = pointers.find(p => p.id === touches[i].identifier);
        if (pointer) pointer.down = false;
      }
    };

    canvas.addEventListener('mousedown', handleMouseDown);
    canvas.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
    canvas.addEventListener('touchstart', handleTouchStart, { passive: false });
    canvas.addEventListener('touchmove', handleTouchMove, { passive: false });
    window.addEventListener('touchend', handleTouchEnd);
    // --- REPLACED EVENT LISTENERS (END) ---

    multipleSplats(parseInt(Math.random() * 8) + 4);

    let lastUpdateTime = Date.now();
    let colorUpdateTimer = 0;
    let autoSplatTimer = 0;
    let animationFrameId;
    let frameCount = 0;
    let fpsTime = Date.now();

    function applyBloom(source, destination) {
      if (bloomFramebuffers.length < 2) return;
      let last = destination;
      gl.disable(gl.BLEND);
      bloomPrefilterProgram.bind();
      const knee = configRef.current.BLOOM_THRESHOLD * 0.7;
      const curve = [configRef.current.BLOOM_THRESHOLD - knee, knee * 2, 0.25 / knee];
      gl.uniform3f(bloomPrefilterProgram.uniforms.curve, curve[0], curve[1], curve[2]);
      gl.uniform1f(bloomPrefilterProgram.uniforms.threshold, configRef.current.BLOOM_THRESHOLD);
      gl.uniform1i(bloomPrefilterProgram.uniforms.uTexture, source.attach(0));
      blit(last);

      bloomBlurProgram.bind();
      for (let i = 0; i < bloomFramebuffers.length; i++) {
        const dest = bloomFramebuffers[i];
        gl.uniform2f(bloomBlurProgram.uniforms.texelSize, last.texelSizeX, 0.0);
        gl.uniform1i(bloomBlurProgram.uniforms.uTexture, last.attach(0));
        blit(dest);
        gl.uniform2f(bloomBlurProgram.uniforms.texelSize, 0.0, dest.texelSizeY);
        gl.uniform1i(bloomBlurProgram.uniforms.uTexture, dest.attach(0));
        blit(dest);
        last = dest;
      }

      gl.blendFunc(gl.ONE, gl.ONE);
      gl.enable(gl.BLEND);
      for (let i = bloomFramebuffers.length - 2; i >= 0; i--) {
        const baseTex = bloomFramebuffers[i];
        gl.uniform2f(bloomBlurProgram.uniforms.texelSize, last.texelSizeX, 0.0);
        gl.uniform1i(bloomBlurProgram.uniforms.uTexture, last.attach(0));
        gl.viewport(0, 0, baseTex.width, baseTex.height);
        blit(baseTex);
        gl.uniform2f(bloomBlurProgram.uniforms.texelSize, 0.0, baseTex.texelSizeY);
        gl.uniform1i(bloomBlurProgram.uniforms.uTexture, baseTex.attach(0));
        blit(baseTex);
        last = baseTex;
      }

      gl.disable(gl.BLEND);
      bloomFinalProgram.bind();
      gl.uniform2f(bloomFinalProgram.uniforms.texelSize, last.texelSizeX, last.texelSizeY);
      gl.uniform1i(bloomFinalProgram.uniforms.uTexture, last.attach(0));
      gl.uniform1f(bloomFinalProgram.uniforms.intensity, configRef.current.BLOOM_INTENSITY);
      blit(destination);
    }

    function applySunrays(source, mask, destination) {
      gl.disable(gl.BLEND);
      sunraysMaskProgram.bind();
      gl.uniform1i(sunraysMaskProgram.uniforms.uTexture, source.attach(0));
      blit(mask);

      sunraysProgram.bind();
      gl.uniform1f(sunraysProgram.uniforms.weight, configRef.current.SUNRAYS_WEIGHT);
      gl.uniform1i(sunraysProgram.uniforms.uTexture, mask.attach(0));
      blit(destination);
    }

    function blur(target, temp, iterations) {
      blurProgram.bind();
      for (let i = 0; i < iterations; i++) {
        gl.uniform2f(blurProgram.uniforms.texelSize, target.texelSizeX, 0.0);
        gl.uniform1i(blurProgram.uniforms.uTexture, target.attach(0));
        blit(temp);
        gl.uniform2f(blurProgram.uniforms.texelSize, 0.0, target.texelSizeY);
        gl.uniform1i(blurProgram.uniforms.uTexture, temp.attach(0));
        blit(target);
      }
    }

    function step(dt) {
      gl.disable(gl.BLEND);

      curlProgram.bind();
      gl.uniform2f(curlProgram.uniforms.texelSize, velocity.texelSizeX, velocity.texelSizeY);
      gl.uniform1i(curlProgram.uniforms.uVelocity, velocity.read.attach(0));
      blit(curl);

      vorticityProgram.bind();
      gl.uniform2f(vorticityProgram.uniforms.texelSize, velocity.texelSizeX, velocity.texelSizeY);
      gl.uniform1i(vorticityProgram.uniforms.uVelocity, velocity.read.attach(0));
      gl.uniform1i(vorticityProgram.uniforms.uCurl, curl.attach(1));
      gl.uniform1f(vorticityProgram.uniforms.curl, configRef.current.CURL);
      gl.uniform1f(vorticityProgram.uniforms.dt, dt);
      blit(velocity.write);
      velocity.swap();

      divergenceProgram.bind();
      gl.uniform2f(divergenceProgram.uniforms.texelSize, velocity.texelSizeX, velocity.texelSizeY);
      gl.uniform1i(divergenceProgram.uniforms.uVelocity, velocity.read.attach(0));
      blit(divergence);

      clearProgram.bind();
      gl.uniform1i(clearProgram.uniforms.uTexture, pressure.read.attach(0));
      gl.uniform1f(clearProgram.uniforms.value, configRef.current.PRESSURE);
      blit(pressure.write);
      pressure.swap();

      pressureProgram.bind();
      gl.uniform2f(pressureProgram.uniforms.texelSize, velocity.texelSizeX, velocity.texelSizeY);
      gl.uniform1i(pressureProgram.uniforms.uDivergence, divergence.attach(0));
      for (let i = 0; i < configRef.current.PRESSURE_ITERATIONS; i++) {
        gl.uniform1i(pressureProgram.uniforms.uPressure, pressure.read.attach(1));
        blit(pressure.write);
        pressure.swap();
      }

      gradienSubtractProgram.bind();
      gl.uniform2f(gradienSubtractProgram.uniforms.texelSize, velocity.texelSizeX, velocity.texelSizeY);
      gl.uniform1i(gradienSubtractProgram.uniforms.uPressure, pressure.read.attach(0));
      gl.uniform1i(gradienSubtractProgram.uniforms.uVelocity, velocity.read.attach(1));
      blit(velocity.write);
      velocity.swap();

      advectionProgram.bind();
      gl.uniform2f(advectionProgram.uniforms.texelSize, velocity.texelSizeX, velocity.texelSizeY);
      gl.uniform2f(advectionProgram.uniforms.dyeTexelSize, velocity.texelSizeX, velocity.texelSizeY);
      gl.uniform1i(advectionProgram.uniforms.uVelocity, velocity.read.attach(0));
      gl.uniform1i(advectionProgram.uniforms.uSource, velocity.read.attach(0));
      gl.uniform1f(advectionProgram.uniforms.dt, dt);
      gl.uniform1f(advectionProgram.uniforms.dissipation, configRef.current.VELOCITY_DISSIPATION);
      blit(velocity.write);
      velocity.swap();

      gl.uniform2f(advectionProgram.uniforms.dyeTexelSize, dye.texelSizeX, dye.texelSizeY);
      gl.uniform1i(advectionProgram.uniforms.uVelocity, velocity.read.attach(0));
      gl.uniform1i(advectionProgram.uniforms.uSource, dye.read.attach(1));
      gl.uniform1f(advectionProgram.uniforms.dissipation, configRef.current.DENSITY_DISSIPATION);
      blit(dye.write);
      dye.swap();
    }

    function render(target) {
      if (configRef.current.BLOOM) applyBloom(dye.read, bloom);
      if (configRef.current.SUNRAYS) {
        applySunrays(dye.read, sunraysTemp, sunrays);
        blur(sunrays, sunraysTemp, 1);
      }

      gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
      gl.enable(gl.BLEND);

      const keywords = [];
      if (configRef.current.SHADING) keywords.push('SHADING');
      if (configRef.current.BLOOM) keywords.push('BLOOM');
      if (configRef.current.SUNRAYS) keywords.push('SUNRAYS');
      displayMaterial.setKeywords(keywords);
      displayMaterial.bind();
      gl.uniform2f(displayMaterial.uniforms.texelSize, 1.0 / canvas.width, 1.0 / canvas.height);
      gl.uniform1i(displayMaterial.uniforms.uTexture, dye.read.attach(0));
      if (configRef.current.BLOOM) gl.uniform1i(displayMaterial.uniforms.uBloom, bloom.attach(1));
      if (configRef.current.SUNRAYS) gl.uniform1i(displayMaterial.uniforms.uSunrays, sunrays.attach(2));
      // Clear canvas before rendering to prevent accumulation/darkening after resize
      const shouldClear = (target == null);
      blit(target, shouldClear);
    }

    function update() {
      // Skip rendering if context is lost
      if (isContextLost) {
        animationFrameId = requestAnimationFrame(update);
        return;
      }

      const now = Date.now();
      let dt = (now - lastUpdateTime) / 1000;
      dt = Math.min(dt, 0.016666);
      lastUpdateTime = now;

      // FPS calculation
      frameCount++;
      if (now - fpsTime >= 1000) {
        setFps(frameCount);
        frameCount = 0;
        fpsTime = now;
      }

      if (resizeCanvas()) {
        const newSimRes = getResolution(configRef.current.SIM_RESOLUTION);
        const newDyeRes = getResolution(configRef.current.DYE_RESOLUTION);
        dye = resizeDoubleFBO(dye, newDyeRes.width, newDyeRes.height, formatRGBA.internalFormat, formatRGBA.format, texType, filtering);
        velocity = resizeDoubleFBO(velocity, newSimRes.width, newSimRes.height, formatRG.internalFormat, formatRG.format, texType, filtering);
        divergence = createFBO(newSimRes.width, newSimRes.height, formatR.internalFormat, formatR.format, texType, gl.NEAREST);
        curl = createFBO(newSimRes.width, newSimRes.height, formatR.internalFormat, formatR.format, texType, gl.NEAREST);
        pressure = resizeDoubleFBO(pressure, newSimRes.width, newSimRes.height, formatR.internalFormat, formatR.format, texType, gl.NEAREST);
        
        // Restore GL state after resize operations to prevent freeze
        restoreGLState();
      }

      if (!configRef.current.PAUSED) {
        // Auto-splat for screensaver mode
        if (autoSplatRef.current) {
          autoSplatTimer += dt;
          if (autoSplatTimer >= 0.8) {
            autoSplatTimer = 0;
            multipleSplats(Math.floor(Math.random() * 2) + 1);
          }
        }

        if (configRef.current.COLORFUL) {
          colorUpdateTimer += dt * 10;
          if (colorUpdateTimer >= 1) {
            colorUpdateTimer = 0;
            pointers.forEach(p => { p.color = generateColor(); });
          }
        }
        pointers.forEach(p => {
          if (p.moved) {
            p.moved = false;
            splatPointer(p);
          }
        });
        step(dt);
      }
      render(null);
      animationFrameId = requestAnimationFrame(update);
    }

    update();
    window._fluidSplats = multipleSplats;
    window._fluidClear = clearCanvas;
    window._fluidRender = () => render(null);

    return () => {
      cancelAnimationFrame(animationFrameId);
      window._fluidSplats = null;
      window._fluidClear = null;
      window._fluidRender = null;
      
      // --- CLEANUP LISTENERS ---
      canvas.removeEventListener('mousedown', handleMouseDown);
      canvas.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
      canvas.removeEventListener('touchstart', handleTouchStart);
      canvas.removeEventListener('touchmove', handleTouchMove);
      window.removeEventListener('touchend', handleTouchEnd);
      canvas.removeEventListener('webglcontextlost', handleContextLost);
      canvas.removeEventListener('webglcontextrestored', handleContextRestored);

      // --- CLEANUP WEBGL RESOURCES ---
      const deleteFBO = (fbo) => {
        gl.deleteTexture(fbo.texture);
        gl.deleteFramebuffer(fbo.fbo);
      };
      const deleteDoubleFBO = (doubleFbo) => {
        deleteFBO(doubleFbo.read);
        deleteFBO(doubleFbo.write);
      };

      // Delete FBOs
      deleteDoubleFBO(dye);
      deleteDoubleFBO(velocity);
      deleteFBO(divergence);
      deleteFBO(curl);
      deleteDoubleFBO(pressure);
      deleteFBO(bloom);
      bloomFramebuffers.forEach(fbo => deleteFBO(fbo));
      deleteFBO(sunrays);
      deleteFBO(sunraysTemp);

      // Delete Programs
      [
        blurProgram, copyProgram, clearProgram, bloomPrefilterProgram,
        bloomBlurProgram, bloomFinalProgram, sunraysMaskProgram, sunraysProgram,
        splatProgram, advectionProgram, divergenceProgram, curlProgram,
        vorticityProgram, pressureProgram, gradienSubtractProgram
      ].forEach(p => gl.deleteProgram(p.program));

      // Delete Material Programs (compiled on demand)
      Object.values(displayMaterial.programs).forEach(p => gl.deleteProgram(p));

      // Delete Shaders
      [
        baseVertexShader, blurVertexShader, blurShader, copyShader, clearShader,
        bloomPrefilterShader, bloomBlurShader, bloomFinalShader, sunraysMaskShader,
        sunraysShader, splatShader, advectionShader, divergenceShader, curlShader,
        vorticityShader, pressureShader, gradienSubtractShader
      ].forEach(s => gl.deleteShader(s));

      // Delete Buffers
      gl.deleteBuffer(blitQuadVBO);
      gl.deleteBuffer(blitQuadEBO);
    };
  }, []);

  const handleRandomSplat = () => {
    if (window._fluidSplats) window._fluidSplats(parseInt(Math.random() * 5) + 3);
  };

  const handleClear = () => {
    if (window._fluidClear) {
      window._fluidClear();
      if (window._fluidRender) window._fluidRender();
    }
  };

  const updateConfig = (key, value) => {
    setConfig(prev => ({ ...prev, [key]: value }));
  };

  const applyPreset = (presetKey) => {
    const preset = PRESETS[presetKey];
    if (preset) {
      setConfig(prev => ({ ...prev, ...preset.config }));
    }
  };

  const ToggleControl = ({ label, value, onChange }) => (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
      <span style={{ fontSize: '12px', color: '#94a3b8' }}>{label}</span>
      <button
        onClick={onChange}
        style={{
          width: '40px',
          height: '22px',
          borderRadius: '11px',
          border: 'none',
          background: value ? '#0ea5e9' : '#334155',
          cursor: 'pointer',
          position: 'relative',
          transition: 'background 0.2s ease'
        }}
      >
        <div style={{
          width: '16px',
          height: '16px',
          borderRadius: '50%',
          background: '#f8f8f8',
          position: 'absolute',
          top: '3px',
          left: value ? '21px' : '3px',
          transition: 'left 0.2s ease',
          boxShadow: '0 1px 3px rgba(0,0,0,0.3)'
        }} />
      </button>
    </div>
  );

  const ActionButton = ({ onClick, icon, label, active, shortcut }) => (
    <button
      onClick={onClick}
      title={shortcut ? `${label} (${shortcut})` : label}
      style={{
        background: active ? 'rgba(14, 165, 233, 0.2)' : 'rgba(30, 41, 59, 0.9)',
        border: `1px solid ${active ? 'rgba(14, 165, 233, 0.4)' : 'rgba(71, 85, 105, 0.4)'}`,
        borderRadius: '6px',
        padding: '8px 12px',
        color: active ? '#38bdf8' : '#e2e8f0',
        fontSize: '12px',
        fontWeight: '500',
        cursor: 'pointer',
        display: 'flex',
        alignItems: 'center',
        gap: '6px',
        backdropFilter: 'blur(8px)',
        transition: 'all 0.15s ease',
        whiteSpace: 'nowrap'
      }}
    >
      {icon}
      <span className="btn-label">{label}</span>
    </button>
  );

  return (
    <div style={{ width: '100%', height: '100vh', background: '#0a0a0a', position: 'relative', overflow: 'hidden' }}>
      <canvas 
        ref={canvasRef} 
        style={{ 
          width: '100%', 
          height: '100%', 
          display: 'block', 
          cursor: 'crosshair',
          // --- ADDED TOUCH ACTION FOR MOBILE ---
          touchAction: 'none' 
        }} 
      />
      
      {/* FPS Counter */}
      {showFPS && (
        <div style={{
          position: 'absolute',
          top: '12px',
          left: '50%',
          transform: 'translateX(-50%)',
          background: 'rgba(15, 23, 42, 0.8)',
          border: '1px solid rgba(51, 65, 85, 0.4)',
          borderRadius: '4px',
          padding: '4px 10px',
          fontSize: '11px',
          fontFamily: 'monospace',
          color: fps >= 50 ? '#4ade80' : fps >= 30 ? '#fbbf24' : '#f87171',
          backdropFilter: 'blur(8px)'
        }}>
          {fps} FPS
        </div>
      )}

      {/* Top Bar */}
      <div style={{
        position: 'absolute',
        top: '0',
        left: '0',
        right: '0',
        padding: '12px 16px',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        background: 'linear-gradient(to bottom, rgba(10,10,10,0.8) 0%, transparent 100%)',
        pointerEvents: 'none'
      }}>
        <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', pointerEvents: 'auto' }}>
          <ActionButton onClick={handleRandomSplat} shortcut="R" label="Splat" icon={
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 2.69l5.66 5.66a8 8 0 1 1-11.31 0z"/>
            </svg>
          } />
          <ActionButton onClick={() => setConfig(prev => ({ ...prev, PAUSED: !prev.PAUSED }))} active={config.PAUSED} shortcut="Space" label={config.PAUSED ? 'Play' : 'Pause'} icon={
            config.PAUSED ? (
              <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><polygon points="5 3 19 12 5 21 5 3"/></svg>
            ) : (
              <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><rect x="6" y="4" width="4" height="16"/><rect x="14" y="4" width="4" height="16"/></svg>
            )
          } />
          <ActionButton onClick={handleClear} shortcut="C" label="Clear" icon={
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M3 6h18M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"/>
            </svg>
          } />
          <ActionButton onClick={() => setAutoSplat(prev => !prev)} active={autoSplat} shortcut="A" label="Auto" icon={
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83"/>
            </svg>
          } />
          <ActionButton onClick={handleScreenshot} shortcut="Ctrl+S" label="Save" icon={
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M7 10l5 5 5-5M12 15V3"/>
            </svg>
          } />
        </div>
        <button
          onClick={() => setShowControls(!showControls)}
          style={{
            background: showControls ? 'rgba(14, 165, 233, 0.2)' : 'rgba(30, 41, 59, 0.9)',
            border: `1px solid ${showControls ? 'rgba(14, 165, 233, 0.4)' : 'rgba(71, 85, 105, 0.4)'}`,
            borderRadius: '6px',
            padding: '8px 14px',
            color: showControls ? '#38bdf8' : '#e2e8f0',
            fontSize: '12px',
            fontWeight: '500',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
            backdropFilter: 'blur(8px)',
            pointerEvents: 'auto',
            transition: 'all 0.15s ease'
          }}
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"/>
          </svg>
          Settings
        </button>
      </div>

      {/* Settings Panel */}
      {showControls && (
        <div style={{
          position: 'absolute',
          top: '60px',
          right: '16px',
          background: 'rgba(15, 23, 42, 0.95)',
          border: '1px solid rgba(51, 65, 85, 0.5)',
          borderRadius: '12px',
          padding: '16px',
          color: '#f8f8f8',
          width: '300px',
          maxHeight: 'calc(100vh - 100px)',
          overflowY: 'auto',
          backdropFilter: 'blur(16px)',
          boxShadow: '0 20px 40px rgba(0,0,0,0.5)'
        }}>
          {/* Presets */}
          <div style={{ marginBottom: '16px' }}>
            <h4 style={{ margin: '0 0 10px 0', fontSize: '11px', fontWeight: '600', color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Presets</h4>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
              {Object.entries(PRESETS).map(([key, preset]) => (
                <button
                  key={key}
                  onClick={() => applyPreset(key)}
                  style={{
                    background: 'rgba(30, 41, 59, 0.8)',
                    border: '1px solid rgba(71, 85, 105, 0.4)',
                    borderRadius: '4px',
                    padding: '5px 10px',
                    color: '#cbd5e1',
                    fontSize: '11px',
                    cursor: 'pointer',
                    transition: 'all 0.15s ease'
                  }}
                >
                  {preset.name}
                </button>
              ))}
            </div>
          </div>

          {/* Color Palette */}
          <div style={{ marginBottom: '16px', paddingTop: '12px', borderTop: '1px solid rgba(51, 65, 85, 0.4)' }}>
            <h4 style={{ margin: '0 0 10px 0', fontSize: '11px', fontWeight: '600', color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Color Palette</h4>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
              {Object.entries(COLOR_PALETTES).map(([key, palette]) => (
                <button
                  key={key}
                  onClick={() => setColorPalette(key)}
                  style={{
                    background: colorPalette === key ? 'rgba(14, 165, 233, 0.2)' : 'rgba(30, 41, 59, 0.8)',
                    border: `1px solid ${colorPalette === key ? 'rgba(14, 165, 233, 0.5)' : 'rgba(71, 85, 105, 0.4)'}`,
                    borderRadius: '4px',
                    padding: '5px 10px',
                    color: colorPalette === key ? '#38bdf8' : '#cbd5e1',
                    fontSize: '11px',
                    cursor: 'pointer',
                    transition: 'all 0.15s ease'
                  }}
                >
                  {palette.name}
                </button>
              ))}
            </div>
          </div>

          {/* Quality */}
          <div style={{ marginBottom: '16px', paddingTop: '12px', borderTop: '1px solid rgba(51, 65, 85, 0.4)' }}>
            <h4 style={{ margin: '0 0 10px 0', fontSize: '11px', fontWeight: '600', color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Quality</h4>
            <SliderControl label="Sim Resolution" value={config.SIM_RESOLUTION} min={32} max={256} step={16} onChange={(v) => updateConfig('SIM_RESOLUTION', v)} />
            <SliderControl label="Dye Resolution" value={config.DYE_RESOLUTION} min={128} max={2048} step={128} onChange={(v) => updateConfig('DYE_RESOLUTION', v)} />
          </div>

          {/* Behavior */}
          <div style={{ marginBottom: '16px', paddingTop: '12px', borderTop: '1px solid rgba(51, 65, 85, 0.4)' }}>
            <h4 style={{ margin: '0 0 10px 0', fontSize: '11px', fontWeight: '600', color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Behavior</h4>
            <SliderControl label="Density Dissipation" value={config.DENSITY_DISSIPATION} min={0} max={4} step={0.1} decimals={1} onChange={(v) => updateConfig('DENSITY_DISSIPATION', v)} />
            <SliderControl label="Velocity Dissipation" value={config.VELOCITY_DISSIPATION} min={0} max={4} step={0.1} decimals={1} onChange={(v) => updateConfig('VELOCITY_DISSIPATION', v)} />
            <SliderControl label="Pressure" value={config.PRESSURE} min={0} max={1} step={0.05} decimals={2} onChange={(v) => updateConfig('PRESSURE', v)} />
            <SliderControl label="Vorticity (Curl)" value={config.CURL} min={0} max={50} step={1} onChange={(v) => updateConfig('CURL', v)} />
          </div>

          {/* Splat */}
          <div style={{ marginBottom: '16px', paddingTop: '12px', borderTop: '1px solid rgba(51, 65, 85, 0.4)' }}>
            <h4 style={{ margin: '0 0 10px 0', fontSize: '11px', fontWeight: '600', color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Splat</h4>
            <SliderControl label="Splat Radius" value={config.SPLAT_RADIUS} min={0.01} max={1} step={0.01} decimals={2} onChange={(v) => updateConfig('SPLAT_RADIUS', v)} />
            <SliderControl label="Splat Force" value={config.SPLAT_FORCE} min={1000} max={10000} step={500} onChange={(v) => updateConfig('SPLAT_FORCE', v)} />
          </div>

          {/* Effects */}
          <div style={{ marginBottom: '16px', paddingTop: '12px', borderTop: '1px solid rgba(51, 65, 85, 0.4)' }}>
            <h4 style={{ margin: '0 0 10px 0', fontSize: '11px', fontWeight: '600', color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Visual Effects</h4>
            <ToggleControl label="Shading" value={config.SHADING} onChange={() => updateConfig('SHADING', !config.SHADING)} />
            <ToggleControl label="Colorful Mode" value={config.COLORFUL} onChange={() => updateConfig('COLORFUL', !config.COLORFUL)} />
            <ToggleControl label="Bloom" value={config.BLOOM} onChange={() => updateConfig('BLOOM', !config.BLOOM)} />
            {config.BLOOM && (
              <>
                <SliderControl label="Bloom Intensity" value={config.BLOOM_INTENSITY} min={0.1} max={2} step={0.1} decimals={1} onChange={(v) => updateConfig('BLOOM_INTENSITY', v)} />
                <SliderControl label="Bloom Threshold" value={config.BLOOM_THRESHOLD} min={0} max={1} step={0.1} decimals={1} onChange={(v) => updateConfig('BLOOM_THRESHOLD', v)} />
              </>
            )}
            <ToggleControl label="Sunrays" value={config.SUNRAYS} onChange={() => updateConfig('SUNRAYS', !config.SUNRAYS)} />
            {config.SUNRAYS && (
              <SliderControl label="Sunrays Weight" value={config.SUNRAYS_WEIGHT} min={0.3} max={1} step={0.1} decimals={1} onChange={(v) => updateConfig('SUNRAYS_WEIGHT', v)} />
            )}
          </div>

          {/* Display */}
          <div style={{ marginBottom: '16px', paddingTop: '12px', borderTop: '1px solid rgba(51, 65, 85, 0.4)' }}>
            <h4 style={{ margin: '0 0 10px 0', fontSize: '11px', fontWeight: '600', color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Display</h4>
            <ToggleControl label="Show FPS" value={showFPS} onChange={() => setShowFPS(prev => !prev)} />
          </div>

          {/* Keyboard Shortcuts */}
          <div style={{
            padding: '12px',
            background: 'rgba(30, 41, 59, 0.5)',
            borderRadius: '8px',
            border: '1px solid rgba(51, 65, 85, 0.3)'
          }}>
            <h4 style={{ margin: '0 0 8px 0', fontSize: '11px', fontWeight: '600', color: '#64748b', textTransform: 'uppercase' }}>Keyboard Shortcuts</h4>
            <div style={{ fontSize: '11px', color: '#64748b', lineHeight: '1.8' }}>
              <div><kbd style={{ background: '#1e293b', padding: '2px 6px', borderRadius: '3px', marginRight: '8px', color: '#94a3b8' }}>Space</kbd> Pause/Play</div>
              <div><kbd style={{ background: '#1e293b', padding: '2px 6px', borderRadius: '3px', marginRight: '8px', color: '#94a3b8' }}>R</kbd> Random Splats</div>
              <div><kbd style={{ background: '#1e293b', padding: '2px 6px', borderRadius: '3px', marginRight: '8px', color: '#94a3b8' }}>C</kbd> Clear Canvas</div>
              <div><kbd style={{ background: '#1e293b', padding: '2px 6px', borderRadius: '3px', marginRight: '8px', color: '#94a3b8' }}>A</kbd> Auto-Splat Mode</div>
              <div><kbd style={{ background: '#1e293b', padding: '2px 6px', borderRadius: '3px', marginRight: '8px', color: '#94a3b8' }}>S</kbd> Toggle Settings</div>
              <div><kbd style={{ background: '#1e293b', padding: '2px 6px', borderRadius: '3px', marginRight: '8px', color: '#94a3b8' }}>F</kbd> Toggle FPS</div>
              <div><kbd style={{ background: '#1e293b', padding: '2px 6px', borderRadius: '3px', marginRight: '8px', color: '#94a3b8' }}>Ctrl+S</kbd> Screenshot</div>
            </div>
          </div>
        </div>
      )}

      {/* Footer */}
      <div style={{
        position: 'absolute',
        bottom: '12px',
        left: '16px',
        right: '16px',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        pointerEvents: 'none'
      }}>

      </div>
    </div>
  );
}

export default WebglFluidSimulation;