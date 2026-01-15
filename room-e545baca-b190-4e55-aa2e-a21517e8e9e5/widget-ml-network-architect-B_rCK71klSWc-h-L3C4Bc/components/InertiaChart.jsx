import React, { useRef, useEffect } from 'react';

const InertiaChart = ({ inertiaHistory }) => {
  const canvasRef = useRef(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !inertiaHistory || inertiaHistory.length === 0) return;

    const ctx = canvas.getContext('2d');
    const width = canvas.width;
    const height = canvas.height;
    const padding = { top: 40, right: 20, bottom: 50, left: 75 };

    ctx.clearRect(0, 0, width, height);

    // Find min/max values
    const minInertia = Math.min(...inertiaHistory);
    const maxInertia = Math.max(...inertiaHistory);
    const maxIteration = inertiaHistory.length - 1;

    const xScale = (iteration) => {
      return padding.left + (iteration / maxIteration) * (width - padding.left - padding.right);
    };

    const yScale = (inertia) => {
      return padding.top + (1 - (inertia - minInertia) / (maxInertia - minInertia)) * (height - padding.top - padding.bottom);
    };

    // Draw grid
    ctx.strokeStyle = '#e0e0e0';
    ctx.lineWidth = 1;
    for (let i = 0; i <= 5; i++) {
      const iteration = (maxIteration * i) / 5;
      const x = xScale(iteration);
      ctx.beginPath();
      ctx.moveTo(x, padding.top);
      ctx.lineTo(x, height - padding.bottom);
      ctx.stroke();
    }
    for (let i = 0; i <= 5; i++) {
      const inertia = minInertia + (maxInertia - minInertia) * (i / 5);
      const y = yScale(inertia);
      ctx.beginPath();
      ctx.moveTo(padding.left, y);
      ctx.lineTo(width - padding.right, y);
      ctx.stroke();
    }

    // Draw filled area
    ctx.fillStyle = 'rgba(255, 107, 107, 0.1)';
    ctx.beginPath();
    ctx.moveTo(xScale(0), height - padding.bottom);
    inertiaHistory.forEach((inertia, idx) => {
      ctx.lineTo(xScale(idx), yScale(inertia));
    });
    ctx.lineTo(xScale(maxIteration), height - padding.bottom);
    ctx.closePath();
    ctx.fill();

    // Draw line
    ctx.strokeStyle = '#ff6b6b';
    ctx.lineWidth = 2;
    ctx.beginPath();
    inertiaHistory.forEach((inertia, idx) => {
      const x = xScale(idx);
      const y = yScale(inertia);
      if (idx === 0) {
        ctx.moveTo(x, y);
      } else {
        ctx.lineTo(x, y);
      }
    });
    ctx.stroke();

    // Draw points
    ctx.fillStyle = '#ff6b6b';
    inertiaHistory.forEach((inertia, idx) => {
      const x = xScale(idx);
      const y = yScale(inertia);
      ctx.beginPath();
      ctx.arc(x, y, 3, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = '#fff';
      ctx.lineWidth = 2;
      ctx.stroke();
    });

    // Draw axes labels
    ctx.fillStyle = '#666';
    ctx.font = '12px -apple-system, BlinkMacSystemFont, "Segoe UI", "Roboto", "Source Sans Pro", "Inter", "Helvetica Neue", Arial, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('Iteration', width / 2, height - 10);
    
    ctx.save();
    ctx.translate(15, height / 2);
    ctx.rotate(-Math.PI / 2);
    ctx.textAlign = 'center';
    ctx.fillText('Inertia', 0, 0);
    ctx.restore();

    // Draw axis ticks
    ctx.fillStyle = '#666';
    ctx.font = '10px -apple-system, BlinkMacSystemFont, "Segoe UI", "Roboto", "Source Sans Pro", "Inter", "Helvetica Neue", Arial, sans-serif';
    for (let i = 0; i <= 5; i++) {
      const iteration = Math.floor((maxIteration * i) / 5);
      const x = xScale(iteration);
      ctx.textAlign = 'center';
      ctx.fillText(iteration.toString(), x, height - padding.bottom + 20);
    }

    for (let i = 0; i <= 5; i++) {
      const inertia = minInertia + (maxInertia - minInertia) * (i / 5);
      const y = yScale(inertia);
      ctx.textAlign = 'right';
      ctx.fillText(inertia.toFixed(0), padding.left - 10, y + 4);
    }
  }, [inertiaHistory]);

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

export default InertiaChart;

