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
    colorClass = "bg-primary-500/10 text-primary-500",
    className
}) => (
    <BentoCard 
        className={cn("!col-span-1 !p-0 min-h-[110px] sm:min-h-[120px]", className)}
    >
        <div className="flex items-center gap-4 sm:gap-5 w-full">
            <div className={`w-12 h-12 sm:w-14 sm:h-14 rounded-2xl flex items-center justify-center ${colorClass} shrink-0 border border-black/5 dark:border-white/5 shadow-sm group-hover:scale-105 transition-transform duration-300`}>
                <Icon name={icon} className="text-2xl sm:text-3xl" />
            </div>
            <div className="min-w-0 relative z-10 w-full">
                <p className="text-xs font-semibold uppercase tracking-wider text-light-text-secondary dark:text-dark-text-secondary opacity-75 group-hover:opacity-100 transition-opacity truncate">{title}</p>
                <p className="text-xl sm:text-2xl md:text-3xl font-bold text-light-text dark:text-dark-text tracking-tight mt-1 leading-tight group-hover:text-primary-500 transition-colors truncate">{value}</p>
                {subtext && <p className="text-xs text-light-text-secondary dark:text-dark-text-secondary mt-1 font-normal truncate opacity-80 leading-normal">{subtext}</p>}
            </div>
        </div>
    </BentoCard>
);

export default StatCard;
