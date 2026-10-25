/**
 * @author: @dorianbaffier
 * @description: Hold Button
 * @version: 2.0.0
 * @date: 2026-10-16
 * @license: MIT
 * @website: https://kokonutui.com
 * @github: https://github.com/kokonut-labs/kokonutui
 *
 * Press and hold to confirm. The fill tracks the hold, drains back at a speed
 * that matches how far it got when released early, and on completion the
 * button turns solid and the label rolls to a drawn check.
 *
 * Crystal port (UI_UX_DESIGN_REFERENCE.md §4, D5, D13): `nv-*` tokens instead of zinc/red classes, Hugeicons
 * through NvIcon instead of lucide-react, a 44px pill, and a `tone` per accent. The hold engine is unchanged.
 */

import {
  AnimatePresence,
  type AnimationPlaybackControls,
  animate,
  MotionConfig,
  motion,
  useMotionValue,
  useReducedMotion,
  useTransform,
} from 'motion/react';
import {
  type ButtonHTMLAttributes,
  type KeyboardEvent,
  type PointerEvent,
  type ReactNode,
  useEffect,
  useRef,
  useState,
} from 'react';
import { cn } from '../../lib/utils';
import { NvIcon, type NvIconName } from '../new/NvIcon';

type Tone = 'danger' | 'violet' | 'green' | 'orange' | 'sky';

const TONE_CLASS: Record<Tone, string> = {
  danger: 'border-nv-red/30 bg-nv-red-soft text-nv-red-text data-[complete]:border-nv-red data-[complete]:bg-nv-red data-[complete]:text-white',
  violet: 'border-nv-violet/30 bg-nv-violet-soft text-nv-violet-text data-[complete]:border-nv-violet data-[complete]:bg-nv-violet data-[complete]:text-nv-on-violet',
  green: 'border-nv-green/40 bg-nv-green-soft text-nv-green-text data-[complete]:border-nv-green data-[complete]:bg-nv-green data-[complete]:text-nv-on-green',
  orange: 'border-nv-orange/40 bg-nv-orange-soft text-nv-orange-text data-[complete]:border-nv-orange data-[complete]:bg-nv-orange data-[complete]:text-nv-on-orange',
  sky: 'border-nv-sky/40 bg-nv-sky-soft text-nv-sky-text data-[complete]:border-nv-sky data-[complete]:bg-nv-sky data-[complete]:text-nv-on-sky',
};

interface HoldButtonProps extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'children'> {
  /** Idle label. */
  children?: ReactNode;
  tone?: Tone;
  icon?: NvIconName;
  /** How long (ms) the button has to be held. */
  holdDuration?: number;
  /** Label while holding. */
  holdingLabel?: ReactNode;
  /** Label once the hold completes. */
  completeLabel?: ReactNode;
  /** How long (ms) the complete state shows before resetting. 0 keeps it. */
  resetAfter?: number;
  /** Called once the button has been held for the full `holdDuration`. A short click or an early release never calls it. */
  onHoldComplete?: () => void;
}

type Phase = 'idle' | 'holding' | 'complete';

const HOLD_KEYS = new Set([' ', 'Enter']);
const EASE_OUT = [0.23, 1, 0.32, 1] as const;
const LABEL_TRANSITION = { duration: 0.2, ease: EASE_OUT };
/** Time (ms) a full fill takes to drain after an early release. */
const DRAIN_MS = 300;
/** The holding label waits this long (ms), so a quick tap doesn't flicker it. */
const LABEL_DELAY_MS = 150;

function DrawnCheck() {
  return (
    <svg aria-hidden="true" className="size-4" fill="none" viewBox="0 0 16 16">
      <motion.path
        animate={{ pathLength: 1 }}
        d="M3.5 8.5 6.5 11.5 12.5 4.5"
        initial={{ pathLength: 0 }}
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="2"
        transition={{ duration: 0.3, delay: 0.1, ease: EASE_OUT }}
      />
    </svg>
  );
}

