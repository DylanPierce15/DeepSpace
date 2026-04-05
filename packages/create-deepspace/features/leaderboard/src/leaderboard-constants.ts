/**
 * Leaderboard Feature - Constants
 */

export const LEADERBOARD_CATEGORY = {
  GENERAL: 'general',
  SPEED: 'speed',
  ACCURACY: 'accuracy',
} as const

export type LeaderboardCategory = typeof LEADERBOARD_CATEGORY[keyof typeof LEADERBOARD_CATEGORY]

// BadgeColor type - matches the Badge component's color prop
// After copying, import from '../components/ui' instead
export type BadgeColor = 'primary' | 'success' | 'warning' | 'danger' | 'info' | 'muted'

export const CATEGORY_CONFIG: Record<LeaderboardCategory, { title: string; color: BadgeColor }> = {
  [LEADERBOARD_CATEGORY.GENERAL]: { title: 'General', color: 'info' },
  [LEADERBOARD_CATEGORY.SPEED]: { title: 'Speed', color: 'warning' },
  [LEADERBOARD_CATEGORY.ACCURACY]: { title: 'Accuracy', color: 'success' },
}
