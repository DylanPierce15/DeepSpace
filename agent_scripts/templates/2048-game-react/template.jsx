import React, { useState, useEffect, useCallback, useMemo } from 'react';

function Game2048() {
  // Collaborative storage - shared across all users
  const [gameData, setGameData] = useGlobalStorage('2048-game-data', {
    board: Array(4).fill().map(() => Array(4).fill(0)),
    score: 0,
    bestTile: 2,
    gameWon: false,
    gameOver: false,
    isActive: false // Track if game is in progress
  });
  
  const [highScore, setHighScore] = useGlobalStorage('2048-high-score', 0);
  const [bestTileEver, setBestTileEver] = useGlobalStorage('2048-best-tile-ever', 2);
  
  // Local UI state (not synced)
  const [previousBoard, setPreviousBoard] = useState([]);
  const [previousScore, setPreviousScore] = useState(0);
  const [canUndo, setCanUndo] = useState(false);
  const [showGameOver, setShowGameOver] = useState(false);
  const [newTilePosition, setNewTilePosition] = useState(null);
  const [mergedTiles, setMergedTiles] = useState([]);
  
  // Game logic functions
  const initializeBoard = useCallback(() => {
    const newBoard = Array(4).fill().map(() => Array(4).fill(0));
    
    // Add two initial tiles
    const addInitialTile = (board) => {
      const emptyCells = [];
      for (let row = 0; row < 4; row++) {
        for (let col = 0; col < 4; col++) {
          if (board[row][col] === 0) {
            emptyCells.push({ row, col });
          }
        }
      }
      if (emptyCells.length > 0) {
        const randomCell = emptyCells[Math.floor(Math.random() * emptyCells.length)];
        const value = Math.random() < 0.9 ? 2 : 4;
        board[randomCell.row][randomCell.col] = value;
      }
    };
    
    addInitialTile(newBoard);
    addInitialTile(newBoard);
    
    setGameData({
      board: newBoard,
      score: 0,
      bestTile: 2,
      gameWon: false,
      gameOver: false,
      isActive: true
    });
    setCanUndo(false);
    setShowGameOver(false);
  }, [setGameData]);
  
  const addRandomTile = useCallback((board) => {
    const emptyCells = [];
    for (let row = 0; row < 4; row++) {
      for (let col = 0; col < 4; col++) {
        if (board[row][col] === 0) {
          emptyCells.push({ row, col });
        }
      }
    }
    
    if (emptyCells.length > 0) {
      const randomCell = emptyCells[Math.floor(Math.random() * emptyCells.length)];
      const value = Math.random() < 0.9 ? 2 : 4;
      board[randomCell.row][randomCell.col] = value;
      setNewTilePosition(randomCell);
      setTimeout(() => setNewTilePosition(null), 200);
    }
  }, []);
  
  const mergeLine = useCallback((line) => {
    const filtered = line.filter(val => val !== 0);
    const merged = [];
    const mergedPositions = [];
    let scoreIncrease = 0;
    let i = 0;
    
    while (i < filtered.length) {
      if (i < filtered.length - 1 && filtered[i] === filtered[i + 1]) {
        const mergedValue = filtered[i] * 2;
        merged.push(mergedValue);
        scoreIncrease += mergedValue;
        mergedPositions.push(merged.length - 1);
        i += 2;
      } else {
        merged.push(filtered[i]);
        i++;
      }
    }
    
    while (merged.length < 4) {
      merged.push(0);
    }
    
    return { merged, scoreIncrease, mergedPositions };
  }, []);
  
  const isGameOver = useCallback((board) => {
    // Check for empty cells
    for (let row = 0; row < 4; row++) {
      for (let col = 0; col < 4; col++) {
        if (board[row][col] === 0) {
          return false;
        }
      }
    }
    
    // Check for possible merges
    for (let row = 0; row < 4; row++) {
      for (let col = 0; col < 4; col++) {
        const current = board[row][col];
        if (col < 3 && board[row][col + 1] === current) return false;
        if (row < 3 && board[row + 1][col] === current) return false;
      }
    }
    
    return true;
  }, []);
  
  const move = useCallback((direction) => {
    if (gameData.gameOver) return;
    
    setPreviousBoard(gameData.board.map(row => [...row]));
    setPreviousScore(gameData.score);
    
    let moved = false;
    const newBoard = gameData.board.map(row => [...row]);
    let newScore = gameData.score;
    let newBestTile = gameData.bestTile;
    
    if (direction === 'left' || direction === 'right') {
      for (let row = 0; row < 4; row++) {
        const line = direction === 'left' ? newBoard[row] : newBoard[row].slice().reverse();
        const { merged, scoreIncrease } = mergeLine(line);
        
        const finalLine = direction === 'left' ? merged : merged.reverse();
        
        for (let col = 0; col < 4; col++) {
          if (gameData.board[row][col] !== finalLine[col]) {
            moved = true;
          }
          newBoard[row][col] = finalLine[col];
          if (finalLine[col] > newBestTile) {
            newBestTile = finalLine[col];
          }
        }
        
        newScore += scoreIncrease;
      }
    } else {
      for (let col = 0; col < 4; col++) {
        const line = [];
        for (let row = 0; row < 4; row++) {
          line.push(direction === 'up' ? newBoard[row][col] : newBoard[3 - row][col]);
        }
        
        const { merged, scoreIncrease } = mergeLine(line);
        
        for (let row = 0; row < 4; row++) {
          const targetRow = direction === 'up' ? row : 3 - row;
          const newValue = merged[row];
          
          if (gameData.board[targetRow][col] !== newValue) {
            moved = true;
          }
          newBoard[targetRow][col] = newValue;
          if (newValue > newBestTile) {
            newBestTile = newValue;
          }
        }
        
        newScore += scoreIncrease;
      }
    }
    
    if (moved) {
      addRandomTile(newBoard);
      
      const newGameWon = !gameData.gameWon && newBestTile >= 2048;
      const newGameOver = isGameOver(newBoard);
      
      setGameData({
        board: newBoard,
        score: newScore,
        bestTile: newBestTile,
        gameWon: newGameWon,
        gameOver: newGameOver,
        isActive: true
      });
      
      if (newBestTile > bestTileEver) {
        setBestTileEver(newBestTile);
      }
      
      setCanUndo(true);
      
      if (newGameWon || newGameOver) {
        setTimeout(() => handleGameEnd(newGameWon, newScore, newBestTile), 300);
      }
    }
  }, [gameData, mergeLine, addRandomTile, isGameOver, setGameData, bestTileEver, setBestTileEver]);
  
  const handleGameEnd = useCallback((won, finalScore, finalBestTile) => {
    setShowGameOver(true);
    
    // Update high score
    if (finalScore > highScore) {
      setHighScore(finalScore);
    }
  }, [highScore, setHighScore]);
  
  const undoMove = useCallback(() => {
    if (!canUndo) return;
    
    setGameData({
      ...gameData,
      board: previousBoard.map(row => [...row]),
      score: previousScore
    });
    setCanUndo(false);
  }, [canUndo, gameData, previousBoard, previousScore, setGameData]);
  
  const newGame = useCallback(() => {
    setShowGameOver(false);
    initializeBoard();
  }, [initializeBoard]);
  
  // Keyboard controls
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') {
        return;
      }
      
      switch (e.key) {
        case 'ArrowUp':
          e.preventDefault();
          move('up');
          break;
        case 'ArrowDown':
          e.preventDefault();
          move('down');
          break;
        case 'ArrowLeft':
          e.preventDefault();
          move('left');
          break;
        case 'ArrowRight':
          e.preventDefault();
          move('right');
          break;
      }
    };
    
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [move]);
  
  // Touch controls
  useEffect(() => {
    let touchStartX = 0;
    let touchStartY = 0;
    
    const handleTouchStart = (e) => {
      touchStartX = e.touches[0].clientX;
      touchStartY = e.touches[0].clientY;
    };
    
    const handleTouchEnd = (e) => {
      if (!touchStartX || !touchStartY) return;
      
      const touchEndX = e.changedTouches[0].clientX;
      const touchEndY = e.changedTouches[0].clientY;
      
      const diffX = touchStartX - touchEndX;
      const diffY = touchStartY - touchEndY;
      
      const minSwipeDistance = 50;
      
      if (Math.abs(diffX) > Math.abs(diffY)) {
        if (Math.abs(diffX) > minSwipeDistance) {
          move(diffX > 0 ? 'left' : 'right');
        }
      } else {
        if (Math.abs(diffY) > minSwipeDistance) {
          move(diffY > 0 ? 'up' : 'down');
        }
      }
      
      touchStartX = 0;
      touchStartY = 0;
    };
    
    document.addEventListener('touchstart', handleTouchStart);
    document.addEventListener('touchend', handleTouchEnd);
    
    return () => {
      document.removeEventListener('touchstart', handleTouchStart);
      document.removeEventListener('touchend', handleTouchEnd);
    };
  }, [move]);
  
  // Get tile class name
  const getTileClassName = (value, row, col) => {
    let className = 'tile';
    
    if (value > 0) {
      className += ` tile-${value}`;
      if (value > 2048) {
        className += ' tile-super';
      }
      if (newTilePosition && newTilePosition.row === row && newTilePosition.col === col) {
        className += ' new-tile';
      }
    }
    
    return className;
  };
  
  return (
    <div style={styles.body}>
      <div style={styles.gameContainer}>
        <div style={styles.gameHeader}>
          <div style={styles.gameTitle}>2048</div>
          <div style={styles.gameSubtitle}>Join the tiles, get to 2048!</div>
          
          <div style={styles.scoreContainer}>
            <div style={styles.scoreItem}>
              <span style={styles.scoreLabel}>Score</span>
              <span style={styles.scoreValue}>{gameData.score.toLocaleString()}</span>
            </div>
            <div style={styles.scoreItem}>
              <span style={styles.scoreLabel}>High Score</span>
              <span style={styles.scoreValue}>{highScore.toLocaleString()}</span>
            </div>
            <div style={styles.scoreItem}>
              <span style={styles.scoreLabel}>Best Tile</span>
              <span style={styles.scoreValue}>{gameData.bestTile}</span>
            </div>
            <div style={styles.scoreItem}>
              <span style={styles.scoreLabel}>Team Best</span>
              <span style={styles.scoreValue}>{bestTileEver}</span>
            </div>
          </div>
        </div>
        
        {/* Game Board */}
        <div style={styles.gameBoard}>
          {gameData.board.map((row, rowIndex) =>
            row.map((value, colIndex) => (
              <div
                key={`${rowIndex}-${colIndex}`}
                className={getTileClassName(value, rowIndex, colIndex)}
                data-row={rowIndex}
                data-col={colIndex}
              >
                {value > 0 ? value : ''}
              </div>
            ))
          )}
        </div>
        
        {/* Controls */}
        <div style={styles.controls}>
          <div style={styles.buttonContainer}>
            <button style={styles.newGameBtn} onClick={newGame}>
              New Game
            </button>
            <button
              style={{...styles.undoBtn, opacity: canUndo ? 1 : 0.5}}
              onClick={undoMove}
              disabled={!canUndo}
            >
              Undo
            </button>
          </div>
          
          <div style={styles.directionPad}>
            <button style={{...styles.directionBtn, ...styles.directionBtnUp}} onClick={() => move('up')}>
              ↑
            </button>
            <button style={{...styles.directionBtn, ...styles.directionBtnLeft}} onClick={() => move('left')}>
              ←
            </button>
            <button style={{...styles.directionBtn, ...styles.directionBtnRight}} onClick={() => move('right')}>
              →
            </button>
            <button style={{...styles.directionBtn, ...styles.directionBtnDown}} onClick={() => move('down')}>
              ↓
            </button>
          </div>
          
          <div style={styles.instructions}>
            <strong>HOW TO PLAY:</strong> Use arrow keys or direction pad to move tiles.<br />
            When two tiles with the same number touch, they merge into one!<br />
            <strong>Goal:</strong> Create a tile with the number 2048 to win!
          </div>
        </div>
        
        {/* Game Over Screen */}
        {showGameOver && (
          <div style={styles.gameOver} className={gameData.gameWon ? 'win' : 'lose'}>
            <h2 style={styles.gameOverTitle}>
              {gameData.gameWon ? 'You Win! 🎉' : 'Game Over! 😔'}
            </h2>
            <p>Final Score: <span>{gameData.score.toLocaleString()}</span></p>
            <p>Best Tile: <span>{gameData.bestTile}</span></p>
            {gameData.gameWon && (
              <div style={styles.achievement}>🏆 You reached 2048!</div>
            )}
            {!gameData.gameWon && gameData.bestTile >= 128 && (
              <div style={styles.achievement}>
                {gameData.bestTile >= 1024 ? '🥉 Great job! You reached 1024!' :
                 gameData.bestTile >= 512 ? '🎯 Nice work! You reached 512!' :
                 gameData.bestTile >= 256 ? '👍 Good effort! You reached 256!' :
                 '🌟 Not bad! You reached 128!'}
              </div>
            )}
            <button style={styles.newGameBtn} onClick={newGame}>
              Try Again
            </button>
          </div>
        )}
      </div>
      
      <style jsx>{`
        .tile {
          background: rgba(238, 228, 218, 0.35);
          border-radius: 6px;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 32px;
          font-weight: bold;
          transition: all 0.15s ease-in-out;
          position: relative;
        }
        
        .tile.tile-2 { background: #eee4da; color: #776e65; }
        .tile.tile-4 { background: #ede0c8; color: #776e65; }
        .tile.tile-8 { background: #f2b179; color: #f9f6f2; }
        .tile.tile-16 { background: #f59563; color: #f9f6f2; }
        .tile.tile-32 { background: #f67c5f; color: #f9f6f2; }
        .tile.tile-64 { background: #f65e3b; color: #f9f6f2; }
        .tile.tile-128 { background: #edcf72; color: #f9f6f2; font-size: 28px; }
        .tile.tile-256 { background: #edcc61; color: #f9f6f2; font-size: 28px; }
        .tile.tile-512 { background: #edc850; color: #f9f6f2; font-size: 28px; }
        .tile.tile-1024 { background: #edc53f; color: #f9f6f2; font-size: 24px; }
        .tile.tile-2048 { background: #edc22e; color: #f9f6f2; font-size: 24px; box-shadow: 0 0 20px rgba(237, 194, 46, 0.5); }
        .tile.tile-super { background: #3c3a32; color: #f9f6f2; font-size: 20px; }
        
        .tile.new-tile {
          animation: appear 0.2s ease-in-out;
        }
        
        .tile.merged-tile {
          animation: pop 0.2s ease-in-out;
        }
        
        @keyframes appear {
          0% { transform: scale(0); }
          100% { transform: scale(1); }
        }
        
        @keyframes pop {
          0% { transform: scale(1); }
          50% { transform: scale(1.2); }
          100% { transform: scale(1); }
        }
        
        button:hover {
          transform: translateY(-2px);
          box-shadow: 0 6px 20px rgba(0, 0, 0, 0.3);
        }
      `}</style>
    </div>
  );
}

