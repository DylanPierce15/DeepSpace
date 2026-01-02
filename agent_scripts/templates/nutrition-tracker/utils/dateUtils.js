/**
 * Get the current date key based on reset hour
 * If current time is before reset hour, use previous day
 */
export function getCurrentDateKey(resetHour = 4) {
  const now = new Date();
  const currentHour = now.getHours();
  
  // If before reset hour, use previous day
  if (currentHour < resetHour) {
    const yesterday = new Date(now);
    yesterday.setDate(yesterday.getDate() - 1);
    return formatDateKey(yesterday);
  }
  
  return formatDateKey(now);
}

/**
 * Format date as YYYY-MM-DD
 */
export function formatDateKey(date) {
  return date.toISOString().split('T')[0];
}

/**
 * Get date range for history view (last 30 days)
 */
export function getHistoryRange(resetHour = 4) {
  const today = getCurrentDateKey(resetHour);
  const dates = [];
  const date = new Date(today);
  
  for (let i = 0; i < 30; i++) {
    dates.unshift(formatDateKey(date));
    date.setDate(date.getDate() - 1);
  }
  
  return dates;
}

/**
 * Format date for display
 */
export function formatDisplayDate(dateKey) {
  const date = new Date(dateKey);
  const today = new Date();
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);
  
  if (formatDateKey(date) === formatDateKey(today)) {
    return 'Today';
  } else if (formatDateKey(date) === formatDateKey(yesterday)) {
    return 'Yesterday';
  }
  
  return date.toLocaleDateString('en-US', { 
    weekday: 'short', 
    month: 'short', 
    day: 'numeric' 
  });
}

/**
 * Get days since date
 */
export function getDaysSince(dateKey) {
  const date = new Date(dateKey);
  const today = new Date();
  const diffTime = today - date;
  const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
  return diffDays;
}

