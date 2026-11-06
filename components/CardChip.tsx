import React, { useId } from 'react';

/** An EMV chip: a gold plate with the contact pads cut into it. */
export const CardChip: React.FC<{ className?: string }> = ({ className }) => {
  const id = useId();
  return (
    <svg viewBox="0 0 44 34" className={className} aria-hidden>
      <defs>
        <linearGradient id={`${id}-gold`} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#F4E2A6" />
          <stop offset=".45" stopColor="#D8B45E" />
          <stop offset="1" stopColor="#A98235" />
        </linearGradient>
      </defs>
      <rect x=".75" y=".75" width="42.5" height="32.5" rx="6.5" fill={`url(#${id}-gold)`} stroke="#8C6A26" strokeOpacity=".55" strokeWidth="1.1" />
      <g fill="none" stroke="#7A5A1E" strokeOpacity=".65" strokeWidth="1" strokeLinecap="round">
        <path d="M.75 12h12.5c2 0 3 1.2 3 3v4c0 1.8-1 3-3 3H.75" />
        <path d="M43.25 12H30.75c-2 0-3 1.2-3 3v4c0 1.8 1 3 3 3h12.5" />
        <path d="M16.25 17h11.5" />
        <path d="M22 .75v9.5M22 23.75v9.5" />
      </g>
      <rect x="16.25" y="10.25" width="11.5" height="13.5" rx="3" fill="#fff" fillOpacity=".16" />
    </svg>
  );
};

/** The contactless symbol: four waves opening to the right. */
export const ContactlessIcon: React.FC<{ className?: string }> = ({ className }) => (
  <svg viewBox="0 0 24 28" className={className} fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" aria-label="Contactless payment" role="img">
    <path d="M4 10.5c1.6 2.2 1.6 4.8 0 7" />
    <path d="M9 7.5c3 3.8 3 9.2 0 13" />
    <path d="M14 4.5c4.4 5.4 4.4 13.6 0 19" />
    <path d="M19 1.5c5.8 7 5.8 18 0 25" />
  </svg>
);
