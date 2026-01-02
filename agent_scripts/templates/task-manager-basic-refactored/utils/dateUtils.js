/**
 * Date formatting utilities
 */

/**
 * Format date string to local date format - avoids timezone issues
 * When date is stored as YYYY-MM-DD, treat it as local date not UTC
 */
export function formatDateLocal(dateString) {
  if (!dateString) return '';
  
  // Parse as local date to avoid timezone shift
  const [year, month, day] = dateString.split('-').map(num => parseInt(num, 10));
  const date = new Date(year, month - 1, day);
  
  return date.toLocaleDateString();
}

/**
 * Check if a date is overdue
 */
export function isOverdue(dateString) {
  if (!dateString) return false;
  
  // Parse date as local to avoid timezone issues
  const [year, month, day] = dateString.split('-').map(num => parseInt(num, 10));
  const dueDate = new Date(year, month - 1, day);
  dueDate.setHours(0, 0, 0, 0);
  
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  
  return dueDate < today;
}

/**
 * Get upcoming tasks within specified days
 */
export function isUpcoming(dateString, daysAhead = 7) {
  if (!dateString) return false;
  
  // Parse date as local to avoid timezone issues
  const [year, month, day] = dateString.split('-').map(num => parseInt(num, 10));
  const dueDate = new Date(year, month - 1, day);
  dueDate.setHours(0, 0, 0, 0);
  
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  
  const futureDate = new Date(today);
  // Add (days - 1) to include today as day 1
  // e.g., "Next 7 Days" = today + 6 more days
  futureDate.setDate(today.getDate() + (daysAhead - 1));
  
  return dueDate >= today && dueDate <= futureDate;
}
