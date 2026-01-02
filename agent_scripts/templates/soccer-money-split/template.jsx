import React, { useState, useEffect, useMemo } from 'react'

function SoccerMoneySplitWidget() {
  const [currentSport] = useGlobalStorage('sports.current', 'soccer')
  const key = (suffix) => `${currentSport}.moneySplit.${suffix}`
  const sportLabel = useMemo(() => {
    const map = { soccer: 'Soccer', football: 'Football', tennis: 'Tennis', baseball: 'Baseball', basketball: 'Basketball' }
    return map[currentSport] || 'Sport'
  }, [currentSport])
  const theme = useMemo(() => {
    const bySport = {
      soccer: { icon: '💰', accent: ['#10b981', '#059669'], placeholder: 'e.g., Field rental' },
      football: { icon: '💰', accent: ['#10b981', '#059669'], placeholder: 'e.g., Turf rental' },
      tennis: { icon: '💰', accent: ['#22c55e', '#16a34a'], placeholder: 'e.g., Court rental' },
      baseball: { icon: '💰', accent: ['#ef4444', '#b91c1c'], placeholder: 'e.g., Diamond rental' },
      basketball: { icon: '💰', accent: ['#f59e0b', '#d97706'], placeholder: 'e.g., Court rental' }
    }
    return bySport[currentSport] || bySport.soccer
  }, [currentSport])
  const [expenses, setExpenses] = useStorage(key('expenses'), [])
  const [players, setPlayers] = useStorage(key('players'), [
    { id: 1, name: 'Alex', avatar: 'A', paid: false },
    { id: 2, name: 'Jordan', avatar: 'J', paid: false },
    { id: 3, name: 'Sam', avatar: 'S', paid: false },
    { id: 4, name: 'Casey', avatar: 'C', paid: false }
  ])
  // Read from global scheduler data when locked
  const [lockedPayloadGlobal] = useGlobalStorage(`${currentSport}.scheduler.lockedPayload`, null)
  const [syncedFromScheduler, setSyncedFromScheduler] = useStorage(key('syncedFromScheduler'), false)
  const [newExpenseName, setNewExpenseName] = useState('')
  const [newExpenseAmount, setNewExpenseAmount] = useState('')
  const [newPlayerName, setNewPlayerName] = useState('')
  const [banner, setBanner] = useState({ message: '', tone: 'info' })
  const [confirmClear, setConfirmClear] = useState(false)

  const totalCost = useMemo(() => {
    return expenses.reduce((sum, expense) => sum + expense.amount, 0)
  }, [expenses])

  const perPersonCost = useMemo(() => {
    return players.length > 0 ? totalCost / players.length : 0
  }, [totalCost, players.length])

  // When scheduler locks with user data, generate player list from global payload
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
      return { id: Date.now() + idx, name, avatar: name.charAt(0).toUpperCase(), paid: false }
    })
    setPlayers(generated)
    setSyncedFromScheduler(true)
  }, [lockedPayloadGlobal])

  const addExpense = () => {
    const name = newExpenseName.trim()
    const amount = parseFloat(newExpenseAmount)

    if (!name || isNaN(amount) || amount <= 0) {
      setBanner({ message: 'Enter a valid expense name and amount', tone: 'error' })
      return
    }

    const expense = {
      id: Date.now(),
      name: name,
      amount: amount
    }

    setExpenses([...expenses, expense])
    setNewExpenseName('')
    setNewExpenseAmount('')
    setBanner({ message: 'Expense added', tone: 'success' })
  }

  const removeExpense = (expenseId) => {
    setExpenses(expenses.filter(expense => expense.id !== expenseId))
  }

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
      avatar: name.charAt(0).toUpperCase(),
      paid: false
    }

    setPlayers([...players, player])
    setNewPlayerName('')
    setBanner({ message: 'Player added', tone: 'success' })
  }

  const removePlayer = (playerId) => {
    setPlayers(players.filter(player => player.id !== playerId))
  }

  const togglePaid = (playerId) => {
    setPlayers(players.map(p => p.id === playerId ? { ...p, paid: !Boolean(p.paid) } : p))
  }

  const clearAll = () => {
    if (!confirmClear) {
      setConfirmClear(true)
      setBanner({ message: 'Press Clear All again to confirm', tone: 'warning' })
      return
    }
    setExpenses([])
    setPlayers([])
    setConfirmClear(false)
    setBanner({ message: 'All data cleared', tone: 'success' })
  }

  const calculateSplit = () => {
    if (expenses.length === 0) {
      setBanner({ message: 'Add at least one expense', tone: 'error' })
      return
    }

    if (players.length === 0) {
      setBanner({ message: 'Add at least one player', tone: 'error' })
      return
    }

    setBanner({ message: `Each person owes $${perPersonCost.toFixed(2)}`, tone: 'info' })
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
        maxWidth: 500, 
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
            <span>{sportLabel} Money Splitter</span>
          </div>
          <div style={{ fontSize: 12, color: 'rgba(255, 255, 255, 0.8)', margin: 0 }}>
            Split field costs and expenses among players
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
           
          {/* Add Expenses Section */}
          <div style={{ marginBottom: 24 }}>
            
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
                  Expense Name
                </label>
                <input 
                  type="text" 
                  value={newExpenseName} 
                  onChange={(e) => setNewExpenseName(e.target.value)}
                  placeholder={theme.placeholder}
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
                  Amount ($)
                </label>
                <input 
                  type="number" 
                  value={newExpenseAmount} 
                  onChange={(e) => setNewExpenseAmount(e.target.value)}
                  placeholder="0.00"
                  step="0.01"
                  min="0"
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
              
              <button
                onClick={addExpense}
                style={{
                  padding: '10px 16px',
                  border: 'none',
                  borderRadius: 6,
                  background: '#f59e0b',
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
            
            {/* Expenses List */}
            <div>
              {expenses.length === 0 ? (
                <div style={{ 
                  textAlign: 'center', 
                  color: '#787774', 
                  fontStyle: 'italic', 
                  padding: '20px' 
                }}>
                  No expenses added yet
                </div>
              ) : (
                expenses.map(expense => (
                  <div
                    key={expense.id}
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
                    <div style={{ flex: 1 }}>
                      <div style={{ 
                        fontSize: 14, 
                        fontWeight: 500, 
                        color: '#37352f', 
                        margin: '0 0 2px 0' 
                      }}>
                        {expense.name}
                      </div>
                      <div style={{ fontSize: 12, color: '#787774', margin: 0 }}>
                        Field expense
                      </div>
                    </div>
                    <div style={{ 
                      fontSize: 14, 
                      fontWeight: 600, 
                      color: '#f59e0b', 
                      marginRight: 12 
                    }}>
                      ${expense.amount.toFixed(2)}
                    </div>
                    <button
                      onClick={() => removeExpense(expense.id)}
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
                ))
              )}
            </div>
          </div>

          {/* Players Section */}
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
            
            {/* Players List */}
            <div style={{ 
              display: 'grid', 
              gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', 
              gap: 12, 
              marginBottom: 16 
            }}>
              {players.map(player => (
                <div
                  key={player.id}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 8,
                    padding: '8px 12px',
                    border: '1px solid #e9e9e7',
                    borderRadius: 6,
                    background: '#ffffff'
                  }}
                >
                  <div style={{
                    width: 32,
                    height: 32,
                    borderRadius: '50%',
                    background: '#f59e0b',
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
                  <button
                    onClick={() => removePlayer(player.id)}
                    style={{
                      padding: '2px 6px',
                      border: 'none',
                      borderRadius: 4,
                      background: '#ef4444',
                      color: 'white',
                      fontSize: 10,
                      cursor: 'pointer',
                      transition: 'all 0.2s ease'
                    }}
                  >
                    ×
                  </button>
                </div>
              ))}
            </div>
            
            {/* Add Player Form */}
            <div style={{ display: 'flex', gap: 8 }}>
              <input 
                type="text" 
                value={newPlayerName} 
                onChange={(e) => setNewPlayerName(e.target.value)}
                placeholder="Enter player name"
                onKeyPress={(e) => {
                  if (e.key === 'Enter') {
                    addPlayer()
                  }
                }}
                style={{ 
                  flex: 1,
                  padding: '8px 12px', 
                  border: '1px solid #e9e9e7', 
                  borderRadius: 6, 
                  fontSize: 14, 
                  fontFamily: 'inherit', 
                  background: '#ffffff', 
                  color: '#37352f'
                }}
              />
              <button
                onClick={addPlayer}
                style={{
                  padding: '8px 16px',
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
                Add Player
              </button>
            </div>
          </div>

          {/* Split Results */}
          <div style={{ 
            background: '#f8fafc', 
            border: '1px solid #e2e8f0', 
            borderRadius: 8, 
            padding: 16, 
            marginTop: 20 
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
              <span>Split Results</span>
            </div>
            
            <div style={{ 
              display: 'grid', 
              gridTemplateColumns: '1fr 1fr', 
              gap: 16, 
              marginBottom: 16 
            }}>
              <div style={{ textAlign: 'center', padding: 12, background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: 6 }}>
                <div style={{ 
                  fontSize: 11, 
                  color: '#787774', 
                  textTransform: 'uppercase', 
                  letterSpacing: '0.04em', 
                  marginBottom: 4 
                }}>
                  Total Cost
                </div>
                <div style={{ fontSize: 18, fontWeight: 600, color: '#f59e0b' }}>
                  ${totalCost.toFixed(2)}
                </div>
              </div>
              
              <div style={{ textAlign: 'center', padding: 12, background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: 6 }}>
                <div style={{ 
                  fontSize: 11, 
                  color: '#787774', 
                  textTransform: 'uppercase', 
                  letterSpacing: '0.04em', 
                  marginBottom: 4 
                }}>
                  Per Person
                </div>
                <div style={{ fontSize: 18, fontWeight: 600, color: '#10b981' }}>
                  ${perPersonCost.toFixed(2)}
                </div>
              </div>
            </div>
            
            {/* Breakdown */}
            <div style={{ marginTop: 16 }}>
              <div style={{ 
                fontSize: 12, 
                fontWeight: 500, 
                color: '#787774', 
                textTransform: 'uppercase', 
                letterSpacing: '0.04em', 
                marginBottom: 8 
              }}>
                Amount Owed by Each Player
              </div>
              <div>
                {players.map(player => (
                  <div
                    key={player.id}
                    onClick={() => togglePaid(player.id)}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      padding: '8px 12px',
                      background: player.paid ? 'rgba(16, 185, 129, 0.05)' : '#ffffff',
                      border: `1px solid ${player.paid ? 'rgba(16, 185, 129, 0.4)' : '#e2e8f0'}`,
                      borderRadius: 4,
                      marginBottom: 4,
                      cursor: 'pointer'
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <div style={{
                        width: 18,
                        height: 18,
                        borderRadius: 4,
                        border: `2px solid ${player.paid ? '#10b981' : '#94a3b8'}`,
                        background: player.paid ? '#10b981' : 'transparent'
                      }} />
                      <div style={{ fontSize: 14, fontWeight: 500, color: '#37352f', textDecoration: player.paid ? 'line-through' : 'none' }}>
                        {player.name}
                      </div>
                    </div>
                    <div style={{ fontSize: 14, fontWeight: 600, color: player.paid ? '#64748b' : '#10b981' }}>
                      ${perPersonCost.toFixed(2)}
                    </div>
                  </div>
                ))}
              </div>
            </div>
            
            <div style={{ display: 'flex', gap: 12, marginTop: 20 }}>
              <button
                onClick={clearAll}
                style={{
                  flex: 1,
                  padding: '10px 16px',
                  border: '1px solid #d1d5db',
                  borderRadius: 6,
                  background: confirmClear ? '#fee2e2' : '#ffffff',
                  color: '#374151',
                  fontSize: 14,
                  fontWeight: 500,
                  cursor: 'pointer',
                  transition: 'all 0.2s ease'
                }}
              >
                {confirmClear ? 'Confirm Clear' : 'Clear All'}
              </button>
              <button
                onClick={calculateSplit}
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
                Calculate Split
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

export default SoccerMoneySplitWidget
