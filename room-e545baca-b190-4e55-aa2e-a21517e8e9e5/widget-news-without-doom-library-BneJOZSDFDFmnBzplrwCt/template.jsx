import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';

// RSS feeds mapping - same as original
const RSS_FEEDS_BY_TOPIC = {
  'Tech': {
    'TechCrunch': 'https://techcrunch.com/feed/',
    'Reuters': 'https://feeds.reuters.com/reuters/technologyNews',
    'BBC': 'https://feeds.bbci.co.uk/news/technology/rss.xml',
    'The Verge': 'https://www.theverge.com/rss/index.xml',
    'Wired': 'https://www.wired.com/feed/rss',
    'AP News': 'https://apnews.com/index.rss'
  },
  'Business': {
    'TechCrunch': 'https://techcrunch.com/category/startups/feed/',
    'Reuters': 'https://feeds.reuters.com/reuters/businessNews',
    'BBC': 'https://feeds.bbci.co.uk/news/business/rss.xml',
    'Wired': 'https://www.wired.com/feed/business/rss',
    'AP News': 'https://apnews.com/index.rss'
  },
  'Science': {
    'Reuters': 'https://feeds.reuters.com/reuters/scienceNews',
    'BBC': 'https://feeds.bbci.co.uk/news/science_and_environment/rss.xml',
    'Wired': 'https://www.wired.com/feed/science/rss',
    'AP News': 'https://apnews.com/index.rss'
  },
  'Markets': {
    'Reuters': 'https://feeds.reuters.com/news/wealth',
    'BBC': 'https://feeds.bbci.co.uk/news/business/rss.xml',
    'AP News': 'https://apnews.com/index.rss'
  },
  'Sports': {
    'Reuters': 'https://feeds.reuters.com/reuters/sportsNews',
    'BBC': 'https://feeds.bbci.co.uk/sport/rss.xml',
    'AP News': 'https://apnews.com/index.rss'
  },
  'Local': {
    'BBC': 'https://feeds.bbci.co.uk/news/england/rss.xml',
    'AP News': 'https://apnews.com/index.rss'
  }
};

const getTodayDateKey = () => {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

const generateId = (source, title, pubDate) => {
  const str = `${source}-${title}-${pubDate}`;
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash;
  }
  return `rss-${Math.abs(hash)}`;
};

const fetchText = async (url, signal) => {
  try {
    const response = await fetch(url, { 
      method: 'GET',
      headers: { 'Accept': 'application/rss+xml, application/xml, text/xml' },
      signal
    });
    if (response.ok) {
      return { success: true, text: await response.text() };
    }
    throw new Error(`HTTP ${response.status}`);
  } catch (directError) {
    if (directError.name === 'AbortError') throw directError;
    
    try {
      const proxyUrl = `https://api.allorigins.win/raw?url=${encodeURIComponent(url)}`;
      const response = await fetch(proxyUrl, { signal });
      if (response.ok) {
        return { success: true, text: await response.text() };
      }
    } catch (proxyError) {
      if (proxyError.name === 'AbortError') throw proxyError;
      return { success: false, error: directError.message.includes('CORS') ? 'CORS blocked' : directError.message };
    }
  }
  return { success: false, error: 'Unknown error' };
};

const parseRSSFeed = async (url, sourceName, topic, signal) => {
  try {
    const fetchedAtISO = new Date().toISOString();
    const result = await fetchText(url, signal);
    
    if (!result.success) {
      return { items: [], error: result.error, url };
    }
    
    const parser = new DOMParser();
    const xml = parser.parseFromString(result.text, 'text/xml');
    
    const parseError = xml.querySelector('parsererror');
    if (parseError) {
      return { items: [], error: 'XML parse error', url };
    }
    
    const items = xml.querySelectorAll('item, entry');
    const parsed = [];
    
    for (let i = 0; i < Math.min(items.length, 20); i++) {
      const item = items[i];
      
      const title = item.querySelector('title')?.textContent?.trim();
      
      let link = item.querySelector('link')?.textContent?.trim();
      if (!link) {
        const linkEl = item.querySelector('link[rel="alternate"]');
        link = linkEl?.getAttribute('href');
      }
      if (!link) {
        link = item.querySelector('link')?.getAttribute('href');
      }
      
      let pubDate = item.querySelector('pubDate')?.textContent?.trim();
      if (!pubDate) pubDate = item.querySelector('published')?.textContent?.trim();
      if (!pubDate) pubDate = item.querySelector('updated')?.textContent?.trim();
      if (!pubDate) pubDate = new Date().toISOString();
      
      let description = item.querySelector('description')?.textContent?.trim();
      if (!description) description = item.querySelector('summary')?.textContent?.trim();
      if (!description) description = item.querySelector('content')?.textContent?.trim();
      if (!description) description = item.querySelector('content\\:encoded')?.textContent?.trim();
      
      if (title && link) {
        const timestamp = new Date(pubDate).getTime();
        const publishedAtISO = new Date(pubDate).toISOString();
        const id = generateId(sourceName, title, publishedAtISO);
        
        const cleanDescription = description 
          ? description.replace(/<[^>]*>/g, '').replace(/&[^;]+;/g, ' ').substring(0, 300).trim()
          : '';
        
        const now = Date.now();
        const diff = now - timestamp;
        const hours = Math.floor(diff / (1000 * 60 * 60));
        const publishedAt = hours < 1 ? 'Just now' 
          : hours < 24 ? `${hours} hour${hours === 1 ? '' : 's'} ago` 
          : `${Math.floor(hours / 24)} day${Math.floor(hours / 24) === 1 ? '' : 's'} ago`;
        
        parsed.push({
          id,
          title,
          link,
          source: sourceName,
          topic,
          publishedAt,
          publishedAtISO,
          timestamp,
          descriptionSnippet: cleanDescription,
          sourceName,
          rssFeedUrlUsed: url,
          fetchedAtISO,
          itemUrl: link,
          originalTitle: title,
          originalDescriptionSnippet: cleanDescription
        });
      }
    }
    
    return { items: parsed, error: null, url };
  } catch (error) {
    if (error.name === 'AbortError') throw error;
    return { items: [], error: error.message, url };
  }
};

