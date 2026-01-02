import React, { useState, useEffect, useMemo, useCallback } from 'react';

function RecipeSuggestionWidget() {
  // Global storage for stock items (shared with stock tracker widget)
  const [stockItems] = useGlobalStorage('stock-tracker-items', []);
  
  // Widget-specific storage for generated recipes and last generation date
  const [savedRecipes, setSavedRecipes] = useGlobalStorage('recipe-suggestions', []);
  const [lastGenerationDate, setLastGenerationDate] = useGlobalStorage('recipe-last-generated', null);
  
  // Local UI state
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState(null);
  const [selectedRecipeIndex, setSelectedRecipeIndex] = useState(0);
  const [expandedRecipe, setExpandedRecipe] = useState(null);

  // Available ingredients from stock (only items with quantity > 0)
  const availableIngredients = useMemo(() => 
    stockItems
      .filter(item => item.currentQty > 0)
      .map(item => ({
        name: item.name,
        quantity: item.currentQty
      })),
    [stockItems]
  );

  // Check if we need to generate new recipes (daily refresh)
  const shouldRegenerateDaily = useCallback(() => {
    if (!lastGenerationDate) return true;
    
    const lastDate = new Date(lastGenerationDate);
    const today = new Date();
    
    // Check if it's a different day
    return lastDate.toDateString() !== today.toDateString();
  }, [lastGenerationDate]);

  // Generate recipes using ChatGPT
  const generateRecipes = useCallback(async () => {
    if (availableIngredients.length === 0) {
      setError('No ingredients available in stock. Add items to your Stock Tracker first!');
      return;
    }

    setIsGenerating(true);
    setError(null);

    try {
      const ingredientList = availableIngredients
        .map(item => `${item.name} (${item.quantity})`)
        .join(', ');

      const prompt = `Given these available ingredients: ${ingredientList}

Please suggest 3 different recipes that can be made using ONLY these ingredients (or common pantry staples like salt, pepper, oil, water).

For each recipe, provide:
1. Recipe name
2. List of ingredients from my stock needed (with approximate quantities)
3. Step-by-step cooking instructions
4. Estimated prep time and cook time

Format your response as a JSON array of objects with this structure:
[
  {
    "name": "Recipe Name",
    "ingredients": ["ingredient 1 (amount)", "ingredient 2 (amount)", ...],
    "instructions": ["step 1", "step 2", ...],
    "prepTime": "X minutes",
    "cookTime": "Y minutes",
    "servings": N
  }
]`;

      const response = await miyagiAPI.post('generate-text', {
        prompt,
        provider: 'openai',
        model: 'gpt-4o',
        max_tokens: 2000,
        temperature: 0.7,
        system_prompt: 'You are a helpful cooking assistant. Always return valid JSON only, no additional text or markdown.'
      });

      // Parse the response - API returns { success, text, error, ... }
      if (!response.success || !response.data.text) {
        throw new Error(response.error || 'Failed to generate recipes');
      }
      
      let recipes;
      try {
        const text = response.data.text;
        const jsonMatch = text.match(/\[[\s\S]*\]/);
        
        if (jsonMatch) {
          recipes = JSON.parse(jsonMatch[0]);
        } else {
          recipes = JSON.parse(text);
        }
      } catch (parseError) {
        console.error('Failed to parse recipe JSON:', parseError);
        throw new Error('Failed to parse recipe response. Please try again.');
      }

      if (!Array.isArray(recipes) || recipes.length === 0) {
        throw new Error('No recipes were generated. Please try again.');
      }

      // Save recipes and update generation date
      setSavedRecipes(recipes);
      setLastGenerationDate(new Date().toISOString());
      setSelectedRecipeIndex(0);
      setExpandedRecipe(0);

    } catch (err) {
      console.error('Recipe generation error:', err);
      setError(err.message || 'Failed to generate recipes. Please try again.');
    } finally {
      setIsGenerating(false);
    }
  }, [availableIngredients, setSavedRecipes, setLastGenerationDate]);

  // Auto-generate recipes on mount if needed (daily refresh logic)
  useEffect(() => {
    if (availableIngredients.length > 0 && shouldRegenerateDaily() && savedRecipes.length === 0) {
      generateRecipes();
    }
  }, [availableIngredients.length, shouldRegenerateDaily, savedRecipes.length]);

  // Daily check effect - regenerate if a new day has started
  useEffect(() => {
    const checkDailyRefresh = () => {
      if (shouldRegenerateDaily() && savedRecipes.length > 0 && availableIngredients.length > 0) {
        console.log('🔄 New day detected, regenerating recipes...');
        generateRecipes();
      }
    };

    // Check every hour if we need to refresh
    const interval = setInterval(checkDailyRefresh, 60 * 60 * 1000);
    
    // Check immediately on mount
    checkDailyRefresh();

    return () => clearInterval(interval);
  }, [shouldRegenerateDaily, savedRecipes.length, availableIngredients.length, generateRecipes]);

  // Toggle recipe expansion
  const toggleRecipe = (index) => {
    setExpandedRecipe(expandedRecipe === index ? null : index);
  };

  return (
    <div style={{
      fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
      background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
      color: '#ffffff',
      minHeight: '100vh',
      overflowX: 'hidden',
      position: 'relative'
    }}>
      <div style={{
        padding: '24px',
        minHeight: '100vh',
        boxSizing: 'border-box'
      }}>
        {/* Header */}
        <div style={{
          marginBottom: '24px'
        }}>
        <h2 style={{
          margin: '0 0 4px 0',
          fontSize: '24px',
          fontWeight: '700',
          color: '#ffffff',
          textShadow: '0 2px 4px rgba(0,0,0,0.1)'
        }}>
          🍳 Recipe Suggestions
        </h2>
        <div style={{
          fontSize: '13px',
          color: 'rgba(255,255,255,0.9)',
          marginBottom: '8px'
        }}>
          AI-powered recipes from your available ingredients
        </div>
        {lastGenerationDate && (
          <div style={{
            fontSize: '12px',
            color: 'rgba(255,255,255,0.7)'
          }}>
            Last updated: {new Date(lastGenerationDate).toLocaleDateString()} at {new Date(lastGenerationDate).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
          </div>
        )}
      </div>

      {/* Available Ingredients */}
      <div style={{
        background: 'rgba(255,255,255,0.15)',
        borderRadius: '8px',
        padding: '16px',
        marginBottom: '16px',
        backdropFilter: 'blur(10px)'
      }}>
        <div style={{
          fontSize: '14px',
          fontWeight: '600',
          marginBottom: '12px',
          color: '#ffffff'
        }}>
          📦 Available Ingredients ({availableIngredients.length})
        </div>
        {availableIngredients.length > 0 ? (
          <div style={{
            display: 'flex',
            flexWrap: 'wrap',
            gap: '8px'
          }}>
            {availableIngredients.map((item, idx) => (
              <div
                key={idx}
                style={{
                  background: 'rgba(255,255,255,0.2)',
                  padding: '6px 12px',
                  borderRadius: '16px',
                  fontSize: '13px',
                  color: '#ffffff',
                  fontWeight: '500'
                }}
              >
                {item.name} <span style={{ opacity: 0.8 }}>×{item.quantity}</span>
              </div>
            ))}
          </div>
        ) : (
          <div style={{
            fontSize: '13px',
            color: 'rgba(255,255,255,0.7)',
            fontStyle: 'italic'
          }}>
            No ingredients in stock. Add items to your Stock Tracker widget first!
          </div>
        )}
      </div>

      {/* Generate Button */}
      <button
        onClick={generateRecipes}
        disabled={isGenerating || availableIngredients.length === 0}
        style={{
          width: '100%',
          padding: '14px 24px',
          border: 'none',
          borderRadius: '8px',
          background: isGenerating || availableIngredients.length === 0 
            ? 'rgba(255,255,255,0.3)' 
            : 'rgba(255,255,255,0.95)',
          color: isGenerating || availableIngredients.length === 0 ? 'rgba(255,255,255,0.6)' : '#667eea',
          cursor: isGenerating || availableIngredients.length === 0 ? 'not-allowed' : 'pointer',
          fontSize: '15px',
          fontWeight: '600',
          marginBottom: '24px',
          transition: 'all 0.2s ease',
          boxShadow: '0 4px 12px rgba(0,0,0,0.15)'
        }}
        onMouseEnter={(e) => {
          if (!isGenerating && availableIngredients.length > 0) {
            e.target.style.transform = 'translateY(-2px)';
            e.target.style.boxShadow = '0 6px 16px rgba(0,0,0,0.2)';
          }
        }}
        onMouseLeave={(e) => {
          e.target.style.transform = 'translateY(0)';
          e.target.style.boxShadow = '0 4px 12px rgba(0,0,0,0.15)';
        }}
      >
        {isGenerating ? '🔄 Generating Recipes...' : '✨ Generate New Recipes'}
      </button>

      {/* Error Message */}
      {error && (
        <div style={{
          background: 'rgba(235, 87, 87, 0.2)',
          border: '1px solid rgba(235, 87, 87, 0.5)',
          borderRadius: '8px',
          padding: '12px 16px',
          marginBottom: '16px',
          fontSize: '14px',
          color: '#ffffff'
        }}>
          ⚠️ {error}
        </div>
      )}

      {/* Recipes Display */}
      {savedRecipes.length > 0 && (
        <div style={{
          display: 'flex',
          flexDirection: 'column',
          gap: '16px'
        }}>
          {savedRecipes.map((recipe, index) => (
            <div
              key={index}
              style={{
                background: 'rgba(255,255,255,0.95)',
                borderRadius: '12px',
                overflow: 'hidden',
                boxShadow: '0 4px 16px rgba(0,0,0,0.1)',
                transition: 'all 0.2s ease'
              }}
            >
              {/* Recipe Header */}
              <div
                onClick={() => toggleRecipe(index)}
                style={{
                  padding: '20px',
                  cursor: 'pointer',
                  background: expandedRecipe === index 
                    ? 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)'
                    : 'rgba(102, 126, 234, 0.1)',
                  transition: 'all 0.2s ease'
                }}
                onMouseEnter={(e) => {
                  if (expandedRecipe !== index) {
                    e.currentTarget.style.background = 'rgba(102, 126, 234, 0.15)';
                  }
                }}
                onMouseLeave={(e) => {
                  if (expandedRecipe !== index) {
                    e.currentTarget.style.background = 'rgba(102, 126, 234, 0.1)';
                  }
                }}
              >
                <div style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center'
                }}>
                  <h3 style={{
                    margin: 0,
                    fontSize: '18px',
                    fontWeight: '600',
                    color: expandedRecipe === index ? '#ffffff' : '#37352f'
                  }}>
                    {recipe.name}
                  </h3>
                  <div style={{
                    fontSize: '20px',
                    transform: expandedRecipe === index ? 'rotate(180deg)' : 'rotate(0deg)',
                    transition: 'transform 0.2s ease'
                  }}>
                    ▼
                  </div>
                </div>
                <div style={{
                  display: 'flex',
                  gap: '16px',
                  marginTop: '8px',
                  fontSize: '13px',
                  color: expandedRecipe === index ? 'rgba(255,255,255,0.9)' : '#787774'
                }}>
                  {recipe.prepTime && (
                    <span>⏱️ Prep: {recipe.prepTime}</span>
                  )}
                  {recipe.cookTime && (
                    <span>🔥 Cook: {recipe.cookTime}</span>
                  )}
                  {recipe.servings && (
                    <span>🍽️ Serves: {recipe.servings}</span>
                  )}
                </div>
              </div>

              {/* Recipe Details (Expanded) */}
              {expandedRecipe === index && (
                <div style={{
                  padding: '20px',
                  color: '#37352f'
                }}>
                  {/* Ingredients */}
                  <div style={{ marginBottom: '20px' }}>
                    <h4 style={{
                      margin: '0 0 12px 0',
                      fontSize: '15px',
                      fontWeight: '600',
                      color: '#667eea'
                    }}>
                      🥗 Ingredients
                    </h4>
                    <ul style={{
                      margin: 0,
                      paddingLeft: '20px',
                      listStyle: 'disc'
                    }}>
                      {recipe.ingredients.map((ingredient, idx) => (
                        <li
                          key={idx}
                          style={{
                            marginBottom: '6px',
                            fontSize: '14px',
                            color: '#37352f',
                            lineHeight: '1.5'
                          }}
                        >
                          {ingredient}
                        </li>
                      ))}
                    </ul>
                  </div>

                  {/* Instructions */}
                  <div>
                    <h4 style={{
                      margin: '0 0 12px 0',
                      fontSize: '15px',
                      fontWeight: '600',
                      color: '#667eea'
                    }}>
                      👨‍🍳 Instructions
                    </h4>
                    <ol style={{
                      margin: 0,
                      paddingLeft: '20px',
                      listStyle: 'decimal'
                    }}>
                      {recipe.instructions.map((instruction, idx) => (
                        <li
                          key={idx}
                          style={{
                            marginBottom: '10px',
                            fontSize: '14px',
                            color: '#37352f',
                            lineHeight: '1.6'
                          }}
                        >
                          {instruction}
                        </li>
                      ))}
                    </ol>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Empty State */}
      {savedRecipes.length === 0 && !isGenerating && !error && availableIngredients.length > 0 && (
        <div style={{
          textAlign: 'center',
          padding: '48px 24px',
          background: 'rgba(255,255,255,0.1)',
          borderRadius: '12px',
          backdropFilter: 'blur(10px)'
        }}>
          <div style={{ fontSize: '48px', marginBottom: '16px' }}>🍳</div>
          <div style={{ fontSize: '16px', fontWeight: '500', marginBottom: '8px' }}>
            Ready to Cook?
          </div>
          <div style={{ fontSize: '14px', opacity: 0.9 }}>
            Click "Generate New Recipes" to get AI-powered recipe suggestions!
          </div>
        </div>
        )}
      </div>
    </div>
  );
}

export default RecipeSuggestionWidget;
