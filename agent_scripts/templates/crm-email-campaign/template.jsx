import React, { useState, useMemo } from 'react';

function EmailCampaignWidget() {
  console.log('Email Campaign Generator rendering...');
  
  // Read contacts from global storage (no default - let Contact Directory initialize the data)
  const [contactData, setContactData] = useGlobalStorage('crm-contacts', { contacts: [] });
  
  // Local state
  const [selectedContacts, setSelectedContacts] = useState([]);
  const [campaignTemplate, setCampaignTemplate] = useState(`Dear [Name],

I hope this email finds you well. I noticed your work at [Company] and was particularly impressed by [Personalization Point].

I wanted to reach out because [Campaign Purpose]. Given your role as [Position] in the [Industry] industry, I believe this could be very valuable for [Company].

[Value Proposition]

Would you be interested in a brief conversation about this? I'd be happy to schedule a 15-minute call at your convenience.

Best regards,
[Your Name]`);
  
  const [campaignPurpose, setCampaignPurpose] = useState('');
  const [valueProposition, setValueProposition] = useState('');
  const [yourName, setYourName] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [generatedEmails, setGeneratedEmails] = useState([]);
  const [showResults, setShowResults] = useState(false);

  // Get contacts that have enough data for personalization
  const contactsForCampaign = useMemo(() => {
    return contactData.contacts.filter(contact => 
      contact.name // Only require name - email and company can be filled in the campaign
    );
  }, [contactData.contacts]);

  const handleSelectContact = (contactId, e) => {
    e.stopPropagation();
    setSelectedContacts(prev => 
      prev.includes(contactId)
        ? prev.filter(id => id !== contactId)
        : [...prev, contactId]
    );
  };

  const handleSelectAll = () => {
    if (selectedContacts.length === contactsForCampaign.length) {
      setSelectedContacts([]);
    } else {
      setSelectedContacts(contactsForCampaign.map(c => c.id));
    }
  };

  const generatePersonalizedEmails = async () => {
    if (selectedContacts.length === 0) return;
    
    setIsGenerating(true);
    setShowResults(false);
    setGeneratedEmails([]);
    
    const contactsToEmail = contactData.contacts.filter(c => selectedContacts.includes(c.id));
    const emails = [];
    
    for (let i = 0; i < contactsToEmail.length; i++) {
      const contact = contactsToEmail[i];
      
      try {
        // Build personalization data (only include fields that have actual data)
        const personalizationData = {
          name: contact.name,
          ...(contact.email && { email: contact.email }),
          ...(contact.company && { company: contact.company }),
          ...(contact.position && { position: contact.position }),
          ...(contact.industry && { industry: contact.industry }),
          ...(contact.linkedin && { linkedin: `LinkedIn: ${contact.linkedin}` }),
          ...(contact.companySize && { companySize: `${contact.companySize} employees` }),
          ...(contact.city && { city: contact.city }),
          ...(contact.state && { state: contact.state })
        };

        // Create personalization prompt from ALL enrichment data
        const personalizationPrompt = [
          // Preset enrichment fields
          personalizationData.companySize && `Company size: ${personalizationData.companySize}`,
          personalizationData.linkedin && `LinkedIn profile: ${personalizationData.linkedin}`,
          personalizationData.industry && `Industry: ${personalizationData.industry}`,
          personalizationData.city && `Location: ${personalizationData.city}`,
          personalizationData.seniority && `Seniority: ${personalizationData.seniority}`,
          // ALL custom enrichment fields (dynamic)
          ...(contact.customEnrichment ? Object.entries(contact.customEnrichment).map(([key, value]) => `${key}: ${value}`) : [])
        ].filter(Boolean).join(', ');

        // Generate personalized email using AI (no web search needed)
        console.log('🤖 Calling AI for email generation...');
        console.log('Contact:', contact.name);
        console.log('Personalization data:', personalizationPrompt);
        
        const generatedText = await miyagiAPI.post('generate-text', {
          prompt: `Generate a personalized business email for ${contact.name}${contact.company ? ` at ${contact.company}` : ''}. 

Campaign purpose: ${campaignPurpose}
Value proposition: ${valueProposition}
Personalization data: ${personalizationPrompt}

Use this template structure:
${campaignTemplate}`,
          system_prompt: `You are an expert email marketer. Generate a personalized business email based on the template and personalization data provided. 

Available Data:
- Name: ${personalizationData.name}
${personalizationData.company ? `- Company: ${personalizationData.company}` : ''}
${personalizationData.position ? `- Position: ${personalizationData.position}` : ''}
${personalizationData.industry ? `- Industry: ${personalizationData.industry}` : ''}
${personalizationPrompt ? `- Additional info: ${personalizationPrompt}` : ''}

Requirements:
1. Replace all [Placeholders] with actual data, or remove them entirely if no data is available
2. Add 1-2 personalized sentences based on the additional info (awards, projects, etc.)
3. Keep professional tone
4. Maintain the overall structure
5. Make it feel personal, not templated
6. NEVER use placeholders like [Company] or [Industry] if you don't have that data
7. Generate a professional subject line at the top

Format your response as:
SUBJECT: [Your generated subject line]

[Full email content]

Return ONLY the email with subject, no explanations.`,
          temperature: 0.7,
          max_tokens: 1000
        });

        console.log('🤖 AI Response:', generatedText);

        if (generatedText?.success && generatedText?.text) {
          // Parse subject line and email content
          const lines = generatedText.text.split('\n');
          let subject = '';
          let emailContent = '';
          
          if (lines[0].startsWith('SUBJECT:')) {
            subject = lines[0].replace('SUBJECT:', '').trim();
            emailContent = lines.slice(1).join('\n').trim();
          } else {
            // Fallback: generate subject from campaign purpose
            subject = `Re: ${campaignPurpose}`;
            emailContent = generatedText.text;
          }
          
          // Replace placeholders with actual data (safety fallback)
          let personalizedEmail = emailContent
            .replace(/\[Name\]/g, personalizationData.name)
            .replace(/\[Company\]/g, personalizationData.company || '')
            .replace(/\[Position\]/g, personalizationData.position || '')
            .replace(/\[Industry\]/g, personalizationData.industry || '')
            .replace(/\[Campaign Purpose\]/g, campaignPurpose)
            .replace(/\[Value Proposition\]/g, valueProposition)
            .replace(/\[Your Name\]/g, yourName || '[Your Name]')
            .replace(/\[Personalization Point\]/g, 'your recent work');

          emails.push({
            contact,
            email: personalizedEmail,
            subject: subject,
            personalizationData
          });
        }
      } catch (error) {
        console.error(`❌ Failed to generate email for ${contact.name}:`, error);
        console.error('Error details:', error.message, error.stack);
        console.log('🔄 Using fallback email instead');
        // Add fallback email
        emails.push({
          contact,
          email: generateFallbackEmail(contact),
          subject: `Re: ${campaignPurpose}${contact.company ? ` - ${contact.company}` : ''}`,
          personalizationData: { name: contact.name, company: contact.company }
        });
      }
    }
    
    setGeneratedEmails(emails);
    
    // Save emails to global storage for each contact
    const updatedContacts = contactData.contacts.map(contact => {
      const emailData = emails.find(e => e.contact.id === contact.id);
      if (emailData) {
        return {
          ...contact,
          emails: [
            ...(contact.emails || []),
            {
              id: Date.now().toString() + Math.random().toString(36).substr(2, 9),
              subject: emailData.subject,
              content: emailData.email,
              campaignPurpose: campaignPurpose,
              generatedAt: new Date().toISOString(),
              status: 'not_sent'
            }
          ]
        };
      }
      return contact;
    });
    
    setContactData({
      ...contactData,
      contacts: updatedContacts
    });
    
    setIsGenerating(false);
    setShowResults(true);
  };

  const generateFallbackEmail = (contact) => {
    return `Dear ${contact.name},

I hope this email finds you well.${contact.company ? ` I noticed your work at ${contact.company} and was particularly impressed by your recent initiatives.` : ''}

I wanted to reach out because ${campaignPurpose}.${contact.company ? ` Given your role, I believe this could be very valuable for ${contact.company}.` : ''}

${valueProposition}

Would you be interested in a brief conversation about this? I'd be happy to schedule a 15-minute call at your convenience.

Best regards,
${yourName || '[Your Name]'}`;
  };

  const copyToClipboard = (text) => {
    navigator.clipboard.writeText(text);
    // Could add a toast notification here
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
        }
        .contact-item:hover { 
          transform: translateY(-1px); 
          box-shadow: 0 4px 12px rgba(0,0,0,0.12); 
        }
        .contact-item input[type="checkbox"] {
          accent-color: #3b82f6;
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
        .form-textarea { 
          width: 100%; 
          padding: 8px 12px; 
          border: 1px solid #d1d5db; 
          border-radius: 6px; 
          font-size: 14px; 
          font-family: inherit;
          resize: vertical;
          min-height: 100px;
        }
        .form-textarea:focus { 
          outline: none; 
          border-color: #3b82f6; 
          box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.1); 
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
        }}>📧 Email Campaign Generator</h2>
        
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
            }}>{contactsForCampaign.length}</div>
            <div style={{
              fontSize: '10px',
              color: '#64748b',
              textAlign: 'center'
            }}>Available Contacts</div>
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
            }}>{selectedContacts.length}</div>
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
              color: '#10b981'
            }}>{generatedEmails.length}</div>
            <div style={{
              fontSize: '10px',
              color: '#64748b',
              textAlign: 'center'
            }}>Generated</div>
          </div>
        </div>
      </div>
      
      <div style={{
        flex: 1,
        display: 'flex',
        overflow: 'hidden'
      }}>
        {/* Left Panel - Contacts & Template */}
        <div style={{
          width: '50%',
          borderRight: '1px solid #e2e8f0',
          overflowY: 'auto',
          display: 'flex',
          flexDirection: 'column'
        }}>
          {/* Contact Selection */}
          <div style={{ padding: '16px', borderBottom: '1px solid #e2e8f0' }}>
            <h3 style={{
              fontSize: '16px',
              fontWeight: '600',
              marginBottom: '12px',
              color: '#1e293b'
            }}>Select Contacts</h3>
            
            {contactsForCampaign.length === 0 ? (
              <div style={{
                textAlign: 'center',
                padding: '20px',
                color: '#64748b'
              }}>
                <div style={{ fontSize: '24px', marginBottom: '8px' }}>📭</div>
                <p>No contacts available. Add contacts to the Contact Directory first.</p>
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
                    checked={selectedContacts.length === contactsForCampaign.length && contactsForCampaign.length > 0}
                    onChange={handleSelectAll}
                    style={{
                      width: '16px',
                      height: '16px',
                      cursor: 'pointer'
                    }}
                  />
                  <span style={{ fontSize: '13px', color: '#64748b' }}>
                    Select all ({contactsForCampaign.length})
                  </span>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', maxHeight: '200px', overflowY: 'auto' }}>
                  {contactsForCampaign.map(contact => {
                    const isSelected = selectedContacts.includes(contact.id);
                    const hasEnrichment = !!(contact.enrichedAt || contact.linkedin || contact.companySize);
                    return (
                      <div
                        key={contact.id}
                        style={{
                          padding: '8px',
                          border: isSelected ? '2px solid #3b82f6' : '1px solid #e2e8f0',
                          borderRadius: '6px',
                          background: isSelected ? '#eff6ff' : 'white',
                          display: 'flex',
                          gap: '8px',
                          alignItems: 'center'
                        }}
                      >
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={(e) => handleSelectContact(contact.id, e)}
                          style={{
                            width: '16px',
                            height: '16px',
                            cursor: 'pointer',
                            flexShrink: 0
                          }}
                        />
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{
                            fontSize: '13px',
                            fontWeight: '600',
                            color: '#1e293b',
                            marginBottom: '2px'
                          }}>{contact.name}</div>
                          <div style={{
                            fontSize: '11px',
                            color: '#64748b'
                          }}>{contact.company}</div>
                        </div>
                        {hasEnrichment && (
                          <div style={{
                            fontSize: '10px',
                            background: '#dbeafe',
                            color: '#1e40af',
                            padding: '2px 6px',
                            borderRadius: '6px'
                          }}>
                            ✨
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </>
            )}
          </div>

          {/* Campaign Settings */}
          <div style={{ padding: '16px' }}>
            <h3 style={{
              fontSize: '16px',
              fontWeight: '600',
              marginBottom: '12px',
              color: '#1e293b'
            }}>Campaign Settings</h3>
            
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <div>
                <label style={{
                  display: 'block',
                  marginBottom: '4px',
                  fontSize: '14px',
                  fontWeight: '500',
                  color: '#374151'
                }}>
                  Your Name
                </label>
                <input
                  type="text"
                  value={yourName}
                  onChange={(e) => setYourName(e.target.value)}
                  className="form-input"
                  placeholder="John Smith"
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
                  Campaign Purpose
                </label>
                <input
                  type="text"
                  value={campaignPurpose}
                  onChange={(e) => setCampaignPurpose(e.target.value)}
                  className="form-input"
                  placeholder="e.g., Introducing our new AI platform"
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
                  Value Proposition
                </label>
                <textarea
                  value={valueProposition}
                  onChange={(e) => setValueProposition(e.target.value)}
                  className="form-textarea"
                  placeholder="e.g., Our platform can increase your team's productivity by 40%..."
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
                  Email Template
                </label>
                <textarea
                  value={campaignTemplate}
                  onChange={(e) => setCampaignTemplate(e.target.value)}
                  className="form-textarea"
                  style={{ minHeight: '120px' }}
                  placeholder="Use [Name], [Company], [Position], etc. as placeholders"
                />
              </div>
            </div>
            
            <button
              onClick={generatePersonalizedEmails}
              disabled={selectedContacts.length === 0 || isGenerating}
              className="btn-primary"
              style={{ 
                width: '100%', 
                marginTop: '16px',
                fontSize: '14px'
              }}
            >
              {isGenerating ? '🤖 Generating...' : `📧 Generate ${selectedContacts.length} Emails`}
            </button>
          </div>
        </div>
        
        {/* Right Panel - Generated Emails */}
        <div style={{
          width: '50%',
          padding: '16px',
          overflowY: 'auto'
        }}>
          <h3 style={{
            fontSize: '16px',
            fontWeight: '600',
            marginBottom: '12px',
            color: '#1e293b'
          }}>Generated Emails</h3>
          
          {!showResults ? (
            <div style={{
              textAlign: 'center',
              padding: '40px 20px',
              color: '#64748b'
            }}>
              <div style={{ fontSize: '48px', marginBottom: '16px' }}>📧</div>
              <h3 style={{
                fontSize: '16px',
                fontWeight: '500',
                marginBottom: '8px',
                color: '#475569'
              }}>Generate Personalized Emails</h3>
              <p style={{ fontSize: '14px' }}>Select contacts and customize your campaign settings to generate personalized emails.</p>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              {generatedEmails.map((emailData, index) => (
                <div
                  key={index}
                  style={{
                    padding: '16px',
                    border: '1px solid #e2e8f0',
                    borderRadius: '8px',
                    background: 'white'
                  }}
                >
                  <div style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'flex-start',
                    marginBottom: '12px'
                  }}>
                    <div>
                      <div style={{
                        fontSize: '14px',
                        fontWeight: '600',
                        color: '#1e293b',
                        marginBottom: '4px'
                      }}>{emailData.contact.name}</div>
                      <div style={{
                        fontSize: '12px',
                        color: '#64748b'
                      }}>{emailData.contact.company}</div>
                    </div>
                    <button
                      onClick={() => copyToClipboard(emailData.email)}
                      className="btn-secondary"
                      style={{ fontSize: '12px', padding: '4px 8px' }}
                    >
                      📋 Copy
                    </button>
                  </div>
                  
                  <div style={{
                    fontSize: '12px',
                    fontWeight: '600',
                    color: '#374151',
                    marginBottom: '8px'
                  }}>
                    Subject: {emailData.subject}
                  </div>
                  
                  <div style={{
                    fontSize: '13px',
                    color: '#1e293b',
                    lineHeight: '1.6',
                    whiteSpace: 'pre-wrap',
                    background: '#f8fafc',
                    padding: '12px',
                    borderRadius: '6px',
                    border: '1px solid #e2e8f0'
                  }}>
                    {emailData.email}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default EmailCampaignWidget;
