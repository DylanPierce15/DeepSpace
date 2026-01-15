// Feature engineering functions

export function applyFeatures(point, enabledFeatures) {
  const features = [];
  
  if (enabledFeatures.x1) features.push(point.x);
  if (enabledFeatures.x2) features.push(point.y);
  if (enabledFeatures.x1_squared) features.push(point.x * point.x);
  if (enabledFeatures.x2_squared) features.push(point.y * point.y);
  if (enabledFeatures.x1_x2) features.push(point.x * point.y);
  if (enabledFeatures.sin_x1) features.push(Math.sin(point.x));
  if (enabledFeatures.sin_x2) features.push(Math.sin(point.y));
  
  return features;
}

export const featureDefinitions = [
  { key: 'x1', label: 'X₁', formula: 'x' },
  { key: 'x2', label: 'X₂', formula: 'y' },
  { key: 'x1_squared', label: 'X₁²', formula: 'x²' },
  { key: 'x2_squared', label: 'X₂²', formula: 'y²' },
  { key: 'x1_x2', label: 'X₁X₂', formula: 'xy' },
  { key: 'sin_x1', label: 'sin(X₁)', formula: 'sin(x)' },
  { key: 'sin_x2', label: 'sin(X₂)', formula: 'sin(y)' }
];
