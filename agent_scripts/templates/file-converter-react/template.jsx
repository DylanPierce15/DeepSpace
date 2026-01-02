import React, { useState, useRef, useCallback, useEffect } from 'react';

function FileConverterWidget() {
  // Apply full-page background to cover entire scrollable area
  useEffect(() => {
    document.body.style.background = 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)';
    document.documentElement.style.minHeight = '100%';
    return () => {
      document.body.style.background = '';
      document.documentElement.style.minHeight = '';
    };
  }, []);

  // Local storage for conversion history (widget-specific)
  const [conversionHistory, setConversionHistory] = useStorage('conversion-history', []);
  
  // Global storage for favorite formats and user preferences (canvas-wide)
  const [favoriteFormats, setFavoriteFormats] = useGlobalStorage('favorite-formats', []);
  const [userPreferences, setUserPreferences] = useGlobalStorage('converter-preferences', {
    defaultOutputFormat: 'pdf',
    showHistory: true,
    autoDownload: false
  });
  
  const [selectedFile, setSelectedFile] = useState(null);
  const [inputFormat, setInputFormat] = useState('');
  const [outputFormat, setOutputFormat] = useState('pdf');
  const [isConverting, setIsConverting] = useState(false);
  const [result, setResult] = useState(null);
  const [dragOver, setDragOver] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [showPreferences, setShowPreferences] = useState(false);
  
  const fileInputRef = useRef(null);

  // Supported format categories
  const formatCategories = {
    document: {
      name: '📄 Documents',
      formats: ['pdf', 'docx', 'doc', 'txt', 'rtf', 'odt', 'pages']
    },
    image: {
      name: '🖼️ Images', 
      formats: ['jpg', 'jpeg', 'png', 'gif', 'bmp', 'tiff', 'webp', 'svg', 'ico']
    },
    video: {
      name: '🎥 Videos',
      formats: ['mp4', 'avi', 'mov', 'wmv', 'flv', 'webm', 'mkv', '3gp']
    },
    audio: {
      name: '🎵 Audio',
      formats: ['mp3', 'wav', 'flac', 'aac', 'ogg', 'm4a', 'wma']
    },
    spreadsheet: {
      name: '📊 Spreadsheets',
      formats: ['xlsx', 'xls', 'csv', 'ods', 'numbers']
    },
    presentation: {
      name: '📈 Presentations',
      formats: ['pptx', 'ppt', 'odp', 'key']
    }
  };

  // Get all available formats
  const allFormats = Object.values(formatCategories).flatMap(cat => cat.formats);

  // File upload handlers
  const handleFileSelect = useCallback((file) => {
    if (!file) return;
    
    setSelectedFile(file);
    setResult(null);
    
    // Auto-detect input format
    const extension = file.name.split('.').pop()?.toLowerCase();
    if (extension && allFormats.includes(extension)) {
      setInputFormat(extension);
    }
  }, [allFormats]);

  const handleFileInputChange = (event) => {
    const file = event.target.files[0];
    handleFileSelect(file);
  };

  const handleDragOver = (e) => {
    e.preventDefault();
    setDragOver(true);
  };

  const handleDragLeave = () => {
    setDragOver(false);
  };

  const handleDrop = (e) => {
    e.preventDefault();
    setDragOver(false);
    
    const files = e.dataTransfer.files;
    if (files.length > 0) {
      handleFileSelect(files[0]);
    }
  };

  // File to base64 converter
  const fileToBase64 = (file) => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        const base64 = reader.result.split(',')[1]; // Remove data:mime;base64, prefix
        resolve(base64);
      };
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  };

  // Format file size
  const formatFileSize = (bytes) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  // Convert file
  const convertFile = async () => {
    if (!selectedFile || !outputFormat || inputFormat === outputFormat) {
      return;
    }

    setIsConverting(true);
    setResult(null);

    try {
      // Convert file to base64
      console.log('[FileConverter] Starting conversion:', {
        fileName: selectedFile.name,
        fileSize: selectedFile.size,
        inputFormat,
        outputFormat
      });
      
      const base64 = await fileToBase64(selectedFile);
      console.log('[FileConverter] Base64 generated, length:', base64.length);
      
      // Call the CloudConvert API
      console.log('[FileConverter] Calling API...');
      const response = await miyagiAPI.post('convert-file', {
        file: base64,
        input_format: inputFormat,
        output_format: outputFormat
      });

      console.log('[FileConverter] API Response:', JSON.stringify(response, null, 2));

      // Check for error in response
      if (!response.success || response.data?.error) {
        throw new Error(response.data?.error || response.error || 'Conversion failed');
      }

      // Create conversion result object
      const downloadUrl = response.data?.downloadUrl || response.data?.url;
      const conversionResult = {
        id: Date.now(),
        originalFile: selectedFile.name,
        inputFormat: inputFormat,
        outputFormat: outputFormat,
        downloadUrl: downloadUrl,
        filename: response.data?.filename || `converted.${outputFormat}`,
        timestamp: new Date().toISOString(),
        fileSize: selectedFile.size,
        success: true
      };

      console.log('[FileConverter] Conversion result:', conversionResult);

      setResult(conversionResult);
      
      // Add to conversion history (local storage)
      const updatedHistory = [conversionResult, ...conversionHistory.slice(0, 9)]; // Keep last 10
      setConversionHistory(updatedHistory);
      
      // Add formats to favorites if successful (global storage)
      const newFavorites = [...new Set([...favoriteFormats, outputFormat])].slice(0, 8);
      setFavoriteFormats(newFavorites);
      
      // Auto-download if preference is set
      if (userPreferences.autoDownload && downloadUrl) {
        const link = document.createElement('a');
        link.href = downloadUrl;
        link.download = response.data?.filename || `converted.${outputFormat}`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
      }
    } catch (error) {
      console.error('[FileConverter] Conversion error:', error);
      console.error('[FileConverter] Error details:', {
        message: error.message,
        response: error.response?.data,
        status: error.response?.status
      });
      setResult({
        error: error.message || 'Conversion failed',
        timestamp: new Date().toISOString(),
        success: false
      });
    } finally {
      setIsConverting(false);
    }
  };

  // Clear file selection
  const clearFile = () => {
    setSelectedFile(null);
    setInputFormat('');
    setResult(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  // Delete from history
  const deleteFromHistory = (id) => {
    setConversionHistory(conversionHistory.filter(item => item.id !== id));
  };

  // Clear all history
  const clearHistory = () => {
    setConversionHistory([]);
  };

  // Update preferences
  const updatePreferences = (newPrefs) => {
    setUserPreferences({ ...userPreferences, ...newPrefs });
  };

  // Get format category
  const getFormatCategory = (format) => {
    for (const [key, category] of Object.entries(formatCategories)) {
      if (category.formats.includes(format)) {
        return { key, ...category };
      }
    }
    return null;
  };

  // Check if conversion is possible
  const canConvert = selectedFile && inputFormat && outputFormat && inputFormat !== outputFormat && !isConverting;

  return (
    <div style={{
      padding: '20px',
      fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
      background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
      color: 'white',
      minHeight: '100vh',
      boxSizing: 'border-box'
    }}>
      <div style={{
        background: 'rgba(255, 255, 255, 0.1)',
        borderRadius: '16px',
        padding: '20px',
        backdropFilter: 'blur(10px)'
      }}>
        {/* Header */}
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: '20px'
        }}>
          <h2 style={{ margin: 0, fontSize: '24px', fontWeight: '600' }}>
            🔄 File Converter
          </h2>
          <div style={{ display: 'flex', gap: '8px' }}>
            <button
              onClick={() => setShowHistory(!showHistory)}
              style={{
                padding: '8px 12px',
                border: 'none',
                borderRadius: '6px',
                background: showHistory ? 'rgba(255, 255, 255, 0.3)' : 'rgba(255, 255, 255, 0.2)',
                color: 'white',
                cursor: 'pointer',
                fontSize: '12px'
              }}
            >
              📊 History
            </button>
            <button
              onClick={() => setShowPreferences(!showPreferences)}
              style={{
                padding: '8px 12px',
                border: 'none',
                borderRadius: '6px',
                background: showPreferences ? 'rgba(255, 255, 255, 0.3)' : 'rgba(255, 255, 255, 0.2)',
                color: 'white',
                cursor: 'pointer',
                fontSize: '12px'
              }}
            >
              ⚙️ Settings
            </button>
          </div>
        </div>

        {!showHistory && !showPreferences ? (
          <>
            {/* File Upload Area */}
            <div
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
              onClick={() => fileInputRef.current?.click()}
              style={{
                border: `2px dashed ${dragOver ? '#4CAF50' : 'rgba(255, 255, 255, 0.3)'}`,
                borderRadius: '12px',
                padding: '40px 20px',
                textAlign: 'center',
                cursor: 'pointer',
                background: dragOver ? 'rgba(76, 175, 80, 0.1)' : 'rgba(255, 255, 255, 0.05)',
                transition: 'all 0.2s ease',
                marginBottom: '20px'
              }}
            >
              <input
                ref={fileInputRef}
                type="file"
                onChange={handleFileInputChange}
                style={{ display: 'none' }}
                accept="*/*"
              />
              
              {selectedFile ? (
                <div>
                  <div style={{ fontSize: '48px', marginBottom: '12px' }}>📄</div>
                  <div style={{ fontSize: '16px', fontWeight: '500', marginBottom: '8px' }}>
                    {selectedFile.name}
                  </div>
                  <div style={{ fontSize: '14px', opacity: 0.8, marginBottom: '12px' }}>
                    {formatFileSize(selectedFile.size)} • {selectedFile.type || 'Unknown type'}
                  </div>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      clearFile();
                    }}
                    style={{
                      padding: '6px 12px',
                      border: 'none',
                      borderRadius: '6px',
                      background: 'rgba(255, 0, 0, 0.3)',
                      color: 'white',
                      cursor: 'pointer',
                      fontSize: '12px'
                    }}
                  >
                    🗑️ Remove
                  </button>
                </div>
              ) : (
                <div>
                  <div style={{ fontSize: '48px', marginBottom: '12px' }}>📁</div>
                  <div style={{ fontSize: '16px', marginBottom: '8px' }}>
                    Click to select a file or drag & drop
                  </div>
                  <div style={{ fontSize: '14px', opacity: 0.7 }}>
                    Supports documents, images, videos, audio, and more
                  </div>
                </div>
              )}
            </div>

            {selectedFile && (
              <>
                {/* Format Selection */}
                <div style={{
                  background: 'rgba(255, 255, 255, 0.1)',
                  borderRadius: '12px',
                  padding: '16px',
                  marginBottom: '20px'
                }}>
                  <h3 style={{ margin: '0 0 16px 0', fontSize: '16px' }}>Format Conversion</h3>
                  
                  <div style={{ display: 'flex', alignItems: 'center', gap: '16px', marginBottom: '16px' }}>
                    <div style={{ flex: 1 }}>
                      <label style={{ display: 'block', marginBottom: '8px', fontSize: '14px' }}>
                        From: {inputFormat ? inputFormat.toUpperCase() : 'Auto-detect'}
                      </label>
                      <select
                        value={inputFormat}
                        onChange={(e) => setInputFormat(e.target.value)}
                        style={{
                          width: '100%',
                          padding: '8px',
                          border: 'none',
                          borderRadius: '6px',
                          background: 'rgba(255, 255, 255, 0.9)',
                          color: '#333',
                          fontSize: '14px'
                        }}
                      >
                        <option value="">Auto-detect</option>
                        {Object.entries(formatCategories).map(([key, category]) => (
                          <optgroup key={key} label={category.name}>
                            {category.formats.map(format => (
                              <option key={format} value={format}>
                                {format.toUpperCase()}
                              </option>
                            ))}
                          </optgroup>
                        ))}
                      </select>
                    </div>
                    
                    <div style={{ fontSize: '24px', opacity: 0.6 }}>→</div>
                    
                    <div style={{ flex: 1 }}>
                      <label style={{ display: 'block', marginBottom: '8px', fontSize: '14px' }}>
                        To: {outputFormat.toUpperCase()}
                      </label>
                      <select
                        value={outputFormat}
                        onChange={(e) => setOutputFormat(e.target.value)}
                        style={{
                          width: '100%',
                          padding: '8px',
                          border: 'none',
                          borderRadius: '6px',
                          background: 'rgba(255, 255, 255, 0.9)',
                          color: '#333',
                          fontSize: '14px'
                        }}
                      >
                        {Object.entries(formatCategories).map(([key, category]) => (
                          <optgroup key={key} label={category.name}>
                            {category.formats.map(format => (
                              <option key={format} value={format}>
                                {format.toUpperCase()}
                              </option>
                            ))}
                          </optgroup>
                        ))}
                      </select>
                    </div>
                  </div>

                  {/* Favorite Formats Quick Select */}
                  {favoriteFormats.length > 0 && (
                    <div style={{ marginBottom: '16px' }}>
                      <div style={{ fontSize: '14px', marginBottom: '8px', opacity: 0.8 }}>
                        ⭐ Quick Select:
                      </div>
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                        {favoriteFormats.map(format => (
                          <button
                            key={format}
                            onClick={() => setOutputFormat(format)}
                            style={{
                              padding: '4px 8px',
                              border: 'none',
                              borderRadius: '4px',
                              background: outputFormat === format ? 'rgba(255, 215, 0, 0.3)' : 'rgba(255, 255, 255, 0.2)',
                              color: 'white',
                              cursor: 'pointer',
                              fontSize: '11px'
                            }}
                          >
                            {format.toUpperCase()}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}

                  <button
                    onClick={convertFile}
                    disabled={!canConvert}
                    style={{
                      width: '100%',
                      padding: '12px',
                      border: 'none',
                      borderRadius: '8px',
                      background: canConvert ? '#4CAF50' : 'rgba(255, 255, 255, 0.3)',
                      color: 'white',
                      cursor: canConvert ? 'pointer' : 'not-allowed',
                      fontWeight: '500',
                      fontSize: '14px',
                      opacity: canConvert ? 1 : 0.6
                    }}
                  >
                    {isConverting ? '🔄 Converting...' : '🔄 Convert File'}
                  </button>
                </div>

                {/* Result */}
                {result && (
                  <div style={{
                    background: result.error ? 'rgba(255, 0, 0, 0.1)' : 'rgba(0, 255, 0, 0.1)',
                    borderRadius: '12px',
                    padding: '16px',
                    marginBottom: '20px',
                    border: `1px solid ${result.error ? 'rgba(255, 0, 0, 0.3)' : 'rgba(0, 255, 0, 0.3)'}`
                  }}>
                    {result.error ? (
                      <div>
                        <div style={{ fontSize: '16px', marginBottom: '8px' }}>❌ Conversion Failed</div>
                        <div style={{ fontSize: '14px', opacity: 0.8 }}>{result.error}</div>
                      </div>
                    ) : (
                      <div>
                        <div style={{ fontSize: '16px', marginBottom: '12px' }}>✅ Conversion Successful!</div>
                        <div style={{ fontSize: '14px', opacity: 0.9, marginBottom: '12px' }}>
                          {result.filename}
                        </div>
                        <a
                          href={result.downloadUrl}
                          download={result.filename}
                          style={{
                            display: 'inline-block',
                            padding: '8px 16px',
                            background: '#4CAF50',
                            color: 'white',
                            textDecoration: 'none',
                            borderRadius: '6px',
                            fontSize: '14px'
                          }}
                        >
                          📥 Download {result.outputFormat.toUpperCase()} File
                        </a>
                        <div style={{ fontSize: '12px', opacity: 0.7, marginTop: '8px' }}>
                          Cost: $0.01 USD per conversion
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </>
            )}
          </>
        ) : showHistory ? (
          /* History View */
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
              <h3 style={{ margin: 0, fontSize: '18px' }}>📊 Conversion History</h3>
              {conversionHistory.length > 0 && (
                <button
                  onClick={clearHistory}
                  style={{
                    padding: '6px 12px',
                    border: 'none',
                    borderRadius: '6px',
                    background: 'rgba(255, 0, 0, 0.3)',
                    color: 'white',
                    cursor: 'pointer',
                    fontSize: '12px'
                  }}
                >
                  🗑️ Clear All
                </button>
              )}
            </div>
            
            <div style={{ maxHeight: '400px', overflowY: 'auto' }}>
              {conversionHistory.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '40px', opacity: 0.6 }}>
                  No conversions yet! 📝
                </div>
              ) : (
                conversionHistory.map(item => (
                  <div key={item.id} style={{
                    background: 'rgba(255, 255, 255, 0.1)',
                    borderRadius: '8px',
                    padding: '12px',
                    marginBottom: '8px',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center'
                  }}>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontWeight: '500', marginBottom: '4px' }}>
                        {item.originalFile}
                      </div>
                      <div style={{ fontSize: '12px', opacity: 0.8 }}>
                        {item.inputFormat.toUpperCase()} → {item.outputFormat.toUpperCase()} • {formatFileSize(item.fileSize)}
                      </div>
                      <div style={{ fontSize: '11px', opacity: 0.6 }}>
                        {new Date(item.timestamp).toLocaleString()}
                      </div>
                    </div>
                    <div style={{ display: 'flex', gap: '8px' }}>
                      {item.downloadUrl && (
                        <a
                          href={item.downloadUrl}
                          download={item.filename}
                          style={{
                            padding: '4px 8px',
                            background: 'rgba(76, 175, 80, 0.3)',
                            color: 'white',
                            textDecoration: 'none',
                            borderRadius: '4px',
                            fontSize: '11px'
                          }}
                        >
                          📥
                        </a>
                      )}
                      <button
                        onClick={() => deleteFromHistory(item.id)}
                        style={{
                          padding: '4px 8px',
                          border: 'none',
                          borderRadius: '4px',
                          background: 'rgba(255, 0, 0, 0.3)',
                          color: 'white',
                          cursor: 'pointer',
                          fontSize: '11px'
                        }}
                      >
                        🗑️
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        ) : (
          /* Preferences View */
          <div>
            <h3 style={{ margin: '0 0 16px 0', fontSize: '18px' }}>⚙️ Preferences</h3>
            
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div>
                <label style={{ display: 'block', marginBottom: '8px', fontSize: '14px' }}>
                  Default Output Format:
                </label>
                <select
                  value={userPreferences.defaultOutputFormat}
                  onChange={(e) => updatePreferences({ defaultOutputFormat: e.target.value })}
                  style={{
                    width: '100%',
                    padding: '8px',
                    border: 'none',
                    borderRadius: '6px',
                    background: 'rgba(255, 255, 255, 0.9)',
                    color: '#333',
                    fontSize: '14px'
                  }}
                >
                  {Object.entries(formatCategories).map(([key, category]) => (
                    <optgroup key={key} label={category.name}>
                      {category.formats.map(format => (
                        <option key={format} value={format}>
                          {format.toUpperCase()}
                        </option>
                      ))}
                    </optgroup>
                  ))}
                </select>
              </div>
              
              <div>
                <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '14px' }}>
                  <input
                    type="checkbox"
                    checked={userPreferences.autoDownload}
                    onChange={(e) => updatePreferences({ autoDownload: e.target.checked })}
                    style={{ transform: 'scale(1.2)' }}
                  />
                  Auto-download converted files
                </label>
              </div>
              
              <div>
                <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '14px' }}>
                  <input
                    type="checkbox"
                    checked={userPreferences.showHistory}
                    onChange={(e) => updatePreferences({ showHistory: e.target.checked })}
                    style={{ transform: 'scale(1.2)' }}
                  />
                  Show conversion history by default
                </label>
              </div>
            </div>
          </div>
        )}

        {/* Storage Info */}
        <div style={{
          marginTop: '20px',
          padding: '12px',
          background: 'rgba(255, 255, 255, 0.1)',
          borderRadius: '8px',
          fontSize: '11px',
          opacity: 0.7
        }}>
          💡 Smart Storage: Conversion history stored locally, preferences & favorites shared globally. Cost: $0.01 per conversion
        </div>
      </div>
    </div>
  );
}

export default FileConverterWidget;