const processHeadlineItemsWithLLM = async (items, signal) => {
  if (items.length === 0) return [];
  
  const batchSize = 15;
  const batches = [];
  for (let i = 0; i < items.length; i += batchSize) {
    batches.push(items.slice(i, i + batchSize));
  }
  
  const enrichedBatches = await Promise.allSettled(
    batches.map(async (batch) => {
      try {
        const itemsText = batch.map((item, idx) => 
          `Item ${idx + 1}:\nTitle: ${item.title}\nSource: ${item.source}\nDescription: ${item.descriptionSnippet || 'No description'}`
        ).join('\n\n');
        
        const prompt = `Analyze these ${batch.length} news headlines and provide calm, neutral rewrites.

${itemsText}

Return ONLY valid JSON:
{
  "items": [
    {
      "contextLine": "Calm sentence (max 120 chars)",
      "shortSummary": "Brief summary (max 320 chars)",
      "negativity": "low or medium or high"
    }
  ]
}

Rules: Never invent facts. Use calm language. If no description, say "Details limited". Return ${batch.length} items in same order.`;

        const response = await miyagiAPI.post('/generate-text', {
          prompt,
          model: 'gpt-4o-mini',
          temperature: 0.3,
          max_tokens: 2000,
          system_prompt: 'You are a calm news assistant. Return valid JSON only.'
        });

        if (response.success && response.data?.text) {
          const text = response.data.text.trim();
          const jsonMatch = text.match(/\{[\s\S]*\}/);
          if (jsonMatch) {
            const parsed = JSON.parse(jsonMatch[0]);
            
            return batch.map((item, idx) => {
              const llmData = parsed.items?.[idx] || {};
              return {
                ...item,
                contextLine: (llmData.contextLine || item.descriptionSnippet || 'Read more for details').substring(0, 120),
                shortSummary: (llmData.shortSummary || item.descriptionSnippet || 'Details limited from source preview.').substring(0, 320),
                negativity: llmData.negativity || 'medium'
              };
            });
          }
        }
        
        return batch.map(item => ({
          ...item,
          contextLine: (item.descriptionSnippet || 'Read more for details').substring(0, 120),
          shortSummary: (item.descriptionSnippet || 'Details limited from source preview.').substring(0, 320),
          negativity: 'medium'
        }));
      } catch (error) {
        if (error.name === 'AbortError') throw error;
        return batch.map(item => ({
          ...item,
          contextLine: (item.descriptionSnippet || 'Read more for details').substring(0, 120),
          shortSummary: (item.descriptionSnippet || 'Details limited from source preview.').substring(0, 320),
          negativity: 'medium'
        }));
      }
    })
  );
  
  const allEnriched = [];
  enrichedBatches.forEach(result => {
    if (result.status === 'fulfilled' && Array.isArray(result.value)) {
      allEnriched.push(...result.value);
    }
  });
  
  return allEnriched;
};

const generateTopicBrief = async (allItems, topic, signal) => {
  if (!allItems || allItems.length === 0) {
    return {
      themeLabel: topic,
      takeaway: `Select sources and click Refresh to see your ${topic} brief.`,
      nowBullets: [],
      stakeholdersBullets: [],
      watchNextBullets: [],
      whyItMattersBullets: [],
      viewpointsBullets: []
    };
  }

  try {
    const briefItems = allItems.slice(0, 20);
    const itemsText = briefItems.map((item, idx) => 
      `${idx + 1}. [${item.source}] ${item.title}\n   ${item.descriptionSnippet || 'No description'}`
    ).join('\n\n');
    
    const prompt = `Analyze these ${briefItems.length} ${topic} news items and create a detailed structured brief.

${itemsText}

Return ONLY valid JSON:
{
  "themeLabel": "Brief theme label (max 25 chars like ${topic} Today)",
  "takeaway": "One sentence key takeaway (max 150 chars)",
  "nowBullets": ["bullet 1 (max 120 chars)", "bullet 2", ...],
  "stakeholdersBullets": ["bullet 1", "bullet 2", ...],
  "watchNextBullets": ["bullet 1", "bullet 2", ...],
  "whyItMattersBullets": ["bullet 1", "bullet 2", ...],
  "viewpointsBullets": ["bullet 1", "bullet 2", ...]
}

Section requirements:
- nowBullets: 5-7 bullets on distinct current developments
- stakeholdersBullets: 3-6 bullets on key players and organizations
- watchNextBullets: 3-5 bullets on what to watch for next
- whyItMattersBullets: 3-5 bullets on practical implications
- viewpointsBullets: 2-4 bullets contrasting different perspectives if present

Rules: Use ONLY provided titles and descriptions. Never invent facts. If limited info, say "Details limited from source previews" in bullets. Keep calm, neutral tone. Synthesize patterns across sources, don't repeat individual headlines.`;

    const response = await miyagiAPI.post('/generate-text', {
      prompt,
      model: 'gpt-4o-mini',
      temperature: 0.4,
      max_tokens: 2500,
      system_prompt: 'You are a calm news briefing assistant. Return valid JSON only.'
    });

    if (response.success && response.data?.text) {
      const text = response.data.text.trim();
      const jsonMatch = text.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]);
        
        return {
          themeLabel: (parsed.themeLabel || topic).substring(0, 30),
          takeaway: (parsed.takeaway || '').substring(0, 150),
          nowBullets: (parsed.nowBullets || []).slice(0, 7).map(b => b.substring(0, 120)),
          stakeholdersBullets: (parsed.stakeholdersBullets || []).slice(0, 6).map(b => b.substring(0, 120)),
          watchNextBullets: (parsed.watchNextBullets || []).slice(0, 5).map(b => b.substring(0, 120)),
          whyItMattersBullets: (parsed.whyItMattersBullets || []).slice(0, 5).map(b => b.substring(0, 120)),
          viewpointsBullets: (parsed.viewpointsBullets || []).slice(0, 4).map(b => b.substring(0, 120))
        };
      }
    }
  } catch (error) {
    if (error.name === 'AbortError') throw error;
  }
  
  return {
    themeLabel: topic,
    takeaway: `${allItems.length} ${topic} developments tracked across sources.`,
    nowBullets: allItems.slice(0, 5).map(item => item.title.substring(0, 120)),
    stakeholdersBullets: ['Details limited from source previews.'],
    watchNextBullets: ['Check back for updates.'],
    whyItMattersBullets: [`Stay informed on ${topic} trends.`],
    viewpointsBullets: []
  };
};

const generateFallbackBrief = async (topic) => {
  return {
    items: [{
      id: `fallback-${topic}-0`,
      title: `${topic} news updates available`,
      link: '#',
      source: 'Generated Brief',
      topic,
      publishedAt: 'Just now',
      publishedAtISO: new Date().toISOString(),
      timestamp: Date.now(),
      descriptionSnippet: 'Try refreshing or selecting different sources.',
      contextLine: `Current ${topic} developments`,
      shortSummary: 'Unable to fetch live headlines. Try refreshing.',
      negativity: 'low',
      isFallback: true
    }],
    brief: {
      themeLabel: 'Generated Overview',
      takeaway: 'Unable to fetch live headlines. Try selecting different sources or clicking Refresh.',
      nowBullets: ['Live headlines are currently unavailable for this topic.'],
      stakeholdersBullets: [],
      watchNextBullets: ['Try selecting different news sources in Preferences.'],
      whyItMattersBullets: ['Stay informed by refreshing to fetch latest updates.'],
      viewpointsBullets: []
    }
  };
};

const fetchTopicFeeds = async (topic, sources, signal) => {
  const feedsForTopic = RSS_FEEDS_BY_TOPIC[topic] || {};
  const sourcesToFetch = sources.length > 0 ? sources : Object.keys(feedsForTopic);
  
  const results = await Promise.allSettled(
    sourcesToFetch.map(sourceName => {
      const feedUrl = feedsForTopic[sourceName];
      if (!feedUrl) {
        return Promise.resolve({ 
          status: 'fulfilled',
          value: { 
            items: [], 
            error: 'No feed for this topic', 
            url: 'N/A',
            source: sourceName 
          }
        });
      }
      return parseRSSFeed(feedUrl, sourceName, topic, signal);
    })
  );
  
  const diagnostics = [];
  const allItems = [];
  
  results.forEach((result, idx) => {
    const sourceName = sourcesToFetch[idx];
    
    if (result.status === 'fulfilled') {
      const data = result.value;
      diagnostics.push({
        source: sourceName,
        topic,
        url: data.url || feedsForTopic[sourceName] || 'N/A',
        status: data.error ? 'failed' : 'success',
        error: data.error,
        itemCount: data.items.length
      });
      if (data.items.length > 0) {
        allItems.push(...data.items);
      }
    } else {
      diagnostics.push({
        source: sourceName,
        topic,
        url: feedsForTopic[sourceName] || 'N/A',
        status: 'failed',
        error: result.reason?.message || 'Unknown error',
        itemCount: 0
      });
    }
  });
  
  return { items: allItems, diagnostics };
};

