import React, { useState, useCallback, useMemo, useEffect, useRef } from 'react';
import SlideThumbnails from './components/SlideThumbnails';
import SlideEditor from './components/SlideEditor';
import SlidePresenter from './components/SlidePresenter';
import HeaderBar from './components/HeaderBar';
import { exportSlidesToHTML, exportSlidesToPDF } from './utils/slideUtils';
import { initializeDefaults } from './utils/defaults';

/**
 * Slide Deck Widget
 * 
 * A clean, modern slide deck editor using file-based storage.
 * Each slide is stored as an HTML file that can be directly edited.
 * 
 * File Structure:
 * files/slides/
 * ├── config.json           # { currentDeckId, deckOrder }
 * └── {deckId}/
 *     ├── deck.json         # { title, currentSlideIndex, slideOrder }
 *     └── {slideId}.html    # Slide HTML content
 */

function generateId(prefix = 'id') {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).substr(2, 6)}`;
}

function SlideDeckWidget() {
  const files = useFiles('slides/');
  
  const [isPresenting, setIsPresenting] = useState(false);
  const [showDeckSidebar, setShowDeckSidebar] = useState(false);
  const initRef = useRef(false);

  // Read config
  const config = useMemo(() => {
    const raw = files.read('config.json');
    if (!raw) return { currentDeckId: null, deckOrder: [] };
    try {
      return typeof raw === 'string' ? JSON.parse(raw) : raw;
    } catch {
      return { currentDeckId: null, deckOrder: [] };
    }
  }, [files]);

  const currentDeckId = config.currentDeckId;
  const deckOrder = config.deckOrder || [];

  const writeConfig = useCallback((updates) => {
    const newConfig = { ...config, ...updates };
    files.write('config.json', JSON.stringify(newConfig, null, 2));
  }, [files, config]);

  // Read current deck
  const currentDeckMeta = useMemo(() => {
    if (!currentDeckId) return null;
    const raw = files.read(`${currentDeckId}/deck.json`);
    if (!raw) return null;
    try {
      return typeof raw === 'string' ? JSON.parse(raw) : raw;
    } catch {
      return null;
    }
  }, [files, currentDeckId]);

  const writeDeckMeta = useCallback((deckId, updates) => {
    const raw = files.read(`${deckId}/deck.json`);
    let current = {};
    if (raw) {
      try { current = typeof raw === 'string' ? JSON.parse(raw) : raw; } catch {}
    }
    files.write(`${deckId}/deck.json`, JSON.stringify({ ...current, ...updates }, null, 2));
  }, [files]);

  // Build slides array
  const slides = useMemo(() => {
    if (!currentDeckId || !currentDeckMeta?.slideOrder) return [];
    return currentDeckMeta.slideOrder.map(slideId => ({
      id: slideId,
      content: files.read(`${currentDeckId}/${slideId}.html`) || ''
    }));
  }, [files, currentDeckId, currentDeckMeta]);

  const currentSlideIndex = currentDeckMeta?.currentSlideIndex || 0;
  const presentationTitle = currentDeckMeta?.title || 'Untitled';

  // Get ordered decks for sidebar
  const orderedDecks = useMemo(() => {
    return deckOrder.map(id => {
      const raw = files.read(`${id}/deck.json`);
      if (!raw) return null;
      try {
        const meta = typeof raw === 'string' ? JSON.parse(raw) : raw;
        return { id, ...meta };
      } catch {
        return null;
      }
    }).filter(Boolean);
  }, [files, deckOrder]);

  const currentSlide = slides[Math.min(currentSlideIndex, slides.length - 1)] || null;

  // Handlers
  const setCurrentSlideIndex = useCallback((index) => {
    if (!currentDeckId) return;
    const newIndex = typeof index === 'function' ? index(currentSlideIndex) : index;
    writeDeckMeta(currentDeckId, { currentSlideIndex: newIndex });
  }, [currentDeckId, currentSlideIndex, writeDeckMeta]);

  const setPresentationTitle = useCallback((title) => {
    if (!currentDeckId) return;
    writeDeckMeta(currentDeckId, { title });
  }, [currentDeckId, writeDeckMeta]);

  const handleCreateDeck = useCallback((title = 'New Presentation') => {
    const deckId = generateId('deck');
    const slideId = generateId('slide');
    
    files.write(`${deckId}/deck.json`, JSON.stringify({
      title,
      currentSlideIndex: 0,
      slideOrder: [slideId]
    }, null, 2));
    
    files.write(`${deckId}/${slideId}.html`, `<div style="display:flex;flex-direction:column;align-items:center;justify-content:center;height:100%;background:linear-gradient(135deg,#1e1e1e,#2d2d2d);padding:60px;">
  <h1 style="font-size:48px;font-weight:700;color:#fff;margin:0;text-align:center">${title}</h1>
  <p style="font-size:20px;color:#888;margin-top:16px">Click to edit</p>
