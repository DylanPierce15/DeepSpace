// Linear regression utility functions

/**
 * Calculate Mean Squared Error (MSE)
 */
export const calculateMSE = (points, slope, intercept) => {
  if (points.length === 0) return 0;
  
  let sumSquaredError = 0;
  points.forEach(([x, y]) => {
    const predicted = slope * x + intercept;
    const error = y - predicted;
    sumSquaredError += error * error;
  });
  
  return sumSquaredError / points.length;
};

/**
 * Calculate Root Mean Squared Error (RMSE)
 */
export const calculateRMSE = (points, slope, intercept) => {
  const mse = calculateMSE(points, slope, intercept);
  return Math.sqrt(mse);
};

/**
 * Calculate Mean Absolute Error (MAE)
 */
export const calculateMAE = (points, slope, intercept) => {
  if (points.length === 0) return 0;
  
  let sumAbsoluteError = 0;
  points.forEach(([x, y]) => {
    const predicted = slope * x + intercept;
    const error = Math.abs(y - predicted);
    sumAbsoluteError += error;
  });
  
  return sumAbsoluteError / points.length;
};

/**
 * Calculate R-squared (coefficient of determination)
 */
export const calculateR2 = (points, slope, intercept) => {
  if (points.length === 0) return 0;
  
  // Calculate mean of y values
  const meanY = points.reduce((sum, [_, y]) => sum + y, 0) / points.length;
  
  // Calculate total sum of squares (TSS)
  let tss = 0;
  points.forEach(([_, y]) => {
    tss += (y - meanY) * (y - meanY);
  });
  
  // Calculate residual sum of squares (RSS)
  let rss = 0;
  points.forEach(([x, y]) => {
    const predicted = slope * x + intercept;
    const error = y - predicted;
    rss += error * error;
  });
  
  // R² = 1 - (RSS / TSS)
  if (tss === 0) return 1; // Perfect fit or all points have same y
  return 1 - (rss / tss);
};

/**
 * Get residuals (errors) for each point
 */
export const getResiduals = (points, slope, intercept) => {
  return points.map(([x, y]) => {
    const predicted = slope * x + intercept;
    return y - predicted;
  });
};

/**
 * Generate initial random points for linear regression
 */
export const generateRandomPoints = (count = 20, xMin = 0, xMax = 10, yMin = 0, yMax = 10) => {
  const points = [];
  for (let i = 0; i < count; i++) {
    points.push([
      Math.random() * (xMax - xMin) + xMin,
      Math.random() * (yMax - yMin) + yMin
    ]);
  }
  return points;
};

/**
 * Calculate optimal slope and intercept using least squares method
 */
export const calculateOptimalLine = (points) => {
  if (points.length === 0) return { slope: 0, intercept: 0 };
  
  const n = points.length;
  let sumX = 0;
  let sumY = 0;
  let sumXY = 0;
  let sumXX = 0;
  
  points.forEach(([x, y]) => {
    sumX += x;
    sumY += y;
    sumXY += x * y;
    sumXX += x * x;
  });
  
  // Least squares formulas:
  // slope = (n*Σxy - Σx*Σy) / (n*Σx² - (Σx)²)
  // intercept = (Σy - slope*Σx) / n
  
  const denominator = n * sumXX - sumX * sumX;
  
  if (Math.abs(denominator) < 1e-10) {
    // Vertical line or all x values are the same
    return { slope: 0, intercept: sumY / n };
  }
  
  const slope = (n * sumXY - sumX * sumY) / denominator;
  const intercept = (sumY - slope * sumX) / n;
  
  return { slope, intercept };
};

/**
 * Generate points that lie on a line with some noise
 */
export const generateLinearPoints = (count = 20, slope = 1.0, intercept = 0.0, xMin = 0, xMax = 10, noise = 0.1) => {
  const points = [];
  const xStep = (xMax - xMin) / (count - 1);
  
  for (let i = 0; i < count; i++) {
    const x = xMin + i * xStep;
    const y = slope * x + intercept;
    // Add small random noise
    const noisyY = y + (Math.random() - 0.5) * noise * (xMax - xMin);
    points.push([
      x,
      Math.max(0, Math.min(10, noisyY)) // Clamp to 0-10
    ]);
  }
  return points;
};

/**
 * Calculate gradients for slope and intercept using MSE loss
 * Returns { slopeGradient, interceptGradient, currentLoss }
 */
export const calculateGradients = (points, slope, intercept) => {
  if (points.length === 0) return { slopeGradient: 0, interceptGradient: 0, currentLoss: 0 };
  
  let slopeGrad = 0;
  let interceptGrad = 0;
  let loss = 0;
  
  points.forEach(([x, y]) => {
    const predicted = slope * x + intercept;
    const error = y - predicted;
    
    // Gradients: derivative of MSE with respect to slope and intercept
    slopeGrad += -2 * x * error;
    interceptGrad += -2 * error;
    loss += error * error;
  });
  
  // Average gradients
  const n = points.length;
  return {
    slopeGradient: slopeGrad / n,
    interceptGradient: interceptGrad / n,
    currentLoss: loss / n
  };
};

/**
 * Perform one step of gradient descent
 * Returns { newSlope, newIntercept, loss }
 */
export const gradientDescentStep = (points, slope, intercept, learningRate) => {
  const { slopeGradient, interceptGradient, currentLoss } = calculateGradients(points, slope, intercept);
  
  const newSlope = slope - learningRate * slopeGradient;
  const newIntercept = intercept - learningRate * interceptGradient;
  
  return {
    newSlope,
    newIntercept,
    loss: currentLoss
  };
};