const deduplicateItems = (items) => {
  const seen = new Set();
  return items.filter(item => {
    if (seen.has(item.id)) return false;
    seen.add(item.id);
    return true;
  });
};

const selectHeadlines = (items, topic, negativityFilter, selectedSources) => {
  let filtered = items.filter(item => item.topic === topic);

  if (selectedSources && selectedSources.length > 0) {
    filtered = filtered.filter(item => selectedSources.includes(item.source));
  }

  if (negativityFilter === 'Light') {
    filtered = filtered.filter(item => item.negativity !== 'high');
  } else if (negativityFilter === 'Strict') {
    filtered = filtered.filter(item => item.negativity === 'low');
  }

  filtered.sort((a, b) => {
    if (a.publishedAtISO !== b.publishedAtISO) return b.publishedAtISO.localeCompare(a.publishedAtISO);
    if (a.source !== b.source) return a.source.localeCompare(b.source);
    return a.title.localeCompare(b.title);
  });

  return filtered;
};

function NewsWithoutDoomLibrary() {
  const [tailwindLoaded, setTailwindLoaded] = useState(false);
  
  // Global storage - same keys as original widgets
  const [selectedTopic, setSelectedTopic] = useGlobalStorage('news.prefs.topicSelected', 'Tech');
  const [selectedSources, setSelectedSources] = useGlobalStorage('news.prefs.sources', []);
  const [negativityFilter, setNegativityFilter] = useGlobalStorage('news.prefs.negativity', 'Light');
  const [lastRefresh, setLastRefresh] = useGlobalStorage('news.cache.lastFetchISO', new Date().toISOString());
  const [diagnostics, setDiagnostics] = useGlobalStorage('news.diagnostics', []);
  const [topicCache, setTopicCache] = useGlobalStorage('news.cache.perTopic', {});
  const [viewItems, setViewItems] = useGlobalStorage('news.view.items', []);
  const [topicBrief, setTopicBrief] = useGlobalStorage('news.view.contextTopicBrief', {});
  const [savedItems, setSavedItems] = useGlobalStorage('news.saved.items', []);
  
  // Local UI state
  const [sourcesOpen, setSourcesOpen] = useState(false);
  const [showDiagnostics, setShowDiagnostics] = useState(false);
  const [updating, setUpdating] = useState(false);
  const [selectedHeadline, setSelectedHeadline] = useState(null);
  const [currentPage, setCurrentPage] = useState(0);
  const [showFullBrief, setShowFullBrief] = useState(false);
  const [showAllSaved, setShowAllSaved] = useState(false);
  
  const dropdownRef = useRef(null);
  const abortControllerRef = useRef(null);
  const requestIdRef = useRef(0);

  const topics = ['Tech', 'Business', 'Science', 'Markets', 'Sports', 'Local'];
  const sources = ['TechCrunch', 'Reuters', 'BBC', 'The Verge', 'Wired', 'AP News'];
  const filterOptions = ['Off', 'Light', 'Strict'];
  const ITEMS_PER_PAGE = 6;

  useEffect(() => {
    if (!document.getElementById('tailwind-script')) {
      const tailwindScript = document.createElement('script');
      tailwindScript.id = 'tailwind-script';
      tailwindScript.src = 'https://cdn.tailwindcss.com';
      tailwindScript.onload = () => setTimeout(() => setTailwindLoaded(true), 100);
      document.head.appendChild(tailwindScript);
    } else {
      setTailwindLoaded(true);
    }

    document.body.style.background = '#ffffff';
    document.documentElement.style.minHeight = '100%';
    return () => {
      document.body.style.background = '';
      document.documentElement.style.minHeight = '';
    };
  }, []);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setSourcesOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  useEffect(() => {
    if (!tailwindLoaded) return;
    
    const today = getTodayDateKey();
    const cacheKey = `${selectedTopic}-${today}`;
    const cached = topicCache[cacheKey];
    
    if (cached) {
      setViewItems(cached.items || []);
      setTopicBrief(cached.brief || {});
    }
  }, [selectedTopic, tailwindLoaded, topicCache]);

  useEffect(() => {
    if (!tailwindLoaded) return;

    const fetchContent = async () => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
      
      abortControllerRef.current = new AbortController();
      const signal = abortControllerRef.current.signal;
      const currentRequestId = ++requestIdRef.current;
      
      const today = getTodayDateKey();
      const cacheKey = `${selectedTopic}-${today}`;
      const cached = topicCache[cacheKey];
      
      if (cached && cached.items && cached.items.length > 0) {
        const cachedDate = cached.dateKey || '';
        if (cachedDate === today) {
          return;
        }
      }
      
      if (cached && cached.items && cached.items.length > 0) {
        setUpdating(true);
      }

      try {
        const result = await fetchTopicFeeds(selectedTopic, selectedSources || [], signal);
        
        if (currentRequestId !== requestIdRef.current) {
          return;
        }
        
        let items = result.items;
        
        if (items.length === 0) {
          const fallback = await generateFallbackBrief(selectedTopic);
          
          const updatedCache = {
            ...topicCache,
            [cacheKey]: {
              items: fallback.items,
              brief: fallback.brief,
              timestamp: new Date().toISOString(),
              dateKey: today
            }
          };
          
          setTopicCache(updatedCache);
          setViewItems(fallback.items);
          setTopicBrief(fallback.brief);
          setDiagnostics(result.diagnostics);
          return;
        }
        
        const deduplicated = deduplicateItems(items);
        const allFiltered = selectHeadlines(deduplicated, selectedTopic, negativityFilter || 'Off', selectedSources || []);
        
        if (allFiltered.length === 0) {
          const fallback = await generateFallbackBrief(selectedTopic);
          
          const updatedCache = {
            ...topicCache,
            [cacheKey]: {
              items: fallback.items,
              brief: fallback.brief,
              timestamp: new Date().toISOString(),
              dateKey: today
            }
          };
          
          setTopicCache(updatedCache);
          setViewItems(fallback.items);
          setTopicBrief(fallback.brief);
          setDiagnostics(result.diagnostics);
          return;
        }
        
        const enrichedAll = await processHeadlineItemsWithLLM(allFiltered, signal);
        
        if (currentRequestId !== requestIdRef.current) {
          return;
        }
        
        const tempCache = {
          ...topicCache,
          [cacheKey]: {
            items: enrichedAll,
            brief: cached?.brief || { themeLabel: selectedTopic, takeaway: 'Generating brief...', nowBullets: [] },
            timestamp: new Date().toISOString(),
            dateKey: today
          }
        };
        
        setTopicCache(tempCache);
        setViewItems(enrichedAll);
        setDiagnostics(result.diagnostics);
        
        generateTopicBrief(enrichedAll, selectedTopic, signal).then(brief => {
          if (currentRequestId === requestIdRef.current) {
            const finalCache = {
              ...topicCache,
              [cacheKey]: {
                items: enrichedAll,
                brief,
                timestamp: new Date().toISOString(),
                dateKey: today
              }
            };
            
            setTopicCache(finalCache);
            setTopicBrief(brief);
          }
        }).catch(error => {
          if (error.name !== 'AbortError') {
            console.error('Background brief generation error:', error);
          }
        });
        
      } catch (error) {
        if (error.name === 'AbortError') {
          return;
        }
        
        console.error('Fetch error:', error);
        
        if (currentRequestId !== requestIdRef.current) {
          return;
        }
        
        const fallback = await generateFallbackBrief(selectedTopic);
        
        const updatedCache = {
          ...topicCache,
          [cacheKey]: {
            items: fallback.items,
            brief: fallback.brief,
            timestamp: new Date().toISOString(),
            dateKey: today
          }
        };
        
        setTopicCache(updatedCache);
        setViewItems(fallback.items);
        setTopicBrief(fallback.brief);
      } finally {
        if (currentRequestId === requestIdRef.current) {
          setUpdating(false);
        }
      }
    };

    fetchContent();
    
    return () => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
  }, [selectedTopic, lastRefresh, tailwindLoaded]);

  useEffect(() => {
    setCurrentPage(0);
  }, [selectedTopic]);

  const headlines = useMemo(() => viewItems || [], [viewItems]);
  
  const totalPages = useMemo(() => {
    return Math.max(1, Math.ceil(headlines.length / ITEMS_PER_PAGE));
  }, [headlines.length, ITEMS_PER_PAGE]);
  
  const paginatedHeadlines = useMemo(() => {
    const start = currentPage * ITEMS_PER_PAGE;
    const end = start + ITEMS_PER_PAGE;
    return headlines.slice(start, end);
  }, [headlines, currentPage, ITEMS_PER_PAGE]);

  const sortedSaved = useMemo(() => {
    const items = savedItems || [];
    return [...items].sort((a, b) => (b.savedAt || 0) - (a.savedAt || 0));
  }, [savedItems]);

  const displayedSaved = useMemo(() => sortedSaved.slice(0, 3), [sortedSaved]);
  
  const brief = useMemo(() => {
    const b = topicBrief || {};
    
    if (!b.themeLabel) {
      return {
        themeLabel: selectedTopic || 'Daily News',
        takeaway: `Loading ${selectedTopic} briefing...`,
        nowBullets: ['Select sources and click Refresh.'],
        stakeholdersBullets: [],
        watchNextBullets: [],
        whyItMattersBullets: [],
        viewpointsBullets: []
      };
    }
    
    const isGenerating = b.takeaway && b.takeaway.includes('Generating brief');
    
    return {
      ...b,
      isGenerating
    };
  }, [topicBrief, selectedTopic]);

  const selectTopic = (topic) => {
    setSelectedTopic(topic);
  };

  const toggleSource = (source) => {
    setSelectedSources(prev => {
      const current = prev || [];
      if (current.includes(source)) {
        return current.filter(s => s !== source);
      }
      return [...current, source];
    });
  };

  const handleRefresh = () => {
    setLastRefresh(new Date().toISOString());
  };

  const handlePrevPage = useCallback(() => {
    setCurrentPage(prev => Math.max(0, prev - 1));
  }, []);
  
  const handleNextPage = useCallback(() => {
    setCurrentPage(prev => Math.min(totalPages - 1, prev + 1));
  }, [totalPages]);

  const handleSave = (headline) => {
    if (headline.isFallback) return;
    setSavedItems(prev => {
      const current = prev || [];
      const exists = current.find(h => h.id === headline.id);
      if (exists) {
        return current.filter(h => h.id !== headline.id);
      }
      return [...current, { ...headline, savedAt: Date.now() }];
    });
  };

  const isSaved = (headlineId) => {
    return (savedItems || []).some(h => h.id === headlineId);
  };

  const handleRemoveSaved = (id) => {
    setSavedItems(prev => (prev || []).filter(item => item.id !== id));
  };

  const handleClearAllSaved = () => {
    if (confirm('Remove all saved items?')) {
      setSavedItems([]);
      setShowAllSaved(false);
    }
  };

  if (!tailwindLoaded) {
    return <div style={{ padding: '20px', textAlign: 'center' }}>Loading...</div>;
  }

  const totalItems = (viewItems || []).length;
  const successCount = (diagnostics || []).filter(d => d.status === 'success').length;
  const failedCount = (diagnostics || []).filter(d => d.status === 'failed').length;

  return (
    <div className="w-full min-h-screen bg-white">
      <style>{`
        * {
          font-family: -apple-system, BlinkMacSystemFont, 'Inter', 'Helvetica Neue', 'Segoe UI', sans-serif;
        }
        .modal-overlay {
          backdrop-filter: blur(8px);
        }
        @keyframes spin {
          to { transform: rotate(360deg); }
        }
        .animate-spin {
          animation: spin 1s linear infinite;
        }
        .context-card {
          background: linear-gradient(135deg, #1a1a1a 0%, #2d2d2d 100%);
        }
      `}</style>

      <div className="max-w-7xl mx-auto px-16 py-16">
        {/* Header */}
        <div className="mb-20">
          <div className="flex items-center gap-4 mb-4">
            <h1 className="text-5xl font-black text-black uppercase tracking-tight">News Without Doom</h1>
            <div className="w-4 h-4 bg-gradient-to-br from-yellow-400 to-yellow-500 rounded-full"></div>
          </div>
          <p className="text-lg text-gray-600 font-bold">Calm, curated news for mindful consumption</p>
        </div>

        {/* Section 1: Preferences */}
        <section className="mb-24">
          <div className="flex items-center gap-4 mb-12">
            <h2 className="text-3xl font-black text-black uppercase tracking-tight">Preferences</h2>
            <div className="w-3 h-3 bg-gradient-to-br from-yellow-400 to-yellow-500 rounded-full"></div>
          </div>
          
          <div className="space-y-16">
            {/* Topics */}
            <div>
              <label className="block text-xs font-black uppercase tracking-wider text-gray-900 mb-6">Topic</label>
              <div className="flex flex-wrap gap-4">
                {topics.map(topic => {
                  const isSelected = selectedTopic === topic;
                  return (
                    <button
                      key={topic}
                      onClick={() => selectTopic(topic)}
                      className={`px-8 py-3 rounded-full text-sm font-bold uppercase tracking-wide transition-all shadow-lg ${
                        isSelected
                          ? 'bg-gradient-to-br from-yellow-400 to-yellow-500 text-black'
                          : 'bg-white text-gray-700 border-2 border-gray-200 hover:border-gray-300'
                      }`}
                    >
                      {topic}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Sources */}
            <div>
              <label className="block text-xs font-black uppercase tracking-wider text-gray-900 mb-6">Sources</label>
              <div className="relative" ref={dropdownRef}>
                <button
                  onClick={() => setSourcesOpen(!sourcesOpen)}
                  className="w-full max-w-xl px-6 py-4 bg-white border-2 border-gray-200 rounded-2xl text-left text-gray-900 hover:border-gray-300 transition-all flex items-center justify-between shadow-lg"
                >
                  <span className="text-sm font-bold">
                    {(selectedSources || []).length === 0
                      ? 'All sources'
                      : `${selectedSources.length} source${selectedSources.length === 1 ? '' : 's'} selected`}
                  </span>
                  <svg className={`w-5 h-5 text-gray-600 transition-transform ${sourcesOpen ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M19 9l-7 7-7-7" />
                  </svg>
                </button>

                {sourcesOpen && (
                  <div className="absolute top-full left-0 right-0 max-w-xl mt-2 bg-white border-2 border-gray-200 rounded-2xl overflow-hidden z-10 shadow-2xl">
                    {sources.map(source => {
                      const isSelected = (selectedSources || []).includes(source);
                      return (
                        <button
                          key={source}
                          onClick={() => toggleSource(source)}
                          className="w-full px-6 py-4 text-left text-sm font-bold hover:bg-gray-50 transition-colors flex items-center justify-between border-b border-gray-100 last:border-0"
                        >
                          <span className="text-gray-900">{source}</span>
                          {isSelected && (
                            <div className="w-6 h-6 bg-gradient-to-br from-yellow-400 to-yellow-500 rounded-full flex items-center justify-center shadow-lg">
                              <svg className="w-4 h-4 text-black" fill="currentColor" viewBox="0 0 20 20">
                                <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                              </svg>
                            </div>
                          )}
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>

            {/* Negativity Filter & Refresh */}
            <div className="flex items-end gap-8">
              <div className="flex-1">
                <label className="block text-xs font-black uppercase tracking-wider text-gray-900 mb-6">Negativity Filter</label>
                <div className="flex gap-4">
                  {filterOptions.map(option => {
                    const isSelected = negativityFilter === option;
                    return (
                      <button
                        key={option}
                        onClick={() => setNegativityFilter(option)}
                        className={`flex-1 px-6 py-3 rounded-2xl text-sm font-bold uppercase tracking-wide transition-all shadow-lg ${
                          isSelected
                            ? 'bg-black text-white'
                            : 'bg-white border-2 border-gray-200 text-gray-700 hover:border-gray-300'
                        }`}
                      >
                        {option}
                      </button>
                    );
                  })}
                </div>
              </div>

              <button
                onClick={handleRefresh}
                className="px-12 py-4 bg-gradient-to-br from-yellow-400 to-yellow-500 text-black rounded-2xl text-sm font-black uppercase tracking-wide hover:scale-105 transition-all shadow-2xl"
              >
                Refresh
              </button>
            </div>

            {/* Diagnostics */}
            <div className="pt-12 border-t-2 border-gray-200">
              <button
                onClick={() => setShowDiagnostics(!showDiagnostics)}
                className="flex items-center justify-between w-full mb-6"
              >
                <label className="text-xs font-black uppercase tracking-wider text-gray-900">Diagnostics</label>
                <svg className={`w-5 h-5 text-gray-600 transition-transform ${showDiagnostics ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M19 9l-7 7-7-7" />
                </svg>
              </button>

              {showDiagnostics && (
                <div className="space-y-6">
                  <div className="grid grid-cols-3 gap-6">
                    <div className="bg-white border-2 border-gray-200 p-6 rounded-2xl shadow-lg">
                      <p className="text-xs font-bold text-gray-600 uppercase tracking-wide mb-2">Total Items</p>
                      <p className="text-3xl font-black text-gray-900">{totalItems}</p>
                    </div>
                    <div className="bg-white border-2 border-gray-200 p-6 rounded-2xl shadow-lg">
                      <p className="text-xs font-bold text-gray-600 uppercase tracking-wide mb-2">Sources Success</p>
                      <p className="text-3xl font-black text-green-600">{successCount}</p>
                    </div>
                    <div className="bg-white border-2 border-gray-200 p-6 rounded-2xl shadow-lg">
                      <p className="text-xs font-bold text-gray-600 uppercase tracking-wide mb-2">Sources Failed</p>
                      <p className="text-3xl font-black text-red-600">{failedCount}</p>
                    </div>
                  </div>

                  {(diagnostics || []).length > 0 && (
                    <div className="space-y-3 max-h-80 overflow-y-auto">
                      {diagnostics.map((diag, idx) => (
                        <div key={idx} className="bg-white border-2 border-gray-200 rounded-2xl p-6 shadow-lg">
                          <div className="flex items-start justify-between mb-4">
                            <div className="flex-1">
                              <div className="flex items-center gap-3 mb-3">
                                <span className="text-sm font-black text-gray-900 uppercase tracking-wide">{diag.source}</span>
                                <span className={`px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wide ${
                                  diag.status === 'success' ? 'bg-green-100 text-green-700' :
                                  diag.status === 'failed' ? 'bg-red-100 text-red-700' :
                                  'bg-gray-100 text-gray-600'
                                }`}>
                                  {diag.status}
                                </span>
                              </div>
                              <div className="bg-gray-50 p-3 rounded-xl mb-2">
                                <p className="text-xs text-gray-600 font-bold mb-1 uppercase tracking-wide">RSS Feed URL:</p>
                                <p className="text-xs text-gray-800 font-mono break-all">{diag.url}</p>
                              </div>
                            </div>
                            <div className="text-right ml-6">
                              <p className="text-xs font-bold text-gray-600 mb-1 uppercase tracking-wide">Items</p>
                              <p className="text-2xl font-black text-gray-900">{diag.itemCount}</p>
                            </div>
                          </div>
                          {diag.error && (
                            <div className="bg-red-50 border-l-4 border-red-400 p-3 rounded-r-xl">
                              <p className="text-xs font-bold text-red-700">Error: {diag.error}</p>
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </section>

        {/* Section 2: Headlines */}
        <section className="mb-24">
          <div className="flex items-center justify-between mb-12">
            <div className="flex items-center gap-4">
              <h2 className="text-3xl font-black text-black uppercase tracking-tight">{selectedTopic} Headlines</h2>
              <div className="w-3 h-3 bg-gradient-to-br from-yellow-400 to-yellow-500 rounded-full"></div>
              {headlines.length > 0 && (
                <span className="text-sm font-bold text-gray-500">
                  {headlines.length} item{headlines.length === 1 ? '' : 's'}
                </span>
              )}
            </div>
            {updating && (
              <div className="flex items-center gap-2 px-4 py-2 bg-gray-100 rounded-full">
                <div className="w-4 h-4 border-2 border-gray-400 border-t-transparent rounded-full animate-spin"></div>
                <span className="text-xs font-bold text-gray-600 uppercase tracking-wide">Updating</span>
              </div>
            )}
          </div>

          {(selectedSources || []).length === 0 ? (
            <div className="flex items-center justify-center py-20">
              <div className="text-center max-w-md">
                <div className="w-24 h-24 bg-gradient-to-br from-yellow-400 to-yellow-500 rounded-full flex items-center justify-center mx-auto mb-6 shadow-xl">
                  <svg className="w-12 h-12 text-black" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                  </svg>
                </div>
                <p className="text-gray-900 font-bold text-lg mb-2">Select sources to see headlines</p>
                <p className="text-sm text-gray-500">Open the Sources dropdown to choose your news sources</p>
              </div>
            </div>
          ) : (
            <>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-8">
                {paginatedHeadlines.map(headline => (
                  <div key={headline.id} className="bg-gradient-to-br from-yellow-400 via-yellow-400 to-yellow-500 rounded-3xl p-8 shadow-2xl relative overflow-hidden">
                    {headline.isFallback && (
                      <div className="absolute top-4 left-4 px-3 py-1 bg-black/20 rounded-full">
                        <span className="text-xs font-bold text-black/80 uppercase tracking-wide">Generated Brief</span>
                      </div>
                    )}
                    <button
                      onClick={() => handleSave(headline)}
                      className="absolute top-6 right-6 w-12 h-12 bg-black rounded-full flex items-center justify-center hover:scale-110 transition-transform shadow-lg"
                      disabled={headline.isFallback}
                    >
                      <svg className={`w-6 h-6 ${isSaved(headline.id) ? 'fill-yellow-400' : 'fill-none stroke-yellow-400'} ${headline.isFallback ? 'opacity-50' : ''}`} viewBox="0 0 24 24" strokeWidth={2.5}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M5 5a2 2 0 012-2h10a2 2 0 012 2v16l-7-3.5L5 21V5z" />
                      </svg>
                    </button>

                    <div className="mb-6 mt-8">
                      <div className="flex items-center gap-3 mb-2">
                        <span className="text-xs font-black uppercase tracking-wider text-black/80">{headline.source}</span>
                        <div className="w-1.5 h-1.5 bg-black/40 rounded-full"></div>
                        <span className="text-xs font-bold text-black/60">{headline.publishedAt}</span>
                      </div>
                    </div>

                    <h3 
                      className="text-xl font-black text-black mb-6 leading-tight cursor-pointer pr-16" 
                      onClick={() => setSelectedHeadline(headline)}
                    >
                      {headline.title}
                    </h3>

                    <div className="bg-black/10 rounded-2xl p-4 backdrop-blur-sm">
                      <p className="text-sm font-medium text-black/90 leading-relaxed">{headline.contextLine}</p>
                    </div>

                    <div className="absolute -bottom-8 -left-8 w-32 h-32 bg-black/5 rounded-full"></div>
                  </div>
                ))}
              </div>
              
              {headlines.length > ITEMS_PER_PAGE && (
                <div className="flex items-center justify-center gap-6">
                  <button
                    onClick={handlePrevPage}
                    disabled={currentPage === 0}
                    className={`w-12 h-12 rounded-full flex items-center justify-center transition-all shadow-lg ${
                      currentPage === 0 
                        ? 'bg-gray-200 text-gray-400 cursor-not-allowed' 
                        : 'bg-gradient-to-br from-yellow-400 to-yellow-500 text-black hover:scale-110'
                    }`}
                  >
                    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M15 19l-7-7 7-7" />
                    </svg>
                  </button>
                  
                  <div className="flex items-center gap-3">
                    <span className="text-sm font-bold text-gray-700">
                      Page {currentPage + 1} of {totalPages}
                    </span>
                    <div className="flex gap-1">
                      {Array.from({ length: totalPages }).map((_, idx) => (
                        <button
                          key={idx}
                          onClick={() => setCurrentPage(idx)}
                          className={`w-2 h-2 rounded-full transition-all ${
                            idx === currentPage 
                              ? 'bg-yellow-400 w-6' 
                              : 'bg-gray-300 hover:bg-gray-400'
                          }`}
                        />
                      ))}
                    </div>
                  </div>
                  
                  <button
                    onClick={handleNextPage}
                    disabled={currentPage === totalPages - 1}
                    className={`w-12 h-12 rounded-full flex items-center justify-center transition-all shadow-lg ${
                      currentPage === totalPages - 1
                        ? 'bg-gray-200 text-gray-400 cursor-not-allowed' 
                        : 'bg-gradient-to-br from-yellow-400 to-yellow-500 text-black hover:scale-110'
                    }`}
                  >
                    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M9 5l7 7-7 7" />
                    </svg>
                  </button>
                </div>
              )}
            </>
          )}
        </section>

        {/* Section 3: Today's Context */}
        <section className="mb-24">
          <div className="flex items-center gap-4 mb-12">
            <h2 className="text-3xl font-black text-black uppercase tracking-tight">Today's Context</h2>
            <div className="w-3 h-3 bg-gradient-to-br from-yellow-400 to-yellow-500 rounded-full"></div>
          </div>
          
          <div className="context-card rounded-3xl p-10 shadow-2xl relative overflow-hidden">
            <div className="absolute -top-12 -right-12 w-48 h-48 bg-yellow-400/10 rounded-full"></div>
            <div className="absolute -bottom-16 -left-16 w-64 h-64 bg-yellow-400/5 rounded-full"></div>

            <div className="relative z-10">
              <div className="mb-6">
                <div className="flex items-center gap-4">
                  <div className="inline-flex items-center gap-3 px-6 py-3 bg-gradient-to-r from-yellow-400 to-yellow-500 rounded-full shadow-xl">
                    <svg className="w-5 h-5 text-black" fill="currentColor" viewBox="0 0 20 20">
                      <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                    </svg>
                    <span className="text-sm font-black uppercase tracking-wider text-black">{brief.themeLabel}</span>
                  </div>
                  {brief.isGenerating && (
                    <div className="flex items-center gap-2 px-3 py-1.5 bg-white/20 rounded-full">
                      <div className="w-3 h-3 border-2 border-white/60 border-t-transparent rounded-full animate-spin"></div>
                      <span className="text-xs font-bold text-white/80 uppercase tracking-wide">Updating</span>
                    </div>
                  )}
                </div>
              </div>

              {brief.takeaway && (
                <div className="bg-yellow-400/10 border-l-4 border-yellow-400 p-4 rounded-r-xl mb-6">
                  <p className="text-sm font-bold text-white leading-relaxed">{brief.takeaway}</p>
                </div>
              )}

              <div className="space-y-6 max-h-96 overflow-y-auto pr-2">
                {brief.nowBullets && brief.nowBullets.length > 0 && (
                  <div>
                    <h4 className="text-sm font-black uppercase tracking-wider text-yellow-400 mb-3">What's Happening Now</h4>
                    <ul className="space-y-2">
                      {brief.nowBullets.map((bullet, idx) => (
                        <li key={idx} className="flex items-start gap-3">
                          <div className="w-1.5 h-1.5 bg-yellow-400 rounded-full mt-2 flex-shrink-0"></div>
                          <p className="text-sm text-white/90 leading-relaxed">{bullet}</p>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>

              <div className="mt-6 pt-6 border-t-2 border-white/10 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-yellow-400/20 rounded-full flex items-center justify-center">
                    <svg className="w-5 h-5 text-yellow-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                  </div>
                  <span className="text-sm font-bold text-white/70 uppercase tracking-wide">
                    Updated {Math.floor((Date.now() - new Date(lastRefresh).getTime()) / (1000 * 60))} minutes ago
                  </span>
                </div>
                <button
                  onClick={() => setShowFullBrief(true)}
                  className="px-4 py-2 bg-yellow-400/20 hover:bg-yellow-400/30 text-yellow-400 rounded-xl text-xs font-bold uppercase tracking-wide transition-all"
                >
                  View Full Brief
                </button>
              </div>
            </div>
          </div>
        </section>

        {/* Section 4: Saved */}
        <section className="mb-24">
          <div className="flex items-center justify-between mb-12">
            <div className="flex items-center gap-4">
              <h2 className="text-3xl font-black text-black uppercase tracking-tight">Saved</h2>
              <div className="w-3 h-3 bg-gradient-to-br from-yellow-400 to-yellow-500 rounded-full"></div>
              {sortedSaved.length > 0 && (
                <div className="w-12 h-12 bg-gradient-to-br from-yellow-400 to-yellow-500 rounded-full flex items-center justify-center shadow-lg">
                  <span className="text-sm font-black text-black">{sortedSaved.length}</span>
                </div>
              )}
            </div>
            {sortedSaved.length > 3 && (
              <button
                onClick={() => setShowAllSaved(true)}
                className="px-6 py-3 bg-gradient-to-br from-yellow-400 to-yellow-500 text-black rounded-2xl text-sm font-bold uppercase tracking-wide hover:scale-105 transition-all shadow-lg"
              >
                See All
              </button>
            )}
          </div>

          {sortedSaved.length === 0 ? (
            <div className="flex items-center justify-center py-20">
              <div className="text-center">
                <div className="w-24 h-24 bg-gradient-to-br from-yellow-400 to-yellow-500 rounded-full flex items-center justify-center mx-auto mb-6 shadow-xl">
                  <svg className="w-12 h-12 text-black" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 5a2 2 0 012-2h10a2 2 0 012 2v16l-7-3.5L5 21V5z" />
                  </svg>
                </div>
                <p className="text-gray-900 font-bold text-lg">No saved items yet</p>
                <p className="text-sm text-gray-500 mt-2">Save headlines to read later</p>
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              {displayedSaved.map(item => (
                <div key={item.id} className="bg-white border-2 border-gray-200 rounded-2xl p-6 hover:border-gray-300 transition-all shadow-lg">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-3">
                        <span className="text-xs font-black uppercase tracking-wider text-black/80">{item.source}</span>
                        <div className="w-1.5 h-1.5 bg-black/40 rounded-full"></div>
                        <span className="text-xs font-bold text-black/60">{item.publishedAt}</span>
                      </div>
                      <h4 className="text-base font-bold text-gray-900 leading-snug">
                        {item.title}
                      </h4>
                    </div>
                    <button
                      onClick={() => handleRemoveSaved(item.id)}
                      className="w-10 h-10 bg-gray-100 hover:bg-red-500 hover:scale-110 rounded-full transition-all flex items-center justify-center group shadow-lg"
                    >
                      <svg className="w-5 h-5 text-gray-500 group-hover:text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
      </div>

      {/* Headline Detail Modal */}
      {selectedHeadline && (
        <div className="modal-overlay fixed inset-0 bg-black/30 flex items-center justify-center z-50 p-10" onClick={() => setSelectedHeadline(null)}>
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-3xl max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            <div className="p-10">
              <div className="flex items-start justify-between mb-8">
                <div className="flex-1">
                  <div className="flex items-center gap-3 mb-4">
                    <span className="text-sm font-black uppercase tracking-wider text-gray-800">{selectedHeadline.source}</span>
                    <div className="w-1.5 h-1.5 bg-gray-400 rounded-full"></div>
                    <span className="text-sm font-bold text-gray-600">{selectedHeadline.publishedAt}</span>
                  </div>
                  <h2 className="text-3xl font-black text-black leading-tight">{selectedHeadline.title}</h2>
                </div>
                <button onClick={() => setSelectedHeadline(null)} className="w-12 h-12 bg-gray-100 hover:bg-gray-200 rounded-full flex items-center justify-center transition-colors flex-shrink-0 ml-6">
                  <svg className="w-6 h-6 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>

              <div className="bg-gradient-to-r from-yellow-400 to-yellow-500 p-6 mb-8 rounded-2xl shadow-xl">
                <p className="text-sm font-bold text-black leading-relaxed">{selectedHeadline.contextLine}</p>
              </div>

              <div className="prose prose-sm max-w-none mb-8">
                <p className="text-gray-800 leading-relaxed text-base">{selectedHeadline.shortSummary}</p>
              </div>

              {!selectedHeadline.isFallback && selectedHeadline.rssFeedUrlUsed && (
                <div className="mb-8 p-4 bg-gray-50 rounded-2xl">
                  <p className="text-xs font-bold uppercase tracking-wide text-gray-500 mb-3">Verification Metadata</p>
                  <div className="space-y-2 text-xs">
                    <div className="flex gap-2">
                      <span className="font-bold text-gray-700 min-w-[120px]">Source Name:</span>
                      <span className="text-gray-600">{selectedHeadline.sourceName}</span>
                    </div>
                    <div className="flex gap-2">
                      <span className="font-bold text-gray-700 min-w-[120px]">RSS Feed URL:</span>
                      <span className="text-gray-600 break-all font-mono text-[10px]">{selectedHeadline.rssFeedUrlUsed}</span>
                    </div>
                    <div className="flex gap-2">
                      <span className="font-bold text-gray-700 min-w-[120px]">Fetched At:</span>
                      <span className="text-gray-600">{new Date(selectedHeadline.fetchedAtISO).toLocaleString()}</span>
                    </div>
                    <div className="flex gap-2">
                      <span className="font-bold text-gray-700 min-w-[120px]">Published At:</span>
                      <span className="text-gray-600">{new Date(selectedHeadline.publishedAtISO).toLocaleString()}</span>
                    </div>
                    <div className="flex gap-2">
                      <span className="font-bold text-gray-700 min-w-[120px]">Item URL:</span>
                      <a href={selectedHeadline.itemUrl} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline break-all text-[10px]">{selectedHeadline.itemUrl}</a>
                    </div>
                  </div>
                </div>
              )}

              <div className="flex items-center justify-between pt-8 border-t-2 border-gray-100">
                <button onClick={() => handleSave(selectedHeadline)} className="flex items-center gap-3 px-8 py-4 bg-white border-2 border-gray-200 hover:border-gray-300 rounded-2xl text-sm font-bold text-gray-800 transition-all shadow-lg" disabled={selectedHeadline.isFallback}>
                  <svg className={`w-6 h-6 ${isSaved(selectedHeadline.id) ? 'fill-black' : 'fill-none stroke-current'}`} viewBox="0 0 24 24" strokeWidth={2.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 5a2 2 0 012-2h10a2 2 0 012 2v16l-7-3.5L5 21V5z" />
                  </svg>
                  {isSaved(selectedHeadline.id) ? 'Saved' : 'Save for Later'}
                </button>

                {!selectedHeadline.isFallback ? (
                  <a href={selectedHeadline.link} target="_blank" rel="noopener noreferrer" className="px-10 py-4 bg-gradient-to-br from-black to-gray-800 hover:from-gray-800 hover:to-black text-white rounded-2xl text-sm font-bold uppercase tracking-wide transition-all shadow-xl">
                    Read Full Article
                  </a>
                ) : (
                  <div className="px-10 py-4 bg-gray-200 text-gray-500 rounded-2xl text-sm font-bold uppercase tracking-wide">
                    Generated Brief
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Full Brief Modal */}
      {showFullBrief && (
        <div className="modal-overlay fixed inset-0 bg-black/30 flex items-center justify-center z-50 p-10" onClick={() => setShowFullBrief(false)}>
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-4xl max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            <div className="p-10">
              <div className="flex items-start justify-between mb-8">
                <div className="flex-1">
                  <div className="inline-flex items-center gap-3 px-6 py-3 bg-gradient-to-r from-yellow-400 to-yellow-500 rounded-full shadow-xl mb-4">
                    <svg className="w-5 h-5 text-black" fill="currentColor" viewBox="0 0 20 20">
                      <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                    </svg>
                    <span className="text-sm font-black uppercase tracking-wider text-black">{brief.themeLabel}</span>
                  </div>
                  <h2 className="text-3xl font-black text-black leading-tight">Today's Brief</h2>
                </div>
                <button onClick={() => setShowFullBrief(false)} className="w-12 h-12 bg-gray-100 hover:bg-gray-200 rounded-full flex items-center justify-center transition-colors flex-shrink-0 ml-6">
                  <svg className="w-6 h-6 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>

              {brief.takeaway && (
                <div className="bg-yellow-50 border-l-4 border-yellow-400 p-6 rounded-r-2xl mb-8">
                  <p className="text-base font-bold text-gray-900 leading-relaxed">{brief.takeaway}</p>
                </div>
              )}
              
              <div className="space-y-8">
                {brief.nowBullets && brief.nowBullets.length > 0 && (
                  <div>
                    <h4 className="text-lg font-black uppercase tracking-wider text-gray-900 mb-4">What's Happening Now</h4>
                    <ul className="space-y-3">
                      {brief.nowBullets.map((bullet, idx) => (
                        <li key={idx} className="flex items-start gap-3">
                          <div className="w-2 h-2 bg-yellow-400 rounded-full mt-2 flex-shrink-0"></div>
                          <p className="text-base text-gray-700 leading-relaxed">{bullet}</p>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {brief.stakeholdersBullets && brief.stakeholdersBullets.length > 0 && (
                  <div>
                    <h4 className="text-lg font-black uppercase tracking-wider text-gray-900 mb-4">Key Players & Stakeholders</h4>
                    <ul className="space-y-3">
                      {brief.stakeholdersBullets.map((bullet, idx) => (
                        <li key={idx} className="flex items-start gap-3">
                          <div className="w-2 h-2 bg-yellow-400 rounded-full mt-2 flex-shrink-0"></div>
                          <p className="text-base text-gray-700 leading-relaxed">{bullet}</p>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {brief.watchNextBullets && brief.watchNextBullets.length > 0 && (
                  <div>
                    <h4 className="text-lg font-black uppercase tracking-wider text-gray-900 mb-4">What to Watch Next</h4>
                    <ul className="space-y-3">
                      {brief.watchNextBullets.map((bullet, idx) => (
                        <li key={idx} className="flex items-start gap-3">
                          <div className="w-2 h-2 bg-yellow-400 rounded-full mt-2 flex-shrink-0"></div>
                          <p className="text-base text-gray-700 leading-relaxed">{bullet}</p>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {brief.whyItMattersBullets && brief.whyItMattersBullets.length > 0 && (
                  <div>
                    <h4 className="text-lg font-black uppercase tracking-wider text-gray-900 mb-4">Why This Matters</h4>
                    <ul className="space-y-3">
                      {brief.whyItMattersBullets.map((bullet, idx) => (
                        <li key={idx} className="flex items-start gap-3">
                          <div className="w-2 h-2 bg-yellow-400 rounded-full mt-2 flex-shrink-0"></div>
                          <p className="text-base text-gray-700 leading-relaxed">{bullet}</p>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {brief.viewpointsBullets && brief.viewpointsBullets.length > 0 && (
                  <div>
                    <h4 className="text-lg font-black uppercase tracking-wider text-gray-900 mb-4">Diversity of Viewpoints</h4>
                    <ul className="space-y-3">
                      {brief.viewpointsBullets.map((bullet, idx) => (
                        <li key={idx} className="flex items-start gap-3">
                          <div className="w-2 h-2 bg-yellow-400 rounded-full mt-2 flex-shrink-0"></div>
                          <p className="text-base text-gray-700 leading-relaxed">{bullet}</p>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>

              <div className="flex items-center justify-between pt-8 border-t-2 border-gray-100 mt-8">
                <div className="flex items-center gap-3 text-gray-500">
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  <span className="text-sm font-medium">Updated {Math.floor((Date.now() - new Date(lastRefresh).getTime()) / (1000 * 60))} minutes ago</span>
                </div>
                
                <button onClick={() => setShowFullBrief(false)} className="px-10 py-4 bg-gradient-to-br from-black to-gray-800 hover:from-gray-800 hover:to-black text-white rounded-2xl text-sm font-bold uppercase tracking-wide transition-all shadow-xl">
                  Done
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* All Saved Modal */}
      {showAllSaved && (
        <div className="modal-overlay fixed inset-0 bg-black/30 flex items-center justify-center z-50 p-10" onClick={() => setShowAllSaved(false)}>
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-4xl max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            <div className="p-10">
              <div className="flex items-center justify-between mb-8">
                <div className="flex items-center gap-4">
                  <h2 className="text-3xl font-black text-black uppercase tracking-tight">All Saved Items</h2>
                  <div className="w-12 h-12 bg-gradient-to-br from-yellow-400 to-yellow-500 rounded-full flex items-center justify-center shadow-lg">
                    <span className="text-sm font-black text-black">{sortedSaved.length}</span>
                  </div>
                </div>
                <button onClick={() => setShowAllSaved(false)} className="w-12 h-12 bg-gray-100 hover:bg-gray-200 rounded-full flex items-center justify-center transition-colors">
                  <svg className="w-6 h-6 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>

              <div className="space-y-4 mb-8">
                {sortedSaved.map(item => (
                  <div key={item.id} className="bg-white border-2 border-gray-200 rounded-2xl p-6 hover:border-gray-300 transition-all shadow-lg">
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1">
                        <div className="flex items-center gap-3 mb-3">
                          <span className="text-xs font-black uppercase tracking-wider text-black/80">{item.source}</span>
                          <div className="w-1.5 h-1.5 bg-black/40 rounded-full"></div>
                          <span className="text-xs font-bold text-black/60">{item.publishedAt}</span>
                        </div>
                        <h4 className="text-base font-bold text-gray-900 mb-3 leading-snug">{item.title}</h4>
                        <p className="text-sm text-gray-700 leading-relaxed">{item.contextLine || item.context}</p>
                      </div>
                      <button
                        onClick={() => handleRemoveSaved(item.id)}
                        className="w-10 h-10 bg-gray-100 hover:bg-red-500 hover:scale-110 rounded-full transition-all flex items-center justify-center group shadow-lg"
                      >
                        <svg className="w-5 h-5 text-gray-500 group-hover:text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                      </button>
                    </div>
                  </div>
                ))}
              </div>

              <div className="flex items-center justify-between pt-8 border-t-2 border-gray-100">
                <button
                  onClick={handleClearAllSaved}
                  className="px-8 py-4 text-red-700 hover:bg-red-50 rounded-2xl text-sm font-bold uppercase tracking-wide transition-all border-2 border-red-200 hover:border-red-300 shadow-lg"
                >
                  Clear All
                </button>
                <button onClick={() => setShowAllSaved(false)} className="px-10 py-4 bg-gradient-to-br from-black to-gray-800 hover:from-gray-800 hover:to-black text-white rounded-2xl text-sm font-bold uppercase tracking-wide transition-all shadow-xl">
                  Done
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default NewsWithoutDoomLibrary;
