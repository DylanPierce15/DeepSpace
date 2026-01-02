// F1 Results Widget Constants

export const DRIVER_COLORS = [
  '#ef4444', '#3b82f6', '#10b981', '#f59e0b', '#8b5cf6', 
  '#06b6d4', '#84cc16', '#f97316', '#ec4899', '#6366f1', 
  '#14b8a6', '#eab308', '#f43f5e', '#06d6a0', '#ffd23f', 
  '#a855f7', '#06b6d4', '#84cc16', '#f59e0b', '#ef4444'
];

export const MEDAL_EMOJI = {
  1: '🥇',
  2: '🥈',
  3: '🥉'
};

export const CHART_CONFIG = {
  height: 400,
  maxWidth: 600,
  margin: { top: 20, right: 20, bottom: 60, left: 50 },
  maxPosition: 20
};

export const QUALIFYING_BAR_COLORS = {
  fast: '#22c55e',
  medium: '#eab308',
  slow: '#ef4444'
};

export const QUALIFYING_THRESHOLDS = {
  fast: 200,  // ms
  medium: 600 // ms
};

export const CACHE_KEYS = {
  YEAR: 'f1.results.year',
  ROUNDS: 'f1.results.rounds',
  SCHEDULE: 'f1.results.schedule',
  QUALIFYING: 'f1.results.qualifying',
  DRIVER_STANDINGS: 'f1.results.driverStandings',
  BETS: 'f1.results.bets',
  SELECTED_ROUND: 'f1.results.selectedRound',
  VIEW: 'f1.results.view',
  USER_EMAIL: 'f1.bets.email',
  PICKS: 'f1.bets.selections',
  SUBMISSIONS: 'f1.bets.submissions'
};

export const VIEWS = {
  RACES: 'races',
  DRIVERS: 'drivers',
  PLAYERS: 'players',
  VISUALIZATIONS: 'visualizations'
};

export const VALID_YEARS = (() => {
  const current = new Date().getFullYear();
  const start = 1950;
  const years = [];
  for (let y = current; y >= start; y--) {
    years.push(y);
  }
  return years;
})();

export const API_BASE_URL = 'https://api.jolpi.ca/ergast/f1';

