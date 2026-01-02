import React, { useState, useEffect } from 'react'

function WorkoutPlannerWidget() {
  // Shared storage with time calendar
  const [calendarEvents, setCalendarEvents] = useGlobalStorage('time-calendar-events', [])
  const [calendarPeople, setCalendarPeople] = useGlobalStorage('time-calendar-people', [])
  
  // User profile storage
  const [userProfile, setUserProfile] = useGlobalStorage('workout-user-profile', null)
  const [savedPlans, setSavedPlans] = useGlobalStorage('workout-saved-plans', [])
  
  // Form state
  const [name, setName] = useState('')
  const [height, setHeight] = useState('')
  const [weight, setWeight] = useState('')
  const [goal, setGoal] = useState('lose_weight')
  const [targetAreas, setTargetAreas] = useState('')
  const [limitations, setLimitations] = useState('')
  const [equipment, setEquipment] = useState('bodyweight')
  const [experienceLevel, setExperienceLevel] = useState('intermediate')
  const [startDate, setStartDate] = useState('')
  const [recurringEndDate, setRecurringEndDate] = useState('')
  const [preferredTime, setPreferredTime] = useState('07:00')
  const [workoutDuration, setWorkoutDuration] = useState('60')
  
  // UI state
  const [generating, setGenerating] = useState(false)
  const [generatedPlan, setGeneratedPlan] = useState(null)
  const [error, setError] = useState(null)
  const [showProfileForm, setShowProfileForm] = useState(true)
  const [selectedPerson, setSelectedPerson] = useState(null)

  // Load profile on mount
  useEffect(() => {
    if (userProfile) {
      setName(userProfile.name || '')
      setHeight(userProfile.height || '')
      setWeight(userProfile.weight || '')
      setGoal(userProfile.goal || 'lose_weight')
      setShowProfileForm(false)
    }
  }, [userProfile])

  // Set default start date
  useEffect(() => {
    if (!startDate) {
      setStartDate(new Date().toISOString().split('T')[0])
    }
  }, [])

  const goalOptions = [
    { value: 'lose_weight', label: 'Lose Weight', description: 'Focus on fat burning and cardio' },
    { value: 'gain_muscle', label: 'Gain Muscle', description: 'Build muscle mass and size' },
    { value: 'build_strength', label: 'Build Strength', description: 'Increase maximum strength' },
    { value: 'increase_endurance', label: 'Increase Endurance', description: 'Improve stamina and conditioning' },
    { value: 'improve_flexibility', label: 'Improve Flexibility', description: 'Enhance mobility and range of motion' },
    { value: 'general_fitness', label: 'General Fitness', description: 'Overall health and wellness' },
    { value: 'athletic_performance', label: 'Athletic Performance', description: 'Sport-specific training' }
  ]

  const equipmentOptions = [
    { value: 'bodyweight', label: 'Bodyweight Only' },
    { value: 'dumbbells', label: 'Dumbbells' },
    { value: 'full_gym', label: 'Full Gym Access' },
    { value: 'resistance_bands', label: 'Resistance Bands' },
    { value: 'minimal', label: 'Minimal Equipment' }
  ]

  const experienceLevelOptions = [
    { value: 'beginner', label: 'Beginner' },
    { value: 'intermediate', label: 'Intermediate' },
    { value: 'advanced', label: 'Advanced' }
  ]

  // Auto-generate workout query
  const generateQuery = () => {
    const goalLabel = goalOptions.find(g => g.value === goal)?.label || goal
    const equipmentLabel = equipmentOptions.find(e => e.value === equipment)?.label || equipment
    
    let query = `Create a ${experienceLevel}-level workout plan focused on ${goalLabel.toLowerCase()}.`
    query += ` Available equipment: ${equipmentLabel.toLowerCase()}.`
    query += ` Workout duration: approximately ${workoutDuration} minutes per session.`
    
    if (targetAreas.trim()) {
      query += ` Target areas: ${targetAreas}.`
    }
    
    if (limitations.trim()) {
      query += ` Important considerations: ${limitations}.`
    }
    
    return query
  }

  const saveProfile = () => {
    if (!name || !height || !weight) {
      setError('Please fill in all profile fields')
      return
    }
    
    const profile = { name, height, weight, goal }
    setUserProfile(profile)
    setShowProfileForm(false)
    setError(null)
  }

  const generateWorkoutPlan = async () => {
    if (!userProfile && (!name || !height || !weight)) {
      setError('Please complete your profile first')
      return
    }

    setGenerating(true)
    setError(null)
    setGeneratedPlan(null)

    try {
      const profile = userProfile || { name, height, weight, goal }
      const workoutQuery = generateQuery()
      
      // Build comprehensive prompt for AI
      const prompt = `Generate a single daily workout plan for the following person:

Name: ${profile.name}
Height: ${profile.height}
Weight: ${profile.weight}
Goal: ${goalOptions.find(g => g.value === profile.goal)?.label || profile.goal}
Experience Level: ${experienceLevel}
Available Equipment: ${equipmentOptions.find(e => e.value === equipment)?.label || equipment}

Workout Requirements: ${workoutQuery}

Requirements:
1. Create ONE daily workout that can be repeated
2. The workout should be practical and achievable every day
3. Include specific exercises, sets, reps, and rest periods
4. Keep the workout within approximately ${workoutDuration} minutes
5. Balance intensity so it's sustainable for daily practice
6. Include warm-up and cool-down instructions

Format your response as a JSON object with this exact structure:
{
  "title": "Full Body Daily Workout",
  "duration": "60 minutes",
  "exercises": [
    {
      "name": "Push-ups",
      "sets": 3,
      "reps": "10-15",
      "rest": "60 seconds",
      "notes": "Keep core engaged"
    }
  ],
  "warmup": "5-10 minutes light cardio and dynamic stretching",
  "cooldown": "5-10 minutes static stretching",
  "notes": "Focus on proper form and listen to your body"
}

Provide a complete daily workout appropriate for their goal.`

      console.log('🏋️ Generating workout plan with prompt:', prompt)

      const response = await miyagiAPI.post('/api/integrations/generate-text', {
        prompt: prompt,
        provider: 'openai',
        model: 'gpt-4o-mini',
        max_tokens: 10000, // Increased to allow for reasoning tokens + actual output
        temperature: 0.7
      })

      console.log('📊 AI Response:', response)

      // API returns { success, text, error, ... }
      if (!response.success || !response.data.text) {
        throw new Error(response.error || 'Failed to generate workout plan')
      }

      let planText = response.data.text.trim()
      
      // Try to extract JSON from markdown code blocks
      const jsonMatch = planText.match(/```(?:json)?\s*([\s\S]*?)```/)
      if (jsonMatch) {
        planText = jsonMatch[1].trim()
      }

      // Parse JSON
      let workoutPlan
      try {
        workoutPlan = JSON.parse(planText)
      } catch (parseError) {
        console.error('Parse error:', parseError)
        // If parsing fails, try to clean up the text
        planText = planText.replace(/^[^[{]*/, '').replace(/[^}\]]*$/, '')
        workoutPlan = JSON.parse(planText)
      }

      // Validate the plan (should be a single object, not array)
      if (!workoutPlan || typeof workoutPlan !== 'object' || !workoutPlan.title) {
        throw new Error('Invalid workout plan format')
      }

      console.log('✅ Generated workout plan:', workoutPlan)

      setGeneratedPlan({
        workout: workoutPlan,
        createdAt: new Date().toISOString(),
        profile: profile,
        query: workoutQuery,
        settings: {
          targetAreas,
          limitations,
          equipment,
          experienceLevel,
          duration: workoutDuration
        }
      })

    } catch (err) {
      console.error('❌ Workout generation error:', err)
      setError(err.message || 'Failed to generate workout plan')
    } finally {
      setGenerating(false)
    }
  }

  const addToCalendar = () => {
    if (!generatedPlan || !generatedPlan.workout) {
      setError('No workout plan to add')
      return
    }

    if (!startDate) {
      setError('Please select a start date')
      return
    }

    try {
      // Find or create person in calendar
      let personId = selectedPerson

      if (!personId && userProfile) {
        // Try to find person by name
        const existingPerson = calendarPeople.find(p => 
          p.name.toLowerCase() === userProfile.name.toLowerCase()
        )
        
        if (existingPerson) {
          personId = existingPerson.id
        } else {
          // Create new person
          personId = Date.now()
          const newPerson = {
            id: personId,
            name: userProfile.name,
            color: `hsl(${Math.random() * 360}, 70%, 50%)`
          }
          setCalendarPeople([...calendarPeople, newPerson])
        }
      }

      const workout = generatedPlan.workout

      // Calculate end time
      const [hours, minutes] = preferredTime.split(':')
      const startHour = parseInt(hours)
      const durationMinutes = parseInt(workoutDuration)
      const endHour = startHour + Math.floor(durationMinutes / 60)
      const endMinutes = parseInt(minutes) + (durationMinutes % 60)
      const endTimeStr = `${endHour.toString().padStart(2, '0')}:${endMinutes.toString().padStart(2, '0')}`

      // Build detailed description
      let description = `${workout.title}\n\n`
      description += `Duration: ${workout.duration || `${workoutDuration} minutes`}\n\n`
      
      if (workout.warmup) {
        description += `🔥 Warm-up:\n${workout.warmup}\n\n`
      }
      
      if (workout.exercises && workout.exercises.length > 0) {
        description += `💪 Exercises:\n`
        workout.exercises.forEach((exercise, idx) => {
          description += `${idx + 1}. ${exercise.name}\n`
          if (exercise.sets) description += `   Sets: ${exercise.sets}\n`
          if (exercise.reps) description += `   Reps: ${exercise.reps}\n`
          if (exercise.rest) description += `   Rest: ${exercise.rest}\n`
          if (exercise.notes) description += `   Notes: ${exercise.notes}\n`
          description += '\n'
        })
      }
      
      if (workout.cooldown) {
        description += `🧘 Cool-down:\n${workout.cooldown}\n\n`
      }
      
      if (workout.notes) {
        description += `📝 Additional Notes:\n${workout.notes}\n`
      }

      // Generate first 7 recurring events (matching time calendar pattern)
      const recurringGroupId = `workout-${Date.now()}`
      const baseEventData = {
        title: `🏋️ ${workout.title}`,
        startTime: preferredTime,
        endTime: endTimeStr,
        category: 'task',
        notes: description,
        assignedPerson: personId,
        linkedStock: null,
        stockAmount: 1,
        recurring: 'daily',
        recurringEndDate: recurringEndDate || null,
        recurringPattern: 'daily',
        recurringGroupId: recurringGroupId,
        completed: false
      }

      const newEvents = []
      const endDate = recurringEndDate ? new Date(recurringEndDate) : null
      let currentDate = new Date(startDate)
      
      // Generate up to 7 instances
      for (let i = 0; i < 7; i++) {
        // Stop if we've exceeded the end date
        if (endDate && currentDate > endDate) break

        newEvents.push({
          id: Date.now() + i,
          ...baseEventData,
          date: currentDate.toISOString().split('T')[0],
          createdAt: new Date().toISOString()
        })

        // Move to next day
        currentDate.setDate(currentDate.getDate() + 1)
      }

      // Add all events to calendar
      setCalendarEvents([...calendarEvents, ...newEvents])

      // Save plan to history
      const planRecord = {
        id: Date.now(),
        ...generatedPlan,
        addedToCalendar: true,
        startDate: startDate,
        recurringEndDate: recurringEndDate,
        preferredTime: preferredTime,
        duration: workoutDuration,
        personId: personId
      }
      setSavedPlans([...savedPlans, planRecord])

      const daysText = recurringEndDate 
        ? `from ${startDate} to ${recurringEndDate}` 
        : 'starting ' + startDate

      alert(`✅ Successfully added ${newEvents.length} workout${newEvents.length > 1 ? 's' : ''} to your calendar!\n\nWorkout: ${workout.title}\nSchedule: ${daysText}\n\nThe calendar will automatically generate more as you complete them.\n\nOpen your Time Calendar to see the scheduled workouts.`)
      
      // Reset form
      setGeneratedPlan(null)
      setTargetAreas('')
      setLimitations('')
      setRecurringEndDate('')
    } catch (err) {
      console.error('❌ Error adding to calendar:', err)
      setError(err.message || 'Failed to add workouts to calendar')
    }
  }

  const formatExerciseList = (exercises) => {
    if (!exercises || exercises.length === 0) return 'No exercises'
    return exercises.slice(0, 3).map(e => e.name).join(', ') + (exercises.length > 3 ? '...' : '')
  }

  return (
    <div style={styles.container}>
      {/* Header */}
      <div style={styles.header}>
        <h1 style={styles.title}>💪 AI Workout Planner</h1>
        <p style={styles.subtitle}>
          Generate a personalized daily recurring workout and add it to your calendar
        </p>
      </div>

      {/* Profile Section */}
      <div style={styles.section}>
        <div style={styles.sectionHeader}>
          <h2 style={styles.sectionTitle}>👤 Your Profile</h2>
          {userProfile && !showProfileForm && (
            <button
              onClick={() => setShowProfileForm(true)}
              style={styles.editButton}
            >
              Edit Profile
            </button>
          )}
        </div>

        {showProfileForm ? (
          <div style={styles.form}>
            <div style={styles.formRow}>
              <div style={styles.formGroup}>
                <label style={styles.label}>Name</label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Enter your name"
                  style={styles.input}
                />
              </div>
              <div style={styles.formGroup}>
                <label style={styles.label}>Height</label>
                <input
                  type="text"
                  value={height}
                  onChange={(e) => setHeight(e.target.value)}
                  placeholder={`e.g., 5'10" or 178cm`}
                  style={styles.input}
                />
              </div>
            </div>

            <div style={styles.formRow}>
              <div style={styles.formGroup}>
                <label style={styles.label}>Weight</label>
                <input
                  type="text"
                  value={weight}
                  onChange={(e) => setWeight(e.target.value)}
                  placeholder="e.g., 170 lbs or 77kg"
                  style={styles.input}
                />
              </div>
              <div style={styles.formGroup}>
                <label style={styles.label}>Fitness Goal</label>
                <select
                  value={goal}
                  onChange={(e) => setGoal(e.target.value)}
                  style={styles.select}
                >
                  {goalOptions.map(opt => (
                    <option key={opt.value} value={opt.value}>{opt.label}</option>
                  ))}
                </select>
              </div>
            </div>

            <button onClick={saveProfile} style={styles.saveButton}>
              Save Profile
            </button>
          </div>
        ) : (
          <div style={styles.profileCard}>
            <div style={styles.profileInfo}>
              <div><strong>Name:</strong> {userProfile.name}</div>
              <div><strong>Height:</strong> {userProfile.height}</div>
              <div><strong>Weight:</strong> {userProfile.weight}</div>
              <div><strong>Goal:</strong> {goalOptions.find(g => g.value === userProfile.goal)?.label}</div>
            </div>
          </div>
        )}
      </div>

      {/* Workout Generation Section */}
      {userProfile && !showProfileForm && (
        <>
          <div style={styles.section}>
            <h2 style={styles.sectionTitle}>🎯 Generate Workout Plan</h2>
            
            <div style={styles.formRow}>
              <div style={styles.formGroup}>
                <label style={styles.label}>Experience Level</label>
                <select
                  value={experienceLevel}
                  onChange={(e) => setExperienceLevel(e.target.value)}
                  style={styles.select}
                >
                  {experienceLevelOptions.map(opt => (
                    <option key={opt.value} value={opt.value}>{opt.label}</option>
                  ))}
                </select>
              </div>
              <div style={styles.formGroup}>
                <label style={styles.label}>Available Equipment</label>
                <select
                  value={equipment}
                  onChange={(e) => setEquipment(e.target.value)}
                  style={styles.select}
                >
                  {equipmentOptions.map(opt => (
                    <option key={opt.value} value={opt.value}>{opt.label}</option>
                  ))}
                </select>
              </div>
            </div>

            <div style={styles.formGroup}>
              <label style={styles.label}>Target Areas (Optional)</label>
              <input
                type="text"
                value={targetAreas}
                onChange={(e) => setTargetAreas(e.target.value)}
                placeholder="e.g., chest and shoulders, core, legs and glutes"
                style={styles.input}
              />
              <div style={styles.inputHint}>
                Specify which muscle groups or body parts you want to focus on
              </div>
            </div>

            <div style={styles.formGroup}>
              <label style={styles.label}>Limitations or Preferences (Optional)</label>
              <textarea
                value={limitations}
                onChange={(e) => setLimitations(e.target.value)}
                placeholder="e.g., no jumping exercises, avoid lower back strain, prefer outdoor activities"
                style={styles.textarea}
                rows={3}
              />
              <div style={styles.inputHint}>
                Any injuries, restrictions, or specific preferences
              </div>
            </div>

            <div style={styles.formRow}>
              <div style={styles.formGroup}>
                <label style={styles.label}>Start Date</label>
                <input
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  min={new Date().toISOString().split('T')[0]}
                  style={styles.input}
                />
              </div>
              <div style={styles.formGroup}>
                <label style={styles.label}>End Date (Optional)</label>
                <input
                  type="date"
                  value={recurringEndDate}
                  onChange={(e) => setRecurringEndDate(e.target.value)}
                  min={startDate || new Date().toISOString().split('T')[0]}
                  style={styles.input}
                  placeholder="Leave empty for indefinite"
                />
                <div style={{fontSize: '12px', color: '#6c757d', marginTop: '4px'}}>
                  Leave empty to repeat indefinitely
                </div>
              </div>
            </div>

            <div style={styles.formRow}>
              <div style={styles.formGroup}>
                <label style={styles.label}>Preferred Time</label>
                <input
                  type="time"
                  value={preferredTime}
                  onChange={(e) => setPreferredTime(e.target.value)}
                  style={styles.input}
                />
              </div>
              <div style={styles.formGroup}>
                <label style={styles.label}>Duration (minutes)</label>
                <input
                  type="number"
                  value={workoutDuration}
                  onChange={(e) => setWorkoutDuration(e.target.value)}
                  min="15"
                  max="180"
                  step="15"
                  style={styles.input}
                />
              </div>
            </div>

            {calendarPeople.length > 0 && (
              <div style={styles.formGroup}>
                <label style={styles.label}>Assign to Person (Optional)</label>
                <select
                  value={selectedPerson || ''}
                  onChange={(e) => setSelectedPerson(e.target.value ? parseInt(e.target.value) : null)}
                  style={styles.select}
                >
                  <option value="">Create new person</option>
                  {calendarPeople.map(person => (
                    <option key={person.id} value={person.id}>{person.name}</option>
                  ))}
                </select>
              </div>
            )}

            {error && (
              <div style={styles.errorAlert}>
                <span style={styles.errorIcon}>⚠️</span>
                <span>{error}</span>
              </div>
            )}

            <button
              onClick={generateWorkoutPlan}
              disabled={generating}
              style={{
                ...styles.generateButton,
                opacity: generating ? 0.6 : 1,
                cursor: generating ? 'not-allowed' : 'pointer'
              }}
            >
              {generating ? (
                <>
                  <span style={styles.spinner}>⏳</span>
                  Generating Plan...
                </>
              ) : (
                <>
                  <span>✨</span>
                  Generate Daily Workout Plan
                </>
              )}
            </button>
          </div>

          {/* Generated Plan Display */}
          {generatedPlan && generatedPlan.workout && (
            <div style={styles.section}>
              <div style={styles.sectionHeader}>
                <h2 style={styles.sectionTitle}>📋 Your Daily Workout Plan</h2>
              </div>

              {/* Query Info */}
              {generatedPlan.query && (
                <div style={styles.queryInfo}>
                  <strong>📝 Plan Details:</strong> {generatedPlan.query}
                </div>
              )}

              <div style={styles.workoutCard}>
                <div style={styles.workoutHeader}>
                  <div>
                    <div style={styles.workoutTitle}>{generatedPlan.workout.title}</div>
                  </div>
                  <div style={styles.workoutDuration}>
                    ⏱️ {generatedPlan.workout.duration || `${workoutDuration} min`}
                  </div>
                </div>

                {generatedPlan.workout.warmup && (
                  <div style={styles.workoutSection}>
                    <div style={styles.workoutSectionTitle}>🔥 Warm-up</div>
                    <div style={styles.workoutSectionContent}>{generatedPlan.workout.warmup}</div>
                  </div>
                )}

                {generatedPlan.workout.exercises && generatedPlan.workout.exercises.length > 0 && (
                  <div style={styles.workoutSection}>
                    <div style={styles.workoutSectionTitle}>💪 Exercises ({generatedPlan.workout.exercises.length})</div>
                    <div style={styles.exerciseDetailList}>
                      {generatedPlan.workout.exercises.map((exercise, idx) => (
                        <div key={idx} style={styles.exerciseDetail}>
                          <div style={styles.exerciseDetailName}>{idx + 1}. {exercise.name}</div>
                          <div style={styles.exerciseDetailMeta}>
                            {exercise.sets && <span>Sets: {exercise.sets}</span>}
                            {exercise.reps && <span> • Reps: {exercise.reps}</span>}
                            {exercise.rest && <span> • Rest: {exercise.rest}</span>}
                          </div>
                          {exercise.notes && (
                            <div style={styles.exerciseDetailNotes}>{exercise.notes}</div>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {generatedPlan.workout.cooldown && (
                  <div style={styles.workoutSection}>
                    <div style={styles.workoutSectionTitle}>🧘 Cool-down</div>
                    <div style={styles.workoutSectionContent}>{generatedPlan.workout.cooldown}</div>
                  </div>
                )}

                {generatedPlan.workout.notes && (
                  <div style={styles.workoutNotes}>
                    💡 {generatedPlan.workout.notes}
                  </div>
                )}
              </div>

              <button
                onClick={addToCalendar}
                style={styles.addToCalendarButton}
              >
                <span>📅</span>
                Add Daily Recurring Workout to Calendar
              </button>
            </div>
          )}

          {/* Previous Plans */}
          {savedPlans.length > 0 && (
            <div style={styles.section}>
              <h2 style={styles.sectionTitle}>📚 Previous Plans</h2>
              <div style={styles.historyList}>
                {savedPlans.slice(-3).reverse().map(plan => (
                  <div key={plan.id} style={styles.historyCard}>
                    <div style={styles.historyHeader}>
                      <div style={styles.historyTitle}>
                        {plan.profile.goal.replace('_', ' ')} Plan
                      </div>
                      <div style={styles.historyDate}>
                        {new Date(plan.createdAt).toLocaleDateString()}
                      </div>
                    </div>
                    <div style={styles.historyQuery}>
                      "{plan.query.substring(0, 100)}{plan.query.length > 100 ? '...' : ''}"
                    </div>
                    <div style={styles.historyMeta}>
                      Daily recurring workout • Added to calendar
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  )
}

const styles = {
  container: {
    width: '100%',
    height: '100%',
    background: '#f8f9fa',
    fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
    overflow: 'auto',
    padding: '20px',
    boxSizing: 'border-box'
  },

  header: {
    marginBottom: '24px',
    textAlign: 'center'
  },

  title: {
    fontSize: '32px',
    fontWeight: '700',
    color: '#212529',
    margin: '0 0 8px 0',
    letterSpacing: '-0.5px'
  },

  subtitle: {
    fontSize: '16px',
    color: '#6c757d',
    margin: 0
  },

  section: {
    background: 'white',
    borderRadius: '12px',
    padding: '20px',
    marginBottom: '20px',
    boxShadow: '0 2px 8px rgba(0, 0, 0, 0.08)',
    border: '1px solid #e9ecef',
    boxSizing: 'border-box'
  },

  sectionHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: '20px'
  },

  sectionTitle: {
    fontSize: '20px',
    fontWeight: '700',
    color: '#212529',
    margin: 0
  },

  queryInfo: {
    background: 'linear-gradient(135deg, #f5f7fa 0%, #e8eef5 100%)',
    padding: '14px 18px',
    borderRadius: '8px',
    fontSize: '13px',
    color: '#495057',
    marginBottom: '20px',
    lineHeight: '1.6',
    border: '1px solid #dee2e6'
  },

  editButton: {
    padding: '8px 16px',
    background: 'white',
    border: '1px solid #dee2e6',
    borderRadius: '6px',
    fontSize: '14px',
    fontWeight: '500',
    color: '#495057',
    cursor: 'pointer',
    transition: 'all 0.2s'
  },

  form: {
    display: 'flex',
    flexDirection: 'column',
    gap: '16px'
  },

  formRow: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
    gap: '16px'
  },

  formGroup: {
    display: 'flex',
    flexDirection: 'column',
    gap: '6px'
  },

  label: {
    fontSize: '14px',
    fontWeight: '600',
    color: '#495057'
  },

  input: {
    padding: '10px 12px',
    border: '1px solid #ced4da',
    borderRadius: '6px',
    fontSize: '14px',
    boxSizing: 'border-box'
  },

  select: {
    padding: '10px 12px',
    border: '1px solid #ced4da',
    borderRadius: '6px',
    fontSize: '14px',
    background: 'white',
    cursor: 'pointer'
  },

  textarea: {
    padding: '10px 12px',
    border: '1px solid #ced4da',
    borderRadius: '6px',
    fontSize: '14px',
    fontFamily: 'inherit',
    resize: 'vertical',
    boxSizing: 'border-box',
    width: '100%'
  },

  inputHint: {
    fontSize: '12px',
    color: '#6c757d',
    marginTop: '4px'
  },

  saveButton: {
    padding: '12px 24px',
    background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
    color: 'white',
    border: 'none',
    borderRadius: '8px',
    fontSize: '16px',
    fontWeight: '600',
    cursor: 'pointer',
    alignSelf: 'flex-start',
    transition: 'all 0.2s'
  },

  profileCard: {
    background: '#f8f9fa',
    borderRadius: '8px',
    padding: '20px'
  },

  profileInfo: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
    gap: '12px',
    fontSize: '14px',
    color: '#495057'
  },

  errorAlert: {
    background: '#f8d7da',
    color: '#721c24',
    padding: '12px 16px',
    borderRadius: '6px',
    border: '1px solid #f5c6cb',
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
    fontSize: '14px'
  },

  errorIcon: {
    fontSize: '18px'
  },

  generateButton: {
    width: '100%',
    padding: '16px 24px',
    background: 'linear-gradient(135deg, #f093fb 0%, #f5576c 100%)',
    color: 'white',
    border: 'none',
    borderRadius: '8px',
    fontSize: '16px',
    fontWeight: '600',
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '8px',
    transition: 'all 0.2s'
  },

  spinner: {
    display: 'inline-block',
    animation: 'spin 1s linear infinite'
  },

  planList: {
    display: 'flex',
    flexDirection: 'column',
    gap: '12px',
    marginBottom: '20px'
  },

  workoutCard: {
    background: '#f8f9fa',
    borderRadius: '8px',
    padding: '16px',
    border: '1px solid #e9ecef'
  },

  workoutHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: '12px'
  },

  workoutDay: {
    fontSize: '12px',
    fontWeight: '600',
    color: '#6c757d',
    textTransform: 'uppercase',
    letterSpacing: '0.5px'
  },

  workoutTitle: {
    fontSize: '18px',
    fontWeight: '700',
    color: '#212529',
    marginTop: '4px'
  },

  workoutDuration: {
    fontSize: '14px',
    color: '#495057',
    background: 'white',
    padding: '4px 12px',
    borderRadius: '12px',
    whiteSpace: 'nowrap'
  },

  workoutExercises: {
    marginBottom: '8px'
  },

  exerciseCount: {
    fontSize: '13px',
    fontWeight: '600',
    color: '#495057',
    marginBottom: '4px'
  },

  exerciseList: {
    fontSize: '13px',
    color: '#6c757d'
  },

  workoutNotes: {
    fontSize: '13px',
    color: '#495057',
    fontStyle: 'italic',
    marginTop: '8px',
    padding: '12px',
    background: '#fff3cd',
    borderRadius: '6px',
    borderLeft: '3px solid #ffc107'
  },

  workoutSection: {
    marginBottom: '16px',
    paddingBottom: '16px',
    borderBottom: '1px solid #e9ecef'
  },

  workoutSectionTitle: {
    fontSize: '14px',
    fontWeight: '700',
    color: '#212529',
    marginBottom: '8px'
  },

  workoutSectionContent: {
    fontSize: '14px',
    color: '#495057',
    lineHeight: '1.6'
  },

  exerciseDetailList: {
    display: 'flex',
    flexDirection: 'column',
    gap: '12px'
  },

  exerciseDetail: {
    padding: '12px',
    background: 'white',
    borderRadius: '6px',
    border: '1px solid #e9ecef'
  },

  exerciseDetailName: {
    fontSize: '15px',
    fontWeight: '600',
    color: '#212529',
    marginBottom: '4px'
  },

  exerciseDetailMeta: {
    fontSize: '13px',
    color: '#6c757d',
    marginBottom: '4px'
  },

  exerciseDetailNotes: {
    fontSize: '13px',
    color: '#495057',
    fontStyle: 'italic',
    marginTop: '4px',
    paddingTop: '8px',
    borderTop: '1px solid #f8f9fa'
  },

  addToCalendarButton: {
    width: '100%',
    padding: '16px 24px',
    background: 'linear-gradient(135deg, #4facfe 0%, #00f2fe 100%)',
    color: 'white',
    border: 'none',
    borderRadius: '8px',
    fontSize: '16px',
    fontWeight: '600',
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '8px',
    transition: 'all 0.2s'
  },

  historyList: {
    display: 'flex',
    flexDirection: 'column',
    gap: '12px'
  },

  historyCard: {
    background: '#f8f9fa',
    borderRadius: '8px',
    padding: '16px',
    border: '1px solid #e9ecef'
  },

  historyHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: '8px'
  },

  historyTitle: {
    fontSize: '16px',
    fontWeight: '600',
    color: '#212529',
    textTransform: 'capitalize'
  },

  historyDate: {
    fontSize: '13px',
    color: '#6c757d'
  },

  historyQuery: {
    fontSize: '14px',
    color: '#495057',
    marginBottom: '8px',
    fontStyle: 'italic'
  },

  historyMeta: {
    fontSize: '13px',
    color: '#6c757d'
  }
}

// Add CSS animation
const styleSheet = document.createElement('style')
styleSheet.textContent = `
  @keyframes spin {
    from { transform: rotate(0deg); }
    to { transform: rotate(360deg); }
  }
`
if (!document.head.querySelector('style[data-workout-animations]')) {
  styleSheet.setAttribute('data-workout-animations', 'true')
  document.head.appendChild(styleSheet)
}

export default WorkoutPlannerWidget

