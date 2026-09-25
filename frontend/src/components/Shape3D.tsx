import React, { useState, useRef, useEffect } from 'react';

// Card3D: Wraps any content in an interactive 3D perspective tilt container with dynamic specular highlight
export interface Card3DProps {
  children: React.ReactNode;
  className?: string;
  style?: React.CSSProperties;
  onClick?: () => void;
  maxTilt?: number; // max tilt angle in degrees
  glare?: boolean;
}

export const Card3D: React.FC<Card3DProps> = ({
  children,
  className = '',
  style = {},
  onClick,
  maxTilt = 12,
  glare = true
}) => {
  const cardRef = useRef<HTMLDivElement>(null);
  const [transform, setTransform] = useState('perspective(1000px) rotateX(0deg) rotateY(0deg) translateZ(0px)');
  const [glarePos, setGlarePos] = useState({ x: 50, y: 50, opacity: 0 });

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!cardRef.current) return;
    const rect = cardRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    const centerX = rect.width / 2;
    const centerY = rect.height / 2;

    const rotateX = ((y - centerY) / centerY) * -maxTilt;
    const rotateY = ((x - centerX) / centerX) * maxTilt;

    setTransform(`perspective(1000px) rotateX(${rotateX.toFixed(2)}deg) rotateY(${rotateY.toFixed(2)}deg) translateZ(12px)`);
    setGlarePos({
      x: (x / rect.width) * 100,
      y: (y / rect.height) * 100,
      opacity: 0.15
    });
  };

  const handleMouseLeave = () => {
    setTransform('perspective(1000px) rotateX(0deg) rotateY(0deg) translateZ(0px)');
    setGlarePos((prev) => ({ ...prev, opacity: 0 }));
  };

  return (
    <div
      ref={cardRef}
      onClick={onClick}
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
      className={`relative transition-transform duration-200 ease-out preserve-3d cursor-pointer ${className}`}
      style={{
        transformStyle: 'preserve-3d',
        transform,
        ...style
      }}
    >
      {glare && (
        <div
          className="pointer-events-none absolute inset-0 rounded-[inherit] transition-opacity duration-300 z-20"
          style={{
            background: `radial-gradient(circle at ${glarePos.x}% ${glarePos.y}%, rgba(255,255,255,0.4) 0%, rgba(255,255,255,0) 70%)`,
            opacity: glarePos.opacity
          }}
        />
      )}
      {children}
    </div>
  );
};

// Pure CSS/SVG 3D Polyhedron / Cube / Pyramid shape rendering
export interface Shape3DProps {
  type?: 'cube' | 'pyramid' | 'octahedron' | 'ring' | 'gem';
  size?: number; // size in px
  color?: string; // primary accent color
  glowColor?: string;
  speed?: number; // rotation speed multiplier
  className?: string;
}

