import React, { useRef, useCallback, useState } from 'react';
import { motion, useAnimation, PanInfo } from 'motion/react';

interface SwipeAction {
  /** Icon name (material symbols or Untitled UI) */
  icon: string;
  /** Background color class */
  bgClass: string;
  /** Text/icon color class */
  colorClass?: string;
  /** Label shown under the icon */
  label?: string;
  /** Callback when the action is triggered */
  onAction: () => void;
}

interface SwipeableRowProps {
  children: React.ReactNode;
  /** Actions revealed on swipe-left (right side) */
  leftActions?: SwipeAction[];
  /** Actions revealed on swipe-right (left side) */
  rightActions?: SwipeAction[];
  /** Whether swipe is disabled */
  disabled?: boolean;
  /** Additional className */
  className?: string;
  /** Threshold in px to trigger full action (default: 80) */
  threshold?: number;
}

/**
 * Apple HIG Swipeable Row
 *
 * Reveals action buttons when the user swipes a list item.
 * Swipe left to reveal right-side actions (e.g., delete, edit).
 * Swipe right to reveal left-side actions (e.g., mark as read).
 *
 * Follows Apple HIG destructive action pattern:
 * - Full swipe triggers the first action
 * - Partial swipe reveals buttons
 * - Spring physics for bounce-back
 */
const SwipeableRow: React.FC<SwipeableRowProps> = ({
  children,
  leftActions = [],
  rightActions = [],
  disabled = false,
  className = '',
  threshold = 80,
}) => {
  const controls = useAnimation();
  const [revealedSide, setRevealedSide] = useState<'left' | 'right' | null>(null);
  const actionWidth = useRef(0);

  const handleDragEnd = useCallback(
    (_: any, info: PanInfo) => {
      if (disabled) return;

      const { offset, velocity } = info;

      // Swipe left → reveal right actions
      if (offset.x < -threshold || velocity.x < -500) {
        if (rightActions.length > 0) {
          const revealWidth = Math.min(rightActions.length * 72, 216);
          actionWidth.current = revealWidth;
          controls.start({ x: -revealWidth });
          setRevealedSide('right');
          return;
        }
      }

      // Swipe right → reveal left actions
      if (offset.x > threshold || velocity.x > 500) {
        if (leftActions.length > 0) {
          const revealWidth = Math.min(leftActions.length * 72, 216);
          actionWidth.current = revealWidth;
          controls.start({ x: revealWidth });
          setRevealedSide('left');
          return;
        }
      }

      // Full-swipe trigger (very fast or very far)
      if (offset.x < -(threshold * 3) || velocity.x < -1200) {
        if (rightActions.length > 0) {
          rightActions[0].onAction();
          controls.start({ x: 0 });
          setRevealedSide(null);
          return;
        }
      }

      // Bounce back
      controls.start({ x: 0 });
      setRevealedSide(null);
    },
    [controls, disabled, leftActions, rightActions, threshold]
  );

  const handleTap = useCallback(() => {
    if (revealedSide) {
      controls.start({ x: 0 });
      setRevealedSide(null);
    }
  }, [controls, revealedSide]);

  const renderActions = (actions: SwipeAction[], side: 'left' | 'right') => {
    if (actions.length === 0) return null;

    return (
      <div
        className={`absolute top-0 bottom-0 flex items-stretch ${side === 'right' ? 'right-0' : 'left-0'
          }`}
      >
        {actions.map((action, i) => (
          <button
            key={i}
            onClick={() => {
              action.onAction();
              controls.start({ x: 0 });
              setRevealedSide(null);
            }}
            className={`touch-feedback flex flex-col items-center justify-center w-[72px] ${action.bgClass} ${action.colorClass || 'text-white'} transition-colors`}
          >
            <span className="material-symbols-rounded text-xl">{action.icon}</span>
            {action.label && (
              <span className="text-[10px] font-semibold mt-0.5">{action.label}</span>
            )}
          </button>
        ))}
      </div>
    );
  };

  return (
    <div className={`swipe-action-container ${className}`}>
      {/* Background actions */}
      {renderActions(leftActions, 'left')}
      {renderActions(rightActions, 'right')}

      {/* Foreground draggable content */}
      <motion.div
        animate={controls}
        drag={disabled ? false : 'x'}
        dragConstraints={{ left: -(rightActions.length * 72), right: leftActions.length * 72 }}
        dragElastic={0.15}
        onDragEnd={handleDragEnd}
        onTap={handleTap}
        className="relative z-10 bg-white dark:bg-dark-card"
        style={{ touchAction: 'pan-y' }}
      >
        {children}
      </motion.div>
    </div>
  );
};

export default SwipeableRow;
