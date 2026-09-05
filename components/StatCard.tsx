/**
 * StatCard — DEPRECATED
 *
 * This component is a backwards-compatible alias for HeroMetricCard.
 * All new code should import HeroMetricCard from './ui/HeroMetricCard' directly.
 *
 * Migration guide:
 *   Old:  <StatCard title="..." value={...} icon="..." colorClass="text-blue-600" subtext="..." />
 *   New:  <HeroMetricCard label="..." value={...} icon="..." iconColor="blue" subtext="..." />
 */
import React from 'react';
import HeroMetricCard from './ui/HeroMetricCard';

// Maps old colorClass strings (e.g. "text-blue-600 dark:text-blue-400") to iconColor keys
function inferIconColor(colorClass: string = ''): string {
  if (colorClass.includes('blue'))    return 'blue';
  if (colorClass.includes('emerald')) return 'emerald';
  if (colorClass.includes('green'))   return 'emerald';
  if (colorClass.includes('red'))     return 'rose';
  if (colorClass.includes('rose'))    return 'rose';
  if (colorClass.includes('amber'))   return 'amber';
  if (colorClass.includes('yellow'))  return 'amber';
  if (colorClass.includes('orange'))  return 'orange';
  if (colorClass.includes('indigo'))  return 'indigo';
  if (colorClass.includes('purple'))  return 'purple';
  if (colorClass.includes('pink'))    return 'pink';
  if (colorClass.includes('cyan'))    return 'cyan';
  if (colorClass.includes('teal'))    return 'teal';
  if (colorClass.includes('primary')) return 'primary';
  return 'primary';
}

interface StatCardProps {
  title: string;
  value: string | number;
  subtext?: string;
  icon: string;
  colorClass?: string;
  className?: string;
}

/** @deprecated Use HeroMetricCard instead */
const StatCard: React.FC<StatCardProps> = ({
  title,
  value,
  subtext,
  icon,
  colorClass = 'text-primary-500',
  className,
}) => (
  <HeroMetricCard
    label={title}
    value={value}
    icon={icon}
    iconColor={inferIconColor(colorClass) as any}
    subtext={subtext}
    className={className}
  />
);

export default StatCard;
