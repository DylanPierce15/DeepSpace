import React, { useState } from 'react';
import PlantCard from './components/PlantCard.jsx';
import { needsWatering } from './utils/plantHelpers.js';

const PLANT_ICONS = ['🌱', '🌿', '🪴', '🌵', '🌴', '🌲', '🌳', '🍀', '🌾', '🌻'];

function PlantTrackerWidget() {
  // Store plants in widget storage
  const [plants, setPlants] = useStorage('plants', []);
  
  // Form state
  const [isAdding, setIsAdding] = useState(false);
  const [editingPlant, setEditingPlant] = useState(null);
  const [formData, setFormData] = useState({
    name: '',
    species: '',
    icon: '🌱',
    wateringFrequency: 7,
    notes: ''
  });
  
  // Filter state
  const [filter, setFilter] = useState('all'); // 'all', 'needsWater', 'healthy'
  
  const handleAddPlant = () => {
    const newPlant = {
      id: Date.now().toString(),
      ...formData,
      lastWatered: new Date().toISOString(),
      createdAt: new Date().toISOString()
    };
    
    setPlants([...plants, newPlant]);
    resetForm();
  };
  
  const handleUpdatePlant = () => {
    setPlants(plants.map(p => 
      p.id === editingPlant.id ? { ...editingPlant, ...formData } : p
    ));
    resetForm();
  };
  
  const handleWaterPlant = (plantId) => {
    setPlants(plants.map(p => 
      p.id === plantId ? { ...p, lastWatered: new Date().toISOString() } : p
    ));
  };
  
  const handleDeletePlant = (plantId) => {
    if (confirm('Are you sure you want to delete this plant?')) {
      setPlants(plants.filter(p => p.id !== plantId));
    }
  };
  
  const handleEditPlant = (plant) => {
    setEditingPlant(plant);
    setFormData({
      name: plant.name,
      species: plant.species,
      icon: plant.icon,
      wateringFrequency: plant.wateringFrequency,
      notes: plant.notes || ''
    });
    setIsAdding(true);
  };
  
  const resetForm = () => {
    setIsAdding(false);
    setEditingPlant(null);
    setFormData({
      name: '',
      species: '',
      icon: '🌱',
      wateringFrequency: 7,
      notes: ''
    });
  };
  
  // Filter plants
  const filteredPlants = plants.filter(plant => {
    if (filter === 'needsWater') {
      return needsWatering(plant.lastWatered, plant.wateringFrequency);
    }
    if (filter === 'healthy') {
      return !needsWatering(plant.lastWatered, plant.wateringFrequency);
    }
    return true; // 'all'
  });
  
  const plantsNeedingWater = plants.filter(p => 
    needsWatering(p.lastWatered, p.wateringFrequency)
  ).length;
  
  return (
    <div style={{
      width: '100%',
      height: '100%',
      backgroundColor: '#0f172a',
      color: '#f1f5f9',
      fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
      display: 'flex',
      flexDirection: 'column',
      overflow: 'hidden'
    }}>
      {/* Header */}
      <div style={{
        padding: '20px',
        borderBottom: '2px solid #1e293b',
        backgroundColor: '#1e293b'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div>
            <h1 style={{ 
              margin: 0, 
              fontSize: '24px', 
              fontWeight: 'bold',
              display: 'flex',
              alignItems: 'center',
              gap: '8px'
            }}>
              🌱 Plant Tracker
            </h1>
            <p style={{ margin: '4px 0 0 0', fontSize: '13px', color: '#94a3b8' }}>
              {plants.length} {plants.length === 1 ? 'plant' : 'plants'} tracked
              {plantsNeedingWater > 0 && (
                <span style={{ color: '#f59e0b', marginLeft: '8px' }}>
                  • {plantsNeedingWater} need{plantsNeedingWater === 1 ? 's' : ''} water 💧
                </span>
              )}
            </p>
          </div>
          
          <button
            onClick={() => setIsAdding(!isAdding)}
            style={{
              padding: '10px 20px',
              backgroundColor: '#22c55e',
              color: 'white',
              border: 'none',
              borderRadius: '8px',
              fontSize: '14px',
              fontWeight: '500',
              cursor: 'pointer',
              transition: 'all 0.2s'
            }}
            onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#16a34a'}
            onMouseLeave={(e) => e.currentTarget.style.backgroundColor = '#22c55e'}
          >
            {isAdding ? '✕ Cancel' : '+ Add Plant'}
          </button>
        </div>
        
        {/* Filter Tabs */}
        <div style={{ display: 'flex', gap: '8px', marginTop: '16px' }}>
          {[
            { id: 'all', label: `All (${plants.length})` },
            { id: 'needsWater', label: `Needs Water (${plantsNeedingWater})` },
            { id: 'healthy', label: `Healthy (${plants.length - plantsNeedingWater})` }
          ].map(tab => (
            <button
              key={tab.id}
              onClick={() => setFilter(tab.id)}
              style={{
                padding: '8px 16px',
                backgroundColor: filter === tab.id ? '#3b82f6' : '#334155',
                color: 'white',
                border: 'none',
                borderRadius: '6px',
                fontSize: '13px',
                cursor: 'pointer',
                transition: 'all 0.2s'
              }}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>
      
      {/* Add/Edit Form */}
      {isAdding && (
        <div style={{
          padding: '20px',
          backgroundColor: '#1e293b',
          borderBottom: '2px solid #334155'
        }}>
          <h3 style={{ margin: '0 0 16px 0', fontSize: '16px' }}>
            {editingPlant ? 'Edit Plant' : 'Add New Plant'}
          </h3>
          
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
            {/* Plant Name */}
            <div>
              <label style={{ fontSize: '12px', color: '#94a3b8', display: 'block', marginBottom: '6px' }}>
                Plant Name *
              </label>
              <input
                type="text"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder="e.g., My Monstera"
                style={{
                  width: '100%',
                  padding: '10px',
                  backgroundColor: '#0f172a',
                  border: '1px solid #475569',
                  borderRadius: '6px',
                  color: '#f1f5f9',
                  fontSize: '14px'
                }}
              />
            </div>
            
            {/* Species */}
            <div>
              <label style={{ fontSize: '12px', color: '#94a3b8', display: 'block', marginBottom: '6px' }}>
                Species
              </label>
              <input
                type="text"
                value={formData.species}
                onChange={(e) => setFormData({ ...formData, species: e.target.value })}
                placeholder="e.g., Monstera deliciosa"
                style={{
                  width: '100%',
                  padding: '10px',
                  backgroundColor: '#0f172a',
                  border: '1px solid #475569',
                  borderRadius: '6px',
                  color: '#f1f5f9',
                  fontSize: '14px'
                }}
              />
            </div>
            
            {/* Watering Frequency */}
            <div>
              <label style={{ fontSize: '12px', color: '#94a3b8', display: 'block', marginBottom: '6px' }}>
                Water Every (days) *
              </label>
              <input
                type="number"
                value={formData.wateringFrequency}
                onChange={(e) => setFormData({ ...formData, wateringFrequency: parseInt(e.target.value) || 7 })}
                min="1"
                max="365"
                style={{
                  width: '100%',
                  padding: '10px',
                  backgroundColor: '#0f172a',
                  border: '1px solid #475569',
                  borderRadius: '6px',
                  color: '#f1f5f9',
                  fontSize: '14px'
                }}
              />
            </div>
            
            {/* Icon Selector */}
            <div>
              <label style={{ fontSize: '12px', color: '#94a3b8', display: 'block', marginBottom: '6px' }}>
                Icon
              </label>
              <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                {PLANT_ICONS.map(icon => (
                  <button
                    key={icon}
                    onClick={() => setFormData({ ...formData, icon })}
                    style={{
                      width: '40px',
                      height: '40px',
                      fontSize: '20px',
                      backgroundColor: formData.icon === icon ? '#3b82f6' : '#0f172a',
                      border: `2px solid ${formData.icon === icon ? '#3b82f6' : '#475569'}`,
                      borderRadius: '6px',
                      cursor: 'pointer',
                      transition: 'all 0.2s'
                    }}
                  >
                    {icon}
                  </button>
                ))}
              </div>
            </div>
          </div>
          
          {/* Notes */}
          <div style={{ marginTop: '12px' }}>
            <label style={{ fontSize: '12px', color: '#94a3b8', display: 'block', marginBottom: '6px' }}>
              Notes
            </label>
            <textarea
              value={formData.notes}
              onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
              placeholder="e.g., Prefers indirect sunlight, keep soil moist..."
              rows={2}
              style={{
                width: '100%',
                padding: '10px',
                backgroundColor: '#0f172a',
                border: '1px solid #475569',
                borderRadius: '6px',
                color: '#f1f5f9',
                fontSize: '14px',
                resize: 'vertical',
                fontFamily: 'inherit'
              }}
            />
          </div>
          
          {/* Form Actions */}
          <div style={{ display: 'flex', gap: '8px', marginTop: '16px' }}>
            <button
              onClick={editingPlant ? handleUpdatePlant : handleAddPlant}
              disabled={!formData.name.trim()}
              style={{
                flex: 1,
                padding: '10px 20px',
                backgroundColor: formData.name.trim() ? '#22c55e' : '#475569',
                color: 'white',
                border: 'none',
                borderRadius: '6px',
                fontSize: '14px',
                fontWeight: '500',
                cursor: formData.name.trim() ? 'pointer' : 'not-allowed',
                transition: 'all 0.2s'
              }}
            >
              {editingPlant ? '✓ Update Plant' : '+ Add Plant'}
            </button>
            <button
              onClick={resetForm}
              style={{
                padding: '10px 20px',
                backgroundColor: '#475569',
                color: 'white',
                border: 'none',
                borderRadius: '6px',
                fontSize: '14px',
                cursor: 'pointer'
              }}
            >
              Cancel
            </button>
          </div>
        </div>
      )}
      
      {/* Plants List */}
      <div style={{
        flex: 1,
        overflowY: 'auto',
        padding: '20px'
      }}>
        {filteredPlants.length === 0 ? (
          <div style={{
            textAlign: 'center',
            padding: '60px 20px',
            color: '#64748b'
          }}>
            <div style={{ fontSize: '48px', marginBottom: '16px' }}>🪴</div>
            <div style={{ fontSize: '16px', marginBottom: '8px' }}>
              {plants.length === 0 
                ? 'No plants yet!' 
                : filter === 'needsWater'
                ? 'All plants are watered! 🎉'
                : 'No healthy plants found'}
            </div>
            <div style={{ fontSize: '13px' }}>
              {plants.length === 0 && 'Click "Add Plant" to start tracking your plants'}
            </div>
          </div>
        ) : (
          filteredPlants.map(plant => (
            <PlantCard
              key={plant.id}
              plant={plant}
              onWater={handleWaterPlant}
              onEdit={handleEditPlant}
              onDelete={handleDeletePlant}
            />
          ))
        )}
      </div>
    </div>
  );
}

export default PlantTrackerWidget;

