import React, { useState, useEffect } from 'react';

// Convert JSON Schema to form fields
function schemaToFields(schema) {
  if (!schema || schema.type !== 'object' || !schema.properties) {
    return [];
  }
  const required = schema.required || [];
  return Object.entries(schema.properties).map(([name, prop]) => ({
    name,
    type: prop.type === 'number' || prop.type === 'integer' ? 'number' : 
          prop.type === 'boolean' ? 'boolean' : 'string',
    required: required.includes(name),
    enum: prop.enum || null,
    placeholder: prop.enum ? `Options: ${prop.enum.join(', ')}` : `Enter ${name}`,
  }));
}

// Format endpoint path for display
function formatEndpointName(path) {
  return path.replace(/^\//, '').replace(/-/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
}

function IntegrationTester() {
  const [routes, setRoutes] = useState([]);
  const [loadingRoutes, setLoadingRoutes] = useState(true);
  const [routeError, setRouteError] = useState(null);
  const [selectedPath, setSelectedPath] = useState('');
  const [formData, setFormData] = useState({});
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);
  const [elapsed, setElapsed] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');

  // Fetch routes on mount
  useEffect(() => {
    async function fetchRoutes() {
      try {
        setLoadingRoutes(true);
        const response = await miyagiAPI.get('routes-schema');
        if (response.success && response.data.routes) {
          setRoutes(response.data.routes);
          if (response.data.routes.length > 0) {
            setSelectedPath(response.data.routes[0].path);
          }
        } else {
          setRouteError('Failed to load routes');
        }
      } catch (e) {
        setRouteError(e?.message || 'Failed to fetch routes');
      } finally {
        setLoadingRoutes(false);
      }
    }
    fetchRoutes();
  }, []);

  const selected = routes.find(r => r.path === selectedPath);
  const fields = selected?.inputSchema ? schemaToFields(selected.inputSchema) : [];

  // Filter routes by search term
  const filteredRoutes = routes.filter(r => 
    r.path.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (r.description && r.description.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  const handleFieldChange = (fieldName, value) => {
    setFormData(prev => ({ ...prev, [fieldName]: value }));
  };

  const handleRouteChange = (path) => {
    setSelectedPath(path);
    setFormData({});
    setResult(null);
    setError(null);
    setElapsed(null);
  };

  const runTest = async () => {
    if (!selected) return;

    // Build request body
    const body = {};
    for (const field of fields) {
      const value = formData[field.name];
      if (field.required && (value === undefined || value === '')) {
        setError(`Field "${field.name}" is required`);
        return;
      }
      if (value !== undefined && value !== '') {
        if (field.type === 'number') {
          body[field.name] = Number(value);
        } else if (field.type === 'boolean') {
          body[field.name] = value === 'true' || value === true;
        } else {
          body[field.name] = value;
        }
      }
    }

    setLoading(true);
    setError(null);
    setResult(null);
    const startTime = Date.now();

    try {
      const endpoint = selected.path.replace(/^\//, '');
      // Use the appropriate HTTP method based on route spec
      const method = (selected.method || 'POST').toLowerCase();
      const response = method === 'get' 
        ? await miyagiAPI.get(endpoint, body)
        : await miyagiAPI.post(endpoint, body);
      setElapsed(Date.now() - startTime);
      setResult(response);
    } catch (e) {
      setElapsed(Date.now() - startTime);
      setError(e?.message || 'Request failed');
    } finally {
      setLoading(false);
    }
  };

  if (loadingRoutes) {
    return (
      <div style={styles.container}>
        <div style={styles.loadingBox}>
          <span style={styles.spinner}>⏳</span>
          Loading integrations...
        </div>
      </div>
    );
  }

  if (routeError) {
    return (
      <div style={styles.container}>
        <div style={styles.errorBox}>
          <span style={styles.errorIcon}>✕</span>
          {routeError}
        </div>
      </div>
    );
  }

  return (
    <div style={styles.container}>
      {/* Header */}
      <div style={styles.header}>
        <span style={styles.headerIcon}>⚡</span>
        <span style={styles.headerTitle}>Integration Tester</span>
        <span style={styles.routeCount}>{routes.length} routes</span>
      </div>

      {/* Search */}
      <input
        type="text"
        value={searchTerm}
        onChange={(e) => setSearchTerm(e.target.value)}
        placeholder="Search integrations..."
        style={styles.searchInput}
      />

      {/* Integration Selector */}
      <div style={styles.section}>
        <label style={styles.label}>Select Integration</label>
        <select
          value={selectedPath}
          onChange={(e) => handleRouteChange(e.target.value)}
          style={styles.select}
        >
          {filteredRoutes.map(r => (
            <option key={r.path} value={r.path}>
              {formatEndpointName(r.path)}
            </option>
          ))}
        </select>
      </div>

      {/* Description */}
      {selected && (
        <div style={styles.descriptionBox}>
          <div style={styles.descriptionText}>{selected.description}</div>
          <div style={styles.endpointBadge}>{selected.method} /api/integrations{selected.path}</div>
        </div>
      )}

      {/* Input Fields */}
      {fields.length > 0 && (
        <div style={styles.section}>
          <label style={styles.label}>Input ({fields.length} fields)</label>
          <div style={styles.fieldsContainer}>
            {fields.map(field => (
              <div key={field.name} style={styles.fieldRow}>
                <span style={styles.fieldName}>
                  {field.name}
                  {field.required && <span style={styles.required}>*</span>}
                </span>
                {field.enum ? (
                  <select
                    value={formData[field.name] || ''}
                    onChange={(e) => handleFieldChange(field.name, e.target.value)}
                    style={styles.input}
                  >
                    <option value="">Select...</option>
                    {field.enum.map(opt => (
                      <option key={opt} value={opt}>{opt}</option>
                    ))}
                  </select>
                ) : field.type === 'boolean' ? (
                  <select
                    value={formData[field.name] || ''}
                    onChange={(e) => handleFieldChange(field.name, e.target.value)}
                    style={styles.input}
                  >
                    <option value="">Select...</option>
                    <option value="true">true</option>
                    <option value="false">false</option>
                  </select>
                ) : (
                  <input
                    type={field.type === 'number' ? 'number' : 'text'}
                    value={formData[field.name] || ''}
                    onChange={(e) => handleFieldChange(field.name, e.target.value)}
                    placeholder={field.placeholder}
                    style={styles.input}
                  />
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Expected Output Schema */}
      {selected?.outputSchema && (
        <div style={styles.section}>
          <label style={styles.label}>Response Schema</label>
          <pre style={styles.schemaBlock}>
            {JSON.stringify(selected.outputSchema, null, 2)}
          </pre>
        </div>
      )}

      {/* Run Button */}
      <button
        onClick={runTest}
        disabled={loading}
        style={{
          ...styles.runButton,
          opacity: loading ? 0.6 : 1,
          cursor: loading ? 'not-allowed' : 'pointer'
        }}
      >
        {loading ? 'Running...' : 'Run Test'}
      </button>

      {/* Error */}
      {error && (
        <div style={styles.errorBox}>
          <span style={styles.errorIcon}>✕</span>
          {error}
        </div>
      )}

      {/* Result */}
      {result && (
        <div style={styles.section}>
          <div style={styles.resultHeader}>
            <label style={styles.label}>Response</label>
            {elapsed !== null && (
              <span style={styles.elapsed}>{elapsed}ms</span>
            )}
          </div>
          <pre style={styles.resultPre}>
            {JSON.stringify(result, null, 2)}
          </pre>
        </div>
      )}
    </div>
  );
}

const styles = {
  container: {
    padding: '20px',
    fontFamily: "'JetBrains Mono', 'SF Mono', Monaco, 'Cascadia Code', monospace",
    background: 'linear-gradient(145deg, #0f0f0f 0%, #1a1a2e 100%)',
    minHeight: '100vh',
    color: '#e0e0e0',
    display: 'flex',
    flexDirection: 'column',
    gap: '16px',
  },
  loadingBox: {
    display: 'flex',
    alignItems: 'center',
    gap: '10px',
    padding: '20px',
    background: 'rgba(99, 102, 241, 0.1)',
    borderRadius: '8px',
    justifyContent: 'center',
  },
  spinner: {
    fontSize: '20px',
  },
  header: {
    display: 'flex',
    alignItems: 'center',
    gap: '10px',
    paddingBottom: '12px',
    borderBottom: '1px solid #2a2a4a',
  },
  headerIcon: {
    fontSize: '20px',
  },
  headerTitle: {
    fontSize: '16px',
    fontWeight: '600',
    color: '#fff',
    letterSpacing: '-0.02em',
    flex: 1,
  },
  routeCount: {
    fontSize: '11px',
    color: '#6366f1',
    background: 'rgba(99, 102, 241, 0.15)',
    padding: '4px 8px',
    borderRadius: '4px',
  },
  searchInput: {
    padding: '10px 12px',
    fontSize: '13px',
    background: '#1e1e2e',
    border: '1px solid #3a3a5a',
    borderRadius: '8px',
    color: '#fff',
    outline: 'none',
  },
  section: {
    display: 'flex',
    flexDirection: 'column',
    gap: '8px',
  },
  label: {
    fontSize: '11px',
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: '0.08em',
    color: '#888',
  },
  select: {
    padding: '10px 12px',
    fontSize: '13px',
    background: '#1e1e2e',
    border: '1px solid #3a3a5a',
    borderRadius: '8px',
    color: '#fff',
    cursor: 'pointer',
    outline: 'none',
  },
  descriptionBox: {
    padding: '12px',
    background: 'rgba(99, 102, 241, 0.08)',
    border: '1px solid rgba(99, 102, 241, 0.2)',
    borderRadius: '8px',
    display: 'flex',
    flexDirection: 'column',
    gap: '8px',
  },
  descriptionText: {
    fontSize: '13px',
    color: '#a5b4fc',
    lineHeight: '1.4',
  },
  endpointBadge: {
    fontSize: '11px',
    color: '#6366f1',
    fontFamily: 'monospace',
  },
  fieldsContainer: {
    display: 'flex',
    flexDirection: 'column',
    gap: '10px',
    padding: '12px',
    background: '#1e1e2e',
    borderRadius: '8px',
    border: '1px solid #2a2a4a',
    maxHeight: '200px',
    overflow: 'auto',
  },
  fieldRow: {
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
  },
  fieldName: {
    fontSize: '12px',
    color: '#10b981',
    minWidth: '100px',
    flexShrink: 0,
  },
  required: {
    color: '#ef4444',
    marginLeft: '2px',
  },
  input: {
    flex: 1,
    padding: '8px 10px',
    fontSize: '13px',
    background: '#0f0f1a',
    border: '1px solid #3a3a5a',
    borderRadius: '6px',
    color: '#fff',
    outline: 'none',
  },
  schemaBlock: {
    margin: 0,
    padding: '12px',
    background: '#0f0f1a',
    border: '1px solid #2a2a4a',
    borderRadius: '6px',
    fontSize: '10px',
    color: '#fbbf24',
    whiteSpace: 'pre-wrap',
    lineHeight: '1.4',
    maxHeight: '150px',
    overflow: 'auto',
  },
  runButton: {
    padding: '12px 20px',
    fontSize: '13px',
    fontWeight: '600',
    background: 'linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%)',
    border: 'none',
    borderRadius: '8px',
    color: '#fff',
    letterSpacing: '0.02em',
  },
  errorBox: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    padding: '12px',
    background: 'rgba(239, 68, 68, 0.1)',
    border: '1px solid rgba(239, 68, 68, 0.3)',
    borderRadius: '8px',
    fontSize: '13px',
    color: '#fca5a5',
  },
  errorIcon: {
    color: '#ef4444',
    fontWeight: 'bold',
  },
  resultHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  elapsed: {
    fontSize: '11px',
    color: '#10b981',
    background: 'rgba(16, 185, 129, 0.1)',
    padding: '4px 8px',
    borderRadius: '4px',
  },
  resultPre: {
    margin: 0,
    padding: '12px',
    background: '#0f0f1a',
    border: '1px solid #2a2a4a',
    borderRadius: '8px',
    fontSize: '11px',
    color: '#a5f3fc',
    overflow: 'auto',
    maxHeight: '300px',
    whiteSpace: 'pre-wrap',
    wordBreak: 'break-word',
    lineHeight: '1.5',
  },
};

export default IntegrationTester;
