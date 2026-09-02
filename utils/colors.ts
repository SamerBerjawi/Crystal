export const getColorClasses = (color: string, isActive: boolean = true): string => {
  if (!isActive) return 'text-gray-600 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200';
  return getIconColorClasses(color);
};

export const getIconColorClasses = (color: string): string => {
  switch (color) {
    case 'indigo': return 'text-indigo-600 dark:text-indigo-400';
    case 'emerald': return 'text-emerald-600 dark:text-emerald-400';
    case 'amber': return 'text-amber-600 dark:text-amber-400';
    case 'purple': return 'text-purple-600 dark:text-purple-400';
    case 'cyan': return 'text-cyan-600 dark:text-cyan-400';
    case 'blue': return 'text-blue-600 dark:text-blue-400';
    case 'teal': return 'text-teal-600 dark:text-teal-400 font-semibold';
    case 'orange': return 'text-orange-600 dark:text-orange-400';
    case 'rose': return 'text-rose-600 dark:text-rose-400 font-semibold';
    case 'violet': return 'text-violet-600 dark:text-violet-400';
    case 'slate': return 'text-slate-600 dark:text-slate-400';
    case 'lime': return 'text-lime-600 dark:text-lime-400';
    case 'gray': return 'text-slate-600 dark:text-slate-400';
    case 'sky': return 'text-sky-600 dark:text-sky-400';
    case 'pink': return 'text-pink-600 dark:text-pink-400';
    default: return 'text-indigo-600 dark:text-indigo-400';
  }
};

export const getBgClasses = (color: string): string => {
  switch (color) {
    case 'indigo': return 'bg-indigo-500/10';
    case 'emerald': return 'bg-emerald-500/10';
    case 'amber': return 'bg-amber-500/10';
    case 'purple': return 'bg-purple-500/10';
    case 'cyan': return 'bg-cyan-500/10';
    case 'teal': return 'bg-teal-500/10';
    case 'rose': return 'bg-rose-500/10';
    case 'blue': return 'bg-blue-500/10';
    case 'orange': return 'bg-orange-500/10';
    case 'violet': return 'bg-violet-500/10';
    case 'lime': return 'bg-lime-500/10';
    case 'slate': return 'bg-slate-500/10';
    case 'sky': return 'bg-sky-500/10';
    case 'pink': return 'bg-pink-500/10';
    default: return 'bg-primary-500/10';
  }
};

export const getGlowClasses = (color: string): string => {
  switch (color) {
    case 'indigo': return 'bg-indigo-500/50 shadow-[0_0_30px_rgba(79,70,229,0.7)]';
    case 'emerald': return 'bg-emerald-500/50 shadow-[0_0_30px_rgba(16,185,129,0.7)]';
    case 'amber': return 'bg-amber-500/50 shadow-[0_0_30px_rgba(245,158,11,0.7)]';
    case 'purple': return 'bg-purple-500/50 shadow-[0_0_30px_rgba(168,85,247,0.7)]';
    case 'cyan': return 'bg-cyan-500/50 shadow-[0_0_30px_rgba(6,182,212,0.7)]';
    case 'rose': return 'bg-rose-500/50 shadow-[0_0_30px_rgba(244,63,94,0.7)]';
    default: return 'bg-primary-500/50 shadow-[0_0_30px_rgba(250,154,29,0.7)]';
  }
};
