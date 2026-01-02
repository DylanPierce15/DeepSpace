import React, { useState, useEffect, useRef } from 'react';

function PresentationWidget() {
  const [isLoading, setIsLoading] = useState(true);
  const [iframeUrl, setIframeUrl] = useState('');
  const iframeRef = useRef(null);

  // Initialize document key and iframe URL
  useEffect(() => {
    // Generate unique user info for this session
    const userId = 'user_' + Math.random().toString(36).substring(2, 15);
    const userName = 'User ' + userId.substring(5, 10);
    
    // Derive document key directly from the widget's shape ID
    let documentKey;
    
    if (typeof miyagiWidgetConfig !== 'undefined' && miyagiWidgetConfig.shapeId) {
      // Use the widget's shape ID directly - it's already unique and persistent
      const shapeId = miyagiWidgetConfig.shapeId.replace(/:/g, '_'); // Replace colons for OnlyOffice compatibility
      documentKey = 'presentation_' + shapeId;
      console.log('Document key derived from shape ID:', documentKey);
    } else {
      // Fallback for testing or if widget config is not available
      documentKey = 'presentation_test_' + Math.random().toString(36).substring(2, 9);
      console.log('Using test document key (widget config not available):', documentKey);
    }
    
    // Build the URL with parameters
    const params = new URLSearchParams({
      user: userName,
      userId: userId,
      type: 'presentation'
    });
    
    const url = `/document-editor/${documentKey}?${params.toString()}`;
    setIframeUrl(url);
    
    console.log('Presentation widget initialized with document key:', documentKey);
  }, []); // Run once on mount

  // Handle editor ready message
  useEffect(() => {
    const handleMessage = (event) => {
      if (event.data && event.data.type === 'editor-ready') {
        console.log('Editor is ready in iframe');
        setIsLoading(false);
      }
    };

    window.addEventListener('message', handleMessage);
    
    return () => {
      window.removeEventListener('message', handleMessage);
    };
  }, []);

  // Fallback timeout to hide loading state
  useEffect(() => {
    const timeoutId = setTimeout(() => {
      setIsLoading(false);
    }, 3000);

    return () => clearTimeout(timeoutId);
  }, []);

  return (
    <div style={{
      width: '100%',
      height: '100%',
      position: 'relative',
      overflow: 'hidden'
    }}>
      {isLoading && (
        <div style={{
          padding: '20px',
          textAlign: 'center',
          color: '#666',
          position: 'absolute',
          top: '50%',
          left: '50%',
          transform: 'translate(-50%, -50%)'
        }}>
          Loading Presentation...
        </div>
      )}
      
      {iframeUrl && (
        <iframe
          ref={iframeRef}
          src={iframeUrl}
          style={{
            width: '100%',
            height: '100%',
            border: 'none',
            display: isLoading ? 'none' : 'block'
          }}
          allow="*"
          allowFullScreen
        />
      )}
    </div>
  );
}

export default PresentationWidget;

