import React, { useState } from 'react';

function WebSearchWidget() {
  const [query, setQuery] = useState('');
  const [count, setCount] = useState(5);
  const [searchType, setSearchType] = useState('web');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [result, setResult] = useState(null);

  const runSearch = async () => {
    if (!query.trim()) return;
    setLoading(true);
    setError(null);
    setResult(null);
    try {
      // Use Miyagi integration (advanced-web-search)
      const body = { searchPrompt: query, count, searchType };
      const raw = await miyagiAPI.post('advanced-web-search', body);

      // Normalize to legacy widget shape
      const json = raw && (raw.dataset || raw.summary || raw.citations)
        ? {
            success: true,
            summary: raw.summary || (raw.dataset && raw.dataset.summary),
            sources: (raw.dataset && raw.dataset.sources) || [],
            images: (raw.dataset && raw.dataset.images) || [],
            videos: (raw.dataset && raw.dataset.videos) || [],
            pdfs: (raw.dataset && raw.dataset.pdfs) || [],
            citations: raw.citations || [],
            debug: raw.debug
          }
        : (raw && typeof raw.success === 'boolean')
          ? raw
          : { success: false, error: (raw && raw.error) || 'Search failed' };

      setResult(json);
      if (!json.success) setError(json.error || 'Search failed');
      // Emit output to canvas system if available
      if (json.success && json.summary && typeof emitOutput === 'function') {
        emitOutput('summary', json.summary);
      }
    } catch (e) {
      setError(e?.message || 'Network error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ padding: '16px', fontFamily: 'system-ui, -apple-system, sans-serif' }}>
      <h2 style={{ margin: '0 0 12px 0', fontSize: '18px', fontWeight: 600 }}>Web Search</h2>

      <div style={{ display: 'flex', gap: '8px', marginBottom: '10px' }}>
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search the web..."
          style={{ flex: 1, padding: '8px 10px', border: '1px solid #ddd', borderRadius: 6, fontSize: 14 }}
          onKeyDown={(e) => e.key === 'Enter' && runSearch()}
        />
        <select
          value={searchType}
          onChange={(e) => setSearchType(e.target.value)}
          style={{ padding: '8px 10px', border: '1px solid #ddd', borderRadius: 6, fontSize: 14, background: 'white' }}
        >
          <option value="web">Web</option>
          <option value="images">Images</option>
          <option value="videos">Videos</option>
          <option value="pdfs">PDFs</option>
          <option value="academic">Academic</option>
          <option value="all">All</option>
        </select>
        <input
          type="number"
          value={count}
          min={1}
          max={10}
          onChange={(e) => setCount(Number(e.target.value))}
          style={{ width: 70, padding: '8px 10px', border: '1px solid #ddd', borderRadius: 6, fontSize: 14 }}
        />
        <button
          onClick={runSearch}
          disabled={loading}
          style={{ padding: '8px 14px', background: '#111', color: 'white', border: 'none', borderRadius: 6, fontSize: 14, cursor: 'pointer', opacity: loading ? 0.6 : 1 }}
        >
          {loading ? 'Searching…' : 'Search'}
        </button>
      </div>

      {error && (
        <div style={{ color: '#b00020', fontSize: 12, marginBottom: 8 }}>{error}</div>
      )}

      {!loading && result?.success && (
        <div>
          {result.summary && (
            <div style={{ marginBottom: 12 }}>
              <div style={{ fontWeight: 600, marginBottom: 6 }}>Summary</div>
              <pre style={{ whiteSpace: 'pre-wrap', background: '#fafafa', padding: 10, borderRadius: 6, border: '1px solid #eee', fontSize: 12 }}>{result.summary}</pre>
            </div>
          )}

          {Array.isArray(result.sources) && result.sources.length > 0 && (
            <div>
              <div style={{ fontWeight: 600, marginBottom: 6 }}>Sources</div>
              <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: 8 }}>
                {result.sources.map((s) => (
                  <li key={s.url} style={{ border: '1px solid #eee', borderRadius: 6, padding: 10, background: 'white' }}>
                    <div style={{ fontWeight: 500, marginBottom: 2 }}>{s.title || s.url}</div>
                    <div style={{ color: '#555', fontSize: 12, wordBreak: 'break-all' }}>
                      <a href={s.url} target="_blank" rel="noreferrer" style={{ color: '#0b57d0', textDecoration: 'underline' }}>{s.url}</a>
                    </div>
                    {(s.byline || s.date) && (
                      <div style={{ color: '#777', fontSize: 11, marginTop: 4 }}>{[s.byline, s.date].filter(Boolean).join(' • ')}</div>
                    )}
                    {s.snippet && (
                      <div style={{ color: '#333', fontSize: 12, marginTop: 6 }}>{s.snippet}</div>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {Array.isArray(result.images) && result.images.length > 0 && (
            <div>
              <div style={{ fontWeight: 600, marginBottom: 6 }}>Images</div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 12 }}>
                {result.images.map((img, index) => (
                  <div key={index} style={{ border: '1px solid #eee', borderRadius: 6, overflow: 'hidden', background: 'white' }}>
                    {img.thumbnailUrl && (
                      <img 
                        src={img.thumbnailUrl} 
                        alt={img.title || 'Search result image'}
                        style={{ width: '100%', height: '150px', objectFit: 'cover' }}
                        onError={(e) => {
                          e.target.style.display = 'none';
                        }}
                      />
                    )}
                    <div style={{ padding: 8 }}>
                      <div style={{ fontWeight: 500, fontSize: 12, marginBottom: 4, lineHeight: 1.3 }}>
                        {img.title && img.title.length > 60 ? `${img.title.substring(0, 60)}...` : img.title}
                      </div>
                      {img.source && (
                        <div style={{ color: '#777', fontSize: 11, marginBottom: 4 }}>{img.source}</div>
                      )}
                      {img.width && img.height && (
                        <div style={{ color: '#999', fontSize: 10 }}>{img.width} × {img.height}</div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {Array.isArray(result.videos) && result.videos.length > 0 && (
            <div>
              <div style={{ fontWeight: 600, marginBottom: 6 }}>Videos</div>
              <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: 8 }}>
                {result.videos.map((video, index) => (
                  <li key={index} style={{ border: '1px solid #eee', borderRadius: 6, padding: 10, background: 'white', display: 'flex', gap: 12 }}>
                    {video.thumbnailUrl && (
                      <img 
                        src={video.thumbnailUrl} 
                        alt={video.title || 'Video thumbnail'}
                        style={{ width: '120px', height: '68px', objectFit: 'cover', borderRadius: 4, flexShrink: 0 }}
                        onError={(e) => {
                          e.target.style.display = 'none';
                        }}
                      />
                    )}
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontWeight: 500, marginBottom: 4, lineHeight: 1.3 }}>
                        {video.title}
                      </div>
                      <div style={{ color: '#555', fontSize: 12, marginBottom: 4 }}>
                        <a href={video.url} target="_blank" rel="noreferrer" style={{ color: '#0b57d0', textDecoration: 'underline' }}>
                          {video.source || 'View Video'}
                        </a>
                      </div>
                      <div style={{ color: '#777', fontSize: 11, display: 'flex', gap: 12 }}>
                        {video.duration && <span>{video.duration}</span>}
                        {video.views && <span>{video.views}</span>}
                        {video.date && <span>{video.date}</span>}
                      </div>
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {Array.isArray(result.pdfs) && result.pdfs.length > 0 && (
            <div>
              <div style={{ fontWeight: 600, marginBottom: 6 }}>PDF Documents</div>
              <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: 8 }}>
                {result.pdfs.map((pdf, index) => (
                  <li key={index} style={{ border: '1px solid #eee', borderRadius: 6, padding: 12, background: 'white' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                      <div style={{ 
                        width: '32px', 
                        height: '32px', 
                        background: '#dc3545', 
                        borderRadius: 4, 
                        display: 'flex', 
                        alignItems: 'center', 
                        justifyContent: 'center',
                        color: 'white',
                        fontSize: '12px',
                        fontWeight: 'bold'
                      }}>
                        PDF
                      </div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontWeight: 500, marginBottom: 2, lineHeight: 1.3 }}>
                          {pdf.title}
                        </div>
                        <div style={{ color: '#555', fontSize: 12, wordBreak: 'break-all' }}>
                          <a href={pdf.url} target="_blank" rel="noreferrer" style={{ color: '#0b57d0', textDecoration: 'underline' }}>
                            {pdf.url}
                          </a>
                        </div>
                      </div>
                    </div>
                    {pdf.snippet && (
                      <div style={{ color: '#333', fontSize: 12, lineHeight: 1.4, marginBottom: 6 }}>
                        {pdf.snippet}
                      </div>
                    )}
                    <div style={{ color: '#777', fontSize: 11, display: 'flex', gap: 12, flexWrap: 'wrap' }}>
                      {pdf.source && <span>{pdf.source}</span>}
                      {pdf.date && <span>{pdf.date}</span>}
                      {pdf.fileSize && <span>{pdf.fileSize}</span>}
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default WebSearchWidget;


