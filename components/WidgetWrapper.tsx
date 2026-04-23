
import React from 'react';
import Card from './Card';

interface WidgetWrapperProps {
  children: React.ReactNode;
  title: string;
  onRemove: () => void;
  isEditMode: boolean;
  className?: string;
  style?: React.CSSProperties;
  onMouseDown?: React.MouseEventHandler;
  onMouseUp?: React.MouseEventHandler;
  onTouchEnd?: React.TouchEventHandler;
  hideHeader?: boolean;
}

const WidgetWrapper: React.FC<WidgetWrapperProps> = ({ 
    children, 
    title, 
    onRemove, 
    isEditMode,
    className,
    style,
    onMouseDown,
    onMouseUp,
    onTouchEnd,
    hideHeader = false
}) => {
  return (
    <div 
        className={`${className} group/widget`}
        style={style}
        onMouseDown={onMouseDown}
        onMouseUp={onMouseUp}
        onTouchEnd={onTouchEnd}
    >
      <div className={`flex flex-col h-full transition-all duration-500 ${
        hideHeader 
        ? '' 
        : `bg-white/40 dark:bg-dark-card/20 backdrop-blur-xl border rounded-[2rem] ${
            isEditMode 
            ? 'border-primary-500/50 shadow-[0_0_20px_rgba(59,130,246,0.2)] scale-[0.98]' 
            : 'border-black/5 dark:border-white/5 shadow-2xl shadow-black/5'
          }`
      }`}>
        {!hideHeader && (
          <header className={`px-6 pt-5 pb-3 flex items-center justify-between drag-handle relative z-10 ${isEditMode ? 'cursor-move bg-primary-500/5' : ''}`}>
            <div className="flex items-center gap-2 overflow-hidden">
               {isEditMode && <span className="material-symbols-outlined text-primary-500 text-sm animate-pulse">drag_indicator</span>}
               <h3 className="text-[10px] font-black uppercase tracking-[0.25em] text-light-text dark:text-dark-text truncate pr-2 opacity-60 group-hover/widget:opacity-100 transition-opacity">
                  {title}
               </h3>
            </div>
            
            {isEditMode && (
              <button 
                onMouseDown={(e) => e.stopPropagation()} 
                onClick={(e) => { e.stopPropagation(); onRemove(); }} 
                className="text-rose-500 p-1 rounded-lg hover:bg-rose-500/10 transition-colors cursor-pointer shrink-0" 
                title="Decommission node"
              >
                <span className="material-symbols-outlined text-sm">close</span>
              </button>
            )}
          </header>
        )}

        <div className={`flex-grow min-h-0 overflow-visible relative z-10 ${hideHeader ? '' : 'px-6 pb-6'}`}>
          {children}
        </div>

        {!hideHeader && (
          <div className={`absolute top-0 right-0 w-12 h-12 bg-gradient-to-bl pointer-events-none opacity-0 transition-opacity duration-500 group-hover/widget:opacity-100 ${
              isEditMode ? 'from-primary-500/10' : 'from-black/5 dark:from-white/5'
          }`}></div>
        )}
      </div>
    </div>
  );
};

export default WidgetWrapper;
