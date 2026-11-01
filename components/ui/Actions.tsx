import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  Button as AriaButton,
  Link as AriaLink,
  OverlayArrow,
  Tooltip as AriaTooltip,
  TooltipTrigger,
  type ButtonProps as AriaButtonProps,
  type LinkProps as AriaLinkProps,
} from 'react-aria-components';
import { cva, type VariantProps } from 'class-variance-authority';
import { motion } from 'motion/react';
import Icon from './Icon';
import { Spinner } from './States';
import { ConfirmDialog } from './Overlays';
import { cn } from '../../lib/utils';

const pressable =
  'relative inline-flex items-center justify-center select-none cursor-pointer transition-[background-color,border-color,color,scale] duration-[var(--duration-fast)] data-[pressed]:scale-[.98] data-[disabled]:cursor-not-allowed data-[disabled]:opacity-50';

export const buttonStyles = cva(
  `${pressable} gap-2 rounded-full border border-transparent font-bold whitespace-nowrap`,
  {
    variants: {
      variant: {
        primary: 'bg-primary text-on-primary data-[hovered]:bg-primary-hover data-[pressed]:bg-primary-hover',
        secondary: 'bg-surface text-ink border-line-strong data-[hovered]:bg-inset data-[pressed]:bg-inset',
        soft: 'bg-primary-soft text-ink data-[hovered]:border-primary data-[pressed]:border-primary',
        ghost: 'text-ink data-[hovered]:bg-inset data-[pressed]:bg-inset',
        destructive: 'bg-money-out text-on-danger data-[hovered]:brightness-95 data-[pressed]:brightness-90',
      },
      size: {
        sm: 'h-8 px-3 text-[.8125rem] pointer-coarse:h-11 pointer-coarse:px-4',
        md: 'h-10 px-[18px] text-sm pointer-coarse:h-11',
        lg: 'h-12 px-6 text-[.9375rem]',
      },
      block: { true: 'w-full' },
    },
    defaultVariants: { variant: 'primary', size: 'md' },
  }
);

export interface ButtonProps extends Omit<AriaButtonProps, 'children' | 'className'>, VariantProps<typeof buttonStyles> {
  icon?: string;
  isBusy?: boolean;
  className?: string;
  children: React.ReactNode;
}

/** The main way to act. A busy button keeps its width and shows a spinner. */
export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ variant, size, block, icon, isBusy, className, children, ...props }, ref) => (
    <AriaButton
      ref={ref}
      {...props}
      isPending={isBusy}
      className={cn(buttonStyles({ variant, size, block }), className)}
    >
      <span className={cn('inline-flex items-center gap-2', isBusy && 'invisible')}>
        {icon && <Icon name={icon} size={20} />}
        {children}
      </span>
      {isBusy && <Spinner className="absolute" />}
    </AriaButton>
  )
);
Button.displayName = 'Button';

/** A name or hint on hover and focus. Never essential content. */
export const Tooltip: React.FC<{
  label: React.ReactNode;
  placement?: 'top' | 'bottom' | 'left' | 'right';
  children: React.ReactElement;
}> = ({ label, placement = 'top', children }) => (
  <TooltipTrigger delay={300} closeDelay={0}>
    {children}
    <AriaTooltip
      placement={placement}
      offset={8}
      className="crystal-pop glass-float rounded-[var(--radius-sm)] px-2 py-1 type-caption text-ink shadow-sm"
    >
      <OverlayArrow />
      {label}
    </AriaTooltip>
  </TooltipTrigger>
);

const iconButtonStyles = cva(`${pressable} shrink-0 rounded-full size-10 pointer-coarse:size-11`, {
  variants: {
    variant: {
      plain: 'text-ink data-[hovered]:bg-inset data-[pressed]:bg-inset',
      glass: 'text-ink data-[hovered]:bg-primary-soft data-[pressed]:bg-primary-soft',
      primary: 'bg-primary text-on-primary data-[hovered]:bg-primary-hover data-[pressed]:bg-primary-hover',
    },
    active: { true: 'bg-primary-soft' },
  },
  defaultVariants: { variant: 'plain' },
});

