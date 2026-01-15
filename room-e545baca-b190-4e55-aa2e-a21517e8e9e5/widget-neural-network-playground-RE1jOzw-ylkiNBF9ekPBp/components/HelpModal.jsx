import React from 'react';

function HelpModal({ isOpen, onClose, darkMode }) {
  if (!isOpen) return null;
  
  return (
    <div 
      className="fixed inset-0 flex items-center justify-center z-[100]"
      style={{ 
        backgroundColor: darkMode ? 'rgba(15, 23, 42, 0.9)' : 'rgba(255, 255, 255, 0.9)',
        backdropFilter: 'blur(8px)' 
      }}
      onClick={onClose}
    >
      <div 
        className="rounded-3xl max-w-4xl max-h-[90vh] overflow-y-auto"
        style={{ 
          boxShadow: darkMode ? '0 25px 60px rgba(0, 0, 0, 0.5)' : '0 25px 60px rgba(0, 0, 0, 0.08)',
          width: '90%',
          backgroundColor: darkMode ? '#1e293b' : '#ffffff',
          border: darkMode ? '1px solid #334155' : '1px solid #f0f0f0'
        }}
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="sticky top-0 backdrop-blur-sm px-10 py-8 flex items-center justify-between z-10" style={{ 
          backgroundColor: darkMode ? 'rgba(30, 41, 59, 0.95)' : 'rgba(255, 255, 255, 0.95)',
          borderBottom: darkMode ? '1px solid #334155' : '1px solid #e5e7eb'
        }}>
          <div>
            <h2 className="text-3xl font-bold tracking-tight" style={{ color: darkMode ? '#f1f5f9' : '#111827' }}>
              Neural Network Playground
            </h2>
            <p className="font-light mt-1 text-lg" style={{ color: darkMode ? '#94a3b8' : '#6b7280' }}>
              Learn by experimenting.
            </p>
          </div>
          <button
            onClick={onClose}
            className="w-10 h-10 rounded-full flex items-center justify-center transition-colors"
            style={{ 
              color: darkMode ? '#94a3b8' : '#9ca3af'
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.backgroundColor = darkMode ? '#334155' : '#f9fafb';
              e.currentTarget.style.color = darkMode ? '#e2e8f0' : '#374151';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = 'transparent';
              e.currentTarget.style.color = darkMode ? '#94a3b8' : '#9ca3af';
            }}
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
        
        {/* Content */}
        <div className="px-10 py-10 space-y-16">
          
          {/* Main Intro */}
          <section className="space-y-6">
            <h3 className="text-2xl font-bold" style={{ color: darkMode ? '#f1f5f9' : '#111827' }}>Quick Start</h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
              <div className="space-y-3">
                <div className="w-10 h-10 rounded-xl flex items-center justify-center font-bold text-lg" style={{ 
                  backgroundColor: darkMode ? '#312e81' : '#eef2ff',
                  color: darkMode ? '#a5b4fc' : '#6366f1'
                }}>1</div>
                <h4 className="font-bold" style={{ color: darkMode ? '#f1f5f9' : '#111827' }}>Pick a Dataset</h4>
                <p className="leading-relaxed text-sm" style={{ color: darkMode ? '#94a3b8' : '#4b5563' }}>
                  Choose a shape on the left (like Circles or Spirals). This creates a pattern of blue and orange dots.
                </p>
              </div>
              <div className="space-y-3">
                <div className="w-10 h-10 rounded-xl flex items-center justify-center font-bold text-lg" style={{ 
                  backgroundColor: darkMode ? '#312e81' : '#eef2ff',
                  color: darkMode ? '#a5b4fc' : '#6366f1'
                }}>2</div>
                <h4 className="font-bold" style={{ color: darkMode ? '#f1f5f9' : '#111827' }}>Design the Brain</h4>
                <p className="leading-relaxed text-sm" style={{ color: darkMode ? '#94a3b8' : '#4b5563' }}>
                  Toggle features and adjust layers. More complexity helps with harder patterns but trains slower.
                </p>
              </div>
              <div className="space-y-3">
                <div className="w-10 h-10 rounded-xl flex items-center justify-center font-bold text-lg" style={{ 
                  backgroundColor: darkMode ? '#312e81' : '#eef2ff',
                  color: darkMode ? '#a5b4fc' : '#6366f1'
                }}>3</div>
                <h4 className="font-bold" style={{ color: darkMode ? '#f1f5f9' : '#111827' }}>Press Train</h4>
                <p className="leading-relaxed text-sm" style={{ color: darkMode ? '#94a3b8' : '#4b5563' }}>
                  Watch the network learn in real-time. The background colors show where it thinks each dot type belongs.
                </p>
              </div>
            </div>
          </section>
          
          <hr style={{ borderColor: darkMode ? '#334155' : '#e5e7eb' }} />
          
          {/* Concept Explanation */}
          <section className="space-y-6">
            <h3 className="text-2xl font-bold" style={{ color: darkMode ? '#f1f5f9' : '#111827' }}>Understanding the Map</h3>
            <div className="rounded-3xl p-8 space-y-6" style={{ backgroundColor: darkMode ? '#0f172a' : 'rgba(249, 250, 251, 0.5)' }}>
              <p className="leading-relaxed text-base" style={{ color: darkMode ? '#cbd5e1' : '#374151' }}>
                The network is learning to classify points. It paints a map showing where it expects to find blue dots versus orange dots.
              </p>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="p-6 rounded-2xl shadow-sm" style={{ 
                  backgroundColor: darkMode ? '#1e293b' : '#ffffff',
                  border: darkMode ? '1px solid #334155' : '1px solid #e5e7eb'
                }}>
                  <h4 className="font-bold mb-2 flex items-center gap-2" style={{ color: darkMode ? '#f1f5f9' : '#111827' }}>
                    <span className="w-4 h-4 rounded-full bg-indigo-500"></span>
                    Blue Region
                  </h4>
                  <p className="text-sm leading-relaxed" style={{ color: darkMode ? '#94a3b8' : '#4b5563' }}>
                    The network is confident this area contains blue dots. The darker the blue, the more confident it is.
                  </p>
                </div>
                <div className="p-6 rounded-2xl shadow-sm" style={{ 
                  backgroundColor: darkMode ? '#1e293b' : '#ffffff',
                  border: darkMode ? '1px solid #334155' : '1px solid #e5e7eb'
                }}>
                  <h4 className="font-bold mb-2 flex items-center gap-2" style={{ color: darkMode ? '#f1f5f9' : '#111827' }}>
                    <span className="w-4 h-4 rounded-full bg-orange-500"></span>
                    Orange Region
                  </h4>
                  <p className="text-sm leading-relaxed" style={{ color: darkMode ? '#94a3b8' : '#4b5563' }}>
                    The network is confident this area contains orange dots. The darker the orange, the more confident.
                  </p>
                </div>
              </div>
              
              <p className="text-sm italic" style={{ color: darkMode ? '#94a3b8' : '#4b5563' }}>
                {darkMode ? 'Dark' : 'White or light'} areas = the network isn't sure yet. This is normal at the start!
              </p>
            </div>
          </section>
          
          <hr style={{ borderColor: darkMode ? '#334155' : '#e5e7eb' }} />
          
          {/* Interactive Features */}
          <section className="space-y-6">
            <h3 className="text-2xl font-bold" style={{ color: darkMode ? '#f1f5f9' : '#111827' }}>Pro Tip: Hover to Explore</h3>
            <div className="rounded-3xl p-8" style={{ backgroundColor: darkMode ? 'rgba(49, 46, 129, 0.2)' : 'rgba(238, 242, 255, 0.5)' }}>
              <p className="leading-relaxed text-base mb-4" style={{ color: darkMode ? '#cbd5e1' : '#374151' }}>
                Try hovering over the features and neurons! The map will change to show what that specific component "sees".
              </p>
              <ul className="space-y-3 text-sm" style={{ color: darkMode ? '#94a3b8' : '#4b5563' }}>
                <li className="flex gap-3">
                  <span className="font-bold" style={{ color: darkMode ? '#a5b4fc' : '#6366f1' }}>→</span>
                  <span><strong style={{ color: darkMode ? '#f1f5f9' : '#111827' }}>Hover a feature:</strong> See how that input (like X₁²) varies across space</span>
                </li>
                <li className="flex gap-3">
                  <span className="font-bold" style={{ color: darkMode ? '#a5b4fc' : '#6366f1' }}>→</span>
                  <span><strong style={{ color: darkMode ? '#f1f5f9' : '#111827' }}>Hover a neuron:</strong> See what pattern that specific neuron is detecting</span>
                </li>
              </ul>
            </div>
          </section>
          
          <hr style={{ borderColor: darkMode ? '#334155' : '#e5e7eb' }} />
          
          {/* Challenges */}
          <section className="space-y-6">
            <h3 className="text-2xl font-bold" style={{ color: darkMode ? '#f1f5f9' : '#111827' }}>Fun Challenges</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="group rounded-2xl p-6 hover:shadow-md transition-all cursor-default" style={{ 
                border: darkMode ? '1px solid #334155' : '1px solid #e5e7eb'
              }}>
                <h4 className="font-bold mb-2 transition-colors" style={{ 
                  color: darkMode ? '#f1f5f9' : '#111827'
                }}>The No-Hidden-Layer Challenge</h4>
                <p className="text-sm mb-3" style={{ color: darkMode ? '#94a3b8' : '#4b5563' }}>Can you solve the Circle dataset without any hidden layers?</p>
                <div className="text-xs inline-block px-3 py-1.5 rounded-lg" style={{ 
                  color: darkMode ? '#94a3b8' : '#4b5563',
                  backgroundColor: darkMode ? '#0f172a' : '#ffffff',
                  border: darkMode ? '1px solid #334155' : '1px solid #e5e7eb'
                }}>Hint: Enable X₁² and X₂² features</div>
              </div>
              
              <div className="group rounded-2xl p-6 hover:shadow-md transition-all cursor-default" style={{ 
                border: darkMode ? '1px solid #334155' : '1px solid #e5e7eb'
              }}>
                <h4 className="font-bold mb-2 transition-colors" style={{ 
                  color: darkMode ? '#f1f5f9' : '#111827'
                }}>XOR with Minimal Neurons</h4>
                <p className="text-sm mb-3" style={{ color: darkMode ? '#94a3b8' : '#4b5563' }}>Solve the XOR pattern using the fewest neurons possible.</p>
                <div className="text-xs inline-block px-3 py-1.5 rounded-lg" style={{ 
                  color: darkMode ? '#94a3b8' : '#4b5563',
                  backgroundColor: darkMode ? '#0f172a' : '#ffffff',
                  border: darkMode ? '1px solid #334155' : '1px solid #e5e7eb'
                }}>Hint: Try X₁X₂ feature or 1 layer with 2-4 neurons</div>
              </div>
              
              <div className="group rounded-2xl p-6 hover:shadow-md transition-all cursor-default" style={{ 
                border: darkMode ? '1px solid #334155' : '1px solid #e5e7eb'
              }}>
                <h4 className="font-bold mb-2 transition-colors" style={{ 
                  color: darkMode ? '#f1f5f9' : '#111827'
                }}>The Spiral Master</h4>
                <p className="text-sm mb-3" style={{ color: darkMode ? '#94a3b8' : '#4b5563' }}>This is the hardest pattern. Be patient!</p>
                <div className="text-xs inline-block px-3 py-1.5 rounded-lg" style={{ 
                  color: darkMode ? '#94a3b8' : '#4b5563',
                  backgroundColor: darkMode ? '#0f172a' : '#ffffff',
                  border: darkMode ? '1px solid #334155' : '1px solid #e5e7eb'
                }}>Hint: Use sin(X₁) and sin(X₂), wait 500+ steps</div>
              </div>
              
              <div className="group rounded-2xl p-6 hover:shadow-md transition-all cursor-default" style={{ 
                border: darkMode ? '1px solid #334155' : '1px solid #e5e7eb'
              }}>
                <h4 className="font-bold mb-2 transition-colors" style={{ 
                  color: darkMode ? '#f1f5f9' : '#111827'
                }}>Spot the Overfit</h4>
                <p className="text-sm mb-3" style={{ color: darkMode ? '#94a3b8' : '#4b5563' }}>Watch what happens when you make the network too complex for a simple problem.</p>
                <div className="text-xs inline-block px-3 py-1.5 rounded-lg" style={{ 
                  color: darkMode ? '#94a3b8' : '#4b5563',
                  backgroundColor: darkMode ? '#0f172a' : '#ffffff',
                  border: darkMode ? '1px solid #334155' : '1px solid #e5e7eb'
                }}>Try: Gaussian dataset with 3 layers of 8 neurons each</div>
              </div>
            </div>
          </section>
          
          <hr style={{ borderColor: darkMode ? '#334155' : '#e5e7eb' }} />
          
          {/* Understanding Overfitting */}
          <section className="space-y-6">
            <h3 className="text-2xl font-bold" style={{ color: darkMode ? '#f1f5f9' : '#111827' }}>What is Overfitting?</h3>
            <div className="rounded-3xl p-8 space-y-4" style={{ backgroundColor: darkMode ? 'rgba(124, 45, 18, 0.15)' : 'rgba(255, 247, 237, 0.5)' }}>
              <p className="leading-relaxed text-base" style={{ color: darkMode ? '#cbd5e1' : '#374151' }}>
                Overfitting happens when your network memorizes the training dots instead of learning the actual pattern.
              </p>
              <div className="rounded-2xl p-6" style={{ 
                backgroundColor: darkMode ? '#1e293b' : '#ffffff',
                border: darkMode ? '1px solid #7c2d12' : '1px solid #fed7aa'
              }}>
                <h4 className="font-bold mb-3" style={{ color: darkMode ? '#f1f5f9' : '#111827' }}>Signs you're overfitting:</h4>
                <ul className="space-y-2 text-sm" style={{ color: darkMode ? '#94a3b8' : '#4b5563' }}>
                  <li className="flex gap-2">
                    <span className="font-bold" style={{ color: darkMode ? '#fb923c' : '#f97316' }}>•</span>
                    <span>Train Loss keeps going down, but Test Loss starts going UP</span>
                  </li>
                  <li className="flex gap-2">
                    <span className="font-bold" style={{ color: darkMode ? '#fb923c' : '#f97316' }}>•</span>
                    <span>The decision boundary looks weirdly squiggly around individual dots</span>
                  </li>
                  <li className="flex gap-2">
                    <span className="font-bold" style={{ color: darkMode ? '#fb923c' : '#f97316' }}>•</span>
                    <span>You have way more neurons than you need for the pattern</span>
                  </li>
                </ul>
              </div>
              <p className="text-sm italic" style={{ color: darkMode ? '#94a3b8' : '#4b5563' }}>
                Fix it by: reducing layers/neurons, adding regularization (L2), or getting more training data.
              </p>
            </div>
          </section>
          
        </div>
        
        {/* Footer */}
        <div className="sticky bottom-0 backdrop-blur-sm px-10 py-6 flex justify-end z-10" style={{ 
          backgroundColor: darkMode ? 'rgba(30, 41, 59, 0.95)' : 'rgba(255, 255, 255, 0.95)',
          borderTop: darkMode ? '1px solid #334155' : '1px solid #e5e7eb'
        }}>
          <button
            onClick={onClose}
            className="px-8 py-3 rounded-xl font-medium text-white transition-all hover:opacity-90 active:scale-95 shadow-lg"
            style={{ 
              backgroundColor: '#6366f1',
              boxShadow: darkMode ? '0 10px 25px rgba(99, 102, 241, 0.3)' : '0 10px 25px rgba(165, 180, 252, 0.4)'
            }}
          >
            Got it, let's go!
          </button>
        </div>
      </div>
    </div>
  );
}

export default HelpModal;
