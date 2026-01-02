import React, { useState, useMemo, useEffect, useRef } from 'react';

function TravelTaskChecklist() {

  // Global storage for tasks - groups represent trips
  const [taskData, setTaskData] = useGlobalStorage('tasks', {
    groups: [{ id: 'general', name: 'General', color: '#3b82f6' }],
    tasks: []
  });
  
  // Task Ideas integration state
  const [taskIdeas, setTaskIdeas] = useGlobalStorage('task-ideas', []);
  const [taskIdeasTracking, setTaskIdeasTracking] = useStorage('task-ideas-tracking', {});
  const [processingIdeaId, setProcessingIdeaId] = useState(null);
  
  // Fixed categories for task grouping
  const CATEGORY_DEFS = useMemo(() => ([
    { id: 'bookings', name: 'Bookings' },
    { id: 'stay', name: 'Stay' },
    { id: 'plans', name: 'Plans' },
    { id: 'essentials', name: 'Essentials' },
    { id: 'misc', name: 'Misc' }
  ]), []);
  
  // Use ref to track last processed count to avoid re-processing
  const lastProcessedCountRef = useRef(0);
  
  // Watch for itinerary query to auto-create trip category
  const [itineraryQuery] = useGlobalStorage('itinerary.query', null);
  const [chosenPlan] = useGlobalStorage('chosen.plan', null);
  const [plans] = useGlobalStorage('trip.plans', []);
  
  // Selected trip/tab - MUST be declared before useEffect
  const [selectedGroupId, setSelectedGroupId] = useState('general');
  
  // Auto-create trip category when plans are generated
  useEffect(() => {
    if (!itineraryQuery?.city || !itineraryQuery?.fromISO || plans.length === 0) return;
    
    const tripName = `${itineraryQuery.city} ${itineraryQuery.fromISO}`;
    const tripId = `trip-${itineraryQuery.city.toLowerCase().replace(/\s+/g, '-')}-${itineraryQuery.fromISO}`;
    
    // Check if trip already exists
    const existingTrip = taskData.groups.find(g => g.id === tripId);
    if (existingTrip) {
      // Update trip with query data if not set (only once)
      if (!existingTrip.queryCity || !existingTrip.queryDate) {
        setTaskData(prev => ({
          ...prev,
          groups: prev.groups.map(g => 
            g.id === tripId 
              ? { ...g, queryCity: itineraryQuery.city, queryDate: itineraryQuery.fromISO }
              : g
          )
        }));
      }
      // DON'T auto-select - let user choose which trip to view
      return;
    }
    
    // Create new trip with query data stored
    const newTrip = {
      id: tripId,
      name: tripName,
      color: '#3b82f6',
      queryCity: itineraryQuery.city,
      queryDate: itineraryQuery.fromISO
    };
    
    setTaskData(prev => ({
      ...prev,
      groups: [...prev.groups, newTrip]
    }));
    
    // Only auto-select if no other trip is selected
    if (!selectedGroupId || selectedGroupId === 'general') {
      setSelectedGroupId(tripId);
    }
  }, [itineraryQuery?.city, itineraryQuery?.fromISO, plans.length]);
  
  // Task form state
  const [taskForm, setTaskForm] = useState({
    name: '',
    description: '',
    dueDate: ''
  });

  // Modal states
  const [showAddTaskModal, setShowAddTaskModal] = useState(false);
  const [showAddTripModal, setShowAddTripModal] = useState(false);
  const [showDeleteTaskModal, setShowDeleteTaskModal] = useState(false);
  const [taskToDelete, setTaskToDelete] = useState(null);
  const [editingGroupId, setEditingGroupId] = useState(null);
  const [editingGroupName, setEditingGroupName] = useState('');
  
  // Email follow-up states
  const [showFollowUpEmailModal, setShowFollowUpEmailModal] = useState(false);
  const [followUpTask, setFollowUpTask] = useState(null);
  const [emailCompose, setEmailCompose] = useState({ to: '', subject: '', body: '' });
  
  // Drag and drop states
  const [draggedTaskId, setDraggedTaskId] = useState(null);
  const [dragOverGroupId, setDragOverGroupId] = useState(null);
  const [dragOverCategoryId, setDragOverCategoryId] = useState(null);
  const [sendingEmail, setSendingEmail] = useState(false);
  const [taskCreationBanner, setTaskCreationBanner] = useState(null);
  const [isGeneratingTasks, setIsGeneratingTasks] = useState(false);
  
  // File upload states
  const [uploadedFile, setUploadedFile] = useState(null);
  const [isProcessingFile, setIsProcessingFile] = useState(false);
  
  // Expand/collapse state per category
  const [expandedCategories, setExpandedCategories] = useState({
    bookings: true,
    stay: true,
    plans: false,
    essentials: false,
    misc: false
  });

  // Get tasks for selected group/trip
  const currentTasks = useMemo(() => {
    return taskData.tasks.filter(task => task.groupId === selectedGroupId);
  }, [taskData.tasks, selectedGroupId]);

  const selectedGroup = taskData.groups.find(g => g.id === selectedGroupId);

  // Process a task idea from another widget (e.g., Gmail agent)
  const processTaskIdea = async (idea) => {
    // Skip if already processed
    if (taskIdeasTracking[idea.id]?.processed) {
      console.log('⏭️ Already processed:', idea.id);
      return;
    }
    
    // Only process ideas with autogenerate: true (e.g., from Gmail agent)
    // Ideas with autogenerate: false (e.g., from itinerary organizer) should be ignored
    if (idea.metadata?.autogenerate === false) {
      console.log('⏭️ Skipping task idea (autogenerate: false):', idea.id);
      return;
    }
    
    console.log('📋 Processing task idea:', idea);
    setProcessingIdeaId(idea.id);

    try {
      const availableCategories = taskData.groups.map(g => ({ id: g.id, name: g.name }));
      const response = await miyagiAPI.post('generate-text', {
        prompt: `Convert this task idea into a structured task format and choose a trip from the provided list.

Task Idea: "${idea.text}"

Source: ${idea.sourceWidgetType} widget

Categories (choose exactly one by id): ${JSON.stringify(availableCategories)}

Generate a JSON object with these fields:
- name: string (required, concise task name)
- description: string (optional, detailed description if needed)
- dueDate: string in YYYY-MM-DD format (optional, only if the idea implies a due date)
- groupId: string (MUST be one of the provided ids; if none fits, use "general")

Rules:
- Return ONLY valid JSON, no other text.
- groupId MUST be selected from the provided list; do not invent ids.`,
        system_prompt: "You are a task structuring assistant. Convert plain text task ideas into structured task objects and select the best target trip from a provided list. Return only valid JSON.",
        max_tokens: 300,
        temperature: 0.3
      });

      if (!response?.success || !response?.text) {
        throw new Error(response?.error || 'AI task generation failed');
      }
      const trimmed = response.data.text.trim() || '{}';
      let jsonStr = trimmed;
      if (trimmed.startsWith('```')) {
        const match = trimmed.match(/```(?:json)?\s*(\{[\s\S]*\})\s*```/);
        if (match) jsonStr = match[1];
      }

      const taskSuggestion = JSON.parse(jsonStr);
      console.log('🤖 Task suggestion from AI:', taskSuggestion);

      // Route strictly by model-selected group within the provided list; fallback to 'general'
      let assignedGroupId = 'general';
      const isValidGroup = (id) => !!taskData.groups.find(g => g.id === id);
      if (taskSuggestion?.groupId && isValidGroup(taskSuggestion.groupId)) {
        assignedGroupId = taskSuggestion.groupId;
        console.log('🤖 Using AI-selected groupId:', taskSuggestion.groupId);
      } else {
        console.log('➡️ Falling back to general; invalid or missing groupId');
      }
      console.log('📍 Assigning task to group:', assignedGroupId);
      console.log('📁 Available groups:', taskData.groups.map(g => g.id));

      const newTask = {
        id: `task-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        name: taskSuggestion.name,
        description: taskSuggestion.description || '',
        groupId: assignedGroupId,
        completed: false,
        createdAt: Date.now(),
        dueDate: taskSuggestion.dueDate || null,
        metadata: idea.metadata || {}
      };

      console.log('✅ Creating new task:', newTask);

      setTaskData({
        ...taskData,
        tasks: [...taskData.tasks, newTask]
      });

      setTaskIdeasTracking({
        ...taskIdeasTracking,
        [idea.id]: {
          processed: true,
          taskId: newTask.id,
          timestamp: Date.now()
        }
      });

      // Remove the processed idea from global storage to prevent re-processing
      setTaskIdeas(prev => {
        const filtered = prev.filter(i => i.id !== idea.id);
        console.log('🗑️ Removed processed idea from storage. Remaining:', filtered.length);
        return filtered;
      });

      setTaskCreationBanner({ message: `✅ Task "${newTask.name}" added from ${idea.sourceWidgetType}`, timestamp: Date.now() });
      setTimeout(() => setTaskCreationBanner(null), 3000);
    } catch (error) {
      console.error('❌ Failed to process task idea:', error);
      setTaskCreationBanner({ message: `❌ Failed to process task idea`, timestamp: Date.now() });
      setTimeout(() => setTaskCreationBanner(null), 3000);
    } finally {
      setProcessingIdeaId(null);
    }
  };

  // Watch for new task ideas - only trigger when count increases
  useEffect(() => {
    if (!taskIdeas || taskIdeas.length === 0) {
      lastProcessedCountRef.current = 0;
      return;
    }
    
    // Only process if we have MORE ideas than last time
    if (taskIdeas.length <= lastProcessedCountRef.current) {
      return;
    }
    
    if (processingIdeaId) {
      return; // Don't process if already processing one
    }

    // Only process the NEW ideas
    const unprocessedIdeas = taskIdeas.filter(idea => !taskIdeasTracking[idea.id]?.processed);
    
    if (unprocessedIdeas.length > 0) {
      console.log('✅ Processing', unprocessedIdeas.length, 'new task ideas');
      unprocessedIdeas.forEach(idea => {
        processTaskIdea(idea);
      });
      lastProcessedCountRef.current = taskIdeas.length;
    }
  }, [taskIdeas]);

  // Convert file to base64
  const fileToBase64 = (file) => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        const base64 = reader.result;
        resolve(base64);
      };
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  };

  // Process uploaded file and generate tasks
  const processUploadedFile = async (newTripId) => {
    if (!uploadedFile) return;

    try {
      setIsProcessingFile(true);
      
      // Convert file to base64
      const fileBase64 = await fileToBase64(uploadedFile);
      
      // Extract text from document
      const extractionResult = await miyagiAPI.post('extract-document-text', {
        file: fileBase64,
        filename: uploadedFile.name
      });

      if (!extractionResult.success || !extractionResult.data?.text) {
        setTaskCreationBanner({ 
          message: '❌ Failed to extract text from document', 
          timestamp: Date.now() 
        });
        setTimeout(() => setTaskCreationBanner(null), 3000);
        return;
      }

      // Generate tasks from extracted text
      const taskGenerationResult = await miyagiAPI.post('generate-tasks-from-document', {
        text: extractionResult.data.text,
        availableCategories: CATEGORY_DEFS
      });

      if (!taskGenerationResult.success || !taskGenerationResult.data?.tasks) {
        setTaskCreationBanner({ 
          message: '❌ Failed to generate tasks from document', 
          timestamp: Date.now() 
        });
        setTimeout(() => setTaskCreationBanner(null), 3000);
        return;
      }

      // Create tasks in the new trip
      const generatedTasks = taskGenerationResult.data.tasks.map(task => ({
        id: task.id,
        name: task.name,
        description: task.description,
        groupId: newTripId,
        categoryId: task.categoryId || 'misc',
        completed: false,
        createdAt: Date.now(),
        dueDate: task.dueDate || null,
        generated: true
      }));

      setTaskData(prev => ({
        ...prev,
        tasks: [...prev.tasks, ...generatedTasks],
        groups: prev.groups.map(g => 
          g.id === newTripId ? { ...g, tasksGenerated: true } : g
        )
      }));

      setTaskCreationBanner({ 
        message: `✅ Added ${generatedTasks.length} tasks from your checklist`, 
        timestamp: Date.now() 
      });
      setTimeout(() => setTaskCreationBanner(null), 3000);

    } catch (error) {
      console.error('Error processing uploaded file:', error);
      setTaskCreationBanner({ 
        message: '❌ Error processing file', 
        timestamp: Date.now() 
      });
      setTimeout(() => setTaskCreationBanner(null), 3000);
    } finally {
      setIsProcessingFile(false);
      setUploadedFile(null);
    }
  };

  // Add a new trip
  const addTrip = async () => {
    const newTrip = {
      id: `trip-${Date.now()}`,
      name: editingGroupName || `Trip ${taskData.groups.length + 1}`,
      color: '#3b82f6'
    };
    setTaskData({
      ...taskData,
      groups: [...taskData.groups, newTrip]
    });
    setSelectedGroupId(newTrip.id);

    // Process uploaded file if present (keep modal open during processing)
    if (uploadedFile) {
      await processUploadedFile(newTrip.id);
    }
    
    // Close modal and reset state only after processing is complete
    setEditingGroupName('');
    setShowAddTripModal(false);
  };

  // Edit trip name
  const saveTripName = (groupId) => {
    setTaskData({
      ...taskData,
      groups: taskData.groups.map(g => 
        g.id === groupId ? { ...g, name: editingGroupName } : g
      )
    });
    setEditingGroupId(null);
    setEditingGroupName('');
  };

  // Add a new task
  const addTask = () => {
    if (!taskForm.name.trim()) return;

    const newTask = {
      id: `task-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      name: taskForm.name.trim(),
      description: taskForm.description.trim(),
      groupId: selectedGroupId,
                completed: false,
      createdAt: Date.now(),
      dueDate: taskForm.dueDate || null
    };

    setTaskData({
      ...taskData,
      tasks: [...taskData.tasks, newTask]
    });

    setTaskForm({ name: '', description: '', dueDate: '' });
    setShowAddTaskModal(false);
  };

  // Toggle task completion
  const toggleTask = (taskId) => {
    const task = taskData.tasks.find(t => t.id === taskId);
    const newStatus = !task.completed;
    
    // If completing a task that originated from an email, show follow-up modal
    if (newStatus && task.metadata?.emailMetadata) {
      setFollowUpTask(task);
      setEmailCompose({
        to: task.metadata.emailMetadata.from || '',
        subject: `Re: ${task.metadata.emailMetadata.subject || 'Your email'}`,
        body: `Hi,\n\nThank you for your email regarding "${task.metadata.emailMetadata.subject || 'your request'}". I've completed the task and wanted to follow up.\n\nBest regards`
      });
      setShowFollowUpEmailModal(true);
    }
    
    setTaskData({
      ...taskData,
      tasks: taskData.tasks.map(t => 
        t.id === taskId ? { ...t, completed: newStatus } : t
      )
    });
  };

  // Drag and drop handlers
  const handleDragStart = (e, taskId) => {
    setDraggedTaskId(taskId);
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', taskId);
    // Make the dragged element semi-transparent
    e.currentTarget.style.opacity = '0.5';
  };

  const handleDragEnd = (e) => {
    e.currentTarget.style.opacity = '';
    setDraggedTaskId(null);
    setDragOverGroupId(null);
    setDragOverCategoryId(null);
  };

  const handleDragOver = (e, groupId) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    setDragOverGroupId(groupId);
  };

  const handleDragLeave = () => {
    setDragOverGroupId(null);
  };

  const handleDrop = (e, targetGroupId, targetCategoryId = null) => {
    e.preventDefault();
    setDragOverGroupId(null);
    setDragOverCategoryId(null);
    
    if (!draggedTaskId) return;
    
    const task = taskData.tasks.find(t => t.id === draggedTaskId);
    if (!task) {
      setDraggedTaskId(null);
      return;
    }
    
    // If dropping on a category (within same trip)
    if (targetCategoryId && task.groupId === selectedGroupId) {
      // Only update category, not group
      setTaskData({
        ...taskData,
        tasks: taskData.tasks.map(t => 
          t.id === draggedTaskId ? { ...t, categoryId: targetCategoryId } : t
        )
      });
      setDraggedTaskId(null);
      return;
    }
    
    // If dropping on a trip/group
    if (targetGroupId && task.groupId !== targetGroupId) {
      setTaskData({
        ...taskData,
        tasks: taskData.tasks.map(t => 
          t.id === draggedTaskId ? { ...t, groupId: targetGroupId } : t
        )
      });
      setDraggedTaskId(null);
      // Optionally switch to the target group
      setSelectedGroupId(targetGroupId);
      return;
    }
    
    setDraggedTaskId(null);
  };

  const handleCategoryDragOver = (e, categoryId) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    setDragOverCategoryId(categoryId);
  };

  const handleCategoryDragLeave = () => {
    setDragOverCategoryId(null);
  };

  // Send follow-up email
  const sendFollowUpEmail = async () => {
    if (sendingEmail) return;
    
    try {
      setSendingEmail(true);
      
      if (!emailCompose.to || !emailCompose.to.includes('@')) {
        setTaskCreationBanner({ message: '❌ Please enter a valid email address', timestamp: Date.now() });
        return;
      }
      
      if (!emailCompose.subject.trim()) {
        setTaskCreationBanner({ message: '❌ Please enter a subject', timestamp: Date.now() });
        return;
      }
      
      if (!emailCompose.body.trim()) {
        setTaskCreationBanner({ message: '❌ Please enter a message', timestamp: Date.now() });
        return;
      }

      const extractEmail = (emailString) => {
        const emailMatch = emailString.match(/<([^>]+)>/);
        return emailMatch ? emailMatch[1] : emailString;
      };

      const cleanRecipient = extractEmail(emailCompose.to);
      const isReply = followUpTask?.metadata?.emailMetadata?.threadId;
      
      let response;
      if (isReply) {
        response = await miyagiAPI.post('gmail-reply', {
          threadId: followUpTask.metadata.emailMetadata.threadId,
          recipient: cleanRecipient,
          subject: emailCompose.subject,
          content: emailCompose.body
        });
                  } else {
        response = await miyagiAPI.post('send-email', {
          recipient: cleanRecipient,
          subject: emailCompose.subject,
          content: emailCompose.body
        });
      }
      
      if (response && response.success) {
        setShowFollowUpEmailModal(false);
        setFollowUpTask(null);
        setEmailCompose({ to: '', subject: '', body: '' });
        setTaskCreationBanner({ 
          message: `📧 ${isReply ? 'Reply sent' : 'Follow-up email sent'} to ${emailCompose.to}`, 
          timestamp: Date.now() 
        });
      } else if (response && response.data?.requiresOAuth) {
        setTaskCreationBanner({ 
          message: '⚠️ Gmail sending permission required. Please reconnect your Gmail integration.', 
          timestamp: Date.now() 
        });
      } else {
        setTaskCreationBanner({ 
          message: `❌ Failed to send email: ${response?.error || 'Unknown error'}`, 
          timestamp: Date.now() 
        });
      }
        } catch (error) {
      console.error('Error sending follow-up email:', error);
      setTaskCreationBanner({ message: '❌ Failed to send email', timestamp: Date.now() });
    } finally {
      setSendingEmail(false);
    }
  };

  // Delete task
  const deleteTask = () => {
    if (!taskToDelete) return;
    setTaskData({
      ...taskData,
      tasks: taskData.tasks.filter(t => t.id !== taskToDelete)
    });
    setShowDeleteTaskModal(false);
    setTaskToDelete(null);
  };

  const completedCount = currentTasks.filter(t => t.completed).length;
  const totalCount = currentTasks.length;
  
  // Generate tasks from chosen plan
  const generateTasksFromPlan = async () => {
    console.log('🎯 Generate Tasks clicked!');
    console.log('📋 chosenPlan:', chosenPlan);
    console.log('🗺️ Selected trip:', selectedGroup);
    console.log('🗺️ Itinerary query:', itineraryQuery);
    
    if (!chosenPlan || !Array.isArray(chosenPlan.days)) {
      console.log('❌ No plan selected or invalid plan');
      setTaskCreationBanner({ message: '❌ No plan selected. Please select a plan in the itinerary organizer first.', timestamp: Date.now() });
      setTimeout(() => setTaskCreationBanner(null), 3000);
      return;
    }
    
    // Verify the plan matches the selected trip using stored query data
    if (!selectedGroup || !selectedGroup.queryCity || !selectedGroup.queryDate) {
      console.log('❌ Selected trip has no query data:', selectedGroup);
      setTaskCreationBanner({ message: '❌ Trip does not have plan data. Please generate plans first.', timestamp: Date.now() });
      setTimeout(() => setTaskCreationBanner(null), 3000);
      return;
    }
    
    // Check if current itinerary query matches the trip's stored query
    if (!itineraryQuery || !itineraryQuery.city || !itineraryQuery.fromISO) {
      console.log('❌ No itinerary query available');
      setTaskCreationBanner({ message: '❌ Please generate plans in the itinerary organizer first.', timestamp: Date.now() });
      setTimeout(() => setTaskCreationBanner(null), 3000);
      return;
    }
    
    const tripCity = selectedGroup.queryCity.toLowerCase().trim();
    const tripDate = selectedGroup.queryDate;
    const queryCity = itineraryQuery.city.toLowerCase().trim();
    const queryDate = itineraryQuery.fromISO;
    
    // CRITICAL: Double-check that the chosen plan is actually for this trip
    if (tripCity !== queryCity || tripDate !== queryDate) {
      console.log('❌ Trip/Query mismatch:', { tripCity, tripDate, queryCity, queryDate });
      console.log('❌ Chosen plan title:', chosenPlan.title);
      console.log('❌ Trying to update:', tripCity, tripDate, 'but plan is for:', queryCity, queryDate);
      setTaskCreationBanner({ message: `❌ Current plan is for "${itineraryQuery.city} ${itineraryQuery.fromISO}". Please select "${selectedGroup.queryCity} ${selectedGroup.queryDate}" plan in the itinerary organizer first.`, timestamp: Date.now() });
      setTimeout(() => setTaskCreationBanner(null), 3000);
      return;
    }
    
    // Additional safety check: verify chosen plan content matches trip
    console.log('✅ City/Date match confirmed. Generating tasks for:', tripCity, tripDate);
    
    console.log('✅ Plan matches trip, generating tasks from:', chosenPlan.title);
    
    setIsGeneratingTasks(true);
    
    try {
      const response = await miyagiAPI.post('generate-text', {
        prompt: `Generate a grouped travel checklist from this plan using ONLY these categories and ids: ${JSON.stringify(CATEGORY_DEFS)}.

Plan: ${JSON.stringify(chosenPlan)}

Guidelines:
- Prefer fewer, high-impact tasks. Deduplicate across days.
- Use dueDate only when clear and helpful (YYYY-MM-DD).
- Omit empty groups entirely.

Return ONLY strict JSON of the form:
{ "groups": [
  { "id": "bookings", "name": "Bookings", "items": [
    { "id": "check-in-online", "name": "Check in online", "description": "", "dueDate": "" }
  ]}
]}
`,
        system_prompt: "You are a travel planning assistant. Group generated tasks into fixed categories and return strict JSON only.",
        max_tokens: 2000,
        temperature: 0.4
      });

      if (!response?.success || !response?.text) {
        throw new Error(response?.error || 'AI checklist generation failed');
      }
      const trimmed = response.data.text.trim() || '{"groups":[]}';
      let jsonStr = trimmed;
      if (trimmed.startsWith('```')) {
        const match = trimmed.match(/```(?:json)?\s*(\{[\s\S]*\})\s*```/);
        if (match) jsonStr = match[1];
      }
      const grouped = JSON.parse(jsonStr);
      const groupsArr = Array.isArray(grouped) ? [] : (Array.isArray(grouped.groups) ? grouped.groups : []);
      
      // Flatten grouped items into task objects with categoryId
      const generatedTasks = groupsArr.flatMap(grp => {
        const catId = grp?.id;
        const items = Array.isArray(grp?.items) ? grp.items : [];
        return items.map(item => ({
          id: `task-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
          name: item.name || item.title || 'Task',
          description: item.description || item.notes || '',
          groupId: selectedGroupId,
          completed: false,
          createdAt: Date.now(),
          dueDate: item.dueAt || item.dueDate || null,
          generated: true,
          categoryId: CATEGORY_DEFS.find(c => c.id === catId) ? catId : 'misc'
        }));
      });
      
      // Keep manually-added tasks (non-generated), replace everything else
      const manualTasks = taskData.tasks.filter(t => t.groupId === selectedGroupId && !t.generated);
      
      // Count what we're keeping vs replacing
      const oldGeneratedTasks = taskData.tasks.filter(t => t.groupId === selectedGroupId && t.generated);
      console.log(`🔄 Replacing ${oldGeneratedTasks.length} old generated tasks, keeping ${manualTasks.length} manual tasks`);
      
      // New generated tasks already shaped above
      const newGeneratedTasks = generatedTasks;

      // Replace all tasks for this group: keep manual tasks + new generated tasks
      // Store plan lastModified timestamp to detect changes - simpler than hashing
      // If plan doesn't have lastModified (legacy plan), use current time
      const planLastModified = chosenPlan.lastModified || Date.now();
      
      console.log('💾 Storing lastGeneratedAt:', planLastModified, 'for plan:', chosenPlan.title);
      console.log(`✅ Created ${newGeneratedTasks.length} new generated tasks`);
      
      setTaskData({
        ...taskData,
        tasks: [
          ...taskData.tasks.filter(t => t.groupId !== selectedGroupId), // Keep tasks from other groups
          ...manualTasks, // Keep manually-added tasks
          ...newGeneratedTasks // Add newly generated tasks
        ],
        groups: taskData.groups.map(g => 
          g.id === selectedGroupId 
            ? { 
                ...g, 
                tasksGenerated: true,
                lastGeneratedPlanTitle: chosenPlan.title, // Track which plan we generated from
                lastGeneratedAt: planLastModified // Track when plan was last modified
              } 
            : g
        )
      });

      setTaskCreationBanner({ message: `✅ Updated ${newGeneratedTasks.length} tasks from plan`, timestamp: Date.now() });
      setTimeout(() => setTaskCreationBanner(null), 3000);
    } catch (error) {
      console.error('Failed to generate tasks:', error);
      setTaskCreationBanner({ message: '❌ Failed to update tasks', timestamp: Date.now() });
      setTimeout(() => setTaskCreationBanner(null), 3000);
    } finally {
      setIsGeneratingTasks(false);
    }
  };

  // Check if selected group has a plan associated and tasks not yet generated
  // Also verify the current itinerary query matches the trip's stored query
  const tripMatchesQuery = selectedGroup && itineraryQuery && 
    selectedGroup.queryCity && selectedGroup.queryDate &&
    selectedGroup.queryCity.toLowerCase().trim() === itineraryQuery.city?.toLowerCase().trim() &&
    selectedGroup.queryDate === itineraryQuery.fromISO;
  
  // Check if there are manually-added tasks (non-generated tasks) in this group
  const hasManualTasks = currentTasks.some(t => !t.generated);
  
  // Check if tasks are already up-to-date with current plan
  // Compare timestamp to detect changes - simpler and more reliable than hashing
  const planLastModified = chosenPlan?.lastModified;
  const lastGeneratedAt = selectedGroup?.lastGeneratedAt;
  const titleMatches = selectedGroup?.lastGeneratedPlanTitle === chosenPlan?.title;
  
  // Task is up-to-date if it was generated AND has the same title AND timestamps match
  // IMPORTANT: If plan has no lastModified, we can't detect changes, so consider it up-to-date
  // (Only show button for plans that DO have lastModified tracking)
  const hasTimestampTracking = planLastModified !== undefined && lastGeneratedAt !== undefined;
  const timestampsMatch = planLastModified === lastGeneratedAt;
  
  const tasksAreUpToDate = selectedGroup?.tasksGenerated && titleMatches && 
    (hasTimestampTracking ? timestampsMatch : true); // If no timestamp tracking, consider up-to-date
  
  // Debug: log when button should appear
  if (selectedGroup && chosenPlan && selectedGroup.id !== 'general') {
    console.log('🔍 Update button FULL check:', {
      trip: selectedGroup.name,
      planLastModified,
      lastGeneratedAt,
      planHasLastModified: chosenPlan?.lastModified !== undefined,
      timestampsMatch: planLastModified === lastGeneratedAt,
      tasksGenerated: selectedGroup?.tasksGenerated,
      titleMatches,
      tasksAreUpToDate,
      showButton: !tasksAreUpToDate && tripMatchesQuery
    });
  }
  
  // Debug logging removed to prevent errors
  
  // Show button if plan matches and tasks are not up-to-date
  const hasPlanForGroup = selectedGroup && chosenPlan && selectedGroup.id !== 'general' && tripMatchesQuery && !tasksAreUpToDate;

  return (
    <div style={{ width: '100%', height: '100%', display: 'flex', background: '#0b1020' }}>
      <style>{`
        @keyframes slideIn {
          from { opacity: 0; transform: translateX(-10px); }
          to { opacity: 1; transform: translateX(0); }
        }
        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
      `}</style>

      {/* Left Sidebar - Trips */}
      <div style={{ 
        width: 280, 
        minWidth: 280,
        background: '#0f172a', 
        borderRight: '1px solid #1f2937',
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden'
      }}>
        {/* Header */}
        <div style={{ padding: 16, borderBottom: '1px solid #1f2937' }}>
          <div style={{ fontSize: 18, fontWeight: 700, color: '#e2e8f0', marginBottom: 8 }}>
            Travel Trips
          </div>
          <button 
            onClick={() => setShowAddTripModal(true)}
            style={{ 
              width: '100%',
              padding: '8px 12px', 
              background: '#1e40af', 
              border: '1px solid #2563eb', 
              color: 'white', 
              borderRadius: 8, 
              cursor: 'pointer',
              fontSize: 14,
              fontWeight: 600
            }}
          >
            + New Trip
          </button>
        </div>

        {/* Trip List */}
        <div style={{ flex: 1, overflow: 'auto', padding: 8 }}>
          {taskData.groups.map(group => (
            <div 
              key={group.id}
              onClick={() => setSelectedGroupId(group.id)}
              onDragOver={(e) => handleDragOver(e, group.id)}
              onDragLeave={handleDragLeave}
              onDrop={(e) => handleDrop(e, group.id)}
              style={{ 
                padding: 12,
                marginBottom: 4,
                background: selectedGroupId === group.id 
                  ? '#1e293b' 
                  : dragOverGroupId === group.id 
                    ? '#1e3a5f' 
                    : '#0b1220',
                border: selectedGroupId === group.id 
                  ? '1px solid #3b82f6' 
                  : dragOverGroupId === group.id
                    ? '2px dashed #3b82f6'
                    : '1px solid #1f2937',
                borderRadius: 8, 
                cursor: draggedTaskId ? 'grabbing' : 'pointer',
                transition: 'all 0.2s',
                animation: 'slideIn 0.3s ease',
                position: 'relative'
              }}
            >
              {editingGroupId === group.id ? (
                <div style={{ display: 'flex', gap: 4 }}>
                  <input
                    value={editingGroupName}
                    onChange={(e) => setEditingGroupName(e.target.value)}
                    onBlur={() => saveTripName(group.id)}
                    onKeyPress={(e) => e.key === 'Enter' && saveTripName(group.id)}
                    style={{
                      flex: 1,
                      padding: '4px 8px',
                      background: '#0f172a',
                      border: '1px solid #3b82f6',
                      borderRadius: 4,
                color: '#e2e8f0', 
                      fontSize: 14
                    }}
                    autoFocus
                  />
                </div>
              ) : (
                <div 
                  style={{ 
                    display: 'flex', 
                    alignItems: 'center', 
                    justifyContent: 'space-between',
                cursor: 'pointer' 
              }}
                  onDoubleClick={() => {
                    setEditingGroupId(group.id);
                    setEditingGroupName(group.name);
                  }}
                >
                  <div style={{ 
                    fontSize: 14, 
                    fontWeight: 600, 
                    color: '#e2e8f0' 
                  }}>
                    {group.name}
        </div>
                  <div style={{ fontSize: 12, color: '#6b7280' }}>
                    {taskData.tasks.filter(t => t.groupId === group.id).length}
            </div>
                </div>
          )}
        </div>
          ))}
            </div>
          </div>

      {/* Right Panel - Tasks */}
                <div style={{ 
        flex: 1, 
        display: 'flex', 
        flexDirection: 'column',
        background: '#0f172a',
        overflow: 'hidden'
      }}>
        {/* Header */}
        <div style={{ padding: 16, borderBottom: '1px solid #1f2937', position: 'relative' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
            <div style={{ fontSize: 20, fontWeight: 700, color: '#e2e8f0' }}>
              {selectedGroup?.name || 'Select a Trip'}
                </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <div style={{ fontSize: 14, color: '#94a3b8' }}>
                {completedCount} / {totalCount} completed
            </div>
              <button 
                onClick={() => setShowAddTaskModal(true)}
                style={{ 
                  padding: '6px 10px', 
                  background: '#1f2937', 
                  border: '1px solid #374151', 
                  color: '#e2e8f0', 
                  borderRadius: 6, 
                  cursor: 'pointer',
                  fontSize: 12,
                  fontWeight: 500
                }}
              >
                + Add
              </button>
          </div>
            </div>
        {hasPlanForGroup && (
          <div style={{ display: 'flex', justifyContent: 'center' }}>
            <button 
              onClick={generateTasksFromPlan}
              disabled={isGeneratingTasks}
              style={{ 
                padding: '10px 24px', 
                background: isGeneratingTasks ? '#4b5563' : '#8b5cf6', 
                border: isGeneratingTasks ? '1px solid #6b7280' : '1px solid #7c3aed', 
                color: 'white', 
                borderRadius: 8, 
                cursor: isGeneratingTasks ? 'not-allowed' : 'pointer',
                fontSize: 15,
                fontWeight: 600,
                opacity: isGeneratingTasks ? 0.7 : 1,
                display: 'flex',
                alignItems: 'center',
                gap: 8
              }}
            >
              {isGeneratingTasks ? (
                <>
                  <span style={{ animation: 'spin 1s linear infinite' }}>⏳</span>
                  Writing your checklist...
                </>
              ) : (
                '🔄 Update Tasks'
              )}
            </button>
          </div>
        )}
          </div>

        {/* Task List */}
        <div style={{ flex: 1, overflow: 'auto', padding: 16 }}>
          {currentTasks.length === 0 ? (
                <div style={{ 
                    textAlign: 'center',
              color: '#6b7280', 
              fontSize: 14, 
              marginTop: 40 
                  }}>
              No tasks yet. Click "Add Task" to get started.
                  </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {selectedGroup?.tasksGenerated ? (
              CATEGORY_DEFS.map(cat => {
                const items = currentTasks.filter(t => (t.categoryId || 'misc') === cat.id);
                if (items.length === 0) return null;
                const isOpen = !!expandedCategories[cat.id];
                return (
                  <div 
                    key={cat.id}
                    onDragOver={(e) => handleCategoryDragOver(e, cat.id)}
                    onDragLeave={handleCategoryDragLeave}
                    onDrop={(e) => handleDrop(e, null, cat.id)}
                    style={{ 
                      border: dragOverCategoryId === cat.id 
                        ? '2px dashed #3b82f6' 
                        : '1px solid #1f2937', 
                      borderRadius: 10, 
                      overflow: 'hidden', 
                      background: dragOverCategoryId === cat.id 
                        ? '#1e3a5f' 
                        : '#0b1220',
                      transition: 'all 0.2s'
                    }}
                  >
                    <div 
                      onClick={() => setExpandedCategories({ ...expandedCategories, [cat.id]: !isOpen })}
                      onDragOver={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        handleCategoryDragOver(e, cat.id);
                      }}
                      onDragLeave={(e) => {
                        e.stopPropagation();
                        handleCategoryDragLeave();
                      }}
                      onDrop={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        handleDrop(e, null, cat.id);
                      }}
                      style={{ 
                        display: 'flex', 
                        alignItems: 'center', 
                        justifyContent: 'space-between', 
                        padding: '10px 12px', 
                        cursor: 'pointer', 
                        background: dragOverCategoryId === cat.id ? '#1e3a5f' : '#0b1220',
                        transition: 'background 0.2s'
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <span style={{ color: '#e2e8f0', fontWeight: 700, fontSize: 14 }}>{cat.name}</span>
                        <span style={{ color: '#94a3b8', fontSize: 12 }}>({items.length})</span>
                      </div>
                      <span style={{ color: '#94a3b8' }}>{isOpen ? '▾' : '▸'}</span>
                    </div>
                    {isOpen && (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 8, padding: '8px 10px 12px' }}>
                        {items.map(task => (
                          <div 
                            key={task.id}
                            draggable
                            onDragStart={(e) => handleDragStart(e, task.id)}
                            onDragEnd={handleDragEnd}
                            style={{
                              padding: 12,
                              background: '#0b1220',
                              border: '1px solid #1f2937',
                              borderRadius: 8,
                              cursor: 'grab',
                              transition: 'all 0.2s',
                              opacity: task.completed ? 0.6 : (draggedTaskId === task.id ? 0.5 : 1),
                              animation: 'slideIn 0.3s ease'
                            }}
                          >
                            <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
                              <div 
                                onClick={() => toggleTask(task.id)}
                                style={{
                                  width: 20,
                                  height: 20,
                                  border: '2px solid #1f2937',
                                  borderRadius: 4,
                                  background: task.completed ? '#10b981' : 'transparent',
                                  cursor: 'pointer',
                                  display: 'flex',
                                  alignItems: 'center',
                                  justifyContent: 'center',
                                  flexShrink: 0,
                                  marginTop: 2
                                }}
                              >
                                {task.completed && (
                                  <span style={{ color: 'white', fontSize: 12 }}>✓</span>
                                )}
                              </div>
                              <div style={{ flex: 1 }}>
                                <div style={{ 
                                  fontSize: 14, 
                                  fontWeight: 600, 
                                  color: task.completed ? '#94a3b8' : '#e2e8f0',
                                  textDecoration: task.completed ? 'line-through' : 'none'
                                }}>
                                  {task.name}
                                </div>
                                {task.description && (
                                  <div style={{ 
                                    fontSize: 13, 
                                    color: '#94a3b8', 
                                    marginTop: 4 
                                  }}>
                                    {task.description}
                                  </div>
                                )}
                                {task.dueDate && (
                                  <div style={{ 
                                    fontSize: 12, 
                                    color: '#86efac', 
                                    marginTop: 4 
                                  }}>
                                    Due: {new Date(task.dueDate).toLocaleDateString()}
                                  </div>
                                )}
                              </div>
                              <button
                                onClick={() => {
                                  setTaskToDelete(task.id);
                                  setShowDeleteTaskModal(true);
                                }}
                                style={{
                                  padding: '4px 8px',
                                  background: 'transparent',
                                  border: '1px solid #dc2626',
                                  color: '#dc2626',
                                  borderRadius: 4,
                                  cursor: 'pointer',
                                  fontSize: 12
                                }}
                              >
                                Delete
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })
              ) : (
                currentTasks.map(task => (
                  <div 
                    key={task.id}
                    draggable
                    onDragStart={(e) => handleDragStart(e, task.id)}
                    onDragEnd={handleDragEnd}
                    style={{
                      padding: 12,
                      background: '#0b1220',
                      border: '1px solid #1f2937',
                      borderRadius: 8,
                      cursor: 'grab',
                      transition: 'all 0.2s',
                      opacity: task.completed ? 0.6 : (draggedTaskId === task.id ? 0.5 : 1),
                      animation: 'slideIn 0.3s ease'
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
                      <div 
                        onClick={() => toggleTask(task.id)}
                        style={{
                          width: 20,
                          height: 20,
                          border: '2px solid #1f2937',
                          borderRadius: 4,
                          background: task.completed ? '#10b981' : 'transparent',
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          flexShrink: 0,
                          marginTop: 2
                        }}
                      >
                        {task.completed && (
                          <span style={{ color: 'white', fontSize: 12 }}>✓</span>
                        )}
                      </div>
                      <div style={{ flex: 1 }}>
                        <div style={{ 
                          fontSize: 14, 
                          fontWeight: 600, 
                          color: task.completed ? '#94a3b8' : '#e2e8f0',
                          textDecoration: task.completed ? 'line-through' : 'none'
                        }}>
                          {task.name}
                        </div>
                        {task.description && (
                          <div style={{ 
                            fontSize: 13, 
                            color: '#94a3b8', 
                            marginTop: 4 
                          }}>
                            {task.description}
                          </div>
                        )}
                        {task.dueDate && (
                          <div style={{ 
                            fontSize: 12, 
                            color: '#86efac', 
                            marginTop: 4 
                          }}>
                            Due: {new Date(task.dueDate).toLocaleDateString()}
                          </div>
                        )}
                      </div>
                      <button
                        onClick={() => {
                          setTaskToDelete(task.id);
                          setShowDeleteTaskModal(true);
                        }}
                        style={{
                          padding: '4px 8px',
                          background: 'transparent',
                          border: '1px solid #dc2626',
                          color: '#dc2626',
                          borderRadius: 4,
                          cursor: 'pointer',
                          fontSize: 12
                        }}
                      >
                        Delete
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          )}
        </div>
      </div>

      {/* Add Task Modal */}
      {showAddTaskModal && (
              <div style={{ 
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: 'rgba(0,0,0,0.7)',
                display: 'flex', 
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 1000
        }}>
          <div style={{
            background: '#0f172a',
            border: '1px solid #1f2937',
            borderRadius: 12,
            padding: 24,
            width: 400,
            maxWidth: '90%'
          }}>
            <div style={{ fontSize: 18, fontWeight: 700, color: '#e2e8f0', marginBottom: 16 }}>
              Add Task
            </div>
            <input
              placeholder="Task name"
              value={taskForm.name}
              onChange={(e) => setTaskForm({ ...taskForm, name: e.target.value })}
              style={{
                width: '100%',
                padding: '10px 12px',
                background: '#0b1220',
                border: '1px solid #1f2937',
                borderRadius: 8,
                color: '#e2e8f0',
                fontSize: 14,
                marginBottom: 12
              }}
            />
            <textarea
              placeholder="Description (optional)"
              value={taskForm.description}
              onChange={(e) => setTaskForm({ ...taskForm, description: e.target.value })}
              style={{
                width: '100%',
                minHeight: 80,
                padding: '10px 12px',
                background: '#0b1220',
                border: '1px solid #1f2937',
                borderRadius: 8,
                color: '#e2e8f0',
                fontSize: 14,
                marginBottom: 12,
                resize: 'vertical'
              }}
            />
            <input
              type="date"
              placeholder="Due date (optional)"
              value={taskForm.dueDate}
              onChange={(e) => setTaskForm({ ...taskForm, dueDate: e.target.value })}
              style={{
                width: '100%',
                padding: '10px 12px',
                background: '#0b1220',
                border: '1px solid #1f2937',
                borderRadius: 8,
                color: '#e2e8f0',
                fontSize: 14,
                marginBottom: 16
              }}
            />
            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
                <button
                  onClick={() => {
                  setShowAddTaskModal(false);
                  setTaskForm({ name: '', description: '', dueDate: '' });
                  }}
                  style={{
                    padding: '8px 16px',
                  background: 'transparent',
                  border: '1px solid #1f2937',
                  color: '#94a3b8',
                  borderRadius: 8,
                    cursor: 'pointer',
                  fontSize: 14
                  }}
                >
                Cancel
                </button>
                <button
                onClick={addTask}
                  style={{
                    padding: '8px 16px',
                  background: '#10b981',
                  border: '1px solid #059669',
                  color: 'white',
                  borderRadius: 8,
                    cursor: 'pointer',
                  fontSize: 14,
                  fontWeight: 600
                  }}
                >
                Add Task
                </button>
            </div>
          </div>
              </div>
            )}

      {/* Add Trip Modal */}
      {showAddTripModal && (
                  <div 
          onClick={(e) => {
            // Prevent closing modal while processing
            if (!isProcessingFile && e.target === e.currentTarget) {
              setShowAddTripModal(false);
              setEditingGroupName('');
              setUploadedFile(null);
            }
          }}
          style={{ 
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: 'rgba(0,0,0,0.7)',
                    display: 'flex', 
                    alignItems: 'center', 
          justifyContent: 'center',
          zIndex: 1000,
          cursor: isProcessingFile ? 'not-allowed' : 'pointer'
        }}>
                      <div style={{ 
            background: '#0f172a',
            border: '1px solid #1f2937',
                        borderRadius: 12, 
            padding: 24,
            width: 400,
            maxWidth: '90%'
                      }}>
            <div style={{ fontSize: 18, fontWeight: 700, color: '#e2e8f0', marginBottom: 16 }}>
              New Trip
                      </div>
            <input
              placeholder="Trip name (e.g., Paris 2024)"
              value={editingGroupName}
              onChange={(e) => setEditingGroupName(e.target.value)}
              onKeyPress={(e) => e.key === 'Enter' && addTrip()}
              style={{
                width: '100%',
                padding: '10px 12px',
                background: '#0b1220',
                border: '1px solid #1f2937',
                borderRadius: 8,
                color: '#e2e8f0',
                fontSize: 14,
                marginBottom: 16
              }}
              autoFocus
            />
            
            {/* File upload section */}
            <div style={{ marginBottom: 16, padding: 16, background: '#0b1220', border: '1px solid #1f2937', borderRadius: 8 }}>
              <div style={{ fontSize: 13, fontWeight: 600, color: '#94a3b8', marginBottom: 8 }}>
                Upload Checklist (Optional)
              </div>
              <div style={{ fontSize: 12, color: '#6b7280', marginBottom: 12 }}>
                Upload a PDF or Word checklist to auto-generate tasks
              </div>
              <input
                type="file"
                accept=".pdf,.doc,.docx"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) {
                    const ext = file.name.toLowerCase().split('.').pop();
                    if (['pdf', 'doc', 'docx'].includes(ext)) {
                      setUploadedFile(file);
                    } else {
                      setTaskCreationBanner({ 
                        message: '❌ Please upload a PDF or Word document', 
                        timestamp: Date.now() 
                      });
                      setTimeout(() => setTaskCreationBanner(null), 3000);
                    }
                  }
                }}
                style={{
                  width: '100%',
                  padding: '8px',
                  background: '#0b1220',
                  border: '1px solid #374151',
                  borderRadius: 6,
                  color: '#e2e8f0',
                  fontSize: 13,
                  cursor: 'pointer'
                }}
              />
              {uploadedFile && (
                <div style={{ marginTop: 8, fontSize: 12, color: '#10b981' }}>
                  ✓ {uploadedFile.name}
                </div>
              )}
            </div>
            
            {/* Loading spinner when processing document */}
            {isProcessingFile && (
              <div style={{ 
                display: 'flex', 
                alignItems: 'center', 
                justifyContent: 'center', 
                gap: 12, 
                padding: '16px',
                marginBottom: 16,
                background: '#0b1220',
                border: '1px solid #1f2937',
                borderRadius: 8
              }}>
                <div style={{
                  width: 20,
                  height: 20,
                  border: '3px solid #374151',
                  borderTop: '3px solid #3b82f6',
                  borderRadius: '50%',
                  animation: 'spin 1s linear infinite'
                }} />
                <div style={{ fontSize: 14, color: '#94a3b8' }}>
                  Processing document and generating tasks...
                </div>
              </div>
            )}
            
            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
                    <button
                onClick={() => {
                  setShowAddTripModal(false);
                  setEditingGroupName('');
                  setUploadedFile(null);
                }}
                      disabled={isProcessingFile}
                      style={{
                  padding: '8px 16px',
                        background: 'transparent',
                  border: '1px solid #1f2937',
                  color: '#94a3b8',
                  borderRadius: 8,
                        cursor: isProcessingFile ? 'not-allowed' : 'pointer',
                  fontSize: 14,
                  opacity: isProcessingFile ? 0.5 : 1
                      }}
                    >
                Cancel
                    </button>
              <button
                onClick={addTrip}
                disabled={isProcessingFile}
                        style={{
                  padding: '8px 16px',
                  background: isProcessingFile ? '#4b5563' : '#1e40af',
                  border: '1px solid #2563eb',
                  color: 'white',
                          borderRadius: 8,
                            cursor: isProcessingFile ? 'not-allowed' : 'pointer',
                            fontSize: 14,
                  fontWeight: 600,
                  opacity: isProcessingFile ? 0.7 : 1,
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8
                }}
              >
                {isProcessingFile ? (
                  <>
                    <div style={{
                      width: 14,
                      height: 14,
                      border: '2px solid #6b7280',
                      borderTop: '2px solid white',
                      borderRadius: '50%',
                      animation: 'spin 0.8s linear infinite'
                    }} />
                    Processing...
                  </>
                ) : (
                  'Create Trip'
                )}
              </button>
                                    </div>
                            </div>
                    </div>
                  )}

      {/* Delete Task Modal */}
      {showDeleteTaskModal && (
                          <div style={{ 
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: 'rgba(0,0,0,0.7)',
                            display: 'flex', 
                            alignItems: 'center', 
          justifyContent: 'center',
          zIndex: 1000
              }}>
                <div style={{ 
                  background: '#0f172a',
                  border: '1px solid #1f2937',
            borderRadius: 12,
            padding: 24,
            width: 400,
            maxWidth: '90%'
          }}>
            <div style={{ fontSize: 18, fontWeight: 700, color: '#e2e8f0', marginBottom: 8 }}>
              Delete Task?
                          </div>
            <div style={{ fontSize: 14, color: '#94a3b8', marginBottom: 16 }}>
              This action cannot be undone.
              </div>
            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
              <button
                onClick={() => {
                  setShowDeleteTaskModal(false);
                  setTaskToDelete(null);
                }}
                style={{
                  padding: '8px 16px',
                  background: 'transparent',
                  border: '1px solid #1f2937',
                  color: '#94a3b8',
                  borderRadius: 8,
                  cursor: 'pointer',
                  fontSize: 14
                }}
              >
                Cancel
              </button>
              <button
                onClick={deleteTask}
                style={{
                  padding: '8px 16px',
                  background: '#dc2626',
                  border: '1px solid #991b1b',
                  color: 'white',
                  borderRadius: 8,
                  cursor: 'pointer',
                            fontSize: 14,
                  fontWeight: 600
                }}
              >
                Delete
              </button>
                          </div>
          </div>
                            </div>
                          )}

        {/* Follow-up Email Modal */}
        {showFollowUpEmailModal && (
                            <div style={{ 
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: 'rgba(0, 0, 0, 0.7)',
                                    display: 'flex',
                                    alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1000
          }}>
                                    <div style={{ 
              background: '#0f172a',
              border: '1px solid #1f2937',
              borderRadius: 12,
              padding: 24,
              minWidth: 600,
              maxWidth: '90vw',
              maxHeight: '80vh',
                                      display: 'flex',
                                      flexDirection: 'column',
              color: '#e2e8f0'
            }}>
              <div style={{ fontSize: 18, fontWeight: 700, marginBottom: 16 }}>
                📧 Send Follow-up Email
                                    </div>
              
              <div style={{ marginBottom: 16, fontSize: 14, color: '#94a3b8' }}>
                Task completed: <strong style={{ color: '#e2e8f0' }}>{followUpTask?.name}</strong>
                            </div>
              
              <div style={{ marginBottom: 16 }}>
                <label style={{ display: 'block', marginBottom: 4, fontSize: 14, fontWeight: 500 }}>
                  To
                </label>
                <input
                  type="email"
                  value={emailCompose.to}
                  onChange={(e) => setEmailCompose({ ...emailCompose, to: e.target.value })}
                  style={{
                    width: '100%',
                    padding: '8px 12px',
                    background: '#0b1220',
                    border: '1px solid #1f2937',
                    borderRadius: 8,
                    color: '#e2e8f0',
                    fontSize: 14
                  }}
                />
                        </div>

              <div style={{ marginBottom: 16 }}>
                <label style={{ display: 'block', marginBottom: 4, fontSize: 14, fontWeight: 500 }}>
                  Subject
                </label>
                <input
                  type="text"
                  value={emailCompose.subject}
                  onChange={(e) => setEmailCompose({ ...emailCompose, subject: e.target.value })}
                  style={{
                    width: '100%',
                    padding: '8px 12px',
                    background: '#0b1220',
                    border: '1px solid #1f2937',
                    borderRadius: 8,
                    color: '#e2e8f0',
                    fontSize: 14
                  }}
                />
                      </div>

              <div style={{ marginBottom: 20, flex: 1 }}>
                <label style={{ display: 'block', marginBottom: 4, fontSize: 14, fontWeight: 500 }}>
                  Message
                </label>
                <textarea
                  value={emailCompose.body}
                  onChange={(e) => setEmailCompose({ ...emailCompose, body: e.target.value })}
                  rows={8}
                  style={{
                    width: '100%',
                    padding: '8px 12px',
                    background: '#0b1220',
                    border: '1px solid #1f2937',
                    borderRadius: 8,
                    color: '#e2e8f0',
                    fontSize: 14,
                    resize: 'vertical',
                    fontFamily: 'inherit'
                  }}
                />
                    </div>

              <div style={{ display: 'flex', gap: 12, justifyContent: 'flex-end' }}>
                <button
                  onClick={() => {
                    setShowFollowUpEmailModal(false);
                    setFollowUpTask(null);
                    setEmailCompose({ to: '', subject: '', body: '' });
                  }}
                  style={{
                    padding: '8px 16px',
                    background: 'transparent',
                    border: '1px solid #1f2937',
                    color: '#94a3b8',
                    borderRadius: 8,
                    cursor: 'pointer',
                    fontSize: 14
                  }}
                >
                  Cancel
                </button>
                <button
                  onClick={sendFollowUpEmail}
                  disabled={sendingEmail}
                  style={{
                    padding: '8px 16px',
                    background: sendingEmail ? '#1f2937' : '#3b82f6',
                    border: '1px solid #2563eb',
                    color: 'white',
                    borderRadius: 8,
                    cursor: sendingEmail ? 'not-allowed' : 'pointer',
                    fontSize: 14,
                    fontWeight: 600
                  }}
                >
                  {sendingEmail ? 'Sending...' : 'Send Email'}
                </button>
                </div>
            </div>
          </div>
        )}

        {/* Task Creation Banner */}
        {taskCreationBanner && (
              <div style={{ 
            position: 'fixed',
            top: 20,
            right: 20,
                  background: '#0f172a',
                  border: '1px solid #1f2937',
            borderRadius: 8,
            padding: '12px 16px',
            color: '#e2e8f0',
            fontSize: 14,
            zIndex: 1001,
            boxShadow: '0 4px 12px rgba(0,0,0,0.4)',
            animation: 'slideIn 0.3s ease'
          }}>
            {taskCreationBanner.message}
              </div>
            )}
              </div>
  );
}

export default TravelTaskChecklist;
