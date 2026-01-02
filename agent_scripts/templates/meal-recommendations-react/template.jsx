import React, { useState, useMemo } from 'react';

function MealRecommendationsWidget() {
  // Global storage
  const [mealData, setMealData] = useGlobalStorage('workout-coach-meals', null)
  const [shoppingListItems, setShoppingListItems] = useGlobalStorage('shopping-list-items', [])
  const [workoutProfile, setWorkoutProfile] = useGlobalStorage('workout-user-profile', null)
  
  // Local state
  const [expandedMeal, setExpandedMeal] = useState(null)
  const [addedIngredients, setAddedIngredients] = useState({}) // Track which ingredients were added
  const [showSuccessMessage, setShowSuccessMessage] = useState(null)

  // Parse ingredient string to extract quantity and name
  // Examples: 
  //   "3 eggs" -> {name: "eggs", quantity: 3}
  //   "100g chicken breast" -> {name: "chicken breast", quantity: 1} (ignore weight)
  //   "1/2 cup oats" -> {name: "oats", quantity: 1} (fractions round to 1)
  const parseIngredient = (ingredient) => {
    const trimmed = ingredient.trim()
    
    // Match patterns with units (weight/volume)
    const unitMatch = trimmed.match(/^[\d./]+\s*(g|kg|lb|lbs|oz|cup|cups|tbsp|tsp|ml|l)\s+(.+)$/i)
    if (unitMatch) {
      // Has a unit (weight/volume) - ignore the number, use quantity 1
      const name = unitMatch[2].trim()
      return { name, quantity: 1 }
    }
    
    // Match patterns with just a number (no unit): "3 eggs", "2 tomatoes"
    const numberMatch = trimmed.match(/^([\d./]+)\s+(.+)$/i)
    if (numberMatch) {
      const quantityStr = numberMatch[1]
      const name = numberMatch[2].trim()
      
      // Handle fractions like "1/2" - treat as 1
      if (quantityStr.includes('/')) {
        return { name, quantity: 1 }
      }
      
      const quantity = parseFloat(quantityStr)
      return { name, quantity: isNaN(quantity) ? 1 : Math.max(1, Math.ceil(quantity)) }
    }
    
    // No quantity found, use whole string as name
    return { name: trimmed, quantity: 1 }
  }

  // Add ingredient to shopping list
  const addToShoppingList = (ingredient, mealType) => {
    const { name, quantity } = parseIngredient(ingredient)
    
    // Check if already in shopping list (case-insensitive)
    const existingItem = shoppingListItems.find(item => 
      item.name.toLowerCase() === name.toLowerCase()
    )

    if (existingItem) {
      // If exists, add the parsed quantity
      const updatedItems = shoppingListItems.map(item =>
        item.name.toLowerCase() === name.toLowerCase()
          ? { ...item, quantity: item.quantity + quantity }
          : item
      )
      setShoppingListItems(updatedItems)
    } else {
      // Add new item with parsed quantity
      const newItem = {
        id: Date.now() + Math.random(), // Ensure unique ID
        name: name,
        quantity: quantity,
        completed: false,
        createdAt: new Date().toISOString()
      }
      setShoppingListItems([...shoppingListItems, newItem])
    }

    // Track added ingredient for UI feedback (use functional update)
    const key = `${mealType}-${ingredient}`
    setAddedIngredients(prev => ({ ...prev, [key]: true }))
    
    // Show success message
    setShowSuccessMessage(`✅ Added ${quantity > 1 ? quantity + 'x ' : ''}"${name}" to shopping list`)
    setTimeout(() => setShowSuccessMessage(null), 2000)
  }

  // Add all main ingredients from a meal
  const addAllMainIngredients = (meal) => {
    // Parse all ingredients first
    const parsedIngredients = meal.mainIngredients.map(ing => ({
      original: ing,
      ...parseIngredient(ing)
    }))

    // Build new shopping list items
    const newItems = []
    const updatedExisting = [...shoppingListItems]

    parsedIngredients.forEach(({ name, quantity, original }) => {
      const existingIndex = updatedExisting.findIndex(item => 
        item.name.toLowerCase() === name.toLowerCase()
      )

      if (existingIndex >= 0) {
        // Update existing item quantity
        updatedExisting[existingIndex] = {
          ...updatedExisting[existingIndex],
          quantity: updatedExisting[existingIndex].quantity + quantity
        }
      } else {
        // Check if we already planned to add this item in this batch
        const alreadyPlanned = newItems.find(item => 
          item.name.toLowerCase() === name.toLowerCase()
        )
        
        if (alreadyPlanned) {
          alreadyPlanned.quantity += quantity
        } else {
          newItems.push({
            id: Date.now() + Math.random(),
            name: name,
            quantity: quantity,
            completed: false,
            createdAt: new Date().toISOString()
          })
        }
      }

      // Track added ingredient for UI feedback
      const key = `${meal.type}-${original}`
      setAddedIngredients(prev => ({ ...prev, [key]: true }))
    })

    // Update shopping list once
    setShoppingListItems([...updatedExisting, ...newItems])
    
    setShowSuccessMessage(`✅ Added all ${meal.mainIngredients.length} ingredients from ${meal.name}`)
    setTimeout(() => setShowSuccessMessage(null), 3000)
  }

  // Format date
  const formatDate = (dateStr) => {
    if (!dateStr) return 'N/A'
    const date = new Date(dateStr)
    return date.toLocaleDateString('en-US', { 
      weekday: 'short', 
      month: 'short', 
      day: 'numeric' 
    })
  }

  // Get recommendation badge style
  const getRecommendationStyle = (rec) => {
    const styles = {
      KEEP: { bg: '#10b981', label: '✓ KEEP' },
      REDUCE: { bg: '#f59e0b', label: '⚠️ REDUCE' },
      REST: { bg: '#ef4444', label: '🛑 REST' },
      RESTORE: { bg: '#3b82f6', label: '↩️ RESTORE' }
    }
    return styles[rec] || { bg: '#6b7280', label: rec }
  }

  // Meal type emoji
  const getMealEmoji = (type) => {
    const emojis = {
      breakfast: '🌅',
      lunch: '☀️',
      dinner: '🌙'
    }
    return emojis[type] || '🍽️'
  }

  if (!mealData || !mealData.meals || mealData.meals.length === 0) {
    return (
      <div style={{
        width: '100%',
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '40px',
        textAlign: 'center',
        background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
        color: '#fff'
      }}>
        <div style={{ fontSize: '64px', marginBottom: '20px' }}>🍽️</div>
        <h2 style={{ fontSize: '24px', marginBottom: '10px' }}>No Meal Recommendations Yet</h2>
        <p style={{ fontSize: '14px', opacity: 0.9, maxWidth: '300px' }}>
          Run the AI Workout Coach to get personalized meal recommendations based on your health data and workout plan.
        </p>
      </div>
    )
  }

  const { meals, date, workoutRecommendation, createdAt } = mealData
  const recStyle = getRecommendationStyle(workoutRecommendation)

  return (
    <div style={{
      width: '100%',
      height: '100%',
      display: 'flex',
      flexDirection: 'column',
      background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
      overflow: 'hidden'
    }}>
      {/* Header */}
      <div style={{
        padding: '20px',
        borderBottom: '1px solid rgba(255,255,255,0.1)',
        color: '#fff'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
          <h2 style={{ margin: 0, fontSize: '22px', fontWeight: '600' }}>🍽️ Today's Meals</h2>
          <div style={{
            padding: '4px 12px',
            background: recStyle.bg,
            borderRadius: '12px',
            fontSize: '12px',
            fontWeight: '600'
          }}>
            {recStyle.label}
          </div>
        </div>
        <div style={{ fontSize: '13px', opacity: 0.9 }}>
          {formatDate(date || createdAt)} • Generated by AI Coach
        </div>
        {workoutProfile && (
          <div style={{ fontSize: '12px', opacity: 0.8, marginTop: '4px' }}>
            Goal: {workoutProfile.goal} • {workoutProfile.experienceLevel}
          </div>
        )}
      </div>

      {/* Success message */}
      {showSuccessMessage && (
        <div style={{
          position: 'absolute',
          top: '80px',
          left: '50%',
          transform: 'translateX(-50%)',
          background: '#10b981',
          color: '#fff',
          padding: '10px 20px',
          borderRadius: '8px',
          fontSize: '14px',
          fontWeight: '500',
          zIndex: 1000,
          boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
          animation: 'slideDown 0.3s ease'
        }}>
          {showSuccessMessage}
        </div>
      )}

      {/* Meals List */}
      <div style={{
        flex: 1,
        overflowY: 'auto',
        padding: '20px'
      }}>
        {meals.map((meal, idx) => {
          const isExpanded = expandedMeal === meal.type
          
          return (
            <div key={meal.type} style={{
              background: '#fff',
              borderRadius: '12px',
              marginBottom: '16px',
              overflow: 'hidden',
              boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
              transition: 'transform 0.2s',
              cursor: 'pointer'
            }}
            onMouseEnter={(e) => e.currentTarget.style.transform = 'translateY(-2px)'}
            onMouseLeave={(e) => e.currentTarget.style.transform = 'translateY(0)'}
            >
              {/* Meal Header */}
              <div
                onClick={() => setExpandedMeal(isExpanded ? null : meal.type)}
                style={{
                  padding: '16px',
                  background: `linear-gradient(135deg, ${idx === 0 ? '#ff9a9e 0%, #fad0c4' : idx === 1 ? '#a18cd1 0%, #fbc2eb' : '#ffecd2 0%, #fcb69f'} 100%)`,
                  color: '#333',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between'
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                  <div style={{ fontSize: '28px' }}>{getMealEmoji(meal.type)}</div>
                  <div>
                    <div style={{ fontSize: '16px', fontWeight: '600', textTransform: 'capitalize' }}>
                      {meal.type}
                    </div>
                    <div style={{ fontSize: '14px', fontWeight: '500', marginTop: '2px' }}>
                      {meal.name}
                    </div>
                  </div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontSize: '16px', fontWeight: '700' }}>{meal.calories} cal</div>
                  <div style={{ fontSize: '11px', opacity: 0.8, marginTop: '2px' }}>
                    {isExpanded ? '▲' : '▼'}
                  </div>
                </div>
              </div>

              {/* Expanded Content */}
              {isExpanded && (
                <div style={{ padding: '16px' }}>
                  {/* Macros */}
                  <div style={{
                    display: 'flex',
                    gap: '12px',
                    marginBottom: '16px',
                    padding: '12px',
                    background: '#f9fafb',
                    borderRadius: '8px'
                  }}>
                    <div style={{ flex: 1, textAlign: 'center' }}>
                      <div style={{ fontSize: '12px', color: '#6b7280', marginBottom: '2px' }}>Protein</div>
                      <div style={{ fontSize: '16px', fontWeight: '600', color: '#10b981' }}>
                        {meal.macros.protein}
                      </div>
                    </div>
                    <div style={{ flex: 1, textAlign: 'center', borderLeft: '1px solid #e5e7eb', borderRight: '1px solid #e5e7eb' }}>
                      <div style={{ fontSize: '12px', color: '#6b7280', marginBottom: '2px' }}>Carbs</div>
                      <div style={{ fontSize: '16px', fontWeight: '600', color: '#3b82f6' }}>
                        {meal.macros.carbs}
                      </div>
                    </div>
                    <div style={{ flex: 1, textAlign: 'center' }}>
                      <div style={{ fontSize: '12px', color: '#6b7280', marginBottom: '2px' }}>Fats</div>
                      <div style={{ fontSize: '16px', fontWeight: '600', color: '#f59e0b' }}>
                        {meal.macros.fats}
                      </div>
                    </div>
                  </div>

                  {/* Main Ingredients */}
                  <div style={{ marginBottom: '16px' }}>
                    <div style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      marginBottom: '8px'
                    }}>
                      <div style={{ fontSize: '14px', fontWeight: '600', color: '#1f2937' }}>
                        🥗 Main Ingredients
                      </div>
                      <button
                        onClick={() => addAllMainIngredients(meal)}
                        style={{
                          padding: '4px 12px',
                          background: '#10b981',
                          color: '#fff',
                          border: 'none',
                          borderRadius: '6px',
                          fontSize: '11px',
                          fontWeight: '600',
                          cursor: 'pointer',
                          transition: 'all 0.2s'
                        }}
                        onMouseEnter={(e) => e.currentTarget.style.background = '#059669'}
                        onMouseLeave={(e) => e.currentTarget.style.background = '#10b981'}
                      >
                        + Add All
                      </button>
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                      {meal.mainIngredients.map((ingredient, i) => {
                        const key = `${meal.type}-${ingredient}`
                        const isAdded = addedIngredients[key]
                        
                        return (
                          <div key={i} style={{
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            padding: '8px 12px',
                            background: isAdded ? '#d1fae5' : '#f9fafb',
                            borderRadius: '6px',
                            fontSize: '13px',
                            transition: 'all 0.2s'
                          }}>
                            <span style={{ color: '#374151' }}>{ingredient}</span>
                            <button
                              onClick={() => addToShoppingList(ingredient, meal.type)}
                              style={{
                                padding: '4px 10px',
                                background: isAdded ? '#10b981' : '#3b82f6',
                                color: '#fff',
                                border: 'none',
                                borderRadius: '4px',
                                fontSize: '11px',
                                fontWeight: '500',
                                cursor: 'pointer',
                                transition: 'all 0.2s'
                              }}
                              onMouseEnter={(e) => {
                                e.currentTarget.style.transform = 'scale(1.05)'
                                e.currentTarget.style.background = isAdded ? '#059669' : '#2563eb'
                              }}
                              onMouseLeave={(e) => {
                                e.currentTarget.style.transform = 'scale(1)'
                                e.currentTarget.style.background = isAdded ? '#10b981' : '#3b82f6'
                              }}
                            >
                              {isAdded ? '✓ Added' : '+ Add'}
                            </button>
                          </div>
                        )
                      })}
                    </div>
                  </div>

                  {/* Spices & Sides */}
                  {meal.spicesAndSides && meal.spicesAndSides.length > 0 && (
                    <div style={{ marginBottom: '16px' }}>
                      <div style={{ fontSize: '14px', fontWeight: '600', color: '#1f2937', marginBottom: '8px' }}>
                        🧂 Spices & Sides
                      </div>
                      <div style={{
                        padding: '10px 12px',
                        background: '#fef3c7',
                        borderRadius: '6px',
                        fontSize: '13px',
                        color: '#78350f',
                        lineHeight: '1.6'
                      }}>
                        {meal.spicesAndSides.join(', ')}
                      </div>
                    </div>
                  )}

                  {/* Instructions */}
                  {meal.instructions && (
                    <div style={{ marginBottom: '16px' }}>
                      <div style={{ fontSize: '14px', fontWeight: '600', color: '#1f2937', marginBottom: '8px' }}>
                        👨‍🍳 Instructions
                      </div>
                      <div style={{
                        padding: '12px',
                        background: '#f0f9ff',
                        borderLeft: '3px solid #3b82f6',
                        borderRadius: '6px',
                        fontSize: '13px',
                        color: '#1e40af',
                        lineHeight: '1.7',
                        whiteSpace: 'pre-wrap'
                      }}>
                        {meal.instructions}
                      </div>
                    </div>
                  )}

                  {/* Reasoning */}
                  {meal.reasoning && (
                    <div style={{
                      padding: '12px',
                      background: '#fef2f2',
                      borderRadius: '6px',
                      fontSize: '12px',
                      color: '#991b1b',
                      lineHeight: '1.6',
                      fontStyle: 'italic'
                    }}>
                      <strong>💡 Why this meal:</strong> {meal.reasoning}
                    </div>
                  )}
                </div>
              )}
            </div>
          )
        })}
      </div>

      {/* Footer */}
      <div style={{
        padding: '16px',
        borderTop: '1px solid rgba(255,255,255,0.1)',
        color: '#fff',
        textAlign: 'center',
        fontSize: '12px',
        opacity: 0.8
      }}>
        💡 Click on any meal to view details and add ingredients to shopping list
      </div>

      <style>
        {`
          @keyframes slideDown {
            from {
              transform: translate(-50%, -20px);
              opacity: 0;
            }
            to {
              transform: translate(-50%, 0);
              opacity: 1;
            }
          }
        `}
      </style>
    </div>
  )
}

export default MealRecommendationsWidget

