import React, { useEffect, useState } from 'react';

export default function ConnectionLines({ positions, hoveredBox, containerRef }) {
  const [dimensions, setDimensions] = useState({ width: 1000, height: 800 });

  useEffect(() => {
    const updateDimensions = () => {
      if (containerRef.current) {
        setDimensions({
          width: containerRef.current.offsetWidth,
          height: containerRef.current.offsetHeight,
        });
      }
    };

    updateDimensions();
    window.addEventListener('resize', updateDimensions);
    return () => window.removeEventListener('resize', updateDimensions);
  }, [containerRef]);

  // Find center position
  const centerPos = positions.find(p => p.type === 'center');
  if (!centerPos) return null;

  const centerX = (centerPos.x / 100) * dimensions.width;
  const centerY = (centerPos.y / 100) * dimensions.height;

  // Create connections from center to genre boxes, and from genre boxes to random boxes
  const connections = [];

  // Center to genre boxes
  positions.filter(p => p.type === 'genre').forEach(genre => {
    const x = (genre.x / 100) * dimensions.width;
    const y = (genre.y / 100) * dimensions.height;
    connections.push({
      from: { x: centerX, y: centerY },
      to: { x, y },
      type: 'inner',
      color: genre.color,
      id: genre.id,
    });

    // Genre to nearest random boxes
    const nearestRandom = positions
      .filter(p => p.type === 'random')
      .map(random => {
        const rx = (random.x / 100) * dimensions.width;
        const ry = (random.y / 100) * dimensions.height;
        const distance = Math.sqrt(Math.pow(rx - x, 2) + Math.pow(ry - y, 2));
        return { ...random, distance, x: rx, y: ry };
      })
      .sort((a, b) => a.distance - b.distance)
      .slice(0, 2);

    nearestRandom.forEach(random => {
      connections.push({
        from: { x, y },
        to: { x: random.x, y: random.y },
        type: 'outer',
        color: genre.color,
        id: `${genre.id}-${random.id}`,
        genreId: genre.id,
        randomId: random.id,
      });
    });
  });

  return (
    <svg 
      className="absolute inset-0 pointer-events-none"
      style={{ zIndex: 1 }}
      width={dimensions.width}
      height={dimensions.height}
    >
      <defs>
        {/* Neon glow filters for each color */}
        <filter id="neonGlow" x="-50%" y="-50%" width="200%" height="200%">
          <feGaussianBlur stdDeviation="2" result="coloredBlur" />
          <feMerge>
            <feMergeNode in="coloredBlur" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
      </defs>

      {connections.map((conn, index) => {
        const isHovered = 
          hoveredBox === conn.id || 
          hoveredBox === conn.genreId || 
          hoveredBox === conn.randomId;

        return (
          <g key={index}>
            {/* Base dim line */}
            <line
              x1={conn.from.x}
              y1={conn.from.y}
              x2={conn.to.x}
              y2={conn.to.y}
              stroke="#1a1a3a"
              strokeWidth={isHovered ? 3 : 1}
              opacity={0.6}
            />
            
            {/* Neon overlay line */}
            <line
              x1={conn.from.x}
              y1={conn.from.y}
              x2={conn.to.x}
              y2={conn.to.y}
              stroke={conn.color}
              strokeWidth={isHovered ? 2 : 1}
              opacity={isHovered ? 0.8 : conn.type === 'inner' ? 0.25 : 0.12}
              className="transition-all duration-200"
              style={{
                filter: isHovered ? 'url(#neonGlow)' : 'none',
              }}
            />

            {/* Animated dashes on hover */}
            {isHovered && (
              <line
                x1={conn.from.x}
                y1={conn.from.y}
                x2={conn.to.x}
                y2={conn.to.y}
                stroke={conn.color}
                strokeWidth={1}
                strokeDasharray="5 5"
                opacity={0.5}
              >
                <animate
                  attributeName="stroke-dashoffset"
                  from="0"
                  to="10"
                  dur="0.5s"
                  repeatCount="indefinite"
                />
              </line>
            )}

            {/* Glowing endpoint dots */}
            {isHovered && conn.type === 'inner' && (
              <circle
                cx={conn.to.x}
                cy={conn.to.y}
                r="4"
                fill={conn.color}
                opacity="0.8"
                style={{
                  filter: 'url(#neonGlow)',
                }}
              />
            )}
          </g>
        );
      })}
    </svg>
  );
}
