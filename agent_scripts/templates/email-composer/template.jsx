import React, { useState, useEffect, useRef } from 'react';

function EmailComposerWidget() {
  const [formData, setFormData] = useState({
    recipient: '',
    subject: '',
    content: ''
  });
  const [status, setStatus] = useState({ type: '', message: '', visible: false });
  const [charCount, setCharCount] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const [showOAuth, setShowOAuth] = useState(false);
  
  const formRef = useRef(null);

  useEffect(() => {
    setCharCount(formData.content.length);
  }, [formData.content]);

  const handleInputChange = (field, value) => {
    setFormData(prev => ({
      ...prev,
      [field]: value
    }));
  };

  const showStatus = (type, message) => {
    setStatus({ type, message, visible: true });
    setTimeout(() => {
      setStatus(prev => ({ ...prev, visible: false }));
    }, 5000);
  };

  const clearForm = () => {
    setFormData({
      recipient: '',
      subject: '',
      content: ''
    });
  };

  const validateForm = () => {
    if (!formData.recipient.trim()) {
      showStatus('error', 'Please enter a recipient email address');
      return false;
    }
    
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(formData.recipient.trim())) {
      showStatus('error', 'Please enter a valid email address');
      return false;
    }
    
    if (!formData.subject.trim()) {
      showStatus('error', 'Please enter a subject');
      return false;
    }
    
    if (!formData.content.trim()) {
      showStatus('error', 'Please enter a message');
      return false;
    }
    
    return true;
  };

  const sendEmail = async (e) => {
    e.preventDefault();
    
    if (!validateForm()) return;

    setIsLoading(true);
    setStatus({ type: '', message: '', visible: false });
    setShowOAuth(false);

    try {
      const result = await miyagiAPI.post('/api/integrations/send-email', {
        recipient: formData.recipient.trim(),
        subject: formData.subject.trim(),
        content: formData.content.trim()
      });

      if (result && result.success) {
        showStatus('success', `✅ Email sent successfully to ${formData.recipient}!`);
        clearForm();
      } else if (result && result.requiresOAuth) {
        setShowOAuth(true);
        showStatus('error', 'Please connect your Google account in the integrations panel to send emails.');
      } else {
        showStatus('error', result?.message || 'Failed to send email. Please try again.');
      }

    } catch (error) {
      console.error('Email send failed:', error);
      showStatus('error', `Failed to send email: ${error.message || 'Network error occurred'}`);
    } finally {
      setIsLoading(false);
    }
  };

  const handleOAuthConnect = () => {
    setShowOAuth(false);
    showStatus('success', 'Please try sending your email again after connecting your account.');
  };

  return (
    <div style={{
      padding: '20px',
      fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif',
      background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
      minHeight: '100vh',
      boxSizing: 'border-box'
    }}>
      <div style={{
        maxWidth: '700px',
        margin: '0 auto',
        background: 'rgba(255, 255, 255, 0.95)',
        borderRadius: '20px',
        backdropFilter: 'blur(20px)',
        boxShadow: '0 20px 40px rgba(0, 0, 0, 0.1)',
        overflow: 'hidden',
        animation: 'fadeIn 0.5s ease-in-out'
      }}>
        {/* Header */}
        <div style={{
          background: 'linear-gradient(135deg, #4f46e5 0%, #7c3aed 100%)',
          color: 'white',
          padding: '30px',
          textAlign: 'center',
          position: 'relative'
        }}>
          <div style={{ position: 'relative', zIndex: 1 }}>
            <h1 style={{
              fontSize: '32px',
              fontWeight: '700',
              margin: '0 0 8px 0',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '12px'
            }}>
              <span>📧</span>
              <span>Email Composer</span>
            </h1>
            <p style={{
              fontSize: '16px',
              opacity: 0.9,
              fontWeight: '400',
              margin: 0
            }}>
              Send professional emails through your Gmail account
            </p>
          </div>
        </div>

        <div style={{ padding: '40px' }}>
          {/* Features Grid */}
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
            gap: '20px',
            margin: '0 0 32px 0'
          }}>
            <div style={{
              background: 'linear-gradient(135deg, #f8fafc 0%, #f1f5f9 100%)',
              padding: '20px',
              borderRadius: '12px',
              border: '1px solid #e2e8f0',
              textAlign: 'center'
            }}>
              <div style={{ fontSize: '32px', marginBottom: '12px' }}>🔒</div>
              <div style={{ fontWeight: '600', color: '#374151', marginBottom: '8px' }}>Secure OAuth</div>
              <div style={{ fontSize: '14px', color: '#6b7280', lineHeight: '1.5' }}>
                Connect safely with Google OAuth 2.0
              </div>
            </div>
            <div style={{
              background: 'linear-gradient(135deg, #f8fafc 0%, #f1f5f9 100%)',
              padding: '20px',
              borderRadius: '12px',
              border: '1px solid #e2e8f0',
              textAlign: 'center'
            }}>
              <div style={{ fontSize: '32px', marginBottom: '12px' }}>⚡</div>
              <div style={{ fontWeight: '600', color: '#374151', marginBottom: '8px' }}>Instant Send</div>
              <div style={{ fontSize: '14px', color: '#6b7280', lineHeight: '1.5' }}>
                Send emails directly from your Gmail
              </div>
            </div>
            <div style={{
              background: 'linear-gradient(135deg, #f8fafc 0%, #f1f5f9 100%)',
              padding: '20px',
              borderRadius: '12px',
              border: '1px solid #e2e8f0',
              textAlign: 'center'
            }}>
              <div style={{ fontSize: '32px', marginBottom: '12px' }}>📱</div>
              <div style={{ fontWeight: '600', color: '#374151', marginBottom: '8px' }}>Responsive</div>
              <div style={{ fontSize: '14px', color: '#6b7280', lineHeight: '1.5' }}>
                Works perfectly on all devices
              </div>
            </div>
          </div>

          {/* Form */}
          <form ref={formRef} onSubmit={sendEmail} style={{ marginBottom: '32px' }}>
            <div style={{ marginBottom: '24px' }}>
              <label
                htmlFor="recipient"
                style={{
                  display: 'block',
                  fontWeight: '600',
                  color: '#374151',
                  marginBottom: '8px',
                  fontSize: '15px'
                }}
              >
                To:
              </label>
              <input
                type="email"
                id="recipient"
                placeholder="recipient@example.com"
                value={formData.recipient}
                onChange={(e) => handleInputChange('recipient', e.target.value)}
                required
                style={{
                  width: '100%',
                  padding: '16px',
                  border: '2px solid #e5e7eb',
                  borderRadius: '12px',
                  fontSize: '15px',
                  fontFamily: 'inherit',
                  transition: 'all 0.2s ease',
                  background: '#fff',
                  boxSizing: 'border-box'
                }}
                onFocus={(e) => {
                  e.target.style.outline = 'none';
                  e.target.style.borderColor = '#4f46e5';
                  e.target.style.boxShadow = '0 0 0 4px rgba(79, 70, 229, 0.1)';
                  e.target.style.transform = 'translateY(-1px)';
                }}
                onBlur={(e) => {
                  e.target.style.borderColor = '#e5e7eb';
                  e.target.style.boxShadow = 'none';
                  e.target.style.transform = 'translateY(0)';
                }}
              />
            </div>

            <div style={{ marginBottom: '24px' }}>
              <label
                htmlFor="subject"
                style={{
                  display: 'block',
                  fontWeight: '600',
                  color: '#374151',
                  marginBottom: '8px',
                  fontSize: '15px'
                }}
              >
                Subject:
              </label>
              <input
                type="text"
                id="subject"
                placeholder="Enter your email subject"
                value={formData.subject}
                onChange={(e) => handleInputChange('subject', e.target.value)}
                required
                style={{
                  width: '100%',
                  padding: '16px',
                  border: '2px solid #e5e7eb',
                  borderRadius: '12px',
                  fontSize: '15px',
                  fontFamily: 'inherit',
                  transition: 'all 0.2s ease',
                  background: '#fff',
                  boxSizing: 'border-box'
                }}
                onFocus={(e) => {
                  e.target.style.outline = 'none';
                  e.target.style.borderColor = '#4f46e5';
                  e.target.style.boxShadow = '0 0 0 4px rgba(79, 70, 229, 0.1)';
                  e.target.style.transform = 'translateY(-1px)';
                }}
                onBlur={(e) => {
                  e.target.style.borderColor = '#e5e7eb';
                  e.target.style.boxShadow = 'none';
                  e.target.style.transform = 'translateY(0)';
                }}
              />
            </div>

            <div style={{ marginBottom: '24px' }}>
              <label
                htmlFor="content"
                style={{
                  display: 'block',
                  fontWeight: '600',
                  color: '#374151',
                  marginBottom: '8px',
                  fontSize: '15px'
                }}
              >
                Message:
              </label>
              <textarea
                id="content"
                placeholder="Write your email message here..."
                value={formData.content}
                onChange={(e) => handleInputChange('content', e.target.value)}
                required
                style={{
                  width: '100%',
                  padding: '16px',
                  border: '2px solid #e5e7eb',
                  borderRadius: '12px',
                  fontSize: '15px',
                  fontFamily: 'inherit',
                  transition: 'all 0.2s ease',
                  background: '#fff',
                  resize: 'vertical',
                  minHeight: '140px',
                  lineHeight: '1.6',
                  boxSizing: 'border-box'
                }}
                onFocus={(e) => {
                  e.target.style.outline = 'none';
                  e.target.style.borderColor = '#4f46e5';
                  e.target.style.boxShadow = '0 0 0 4px rgba(79, 70, 229, 0.1)';
                  e.target.style.transform = 'translateY(-1px)';
                }}
                onBlur={(e) => {
                  e.target.style.borderColor = '#e5e7eb';
                  e.target.style.boxShadow = 'none';
                  e.target.style.transform = 'translateY(0)';
                }}
              />
              <div style={{
                textAlign: 'right',
                fontSize: '13px',
                color: '#6b7280',
                marginTop: '8px',
                fontWeight: '500'
              }}>
                {charCount} characters
              </div>
            </div>

            <button
              type="submit"
              disabled={isLoading}
              style={{
                width: '100%',
                background: isLoading ? 'linear-gradient(135deg, #9ca3af 0%, #6b7280 100%)' : 'linear-gradient(135deg, #4f46e5 0%, #7c3aed 100%)',
                color: 'white',
                border: 'none',
                padding: '18px 24px',
                borderRadius: '12px',
                cursor: isLoading ? 'not-allowed' : 'pointer',
                fontSize: '16px',
                fontWeight: '600',
                transition: 'all 0.2s ease',
                position: 'relative',
                overflow: 'hidden',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '8px'
              }}
              onMouseEnter={(e) => {
                if (!isLoading) {
                  e.target.style.transform = 'translateY(-2px)';
                  e.target.style.boxShadow = '0 8px 25px rgba(79, 70, 229, 0.3)';
                }
              }}
              onMouseLeave={(e) => {
                if (!isLoading) {
                  e.target.style.transform = 'translateY(0)';
                  e.target.style.boxShadow = 'none';
                }
              }}
            >
              {isLoading ? (
                <>
                  <div style={{
                    width: '20px',
                    height: '20px',
                    border: '2px solid transparent',
                    borderTop: '2px solid currentColor',
                    borderRadius: '50%',
                    animation: 'spin 1s linear infinite'
                  }}></div>
                  <span>Sending...</span>
                </>
              ) : (
                <>📤 Send Email</>
              )}
            </button>
          </form>

          {/* Status Messages */}
          {status.visible && (
            <div style={{
              padding: '16px 20px',
              borderRadius: '12px',
              margin: '20px 0',
              fontWeight: '500',
              display: 'flex',
              alignItems: 'center',
              gap: '12px',
              opacity: 1,
              transform: 'translateY(0)',
              transition: 'all 0.3s ease',
              background: status.type === 'loading' ? 'linear-gradient(135deg, #fef3c7 0%, #fde68a 100%)' :
                         status.type === 'success' ? 'linear-gradient(135deg, #d1fae5 0%, #a7f3d0 100%)' :
                         'linear-gradient(135deg, #fee2e2 0%, #fecaca 100%)',
              color: status.type === 'loading' ? '#92400e' :
                     status.type === 'success' ? '#065f46' :
                     '#dc2626',
              border: status.type === 'loading' ? '2px solid #fcd34d' :
                      status.type === 'success' ? '2px solid #34d399' :
                      '2px solid #f87171'
            }}>
              {status.type === 'loading' && (
                <div style={{
                  width: '20px',
                  height: '20px',
                  border: '2px solid transparent',
                  borderTop: '2px solid currentColor',
                  borderRadius: '50%',
                  animation: 'spin 1s linear infinite'
                }}></div>
              )}
              {status.type === 'success' && <span>✅</span>}
              {status.type === 'error' && <span>❌</span>}
              <span>{status.message}</span>
            </div>
          )}

          {/* OAuth Prompt */}
          {showOAuth && (
            <div style={{
              background: 'linear-gradient(135deg, #fef3c7 0%, #fde68a 100%)',
              border: '2px solid #fcd34d',
              color: '#92400e',
              padding: '24px',
              borderRadius: '16px',
              margin: '24px 0',
              textAlign: 'center',
              animation: 'fadeIn 0.5s ease-in-out'
            }}>
              <div style={{ fontSize: '24px', marginBottom: '12px' }}>🔗</div>
              <div style={{ fontWeight: '600', marginBottom: '8px' }}>Connect Your Google Account</div>
              <div style={{ marginBottom: '16px' }}>
                To send emails, you need to connect your Gmail account first.
              </div>
              <button
                onClick={handleOAuthConnect}
                type="button"
                style={{
                  background: 'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)',
                  color: 'white',
                  border: 'none',
                  padding: '12px 24px',
                  borderRadius: '8px',
                  cursor: 'pointer',
                  fontSize: '14px',
                  fontWeight: '600',
                  marginTop: '16px',
                  textDecoration: 'none',
                  display: 'inline-block',
                  transition: 'all 0.2s ease'
                }}
                onMouseEnter={(e) => {
                  e.target.style.transform = 'translateY(-1px)';
                  e.target.style.boxShadow = '0 4px 12px rgba(245, 158, 11, 0.3)';
                }}
                onMouseLeave={(e) => {
                  e.target.style.transform = 'translateY(0)';
                  e.target.style.boxShadow = 'none';
                }}
              >
                Connect Gmail Account
              </button>
            </div>
          )}

          {/* Info Footer */}
          <div style={{
            marginTop: '32px',
            padding: '20px',
            background: 'linear-gradient(135deg, #f8fafc 0%, #f1f5f9 100%)',
            borderRadius: '12px',
            fontSize: '13px',
            color: '#6b7280',
            textAlign: 'center',
            border: '1px solid #e2e8f0'
          }}>
            💡 <strong>Smart Integration:</strong> Emails are sent through your connected Gmail account with full OAuth security. 
            Character count and validation help ensure your messages are professional and complete.
          </div>
        </div>

        {/* Add keyframe animations */}
        <style>{`
          @keyframes fadeIn {
            from {
              opacity: 0;
              transform: translateY(20px);
            }
            to {
              opacity: 1;
              transform: translateY(0);
            }
          }
          
          @keyframes spin {
            to { transform: rotate(360deg); }
          }
        `}</style>
      </div>
    </div>
  );
}

export default EmailComposerWidget;

