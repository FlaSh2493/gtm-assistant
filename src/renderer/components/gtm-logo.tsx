import React from 'react';

interface GtmLogoProps {
  size?: number;
  className?: string;
}

const GtmLogo: React.FC<GtmLogoProps> = ({ size = 24, className }) => {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 40 40"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
    >
      <defs>
        <linearGradient id="gtmGradient" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#4285F4" />
          <stop offset="100%" stopColor="#2A59A8" />
        </linearGradient>
      </defs>
      <path
        d="M8 12C8 9.79086 9.79086 8 12 8H28C30.2091 8 32 9.79086 32 12V32H8V12Z"
        fill="url(#gtmGradient)"
      />
      <circle cx="20" cy="16" r="3" fill="white" />
      <path
        d="M8 32L12 28H28L32 32H8Z"
        fill="rgba(0,0,0,0.1)"
      />
    </svg>
  );
};

export default GtmLogo;
