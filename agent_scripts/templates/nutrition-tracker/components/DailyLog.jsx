import React, { useState } from 'react';
import FoodItem from './FoodItem';
import { COLORS } from '../utils/constants';
import { formatDisplayDate } from '../utils/dateUtils';

function DailyLog({ dateKey, foods, onUpdateFood, onDeleteFood, onReorder }) {
  const totalCalories = foods.reduce((sum, food) => sum + food.calories, 0);
  const [expandedFoodId, setExpandedFoodId] = useState(null);
  const [draggedIndex, setDraggedIndex] = useState(null);

  return (
    <div style={{
      background: 'white',
      borderRadius: '16px',
      padding: '24px',
      boxShadow: '0 2px 8px rgba(0,0,0,0.08)'
    }}>
      <div style={{ 
        display: 'flex', 
        justifyContent: 'space-between', 
        alignItems: 'center',
        marginBottom: '20px'
      }}>
        <h3 style={{ 
          margin: 0, 
          fontSize: '18px', 
          fontWeight: '500',
          color: COLORS.text,
          display: 'flex',
          alignItems: 'center',
          gap: '8px'
        }}>
          <span className="material-icons" style={{ color: COLORS.primary }}>
            restaurant_menu
          </span>
          {formatDisplayDate(dateKey)}
        </h3>
        <div style={{ 
          fontSize: '14px', 
          fontWeight: '600',
          color: COLORS.textSecondary 
        }}>
          {foods.length} {foods.length === 1 ? 'item' : 'items'} • {totalCalories} cal
        </div>
      </div>

      {foods.length === 0 ? (
        <div style={{
          textAlign: 'center',
          padding: '60px 20px',
          color: COLORS.textSecondary
        }}>
          <span className="material-icons" style={{ 
            fontSize: '64px', 
            color: COLORS.border,
            marginBottom: '16px',
            display: 'block'
          }}>
            no_meals
          </span>
          <div style={{ fontSize: '16px', marginBottom: '8px' }}>
            No foods logged yet
          </div>
          <div style={{ fontSize: '13px' }}>
            Use the quick entry above to add your first meal
          </div>
        </div>
      ) : (
        <div style={{ 
          maxHeight: '500px', 
          overflowY: 'auto',
          paddingRight: '4px',
          userSelect: 'none'
        }}>
          {foods.map((food, index) => (
            <div
              key={food.id}
              draggable={expandedFoodId !== food.id}
              onDragStart={(e) => {
                if (expandedFoodId === food.id) {
                  e.preventDefault();
                  return;
                }
                setDraggedIndex(index);
                e.dataTransfer.effectAllowed = 'move';
              }}
              onDragOver={(e) => {
                e.preventDefault();
                e.dataTransfer.dropEffect = 'move';
              }}
              onDrop={(e) => {
                e.preventDefault();
                if (draggedIndex !== null && draggedIndex !== index) {
                  onReorder(draggedIndex, index);
                }
                setDraggedIndex(null);
              }}
              onDragEnd={() => setDraggedIndex(null)}
              style={{
                opacity: draggedIndex === index ? 0.5 : 1,
                cursor: expandedFoodId === food.id ? 'default' : 'grab',
                transition: 'opacity 0.2s'
              }}
            >
              <FoodItem
                food={food}
                onUpdate={onUpdateFood}
                onDelete={onDeleteFood}
                isExpanded={expandedFoodId === food.id}
                onExpand={() => setExpandedFoodId(food.id)}
                onCollapse={() => setExpandedFoodId(null)}
              />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default DailyLog;

