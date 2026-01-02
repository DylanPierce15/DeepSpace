/**
 * Calculate days since last watering
 */
export function daysSinceWatering(lastWateredDate) {
  if (!lastWateredDate) return null;
  const now = new Date();
  const lastWatered = new Date(lastWateredDate);
  const diffTime = Math.abs(now - lastWatered);
  const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
  return diffDays;
}

/**
 * Determine if plant needs watering based on schedule
 */
export function needsWatering(lastWateredDate, wateringFrequency) {
  const days = daysSinceWatering(lastWateredDate);
  if (days === null) return true; // Never watered
  return days >= wateringFrequency;
}

/**
 * Get health status based on watering schedule
 */
export function getHealthStatus(lastWateredDate, wateringFrequency) {
  const days = daysSinceWatering(lastWateredDate);
  if (days === null) return 'unknown';
  
  const overdueDays = days - wateringFrequency;
  
  if (overdueDays <= 0) return 'healthy';
  if (overdueDays <= 2) return 'thirsty';
  return 'critical';
}

/**
 * Get health color for UI
 */
export function getHealthColor(status) {
  switch (status) {
    case 'healthy': return '#22c55e';
    case 'thirsty': return '#f59e0b';
    case 'critical': return '#ef4444';
    default: return '#64748b';
  }
}

/**
 * Format date for display
 */
export function formatDate(dateString) {
  if (!dateString) return 'Never';
  const date = new Date(dateString);
  const now = new Date();
  const diffDays = Math.floor((now - date) / (1000 * 60 * 60 * 24));
  
  if (diffDays === 0) return 'Today';
  if (diffDays === 1) return 'Yesterday';
  if (diffDays < 7) return `${diffDays} days ago`;
  
  return date.toLocaleDateString();
}