export interface IconButtonProps extends Omit<AriaButtonProps, 'children' | 'className' | 'aria-label'> {
  icon: string;
  /** The accessible name, also shown as the tooltip. */
  label: string;
  variant?: 'plain' | 'glass' | 'primary';
  isActive?: boolean;
  isBusy?: boolean;
  tooltipPlacement?: 'top' | 'bottom' | 'left' | 'right';
  iconSize?: number;
  badge?: number;
  className?: string;
}

/** A round icon-only button. The label is required, because an icon has no name of its own. */
export const IconButton = React.forwardRef<HTMLButtonElement, IconButtonProps>(
  ({ icon, label, variant, isActive, isBusy, tooltipPlacement, iconSize = 20, badge, className, ...props }, ref) => (
    <Tooltip label={label} placement={tooltipPlacement}>
      <AriaButton
        ref={ref}
        {...props}
        isPending={isBusy}
        aria-label={badge ? `${label}, ${badge} waiting` : label}
        aria-current={isActive ? 'page' : undefined}
        className={cn(iconButtonStyles({ variant, active: isActive }), className)}
      >
        {isBusy ? <Spinner /> : <Icon name={icon} size={iconSize} weight={isActive ? 'bold' : 'regular'} />}
        {!!badge && (
          <span
            aria-hidden="true"
            className="absolute -right-0.5 -top-0.5 flex h-[18px] min-w-[18px] items-center justify-center rounded-full bg-primary px-1 text-[.6875rem] font-bold leading-none text-on-primary tabular-nums"
          >
            {badge > 99 ? '99+' : badge}
          </span>
        )}
      </AriaButton>
    </Tooltip>
  )
);
IconButton.displayName = 'IconButton';

/** Inline text link, or a Summary link inside the written summary. */
export const TextLink: React.FC<AriaLinkProps & { variant?: 'inline' | 'summary'; className?: string }> = ({
  variant = 'inline',
  className,
  ...props
}) => (
  <AriaLink
    {...props}
    className={cn(
      'cursor-pointer rounded-sm underline underline-offset-2 decoration-1 data-[hovered]:decoration-2',
      variant === 'inline' ? 'text-primary font-semibold' : 'text-ink font-bold decoration-primary',
      className
    )}
  />
);

const HOLD_MS = 1200;
const DRAIN_MS = 300;
const QUICK_MS = 200;

export interface HoldButtonProps {
  /** What goes, in plain words: "Delete 3 transactions". */
  label: string;
  onConfirm: () => void;
  isDisabled?: boolean;
  block?: boolean;
  className?: string;
}

/**
 * Press and hold to delete (D-065), adapted from KokonutUI's Hold Button (MIT). The fill drains if you let go early, and
 * a screen reader, which can only send a click, gets a plain confirmation instead. Keyboard users hold Space or Enter.
 */
