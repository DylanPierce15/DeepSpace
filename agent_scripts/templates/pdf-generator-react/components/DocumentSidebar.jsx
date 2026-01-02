import React, { useMemo } from 'react';

/**
 * DocumentSidebar - List of documents
 */
export default function DocumentSidebar({
  files,
  currentDoc,
  docOrder,
  onSelectDoc,
  onCreateDoc,
  onDeleteDoc
}) {
  // Get document titles
  const documents = useMemo(() => {
    return (docOrder || []).map(docId => {
      const metaRaw = files.read(`${docId}/meta.json`);
      let meta = null;
      try {
        meta = metaRaw ? (typeof metaRaw === 'string' ? JSON.parse(metaRaw) : metaRaw) : null;
      } catch {}
      
      return {
        id: docId,
        title: meta?.title || docId,
        pageCount: meta?.pageOrder?.length || 0
      };
    });
  }, [files, docOrder]);

  return (
    <div style={{
      width: '220px',
      background: '#252525',
      borderRight: '1px solid #404040',
      display: 'flex',
      flexDirection: 'column',
      userSelect: 'none',
      WebkitUserSelect: 'none'
    }}>
      <div style={{
        padding: '16px',
        borderBottom: '1px solid #404040',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center'
      }}>
        <span style={{ fontSize: '12px', fontWeight: 600, color: '#888', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
          Documents
        </span>
        <button
          onClick={onCreateDoc}
          style={{
            padding: '4px 10px',
            background: '#2563eb',
            border: 'none',
            borderRadius: '4px',
            color: '#fff',
            fontSize: '12px',
            cursor: 'pointer'
          }}
        >
          + New
        </button>
      </div>
      
      <div style={{ flex: 1, overflowY: 'auto', padding: '8px' }}>
        {documents.length === 0 ? (
          <div style={{ padding: '20px', textAlign: 'center', color: '#666', fontSize: '13px' }}>
            No documents yet
          </div>
        ) : (
          documents.map(doc => (
            <div
              key={doc.id}
              onClick={() => onSelectDoc(doc.id)}
              style={{
                padding: '12px',
                background: currentDoc === doc.id ? '#2563eb22' : 'transparent',
                borderRadius: '6px',
                cursor: 'pointer',
                marginBottom: '4px',
                borderLeft: currentDoc === doc.id ? '3px solid #2563eb' : '3px solid transparent'
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <div>
                  <div style={{ fontSize: '14px', fontWeight: 500, color: '#fff', marginBottom: '4px' }}>
                    {doc.title}
                  </div>
                  <div style={{ fontSize: '11px', color: '#888' }}>
                    {doc.pageCount} page{doc.pageCount !== 1 ? 's' : ''}
                  </div>
                </div>
                <button
                  onClick={(e) => { e.stopPropagation(); onDeleteDoc(doc.id); }}
                  style={{
                    background: 'none',
                    border: 'none',
                    color: '#666',
                    cursor: 'pointer',
                    fontSize: '12px',
                    padding: '2px 6px',
                    borderRadius: '4px'
                  }}
                  onMouseEnter={(e) => e.target.style.color = '#ef4444'}
                  onMouseLeave={(e) => e.target.style.color = '#666'}
                >
                  ✕
                </button>
              </div>
            </div>
          ))
        )}
      </div>
      
      <div style={{ padding: '12px', borderTop: '1px solid #404040', fontSize: '10px', color: '#666' }}>
        📄 8.5" × 11" pages
      </div>
    </div>
  );
}
