import React, { useState, useEffect, useCallback, useMemo } from 'react';

function Spyfall() {
  // Word pairs for the game (civilian word vs undercover word)
  const WORD_PAIRS = useMemo(() => [
    { civilian: "Cat", undercover: "Tiger" },
    { civilian: "Coffee", undercover: "Tea" },
    { civilian: "Book", undercover: "Magazine" },
    { civilian: "Car", undercover: "Bus" },
    { civilian: "Apple", undercover: "Orange" },
    { civilian: "Doctor", undercover: "Nurse" },
    { civilian: "Ocean", undercover: "Lake" },
    { civilian: "Pizza", undercover: "Burger" },
    { civilian: "Guitar", undercover: "Piano" },
    { civilian: "Summer", undercover: "Spring" },
    { civilian: "Moon", undercover: "Sun" },
    { civilian: "Rain", undercover: "Snow" },
    { civilian: "Football", undercover: "Basketball" },
    { civilian: "Chocolate", undercover: "Candy" },
    { civilian: "Mountain", undercover: "Hill" }
  ], []);

  // Generate stable player ID based on authentication or device fingerprint
  const generatePlayerId = useCallback(() => {
    // Try to get authenticated user ID first
    const authToken = getAuthToken();
    if (authToken) {
      try {
        const payload = JSON.parse(atob(authToken.split('.')[1]));
        return payload.sub; // Clerk user ID
      } catch (error) {
        console.log('Failed to parse auth token');
      }
    }
    
    // Generate stable computer-specific ID (no localStorage syncing issues)
    return generateStableComputerId();
  }, []);

  const getAuthToken = useCallback(() => {
    if (typeof window === 'undefined') return null;
    if (window.__clerk_token) return window.__clerk_token;
    
    const localStorageToken = localStorage.getItem('__session');
    if (localStorageToken) return localStorageToken;
    
    const cookies = document.cookie.split(';');
    for (let cookie of cookies) {
      const [name, value] = cookie.trim().split('=');
      if (name === '__session') return value;
    }
    
    return null;
  }, []);

  const generateStableComputerId = useCallback(() => {
    const components = [
      navigator.userAgent,
      navigator.platform,
      navigator.language,
      screen.width + 'x' + screen.height + 'x' + screen.colorDepth,
      navigator.hardwareConcurrency || 'unknown',
      navigator.deviceMemory || 'unknown',
      navigator.maxTouchPoints || 0,
      getWebGLFingerprint(),
      navigator.cookieEnabled ? 'cookies' : 'no-cookies'
    ];
    
    const fingerprint = components.join('||');
    let hash = 0;
    for (let i = 0; i < fingerprint.length; i++) {
      hash = ((hash << 5) - hash) + fingerprint.charCodeAt(i);
      hash = hash & hash;
    }
    
    return 'comp_' + Math.abs(hash).toString(36);
  }, []);

  const getWebGLFingerprint = () => {
    try {
      const canvas = document.createElement('canvas');
      const gl = canvas.getContext('webgl') || canvas.getContext('experimental-webgl');
      if (gl) {
        const renderer = gl.getParameter(gl.RENDERER);
        const vendor = gl.getParameter(gl.VENDOR);
        return renderer + '|' + vendor;
      }
    } catch (e) {
      return 'no-webgl';
    }
    return 'no-webgl';
  };

  // Initialize player ID
  const playerId = useMemo(() => generatePlayerId(), [generatePlayerId]);

  // Collaborative storage - shared game state
  const [gameState, setGameState] = useGlobalStorage('spyfall-game-state', {
    players: {},
    gamePhase: 'waiting',
    currentRound: 1,
    currentTurnIndex: 0,
    currentTurnPlayerId: null,
    playerOrder: [],
    currentWordPair: null,
    undercoverPlayerIds: [],
    descriptions: {},
    votes: {},
    eliminatedPlayers: [],
    gameResult: null
  });

  // Local UI state
  const [playerName, setPlayerName] = useState('');
  const [nicknameInput, setNicknameInput] = useState('');
  const [hasJoined, setHasJoined] = useState(false);
  const [descriptionInput, setDescriptionInput] = useState('');
  const [selectedVote, setSelectedVote] = useState(null);

  // Initialize on mount
  useEffect(() => {
    console.log('🕵️ Initializing Spyfall Game...');
    console.log('Player ID:', playerId);
    
    // Check if player has already joined
    if (gameState.players[playerId]) {
      setHasJoined(true);
      setPlayerName(gameState.players[playerId].name);
    }
  }, [playerId, gameState.players]);

  // Join game
  const joinGame = useCallback(() => {
    const nickname = nicknameInput.trim();
    
    if (!nickname) {
      alert('Please enter a nickname');
      return;
    }
    
    if (nickname.length > 20) {
      alert('Nickname must be 20 characters or less');
      return;
    }
    
    // Check if nickname is already taken
    for (let pid in gameState.players) {
      if (gameState.players[pid].name === nickname) {
        alert('This nickname is already taken');
        return;
      }
    }
    
    const isHost = Object.keys(gameState.players).length === 0;
    
    setGameState({
      ...gameState,
      players: {
        ...gameState.players,
        [playerId]: {
          id: playerId,
          name: nickname,
          isHost: isHost,
          isReady: false,
          isEliminated: false,
          hasDescribed: false,
          hasVoted: false
        }
      }
    });
    
    setPlayerName(nickname);
    setHasJoined(true);
    console.log(`🎯 Player ${nickname} joined as ${isHost ? 'host' : 'player'}`);
  }, [nicknameInput, gameState, playerId, setGameState]);

  // Toggle ready
  const toggleReady = useCallback(() => {
    const player = gameState.players[playerId];
    if (!player) return;
    
    const updatedPlayer = { ...player, isReady: !player.isReady };
    const updatedPlayers = { ...gameState.players, [playerId]: updatedPlayer };
    
    setGameState({
      ...gameState,
      players: updatedPlayers
    });
    
    console.log(`🎯 Player ${player.name} is now ${updatedPlayer.isReady ? 'ready' : 'not ready'}`);
    
    // Check if all players are ready
    const activePlayers = Object.values(updatedPlayers).filter(p => !p.isEliminated);
    if (activePlayers.length >= 3 && activePlayers.every(p => p.isReady)) {
      setTimeout(() => startNewRound(), 500);
    }
  }, [gameState, playerId, setGameState]);

  // Quit game - removes current player from the game
  const quitGame = useCallback(() => {
    if (!confirm('Are you sure you want to quit the game?')) {
      return;
    }
    
    const updatedPlayers = { ...gameState.players };
    delete updatedPlayers[playerId];
    
    setGameState({
      ...gameState,
      players: updatedPlayers
    });
    
    setHasJoined(false);
    setPlayerName('');
    setNicknameInput('');
    console.log(`👋 Player ${playerName} has left the game`);
  }, [gameState, playerId, playerName, setGameState]);

  // Reset game - kicks everyone back to join screen (host only)
  const resetGame = useCallback(() => {
    const player = gameState.players[playerId];
    if (!player?.isHost) {
      alert('Only the host can reset the game');
      return;
    }
    
    if (!confirm('Reset the game? This will kick all players back to the join screen.')) {
      return;
    }
    
    // Clear all game state
    setGameState({
      players: {},
      gamePhase: 'waiting',
      currentRound: 1,
      currentTurnIndex: 0,
      currentTurnPlayerId: null,
      playerOrder: [],
      currentWordPair: null,
      undercoverPlayerIds: [],
      descriptions: {},
      votes: {},
      eliminatedPlayers: [],
      gameResult: null
    });
    
    setHasJoined(false);
    setPlayerName('');
    setNicknameInput('');
    setSelectedVote(null);
    console.log('🔄 Game has been reset by host');
  }, [gameState, playerId, setGameState]);

  // Start new round
  const startNewRound = useCallback(() => {
    const activePlayers = Object.values(gameState.players).filter(p => !p.isEliminated);
    if (activePlayers.length < 3) return;
    
    // Shuffle player order
    const playerIds = activePlayers.map(p => p.id);
    for (let i = playerIds.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [playerIds[i], playerIds[j]] = [playerIds[j], playerIds[i]];
    }
    
    // Select random word pair
    const wordPair = WORD_PAIRS[Math.floor(Math.random() * WORD_PAIRS.length)];
    
    // Determine undercover players
    const undercoverCount = activePlayers.length >= 7 ? 2 : 1;
    const shuffledPlayers = [...activePlayers].sort(() => Math.random() - 0.5);
    const undercoverPlayerIds = shuffledPlayers.slice(0, undercoverCount).map(p => p.id);
    
    // Assign words to players
    const updatedPlayers = { ...gameState.players };
    for (let player of activePlayers) {
      const isUndercover = undercoverPlayerIds.includes(player.id);
      updatedPlayers[player.id] = {
        ...updatedPlayers[player.id],
        isUndercover: isUndercover,
        word: isUndercover ? wordPair.undercover : wordPair.civilian,
        isReady: false,
        hasDescribed: false,
        hasVoted: false
      };
    }
    
    setGameState({
      ...gameState,
      players: updatedPlayers,
      gamePhase: 'description',
      currentTurnIndex: 0,
      currentTurnPlayerId: playerIds[0],
      playerOrder: playerIds,
      currentWordPair: wordPair,
      undercoverPlayerIds: undercoverPlayerIds,
      descriptions: {},
      votes: {}
    });
    
    console.log(`🎮 Starting round ${gameState.currentRound}`);
    console.log(`🔄 Player order:`, playerIds.map(id => updatedPlayers[id]?.name));
  }, [gameState, WORD_PAIRS, setGameState]);

  // Submit description
  const submitDescription = useCallback(() => {
    const description = descriptionInput.trim();
    
    if (!description) {
      alert('Please enter a description');
      return;
    }
    
    if (description.length > 200) {
      alert('Description must be 200 characters or less');
      return;
    }
    
    if (gameState.currentTurnPlayerId !== playerId) {
      alert("It's not your turn!");
      return;
    }
    
    const updatedDescriptions = { ...gameState.descriptions, [playerId]: description };
    const updatedPlayer = { ...gameState.players[playerId], hasDescribed: true };
    const updatedPlayers = { ...gameState.players, [playerId]: updatedPlayer };
    
    const nextTurnIndex = gameState.currentTurnIndex + 1;
    const isLastPlayer = nextTurnIndex >= gameState.playerOrder.length;
    
    setGameState({
      ...gameState,
      players: updatedPlayers,
      descriptions: updatedDescriptions,
      currentTurnIndex: nextTurnIndex,
      currentTurnPlayerId: isLastPlayer ? null : gameState.playerOrder[nextTurnIndex],
      gamePhase: isLastPlayer ? 'voting' : 'description'
    });
    
    setDescriptionInput('');
    console.log(`📝 ${playerName} submitted description: ${description}`);
  }, [descriptionInput, gameState, playerId, playerName, setGameState]);

  // Submit vote
  const submitVote = useCallback(() => {
    if (!selectedVote) {
      alert('Please select a player to vote for');
      return;
    }
    
    const updatedVotes = { ...gameState.votes, [playerId]: selectedVote };
    const updatedPlayer = { ...gameState.players[playerId], hasVoted: true };
    const updatedPlayers = { ...gameState.players, [playerId]: updatedPlayer };
    
    setGameState({
      ...gameState,
      players: updatedPlayers,
      votes: updatedVotes
    });
    
    console.log(`🗳️ ${playerName} voted for ${gameState.players[selectedVote]?.name}`);
    
    // Check if all players have voted
    const activePlayers = Object.values(updatedPlayers).filter(p => !p.isEliminated);
    if (activePlayers.every(p => p.hasVoted)) {
      setTimeout(() => processVotes(updatedVotes, updatedPlayers), 1000);
    }
  }, [selectedVote, gameState, playerId, playerName, setGameState]);

  // Process votes
  const processVotes = useCallback((votes, players) => {
    // Count votes
    const voteCount = {};
    for (let voterId in votes) {
      const votedFor = votes[voterId];
      voteCount[votedFor] = (voteCount[votedFor] || 0) + 1;
    }
    
    // Find player with most votes
    let maxVotes = 0;
    let eliminatedPlayerId = null;
    for (let pid in voteCount) {
      if (voteCount[pid] > maxVotes) {
        maxVotes = voteCount[pid];
        eliminatedPlayerId = pid;
      }
    }
    
    // Eliminate player
    const updatedPlayers = { ...players };
    const updatedEliminatedPlayers = [...gameState.eliminatedPlayers];
    
    if (eliminatedPlayerId) {
      updatedEliminatedPlayers.push(eliminatedPlayerId);
      updatedPlayers[eliminatedPlayerId] = {
        ...updatedPlayers[eliminatedPlayerId],
        isEliminated: true
      };
      console.log(`❌ ${updatedPlayers[eliminatedPlayerId]?.name} was eliminated with ${maxVotes} votes`);
    }
    
    // Check victory conditions
    const activePlayers = Object.values(updatedPlayers).filter(p => !p.isEliminated);
    const activeUndercover = activePlayers.filter(p => p.isUndercover);
    const activeCivilians = activePlayers.filter(p => !p.isUndercover);
    
    let gameResult = null;
    let newPhase = gameState.gamePhase;
    
    if (activeUndercover.length === 0 && activeCivilians.length > 1) {
      gameResult = {
        winner: 'civilians',
        reason: 'All undercover players eliminated'
      };
      newPhase = 'results';
    } else if (activeUndercover.length >= activeCivilians.length && activeCivilians.length === 1) {
      gameResult = {
        winner: 'undercover',
        reason: 'Undercover players equal or outnumber civilians'
      };
      newPhase = 'results';
    } else {
      // Continue to next round
      const playerIds = activePlayers.map(p => p.id);
      for (let i = playerIds.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [playerIds[i], playerIds[j]] = [playerIds[j], playerIds[i]];
      }
      
      // Reset for new round
      for (let pid in updatedPlayers) {
        if (!updatedPlayers[pid].isEliminated) {
          updatedPlayers[pid] = {
            ...updatedPlayers[pid],
            isReady: false,
            hasDescribed: false,
            hasVoted: false
          };
        }
      }
      
      setGameState({
        ...gameState,
        players: updatedPlayers,
        eliminatedPlayers: updatedEliminatedPlayers,
        currentRound: gameState.currentRound + 1,
        gamePhase: 'description',
        currentTurnIndex: 0,
        currentTurnPlayerId: playerIds[0],
        playerOrder: playerIds,
        descriptions: {},
        votes: {},
        gameResult: null
      });
      return;
    }
    
    setGameState({
      ...gameState,
      players: updatedPlayers,
      eliminatedPlayers: updatedEliminatedPlayers,
      gamePhase: newPhase,
      gameResult: gameResult
    });
  }, [gameState, setGameState]);

  // Start new game
  const startNewGame = useCallback(() => {
    const updatedPlayers = { ...gameState.players };
    for (let pid in updatedPlayers) {
      updatedPlayers[pid] = {
        ...updatedPlayers[pid],
        isReady: false,
        isEliminated: false,
        hasDescribed: false,
        hasVoted: false,
        word: undefined,
        isUndercover: undefined
      };
    }
    
    setGameState({
      ...gameState,
      players: updatedPlayers,
      gamePhase: 'waiting',
      currentRound: 1,
      currentTurnIndex: 0,
      currentTurnPlayerId: null,
      playerOrder: [],
      currentWordPair: null,
      undercoverPlayerIds: [],
      descriptions: {},
      votes: {},
      eliminatedPlayers: [],
      gameResult: null
    });
    
    setSelectedVote(null);
  }, [gameState, setGameState]);

  // Get current player data
  const currentPlayer = gameState.players[playerId];
  const isMyTurn = gameState.currentTurnPlayerId === playerId;
  const playerWord = currentPlayer?.word;
  const isUndercover = currentPlayer?.isUndercover;

  // Render player cards
  const renderPlayerCards = () => {
    const players = Object.values(gameState.players);
    
    return players.map((player) => {
      let cardClass = 'player-card';
      if (player.isEliminated) cardClass += ' eliminated';
      else if (player.isReady && gameState.gamePhase === 'waiting') cardClass += ' ready';
      else if (gameState.gamePhase === 'description' && gameState.currentTurnPlayerId === player.id) cardClass += ' current-turn';
      
      let statusText = '';
      if (gameState.gamePhase === 'waiting') {
        statusText = player.isReady ? 'Ready' : 'Not Ready';
      } else if (gameState.gamePhase === 'description') {
        if (gameState.currentTurnPlayerId === player.id) statusText = 'Current Turn';
        else if (player.hasDescribed) statusText = 'Described';
        else statusText = 'Waiting';
      } else if (gameState.gamePhase === 'voting') {
        statusText = player.hasVoted ? 'Voted' : 'Voting...';
      } else if (gameState.gamePhase === 'results') {
        statusText = player.isEliminated ? 'Eliminated' : 'Survived';
      }
      
      let turnOrderText = '';
      if (gameState.gamePhase === 'description' && gameState.playerOrder.length > 0) {
        const turnIndex = gameState.playerOrder.indexOf(player.id);
        if (turnIndex !== -1) {
          turnOrderText = ` (#${turnIndex + 1})`;
        }
      }
      
      return (
        <div key={player.id} className={cardClass}>
          <div className="player-name">
            {player.name}{player.isHost ? ' 👑' : ''}{turnOrderText}
          </div>
          <div className="player-status">{statusText}</div>
          {player.isEliminated && <div className="player-role role-unknown">Eliminated</div>}
        </div>
      );
    });
  };

  // Render descriptions history
  const renderDescriptions = () => {
    if (gameState.playerOrder.length === 0 || Object.keys(gameState.descriptions).length === 0) {
      return <div style={{ textAlign: 'center', color: '#6c757d', fontStyle: 'italic' }}>No descriptions yet...</div>;
    }
    
    return gameState.playerOrder.map(pid => {
      const description = gameState.descriptions[pid];
      if (!description) return null;
      
      const player = gameState.players[pid];
      if (!player) return null;
      
      return (
        <div key={pid} className="description-item">
          <div className="description-author">{player.name}</div>
          <div className="description-text">"{description}"</div>
        </div>
      );
    });
  };

  // Render voting buttons
  const renderVotingButtons = () => {
    const players = Object.values(gameState.players).filter(
      p => !p.isEliminated && p.id !== playerId
    );
    
    return players.map(player => (
      <div
        key={player.id}
        className={`vote-button ${selectedVote === player.id ? 'selected' : ''}`}
        onClick={() => setSelectedVote(player.id)}
      >
        {player.name}
      </div>
    ));
  };

  return (
    <div style={styles.body}>
      {/* Top Bar */}
      <div style={styles.topBar}>
        <div style={styles.gameTitle}>🕵️ Spyfall</div>
        <div style={styles.roundInfo}>
          <span style={styles.roundBadge}>Round {gameState.currentRound}</span>
          <span style={styles.phaseBadge}>{capitalizeFirst(gameState.gamePhase)}</span>
        </div>
      </div>

      {/* Main Container */}
      <div style={styles.mainContainer}>
        {/* Join Screen */}
        {!hasJoined && (
          <div style={styles.joinScreen}>
            <h1 style={styles.joinTitle}>🕵️ Join the Game</h1>
            <p style={styles.joinSubtitle}>Enter your nickname to join the undercover game</p>
            
            <div style={styles.joinForm}>
              <div style={styles.inputGroup}>
                <label style={styles.inputLabel}>Nickname</label>
                <input
                  type="text"
                  style={styles.inputField}
                  placeholder="Enter your nickname"
                  maxLength={20}
                  value={nicknameInput}
                  onChange={(e) => setNicknameInput(e.target.value)}
                  onKeyPress={(e) => e.key === 'Enter' && joinGame()}
                />
              </div>
              <button style={styles.btnPrimary} onClick={joinGame}>
                Join Game
              </button>
            </div>
          </div>
        )}

        {/* Game Screen */}
        {hasJoined && (
          <div>
            {/* Phase Instructions */}
            <div style={styles.phaseInstructions}>
              <div style={styles.instructionTitle}>
                {gameState.gamePhase === 'waiting' && 'Waiting for Players'}
                {gameState.gamePhase === 'description' && 'Description Phase'}
                {gameState.gamePhase === 'voting' && 'Voting Phase'}
                {gameState.gamePhase === 'results' && 'Game Results'}
              </div>
              <div style={styles.instructionText}>
                {gameState.gamePhase === 'waiting' && (
                  Object.keys(gameState.players).length < 3
                    ? 'Need at least 3 players to start the game. Share the link with friends!'
                    : `Waiting for all players to be ready (${Object.values(gameState.players).filter(p => p.isReady && !p.isEliminated).length}/${Object.values(gameState.players).filter(p => !p.isEliminated).length} ready). Click Ready when you're prepared to start!`
                )}
                {gameState.gamePhase === 'description' && "Describe your word in one sentence without saying it directly. Be careful not to reveal if you're undercover!"}
                {gameState.gamePhase === 'voting' && 'Based on the descriptions, vote for who you think is the undercover player. Choose wisely!'}
                {gameState.gamePhase === 'results' && 'The game has ended. See the results below!'}
              </div>
            </div>

            {/* Turn Display */}
            {gameState.gamePhase === 'description' && gameState.currentTurnPlayerId && (
              <div style={styles.turnDisplay}>
                <div style={styles.currentTurnPlayer}>
                  {isMyTurn ? 'Your Turn!' : `${gameState.players[gameState.currentTurnPlayerId]?.name}'s Turn`}
                </div>
                <div style={styles.turnInstruction}>
                  {isMyTurn
                    ? 'Describe your word in one sentence without saying it directly!'
                    : `Waiting for ${gameState.players[gameState.currentTurnPlayerId]?.name} to describe their word...`}
                </div>
              </div>
            )}

            {/* Your Word */}
            {(gameState.gamePhase === 'description' || gameState.gamePhase === 'voting') && playerWord && (
              <div style={styles.gameContent}>
                <div style={styles.wordDisplay}>
                  <div style={styles.yourWord}>{playerWord}</div>
                  <div style={styles.wordHint}>Your word - describe it without saying it directly!</div>
                </div>
              </div>
            )}

            {/* Descriptions History */}
            {(gameState.gamePhase === 'description' || gameState.gamePhase === 'voting') && (
              <div style={styles.descriptionsHistory}>
                <h3 style={styles.sectionTitle}>Descriptions So Far</h3>
                <div>{renderDescriptions()}</div>
              </div>
            )}

            {/* Description Phase - Your Turn */}
            {gameState.gamePhase === 'description' && isMyTurn && currentPlayer && !currentPlayer.isEliminated && !currentPlayer.hasDescribed && (
              <div style={styles.gameContent}>
                <h3 style={styles.sectionTitle}>Your Turn - Describe Your Word</h3>
                <div style={styles.descriptionArea}>
                  <textarea
                    style={styles.descriptionInput}
                    placeholder="Describe your word in one sentence (without saying the word directly)..."
                    maxLength={200}
                    value={descriptionInput}
                    onChange={(e) => setDescriptionInput(e.target.value)}
                  />
                </div>
                <div style={styles.actionBar}>
                  <button style={styles.btnPrimary} onClick={submitDescription}>
                    Submit Description
                  </button>
                </div>
              </div>
            )}

            {/* Waiting for Turn */}
            {gameState.gamePhase === 'description' && !isMyTurn && gameState.currentTurnPlayerId && (
              <div style={styles.waitingForTurn}>
                <div>⏳ Waiting for <strong>{gameState.players[gameState.currentTurnPlayerId]?.name}</strong> to describe their word...</div>
              </div>
            )}

            {/* Voting Phase */}
            {gameState.gamePhase === 'voting' && currentPlayer && !currentPlayer.isEliminated && !currentPlayer.hasVoted && (
              <div style={styles.gameContent}>
                <h3 style={styles.sectionTitle}>Vote for Undercover</h3>
                <p style={styles.instructionText}>Who do you think is the undercover player?</p>
                <div style={styles.votingSection}>
                  <div style={styles.votingGrid}>
                    {renderVotingButtons()}
                  </div>
                </div>
                <div style={styles.actionBar}>
                  <button
                    style={{...styles.btnDanger, opacity: selectedVote ? 1 : 0.6}}
                    onClick={submitVote}
                    disabled={!selectedVote}
                  >
                    Submit Vote
                  </button>
                </div>
              </div>
            )}

            {/* Players Section */}
            <div style={styles.playersSection}>
              <h3 style={styles.sectionTitle}>Players ({Object.keys(gameState.players).length})</h3>
              <div style={styles.playersGrid}>
                {renderPlayerCards()}
              </div>
            </div>

            {/* Ready System */}
            {gameState.gamePhase === 'waiting' && currentPlayer && (
              <div style={styles.actionBar}>
                <button
                  style={currentPlayer.isReady ? styles.btnSecondary : styles.btnOutline}
                  onClick={toggleReady}
                >
                  {currentPlayer.isReady ? 'Not Ready' : 'Ready'}
                </button>
                <button
                  style={styles.btnDanger}
                  onClick={quitGame}
                >
                  Quit
                </button>
                {currentPlayer.isHost && (
                  <button
                    style={{...styles.btnSecondary, background: '#dc3545'}}
                    onClick={resetGame}
                  >
                    Reset Game
                  </button>
                )}
              </div>
            )}

            {/* In-Game Controls */}
            {gameState.gamePhase !== 'waiting' && currentPlayer && (
              <div style={styles.actionBar}>
                <button
                  style={styles.btnDanger}
                  onClick={quitGame}
                >
                  Quit Game
                </button>
                {currentPlayer.isHost && (
                  <button
                    style={{...styles.btnSecondary, background: '#dc3545'}}
                    onClick={resetGame}
                  >
                    Reset Game
                  </button>
                )}
              </div>
            )}

            {/* Game Results */}
            {gameState.gamePhase === 'results' && gameState.gameResult && (
              <div style={styles.resultsSection}>
                <h2 style={{
                  ...styles.resultTitle,
                  color: (isUndercover && gameState.gameResult.winner === 'undercover') || (!isUndercover && gameState.gameResult.winner === 'civilians') ? '#28a745' : '#dc3545'
                }}>
                  {(isUndercover && gameState.gameResult.winner === 'undercover') || (!isUndercover && gameState.gameResult.winner === 'civilians') ? '🎉 YOU WIN!' : '💔 YOU LOSE!'}
                </h2>
                <p style={styles.resultText}>
                  You were {isUndercover ? 'UNDERCOVER' : 'CIVILIAN'} and your team {(isUndercover && gameState.gameResult.winner === 'undercover') || (!isUndercover && gameState.gameResult.winner === 'civilians') ? 'won' : 'lost'}! {gameState.gameResult.reason}
                </p>
                <div style={styles.actionBar}>
                  <button style={styles.btnPrimary} onClick={startNewGame}>
                    Play Again
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      <style jsx>{`
        .player-card {
          background: #f8f9fa;
          border: 2px solid #e9ecef;
          border-radius: 12px;
          padding: 20px;
          text-align: center;
          transition: all 0.3s ease;
          position: relative;
        }
        
        .player-card.current-turn {
          border-color: #007bff;
          background: #e3f2fd;
          box-shadow: 0 0 0 3px rgba(0,123,255,0.1);
        }
        
        .player-card.eliminated {
          opacity: 0.6;
          background: #f8d7da;
          border-color: #f5c6cb;
        }
        
        .player-card.ready {
          border-color: #28a745;
          background: #d4edda;
        }
        
        .player-name {
          font-size: 18px;
          font-weight: 600;
          margin-bottom: 8px;
          color: #2c3e50;
        }
        
        .player-status {
          font-size: 14px;
          color: #6c757d;
          margin-bottom: 8px;
        }
        
        .player-role {
          font-size: 12px;
          padding: 4px 8px;
          border-radius: 12px;
          font-weight: 600;
          display: inline-block;
        }
        
        .role-unknown {
          background: #e2e3e5;
          color: #383d41;
        }
        
        .description-item {
          background: white;
          border-radius: 8px;
          padding: 16px;
          margin-bottom: 12px;
          border-left: 4px solid #007bff;
        }
        
        .description-item:last-child {
          margin-bottom: 0;
        }
        
        .description-author {
          font-weight: 600;
          color: #2c3e50;
          margin-bottom: 8px;
        }
        
        .description-text {
          color: #495057;
          font-style: italic;
          line-height: 1.4;
        }
        
        .vote-button {
          padding: 12px;
          background: #f8f9fa;
          border: 2px solid #dee2e6;
          border-radius: 8px;
          cursor: pointer;
          transition: all 0.3s ease;
          text-align: center;
          font-weight: 600;
        }
        
        .vote-button:hover {
          border-color: #007bff;
          background: #e3f2fd;
        }
        
        .vote-button.selected {
          border-color: #007bff;
          background: #007bff;
          color: white;
        }
      `}</style>
    </div>
  );
}

const capitalizeFirst = (str) => {
  return str.charAt(0).toUpperCase() + str.slice(1);
};

const styles = {
  body: {
    margin: 0,
    padding: 0,
    fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
    background: '#ffffff',
    color: '#333333',
    minHeight: '100vh',
    display: 'flex',
    flexDirection: 'column',
    boxSizing: 'border-box',
    overflow: 'hidden',
  },
  topBar: {
    background: '#f8f9fa',
    borderBottom: '2px solid #e9ecef',
    padding: '16px 20px',
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
    boxSizing: 'border-box',
  },
  gameTitle: {
    fontSize: '24px',
    fontWeight: 'bold',
    color: '#2c3e50',
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
  },
  roundInfo: {
    display: 'flex',
    alignItems: 'center',
    gap: '16px',
    fontSize: '16px',
    color: '#6c757d',
  },
  roundBadge: {
    background: '#007bff',
    color: 'white',
    padding: '4px 12px',
    borderRadius: '12px',
    fontWeight: 600,
    fontSize: '14px',
  },
  phaseBadge: {
    background: '#28a745',
    color: 'white',
    padding: '4px 12px',
    borderRadius: '12px',
    fontWeight: 600,
    fontSize: '14px',
  },
  mainContainer: {
    flex: 1,
    padding: '20px',
    width: '100%',
    maxWidth: '100%',
    boxSizing: 'border-box',
    overflowY: 'auto',
    overflowX: 'hidden',
  },
  joinScreen: {
    textAlign: 'center',
    padding: '60px 20px',
  },
  joinTitle: {
    fontSize: '32px',
    marginBottom: '16px',
    color: '#2c3e50',
  },
  joinSubtitle: {
    fontSize: '18px',
    color: '#6c757d',
    marginBottom: '40px',
  },
  joinForm: {
    width: '100%',
    maxWidth: '400px',
    margin: '0 auto',
    display: 'flex',
    flexDirection: 'column',
    gap: '16px',
    boxSizing: 'border-box',
    padding: '0 20px',
  },
  inputGroup: {
    textAlign: 'left',
  },
  inputLabel: {
    display: 'block',
    fontWeight: 600,
    marginBottom: '8px',
    color: '#495057',
  },
  inputField: {
    width: '100%',
    padding: '12px 16px',
    border: '2px solid #dee2e6',
    borderRadius: '8px',
    fontSize: '16px',
    transition: 'border-color 0.3s ease',
    boxSizing: 'border-box',
  },
  btnPrimary: {
    padding: '12px 24px',
    border: 'none',
    borderRadius: '8px',
    fontSize: '16px',
    fontWeight: 600,
    cursor: 'pointer',
    transition: 'all 0.3s ease',
    textAlign: 'center',
    background: '#007bff',
    color: 'white',
  },
  btnSuccess: {
    padding: '12px 24px',
    border: 'none',
    borderRadius: '8px',
    fontSize: '16px',
    fontWeight: 600,
    cursor: 'pointer',
    transition: 'all 0.3s ease',
    background: '#28a745',
    color: 'white',
  },
  btnDanger: {
    padding: '12px 24px',
    border: 'none',
    borderRadius: '8px',
    fontSize: '16px',
    fontWeight: 600,
    cursor: 'pointer',
    transition: 'all 0.3s ease',
    background: '#dc3545',
    color: 'white',
  },
  btnSecondary: {
    padding: '12px 24px',
    border: 'none',
    borderRadius: '8px',
    fontSize: '16px',
    fontWeight: 600,
    cursor: 'pointer',
    transition: 'all 0.3s ease',
    background: '#6c757d',
    color: 'white',
  },
  btnOutline: {
    padding: '12px 24px',
    border: '2px solid #007bff',
    borderRadius: '8px',
    fontSize: '16px',
    fontWeight: 600,
    cursor: 'pointer',
    transition: 'all 0.3s ease',
    background: 'transparent',
    color: '#007bff',
  },
  phaseInstructions: {
    background: '#fff3cd',
    border: '2px solid #ffeaa7',
    borderRadius: '8px',
    padding: '16px',
    marginBottom: '24px',
    boxSizing: 'border-box',
  },
  instructionTitle: {
    fontSize: '18px',
    fontWeight: 600,
    color: '#856404',
    marginBottom: '8px',
  },
  instructionText: {
    color: '#856404',
    lineHeight: 1.5,
  },
  turnDisplay: {
    background: '#e3f2fd',
    border: '2px solid #2196f3',
    borderRadius: '12px',
    padding: '20px',
    marginBottom: '24px',
    textAlign: 'center',
    boxSizing: 'border-box',
  },
  currentTurnPlayer: {
    fontSize: '24px',
    fontWeight: 'bold',
    color: '#1976d2',
    marginBottom: '8px',
  },
  turnInstruction: {
    fontSize: '16px',
    color: '#424242',
  },
  gameContent: {
    background: '#f8f9fa',
    borderRadius: '12px',
    padding: '20px',
    marginBottom: '24px',
    border: '2px solid #e9ecef',
    boxSizing: 'border-box',
  },
  wordDisplay: {
    textAlign: 'center',
    marginBottom: '24px',
  },
  yourWord: {
    fontSize: '32px',
    fontWeight: 'bold',
    color: '#007bff',
    marginBottom: '8px',
  },
  wordHint: {
    fontSize: '16px',
    color: '#6c757d',
  },
  descriptionsHistory: {
    background: '#f8f9fa',
    borderRadius: '12px',
    padding: '20px',
    marginBottom: '24px',
    border: '2px solid #e9ecef',
    boxSizing: 'border-box',
  },
  sectionTitle: {
    fontSize: '20px',
    fontWeight: 600,
    marginBottom: '16px',
    color: '#2c3e50',
  },
  descriptionArea: {
    marginBottom: '24px',
  },
  descriptionInput: {
    width: '100%',
    minHeight: '100px',
    padding: '16px',
    border: '2px solid #dee2e6',
    borderRadius: '8px',
    fontSize: '16px',
    resize: 'vertical',
    fontFamily: 'inherit',
    boxSizing: 'border-box',
  },
  waitingForTurn: {
    background: '#fff3cd',
    border: '2px solid #ffeaa7',
    borderRadius: '8px',
    padding: '16px',
    textAlign: 'center',
    color: '#856404',
    marginBottom: '24px',
    boxSizing: 'border-box',
  },
  votingSection: {
    marginBottom: '24px',
  },
  votingGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fill, minmax(120px, 1fr))',
    gap: '12px',
  },
  playersSection: {
    marginBottom: '32px',
  },
  playersGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))',
    gap: '12px',
  },
  actionBar: {
    display: 'flex',
    justifyContent: 'center',
    gap: '16px',
    marginTop: '24px',
  },
  resultsSection: {
    textAlign: 'center',
    padding: '32px',
  },
  resultTitle: {
    fontSize: '28px',
    fontWeight: 'bold',
    marginBottom: '16px',
  },
  resultText: {
    fontSize: '18px',
    color: '#6c757d',
    marginBottom: '24px',
  },
};

export default Spyfall;


