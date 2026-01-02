import React, { useState, useMemo } from 'react';

function ActivityLoggerWidget() {
  // Global storage for activities (canvas-wide, single source of truth)
  const [activityData, setActivityData] = useGlobalStorage('crm-activities', { activities: [] });

  // Local state
  const [showModal, setShowModal] = useState(false);
  const [editingActivity, setEditingActivity] = useState(null);
  const [filters, setFilters] = useState({
    type: '',
    contact: '',
    time: 'all'
  });
  const [formData, setFormData] = useState({
    type: 'call',
    contact: '',
    date: '',
    time: '',
    duration: '',
    description: '',
    outcome: '',
    tags: ''
  });

  // Calculate stats
  const stats = useMemo(() => {
    const total = activityData.activities.length;
    const today = new Date().toISOString().split('T')[0];
    const todayCount = activityData.activities.filter(a => a.date === today).length;
    
    const weekStart = new Date();
    weekStart.setDate(weekStart.getDate() - weekStart.getDay());
    const weekStartStr = weekStart.toISOString().split('T')[0];
    const weekCount = activityData.activities.filter(a => a.date >= weekStartStr).length;
    
    const calls = activityData.activities.filter(a => a.type === 'call').length;
    const emails = activityData.activities.filter(a => a.type === 'email').length;
    const meetings = activityData.activities.filter(a => a.type === 'meeting').length;
    
    return { total, todayCount, weekCount, calls, emails, meetings };
  }, [activityData.activities]);

  // Get unique contacts for filter
  const contacts = useMemo(() => {
    return [...new Set(activityData.activities.map(a => a.contact))];
  }, [activityData.activities]);

  // Filter activities
  const filteredActivities = useMemo(() => {
    let filtered = [...activityData.activities];
    
    // Filter by type
    if (filters.type) {
      filtered = filtered.filter(activity => activity.type === filters.type);
    }
    
    // Filter by contact
    if (filters.contact) {
      filtered = filtered.filter(activity => activity.contact === filters.contact);
    }
    
    // Filter by time
    if (filters.time !== 'all') {
      const today = new Date();
      const todayStr = today.toISOString().split('T')[0];
      
      switch (filters.time) {
        case 'today':
          filtered = filtered.filter(activity => activity.date === todayStr);
          break;
        case 'week':
          const weekStart = new Date();
          weekStart.setDate(weekStart.getDate() - weekStart.getDay());
          const weekStartStr = weekStart.toISOString().split('T')[0];
          filtered = filtered.filter(activity => activity.date >= weekStartStr);
          break;
        case 'month':
          const monthStart = new Date();
          monthStart.setDate(1);
          const monthStartStr = monthStart.toISOString().split('T')[0];
          filtered = filtered.filter(activity => activity.date >= monthStartStr);
          break;
      }
    }
    
    // Sort by date and time (newest first)
    filtered.sort((a, b) => {
      const dateA = new Date(`${a.date}T${a.time}`);
      const dateB = new Date(`${b.date}T${b.time}`);
      return dateB - dateA;
    });
    
    return filtered;
  }, [activityData.activities, filters]);

  const handleAddActivity = () => {
    setEditingActivity(null);
    const now = new Date();
    setFormData({
      type: 'call',
      contact: '',
      date: now.toISOString().split('T')[0],
      time: now.toTimeString().slice(0, 5),
      duration: '',
      description: '',
      outcome: '',
      tags: ''
    });
    setShowModal(true);
  };

  const handleEditActivity = (activity) => {
    setEditingActivity(activity);
    setFormData({
      ...activity,
      tags: activity.tags ? activity.tags.join(', ') : ''
    });
    setShowModal(true);
  };

  const handleSaveActivity = (e) => {
    e.preventDefault();
    
    const activityFormData = {
      ...formData,
      duration: formData.duration ? parseInt(formData.duration) : null,
      tags: formData.tags
        .split(',')
        .map(tag => tag.trim())
        .filter(tag => tag.length > 0)
    };
    
    if (editingActivity) {
      // Update existing activity
      setActivityData(prev => ({
        ...prev,
        activities: prev.activities.map(a => 
          a.id === editingActivity.id ? { ...a, ...activityFormData } : a
        )
      }));
    } else {
      // Add new activity
      const newActivity = {
        id: Date.now().toString(),
        ...activityFormData,
        createdAt: new Date().toISOString()
      };
      setActivityData(prev => ({
        ...prev,
        activities: [...prev.activities, newActivity]
      }));
    }
    
    setShowModal(false);
  };

  const getTypeIcon = (type) => {
    const icons = {
      call: '📞',
      email: '📧',
      meeting: '🤝',
      note: '📝',
      task: '✅'
    };
    return icons[type] || '📝';
  };

  const getTypeColor = (type) => {
    switch (type) {
      case 'call': return { bg: '#dbeafe', text: '#1e40af' };
      case 'email': return { bg: '#f3e8ff', text: '#7c3aed' };
      case 'meeting': return { bg: '#fef3c7', text: '#d97706' };
      case 'note': return { bg: '#d1fae5', text: '#065f46' };
      case 'task': return { bg: '#fecaca', text: '#dc2626' };
      default: return { bg: '#f1f5f9', text: '#6b7280' };
    }
  };

  const formatTime = (dateString) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now - date;
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
    const diffDays = Math.floor(diffHours / 24);
    
    if (diffHours < 1) {
      return 'Just now';
    } else if (diffHours < 24) {
      return `${diffHours}h ago`;
    } else if (diffDays < 7) {
      return `${diffDays}d ago`;
    } else {
      return date.toLocaleDateString();
    }
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
        .activity-item { 
          transition: all 0.2s ease; 
          cursor: pointer;
        }
        .activity-item:hover { 
          transform: translateY(-1px); 
          box-shadow: 0 4px 8px rgba(0,0,0,0.1); 
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
        <h2 style={{
          fontSize: '18px',
          fontWeight: '600',
          marginBottom: '12px',
          color: '#1e293b'
        }}>📝 Activity Logger</h2>
        
        {/* Activity Stats */}
        <div style={{ display: 'flex', gap: '16px', marginBottom: '12px' }}>
          <div style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            padding: '8px',
            background: 'white',
            borderRadius: '6px',
            border: '1px solid #e2e8f0',
            minWidth: '60px'
          }}>
            <div style={{
              fontSize: '16px',
              fontWeight: '700',
              color: '#1e293b'
            }}>{stats.total}</div>
            <div style={{
              fontSize: '10px',
              color: '#64748b',
              textAlign: 'center'
            }}>Total</div>
          </div>
          <div style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            padding: '8px',
            background: 'white',
            borderRadius: '6px',
            border: '1px solid #e2e8f0',
            minWidth: '60px'
          }}>
            <div style={{
              fontSize: '16px',
              fontWeight: '700',
              color: '#1e293b'
            }}>{stats.todayCount}</div>
            <div style={{
              fontSize: '10px',
              color: '#64748b',
              textAlign: 'center'
            }}>Today</div>
          </div>
          <div style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            padding: '8px',
            background: 'white',
            borderRadius: '6px',
            border: '1px solid #e2e8f0',
            minWidth: '60px'
          }}>
            <div style={{
              fontSize: '16px',
              fontWeight: '700',
              color: '#1e293b'
            }}>{stats.weekCount}</div>
            <div style={{
              fontSize: '10px',
              color: '#64748b',
              textAlign: 'center'
            }}>Week</div>
          </div>
          <div style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            padding: '8px',
            background: 'white',
            borderRadius: '6px',
            border: '1px solid #e2e8f0',
            minWidth: '60px'
          }}>
            <div style={{
              fontSize: '16px',
              fontWeight: '700',
              color: '#1e293b'
            }}>{stats.calls}</div>
            <div style={{
              fontSize: '10px',
              color: '#64748b',
              textAlign: 'center'
            }}>Calls</div>
          </div>
          <div style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            padding: '8px',
            background: 'white',
            borderRadius: '6px',
            border: '1px solid #e2e8f0',
            minWidth: '60px'
          }}>
            <div style={{
              fontSize: '16px',
              fontWeight: '700',
              color: '#1e293b'
            }}>{stats.emails}</div>
            <div style={{
              fontSize: '10px',
              color: '#64748b',
              textAlign: 'center'
            }}>Emails</div>
          </div>
          <div style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            padding: '8px',
            background: 'white',
            borderRadius: '6px',
            border: '1px solid #e2e8f0',
            minWidth: '60px'
          }}>
            <div style={{
              fontSize: '16px',
              fontWeight: '700',
              color: '#1e293b'
            }}>{stats.meetings}</div>
            <div style={{
              fontSize: '10px',
              color: '#64748b',
              textAlign: 'center'
            }}>Meetings</div>
          </div>
        </div>
        
        {/* Filters */}
        <div style={{ display: 'flex', gap: '8px' }}>
          <select
            value={filters.type}
            onChange={(e) => setFilters(prev => ({ ...prev, type: e.target.value }))}
            style={{
              padding: '6px 12px',
              border: '1px solid #d1d5db',
              borderRadius: '6px',
              fontSize: '12px',
              background: 'white'
            }}
          >
            <option value="">All Types</option>
            <option value="call">Calls</option>
            <option value="email">Emails</option>
            <option value="meeting">Meetings</option>
            <option value="note">Notes</option>
            <option value="task">Tasks</option>
          </select>
          <select
            value={filters.contact}
            onChange={(e) => setFilters(prev => ({ ...prev, contact: e.target.value }))}
            style={{
              padding: '6px 12px',
              border: '1px solid #d1d5db',
              borderRadius: '6px',
              fontSize: '12px',
              background: 'white'
            }}
          >
            <option value="">All Contacts</option>
            {contacts.map(contact => (
              <option key={contact} value={contact}>{contact}</option>
            ))}
          </select>
          <select
            value={filters.time}
            onChange={(e) => setFilters(prev => ({ ...prev, time: e.target.value }))}
            style={{
              padding: '6px 12px',
              border: '1px solid #d1d5db',
              borderRadius: '6px',
              fontSize: '12px',
              background: 'white'
            }}
          >
            <option value="all">All Time</option>
            <option value="today">Today</option>
            <option value="week">This Week</option>
            <option value="month">This Month</option>
          </select>
        </div>
      </div>
      
      {/* Activities List */}
      <div style={{
        flex: 1,
        overflowY: 'auto',
        padding: '8px'
      }}>
        {filteredActivities.length === 0 ? (
          <div style={{
            textAlign: 'center',
            padding: '40px 20px',
            color: '#64748b'
          }}>
            <h3 style={{
              fontSize: '18px',
              fontWeight: '500',
              marginBottom: '8px',
              color: '#475569'
            }}>No activities found</h3>
            <p>Try adjusting your filters or log your first activity</p>
          </div>
        ) : (
          <div style={{ position: 'relative', paddingLeft: '20px' }}>
            {/* Timeline line */}
            <div style={{
              position: 'absolute',
              left: '8px',
              top: 0,
              bottom: 0,
              width: '2px',
              background: '#e2e8f0'
            }} />
            
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              {filteredActivities.map((activity, index) => (
                <div key={activity.id} style={{ position: 'relative' }}>
                  {/* Timeline dot */}
                  <div style={{
                    position: 'absolute',
                    left: '-16px',
                    top: '4px',
                    width: '8px',
                    height: '8px',
                    borderRadius: '50%',
                    background: '#3b82f6'
                  }} />
                  
                  <div
                    onClick={() => handleEditActivity(activity)}
                    className="activity-item"
                    style={{
                      background: 'white',
                      border: '1px solid #e2e8f0',
                      borderRadius: '8px',
                      padding: '12px',
                      boxShadow: '0 1px 2px rgba(0, 0, 0, 0.05)'
                    }}
                  >
                    <div style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      marginBottom: '8px'
                    }}>
                      <div style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '6px',
                        fontSize: '12px',
                        fontWeight: '500',
                        padding: '4px 8px',
                        borderRadius: '12px',
                        ...getTypeColor(activity.type)
                      }}>
                        {getTypeIcon(activity.type)} {activity.type.toUpperCase()}
                      </div>
                      <div style={{
                        fontSize: '11px',
                        color: '#64748b'
                      }}>
                        {new Date(`${activity.date}T${activity.time}`).toLocaleString()}
                      </div>
                    </div>
                    
                    <div style={{
                      fontWeight: '600',
                      fontSize: '14px',
                      color: '#1e293b',
                      marginBottom: '4px'
                    }}>{activity.contact}</div>
                    <div style={{
                      fontSize: '13px',
                      color: '#64748b',
                      lineHeight: '1.4',
                      marginBottom: '8px'
                    }}>{activity.description}</div>
                    
                    {activity.outcome && (
                      <div style={{
                        fontSize: '12px',
                        color: '#059669',
                        fontWeight: '500'
                      }}>{activity.outcome}</div>
                    )}
                    
                    {activity.tags && activity.tags.length > 0 && (
                      <div style={{
                        display: 'flex',
                        gap: '4px',
                        marginTop: '8px',
                        flexWrap: 'wrap'
                      }}>
                        {activity.tags.map(tag => (
                          <span key={tag} style={{
                            padding: '2px 6px',
                            background: '#f1f5f9',
                            color: '#64748b',
                            borderRadius: '10px',
                            fontSize: '10px'
                          }}>
                            {tag}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
      
      {/* Add Activity Button */}
      <button
        onClick={handleAddActivity}
        style={{
          position: 'fixed',
          bottom: '20px',
          right: '20px',
          width: '48px',
          height: '48px',
          borderRadius: '50%',
          background: '#3b82f6',
          color: 'white',
          border: 'none',
          fontSize: '24px',
          cursor: 'pointer',
          boxShadow: '0 4px 12px rgba(59, 130, 246, 0.3)',
          transition: 'all 0.2s'
        }}
        onMouseOver={(e) => {
          e.target.style.background = '#2563eb';
          e.target.style.transform = 'scale(1.05)';
        }}
        onMouseOut={(e) => {
          e.target.style.background = '#3b82f6';
          e.target.style.transform = 'scale(1)';
        }}
      >
        +
      </button>
      
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
                {editingActivity ? 'Edit Activity' : 'Log Activity'}
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
            
            <form onSubmit={handleSaveActivity} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div>
                <label style={{
                  display: 'block',
                  marginBottom: '4px',
                  fontSize: '14px',
                  fontWeight: '500',
                  color: '#374151'
                }}>
                  Activity Type
                </label>
                <select
                  value={formData.type}
                  onChange={(e) => setFormData(prev => ({ ...prev, type: e.target.value }))}
                  className="form-input"
                >
                  <option value="call">📞 Call</option>
                  <option value="email">📧 Email</option>
                  <option value="meeting">🤝 Meeting</option>
                  <option value="note">📝 Note</option>
                  <option value="task">✅ Task</option>
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
                  Contact/Company
                </label>
                <input
                  type="text"
                  value={formData.contact}
                  onChange={(e) => setFormData(prev => ({ ...prev, contact: e.target.value }))}
                  className="form-input"
                  required
                />
              </div>
              
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <div>
                  <label style={{
                    display: 'block',
                    marginBottom: '4px',
                    fontSize: '14px',
                    fontWeight: '500',
                    color: '#374151'
                  }}>
                    Date
                  </label>
                  <input
                    type="date"
                    value={formData.date}
                    onChange={(e) => setFormData(prev => ({ ...prev, date: e.target.value }))}
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
                    Time
                  </label>
                  <input
                    type="time"
                    value={formData.time}
                    onChange={(e) => setFormData(prev => ({ ...prev, time: e.target.value }))}
                    className="form-input"
                    required
                  />
                </div>
              </div>
              
              <div>
                <label style={{
                  display: 'block',
                  marginBottom: '4px',
                  fontSize: '14px',
                  fontWeight: '500',
                  color: '#374151'
                }}>
                  Duration (minutes)
                </label>
                <input
                  type="number"
                  value={formData.duration}
                  onChange={(e) => setFormData(prev => ({ ...prev, duration: e.target.value }))}
                  className="form-input"
                  min="0"
                  placeholder="Optional"
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
                  Description
                </label>
                <textarea
                  value={formData.description}
                  onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
                  rows={3}
                  className="form-input"
                  placeholder="Describe what happened..."
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
                  Outcome
                </label>
                <textarea
                  value={formData.outcome}
                  onChange={(e) => setFormData(prev => ({ ...prev, outcome: e.target.value }))}
                  rows={2}
                  className="form-input"
                  placeholder="What was the result?"
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
                  Tags (comma-separated)
                </label>
                <input
                  type="text"
                  value={formData.tags}
                  onChange={(e) => setFormData(prev => ({ ...prev, tags: e.target.value }))}
                  className="form-input"
                  placeholder="follow-up, urgent, demo"
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
                  Log Activity
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

export default ActivityLoggerWidget;
