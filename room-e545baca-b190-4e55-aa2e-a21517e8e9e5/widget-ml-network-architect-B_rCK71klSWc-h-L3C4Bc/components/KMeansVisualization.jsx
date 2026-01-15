import React, { useRef, useEffect, useCallback, useState } from 'react';

const KMeansVisualization = ({ 
  points, 
  centroids, 
  assignments, 
  onUpdatePoint,
  phase,
  hasStartedClustering = false
}) => {
  const canvasRef = useRef(null);
  const [isDragging, setIsDragging] = useState(null);
  const [dragOffset, setDragOffset] = useState([0, 0]);

  const colors = [
    '#36c', '#ff6b6b', '#4ecdc4', '#ffe66d', '#95e1d3',
    '#f38181', '#aa96da', '#fcbad3', '#a8d8ea', '#dcedc1'
  ];

  const LOGICAL_WIDTH = 800;
  const LOGICAL_HEIGHT = 600;

  const getCanvasCoordinates = useCallback((e) => {
    const canvas = canvasRef.current;
    if (!canvas) return null;
    
    const rect = canvas.getBoundingClientRect();
    const scale = Math.min(rect.width / LOGICAL_WIDTH, rect.height / LOGICAL_HEIGHT);
    const offsetX = (rect.width - LOGICAL_WIDTH * scale) / 2;
    const offsetY = (rect.height - LOGICAL_HEIGHT * scale) / 2;
    
    return [
      ((e.clientX - rect.left - offsetX) / scale),
      ((e.clientY - rect.top - offsetY) / scale)
    ];
  }, []);

  const findNearestPoint = useCallback((x, y, threshold = 10) => {
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
    ctx.clearRect(0, 0, LOGICAL_WIDTH, LOGICAL_HEIGHT);
    
    // Draw grid
    ctx.strokeStyle = '#eaecf0';
    ctx.lineWidth = 1;
    const gridSize = 50;
    for (let x = 0; x <= LOGICAL_WIDTH; x += gridSize) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, LOGICAL_HEIGHT);
      ctx.stroke();
    }
    for (let y = 0; y <= LOGICAL_HEIGHT; y += gridSize) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(LOGICAL_WIDTH, y);
      ctx.stroke();
    }
    
    // Draw points
    points.forEach((point, idx) => {
      // Use black/white if clustering hasn't started, otherwise use cluster colors
      const useColors = hasStartedClustering && centroids.length > 0;
      const cluster = assignments[idx] || 0;
      const color = useColors ? colors[cluster % colors.length] : '#54595d';
      
      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.arc(point[0], point[1], 6, 0, Math.PI * 2);
      ctx.fill();
      
      // Draw point border
      ctx.strokeStyle = '#fff';
      ctx.lineWidth = 2;
      ctx.stroke();
    });
    
    // Draw centroids - only show when clustering has started
    if (hasStartedClustering) {
      centroids.forEach((centroid, idx) => {
        const color = colors[idx % colors.length];
        
        // Draw centroid circle
        ctx.fillStyle = color;
        ctx.beginPath();
        ctx.arc(centroid[0], centroid[1], 12, 0, Math.PI * 2);
        ctx.fill();
        
        // Draw centroid border
        ctx.strokeStyle = '#202122';
        ctx.lineWidth = 3;
        ctx.stroke();
        
        // Draw cross marker
        ctx.strokeStyle = '#fff';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(centroid[0] - 6, centroid[1]);
        ctx.lineTo(centroid[0] + 6, centroid[1]);
        ctx.moveTo(centroid[0], centroid[1] - 6);
        ctx.lineTo(centroid[0], centroid[1] + 6);
        ctx.stroke();
      });
    }
    
    // Draw lines from points to centroids (optional, can be toggled)
    if (phase === 'assignment') {
      ctx.strokeStyle = '#a7d7f9';
      ctx.lineWidth = 1;
      ctx.globalAlpha = 0.3;
      
      points.forEach((point, idx) => {
        const cluster = assignments[idx] || 0;
        const centroid = centroids[cluster];
        if (centroid) {
          ctx.beginPath();
          ctx.moveTo(point[0], point[1]);
          ctx.lineTo(centroid[0], centroid[1]);
          ctx.stroke();
        }
      });
      
      ctx.globalAlpha = 1.0;
    }
    
    // Draw axes labels
    const axisPadding = 30;
    ctx.fillStyle = '#666';
    ctx.font = '12px -apple-system, BlinkMacSystemFont, "Segoe UI", "Roboto", "Source Sans Pro", "Inter", "Helvetica Neue", Arial, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('X', LOGICAL_WIDTH / 2, LOGICAL_HEIGHT - 10);
    
    ctx.save();
    ctx.translate(15, LOGICAL_HEIGHT / 2);
    ctx.rotate(-Math.PI / 2);
    ctx.textAlign = 'center';
    ctx.fillText('Y', 0, 0);
    ctx.restore();
  }, [points, centroids, assignments, colors, phase, hasStartedClustering]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    
    const resizeCanvas = () => {
      const container = canvas.parentElement;
      if (container) {
        // Set actual canvas size to logical size
        canvas.width = LOGICAL_WIDTH;
        canvas.height = LOGICAL_HEIGHT;
        
        // Scale CSS to fit container
        const scale = Math.min(
          container.clientWidth / LOGICAL_WIDTH,
          container.clientHeight / LOGICAL_HEIGHT
        );
        canvas.style.width = (LOGICAL_WIDTH * scale) + 'px';
        canvas.style.height = (LOGICAL_HEIGHT * scale) + 'px';
        
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
    
    // Clamp to canvas bounds
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

export default KMeansVisualization;

