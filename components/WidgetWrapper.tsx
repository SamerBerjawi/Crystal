
import React from 'react';
import Card from './Card';
import Icon from './ui/Icon';

interface WidgetWrapperProps {
  children: React.ReactNode;
  title: string;
  subtitle?: string;
  icon?: string;
  onRemove: () => void;
  onWidthChange?: (width: number) => void;
  currentWidth?: number;
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
    onWidthChange,
    currentWidth,
    isEditMode,
    className,
    style,
    onMouseDown,
    onMouseUp,
    onTouchEnd,
    isCompact = false
}) => {
  const widthOptions = [
    { label: '1/4', value: 3 },
    { label: '1/3', value: 4 },
    { label: '1/2', value: 6 },
    { label: '2/3', value: 8 },
    { label: '3/4', value: 9 },
    { label: 'Full', value: 12 },
  ];

  return (
    <div 
        className={`${className} relative z-[-1]`}
        style={style}
        onMouseDown={onMouseDown}
        onMouseUp={onMouseUp}
        onTouchEnd={onTouchEnd}
    >
      <Card className={`flex flex-col h-full transition-all duration-200 !rounded-[2rem] ${isCompact ? '!p-3.5' : '!p-5'} ${isEditMode ? 'border-dashed border-primary-500/50 ring-2 ring-primary-500/20' : ''}`}>
        <header className={`flex items-center justify-between gap-3 ${isCompact ? 'mb-2.5' : 'mb-4'} drag-handle ${isEditMode ? 'cursor-move' : ''}`}>
          <div className="flex items-center gap-2.5 min-w-0 overflow-hidden">
            {icon && (
               <div className={`${isCompact ? 'w-8 h-8 rounded-lg' : 'w-9 h-9 rounded-xl'} bg-primary-500/10 text-primary-600 dark:text-primary-400 flex items-center justify-center shrink-0 border border-primary-500/15`}>
                  <Icon name={icon} className={isCompact ? 'text-base' : 'text-lg'} />
               </div>
            )}
            <div className="min-w-0 overflow-hidden">
              <h2 className={`${isCompact ? 'text-xs' : 'text-base'} font-semibold text-slate-900 dark:text-slate-100 tracking-tight truncate leading-tight`}>{title}</h2>
              {subtitle && (
                <p className="text-xs font-normal text-slate-500 dark:text-slate-400 mt-0.5 truncate leading-tight">{subtitle}</p>
              )}
            </div>
          </div>
          
          <div className="flex items-center gap-1 shrink-0" onMouseDown={(e) => e.stopPropagation()}>
            {isEditMode && onWidthChange && (
              <div className="flex items-center bg-black/5 dark:bg-white/5 rounded-lg p-0.5 mr-1">
                <select 
                  value={currentWidth} 
                  onChange={(e) => onWidthChange(Number(e.target.value))}
                  className="bg-transparent text-xs font-semibold px-1 outline-none cursor-pointer text-slate-600 dark:text-slate-400"
                >
                  {widthOptions.map(opt => (
                    <option key={opt.value} value={opt.value} className="bg-white dark:bg-gray-800 text-light-text dark:text-dark-text">{opt.label}</option>
                  ))}
                </select>
              </div>
            )}
            {isEditMode && (
              <button 
                onClick={(e) => { e.stopPropagation(); onRemove(); }} 
                className="text-slate-400 hover:text-rose-500 p-1.5 rounded-full hover:bg-rose-500/10 transition-colors cursor-pointer shrink-0" 
                title="Remove widget"
                aria-label="Remove widget"
              >
                <Icon name="delete" className="text-base" />
              </button>
            )}
          </div>
        </header>
        <div className="flex-grow min-h-0 overflow-hidden">
          {children}
        </div>
      </Card>
    </div>
  );
};

export default WidgetWrapper;