export const HoldButton: React.FC<HoldButtonProps> = ({ label, onConfirm, isDisabled, block, className }) => {
  const buttonRef = useRef<HTMLButtonElement>(null);
  const startedAt = useRef(0);
  const frame = useRef(0);
  const progress = useRef(0);
  const [hint, setHint] = useState(false);
  const [isConfirmOpen, setConfirmOpen] = useState(false);

  const paint = (value: number) => {
    progress.current = value;
    buttonRef.current?.style.setProperty('--hold', `${value}%`);
  };

  const hold = useCallback(() => {
    if (isDisabled || startedAt.current) return;
    setHint(false);
    startedAt.current = performance.now() - (progress.current / 100) * HOLD_MS;
    const step = (now: number) => {
      if (!startedAt.current) return;
      const value = Math.min(100, ((now - startedAt.current) / HOLD_MS) * 100);
      paint(value);
      if (value >= 100) {
        startedAt.current = 0;
        paint(0);
        onConfirm();
        return;
      }
      frame.current = requestAnimationFrame(step);
    };
    frame.current = requestAnimationFrame(step);
  }, [isDisabled, onConfirm]);

  const release = useCallback(() => {
    if (!startedAt.current) return;
    if (performance.now() - startedAt.current < QUICK_MS) setHint(true);
    startedAt.current = 0;
    cancelAnimationFrame(frame.current);
    const from = progress.current;
    const began = performance.now();
    const drain = (now: number) => {
      if (startedAt.current) return;
      const t = Math.min(1, (now - began) / DRAIN_MS);
      paint(from * (1 - t));
      if (t < 1) requestAnimationFrame(drain);
    };
    requestAnimationFrame(drain);
  }, []);

  useEffect(() => () => cancelAnimationFrame(frame.current), []);

  useEffect(() => {
    if (!hint) return;
    const timer = setTimeout(() => setHint(false), 2500);
    return () => clearTimeout(timer);
  }, [hint]);

  const isHoldKey = (e: React.KeyboardEvent) => e.key === ' ' || e.key === 'Enter';
  const text = hint ? 'Keep holding' : `Hold to ${label.charAt(0).toLowerCase()}${label.slice(1)}`;
  const content = (
    <span className="flex h-full w-full items-center justify-center gap-2 px-5 whitespace-nowrap">
      <Icon name="delete" size={20} />
      {text}
    </span>
  );

  return (
    <>
      <button
        ref={buttonRef}
        type="button"
        disabled={isDisabled}
        aria-label={`Hold to ${label.charAt(0).toLowerCase()}${label.slice(1)}`}
        className={cn(
          'relative inline-flex h-11 min-w-[190px] touch-none cursor-pointer select-none overflow-hidden rounded-full border border-money-out bg-money-out-soft text-sm font-bold text-ink disabled:cursor-not-allowed disabled:opacity-50',
          block && 'w-full',
          className
        )}
        onPointerDown={e => {
          e.currentTarget.setPointerCapture(e.pointerId);
          hold();
        }}
        onPointerUp={release}
        onPointerCancel={release}
        onBlur={release}
        onKeyDown={e => {
          if (!isHoldKey(e)) return;
          e.preventDefault();
          if (!e.repeat) hold();
        }}
        onKeyUp={e => {
          if (!isHoldKey(e)) return;
          e.preventDefault();
          release();
        }}
        onClick={e => {
          // Pointer and keyboard presses are handled above. A click with no pointer behind it is assistive technology.
          if (e.detail === 0) setConfirmOpen(true);
        }}
      >
        {content}
        <span
          aria-hidden="true"
          className="absolute inset-0 bg-money-out text-on-danger [clip-path:inset(0_calc(100%-var(--hold,0%))_0_0)]"
        >
          {content}
        </span>
      </button>
      <span role="status" className="sr-only">{hint ? 'Keep holding to delete.' : ''}</span>
      <ConfirmDialog
        isOpen={isConfirmOpen}
        onClose={() => setConfirmOpen(false)}
        onConfirm={onConfirm}
        title={`${label}?`}
        confirmLabel={label}
        isDestructive
      />
    </>
  );
};

/** The floating bar of bulk actions in Select mode. Toasts move up while it shows (D-066). */
export const SelectionBar: React.FC<{
  count: number;
  noun?: string;
  onClear: () => void;
  children: React.ReactNode;
}> = ({ count, noun = 'selected', onClear, children }) => {
  useEffect(() => {
    document.documentElement.dataset.selectionBar = 'true';
    return () => { delete document.documentElement.dataset.selectionBar; };
  }, []);

  return (
    <motion.div
      role="toolbar"
      aria-label="Selection actions"
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      className="glass-float fixed inset-x-4 bottom-[calc(96px+env(safe-area-inset-bottom,0px))] z-[var(--z-bar)] mx-auto flex w-fit max-w-[calc(100%-32px)] items-center gap-2 rounded-full p-1.5 pl-4 md:bottom-6"
    >
      <span className="type-label whitespace-nowrap text-ink tabular-nums">{count} {noun}</span>
      <div className="flex min-w-0 items-center gap-1 overflow-x-auto no-scrollbar">{children}</div>
      <IconButton icon="close" label="Clear selection" onPress={onClear} />
    </motion.div>
  );
};