const styles = {
  body: {
    margin: 0,
    padding: 'clamp(10px, 4vw, 20px)',
    fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
    background: 'linear-gradient(135deg, #ffecd2 0%, #fcb69f 100%)',
    minHeight: '100%',
    width: '100%',
    boxSizing: 'border-box',
    color: '#776e65',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
  },
  gameContainer: {
    background: 'rgba(255, 255, 255, 0.9)',
    backdropFilter: 'blur(10px)',
    borderRadius: '20px',
    padding: 'clamp(15px, 5vw, 30px)',
    boxShadow: '0 8px 32px rgba(31, 38, 135, 0.37)',
    border: '1px solid rgba(255, 255, 255, 0.18)',
    textAlign: 'center',
    width: '100%',
    maxWidth: '500px',
    position: 'relative',
    boxSizing: 'border-box',
  },
  gameHeader: {
    width: '100%',
  },
  gameTitle: {
    fontSize: 'clamp(32px, 8vw, 48px)',
    fontWeight: 'bold',
    marginBottom: '10px',
    color: '#776e65',
    textShadow: '0 2px 4px rgba(0, 0, 0, 0.1)',
  },
  gameSubtitle: {
    fontSize: 'clamp(12px, 3vw, 14px)',
    color: '#776e65',
    marginBottom: '20px',
    opacity: 0.8,
  },
  scoreContainer: {
    display: 'grid',
    gridTemplateColumns: 'repeat(2, 1fr)',
    gridTemplateRows: 'repeat(2, 1fr)',
    gap: '12px',
    marginBottom: '20px',
    fontSize: '16px',
    fontWeight: 600,
  },
  scoreItem: {
    background: '#bbada0',
    color: 'white',
    padding: '12px',
    borderRadius: '8px',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: '5px',
  },
  scoreLabel: {
    fontSize: '12px',
    opacity: 0.9,
    textTransform: 'uppercase',
    fontWeight: 700,
  },
  scoreValue: {
    fontSize: '20px',
    fontWeight: 'bold',
  },
  gameBoard: {
    background: '#bbada0',
    borderRadius: '10px',
    padding: '10px',
    margin: '20px auto',
    width: 'min(340px, 100%)',
    aspectRatio: '1',
    position: 'relative',
    display: 'grid',
    gridTemplateColumns: 'repeat(4, 1fr)',
    gridTemplateRows: 'repeat(4, 1fr)',
    gap: '10px',
    boxSizing: 'border-box',
  },
  controls: {
    margin: '20px 0',
  },
  buttonContainer: {
    display: 'flex',
    gap: '15px',
    justifyContent: 'center',
    marginBottom: '15px',
  },
  newGameBtn: {
    padding: '12px 24px',
    border: 'none',
    borderRadius: '12px',
    color: 'white',
    fontWeight: 600,
    cursor: 'pointer',
    fontSize: '16px',
    transition: 'all 0.3s ease',
    boxShadow: '0 4px 15px rgba(0, 0, 0, 0.2)',
    background: '#8f7a66',
  },
  undoBtn: {
    padding: '12px 24px',
    border: 'none',
    borderRadius: '12px',
    color: 'white',
    fontWeight: 600,
    cursor: 'pointer',
    fontSize: '16px',
    transition: 'all 0.3s ease',
    boxShadow: '0 4px 15px rgba(0, 0, 0, 0.2)',
    background: '#bbada0',
  },
  directionPad: {
    display: 'grid',
    gridTemplateColumns: 'repeat(3, 1fr)',
    gap: '8px',
    margin: '15px auto',
    width: '180px',
  },
  directionBtn: {
    width: '50px',
    height: '50px',
    border: 'none',
    borderRadius: '8px',
    background: '#bbada0',
    color: 'white',
    fontSize: '20px',
    cursor: 'pointer',
    transition: 'all 0.2s ease',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  },
  directionBtnUp: { gridColumn: 2, gridRow: 1 },
  directionBtnLeft: { gridColumn: 1, gridRow: 2 },
  directionBtnRight: { gridColumn: 3, gridRow: 2 },
  directionBtnDown: { gridColumn: 2, gridRow: 3 },
  instructions: {
    fontSize: '14px',
    color: '#776e65',
    marginTop: '15px',
    lineHeight: 1.4,
  },
  gameOver: {
    display: 'block',
    position: 'absolute',
    top: '50%',
    left: '50%',
    transform: 'translate(-50%, -50%)',
    background: 'rgba(0, 0, 0, 0.9)',
    color: 'white',
    padding: '30px',
    borderRadius: '16px',
    textAlign: 'center',
    boxShadow: '0 8px 32px rgba(0, 0, 0, 0.5)',
    zIndex: 1000,
  },
  gameOverTitle: {
    marginBottom: '20px',
    fontSize: '32px',
  },
  achievement: {
    background: 'linear-gradient(135deg, #edc22e 0%, #f2b179 100%)',
    color: '#776e65',
    padding: '10px 20px',
    borderRadius: '20px',
    margin: '10px 0',
    fontWeight: 'bold',
    display: 'inline-block',
  },
};

export default Game2048;

