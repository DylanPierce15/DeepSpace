// K-Means clustering algorithm implementation

export const initializeCentroids = (points, k, mode = 'random') => {
  if (points.length === 0) return [];
  
  if (mode === 'kmeans++') {
    return initializeKMeansPlusPlus(points, k);
  }
  
  // Random initialization
  const centroids = [];
  const indices = new Set();
  
  while (centroids.length < k && indices.size < points.length) {
    const idx = Math.floor(Math.random() * points.length);
    if (!indices.has(idx)) {
      indices.add(idx);
      centroids.push([...points[idx]]);
    }
  }
  
  return centroids;
};

const initializeKMeansPlusPlus = (points, k) => {
  if (points.length === 0) return [];
  
  const centroids = [];
  // First centroid: random point
  const firstIdx = Math.floor(Math.random() * points.length);
  centroids.push([...points[firstIdx]]);
  
  // Subsequent centroids: weighted by distance to nearest centroid
  for (let i = 1; i < k; i++) {
    const distances = points.map(point => {
      const minDist = Math.min(
        ...centroids.map(centroid => euclideanDistance(point, centroid))
      );
      return minDist * minDist; // Use squared distance
    });
    
    const sumDistances = distances.reduce((a, b) => a + b, 0);
    let random = Math.random() * sumDistances;
    
    for (let j = 0; j < points.length; j++) {
      random -= distances[j];
      if (random <= 0) {
        centroids.push([...points[j]]);
        break;
      }
    }
  }
  
  return centroids;
};

export const euclideanDistance = (point1, point2) => {
  const dx = point1[0] - point2[0];
  const dy = point1[1] - point2[1];
  return Math.sqrt(dx * dx + dy * dy);
};

export const assignPointsToClusters = (points, centroids) => {
  return points.map(point => {
    let minDist = Infinity;
    let clusterIdx = 0;
    
    centroids.forEach((centroid, idx) => {
      const dist = euclideanDistance(point, centroid);
      if (dist < minDist) {
        minDist = dist;
        clusterIdx = idx;
      }
    });
    
    return clusterIdx;
  });
};

export const updateCentroids = (points, assignments, centroids, learningRate = 1.0) => {
  const k = centroids.length;
  const newCentroids = Array(k).fill(null).map(() => [0, 0]);
  const clusterCounts = Array(k).fill(0);
  
  // Calculate new centroids
  points.forEach((point, idx) => {
    const cluster = assignments[idx];
    newCentroids[cluster][0] += point[0];
    newCentroids[cluster][1] += point[1];
    clusterCounts[cluster]++;
  });
  
  // Average and apply learning rate for smooth animation
  return newCentroids.map((newCentroid, idx) => {
    if (clusterCounts[idx] === 0) {
      // Keep old centroid if cluster is empty
      return centroids[idx];
    }
    
    const avgX = newCentroid[0] / clusterCounts[idx];
    const avgY = newCentroid[1] / clusterCounts[idx];
    
    // Smooth movement with learning rate
    const oldX = centroids[idx][0];
    const oldY = centroids[idx][1];
    
    return [
      oldX + (avgX - oldX) * learningRate,
      oldY + (avgY - oldY) * learningRate
    ];
  });
};

export const calculateInertia = (points, assignments, centroids, normalize = false) => {
  let inertia = 0;
  points.forEach((point, idx) => {
    const cluster = assignments[idx];
    const dist = euclideanDistance(point, centroids[cluster]);
    inertia += dist * dist;
  });
  // Normalize by number of points to get average squared distance (makes numbers smaller)
  return normalize && points.length > 0 ? inertia / points.length : inertia;
};

export const calculateElbowData = (points, maxK = 10) => {
  if (points.length === 0) return [];
  
  const results = [];
  const actualMaxK = Math.min(maxK, points.length);
  
  for (let k = 1; k <= actualMaxK; k++) {
    // Run k-means multiple times and take average
    let totalInertia = 0;
    const runs = 5;
    
    for (let run = 0; run < runs; run++) {
      let centroids = initializeCentroids(points, k, 'random');
      let assignments = assignPointsToClusters(points, centroids);
      let prevInertia = Infinity;
      
      // Run iterations
      for (let iter = 0; iter < 20; iter++) {
        centroids = updateCentroids(points, assignments, centroids, 1.0);
        assignments = assignPointsToClusters(points, centroids);
        const inertia = calculateInertia(points, assignments, centroids, true); // Normalize for elbow method
        
        // Check convergence (use normalized value for comparison)
        if (Math.abs(inertia - prevInertia) < 0.001) break;
        prevInertia = inertia;
      }
      
      totalInertia += calculateInertia(points, assignments, centroids, true); // Normalize for elbow method
    }
    
    results.push({
      k,
      inertia: totalInertia / runs
    });
  }
  
  return results;
};

