import React from 'react';
import Icon from './ui/Icon';
import { BentoCard } from './ui/bento-grid';
import { cn } from '../lib/utils';

interface StatCardProps {
  title: string;
  value: string | number;
  subtext?: string;
  icon: string;
  colorClass?: string;
  className?: string;
}

const StatCard: React.FC<StatCardProps> = ({ 
    title, 
    value, 
    subtext, 
    icon, 
    colorClass = "text-primary-500",
    className
}) => {
    // Strip bg, border, shadow, and text-white classes so bare icon gets semantic or fallback text color
    const cleaned = colorClass
        .replace(/\b(bg|border|shadow)-[^\s]+/g, '')
        .replace(/\btext-white\b/g, '')
        .trim();
    const textColor = cleaned || 'text-primary-500';

    return (
        <BentoCard 
            className={cn("!col-span-1 !p-0 min-h-[110px] sm:min-h-[120px]", className)}
        >
            <div className="flex items-center gap-4 sm:gap-5 w-full">
                <Icon 
                    name={icon} 
                    className={cn("text-3xl sm:text-4xl shrink-0 transition-transform duration-300 group-hover:scale-110", textColor)} 
                />
                <div className="min-w-0 relative z-10 w-full">
                    <p className="text-xs font-bold uppercase tracking-wider text-light-text-secondary dark:text-dark-text-secondary opacity-75 group-hover:opacity-100 transition-opacity truncate">{title}</p>
                    <p className="text-xl sm:text-2xl md:text-3xl font-black font-mono text-light-text dark:text-dark-text tracking-tight mt-1 leading-tight group-hover:text-primary-500 transition-colors truncate">{value}</p>
                    {subtext && <p className="text-xs text-light-text-secondary dark:text-dark-text-secondary mt-1 font-normal truncate opacity-80 leading-normal">{subtext}</p>}
                </div>
            </div>
        </BentoCard>
    );
};

export default StatCard;
