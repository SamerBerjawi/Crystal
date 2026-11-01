import React from 'react';

interface CardProps {
  children: React.ReactNode;
  className?: string;
  onClick?: () => void;
}

const Card: React.FC<CardProps> = ({ children, className = '', onClick }) => {
  return (
    <div
        className={`relative rounded-[var(--radius-xl)] border border-line bg-surface p-6 max-md:p-5 overflow-hidden ${className}`}
        onClick={onClick}
    >
      {children}
    </div>
  );
};

export default Card;