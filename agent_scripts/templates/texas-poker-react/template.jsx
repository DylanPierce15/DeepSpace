import React, { useState, useEffect, useCallback, useMemo } from 'react';

// Constants
const RANKS = ['2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K', 'A'];
const SUITS = ['♠', '♥', '♦', '♣'];
const SUIT_COLORS = { '♠': '#000', '♥': '#e74c3c', '♦': '#e74c3c', '♣': '#000' };
const STARTING_CHIPS = 10000;
const SMALL_BLIND = 50;
const BIG_BLIND = 100;
const MIN_PLAYERS = 2;
const MAX_PLAYERS = 8;

function TexasPoker() {
  // Player ID generation
  const generatePlayerId = useCallback(() => {
    const getAuthToken = () => {
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
    };

    const authToken = getAuthToken();
    if (authToken) {
      try {
        const payload = JSON.parse(atob(authToken.split('.')[1]));
        return payload.sub;
      } catch (error) {
        console.log('Failed to parse auth token');
      }
    }

    // Generate device fingerprint
    const components = [
      navigator.userAgent,
      navigator.platform,
      navigator.language,
      screen.width + 'x' + screen.height,
      navigator.hardwareConcurrency || 'unknown'
    ];
    const fingerprint = components.join('||');
    let hash = 0;
    for (let i = 0; i < fingerprint.length; i++) {
      hash = ((hash << 5) - hash) + fingerprint.charCodeAt(i);
      hash = hash & hash;
    }
    return 'player_' + Math.abs(hash).toString(36);
  }, []);

  const playerId = useMemo(() => generatePlayerId(), [generatePlayerId]);

  // Game state
  const [gameState, setGameState] = useGlobalStorage('texas-poker-game', {
    players: {},
    gamePhase: 'lobby',
    deck: [],
    communityCards: [],
    pot: 0,
    currentBet: 0,
    dealerIndex: 0,
    activePlayerIndex: -1,
    playerOrder: [],
    handNumber: 0,
    lastAction: null,
    lastAggressorIndex: -1, // Tracks who made the last raise/bet
    shouldAutoAdvance: false, // Flag to trigger auto-advance
    winnerDetermined: false // Flag to prevent duplicate winner determination
  });

  // Local UI state
  const [playerName, setPlayerName] = useState('');
  const [nicknameInput, setNicknameInput] = useState('');
  const [hasJoined, setHasJoined] = useState(false);
  const [raiseAmount, setRaiseAmount] = useState('');
  const [showWinners, setShowWinners] = useState(false);
  const [winners, setWinners] = useState([]);

  // Check if player joined
  useEffect(() => {
    if (gameState.players[playerId]) {
      setHasJoined(true);
      setPlayerName(gameState.players[playerId].name);
    } else if (hasJoined) {
      // Player was removed (e.g., by host reset) - force back to join screen
      setHasJoined(false);
      setPlayerName('');
      setNicknameInput('');
      setShowWinners(false);
      setWinners([]);
    }
  }, [playerId, gameState.players, hasJoined]);

  // Deck creation and shuffling
  const createDeck = useCallback(() => {
    const deck = [];
    for (let suit of SUITS) {
      for (let rank of RANKS) {
        deck.push({ rank, suit });
      }
    }
    for (let i = deck.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [deck[i], deck[j]] = [deck[j], deck[i]];
    }
    return deck;
  }, []);

  // Hand evaluation
  const evaluateHand = useCallback((playerCards, communityCards) => {
    const allCards = [...playerCards, ...communityCards];
    if (allCards.length < 5) return { rank: 0, value: 0, name: 'High Card', kickers: [] };

    const rankValues = { '2': 2, '3': 3, '4': 4, '5': 5, '6': 6, '7': 7, '8': 8, '9': 9, '10': 10, 'J': 11, 'Q': 12, 'K': 13, 'A': 14 };
    const rankCounts = {};
    const suitCounts = {};
    
    allCards.forEach(card => {
      rankCounts[card.rank] = (rankCounts[card.rank] || 0) + 1;
      suitCounts[card.suit] = (suitCounts[card.suit] || 0) + 1;
    });

    // Get sorted values
    const values = allCards.map(c => rankValues[c.rank]).sort((a, b) => b - a);
    const uniqueValues = [...new Set(values)];
    
    // Check flush
    const flushSuit = Object.keys(suitCounts).find(suit => suitCounts[suit] >= 5);
    const isFlush = !!flushSuit;
    
    // Check straight
    let isStraight = false;
    let straightHigh = 0;
    for (let i = 0; i <= uniqueValues.length - 5; i++) {
      if (uniqueValues[i] - uniqueValues[i + 4] === 4) {
        isStraight = true;
        straightHigh = uniqueValues[i];
        break;
      }
    }
    // Check A-2-3-4-5 straight (wheel)
    if (!isStraight && uniqueValues.includes(14) && uniqueValues.includes(2) && uniqueValues.includes(3) && uniqueValues.includes(4) && uniqueValues.includes(5)) {
      isStraight = true;
      straightHigh = 5; // In wheel, 5 is high
    }

    // Get pairs, trips, quads
    const counts = Object.entries(rankCounts)
      .map(([rank, count]) => ({ rank, count, value: rankValues[rank] }))
      .sort((a, b) => b.count === a.count ? b.value - a.value : b.count - a.count);

    // Determine hand
    if (isStraight && isFlush) {
      if (straightHigh === 14) return { rank: 9, value: 14, name: 'Royal Flush', kickers: [] };
      return { rank: 8, value: straightHigh, name: 'Straight Flush', kickers: [] };
    }
    if (counts[0].count === 4) {
      const kicker = uniqueValues.find(v => v !== counts[0].value);
      return { rank: 7, value: counts[0].value, name: 'Four of a Kind', kickers: [kicker] };
    }
    if (counts[0].count === 3 && counts[1].count >= 2) {
      return { rank: 6, value: counts[0].value * 100 + counts[1].value, name: 'Full House', kickers: [] };
    }
    if (isFlush) {
      const flushCards = allCards.filter(c => c.suit === flushSuit).map(c => rankValues[c.rank]).sort((a, b) => b - a).slice(0, 5);
      return { rank: 5, value: flushCards[0], name: 'Flush', kickers: flushCards.slice(1) };
    }
    if (isStraight) {
      return { rank: 4, value: straightHigh, name: 'Straight', kickers: [] };
    }
    if (counts[0].count === 3) {
      const kickers = uniqueValues.filter(v => v !== counts[0].value).slice(0, 2);
      return { rank: 3, value: counts[0].value, name: 'Three of a Kind', kickers };
    }
    if (counts[0].count === 2 && counts[1].count === 2) {
      const kicker = uniqueValues.find(v => v !== counts[0].value && v !== counts[1].value);
      return { rank: 2, value: counts[0].value * 100 + counts[1].value, name: 'Two Pair', kickers: [kicker] };
    }
    if (counts[0].count === 2) {
      const kickers = uniqueValues.filter(v => v !== counts[0].value).slice(0, 3);
      return { rank: 1, value: counts[0].value, name: 'Pair', kickers };
    }
    return { rank: 0, value: uniqueValues[0], name: 'High Card', kickers: uniqueValues.slice(1, 5) };
  }, []);

  // Compare hands for tie-breaking
  const compareHands = (hand1, hand2) => {
    if (hand1.rank !== hand2.rank) return hand2.rank - hand1.rank;
    if (hand1.value !== hand2.value) return hand2.value - hand1.value;
    // Compare kickers
    for (let i = 0; i < Math.max(hand1.kickers.length, hand2.kickers.length); i++) {
      const k1 = hand1.kickers[i] || 0;
      const k2 = hand2.kickers[i] || 0;
      if (k1 !== k2) return k2 - k1;
    }
    return 0; // True tie
  };

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
    
    for (let pid in gameState.players) {
      if (gameState.players[pid].name === nickname && pid !== playerId) {
        alert('This nickname is already taken');
        return;
      }
    }

    const activePlayers = Object.values(gameState.players).filter(p => p.chips > 0 || p.isPlaying);
    if (activePlayers.length >= MAX_PLAYERS) {
      alert(`Maximum ${MAX_PLAYERS} players allowed`);
      return;
    }
    
    const isHost = Object.keys(gameState.players).length === 0;
    const newPlayerOrder = [...gameState.playerOrder];
    if (!newPlayerOrder.includes(playerId)) {
      newPlayerOrder.push(playerId);
    }
    
    setGameState({
      ...gameState,
      players: {
        ...gameState.players,
        [playerId]: {
          id: playerId,
          name: nickname,
          chips: STARTING_CHIPS,
          cards: [],
          isHost,
          isFolded: false,
          isAllIn: false,
          currentBet: 0,
          totalContribution: 0,
          hasActed: false
        }
      },
      playerOrder: newPlayerOrder
    });
    
    setPlayerName(nickname);
    setHasJoined(true);
  }, [nicknameInput, gameState, playerId, setGameState]);

  // Start new hand
  const startNewHand = useCallback(() => {
    const activePlayers = Object.values(gameState.players).filter(p => p.chips > 0);
    if (activePlayers.length < MIN_PLAYERS) {
      alert(`Need at least ${MIN_PLAYERS} players to start`);
      return;
    }

    const deck = createDeck();
    const newPlayers = { ...gameState.players };
    const activePlayerIds = gameState.playerOrder.filter(pid => newPlayers[pid] && newPlayers[pid].chips > 0);
    
    // Move dealer button
    const newDealerIndex = gameState.handNumber === 0 ? 0 : (gameState.dealerIndex + 1) % activePlayerIds.length;
    
    // Deal hole cards
    let cardIndex = 0;
    activePlayerIds.forEach(pid => {
      newPlayers[pid] = {
        ...newPlayers[pid],
        cards: [deck[cardIndex++], deck[cardIndex++]],
        isFolded: false,
        isAllIn: false,
        currentBet: 0,
        totalContribution: 0, // Track total bet for the hand (for side pots)
        hasActed: false
      };
    });

    // Post blinds
    const smallBlindIndex = (newDealerIndex + 1) % activePlayerIds.length;
    const bigBlindIndex = (newDealerIndex + 2) % activePlayerIds.length;
    const smallBlindId = activePlayerIds[smallBlindIndex];
    const bigBlindId = activePlayerIds[bigBlindIndex];

    const smallBlindAmount = Math.min(SMALL_BLIND, newPlayers[smallBlindId].chips);
    const bigBlindAmount = Math.min(BIG_BLIND, newPlayers[bigBlindId].chips);
    
    newPlayers[smallBlindId].chips -= smallBlindAmount;
    newPlayers[smallBlindId].currentBet = smallBlindAmount;
    newPlayers[smallBlindId].totalContribution = smallBlindAmount;
    newPlayers[bigBlindId].chips -= bigBlindAmount;
    newPlayers[bigBlindId].currentBet = bigBlindAmount;
    newPlayers[bigBlindId].totalContribution = bigBlindAmount;

    if (newPlayers[smallBlindId].chips === 0) newPlayers[smallBlindId].isAllIn = true;
    if (newPlayers[bigBlindId].chips === 0) newPlayers[bigBlindId].isAllIn = true;

    const pot = smallBlindAmount + bigBlindAmount;
    
    // PRE-FLOP: First to act is LEFT OF BIG BLIND (UTG)
    const firstToActIndex = (bigBlindIndex + 1) % activePlayerIds.length;

    setGameState({
      ...gameState,
      players: newPlayers,
      gamePhase: 'preflop',
      deck: deck.slice(cardIndex),
      communityCards: [],
      pot,
      currentBet: bigBlindAmount,
      dealerIndex: newDealerIndex,
      activePlayerIndex: firstToActIndex,
      playerOrder: activePlayerIds,
      handNumber: gameState.handNumber + 1,
      lastAggressorIndex: bigBlindIndex, // Big blind is initial aggressor in pre-flop
      shouldAutoAdvance: false, // Reset flags for new hand
      winnerDetermined: false,
      lastAction: `Hand #${gameState.handNumber + 1}. ${newPlayers[smallBlindId].name} posts SB (${smallBlindAmount}), ${newPlayers[bigBlindId].name} posts BB (${bigBlindAmount})`
    });
  }, [gameState, createDeck, setGameState]);

  // Check if betting round is complete
  const isBettingRoundComplete = useCallback(() => {
    const activePlayers = gameState.playerOrder.filter(pid => {
      const p = gameState.players[pid];
      return p && !p.isFolded && !p.isAllIn;
    });

    // If no active players, round is complete
    if (activePlayers.length === 0) return true;

    // If only one active player and they've matched the bet, round is complete
    if (activePlayers.length === 1) {
      const player = gameState.players[activePlayers[0]];
      return player.hasActed && player.currentBet === gameState.currentBet;
    }

    // All active players must have acted
    const allActed = activePlayers.every(pid => gameState.players[pid].hasActed);
    if (!allActed) return false;

    // All active players must match current bet
    const allMatched = activePlayers.every(pid => gameState.players[pid].currentBet === gameState.currentBet);
    if (!allMatched) return false;

    // Special case for pre-flop: if we're in pre-flop and there's a last aggressor (big blind),
    // they must have had a chance to act
    if (gameState.gamePhase === 'preflop' && gameState.lastAggressorIndex !== -1) {
      const lastAggressor = gameState.players[gameState.playerOrder[gameState.lastAggressorIndex]];
      // If last aggressor hasn't acted yet, round not complete
      if (lastAggressor && !lastAggressor.hasActed && !lastAggressor.isFolded && !lastAggressor.isAllIn) {
        return false;
      }
    }

    return true;
  }, [gameState]);

  // Calculate side pots based on all-in amounts
  const calculateSidePots = useCallback(() => {
    const players = gameState.playerOrder.map(pid => ({
      id: pid,
      ...gameState.players[pid]
    }));

    // Get all players who contributed (not folded at some point counted their bets)
    const contributions = players.map(p => ({
      id: p.id,
      amount: p.totalContribution || 0,
      isFolded: p.isFolded
    }));

    // Sort by contribution amount
    contributions.sort((a, b) => a.amount - b.amount);

    const pots = [];
    let previousAmount = 0;

    // Create pots for each unique contribution level
    for (let i = 0; i < contributions.length; i++) {
      const currentAmount = contributions[i].amount;
      
      if (currentAmount > previousAmount) {
        // Calculate pot amount: (currentAmount - previousAmount) * number of players still in
        const potAmount = (currentAmount - previousAmount) * (contributions.length - i);
        
        // Eligible players are those who contributed at least this much and didn't fold
        const eligiblePlayers = contributions
          .slice(i)
          .filter(c => !c.isFolded)
          .map(c => c.id);

        if (eligiblePlayers.length > 0) {
          pots.push({
            amount: potAmount,
            eligiblePlayers
          });
        }

        previousAmount = currentAmount;
      }
    }

    return pots;
  }, [gameState]);

  // Separate function to determine winner with side pot support
  const determineWinner = useCallback(() => {
    if (gameState.winnerDetermined || gameState.gamePhase !== 'showdown') return;

    const playersNotFolded = gameState.playerOrder.filter(pid => !gameState.players[pid].isFolded);
    
    if (playersNotFolded.length === 0) {
      // This shouldn't happen, but handle it
      setGameState({
        ...gameState,
        gamePhase: 'lobby',
        pot: 0,
        currentBet: 0,
        activePlayerIndex: -1,
        lastAggressorIndex: -1,
        shouldAutoAdvance: false,
        winnerDetermined: false
      });
      return;
    }

    if (playersNotFolded.length === 1) {
      // Everyone else folded - single winner gets everything
      const winnerId = playersNotFolded[0];
      const newPlayers = { ...gameState.players };
      const winAmount = gameState.pot;
      newPlayers[winnerId].chips += winAmount;

      setWinners([{
        playerId: winnerId,
        playerName: newPlayers[winnerId].name,
        amount: winAmount,
        hand: null
      }]);
      setShowWinners(true);

      setGameState({
        ...gameState,
        players: newPlayers,
        gamePhase: 'lobby',
        pot: 0,
        currentBet: 0,
        activePlayerIndex: -1,
        lastAggressorIndex: -1,
        shouldAutoAdvance: false,
        winnerDetermined: true,
        lastAction: `${newPlayers[winnerId].name} wins ${winAmount} chips!`
      });
      return;
    }

    // Multiple players - evaluate hands
    const handEvals = playersNotFolded.map(pid => ({
      playerId: pid,
      playerName: gameState.players[pid].name,
      hand: evaluateHand(gameState.players[pid].cards, gameState.communityCards),
      cards: gameState.players[pid].cards
    }));

    // Calculate side pots
    const sidePots = calculateSidePots();
    const newPlayers = { ...gameState.players };
    const allWinnerDetails = [];

    // Award each pot
    sidePots.forEach(pot => {
      // Find eligible players for this pot
      const eligibleHands = handEvals.filter(h => pot.eligiblePlayers.includes(h.playerId));
      
      if (eligibleHands.length === 0) return;

      // Sort to find best hand
      eligibleHands.sort((a, b) => compareHands(a.hand, b.hand));
      const bestHand = eligibleHands[0].hand;
      const potWinners = eligibleHands.filter(h => compareHands(h.hand, bestHand) === 0);

      // Split pot among winners
      const potShare = Math.floor(pot.amount / potWinners.length);
      
      potWinners.forEach(w => {
        newPlayers[w.playerId].chips += potShare;
        
        // Add to winner details (or update if already there)
        let existing = allWinnerDetails.find(wd => wd.playerId === w.playerId);
        if (existing) {
          existing.amount += potShare;
        } else {
          allWinnerDetails.push({
            playerId: w.playerId,
            playerName: w.playerName,
            amount: potShare,
            hand: w.hand,
            cards: w.cards
          });
        }
      });
    });

    setWinners(allWinnerDetails);
    setShowWinners(true);

    const totalAwarded = allWinnerDetails.reduce((sum, w) => sum + w.amount, 0);

    setGameState({
      ...gameState,
      players: newPlayers,
      gamePhase: 'lobby',
      pot: 0,
      currentBet: 0,
      activePlayerIndex: -1,
      lastAggressorIndex: -1,
      shouldAutoAdvance: false,
      winnerDetermined: true,
      lastAction: allWinnerDetails.length === 1 
        ? `${allWinnerDetails[0].playerName} wins ${totalAwarded} chips with ${allWinnerDetails[0].hand.name}!`
        : `${allWinnerDetails.length} players win pots (total: ${totalAwarded} chips)!`
    });
  }, [gameState, evaluateHand, compareHands, calculateSidePots, setGameState, setWinners, setShowWinners]);

  // Advance to next phase
  const advancePhase = useCallback(() => {
    const phases = ['preflop', 'flop', 'turn', 'river', 'showdown'];
    const currentIdx = phases.indexOf(gameState.gamePhase);
    
    // If already at showdown or beyond, winner determination happens separately
    if (currentIdx === -1 || currentIdx >= phases.length - 1) {
      return;
    }

    const nextPhase = phases[currentIdx + 1];
    let newCommunityCards = [...gameState.communityCards];
    let newDeck = [...gameState.deck];
    
    // Deal community cards
    if (nextPhase === 'flop') {
      newCommunityCards.push(newDeck.shift(), newDeck.shift(), newDeck.shift());
    } else if (nextPhase === 'turn' || nextPhase === 'river') {
      newCommunityCards.push(newDeck.shift());
    }

    // Reset for new betting round (but keep totalContribution for side pots)
    const newPlayers = { ...gameState.players };
    gameState.playerOrder.forEach(pid => {
      if (newPlayers[pid]) {
        newPlayers[pid].currentBet = 0;
        newPlayers[pid].hasActed = false;
        // totalContribution is NOT reset - it accumulates throughout the hand
      }
    });

    // POST-FLOP: First to act is LEFT OF DEALER
    const firstToActIndex = (gameState.dealerIndex + 1) % gameState.playerOrder.length;
    
    // Find first active player
    let activeIdx = firstToActIndex;
    let attempts = 0;
    while (attempts < gameState.playerOrder.length) {
      const pid = gameState.playerOrder[activeIdx];
      if (newPlayers[pid] && !newPlayers[pid].isFolded && !newPlayers[pid].isAllIn) {
        break;
      }
      activeIdx = (activeIdx + 1) % gameState.playerOrder.length;
      attempts++;
    }

    // Check if all players all-in
    const activePlayers = gameState.playerOrder.filter(pid => {
      const p = newPlayers[pid];
      return p && !p.isFolded && !p.isAllIn;
    });

    const newState = {
      ...gameState,
      players: newPlayers,
      gamePhase: nextPhase,
      communityCards: newCommunityCards,
      deck: newDeck,
      currentBet: 0,
      activePlayerIndex: activeIdx,
      lastAggressorIndex: -1, // Reset for new round
      shouldAutoAdvance: false, // Reset flag
      winnerDetermined: nextPhase === 'showdown' ? false : gameState.winnerDetermined, // Reset at showdown
      lastAction: `${nextPhase.charAt(0).toUpperCase() + nextPhase.slice(1)}`
    };

    setGameState(newState);
  }, [gameState, evaluateHand, compareHands, setGameState]);

  // Determine if we should auto-advance
  useEffect(() => {
    if (gameState.gamePhase === 'lobby' || gameState.shouldAutoAdvance) return;
    
    // Check if only one player left (not folded)
    const playersNotFolded = gameState.playerOrder.filter(pid => {
      const p = gameState.players[pid];
      return p && !p.isFolded;
    });
    
    if (playersNotFolded.length === 1) {
      setGameState({ ...gameState, shouldAutoAdvance: true });
      return;
    }

    // Check if all remaining players are all-in
    const activePlayers = gameState.playerOrder.filter(pid => {
      const p = gameState.players[pid];
      return p && !p.isFolded && !p.isAllIn;
    });
    
    if (activePlayers.length === 0) {
      setGameState({ ...gameState, shouldAutoAdvance: true });
      return;
    }

    // Check if betting round complete
    if (isBettingRoundComplete()) {
      setGameState({ ...gameState, shouldAutoAdvance: true });
      return;
    }
  }, [gameState, isBettingRoundComplete]);

  // Execute auto-advance when flagged
  useEffect(() => {
    if (!gameState.shouldAutoAdvance || gameState.gamePhase === 'lobby') return;
    
    const timer = setTimeout(() => {
      advancePhase();
    }, 800);
    
    return () => clearTimeout(timer);
  }, [gameState.shouldAutoAdvance, gameState.gamePhase, gameState.handNumber]);

  // Separate effect for winner determination at showdown
  useEffect(() => {
    if (gameState.gamePhase !== 'showdown' || gameState.winnerDetermined) return;
    
    const timer = setTimeout(() => {
      determineWinner();
    }, 1000);
    
    return () => clearTimeout(timer);
  }, [gameState.gamePhase, gameState.winnerDetermined, gameState.handNumber]);

  // Move to next player (only handles player rotation, not phase advancement)
  const moveToNext = useCallback((newState) => {
    // Use provided state or current state
    const state = newState || gameState;
    
    // Find next active player
    let nextIndex = (state.activePlayerIndex + 1) % state.playerOrder.length;
    let attempts = 0;
    
    while (attempts < state.playerOrder.length) {
      const nextPlayerId = state.playerOrder[nextIndex];
      const nextPlayer = state.players[nextPlayerId];
      
      if (nextPlayer && !nextPlayer.isFolded && !nextPlayer.isAllIn) {
        // Found next active player
        if (newState) {
          // If newState was provided, update it and return it
          return { ...newState, activePlayerIndex: nextIndex };
        } else {
          // Otherwise update the global state
          setGameState({ ...state, activePlayerIndex: nextIndex });
          return;
        }
      }
      
      nextIndex = (nextIndex + 1) % state.playerOrder.length;
      attempts++;
    }
    
    // No active players found, return state as-is
    return newState || state;
  }, [gameState, setGameState]);

  // Player actions
  const fold = useCallback(() => {
    if (gameState.playerOrder[gameState.activePlayerIndex] !== playerId) return;

    const newPlayers = { ...gameState.players };
    newPlayers[playerId].isFolded = true;
    newPlayers[playerId].hasActed = true;

    const newState = {
      ...gameState,
      players: newPlayers,
      shouldAutoAdvance: false, // Reset to allow auto-advance detection
      lastAction: `${newPlayers[playerId].name} folds`
    };
    
    // Move to next player and update state
    const stateWithNextPlayer = moveToNext(newState);
    setGameState(stateWithNextPlayer);
  }, [gameState, playerId, setGameState, moveToNext]);

  const check = useCallback(() => {
    if (gameState.playerOrder[gameState.activePlayerIndex] !== playerId) return;
    
    if (gameState.players[playerId].currentBet !== gameState.currentBet) {
      alert('Cannot check - there is a bet to call');
      return;
    }

    const newPlayers = { ...gameState.players };
    newPlayers[playerId].hasActed = true;

    const newState = {
      ...gameState,
      players: newPlayers,
      shouldAutoAdvance: false, // Reset to allow auto-advance detection
      lastAction: `${newPlayers[playerId].name} checks`
    };
    
    // Move to next player and update state
    const stateWithNextPlayer = moveToNext(newState);
    setGameState(stateWithNextPlayer);
  }, [gameState, playerId, setGameState, moveToNext]);

  const call = useCallback(() => {
    if (gameState.playerOrder[gameState.activePlayerIndex] !== playerId) return;

    const player = gameState.players[playerId];
    const callAmount = Math.min(gameState.currentBet - player.currentBet, player.chips);
    
    if (callAmount <= 0) return;

    const newPlayers = { ...gameState.players };
    newPlayers[playerId].chips -= callAmount;
    newPlayers[playerId].currentBet += callAmount;
    newPlayers[playerId].totalContribution = (newPlayers[playerId].totalContribution || 0) + callAmount;
    newPlayers[playerId].hasActed = true;
    
    if (newPlayers[playerId].chips === 0) {
      newPlayers[playerId].isAllIn = true;
    }

    const newState = {
      ...gameState,
      players: newPlayers,
      pot: gameState.pot + callAmount,
      shouldAutoAdvance: false, // Reset to allow auto-advance detection
      lastAction: `${player.name} calls ${callAmount}`
    };
    
    // Move to next player and update state
    const stateWithNextPlayer = moveToNext(newState);
    setGameState(stateWithNextPlayer);
  }, [gameState, playerId, setGameState, moveToNext]);

  const raise = useCallback(() => {
    if (gameState.playerOrder[gameState.activePlayerIndex] !== playerId) return;

    const player = gameState.players[playerId];
    const amount = parseInt(raiseAmount);
    
    if (!amount || amount <= 0) {
      alert('Please enter a valid raise amount');
      return;
    }

    const minRaise = gameState.currentBet + BIG_BLIND;
    const maxRaise = player.chips + player.currentBet;

    if (amount < minRaise) {
      alert(`Minimum raise is ${minRaise}`);
      return;
    }

    if (amount > maxRaise) {
      alert(`Maximum raise is ${maxRaise}`);
      return;
    }

    const raiseChips = amount - player.currentBet;
    
    if (raiseChips > player.chips) {
      alert('Not enough chips');
      return;
    }

    const newPlayers = { ...gameState.players };
    newPlayers[playerId].chips -= raiseChips;
    newPlayers[playerId].currentBet = amount;
    newPlayers[playerId].totalContribution = (newPlayers[playerId].totalContribution || 0) + raiseChips;
    newPlayers[playerId].hasActed = true;
    
    if (newPlayers[playerId].chips === 0) {
      newPlayers[playerId].isAllIn = true;
    }

    // Reset all other players' hasActed (they need to respond to raise)
    gameState.playerOrder.forEach(pid => {
      if (pid !== playerId && newPlayers[pid] && !newPlayers[pid].isFolded && !newPlayers[pid].isAllIn) {
        newPlayers[pid].hasActed = false;
      }
    });

    const newState = {
      ...gameState,
      players: newPlayers,
      pot: gameState.pot + raiseChips,
      currentBet: amount,
      lastAggressorIndex: gameState.activePlayerIndex,
      shouldAutoAdvance: false, // Reset to allow auto-advance detection
      lastAction: `${player.name} raises to ${amount}`
    };

    setRaiseAmount('');
    
    // Move to next player and update state
    const stateWithNextPlayer = moveToNext(newState);
    setGameState(stateWithNextPlayer);
  }, [gameState, playerId, raiseAmount, setGameState, moveToNext]);

  const allIn = useCallback(() => {
    if (gameState.playerOrder[gameState.activePlayerIndex] !== playerId) return;

    const player = gameState.players[playerId];
    const allInAmount = player.chips;
    const totalBet = player.currentBet + allInAmount;
    const isRaise = totalBet > gameState.currentBet;

    const newPlayers = { ...gameState.players };
    newPlayers[playerId].chips = 0;
    newPlayers[playerId].currentBet = totalBet;
    newPlayers[playerId].totalContribution = (newPlayers[playerId].totalContribution || 0) + allInAmount;
    newPlayers[playerId].isAllIn = true;
    newPlayers[playerId].hasActed = true;

    // If this all-in is a raise, reset other players' actions
    if (isRaise) {
      gameState.playerOrder.forEach(pid => {
        if (pid !== playerId && newPlayers[pid] && !newPlayers[pid].isFolded && !newPlayers[pid].isAllIn) {
          newPlayers[pid].hasActed = false;
        }
      });
    }

    const newCurrentBet = Math.max(gameState.currentBet, totalBet);

    const newState = {
      ...gameState,
      players: newPlayers,
      pot: gameState.pot + allInAmount,
      currentBet: newCurrentBet,
      lastAggressorIndex: isRaise ? gameState.activePlayerIndex : gameState.lastAggressorIndex,
      shouldAutoAdvance: false, // Reset to allow auto-advance detection
      lastAction: `${player.name} goes all-in (${totalBet})`
    };
    
    // Move to next player and update state
    const stateWithNextPlayer = moveToNext(newState);
    setGameState(stateWithNextPlayer);
  }, [gameState, playerId, setGameState, moveToNext]);

  // Reset and rebuy
  const resetGame = useCallback(() => {
    const player = gameState.players[playerId];
    if (!player?.isHost) {
      alert('Only the host can reset the game');
      return;
    }
    
    if (!confirm('Reset the entire game? This will clear all players and everyone must rejoin.')) {
      return;
    }

    // Reset global state - this will force all users back to join screen
    setGameState({
      players: {},
      gamePhase: 'lobby',
      deck: [],
      communityCards: [],
      pot: 0,
      currentBet: 0,
      dealerIndex: 0,
      activePlayerIndex: -1,
      playerOrder: [],
      handNumber: 0,
      lastAction: null,
      lastAggressorIndex: -1,
      shouldAutoAdvance: false,
      winnerDetermined: false
    });

    // Reset local state for this player
    setHasJoined(false);
    setPlayerName('');
    setNicknameInput('');
    setShowWinners(false);
    setWinners([]);
  }, [gameState, playerId, setGameState]);

  const rebuy = useCallback(() => {
    const player = gameState.players[playerId];
    if (!player) {
      alert('Player not found');
      return;
    }
    
    if (player.chips > 0) {
      alert('You still have chips!');
      return;
    }

    if (!confirm(`Rebuy ${STARTING_CHIPS} chips?`)) {
      return;
    }

    const newPlayers = { ...gameState.players };
    newPlayers[playerId].chips = STARTING_CHIPS;

    setGameState({
      ...gameState,
      players: newPlayers,
      lastAction: `${player.name} rebuys ${STARTING_CHIPS} chips`
    });
  }, [gameState, playerId, setGameState]);

  // Render functions
  const currentPlayer = gameState.players[playerId];
  const isMyTurn = gameState.playerOrder[gameState.activePlayerIndex] === playerId;
  const canCheck = isMyTurn && currentPlayer?.currentBet === gameState.currentBet;
  const needToCall = currentPlayer?.currentBet < gameState.currentBet;
  const canCall = isMyTurn && needToCall;
  const callAmount = needToCall ? gameState.currentBet - (currentPlayer?.currentBet || 0) : 0;

  const renderCard = (card, faceDown = false) => {
    if (faceDown) {
      return (
        <div style={styles.card}>
          <div style={styles.cardBack}>🂠</div>
        </div>
      );
    }

    return (
      <div style={{ ...styles.card, ...styles.cardFront }}>
        <div style={{ ...styles.cardRank, color: SUIT_COLORS[card.suit] }}>
          {card.rank}
        </div>
        <div style={{ ...styles.cardSuit, color: SUIT_COLORS[card.suit] }}>
          {card.suit}
        </div>
      </div>
    );
  };

  const renderPlayerSeat = (pid, position) => {
    const player = gameState.players[pid];
    if (!player) return null;

    const isDealer = gameState.playerOrder[gameState.dealerIndex] === pid;
    const isActive = gameState.playerOrder[gameState.activePlayerIndex] === pid && gameState.gamePhase !== 'lobby';
    const isCurrentPlayer = pid === playerId;

    return (
      <div key={pid} style={{ ...styles.playerSeat, ...styles[`seat${position}`] }}>
        <div style={{
          ...styles.playerCard,
          ...(isActive ? styles.activePlayer : {}),
          ...(player.isFolded ? styles.foldedPlayer : {})
        }}>
          {isDealer && <div style={styles.dealerButton}>D</div>}
          <div style={styles.playerName}>
            {player.name} {player.isHost && '👑'}
          </div>
          <div style={styles.playerChips}>💰 {player.chips}</div>
          
          {player.currentBet > 0 && gameState.gamePhase !== 'lobby' && (
            <div style={styles.playerBet}>Bet: {player.currentBet}</div>
          )}
          
          {player.isAllIn && <div style={styles.allInBadge}>ALL IN</div>}
          {player.isFolded && <div style={styles.foldedBadge}>FOLDED</div>}
          
          {/* Only show cards at showdown */}
          {gameState.gamePhase === 'showdown' && player.cards && !isCurrentPlayer && !player.isFolded && (
            <div style={styles.playerCards}>
              {renderCard(player.cards[0])}
              {renderCard(player.cards[1])}
            </div>
          )}
        </div>
      </div>
    );
  };

  return (
    <div style={styles.container}>
      {!hasJoined ? (
        <div style={styles.joinScreen}>
          <h1 style={styles.title}>🃏 Texas Hold'em Poker</h1>
          <p style={styles.subtitle}>Join the table and play No-Limit Hold'em</p>
          
          <div style={styles.joinForm}>
            <input
              type="text"
              style={styles.input}
              placeholder="Enter your name"
              maxLength={20}
              value={nicknameInput}
              onChange={(e) => setNicknameInput(e.target.value)}
              onKeyPress={(e) => e.key === 'Enter' && joinGame()}
            />
            <button style={styles.btnPrimary} onClick={joinGame}>
              Join Table
            </button>
          </div>

          <div style={styles.gameInfo}>
            <div style={styles.infoItem}>
              <span style={styles.infoLabel}>Starting Chips:</span>
              <span style={styles.infoValue}>{STARTING_CHIPS}</span>
            </div>
            <div style={styles.infoItem}>
              <span style={styles.infoLabel}>Small Blind:</span>
              <span style={styles.infoValue}>{SMALL_BLIND}</span>
            </div>
            <div style={styles.infoItem}>
              <span style={styles.infoLabel}>Big Blind:</span>
              <span style={styles.infoValue}>{BIG_BLIND}</span>
            </div>
            <div style={styles.infoItem}>
              <span style={styles.infoLabel}>Players:</span>
              <span style={styles.infoValue}>{MIN_PLAYERS}-{MAX_PLAYERS}</span>
            </div>
          </div>
        </div>
      ) : (
        <div style={styles.gameContainer}>
          {/* Your Cards - Above table */}
          {gameState.gamePhase !== 'lobby' && currentPlayer?.cards && currentPlayer.cards.length > 0 && (
            <div style={styles.yourCardsArea}>
              <div style={styles.yourCardsLabel}>Your Hand</div>
              <div style={styles.yourCardsDisplay}>
                {renderCard(currentPlayer.cards[0])}
                {renderCard(currentPlayer.cards[1])}
              </div>
            </div>
          )}

          {/* Poker Table */}
          <div style={styles.pokerTable}>
            <div style={styles.communityArea}>
              <div style={styles.communityCards}>
                {gameState.communityCards.length > 0 ? (
                  gameState.communityCards.map((card, idx) => (
                    <div key={idx}>{renderCard(card)}</div>
                  ))
                ) : (
                  gameState.gamePhase !== 'lobby' && (
                    <div style={styles.emptyCards}>
                      {[1, 2, 3, 4, 5].map(i => (
                        <div key={i} style={styles.emptyCard}></div>
                      ))}
                    </div>
                  )
                )}
              </div>
              
              {gameState.gamePhase !== 'lobby' && (
                <div style={styles.potDisplay}>
                  <div style={styles.potLabel}>POT</div>
                  <div style={styles.potAmount}>💰 {gameState.pot}</div>
                  {gameState.currentBet > 0 && (
                    <div style={styles.currentBetDisplay}>Current Bet: {gameState.currentBet}</div>
                  )}
                </div>
              )}

              {gameState.lastAction && (
                <div style={styles.lastAction}>{gameState.lastAction}</div>
              )}
            </div>

            {gameState.playerOrder.map((pid, idx) => renderPlayerSeat(pid, idx))}
          </div>

          {/* Controls */}
          <div style={styles.controls}>
            {gameState.gamePhase === 'lobby' ? (
              <div style={styles.lobbyControls}>
                <div style={styles.statusText}>
                  {Object.keys(gameState.players).filter(pid => gameState.players[pid].chips > 0).length} / {MAX_PLAYERS} players
                </div>
                
                {/* Rebuy button - show if player has no chips */}
                {currentPlayer?.chips === 0 && (
                  <button style={styles.btnSuccess} onClick={rebuy}>
                    Rebuy ({STARTING_CHIPS} chips)
                  </button>
                )}
                
                {/* Start New Hand button - show for all players with chips, only host can click */}
                {currentPlayer?.chips > 0 && (
                  currentPlayer?.isHost ? (
                    <button 
                      style={styles.btnSuccess} 
                      onClick={startNewHand}
                      disabled={Object.values(gameState.players).filter(p => p.chips > 0).length < MIN_PLAYERS}
                    >
                      Start New Hand
                    </button>
                  ) : (
                    <div style={styles.statusText}>
                      Waiting for host to start...
                    </div>
                  )
                )}
                
                {/* Reset button - only for host */}
                {currentPlayer?.isHost && (
                  <button style={styles.btnDanger} onClick={resetGame}>
                    Reset Game
                  </button>
                )}
              </div>
            ) : (
              <div style={styles.actionControls}>
                <div style={styles.gamePhaseDisplay}>
                  {gameState.gamePhase.toUpperCase()} - Hand #{gameState.handNumber}
                  {currentPlayer && (
                    <div style={styles.playerBetInfo}>
                      Your bet: {currentPlayer.currentBet} | To call: {callAmount}
                    </div>
                  )}
                </div>
                
                {isMyTurn && !currentPlayer?.isFolded && !currentPlayer?.isAllIn ? (
                  <div style={styles.actionButtons}>
                    <button style={styles.btnDanger} onClick={fold}>
                      Fold
                    </button>
                    
                    {canCheck ? (
                      <button style={styles.btnSecondary} onClick={check}>
                        Check
                      </button>
                    ) : (
                      <button style={styles.btnWarning} onClick={call} disabled={!canCall}>
                        Call {callAmount}
                      </button>
                    )}
                    
                    <div style={styles.raiseGroup}>
                      <input
                        type="number"
                        style={styles.raiseInput}
                        placeholder={`Min: ${gameState.currentBet + BIG_BLIND}`}
                        value={raiseAmount}
                        onChange={(e) => setRaiseAmount(e.target.value)}
                      />
                      <button style={styles.btnPrimary} onClick={raise}>
                        Raise
                      </button>
                    </div>
                    
                    <button style={styles.btnAllIn} onClick={allIn}>
                      All-In ({currentPlayer?.chips})
                    </button>
                  </div>
                ) : (
                  <div style={styles.waitingText}>
                    {currentPlayer?.isFolded ? 'You folded' : 
                     currentPlayer?.isAllIn ? 'You are all-in' :
                     'Waiting for other players...'}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Winner Modal */}
          {showWinners && (
            <div style={styles.modal} onClick={(e) => e.stopPropagation()}>
              <div style={styles.modalContent} onClick={(e) => e.stopPropagation()}>
                <h2 style={styles.modalTitle}>
                  {winners.length === 1 ? '🏆 Winner! 🏆' : '🏆 Split Pot! 🏆'}
                </h2>
                
                {/* Show winners prominently */}
                {winners.map((winner, idx) => (
                  <div key={idx} style={styles.winnerInfo}>
                    <div style={styles.winnerName}>
                      🎉 {winner.playerName.toUpperCase()} WINS! 🎉
                    </div>
                    {winner.hand && <div style={styles.winnerHand}>
                      <strong style={{ fontSize: '20px', color: '#27ae60' }}>
                        {winner.hand.name}
                      </strong>
                    </div>}
                    <div style={styles.winnerAmount}>Won: 💰 {winner.amount} chips</div>
                    {winner.cards && (
                      <div style={styles.winnerCards}>
                        {winner.cards.map((card, i) => (
                          <div key={i}>{renderCard(card)}</div>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
                <div style={styles.modalButtons}>
                  <button style={styles.btnSuccess} onClick={() => {
                    setShowWinners(false);
                  }}>
                    Close
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

const styles = {
  container: {
    fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
    background: 'linear-gradient(135deg, #1e3c72 0%, #2a5298 100%)',
    minHeight: '100vh',
    display: 'flex',
    alignItems: 'flex-start',
    justifyContent: 'center',
    padding: '20px',
    boxSizing: 'border-box',
    overflowY: 'auto',
    overflowX: 'hidden'
  },
  joinScreen: {
    background: 'white',
    borderRadius: '20px',
    padding: '60px 40px',
    maxWidth: '500px',
    width: '100%',
    textAlign: 'center',
    boxShadow: '0 20px 60px rgba(0,0,0,0.3)',
    margin: 'auto'
  },
  title: {
    fontSize: '48px',
    margin: '0 0 16px 0',
    color: '#2c3e50'
  },
  subtitle: {
    fontSize: '18px',
    color: '#7f8c8d',
    margin: '0 0 40px 0'
  },
  joinForm: {
    display: 'flex',
    flexDirection: 'column',
    gap: '16px',
    marginBottom: '40px'
  },
  input: {
    padding: '16px',
    fontSize: '16px',
    border: '2px solid #e0e0e0',
    borderRadius: '10px',
    boxSizing: 'border-box'
  },
  btnPrimary: {
    padding: '16px',
    fontSize: '18px',
    fontWeight: '600',
    background: '#27ae60',
    color: 'white',
    border: 'none',
    borderRadius: '10px',
    cursor: 'pointer'
  },
  btnSecondary: {
    padding: '12px 24px',
    fontSize: '16px',
    fontWeight: '600',
    background: '#95a5a6',
    color: 'white',
    border: 'none',
    borderRadius: '8px',
    cursor: 'pointer'
  },
  btnDanger: {
    padding: '12px 24px',
    fontSize: '16px',
    fontWeight: '600',
    background: '#e74c3c',
    color: 'white',
    border: 'none',
    borderRadius: '8px',
    cursor: 'pointer'
  },
  btnWarning: {
    padding: '12px 24px',
    fontSize: '16px',
    fontWeight: '600',
    background: '#f39c12',
    color: 'white',
    border: 'none',
    borderRadius: '8px',
    cursor: 'pointer'
  },
  btnSuccess: {
    padding: '12px 24px',
    fontSize: '16px',
    fontWeight: '600',
    background: '#27ae60',
    color: 'white',
    border: 'none',
    borderRadius: '8px',
    cursor: 'pointer'
  },
  btnAllIn: {
    padding: '12px 24px',
    fontSize: '16px',
    fontWeight: '600',
    background: '#9b59b6',
    color: 'white',
    border: 'none',
    borderRadius: '8px',
    cursor: 'pointer'
  },
  gameInfo: {
    display: 'grid',
    gridTemplateColumns: '1fr 1fr',
    gap: '16px',
    padding: '24px',
    background: '#f8f9fa',
    borderRadius: '12px'
  },
  infoItem: {
    display: 'flex',
    flexDirection: 'column',
    gap: '4px'
  },
  infoLabel: {
    fontSize: '14px',
    color: '#7f8c8d',
    fontWeight: '500'
  },
  infoValue: {
    fontSize: '20px',
    color: '#2c3e50',
    fontWeight: '700'
  },
  gameContainer: {
    width: '100%',
    maxWidth: '1400px',
    display: 'flex',
    flexDirection: 'column',
    gap: '20px',
    margin: '0 auto'
  },
  yourCardsArea: {
    background: 'rgba(255,255,255,0.95)',
    borderRadius: '16px',
    padding: '20px',
    boxShadow: '0 8px 24px rgba(0,0,0,0.3)',
    textAlign: 'center'
  },
  yourCardsLabel: {
    fontSize: '18px',
    fontWeight: '700',
    color: '#2c3e50',
    marginBottom: '12px'
  },
  yourCardsDisplay: {
    display: 'flex',
    gap: '16px',
    justifyContent: 'center',
    alignItems: 'center'
  },
  pokerTable: {
    background: 'linear-gradient(135deg, #0b7a38 0%, #097a36 100%)',
    borderRadius: '200px',
    padding: '60px 40px',
    position: 'relative',
    minHeight: '600px',
    border: '12px solid #8b4513',
    boxShadow: '0 20px 60px rgba(0,0,0,0.4), inset 0 0 60px rgba(0,0,0,0.2)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center'
  },
  communityArea: {
    position: 'absolute',
    top: '50%',
    left: '50%',
    transform: 'translate(-50%, -50%)',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: '20px',
    zIndex: 1
  },
  communityCards: {
    display: 'flex',
    gap: '12px',
    flexWrap: 'wrap',
    justifyContent: 'center'
  },
  emptyCards: {
    display: 'flex',
    gap: '12px'
  },
  emptyCard: {
    width: '80px',
    height: '112px',
    background: 'rgba(255,255,255,0.1)',
    borderRadius: '8px',
    border: '2px dashed rgba(255,255,255,0.3)'
  },
  card: {
    width: '80px',
    height: '112px',
    background: 'white',
    borderRadius: '8px',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    boxShadow: '0 4px 8px rgba(0,0,0,0.3)',
    position: 'relative',
    border: '2px solid #ddd'
  },
  cardBack: {
    width: '100%',
    height: '100%',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
    borderRadius: '6px',
    color: 'white',
    fontSize: '48px'
  },
  cardFront: {
    padding: '8px'
  },
  cardRank: {
    fontSize: '24px',
    fontWeight: 'bold',
    position: 'absolute',
    top: '4px',
    left: '8px'
  },
  cardSuit: {
    fontSize: '36px'
  },
  potDisplay: {
    background: 'rgba(0,0,0,0.7)',
    borderRadius: '12px',
    padding: '16px 32px',
    textAlign: 'center',
    border: '3px solid #ffd700'
  },
  potLabel: {
    color: '#ffd700',
    fontSize: '14px',
    fontWeight: '700',
    letterSpacing: '2px'
  },
  potAmount: {
    color: 'white',
    fontSize: '28px',
    fontWeight: '700',
    marginTop: '4px'
  },
  currentBetDisplay: {
    color: '#ffd700',
    fontSize: '14px',
    fontWeight: '600',
    marginTop: '8px'
  },
  lastAction: {
    background: 'rgba(0,0,0,0.6)',
    color: 'white',
    padding: '8px 16px',
    borderRadius: '8px',
    fontSize: '14px',
    textAlign: 'center',
    maxWidth: '400px'
  },
  playerSeat: {
    position: 'absolute',
    zIndex: 2
  },
  seat0: { top: '5%', left: '50%', transform: 'translateX(-50%)' },
  seat1: { top: '12%', right: '12%' },
  seat2: { top: '50%', right: '3%', transform: 'translateY(-50%)' },
  seat3: { bottom: '12%', right: '12%' },
  seat4: { bottom: '5%', left: '50%', transform: 'translateX(-50%)' },
  seat5: { bottom: '12%', left: '12%' },
  seat6: { top: '50%', left: '3%', transform: 'translateY(-50%)' },
  seat7: { top: '12%', left: '12%' },
  playerCard: {
    background: 'rgba(255,255,255,0.95)',
    borderRadius: '12px',
    padding: '16px',
    minWidth: '140px',
    border: '3px solid transparent',
    boxShadow: '0 4px 12px rgba(0,0,0,0.3)',
    transition: 'all 0.3s',
    position: 'relative'
  },
  activePlayer: {
    border: '3px solid #ffd700',
    boxShadow: '0 0 20px rgba(255, 215, 0, 0.6)'
  },
  foldedPlayer: {
    opacity: 0.5
  },
  playerName: {
    fontSize: '16px',
    fontWeight: '700',
    color: '#2c3e50',
    marginBottom: '4px',
    textAlign: 'center'
  },
  playerChips: {
    fontSize: '18px',
    fontWeight: '600',
    color: '#27ae60',
    textAlign: 'center',
    marginBottom: '8px'
  },
  playerBet: {
    fontSize: '12px',
    color: '#e67e22',
    textAlign: 'center',
    fontWeight: '600',
    marginBottom: '8px'
  },
  playerCards: {
    display: 'flex',
    gap: '4px',
    justifyContent: 'center',
    marginTop: '8px'
  },
  dealerButton: {
    position: 'absolute',
    top: '-12px',
    right: '-12px',
    width: '32px',
    height: '32px',
    borderRadius: '50%',
    background: 'white',
    border: '3px solid #ffd700',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontWeight: '700',
    fontSize: '16px',
    color: '#2c3e50',
    boxShadow: '0 2px 8px rgba(0,0,0,0.3)'
  },
  allInBadge: {
    background: '#9b59b6',
    color: 'white',
    padding: '4px 8px',
    borderRadius: '4px',
    fontSize: '11px',
    fontWeight: '700',
    textAlign: 'center',
    marginTop: '4px'
  },
  foldedBadge: {
    background: '#95a5a6',
    color: 'white',
    padding: '4px 8px',
    borderRadius: '4px',
    fontSize: '11px',
    fontWeight: '700',
    textAlign: 'center',
    marginTop: '4px'
  },
  controls: {
    background: 'rgba(255,255,255,0.95)',
    borderRadius: '20px',
    padding: '24px',
    boxShadow: '0 8px 24px rgba(0,0,0,0.3)'
  },
  lobbyControls: {
    display: 'flex',
    gap: '16px',
    alignItems: 'center',
    justifyContent: 'center',
    flexWrap: 'wrap'
  },
  statusText: {
    fontSize: '18px',
    fontWeight: '600',
    color: '#2c3e50'
  },
  actionControls: {
    display: 'flex',
    flexDirection: 'column',
    gap: '16px'
  },
  gamePhaseDisplay: {
    fontSize: '20px',
    fontWeight: '700',
    color: '#2c3e50',
    textAlign: 'center',
    padding: '12px',
    background: '#f8f9fa',
    borderRadius: '12px'
  },
  playerBetInfo: {
    fontSize: '14px',
    fontWeight: '500',
    color: '#7f8c8d',
    marginTop: '8px'
  },
  actionButtons: {
    display: 'flex',
    gap: '12px',
    flexWrap: 'wrap',
    justifyContent: 'center'
  },
  raiseGroup: {
    display: 'flex',
    gap: '8px'
  },
  raiseInput: {
    padding: '12px',
    fontSize: '16px',
    border: '2px solid #e0e0e0',
    borderRadius: '8px',
    width: '150px',
    boxSizing: 'border-box'
  },
  waitingText: {
    fontSize: '18px',
    color: '#7f8c8d',
    textAlign: 'center',
    padding: '20px'
  },
  modal: {
    position: 'fixed',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    background: 'rgba(0,0,0,0.8)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 1000
  },
  modalContent: {
    background: 'white',
    borderRadius: '20px',
    padding: '40px',
    maxWidth: '500px',
    width: '90%',
    maxHeight: '80vh',
    overflow: 'auto'
  },
  modalTitle: {
    fontSize: '32px',
    color: '#2c3e50',
    marginBottom: '24px',
    textAlign: 'center'
  },
  winnerInfo: {
    background: '#f8f9fa',
    borderRadius: '12px',
    padding: '20px',
    marginBottom: '16px',
    textAlign: 'center'
  },
  winnerName: {
    fontSize: '24px',
    fontWeight: '700',
    color: '#2c3e50',
    marginBottom: '8px'
  },
  winnerHand: {
    fontSize: '18px',
    color: '#27ae60',
    fontWeight: '600',
    marginBottom: '8px'
  },
  winnerAmount: {
    fontSize: '20px',
    color: '#e67e22',
    fontWeight: '700',
    marginBottom: '12px'
  },
  winnerCards: {
    display: 'flex',
    gap: '8px',
    justifyContent: 'center'
  },
  modalButtons: {
    display: 'flex',
    gap: '12px',
    justifyContent: 'center',
    marginTop: '20px'
  }
};

export default TexasPoker;

