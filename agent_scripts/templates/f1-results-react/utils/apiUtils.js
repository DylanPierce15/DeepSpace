// F1 API utilities for fetching data from Ergast API

import { API_BASE_URL } from './constants';

/**
 * Build API URL for season results
 */
export const buildSeasonResultsUrl = (season) => {
  const s = String(season).trim();
  return `${API_BASE_URL}/${encodeURIComponent(s)}/results.json?limit=1000`;
};

/**
 * Build API URL for specific round results
 */
export const buildRoundResultsUrl = (season, round) => {
  const s = String(season).trim();
  const r = String(round).trim();
  return `${API_BASE_URL}/${encodeURIComponent(s)}/${encodeURIComponent(r)}/results.json`;
};

/**
 * Build API URL for qualifying results
 */
export const buildQualifyingUrl = (season, round) => {
  const s = String(season).trim();
  const r = String(round).trim();
  return `${API_BASE_URL}/${encodeURIComponent(s)}/${encodeURIComponent(r)}/qualifying.json`;
};

/**
 * Build API URL for season schedule
 */
export const buildScheduleUrl = (season) => {
  const s = String(season).trim();
  return `${API_BASE_URL}/${encodeURIComponent(s)}.json`;
};

/**
 * Build API URL for driver standings
 */
export const buildDriverStandingsUrl = (season) => {
  const s = String(season).trim();
  return `${API_BASE_URL}/${encodeURIComponent(s)}/driverStandings.json`;
};

/**
 * Generic fetch wrapper with error handling
 */
export const fetchFromAPI = async (url) => {
  try {
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }
    return await response.json();
  } catch (error) {
    console.error(`API fetch failed for ${url}:`, error);
    throw error;
  }
};

