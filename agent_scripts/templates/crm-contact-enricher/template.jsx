import React, { useState, useMemo } from 'react';

function ContactEnricherWidget() {
  console.log('Contact Enricher rendering...');
  
  // Global storage for contacts (reads from Contact Directory)
  const [contactData, setContactData] = useGlobalStorage('crm-contacts', { contacts: [] });
  
  console.log('Contact Enricher - Raw contactData:', contactData);
  
  // Local state for enrichment
  const [selectedContact, setSelectedContact] = useState(null);
  const [selectedContacts, setSelectedContacts] = useState([]);
  const [enrichmentOptions, setEnrichmentOptions] = useState({
    socialProfiles: true,
    companyInfo: true,
    locationData: true,
    jobTitle: true
  });
  const [customFields, setCustomFields] = useState([]);
  const [newFieldName, setNewFieldName] = useState('');
  const [newFieldPrompt, setNewFieldPrompt] = useState('');
  const [isEnriching, setIsEnriching] = useState(false);
  const [bulkEnriching, setBulkEnriching] = useState(false);
  const [enrichmentProgress, setEnrichmentProgress] = useState({ current: 0, total: 0 });
  const [enrichmentResults, setEnrichmentResults] = useState({});
  const [showResults, setShowResults] = useState(false);

  // Ensure data exists with fallbacks
  const safeContactData = contactData || { contacts: [] };
  
  console.log('Contact Enricher - Safe contactData:', safeContactData);
  console.log('Contact Enricher - Contacts count:', safeContactData.contacts.length);

  // Get contacts that need enrichment (missing key data)
  const contactsNeedingEnrichment = useMemo(() => {
    console.log('Contact Enricher - Filtering contacts for enrichment...');
    const filtered = safeContactData.contacts.filter(contact => {
      const missingData = [];
      if (!contact.linkedin) missingData.push('LinkedIn');
      if (!contact.twitter) missingData.push('Twitter');
      if (!contact.companySize) missingData.push('Company Size');
      if (!contact.industry) missingData.push('Industry');
      if (!contact.location) missingData.push('Location');
      if (!contact.jobTitle || contact.jobTitle === '') missingData.push('Job Title');
      
      console.log(`Contact ${contact.name}: missing ${missingData.length} fields (${missingData.join(', ')})`);
      return missingData.length > 0;
    });
    console.log('Contact Enricher - Contacts needing enrichment:', filtered.length);
    return filtered;
  }, [safeContactData.contacts]);

  // Real enrichment function using API
  const enrichContact = async (contact, options) => {
    setIsEnriching(true);
    setShowResults(false);
    
    try {
      // Build preset fields array
      const presetFields = [];
      if (options.socialProfiles) presetFields.push('socialProfiles', 'linkedin', 'twitter');
      if (options.companyInfo) presetFields.push('companyInfo');
      if (options.locationData) presetFields.push('locationData');
      if (options.jobTitle) presetFields.push('jobTitle');
      
      // Use miyagiAPI for authenticated requests
      const result = await miyagiAPI.post('/api/crm/enrich-contact', {
        contact: {
          name: contact.name,
          email: contact.email,
          company: contact.company,
          position: contact.position
        },
        presetFields,
        customFields: customFields.map(f => ({
          name: f.name,
          prompt: f.prompt
        }))
      });
      
      if (result.success) {
        setEnrichmentResults({
          presetData: result.presetData || {},
          customFields: result.customFields || {}
        });
        setShowResults(true);
      } else {
        throw new Error(result.error || 'Enrichment failed');
      }
    } catch (error) {
      console.error('Enrichment error:', error);
      alert('Failed to enrich contact. Please try again.');
      setEnrichmentResults({});
    } finally {
      setIsEnriching(false);
    }
  };

  const applyEnrichment = () => {
    if (!selectedContact || !showResults) return;
    
    const presetData = enrichmentResults.presetData || {};
    const customData = enrichmentResults.customFields || {};
    
    const enrichedContact = {
      ...selectedContact,
      // Merge preset data (only add new fields, don't overwrite existing)
      ...(presetData.linkedin && !selectedContact.linkedin && { linkedin: presetData.linkedin }),
      ...(presetData.twitter && !selectedContact.twitter && { twitter: presetData.twitter }),
      ...(presetData.companySize && !selectedContact.companySize && { companySize: presetData.companySize }),
      ...(presetData.industry && !selectedContact.industry && { industry: presetData.industry }),
      ...(presetData.foundedYear && !selectedContact.foundedYear && { foundedYear: presetData.foundedYear }),
      ...(presetData.website && !selectedContact.website && { website: presetData.website }),
      ...(presetData.revenue && !selectedContact.revenue && { revenue: presetData.revenue }),
      ...(presetData.city && !selectedContact.city && { city: presetData.city }),
      ...(presetData.state && !selectedContact.state && { state: presetData.state }),
      ...(presetData.country && !selectedContact.country && { country: presetData.country }),
      ...(presetData.timezone && !selectedContact.timezone && { timezone: presetData.timezone }),
      ...(presetData.seniority && !selectedContact.seniority && { seniority: presetData.seniority }),
      ...(presetData.department && !selectedContact.department && { department: presetData.department }),
      ...(presetData.yearsExperience && !selectedContact.yearsExperience && { yearsExperience: presetData.yearsExperience }),
      // Merge custom enrichment data
      customEnrichment: {
        ...selectedContact.customEnrichment,
        ...customData
      },
      // Update enrichment metadata
      enrichedAt: new Date().toISOString(),
      enrichmentSource: 'Contact Enricher'
    };
    
    // Update the contact in global storage
    setContactData({
      ...contactData,
      contacts: contactData.contacts.map(c => 
        c.id === selectedContact.id ? enrichedContact : c
      )
    });
    
    // Reset state
    setSelectedContact(null);
    setShowResults(false);
    setEnrichmentResults({});
  };
  
  const addCustomField = () => {
    if (!newFieldName.trim() || !newFieldPrompt.trim()) return;
    
    setCustomFields([...customFields, {
      id: Date.now().toString(),
      name: newFieldName.trim(),
      prompt: newFieldPrompt.trim()
    }]);
    
    setNewFieldName('');
    setNewFieldPrompt('');
  };
  
  const removeCustomField = (id) => {
    setCustomFields(customFields.filter(f => f.id !== id));
  };

  const handleSelectContact = (contactId, e) => {
    e.stopPropagation();
    setSelectedContacts(prev => 
      prev.includes(contactId)
        ? prev.filter(id => id !== contactId)
        : [...prev, contactId]
    );
  };

  const handleSelectAll = () => {
    if (selectedContacts.length === contactsNeedingEnrichment.length) {
      setSelectedContacts([]);
    } else {
      setSelectedContacts(contactsNeedingEnrichment.map(c => c.id));
    }
  };

  const enrichBulkContacts = async () => {
    if (selectedContacts.length === 0) return;
    
    setBulkEnriching(true);
    setEnrichmentProgress({ current: 0, total: selectedContacts.length });
    
    const contactsToEnrich = safeContactData.contacts.filter(c => selectedContacts.includes(c.id));
    const updatedContacts = [...contactData.contacts];
    
    for (let i = 0; i < contactsToEnrich.length; i++) {
      const contact = contactsToEnrich[i];
      setEnrichmentProgress({ current: i + 1, total: selectedContacts.length });
      
      try {
        // Build preset fields array
        const presetFields = [];
        if (enrichmentOptions.socialProfiles) presetFields.push('socialProfiles', 'linkedin', 'twitter');
        if (enrichmentOptions.companyInfo) presetFields.push('companyInfo');
        if (enrichmentOptions.locationData) presetFields.push('locationData');
        if (enrichmentOptions.jobTitle) presetFields.push('jobTitle');
        
        const result = await miyagiAPI.post('/api/crm/enrich-contact', {
          contact: {
            name: contact.name,
            email: contact.email,
            company: contact.company,
            position: contact.position
          },
          presetFields,
          customFields: customFields.map(f => ({
            name: f.name,
            prompt: f.prompt
          }))
        });
        
        if (result.success) {
          const presetData = result.presetData || {};
          const customData = result.customFields || {};
          
          const enrichedContact = {
            ...contact,
            // Merge preset data (only add new fields, don't overwrite existing)
            ...(presetData.linkedin && !contact.linkedin && { linkedin: presetData.linkedin }),
            ...(presetData.twitter && !contact.twitter && { twitter: presetData.twitter }),
            ...(presetData.companySize && !contact.companySize && { companySize: presetData.companySize }),
            ...(presetData.industry && !contact.industry && { industry: presetData.industry }),
            ...(presetData.foundedYear && !contact.foundedYear && { foundedYear: presetData.foundedYear }),
            ...(presetData.website && !contact.website && { website: presetData.website }),
            ...(presetData.revenue && !contact.revenue && { revenue: presetData.revenue }),
            ...(presetData.city && !contact.city && { city: presetData.city }),
            ...(presetData.state && !contact.state && { state: presetData.state }),
            ...(presetData.country && !contact.country && { country: presetData.country }),
            ...(presetData.timezone && !contact.timezone && { timezone: presetData.timezone }),
            ...(presetData.seniority && !contact.seniority && { seniority: presetData.seniority }),
            ...(presetData.department && !contact.department && { department: presetData.department }),
            ...(presetData.yearsExperience && !contact.yearsExperience && { yearsExperience: presetData.yearsExperience }),
            // Merge custom enrichment data
            customEnrichment: {
              ...contact.customEnrichment,
              ...customData
            },
            // Update enrichment metadata
            enrichedAt: new Date().toISOString(),
            enrichmentSource: 'Contact Enricher (Bulk)'
          };
          
          // Update in local array
          const index = updatedContacts.findIndex(c => c.id === contact.id);
          if (index !== -1) {
            updatedContacts[index] = enrichedContact;
          }
        }
      } catch (error) {
        console.error(`Failed to enrich ${contact.name}:`, error);
      }
      
      // Small delay to avoid rate limiting
      await new Promise(resolve => setTimeout(resolve, 500));
    }
    
    // Update all contacts at once
    setContactData({
      ...contactData,
      contacts: updatedContacts
    });
    
    setBulkEnriching(false);
    setSelectedContacts([]);
    setEnrichmentProgress({ current: 0, total: 0 });
  };

  const isContactEnriched = (contact) => {
    return !!(contact.enrichedAt || contact.linkedin || contact.companySize || contact.industry);
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
        .contact-item { 
          transition: all 0.2s ease; 
          cursor: pointer;
        }
        .contact-item:hover { 
          transform: translateY(-1px); 
          box-shadow: 0 4px 8px rgba(0,0,0,0.1); 
        }
        .contact-item.selected {
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
        .checkbox-group {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 8px;
          margin: 12px 0;
        }
        .checkbox-item {
          display: flex;
          align-items: center;
          gap: 8px;
          font-size: 14px;
        }
        .progress-bar {
          height: 8px;
          background: #f1f5f9;
          border-radius: 4px;
          overflow: hidden;
          position: relative;
        }
        .progress-fill {
          height: 100%;
          border-radius: 4px;
          transition: width 0.3s ease;
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
        }}>🔍 Contact Enricher</h2>
        
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
            }}>{safeContactData.contacts.length}</div>
            <div style={{
              fontSize: '10px',
              color: '#64748b',
              textAlign: 'center'
            }}>Total Contacts</div>
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
            }}>{contactsNeedingEnrichment.length}</div>
            <div style={{
              fontSize: '10px',
              color: '#64748b',
              textAlign: 'center'
            }}>Need Enrichment</div>
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
              color: '#10b981'
            }}>{safeContactData.contacts.filter(isContactEnriched).length}</div>
            <div style={{
              fontSize: '10px',
              color: '#64748b',
              textAlign: 'center'
            }}>Enriched</div>
          </div>
        </div>
      </div>
      
      <div style={{
        flex: 1,
        display: 'flex',
        overflow: 'hidden'
      }}>
        {/* Contact List */}
        <div style={{
          width: '50%',
          borderRight: '1px solid #e2e8f0',
          overflowY: 'auto'
        }}>
          <div style={{ padding: '16px' }}>
            <h3 style={{
              fontSize: '16px',
              fontWeight: '600',
              marginBottom: '12px',
              color: '#1e293b'
            }}>Select Contacts to Enrich</h3>
            
            {contactsNeedingEnrichment.length === 0 ? (
              <div style={{
                textAlign: 'center',
                padding: '40px 20px',
                color: '#64748b'
              }}>
                <div style={{ fontSize: '48px', marginBottom: '16px' }}>🎉</div>
                <h3 style={{
                  fontSize: '16px',
                  fontWeight: '500',
                  marginBottom: '8px',
                  color: '#475569'
                }}>All contacts enriched!</h3>
                <p style={{ fontSize: '14px' }}>All your contacts have complete information.</p>
              </div>
            ) : (
              <>
                {/* Bulk Actions Toolbar */}
                {selectedContacts.length > 0 && !bulkEnriching && (
                  <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '12px',
                    background: '#eff6ff',
                    border: '1px solid #3b82f6',
                    borderRadius: '8px',
                    marginBottom: '12px'
                  }}>
                    <span style={{
                      fontSize: '14px',
                      fontWeight: '500',
                      color: '#1e293b'
                    }}>
                      {selectedContacts.length} selected
                    </span>
                    <div style={{ display: 'flex', gap: '8px' }}>
                      <button
                        onClick={enrichBulkContacts}
                        className="btn-primary"
                        style={{ fontSize: '13px' }}
                      >
                        ⚡ Enrich All
                      </button>
                      <button
                        onClick={() => setSelectedContacts([])}
                        className="btn-secondary"
                        style={{ fontSize: '13px' }}
                      >
                        Clear
                      </button>
                    </div>
                  </div>
                )}

                {/* Bulk Enrichment Progress */}
                {bulkEnriching && (
                  <div style={{
                    padding: '16px',
                    background: '#f0fdf4',
                    border: '1px solid #10b981',
                    borderRadius: '8px',
                    marginBottom: '12px'
                  }}>
                    <div style={{
                      fontSize: '14px',
                      fontWeight: '600',
                      color: '#065f46',
                      marginBottom: '8px'
                    }}>
                      ⚡ Enriching Contacts...
                    </div>
                    <div style={{
                      fontSize: '13px',
                      color: '#047857',
                      marginBottom: '8px'
                    }}>
                      {enrichmentProgress.current} of {enrichmentProgress.total}
                    </div>
                    <div className="progress-bar" style={{ height: '6px' }}>
                      <div
                        className="progress-fill"
                        style={{
                          width: `${(enrichmentProgress.current / enrichmentProgress.total) * 100}%`,
                          background: '#10b981'
                        }}
                      />
                    </div>
                  </div>
                )}

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
                    checked={selectedContacts.length === contactsNeedingEnrichment.length && contactsNeedingEnrichment.length > 0}
                    onChange={handleSelectAll}
                    disabled={bulkEnriching}
                    style={{
                      width: '16px',
                      height: '16px',
                      cursor: bulkEnriching ? 'not-allowed' : 'pointer'
                    }}
                  />
                  <span style={{ fontSize: '13px', color: '#64748b' }}>
                    Select all ({contactsNeedingEnrichment.length})
                  </span>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  {contactsNeedingEnrichment.map(contact => {
                    const isSelected = selectedContacts.includes(contact.id);
                    const isEnriched = isContactEnriched(contact);
                    return (
                      <div
                        key={contact.id}
                        className={`contact-item ${selectedContact?.id === contact.id ? 'selected' : ''}`}
                        style={{
                          padding: '12px',
                          border: isSelected ? '2px solid #3b82f6' : '1px solid #e2e8f0',
                          borderRadius: '8px',
                          background: isSelected ? '#eff6ff' : 'white',
                          boxShadow: '0 1px 2px rgba(0, 0, 0, 0.05)',
                          display: 'flex',
                          gap: '12px',
                          alignItems: 'flex-start',
                          opacity: bulkEnriching ? 0.6 : 1
                        }}
                      >
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={(e) => handleSelectContact(contact.id, e)}
                          onClick={(e) => e.stopPropagation()}
                          disabled={bulkEnriching}
                          style={{
                            width: '18px',
                            height: '18px',
                            cursor: bulkEnriching ? 'not-allowed' : 'pointer',
                            marginTop: '2px',
                            flexShrink: 0,
                            accentColor: '#3b82f6'
                          }}
                        />
                        <div
                          style={{ flex: 1, cursor: bulkEnriching ? 'not-allowed' : 'pointer' }}
                          onClick={() => !bulkEnriching && setSelectedContact(contact)}
                        >
                          <div style={{
                            display: 'flex',
                            justifyContent: 'space-between',
                            alignItems: 'flex-start',
                            marginBottom: '8px'
                          }}>
                            <div style={{
                              fontWeight: '600',
                              fontSize: '14px',
                              color: '#1e293b'
                            }}>{contact.name}</div>
                            <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
                              {isEnriched && (
                                <div style={{
                                  fontSize: '11px',
                                  fontWeight: '500',
                                  background: '#dbeafe',
                                  color: '#1e40af',
                                  padding: '2px 6px',
                                  borderRadius: '8px'
                                }}>
                                  ✨ Enriched
                                </div>
                              )}
                            </div>
                          </div>
                          <div style={{
                            fontSize: '12px',
                            color: '#64748b',
                            marginBottom: '4px'
                          }}>{contact.company}</div>
                          <div style={{
                            fontSize: '12px',
                            color: '#64748b'
                          }}>{contact.email}</div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </>
            )}
          </div>
        </div>
        
        {/* Enrichment Panel */}
        <div style={{
          width: '50%',
          padding: '16px',
          overflowY: 'auto'
        }}>
          {selectedContact ? (
            <div>
              <h3 style={{
                fontSize: '16px',
                fontWeight: '600',
                marginBottom: '12px',
                color: '#1e293b'
              }}>Enrichment Options</h3>
              
              <div style={{
                background: '#f8fafc',
                padding: '12px',
                borderRadius: '8px',
                marginBottom: '16px'
              }}>
                <div style={{
                  fontWeight: '600',
                  fontSize: '14px',
                  color: '#1e293b',
                  marginBottom: '4px'
                }}>{selectedContact.name}</div>
                <div style={{
                  fontSize: '12px',
                  color: '#64748b'
                }}>{selectedContact.company}</div>
              </div>
              
              <div className="checkbox-group">
                {Object.entries(enrichmentOptions).map(([key, value]) => (
                  <label key={key} className="checkbox-item">
                    <input
                      type="checkbox"
                      checked={value}
                      onChange={(e) => setEnrichmentOptions(prev => ({
                        ...prev,
                        [key]: e.target.checked
                      }))}
                      style={{ margin: 0 }}
                    />
                    <span style={{ fontSize: '13px' }}>
                      {key.replace(/([A-Z])/g, ' $1').replace(/^./, str => str.toUpperCase())}
                    </span>
                  </label>
                ))}
              </div>
              
              {/* Custom Fields Section */}
              <div style={{ marginTop: '16px', marginBottom: '16px' }}>
                <h4 style={{
                  fontSize: '14px',
                  fontWeight: '600',
                  marginBottom: '8px',
                  color: '#1e293b'
                }}>Custom Fields</h4>
                
                {/* Custom Field List */}
                {customFields.length > 0 && (
                  <div style={{ 
                    display: 'flex', 
                    flexDirection: 'column', 
                    gap: '6px',
                    marginBottom: '12px'
                  }}>
                    {customFields.map(field => (
                      <div key={field.id} style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        padding: '6px 10px',
                        background: '#f8fafc',
                        border: '1px solid #e2e8f0',
                        borderRadius: '6px',
                        fontSize: '12px'
                      }}>
                        <div style={{ flex: 1 }}>
                          <div style={{ fontWeight: '500', color: '#1e293b' }}>{field.name}</div>
                          <div style={{ fontSize: '11px', color: '#64748b' }}>{field.prompt}</div>
                        </div>
                        <button
                          onClick={() => removeCustomField(field.id)}
                          style={{
                            background: 'none',
                            border: 'none',
                            color: '#ef4444',
                            cursor: 'pointer',
                            padding: '4px',
                            fontSize: '14px'
                          }}
                        >×</button>
                      </div>
                    ))}
                  </div>
                )}
                
                {/* Add Custom Field Form */}
                <div style={{
                  background: '#f8fafc',
                  padding: '12px',
                  borderRadius: '8px',
                  border: '1px solid #e2e8f0'
                }}>
                  <input
                    type="text"
                    placeholder="Field name (e.g., Recent Awards)"
                    value={newFieldName}
                    onChange={(e) => setNewFieldName(e.target.value)}
                    className="form-input"
                    style={{ marginBottom: '8px', fontSize: '12px' }}
                  />
                  <input
                    type="text"
                    placeholder="Search prompt (e.g., recent awards achievements)"
                    value={newFieldPrompt}
                    onChange={(e) => setNewFieldPrompt(e.target.value)}
                    className="form-input"
                    style={{ marginBottom: '8px', fontSize: '12px' }}
                  />
                  <button
                    onClick={addCustomField}
                    className="btn-secondary"
                    style={{ width: '100%', fontSize: '12px' }}
                  >
                    + Add Custom Field
                  </button>
                </div>
              </div>
              
              <button
                onClick={() => enrichContact(selectedContact, enrichmentOptions)}
                disabled={isEnriching}
                className="btn-primary"
                style={{ width: '100%', marginBottom: '16px' }}
              >
                {isEnriching ? '🔍 Enriching...' : '🔍 Enrich Contact'}
              </button>
              
              {/* Enrichment Results */}
              {showResults && enrichmentResults && (
                <div style={{
                  background: '#f0fdf4',
                  border: '1px solid #10b981',
                  borderRadius: '8px',
                  padding: '16px',
                  maxHeight: '400px',
                  overflowY: 'auto'
                }}>
                  <h4 style={{
                    fontSize: '14px',
                    fontWeight: '600',
                    color: '#065f46',
                    marginBottom: '12px'
                  }}>✅ Enrichment Complete</h4>
                  
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                    {/* Preset Data */}
                    {enrichmentResults.presetData && Object.keys(enrichmentResults.presetData).length > 0 && (
                      <div>
                        <div style={{ fontSize: '12px', fontWeight: '600', color: '#065f46', marginBottom: '6px' }}>
                          Preset Fields:
                        </div>
                        {enrichmentResults.presetData.linkedin && (
                          <div style={{ fontSize: '11px', color: '#047857', marginBottom: '4px' }}>
                            <strong>LinkedIn:</strong> {enrichmentResults.presetData.linkedin}
                          </div>
                        )}
                        {enrichmentResults.presetData.twitter && (
                          <div style={{ fontSize: '11px', color: '#047857', marginBottom: '4px' }}>
                            <strong>Twitter:</strong> {enrichmentResults.presetData.twitter}
                          </div>
                        )}
                        {enrichmentResults.presetData.companySize && (
                          <div style={{ fontSize: '11px', color: '#047857', marginBottom: '4px' }}>
                            <strong>Company Size:</strong> {enrichmentResults.presetData.companySize} employees
                          </div>
                        )}
                        {enrichmentResults.presetData.industry && (
                          <div style={{ fontSize: '11px', color: '#047857', marginBottom: '4px' }}>
                            <strong>Industry:</strong> {enrichmentResults.presetData.industry}
                          </div>
                        )}
                        {enrichmentResults.presetData.revenue && (
                          <div style={{ fontSize: '11px', color: '#047857', marginBottom: '4px' }}>
                            <strong>Revenue:</strong> {enrichmentResults.presetData.revenue}
                          </div>
                        )}
                        {enrichmentResults.presetData.city && (
                          <div style={{ fontSize: '11px', color: '#047857', marginBottom: '4px' }}>
                            <strong>Location:</strong> {enrichmentResults.presetData.city}{enrichmentResults.presetData.state ? `, ${enrichmentResults.presetData.state}` : ''}{enrichmentResults.presetData.country ? `, ${enrichmentResults.presetData.country}` : ''}
                          </div>
                        )}
                        {enrichmentResults.presetData.seniority && (
                          <div style={{ fontSize: '11px', color: '#047857', marginBottom: '4px' }}>
                            <strong>Seniority:</strong> {enrichmentResults.presetData.seniority}
                          </div>
                        )}
                        {enrichmentResults.presetData.department && (
                          <div style={{ fontSize: '11px', color: '#047857', marginBottom: '4px' }}>
                            <strong>Department:</strong> {enrichmentResults.presetData.department}
                          </div>
                        )}
                      </div>
                    )}
                    
                    {/* Custom Fields */}
                    {enrichmentResults.customFields && Object.keys(enrichmentResults.customFields).length > 0 && (
                      <div style={{
                        borderTop: '1px solid #10b98120',
                        paddingTop: '12px'
                      }}>
                        <div style={{ fontSize: '12px', fontWeight: '600', color: '#065f46', marginBottom: '6px' }}>
                          Custom Fields:
                        </div>
                        {Object.entries(enrichmentResults.customFields).map(([key, value]) => (
                          <div key={key} style={{
                            marginBottom: '8px',
                            padding: '8px',
                            background: '#ffffff40',
                            borderRadius: '6px'
                          }}>
                            <div style={{ fontSize: '11px', fontWeight: '600', color: '#065f46', marginBottom: '2px' }}>
                              {key}:
                            </div>
                            <div style={{ fontSize: '11px', color: '#047857', lineHeight: '1.4' }}>
                              {value}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                  
                  <button
                    onClick={applyEnrichment}
                    className="btn-primary"
                    style={{ 
                      width: '100%', 
                      marginTop: '12px',
                      background: '#10b981'
                    }}
                  >
                    ✅ Apply Enrichment
                  </button>
                </div>
              )}
            </div>
          ) : (
            <div style={{
              textAlign: 'center',
              padding: '40px 20px',
              color: '#64748b'
            }}>
              <div style={{ fontSize: '48px', marginBottom: '16px' }}>👆</div>
              <h3 style={{
                fontSize: '16px',
                fontWeight: '500',
                marginBottom: '8px',
                color: '#475569'
              }}>Select a Contact</h3>
              <p style={{ fontSize: '14px' }}>Choose a contact from the list to start enriching their data.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default ContactEnricherWidget;
