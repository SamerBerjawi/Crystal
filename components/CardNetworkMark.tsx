import React from 'react';

/** The mark of a card network, drawn in SVG so it needs no download. Anything unknown falls back to its name. */
const CardNetworkMark: React.FC<{ network?: string; className?: string }> = ({ network, className }) => {
  const name = (network || '').toLowerCase();
  const common = { className, role: 'img' as const, 'aria-label': network, preserveAspectRatio: 'xMaxYMid meet' as const };

  if (name.includes('mastercard') || name === 'mc') {
    return (
      <svg viewBox="0 0 48 30" {...common}>
        <circle cx="17" cy="15" r="13" fill="#EB001B" />
        <circle cx="31" cy="15" r="13" fill="#F79E1B" />
        <path d="M24 4.6a13 13 0 0 1 0 20.8 13 13 0 0 1 0-20.8Z" fill="#FF5F00" />
      </svg>
    );
  }
  if (name.includes('visa')) {
    return (
      <svg viewBox="0 0 60 24" {...common}>
        <text x="60" y="20" textAnchor="end" fontFamily="Arial, Helvetica, sans-serif" fontWeight="900" fontStyle="italic" fontSize="24" letterSpacing="-1" fill="#fff" stroke="#1A1F71" strokeWidth="0.6" paintOrder="stroke">VISA</text>
      </svg>
    );
  }
  if (name.includes('american') || name.includes('amex')) {
    return (
      <svg viewBox="0 0 40 28" {...common}>
        <rect width="40" height="28" rx="4" fill="#2E77BC" />
        <text x="20" y="18" textAnchor="middle" fontFamily="Arial, Helvetica, sans-serif" fontWeight="800" fontSize="9.5" fill="#fff">AMEX</text>
      </svg>
    );
  }
  if (name.includes('discover')) {
    return (
      <svg viewBox="0 0 64 22" {...common}>
        <text x="0" y="16" fontFamily="Arial, Helvetica, sans-serif" fontWeight="700" fontSize="12" fill="#fff">DISCOVER</text>
        <circle cx="58" cy="11" r="5" fill="#F58220" />
      </svg>
    );
  }
  if (name.includes('unionpay')) {
    return (
      <svg viewBox="0 0 44 28" {...common}>
        <path d="M8 1h12L12 27H0Z" fill="#E21836" />
        <path d="M18 1h14L24 27H10Z" fill="#00447C" />
        <path d="M30 1h12L34 27H22Z" fill="#007B84" />
      </svg>
    );
  }
  if (name.includes('jcb')) {
    return (
      <svg viewBox="0 0 44 28" {...common}>
        <rect x="1" y="1" width="12" height="26" rx="4" fill="#0E4C96" />
        <rect x="16" y="1" width="12" height="26" rx="4" fill="#BC1F2C" />
        <rect x="31" y="1" width="12" height="26" rx="4" fill="#2E8B3E" />
      </svg>
    );
  }
  return network ? <span className={className} style={{ fontWeight: 700 }}>{network}</span> : null;
};

export default CardNetworkMark;
