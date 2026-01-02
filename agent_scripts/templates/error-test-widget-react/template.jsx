import React, { useState, useEffect } from 'react';

/**
 * Test widget to verify error boundary behavior.
 * - Test 1: Caught API error → widget stays functional
 * - Test 2: Event handler error → NOT caught by boundary (React design)
 * - Test 3: Render error → CAUGHT by boundary (triggers error UI)
 */
function ErrorTestWidget() {
  const [status, setStatus] = useState('idle');
  const [error, setError] = useState(null);
  const [tailwindLoaded, setTailwindLoaded] = useState(false);
  const [shouldCrash, setShouldCrash] = useState(false);

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

  const callNonExistentAPI = async () => {
    setStatus('loading');
    setError(null);
    
    try {
      // This should fail - calling a non-existent McAPI integration
      if (typeof miyagiAPI !== 'undefined' && miyagiAPI) {
        const result = await miyagiAPI.call('non-existent-integration', 'fakeMethod', {
          param: 'test'
        });
        setStatus('success');
        console.log('Unexpected success:', result);
      } else {
        // miyagiAPI not available - simulate the error
        throw new Error('Integration "non-existent-integration" not found');
      }
    } catch (err) {
      console.error('API call failed (expected):', err);
      setError(err.message || 'Unknown error');
      setStatus('error');
    }
  };

  const throwEventHandlerError = () => {
    // Event handler errors are NOT caught by React error boundaries!
    // This is by design - error boundaries only catch render/lifecycle errors
    throw new Error('Event handler error - NOT caught by boundary');
  };

  const triggerRenderCrash = () => {
    // This sets state that will cause the NEXT render to throw
    // Error boundaries DO catch errors during render
    setShouldCrash(true);
  };

  // This will throw during render when shouldCrash is true
  if (shouldCrash) {
    throw new Error('Intentional render error - error boundary should catch this!');
  }

  if (!tailwindLoaded) {
    return <div style={{ padding: '20px', textAlign: 'center' }}>Loading...</div>;
  }

  return (
    <div className="p-6 h-full bg-gray-50 overflow-auto">
      <h2 className="text-xl font-bold text-gray-800 mb-4">Error Handling Test Widget</h2>
      
      <div className="space-y-4">
        {/* Test 1: Caught API error - should NOT crash */}
        <div className="bg-white p-4 rounded-lg border border-gray-200">
          <h3 className="font-medium text-gray-700 mb-2">Test 1: Caught API Error</h3>
          <p className="text-sm text-gray-500 mb-3">
            Calls a non-existent McAPI integration. Error is caught - widget should NOT crash.
          </p>
          <button
            onClick={callNonExistentAPI}
            disabled={status === 'loading'}
            className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 disabled:opacity-50"
          >
            {status === 'loading' ? 'Calling...' : 'Call Non-Existent API'}
          </button>
          
          {status === 'error' && (
            <div className="mt-3 p-3 bg-yellow-50 border border-yellow-200 rounded">
              <p className="text-sm text-yellow-800">
                <strong>Error caught (expected):</strong> {error}
              </p>
              <p className="text-xs text-yellow-600 mt-1">
                ✓ Widget is still functional - error was handled gracefully
              </p>
            </div>
          )}
          
          {status === 'success' && (
            <div className="mt-3 p-3 bg-green-50 border border-green-200 rounded">
              <p className="text-sm text-green-800">Success (unexpected)</p>
            </div>
          )}
        </div>

        {/* Test 2: Event handler error - NOT caught by boundary */}
        <div className="bg-white p-4 rounded-lg border border-gray-200">
          <h3 className="font-medium text-gray-700 mb-2">Test 2: Event Handler Error</h3>
          <p className="text-sm text-gray-500 mb-3">
            Throws in onClick handler. React error boundaries do NOT catch event handler errors (by design).
            Widget will NOT crash.
          </p>
          <button
            onClick={throwEventHandlerError}
            className="px-4 py-2 bg-orange-500 text-white rounded hover:bg-orange-600"
          >
            Throw in Event Handler (Won't Crash)
          </button>
        </div>

        {/* Test 3: Render error - WILL be caught by boundary */}
        <div className="bg-white p-4 rounded-lg border border-red-200 bg-red-50">
          <h3 className="font-medium text-red-700 mb-2">Test 3: Render Error (WILL CRASH)</h3>
          <p className="text-sm text-red-600 mb-3">
            Sets state that causes next render to throw. Error boundary WILL catch this and show error UI.
          </p>
          <button
            onClick={triggerRenderCrash}
            className="px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700"
          >
            🔥 Crash Widget (Render Error)
          </button>
        </div>
      </div>
      
      <div className="mt-6 p-3 bg-gray-100 rounded text-xs text-gray-600">
        <strong>Current Status:</strong> {status} | Widget is functional
      </div>
    </div>
  );
}

export default ErrorTestWidget;

