import React, { useState, useMemo } from 'react';

function ContactDirectoryWidget() {
  console.log('Contact Directory rendering...');
  console.log('useGlobalStorage available:', typeof useGlobalStorage);
  
  // Global storage for contacts (canvas-wide, single source of truth)
  const [contactData, setContactData] = useGlobalStorage('crm-contacts', {
    contacts: [
      {
        id: '1',
        name: 'John Smith',
        email: 'john@techcorp.com',
        phone: '+1 (555) 123-4567',
        company: 'TechCorp',
        position: 'CEO',
        status: 'customer',
        notes: 'Main decision maker, interested in enterprise solution',
        createdAt: new Date().toISOString()
      },
      {
        id: '2',
        name: 'Sarah Johnson',
        email: 'sarah@startup.io',
        phone: '+1 (555) 987-6543',
        company: 'Startup.io',
        position: 'CTO',
        status: 'prospect',
        notes: 'Technical evaluation in progress',
        createdAt: new Date().toISOString()
      },
      {
        id: '3',
        name: 'Mike Chen',
        email: 'mike@globalcorp.com',
        phone: '+1 (555) 456-7890',
        company: 'Global Corp',
        position: 'VP Sales',
        status: 'lead',
        notes: 'Cold outreach, initial interest shown',
        createdAt: new Date().toISOString()
      }
    ]
  });

  console.log('Contact Directory - contactData:', contactData);
  console.log('Contact Directory - setContactData:', typeof setContactData);

  // Local state
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [companyFilter, setCompanyFilter] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [editingContact, setEditingContact] = useState(null);
  const [selectedContacts, setSelectedContacts] = useState([]);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [activeTab, setActiveTab] = useState('details');
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    phone: '',
    company: '',
    position: '',
    status: 'lead',
    notes: ''
  });
  
  // Import state
  const [showImportModal, setShowImportModal] = useState(false);
  const [importData, setImportData] = useState(null);
  const [columnMapping, setColumnMapping] = useState({});
  const [importPreview, setImportPreview] = useState([]);
  
  // Google Contacts sync state
  const [isGoogleSyncing, setIsGoogleSyncing] = useState(false);
  const [googleConnected, setGoogleConnected] = useState(false);

  // Get unique companies for filter
  const companies = useMemo(() => {
    return [...new Set(contactData.contacts.map(c => c.company).filter(Boolean))];
  }, [contactData.contacts]);

  // Filter contacts based on search and filters
  const filteredContacts = useMemo(() => {
    return contactData.contacts.filter(contact => {
      const matchesSearch = !searchTerm || 
        contact.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        contact.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
        contact.company.toLowerCase().includes(searchTerm.toLowerCase());
        
      const matchesStatus = !statusFilter || contact.status === statusFilter;
      const matchesCompany = !companyFilter || contact.company === companyFilter;
      
      return matchesSearch && matchesStatus && matchesCompany;
    });
  }, [contactData.contacts, searchTerm, statusFilter, companyFilter]);

  const handleAddContact = () => {
    setEditingContact(null);
    setActiveTab('details');
    setFormData({
      name: '',
      email: '',
      phone: '',
      company: '',
      position: '',
      status: 'lead',
      notes: ''
    });
    setShowModal(true);
  };

  const handleEditContact = (contact) => {
    setEditingContact(contact);
    setActiveTab('details');
    setFormData(contact);
    setShowModal(true);
  };

  const isContactEnriched = (contact) => {
    return !!(contact.enrichedAt || contact.linkedin || contact.companySize || contact.industry);
  };

  const getEmailStatusCount = (contact) => {
    if (!contact.emails) return { sent: 0, notSent: 0 };
    return {
      sent: contact.emails.filter(e => e.status === 'sent').length,
      notSent: contact.emails.filter(e => e.status === 'not_sent').length
    };
  };

  const handleDeleteEmail = (emailId) => {
    if (!editingContact) return;
    
    const updatedContact = {
      ...editingContact,
      emails: editingContact.emails.filter(email => email.id !== emailId)
    };
    
    // Update the contact in the global storage
    setContactData({
      ...contactData,
      contacts: contactData.contacts.map(c => 
        c.id === editingContact.id ? updatedContact : c
      )
    });
    
    // Update the editing contact state
    setEditingContact(updatedContact);
  };

  const handleSaveContact = (e) => {
    e.preventDefault();
    
    if (editingContact) {
      // Update existing contact
      console.log('🔄 Contact Directory: Updating contact', editingContact.id, formData);
      const updated = {
        ...contactData,
        contacts: contactData.contacts.map(c => 
          c.id === editingContact.id ? { ...c, ...formData } : c
        )
      };
      console.log('✅ Contact Directory: Updated contactData', updated);
      setContactData(updated);
    } else {
      // Add new contact
      const newContact = {
        id: Date.now().toString(),
        ...formData,
        createdAt: new Date().toISOString()
      };
      console.log('➕ Contact Directory: Adding new contact', newContact);
      const updated = {
        ...contactData,
        contacts: [...contactData.contacts, newContact]
      };
      console.log('✅ Contact Directory: Updated contactData', updated);
      setContactData(updated);
    }
    
    setShowModal(false);
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
    if (selectedContacts.length === filteredContacts.length) {
      setSelectedContacts([]);
    } else {
      setSelectedContacts(filteredContacts.map(c => c.id));
    }
  };

  const handleDeleteSelected = () => {
    if (selectedContacts.length === 0) return;
    setShowDeleteConfirm(true);
  };

  const confirmDelete = () => {
    const updated = {
      ...contactData,
      contacts: contactData.contacts.filter(c => !selectedContacts.includes(c.id))
    };
    setContactData(updated);
    setSelectedContacts([]);
    setShowDeleteConfirm(false);
  };

  const cancelDelete = () => {
    setShowDeleteConfirm(false);
  };

  const loadXLSX = () => {
    return new Promise((resolve, reject) => {
      if (window.XLSX) {
        resolve(window.XLSX);
        return;
      }
      
      const script = document.createElement('script');
      script.src = 'https://cdn.sheetjs.com/xlsx-latest/package/dist/xlsx.full.min.js';
      script.onload = () => resolve(window.XLSX);
      script.onerror = () => reject(new Error('Failed to load XLSX library'));
      document.head.appendChild(script);
    });
  };

  const parseVCard = (vcfText) => {
    const contacts = [];
    const vCards = vcfText.split('BEGIN:VCARD');
    
    vCards.forEach(vcard => {
      if (!vcard.trim()) return;
      
      const contact = {
        name: '',
        email: '',
        phone: '',
        company: '',
        position: '',
        status: 'lead',
        notes: ''
      };
      
      const lines = vcard.split('\n');
      
      lines.forEach(line => {
        line = line.trim();
        
        // Name
        if (line.startsWith('FN:')) {
          contact.name = line.substring(3).trim();
        }
        // Email
        else if (line.includes('EMAIL')) {
          const emailMatch = line.match(/:(.*)/);
          if (emailMatch && !contact.email) {
            contact.email = emailMatch[1].trim();
          }
        }
        // Phone
        else if (line.includes('TEL')) {
          const phoneMatch = line.match(/:(.*)/);
          if (phoneMatch && !contact.phone) {
            contact.phone = phoneMatch[1].trim();
          }
        }
        // Organization
        else if (line.startsWith('ORG:')) {
          contact.company = line.substring(4).trim();
        }
        // Title/Position
        else if (line.startsWith('TITLE:')) {
          contact.position = line.substring(6).trim();
        }
        // Notes
        else if (line.startsWith('NOTE:')) {
          contact.notes = line.substring(5).trim().replace(/\\n/g, ' ');
        }
      });
      
      if (contact.name || contact.email || contact.phone) {
        contacts.push(contact);
      }
    });
    
    return contacts;
  };

  const handleFileImport = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    
    const fileName = file.name.toLowerCase();
    
    // Handle vCard (.vcf) files - iPhone contacts
    if (fileName.endsWith('.vcf')) {
      const reader = new FileReader();
      reader.onload = (event) => {
        try {
          const vcfText = event.target.result;
          const parsedContacts = parseVCard(vcfText);
          
          if (parsedContacts.length === 0) {
            alert('No valid contacts found in vCard file');
            return;
          }
          
          // Import vCard contacts directly (they're already in the right format)
          const newContacts = parsedContacts.map((contact, idx) => ({
            ...contact,
            id: Date.now().toString() + '-' + idx,
            createdAt: new Date().toISOString()
          }));
          
          const updated = {
            ...contactData,
            contacts: [...contactData.contacts, ...newContacts]
          };
          setContactData(updated);
          
          alert(`Successfully imported ${newContacts.length} contacts from iPhone!`);
        } catch (error) {
          console.error('vCard parse error:', error);
          alert('Error reading vCard file. Please ensure it\'s a valid iPhone contacts export.');
        }
      };
      reader.readAsText(file);
      return;
    }
    
    // Handle Excel/CSV files
    try {
      // Load XLSX library if not already loaded
      const XLSX = await loadXLSX();
      
      const reader = new FileReader();
      reader.onload = (event) => {
        try {
          const data = new Uint8Array(event.target.result);
          const workbook = XLSX.read(data, { type: 'array' });
          const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
          const jsonData = XLSX.utils.sheet_to_json(firstSheet, { header: 1 });
        
        if (jsonData.length < 2) {
          alert('File must contain at least a header row and one data row');
          return;
        }
        
        const headers = jsonData[0];
        const rows = jsonData.slice(1).filter(row => row.some(cell => cell));
        
        // Auto-detect column mapping
        const autoMapping = {};
        const fieldMappings = {
          name: ['name', 'full name', 'contact name', 'fullname', 'contact'],
          email: ['email', 'e-mail', 'email address', 'mail'],
          phone: ['phone', 'telephone', 'mobile', 'cell', 'phone number'],
          company: ['company', 'organization', 'org', 'business'],
          position: ['position', 'title', 'job title', 'role'],
          status: ['status', 'lead status', 'type'],
          notes: ['notes', 'note', 'comments', 'description']
        };
        
        headers.forEach((header, index) => {
          const headerLower = String(header).toLowerCase().trim();
          for (const [field, keywords] of Object.entries(fieldMappings)) {
            if (keywords.some(kw => headerLower.includes(kw))) {
              autoMapping[index] = field;
              break;
            }
          }
        });
        
        setImportData({ headers, rows });
        setColumnMapping(autoMapping);
        
        // Generate preview
        const preview = rows.slice(0, 3).map(row => {
          const contact = {};
          Object.entries(autoMapping).forEach(([colIndex, field]) => {
            contact[field] = row[colIndex] || '';
          });
          return contact;
        });
        setImportPreview(preview);
        setShowImportModal(true);
        } catch (error) {
          console.error('Import error:', error);
          alert('Error reading file. Please ensure it\'s a valid Excel file (.xlsx, .xls, .csv)');
        }
      };
      reader.readAsArrayBuffer(file);
    } catch (error) {
      console.error('Library load error:', error);
      alert('Failed to load import library. Please try again.');
    }
  };
  
  const handleConfirmImport = () => {
    if (!importData) return;
    
    const newContacts = importData.rows.map((row, idx) => {
      const contact = {
        id: Date.now().toString() + '-' + idx,
        createdAt: new Date().toISOString()
      };
      
      // Map columns to contact fields
      Object.entries(columnMapping).forEach(([colIndex, field]) => {
        let value = row[colIndex];
        if (value !== undefined && value !== null && value !== '') {
          contact[field] = String(value).trim();
        }
      });
      
      // Set defaults for required/missing fields
      if (!contact.name) contact.name = 'Imported Contact';
      if (!contact.status) contact.status = 'lead';
      if (!contact.email) contact.email = '';
      if (!contact.phone) contact.phone = '';
      if (!contact.company) contact.company = '';
      if (!contact.position) contact.position = '';
      if (!contact.notes) contact.notes = '';
      
      return contact;
    });
    
    // Add imported contacts to existing contacts
    const updated = {
      ...contactData,
      contacts: [...contactData.contacts, ...newContacts]
    };
    setContactData(updated);
    
    // Reset import state
    setShowImportModal(false);
    setImportData(null);
    setColumnMapping({});
    setImportPreview([]);
  };

  const handleGoogleSync = async () => {
    try {
      setIsGoogleSyncing(true);
      
      const result = await miyagiAPI.get('google-auth-url', { service: 'contacts' });
      const authResult = result.data || result;
      
      if (!authResult.authUrl) {
        throw new Error('Failed to get authorization URL');
      }
      
      const { authUrl } = authResult;
      
      // Open OAuth popup
      const width = 600;
      const height = 700;
      const left = window.screen.width / 2 - width / 2;
      const top = window.screen.height / 2 - height / 2;
      
      const popup = window.open(
        authUrl,
        'Google OAuth',
        `width=${width},height=${height},left=${left},top=${top}`
      );
      
      // Listen for OAuth completion
      const checkPopup = setInterval(() => {
        if (!popup || popup.closed) {
          clearInterval(checkPopup);
          setIsGoogleSyncing(false);
          // Check if connected and fetch contacts
          fetchGoogleContacts();
        }
      }, 1000);
      
    } catch (error) {
      console.error('Google sync error:', error);
      alert('Failed to connect to Google. Please try again.');
      setIsGoogleSyncing(false);
    }
  };

  const fetchGoogleContacts = async () => {
    try {
      setIsGoogleSyncing(true);
      
      const result = await miyagiAPI.get('google-contacts');
      const data = result.data || result;
      
      if (data.requiresOAuth || !data.contacts) {
        setGoogleConnected(false);
        setIsGoogleSyncing(false);
        return;
      }
      
      setGoogleConnected(true);
      
      // Import Google contacts
      const newContacts = data.contacts.map((contact, idx) => ({
        ...contact,
        id: Date.now().toString() + '-' + idx,
        createdAt: new Date().toISOString()
      }));
      
      const updated = {
        ...contactData,
        contacts: [...contactData.contacts, ...newContacts]
      };
      setContactData(updated);
      
      alert(`Successfully imported ${newContacts.length} contacts from Google!`);
      setIsGoogleSyncing(false);
      
    } catch (error) {
      console.error('Fetch contacts error:', error);
      alert('Failed to import Google contacts. Please try again.');
      setIsGoogleSyncing(false);
    }
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'lead': return '#fef3c7';
      case 'prospect': return '#dbeafe';
      case 'customer': return '#d1fae5';
      case 'inactive': return '#f3f4f6';
      default: return '#f3f4f6';
    }
  };

  const getStatusTextColor = (status) => {
    switch (status) {
      case 'lead': return '#92400e';
      case 'prospect': return '#1e40af';
      case 'customer': return '#065f46';
      case 'inactive': return '#6b7280';
      default: return '#6b7280';
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
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
          <h2 style={{
            fontSize: '18px',
            fontWeight: '600',
            color: '#1e293b',
            margin: 0
          }}>👥 Contact Directory</h2>
          
          <div style={{ display: 'flex', gap: '8px' }}>
            <button
              onClick={handleGoogleSync}
              disabled={isGoogleSyncing}
              style={{
                background: isGoogleSyncing ? '#9ca3af' : '#4285f4',
                color: 'white',
                padding: '6px 12px',
                borderRadius: '6px',
                fontSize: '13px',
                fontWeight: '500',
                cursor: isGoogleSyncing ? 'not-allowed' : 'pointer',
                transition: 'background 0.2s',
                border: 'none'
              }}
              onMouseOver={(e) => {
                if (!isGoogleSyncing) e.target.style.background = '#3367d6';
              }}
              onMouseOut={(e) => {
                if (!isGoogleSyncing) e.target.style.background = '#4285f4';
              }}
            >
              {isGoogleSyncing ? '🔄 Syncing...' : '📱 Sync Google'}
            </button>
            
            <label style={{
              background: '#10b981',
              color: 'white',
              padding: '6px 12px',
              borderRadius: '6px',
              fontSize: '13px',
              fontWeight: '500',
              cursor: 'pointer',
              transition: 'background 0.2s'
            }}
            onMouseOver={(e) => e.target.style.background = '#059669'}
            onMouseOut={(e) => e.target.style.background = '#10b981'}>
              📊 Import File
              <input
                type="file"
                accept=".xlsx,.xls,.csv,.vcf"
                onChange={handleFileImport}
                style={{ display: 'none' }}
              />
            </label>
          </div>
        </div>
        
        {/* Search and Filters */}
        <div style={{ display: 'flex', gap: '8px', marginBottom: '12px' }}>
          <input
            type="text"
            placeholder="Search contacts..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="form-input"
            style={{ flex: 1 }}
          />
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="form-input"
          >
            <option value="">All Status</option>
            <option value="lead">Lead</option>
            <option value="prospect">Prospect</option>
            <option value="customer">Customer</option>
            <option value="inactive">Inactive</option>
          </select>
          <select
            value={companyFilter}
            onChange={(e) => setCompanyFilter(e.target.value)}
            className="form-input"
          >
            <option value="">All Companies</option>
            {companies.map(company => (
              <option key={company} value={company}>{company}</option>
            ))}
          </select>
        </div>
        
        {/* Stats */}
        <div style={{ display: 'flex', gap: '16px', fontSize: '12px', color: '#64748b' }}>
          <span>{contactData.contacts.length} contacts</span>
          <span>{filteredContacts.length} shown</span>
        </div>
      </div>
      
      {/* Contacts List */}
      <div style={{
        flex: 1,
        overflowY: 'auto',
        padding: '8px'
      }}>
        {filteredContacts.length === 0 ? (
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
            }}>No contacts found</h3>
            <p>Try adjusting your search or filters</p>
          </div>
        ) : (
          <>
            {/* Bulk Actions Toolbar */}
            {selectedContacts.length > 0 && (
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
                  {selectedContacts.length} contact{selectedContacts.length > 1 ? 's' : ''} selected
                </span>
                <div style={{ display: 'flex', gap: '8px' }}>
                  <button
                    onClick={handleDeleteSelected}
                    className="btn-secondary"
                    style={{
                      background: '#ef4444',
                      color: 'white',
                      border: 'none'
                    }}
                  >
                    🗑️ Delete
                  </button>
                  <button
                    onClick={() => setSelectedContacts([])}
                    className="btn-secondary"
                  >
                    Clear Selection
                  </button>
                </div>
              </div>
            )}
            
            {/* Select All Button */}
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              padding: '8px 0',
              marginBottom: '8px'
            }}>
              <input
                type="checkbox"
                checked={selectedContacts.length === filteredContacts.length && filteredContacts.length > 0}
                onChange={handleSelectAll}
                style={{
                  width: '16px',
                  height: '16px',
                  cursor: 'pointer'
                }}
              />
              <span style={{ fontSize: '13px', color: '#64748b' }}>
                Select all ({filteredContacts.length})
              </span>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {filteredContacts.map(contact => (
                <div
                  key={contact.id}
                  className="contact-item"
                  style={{
                    padding: '12px',
                    border: selectedContacts.includes(contact.id) ? '2px solid #3b82f6' : '1px solid #e2e8f0',
                    borderRadius: '8px',
                    background: selectedContacts.includes(contact.id) ? '#eff6ff' : 'white',
                    boxShadow: '0 1px 2px rgba(0, 0, 0, 0.05)',
                    display: 'flex',
                    gap: '12px',
                    alignItems: 'flex-start'
                  }}
                >
                  <input
                    type="checkbox"
                    checked={selectedContacts.includes(contact.id)}
                    onChange={(e) => handleSelectContact(contact.id, e)}
                    onClick={(e) => e.stopPropagation()}
                    style={{
                      width: '18px',
                      height: '18px',
                      cursor: 'pointer',
                      marginTop: '2px',
                      flexShrink: 0
                    }}
                  />
                  <div 
                    style={{ flex: 1, cursor: 'pointer' }}
                    onClick={() => handleEditContact(contact)}
                  >
                    <div style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'flex-start',
                      marginBottom: '8px'
                    }}>
                      <div style={{
                        fontWeight: '600',
                        color: '#1e293b',
                        fontSize: '14px'
                      }}>{contact.name}</div>
                      <div style={{
                        fontSize: '12px',
                        color: '#64748b'
                      }}>{contact.company}</div>
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                      <div style={{
                        fontSize: '12px',
                        color: '#64748b'
                      }}>{contact.email}</div>
                      <div style={{
                        fontSize: '12px',
                        color: '#64748b'
                      }}>{contact.phone}</div>
                      <div style={{ display: 'flex', gap: '6px', alignItems: 'center', marginTop: '4px' }}>
                        <div style={{
                          display: 'inline-block',
                          padding: '2px 8px',
                          borderRadius: '12px',
                          fontSize: '10px',
                          fontWeight: '500',
                          background: getStatusColor(contact.status),
                          color: getStatusTextColor(contact.status),
                          width: 'fit-content'
                        }}>
                          {contact.status}
                        </div>
                        <div style={{ display: 'flex', gap: '4px', alignItems: 'center' }}>
                          {isContactEnriched(contact) && (
                            <div style={{
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '4px',
                              padding: '2px 8px',
                              borderRadius: '12px',
                              fontSize: '10px',
                              fontWeight: '500',
                              background: '#dbeafe',
                              color: '#1e40af',
                              width: 'fit-content'
                            }}>
                              ✨ Enriched
                            </div>
                          )}
                          {contact.emails && contact.emails.length > 0 && (
                            <div style={{
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '4px',
                              padding: '2px 8px',
                              borderRadius: '12px',
                              fontSize: '10px',
                              fontWeight: '500',
                              background: '#fef3c7',
                              color: '#92400e',
                              width: 'fit-content'
                            }}>
                              📧 {contact.emails.length}
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </>
        )}
      </div>
      
      {/* Add Contact Button */}
      <button
        onClick={handleAddContact}
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
            maxWidth: '400px',
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
                {editingContact ? 'Edit Contact' : 'Add Contact'}
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
            
            {/* Tabs */}
            {editingContact && (
              <div style={{
                display: 'flex',
                gap: '8px',
                borderBottom: '1px solid #e2e8f0',
                marginBottom: '20px'
              }}>
                <button
                  type="button"
                  onClick={() => setActiveTab('details')}
                  style={{
                    padding: '8px 16px',
                    background: 'none',
                    border: 'none',
                    borderBottom: activeTab === 'details' ? '2px solid #3b82f6' : '2px solid transparent',
                    color: activeTab === 'details' ? '#3b82f6' : '#64748b',
                    fontWeight: activeTab === 'details' ? '600' : '500',
                    cursor: 'pointer',
                    fontSize: '14px'
                  }}
                >
                  Details
                </button>
                {isContactEnriched(editingContact) && (
                  <button
                    type="button"
                    onClick={() => setActiveTab('enrichment')}
                    style={{
                      padding: '8px 16px',
                      background: 'none',
                      border: 'none',
                      borderBottom: activeTab === 'enrichment' ? '2px solid #3b82f6' : '2px solid transparent',
                      color: activeTab === 'enrichment' ? '#3b82f6' : '#64748b',
                      fontWeight: activeTab === 'enrichment' ? '600' : '500',
                      cursor: 'pointer',
                      fontSize: '14px',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '4px'
                    }}
                  >
                    ✨ Enrichment
                  </button>
                )}
                {editingContact.emails && editingContact.emails.length > 0 && (
                  <button
                    type="button"
                    onClick={() => setActiveTab('emails')}
                    style={{
                      padding: '8px 16px',
                      background: 'none',
                      border: 'none',
                      borderBottom: activeTab === 'emails' ? '2px solid #3b82f6' : '2px solid transparent',
                      color: activeTab === 'emails' ? '#3b82f6' : '#64748b',
                      fontWeight: activeTab === 'emails' ? '600' : '500',
                      cursor: 'pointer',
                      fontSize: '14px',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '4px'
                    }}
                  >
                    📧 Emails ({editingContact.emails.length})
                  </button>
                )}
              </div>
            )}
            
            {activeTab === 'details' ? (
              <form onSubmit={handleSaveContact} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div>
                <label style={{
                  display: 'block',
                  marginBottom: '4px',
                  fontSize: '14px',
                  fontWeight: '500',
                  color: '#374151'
                }}>
                  Full Name
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
                  Company
                </label>
                <input
                  type="text"
                  value={formData.company}
                  onChange={(e) => setFormData(prev => ({ ...prev, company: e.target.value }))}
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
                  Position
                </label>
                <input
                  type="text"
                  value={formData.position}
                  onChange={(e) => setFormData(prev => ({ ...prev, position: e.target.value }))}
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
                  Status
                </label>
                <select
                  value={formData.status}
                  onChange={(e) => setFormData(prev => ({ ...prev, status: e.target.value }))}
                  className="form-input"
                >
                  <option value="lead">Lead</option>
                  <option value="prospect">Prospect</option>
                  <option value="customer">Customer</option>
                  <option value="inactive">Inactive</option>
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
                  Notes
                </label>
                <textarea
                  value={formData.notes}
                  onChange={(e) => setFormData(prev => ({ ...prev, notes: e.target.value }))}
                  rows={3}
                  className="form-input"
                  placeholder="Add notes about this contact..."
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
                  Save Contact
                </button>
              </div>
            </form>
            ) : activeTab === 'enrichment' ? (
              /* Enrichment Tab */
              <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                {editingContact && (
                  <>
                    {/* Enrichment Metadata */}
                    {editingContact.enrichedAt && (
                      <div style={{
                        padding: '12px',
                        background: '#f0fdf4',
                        border: '1px solid #10b981',
                        borderRadius: '8px',
                        marginBottom: '8px'
                      }}>
                        <div style={{ fontSize: '12px', color: '#065f46', marginBottom: '4px' }}>
                          <strong>Enriched:</strong> {new Date(editingContact.enrichedAt).toLocaleDateString()} at {new Date(editingContact.enrichedAt).toLocaleTimeString()}
                        </div>
                        {editingContact.enrichmentSource && (
                          <div style={{ fontSize: '12px', color: '#065f46' }}>
                            <strong>Source:</strong> {editingContact.enrichmentSource}
                          </div>
                        )}
                      </div>
                    )}

                    {/* Social Profiles */}
                    {(editingContact.linkedin || editingContact.twitter) && (
                      <div>
                        <h4 style={{ fontSize: '14px', fontWeight: '600', marginBottom: '8px', color: '#1e293b' }}>
                          Social Profiles
                        </h4>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                          {editingContact.linkedin && (
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                              <span style={{ fontSize: '13px', color: '#64748b', minWidth: '80px' }}>LinkedIn:</span>
                              <a href={editingContact.linkedin} target="_blank" rel="noopener noreferrer" style={{
                                fontSize: '13px',
                                color: '#3b82f6',
                                textDecoration: 'none',
                                wordBreak: 'break-all'
                              }}>
                                {editingContact.linkedin}
                              </a>
                            </div>
                          )}
                          {editingContact.twitter && (
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                              <span style={{ fontSize: '13px', color: '#64748b', minWidth: '80px' }}>Twitter:</span>
                              <span style={{ fontSize: '13px', color: '#1e293b' }}>{editingContact.twitter}</span>
                            </div>
                          )}
                        </div>
                      </div>
                    )}

                    {/* Company Information */}
                    {(editingContact.companySize || editingContact.industry || editingContact.revenue || editingContact.website || editingContact.foundedYear) && (
                      <div>
                        <h4 style={{ fontSize: '14px', fontWeight: '600', marginBottom: '8px', color: '#1e293b' }}>
                          Company Information
                        </h4>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                          {editingContact.industry && (
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                              <span style={{ fontSize: '13px', color: '#64748b', minWidth: '120px' }}>Industry:</span>
                              <span style={{ fontSize: '13px', color: '#1e293b' }}>{editingContact.industry}</span>
                            </div>
                          )}
                          {editingContact.companySize && (
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                              <span style={{ fontSize: '13px', color: '#64748b', minWidth: '120px' }}>Company Size:</span>
                              <span style={{ fontSize: '13px', color: '#1e293b' }}>{editingContact.companySize} employees</span>
                            </div>
                          )}
                          {editingContact.revenue && (
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                              <span style={{ fontSize: '13px', color: '#64748b', minWidth: '120px' }}>Revenue:</span>
                              <span style={{ fontSize: '13px', color: '#1e293b' }}>{editingContact.revenue}</span>
                            </div>
                          )}
                          {editingContact.foundedYear && (
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                              <span style={{ fontSize: '13px', color: '#64748b', minWidth: '120px' }}>Founded:</span>
                              <span style={{ fontSize: '13px', color: '#1e293b' }}>{editingContact.foundedYear}</span>
                            </div>
                          )}
                          {editingContact.website && (
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                              <span style={{ fontSize: '13px', color: '#64748b', minWidth: '120px' }}>Website:</span>
                              <a href={editingContact.website} target="_blank" rel="noopener noreferrer" style={{
                                fontSize: '13px',
                                color: '#3b82f6',
                                textDecoration: 'none'
                              }}>
                                {editingContact.website}
                              </a>
                            </div>
                          )}
                        </div>
                      </div>
                    )}

                    {/* Location */}
                    {(editingContact.city || editingContact.state || editingContact.country || editingContact.timezone) && (
                      <div>
                        <h4 style={{ fontSize: '14px', fontWeight: '600', marginBottom: '8px', color: '#1e293b' }}>
                          Location
                        </h4>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                          {(editingContact.city || editingContact.state || editingContact.country) && (
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                              <span style={{ fontSize: '13px', color: '#64748b', minWidth: '80px' }}>Address:</span>
                              <span style={{ fontSize: '13px', color: '#1e293b' }}>
                                {[editingContact.city, editingContact.state, editingContact.country].filter(Boolean).join(', ')}
                              </span>
                            </div>
                          )}
                          {editingContact.timezone && (
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                              <span style={{ fontSize: '13px', color: '#64748b', minWidth: '80px' }}>Timezone:</span>
                              <span style={{ fontSize: '13px', color: '#1e293b' }}>{editingContact.timezone}</span>
                            </div>
                          )}
                        </div>
                      </div>
                    )}

                    {/* Job Details */}
                    {(editingContact.seniority || editingContact.department || editingContact.yearsExperience) && (
                      <div>
                        <h4 style={{ fontSize: '14px', fontWeight: '600', marginBottom: '8px', color: '#1e293b' }}>
                          Job Details
                        </h4>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                          {editingContact.seniority && (
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                              <span style={{ fontSize: '13px', color: '#64748b', minWidth: '120px' }}>Seniority:</span>
                              <span style={{ fontSize: '13px', color: '#1e293b' }}>{editingContact.seniority}</span>
                            </div>
                          )}
                          {editingContact.department && (
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                              <span style={{ fontSize: '13px', color: '#64748b', minWidth: '120px' }}>Department:</span>
                              <span style={{ fontSize: '13px', color: '#1e293b' }}>{editingContact.department}</span>
                            </div>
                          )}
                          {editingContact.yearsExperience && (
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                              <span style={{ fontSize: '13px', color: '#64748b', minWidth: '120px' }}>Experience:</span>
                              <span style={{ fontSize: '13px', color: '#1e293b' }}>{editingContact.yearsExperience} years</span>
                            </div>
                          )}
                        </div>
                      </div>
                    )}

                    {/* Custom Enrichment */}
                    {editingContact.customEnrichment && Object.keys(editingContact.customEnrichment).length > 0 && (
                      <div>
                        <h4 style={{ fontSize: '14px', fontWeight: '600', marginBottom: '8px', color: '#1e293b' }}>
                          Custom Enrichment
                        </h4>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                          {Object.entries(editingContact.customEnrichment).map(([key, value]) => (
                            <div key={key} style={{
                              padding: '12px',
                              background: '#f8fafc',
                              borderRadius: '6px',
                              border: '1px solid #e2e8f0'
                            }}>
                              <div style={{ fontSize: '13px', fontWeight: '600', color: '#1e293b', marginBottom: '4px' }}>
                                {key}
                              </div>
                              <div style={{ fontSize: '13px', color: '#64748b', lineHeight: '1.5' }}>
                                {value}
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    <button
                      type="button"
                      onClick={() => setShowModal(false)}
                      className="btn-secondary"
                      style={{ width: '100%', marginTop: '8px' }}
                    >
                      Close
                    </button>
                  </>
                )}
              </div>
            ) : activeTab === 'enrichment' ? (
              /* Enrichment Tab */
              <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                {editingContact && (
                  <>
                    {/* Enrichment Metadata */}
                    {editingContact.enrichedAt && (
                      <div style={{
                        padding: '12px',
                        background: '#f0fdf4',
                        border: '1px solid #10b981',
                        borderRadius: '8px',
                        marginBottom: '8px'
                      }}>
                        <div style={{ fontSize: '12px', color: '#065f46', marginBottom: '4px' }}>
                          <strong>Enriched:</strong> {new Date(editingContact.enrichedAt).toLocaleDateString()} at {new Date(editingContact.enrichedAt).toLocaleTimeString()}
                        </div>
                        {editingContact.enrichmentSource && (
                          <div style={{ fontSize: '12px', color: '#065f46' }}>
                            <strong>Source:</strong> {editingContact.enrichmentSource}
                          </div>
                        )}
                      </div>
                    )}

                    {/* Social Profiles */}
                    {(editingContact.linkedin || editingContact.twitter) && (
                      <div>
                        <h4 style={{ fontSize: '14px', fontWeight: '600', marginBottom: '8px', color: '#1e293b' }}>
                          Social Profiles
                        </h4>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                          {editingContact.linkedin && (
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                              <span style={{ fontSize: '13px', color: '#64748b', minWidth: '80px' }}>LinkedIn:</span>
                              <a href={editingContact.linkedin} target="_blank" rel="noopener noreferrer" style={{
                                fontSize: '13px',
                                color: '#3b82f6',
                                textDecoration: 'none',
                                wordBreak: 'break-all'
                              }}>
                                {editingContact.linkedin}
                              </a>
                            </div>
                          )}
                          {editingContact.twitter && (
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                              <span style={{ fontSize: '13px', color: '#64748b', minWidth: '80px' }}>Twitter:</span>
                              <span style={{ fontSize: '13px', color: '#1e293b' }}>{editingContact.twitter}</span>
                            </div>
                          )}
                        </div>
                      </div>
                    )}

                    {/* Company Information */}
                    {(editingContact.companySize || editingContact.industry || editingContact.revenue || editingContact.website || editingContact.foundedYear) && (
                      <div>
                        <h4 style={{ fontSize: '14px', fontWeight: '600', marginBottom: '8px', color: '#1e293b' }}>
                          Company Information
                        </h4>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                          {editingContact.industry && (
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                              <span style={{ fontSize: '13px', color: '#64748b', minWidth: '120px' }}>Industry:</span>
                              <span style={{ fontSize: '13px', color: '#1e293b' }}>{editingContact.industry}</span>
                            </div>
                          )}
                          {editingContact.companySize && (
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                              <span style={{ fontSize: '13px', color: '#64748b', minWidth: '120px' }}>Company Size:</span>
                              <span style={{ fontSize: '13px', color: '#1e293b' }}>{editingContact.companySize} employees</span>
                            </div>
                          )}
                          {editingContact.revenue && (
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                              <span style={{ fontSize: '13px', color: '#64748b', minWidth: '120px' }}>Revenue:</span>
                              <span style={{ fontSize: '13px', color: '#1e293b' }}>{editingContact.revenue}</span>
                            </div>
                          )}
                          {editingContact.foundedYear && (
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                              <span style={{ fontSize: '13px', color: '#64748b', minWidth: '120px' }}>Founded:</span>
                              <span style={{ fontSize: '13px', color: '#1e293b' }}>{editingContact.foundedYear}</span>
                            </div>
                          )}
                          {editingContact.website && (
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                              <span style={{ fontSize: '13px', color: '#64748b', minWidth: '120px' }}>Website:</span>
                              <a href={editingContact.website} target="_blank" rel="noopener noreferrer" style={{
                                fontSize: '13px',
                                color: '#3b82f6',
                                textDecoration: 'none'
                              }}>
                                {editingContact.website}
                              </a>
                            </div>
                          )}
                        </div>
                      </div>
                    )}

                    {/* Location */}
                    {(editingContact.city || editingContact.state || editingContact.country || editingContact.timezone) && (
                      <div>
                        <h4 style={{ fontSize: '14px', fontWeight: '600', marginBottom: '8px', color: '#1e293b' }}>
                          Location
                        </h4>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                          {(editingContact.city || editingContact.state || editingContact.country) && (
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                              <span style={{ fontSize: '13px', color: '#64748b', minWidth: '80px' }}>Address:</span>
                              <span style={{ fontSize: '13px', color: '#1e293b' }}>
                                {[editingContact.city, editingContact.state, editingContact.country].filter(Boolean).join(', ')}
                              </span>
                            </div>
                          )}
                          {editingContact.timezone && (
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                              <span style={{ fontSize: '13px', color: '#64748b', minWidth: '80px' }}>Timezone:</span>
                              <span style={{ fontSize: '13px', color: '#1e293b' }}>{editingContact.timezone}</span>
                            </div>
                          )}
                        </div>
                      </div>
                    )}

                    {/* Job Details */}
                    {(editingContact.seniority || editingContact.department || editingContact.yearsExperience) && (
                      <div>
                        <h4 style={{ fontSize: '14px', fontWeight: '600', marginBottom: '8px', color: '#1e293b' }}>
                          Job Details
                        </h4>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                          {editingContact.seniority && (
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                              <span style={{ fontSize: '13px', color: '#64748b', minWidth: '120px' }}>Seniority:</span>
                              <span style={{ fontSize: '13px', color: '#1e293b' }}>{editingContact.seniority}</span>
                            </div>
                          )}
                          {editingContact.department && (
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                              <span style={{ fontSize: '13px', color: '#64748b', minWidth: '120px' }}>Department:</span>
                              <span style={{ fontSize: '13px', color: '#1e293b' }}>{editingContact.department}</span>
                            </div>
                          )}
                          {editingContact.yearsExperience && (
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                              <span style={{ fontSize: '13px', color: '#64748b', minWidth: '120px' }}>Experience:</span>
                              <span style={{ fontSize: '13px', color: '#1e293b' }}>{editingContact.yearsExperience} years</span>
                            </div>
                          )}
                        </div>
                      </div>
                    )}

                    {/* Custom Enrichment */}
                    {editingContact.customEnrichment && Object.keys(editingContact.customEnrichment).length > 0 && (
                      <div>
                        <h4 style={{ fontSize: '14px', fontWeight: '600', marginBottom: '8px', color: '#1e293b' }}>
                          Custom Enrichment
                        </h4>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                          {Object.entries(editingContact.customEnrichment).map(([key, value]) => (
                            <div key={key} style={{
                              padding: '12px',
                              background: '#f8fafc',
                              borderRadius: '6px',
                              border: '1px solid #e2e8f0'
                            }}>
                              <div style={{ fontSize: '13px', fontWeight: '600', color: '#1e293b', marginBottom: '4px' }}>
                                {key}
                              </div>
                              <div style={{ fontSize: '13px', color: '#64748b', lineHeight: '1.5' }}>
                                {value}
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    <button
                      type="button"
                      onClick={() => setShowModal(false)}
                      className="btn-secondary"
                      style={{ width: '100%', marginTop: '8px' }}
                    >
                      Close
                    </button>
                  </>
                )}
              </div>
            ) : activeTab === 'emails' ? (
              /* Emails Tab */
              <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                {editingContact && editingContact.emails && (
                  <>
                    {/* Email Stats */}
                    <div style={{
                      display: 'flex',
                      gap: '12px',
                      marginBottom: '16px'
                    }}>
                      <div style={{
                        padding: '8px 12px',
                        background: '#fef3c7',
                        borderRadius: '6px',
                        border: '1px solid #fbbf24'
                      }}>
                        <div style={{ fontSize: '12px', color: '#92400e', fontWeight: '600' }}>
                          📧 Total: {editingContact.emails.length}
                        </div>
                      </div>
                      <div style={{
                        padding: '8px 12px',
                        background: '#fef2f2',
                        borderRadius: '6px',
                        border: '1px solid #f87171'
                      }}>
                        <div style={{ fontSize: '12px', color: '#dc2626', fontWeight: '600' }}>
                          ⏳ Not Sent: {getEmailStatusCount(editingContact).notSent}
                        </div>
                      </div>
                      <div style={{
                        padding: '8px 12px',
                        background: '#f0fdf4',
                        borderRadius: '6px',
                        border: '1px solid #4ade80'
                      }}>
                        <div style={{ fontSize: '12px', color: '#16a34a', fontWeight: '600' }}>
                          ✅ Sent: {getEmailStatusCount(editingContact).sent}
                        </div>
                      </div>
                    </div>

                    {/* Email List */}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                      {editingContact.emails.map((email, index) => (
                        <div
                          key={email.id || index}
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
                            marginBottom: '8px'
                          }}>
                            <div style={{ flex: 1 }}>
                              <div style={{
                                fontSize: '14px',
                                fontWeight: '600',
                                color: '#1e293b',
                                marginBottom: '4px'
                              }}>
                                {email.subject}
                              </div>
                              <div style={{
                                fontSize: '12px',
                                color: '#64748b',
                                marginBottom: '8px'
                              }}>
                                Campaign: {email.campaignPurpose}
                              </div>
                              <div style={{
                                fontSize: '11px',
                                color: '#9ca3af'
                              }}>
                                Generated: {new Date(email.generatedAt).toLocaleDateString()} at {new Date(email.generatedAt).toLocaleTimeString()}
                              </div>
                            </div>
                            <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                              <div style={{
                                padding: '4px 8px',
                                borderRadius: '12px',
                                fontSize: '10px',
                                fontWeight: '500',
                                background: email.status === 'sent' ? '#dcfce7' : '#fef3c7',
                                color: email.status === 'sent' ? '#166534' : '#92400e',
                                border: `1px solid ${email.status === 'sent' ? '#22c55e' : '#f59e0b'}`
                              }}>
                                {email.status === 'sent' ? '✅ Sent' : '⏳ Not Sent'}
                              </div>
                              <button
                                onClick={() => navigator.clipboard.writeText(email.content)}
                                className="btn-secondary"
                                style={{ fontSize: '12px', padding: '4px 8px' }}
                              >
                                📋 Copy
                              </button>
                              <button
                                onClick={() => handleDeleteEmail(email.id)}
                                className="btn-secondary"
                                style={{ fontSize: '12px', padding: '4px 8px', background: '#fee2e2', color: '#dc2626', border: '1px solid #f87171' }}
                              >
                                🗑️ Delete
                              </button>
                            </div>
                          </div>
                          
                          <div style={{
                            fontSize: '13px',
                            color: '#1e293b',
                            lineHeight: '1.5',
                            background: '#f8fafc',
                            padding: '12px',
                            borderRadius: '6px',
                            border: '1px solid #e2e8f0',
                            maxHeight: '150px',
                            overflowY: 'auto',
                            whiteSpace: 'pre-wrap'
                          }}>
                            {email.content}
                          </div>
                        </div>
                      ))}
                    </div>

                    <button
                      type="button"
                      onClick={() => setShowModal(false)}
                      className="btn-secondary"
                      style={{ width: '100%', marginTop: '8px' }}
                    >
                      Close
                    </button>
                  </>
                )}
              </div>
            ) : null}
          </div>
        </div>
      )}
      
      {/* Import Modal */}
      {showImportModal && importData && (
        <div className="modal-overlay">
          <div className="modal-content" style={{
            padding: '24px',
            width: '90%',
            maxWidth: '600px',
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
                Import Contacts
              </h3>
              <button
                onClick={() => setShowImportModal(false)}
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
            
            <div style={{ marginBottom: '20px' }}>
              <p style={{ fontSize: '14px', color: '#64748b', marginBottom: '12px' }}>
                Found {importData.rows.length} rows. Map columns to contact fields:
              </p>
              
              {/* Column Mapping */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {importData.headers.map((header, index) => (
                  <div key={index} style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '12px',
                    padding: '8px',
                    background: '#f8fafc',
                    borderRadius: '6px'
                  }}>
                    <div style={{
                      flex: 1,
                      fontSize: '13px',
                      fontWeight: '500',
                      color: '#1e293b'
                    }}>
                      {header}
                    </div>
                    <select
                      value={columnMapping[index] || ''}
                      onChange={(e) => {
                        const newMapping = {
                          ...columnMapping,
                          [index]: e.target.value || undefined
                        };
                        setColumnMapping(newMapping);
                        
                        // Update preview
                        const preview = importData.rows.slice(0, 3).map(row => {
                          const contact = {};
                          Object.entries(newMapping).forEach(([colIndex, field]) => {
                            if (field) contact[field] = row[colIndex] || '';
                          });
                          return contact;
                        });
                        setImportPreview(preview);
                      }}
                      className="form-input"
                      style={{ width: '150px' }}
                    >
                      <option value="">-- Skip --</option>
                      <option value="name">Name</option>
                      <option value="email">Email</option>
                      <option value="phone">Phone</option>
                      <option value="company">Company</option>
                      <option value="position">Position</option>
                      <option value="status">Status</option>
                      <option value="notes">Notes</option>
                    </select>
                  </div>
                ))}
              </div>
            </div>
            
            {/* Preview */}
            {importPreview.length > 0 && (
              <div style={{ marginBottom: '20px' }}>
                <h4 style={{
                  fontSize: '14px',
                  fontWeight: '600',
                  marginBottom: '8px',
                  color: '#1e293b'
                }}>Preview (first 3 rows):</h4>
                <div style={{
                  background: '#f8fafc',
                  padding: '12px',
                  borderRadius: '6px',
                  fontSize: '12px',
                  maxHeight: '200px',
                  overflowY: 'auto'
                }}>
                  {importPreview.map((contact, idx) => (
                    <div key={idx} style={{
                      padding: '8px',
                      marginBottom: '8px',
                      background: 'white',
                      borderRadius: '4px',
                      border: '1px solid #e2e8f0'
                    }}>
                      <div><strong>Name:</strong> {contact.name || '(empty)'}</div>
                      <div><strong>Email:</strong> {contact.email || '(empty)'}</div>
                      <div><strong>Company:</strong> {contact.company || '(empty)'}</div>
                    </div>
                  ))}
                </div>
              </div>
            )}
            
            <div style={{
              display: 'flex',
              gap: '12px',
              justifyContent: 'flex-end'
            }}>
              <button
                type="button"
                onClick={() => setShowImportModal(false)}
                className="btn-secondary"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmImport}
                className="btn-primary"
              >
                Import {importData.rows.length} Contacts
              </button>
            </div>
          </div>
        </div>
      )}
      
      {/* Delete Confirmation Modal */}
      {showDeleteConfirm && (
        <div className="modal-overlay">
          <div className="modal-content" style={{
            padding: '24px',
            width: '90%',
            maxWidth: '400px'
          }}>
            <div style={{
              display: 'flex',
              justifyContent: 'center',
              marginBottom: '16px'
            }}>
              <div style={{
                width: '48px',
                height: '48px',
                borderRadius: '50%',
                background: '#fee2e2',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '24px'
              }}>
                ⚠️
              </div>
            </div>
            
            <h3 style={{
              fontSize: '18px',
              fontWeight: '600',
              textAlign: 'center',
              marginBottom: '8px',
              color: '#1e293b'
            }}>
              Delete {selectedContacts.length} Contact{selectedContacts.length > 1 ? 's' : ''}?
            </h3>
            
            <p style={{
              fontSize: '14px',
              color: '#64748b',
              textAlign: 'center',
              marginBottom: '24px'
            }}>
              This action cannot be undone. The contact{selectedContacts.length > 1 ? 's' : ''} will be permanently removed from your directory.
            </p>
            
            <div style={{
              display: 'flex',
              gap: '12px',
              justifyContent: 'flex-end'
            }}>
              <button
                type="button"
                onClick={cancelDelete}
                className="btn-secondary"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={confirmDelete}
                className="btn-primary"
                style={{
                  background: '#ef4444'
                }}
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default ContactDirectoryWidget;
