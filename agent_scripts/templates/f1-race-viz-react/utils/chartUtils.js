import { CHART_COLORS } from './constants';

/**
 * Extract position data for each driver across all laps
 */
export function extractPositionEvolution(lapTimes) {
  if (!lapTimes || !lapTimes.driverLaps) return null;

  const drivers = Object.keys(lapTimes.driverLaps);
  
  // Find actual maximum lap number across all drivers
  let maxLap = 0;
  drivers.forEach(d => {
    const driverMaxLap = Math.max(...lapTimes.driverLaps[d].map(l => parseInt(l.lap) || 0));
    if (driverMaxLap > maxLap) maxLap = driverMaxLap;
  });

  const driverData = drivers.map((driverId, idx) => ({
    driverId,
    color: CHART_COLORS[idx % CHART_COLORS.length],
    positions: lapTimes.driverLaps[driverId].map(lap => ({
      lap: parseInt(lap.lap),
      position: parseInt(lap.position)
    }))
  }));

  return { driverData, maxLap };
}

/**
 * Extract lead changes from lap data
 */
export function extractLeadChanges(lapTimes) {
  if (!lapTimes || !lapTimes.laps) return null;

  const leadChanges = [];
  let currentLeader = null;

  lapTimes.laps.forEach(lap => {
    const leader = lap.Timings?.find(t => parseInt(t.position) === 1);
    if (leader && leader.driverId !== currentLeader) {
      leadChanges.push({
        lap: parseInt(lap.number),
        driverId: leader.driverId,
        previousLeader: currentLeader
      });
      currentLeader = leader.driverId;
    }
  });

  return leadChanges;
}

/**
 * Extract pit stop timing for visualization
 */
export function extractPitStopData(pitStops, lapTimes) {
  if (!pitStops || pitStops.length === 0) return null;

  const driverStops = {};
  
  pitStops.forEach(stop => {
    if (!driverStops[stop.driverId]) {
      driverStops[stop.driverId] = [];
    }
    driverStops[stop.driverId].push({
      lap: parseInt(stop.lap),
      stop: parseInt(stop.stop),
      duration: parseFloat(stop.duration)
    });
  });

  return driverStops;
}

/**
 * Compare qualifying positions to race finish
 */
export function compareQualifyingToRace(qualifying, raceResults) {
  if (!qualifying || !raceResults) return null;

  const comparison = [];

  raceResults.forEach(result => {
    const driverId = result.Driver?.driverId;
    const qualPos = qualifying.find(q => q.Driver?.driverId === driverId)?.position;
    
    if (qualPos && result.position) {
      comparison.push({
        driverId,
        driverName: `${result.Driver?.givenName} ${result.Driver?.familyName}`,
        qualPosition: parseInt(qualPos),
        racePosition: parseInt(result.position),
        positionChange: parseInt(qualPos) - parseInt(result.position)
      });
    }
  });

  return comparison.sort((a, b) => a.racePosition - b.racePosition);
}

/**
 * Extract fastest laps per driver
 */
export function extractFastestLaps(raceResults) {
  if (!raceResults) return null;

  return raceResults
    .filter(r => r.FastestLap && r.FastestLap.Time)
    .map(r => ({
      driverId: r.Driver?.driverId,
      driverName: `${r.Driver?.givenName} ${r.Driver?.familyName}`,
      time: r.FastestLap.Time.time,
      rank: parseInt(r.FastestLap.rank),
      lap: parseInt(r.FastestLap.lap)
    }))
    .sort((a, b) => a.rank - b.rank);
}

