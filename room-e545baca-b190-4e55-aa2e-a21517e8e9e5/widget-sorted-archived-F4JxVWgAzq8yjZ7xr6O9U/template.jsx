import React, { useState, useEffect, useRef } from 'react';
import DiscoveryBox from './components/DiscoveryBox';
import ShuffleButton from './components/ShuffleButton';
import ConnectionLines from './components/ConnectionLines';
import GenrePage from './components/GenrePage';
import GenreNavigation from './components/GenreNavigation';
import SuggestPage from './components/SuggestPage';

export default function DiscoveryHub() {
  const [tailwindLoaded, setTailwindLoaded] = useState(false);
  const [hoveredBox, setHoveredBox] = useState(null);
  const [shuffleKey, setShuffleKey] = useState(0);
  const [currentView, setCurrentView] = useState('genre'); // Always on genre page
  const [selectedGenre, setSelectedGenre] = useState('all'); // Start with all genre
  const [showIntro, setShowIntro] = useState(false);
  const [introStep, setIntroStep] = useState(0);
  const containerRef = useRef(null);

  // Discovery links organized by genre - removed sites that refuse iframe
  const discoveryLinks = {
    music: [
      { 
        url: 'https://radio.garden/listen/smooth-jazz-24-7/1vlrqH6v', 
        title: 'Radio Garden',
        description: 'Explore live radio stations from around the world'
      },
      { 
        url: 'https://musiclab.chromeexperiments.com/Kandinsky/', 
        title: 'Kandinsky Music Lab',
        description: 'Paint with sound - visual music creation experiment'
      },
      { 
        url: 'https://musiclab.chromeexperiments.com/Sound-Waves/', 
        title: 'Sound Waves Lab',
        description: 'Visualize and learn about sound waves interactively'
      },
      { 
        url: 'https://musiclab.chromeexperiments.com/Piano-Roll/', 
        title: 'Piano Roll',
        description: 'Create melodies with an interactive piano sequencer'
      },
      { 
        url: 'https://music.ishkur.com/', 
        title: 'Ishkur\'s Guide to Electronic Music',
        description: 'Comprehensive history of electronic music genres'
      },
      { 
        url: 'https://www.music-map.com/', 
        title: 'Music Map',
        description: 'Discover similar artists and explore music connections'
      },
    ],
    art: [
      { 
        url: 'https://jspaint.app/', 
        title: 'JS Paint',
        description: 'Classic MS Paint recreated in the browser'
      },
      { 
        url: 'https://atomanimation.com/', 
        title: 'Atom Animation',
        description: 'Mesmerizing molecular structure animations'
      },
      { 
        url: 'https://pointerpointer.com/', 
        title: 'Pointer Pointer',
        description: 'Artistic cursor-tracking photography project'
      },
      { 
        url: 'https://walzr.com/IMG_0001', 
        title: 'Walzr',
        description: 'Unique photo gallery presentation'
      },
      { 
        url: 'https://musiclab.chromeexperiments.com/Kandinsky/', 
        title: 'Kandinsky Music Lab',
        description: 'Paint with sound - visual music creation'
      },
      { 
        url: 'https://film-grab.com/', 
        title: 'Film Grab',
        description: 'High-quality screenshots from beautiful films'
      },
      { 
        url: 'https://thenounproject.com/', 
        title: 'The Noun Project',
        description: 'Icons and symbols for every concept'
      },
      { 
        url: 'https://bongo.cat/', 
        title: 'Bongo Cat',
        description: 'Make music with an adorable typing cat'
      },
    ],
    learn: [
      { 
        url: 'https://www.typelit.io/', 
        title: 'TypeLit',
        description: 'Learn touch typing by retyping classic literature'
      },
      { 
        url: 'https://www.typelit.io/chapters/1984', 
        title: 'Type 1984',
        description: 'Type out George Orwell\'s dystopian masterpiece'
      },
      { 
        url: 'https://www.metafilter.com/', 
        title: 'MetaFilter',
        description: 'Community weblog and discussion site since 1999'
      },
      { 
        url: 'https://www.gutenberg.org/', 
        title: 'Project Gutenberg',
        description: 'Over 70,000 free ebooks in the public domain'
      },
      { 
        url: 'https://tosdr.org/en', 
        title: 'Terms of Service; Didn\'t Read',
        description: 'Privacy policies and terms simplified and rated'
      },
      { 
        url: 'https://sciphilos.info/', 
        title: 'Science & Philosophy',
        description: 'Explore connections between science and philosophy'
      },
    ],
    games: [
      { 
        url: 'https://pointerpointer.com/', 
        title: 'Pointer Pointer',
        description: 'Interactive cursor-pointing experience'
      },
      { 
        url: 'https://bongo.cat/', 
        title: 'Bongo Cat',
        description: 'Play music by typing or clicking'
      },
    ],
    science: [
      { 
        url: 'https://explore.org/livecams/oceans/shark-lagoon-cam', 
        title: 'Live Shark Cam',
        description: 'Watch sharks swimming in real-time'
      },
      { 
        url: 'https://explore.org/livecams/currently-live/wolf-cam-1', 
        title: 'Live Wolf Cam',
        description: 'Observe wolves in their natural habitat'
      },
      { 
        url: 'https://www.desmos.com/calculator', 
        title: 'Desmos Calculator',
        description: 'Advanced online graphing calculator for math'
      },
      { 
        url: 'https://archive.org/', 
        title: 'Internet Archive',
        description: 'Digital library of websites, books, and media'
      },
      { 
        url: 'https://earth.nullschool.net/', 
        title: 'Earth Wind Map',
        description: 'Real-time visualization of global weather patterns'
      },
      { 
        url: 'https://www.earthcam.com/', 
        title: 'EarthCam',
        description: 'Live webcams from locations around the world'
      },
    ],
    create: [
      { 
        url: 'https://jspaint.app/', 
        title: 'JS Paint',
        description: 'Create pixel art and digital paintings'
      },
      { 
        url: 'https://atomanimation.com/', 
        title: 'Atom Animation',
        description: 'Explore and create molecular visualizations'
      },
      { 
        url: 'https://musiclab.chromeexperiments.com/Kandinsky/', 
        title: 'Kandinsky Music Lab',
        description: 'Paint with sound - create visual music'
      },
      { 
        url: 'https://musiclab.chromeexperiments.com/Piano-Roll/', 
        title: 'Piano Roll',
        description: 'Compose music with an interactive sequencer'
      },
      { 
        url: 'https://www.desmos.com/calculator', 
        title: 'Desmos Calculator',
        description: 'Create mathematical art and visualizations'
      },
    ],
  };

  // "All" genre contains everything
  discoveryLinks.all = [
    ...discoveryLinks.music,
    ...discoveryLinks.art,
    ...discoveryLinks.learn,
    ...discoveryLinks.games,
    ...discoveryLinks.science,
    ...discoveryLinks.create,
  ];

  // Get random links for the discovery boxes
  const getRandomDiscoveries = () => {
    const allLinks = Object.values(discoveryLinks).flat();
    const shuffled = [...allLinks].sort(() => Math.random() - 0.5);
    return shuffled.slice(0, 6);
  };

  const [randomDiscoveries] = useState(getRandomDiscoveries());

  // Load Tailwind CSS and retro fonts
  useEffect(() => {
    // Load VT323 and Press Start 2P fonts
    if (!document.getElementById('retro-font')) {
      const fontLink = document.createElement('link');
      fontLink.id = 'retro-font';
      fontLink.href = 'https://fonts.googleapis.com/css2?family=VT323&family=Press+Start+2P&display=swap';
      fontLink.rel = 'stylesheet';
      document.head.appendChild(fontLink);
    }

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

    // Check if user has seen intro
    const hasSeenIntro = localStorage.getItem('discoveryHubIntroSeen');
    if (!hasSeenIntro) {
      setTimeout(() => setShowIntro(true), 1000);
    }
  }, []);

  // Apply full-page dark background
  useEffect(() => {
    document.body.style.background = '#0a0a12';
    document.documentElement.style.minHeight = '100%';
    return () => {
      document.body.style.background = '';
      document.documentElement.style.minHeight = '';
    };
  }, []);

  // Genre gateways with neon colors (ALL is now red) - No hub needed
  const genres = [
    { id: 'all', label: 'ALL', color: '#FF3300' },
    { id: 'music', label: 'MUSIC', color: '#39FF14' },
    { id: 'art', label: 'ART', color: '#FF2DFF' },
    { id: 'learn', label: 'LEARN', color: '#FFD400' },
    { id: 'games', label: 'GAMES', color: '#00A2FF' },
    { id: 'science', label: 'SCIENCE', color: '#00FFFF' },
    { id: 'create', label: 'CREATE', color: '#FF6B00' },
  ];

  // Random discovery boxes (6 larger boxes for showing previews)
  const randomBoxCount = 6;
  const randomBoxes = Array.from({ length: randomBoxCount }, (_, i) => ({
    id: `random-${i}`,
    type: 'random',
  }));

  // Handle genre click
  const handleGenreClick = (genreId) => {
    setSelectedGenre(genreId);
    setCurrentView('genre');
  };

  // Handle genre change from navigation
  const handleGenreChange = (genreId) => {
    setSelectedGenre(genreId);
    if (genreId === 'suggest') {
      setCurrentView('suggest');
    } else {
      setCurrentView('genre');
    }
  };

  // Handle random box click
  const handleRandomBoxClick = (index) => {
    const link = randomDiscoveries[index];
    if (link) {
      window.open(link.url, '_blank');
    }
  };

  const handleIntroNext = () => {
    if (introStep < 2) {
      setIntroStep(introStep + 1);
    } else {
      localStorage.setItem('discoveryHubIntroSeen', 'true');
      setShowIntro(false);
      setIntroStep(0);
    }
  };

  const handleIntroSkip = () => {
    localStorage.setItem('discoveryHubIntroSeen', 'true');
    setShowIntro(false);
    setIntroStep(0);
  };

  // Shuffle all boxes
  const handleShuffle = () => {
    setShuffleKey(prev => prev + 1);
  };

  // Handle back - no hub anymore, just stay on genre view
  const handleBack = () => {
    // No hub to go back to
  };

  // Calculate positions for boxes in a web/radial pattern
  const getBoxPositions = () => {
    const centerX = 50; // center percentage
    const centerY = 50;
    const innerRadius = 25; // percentage from center for genre boxes
    const outerRadius = 42; // percentage from center for random boxes

    const positions = [];

    // Center "Explore" position
    positions.push({
      id: 'center',
      x: centerX,
      y: centerY,
      type: 'center',
    });

    // Genre boxes in inner circle
    genres.forEach((genre, index) => {
      const angle = (index / genres.length) * Math.PI * 2 - Math.PI / 2;
      positions.push({
        ...genre,
        x: centerX + Math.cos(angle) * innerRadius,
        y: centerY + Math.sin(angle) * innerRadius,
        type: 'genre',
      });
    });

    // Random boxes in outer circle
    randomBoxes.forEach((box, index) => {
      const angle = (index / randomBoxCount) * Math.PI * 2 - Math.PI / 2;
      const radiusVariation = (Math.sin(index * 2.3 + shuffleKey) * 3); // Slight variation for organic feel
      positions.push({
        ...box,
        x: centerX + Math.cos(angle) * (outerRadius + radiusVariation),
        y: centerY + Math.sin(angle) * (outerRadius + radiusVariation),
        type: 'random',
      });
    });

    return positions;
  };

  const positions = getBoxPositions();

  if (!tailwindLoaded) {
    return (
      <div style={{ 
        padding: '20px', 
        textAlign: 'center', 
        fontFamily: 'VT323, monospace',
        fontSize: '24px',
        color: '#39FF14',
        background: '#0a0a12',
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
      }}>
        LOADING...
      </div>
    );
  }

  return (
    <div 
      className="relative w-full min-h-screen overflow-hidden"
      style={{ 
        fontFamily: 'VT323, monospace',
        background: '#0a0a12',
      }}
    >
      {/* Animated starfield background */}
      <div 
        className="absolute inset-0 pointer-events-none"
        style={{
          background: `
            radial-gradient(1px 1px at 20px 30px, #fff, transparent),
            radial-gradient(1px 1px at 40px 70px, rgba(255,255,255,0.8), transparent),
            radial-gradient(1px 1px at 50px 160px, rgba(255,255,255,0.6), transparent),
            radial-gradient(1px 1px at 90px 40px, #39FF14, transparent),
            radial-gradient(1px 1px at 130px 80px, rgba(255,255,255,0.7), transparent),
            radial-gradient(1.5px 1.5px at 160px 120px, #FF2DFF, transparent),
            radial-gradient(1px 1px at 200px 50px, rgba(255,255,255,0.5), transparent),
            radial-gradient(1px 1px at 20px 130px, rgba(255,255,255,0.9), transparent),
            radial-gradient(1px 1px at 100px 180px, #00A2FF, transparent),
            radial-gradient(1.5px 1.5px at 180px 20px, #FFD400, transparent),
            radial-gradient(1px 1px at 60px 100px, rgba(255,255,255,0.6), transparent),
            radial-gradient(1px 1px at 140px 160px, rgba(255,255,255,0.8), transparent),
            radial-gradient(1px 1px at 80px 190px, #FF3300, transparent),
            radial-gradient(1px 1px at 220px 140px, rgba(255,255,255,0.7), transparent),
            radial-gradient(1px 1px at 170px 90px, rgba(255,255,255,0.5), transparent),
            radial-gradient(1px 1px at 30px 200px, #00FFFF, transparent),
            radial-gradient(1px 1px at 110px 30px, rgba(255,255,255,0.9), transparent),
            radial-gradient(1px 1px at 240px 180px, rgba(255,255,255,0.6), transparent)
          `,
          backgroundSize: '250px 220px',
          animation: 'twinkle 8s ease-in-out infinite',
        }}
      />

      {/* Secondary star layer */}
      <div 
        className="absolute inset-0 pointer-events-none"
        style={{
          background: `
            radial-gradient(1px 1px at 15px 45px, rgba(255,255,255,0.4), transparent),
            radial-gradient(1px 1px at 55px 15px, rgba(255,255,255,0.3), transparent),
            radial-gradient(1px 1px at 95px 125px, rgba(255,255,255,0.5), transparent),
            radial-gradient(1px 1px at 145px 35px, rgba(255,255,255,0.4), transparent),
            radial-gradient(1px 1px at 185px 165px, rgba(255,255,255,0.3), transparent),
            radial-gradient(1px 1px at 25px 175px, rgba(255,255,255,0.5), transparent),
            radial-gradient(1px 1px at 75px 55px, rgba(255,255,255,0.4), transparent),
            radial-gradient(1px 1px at 125px 95px, rgba(255,255,255,0.3), transparent),
            radial-gradient(1px 1px at 165px 145px, rgba(255,255,255,0.5), transparent),
            radial-gradient(1px 1px at 205px 65px, rgba(255,255,255,0.4), transparent)
          `,
          backgroundSize: '220px 200px',
          backgroundPosition: '10px 10px',
        }}
      />

      {/* CRT scanline overlay - REMOVED */}

      {/* Noise texture overlay */}
      <div 
        className="absolute inset-0 pointer-events-none"
        style={{
          backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noiseFilter'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noiseFilter)'/%3E%3C/svg%3E")`,
          opacity: 0.03,
          zIndex: 101,
        }}
      />

      {/* Vignette effect */}
      <div 
        className="absolute inset-0 pointer-events-none"
        style={{
          background: 'radial-gradient(ellipse at center, transparent 0%, transparent 50%, rgba(0,0,0,0.4) 100%)',
          zIndex: 99,
        }}
      />

      {/* Genre Page View - Only view now */}
      <div 
        className="absolute inset-0"
        style={{
          zIndex: 50,
        }}
      >
        {/* Genre Navigation Bar */}
        <GenreNavigation 
          currentGenre={selectedGenre}
          onGenreChange={handleGenreChange}
        />

        {currentView === 'suggest' ? (
          <SuggestPage isActive={true} />
        ) : (
          <GenrePage 
            selectedGenre={selectedGenre}
            onBack={handleBack}
            isActive={true}
            links={discoveryLinks[selectedGenre] || []}
          />
        )}
      </div>

      {/* Intro Modal */}
      {showIntro && (
        <div 
          className="fixed inset-0 flex items-center justify-center"
          style={{ 
            zIndex: 200,
            background: 'rgba(0,0,0,0.9)',
          }}
        >
          <div 
            className="max-w-2xl w-full mx-8 relative"
            style={{
              background: 'linear-gradient(180deg, #1a1a2e 0%, #0f0f1a 100%)',
              border: '4px solid',
              borderColor: '#3a3a5a #0a0a12 #0a0a12 #3a3a5a',
              boxShadow: 'inset 3px 3px 0 #4a4a6a, inset -3px -3px 0 #08080f, 0 0 40px #FF330030',
              padding: '40px',
            }}
          >
            {/* Top bar */}
            <div 
              className="absolute top-0 left-0 right-0 h-2"
              style={{ 
                backgroundColor: '#FF3300',
                boxShadow: '0 0 15px #FF3300',
              }}
            />

            {/* Big emoji/icon */}
            <div 
              className="text-center mb-6"
              style={{
                fontSize: '64px',
                filter: 'drop-shadow(0 0 20px #FF3300)',
              }}
            >
              {introStep === 0 && '\u{1F680}'}
              {introStep === 1 && '\u{1F3AE}'}
              {introStep === 2 && '\u{2728}'}
            </div>

            {/* Title */}
            <h2 
              className="text-center mb-6"
              style={{
                fontFamily: '"Press Start 2P", monospace',
                fontSize: '18px',
                color: '#FF3300',
                textShadow: '0 0 15px #FF3300',
                letterSpacing: '2px',
              }}
            >
              {introStep === 0 && 'WELCOME EXPLORER'}
              {introStep === 1 && 'HOW IT WORKS'}
              {introStep === 2 && 'READY TO DIVE IN?'}
            </h2>

            {/* Content */}
            <div 
              className="mb-8"
              style={{
                fontFamily: 'VT323, monospace',
                fontSize: '22px',
                color: '#ccc',
                lineHeight: '1.6',
              }}
            >
              {introStep === 0 && (
                <>
                  <p className="mb-4 text-center" style={{ fontSize: '24px' }}>
                    Your portal to the <span style={{ color: '#39FF14' }}>coolest corners</span> of the internet
                  </p>
                  <p className="text-center" style={{ color: '#888' }}>
                    Curated websites across music, art, science, games & more
                  </p>
                </>
              )}
              {introStep === 1 && (
                <>
                  <div className="space-y-4">
                    <div className="flex items-start gap-3">
                      <div style={{ color: '#39FF14', fontSize: '28px', minWidth: '32px' }}>1</div>
                      <div>
                        <div style={{ color: '#39FF14', marginBottom: '4px' }}>Pick a genre from the tabs above</div>
                        <div style={{ color: '#888', fontSize: '18px' }}>ALL • MUSIC • ART • LEARN • GAMES • SCIENCE • CREATE</div>
                      </div>
                    </div>
                    
                    <div className="flex items-start gap-3">
                      <div style={{ color: '#FF2DFF', fontSize: '28px', minWidth: '32px' }}>2</div>
                      <div>
                        <div style={{ color: '#FF2DFF', marginBottom: '4px' }}>Scroll through curated websites</div>
                        <div style={{ color: '#888', fontSize: '18px' }}>Each one is handpicked & interesting</div>
                      </div>
                    </div>
                    
                    <div className="flex items-start gap-3">
                      <div style={{ color: '#FFD400', fontSize: '28px', minWidth: '32px' }}>3</div>
                      <div>
                        <div style={{ color: '#FFD400', marginBottom: '4px' }}>Click to explore in full screen</div>
                        <div style={{ color: '#888', fontSize: '18px' }}>Found a gem? Share it with us!</div>
                      </div>
                    </div>
                  </div>
                </>
              )}
              {introStep === 2 && (
                <>
                  <p className="mb-6 text-center" style={{ fontSize: '24px', color: '#39FF14' }}>
                    That's it! Simple & fun {'\u{1F389}'}
                  </p>
                  <p className="text-center mb-4" style={{ fontSize: '20px' }}>
                    Start with <span style={{ color: '#FF3300' }}>ALL</span> to see everything
                  </p>
                  <p className="text-center" style={{ color: '#888' }}>
                    or pick a genre that interests you
                  </p>
                </>
              )}
            </div>

            {/* Progress dots */}
            <div className="flex justify-center gap-3 mb-8">
              {[0, 1, 2].map((i) => (
                <div
                  key={i}
                  className="w-3 h-3"
                  style={{
                    backgroundColor: i === introStep ? '#FF3300' : '#2a2a4a',
                    boxShadow: i === introStep ? '0 0 8px #FF3300' : 'none',
                    border: '1px solid',
                    borderColor: i === introStep ? '#FF3300' : '#3a3a5a',
                  }}
                />
              ))}
            </div>

            {/* Buttons */}
            <div className="flex justify-between gap-4">
              <button
                onClick={handleIntroSkip}
                className="px-6 py-2"
                style={{
                  fontFamily: 'VT323, monospace',
                  fontSize: '18px',
                  background: 'linear-gradient(180deg, #1e1e35 0%, #12121f 100%)',
                  border: '2px solid',
                  borderColor: '#3a3a5a #0a0a12 #0a0a12 #3a3a5a',
                  boxShadow: 'inset 1px 1px 0 #4a4a6a',
                  color: '#888',
                  cursor: 'pointer',
                }}
              >
                [SKIP]
              </button>
              <button
                onClick={handleIntroNext}
                className="px-6 py-2"
                style={{
                  fontFamily: 'VT323, monospace',
                  fontSize: '18px',
                  background: 'linear-gradient(180deg, #2e2e45 0%, #1e1e30 100%)',
                  border: '2px solid',
                  borderColor: '#4a4a6a #1a1a22 #1a1a22 #4a4a6a',
                  boxShadow: 'inset 1px 1px 0 #5a5a7a, 0 0 10px #FF330040',
                  color: '#FF3300',
                  textShadow: '0 0 8px #FF3300',
                  cursor: 'pointer',
                }}
              >
                {introStep === 2 ? '[START EXPLORING]' : '[NEXT]'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* CSS animations */}
      <style>{`
        @keyframes twinkle {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.7; }
        }
        @keyframes pulse-glow {
          0%, 100% { box-shadow: 0 0 5px currentColor, 0 0 10px currentColor; }
          50% { box-shadow: 0 0 15px currentColor, 0 0 25px currentColor; }
        }
        @keyframes radar-sweep {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }
        @keyframes blink {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.3; }
        }
      `}</style>
    </div>
  );
}
