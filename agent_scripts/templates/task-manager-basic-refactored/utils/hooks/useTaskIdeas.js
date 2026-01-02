/**
 * Hook for task ideas processing
 */

import { useState } from 'react';
import { logTaskFromIdea } from '../logging.js';
import { DEFAULT_TASK_DATA } from '../constants/defaults.js';

export function useTaskIdeas() {
  const [taskData, setTaskData] = useGlobalStorage('tasks', DEFAULT_TASK_DATA);
  const [taskIdeas, setTaskIdeas] = useGlobalStorage('task-ideas', []);
  const [taskIdeasTracking, setTaskIdeasTracking] = useGlobalStorage('task-ideas-tracking', {});
  const [processingIdeaId, setProcessingIdeaId] = useState(null);

  // Process task idea - convert plain text to structured task via LLM
  const processTaskIdea = async (ideaId, currentUser = null) => {
    const idea = taskIdeas.find(i => i.id === ideaId);
    if (!idea) return;

    setProcessingIdeaId(ideaId);

    try {
      const response = await miyagiAPI.post('generate-text', {
        prompt: `Based on this task idea: "${idea.text}", generate a structured task with:
1. A clear, actionable task name (concise, under 50 chars)
2. A brief description (1-2 sentences)
3. Suggested due date (format: YYYY-MM-DD, within next 30 days)

Format as JSON: {"name": "...", "description": "...", "dueDate": "..."}`,
        system_prompt: "You are a task structuring assistant. Convert plain text task ideas into structured task objects. Return only valid JSON.",
        model: 'gpt-4o-mini',
        max_tokens: 300,
        temperature: 0.7
      });

      if (response?.success && response?.text) {
        try {
          // Parse the response - handle potential markdown code blocks
          const trimmed = response.text.trim();
          let jsonStr = trimmed;
          if (trimmed.startsWith('```')) {
            const match = trimmed.match(/```(?:json)?\s*(\{[\s\S]*\})\s*```/);
            if (match) {
              jsonStr = match[1];
            }
          }
          
          const taskSuggestion = JSON.parse(jsonStr);
          const userName = currentUser?.name || 'Unknown User';
          const userId = currentUser?.id || null;

          // Get max order from existing tasks
          const maxOrder = Math.max(
            0,
            ...(taskData?.tasks || []).map(t => t.order ?? 0)
          );

          const newTask = {
            id: `task-${Date.now()}`,
            name: taskSuggestion.name,
            description: taskSuggestion.description,
            dueDate: taskSuggestion.dueDate,
            assignedUser: null,
            projectId: '',
            completed: false,
            completedAt: null,
            order: maxOrder + 1,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
            sourceIdeaId: ideaId,
            priority: 'medium'
          };

          setTaskData({
            ...taskData,
            tasks: [...(taskData?.tasks || []), newTask]
          });

          setTaskIdeasTracking({
            ...taskIdeasTracking,
            [ideaId]: {
              processed: true,
              taskId: newTask.id,
              timestamp: Date.now()
            }
          });

          logTaskFromIdea(newTask.name, idea.text, userName, userId, newTask.id, ideaId);
        } catch (parseError) {
          console.error('Failed to parse task suggestion:', parseError);
        }
      }
    } catch (error) {
      console.error('Failed to process task idea:', error);
    } finally {
      setProcessingIdeaId(null);
    }
  };

  // Get unprocessed ideas
  const unprocessedIdeas = taskIdeas.filter(idea => !taskIdeasTracking[idea.id]?.processed);

  return {
    taskIdeas,
    taskIdeasTracking,
    processingIdeaId,
    unprocessedTaskIdeas: unprocessedIdeas,
    processTaskIdea
  };
}
