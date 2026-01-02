import React, { useState, useEffect, useMemo } from 'react'

function SoccerTeamMakerWidget() {
  const [currentSport] = useGlobalStorage('sports.current', 'soccer')
  const key = (suffix) => `${currentSport}.teamMaker.${suffix}`
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
  const [players, setPlayers] = useStorage(key('players'), [])
  // Read from global scheduler data when locked (same as money splitter)
  const [lockedPayloadGlobal] = useGlobalStorage(`${currentSport}.scheduler.lockedPayload`, null)
  const [syncedFromScheduler, setSyncedFromScheduler] = useStorage(key('syncedFromScheduler'), false)
  const [teams, setTeams] = useStorage(key('teams'), [])
  const [teamCount, setTeamCount] = useStorage(key('teamCount'), 2)
  const [balanceMethod, setBalanceMethod] = useStorage(key('balanceMethod'), 'skill')
  const [teamsGenerated, setTeamsGenerated] = useStorage(key('teamsGenerated'), false)
  const [teamsLocked, setTeamsLocked] = useStorage(key('teamsLocked'), false)
  const [newPlayerName, setNewPlayerName] = useState('')
  const [newPlayerSkill, setNewPlayerSkill] = useState('beginner')
  const [banner, setBanner] = useState({ message: '', tone: 'info' })

  const skillValues = { beginner: 1, intermediate: 2, advanced: 3, expert: 4 }

  const minPlayers = useMemo(() => {
    return teamCount * 2 // Minimum 2 players per team
  }, [teamCount])

  const canGenerateTeams = useMemo(() => {
    return players.length >= minPlayers
  }, [players.length, minPlayers])

  // When scheduler locks with user data, generate player list from global payload (same as money splitter)
  useEffect(() => {
    if (!lockedPayloadGlobal?.userName) return
    
    const numFriends = Number(lockedPayloadGlobal.userExtraVotes || 0)
    const totalParticipants = 1 + Math.max(0, numFriends)
    const currentCount = Array.isArray(players) ? players.length : 0
    
    // Only auto-sync if we haven't already synced or if counts diverge
    if (syncedFromScheduler && currentCount === totalParticipants) return
    
    const baseName = (lockedPayloadGlobal.userName && lockedPayloadGlobal.userName.trim()) || 'Player'
    const generated = Array.from({ length: totalParticipants }, (_, idx) => {
      const name = idx === 0 ? baseName : `${baseName}${idx}`
      return { 
        id: Date.now() + idx, 
        name, 
        skill: 'intermediate', // default skill for all players
        avatar: name.charAt(0).toUpperCase() 
      }
    })
    setPlayers(generated)
    setSyncedFromScheduler(true)
  }, [lockedPayloadGlobal])

  const addPlayer = () => {
    const name = newPlayerName.trim()

    if (!name) {
      setBanner({ message: 'Please enter a player name', tone: 'error' })
      return
    }

    // Check if player already exists
    if (players.some(player => player.name.toLowerCase() === name.toLowerCase())) {
      setBanner({ message: 'Player already exists', tone: 'error' })
      return
    }

    const player = {
      id: Date.now(),
      name: name,
      skill: newPlayerSkill,
      avatar: name.charAt(0).toUpperCase()
    }

    setPlayers([...players, player])
    setNewPlayerName('')
    setNewPlayerSkill('beginner')
  }

  const removePlayer = (playerId) => {
    setPlayers(players.filter(player => player.id !== playerId))
  }

  const createBalancedTeams = () => {
    const newTeams = Array.from({ length: teamCount }, () => [])
    const playersCopy = [...players]

    if (balanceMethod === 'random') {
      // Random distribution
      for (let i = 0; i < playersCopy.length; i++) {
        const teamIndex = i % teamCount
        newTeams[teamIndex].push(playersCopy[i])
      }
    } else if (balanceMethod === 'skill') {
      // Skill-based distribution
      playersCopy.sort((a, b) => skillValues[b.skill] - skillValues[a.skill])
      
      for (let i = 0; i < playersCopy.length; i++) {
        const teamIndex = i % teamCount
        newTeams[teamIndex].push(playersCopy[i])
      }
    } else {
      // Mixed approach
      playersCopy.sort((a, b) => skillValues[b.skill] - skillValues[a.skill])
      
      // Distribute high-skill players first, then fill remaining spots
      for (let i = 0; i < playersCopy.length; i++) {
        const teamIndex = i % teamCount
        newTeams[teamIndex].push(playersCopy[i])
      }
    }

    return newTeams
  }

  const generateTeams = () => {
    if (!canGenerateTeams) {
      setBanner({ message: `Need at least ${minPlayers} players to create ${teamCount} teams`, tone: 'error' })
      return
    }

    const newTeams = createBalancedTeams()
    setTeams(newTeams)
    setTeamsGenerated(true)
  }

  const regenerateTeams = () => {
    if (teamsLocked) {
      setBanner({ message: 'Teams are locked. Unlock them first to regenerate.', tone: 'warning' })
      return
    }

    generateTeams()
  }

  const lockTeams = () => {
    setTeamsLocked(true)
    setBanner({ message: 'Teams have been locked', tone: 'success' })
  }

  const unlockTeams = () => {
    setTeamsLocked(false)
    setBanner({ message: 'Teams unlocked', tone: 'info' })
  }

  // Drag & Drop between teams (enabled when teams generated and not locked)
  const onDragStart = (e, fromTeamIdx, playerId) => {
    try {
      e.dataTransfer.setData('application/json', JSON.stringify({ fromTeamIdx, playerId }))
    } catch {}
  }
  const onDragOver = (e) => {
    e.preventDefault()
  }
  const onDrop = (e, toTeamIdx) => {
    e.preventDefault()
    if (teamsLocked) return
    try {
      const data = JSON.parse(e.dataTransfer.getData('application/json') || '{}')
      const { fromTeamIdx, playerId } = data
      if (Number.isInteger(fromTeamIdx) && Number.isInteger(toTeamIdx) && playerId != null && fromTeamIdx !== toTeamIdx) {
        const next = teams.map(t => [...t])
        const fromList = next[fromTeamIdx] || []
        const idx = fromList.findIndex(p => p.id === playerId)
        if (idx >= 0) {
          const [moved] = fromList.splice(idx, 1)
          next[toTeamIdx] = [...(next[toTeamIdx] || []), moved]
          setTeams(next)
        }
      }
    } catch {}
  }

  const calculateTeamBalance = () => {
    return teams.map(team => {
      const totalSkill = team.reduce((sum, player) => sum + skillValues[player.skill], 0)
      const avgSkill = team.length > 0 ? totalSkill / team.length : 0
      return { totalSkill, avgSkill, count: team.length }
    })
  }

  const getSkillBadgeColor = (skill) => {
    const colors = {
      beginner: { background: 'rgba(239, 68, 68, 0.1)', color: '#dc2626' },
      intermediate: { background: 'rgba(245, 158, 11, 0.1)', color: '#d97706' },
      advanced: { background: 'rgba(34, 197, 94, 0.1)', color: '#16a34a' },
      expert: { background: 'rgba(139, 92, 246, 0.1)', color: '#7c3aed' }
    }
    return colors[skill] || colors.beginner
  }

  const teamNames = ['Team A', 'Team B', 'Team C', 'Team D']
  const teamColors = [theme.accent[0], theme.accent[1], theme.accent[0], theme.accent[1]]

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
        maxWidth: 600, 
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
            <span>{sportLabel} Team Maker</span>
          </div>
          <div style={{ fontSize: 12, color: 'rgba(255, 255, 255, 0.8)', margin: 0 }}>
            Create balanced teams for your pickup game
          </div>
        </div>

        {/* Content */}
        <div style={{ padding: 20 }}>
          {banner?.message && (
            <div style={{
              marginBottom: 12,
              padding: 12,
              borderRadius: 8,
              border: banner.tone === 'error' ? '1px solid #fecaca' : (banner.tone === 'warning' ? '1px solid #fde68a' : (banner.tone === 'success' ? '1px solid #bbf7d0' : '1px solid #e5e7eb')),
              background: banner.tone === 'error' ? '#fef2f2' : (banner.tone === 'warning' ? '#fffbeb' : (banner.tone === 'success' ? '#f0fdf4' : '#f9fafb')),
              color: banner.tone === 'error' ? '#b91c1c' : (banner.tone === 'warning' ? '#92400e' : (banner.tone === 'success' ? '#166534' : '#374151')),
              fontSize: 13
            }}>
              {banner.message}
            </div>
          )}
          
          {/* Add Players Section */}
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
              <span>👥</span>
              <span>Players</span>
            </div>

            {/* Info about player generation */}
            {lockedPayloadGlobal?.userName ? (
              <div style={{ padding: 8, marginBottom: 12, border: '1px solid #e5e7eb', borderRadius: 6, background: '#f0f9ff', fontSize: 12, color: '#374151' }}>
                Players auto-generated from scheduler: {lockedPayloadGlobal.userName} + {lockedPayloadGlobal.userExtraVotes || 0} friends
              </div>
            ) : (
              <div style={{ padding: 8, marginBottom: 12, border: '1px solid #e5e7eb', borderRadius: 6, background: '#fef3c7', fontSize: 12, color: '#374151' }}>
                Lock your time in the Scheduler with your name and friend count to auto-generate players
              </div>
            )}
            
            <div style={{ 
              display: 'grid', 
              gridTemplateColumns: '1fr 1fr auto', 
              gap: 12, 
              marginBottom: 16 
            }}>
              <div>
                <label style={{ 
                  fontSize: 12, 
                  fontWeight: 500, 
                  color: '#787774', 
                  marginBottom: 6, 
                  textTransform: 'uppercase', 
                  letterSpacing: '0.04em',
                  display: 'block'
                }}>
                  Player Name
                </label>
                <input 
                  type="text" 
                  value={newPlayerName} 
                  onChange={(e) => setNewPlayerName(e.target.value)}
                  placeholder="Enter player name"
                  style={{ 
                    width: '100%',
                    padding: '10px 12px', 
                    border: '1px solid #e9e9e7', 
                    borderRadius: 6, 
                    fontSize: 14, 
                    fontFamily: 'inherit', 
                    background: '#ffffff', 
                    color: '#37352f'
                  }}
                />
              </div>
              
              <div>
                <label style={{ 
                  fontSize: 12, 
                  fontWeight: 500, 
                  color: '#787774', 
                  marginBottom: 6, 
                  textTransform: 'uppercase', 
                  letterSpacing: '0.04em',
                  display: 'block'
                }}>
                  Skill Level
                </label>
                <select
                  value={newPlayerSkill}
                  onChange={(e) => setNewPlayerSkill(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '10px 12px',
                    border: '1px solid #e9e9e7',
                    borderRadius: 6,
                    fontSize: 14,
                    fontFamily: 'inherit',
                    background: '#ffffff',
                    color: '#37352f',
                    cursor: 'pointer'
                  }}
                >
                  <option value="beginner">Beginner</option>
                  <option value="intermediate">Intermediate</option>
                  <option value="advanced">Advanced</option>
                  <option value="expert">Expert</option>
                </select>
              </div>
              
              <button
                onClick={addPlayer}
                style={{
                  padding: '10px 16px',
                  border: 'none',
                  borderRadius: 6,
                  background: '#8b5cf6',
                  color: 'white',
                  fontSize: 14,
                  fontWeight: 500,
                  cursor: 'pointer',
                  transition: 'all 0.2s ease',
                  alignSelf: 'end'
                }}
              >
                Add
              </button>
            </div>
            
            {/* Players List */}
            <div>
              {players.length === 0 ? (
                <div style={{ 
                  textAlign: 'center', 
                  color: '#787774', 
                  fontStyle: 'italic', 
                  padding: '20px' 
                }}>
                  No players added yet
                </div>
              ) : (
                players.map(player => {
                  const skillColor = getSkillBadgeColor(player.skill)
                  return (
                    <div
                      key={player.id}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        padding: '12px 16px',
                        border: '1px solid #e9e9e7',
                        borderRadius: 6,
                        marginBottom: 8,
                        background: '#ffffff',
                        transition: 'all 0.2s ease'
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: 12, flex: 1 }}>
                        <div style={{
                          width: 40,
                          height: 40,
                          borderRadius: '50%',
                          background: '#8b5cf6',
                          color: 'white',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          fontSize: 14,
                          fontWeight: 600
                        }}>
                          {player.avatar}
                        </div>
                        <div style={{ flex: 1 }}>
                          <div style={{ 
                            fontSize: 14, 
                            fontWeight: 500, 
                            color: '#37352f', 
                            margin: '0 0 2px 0' 
                          }}>
                            {player.name}
                          </div>
                          <div style={{ fontSize: 12, color: '#787774', margin: 0 }}>
                            <span style={{
                              padding: '2px 8px',
                              borderRadius: 12,
                              fontSize: 11,
                              fontWeight: 500,
                              textTransform: 'uppercase',
                              letterSpacing: '0.04em',
                              background: skillColor.background,
                              color: skillColor.color
                            }}>
                              {player.skill}
                            </span>
                          </div>
                        </div>
                      </div>
                      <button
                        onClick={() => removePlayer(player.id)}
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
                  )
                })
              )}
            </div>
          </div>

          {/* Team Options */}
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
              <span>⚙️</span>
              <span>Team Options</span>
            </div>
            
            <div style={{ 
              display: 'grid', 
              gridTemplateColumns: '1fr 1fr', 
              gap: 16, 
              marginBottom: 20 
            }}>
              <div>
                <label style={{ 
                  fontSize: 12, 
                  fontWeight: 500, 
                  color: '#787774', 
                  marginBottom: 6, 
                  textTransform: 'uppercase', 
                  letterSpacing: '0.04em',
                  display: 'block'
                }}>
                  Number of Teams
                </label>
                <select
                  value={teamCount}
                  onChange={(e) => setTeamCount(parseInt(e.target.value))}
                  style={{
                    width: '100%',
                    padding: '10px 12px',
                    border: '1px solid #e9e9e7',
                    borderRadius: 6,
                    fontSize: 14,
                    fontFamily: 'inherit',
                    background: '#ffffff',
                    color: '#37352f',
                    cursor: 'pointer'
                  }}
                >
                  <option value={2}>2 Teams</option>
                  <option value={3}>3 Teams</option>
                  <option value={4}>4 Teams</option>
                </select>
              </div>
              
              <div>
                <label style={{ 
                  fontSize: 12, 
                  fontWeight: 500, 
                  color: '#787774', 
                  marginBottom: 6, 
                  textTransform: 'uppercase', 
                  letterSpacing: '0.04em',
                  display: 'block'
                }}>
                  Balance Method
                </label>
                <select
                  value={balanceMethod}
                  onChange={(e) => setBalanceMethod(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '10px 12px',
                    border: '1px solid #e9e9e7',
                    borderRadius: 6,
                    fontSize: 14,
                    fontFamily: 'inherit',
                    background: '#ffffff',
                    color: '#37352f',
                    cursor: 'pointer'
                  }}
                >
                  <option value="skill">Skill Level</option>
                  <option value="random">Random</option>
                  <option value="mixed">Mixed (Skill + Random)</option>
                </select>
              </div>
            </div>
            
            <button
              onClick={generateTeams}
              disabled={!canGenerateTeams}
              style={{
                width: '100%',
                padding: '12px 16px',
                border: 'none',
                borderRadius: 6,
                background: canGenerateTeams ? '#8b5cf6' : '#e5e7eb',
                color: canGenerateTeams ? 'white' : '#9ca3af',
                fontSize: 16,
                fontWeight: 600,
                cursor: canGenerateTeams ? 'pointer' : 'not-allowed',
                transition: 'all 0.2s ease',
                marginBottom: 20
              }}
            >
              Generate Teams
            </button>
          </div>

          {/* Teams Results */}
          {teamsGenerated && teams.length > 0 && (
            <div>
              {/* Balance Info */}
              <div style={{ 
                background: '#f8fafc', 
                border: '1px solid #e2e8f0', 
                borderRadius: 8, 
                padding: 16, 
                marginBottom: 20 
              }}>
                <div style={{ 
                  fontSize: 14, 
                  fontWeight: 600, 
                  color: '#37352f', 
                  margin: '0 0 12px 0', 
                  display: 'flex', 
                  alignItems: 'center', 
                  gap: 6 
                }}>
                  <span>📊</span>
                  <span>Team Balance</span>
                </div>
                <div style={{ 
                  display: 'grid', 
                  gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))', 
                  gap: 12 
                }}>
                  {calculateTeamBalance().map((balance, index) => (
                    <div key={index} style={{ textAlign: 'center', padding: 8, background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: 6 }}>
                      <div style={{ 
                        fontSize: 11, 
                        color: '#787774', 
                        textTransform: 'uppercase', 
                        letterSpacing: '0.04em', 
                        marginBottom: 4 
                      }}>
                        {teamNames[index] || `Team ${index + 1}`}
                      </div>
                      <div style={{ fontSize: 14, fontWeight: 600, color: '#37352f' }}>
                        {(balance.avgSkill).toFixed(1)}/4.0
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Teams Grid */}
              <div style={{ 
                display: 'grid', 
                gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', 
                gap: 20, 
                marginBottom: 20 
              }}>
                {teams.map((team, index) => (
                  <div
                    key={index}
                    onDragOver={onDragOver}
                    onDrop={(e) => onDrop(e, index)}
                    style={{
                      border: `2px solid ${teamColors[index]}`,
                      borderRadius: 8,
                      padding: 16,
                      background: 'rgba(255, 255, 255, 0.5)'
                    }}
                  >
                    <div style={{ 
                      display: 'flex', 
                      alignItems: 'center', 
                      justifyContent: 'space-between', 
                      marginBottom: 12 
                    }}>
                      <div style={{ 
                        fontSize: 16, 
                        fontWeight: 600, 
                        color: teamColors[index], 
                        display: 'flex', 
                        alignItems: 'center', 
                        gap: 8 
                      }}>
                        <span>{theme.icon}</span>
                        <span>{teamNames[index] || `Team ${index + 1}`}</span>
                      </div>
                      <div style={{ 
                        fontSize: 12, 
                        color: '#787774', 
                        background: '#f7f6f3', 
                        padding: '2px 8px', 
                        borderRadius: 3 
                      }}>
                        {team.length} players
                      </div>
                    </div>
                    
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                      {team.map(player => {
                        const skillColor = getSkillBadgeColor(player.skill)
                        return (
                          <div
                            key={player.id}
                            draggable={!teamsLocked}
                            onDragStart={(e) => onDragStart(e, index, player.id)}
                            style={{
                              display: 'flex',
                              alignItems: 'center',
                              gap: 8,
                              padding: '8px 12px',
                              background: '#f8fafc',
                              border: '1px solid #e2e8f0',
                              borderRadius: 6
                            }}
                          >
                            <div style={{
                              width: 32,
                              height: 32,
                              borderRadius: '50%',
                              background: '#8b5cf6',
                              color: 'white',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              fontSize: 12,
                              fontWeight: 600
                            }}>
                              {player.avatar}
                            </div>
                            <div style={{ 
                              flex: 1, 
                              fontSize: 14, 
                              fontWeight: 500, 
                              color: '#37352f' 
                            }}>
                              {player.name}
                            </div>
                            <div style={{
                              fontSize: 11,
                              padding: '2px 6px',
                              borderRadius: 10,
                              fontWeight: 500,
                              textTransform: 'uppercase',
                              letterSpacing: '0.04em',
                              background: skillColor.background,
                              color: skillColor.color
                            }}>
                              {player.skill}
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  </div>
                ))}
              </div>

              {/* Action Buttons */}
              <div style={{ display: 'flex', gap: 12 }}>
                <button
                  onClick={regenerateTeams}
                  style={{
                    flex: 1,
                    padding: '10px 16px',
                    border: '1px solid #d1d5db',
                    borderRadius: 6,
                    background: '#ffffff',
                    color: '#374151',
                    fontSize: 14,
                    fontWeight: 500,
                    cursor: 'pointer',
                    transition: 'all 0.2s ease'
                  }}
                >
                  Regenerate
                </button>
                {teamsLocked ? (
                  <button
                    onClick={unlockTeams}
                    style={{
                      flex: 1,
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
                    Unlock Teams
                  </button>
                ) : (
                  <button
                    onClick={lockTeams}
                    style={{
                      flex: 1,
                      padding: '10px 16px',
                      border: 'none',
                      borderRadius: 6,
                      background: '#8b5cf6',
                      color: 'white',
                      fontSize: 14,
                      fontWeight: 500,
                      cursor: 'pointer',
                      transition: 'all 0.2s ease'
                    }}
                  >
                    Lock Teams
                  </button>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

export default SoccerTeamMakerWidget
