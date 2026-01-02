import React, { useState, useEffect } from 'react';

function WowPlayerDisplay() {
  const [tailwindLoaded, setTailwindLoaded] = useState(false);
  
  // Read player data from global storage
  const [data] = useGlobalStorage('wowPlayerSearch', null);

  useEffect(() => {
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
  }, []);

  if (!tailwindLoaded) {
    return <div style={{ padding: '20px', textAlign: 'center', color: '#666' }}>Loading...</div>;
  }

  if (!data || !data.players || data.players.length === 0) {
    return (
      <div style={{ 
        fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif',
        padding: '40px',
        height: '100%',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: '#fafafa'
      }}>
        <div className="text-center">
          <div className="text-gray-400 text-4xl mb-3">{'\u{1F50D}'}</div>
          <p className="text-gray-500 text-sm">No players to display</p>
          <p className="text-gray-400 text-xs mt-1">Search for players using the input widget</p>
        </div>
      </div>
    );
  }

  return (
    <div style={{ 
      fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif',
      padding: '40px',
      height: '100%',
      overflow: 'auto',
      background: '#fafafa'
    }}>
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-2xl font-semibold text-gray-800 mb-1">Top 5 Players</h1>
        <p className="text-sm text-gray-500">
          {data.class} {'\u{2022}'} {data.spec} {'\u{2022}'} {data.contentType === '3v3' ? '3v3 Arena' : 'Mythic+'}
        </p>
      </div>

      {/* Players List */}
      <div className="space-y-3">
        {data.players.map((player, index) => (
          <div 
            key={index}
            className="bg-white rounded-lg border border-gray-200 p-5 hover:border-gray-300 transition-all"
          >
            <div className="flex items-center gap-4">
              {/* Rank Badge */}
              <div className="flex-shrink-0">
                <div className="w-10 h-10 rounded-full bg-blue-600 flex items-center justify-center text-white font-semibold text-sm">
                  #{player.rank}
                </div>
              </div>
              
              <div className="flex-1 min-w-0">
                <h3 className="text-base font-semibold text-gray-800 mb-0.5">{player.name}</h3>
                <p className="text-xs text-gray-500">
                  {player.realm} {'\u{2022}'} {player.region}
                </p>
              </div>
              
              <div className="flex flex-wrap gap-2">
                <a
                  href={player.raiderioUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="px-3 py-1.5 bg-green-600 text-white rounded text-xs font-medium hover:bg-green-700 transition-all"
                >
                  Raider.IO
                </a>
                <a
                  href={player.checkPvpUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="px-3 py-1.5 bg-purple-600 text-white rounded text-xs font-medium hover:bg-purple-700 transition-all"
                >
                  Check-PvP
                </a>
                <a
                  href={player.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="px-3 py-1.5 bg-blue-600 text-white rounded text-xs font-medium hover:bg-blue-700 transition-all"
                >
                  Murlok.io
                </a>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export default WowPlayerDisplay;
