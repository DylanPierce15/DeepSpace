import React, { useState, useEffect } from 'react';

function WowMediaGuides() {
  const [tailwindLoaded, setTailwindLoaded] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [youtubeVideos, setYoutubeVideos] = useState([]);
  
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

  // Fetch media when playerData changes
  useEffect(() => {
    if (playerData && playerData.class && playerData.spec) {
      fetchMediaGuides();
    }
  }, [playerData]);

  const fetchMediaGuides = async () => {
    if (!playerData || !playerData.class || !playerData.spec) {
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const searchQuery = `${playerData.spec} ${playerData.class} WoW guide youtube`;

      // Fetch YouTube videos using video search API
      let youtubeData = [];
      try {
        const response = await miyagiAPI.post('search-videos', {
          searchPrompt: searchQuery,
          count: 10
        });
        
        // autoRoutes wraps response in { success, data: { assets, ... } }
        const assets = response?.data?.assets || response?.assets || [];
        if (assets && Array.isArray(assets) && assets.length > 0) {
          youtubeData = assets
            .filter(video => video.url && video.url.includes('youtube.com'))
            .map(video => {
              // Extract video ID from URL
              const videoId = video.url?.split('v=')[1]?.split('&')[0] || '';
              
              return {
                videoId,
                title: video.title || 'Video Guide',
                channelTitle: video.channelName || video.author || video.attribution || '',
                thumbnail: video.thumbnailUrl || video.thumbnail || video.image || '',
                description: video.description || video.snippet || '',
                url: video.url
              };
            });
        }
      } catch (searchError) {
        console.error('Video search error:', searchError);
      }

      setYoutubeVideos(youtubeData);

      if (youtubeData.length === 0) {
        setError('No YouTube guides found. Try a different class/spec.');
      }
    } catch (err) {
      console.error('Error fetching media:', err);
      setError(err.message || 'Failed to fetch guides');
    } finally {
      setLoading(false);
    }
  };

  if (!tailwindLoaded) {
    return <div style={{ padding: '20px', textAlign: 'center', color: '#666' }}>Loading...</div>;
  }

  if (!playerData || !playerData.class || !playerData.spec) {
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
          <div className="text-gray-400 text-4xl mb-3">{'\u{1F3AC}'}</div>
          <p className="text-gray-500 text-sm">No class selected</p>
          <p className="text-gray-400 text-xs mt-1">Search for a class to see video guides</p>
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
      <div className="mb-6">
        <h1 className="text-2xl font-semibold text-gray-800 mb-1">YouTube Guides</h1>
        <p className="text-sm text-gray-500">
          {playerData.class} {'\u{2022}'} {playerData.spec}
        </p>
      </div>

      {loading && (
        <div className="bg-white rounded-lg border border-gray-200 p-8 text-center">
          <div className="text-red-600 text-sm font-medium">Loading videos...</div>
        </div>
      )}

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-md p-4 mb-6">
          <p className="text-red-700 text-sm">{error}</p>
        </div>
      )}

      {!loading && (
        <div className="space-y-3">
          {youtubeVideos.length > 0 ? (
            youtubeVideos.map((video, index) => (
              <div key={index} className="bg-white rounded-lg border border-gray-200 p-4 hover:border-gray-300 transition-all">
                <div className="flex gap-4">
                  {/* Thumbnail */}
                  {video.thumbnail && (
                    <a 
                      href={video.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex-shrink-0"
                    >
                      <img 
                        src={video.thumbnail} 
                        alt={video.title}
                        className="w-40 h-24 object-cover rounded hover:opacity-90 transition-opacity"
                      />
                    </a>
                  )}
                  
                  {/* Content */}
                  <div className="flex-1 min-w-0">
                    <a
                      href={video.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="block"
                    >
                      <h3 className="text-sm font-semibold text-gray-800 mb-1 line-clamp-2 hover:text-red-600 transition-colors">
                        {video.title}
                      </h3>
                    </a>
                    {video.channelTitle && (
                      <div className="text-xs text-gray-500 mb-2">
                        {video.channelTitle}
                      </div>
                    )}
                    {video.description && (
                      <p className="text-xs text-gray-600 line-clamp-2 mb-3">
                        {video.description}
                      </p>
                    )}
                    <a
                      href={video.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-block px-3 py-1.5 bg-red-600 text-white rounded text-xs font-medium hover:bg-red-700 transition-colors"
                    >
                      Watch on YouTube
                    </a>
                  </div>
                </div>
              </div>
            ))
          ) : (
            <div className="bg-white rounded-lg border border-gray-200 p-8 text-center">
              <div className="text-gray-400 text-3xl mb-2">{'\u{1F4FA}'}</div>
              <p className="text-gray-500 text-sm">No YouTube guides found</p>
              <p className="text-gray-400 text-xs mt-1">Try a different class or spec</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default WowMediaGuides;
