import React, { useRef, useCallback, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence, PanInfo } from 'motion/react';

interface BottomSheetProps {
  isOpen: boolean;
  onClose: () => void;
  children: React.ReactNode;
  /** Title displayed in the sheet header */
  title?: string;
  /** Subtitle or description displayed in header */
  subtitle?: string;
  /** Maximum height as vh percentage (default: 92) */
  maxHeight?: number;
  /** Snap points as vh percentages — the sheet will snap to the nearest */
  snapPoints?: number[];
  /** Whether to show the drag handle (default: true) */
  showHandle?: boolean;
  /** Whether to show the close button (default: true when title is provided) */
  showClose?: boolean;
  /** Optional left header action (e.g., "Reset" text button) */
  headerLeft?: React.ReactNode;
  /** Optional right header action (e.g., "Done" button or custom badge) */
  headerRight?: React.ReactNode;
  /** Optional sticky footer at the bottom of the sheet */
  footer?: React.ReactNode;
  /** Additional className for the sheet container */
  className?: string;
}

const DRAG_CONSTRAINTS = { top: 0 };

/**
 * Apple iOS HIG Bottom Sheet
 *
 * Features:
 * - Rendered in createPortal to ensure escape from parent CSS transforms & navbar stacking
 * - Drag-to-dismiss with spring physics
 * - High-coverage default max height (92vh/dvh) so it pulls all the way up cleanly
 * - iOS frosted glass backdrop and grouped surface
 * - Rounded top corners with drag handle
 * - Safe-area bottom padding
 * - Overscroll-aware (won't dismiss when scrolling content)
 */
const BottomSheet: React.FC<BottomSheetProps> = ({
  isOpen,
  onClose,
  children,
  title,
  subtitle,
  maxHeight = 92,
  snapPoints,
  showHandle = true,
  showClose,
  headerLeft,
  headerRight,
  footer,
  className = '',
}) => {
  const sheetRef = useRef<HTMLDivElement>(null);
  const isDragging = useRef(false);

  const shouldShowClose = showClose ?? (!!title && !headerRight);

  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [isOpen]);

  const handleDragEnd = useCallback(
    (_: any, info: PanInfo) => {
      isDragging.current = false;
      const { velocity, offset } = info;

      // Dismiss if dragged down > 80px or fast swipe down
      if (offset.y > 80 || velocity.y > 400) {
        onClose();
      }
    },
    [onClose]
  );

  if (typeof document === 'undefined') return null;

  return createPortal(
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-[9999] flex flex-col justify-end md:hidden font-sans">
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.25 }}
            onClick={onClose}
            className="absolute inset-0 bg-black/60 backdrop-blur-sm"
          />

          {/* Sheet Surface */}
          <motion.div
            ref={sheetRef}
            initial={{ y: '100%' }}
            animate={{ y: 0 }}
            exit={{ y: '100%' }}
            transition={{ type: 'spring', stiffness: 380, damping: 32 }}
            drag="y"
            dragConstraints={DRAG_CONSTRAINTS}
            dragElastic={0.08}
            onDragStart={() => {
              isDragging.current = true;
            }}
            onDragEnd={handleDragEnd}
            className={`relative z-10 bg-light-card dark:bg-dark-card backdrop-blur-2xl dark:shadow-[inset_0_1px_0_0_rgba(255,255,255,0.1)] text-light-text dark:text-dark-text rounded-t-[32px] border-t border-black/10 dark:border-white/10 shadow-2xl flex flex-col overflow-hidden ${className}`}
            style={{
              maxHeight: `min(${maxHeight}vh, ${maxHeight}dvh)`,
              paddingBottom: `env(safe-area-inset-bottom, 0px)`,
            }}
          >
            {/* iOS Grab Handle */}
            {showHandle && (
              <div className="flex justify-center pt-2.5 pb-1 cursor-grab active:cursor-grabbing shrink-0" aria-hidden="true">
                <div className="w-10 h-1.5 rounded-full bg-gray-300/90 dark:bg-gray-600/90 transition-colors" />
              </div>
            )}

            {/* iOS Navigation Header */}
            {(title || headerLeft || headerRight || shouldShowClose) && (
              <div className="flex items-center justify-between px-4 sm:px-5 py-2.5 border-b border-black/5 dark:border-white/5 bg-gradient-to-r from-primary-500/5 to-transparent shrink-0 min-h-[48px]">
                {/* Left Action */}
                <div className="flex items-center justify-start min-w-[70px]">
                  {headerLeft}
                </div>

                {/* Center Title */}
                <div className="text-center flex-1 px-2">
                  {title && (
                    <h3 className="text-base font-bold text-light-text dark:text-dark-text tracking-tight leading-tight">
                      {title}
                    </h3>
                  )}
                  {subtitle && (
                    <p className="text-xs font-medium text-light-text-secondary dark:text-dark-text-secondary mt-0.5">
                      {subtitle}
                    </p>
                  )}
                </div>

                {/* Right Action */}
                <div className="flex items-center justify-end min-w-[70px]">
                  {headerRight ? (
                    headerRight
                  ) : shouldShowClose ? (
                    <button
                      onClick={onClose}
                      className="w-8 h-8 rounded-xl flex items-center justify-center text-light-text-secondary dark:text-dark-text-secondary hover:bg-black/5 dark:hover:bg-white/5 transition-colors"
                      aria-label="Close"
                    >
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  ) : null}
                </div>
              </div>
            )}

            {/* Scrollable Content */}
            <div className="flex-1 overflow-y-auto scroll-touch overscroll-contain">
              {children}
            </div>

            {/* Sticky Footer */}
            {footer && (
              <div className="shrink-0 border-t border-black/5 dark:border-white/5 bg-light-card/80 dark:bg-dark-card/80 backdrop-blur-md px-4 sm:px-5 py-3 safe-bottom shadow-lg">
                {footer}
              </div>
            )}
          </motion.div>
        </div>
      )}
    </AnimatePresence>,
    document.body
  );
};

export default BottomSheet;
