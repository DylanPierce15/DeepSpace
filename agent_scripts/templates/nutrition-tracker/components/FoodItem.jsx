import React, { useState, useEffect } from 'react';
import { COLORS } from '../utils/constants';

function FoodItem({ food, onUpdate, onDelete, isExpanded, onExpand, onCollapse }) {
  const [editedFood, setEditedFood] = useState(food);
  
  useEffect(() => {
    setEditedFood(food);
  }, [food]);

  const handleSave = () => {
    onUpdate(editedFood);
    onCollapse();
  };

  const formatTime = (timestamp) => {
    const date = new Date(timestamp);
    return date.toLocaleTimeString('en-US', { 
      hour: 'numeric', 
      minute: '2-digit',
      hour12: true 
    });
  };

  if (isExpanded) {
    return (
      <div style={{
        padding: '16px',
        background: '#f9f9f9',
        borderRadius: '12px',
        border: `2px solid ${COLORS.primary}`,
        marginBottom: '8px'
      }}>
        <div style={{ marginBottom: '12px' }}>
          <label style={{ 
            display: 'block', 
            fontSize: '12px', 
            fontWeight: '500', 
            color: COLORS.text,
            marginBottom: '6px'
          }}>
            Food Name
          </label>
          <input
            type="text"
            value={editedFood.name}
            onChange={(e) => setEditedFood({...editedFood, name: e.target.value})}
            style={{
              width: '100%',
              padding: '10px',
              border: `1px solid ${COLORS.border}`,
              borderRadius: '6px',
              fontSize: '14px',
              fontFamily: 'Roboto, sans-serif',
              boxSizing: 'border-box'
            }}
          />
        </div>

        <div style={{ 
          display: 'grid', 
          gridTemplateColumns: 'repeat(4, 1fr)', 
          gap: '10px',
          marginBottom: '12px'
        }}>
          <div>
            <label style={{ 
              display: 'block', 
              fontSize: '11px', 
              fontWeight: '500', 
              color: COLORS.text,
              marginBottom: '4px'
            }}>
              Calories
            </label>
            <input
              type="number"
              value={editedFood.calories}
              onChange={(e) => setEditedFood({...editedFood, calories: parseInt(e.target.value) || 0})}
              style={{
                width: '100%',
                padding: '8px',
                border: `1px solid ${COLORS.border}`,
                borderRadius: '6px',
                fontSize: '13px',
                boxSizing: 'border-box'
              }}
            />
          </div>
          <div>
            <label style={{ 
              display: 'block', 
              fontSize: '11px', 
              fontWeight: '500', 
              color: COLORS.text,
              marginBottom: '4px'
            }}>
              Protein (g)
            </label>
            <input
              type="number"
              value={editedFood.protein}
              onChange={(e) => setEditedFood({...editedFood, protein: parseInt(e.target.value) || 0})}
              style={{
                width: '100%',
                padding: '8px',
                border: `1px solid ${COLORS.border}`,
                borderRadius: '6px',
                fontSize: '13px',
                boxSizing: 'border-box'
              }}
            />
          </div>
          <div>
            <label style={{ 
              display: 'block', 
              fontSize: '11px', 
              fontWeight: '500', 
              color: COLORS.text,
              marginBottom: '4px'
            }}>
              Carbs (g)
            </label>
            <input
              type="number"
              value={editedFood.carbs}
              onChange={(e) => setEditedFood({...editedFood, carbs: parseInt(e.target.value) || 0})}
              style={{
                width: '100%',
                padding: '8px',
                border: `1px solid ${COLORS.border}`,
                borderRadius: '6px',
                fontSize: '13px',
                boxSizing: 'border-box'
              }}
            />
          </div>
          <div>
            <label style={{ 
              display: 'block', 
              fontSize: '11px', 
              fontWeight: '500', 
              color: COLORS.text,
              marginBottom: '4px'
            }}>
              Fat (g)
            </label>
            <input
              type="number"
              value={editedFood.fat}
              onChange={(e) => setEditedFood({...editedFood, fat: parseInt(e.target.value) || 0})}
              style={{
                width: '100%',
                padding: '8px',
                border: `1px solid ${COLORS.border}`,
                borderRadius: '6px',
                fontSize: '13px',
                boxSizing: 'border-box'
              }}
            />
          </div>
        </div>

        <div style={{ display: 'flex', gap: '8px' }}>
          <button
            onClick={handleSave}
            style={{
              flex: 1,
              padding: '10px',
              border: 'none',
              borderRadius: '6px',
              background: COLORS.success,
              color: 'white',
              cursor: 'pointer',
              fontSize: '13px',
              fontWeight: '500',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '6px'
            }}
          >
            <span className="material-icons" style={{ fontSize: '16px' }}>check</span>
            Save
          </button>
          <button
            onClick={onCollapse}
            style={{
              flex: 1,
              padding: '10px',
              border: `1px solid ${COLORS.border}`,
              borderRadius: '6px',
              background: 'white',
              color: COLORS.text,
              cursor: 'pointer',
              fontSize: '13px',
              fontWeight: '500'
            }}
          >
            Cancel
          </button>
        </div>
      </div>
    );
  }

  return (
    <div
      onClick={onExpand}
      style={{
        padding: '14px 16px',
        background: 'white',
        borderRadius: '10px',
        border: `1px solid ${COLORS.border}`,
        marginBottom: '8px',
        cursor: 'grab',
        transition: 'all 0.2s',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between'
      }}
      onMouseOver={e => {
        e.currentTarget.style.borderColor = COLORS.primary;
        e.currentTarget.style.boxShadow = '0 2px 8px rgba(102,126,234,0.15)';
      }}
      onMouseOut={e => {
        e.currentTarget.style.borderColor = COLORS.border;
        e.currentTarget.style.boxShadow = 'none';
      }}
    >
      <div style={{ flex: 1 }}>
        <div style={{ 
          display: 'flex', 
          alignItems: 'center', 
          gap: '10px',
          marginBottom: '4px'
        }}>
          <span className="material-icons" style={{ 
            fontSize: '20px', 
            color: COLORS.primary 
          }}>
            restaurant
          </span>
          <span style={{ 
            fontWeight: '500', 
            fontSize: '15px',
            color: COLORS.text 
          }}>
            {food.name}
          </span>
        </div>
        <div style={{ 
          fontSize: '12px', 
          color: COLORS.textSecondary,
          marginLeft: '30px'
        }}>
          {formatTime(food.timestamp)}
          {(food.protein > 0 || food.carbs > 0 || food.fat > 0) && (
            <span style={{ marginLeft: '12px' }}>
              • P: {food.protein}g • C: {food.carbs}g • F: {food.fat}g
            </span>
          )}
        </div>
      </div>
      <div style={{ 
        display: 'flex', 
        alignItems: 'center', 
        gap: '12px' 
      }}>
        <div style={{
          fontSize: '18px',
          fontWeight: '600',
          color: COLORS.primary
        }}>
          {food.calories}
          <span style={{ 
            fontSize: '12px', 
            fontWeight: '400',
            color: COLORS.textSecondary,
            marginLeft: '2px'
          }}>
            cal
          </span>
        </div>
        <button
          onClick={(e) => {
            e.stopPropagation();
            onDelete(food.id);
          }}
          style={{
            padding: '6px',
            border: 'none',
            borderRadius: '6px',
            background: 'transparent',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            transition: 'background 0.2s'
          }}
          onMouseOver={e => e.currentTarget.style.background = '#FFEBEE'}
          onMouseOut={e => e.currentTarget.style.background = 'transparent'}
        >
          <span className="material-icons" style={{ 
            fontSize: '18px', 
            color: COLORS.error 
          }}>
            delete_outline
          </span>
        </button>
      </div>
    </div>
  );
}

export default FoodItem;

