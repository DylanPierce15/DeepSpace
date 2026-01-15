import React, { useRef, useEffect, useCallback, useState } from 'react';

const LinearRegressionVisualization = ({ 
  points, 
  slope,
  intercept,
  onUpdatePoint
}) => {
  const canvasRef = useRef(null);
  const [isDragging, setIsDragging] = useState(null);
  const [dragOffset, setDragOffset] = useState([0, 0]);

  const LOGICAL_WIDTH = 10;
  const LOGICAL_HEIGHT = 10;
  const CANVAS_SIZE = 600; // Display size

  const getCanvasCoordinates = useCallback((e) => {
    const canvas = canvasRef.current;
    if (!canvas) return null;
    
    const rect = canvas.getBoundingClientRect();
    const scale = Math.min(rect.width / CANVAS_SIZE, rect.height / CANVAS_SIZE);
    const offsetX = (rect.width - CANVAS_SIZE * scale) / 2;
    const offsetY = (rect.height - CANVAS_SIZE * scale) / 2;
    
    // Convert to logical coordinates (0-10)
    const logicalX = ((e.clientX - rect.left - offsetX) / scale) * (LOGICAL_WIDTH / CANVAS_SIZE);
    const logicalY = ((e.clientY - rect.top - offsetY) / scale) * (LOGICAL_HEIGHT / CANVAS_SIZE);
    
    return [logicalX, logicalY];
  }, []);

  const findNearestPoint = useCallback((x, y, threshold = 0.3) => {
    let minDist = threshold;
    let nearestIdx = null;
    
    points.forEach((point, idx) => {
      const dist = Math.sqrt(
        Math.pow(point[0] - x, 2) + Math.pow(point[1] - y, 2)
      );
      if (dist < minDist) {
        minDist = dist;
        nearestIdx = idx;
      }
    });
    
    return nearestIdx;
  }, [points]);

  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    
    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, CANVAS_SIZE, CANVAS_SIZE);
    
    // Scale factor for drawing
    const scale = CANVAS_SIZE / LOGICAL_WIDTH;
    
    // Draw grid
    ctx.strokeStyle = '#eaecf0';
    ctx.lineWidth = 1;
    const gridStep = 1; // 1 unit in logical space
    for (let x = 0; x <= LOGICAL_WIDTH; x += gridStep) {
      const px = x * scale;
      ctx.beginPath();
      ctx.moveTo(px, 0);
      ctx.lineTo(px, CANVAS_SIZE);
      ctx.stroke();
    }
    for (let y = 0; y <= LOGICAL_HEIGHT; y += gridStep) {
      const py = y * scale;
      ctx.beginPath();
      ctx.moveTo(0, py);
      ctx.lineTo(CANVAS_SIZE, py);
      ctx.stroke();
    }
    
    // Draw regression line
    ctx.strokeStyle = '#0066cc';
    ctx.lineWidth = 2;
    ctx.beginPath();
    const y1 = intercept; // y at x = 0
    const y2 = slope * LOGICAL_WIDTH + intercept; // y at x = 10
    ctx.moveTo(0, (LOGICAL_HEIGHT - y1) * scale);
    ctx.lineTo(CANVAS_SIZE, (LOGICAL_HEIGHT - y2) * scale);
    ctx.stroke();
    
    // Draw dotted lines from points to regression line (residuals)
    ctx.strokeStyle = '#a7d7f9';
    ctx.lineWidth = 1;
    ctx.setLineDash([4, 4]);
    points.forEach(([x, y]) => {
      const predictedY = slope * x + intercept;
      const px = x * scale;
      const py = (LOGICAL_HEIGHT - y) * scale;
      const predictedPy = (LOGICAL_HEIGHT - predictedY) * scale;
      
      ctx.beginPath();
      ctx.moveTo(px, py);
      ctx.lineTo(px, predictedPy);
      ctx.stroke();
    });
    ctx.setLineDash([]);
    
    // Draw points
    points.forEach((point, idx) => {
      const px = point[0] * scale;
      const py = (LOGICAL_HEIGHT - point[1]) * scale;
      
      ctx.fillStyle = '#36c';
      ctx.beginPath();
      ctx.arc(px, py, 6, 0, Math.PI * 2);
      ctx.fill();
      
      // Draw point border
      ctx.strokeStyle = '#fff';
      ctx.lineWidth = 2;
      ctx.stroke();
    });
    
    // Draw axes labels
    ctx.fillStyle = '#666';
    ctx.font = '12px -apple-system, BlinkMacSystemFont, "Segoe UI", "Roboto", "Source Sans Pro", "Inter", "Helvetica Neue", Arial, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('X', CANVAS_SIZE / 2, CANVAS_SIZE - 10);
    
    ctx.save();
    ctx.translate(15, CANVAS_SIZE / 2);
    ctx.rotate(-Math.PI / 2);
    ctx.textAlign = 'center';
    ctx.fillText('Y', 0, 0);
    ctx.restore();
    
    // Draw axis numbers
    ctx.fillStyle = '#666';
    ctx.font = '10px -apple-system, BlinkMacSystemFont, "Segoe UI", "Roboto", "Source Sans Pro", "Inter", "Helvetica Neue", Arial, sans-serif';
    for (let i = 0; i <= 10; i++) {
      const px = i * scale;
      ctx.textAlign = 'center';
      ctx.fillText(i.toString(), px, CANVAS_SIZE - 5);
      
      const py = (LOGICAL_HEIGHT - i) * scale;
      ctx.textAlign = 'right';
      ctx.fillText(i.toString(), 15, py + 4);
    }
  }, [points, slope, intercept]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    
    const resizeCanvas = () => {
      const container = canvas.parentElement;
      if (container) {
        canvas.width = CANVAS_SIZE;
        canvas.height = CANVAS_SIZE;
        
        const scale = Math.min(
          container.clientWidth / CANVAS_SIZE,
          container.clientHeight / CANVAS_SIZE
        );
        canvas.style.width = (CANVAS_SIZE * scale) + 'px';
        canvas.style.height = (CANVAS_SIZE * scale) + 'px';
        
        draw();
      }
    };
    
    resizeCanvas();
    window.addEventListener('resize', resizeCanvas);
    
    return () => {
      window.removeEventListener('resize', resizeCanvas);
    };
  }, [draw]);

  useEffect(() => {
    draw();
  }, [draw]);

  const handleMouseDown = (e) => {
    const coords = getCanvasCoordinates(e);
    if (!coords) return;
    
    const nearestIdx = findNearestPoint(coords[0], coords[1]);
    
    if (nearestIdx !== null) {
      setIsDragging(nearestIdx);
      setDragOffset([
        coords[0] - points[nearestIdx][0],
        coords[1] - points[nearestIdx][1]
      ]);
    }
  };

  const handleMouseMove = (e) => {
    if (isDragging === null) return;
    
    const coords = getCanvasCoordinates(e);
    if (!coords) return;
    
    const newPoint = [
      coords[0] - dragOffset[0],
      coords[1] - dragOffset[1]
    ];
    
    // Clamp to bounds (0-10)
    newPoint[0] = Math.max(0, Math.min(LOGICAL_WIDTH, newPoint[0]));
    newPoint[1] = Math.max(0, Math.min(LOGICAL_HEIGHT, newPoint[1]));
    
    onUpdatePoint(isDragging, newPoint);
  };

  const handleMouseUp = () => {
    setIsDragging(null);
  };

  return (
    <div style={{ position: 'relative', width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundColor: '#ffffff', border: '1px solid #e0e0e0' }}>
      <canvas
        ref={canvasRef}
        style={{ cursor: 'default' }}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
      />
      <div style={{ position: 'absolute', bottom: '10px', left: '50%', transform: 'translateX(-50%)', backgroundColor: 'rgba(255, 255, 255, 0.95)', padding: '8px 12px', borderRadius: '2px', fontSize: '13px', color: '#666', border: '1px solid #e0e0e0' }}>
        Drag points to move them
      </div>
    </div>
  );
};

export default LinearRegressionVisualization;

