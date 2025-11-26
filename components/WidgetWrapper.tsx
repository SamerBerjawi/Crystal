
import React from 'react';
import Card from './Card';

interface WidgetWrapperProps {
  children: React.ReactNode;
  title: string;
  onRemove: () => void;
  w: number;
  h: number;
  isEditMode: boolean;
  onResize: (dimension: 'w' | 'h', change: 1 | -1) => void;
  isBeingDragged?: boolean;
  isDragOver?: boolean;
  onDragStart?: (e: React.DragEvent) => void;
  onDragEnter?: (e: React.DragEvent) => void;
  onDragLeave?: (e: React.DragEvent) => void;
  onDrop?: (e: React.DragEvent) => void;
  onDragEnd?: (e: React.DragEvent) => void;
}

const WidgetWrapper: React.FC<WidgetWrapperProps> = ({ 
    children, 
    title, 
    onRemove, 
    w,
    h,
    isEditMode,
    onResize,
    isBeingDragged,
    isDragOver,
    onDragStart,
    onDragEnter,
    onDragLeave,
    onDrop,
    onDragEnd
}) => {
  const colSpanClasses: { [key: number]: string } = {
    1: 'md:col-span-1',
    2: 'md:col-span-2',
    3: 'md:col-span-3',
    4: 'md:col-span-4',
  };
  const rowSpanClasses: { [key: number]: string } = {
    1: 'md:row-span-1',
    2: 'md:row-span-2',
    3: 'md:row-span-3',
  };

  const dragClasses = isBeingDragged ? 'opacity-30' : '';
  const dragOverClasses = isDragOver ? 'ring-2 ring-primary-500 bg-primary-500/5' : '';
  
  return (
    <div 
        className={`${colSpanClasses[w] || 'md:col-span-1'} ${rowSpanClasses[h] || 'md:row-span-1'} ${dragClasses} transition-opacity duration-300 relative`}
        draggable={isEditMode}
        onDragStart={onDragStart}
        onDragEnter={onDragEnter}
        onDragLeave={onDragLeave}
        onDragOver={(e) => e.preventDefault()}
        onDrop={onDrop}
        onDragEnd={onDragEnd}
    >
      <Card className={`flex flex-col h-full ${dragOverClasses} transition-all duration-200 ${isEditMode ? 'border-dashed border-primary-500/50 cursor-move' : ''}`}>
        {isEditMode && (
           <div className="absolute top-2 right-2 z-20">
             <button onClick={onRemove} className="bg-red-500 text-white p-1 rounded-full hover:bg-red-600 shadow-sm">
                <span className="material-symbols-outlined text-sm block">close</span>
             </button>
           </div>
        )}
        {/* Only show title if not in edit mode to keep it clean, or keep it minimal */}
        <header className="flex items-center justify-between mb-4">
           <h3 className="text-lg font-bold text-light-text dark:text-dark-text tracking-tight">{title}</h3>
        </header>

        <div className="flex-grow relative min-h-0">
          {children}
        </div>

        {isEditMode && (
          <div className="absolute bottom-2 right-2 flex gap-1 bg-white dark:bg-dark-card p-1 rounded-lg shadow-lg border border-black/10 dark:border-white/10 z-20">
            <button onClick={(e) => { e.stopPropagation(); onResize('w', -1); }} disabled={w <= 1} className="p-1 hover:bg-gray-100 dark:hover:bg-white/10 rounded disabled:opacity-30"><span className="material-symbols-outlined text-sm">west</span></button>
            <button onClick={(e) => { e.stopPropagation(); onResize('w', 1); }} disabled={w >= 4} className="p-1 hover:bg-gray-100 dark:hover:bg-white/10 rounded disabled:opacity-30"><span className="material-symbols-outlined text-sm">east</span></button>
            <div className="w-px bg-gray-200 dark:bg-gray-700 mx-1"></div>
            <button onClick={(e) => { e.stopPropagation(); onResize('h', -1); }} disabled={h <= 1} className="p-1 hover:bg-gray-100 dark:hover:bg-white/10 rounded disabled:opacity-30"><span className="material-symbols-outlined text-sm">north</span></button>
            <button onClick={(e) => { e.stopPropagation(); onResize('h', 1); }} disabled={h >= 3} className="p-1 hover:bg-gray-100 dark:hover:bg-white/10 rounded disabled:opacity-30"><span className="material-symbols-outlined text-sm">south</span></button>
          </div>
        )}
      </Card>
    </div>
  );
};

export default WidgetWrapper;
