import React, { useRef, useEffect } from 'react';

const ElbowChart = ({ elbowData }) => {
  const canvasRef = useRef(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !elbowData || elbowData.length === 0) return;

    const ctx = canvas.getContext('2d');
    const width = canvas.width;
    const height = canvas.height;
    const padding = { top: 40, right: 20, bottom: 50, left: 60 };

    ctx.clearRect(0, 0, width, height);

    // Find min/max values
    const kValues = elbowData.map(d => d.k);
    const inertiaValues = elbowData.map(d => d.inertia);
    const minK = Math.min(...kValues);
    const maxK = Math.max(...kValues);
    const minInertia = Math.min(...inertiaValues);
    const maxInertia = Math.max(...inertiaValues);

    const xScale = (k) => {
      return padding.left + ((k - minK) / (maxK - minK)) * (width - padding.left - padding.right);
    };

    const yScale = (inertia) => {
      return padding.top + (1 - (inertia - minInertia) / (maxInertia - minInertia)) * (height - padding.top - padding.bottom);
    };

    // Draw grid
    ctx.strokeStyle = '#e0e0e0';
    ctx.lineWidth = 1;
    for (let k = minK; k <= maxK; k++) {
      const x = xScale(k);
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

    // Draw line
    ctx.strokeStyle = '#0066cc';
    ctx.lineWidth = 2;
    ctx.beginPath();
    for (let i = 0; i < elbowData.length; i++) {
      const x = xScale(elbowData[i].k);
      const y = yScale(elbowData[i].inertia);
      if (i === 0) {
        ctx.moveTo(x, y);
      } else {
        ctx.lineTo(x, y);
      }
    }
    ctx.stroke();

    // Draw points
    ctx.fillStyle = '#0066cc';
    elbowData.forEach(d => {
      const x = xScale(d.k);
      const y = yScale(d.inertia);
      ctx.beginPath();
      ctx.arc(x, y, 4, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = '#fff';
      ctx.lineWidth = 2;
      ctx.stroke();
    });

    // Draw axes labels
    ctx.fillStyle = '#666';
    ctx.font = '12px -apple-system, BlinkMacSystemFont, "Segoe UI", "Roboto", "Source Sans Pro", "Inter", "Helvetica Neue", Arial, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('Number of Clusters (K)', width / 2, height - 10);
    
    ctx.save();
    ctx.translate(15, height / 2);
    ctx.rotate(-Math.PI / 2);
    ctx.textAlign = 'center';
    ctx.fillText('Sum of Euclidean Distance Squared', 0, 0);
    ctx.restore();

    // Draw axis ticks
    ctx.fillStyle = '#666';
    ctx.font = '10px -apple-system, BlinkMacSystemFont, "Segoe UI", "Roboto", "Source Sans Pro", "Inter", "Helvetica Neue", Arial, sans-serif';
    ctx.textAlign = 'center';
    kValues.forEach(k => {
      const x = xScale(k);
      ctx.fillText(k.toString(), x, height - padding.bottom + 20);
    });

    for (let i = 0; i <= 5; i++) {
      const inertia = minInertia + (maxInertia - minInertia) * (i / 5);
      const y = yScale(inertia);
      ctx.textAlign = 'right';
      ctx.fillText(inertia.toFixed(0), padding.left - 10, y + 4);
    }
  }, [elbowData]);

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

export default ElbowChart;

