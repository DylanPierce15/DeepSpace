import React, { useState, useEffect, useRef } from 'react';

function LeadDetailWidget() {
  console.log('Lead Detail Widget rendering...');
  
  // Global storage for leads (reads from Lead Pipeline) - EXACT pattern as ItineraryOrganizer
  const [leadData, setLeadData] = useGlobalStorage('crm-leads', { leads: [] });
  
  // Watch for the selected lead ID from global storage (set by pipeline)
  const [selectedLeadId, setSelectedLeadId] = useGlobalStorage('selected-lead-id', '');
  
  console.log('Detail - Raw leadData:', leadData);
  console.log('Detail - Selected Lead ID:', selectedLeadId);
  
  // EXACT same pattern as ItineraryOrganizer
  const leads = leadData.leads || [];
  // Fix type mismatch: selectedLeadId might be number, but lead IDs are strings
  const lead = selectedLeadId ? leads.find(l => l.id === String(selectedLeadId)) : null;
  
  console.log('Detail - leads array:', leads);
  console.log('Detail - selectedLeadId:', selectedLeadId, 'type:', typeof selectedLeadId);
  console.log('Detail - found lead:', lead);
  
  // Local state for tabs and editing
  const [activeTab, setActiveTab] = useState('overview');
  const [isEditing, setIsEditing] = useState(false);
  const [editForm, setEditForm] = useState({});
  
  // Use localStorage directly instead of useGlobalStorage to avoid conflicts between multiple widget instances
  const getStoredData = () => {
    try {
      const stored = localStorage.getItem('crm-lead-data');
      if (stored) {
        const parsed = JSON.parse(stored);
        console.log('Loaded from localStorage:', parsed);
        return parsed;
      }
    } catch (error) {
      console.error('Error loading from localStorage:', error);
    }
    return {
      documents: {},
      files: {},
      notes: {},
      activities: {}
    };
  };
  
  const [allLeadData, setAllLeadDataState] = useState(getStoredData);
  
  // Wrapper to save to localStorage whenever state changes
  const setAllLeadData = (updater) => {
    setAllLeadDataState(prev => {
      const newValue = typeof updater === 'function' ? updater(prev) : updater;
      console.log('Saving to localStorage:', newValue);
      
      // Save to localStorage
      try {
        localStorage.setItem('crm-lead-data', JSON.stringify(newValue));
      } catch (error) {
        console.error('Error saving to localStorage:', error);
      }
      
      return newValue;
    });
  };
  
  // Ensure allLeadData is always a valid object with required properties
  const safeLeadData = allLeadData && typeof allLeadData === 'object' ? {
    documents: allLeadData.documents || {},
    files: allLeadData.files || {},
    notes: allLeadData.notes || {},
    activities: allLeadData.activities || {}
  } : {
    documents: {},
    files: {},
    notes: {},
    activities: {}
  };
  
  console.log('All lead data from storage:', allLeadData);
  console.log('Safe lead data:', safeLeadData);
  console.log('Selected lead ID:', selectedLeadId);
  
  // Get current lead's data from global storage
  const documents = selectedLeadId ? (safeLeadData.documents[selectedLeadId] || []) : [];
  const uploadedFiles = selectedLeadId ? (safeLeadData.files[selectedLeadId] || {}) : {};
  const notes = selectedLeadId ? (safeLeadData.notes[selectedLeadId] || []) : [];
  const activities = selectedLeadId ? (safeLeadData.activities[selectedLeadId] || []) : [];
  
  console.log('Current lead data:', { documents, uploadedFiles, notes, activities });
  
  // Local state
  const [showAddDocument, setShowAddDocument] = useState(false);
  const [newDocument, setNewDocument] = useState({ name: '', type: '', url: '', notes: '' });
  const [tempUploadedFiles, setTempUploadedFiles] = useState([]);
  const [newNote, setNewNote] = useState('');
  const [newActivity, setNewActivity] = useState({ type: '', description: '', date: '' });
  const [showAddActivity, setShowAddActivity] = useState(false);
  
  // Initialize edit form when lead changes
  useEffect(() => {
    if (lead) {
      setEditForm(lead);
    }
  }, [lead]);
  
  const handleSaveEdit = () => {
    // TODO: Implement lead editing - for now just close edit mode
    console.log('Would save lead edits:', editForm);
    setIsEditing(false);
  };
  
  // Delete functionality removed per request
  
  const handleSelectLead = (leadId) => {
    setSelectedLeadId(leadId);
  };
  
  const addDocument = () => {
    console.log('=== ADDING DOCUMENT ===');
    console.log('selectedLeadId:', selectedLeadId);
    console.log('tempUploadedFiles:', tempUploadedFiles);
    console.log('Current documents:', documents);
    console.log('Current uploadedFiles:', uploadedFiles);
    
    if (!selectedLeadId) {
      console.error('No selectedLeadId available!');
      return;
    }
    
    // Prepare all documents and file data at once
    const newDocs = [];
    const newFileData = {};
    
    // Process uploaded files
    tempUploadedFiles.forEach(fileData => {
      console.log('Processing file:', fileData);
      
      // Use custom name if provided, otherwise use original filename
      const displayName = newDocument.name || fileData.name;
      
      // Prepare document entry
      const doc = {
        id: fileData.id,
        name: displayName,
        type: fileData.type,
        url: '', // No external URL for uploaded files
        notes: `Uploaded file (${(fileData.size / 1024).toFixed(1)} KB)`,
        addedAt: new Date().toISOString(),
        isUploaded: true
      };
      newDocs.push(doc);
      newFileData[fileData.id] = fileData;
    });
    
    // Add manual document if filled (only if no files uploaded)
    if (newDocument.name && newDocument.type && tempUploadedFiles.length === 0) {
      const doc = {
        id: Date.now().toString(),
        ...newDocument,
        addedAt: new Date().toISOString()
      };
      newDocs.push(doc);
    }
    
    // Update global storage with new documents and files
    if (newDocs.length > 0 || Object.keys(newFileData).length > 0) {
      setAllLeadData(prev => {
        console.log('addDocument - prev value:', prev);
        
        // Ensure prev is a valid object
        const safePrev = prev && typeof prev === 'object' ? prev : {
          documents: {},
          files: {},
          notes: {},
          activities: {}
        };
        
        const updated = {
          documents: {
            ...(safePrev.documents || {}),
            [selectedLeadId]: [...((safePrev.documents || {})[selectedLeadId] || []), ...newDocs]
          },
          files: {
            ...(safePrev.files || {}),
            [selectedLeadId]: {
              ...((safePrev.files || {})[selectedLeadId] || {}),
              ...newFileData
            }
          },
          notes: safePrev.notes || {},
          activities: safePrev.activities || {}
        };
        console.log('addDocument - returning updated:', updated);
        
        // CRITICAL: Never return undefined
        if (!updated || typeof updated !== 'object') {
          console.error('CRITICAL: About to return invalid object!', updated);
          return safePrev;
        }
        
        return updated;
      });
    }
    
    // Reset everything
    setNewDocument({ name: '', type: '', url: '', notes: '' });
    setTempUploadedFiles([]);
    setShowAddDocument(false);
    
    console.log('=== DOCUMENT ADDED ===');
  };
  
  const handleFileUpload = (event) => {
    const files = event.target.files;
    if (!files || files.length === 0) return;
    
    Array.from(files).forEach(file => {
      const reader = new FileReader();
      reader.onload = (e) => {
        const fileData = {
          id: Date.now().toString() + Math.random().toString(36).substr(2, 9),
          name: file.name,
          type: file.type || 'Unknown',
          size: file.size,
          data: e.target.result,
          uploadedAt: new Date().toISOString()
        };
        
        // Add to temporary files list (not saved yet)
        setTempUploadedFiles(prev => [...prev, fileData]);
      };
      reader.readAsDataURL(file);
    });
    
    // Reset file input
    event.target.value = '';
  };
  
  const downloadDocument = (doc) => {
    console.log('Downloading document:', doc);
    
    if (doc.isUploaded && uploadedFiles[doc.id]) {
      // Download uploaded file
      const fileData = uploadedFiles[doc.id];
      console.log('File data:', fileData);
      
      const link = document.createElement('a');
      link.href = fileData.data;
      link.download = fileData.name;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } else if (doc.url) {
      // Download external URL
      const link = document.createElement('a');
      link.href = doc.url;
      link.download = doc.name || 'document';
      link.target = '_blank';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    }
  };
  
  const deleteDocument = (id) => {
    if (!selectedLeadId) return;
    
    setAllLeadData(prev => {
      const safePrev = prev && typeof prev === 'object' ? prev : { documents: {}, files: {}, notes: {}, activities: {} };
      return {
        documents: {
          ...(safePrev.documents || {}),
          [selectedLeadId]: ((safePrev.documents || {})[selectedLeadId] || []).filter(d => d.id !== id)
        },
        files: {
          ...(safePrev.files || {}),
          [selectedLeadId]: Object.fromEntries(
            Object.entries((safePrev.files || {})[selectedLeadId] || {}).filter(([fileId]) => fileId !== id)
          )
        },
        notes: safePrev.notes || {},
        activities: safePrev.activities || {}
      };
    });
  };
  
  const addNote = () => {
    if (!newNote.trim() || !selectedLeadId) return;
    
    const note = {
      id: Date.now().toString(),
      content: newNote,
      createdAt: new Date().toISOString()
    };
    
    setAllLeadData(prev => {
      const safePrev = prev && typeof prev === 'object' ? prev : { documents: {}, files: {}, notes: {}, activities: {} };
      return {
        documents: safePrev.documents || {},
        files: safePrev.files || {},
        notes: {
          ...(safePrev.notes || {}),
          [selectedLeadId]: [note, ...((safePrev.notes || {})[selectedLeadId] || [])]
        },
        activities: safePrev.activities || {}
      };
    });
    setNewNote('');
  };
  
  const deleteNote = (id) => {
    if (!selectedLeadId) return;
    
    setAllLeadData(prev => {
      const safePrev = prev && typeof prev === 'object' ? prev : { documents: {}, files: {}, notes: {}, activities: {} };
      return {
        documents: safePrev.documents || {},
        files: safePrev.files || {},
        notes: {
          ...(safePrev.notes || {}),
          [selectedLeadId]: ((safePrev.notes || {})[selectedLeadId] || []).filter(n => n.id !== id)
        },
        activities: safePrev.activities || {}
      };
    });
  };
  
  // Global activities storage for the Activity Logger widget
  // Must match Activity Logger's expected structure: { activities: [] }
  const [globalActivities, setGlobalActivities] = useGlobalStorage('crm-activities', { activities: [] });
  
  const addActivity = () => {
    if (!selectedLeadId || !lead) return;
    
    const now = new Date();
    const activity = {
      id: Date.now().toString(),
      type: newActivity.type,
      contact: `${lead.name} - ${lead.company}`, // Format for Activity Logger
      date: newActivity.date || now.toISOString().split('T')[0],
      time: now.toTimeString().slice(0, 5), // HH:MM format
      duration: null,
      description: newActivity.description,
      outcome: '', // Can be added later
      tags: [], // Can be added later
      createdAt: now.toISOString(),
      // Add lead context for filtering/reference
      leadId: selectedLeadId,
      leadName: lead.name,
      leadCompany: lead.company
    };
    
    // Save to per-lead storage (for this widget)
    setAllLeadData(prev => {
      const safePrev = prev && typeof prev === 'object' ? prev : { documents: {}, files: {}, notes: {}, activities: {} };
      return {
        documents: safePrev.documents || {},
        files: safePrev.files || {},
        notes: safePrev.notes || {},
        activities: {
          ...(safePrev.activities || {}),
          [selectedLeadId]: [activity, ...((safePrev.activities || {})[selectedLeadId] || [])]
        }
      };
    });
    
    // ALSO save to global activities storage (for Activity Logger widget)
    setGlobalActivities({
      activities: [activity, ...(globalActivities.activities || [])]
    });
    console.log('Activity added to global storage:', activity);
    
    setNewActivity({ type: '', description: '', date: '' });
    setShowAddActivity(false);
  };
  
  const deleteActivity = (id) => {
    if (!selectedLeadId) return;
    
    // Remove from per-lead storage
    setAllLeadData(prev => {
      const safePrev = prev && typeof prev === 'object' ? prev : { documents: {}, files: {}, notes: {}, activities: {} };
      return {
        documents: safePrev.documents || {},
        files: safePrev.files || {},
        notes: safePrev.notes || {},
        activities: {
          ...(safePrev.activities || {}),
          [selectedLeadId]: ((safePrev.activities || {})[selectedLeadId] || []).filter(a => a.id !== id)
        }
      };
    });
    
    // ALSO remove from global activities storage
    setGlobalActivities({
      activities: (globalActivities.activities || []).filter(a => a.id !== id)
    });
    console.log('Activity deleted from global storage:', id);
  };
  
  const getPriorityColor = (priority) => {
    switch (priority) {
      case 'high': return { bg: '#fef2f2', text: '#dc2626', border: '#fca5a5' };
      case 'medium': return { bg: '#fef3c7', text: '#d97706', border: '#fcd34d' };
      case 'low': return { bg: '#f0fdf4', text: '#16a34a', border: '#86efac' };
      default: return { bg: '#f3f4f6', text: '#6b7280', border: '#d1d5db' };
    }
  };
  
  const getStageColor = (stage) => {
    const colors = {
      'new': '#6b7280',
      'contacted': '#3b82f6',
      'qualified': '#8b5cf6',
      'proposal': '#f59e0b',
      'negotiation': '#ef4444',
      'closed-won': '#10b981',
      'closed-lost': '#6b7280'
    };
    return colors[stage] || '#6b7280';
  };
  
  if (!selectedLeadId || !lead) {
    return (
      <div style={{
        height: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
        color: '#64748b',
        background: '#f8fafc'
      }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: '64px', marginBottom: '16px' }}>👤</div>
          <div style={{ fontSize: '20px', fontWeight: '600', marginBottom: '8px', color: '#1e293b' }}>
            No Lead Selected
          </div>
          <div style={{ fontSize: '14px', color: '#64748b' }}>
            Click on a lead in the pipeline to view details
          </div>
        </div>
      </div>
    );
  }
  
  return (
    <div style={{
      height: '100vh',
      display: 'flex',
      flexDirection: 'column',
      background: 'white',
      fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif'
    }}>
      <style>{`
        * { margin: 0; padding: 0; box-sizing: border-box; }
        .btn { 
          padding: 8px 16px;
          border-radius: 6px;
          border: none;
          cursor: pointer;
          font-size: 14px;
          font-weight: 500;
          transition: all 0.2s;
        }
        .btn-primary { background: #3b82f6; color: white; }
        .btn-primary:hover { background: #2563eb; }
        .btn-secondary { background: #f3f4f6; color: #374151; border: 1px solid #d1d5db; }
        .btn-secondary:hover { background: #e5e7eb; }
        .btn-danger { background: #ef4444; color: white; }
        .btn-danger:hover { background: #dc2626; }
        .btn-small { padding: 4px 8px; font-size: 12px; }
        .form-input {
          width: 100%;
          padding: 8px 12px;
          border: 1px solid #d1d5db;
          border-radius: 6px;
          font-size: 14px;
          font-family: inherit;
        }
        .form-input:focus {
          outline: none;
          border-color: #3b82f6;
          box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.1);
        }
        .tab {
          padding: 12px 24px;
          border: none;
          background: transparent;
          cursor: pointer;
          font-size: 14px;
          font-weight: 500;
          color: #64748b;
          border-bottom: 2px solid transparent;
          transition: all 0.2s;
        }
        .tab:hover { color: #3b82f6; }
        .tab.active {
          color: #3b82f6;
          border-bottom-color: #3b82f6;
        }
        .card {
          background: white;
          border: 1px solid #e2e8f0;
          border-radius: 8px;
          padding: 16px;
          margin-bottom: 16px;
        }
        .card-title {
          fontSize: '16px';
          fontWeight: '600';
          color: '#1e293b';
          marginBottom: '12px';
        }
        .modal-overlay {
          position: fixed;
          top: 0;
          left: 0;
          right: 0;
          bottom: 0;
          background: rgba(0, 0, 0, 0.5);
          display: flex;
          align-items: center;
          justify-content: center;
          z-index: 1000;
        }
        .modal-content {
          background: white;
          border-radius: 8px;
          padding: 24px;
          max-width: 500px;
          width: 90%;
          max-height: 80vh;
          overflow-y: auto;
        }
      `}</style>
      
      {/* Header */}
      <div style={{
        padding: '20px 24px',
        borderBottom: '1px solid #e2e8f0',
        background: '#f8fafc'
      }}>
        {/* Lead Selector */}
        <div style={{ marginBottom: '16px' }}>
          <select 
            value={selectedLeadId || ''}
            onChange={(e) => handleSelectLead(e.target.value)}
            style={{
              width: '100%',
              padding: '8px 12px',
              fontSize: '14px',
              border: '1px solid #d1d5db',
              borderRadius: '6px',
              background: 'white',
              cursor: 'pointer'
            }}
          >
            <option value="">Select a lead to view...</option>
            {leads.map(l => (
              <option key={l.id} value={l.id}>
                {l.name} - {l.company} ({l.stage})
              </option>
            ))}
          </select>
        </div>
        
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div style={{ fontSize: '32px' }}>👤</div>
            <div>
              <h1 style={{ fontSize: '24px', fontWeight: '700', color: '#1e293b', marginBottom: '4px' }}>
                {lead.name}
              </h1>
              <div style={{ fontSize: '14px', color: '#64748b' }}>
                {lead.company} • {lead.email}
              </div>
            </div>
          </div>
          <div style={{ display: 'flex', gap: '8px' }}>
            {!isEditing && (
              <>
                <button className="btn btn-secondary" onClick={() => setIsEditing(true)}>
                  ✏️ Edit
                </button>
              </>
            )}
            {isEditing && (
              <>
                <button className="btn btn-secondary" onClick={() => setIsEditing(false)}>
                  Cancel
                </button>
                <button className="btn btn-primary" onClick={handleSaveEdit}>
                  💾 Save
                </button>
              </>
            )}
          </div>
        </div>
        
        {/* Quick Info Badges */}
        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
          <span style={{
            padding: '4px 12px',
            borderRadius: '16px',
            fontSize: '12px',
            fontWeight: '600',
            background: getStageColor(lead.stage),
            color: 'white'
          }}>
            {lead.stage}
          </span>
          <span style={{
            padding: '4px 12px',
            borderRadius: '16px',
            fontSize: '12px',
            fontWeight: '600',
            ...getPriorityColor(lead.priority)
          }}>
            {lead.priority} priority
          </span>
          <span style={{
            padding: '4px 12px',
            borderRadius: '16px',
            fontSize: '12px',
            fontWeight: '600',
            background: '#f0fdf4',
            color: '#16a34a',
            border: '1px solid #86efac'
          }}>
            ${(lead.value || 0).toLocaleString()}
          </span>
        </div>
      </div>
      
      {/* Tabs */}
      <div style={{ borderBottom: '1px solid #e2e8f0', background: 'white' }}>
        <div style={{ display: 'flex', gap: '0' }}>
          <button 
            className={`tab ${activeTab === 'overview' ? 'active' : ''}`}
            onClick={() => setActiveTab('overview')}
          >
            📊 Overview
          </button>
          <button 
            className={`tab ${activeTab === 'documents' ? 'active' : ''}`}
            onClick={() => setActiveTab('documents')}
          >
            📁 Documents ({documents.length})
          </button>
          <button 
            className={`tab ${activeTab === 'notes' ? 'active' : ''}`}
            onClick={() => setActiveTab('notes')}
          >
            📝 Notes ({notes.length})
          </button>
          <button 
            className={`tab ${activeTab === 'activities' ? 'active' : ''}`}
            onClick={() => setActiveTab('activities')}
          >
            🔔 Activities ({activities.length})
          </button>
        </div>
      </div>

      {/* Delete Lead Modal removed */}
      
      {/* Content */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '24px' }}>
        {/* Overview Tab */}
        {activeTab === 'overview' && (
          <div>
            {isEditing ? (
              <div className="card">
                <h3 style={{ fontSize: '16px', fontWeight: '600', marginBottom: '16px' }}>Edit Lead Information</h3>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                  <div>
                    <label style={{ display: 'block', marginBottom: '4px', fontSize: '14px', fontWeight: '500' }}>Name</label>
                    <input
                      type="text"
                      className="form-input"
                      value={editForm.name || ''}
                      onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
                    />
                  </div>
                  <div>
                    <label style={{ display: 'block', marginBottom: '4px', fontSize: '14px', fontWeight: '500' }}>Company</label>
                    <input
                      type="text"
                      className="form-input"
                      value={editForm.company || ''}
                      onChange={(e) => setEditForm({ ...editForm, company: e.target.value })}
                    />
                  </div>
                  <div>
                    <label style={{ display: 'block', marginBottom: '4px', fontSize: '14px', fontWeight: '500' }}>Email</label>
                    <input
                      type="email"
                      className="form-input"
                      value={editForm.email || ''}
                      onChange={(e) => setEditForm({ ...editForm, email: e.target.value })}
                    />
                  </div>
                  <div>
                    <label style={{ display: 'block', marginBottom: '4px', fontSize: '14px', fontWeight: '500' }}>Phone</label>
                    <input
                      type="tel"
                      className="form-input"
                      value={editForm.phone || ''}
                      onChange={(e) => setEditForm({ ...editForm, phone: e.target.value })}
                    />
                  </div>
                  <div>
                    <label style={{ display: 'block', marginBottom: '4px', fontSize: '14px', fontWeight: '500' }}>Deal Value</label>
                    <input
                      type="number"
                      className="form-input"
                      value={editForm.value || ''}
                      onChange={(e) => setEditForm({ ...editForm, value: parseFloat(e.target.value) || 0 })}
                    />
                  </div>
                  <div>
                    <label style={{ display: 'block', marginBottom: '4px', fontSize: '14px', fontWeight: '500' }}>Close Date</label>
                    <input
                      type="date"
                      className="form-input"
                      value={editForm.closeDate || ''}
                      onChange={(e) => setEditForm({ ...editForm, closeDate: e.target.value })}
                    />
                  </div>
                  <div>
                    <label style={{ display: 'block', marginBottom: '4px', fontSize: '14px', fontWeight: '500' }}>Notes</label>
                    <textarea
                      className="form-input"
                      rows={3}
                      value={editForm.notes || ''}
                      onChange={(e) => setEditForm({ ...editForm, notes: e.target.value })}
                    />
                  </div>
                </div>
              </div>
            ) : (
              <>
                <div className="card">
                  <h3 style={{ fontSize: '16px', fontWeight: '600', marginBottom: '16px' }}>Contact Information</h3>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                    <div>
                      <div style={{ fontSize: '12px', color: '#64748b', marginBottom: '4px' }}>Email</div>
                      <div style={{ fontSize: '14px', fontWeight: '500' }}>{lead.email}</div>
                    </div>
                    <div>
                      <div style={{ fontSize: '12px', color: '#64748b', marginBottom: '4px' }}>Phone</div>
                      <div style={{ fontSize: '14px', fontWeight: '500' }}>{lead.phone}</div>
                    </div>
                    <div>
                      <div style={{ fontSize: '12px', color: '#64748b', marginBottom: '4px' }}>Company</div>
                      <div style={{ fontSize: '14px', fontWeight: '500' }}>{lead.company}</div>
                    </div>
                    <div>
                      <div style={{ fontSize: '12px', color: '#64748b', marginBottom: '4px' }}>Deal Value</div>
                      <div style={{ fontSize: '14px', fontWeight: '500', color: '#059669' }}>
                        ${(lead.value || 0).toLocaleString()}
                      </div>
                    </div>
                    <div>
                      <div style={{ fontSize: '12px', color: '#64748b', marginBottom: '4px' }}>Expected Close</div>
                      <div style={{ fontSize: '14px', fontWeight: '500' }}>
                        {new Date(lead.closeDate).toLocaleDateString()}
                      </div>
                    </div>
                    <div>
                      <div style={{ fontSize: '12px', color: '#64748b', marginBottom: '4px' }}>Created</div>
                      <div style={{ fontSize: '14px', fontWeight: '500' }}>
                        {new Date(lead.createdAt).toLocaleDateString()}
                      </div>
                    </div>
                  </div>
                </div>
                
                {lead.notes && (
                  <div className="card">
                    <h3 style={{ fontSize: '16px', fontWeight: '600', marginBottom: '12px' }}>Lead Notes</h3>
                    <div style={{ fontSize: '14px', color: '#475569', lineHeight: '1.6' }}>
                      {lead.notes}
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
        )}
        
        {/* Documents Tab */}
        {activeTab === 'documents' && (
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
              <h3 style={{ fontSize: '18px', fontWeight: '600' }}>Documents</h3>
              <button className="btn btn-primary" onClick={() => setShowAddDocument(true)}>
                ➕ Add Document
              </button>
            </div>
            
            {documents.length === 0 ? (
              <div style={{
                textAlign: 'center',
                padding: '48px',
                color: '#64748b'
              }}>
                <div style={{ fontSize: '48px', marginBottom: '16px' }}>📄</div>
                <div style={{ fontSize: '16px', fontWeight: '500', marginBottom: '8px' }}>No documents yet</div>
                <div style={{ fontSize: '14px' }}>Add documents, contracts, or files related to this lead</div>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                {documents.map(doc => (
                  <div key={doc.id} className="card" style={{ padding: '16px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start' }}>
                      <div style={{ flex: 1 }}>
                        <div style={{ fontSize: '16px', fontWeight: '600', marginBottom: '4px' }}>
                          📎 {doc.name}
                        </div>
                        <div style={{ fontSize: '12px', color: '#64748b', marginBottom: '8px' }}>
                          Type: {doc.type} • Added {new Date(doc.addedAt).toLocaleDateString()}
                          {doc.isUploaded && <span style={{ color: '#10b981', fontWeight: '600' }}> • 📁 Uploaded</span>}
                        </div>
                        {doc.notes && (
                          <div style={{ fontSize: '14px', color: '#475569' }}>{doc.notes}</div>
                        )}
                        <button 
                          onClick={() => downloadDocument(doc)}
                          style={{ 
                            fontSize: '14px', 
                            color: '#3b82f6', 
                            textDecoration: 'none',
                            background: 'none',
                            border: 'none',
                            cursor: 'pointer',
                            padding: '0'
                          }}
                        >
                          📥 Download →
                        </button>
                      </div>
                      <button 
                        className="btn btn-danger btn-small"
                        onClick={() => deleteDocument(doc.id)}
                      >
                        🗑️
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
            
            {/* Add Document Modal */}
            {showAddDocument && (
              <div className="modal-overlay">
                <div className="modal-content">
                  <h3 style={{ fontSize: '18px', fontWeight: '600', marginBottom: '16px' }}>Add Document</h3>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                    <div>
                      <label style={{ display: 'block', marginBottom: '4px', fontSize: '14px', fontWeight: '500' }}>
                        Document Name
                        {tempUploadedFiles.length > 0 && (
                          <span style={{ fontSize: '12px', color: '#64748b', fontWeight: 'normal' }}>
                            {' '}(will override uploaded file names)
                          </span>
                        )}
                      </label>
                      <input
                        type="text"
                        className="form-input"
                        value={newDocument.name}
                        onChange={(e) => setNewDocument({ ...newDocument, name: e.target.value })}
                        placeholder={tempUploadedFiles.length > 0 ? "Custom name for uploaded files" : "e.g., Proposal, Contract, Invoice"}
                      />
                    </div>
                    <div>
                      <label style={{ display: 'block', marginBottom: '4px', fontSize: '14px', fontWeight: '500' }}>
                        Type
                      </label>
                      <select
                        className="form-input"
                        value={newDocument.type}
                        onChange={(e) => setNewDocument({ ...newDocument, type: e.target.value })}
                      >
                        <option value="">Select type...</option>
                        <option value="Proposal">Proposal</option>
                        <option value="Contract">Contract</option>
                        <option value="Invoice">Invoice</option>
                        <option value="Presentation">Presentation</option>
                        <option value="Report">Report</option>
                        <option value="Other">Other</option>
                      </select>
                    </div>
                    <div>
                      <label style={{ display: 'block', marginBottom: '4px', fontSize: '14px', fontWeight: '500' }}>
                        URL (optional)
                      </label>
                      <input
                        type="url"
                        className="form-input"
                        value={newDocument.url}
                        onChange={(e) => setNewDocument({ ...newDocument, url: e.target.value })}
                        placeholder="https://..."
                      />
                    </div>
                    <div>
                      <label style={{ display: 'block', marginBottom: '4px', fontSize: '14px', fontWeight: '500' }}>
                        Notes (optional)
                      </label>
                      <textarea
                        className="form-input"
                        rows={3}
                        value={newDocument.notes}
                        onChange={(e) => setNewDocument({ ...newDocument, notes: e.target.value })}
                        placeholder="Additional details..."
                      />
                    </div>
                    
                    {/* File Upload Section */}
                    <div style={{ borderTop: '1px solid #e2e8f0', paddingTop: '16px', marginTop: '16px' }}>
                      <label style={{ display: 'block', marginBottom: '8px', fontSize: '14px', fontWeight: '500' }}>
                        Or Upload Files
                      </label>
                      <input
                        type="file"
                        id="file-upload-modal"
                        multiple
                        onChange={handleFileUpload}
                        style={{ display: 'none' }}
                        accept="*/*"
                      />
                      <label htmlFor="file-upload-modal" className="btn btn-secondary" style={{ cursor: 'pointer', display: 'inline-block' }}>
                        📁 Choose Files
                      </label>
                      <span style={{ fontSize: '12px', color: '#64748b', marginLeft: '8px' }}>
                        Select multiple files to upload
                      </span>
                    </div>
                    
                    {/* Show selected files */}
                    {tempUploadedFiles.length > 0 && (
                      <div style={{ borderTop: '1px solid #e2e8f0', paddingTop: '12px', marginTop: '12px' }}>
                        <div style={{ fontSize: '12px', color: '#64748b', marginBottom: '8px' }}>
                          Selected files ({tempUploadedFiles.length}):
                        </div>
                        {tempUploadedFiles.map(file => (
                          <div key={file.id} style={{ 
                            fontSize: '12px', 
                            color: '#475569',
                            marginBottom: '4px',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '8px'
                          }}>
                            📄 {file.name} ({(file.size / 1024).toFixed(1)} KB)
                            <button
                              onClick={() => setTempUploadedFiles(prev => prev.filter(f => f.id !== file.id))}
                              style={{ 
                                background: '#ef4444', 
                                color: 'white', 
                                border: 'none', 
                                borderRadius: '3px', 
                                padding: '2px 6px',
                                fontSize: '10px',
                                cursor: 'pointer'
                              }}
                            >
                              ✕
                            </button>
                          </div>
                        ))}
                      </div>
                    )}
                    
                    <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end', marginTop: '16px' }}>
                      <button 
                        className="btn btn-secondary" 
                        onClick={() => {
                          setShowAddDocument(false);
                          setNewDocument({ name: '', type: '', url: '', notes: '' });
                          setTempUploadedFiles([]);
                        }}
                      >
                        Cancel
                      </button>
                      <button 
                        className="btn btn-primary" 
                        onClick={addDocument}
                        disabled={tempUploadedFiles.length === 0 && (!newDocument.name || !newDocument.type)}
                      >
                        {tempUploadedFiles.length > 0 ? `Add ${tempUploadedFiles.length} File(s)` : 'Add Document'}
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}
        
        {/* Notes Tab */}
        {activeTab === 'notes' && (
          <div>
            <div style={{ marginBottom: '16px' }}>
              <div style={{ display: 'flex', gap: '8px' }}>
                <textarea
                  className="form-input"
                  rows={3}
                  value={newNote}
                  onChange={(e) => setNewNote(e.target.value)}
                  placeholder="Add a new note..."
                  style={{ flex: 1 }}
                />
                <button 
                  className="btn btn-primary" 
                  onClick={addNote}
                  disabled={!newNote.trim()}
                >
                  ➕ Add
                </button>
              </div>
            </div>
            
            {notes.length === 0 ? (
              <div style={{
                textAlign: 'center',
                padding: '48px',
                color: '#64748b'
              }}>
                <div style={{ fontSize: '48px', marginBottom: '16px' }}>📝</div>
                <div style={{ fontSize: '16px', fontWeight: '500', marginBottom: '8px' }}>No notes yet</div>
                <div style={{ fontSize: '14px' }}>Add notes to keep track of conversations and updates</div>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                {notes.map(note => (
                  <div key={note.id} className="card">
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start' }}>
                      <div style={{ flex: 1 }}>
                        <div style={{ fontSize: '14px', color: '#475569', marginBottom: '8px', whiteSpace: 'pre-wrap' }}>
                          {note.content}
                        </div>
                        <div style={{ fontSize: '12px', color: '#64748b' }}>
                          {new Date(note.createdAt).toLocaleString()}
                        </div>
                      </div>
                      <button 
                        className="btn btn-danger btn-small"
                        onClick={() => deleteNote(note.id)}
                      >
                        🗑️
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
        
        {/* Activities Tab */}
        {activeTab === 'activities' && (
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
              <h3 style={{ fontSize: '18px', fontWeight: '600' }}>Activities & Events</h3>
              <button className="btn btn-primary" onClick={() => setShowAddActivity(true)}>
                ➕ Log Activity
              </button>
            </div>
            
            {activities.length === 0 ? (
              <div style={{
                textAlign: 'center',
                padding: '48px',
                color: '#64748b'
              }}>
                <div style={{ fontSize: '48px', marginBottom: '16px' }}>🔔</div>
                <div style={{ fontSize: '16px', fontWeight: '500', marginBottom: '8px' }}>No activities logged</div>
                <div style={{ fontSize: '14px' }}>Track calls, meetings, emails, and other interactions</div>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                {activities.map(activity => (
                  <div key={activity.id} className="card">
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start' }}>
                      <div style={{ flex: 1 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
                          <span style={{
                            padding: '2px 8px',
                            borderRadius: '12px',
                            fontSize: '11px',
                            fontWeight: '600',
                            background: '#eff6ff',
                            color: '#1d4ed8'
                          }}>
                            {activity.type}
                          </span>
                          <span style={{ fontSize: '12px', color: '#64748b' }}>
                            {activity.date ? new Date(activity.date).toLocaleDateString() : new Date(activity.createdAt).toLocaleDateString()}
                          </span>
                        </div>
                        <div style={{ fontSize: '14px', color: '#475569' }}>
                          {activity.description}
                        </div>
                      </div>
                      <button 
                        className="btn btn-danger btn-small"
                        onClick={() => deleteActivity(activity.id)}
                      >
                        🗑️
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
            
            {/* Add Activity Modal */}
            {showAddActivity && (
              <div className="modal-overlay">
                <div className="modal-content">
                  <h3 style={{ fontSize: '18px', fontWeight: '600', marginBottom: '16px' }}>Log Activity</h3>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                    <div>
                      <label style={{ display: 'block', marginBottom: '4px', fontSize: '14px', fontWeight: '500' }}>
                        Activity Type
                      </label>
                      <select
                        className="form-input"
                        value={newActivity.type}
                        onChange={(e) => setNewActivity({ ...newActivity, type: e.target.value })}
                      >
                        <option value="">Select type...</option>
                        <option value="Call">📞 Call</option>
                        <option value="Meeting">🤝 Meeting</option>
                        <option value="Email">📧 Email</option>
                        <option value="Demo">🎯 Demo</option>
                        <option value="Follow-up">🔄 Follow-up</option>
                        <option value="Other">📋 Other</option>
                      </select>
                    </div>
                    <div>
                      <label style={{ display: 'block', marginBottom: '4px', fontSize: '14px', fontWeight: '500' }}>
                        Date
                      </label>
                      <input
                        type="date"
                        className="form-input"
                        value={newActivity.date}
                        onChange={(e) => setNewActivity({ ...newActivity, date: e.target.value })}
                      />
                    </div>
                    <div>
                      <label style={{ display: 'block', marginBottom: '4px', fontSize: '14px', fontWeight: '500' }}>
                        Description
                      </label>
                      <textarea
                        className="form-input"
                        rows={4}
                        value={newActivity.description}
                        onChange={(e) => setNewActivity({ ...newActivity, description: e.target.value })}
                        placeholder="What happened during this activity?"
                      />
                    </div>
                    <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end', marginTop: '8px' }}>
                      <button className="btn btn-secondary" onClick={() => setShowAddActivity(false)}>
                        Cancel
                      </button>
                      <button 
                        className="btn btn-primary" 
                        onClick={addActivity}
                        disabled={!newActivity.type || !newActivity.description}
                      >
                        Log Activity
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

export default LeadDetailWidget;

