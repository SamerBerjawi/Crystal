
import React from 'react';
import Card from './Card';

interface WidgetWrapperProps {
  children: React.ReactNode;
  title: string;
  subtitle?: string;
  icon?: string;
  onRemove: () => void;
  isEditMode: boolean;
  className?: string;
  style?: React.CSSProperties;
  onMouseDown?: React.MouseEventHandler;
  onMouseUp?: React.MouseEventHandler;
  onTouchEnd?: React.TouchEventHandler;
  isCompact?: boolean;
}

const WidgetWrapper: React.FC<WidgetWrapperProps> = ({ 
    children, 
    title, 
    subtitle,
    icon,
    onRemove, 
    isEditMode,
    className,
    style,
    onMouseDown,
    onMouseUp,
    onTouchEnd,
    isCompact = false
}) => {
  return (
    <div 
        className={className}
        style={style}
        onMouseDown={onMouseDown}
        onMouseUp={onMouseUp}
        onTouchEnd={onTouchEnd}
    >
      <Card className={`flex flex-col h-full transition-all duration-200 ${isCompact ? '!p-4' : '!p-5'} ${isEditMode ? 'border-dashed border-primary-500/50' : ''}`}>
        <header className={`flex items-start justify-between ${isCompact ? 'mb-2.5 -mt-1' : 'mb-5 -mt-1'} drag-handle ${isEditMode ? 'cursor-move' : ''}`}>
          <div className="flex items-center gap-3 overflow-hidden">
            {icon && (
               <div className={`${isCompact ? 'w-8 h-8 rounded-lg' : 'w-10 h-10 rounded-xl'} bg-primary-100 dark:bg-primary-900/30 text-primary-600 dark:text-primary-400 flex items-center justify-center shrink-0`}>
                  <span className={`material-symbols-outlined ${isCompact ? 'text-lg' : 'text-xl'}`}>{icon}</span>
               </div>
            )}
            <div className="overflow-hidden">
              <h3 className={`${isCompact ? 'text-[13px]' : 'text-lg'} font-bold text-light-text dark:text-dark-text truncate leading-tight`}>{title}</h3>
              {subtitle && (
                <p className={`${isCompact ? 'text-[10px]' : 'text-xs'} text-light-text-secondary dark:text-dark-text-secondary truncate mt-0.5 font-medium opacity-80 uppercase tracking-widest`}>{subtitle}</p>
              )}
            </div>
          </div>
          {isEditMode && (
            <button 
              onMouseDown={(e) => e.stopPropagation()} // Prevent drag when clicking remove
              onClick={(e) => { e.stopPropagation(); onRemove(); }} 
              className="text-light-text-secondary dark:text-dark-text-secondary p-1.5 rounded-full hover:bg-black/5 dark:hover:bg-white/5 transition-colors cursor-pointer shrink-0" 
              title="Remove widget"
            >
              <span className="material-symbols-outlined text-base">close</span>
            </button>
          )}
        </header>
        <div className="flex-grow min-h-0 overflow-hidden">
          {children}
        </div>
      </Card>
    </div>
  );
};

export default WidgetWrapper;
