import React, { useState, useEffect, useCallback, useMemo } from 'react';

function Sheeeeeeeeeeep() {
  // Game configuration
  const TILE_TYPES = useMemo(() => ['🐎', '🐏', '🦙', '🐐', '🦌', '🐄', '🐕', '🐈', '🐰', '🐻', '🐼', '🦊'], []);
  const MAX_SLOTS = 7;
  const TILES_PER_TYPE = 3;
  const MATCH_COUNT = 3;
  const LEVEL_CONFIGS = useMemo(() => ({
    1: { types: 6, layers: 3, density: 0.6, description: "Tutorial Level" },
    2: { types: 10, layers: 6, density: 1.2, description: "The Challenge" }, 
    3: { types: 12, layers: 6, density: 4.0, description: "Nearly Impossible" }
  }), []);
  
  // Game state
  const [level, setLevel] = useState(1);
  const [tiles, setTiles] = useState([]);
  const [slots, setSlots] = useState([]);
  const [score, setScore] = useState(0);
  const [hints, setHints] = useState(3);
  const [gameRunning, setGameRunning] = useState(false);
  const [elapsedTime, setElapsedTime] = useState(0);
  const [powerUps, setPowerUps] = useState({ shuffle: 2, undo: 2, bomb: 1, freeze: 1 });
  const [moveHistory, setMoveHistory] = useState([]);
  const [combo, setCombo] = useState(0);
  const [maxCombo, setMaxCombo] = useState(0);
  const [warning, setWarning] = useState('');
  
  // Game over state
  const [gameOverVisible, setGameOverVisible] = useState(false);
  const [gameOverTitle, setGameOverTitle] = useState('');
  const [gameOverMessage, setGameOverMessage] = useState('');
  
  // Level complete animation
  const [levelCompleteVisible, setLevelCompleteVisible] = useState(false);
  const [levelCompleteMessage, setLevelCompleteMessage] = useState('');
  
  // Combo indicator
  const [comboVisible, setComboVisible] = useState(false);
  const [comboText, setComboText] = useState('');
  
  // Freeze state
  const [timeFrozen, setTimeFrozen] = useState(false);
  
  // Timer
  useEffect(() => {
    if (!gameRunning || timeFrozen) return;
    
    const timer = setInterval(() => {
      setElapsedTime(prev => prev + 1);
    }, 1000);
    
    return () => clearInterval(timer);
  }, [gameRunning, timeFrozen]);
  
  // Level config getter
  const getLevelConfig = useCallback((lvl) => {
    return LEVEL_CONFIGS[lvl] || LEVEL_CONFIGS[3];
  }, [LEVEL_CONFIGS]);
  
  // Generate level
  const generateLevel = useCallback((lvl) => {
    const config = getLevelConfig(lvl);
    const newTiles = [];
    const boardWidth = 600;
    const boardHeight = 400;
    const tileWidth = 60;
    const tileHeight = 80;
    
    const levelTileTypes = TILE_TYPES.slice(0, config.types);
    
    const tileData = [];
    levelTileTypes.forEach(type => {
      for (let i = 0; i < TILES_PER_TYPE; i++) {
        tileData.push(type);
      }
    });
    
    const extraTiles = Math.floor((lvl - 1) * 3);
    for (let i = 0; i < extraTiles; i++) {
      const randomType = levelTileTypes[Math.floor(Math.random() * levelTileTypes.length)];
      tileData.push(randomType);
    }
    
    const typeCount = {};
    tileData.forEach(type => {
      typeCount[type] = (typeCount[type] || 0) + 1;
    });
    
    Object.keys(typeCount).forEach(type => {
      const count = typeCount[type];
      const remainder = count % 3;
      if (remainder !== 0) {
        for (let i = 0; i < (3 - remainder); i++) {
          tileData.push(type);
        }
      }
    });
    
    for (let i = tileData.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [tileData[i], tileData[j]] = [tileData[j], tileData[i]];
    }
    
    const positions = generateLayerPositions(boardWidth, boardHeight, tileWidth, tileHeight, config.layers, config.density, lvl);
    
    let tileIndex = 0;
    positions.forEach((pos, index) => {
      if (tileIndex < tileData.length) {
        newTiles.push({
          id: index,
          type: tileData[tileIndex],
          x: pos.x,
          y: pos.y,
          layer: pos.layer,
          removed: false,
          blocked: false
        });
        tileIndex++;
      }
    });
    
    return newTiles;
  }, [getLevelConfig, TILE_TYPES]);
  
  const generateLayerPositions = (boardWidth, boardHeight, tileWidth, tileHeight, layers, density, lvl) => {
    const positions = [];
    const usedPositions = new Set();
    
    for (let layer = 0; layer < layers; layer++) {
      const layerPositions = [];
      let tilesInLayer = Math.floor(15 * density * (1 + layer * 0.15));
      
      if (lvl >= 2) {
        tilesInLayer = Math.floor(tilesInLayer * (1 + (lvl - 1) * 0.3));
      }
      
      const gridCols = Math.floor(boardWidth / (tileWidth - (lvl >= 2 ? 30 : 20)));
      const gridRows = Math.floor(boardHeight / (tileHeight - (lvl >= 2 ? 30 : 20)));
      
      let attempts = 0;
      while (layerPositions.length < tilesInLayer && attempts < tilesInLayer * 4) {
        const gridX = Math.floor(Math.random() * gridCols);
        const gridY = Math.floor(Math.random() * gridRows);
        const posKey = `${gridX}-${gridY}-${layer}`;
        
        const allowOverlap = lvl >= 2 && Math.random() < 0.3;
        
        if (!usedPositions.has(posKey) || allowOverlap) {
          const offsetRange = lvl >= 2 ? 30 : 20;
          const layerOffset = lvl >= 2 ? layer * 12 : layer * 8;
          
          const x = gridX * (tileWidth - offsetRange) + Math.random() * offsetRange + layerOffset;
          const y = gridY * (tileHeight - offsetRange) + Math.random() * offsetRange + layerOffset;
          
          if (x >= 0 && x <= boardWidth - tileWidth && y >= 0 && y <= boardHeight - tileHeight) {
            layerPositions.push({ x, y, layer });
            if (!allowOverlap) {
              usedPositions.add(posKey);
            }
          }
        }
        attempts++;
      }
      
      positions.push(...layerPositions);
    }
    
    return positions;
  };
  
  // Check if tile is clickable
  const isTileClickable = useCallback((tile) => {
    return !tiles.some(other => 
      !other.removed &&
      other.layer > tile.layer &&
      Math.abs(other.x - tile.x) < 40 &&
      Math.abs(other.y - tile.y) < 60
    );
  }, [tiles]);
  
  // Show warning message
  const showWarningMessage = useCallback((message) => {
    setWarning(message);
    setTimeout(() => setWarning(''), 3000);
  }, []);
  
  // Select tile
  const selectTile = useCallback((tile) => {
    if (!gameRunning) return;
    
    // Check if slots will be full after adding this tile
    setSlots(prev => {
      if (prev.length >= MAX_SLOTS) {
        showWarningMessage('Slot area is full! Match some tiles first.');
        return prev;
      }
      
      // Save move for undo
      setMoveHistory(prevHistory => [...prevHistory, {
        type: 'select',
        tile: { ...tile },
        slotsState: [...prev],
        tilesState: tiles.map(t => ({ ...t }))
      }]);
      
      // Mark tile as removed
      setTiles(prevTiles => prevTiles.map(t => t.id === tile.id ? { ...t, removed: true } : t));
      
      const newSlots = [...prev, tile];
      
      // Check matches after a short delay with the new slots
      setTimeout(() => {
        checkMatchesWithSlots(newSlots);
      }, 300);
      
      return newSlots;
    });
  }, [gameRunning, tiles]);
  
  // End game
  const endGame = useCallback((lost = false) => {
    setGameRunning(false);
    
    if (lost) {
      setGameOverTitle('😔 Game Over');
      const msg = `No more valid moves! Reached Level ${level} with Score: ${score}`;
      
      setGameOverMessage(msg);
      setGameOverVisible(true);
    }
  }, [level, score]);
  
  // Show game victory
  const showGameVictory = useCallback(() => {
    setGameRunning(false);
    
    const bonusScore = 10000;
    setScore(s => s + bonusScore);
    
    setGameOverTitle('🏆 LEGENDARY VICTORY! 🏆');
    const finalScore = score + bonusScore;
    const msg = `INCREDIBLE! You beat all 3 levels!\nFinal Score: ${finalScore}\n+10,000 Victory Bonus!\n\nYou are among the 1% who conquered 羊了个羊!`;
    
    setGameOverMessage(msg);
    setGameOverVisible(true);
  }, [score]);
  
  // Next level
  const nextLevel = useCallback(() => {
    const completedLevel = level;
    
    if (level >= 3) {
      showGameVictory();
      return;
    }
    
    const config = getLevelConfig(level + 1);
    setLevelCompleteMessage(`
      Level ${level} Complete!
      ${config.description}
      Moving to Level ${level + 1}...
      +${100 * level} Bonus Points!
    `);
    setLevelCompleteVisible(true);
    
    setScore(s => s + 100 * level);
    
    setTimeout(() => {
      setLevelCompleteVisible(false);
      const nextLevelNum = level + 1;
      setLevel(nextLevelNum);
      setTiles(generateLevel(nextLevelNum));
      setSlots([]);
      setCombo(0);
      setMoveHistory([]);
      
      setPowerUps(prev => ({
        shuffle: Math.min(prev.shuffle + 1, 3),
        undo: Math.min(prev.undo + 1, 3),
        bomb: completedLevel === 1 ? Math.min(prev.bomb + 1, 2) : prev.bomb,
        freeze: completedLevel === 2 ? Math.min(prev.freeze + 1, 2) : prev.freeze
      }));
      
      setWarning('');
    }, 2000);
  }, [level, getLevelConfig, generateLevel, showGameVictory]);
  
  // Check win condition
  const checkWinCondition = useCallback(() => {
    const remainingTiles = tiles.filter(t => !t.removed);
    
    if (remainingTiles.length === 0 && gameRunning) {
      nextLevel();
    }
  }, [tiles, gameRunning, nextLevel]);
  
  // Check matches with provided slots array (avoids stale closure)
  const checkMatchesWithSlots = useCallback((currentSlots) => {
    const typeCount = {};
    currentSlots.forEach(tile => {
      typeCount[tile.type] = (typeCount[tile.type] || 0) + 1;
    });
    
    let hasMatch = false;
    let newSlotsAfterMatch = [...currentSlots];
    
    Object.entries(typeCount).forEach(([type, count]) => {
      if (count >= MATCH_COUNT) {
        hasMatch = true;
        
        // Remove matching tiles from the array
        newSlotsAfterMatch = newSlotsAfterMatch.filter(tile => tile.type !== type);
        
        // Update combo
        setCombo(prev => {
          const newCombo = prev + 1;
          setMaxCombo(max => Math.max(max, newCombo));
          
          const baseScore = 100 * level;
          const comboBonus = newCombo > 1 ? (newCombo - 1) * 50 : 0;
          const totalScore = baseScore + comboBonus;
          setScore(s => s + totalScore);
          
          if (newCombo > 1) {
            setComboText(`${newCombo}x COMBO! +${totalScore}`);
            setComboVisible(true);
            setTimeout(() => setComboVisible(false), 2000);
          }
          
          return newCombo;
        });
      }
    });
    
    if (hasMatch) {
      // Immediately update slots to remove matched tiles
      setSlots(newSlotsAfterMatch);
      
      // Check for win after removing matches
      setTimeout(() => {
        setTiles(prevTiles => {
          const remainingTiles = prevTiles.filter(t => !t.removed);
          if (remainingTiles.length === 0 && gameRunning) {
            nextLevel();
          }
          return prevTiles;
        });
      }, 500);
    } else {
      // Reset combo when no match occurs
      setCombo(0);
      
      // Check if game is stuck - slots are full and no matches possible
      if (currentSlots.length >= MAX_SLOTS) {
        endGame(true);
      }
    }
  }, [level, gameRunning, nextLevel, endGame]);
  
  // Start game
  const startGame = useCallback(() => {
    if (gameRunning) return;
    
    setGameRunning(true);
    setScore(0);
    setLevel(1);
    setTiles(generateLevel(1));
    setSlots([]);
    setHints(3);
    setCombo(0);
    setMoveHistory([]);
    setElapsedTime(0);
    setTimeFrozen(false);
    setPowerUps({ shuffle: 2, undo: 2, bomb: 1, freeze: 1 });
    setWarning('');
    setGameOverVisible(false);
  }, [gameRunning, generateLevel]);
  
  // Reset game
  const resetGame = useCallback(() => {
    setGameRunning(false);
    setGameOverVisible(false);
    setLevel(1);
    startGame();
  }, [startGame]);
  
  // Quit game
  const quitGame = useCallback(() => {
    if (!gameRunning) return;
    
    if (!confirm(`Are you sure you want to quit?\nFinal Score: ${score} points from Level ${level}`)) {
      return;
    }
    
    setGameRunning(false);
    
    setGameOverTitle('🎯 Game Completed!');
    const msg = `Final Score: ${score} points\nReached Level: ${level}\nThanks for playing!`;
    
    setGameOverMessage(msg);
    setGameOverVisible(true);
  }, [gameRunning, score, level]);
  
  // Use hint
  const useHint = useCallback(() => {
    if (!gameRunning || hints <= 0) return;
    
    const typeCount = {};
    slots.forEach(tile => {
      typeCount[tile.type] = (typeCount[tile.type] || 0) + 1;
    });
    
    const clickableTiles = tiles.filter(t => !t.removed && isTileClickable(t));
    const helpfulTile = clickableTiles.find(tile => 
      (typeCount[tile.type] || 0) >= MATCH_COUNT - 1
    );
    
    if (helpfulTile) {
      const tileEl = document.getElementById(`tile-${helpfulTile.id}`);
      if (tileEl) {
        tileEl.classList.add('highlighted');
        setTimeout(() => {
          tileEl.classList.remove('highlighted');
        }, 2000);
      }
      setHints(prev => prev - 1);
    } else {
      showWarningMessage('No helpful hints available!');
    }
  }, [gameRunning, hints, slots, tiles, isTileClickable, showWarningMessage]);
  
  // Power-ups
  const usePowerUp = useCallback((type) => {
    if (!gameRunning || powerUps[type] <= 0) return;
    
    setPowerUps(prev => ({ ...prev, [type]: prev[type] - 1 }));
    
    switch (type) {
      case 'shuffle':
        const availableTiles = tiles.filter(t => !t.removed);
        const tileTypes = availableTiles.map(t => t.type);
        
        for (let i = tileTypes.length - 1; i > 0; i--) {
          const j = Math.floor(Math.random() * (i + 1));
          [tileTypes[i], tileTypes[j]] = [tileTypes[j], tileTypes[i]];
        }
        
        let typeIndex = 0;
        setTiles(prev => prev.map(tile => {
          if (!tile.removed) {
            return { ...tile, type: tileTypes[typeIndex++] };
          }
          return tile;
        }));
        
        showWarningMessage('Tiles shuffled! 🔀');
        break;
        
      case 'undo':
        if (moveHistory.length === 0) {
          showWarningMessage('No moves to undo!');
          setPowerUps(prev => ({ ...prev, undo: prev.undo + 1 }));
          return;
        }
        
        const lastMove = moveHistory[moveHistory.length - 1];
        setMoveHistory(prev => prev.slice(0, -1));
        setSlots(lastMove.slotsState);
        setTiles(lastMove.tilesState);
        showWarningMessage('Move undone! ↩️');
        break;
        
      case 'bomb':
        const clickableTiles = tiles.filter(t => !t.removed && isTileClickable(t));
        const tilesByType = {};
        clickableTiles.forEach(tile => {
          if (!tilesByType[tile.type]) tilesByType[tile.type] = [];
          tilesByType[tile.type].push(tile);
        });
        
        let tilesToRemove = [];
        for (const [type, typeTiles] of Object.entries(tilesByType)) {
          if (typeTiles.length >= 3) {
            tilesToRemove = typeTiles.slice(0, 3);
            break;
          }
        }
        
        if (tilesToRemove.length === 0) {
          showWarningMessage('💣 Bomb failed! No animal type has 3+ tiles available.');
          setPowerUps(prev => ({ ...prev, bomb: prev.bomb + 1 }));
          return;
        }
        
        const animalType = tilesToRemove[0]?.type || '';
        const tileIdsToRemove = tilesToRemove.map(t => t.id);
        
        // Mark tiles as removed
        setTiles(prev => prev.map(tile => {
          if (tileIdsToRemove.includes(tile.id)) {
            return { ...tile, removed: true };
          }
          return tile;
        }));
        
        // Show message and force re-render
        showWarningMessage(`Bomb exploded! 💥 Removed 3 ${animalType} tiles!`);
        
        // Force state update by updating score (triggers re-render)
        setScore(s => s + 50);
        break;
        
      case 'freeze':
        setTimeFrozen(true);
        showWarningMessage('Time frozen for 30 seconds! ❄️');
        setTimeout(() => {
          setTimeFrozen(false);
        }, 30000);
        break;
    }
  }, [gameRunning, powerUps, tiles, moveHistory, isTileClickable, showWarningMessage]);
  
  // Format time
  const formatTime = (seconds) => {
    const minutes = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${minutes}:${secs.toString().padStart(2, '0')}`;
  };
  
  // Render tiles
  const renderTiles = () => {
    const sortedTiles = [...tiles].sort((a, b) => a.layer - b.layer);
    
    return sortedTiles.map(tile => {
      if (tile.removed) return null;
      
      const clickable = isTileClickable(tile);
      
      return (
        <div
          key={tile.id}
          id={`tile-${tile.id}`}
          className={`tile ${!clickable ? 'locked' : ''}`}
          style={{
            ...styles.tile,
            left: tile.x + 'px',
            top: tile.y + 'px',
            zIndex: tile.layer * 100,
            ...(clickable ? {} : styles.tileLocked)
          }}
          onClick={clickable ? () => selectTile(tile) : undefined}
        >
          {tile.type}
        </div>
      );
    });
  };
  
  // Render slots
  const renderSlots = () => {
    if (slots.length === 0) {
      return <div style={{ color: '#764ba2', opacity: 0.6 }}>Select tiles to place here (Max 7)</div>;
    }
    
    return slots.map((tile, index) => (
      <div key={index} style={styles.slotTile}>
        {tile.type}
      </div>
    ));
  };
  
  const stats = {
    level: level,
    tilesLeft: tiles.filter(t => !t.removed).length,
    timer: formatTime(elapsedTime),
    score: score
  };
  
  return (
    <div style={styles.body}>
      <div style={styles.gameContainer}>
        <div style={styles.gameTitle}>
          <span>🐑 Sheep A Sheep</span>
        </div>
        
        <div style={styles.gameStats}>
          <div style={styles.statItem}>
            <div style={styles.statLabel}>Level</div>
            <div style={styles.statValue}>{stats.level}</div>
          </div>
          <div style={styles.statItem}>
            <div style={styles.statLabel}>Tiles Left</div>
            <div style={styles.statValue}>{stats.tilesLeft}</div>
          </div>
          <div style={styles.statItem}>
            <div style={styles.statLabel}>Time</div>
            <div style={styles.statValue}>{stats.timer}</div>
          </div>
          <div style={styles.statItem}>
            <div style={styles.statLabel}>Score</div>
            <div style={styles.statValue}>{stats.score}</div>
          </div>
        </div>
        
        <div style={styles.gameBoard}>
          {renderTiles()}
        </div>
        
        <div style={styles.slotArea}>
          {renderSlots()}
        </div>
        
        <div style={styles.controls}>
          <button style={styles.startBtn} onClick={startGame}>Start Game</button>
          <button style={styles.resetBtn} onClick={resetGame}>Reset</button>
          <button style={styles.hintBtn} onClick={useHint} disabled={hints <= 0}>
            Hint ({hints})
          </button>
          {gameRunning && (
            <button style={styles.quitBtn} onClick={quitGame}>Quit & Submit</button>
          )}
        </div>
        
        <div style={styles.powerUps}>
          <div style={styles.powerUpTitle}>Power-ups</div>
          <div style={styles.powerUpGrid}>
            <button
              style={{...styles.powerUpBtn, ...styles.shuffleBtn}}
              onClick={() => usePowerUp('shuffle')}
              disabled={powerUps.shuffle <= 0}
            >
              🔀 Shuffle ({powerUps.shuffle})
            </button>
            <button
              style={{...styles.powerUpBtn, ...styles.undoBtn}}
              onClick={() => usePowerUp('undo')}
              disabled={powerUps.undo <= 0}
            >
              ↩️ Undo ({powerUps.undo})
            </button>
            <button
              style={{...styles.powerUpBtn, ...styles.bombBtn}}
              onClick={() => usePowerUp('bomb')}
              disabled={powerUps.bomb <= 0}
            >
              💣 Bomb ({powerUps.bomb})
            </button>
            <button
              style={{...styles.powerUpBtn, ...styles.freezeBtn}}
              onClick={() => usePowerUp('freeze')}
              disabled={powerUps.freeze <= 0}
            >
              ❄️ Freeze ({powerUps.freeze})
            </button>
          </div>
        </div>
        
        {warning && <div style={styles.warning}>{warning}</div>}
      </div>
      
      {/* Game Over Modal */}
      {gameOverVisible && (
        <>
          <div style={styles.overlay} />
          <div style={styles.gameOver}>
            <h2>{gameOverTitle}</h2>
            <p style={{ whiteSpace: 'pre-line' }}>{gameOverMessage}</p>
            <div style={styles.gameOverButtons}>
              <button style={styles.startBtn} onClick={resetGame}>New Game</button>
            </div>
          </div>
        </>
      )}
      
      {/* Level Complete */}
      {levelCompleteVisible && (
        <div style={styles.levelCompleteIndicator}>
          <h2>🎉 {levelCompleteMessage.split('\n')[0]}</h2>
          {levelCompleteMessage.split('\n').slice(1).map((line, i) => (
            <p key={i}>{line}</p>
          ))}
        </div>
      )}
      
      {/* Combo Indicator */}
      {comboVisible && (
        <div style={styles.comboIndicator}>{comboText}</div>
      )}
      
      <style jsx>{`
        .tile {
          transition: all 0.2s ease;
        }
        
        .tile:hover:not(.locked) {
          transform: translateY(-2px);
          box-shadow: 0 4px 12px rgba(0, 0, 0, 0.2);
          border-color: #764ba2;
        }
        
        .tile.highlighted {
          box-shadow: 0 0 20px #ffd700;
          border-color: #ffd700;
          animation: glow 1s infinite alternate;
        }
        
        @keyframes glow {
          from { box-shadow: 0 0 20px #ffd700; }
          to { box-shadow: 0 0 30px #ffd700, 0 0 40px #ffd700; }
        }
        
        button:hover:not(:disabled) {
          transform: translateY(-2px);
          box-shadow: 0 4px 12px rgba(0, 0, 0, 0.2);
        }
        
        button:disabled {
          opacity: 0.5;
          cursor: not-allowed;
          transform: none;
        }
      `}</style>
    </div>
  );
}

const styles = {
  body: {
    margin: 0,
    padding: '20px',
    fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
    background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    minHeight: '100vh',
    boxSizing: 'border-box',
    color: '#333',
  },
  gameContainer: {
    background: 'rgba(255, 255, 255, 0.95)',
    backdropFilter: 'blur(10px)',
    borderRadius: '20px',
    padding: '20px',
    boxShadow: '0 8px 32px rgba(31, 38, 135, 0.37)',
    textAlign: 'center',
    maxWidth: '800px',
    width: '100%',
  },
  gameTitle: {
    fontSize: '32px',
    fontWeight: 'bold',
    marginBottom: '10px',
    color: '#764ba2',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '10px',
  },
  gameStats: {
    display: 'flex',
    justifyContent: 'space-around',
    marginBottom: '20px',
    flexWrap: 'wrap',
  },
  statItem: {
    background: 'rgba(118, 75, 162, 0.1)',
    padding: '10px 20px',
    borderRadius: '10px',
    margin: '5px',
  },
  statLabel: {
    fontSize: '12px',
    color: '#666',
    textTransform: 'uppercase',
  },
  statValue: {
    fontSize: '24px',
    fontWeight: 'bold',
    color: '#764ba2',
  },
  gameBoard: {
    position: 'relative',
    width: '600px',
    height: '400px',
    margin: '20px auto',
    background: 'rgba(118, 75, 162, 0.05)',
    borderRadius: '15px',
    overflow: 'visible',
  },
  tile: {
    position: 'absolute',
    width: '60px',
    height: '80px',
    background: 'white',
    border: '2px solid #ddd',
    borderRadius: '8px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: '28px',
    cursor: 'pointer',
    boxShadow: '0 2px 8px rgba(0, 0, 0, 0.1)',
    userSelect: 'none',
  },
  tileLocked: {
    opacity: 0.5,
    cursor: 'not-allowed',
    background: '#f0f0f0',
  },
  slotArea: {
    background: 'rgba(118, 75, 162, 0.1)',
    border: '3px dashed #764ba2',
    borderRadius: '15px',
    padding: '15px',
    margin: '20px auto',
    width: '500px',
    minHeight: '100px',
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
    gap: '10px',
    flexWrap: 'wrap',
  },
  slotTile: {
    width: '60px',
    height: '80px',
    background: 'white',
    border: '2px solid #764ba2',
    borderRadius: '8px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: '28px',
  },
  controls: {
    margin: '20px 0',
    display: 'flex',
    gap: '10px',
    justifyContent: 'center',
    flexWrap: 'wrap',
  },
  startBtn: {
    padding: '12px 24px',
    border: 'none',
    borderRadius: '10px',
    color: 'white',
    fontWeight: 600,
    cursor: 'pointer',
    fontSize: '16px',
    transition: 'all 0.3s ease',
    background: 'linear-gradient(45deg, #667eea, #764ba2)',
  },
  resetBtn: {
    padding: '12px 24px',
    border: 'none',
    borderRadius: '10px',
    color: 'white',
    fontWeight: 600,
    cursor: 'pointer',
    fontSize: '16px',
    transition: 'all 0.3s ease',
    background: 'linear-gradient(45deg, #f093fb, #f5576c)',
  },
  hintBtn: {
    padding: '12px 24px',
    border: 'none',
    borderRadius: '10px',
    color: 'white',
    fontWeight: 600,
    cursor: 'pointer',
    fontSize: '16px',
    transition: 'all 0.3s ease',
    background: 'linear-gradient(45deg, #4facfe, #00f2fe)',
  },
  quitBtn: {
    padding: '12px 24px',
    border: 'none',
    borderRadius: '10px',
    color: 'white',
    fontWeight: 600,
    cursor: 'pointer',
    fontSize: '16px',
    transition: 'all 0.3s ease',
    background: 'linear-gradient(45deg, #ff6b6b, #ee5a24)',
  },
  powerUps: {
    margin: '20px 0',
    background: 'rgba(255, 255, 255, 0.1)',
    borderRadius: '15px',
    padding: '15px',
  },
  powerUpTitle: {
    fontSize: '18px',
    fontWeight: 'bold',
    color: '#764ba2',
    marginBottom: '10px',
    textAlign: 'center',
  },
  powerUpGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(2, 1fr)',
    gap: '10px',
  },
  powerUpBtn: {
    padding: '8px 12px',
    border: 'none',
    borderRadius: '8px',
    color: 'white',
    fontWeight: 600,
    cursor: 'pointer',
    fontSize: '14px',
    transition: 'all 0.3s ease',
  },
  shuffleBtn: { background: 'linear-gradient(45deg, #4facfe, #00f2fe)' },
  undoBtn: { background: 'linear-gradient(45deg, #43e97b, #38f9d7)' },
  bombBtn: { background: 'linear-gradient(45deg, #fa709a, #fee140)' },
  freezeBtn: { background: 'linear-gradient(45deg, #a8edea, #fed6e3)' },
  warning: {
    color: '#ef4444',
    fontSize: '14px',
    marginTop: '10px',
  },
  overlay: {
    position: 'fixed',
    top: 0,
    left: 0,
    width: '100%',
    height: '100%',
    background: 'rgba(0, 0, 0, 0.5)',
    zIndex: 999,
  },
  gameOver: {
    position: 'fixed',
    top: '50%',
    left: '50%',
    transform: 'translate(-50%, -50%)',
    background: 'white',
    padding: '30px',
    borderRadius: '20px',
    boxShadow: '0 10px 40px rgba(0, 0, 0, 0.3)',
    textAlign: 'center',
    zIndex: 1000,
    color: '#764ba2',
  },
  gameOverButtons: {
    display: 'flex',
    gap: '15px',
    justifyContent: 'center',
    marginTop: '20px',
  },
  levelCompleteIndicator: {
    position: 'absolute',
    top: '50%',
    left: '50%',
    transform: 'translate(-50%, -50%)',
    background: 'linear-gradient(135deg, #4ade80 0%, #22c55e 100%)',
    color: 'white',
    padding: '30px',
    borderRadius: '20px',
    textAlign: 'center',
    boxShadow: '0 10px 40px rgba(0, 0, 0, 0.3)',
    zIndex: 1000,
  },
  comboIndicator: {
    position: 'absolute',
    top: '100px',
    right: '20px',
    background: 'linear-gradient(45deg, #ff6b6b, #feca57)',
    color: 'white',
    padding: '10px 15px',
    borderRadius: '20px',
    fontWeight: 'bold',
    fontSize: '16px',
    boxShadow: '0 4px 12px rgba(0, 0, 0, 0.2)',
    zIndex: 1000,
  },
};

export default Sheeeeeeeeeeep;

