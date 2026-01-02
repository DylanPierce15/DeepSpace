import React, { useState, useMemo } from 'react';

function LeadPipelineWidget() {
  console.log('Lead Pipeline Widget rendering...');
  console.log('useGlobalStorage available:', typeof useGlobalStorage);
  
  // Global storage for leads (canvas-wide, single source of truth)
  const [leadData, setLeadData] = useGlobalStorage('crm-leads', { leads: [] });

  // Global storage for selected lead (shared with detail viewer)
  const [selectedLeadId, setSelectedLeadId] = useGlobalStorage('selected-lead-id', '');
  
  console.log('Pipeline - Lead Data:', leadData);
  console.log('Pipeline - Selected Lead ID:', selectedLeadId);

  // Global storage for columns (editable pipeline stages)
  const [columns, setColumns] = useGlobalStorage('crm-pipeline-columns', [
    { id: 'new', name: 'New Leads', color: '#6b7280' },
    { id: 'contacted', name: 'Contacted', color: '#3b82f6' },
    { id: 'qualified', name: 'Qualified', color: '#8b5cf6' },
    { id: 'proposal', name: 'Proposal', color: '#f59e0b' },
    { id: 'negotiation', name: 'Negotiation', color: '#ef4444' },
    { id: 'closed-won', name: 'Closed Won', color: '#10b981' },
    { id: 'closed-lost', name: 'Closed Lost', color: '#6b7280' }
  ]);

  // Local state
  const [showModal, setShowModal] = useState(false);
  const [editingLead, setEditingLead] = useState(null);
  const [currentStage, setCurrentStage] = useState('new');
  const [draggedLead, setDraggedLead] = useState(null);
  const [editingColumnId, setEditingColumnId] = useState(null);
  const [editingColumnName, setEditingColumnName] = useState('');
  const [formData, setFormData] = useState({
    name: '',
    company: '',
    email: '',
    phone: '',
    value: '',
    priority: 'medium',
    closeDate: '',
    notes: ''
  });
  const [showDeleteLeadModal, setShowDeleteLeadModal] = useState(false);
  const [leadToDelete, setLeadToDelete] = useState(null);
  const [showDeleteColumnModal, setShowDeleteColumnModal] = useState(false);
  const [columnToDelete, setColumnToDelete] = useState(null);
  const [globalActivities, setGlobalActivities] = useGlobalStorage('crm-activities', { activities: [] });

  // Calculate stats
  const stats = useMemo(() => {
    const totalLeads = leadData.leads.length;
    const totalValue = leadData.leads.reduce((sum, lead) => sum + (lead.value || 0), 0);
    const wonLeads = leadData.leads.filter(l => l.stage === 'closed-won').length;
    const conversionRate = totalLeads > 0 ? Math.round((wonLeads / totalLeads) * 100) : 0;
    const avgDealSize = totalLeads > 0 ? totalValue / totalLeads : 0;
    
    return { totalLeads, totalValue, conversionRate, avgDealSize };
  }, [leadData.leads]);

  // Get leads by stage
  const getLeadsByStage = (stageId) => {
    return leadData.leads.filter(lead => lead.stage === stageId);
  };

  const handleAddLead = (stageId) => {
    setEditingLead(null);
    setCurrentStage(stageId);
    setFormData({
      name: '',
      company: '',
      email: '',
      phone: '',
      value: '',
      priority: 'medium',
      closeDate: '',
      notes: ''
    });
    setShowModal(true);
  };

  const handleEditLead = (lead) => {
    setEditingLead(lead);
    setFormData(lead);
    setShowModal(true);
  };
  
  const handleSelectLead = (lead) => {
    // Set the selected lead ID in global storage for the detail viewer
    console.log('Selecting lead:', lead);
    setSelectedLeadId(lead.id);
    console.log('Set selected lead ID to:', lead.id);
  };

  const handleSaveLead = (e) => {
    e.preventDefault();
    
    const leadFormData = {
      ...formData,
      value: parseFloat(formData.value) || 0
    };
    
    if (editingLead) {
      // Update existing lead
      const updated = {
        ...leadData,
        leads: leadData.leads.map(l => 
          l.id === editingLead.id ? { ...l, ...leadFormData } : l
        )
      };
      setLeadData(updated);
    } else {
      // Add new lead
      const newLead = {
        id: Date.now().toString(),
        ...leadFormData,
        stage: currentStage,
        createdAt: new Date().toISOString()
      };
      const updated = {
        ...leadData,
        leads: [...leadData.leads, newLead]
      };
      setLeadData(updated);
    }
    
    setShowModal(false);
  };

  const handleDragStart = (lead) => {
    setDraggedLead(lead);
  };

  const handleDragEnd = () => {
    setDraggedLead(null);
  };

  const handleDrop = (stageId) => {
    if (!draggedLead) return;
    
    const updated = {
      ...leadData,
      leads: leadData.leads.map(l => 
        l.id === draggedLead.id ? { ...l, stage: stageId } : l
      )
    };
    setLeadData(updated);
  };

  const getPriorityColor = (priority) => {
    switch (priority) {
      case 'high': return { bg: '#fef2f2', text: '#dc2626' };
      case 'medium': return { bg: '#fef3c7', text: '#d97706' };
      case 'low': return { bg: '#f0fdf4', text: '#16a34a' };
      default: return { bg: '#f3f4f6', text: '#6b7280' };
    }
  };

  // Column management functions
  const handleAddColumn = () => {
    const newColumn = {
      id: `stage-${Date.now()}`,
      name: 'New Stage',
      color: '#64748b'
    };
    setColumns([...columns, newColumn]);
  };

  const handleRemoveColumn = (columnId) => {
    if (columns.length <= 1) return;
    setColumnToDelete(columnId);
    setShowDeleteColumnModal(true);
  };

  const confirmRemoveColumn = () => {
    if (!columnToDelete) return;
    const leadsInColumn = leadData.leads.filter(lead => lead.stage === columnToDelete);
    if (leadsInColumn.length > 0) {
      const targetColumnId = columns.find(c => c.id !== columnToDelete)?.id;
      const updatedLeads = leadData.leads.map(lead => 
        lead.stage === columnToDelete ? { ...lead, stage: targetColumnId } : lead
      );
      setLeadData({ ...leadData, leads: updatedLeads });
    }
    setColumns(columns.filter(col => col.id !== columnToDelete));
    setShowDeleteColumnModal(false);
    setColumnToDelete(null);
  };

  const handleStartEditColumn = (columnId, currentName) => {
    setEditingColumnId(columnId);
    setEditingColumnName(currentName);
  };

  const handleSaveColumnName = (columnId) => {
    if (editingColumnName.trim()) {
      setColumns(columns.map(col => 
        col.id === columnId ? { ...col, name: editingColumnName.trim() } : col
      ));
    }
    setEditingColumnId(null);
    setEditingColumnName('');
  };

  const handleCancelEditColumn = () => {
    setEditingColumnId(null);
    setEditingColumnName('');
  };

  const handleChangeColumnColor = (columnId, color) => {
    setColumns(columns.map(col => 
      col.id === columnId ? { ...col, color } : col
    ));
  };

  const handleRequestDeleteLead = (lead) => {
    setLeadToDelete(lead);
    setShowDeleteLeadModal(true);
  };

  const confirmDeleteLead = () => {
    if (!leadToDelete) return;
    const updated = {
      ...leadData,
      leads: leadData.leads.filter(l => l.id !== leadToDelete.id)
    };
    setLeadData(updated);
    if (selectedLeadId === leadToDelete.id) {
      setSelectedLeadId('');
    }

    // Purge per-lead data from localStorage bucket used by the detail widget (same shape as Lead Detail viewer)
    try {
      const raw = localStorage.getItem('crm-lead-data');
      if (raw) {
        const parsed = JSON.parse(raw);
        const safePrev = parsed && typeof parsed === 'object' ? parsed : { documents: {}, files: {}, notes: {}, activities: {} };
        const updated = {
          documents: { ...(safePrev.documents || {}) },
          files: { ...(safePrev.files || {}) },
          notes: { ...(safePrev.notes || {}) },
          activities: { ...(safePrev.activities || {}) }
        };
        delete updated.documents[leadToDelete.id];
        delete updated.files[leadToDelete.id];
        delete updated.notes[leadToDelete.id];
        delete updated.activities[leadToDelete.id];
        localStorage.setItem('crm-lead-data', JSON.stringify(updated));
      }
    } catch (e) {
      console.error('Failed to purge per-lead storage', e);
    }

    // Remove global activities referencing this lead
    try {
      const activities = (globalActivities && globalActivities.activities) || [];
      const contactSignature = `${leadToDelete.name} - ${leadToDelete.company}`;
      const sig = (contactSignature || '').trim().toLowerCase();
      setGlobalActivities({ 
        activities: activities.filter(a => {
          // Remove if explicitly linked by leadId
          if (a && a.leadId && a.leadId === leadToDelete.id) return false;
          
          // Remove if has leadName/leadCompany matching this lead (from lead detail viewer)
          if (a && a.leadName === leadToDelete.name && a.leadCompany === leadToDelete.company) return false;
          
          // Remove if older entry without leadId matches contact string
          const contact = (a && a.contact ? String(a.contact) : '').trim().toLowerCase();
          if (!a?.leadId && sig && contact === sig) return false;
          
          return true;
        })
      });
    } catch (e) {
      console.error('Failed to update global activities', e);
    }

    setShowDeleteLeadModal(false);
    setLeadToDelete(null);
  };

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
        .lead-card { 
          transition: all 0.2s ease; 
          cursor: grab;
        }
        .lead-card:hover { 
          transform: translateY(-2px); 
          box-shadow: 0 4px 8px rgba(0,0,0,0.15);
        }
        .lead-card:active {
          transform: scale(0.98);
        }
        .lead-card.dragging { 
          opacity: 0.5; 
          transform: rotate(5deg); 
        }
        .drop-zone { 
          min-height: 100px; 
          border: 2px dashed transparent; 
          border-radius: 8px; 
          transition: all 0.2s; 
        }
        .drop-zone.drag-over { 
          border-color: #3b82f6; 
          background: #eff6ff; 
        }
        .btn-primary { 
          background: #3b82f6; 
          color: white; 
          border: none; 
          padding: 8px 16px; 
          border-radius: 6px; 
          cursor: pointer; 
          font-weight: 500;
        }
        .btn-primary:hover { background: #2563eb; }
        .btn-secondary { 
          background: #f3f4f6; 
          color: #374151; 
          border: 1px solid #d1d5db; 
          padding: 8px 16px; 
          border-radius: 6px; 
          cursor: pointer; 
          font-weight: 500;
        }
        .btn-secondary:hover { background: #e5e7eb; }
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
          box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.1);
        }
      `}</style>
      
      {/* Header */}
      <div style={{
        padding: '16px',
        borderBottom: '1px solid #e2e8f0',
        background: '#f8fafc'
      }}>
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: '12px'
        }}>
          <h2 style={{
            fontSize: '18px',
            fontWeight: '600',
            color: '#1e293b',
            margin: 0
          }}>🔄 Lead Pipeline</h2>
        </div>
        
        {/* Stats */}
        <div style={{ display: 'flex', gap: '24px' }}>
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: '20px', fontWeight: '700', color: '#1e293b' }}>{stats.totalLeads}</div>
            <div style={{ fontSize: '12px', color: '#64748b' }}>Total Leads</div>
          </div>
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: '20px', fontWeight: '700', color: '#1e293b' }}>${stats.totalValue.toLocaleString()}</div>
            <div style={{ fontSize: '12px', color: '#64748b' }}>Pipeline Value</div>
          </div>
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: '20px', fontWeight: '700', color: '#1e293b' }}>{stats.conversionRate}%</div>
            <div style={{ fontSize: '12px', color: '#64748b' }}>Conversion Rate</div>
          </div>
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: '20px', fontWeight: '700', color: '#1e293b' }}>${Math.round(stats.avgDealSize).toLocaleString()}</div>
            <div style={{ fontSize: '12px', color: '#64748b' }}>Avg Deal Size</div>
          </div>
        </div>
      </div>
      
      {/* Pipeline */}
      <div style={{
        flex: 1,
        overflowX: 'auto',
        padding: '16px',
        background: '#f1f5f9'
      }}>
        <div style={{
          display: 'flex',
          gap: '16px',
          minWidth: 'fit-content',
          height: '100%'
        }}>
          {columns.map(column => {
            const leadsInStage = getLeadsByStage(column.id);
            
            return (
              <div
                key={column.id}
                style={{
                  minWidth: '280px',
                  background: 'white',
                  borderRadius: '8px',
                  border: '1px solid #e2e8f0',
                  display: 'flex',
                  flexDirection: 'column',
                  boxShadow: '0 1px 3px rgba(0, 0, 0, 0.1)'
                }}
              >
                {/* Column Header */}
                <div style={{
                  padding: '16px',
                  borderBottom: '1px solid #e2e8f0',
                  background: '#f8fafc',
                  borderRadius: '8px 8px 0 0'
                }}>
                  <div style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'flex-start',
                    marginBottom: '8px'
                  }}>
                    {editingColumnId === column.id ? (
                      <input
                        type="text"
                        value={editingColumnName}
                        onChange={(e) => setEditingColumnName(e.target.value)}
                        onBlur={() => handleSaveColumnName(column.id)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') handleSaveColumnName(column.id);
                          if (e.key === 'Escape') handleCancelEditColumn();
                        }}
                        autoFocus
                        style={{
                          flex: 1,
                          fontSize: '16px',
                          fontWeight: '600',
                          padding: '4px 8px',
                          border: '2px solid #3b82f6',
                          borderRadius: '4px',
                          outline: 'none'
                        }}
                      />
                    ) : (
                      <div
                        onDoubleClick={() => handleStartEditColumn(column.id, column.name)}
                        style={{
                          flex: 1,
                          fontSize: '16px',
                          fontWeight: '600',
                          color: '#1e293b',
                          cursor: 'pointer',
                          padding: '4px 0'
                        }}
                        title="Double-click to edit"
                      >
                        {column.name}
                      </div>
                    )}
                    
                    <div style={{ display: 'flex', gap: '6px', marginLeft: '8px', alignItems: 'center' }}>
                      <input
                        type="color"
                        value={column.color}
                        onChange={(e) => handleChangeColumnColor(column.id, e.target.value)}
                        title="Change column color"
                        style={{
                          width: '24px',
                          height: '24px',
                          border: 'none',
                          borderRadius: '4px',
                          cursor: 'pointer'
                        }}
                      />
                      <button
                        onClick={() => handleRemoveColumn(column.id)}
                        title="Delete column"
                        aria-label="Delete column"
                        style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          width: '28px',
                          height: '28px',
                          background: 'transparent',
                          border: '1px solid #e2e8f0',
                          color: '#dc2626',
                          cursor: 'pointer',
                          borderRadius: '8px',
                          transition: 'background 0.2s, border-color 0.2s'
                        }}
                        onMouseEnter={(e) => { e.currentTarget.style.background = '#fef2f2'; e.currentTarget.style.borderColor = '#fecaca'; }}
                        onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.borderColor = '#e2e8f0'; }}
                      >
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <polyline points="3 6 5 6 21 6"></polyline>
                          <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"></path>
                          <path d="M10 11v6"></path>
                          <path d="M14 11v6"></path>
                          <path d="M9 6V4a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2v2"></path>
                        </svg>
                      </button>
                    </div>
                  </div>
                  
                  <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px'
                  }}>
                    <div style={{
                      width: '12px',
                      height: '12px',
                      borderRadius: '50%',
                      background: column.color
                    }} />
                    <div style={{
                      fontSize: '12px',
                      color: '#64748b'
                    }}>{leadsInStage.length} leads</div>
                  </div>
                </div>
                
                {/* Column Content */}
                <div
                  className="drop-zone"
                  style={{
                    flex: 1,
                    padding: '12px',
                    overflowY: 'auto'
                  }}
                  onDragOver={(e) => {
                    e.preventDefault();
                    e.target.classList.add('drag-over');
                  }}
                  onDragLeave={(e) => {
                    e.target.classList.remove('drag-over');
                  }}
                  onDrop={(e) => {
                    e.preventDefault();
                    e.target.classList.remove('drag-over');
                    handleDrop(column.id);
                  }}
                >
                  {leadsInStage.map(lead => (
                    <div
                      key={lead.id}
                      draggable
                      onDragStart={() => handleDragStart(lead)}
                      onDragEnd={handleDragEnd}
                      onDoubleClick={() => handleSelectLead(lead)}
                      className="lead-card"
                      style={{
                        background: selectedLeadId === lead.id ? '#eff6ff' : 'white',
                        border: selectedLeadId === lead.id ? '2px solid #3b82f6' : '1px solid #e2e8f0',
                        borderLeft: `4px solid ${column.color}`,
                        borderRadius: '8px',
                        padding: '12px',
                        marginBottom: '8px',
                        cursor: 'pointer',
                        boxShadow: selectedLeadId === lead.id ? '0 4px 6px rgba(59, 130, 246, 0.15)' : '0 1px 2px rgba(0, 0, 0, 0.05)'
                      }}
                    >
                      <div style={{
                        fontWeight: '600',
                        fontSize: '14px',
                        color: '#1e293b',
                        marginBottom: '4px'
                      }}>{lead.name}</div>
                      <div style={{
                        fontSize: '12px',
                        color: '#64748b',
                        marginBottom: '8px'
                      }}>{lead.company}</div>
                      <div style={{
                        fontSize: '14px',
                        fontWeight: '600',
                        color: '#059669',
                        marginBottom: '8px'
                      }}>${(lead.value || 0).toLocaleString()}</div>
                      <div style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        fontSize: '11px',
                        color: '#64748b'
                      }}>
                        <span style={{
                          padding: '2px 6px',
                          borderRadius: '12px',
                          fontWeight: '500',
                          ...getPriorityColor(lead.priority)
                        }}>
                          {lead.priority}
                        </span>
                        <span>{new Date(lead.closeDate).toLocaleDateString()}</span>
                        <button
                          onClick={(e) => { e.stopPropagation(); handleRequestDeleteLead(lead); }}
                          title="Delete lead"
                          aria-label="Delete lead"
                          style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            width: '24px',
                            height: '24px',
                            background: 'transparent',
                            border: '1px solid #e2e8f0',
                            color: '#dc2626',
                            cursor: 'pointer',
                            borderRadius: '6px'
                          }}
                        >
                          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <polyline points="3 6 5 6 21 6"></polyline>
                            <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"></path>
                            <path d="M10 11v6"></path>
                            <path d="M14 11v6"></path>
                            <path d="M9 6V4a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2v2"></path>
                          </svg>
                        </button>
                      </div>
                    </div>
                  ))}
                  
                  <button
                    onClick={() => handleAddLead(column.id)}
                    style={{
                      width: '100%',
                      padding: '12px',
                      border: '2px dashed #d1d5db',
                      borderRadius: '8px',
                      background: 'transparent',
                      color: '#64748b',
                      cursor: 'pointer',
                      transition: 'all 0.2s',
                      fontSize: '14px'
                    }}
                    onMouseOver={(e) => {
                      e.target.style.borderColor = '#3b82f6';
                      e.target.style.color = '#3b82f6';
                      e.target.style.background = '#eff6ff';
                    }}
                    onMouseOut={(e) => {
                      e.target.style.borderColor = '#d1d5db';
                      e.target.style.color = '#64748b';
                      e.target.style.background = 'transparent';
                    }}
                  >
                    + Add Lead
                  </button>
                </div>
              </div>
            );
          })}
          {/* Ghost add-column at end */}
          <div
            role="button"
            tabIndex={0}
            onClick={handleAddColumn}
            onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') handleAddColumn(); }}
            style={{
              minWidth: '220px',
              border: '1px dashed #cbd5e1',
              borderRadius: '8px',
              background: 'linear-gradient(to right, rgba(248,250,252,0.9), rgba(248,250,252,0.3))',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#475569',
              cursor: 'pointer',
              userSelect: 'none'
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '12px 16px' }}>
              <div style={{
                width: '28px',
                height: '28px',
                borderRadius: '9999px',
                background: '#3b82f6',
                color: '#fff',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                boxShadow: '0 4px 6px rgba(59,130,246,0.2)'
              }}>
                +
              </div>
              <div style={{ fontSize: '14px', fontWeight: 600 }}>Add stage</div>
            </div>
          </div>
        </div>
      </div>
      {/* Delete lead modal */}
      {showDeleteLeadModal && (
        <div className="modal-overlay">
          <div className="modal-content" style={{ padding: '20px', width: '420px' }}>
            <h3 style={{ fontSize: '16px', fontWeight: 600, marginBottom: '8px' }}>Delete this lead?</h3>
            <p style={{ fontSize: '14px', color: '#475569', marginBottom: '16px' }}>
              This action cannot be undone and will remove the lead from all views.
            </p>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
              <button className="btn-secondary" onClick={() => { setShowDeleteLeadModal(false); setLeadToDelete(null); }}>Cancel</button>
              <button className="btn-primary" style={{ background: '#dc2626' }} onClick={confirmDeleteLead}>Delete</button>
            </div>
          </div>
        </div>
      )}

      {/* Delete column modal */}
      {showDeleteColumnModal && (
        <div className="modal-overlay">
          <div className="modal-content" style={{ padding: '20px', width: '440px' }}>
            <h3 style={{ fontSize: '16px', fontWeight: 600, marginBottom: '8px' }}>Remove this stage?</h3>
            <p style={{ fontSize: '14px', color: '#475569', marginBottom: '16px' }}>
              Leads in this stage will be moved to the first remaining stage.
            </p>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
              <button className="btn-secondary" onClick={() => { setShowDeleteColumnModal(false); setColumnToDelete(null); }}>Cancel</button>
              <button className="btn-primary" onClick={confirmRemoveColumn}>Confirm</button>
            </div>
          </div>
        </div>
      )}
      
      {/* Modal */}
      {showModal && (
        <div className="modal-overlay">
          <div className="modal-content" style={{
            padding: '24px',
            width: '90%',
            maxWidth: '500px',
            maxHeight: '80vh',
            overflowY: 'auto'
          }}>
            <div style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              marginBottom: '20px'
            }}>
              <h3 style={{
                fontSize: '18px',
                fontWeight: '600'
              }}>
                {editingLead ? 'Edit Lead' : 'Add Lead'}
              </h3>
              <button
                onClick={() => setShowModal(false)}
                style={{
                  background: 'none',
                  border: 'none',
                  fontSize: '20px',
                  cursor: 'pointer',
                  color: '#64748b'
                }}
              >
                ×
              </button>
            </div>
            
            <form onSubmit={handleSaveLead} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div>
                <label style={{
                  display: 'block',
                  marginBottom: '4px',
                  fontSize: '14px',
                  fontWeight: '500',
                  color: '#374151'
                }}>
                  Lead Name
                </label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                  className="form-input"
                  required
                />
              </div>
              
              <div>
                <label style={{
                  display: 'block',
                  marginBottom: '4px',
                  fontSize: '14px',
                  fontWeight: '500',
                  color: '#374151'
                }}>
                  Company
                </label>
                <input
                  type="text"
                  value={formData.company}
                  onChange={(e) => setFormData(prev => ({ ...prev, company: e.target.value }))}
                  className="form-input"
                  required
                />
              </div>
              
              <div>
                <label style={{
                  display: 'block',
                  marginBottom: '4px',
                  fontSize: '14px',
                  fontWeight: '500',
                  color: '#374151'
                }}>
                  Email
                </label>
                <input
                  type="email"
                  value={formData.email}
                  onChange={(e) => setFormData(prev => ({ ...prev, email: e.target.value }))}
                  className="form-input"
                />
              </div>
              
              <div>
                <label style={{
                  display: 'block',
                  marginBottom: '4px',
                  fontSize: '14px',
                  fontWeight: '500',
                  color: '#374151'
                }}>
                  Phone
                </label>
                <input
                  type="tel"
                  value={formData.phone}
                  onChange={(e) => setFormData(prev => ({ ...prev, phone: e.target.value }))}
                  className="form-input"
                />
              </div>
              
              <div>
                <label style={{
                  display: 'block',
                  marginBottom: '4px',
                  fontSize: '14px',
                  fontWeight: '500',
                  color: '#374151'
                }}>
                  Deal Value ($)
                </label>
                <input
                  type="number"
                  value={formData.value}
                  onChange={(e) => setFormData(prev => ({ ...prev, value: e.target.value }))}
                  className="form-input"
                  min="0"
                  step="0.01"
                />
              </div>
              
              <div>
                <label style={{
                  display: 'block',
                  marginBottom: '4px',
                  fontSize: '14px',
                  fontWeight: '500',
                  color: '#374151'
                }}>
                  Priority
                </label>
                <select
                  value={formData.priority}
                  onChange={(e) => setFormData(prev => ({ ...prev, priority: e.target.value }))}
                  className="form-input"
                >
                  <option value="high">High</option>
                  <option value="medium">Medium</option>
                  <option value="low">Low</option>
                </select>
              </div>
              
              <div>
                <label style={{
                  display: 'block',
                  marginBottom: '4px',
                  fontSize: '14px',
                  fontWeight: '500',
                  color: '#374151'
                }}>
                  Expected Close Date
                </label>
                <input
                  type="date"
                  value={formData.closeDate}
                  onChange={(e) => setFormData(prev => ({ ...prev, closeDate: e.target.value }))}
                  className="form-input"
                />
              </div>
              
              <div>
                <label style={{
                  display: 'block',
                  marginBottom: '4px',
                  fontSize: '14px',
                  fontWeight: '500',
                  color: '#374151'
                }}>
                  Notes
                </label>
                <textarea
                  value={formData.notes}
                  onChange={(e) => setFormData(prev => ({ ...prev, notes: e.target.value }))}
                  rows={3}
                  className="form-input"
                  placeholder="Add notes about this lead..."
                />
              </div>
              
              <div style={{
                display: 'flex',
                gap: '12px',
                justifyContent: 'flex-end',
                marginTop: '24px'
              }}>
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="btn-secondary"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="btn-primary"
                >
                  Save Lead
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

export default LeadPipelineWidget;
