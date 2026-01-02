import React, { useState, useMemo } from 'react';

function EmailSchedulerWidget() {
  console.log('Email Scheduler rendering...');
  
  // Read contacts from global storage
  const [contactData, setContactData] = useGlobalStorage('crm-contacts', { contacts: [] });
  
  // Local state
  const [selectedEmails, setSelectedEmails] = useState([]);
  const [schedulerSettings, setSchedulerSettings] = useState({
    fromEmail: '',
    emailsPerDay: 10,
    startTime: '09:00',
    endTime: '17:00',
    timezone: 'America/New_York',
    daysOfWeek: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'],
    isActive: false
  });
  
  const [isConnecting, setIsConnecting] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState('disconnected'); // disconnected, connected, error

  // Get all emails from all contacts
  const allEmails = useMemo(() => {
    const emails = [];
    contactData.contacts.forEach(contact => {
      if (contact.emails) {
        contact.emails.forEach(email => {
          if (email.status === 'not_sent') {
            emails.push({
              ...email,
              contactId: contact.id,
              contactName: contact.name,
              contactEmail: contact.email
            });
          }
        });
      }
    });
    return emails;
  }, [contactData.contacts]);

  const handleSelectEmail = (emailId) => {
    setSelectedEmails(prev => 
      prev.includes(emailId)
        ? prev.filter(id => id !== emailId)
        : [...prev, emailId]
    );
  };

  const handleSelectAll = () => {
    if (selectedEmails.length === allEmails.length) {
      setSelectedEmails([]);
    } else {
      setSelectedEmails(allEmails.map(e => e.id));
    }
  };

  const markEmailAsSent = (emailId, contactId) => {
    // Update the email status in global storage
    const updatedContacts = contactData.contacts.map(contact => {
      if (contact.id === contactId) {
        return {
          ...contact,
          emails: contact.emails.map(email => 
            email.id === emailId 
              ? { ...email, status: 'sent', sentAt: new Date().toISOString() }
              : email
          )
        };
      }
      return contact;
    });

    setContactData({
      ...contactData,
      contacts: updatedContacts
    });
  };

  const simulateEmailSending = async (emailsToSend) => {
    // This simulates sending emails - in real implementation, this would call Gmail API
    console.log('📧 Simulating sending emails:', emailsToSend);
    
    for (const email of emailsToSend) {
      // Simulate API call delay
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      // Mark email as sent
      markEmailAsSent(email.id, email.contactId);
      
      console.log(`✅ Marked email "${email.subject}" as sent for ${email.contactName}`);
    }
  };

  const handleConnectGmail = async () => {
    setIsConnecting(true);
    try {
      // TODO: Implement Gmail OAuth integration
      // For now, simulate connection
      await new Promise(resolve => setTimeout(resolve, 2000));
      setConnectionStatus('connected');
    } catch (error) {
      console.error('Gmail connection failed:', error);
      setConnectionStatus('error');
    } finally {
      setIsConnecting(false);
    }
  };

  const handleStartScheduler = async () => {
    if (selectedEmails.length === 0) {
      alert('Please select emails to schedule');
      return;
    }
    
    if (connectionStatus !== 'connected') {
      alert('Please connect to Gmail first');
      return;
    }

    try {
      console.log('Starting email scheduler with settings:', schedulerSettings);
      console.log('Selected emails:', selectedEmails);
      
      // Get the emails to send
      const emailsToSend = allEmails.filter(email => selectedEmails.includes(email.id));
      
      if (schedulerSettings.isActive) {
        // Stop scheduler
        setSchedulerSettings(prev => ({ ...prev, isActive: false }));
        alert('Scheduler stopped');
      } else {
        // Start scheduler and send emails immediately (for demo)
        setSchedulerSettings(prev => ({ ...prev, isActive: true }));
        
        // Send emails immediately (in real implementation, this would be scheduled)
        await simulateEmailSending(emailsToSend);
        
        alert(`✅ Sent ${emailsToSend.length} emails successfully! They are now marked as "sent" in the Contact Directory.`);
        
        // Clear selection after sending
        setSelectedEmails([]);
      }
      
    } catch (error) {
      console.error('Scheduling failed:', error);
      alert('Failed to start scheduler. Please try again.');
    }
  };

  const updateSchedulerSetting = (key, value) => {
    setSchedulerSettings(prev => ({
      ...prev,
      [key]: value
    }));
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
        .btn-primary:disabled { 
          background: #9ca3af; 
          cursor: not-allowed; 
        }
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
        .form-select { 
          width: 100%; 
          padding: 8px 12px; 
          border: 1px solid #d1d5db; 
          border-radius: 6px; 
          font-size: 14px; 
          font-family: inherit;
          background: white;
        }
        .form-select:focus { 
          outline: none; 
          border-color: #3b82f6; 
          box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.1); 
        }
        .checkbox-container {
          display: flex;
          align-items: center;
          gap: 8px;
          margin-bottom: 8px;
        }
        .checkbox-container input[type="checkbox"] {
          accent-color: #3b82f6;
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
        }}>📧 Email Scheduler</h2>
        
        {/* Stats */}
        <div style={{ display: 'flex', gap: '16px' }}>
          <div style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            padding: '8px',
            background: 'white',
            borderRadius: '6px',
            border: '1px solid #e2e8f0',
            minWidth: '80px'
          }}>
            <div style={{
              fontSize: '16px',
              fontWeight: '700',
              color: '#3b82f6'
            }}>{allEmails.length}</div>
            <div style={{
              fontSize: '10px',
              color: '#64748b',
              textAlign: 'center'
            }}>Available Emails</div>
          </div>
          <div style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            padding: '8px',
            background: 'white',
            borderRadius: '6px',
            border: '1px solid #e2e8f0',
            minWidth: '80px'
          }}>
            <div style={{
              fontSize: '16px',
              fontWeight: '700',
              color: '#f59e0b'
            }}>{selectedEmails.length}</div>
            <div style={{
              fontSize: '10px',
              color: '#64748b',
              textAlign: 'center'
            }}>Selected</div>
          </div>
          <div style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            padding: '8px',
            background: 'white',
            borderRadius: '6px',
            border: '1px solid #e2e8f0',
            minWidth: '80px'
          }}>
            <div style={{
              fontSize: '16px',
              fontWeight: '700',
              color: schedulerSettings.isActive ? '#10b981' : '#64748b'
            }}>{schedulerSettings.isActive ? 'Active' : 'Inactive'}</div>
            <div style={{
              fontSize: '10px',
              color: '#64748b',
              textAlign: 'center'
            }}>Scheduler</div>
          </div>
        </div>
      </div>
      
      <div style={{
        flex: 1,
        display: 'flex',
        overflow: 'hidden'
      }}>
        {/* Left Panel - Email Selection */}
        <div style={{
          width: '50%',
          borderRight: '1px solid #e2e8f0',
          overflowY: 'auto',
          display: 'flex',
          flexDirection: 'column'
        }}>
          {/* Gmail Connection */}
          <div style={{ padding: '16px', borderBottom: '1px solid #e2e8f0' }}>
            <h3 style={{
              fontSize: '16px',
              fontWeight: '600',
              marginBottom: '12px',
              color: '#1e293b'
            }}>Gmail Integration</h3>
            
            <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
              <button
                onClick={handleConnectGmail}
                disabled={isConnecting || connectionStatus === 'connected'}
                className="btn-primary"
                style={{ 
                  background: connectionStatus === 'connected' ? '#10b981' : '#3b82f6',
                  opacity: isConnecting ? 0.7 : 1
                }}
              >
                {isConnecting ? '🔄 Connecting...' : 
                 connectionStatus === 'connected' ? '✅ Connected to Gmail' : 
                 '🔗 Connect to Gmail'}
              </button>
              
              {connectionStatus === 'connected' && (
                <div style={{
                  padding: '4px 8px',
                  background: '#f0fdf4',
                  color: '#166534',
                  borderRadius: '4px',
                  fontSize: '12px'
                }}>
                  Ready to send
                </div>
              )}
            </div>
          </div>

          {/* Email Selection */}
          <div style={{ padding: '16px' }}>
            <h3 style={{
              fontSize: '16px',
              fontWeight: '600',
              marginBottom: '12px',
              color: '#1e293b'
            }}>Select Emails to Schedule</h3>
            
            {allEmails.length === 0 ? (
              <div style={{
                textAlign: 'center',
                padding: '20px',
                color: '#64748b'
              }}>
                <div style={{ fontSize: '24px', marginBottom: '8px' }}>📭</div>
                <p>No unsent emails found. Generate some emails in the Email Campaign Generator first.</p>
              </div>
            ) : (
              <>
                {/* Select All */}
                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  padding: '8px 0',
                  marginBottom: '8px'
                }}>
                  <input
                    type="checkbox"
                    checked={selectedEmails.length === allEmails.length && allEmails.length > 0}
                    onChange={handleSelectAll}
                    style={{
                      width: '16px',
                      height: '16px',
                      cursor: 'pointer'
                    }}
                  />
                  <span style={{ fontSize: '13px', color: '#64748b' }}>
                    Select all ({allEmails.length})
                  </span>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', maxHeight: '300px', overflowY: 'auto' }}>
                  {allEmails.map(email => {
                    const isSelected = selectedEmails.includes(email.id);
                    return (
                      <div
                        key={email.id}
                        style={{
                          padding: '8px',
                          border: isSelected ? '2px solid #3b82f6' : '1px solid #e2e8f0',
                          borderRadius: '6px',
                          background: isSelected ? '#eff6ff' : 'white',
                          display: 'flex',
                          gap: '8px',
                          alignItems: 'flex-start'
                        }}
                      >
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={() => handleSelectEmail(email.id)}
                          style={{
                            width: '16px',
                            height: '16px',
                            cursor: 'pointer',
                            flexShrink: 0,
                            marginTop: '2px'
                          }}
                        />
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{
                            fontSize: '13px',
                            fontWeight: '600',
                            color: '#1e293b',
                            marginBottom: '2px'
                          }}>{email.contactName}</div>
                          <div style={{
                            fontSize: '11px',
                            color: '#64748b',
                            marginBottom: '4px'
                          }}>{email.subject}</div>
                          <div style={{
                            fontSize: '10px',
                            color: '#9ca3af',
                            display: '-webkit-box',
                            WebkitLineClamp: 2,
                            WebkitBoxOrient: 'vertical',
                            overflow: 'hidden'
                          }}>{email.content.substring(0, 100)}...</div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </>
            )}
          </div>
        </div>
        
        {/* Right Panel - Scheduler Settings */}
        <div style={{
          width: '50%',
          padding: '16px',
          overflowY: 'auto'
        }}>
          <h3 style={{
            fontSize: '16px',
            fontWeight: '600',
            marginBottom: '16px',
            color: '#1e293b'
          }}>Scheduler Settings</h3>
          
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            {/* From Email */}
            <div>
              <label style={{
                display: 'block',
                marginBottom: '4px',
                fontSize: '14px',
                fontWeight: '500',
                color: '#374151'
              }}>
                From Email Address
              </label>
              <input
                type="email"
                value={schedulerSettings.fromEmail}
                onChange={(e) => updateSchedulerSetting('fromEmail', e.target.value)}
                className="form-input"
                placeholder="your-email@gmail.com"
              />
            </div>

            {/* Emails Per Day */}
            <div>
              <label style={{
                display: 'block',
                marginBottom: '4px',
                fontSize: '14px',
                fontWeight: '500',
                color: '#374151'
              }}>
                Emails Per Day
              </label>
              <input
                type="number"
                min="1"
                max="100"
                value={schedulerSettings.emailsPerDay}
                onChange={(e) => updateSchedulerSetting('emailsPerDay', parseInt(e.target.value))}
                className="form-input"
              />
            </div>

            {/* Time Range */}
            <div style={{ display: 'flex', gap: '12px' }}>
              <div style={{ flex: 1 }}>
                <label style={{
                  display: 'block',
                  marginBottom: '4px',
                  fontSize: '14px',
                  fontWeight: '500',
                  color: '#374151'
                }}>
                  Start Time
                </label>
                <input
                  type="time"
                  value={schedulerSettings.startTime}
                  onChange={(e) => updateSchedulerSetting('startTime', e.target.value)}
                  className="form-input"
                />
              </div>
              <div style={{ flex: 1 }}>
                <label style={{
                  display: 'block',
                  marginBottom: '4px',
                  fontSize: '14px',
                  fontWeight: '500',
                  color: '#374151'
                }}>
                  End Time
                </label>
                <input
                  type="time"
                  value={schedulerSettings.endTime}
                  onChange={(e) => updateSchedulerSetting('endTime', e.target.value)}
                  className="form-input"
                />
              </div>
            </div>

            {/* Timezone */}
            <div>
              <label style={{
                display: 'block',
                marginBottom: '4px',
                fontSize: '14px',
                fontWeight: '500',
                color: '#374151'
              }}>
                Timezone
              </label>
              <select
                value={schedulerSettings.timezone}
                onChange={(e) => updateSchedulerSetting('timezone', e.target.value)}
                className="form-select"
              >
                <option value="America/New_York">Eastern Time (ET)</option>
                <option value="America/Chicago">Central Time (CT)</option>
                <option value="America/Denver">Mountain Time (MT)</option>
                <option value="America/Los_Angeles">Pacific Time (PT)</option>
                <option value="Europe/London">London (GMT)</option>
                <option value="Europe/Paris">Paris (CET)</option>
              </select>
            </div>

            {/* Days of Week */}
            <div>
              <label style={{
                display: 'block',
                marginBottom: '8px',
                fontSize: '14px',
                fontWeight: '500',
                color: '#374151'
              }}>
                Send On Days
              </label>
              {['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'].map(day => (
                <div key={day} className="checkbox-container">
                  <input
                    type="checkbox"
                    id={day}
                    checked={schedulerSettings.daysOfWeek.includes(day)}
                    onChange={(e) => {
                      const newDays = e.target.checked
                        ? [...schedulerSettings.daysOfWeek, day]
                        : schedulerSettings.daysOfWeek.filter(d => d !== day);
                      updateSchedulerSetting('daysOfWeek', newDays);
                    }}
                  />
                  <label htmlFor={day} style={{ fontSize: '13px', color: '#374151', cursor: 'pointer' }}>
                    {day}
                  </label>
                </div>
              ))}
            </div>

            {/* Start/Stop Scheduler */}
            <div style={{
              padding: '16px',
              background: '#f8fafc',
              borderRadius: '8px',
              border: '1px solid #e2e8f0'
            }}>
              <div style={{
                display: 'flex',
                gap: '12px',
                alignItems: 'center'
              }}>
                <button
                  onClick={handleStartScheduler}
                  disabled={connectionStatus !== 'connected' || selectedEmails.length === 0}
                  className="btn-primary"
                  style={{
                    background: schedulerSettings.isActive ? '#ef4444' : '#10b981',
                    flex: 1
                  }}
                >
                  {schedulerSettings.isActive ? '🛑 Stop Scheduler' : '🚀 Start Scheduler'}
                </button>
              </div>
              
              {schedulerSettings.isActive && (
                <div style={{
                  marginTop: '12px',
                  padding: '8px',
                  background: '#f0fdf4',
                  border: '1px solid #10b981',
                  borderRadius: '6px',
                  fontSize: '12px',
                  color: '#166534'
                }}>
                  📊 Scheduler is active. Sending {schedulerSettings.emailsPerDay} emails per day between {schedulerSettings.startTime} and {schedulerSettings.endTime} ({schedulerSettings.daysOfWeek.join(', ')})
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default EmailSchedulerWidget;
