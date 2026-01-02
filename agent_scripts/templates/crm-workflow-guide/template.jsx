import React, { useState, useEffect } from 'react';

function CRMWorkflowGuide() {
  console.log('CRM Workflow Guide rendering...');
  
  // Track which step is currently active/highlighted
  const [activeStep, setActiveStep] = useState(null);
  const [animatingFlow, setAnimatingFlow] = useState(false);
  const [completedSteps, setCompletedSteps] = useState([]);
  
  // Tutorial mode state
  const [tutorialMode, setTutorialMode] = useState(false);
  const [tutorialStep, setTutorialStep] = useState(0);
  const [hasSeenTutorial, setHasSeenTutorial] = useGlobalStorage('crm-workflow-tutorial-seen', false);
  
  // Feedback state
  const [launchingWidget, setLaunchingWidget] = useState(null);
  const [successMessage, setSuccessMessage] = useState(null);
  
  // Read data from global storage to detect progress
  const [contactData] = useGlobalStorage('crm-contacts', { contacts: [] });
  const [scheduledEmails] = useGlobalStorage('scheduled-emails', { emails: [] });
  
  // Calculate workflow progress based on actual data
  const workflowProgress = {
    hasContacts: contactData.contacts.length > 0,
    hasEnrichedContacts: contactData.contacts.some(c => c.linkedin || c.companySize || c.industry),
    hasCampaigns: false, // Could track generated campaigns if you add that to storage
    hasScheduledEmails: scheduledEmails.emails.length > 0
  };
  
  const steps = [
    {
      id: 'directory',
      templateId: 'crm-contact-directory',
      number: 1,
      title: 'Contact Directory',
      icon: '👥',
      description: 'Import and manage your contacts',
      details: 'Start by adding contacts manually or importing from CSV. This is your central database.',
      tutorialText: 'Start here! Add your contacts manually, import from a file, or sync with Google Contacts. This becomes your central contact database.',
      color: '#3b82f6',
      gradient: 'linear-gradient(135deg, #3b82f6 0%, #2563eb 100%)',
      status: workflowProgress.hasContacts ? 'completed' : 'pending',
      dataCount: contactData.contacts.length,
      dataLabel: 'contacts'
    },
    {
      id: 'enricher',
      templateId: 'crm-contact-enricher',
      number: 2,
      title: 'Contact Enricher',
      icon: '✨',
      description: 'Enhance contacts with AI-powered data',
      details: 'Automatically enrich contacts with LinkedIn profiles, company size, industry data, and custom fields.',
      tutorialText: 'Once you have contacts, use AI to enrich them with LinkedIn profiles, company data, industry info, and custom fields. This makes your outreach super personalized!',
      color: '#8b5cf6',
      gradient: 'linear-gradient(135deg, #8b5cf6 0%, #7c3aed 100%)',
      status: workflowProgress.hasEnrichedContacts ? 'completed' : workflowProgress.hasContacts ? 'ready' : 'locked',
      dataCount: contactData.contacts.filter(c => c.linkedin || c.companySize).length,
      dataLabel: 'enriched'
    },
    {
      id: 'campaign',
      templateId: 'crm-email-campaign',
      number: 3,
      title: 'Email Campaign',
      icon: '📧',
      description: 'Generate personalized email campaigns',
      details: 'Create highly personalized emails using AI based on enrichment data for each contact.',
      tutorialText: 'Now generate personalized email campaigns! The AI uses all the enrichment data to create unique, relevant emails for each contact. Much better than generic templates!',
      color: '#f59e0b',
      gradient: 'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)',
      status: workflowProgress.hasEnrichedContacts ? 'ready' : 'locked',
      dataCount: 0, // Track if you add campaign storage
      dataLabel: 'campaigns'
    },
    {
      id: 'scheduler',
      templateId: 'crm-email-scheduler',
      number: 4,
      title: 'Email Scheduler',
      icon: '📅',
      description: 'Schedule and track email delivery',
      details: 'Set optimal send times, manage follow-ups, and track email performance.',
      tutorialText: 'Finally, schedule your emails for optimal send times! Set up follow-up sequences and track delivery. Your automated CRM pipeline is complete! 🎉',
      color: '#10b981',
      gradient: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
      status: workflowProgress.hasScheduledEmails ? 'completed' : 'ready',
      dataCount: scheduledEmails.emails.length,
      dataLabel: 'scheduled'
    }
  ];
  
  // Auto-play flow animation on mount and check if tutorial should auto-start
  useEffect(() => {
    const timer = setTimeout(() => {
      playFlowAnimation();
      
      // Auto-start tutorial for first-time users
      if (!hasSeenTutorial && contactData.contacts.length === 0) {
        setTimeout(() => {
          setTutorialMode(true);
          setTutorialStep(0);
        }, 3000);
      }
    }, 1000);
    return () => clearTimeout(timer);
  }, []);
  
  const playFlowAnimation = () => {
    setAnimatingFlow(true);
    setActiveStep(null);
    
    steps.forEach((step, index) => {
      setTimeout(() => {
        setActiveStep(step.id);
        if (index === steps.length - 1) {
          setTimeout(() => {
            setAnimatingFlow(false);
            setActiveStep(null);
          }, 1500);
        }
      }, index * 1500);
    });
  };
  
  const getStatusIcon = (status) => {
    switch (status) {
      case 'completed': return '✅';
      case 'ready': return '▶️';
      case 'locked': return '🔒';
      default: return '⭕';
    }
  };
  
  const getStatusColor = (status) => {
    switch (status) {
      case 'completed': return '#10b981';
      case 'ready': return '#3b82f6';
      case 'locked': return '#9ca3af';
      default: return '#d1d5db';
    }
  };
  
  const handleLaunchWidget = async (templateId) => {
    try {
      setLaunchingWidget(templateId);
      console.log('🚀 Launching widget:', templateId);
      
      // TODO: Fix this - the add_widget endpoint has been removed from canvas-tools.
      // This should use WidgetCreationService.createWidgetFrontend() instead,
      // but that requires access to the editor instance which isn't available in widget templates.
      // Need to either:
      // 1. Add a createWidget() global API function injected by MiyagiStorageService
      // 2. Use a postMessage-based approach to request widget creation from parent
      // 3. Convert this to a regular component that has access to useEditor()
      const result = await miyagiAPI.post('/api/canvas/canvas-tools', {
        tool: 'add_widget',
        params: {
          templateHandle: templateId,
          position: { x: 100, y: 100 }, // Default position - backend will auto-detect page
          size: { w: 450, h: 600 }
        }
      });
      
      setLaunchingWidget(null);
      
      if (result.success) {
        console.log('✅ Widget created successfully:', result.shapeId);
        const widgetName = steps.find(s => s.templateId === templateId)?.title || 'Widget';
        setSuccessMessage(`✅ ${widgetName} launched successfully!`);
        setTimeout(() => setSuccessMessage(null), 3000);
      } else {
        console.error('❌ Failed to create widget:', result.error);
        setSuccessMessage('❌ Failed to launch widget. Please try again.');
        setTimeout(() => setSuccessMessage(null), 3000);
      }
    } catch (error) {
      setLaunchingWidget(null);
      console.error('❌ Error launching widget:', error);
      setSuccessMessage('❌ Error launching widget. Please use the Add menu.');
      setTimeout(() => setSuccessMessage(null), 3000);
    }
  };
  
  const startTutorial = () => {
    setTutorialMode(true);
    setTutorialStep(0);
    setActiveStep(steps[0].id);
  };
  
  const nextTutorialStep = () => {
    if (tutorialStep < steps.length - 1) {
      const nextStep = tutorialStep + 1;
      setTutorialStep(nextStep);
      setActiveStep(steps[nextStep].id);
    } else {
      endTutorial();
    }
  };
  
  const prevTutorialStep = () => {
    if (tutorialStep > 0) {
      const prevStep = tutorialStep - 1;
      setTutorialStep(prevStep);
      setActiveStep(steps[prevStep].id);
    }
  };
  
  const endTutorial = () => {
    setTutorialMode(false);
    setTutorialStep(0);
    setActiveStep(null);
    setHasSeenTutorial(true);
  };
  
  return (
    <div style={{
      height: '100%',
      display: 'flex',
      flexDirection: 'column',
      background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
      fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
      overflow: 'hidden',
      position: 'relative'
    }}>
      <style>{`
        @keyframes pulse {
          0%, 100% { transform: scale(1); opacity: 1; }
          50% { transform: scale(1.05); opacity: 0.8; }
        }
        
        @keyframes flowLine {
          0% { stroke-dashoffset: 1000; }
          100% { stroke-dashoffset: 0; }
        }
        
        @keyframes glow {
          0%, 100% { box-shadow: 0 0 20px rgba(59, 130, 246, 0.5); }
          50% { box-shadow: 0 0 40px rgba(59, 130, 246, 0.8); }
        }
        
        .step-card {
          transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
          cursor: pointer;
        }
        
        .step-card:hover {
          transform: translateY(-8px) scale(1.02);
        }
        
        .step-card.active {
          animation: glow 2s infinite;
          transform: scale(1.05);
        }
        
        .connection-line {
          stroke-dasharray: 10;
          stroke-dashoffset: 1000;
        }
        
        .connection-line.animating {
          animation: flowLine 1.5s ease-out forwards;
        }
        
        .data-badge {
          animation: pulse 2s infinite;
        }
        
        .play-button {
          transition: all 0.3s;
        }
        
        .play-button:hover {
          transform: scale(1.1);
          box-shadow: 0 8px 20px rgba(0, 0, 0, 0.3);
        }
        
        .launch-button {
          transition: all 0.3s;
          transform: scale(0.95);
        }
        
        .launch-button:hover {
          transform: scale(1);
          box-shadow: 0 4px 12px rgba(0, 0, 0, 0.2);
        }
        
        .tutorial-tooltip {
          animation: tooltipFadeIn 0.3s ease-out;
        }
        
        @keyframes tooltipFadeIn {
          from {
            opacity: 0;
            transform: translateY(-10px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
        
        .tutorial-overlay {
          position: fixed;
          top: 0;
          left: 0;
          right: 0;
          bottom: 0;
          background: rgba(0, 0, 0, 0.7);
          z-index: 999;
          animation: fadeIn 0.3s;
        }
        
        @keyframes fadeIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }
        
        .success-toast {
          animation: slideInDown 0.3s ease-out;
        }
        
        @keyframes slideInDown {
          from {
            opacity: 0;
            transform: translateY(-20px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
      `}</style>
      
      {/* Success Toast */}
      {successMessage && (
        <div className="success-toast" style={{
          position: 'fixed',
          top: '20px',
          left: '50%',
          transform: 'translateX(-50%)',
          background: successMessage.includes('❌') ? '#ef4444' : '#10b981',
          color: 'white',
          padding: '12px 24px',
          borderRadius: '8px',
          boxShadow: '0 4px 12px rgba(0, 0, 0, 0.3)',
          zIndex: 10000,
          fontSize: '14px',
          fontWeight: '600'
        }}>
          {successMessage}
        </div>
      )}
      
      {/* Header */}
      <div style={{
        padding: '24px',
        background: 'rgba(255, 255, 255, 0.1)',
        backdropFilter: 'blur(10px)',
        borderBottom: '1px solid rgba(255, 255, 255, 0.2)'
      }}>
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center'
        }}>
          <div>
            <h2 style={{
              fontSize: '24px',
              fontWeight: '700',
              color: 'white',
              margin: '0 0 8px 0',
              textShadow: '0 2px 4px rgba(0, 0, 0, 0.2)'
            }}>🚀 CRM Workflow Journey</h2>
            <p style={{
              fontSize: '14px',
              color: 'rgba(255, 255, 255, 0.9)',
              margin: 0
            }}>Your automated path from contacts to campaigns</p>
          </div>
          
          <div style={{ display: 'flex', gap: '8px' }}>
            <button
              className="play-button"
              onClick={startTutorial}
              style={{
                padding: '12px 24px',
                background: 'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)',
                color: 'white',
                border: 'none',
                borderRadius: '12px',
                cursor: 'pointer',
                fontSize: '14px',
                fontWeight: '600',
                display: 'flex',
                alignItems: 'center',
                gap: '8px'
              }}
            >
              🎓 Start Tutorial
            </button>
            
            <button
              className="play-button"
              onClick={playFlowAnimation}
              disabled={animatingFlow}
              style={{
                padding: '12px 24px',
                background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
                color: 'white',
                border: 'none',
                borderRadius: '12px',
                cursor: animatingFlow ? 'not-allowed' : 'pointer',
                fontSize: '14px',
                fontWeight: '600',
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                opacity: animatingFlow ? 0.6 : 1
              }}
            >
              {animatingFlow ? '⏸️ Playing...' : '▶️ Show Flow'}
            </button>
          </div>
        </div>
      </div>
      
      {/* Workflow Steps */}
      <div style={{
        flex: 1,
        padding: '32px 24px',
        overflowY: 'auto',
        position: 'relative'
      }}>
        <div style={{
          display: 'flex',
          flexDirection: 'column',
          gap: '24px',
          maxWidth: '600px',
          margin: '0 auto',
          position: 'relative'
        }}>
          {/* SVG for connection lines */}
          <svg
            style={{
              position: 'absolute',
              top: 0,
              left: '50%',
              transform: 'translateX(-50%)',
              width: '100%',
              height: '100%',
              pointerEvents: 'none',
              zIndex: 0
            }}
          >
            {steps.slice(0, -1).map((step, index) => (
              <line
                key={`line-${step.id}`}
                className={`connection-line ${animatingFlow ? 'animating' : ''}`}
                x1="50%"
                y1={150 + index * 220}
                x2="50%"
                y2={150 + (index + 1) * 220 - 70}
                stroke="rgba(255, 255, 255, 0.3)"
                strokeWidth="3"
                strokeDasharray="10, 5"
                style={{
                  animationDelay: `${index * 1.5}s`
                }}
              />
            ))}
          </svg>
          
          {steps.map((step, index) => (
            <div
              key={step.id}
              className={`step-card ${activeStep === step.id ? 'active' : ''}`}
              onClick={() => !tutorialMode && setActiveStep(activeStep === step.id ? null : step.id)}
              onMouseEnter={() => !animatingFlow && !tutorialMode && setActiveStep(step.id)}
              onMouseLeave={() => !animatingFlow && !tutorialMode && setActiveStep(null)}
              style={{
                background: 'white',
                borderRadius: '16px',
                padding: '24px',
                boxShadow: activeStep === step.id 
                  ? `0 20px 40px rgba(0, 0, 0, 0.3)` 
                  : '0 4px 12px rgba(0, 0, 0, 0.15)',
                position: 'relative',
                zIndex: tutorialMode && tutorialStep === index ? 1000 : (activeStep === step.id ? 10 : 1),
                border: `3px solid ${activeStep === step.id ? step.color : 'transparent'}`
              }}
            >
              <div style={{ display: 'flex', gap: '16px', alignItems: 'flex-start' }}>
                {/* Step Number Circle */}
                <div style={{
                  width: '56px',
                  height: '56px',
                  borderRadius: '50%',
                  background: step.gradient,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexShrink: 0,
                  fontSize: '24px',
                  fontWeight: '700',
                  color: 'white',
                  boxShadow: `0 4px 12px ${step.color}40`,
                  position: 'relative'
                }}>
                  {step.icon}
                  <div style={{
                    position: 'absolute',
                    top: '-6px',
                    right: '-6px',
                    background: 'white',
                    borderRadius: '50%',
                    width: '24px',
                    height: '24px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: '12px',
                    fontWeight: '700',
                    color: step.color,
                    boxShadow: '0 2px 8px rgba(0, 0, 0, 0.2)'
                  }}>
                    {step.number}
                  </div>
                </div>
                
                {/* Step Content */}
                <div style={{ flex: 1 }}>
                  <div style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'flex-start',
                    marginBottom: '8px'
                  }}>
                    <h3 style={{
                      fontSize: '18px',
                      fontWeight: '700',
                      color: '#1e293b',
                      margin: 0
                    }}>{step.title}</h3>
                    
                    <div style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '8px'
                    }}>
                      {step.dataCount > 0 && (
                        <div className="data-badge" style={{
                          padding: '4px 12px',
                          background: step.gradient,
                          color: 'white',
                          borderRadius: '12px',
                          fontSize: '12px',
                          fontWeight: '600'
                        }}>
                          {step.dataCount} {step.dataLabel}
                        </div>
                      )}
                      <div style={{
                        fontSize: '18px'
                      }}>
                        {getStatusIcon(step.status)}
                      </div>
                    </div>
                  </div>
                  
                  <p style={{
                    fontSize: '14px',
                    color: '#64748b',
                    margin: '0 0 12px 0',
                    fontWeight: '500'
                  }}>{step.description}</p>
                  
                  {/* Expanded details on hover/click */}
                  {activeStep === step.id && (
                    <div style={{
                      marginTop: '16px',
                      padding: '16px',
                      background: `linear-gradient(135deg, ${step.color}10 0%, ${step.color}05 100%)`,
                      borderRadius: '12px',
                      borderLeft: `4px solid ${step.color}`
                    }}>
                      <p style={{
                        fontSize: '13px',
                        color: '#475569',
                        margin: '0 0 12px 0',
                        lineHeight: '1.6'
                      }}>{step.details}</p>
                      
                      <div style={{
                        display: 'flex',
                        gap: '12px',
                        flexWrap: 'wrap',
                        marginBottom: '12px'
                      }}>
                        <div style={{
                          padding: '6px 12px',
                          background: 'white',
                          borderRadius: '8px',
                          fontSize: '12px',
                          color: '#64748b',
                          border: '1px solid #e2e8f0'
                        }}>
                          Status: <strong style={{ color: getStatusColor(step.status) }}>
                            {step.status.charAt(0).toUpperCase() + step.status.slice(1)}
                          </strong>
                        </div>
                        
                        {index < steps.length - 1 && (
                          <div style={{
                            padding: '6px 12px',
                            background: 'white',
                            borderRadius: '8px',
                            fontSize: '12px',
                            color: '#64748b',
                            border: '1px solid #e2e8f0'
                          }}>
                            Next: <strong>{steps[index + 1].title}</strong>
                          </div>
                        )}
                      </div>
                      
                      {/* Quick Action Button */}
                      <button
                        className="launch-button"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleLaunchWidget(step.templateId);
                        }}
                        disabled={launchingWidget === step.templateId}
                        style={{
                          width: '100%',
                          padding: '12px',
                          background: launchingWidget === step.templateId ? '#9ca3af' : step.gradient,
                          color: 'white',
                          border: 'none',
                          borderRadius: '8px',
                          cursor: launchingWidget === step.templateId ? 'not-allowed' : 'pointer',
                          fontSize: '14px',
                          fontWeight: '600',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          gap: '8px',
                          opacity: launchingWidget === step.templateId ? 0.6 : 1
                        }}
                      >
                        {launchingWidget === step.templateId ? (
                          <>⏳ Launching...</>
                        ) : (
                          <>🚀 Launch {step.title}</>
                        )}
                      </button>
                    </div>
                  )}
                  
                  {/* Tutorial Tooltip */}
                  {tutorialMode && tutorialStep === index && (
                    <div className="tutorial-tooltip" style={{
                      position: 'absolute',
                      top: '-120px',
                      left: '50%',
                      transform: 'translateX(-50%)',
                      background: 'white',
                      padding: '16px',
                      borderRadius: '12px',
                      boxShadow: '0 8px 24px rgba(0, 0, 0, 0.2)',
                      maxWidth: '300px',
                      zIndex: 1001,
                      border: `3px solid ${step.color}`
                    }}>
                      <div style={{
                        fontSize: '14px',
                        fontWeight: '600',
                        color: '#1e293b',
                        marginBottom: '8px',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '8px'
                      }}>
                        <span style={{
                          width: '24px',
                          height: '24px',
                          borderRadius: '50%',
                          background: step.gradient,
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          color: 'white',
                          fontSize: '12px',
                          fontWeight: '700'
                        }}>
                          {index + 1}
                        </span>
                        Step {index + 1} of {steps.length}
                      </div>
                      <p style={{
                        fontSize: '13px',
                        color: '#475569',
                        margin: '0 0 12px 0',
                        lineHeight: '1.5'
                      }}>
                        {step.tutorialText}
                      </p>
                      
                      <div style={{
                        display: 'flex',
                        gap: '8px',
                        justifyContent: 'space-between'
                      }}>
                        <button
                          onClick={endTutorial}
                          style={{
                            padding: '6px 12px',
                            background: 'white',
                            color: '#64748b',
                            border: '1px solid #e2e8f0',
                            borderRadius: '6px',
                            cursor: 'pointer',
                            fontSize: '12px',
                            fontWeight: '500'
                          }}
                        >
                          Skip
                        </button>
                        
                        <div style={{ display: 'flex', gap: '8px' }}>
                          {index > 0 && (
                            <button
                              onClick={prevTutorialStep}
                              style={{
                                padding: '6px 12px',
                                background: 'white',
                                color: '#64748b',
                                border: '1px solid #e2e8f0',
                                borderRadius: '6px',
                                cursor: 'pointer',
                                fontSize: '12px',
                                fontWeight: '500'
                              }}
                            >
                              ← Back
                            </button>
                          )}
                          
                          <button
                            onClick={nextTutorialStep}
                            style={{
                              padding: '6px 12px',
                              background: step.gradient,
                              color: 'white',
                              border: 'none',
                              borderRadius: '6px',
                              cursor: 'pointer',
                              fontSize: '12px',
                              fontWeight: '600'
                            }}
                          >
                            {index === steps.length - 1 ? '✓ Done' : 'Next →'}
                          </button>
                        </div>
                      </div>
                      
                      {/* Tooltip arrow */}
                      <div style={{
                        position: 'absolute',
                        bottom: '-10px',
                        left: '50%',
                        transform: 'translateX(-50%)',
                        width: 0,
                        height: 0,
                        borderLeft: '10px solid transparent',
                        borderRight: '10px solid transparent',
                        borderTop: `10px solid ${step.color}`
                      }} />
                    </div>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
      
      {/* Footer Stats */}
      <div style={{
        padding: '20px 24px',
        background: 'rgba(255, 255, 255, 0.1)',
        backdropFilter: 'blur(10px)',
        borderTop: '1px solid rgba(255, 255, 255, 0.2)'
      }}>
        <div style={{
          display: 'flex',
          justifyContent: 'space-around',
          maxWidth: '600px',
          margin: '0 auto'
        }}>
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: '24px', fontWeight: '700', color: 'white' }}>
              {contactData.contacts.length}
            </div>
            <div style={{ fontSize: '12px', color: 'rgba(255, 255, 255, 0.8)' }}>
              Total Contacts
            </div>
          </div>
          
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: '24px', fontWeight: '700', color: 'white' }}>
              {contactData.contacts.filter(c => c.linkedin || c.companySize).length}
            </div>
            <div style={{ fontSize: '12px', color: 'rgba(255, 255, 255, 0.8)' }}>
              Enriched
            </div>
          </div>
          
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: '24px', fontWeight: '700', color: 'white' }}>
              {scheduledEmails.emails.length}
            </div>
            <div style={{ fontSize: '12px', color: 'rgba(255, 255, 255, 0.8)' }}>
              Scheduled
            </div>
          </div>
          
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: '24px', fontWeight: '700', color: 'white' }}>
              {Math.round((steps.filter(s => s.status === 'completed').length / steps.length) * 100)}%
            </div>
            <div style={{ fontSize: '12px', color: 'rgba(255, 255, 255, 0.8)' }}>
              Complete
            </div>
          </div>
        </div>
      </div>
      
      {/* Tutorial Overlay */}
      {tutorialMode && (
        <div 
          className="tutorial-overlay"
          onClick={endTutorial}
        />
      )}
    </div>
  );
}

export default CRMWorkflowGuide;

