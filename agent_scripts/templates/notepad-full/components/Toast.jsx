import React, { useState, useEffect } from 'react';

let toastIdCounter = 0;
let addToastCallback = null;

export function showToast(message, type = 'info') {
  if (addToastCallback) {
    addToastCallback({ id: toastIdCounter++, message, type });
  }
}

export function ToastContainer() {
  const [toasts, setToasts] = useState([]);

  useEffect(() => {
    addToastCallback = (toast) => {
      setToasts(prev => [...prev, toast]);
      setTimeout(() => {
        setToasts(prev => prev.filter(t => t.id !== toast.id));
      }, 3000);
    };
    return () => { addToastCallback = null; };
  }, []);

  return (
    <div style={{
      position: 'fixed',
      top: '16px',
      right: '16px',
      zIndex: 10000,
      display: 'flex',
      flexDirection: 'column',
      gap: '8px',
      pointerEvents: 'none'
    }}>
      {toasts.map(toast => (
        <div
          key={toast.id}
          style={{
            backgroundColor: toast.type === 'error' ? '#fee2e2' : toast.type === 'success' ? '#d1fae5' : '#e0e7ff',
            color: toast.type === 'error' ? '#991b1b' : toast.type === 'success' ? '#065f46' : '#1e40af',
            padding: '12px 16px',
            borderRadius: '8px',
            boxShadow: '0 4px 12px rgba(0, 0, 0, 0.15)',
            fontSize: '14px',
            fontWeight: 500,
            pointerEvents: 'auto',
            animation: 'slideIn 0.3s ease-out',
            minWidth: '200px',
            maxWidth: '400px'
          }}
        >
          {toast.message}
        </div>
      ))}
      <style>{`
        @keyframes slideIn {
          from {
            transform: translateX(100%);
            opacity: 0;
          }
          to {
            transform: translateX(0);
            opacity: 1;
          }
        }
      `}</style>
    </div>
  );
}

export function confirmAction(message) {
  return new Promise((resolve) => {
    const div = document.createElement('div');
    div.style.cssText = `
      position: fixed; top: 0; left: 0; right: 0; bottom: 0;
      background: rgba(0, 0, 0, 0.5); display: flex; align-items: center;
      justify-content: center; z-index: 10001;
    `;
    
    const modal = document.createElement('div');
    modal.style.cssText = `
      background: white; border-radius: 8px; padding: 24px;
      max-width: 400px; box-shadow: 0 4px 20px rgba(0, 0, 0, 0.15);
    `;
    
    modal.innerHTML = `
      <div style="font-size: 16px; color: #111827; margin-bottom: 20px; line-height: 1.5;">
        ${message}
      </div>
      <div style="display: flex; gap: 8px; justify-content: flex-end;">
        <button id="cancel-btn" style="
          padding: 8px 16px; border: 1px solid #d1d5db; border-radius: 6px;
          background: white; color: #374151; cursor: pointer; font-size: 14px;
          font-weight: 500; transition: background-color 0.15s;
        ">Cancel</button>
        <button id="confirm-btn" style="
          padding: 8px 16px; border: none; border-radius: 6px;
          background: #ef4444; color: white; cursor: pointer; font-size: 14px;
          font-weight: 500; transition: background-color 0.15s;
        ">Delete</button>
      </div>
    `;
    
    div.appendChild(modal);
    document.body.appendChild(div);
    
    const cleanup = () => document.body.removeChild(div);
    
    modal.querySelector('#cancel-btn').onclick = () => {
      cleanup();
      resolve(false);
    };
    
    modal.querySelector('#confirm-btn').onclick = () => {
      cleanup();
      resolve(true);
    };
    
    div.onclick = (e) => {
      if (e.target === div) {
        cleanup();
        resolve(false);
      }
    };
  });
}