export function HoldButton({
  className,
  tone = 'danger',
  icon = 'delete',
  holdDuration = 1200,
  holdingLabel = 'Keep holding',
  completeLabel = 'Done',
  resetAfter = 1800,
  onHoldComplete,
  children = 'Hold to delete',
  type = 'button',
  disabled,
  onPointerDown,
  onPointerUp,
  onPointerLeave,
  onPointerCancel,
  onKeyDown,
  onKeyUp,
  onBlur,
  ...props
}: HoldButtonProps) {
  const [phase, setPhase] = useState<Phase>('idle');
  const [showHoldingLabel, setShowHoldingLabel] = useState(false);
  const labelTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const phaseRef = useRef<Phase>('idle');
  const progress = useMotionValue(0);
  const animationRef = useRef<AnimationPlaybackControls | null>(null);
  const resetRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const onHoldCompleteRef = useRef(onHoldComplete);
  const shouldReduceMotion = useReducedMotion();
  const clipPath = useTransform(progress, p => `inset(0 ${(1 - p) * 100}% 0 0)`);

  useEffect(() => {
    onHoldCompleteRef.current = onHoldComplete;
  }, [onHoldComplete]);

  useEffect(
    () => () => {
      animationRef.current?.stop();
      if (labelTimerRef.current) clearTimeout(labelTimerRef.current);
      if (resetRef.current) clearTimeout(resetRef.current);
    },
    []
  );

  const updatePhase = (next: Phase) => {
    phaseRef.current = next;
    setPhase(next);
    if (labelTimerRef.current) {
      clearTimeout(labelTimerRef.current);
      labelTimerRef.current = null;
    }
    if (next === 'holding') {
      labelTimerRef.current = setTimeout(() => setShowHoldingLabel(true), LABEL_DELAY_MS);
    } else {
      setShowHoldingLabel(false);
    }
  };

  const complete = () => {
    updatePhase('complete');
    onHoldCompleteRef.current?.();
    if (resetAfter > 0) {
      resetRef.current = setTimeout(() => {
        resetRef.current = null;
        progress.set(0);
        updatePhase('idle');
      }, resetAfter);
    }
  };

  const startHold = () => {
    if (phaseRef.current !== 'idle' || disabled) return;
    updatePhase('holding');
    animationRef.current?.stop();
    // Picks up from wherever a previous drain left the fill.
    const remaining = (1 - progress.get()) * holdDuration;
    animationRef.current = animate(progress, 1, {
      duration: remaining / 1000,
      ease: 'linear',
      onComplete: () => {
        if (phaseRef.current === 'holding') complete();
      },
    });
  };

  const endHold = () => {
    if (phaseRef.current !== 'holding') return;
    updatePhase('idle');
    animationRef.current?.stop();
    // A near miss visibly unwinds; a short tap barely moves.
    animationRef.current = animate(progress, 0, {
      duration: shouldReduceMotion ? 0 : (progress.get() * DRAIN_MS) / 1000,
      ease: EASE_OUT,
    });
  };

  const handlePointerDown = (e: PointerEvent<HTMLButtonElement>) => {
    onPointerDown?.(e);
    if (e.button !== 0) return;
    // Touch pointers are captured implicitly, which would keep the hold going after the finger slides off.
    // Release so pointerleave cancels it.
    if (e.currentTarget.hasPointerCapture(e.pointerId)) e.currentTarget.releasePointerCapture(e.pointerId);
    startHold();
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLButtonElement>) => {
    onKeyDown?.(e);
    if (HOLD_KEYS.has(e.key)) {
      // Stops Enter from firing click and Space from scrolling.
      e.preventDefault();
      if (!e.repeat) startHold();
    }
  };

  const handleKeyUp = (e: KeyboardEvent<HTMLButtonElement>) => {
    onKeyUp?.(e);
    if (HOLD_KEYS.has(e.key)) endHold();
  };

  let label: ReactNode = children;
  if (phase === 'holding' && showHoldingLabel) label = holdingLabel;
  else if (phase === 'complete') label = completeLabel;

  const labelKey = phase === 'holding' && !showHoldingLabel ? 'idle' : phase;

  return (
    <MotionConfig reducedMotion="user">
      <button
        {...props}
        aria-disabled={phase === 'complete' || undefined}
        className={cn(
          'group/hold relative inline-flex h-11 min-w-44 touch-none select-none items-center justify-center overflow-hidden rounded-full border px-5 text-[15px] font-medium [-webkit-touch-callout:none]',
          'transition-[background-color,border-color,color] duration-150 ease-out disabled:pointer-events-none disabled:opacity-50',
          TONE_CLASS[tone],
          className,
        )}
        data-complete={phase === 'complete' || undefined}
        data-holding={phase === 'holding' || undefined}
        disabled={disabled}
        onBlur={e => { onBlur?.(e); endHold(); }}
        onKeyDown={handleKeyDown}
        onKeyUp={handleKeyUp}
        onPointerCancel={e => { onPointerCancel?.(e); endHold(); }}
        onPointerDown={handlePointerDown}
        onPointerLeave={e => { onPointerLeave?.(e); endHold(); }}
        onPointerUp={e => { onPointerUp?.(e); endHold(); }}
        type={type}
      >
        {/* The fill is the button's ink at low strength, revealed left to right. It hides once the whole button turns solid. */}
        <motion.span
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 bg-current/15 transition-opacity duration-150 group-data-[complete]/hold:opacity-0"
          style={{ clipPath }}
        />
        <span className="relative flex items-center justify-center overflow-hidden">
          <AnimatePresence initial={false} mode="popLayout">
            <motion.span
              animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
              className="inline-flex items-center gap-2 whitespace-nowrap"
              exit={{ opacity: 0, y: -10, filter: 'blur(2px)' }}
              initial={{ opacity: 0, y: 10, filter: 'blur(2px)' }}
              key={labelKey}
              transition={LABEL_TRANSITION}
            >
              {labelKey === 'complete' ? <DrawnCheck /> : <NvIcon name={icon} size={16} />}
              {label}
            </motion.span>
          </AnimatePresence>
        </span>
        <span aria-live="polite" className="sr-only">{phase === 'complete' ? completeLabel : ''}</span>
      </button>
    </MotionConfig>
  );
}
