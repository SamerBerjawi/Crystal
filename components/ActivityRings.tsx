import React from 'react';

interface ActivityRingsProps {
  movePercent?: number;     // e.g. 0.85 = 85%
  exercisePercent?: number; // e.g. 0.50 = 50%
  standPercent?: number;    // e.g. 0.90 = 90%
  size?: number;           // default 114
  className?: string;
  ring1Colors?: [string, string]; // default: [#FF2D55, #FF6B8B]
  ring2Colors?: [string, string]; // default: [#A3F900, #30D158]
  ring3Colors?: [string, string]; // default: [#04C7DD, #007AFF]
}

export const ActivityRings: React.FC<ActivityRingsProps> = ({
  movePercent = 0.75,
  exercisePercent = 0.50,
  standPercent = 0.90,
  size = 114,
  className = '',
  ring1Colors = ['#FF2D55', '#FF6B8B'],
  ring2Colors = ['#A3F900', '#30D158'],
  ring3Colors = ['#04C7DD', '#007AFF'],
}) => {
  const center = size / 2;
  const strokeWidth = Math.max(4, Math.round(size * 0.083));

  const rMove = Math.round(size * 0.41);
  const rExercise = Math.round(size * 0.31);
  const rStand = Math.round(size * 0.20);

  const circMove = 2 * Math.PI * rMove;
  const circExercise = 2 * Math.PI * rExercise;
  const circStand = 2 * Math.PI * rStand;

  const offsetMove = circMove * (1 - Math.min(1, Math.max(0, movePercent)));
  const offsetExercise = circExercise * (1 - Math.min(1, Math.max(0, exercisePercent)));
  const offsetStand = circStand * (1 - Math.min(1, Math.max(0, standPercent)));

  const uniqueId = React.useId().replace(/:/g, '');

  return (
    <div className={`relative flex items-center justify-center shrink-0 ${className}`}>
      <svg
        width={size}
        height={size}
        className="transform -rotate-90 filter drop-shadow-[0_0_12px_rgba(250,154,29,0.2)]"
      >
        <defs>
          <linearGradient id={`moveGrad-${uniqueId}`} x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor={ring1Colors[0]} />
            <stop offset="100%" stopColor={ring1Colors[1]} />
          </linearGradient>
          <linearGradient id={`exerciseGrad-${uniqueId}`} x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor={ring2Colors[0]} />
            <stop offset="100%" stopColor={ring2Colors[1]} />
          </linearGradient>
          <linearGradient id={`standGrad-${uniqueId}`} x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor={ring3Colors[0]} />
            <stop offset="100%" stopColor={ring3Colors[1]} />
          </linearGradient>
        </defs>

        {/* Background Tracks */}
        <circle cx={center} cy={center} r={rMove} fill="none" stroke={`${ring1Colors[0]}22`} strokeWidth={strokeWidth} />
        <circle cx={center} cy={center} r={rExercise} fill="none" stroke={`${ring2Colors[0]}22`} strokeWidth={strokeWidth} />
        <circle cx={center} cy={center} r={rStand} fill="none" stroke={`${ring3Colors[0]}22`} strokeWidth={strokeWidth} />

        {/* Active Animated Rings */}
        <circle
          cx={center}
          cy={center}
          r={rMove}
          fill="none"
          stroke={`url(#moveGrad-${uniqueId})`}
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          strokeDasharray={circMove}
          strokeDashoffset={offsetMove}
          className="transition-all duration-700 ease-out"
        />
        <circle
          cx={center}
          cy={center}
          r={rExercise}
          fill="none"
          stroke={`url(#exerciseGrad-${uniqueId})`}
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          strokeDasharray={circExercise}
          strokeDashoffset={offsetExercise}
          className="transition-all duration-700 ease-out"
        />
        <circle
          cx={center}
          cy={center}
          r={rStand}
          fill="none"
          stroke={`url(#standGrad-${uniqueId})`}
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          strokeDasharray={circStand}
          strokeDashoffset={offsetStand}
          className="transition-all duration-700 ease-out"
        />
      </svg>
    </div>
  );
};

export default ActivityRings;
