import React, { useRef, useEffect } from 'react';

const PredictedVsActual = ({ points, slope, intercept }) => {
  const canvasRef = useRef(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !points || points.length === 0) return;

    const ctx = canvas.getContext('2d');
    const width = canvas.width;
    const height = canvas.height;
    const padding = { top: 40, right: 20, bottom: 50, left: 75 };

    ctx.clearRect(0, 0, width, height);

    // Calculate predicted values
    const predictedValues = points.map(([x]) => slope * x + intercept);
    const actualValues = points.map(([_, y]) => y);

    // Find min/max values
    const minPred = Math.min(...predictedValues);
    const maxPred = Math.max(...predictedValues);
    const minActual = Math.min(...actualValues);
    const maxActual = Math.max(...actualValues);
    const minVal = Math.min(minPred, minActual);
    const maxVal = Math.max(maxPred, maxActual);

    const scale = (val) => {
      const range = maxVal - minVal || 1;
      return padding.left + ((val - minVal) / range) * (width - padding.left - padding.right);
    };

    // Draw grid
    ctx.strokeStyle = '#e0e0e0';
    ctx.lineWidth = 1;
    for (let i = 0; i <= 5; i++) {
      const val = minVal + (maxVal - minVal) * (i / 5);
      const x = scale(val);
      const y = scale(val);
      ctx.beginPath();
      ctx.moveTo(x, padding.top);
      ctx.lineTo(x, height - padding.bottom);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(padding.left, y);
      ctx.lineTo(width - padding.right, y);
      ctx.stroke();
    }

    // Draw perfect fit line (y = x)
    ctx.strokeStyle = '#666';
    ctx.lineWidth = 1;
    ctx.setLineDash([2, 2]);
    ctx.beginPath();
    ctx.moveTo(scale(minVal), scale(minVal));
    ctx.lineTo(scale(maxVal), scale(maxVal));
    ctx.stroke();
    ctx.setLineDash([]);

    // Draw points
    ctx.fillStyle = '#36c';
    points.forEach(([x], idx) => {
      const px = scale(predictedValues[idx]);
      const py = scale(actualValues[idx]);
      ctx.beginPath();
      ctx.arc(px, py, 4, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = '#fff';
      ctx.lineWidth = 2;
      ctx.stroke();
    });

    // Draw axes labels
    ctx.fillStyle = '#666';
    ctx.font = '12px -apple-system, BlinkMacSystemFont, "Segoe UI", "Roboto", "Source Sans Pro", "Inter", "Helvetica Neue", Arial, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('Predicted (Ŷ)', width / 2, height - 10);
    
    ctx.save();
    ctx.translate(15, height / 2);
    ctx.rotate(-Math.PI / 2);
    ctx.textAlign = 'center';
    ctx.fillText('Actual (Y)', 0, 0);
    ctx.restore();

    // Draw axis ticks
    ctx.fillStyle = '#666';
    ctx.font = '10px -apple-system, BlinkMacSystemFont, "Segoe UI", "Roboto", "Source Sans Pro", "Inter", "Helvetica Neue", Arial, sans-serif';
    
    for (let i = 0; i <= 5; i++) {
      const val = minVal + (maxVal - minVal) * (i / 5);
      const x = scale(val);
      const y = scale(val);
      
      // X-axis ticks
      ctx.textAlign = 'center';
      ctx.fillText(val.toFixed(1), x, height - padding.bottom + 20);
      
      // Y-axis ticks
      ctx.textAlign = 'right';
      ctx.fillText(val.toFixed(1), padding.left - 10, y + 4);
    }
  }, [points, slope, intercept]);

  return (
    <div style={{ width: '100%', height: '100%' }}>
      <canvas
        ref={canvasRef}
        width={350}
        height={300}
        style={{ width: '100%', height: '100%' }}
      />
    </div>
  );
};

export default PredictedVsActual;

