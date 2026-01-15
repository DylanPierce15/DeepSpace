// Dataset generators

export function generateCircle(numSamples, noise) {
  const points = [];
  for (let i = 0; i < numSamples / 2; i++) {
    const r = Math.random() * 2 + noise * (Math.random() - 0.5);
    const angle = Math.random() * 2 * Math.PI;
    points.push({
      x: r * Math.cos(angle),
      y: r * Math.sin(angle),
      label: 1
    });
  }
  for (let i = 0; i < numSamples / 2; i++) {
    const r = Math.random() * 2 + 3 + noise * (Math.random() - 0.5);
    const angle = Math.random() * 2 * Math.PI;
    points.push({
      x: r * Math.cos(angle),
      y: r * Math.sin(angle),
      label: 0
    });
  }
  // Shuffle to mix classes
  return normalizeData(shuffle(points));
}

export function generateXOR(numSamples, noise) {
  const points = [];
  for (let i = 0; i < numSamples; i++) {
    const x = Math.random() * 10 - 5 + noise * (Math.random() - 0.5);
    const y = Math.random() * 10 - 5 + noise * (Math.random() - 0.5);
    const label = (x > 0) !== (y > 0) ? 1 : 0;
    points.push({ x, y, label });
  }
  return normalizeData(shuffle(points));
}

export function generateGaussian(numSamples, noise) {
  const points = [];
  for (let i = 0; i < numSamples / 2; i++) {
    const x = randn() * 1.5 - 2 + noise * (Math.random() - 0.5);
    const y = randn() * 1.5 - 2 + noise * (Math.random() - 0.5);
    points.push({ x, y, label: 1 });
  }
  for (let i = 0; i < numSamples / 2; i++) {
    const x = randn() * 1.5 + 2 + noise * (Math.random() - 0.5);
    const y = randn() * 1.5 + 2 + noise * (Math.random() - 0.5);
    points.push({ x, y, label: 0 });
  }
  return normalizeData(shuffle(points));
}

export function generateSpiral(numSamples, noise) {
  const points = [];
  const n = numSamples / 2;
  
  for (let i = 0; i < n; i++) {
    const r = i / n * 5;
    const t = 1.25 * i / n * 2 * Math.PI;
    const x = r * Math.cos(t) + noise * (Math.random() - 0.5);
    const y = r * Math.sin(t) + noise * (Math.random() - 0.5);
    points.push({ x, y, label: 1 });
  }
  
  for (let i = 0; i < n; i++) {
    const r = i / n * 5;
    const t = 1.25 * i / n * 2 * Math.PI + Math.PI;
    const x = r * Math.cos(t) + noise * (Math.random() - 0.5);
    const y = r * Math.sin(t) + noise * (Math.random() - 0.5);
    points.push({ x, y, label: 0 });
  }
  
  return normalizeData(shuffle(points));
}

// Helper: shuffle array
function shuffle(array) {
  const shuffled = [...array];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled;
}

// Helper: generate random number from standard normal distribution
function randn() {
  let u = 0, v = 0;
  while (u === 0) u = Math.random();
  while (v === 0) v = Math.random();
  return Math.sqrt(-2.0 * Math.log(u)) * Math.cos(2.0 * Math.PI * v);
}

// Normalize data to fit roughly in [-6, 6] range
function normalizeData(points) {
  const xs = points.map(p => p.x);
  const ys = points.map(p => p.y);
  const minX = Math.min(...xs);
  const maxX = Math.max(...xs);
  const minY = Math.min(...ys);
  const maxY = Math.max(...ys);
  const rangeX = maxX - minX || 1; // Prevent division by zero
  const rangeY = maxY - minY || 1; // Prevent division by zero
  
  return points.map(p => ({
    x: ((p.x - minX) / rangeX - 0.5) * 12,
    y: ((p.y - minY) / rangeY - 0.5) * 12,
    label: p.label
  }));
}

export const datasets = {
  circle: generateCircle,
  xor: generateXOR,
  gaussian: generateGaussian,
  spiral: generateSpiral
};