</div>`);
    
    writeConfig({ currentDeckId: deckId, deckOrder: [...deckOrder, deckId] });
    return deckId;
  }, [files, writeConfig, deckOrder]);

  const handleDeleteDeck = useCallback((deckId) => {
    files.delete(`${deckId}/`);
    const newOrder = deckOrder.filter(id => id !== deckId);
    writeConfig({
      currentDeckId: deckId === currentDeckId ? (newOrder[0] || null) : currentDeckId,
      deckOrder: newOrder
    });
  }, [files, deckOrder, currentDeckId, writeConfig]);

  const handleSelectDeck = useCallback((deckId) => {
    writeConfig({ currentDeckId: deckId });
  }, [writeConfig]);

  const handleAddSlide = useCallback(() => {
    if (!currentDeckId || !currentDeckMeta) return;
    const slideId = generateId('slide');
    const num = (currentDeckMeta.slideOrder?.length || 0) + 1;
    
    files.write(`${currentDeckId}/${slideId}.html`, `<div style="display:flex;flex-direction:column;align-items:center;justify-content:center;height:100%;padding:60px;background:#fff">
  <h1 style="font-size:42px;font-weight:600;color:#1a1a1a;margin:0">Slide ${num}</h1>
  <p style="font-size:18px;color:#666;margin-top:12px">Add your content here</p>
