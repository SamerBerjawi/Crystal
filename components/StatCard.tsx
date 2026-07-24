import React from 'react';

interface StatCardProps {
  title: string;
  value: string | number;
  subtext?: string;
  icon: string;
  colorClass?: string;
}

const StatCard: React.FC<StatCardProps> = ({ 
    title, 
    value, 
    subtext, 
    icon, 
    colorClass = "bg-primary-500/10 text-primary-500" 
}) => (
    <div className="p-5 md:p-6 rounded-[2rem] bg-white dark:bg-dark-card border border-black/5 dark:border-white/5 shadow-sm flex items-center gap-5 hover:shadow-xl hover:-translate-y-1 transition-all duration-500 relative overflow-hidden group h-full">
        <div className="absolute inset-0 bg-gradient-to-br from-primary-500/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none" />
        <div className={`w-14 h-14 rounded-2xl flex items-center justify-center ${colorClass} shrink-0 border border-black/5 dark:border-white/5 shadow-sm group-hover:scale-110 transition-transform`}>
            <span className="material-symbols-outlined text-3xl">{icon}</span>
        </div>
        <div className="min-w-0 relative z-10 w-full">
            <p className="text-[10px] font-black tracking-widest text-light-text-secondary dark:text-dark-text-secondary  opacity-60 group-hover:opacity-100 transition-opacity">{title}</p>
            <p className="text-2xl md:text-3xl font-black text-light-text dark:text-dark-text tracking-tighter mt-1 leading-none group-hover:text-primary-500 transition-colors">{value}</p>
            {subtext && <p className="text-[10px] text-light-text-secondary dark:text-dark-text-secondary mt-1.5 font-bold truncate opacity-60  tracking-tight">{subtext}</p>}
        </div>
    </div>
);

export default StatCard;
