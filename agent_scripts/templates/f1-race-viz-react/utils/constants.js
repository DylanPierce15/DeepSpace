// Storage keys - read from F1 widget global storage
export const STORAGE_KEYS = {
  SCHEDULE: 'f1.results.schedule',
  ROUNDS: 'f1.results.rounds',
  QUALIFYING: 'f1.results.qualifying',
  SPRINT: 'f1.results.sprint',
  PIT_STOPS: 'f1.results.pitstops',
  LAP_TIMES: 'f1.results.laptimes',
  DRIVER_STANDINGS: 'f1.results.driverStandings',
  ALL_DRIVERS: 'f1.data.drivers',
};

export const CHART_COLORS = [
  '#ef4444', '#3b82f6', '#10b981', '#f59e0b', '#8b5cf6',
  '#06b6d4', '#84cc16', '#f97316', '#ec4899', '#6366f1',
  '#14b8a6', '#eab308', '#f43f5e', '#06d6a0', '#ffd23f',
  '#a855f7', '#22c55e', '#fb923c', '#fb7185', '#facc15'
];

export const CHART_TYPES = {
  POSITION_EVOLUTION: 'position-evolution',
  LEAD_CHANGES: 'lead-changes',
  PIT_STRATEGY: 'pit-strategy',
  LAP_TIMES: 'lap-times',
  QUALI_VS_RACE: 'quali-vs-race',
};

