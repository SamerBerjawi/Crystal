
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
    onTouchEnd
}) => {
  return (
    <div 
        className={className}
        style={style}
        onMouseDown={onMouseDown}
        onMouseUp={onMouseUp}
        onTouchEnd={onTouchEnd}
    >
      <Card className={`flex flex-col h-full transition-all duration-200 ${isEditMode ? 'border-dashed border-primary-500/50' : ''}`}>
        <header className={`flex items-center justify-between mb-4 -mt-2 drag-handle ${isEditMode ? 'cursor-move' : ''}`}>
          <h3 className="text-xl font-semibold text-light-text dark:text-dark-text truncate pr-2">{title}</h3>
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
