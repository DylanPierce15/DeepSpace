import React, { useState, useEffect } from 'react';

const classSpecs = {
  'Death Knight': ['Blood', 'Frost', 'Unholy'],
  'Demon Hunter': ['Havoc', 'Vengeance'],
  'Druid': ['Balance', 'Feral', 'Guardian', 'Restoration'],
  'Evoker': ['Devastation', 'Preservation', 'Augmentation'],
  'Hunter': ['Beast Mastery', 'Marksmanship', 'Survival'],
  'Mage': ['Arcane', 'Fire', 'Frost'],
  'Monk': ['Brewmaster', 'Mistweaver', 'Windwalker'],
  'Paladin': ['Holy', 'Protection', 'Retribution'],
  'Priest': ['Discipline', 'Holy', 'Shadow'],
  'Rogue': ['Assassination', 'Outlaw', 'Subtlety'],
  'Shaman': ['Elemental', 'Enhancement', 'Restoration'],
  'Warlock': ['Affliction', 'Demonology', 'Destruction'],
  'Warrior': ['Arms', 'Fury', 'Protection']
};

function WowPlayerSearchInput() {
  const [tailwindLoaded, setTailwindLoaded] = useState(false);
  const [selectedClass, setSelectedClass] = useState('');
  const [selectedSpec, setSelectedSpec] = useState('');
  const [contentType, setContentType] = useState('3v3');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  
  // Use global storage to share data with display widget
  const [playerData, setPlayerData] = useGlobalStorage('wowPlayerSearch', null);

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

  const scrapeMurlok = async () => {
    if (!selectedClass || !selectedSpec) {
      setError('Please select both a class and specialization');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const classFormatted = selectedClass.toLowerCase().replace(/\s+/g, '-');
      const specFormatted = selectedSpec.toLowerCase().replace(/\s+/g, '-');
      const targetUrl = `https://murlok.io/${classFormatted}/${specFormatted}/${contentType}`;
      
      console.log('Fetching from:', targetUrl);
      
      const response = await miyagiAPI.post('search-web-raw', {
        searchPrompt: `${targetUrl}`,
        count: 1
      });

      if (response.sources && response.sources.length > 0) {
        const topResult = response.sources[0];
        const extractedText = topResult.extractedText || topResult.snippet || '';
        
        const topPlayers = extractTopPlayers(extractedText, topResult.url);
        
        const playersWithLinks = topPlayers.map(player => {
          const raiderioUrl = convertToRaiderIO(player.url, player.name);
          const checkPvpUrl = convertToCheckPvP(player.region, player.realm, player.name);
          return {
            ...player,
            raiderioUrl,
            checkPvpUrl
          };
        });
        
        // Send top 5 players to display widget via global storage
        const topFivePlayers = playersWithLinks.slice(0, 5);
        setPlayerData({
          players: topFivePlayers,
          class: selectedClass,
          spec: selectedSpec,
          contentType: contentType,
          timestamp: Date.now()
        });
      } else {
        setError('No results found on murlok.io for this class/spec combination');
      }
    } catch (err) {
      console.error('Error during scraping:', err);
      setError(err.message || 'Failed to scrape data from murlok.io');
    } finally {
      setLoading(false);
    }
  };

  const extractTopPlayers = (text, baseUrl) => {
    const players = [];
    const seen = new Set();
    
    const playerPattern = /([A-Z][a-záàâäãåçéèêëíìîïñóòôöõúùûüýÿæœ]+(?:[a-z]+)?)\s+([A-Z][a-zA-Z\s-]+?)\s+\(([A-Z]{2})\)/gi;
    
    const matches = [...text.matchAll(playerPattern)];
    console.log('Found player text matches:', matches.length);
    
    for (const match of matches) {
      const [fullMatch, playerName, realm, region] = match;
      const characterKey = `${playerName}-${realm}-${region}`.toLowerCase();
      
      if (!seen.has(characterKey)) {
        seen.add(characterKey);
        
        const realmUrl = realm.trim().toLowerCase().replace(/\s+/g, '-');
        const playerUrl = playerName.toLowerCase();
        const regionUrl = region.toLowerCase();
        
        players.push({
          name: playerName.trim(),
          region: region.toUpperCase(),
          realm: realm.trim(),
          url: `https://murlok.io/character/${regionUrl}/${realmUrl}/${playerUrl}/pvp`,
          rank: players.length + 1
        });
      }
    }
    
    console.log('Total players extracted:', players.length);
    return players;
  };

  const convertToRaiderIO = (murlokUrl, characterName) => {
    const match = murlokUrl.match(/\/character\/([a-z]+)\/([a-z0-9-]+)\/([^/]+)/i);
    
    if (match) {
      const [, region, realm, character] = match;
      const capitalizedName = character.charAt(0).toUpperCase() + character.slice(1);
      return `https://raider.io/characters/${region}/${realm}/${capitalizedName}`;
    }
    
    return murlokUrl;
  };

  const convertToCheckPvP = (region, realm, characterName) => {
    const capitalizedRealm = realm
      .split('-')
      .map(word => word.charAt(0).toUpperCase() + word.slice(1))
      .join('-');
    
    return `https://check-pvp.fr/${region.toLowerCase()}/${capitalizedRealm}/${characterName}`;
  };

  if (!tailwindLoaded) {
    return <div style={{ padding: '20px', textAlign: 'center', color: '#666' }}>Loading...</div>;
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
        <h1 className="text-2xl font-semibold text-gray-800 mb-1">Find Best Player Builds</h1>
        <p className="text-sm text-gray-500">Search for top-ranked World of Warcraft players</p>
      </div>

      {/* Selection Form */}
      <div className="bg-white rounded-lg border border-gray-200 p-6 mb-6">
        <div className="space-y-5">
          {/* Class Selection */}
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-2 uppercase tracking-wide">
              Class
            </label>
            <select
              value={selectedClass}
              onChange={(e) => {
                setSelectedClass(e.target.value);
                setSelectedSpec('');
              }}
              className="w-full px-4 py-2.5 bg-white border border-gray-300 rounded-md text-gray-800 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
            >
              <option value="">Select a class...</option>
              {Object.keys(classSpecs).map(cls => (
                <option key={cls} value={cls}>{cls}</option>
              ))}
            </select>
          </div>

          {/* Spec Selection */}
          {selectedClass && (
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-2 uppercase tracking-wide">
                Specialization
              </label>
              <select
                value={selectedSpec}
                onChange={(e) => setSelectedSpec(e.target.value)}
                className="w-full px-4 py-2.5 bg-white border border-gray-300 rounded-md text-gray-800 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
              >
                <option value="">Select a spec...</option>
                {classSpecs[selectedClass].map(spec => (
                  <option key={spec} value={spec}>{spec}</option>
                ))}
              </select>
            </div>
          )}

          {/* Content Type Selection */}
          {selectedSpec && (
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-2 uppercase tracking-wide">
                Content Type
              </label>
              <div className="flex gap-3">
                <button
                  onClick={() => setContentType('3v3')}
                  className={`flex-1 px-4 py-2.5 rounded-md text-sm font-medium transition-all ${
                    contentType === '3v3'
                      ? 'bg-blue-600 text-white'
                      : 'bg-white text-gray-700 border border-gray-300 hover:border-gray-400'
                  }`}
                >
                  3v3 Arena
                </button>
                <button
                  onClick={() => setContentType('m+')}
                  className={`flex-1 px-4 py-2.5 rounded-md text-sm font-medium transition-all ${
                    contentType === 'm+'
                      ? 'bg-blue-600 text-white'
                      : 'bg-white text-gray-700 border border-gray-300 hover:border-gray-400'
                  }`}
                >
                  Mythic+
                </button>
              </div>
            </div>
          )}

          {/* Submit Button */}
          <button
            onClick={scrapeMurlok}
            disabled={!selectedClass || !selectedSpec || loading}
            className="w-full px-6 py-3 bg-blue-600 text-white font-medium text-sm rounded-md hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition-all"
          >
            {loading ? 'Searching...' : 'Find Top Players'}
          </button>
        </div>
      </div>

      {/* Error Display */}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-md p-4">
          <p className="text-red-700 text-sm">{error}</p>
        </div>
      )}
    </div>
  );
}

export default WowPlayerSearchInput;
