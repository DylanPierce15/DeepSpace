import React, { useState } from 'react';

const Sidebar = ({ currentPath, onNavigate }) => {
  const [expandedSections, setExpandedSections] = useState({
    clustering: true,
    regression: true
  });

  const toggleSection = (section) => {
    setExpandedSections(prev => ({
      ...prev,
      [section]: !prev[section]
    }));
  };

  const menuItems = [
    {
      title: 'Clustering & Reduction',
      key: 'clustering',
      items: [
        { name: 'K-Means Clustering', path: '/kmeans' }
      ]
    },
    {
      title: 'Regression',
      key: 'regression',
      items: [
        { name: 'Linear Regression', path: '/linear-regression' }
      ]
    }
  ];

  const isActive = (path) => currentPath === path;

  return (
    <aside style={{
      position: 'fixed',
      left: 0,
      top: 0,
      width: '220px',
      height: '100vh',
      backgroundColor: '#fafafa',
      borderRight: '1px solid #e0e0e0',
      zIndex: 10,
      overflowY: 'auto'
    }}>
      <style>{`
        aside::-webkit-scrollbar {
          width: 8px;
        }
        aside::-webkit-scrollbar-track {
          background: transparent;
        }
        aside::-webkit-scrollbar-thumb {
          background: #ddd;
          border-radius: 4px;
        }
        aside::-webkit-scrollbar-thumb:hover {
          background: #ccc;
        }
      `}</style>
      
      <div style={{
        padding: '30px 25px 20px',
        borderBottom: '1px solid #e0e0e0'
      }}>
        <h2 
          onClick={() => onNavigate('/')}
          style={{
            fontSize: '20px',
            fontWeight: 500,
            color: '#222',
            cursor: 'pointer',
            margin: 0
          }}
          onMouseEnter={(e) => e.target.style.color = '#0066cc'}
          onMouseLeave={(e) => e.target.style.color = '#222'}
        >
          ML Visualizer
        </h2>
      </div>
      
      <nav style={{ padding: '10px 0' }}>
        {menuItems.map((section) => (
          <div key={section.key}>
            <button
              onClick={() => toggleSection(section.key)}
              style={{
                width: '100%',
                padding: '10px 25px',
                fontSize: '14px',
                fontWeight: 600,
                color: '#222',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                background: 'none',
                border: 'none',
                cursor: 'pointer',
                textAlign: 'left'
              }}
              onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#f0f0f0'}
              onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
            >
              <span>{section.title}</span>
              <span style={{ fontSize: '18px', color: '#666' }}>
                {expandedSections[section.key] ? '−' : '+'}
              </span>
            </button>
            {expandedSections[section.key] && (
              <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
                {section.items.map((item) => (
                  <li key={item.path}>
                    <a
                      href="#"
                      onClick={(e) => {
                        e.preventDefault();
                        onNavigate(item.path);
                      }}
                      style={{
                        display: 'block',
                        padding: '8px 25px 8px 40px',
                        fontSize: '14px',
                        color: isActive(item.path) ? '#0066cc' : '#333',
                        textDecoration: 'none',
                        fontWeight: isActive(item.path) ? 500 : 'normal',
                        backgroundColor: isActive(item.path) ? '#e8f0f8' : 'transparent',
                        borderLeft: isActive(item.path) ? '3px solid #0066cc' : '3px solid transparent',
                        paddingLeft: isActive(item.path) ? '37px' : '40px'
                      }}
                      onMouseEnter={(e) => {
                        if (!isActive(item.path)) {
                          e.currentTarget.style.backgroundColor = '#f0f0f0';
                          e.currentTarget.style.color = '#0066cc';
                        }
                      }}
                      onMouseLeave={(e) => {
                        if (!isActive(item.path)) {
                          e.currentTarget.style.backgroundColor = 'transparent';
                          e.currentTarget.style.color = '#333';
                        }
                      }}
                    >
                      {item.name}
                    </a>
                  </li>
                ))}
              </ul>
            )}
          </div>
        ))}
      </nav>
    </aside>
  );
};

export default Sidebar;