export const Shape3D: React.FC<Shape3DProps> = ({
  type = 'cube',
  size = 80,
  color = '#00F5A0',
  glowColor = 'rgba(0,245,160,0.3)',
  speed = 1,
  className = ''
}) => {
  const half = size / 2;

  if (type === 'pyramid') {
    return (
      <div
        className={`relative preserve-3d animate-spin-3d ${className}`}
        style={{
          width: size,
          height: size,
          transformStyle: 'preserve-3d',
          animationDuration: `${12 / speed}s`
        }}
      >
        <svg width={size} height={size} viewBox="0 0 100 100" className="drop-shadow-2xl overflow-visible">
          <defs>
            <linearGradient id={`grad-p1-${size}`} x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor={color} stopOpacity="0.8" />
              <stop offset="100%" stopColor="#7B2CBF" stopOpacity="0.3" />
            </linearGradient>
            <linearGradient id={`grad-p2-${size}`} x1="100%" y1="0%" x2="0%" y2="100%">
              <stop offset="0%" stopColor="#00F0FF" stopOpacity="0.9" />
              <stop offset="100%" stopColor={color} stopOpacity="0.4" />
            </linearGradient>
            <filter id={`glow-${size}`}>
              <feDropShadow dx="0" dy="0" stdDeviation="6" floodColor={color} floodOpacity="0.5" />
            </filter>
          </defs>
          <polygon points="50,10 15,80 50,88" fill={`url(#grad-p1-${size})`} stroke={color} strokeWidth="1.5" />
          <polygon points="50,10 50,88 85,80" fill={`url(#grad-p2-${size})`} stroke="#00F0FF" strokeWidth="1.5" />
          <line x1="50" y1="10" x2="50" y2="88" stroke="#ffffff" strokeWidth="1" strokeOpacity="0.6" />
        </svg>
      </div>
    );
  }

  if (type === 'octahedron' || type === 'gem') {
    return (
      <div
        className={`relative preserve-3d animate-float ${className}`}
        style={{
          width: size,
          height: size,
          filter: `drop-shadow(0 0 16px ${glowColor})`
        }}
      >
        <svg width={size} height={size} viewBox="0 0 100 100" className="overflow-visible">
          <defs>
            <linearGradient id={`gem-g1-${size}`} x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor={color} stopOpacity="0.85" />
              <stop offset="50%" stopColor="#00F0FF" stopOpacity="0.6" />
              <stop offset="100%" stopColor="#7B2CBF" stopOpacity="0.2" />
            </linearGradient>
            <linearGradient id={`gem-g2-${size}`} x1="100%" y1="0%" x2="0%" y2="100%">
              <stop offset="0%" stopColor="#ffffff" stopOpacity="0.7" />
              <stop offset="100%" stopColor={color} stopOpacity="0.2" />
            </linearGradient>
          </defs>
          {/* Top Diamond Facets */}
          <polygon points="50,5 20,40 50,50" fill={`url(#gem-g1-${size})`} stroke={color} strokeWidth="1" />
          <polygon points="50,5 50,50 80,40" fill={`url(#gem-g2-${size})`} stroke="#00F0FF" strokeWidth="1" />
          {/* Bottom Facets */}
          <polygon points="20,40 50,95 50,50" fill={`url(#gem-g2-${size})`} stroke={color} strokeWidth="1" />
          <polygon points="80,40 50,95 50,50" fill={`url(#gem-g1-${size})`} stroke="#7B2CBF" strokeWidth="1" />
          {/* Inner Light Core */}
          <circle cx="50" cy="48" r="8" fill="#ffffff" opacity="0.8" className="animate-pulse" />
        </svg>
      </div>
    );
  }

  if (type === 'ring') {
    return (
      <div
        className={`relative preserve-3d animate-float ${className}`}
        style={{
          width: size,
          height: size,
          filter: `drop-shadow(0 0 20px ${glowColor})`
        }}
      >
        <svg width={size} height={size} viewBox="0 0 100 100" className="overflow-visible">
          <defs>
            <linearGradient id={`ring-g-${size}`} x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor={color} />
              <stop offset="50%" stopColor="#00F0FF" />
              <stop offset="100%" stopColor="#7B2CBF" />
            </linearGradient>
          </defs>
          <ellipse cx="50" cy="50" rx="40" ry="18" fill="none" stroke={`url(#ring-g-${size})`} strokeWidth="6" transform="rotate(-25 50 50)" />
          <ellipse cx="50" cy="50" rx="26" ry="10" fill="none" stroke="#ffffff" strokeWidth="1.5" strokeDasharray="4 2" opacity="0.7" transform="rotate(-25 50 50)" />
        </svg>
      </div>
    );
  }

  // Default: 3D Cube with Glass Faces and Glowing Wireframe
  return (
    <div
      className={`relative preserve-3d ${className}`}
      style={{
        width: size,
        height: size,
        transformStyle: 'preserve-3d',
        transform: 'rotateX(-20deg) rotateY(25deg)'
      }}
    >
      <div
        className="absolute inset-0 border border-white/20 rounded-lg backdrop-blur-md transition-all duration-300"
        style={{
          transform: `translateZ(${half}px)`,
          background: `linear-gradient(135deg, ${color}33, rgba(255,255,255,0.05))`,
          boxShadow: `inset 0 0 15px ${glowColor}, 0 0 20px ${glowColor}`
        }}
      />
      <div
        className="absolute inset-0 border border-white/20 rounded-lg backdrop-blur-md"
        style={{
          transform: `rotateY(180deg) translateZ(${half}px)`,
          background: `linear-gradient(135deg, #7B2CBF33, rgba(255,255,255,0.05))`
        }}
      />
      <div
        className="absolute inset-0 border border-white/20 rounded-lg backdrop-blur-md"
        style={{
          transform: `rotateY(-90deg) translateZ(${half}px)`,
          background: `linear-gradient(135deg, #00F0FF33, rgba(255,255,255,0.05))`
        }}
      />
      <div
        className="absolute inset-0 border border-white/20 rounded-lg backdrop-blur-md"
        style={{
          transform: `rotateY(90deg) translateZ(${half}px)`,
          background: `linear-gradient(135deg, ${color}22, rgba(255,255,255,0.05))`
        }}
      />
      <div
        className="absolute inset-0 border border-white/20 rounded-lg backdrop-blur-md"
        style={{
          transform: `rotateX(90deg) translateZ(${half}px)`,
          background: `linear-gradient(135deg, rgba(255,255,255,0.15), rgba(0,0,0,0.2))`
        }}
      />
      <div
        className="absolute inset-0 border border-white/20 rounded-lg backdrop-blur-md"
        style={{
          transform: `rotateX(-90deg) translateZ(${half}px)`,
          background: `linear-gradient(135deg, rgba(0,0,0,0.4), ${color}22)`
        }}
      />
    </div>
  );
};

// Cluster of floating interactive 3D shapes for backgrounds or hero headers
export const Floating3DScene: React.FC<{ count?: number; className?: string }> = ({ count = 5, className = '' }) => {
  return (
    <div className={`pointer-events-none absolute inset-0 overflow-hidden ${className}`}>
      <div className="absolute top-10 left-[10%] animate-float" style={{ animationDuration: '7s' }}>
        <Shape3D type="cube" size={60} color="#00F5A0" />
      </div>
      <div className="absolute top-1/4 right-[12%] animate-float" style={{ animationDuration: '9s', animationDelay: '1s' }}>
        <Shape3D type="gem" size={70} color="#00F0FF" />
      </div>
      <div className="absolute bottom-12 left-[15%] animate-float" style={{ animationDuration: '8s', animationDelay: '2s' }}>
        <Shape3D type="ring" size={80} color="#7B2CBF" />
      </div>
      <div className="absolute bottom-1/3 right-[18%] animate-float" style={{ animationDuration: '10s', animationDelay: '0.5s' }}>
        <Shape3D type="pyramid" size={65} color="#FF3366" />
      </div>
      <div className="absolute top-1/2 left-[48%] animate-float" style={{ animationDuration: '11s', animationDelay: '3s' }}>
        <Shape3D type="octahedron" size={50} color="#00F5A0" />
      </div>
    </div>
  );
};
