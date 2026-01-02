import React, { useState, useEffect, useRef } from 'react';

function GoogleDriveWidget() {
  const [files, setFiles] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [isConnected, setIsConnected] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploadFileName, setUploadFileName] = useState('');
  const [nextPageToken, setNextPageToken] = useState(null);
  const [deleteConfirm, setDeleteConfirm] = useState(null);
  
  const fileInputRef = useRef(null);
  const pollIntervalRef = useRef(null);

  useEffect(() => {
    checkConnectionAndLoad();
    
    return () => {
      if (pollIntervalRef.current) {
        clearInterval(pollIntervalRef.current);
      }
    };
  }, []);

  useEffect(() => {
    if (isConnected === false && !pollIntervalRef.current) {
      pollIntervalRef.current = setInterval(() => {
        checkConnection();
      }, 5000);
    } else if (isConnected === true && pollIntervalRef.current) {
      clearInterval(pollIntervalRef.current);
      pollIntervalRef.current = null;
    }
  }, [isConnected]);

  const checkConnection = async () => {
    try {
      const result = await miyagiAPI.get('status');
      const status = result.data || result;
      const connected = status?.google?.drive || false;
      if (connected && !isConnected) {
        setIsConnected(true);
        loadFiles();
      } else {
        setIsConnected(connected);
      }
    } catch {
      setIsConnected(false);
    }
  };

  const checkConnectionAndLoad = async () => {
    setLoading(true);
    try {
      const result = await miyagiAPI.get('status');
      const status = result.data || result;
      const connected = status?.google?.drive || false;
      setIsConnected(connected);
      
      if (connected) {
        await loadFiles();
      }
    } catch {
      setIsConnected(false);
    } finally {
      setLoading(false);
    }
  };

  const loadFiles = async () => {
    setLoading(true);
    setError(null);
    
    try {
      const result = await miyagiAPI.get('drive-list', { pageSize: 50 });
      const payload = result.data || result;
      
      if (payload.requiresOAuth) {
        setIsConnected(false);
        return;
      }
      
      if (payload.files) {
        setFiles(payload.files);
        setNextPageToken(payload.nextPageToken);
        setIsConnected(true);
      }
    } catch (err) {
      setError(err.message || 'Failed to load files');
    } finally {
      setLoading(false);
    }
  };

  const handleFileSelect = async (event) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setUploading(true);
    setUploadFileName(file.name);
    setUploadProgress(0);
    setError(null);

    try {
      const reader = new FileReader();
      
      reader.onprogress = (e) => {
        if (e.lengthComputable) {
          setUploadProgress(Math.round((e.loaded / e.total) * 50));
        }
      };
      
      reader.onload = async (e) => {
        setUploadProgress(60);
        const base64Data = e.target.result.split(',')[1];
        
        setUploadProgress(70);
        const result = await miyagiAPI.post('drive-upload', {
          filename: file.name,
          mimeType: file.type || 'application/octet-stream',
          fileData: base64Data
        });
        setUploadProgress(90);
        const payload = result.data || result;

        if (payload.requiresOAuth) {
          setError('Please connect Google Drive in the integrations panel');
          setIsConnected(false);
          return;
        }

        if (payload.id) {
          setUploadProgress(100);
          await loadFiles();
        } else {
          setError('Failed to upload file');
        }
      };
      reader.readAsDataURL(file);
    } catch (err) {
      setError(err.message || 'Failed to upload file');
    } finally {
      setTimeout(() => {
        setUploading(false);
        setUploadProgress(0);
        setUploadFileName('');
      }, 500);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  const handleDownload = async (file) => {
    setLoading(true);
    setError(null);

    try {
      const result = await miyagiAPI.get('drive-download', { fileId: file.id });
      const payload = result.data || result;

      if (payload.requiresOAuth) {
        setError('Please connect Google Drive in the integrations panel');
        return;
      }

      if (payload.fileData) {
        const blob = new Blob([
          Uint8Array.from(atob(payload.fileData), c => c.charCodeAt(0))
        ], { type: payload.mimeType });
        
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = payload.filename || file.name;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
      } else {
        setError('Failed to download file');
      }
    } catch (err) {
      setError(err.message || 'Failed to download file');
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteClick = (file) => {
    setDeleteConfirm(file);
  };

  const handleDeleteConfirm = async () => {
    if (!deleteConfirm) return;
    
    const fileId = deleteConfirm.id;
    setDeleteConfirm(null);
    setLoading(true);
    setError(null);

    try {
      const result = await miyagiAPI.delete('drive-delete', { fileId });
      const payload = result.data || result;

      if (payload.requiresOAuth) {
        setError('Please connect Google Drive in the integrations panel');
        return;
      }

      if (result.success || payload.success) {
        await loadFiles();
      } else {
        setError('Failed to delete file');
      }
    } catch (err) {
      setError(err.message || 'Failed to delete file');
    } finally {
      setLoading(false);
    }
  };

  const formatFileSize = (bytes) => {
    if (!bytes) return '';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
  };

  const formatDate = (dateString) => {
    const date = new Date(dateString);
    const now = new Date();
    const diff = now - date;
    const days = Math.floor(diff / (1000 * 60 * 60 * 24));
    
    if (days === 0) return 'Today';
    if (days === 1) return 'Yesterday';
    if (days < 7) return `${days} days ago`;
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: date.getFullYear() !== now.getFullYear() ? 'numeric' : undefined });
  };

  const getFileIcon = (mimeType, name) => {
    if (!mimeType) return '📄';
    if (mimeType.includes('folder')) return '📁';
    if (mimeType.includes('image')) return '🖼️';
    if (mimeType.includes('video')) return '🎬';
    if (mimeType.includes('audio')) return '🎵';
    if (mimeType.includes('pdf')) return '📕';
    if (mimeType.includes('spreadsheet') || name?.endsWith('.xlsx') || name?.endsWith('.csv')) return '📊';
    if (mimeType.includes('presentation') || name?.endsWith('.pptx')) return '📽️';
    if (mimeType.includes('document') || name?.endsWith('.docx')) return '📝';
    if (mimeType.includes('zip') || mimeType.includes('compressed')) return '🗜️';
    return '📄';
  };

  if (isConnected === null && loading) {
    return (
      <div style={{
        height: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: '#fff',
        fontFamily: "'Google Sans', 'Segoe UI', Roboto, sans-serif"
      }}>
        <div style={{ textAlign: 'center', color: '#5f6368' }}>
          <div style={{
            width: '40px',
            height: '40px',
            border: '3px solid #e8eaed',
            borderTopColor: '#1a73e8',
            borderRadius: '50%',
            animation: 'spin 1s linear infinite',
            margin: '0 auto 16px'
          }} />
          <div style={{ fontSize: '14px' }}>Loading...</div>
        </div>
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      </div>
    );
  }

  if (isConnected === false) {
    return (
      <div style={{
        height: '100vh',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        background: '#fff',
        fontFamily: "'Google Sans', 'Segoe UI', Roboto, sans-serif",
        padding: '32px'
      }}>
        <img 
          src="https://ssl.gstatic.com/images/branding/product/2x/drive_2020q4_48dp.png"
          alt="Google Drive"
          style={{ width: '96px', height: '96px', marginBottom: '24px' }}
        />
        
        <h2 style={{
          fontSize: '22px',
          fontWeight: '400',
          color: '#202124',
          marginBottom: '8px',
          textAlign: 'center'
        }}>
          Connect Google Drive
        </h2>
        
        <p style={{
          fontSize: '14px',
          color: '#5f6368',
          textAlign: 'center',
          maxWidth: '320px',
          lineHeight: '1.5',
          marginBottom: '24px'
        }}>
          To upload and manage files, connect your Google Drive account in the <strong>Integrations</strong> panel.
        </p>
        
        <div style={{
          background: '#f8f9fa',
          borderRadius: '8px',
          padding: '16px 20px',
          display: 'flex',
          alignItems: 'center',
          gap: '12px',
          maxWidth: '320px'
        }}>
          <div style={{
            width: '40px',
            height: '40px',
            background: '#e8f0fe',
            borderRadius: '50%',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexShrink: 0,
            fontSize: '20px'
          }}>
            ⚡
          </div>
          <div style={{ fontSize: '13px', color: '#5f6368', lineHeight: '1.4' }}>
            Open the <strong style={{ color: '#202124' }}>Integrations</strong> panel from the toolbar and connect Google Drive.
          </div>
        </div>
        
        <div style={{
          marginTop: '24px',
          fontSize: '12px',
          color: '#80868b',
          display: 'flex',
          alignItems: 'center',
          gap: '6px'
        }}>
          <div style={{
            width: '8px',
            height: '8px',
            borderRadius: '50%',
            background: '#fbbc04',
            animation: 'pulse 2s ease-in-out infinite'
          }} />
          Checking for connection...
        </div>
        
        <style>{`
          @keyframes pulse {
            0%, 100% { opacity: 1; }
            50% { opacity: 0.4; }
          }
        `}</style>
      </div>
    );
  }

  return (
    <div style={{
      height: '100vh',
      display: 'flex',
      flexDirection: 'column',
      background: '#fff',
      fontFamily: "'Google Sans', 'Segoe UI', Roboto, sans-serif",
      position: 'relative'
    }}>
      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
        @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
        @keyframes slideUp { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } }
        @keyframes progress { from { width: 0%; } }
        .file-row:hover { background: #f5f5f5; }
        .action-btn { opacity: 0; transition: opacity 0.15s; }
        .file-row:hover .action-btn { opacity: 1; }
        .icon-btn:hover { background: rgba(0,0,0,0.08); }
      `}</style>

      {deleteConfirm && (
        <div style={{
          position: 'absolute',
          inset: 0,
          background: 'rgba(0,0,0,0.4)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 100,
          animation: 'fadeIn 0.15s ease-out'
        }}>
          <div style={{
            background: '#fff',
            borderRadius: '12px',
            padding: '24px',
            maxWidth: '320px',
            width: '90%',
            boxShadow: '0 8px 32px rgba(0,0,0,0.2)',
            animation: 'slideUp 0.2s ease-out'
          }}>
            <div style={{ fontSize: '18px', fontWeight: '500', color: '#202124', marginBottom: '12px' }}>
              Delete file?
            </div>
            <div style={{ fontSize: '14px', color: '#5f6368', marginBottom: '8px', lineHeight: 1.5 }}>
              <strong style={{ color: '#202124' }}>{deleteConfirm.name}</strong> will be permanently deleted from your Drive.
            </div>
            <div style={{ fontSize: '13px', color: '#80868b', marginBottom: '20px' }}>
              This action cannot be undone.
            </div>
            <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end' }}>
              <button
                onClick={() => setDeleteConfirm(null)}
                style={{
                  padding: '8px 20px',
                  border: '1px solid #dadce0',
                  borderRadius: '6px',
                  background: '#fff',
                  color: '#5f6368',
                  fontSize: '14px',
                  fontWeight: '500',
                  cursor: 'pointer'
                }}
              >
                Cancel
              </button>
              <button
                onClick={handleDeleteConfirm}
                style={{
                  padding: '8px 20px',
                  border: 'none',
                  borderRadius: '6px',
                  background: '#d93025',
                  color: '#fff',
                  fontSize: '14px',
                  fontWeight: '500',
                  cursor: 'pointer'
                }}
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}

      <div style={{
        padding: '16px 24px',
        borderBottom: '1px solid #e0e0e0',
        display: 'flex',
        alignItems: 'center',
        gap: '16px'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <img 
            src="https://ssl.gstatic.com/images/branding/product/2x/drive_2020q4_48dp.png"
            alt="Drive"
            style={{ width: '32px', height: '32px' }}
          />
          <span style={{ fontSize: '18px', color: '#5f6368', fontWeight: '400' }}>Drive</span>
        </div>
        
        <div style={{ flex: 1 }} />
        
        <input
          ref={fileInputRef}
          type="file"
          onChange={handleFileSelect}
          style={{ display: 'none' }}
        />
        <button
          onClick={() => fileInputRef.current?.click()}
          disabled={uploading || loading}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            padding: '0 24px',
            height: '36px',
            border: 'none',
            borderRadius: '18px',
            background: '#1a73e8',
            color: '#fff',
            fontSize: '14px',
            fontWeight: '500',
            cursor: uploading ? 'not-allowed' : 'pointer',
            opacity: uploading ? 0.7 : 1,
            transition: 'box-shadow 0.2s'
          }}
          onMouseEnter={(e) => { if (!uploading) e.target.style.boxShadow = '0 1px 3px rgba(0,0,0,0.3)'; }}
          onMouseLeave={(e) => { e.target.style.boxShadow = 'none'; }}
        >
          <span style={{ fontSize: '18px' }}>+</span>
          New
        </button>
        
        <button
          onClick={loadFiles}
          disabled={loading || uploading}
          title="Refresh"
          className="icon-btn"
          style={{
            width: '36px',
            height: '36px',
            border: 'none',
            borderRadius: '50%',
            background: 'transparent',
            cursor: loading ? 'not-allowed' : 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: '18px'
          }}
        >
          🔄
        </button>
      </div>

      {uploading && (
        <div style={{
          margin: '16px 24px 0',
          padding: '16px',
          background: '#e8f0fe',
          borderRadius: '8px',
          animation: 'slideUp 0.2s ease-out'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '10px' }}>
            <div style={{
              width: '32px',
              height: '32px',
              borderRadius: '50%',
              background: '#1a73e8',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}>
              <div style={{
                width: '16px',
                height: '16px',
                border: '2px solid rgba(255,255,255,0.3)',
                borderTopColor: '#fff',
                borderRadius: '50%',
                animation: 'spin 0.8s linear infinite'
              }} />
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ 
                fontSize: '14px', 
                fontWeight: '500', 
                color: '#1a73e8',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap'
              }}>
                Uploading {uploadFileName}
              </div>
              <div style={{ fontSize: '12px', color: '#5f6368', marginTop: '2px' }}>
                {uploadProgress < 50 ? 'Reading file...' : 
                 uploadProgress < 70 ? 'Preparing upload...' : 
                 uploadProgress < 100 ? 'Uploading to Drive...' : 'Complete!'}
              </div>
            </div>
            <div style={{ fontSize: '14px', fontWeight: '500', color: '#1a73e8' }}>
              {uploadProgress}%
            </div>
          </div>
          <div style={{
            height: '4px',
            background: 'rgba(26,115,232,0.2)',
            borderRadius: '2px',
            overflow: 'hidden'
          }}>
            <div style={{
              height: '100%',
              background: '#1a73e8',
              borderRadius: '2px',
              width: `${uploadProgress}%`,
              transition: 'width 0.3s ease-out'
            }} />
          </div>
        </div>
      )}

      {error && (
        <div style={{
          margin: '16px 24px 0',
          padding: '12px 16px',
          background: '#fce8e6',
          borderRadius: '8px',
          display: 'flex',
          alignItems: 'center',
          gap: '12px'
        }}>
          <span style={{ fontSize: '16px' }}>⚠️</span>
          <span style={{ flex: 1, fontSize: '14px', color: '#d93025' }}>{error}</span>
          <button
            onClick={() => setError(null)}
            style={{
              border: 'none',
              background: 'transparent',
              cursor: 'pointer',
              padding: '4px',
              fontSize: '16px',
              color: '#5f6368'
            }}
          >
            ✕
          </button>
        </div>
      )}

      <div style={{ flex: 1, overflow: 'auto', padding: '8px 0' }}>
        {loading && files.length === 0 ? (
          <div style={{ display: 'flex', justifyContent: 'center', padding: '48px' }}>
            <div style={{
              width: '32px',
              height: '32px',
              border: '3px solid #e8eaed',
              borderTopColor: '#1a73e8',
              borderRadius: '50%',
              animation: 'spin 1s linear infinite'
            }} />
          </div>
        ) : files.length === 0 ? (
          <div style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '64px 24px',
            color: '#5f6368'
          }}>
            <div style={{ fontSize: '64px', marginBottom: '16px', opacity: 0.5 }}>☁️</div>
            <div style={{ fontSize: '16px', fontWeight: '500', color: '#202124', marginBottom: '8px' }}>
              No files yet
            </div>
            <div style={{ fontSize: '14px', textAlign: 'center' }}>
              Click <strong>+ New</strong> to upload your first file
            </div>
          </div>
        ) : (
          <>
            <div style={{
              padding: '8px 24px',
              display: 'grid',
              gridTemplateColumns: '1fr 100px 120px 80px',
              gap: '16px',
              fontSize: '12px',
              fontWeight: '500',
              color: '#5f6368',
              textTransform: 'uppercase',
              letterSpacing: '0.5px'
            }}>
              <div>Name</div>
              <div>Size</div>
              <div>Modified</div>
              <div></div>
            </div>
            
            {files.map((file) => (
              <div
                key={file.id}
                className="file-row"
                style={{
                  padding: '8px 24px',
                  display: 'grid',
                  gridTemplateColumns: '1fr 100px 120px 80px',
                  gap: '16px',
                  alignItems: 'center',
                  borderRadius: '0',
                  cursor: 'default',
                  transition: 'background 0.1s'
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px', minWidth: 0 }}>
                  <span style={{ fontSize: '20px', flexShrink: 0 }}>
                    {getFileIcon(file.mimeType, file.name)}
                  </span>
                  <span style={{
                    fontSize: '14px',
                    color: '#202124',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap'
                  }}>
                    {file.name}
                  </span>
                </div>
                
                <div style={{ fontSize: '13px', color: '#5f6368' }}>
                  {formatFileSize(file.size)}
                </div>
                
                <div style={{ fontSize: '13px', color: '#5f6368' }}>
                  {formatDate(file.modifiedTime)}
                </div>
                
                <div style={{ display: 'flex', gap: '4px', justifyContent: 'flex-end' }} className="action-btn">
                  {file.webViewLink && (
                    <a
                      href={file.webViewLink}
                      target="_blank"
                      rel="noopener noreferrer"
                      title="Open in Drive"
                      className="icon-btn"
                      style={{
                        width: '32px',
                        height: '32px',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        borderRadius: '50%',
                        textDecoration: 'none',
                        fontSize: '14px'
                      }}
                    >
                      🔗
                    </a>
                  )}
                  <button
                    onClick={() => handleDownload(file)}
                    disabled={loading}
                    title="Download"
                    className="icon-btn"
                    style={{
                      width: '32px',
                      height: '32px',
                      border: 'none',
                      background: 'transparent',
                      borderRadius: '50%',
                      cursor: loading ? 'not-allowed' : 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontSize: '14px'
                    }}
                  >
                    ⬇️
                  </button>
                  <button
                    onClick={() => handleDeleteClick(file)}
                    disabled={loading}
                    title="Delete"
                    className="icon-btn"
                    style={{
                      width: '32px',
                      height: '32px',
                      border: 'none',
                      background: 'transparent',
                      borderRadius: '50%',
                      cursor: loading ? 'not-allowed' : 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontSize: '14px'
                    }}
                  >
                    🗑️
                  </button>
                </div>
              </div>
            ))}
          </>
        )}
      </div>

      <div style={{
        padding: '12px 24px',
        borderTop: '1px solid #e0e0e0',
        fontSize: '12px',
        color: '#5f6368',
        display: 'flex',
        alignItems: 'center',
        gap: '6px'
      }}>
        <span>ℹ️</span>
        Only files created through this app are accessible
      </div>
    </div>
  );
}

export default GoogleDriveWidget;
