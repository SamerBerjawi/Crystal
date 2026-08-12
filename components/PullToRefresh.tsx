import React, { useState, useCallback, useRef } from 'react';
import { motion } from 'motion/react';
import Icon from './ui/Icon';

interface PullToRefreshProps {
  children: React.ReactNode;
  /** Async callback triggered when pull-to-refresh activates */
  onRefresh: () => Promise<void>;
  /** Whether PTR is enabled (default: true) */
  enabled?: boolean;
  /** Pull distance in px required to trigger refresh (default: 80) */
  threshold?: number;
  /** Additional className for the container */
  className?: string;
}

/**
 * Pull-to-Refresh wrapper — Apple HIG.
 *
 * Wraps a scrollable container and shows a spinner when the user
 * pulls down from the top. Uses native touch events for smooth
 * iOS-like feel.
 *
 * Note: Only works on mobile (touch devices). On desktop, this
 * simply renders children.
 */
const PullToRefresh: React.FC<PullToRefreshProps> = ({
  children,
  onRefresh,
  enabled = true,
  threshold = 80,
  className = '',
}) => {
  const [pullDistance, setPullDistance] = useState(0);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const startY = useRef(0);
  const containerRef = useRef<HTMLDivElement>(null);
  const isPulling = useRef(false);

  const handleTouchStart = useCallback(
    (e: React.TouchEvent) => {
      if (!enabled || isRefreshing) return;
      const container = containerRef.current;
      if (!container || container.scrollTop > 0) return;

      startY.current = e.touches[0].clientY;
      isPulling.current = true;
    },
    [enabled, isRefreshing]
  );

  const handleTouchMove = useCallback(
    (e: React.TouchEvent) => {
      if (!isPulling.current || !enabled || isRefreshing) return;

      const currentY = e.touches[0].clientY;
      const diff = currentY - startY.current;

      if (diff > 0) {
        // Apply diminishing returns for overscroll feel
        const dampened = Math.min(diff * 0.5, threshold * 1.5);
        setPullDistance(dampened);
      }
    },
    [enabled, isRefreshing, threshold]
  );

  const handleTouchEnd = useCallback(async () => {
    if (!isPulling.current) return;
    isPulling.current = false;

    if (pullDistance >= threshold && !isRefreshing) {
      setIsRefreshing(true);
      setPullDistance(threshold * 0.6); // Hold at spinner position

      try {
        await onRefresh();
      } catch {
        // Silently handle errors
      }

      setIsRefreshing(false);
    }

    setPullDistance(0);
  }, [pullDistance, threshold, isRefreshing, onRefresh]);

  const showIndicator = pullDistance > 10 || isRefreshing;
  const progress = Math.min(pullDistance / threshold, 1);
  const isTriggered = progress >= 1;

  return (
    <div
      ref={containerRef}
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
      className={`relative ${className}`}
    >
      {/* Pull indicator */}
      {showIndicator && (
        <motion.div
          className="absolute left-1/2 -translate-x-1/2 z-20 flex items-center justify-center"
          style={{ top: Math.max(pullDistance - 40, 4) }}
          initial={{ opacity: 0, scale: 0.5 }}
          animate={{
            opacity: progress > 0.2 ? 1 : progress * 5,
            scale: isTriggered || isRefreshing ? 1 : 0.5 + progress * 0.5,
          }}
        >
          <div className={`w-9 h-9 rounded-full bg-white dark:bg-gray-800 shadow-lg border border-black/10 dark:border-white/10 flex items-center justify-center ${isRefreshing || isTriggered ? 'ptr-spinner' : ''}`}>
            <Icon
              name={isRefreshing ? 'refresh' : isTriggered ? 'check' : 'arrow_downward'}
              className={`text-base transition-transform ${!isRefreshing ? `rotate-[${Math.min(progress * 180, 180)}deg]` : ''} ${
                isTriggered ? 'text-green-500' : 'text-primary-500'
              }`}
            />
          </div>
        </motion.div>
      )}

      {/* Content with pull offset */}
      <div
        style={{
          transform: pullDistance > 0 ? `translateY(${pullDistance}px)` : undefined,
          transition: isPulling.current ? 'none' : 'transform 0.3s ease-out',
        }}
      >
        {children}
      </div>
    </div>
  );
};

export default PullToRefresh;