</div>`);
    
    const newOrder = [...(currentDeckMeta.slideOrder || []), slideId];
    writeDeckMeta(currentDeckId, { slideOrder: newOrder, currentSlideIndex: newOrder.length - 1 });
  }, [files, currentDeckId, currentDeckMeta, writeDeckMeta]);

  const handleUpdateSlide = useCallback((slide) => {
    if (!currentDeckId) return;
    files.write(`${currentDeckId}/${slide.id}.html`, slide.content);
  }, [files, currentDeckId]);

  const handleDeleteSlide = useCallback((index) => {
    if (!currentDeckId || !currentDeckMeta || (currentDeckMeta.slideOrder?.length || 0) <= 1) return;
    const slideId = currentDeckMeta.slideOrder[index];
    if (!slideId) return;
    
    files.delete(`${currentDeckId}/${slideId}.html`);
    const newOrder = currentDeckMeta.slideOrder.filter((_, i) => i !== index);
    const newIndex = currentSlideIndex >= newOrder.length ? newOrder.length - 1 : 
                     currentSlideIndex > index ? currentSlideIndex - 1 : currentSlideIndex;
    writeDeckMeta(currentDeckId, { slideOrder: newOrder, currentSlideIndex: Math.max(0, newIndex) });
  }, [files, currentDeckId, currentDeckMeta, currentSlideIndex, writeDeckMeta]);

  const handleDuplicateSlide = useCallback((index) => {
    if (!currentDeckId || !currentDeckMeta?.slideOrder?.[index]) return;
    const sourceId = currentDeckMeta.slideOrder[index];
    const newId = generateId('slide');
    const content = files.read(`${currentDeckId}/${sourceId}.html`) || '';
    
    files.write(`${currentDeckId}/${newId}.html`, content);
    const newOrder = [...currentDeckMeta.slideOrder];
    newOrder.splice(index + 1, 0, newId);
    writeDeckMeta(currentDeckId, { slideOrder: newOrder, currentSlideIndex: index + 1 });
  }, [files, currentDeckId, currentDeckMeta, writeDeckMeta]);

  const handleReorderSlides = useCallback((from, to) => {
    if (!currentDeckId || !currentDeckMeta?.slideOrder) return;
    const newOrder = [...currentDeckMeta.slideOrder];
    const [moved] = newOrder.splice(from, 1);
    newOrder.splice(to, 0, moved);
    
    let newIndex = currentSlideIndex;
    if (currentSlideIndex === from) newIndex = to;
    else if (currentSlideIndex > from && currentSlideIndex <= to) newIndex--;
    else if (currentSlideIndex < from && currentSlideIndex >= to) newIndex++;
    
    writeDeckMeta(currentDeckId, { slideOrder: newOrder, currentSlideIndex: newIndex });
  }, [currentDeckId, currentDeckMeta, currentSlideIndex, writeDeckMeta]);

  const handleNavigate = useCallback((dir) => {
    if (dir === 'prev' && currentSlideIndex > 0) setCurrentSlideIndex(currentSlideIndex - 1);
    else if (dir === 'next' && currentSlideIndex < slides.length - 1) setCurrentSlideIndex(currentSlideIndex + 1);
  }, [currentSlideIndex, slides.length, setCurrentSlideIndex]);

  const handleExport = useCallback(() => {
    const html = exportSlidesToHTML(slides, presentationTitle);
    const blob = new Blob([html], { type: 'text/html' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${presentationTitle.replace(/[^a-z0-9]/gi, '-').toLowerCase()}.html`;
    a.click();
    URL.revokeObjectURL(url);
  }, [slides, presentationTitle]);

  const handleExportPDF = useCallback(() => {
    exportSlidesToPDF(slides, presentationTitle);
  }, [slides, presentationTitle]);

  // Apply dark background
  useEffect(() => {
    document.body.style.background = '#0a0a0a';
    document.body.style.margin = '0';
    document.documentElement.style.minHeight = '100%';
    return () => {
      document.body.style.background = '';
      document.body.style.margin = '';
    };
  }, []);

  // Initialize if no decks
  useEffect(() => {
    if (!files.ready) return;
    if (config.deckOrder?.length > 0) {
      if (!config.currentDeckId || !config.deckOrder.includes(config.currentDeckId)) {
        writeConfig({ currentDeckId: config.deckOrder[0] });
      }
      return;
    }
    if (initRef.current) return;
    initRef.current = true;
    initializeDefaults(files);
  }, [files.ready, config, writeConfig]);

  return (
    <>
      <div style={{
        display: 'flex',
        flexDirection: 'column',
        height: '100%',
        width: '100%',
        fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
        backgroundColor: '#0a0a0a',
        overflow: 'hidden'
      }}>
        <HeaderBar
          presentationTitle={presentationTitle}
          onTitleChange={setPresentationTitle}
          onExport={handleExport}
          onExportPDF={handleExportPDF}
          deckCount={orderedDecks.length}
          onToggleDeckSidebar={() => setShowDeckSidebar(!showDeckSidebar)}
        />

        <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>
          {/* Deck sidebar */}
          {showDeckSidebar && (
            <div style={{
              width: '180px',
              backgroundColor: '#0a0a0a',
              borderRight: '1px solid #262626',
              display: 'flex',
              flexDirection: 'column',
              overflow: 'hidden'
            }}>
              <div style={{
                padding: '10px 12px',
                borderBottom: '1px solid #262626',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center'
              }}>
                <span style={{ color: '#737373', fontSize: '11px', fontWeight: 600, textTransform: 'uppercase' }}>
                  Decks
                </span>
                <button
                  onClick={() => handleCreateDeck()}
                  style={{
                    width: '20px',
                    height: '20px',
                    borderRadius: '4px',
                    border: '1px solid #404040',
                    backgroundColor: 'transparent',
                    color: '#a3a3a3',
                    cursor: 'pointer',
                    fontSize: '12px'
                  }}
                >
                  +
                </button>
              </div>
              <div style={{ flex: 1, overflowY: 'auto', padding: '8px' }}>
                {orderedDecks.map(deck => (
                  <div
                    key={deck.id}
                    onClick={() => handleSelectDeck(deck.id)}
                    style={{
                      padding: '8px 10px',
                      marginBottom: '4px',
                      borderRadius: '4px',
                      backgroundColor: deck.id === currentDeckId ? '#262626' : 'transparent',
                      cursor: 'pointer',
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center'
                    }}
                  >
                    <div style={{ overflow: 'hidden' }}>
                      <div style={{
                        color: deck.id === currentDeckId ? '#fafafa' : '#a3a3a3',
                        fontSize: '12px',
                        fontWeight: 500,
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap'
                      }}>
                        {deck.title}
                      </div>
                      <div style={{ color: '#525252', fontSize: '10px', marginTop: '2px' }}>
                        {deck.slideOrder?.length || 0} slides
                      </div>
                    </div>
                    {orderedDecks.length > 1 && (
                      <button
                        onClick={(e) => { e.stopPropagation(); handleDeleteDeck(deck.id); }}
                        style={{
                          background: 'none',
                          border: 'none',
                          color: '#525252',
                          cursor: 'pointer',
                          fontSize: '14px',
                          padding: '0 4px'
                        }}
                      >
                        ×
                      </button>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          <SlideThumbnails
            slides={slides}
            currentSlideIndex={currentSlideIndex}
            onSelectSlide={setCurrentSlideIndex}
            onDeleteSlide={handleDeleteSlide}
            onDuplicateSlide={handleDuplicateSlide}
            onReorderSlides={handleReorderSlides}
            onAddSlide={handleAddSlide}
          />

          <SlideEditor
            slide={currentSlide}
            slideIndex={currentSlideIndex}
            totalSlides={slides.length}
            onUpdateSlide={handleUpdateSlide}
            onNavigate={handleNavigate}
            onPresent={() => setIsPresenting(true)}
          />
        </div>
      </div>

      {isPresenting && slides.length > 0 && (
        <SlidePresenter
          slides={slides}
          initialSlideIndex={currentSlideIndex}
          onClose={() => setIsPresenting(false)}
        />
      )}

      <style>{`
        * { box-sizing: border-box; }
        ::-webkit-scrollbar { width: 6px; height: 6px; }
        ::-webkit-scrollbar-track { background: #171717; }
        ::-webkit-scrollbar-thumb { background: #404040; border-radius: 3px; }
        ::-webkit-scrollbar-thumb:hover { background: #525252; }
      `}</style>
    </>
  );
}

export default SlideDeckWidget;
