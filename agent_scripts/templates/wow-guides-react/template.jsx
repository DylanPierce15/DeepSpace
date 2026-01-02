import React, { useState, useEffect } from 'react';

function WowGuides() {
  const [tailwindLoaded, setTailwindLoaded] = useState(false);
  
  // Read from global storage to sync with search widget
  const [playerData] = useGlobalStorage('wowPlayerSearch', null);

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

  const formatForUrl = (text) => {
    return text.toLowerCase().replace(/\s+/g, '-');
  };

  const generateGuides = () => {
    if (!playerData || !playerData.class || !playerData.spec) {
      return null;
    }

    const classUrl = formatForUrl(playerData.class);
    const specUrl = formatForUrl(playerData.spec);

    return {
      wowhead: `https://www.wowhead.com/guide/classes/${classUrl}/${specUrl}/overview-pve-dps`,
      icyVeinsPve: `https://www.icy-veins.com/wow/${specUrl}-${classUrl}-pve-dps-guide`,
      icyVeinsPvp: `https://www.icy-veins.com/wow/${specUrl}-${classUrl}-pvp-guide`
    };
  };

  const guides = generateGuides();

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
        <h1 className="text-2xl font-semibold text-gray-800 mb-1">Class Guides</h1>
        {playerData && playerData.class && playerData.spec ? (
          <p className="text-sm text-gray-500">
            {playerData.class} {'\u{2022}'} {playerData.spec}
          </p>
        ) : (
          <p className="text-sm text-gray-500">Search for a class to see guides</p>
        )}
      </div>

      {/* Guide Links */}
      {guides ? (
        <div className="space-y-3">
          <div className="bg-white rounded-lg border border-gray-200 p-5 hover:border-gray-300 transition-all">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-base font-semibold text-gray-800 mb-0.5">Wowhead Guide</h3>
                <p className="text-xs text-gray-500">PvE DPS Overview</p>
              </div>
              <a
                href={guides.wowhead}
                target="_blank"
                rel="noopener noreferrer"
                className="px-4 py-2 bg-blue-600 text-white rounded-md text-sm font-medium hover:bg-blue-700 transition-all"
              >
                Open Guide
              </a>
            </div>
          </div>

          <div className="bg-white rounded-lg border border-gray-200 p-5 hover:border-gray-300 transition-all">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-base font-semibold text-gray-800 mb-0.5">Icy Veins PvE</h3>
                <p className="text-xs text-gray-500">PvE DPS Guide</p>
              </div>
              <a
                href={guides.icyVeinsPve}
                target="_blank"
                rel="noopener noreferrer"
                className="px-4 py-2 bg-blue-600 text-white rounded-md text-sm font-medium hover:bg-blue-700 transition-all"
              >
                Open Guide
              </a>
            </div>
          </div>

          <div className="bg-white rounded-lg border border-gray-200 p-5 hover:border-gray-300 transition-all">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-base font-semibold text-gray-800 mb-0.5">Icy Veins PvP</h3>
                <p className="text-xs text-gray-500">PvP Guide</p>
              </div>
              <a
                href={guides.icyVeinsPvp}
                target="_blank"
                rel="noopener noreferrer"
                className="px-4 py-2 bg-blue-600 text-white rounded-md text-sm font-medium hover:bg-blue-700 transition-all"
              >
                Open Guide
              </a>
            </div>
          </div>
        </div>
      ) : (
        <div className="bg-white rounded-lg border border-gray-200 p-8 text-center">
          <div className="text-gray-400 text-3xl mb-2">{'\u{1F4DA}'}</div>
          <p className="text-gray-500 text-sm">Search for a class in the search widget to view guides</p>
        </div>
      )}
    </div>
  );
}

export default WowGuides;
