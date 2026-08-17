import React, { useRef, useCallback, useState } from 'react';
import { motion, useAnimation, PanInfo } from 'motion/react';
import Icon from './ui/Icon';

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
  const [isSwiping, setIsSwiping] = useState(false);
  const actionWidth = useRef(0);

  const handleDragStart = useCallback(() => {
    setIsSwiping(true);
  }, []);

  const handleDragEnd = useCallback(
    (_: any, info: PanInfo) => {
      setIsSwiping(false);
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
    const isVisible = isSwiping || revealedSide === side;

    return (
      <div
        className={`absolute top-0 bottom-0 flex items-stretch z-0 transition-opacity duration-150 ${
          side === 'right' ? 'right-0' : 'left-0'
        } ${isVisible ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'}`}
      >
        {actions.map((action, i) => (
          <button
            key={i}
            onClick={(e) => {
              e.stopPropagation();
              action.onAction();
              controls.start({ x: 0 });
              setRevealedSide(null);
            }}
            className={`touch-feedback flex flex-col items-center justify-center w-[72px] ${action.bgClass} ${action.colorClass || 'text-white'} transition-colors`}
          >
            <Icon name={action.icon} className="text-lg mb-0.5" />
            {action.label && (
              <span className="text-xs font-semibold tracking-tight">{action.label}</span>
            )}
          </button>
        ))}
      </div>
    );
  };

  return (
    <div className={`relative overflow-hidden w-full select-none ${className}`}>
      {/* Background actions */}
      {renderActions(leftActions, 'left')}
      {renderActions(rightActions, 'right')}

      {/* Foreground draggable content */}
      <motion.div
        animate={controls}
        drag={disabled ? false : 'x'}
        dragConstraints={{ left: -(rightActions.length * 72), right: leftActions.length * 72 }}
        dragElastic={0.15}
        onDragStart={handleDragStart}
        onDragEnd={handleDragEnd}
        onTap={handleTap}
        className="relative z-10 w-full bg-white dark:bg-[#18181b]"
        style={{ touchAction: 'pan-y' }}
      >
        {children}
      </motion.div>
    </div>
  );
};

export default SwipeableRow;
