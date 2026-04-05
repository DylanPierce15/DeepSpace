/**
 * Tasks/Challenges Feature - Constants
 * 
 * After copying to starter/src/constants/, update import:
 *   import type { BadgeColor } from '../components/ui'
 */

// BadgeColor type - matches the Badge component's color prop
// After copying, import from '../components/ui' instead
export type BadgeColor = 'primary' | 'success' | 'warning' | 'danger' | 'info' | 'muted'

// ============================================================================
// Difficulty
// ============================================================================

export const DIFFICULTY = {
  EASY: 'easy',
  MEDIUM: 'medium',
  HARD: 'hard',
} as const

export type Difficulty = typeof DIFFICULTY[keyof typeof DIFFICULTY]

export const DIFFICULTY_CONFIG: Record<Difficulty, { title: string; color: BadgeColor; points: number }> = {
  [DIFFICULTY.EASY]: { title: 'Easy', color: 'success', points: 5 },
  [DIFFICULTY.MEDIUM]: { title: 'Medium', color: 'warning', points: 10 },
  [DIFFICULTY.HARD]: { title: 'Hard', color: 'danger', points: 20 },
}

// ============================================================================
// Grade
// ============================================================================

export const GRADE = {
  PASS: 'pass',
  FAIL: 'fail',
  EXCELLENT: 'excellent',
} as const

export type Grade = typeof GRADE[keyof typeof GRADE]

export const GRADE_CONFIG: Record<Grade, { title: string; color: BadgeColor; multiplier: number }> = {
  [GRADE.FAIL]: { title: 'Fail', color: 'danger', multiplier: 0 },
  [GRADE.PASS]: { title: 'Pass', color: 'success', multiplier: 1 },
  [GRADE.EXCELLENT]: { title: 'Excellent', color: 'primary', multiplier: 1.5 },
}
