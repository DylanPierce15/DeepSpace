import React, { useRef, useEffect } from 'react';

const ResidualPlot = ({ points, slope, intercept }) => {
  const canvasRef = useRef(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !points || points.length === 0) return;

    const ctx = canvas.getContext('2d');
    const width = canvas.width;
    const height = canvas.height;
    const padding = { top: 40, right: 20, bottom: 50, left: 75 };

    ctx.clearRect(0, 0, width, height);

    // Calculate residuals
    const residuals = points.map(([x, y]) => {
      const predicted = slope * x + intercept;
      return y - predicted;
    });

    // Find min/max values
    const xValues = points.map(([x]) => x);
    const minX = Math.min(...xValues);
    const maxX = Math.max(...xValues);
    const minResidual = Math.min(...residuals);
    const maxResidual = Math.max(...residuals);
    const maxAbsResidual = Math.max(Math.abs(minResidual), Math.abs(maxResidual));

    const xScale = (x) => {
      return padding.left + ((x - minX) / (maxX - minX)) * (width - padding.left - padding.right);
    };

    const yScale = (residual) => {
      // Center zero line in the middle
      const range = maxAbsResidual * 2 || 1;
      return padding.top + (1 - (residual + maxAbsResidual) / range) * (height - padding.top - padding.bottom);
    };

    // Draw grid
    ctx.strokeStyle = '#e0e0e0';
    ctx.lineWidth = 1;
    for (let i = 0; i <= 5; i++) {
      const x = minX + (maxX - minX) * (i / 5);
      const px = xScale(x);
      ctx.beginPath();
      ctx.moveTo(px, padding.top);
      ctx.lineTo(px, height - padding.bottom);
      ctx.stroke();
    }
    
    // Draw zero line
    const zeroY = yScale(0);
    ctx.strokeStyle = '#666';
    ctx.lineWidth = 1;
    ctx.setLineDash([2, 2]);
    ctx.beginPath();
    ctx.moveTo(padding.left, zeroY);
    ctx.lineTo(width - padding.right, zeroY);
    ctx.stroke();
    ctx.setLineDash([]);

    // Draw grid lines for residuals
    for (let i = 0; i <= 5; i++) {
      const residual = -maxAbsResidual + (maxAbsResidual * 2) * (i / 5);
      const y = yScale(residual);
      ctx.strokeStyle = '#e0e0e0';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(padding.left, y);
      ctx.lineTo(width - padding.right, y);
      ctx.stroke();
    }

    // Draw points
    ctx.fillStyle = '#36c';
    points.forEach(([x], idx) => {
      const px = xScale(x);
      const py = yScale(residuals[idx]);
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
    ctx.fillText('X (Actual)', width / 2, height - 10);
    
    ctx.save();
    ctx.translate(15, height / 2);
    ctx.rotate(-Math.PI / 2);
    ctx.textAlign = 'center';
    ctx.fillText('Residual (Y - Ŷ)', 0, 0);
    ctx.restore();

    // Draw axis ticks
    ctx.fillStyle = '#666';
    ctx.font = '10px -apple-system, BlinkMacSystemFont, "Segoe UI", "Roboto", "Source Sans Pro", "Inter", "Helvetica Neue", Arial, sans-serif';
    
    // X-axis ticks
    for (let i = 0; i <= 5; i++) {
      const x = minX + (maxX - minX) * (i / 5);
      const px = xScale(x);
      ctx.textAlign = 'center';
      ctx.fillText(x.toFixed(1), px, height - padding.bottom + 20);
    }

    // Y-axis ticks (residuals)
    for (let i = 0; i <= 5; i++) {
      const residual = -maxAbsResidual + (maxAbsResidual * 2) * (i / 5);
      const y = yScale(residual);
      ctx.textAlign = 'right';
      ctx.fillText(residual.toFixed(2), padding.left - 10, y + 4);
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

export default ResidualPlot;

