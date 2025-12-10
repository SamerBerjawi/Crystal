import React from 'react';

interface CardProps {
  children: React.ReactNode;
  className?: string;
  onClick?: () => void;
}

const Card: React.FC<CardProps> = ({ children, className = '', onClick }) => {
  return (
    <div 
        className={`relative bg-light-card dark:bg-dark-card rounded-xl shadow-card p-6 overflow-hidden group 
                    before:absolute before:inset-0 before:bg-gradient-to-r before:from-transparent before:via-black/5 before:dark:via-white/5 before:to-transparent
                    before:bg-200% before:opacity-0 group-hover:before:opacity-100 group-hover:before:animate-bg-pan 
                    before:transition-opacity before:duration-500 before:pointer-events-none ${className}`} 
        onClick={onClick}
    >
      {children}
    </div>
  );
};

export default Card;