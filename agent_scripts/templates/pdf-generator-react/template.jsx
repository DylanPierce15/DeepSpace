import React, { useState, useCallback, useMemo, useEffect, useRef } from 'react';
import PagePreview from './components/PagePreview';
import PageEditor from './components/PageEditor';
import DocumentSidebar from './components/DocumentSidebar';
import { exportToPDF } from './utils/pdfExport';
import { initializeDefaults } from './utils/defaults';

/**
 * PDF Generator Widget
 * 
 * Creates documents with 8.5" x 11" pages that can be exported as PDF.
 * Pages are stored as HTML files in files/documents/
 */

// Page dimensions at 96 DPI
const PAGE_WIDTH = 816;  // 8.5 inches
const PAGE_HEIGHT = 1056; // 11 inches

function PDFGeneratorWidget() {
  const files = useFiles('documents/');
  const [viewMode, setViewMode] = useState('preview'); // 'preview' | 'edit'
  const [currentPageIndex, setCurrentPageIndex] = useState(0);
  const [isExporting, setIsExporting] = useState(false);
  const [tailwindLoaded, setTailwindLoaded] = useState(false);
  const initRef = useRef(false);

  // Load Tailwind
  useEffect(() => {
    if (!document.getElementById('tailwind-script')) {
      const script = document.createElement('script');
      script.id = 'tailwind-script';
      script.src = 'https://cdn.tailwindcss.com';
      script.onload = () => setTimeout(() => setTailwindLoaded(true), 100);
      document.head.appendChild(script);
    } else {
      setTailwindLoaded(true);
    }
  }, []);

  // Read config
  const config = useMemo(() => {
    const raw = files.read('config.json');
    if (!raw) return { currentDoc: null, docOrder: [] };
    try {
      return typeof raw === 'string' ? JSON.parse(raw) : raw;
    } catch { return { currentDoc: null, docOrder: [] }; }
  }, [files]);

  const writeConfig = useCallback((updates) => {
    const newConfig = { ...config, ...updates };
    files.write('config.json', JSON.stringify(newConfig, null, 2));
  }, [files, config]);

  // Get current document
  const currentDoc = config.currentDoc;

  // Read document meta
  const docMeta = useMemo(() => {
    if (!currentDoc) return null;
    const raw = files.read(`${currentDoc}/meta.json`);
    if (!raw) return null;
    try {
      return typeof raw === 'string' ? JSON.parse(raw) : raw;
    } catch { return null; }
  }, [files, currentDoc]);

  const writeDocMeta = useCallback((updates) => {
    if (!currentDoc) return;
    const newMeta = { ...docMeta, ...updates, updatedAt: Date.now() };
    files.write(`${currentDoc}/meta.json`, JSON.stringify(newMeta, null, 2));
  }, [files, currentDoc, docMeta]);

  // Get pages for current document
  const pages = useMemo(() => {
    if (!currentDoc || !docMeta?.pageOrder) return [];
    return docMeta.pageOrder.map(pageId => ({
      id: pageId,
      content: files.read(`${currentDoc}/${pageId}.html`) || ''
    }));
  }, [files, currentDoc, docMeta]);

  const currentPage = pages[currentPageIndex] || null;

  // Initialize with default document if empty
  useEffect(() => {
    if (!files.ready || initRef.current) return;
    
    if (config.docOrder && config.docOrder.length > 0) {
      initRef.current = true;
      return;
    }
    
    // Check if sample-report exists, otherwise create defaults
    if (files.exists('sample-report/meta.json')) {
      initRef.current = true;
      writeConfig({ currentDoc: 'sample-report', docOrder: ['sample-report'] });
    } else {
      initRef.current = true;
      initializeDefaults(files);
    }
  }, [files.ready, config, writeConfig, files]);

  // Select document
  const handleSelectDoc = useCallback((docId) => {
    writeConfig({ currentDoc: docId });
    setCurrentPageIndex(0);
    setViewMode('preview');
  }, [writeConfig]);

  // Create new document
  const handleCreateDoc = useCallback(() => {
    const docId = `doc-${Date.now()}`;
    const pageId = `page-1`;
    
    const meta = {
      title: 'New Document',
      createdAt: Date.now(),
      updatedAt: Date.now(),
      pageOrder: [pageId]
    };
    
    const defaultPage = `<div class="page" style="width: 816px; height: 1056px; padding: 72px; box-sizing: border-box; font-family: 'Georgia', serif; background: white; overflow: hidden; position: relative;">
  <div style="height: 100%; display: flex; flex-direction: column; justify-content: center; align-items: center; text-align: center;">
    <h1 style="font-size: 42px; font-weight: bold; color: #1a1a1a; margin: 0;">New Document</h1>
    <p style="font-size: 18px; color: #666; margin-top: 16px;">Click Edit to customize this page</p>
  </div>
</div>`;
    
    files.write(`${docId}/meta.json`, JSON.stringify(meta, null, 2));
    files.write(`${docId}/${pageId}.html`, defaultPage);
    
    const newOrder = [...(config.docOrder || []), docId];
    writeConfig({ currentDoc: docId, docOrder: newOrder });
    setCurrentPageIndex(0);
  }, [files, config, writeConfig]);

  // Delete document
  const handleDeleteDoc = useCallback((docId) => {
    files.delete(`${docId}/`);
    const newOrder = config.docOrder.filter(id => id !== docId);
    writeConfig({
      currentDoc: newOrder[0] || null,
      docOrder: newOrder
    });
    setCurrentPageIndex(0);
  }, [files, config, writeConfig]);

  // Add page
  const handleAddPage = useCallback(() => {
    if (!currentDoc || !docMeta) return;
    
    const pageId = `page-${Date.now()}`;
    const newPage = `<div class="page" style="width: 816px; height: 1056px; padding: 72px; box-sizing: border-box; font-family: 'Georgia', serif; background: white; overflow: hidden; position: relative;">
  <h2 style="font-size: 24px; font-weight: bold; color: #1a1a1a; margin: 0 0 20px 0;">New Page</h2>
  <p style="font-size: 15px; line-height: 1.7; color: #333;">Add your content here...</p>
</div>`;
    
    files.write(`${currentDoc}/${pageId}.html`, newPage);
    writeDocMeta({ pageOrder: [...docMeta.pageOrder, pageId] });
    setCurrentPageIndex(pages.length);
  }, [files, currentDoc, docMeta, pages.length, writeDocMeta]);

  // Delete page
  const handleDeletePage = useCallback((pageIndex) => {
    if (!currentDoc || !docMeta || docMeta.pageOrder.length <= 1) return;
    
    const pageId = docMeta.pageOrder[pageIndex];
    files.delete(`${currentDoc}/${pageId}.html`);
    
    const newOrder = docMeta.pageOrder.filter((_, i) => i !== pageIndex);
    writeDocMeta({ pageOrder: newOrder });
    
    if (currentPageIndex >= newOrder.length) {
      setCurrentPageIndex(Math.max(0, newOrder.length - 1));
    }
  }, [files, currentDoc, docMeta, currentPageIndex, writeDocMeta]);

  // Reorder pages via drag and drop
  const handleReorderPages = useCallback((fromIndex, toIndex) => {
    if (!currentDoc || !docMeta) return;
    
    const newOrder = [...docMeta.pageOrder];
    const [moved] = newOrder.splice(fromIndex, 1);
    newOrder.splice(toIndex, 0, moved);
    
    writeDocMeta({ pageOrder: newOrder });
    
    // Update current page index to follow the moved page
    if (currentPageIndex === fromIndex) {
      setCurrentPageIndex(toIndex);
    } else if (fromIndex < currentPageIndex && toIndex >= currentPageIndex) {
      setCurrentPageIndex(currentPageIndex - 1);
    } else if (fromIndex > currentPageIndex && toIndex <= currentPageIndex) {
      setCurrentPageIndex(currentPageIndex + 1);
    }
  }, [currentDoc, docMeta, currentPageIndex, writeDocMeta]);

  // Update page content
  const handleUpdatePage = useCallback((content) => {
    if (!currentDoc || !currentPage) return;
    files.write(`${currentDoc}/${currentPage.id}.html`, content);
  }, [files, currentDoc, currentPage]);

  // Export to PDF
  const handleExportPDF = useCallback(async () => {
    if (!pages.length || !docMeta) return;
    setIsExporting(true);
    
    try {
      await exportToPDF(pages, docMeta.title || 'document');
    } catch (error) {
      console.error('PDF export failed:', error);
      alert('Failed to export PDF: ' + error.message);
    } finally {
      setIsExporting(false);
    }
  }, [pages, docMeta]);

  // Navigate pages
  const handlePrevPage = () => setCurrentPageIndex(Math.max(0, currentPageIndex - 1));
  const handleNextPage = () => setCurrentPageIndex(Math.min(pages.length - 1, currentPageIndex + 1));

  useEffect(() => {
    document.body.style.background = '#1e1e1e';
    document.body.style.margin = '0';
    return () => { document.body.style.background = ''; };
  }, []);

  if (!tailwindLoaded || !files.ready) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh', background: '#1e1e1e', color: '#fff' }}>
        Loading...
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', height: '100%', fontFamily: 'system-ui, sans-serif', background: '#1e1e1e', color: '#fff' }}>
      {/* Sidebar */}
      <DocumentSidebar
        files={files}
        currentDoc={currentDoc}
        docOrder={config.docOrder || []}
        onSelectDoc={handleSelectDoc}
        onCreateDoc={handleCreateDoc}
        onDeleteDoc={handleDeleteDoc}
      />
      
      {/* Main area */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        {/* Header */}
        <div style={{ 
          display: 'flex', 
          justifyContent: 'space-between', 
          alignItems: 'center', 
          padding: '12px 20px',
          background: '#2d2d2d',
          borderBottom: '1px solid #404040'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
            <h2 style={{ margin: 0, fontSize: '16px', fontWeight: 600 }}>
              {docMeta?.title || 'No Document Selected'}
            </h2>
            {pages.length > 0 && (
              <span style={{ fontSize: '13px', color: '#888' }}>
                Page {currentPageIndex + 1} of {pages.length}
              </span>
            )}
          </div>
          
          <div style={{ display: 'flex', gap: '8px' }}>
            <button
              onClick={() => setViewMode(viewMode === 'preview' ? 'edit' : 'preview')}
              style={{
                padding: '8px 16px',
                background: viewMode === 'edit' ? '#2563eb' : '#404040',
                border: 'none',
                borderRadius: '6px',
                color: '#fff',
                fontSize: '13px',
                cursor: 'pointer'
              }}
            >
              {viewMode === 'edit' ? 'Preview' : 'Edit'}
            </button>
            <button
              onClick={handleExportPDF}
              disabled={!pages.length || isExporting}
              style={{
                padding: '8px 20px',
                background: pages.length ? '#10b981' : '#404040',
                border: 'none',
                borderRadius: '6px',
                color: '#fff',
                fontSize: '13px',
                fontWeight: 600,
                cursor: pages.length && !isExporting ? 'pointer' : 'not-allowed',
                display: 'flex',
                alignItems: 'center',
                gap: '6px'
              }}
            >
              {isExporting ? 'Exporting...' : '📄 Export PDF'}
            </button>
          </div>
        </div>
        
        {/* Content area */}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
          {!currentDoc ? (
            <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: '16px', color: '#888' }}>
              <span style={{ fontSize: '48px' }}>📄</span>
              <span>Select or create a document</span>
            </div>
          ) : viewMode === 'edit' ? (
            <PageEditor
              content={currentPage?.content || ''}
              onChange={handleUpdatePage}
            />
          ) : (
            <PagePreview
              pages={pages}
              currentIndex={currentPageIndex}
              onSelectPage={setCurrentPageIndex}
              onDeletePage={handleDeletePage}
              onReorderPages={handleReorderPages}
              onAddPage={handleAddPage}
            />
          )}
        </div>
        
        {/* Page navigation */}
        {pages.length > 0 && viewMode === 'preview' && (
          <div style={{
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center',
            gap: '16px',
            padding: '12px',
            background: '#2d2d2d',
            borderTop: '1px solid #404040'
          }}>
            <button
              onClick={handlePrevPage}
              disabled={currentPageIndex === 0}
              style={{
                padding: '8px 16px',
                background: currentPageIndex > 0 ? '#404040' : '#2d2d2d',
                border: 'none',
                borderRadius: '6px',
                color: currentPageIndex > 0 ? '#fff' : '#555',
                cursor: currentPageIndex > 0 ? 'pointer' : 'not-allowed'
              }}
            >
              ← Previous
            </button>
            <span style={{ fontSize: '13px', color: '#888' }}>
              {currentPageIndex + 1} / {pages.length}
            </span>
            <button
              onClick={handleNextPage}
              disabled={currentPageIndex >= pages.length - 1}
              style={{
                padding: '8px 16px',
                background: currentPageIndex < pages.length - 1 ? '#404040' : '#2d2d2d',
                border: 'none',
                borderRadius: '6px',
                color: currentPageIndex < pages.length - 1 ? '#fff' : '#555',
                cursor: currentPageIndex < pages.length - 1 ? 'pointer' : 'not-allowed'
              }}
            >
              Next →
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

export default PDFGeneratorWidget;

