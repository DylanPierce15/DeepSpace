import React from 'react';
import { daysSinceWatering, getHealthStatus, getHealthColor, formatDate } from '../utils/plantHelpers.js';

export default function PlantCard({ plant, onWater, onEdit, onDelete }) {
  const status = getHealthStatus(plant.lastWatered, plant.wateringFrequency);
  const healthColor = getHealthColor(status);
  const daysSince = daysSinceWatering(plant.lastWatered);
  
  return (
    <div style={{
      padding: '16px',
      borderRadius: '12px',
      backgroundColor: '#1e293b',
      border: `2px solid ${healthColor}`,
      marginBottom: '12px',
      position: 'relative'
    }}>
      {/* Health Indicator Dot */}
      <div style={{
        position: 'absolute',
        top: '12px',
        right: '12px',
        width: '12px',
        height: '12px',
        borderRadius: '50%',
        backgroundColor: healthColor,
        boxShadow: `0 0 8px ${healthColor}`
      }} />
      
      {/* Plant Icon and Name */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '12px' }}>
        <span style={{ fontSize: '32px' }}>{plant.icon}</span>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: '18px', fontWeight: 'bold', color: '#f1f5f9' }}>
            {plant.name}
          </div>
          <div style={{ fontSize: '12px', color: '#94a3b8', textTransform: 'capitalize' }}>
            {plant.species || 'Unknown species'}
          </div>
        </div>
      </div>
      
      {/* Watering Info */}
      <div style={{ 
        display: 'grid', 
        gridTemplateColumns: '1fr 1fr', 
        gap: '8px',
        marginBottom: '12px',
        padding: '12px',
        backgroundColor: '#0f172a',
        borderRadius: '8px'
      }}>
        <div>
          <div style={{ fontSize: '11px', color: '#64748b', marginBottom: '4px' }}>
            Last Watered
          </div>
          <div style={{ fontSize: '13px', color: '#e2e8f0', fontWeight: '500' }}>
            {formatDate(plant.lastWatered)}
          </div>
          {daysSince !== null && (
            <div style={{ fontSize: '11px', color: '#94a3b8' }}>
              {daysSince} {daysSince === 1 ? 'day' : 'days'} ago
            </div>
          )}
        </div>
        <div>
          <div style={{ fontSize: '11px', color: '#64748b', marginBottom: '4px' }}>
            Water Every
          </div>
          <div style={{ fontSize: '13px', color: '#e2e8f0', fontWeight: '500' }}>
            {plant.wateringFrequency} days
          </div>
          <div style={{ fontSize: '11px', color: '#94a3b8' }}>
            {status === 'healthy' ? '✓ On schedule' : status === 'thirsty' ? '⚠ Due soon' : '🚨 Overdue'}
          </div>
        </div>
      </div>
      
      {/* Notes */}
      {plant.notes && (
        <div style={{
          fontSize: '12px',
          color: '#cbd5e1',
          padding: '8px',
          backgroundColor: '#0f172a',
          borderRadius: '6px',
          marginBottom: '12px',
          fontStyle: 'italic'
        }}>
          💭 {plant.notes}
        </div>
      )}
      
      {/* Actions */}
      <div style={{ display: 'flex', gap: '8px' }}>
        <button
          onClick={() => onWater(plant.id)}
          style={{
            flex: 1,
            padding: '8px 16px',
            backgroundColor: '#3b82f6',
            color: 'white',
            border: 'none',
            borderRadius: '6px',
            fontSize: '13px',
            fontWeight: '500',
            cursor: 'pointer',
            transition: 'all 0.2s'
          }}
          onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#2563eb'}
          onMouseLeave={(e) => e.currentTarget.style.backgroundColor = '#3b82f6'}
        >
          💧 Water Now
        </button>
        <button
          onClick={() => onEdit(plant)}
          style={{
            padding: '8px 12px',
            backgroundColor: '#475569',
            color: 'white',
            border: 'none',
            borderRadius: '6px',
            fontSize: '13px',
            cursor: 'pointer'
          }}
        >
          ✏️
        </button>
        <button
          onClick={() => onDelete(plant.id)}
          style={{
            padding: '8px 12px',
            backgroundColor: '#ef4444',
            color: 'white',
            border: 'none',
            borderRadius: '6px',
            fontSize: '13px',
            cursor: 'pointer'
          }}
        >
          🗑️
        </button>
      </div>
    </div>
  );
}

