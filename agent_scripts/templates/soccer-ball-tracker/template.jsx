import React, { useState, useEffect, useMemo } from 'react'

function SoccerBallTrackerWidget() {
  const [currentSport] = useGlobalStorage('sports.current', 'soccer')
  const key = (suffix) => `${currentSport}.ballTracker.${suffix}`
  const sportLabel = useMemo(() => {
    const map = { soccer: 'Soccer', football: 'Football', tennis: 'Tennis', baseball: 'Baseball', basketball: 'Basketball' }
    return map[currentSport] || 'Sport'
  }, [currentSport])
  const theme = useMemo(() => {
    const bySport = {
      soccer: { icon: '⚽', accent: ['#10b981', '#059669'] },
      football: { icon: '🏈', accent: ['#10b981', '#059669'] },
      tennis: { icon: '🎾', accent: ['#22c55e', '#16a34a'] },
      baseball: { icon: '⚾', accent: ['#ef4444', '#b91c1c'] },
      basketball: { icon: '🏀', accent: ['#f59e0b', '#d97706'] }
    }
    return bySport[currentSport] || bySport.soccer
  }, [currentSport])
  const [ballBringers, setBallBringers] = useStorage(key('bringers'), [])
  const [newName, setNewName] = useState('')

  const addBallBringer = () => {
    const name = newName.trim()
    if (!name) {
      return
    }

    // Check if name already exists
    if (ballBringers.some(person => person.name.toLowerCase() === name.toLowerCase())) {
      return
    }

    const person = {
      id: Date.now(),
      name: name,
      addedAt: new Date().toISOString()
    }

    setBallBringers([...ballBringers, person])
    setNewName('')
  }

  const removeBallBringer = (id) => {
    setBallBringers(ballBringers.filter(person => person.id !== id))
  }

  const clearAll = () => {
    setBallBringers([])
  }

  return (
    <div key={currentSport} style={{ 
      width: '100%', 
      height: '100%', 
      display: 'flex', 
      alignItems: 'flex-start', 
      justifyContent: 'center', 
      background: '#0b1020', 
      overflowY: 'auto' 
    }}>
      <div style={{ 
        width: '100%', 
        maxWidth: 400, 
        background: '#ffffff', 
        color: '#37352f', 
        border: '1px solid #e9e9e7', 
        borderRadius: 12, 
        padding: 0, 
        boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)',
        fontSize: 16 
      }}>
        
        {/* Header */}
        <div style={{ 
          padding: '20px 24px', 
          borderBottom: '1px solid #e9e9e7', 
          background: `linear-gradient(135deg, ${theme.accent[0]} 0%, ${theme.accent[1]} 100%)`, 
          color: 'white'
        }}>
          <div style={{ 
            fontSize: 18, 
            fontWeight: 600, 
            margin: '0 0 4px 0', 
            display: 'flex', 
            alignItems: 'center', 
            gap: 8 
          }}>
            <span>{theme.icon}</span>
            <span>{sportLabel} Ball Tracker</span>
          </div>
          <div style={{ fontSize: 12, color: 'rgba(255, 255, 255, 0.8)', margin: 0 }}>
            Who's bringing the ball?
          </div>
        </div>

        {/* Content */}
        <div style={{ padding: 20 }}>
          
          {/* Add Person Section */}
          <div style={{ marginBottom: 24 }}>
            <div style={{ 
              fontSize: 14, 
              fontWeight: 600, 
              color: '#37352f', 
              margin: '0 0 12px 0', 
              display: 'flex', 
              alignItems: 'center', 
              gap: 6 
            }}>
              <span>👤</span>
              <span>Add Ball Bringer</span>
            </div>
            
            <div style={{ display: 'flex', gap: 8 }}>
              <input 
                type="text" 
                value={newName} 
                onChange={(e) => setNewName(e.target.value)}
                placeholder="Enter name (e.g., Mihai)"
                onKeyPress={(e) => {
                  if (e.key === 'Enter') {
                    addBallBringer()
                  }
                }}
                style={{ 
                  flex: 1,
                  padding: '10px 12px', 
                  border: '1px solid #e9e9e7', 
                  borderRadius: 6, 
                  fontSize: 14, 
                  fontFamily: 'inherit', 
                  background: '#ffffff', 
                  color: '#37352f'
                }}
              />
              <button
                onClick={addBallBringer}
                style={{
                  padding: '10px 16px',
                  border: 'none',
                  borderRadius: 6,
                  background: '#f59e0b',
                  color: 'white',
                  fontSize: 14,
                  fontWeight: 500,
                  cursor: 'pointer',
                  transition: 'all 0.2s ease'
                }}
              >
                Add
              </button>
            </div>
          </div>

          {/* Ball Bringers List */}
          <div style={{ marginBottom: 24 }}>
            <div style={{ 
              fontSize: 14, 
              fontWeight: 600, 
              color: '#37352f', 
              margin: '0 0 12px 0', 
              display: 'flex', 
              alignItems: 'center', 
              justifyContent: 'space-between'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <span>🏆</span>
                <span>Ball Bringers ({ballBringers.length})</span>
              </div>
              {ballBringers.length > 0 && (
                <button
                  onClick={clearAll}
                  style={{
                    padding: '4px 8px',
                    border: '1px solid #ef4444',
                    borderRadius: 4,
                    background: 'transparent',
                    color: '#ef4444',
                    fontSize: 12,
                    fontWeight: 500,
                    cursor: 'pointer',
                    transition: 'all 0.2s ease'
                  }}
                >
                  Clear All
                </button>
              )}
            </div>
            
            {ballBringers.length === 0 ? (
              <div style={{ 
                textAlign: 'center', 
                color: '#787774', 
                fontStyle: 'italic', 
                padding: '20px',
                border: '1px dashed #e5e7eb',
                borderRadius: 8
              }}>
                No one has volunteered yet
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {ballBringers.map((person, index) => (
                  <div
                    key={person.id}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      padding: '12px 16px',
                      border: '1px solid #e9e9e7',
                      borderRadius: 8,
                      background: '#ffffff',
                      transition: 'all 0.2s ease'
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                      <div style={{
                        width: 32,
                        height: 32,
                        borderRadius: '50%',
                        background: '#f59e0b',
                        color: 'white',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontSize: 14,
                        fontWeight: 600
                      }}>
                        {person.name.charAt(0).toUpperCase()}
                      </div>
                      <div>
                        <div style={{ 
                          fontSize: 14, 
                          fontWeight: 500, 
                          color: '#37352f', 
                          margin: '0 0 2px 0' 
                        }}>
                          {person.name}
                        </div>
                        <div style={{ fontSize: 11, color: '#787774', margin: 0 }}>
                          #{index + 1} • Added {new Date(person.addedAt).toLocaleDateString()}
                        </div>
                      </div>
                    </div>
                    <button
                      onClick={() => removeBallBringer(person.id)}
                      style={{
                        padding: '4px 8px',
                        border: 'none',
                        borderRadius: 4,
                        background: '#ef4444',
                        color: 'white',
                        fontSize: 12,
                        cursor: 'pointer',
                        transition: 'all 0.2s ease'
                      }}
                    >
                      Remove
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Summary */}
          {ballBringers.length > 0 && (
            <div style={{ 
              background: '#f8fafc', 
              border: '1px solid #e2e8f0', 
              borderRadius: 8, 
              padding: 16, 
              textAlign: 'center'
            }}>
              <div style={{ 
                fontSize: 14, 
                fontWeight: 600, 
                color: '#37352f', 
                margin: '0 0 8px 0',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 6
              }}>
                <span>{theme.icon}</span>
                <span>Ready to Play!</span>
              </div>
              <div style={{ fontSize: 12, color: '#787774', margin: 0 }}>
                {ballBringers.length === 1 
                  ? `${ballBringers[0].name} will bring the ball`
                  : `${ballBringers.length} people volunteered to bring balls`
                }
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

export default SoccerBallTrackerWidget

