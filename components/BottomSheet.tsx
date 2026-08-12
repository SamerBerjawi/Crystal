import React, { useRef, useCallback, useEffect } from 'react';
import { motion, AnimatePresence, PanInfo, useAnimation } from 'motion/react';

interface BottomSheetProps {
  isOpen: boolean;
  onClose: () => void;
  children: React.ReactNode;
  /** Title displayed in the sheet header */
  title?: string;
  /** Maximum height as vh percentage (default: 85) */
  maxHeight?: number;
  /** Snap points as vh percentages — the sheet will snap to the nearest */
  snapPoints?: number[];
  /** Whether to show the drag handle (default: true) */
  showHandle?: boolean;
  /** Whether to show the close button (default: true when title is provided) */
  showClose?: boolean;
  /** Additional className for the sheet container */
  className?: string;
}

/**
 * Apple HIG Bottom Sheet
 *
 * Features:
 * - Drag-to-dismiss with spring physics
 * - Snap points for intermediate heights
 * - Backdrop blur overlay
 * - Rounded top corners with drag handle
 * - Safe-area bottom padding
 * - Overscroll-aware (won't dismiss when scrolling content)
 */
const BottomSheet: React.FC<BottomSheetProps> = ({
  isOpen,
  onClose,
  children,
  title,
  maxHeight = 85,
  snapPoints,
  showHandle = true,
  showClose,
  className = '',
}) => {
  const sheetRef = useRef<HTMLDivElement>(null);
  const controls = useAnimation();
  const isDragging = useRef(false);

  const shouldShowClose = showClose ?? !!title;

  useEffect(() => {
    if (isOpen) {
      controls.start({ y: 0 });
      document.body.style.overflow = 'hidden';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [isOpen, controls]);

  const handleDragEnd = useCallback(
    (_: any, info: PanInfo) => {
      isDragging.current = false;
      const { velocity, offset } = info;

      // Dismiss if dragged down > 30% or fast swipe down
      if (offset.y > 100 || velocity.y > 500) {
        controls.start({ y: '100%' }).then(onClose);
        return;
      }

      // Snap to nearest point if snap points are defined
      if (snapPoints && snapPoints.length > 0) {
        const sheetHeight = sheetRef.current?.offsetHeight || 0;
        const currentPos = offset.y;
        const percentDragged = (currentPos / sheetHeight) * 100;

        // Find nearest snap point
        let nearestSnap = 0;
        let minDist = Infinity;
        for (const sp of [0, ...snapPoints.map(p => 100 - p)]) {
          const dist = Math.abs(percentDragged - sp);
          if (dist < minDist) {
            minDist = dist;
            nearestSnap = sp;
          }
        }

        if (nearestSnap >= 70) {
          controls.start({ y: '100%' }).then(onClose);
        } else {
          controls.start({ y: `${nearestSnap}%` });
        }
        return;
      }

      // Bounce back
      controls.start({ y: 0 });
    },
    [controls, onClose, snapPoints]
  );

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-[9998] flex flex-col justify-end md:hidden">
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            onClick={onClose}
            className="absolute inset-0 sheet-backdrop"
          />

          {/* Sheet */}
          <motion.div
            ref={sheetRef}
            initial={{ y: '100%' }}
            animate={controls}
            exit={{ y: '100%' }}
            transition={{ type: 'spring', stiffness: 400, damping: 35 }}
            drag="y"
            dragConstraints={{ top: 0 }}
            dragElastic={0.1}
            onDragStart={() => { isDragging.current = true; }}
            onDragEnd={handleDragEnd}
            className={`relative z-10 bg-white dark:bg-gray-900 rounded-t-[28px] border-t border-black/10 dark:border-white/10 shadow-2xl flex flex-col overflow-hidden ${className}`}
            style={{
              maxHeight: `${maxHeight}vh`,
              paddingBottom: `env(safe-area-inset-bottom, 0px)`,
              touchAction: 'none',
            }}
          >
            {/* Drag Handle */}
            {showHandle && (
              <div className="flex justify-center pt-3 pb-1 cursor-grab active:cursor-grabbing" aria-hidden="true">
                <div className="w-9 h-1 rounded-full bg-gray-300 dark:bg-gray-600" />
              </div>
            )}

            {/* Header */}
            {(title || shouldShowClose) && (
              <div className="flex items-center justify-between px-5 py-2 border-b border-black/5 dark:border-white/5 shrink-0">
                {title ? (
                  <div>
                    <h3 className="text-base font-bold text-light-text dark:text-dark-text">{title}</h3>
                  </div>
                ) : <div />}
                {shouldShowClose && (
                  <button
                    onClick={onClose}
                    className="touch-feedback w-9 h-9 min-h-[44px] min-w-[44px] rounded-full bg-gray-100 dark:bg-gray-800 flex items-center justify-center text-gray-500 hover:text-gray-900 dark:hover:text-white"
                    aria-label="Close"
                  >
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                )}
              </div>
            )}

            {/* Content */}
            <div className="flex-1 overflow-y-auto scroll-touch overscroll-contain">
              {children}
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
};

export default BottomSheet;
