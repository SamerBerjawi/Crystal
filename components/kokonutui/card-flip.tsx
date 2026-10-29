/**
 * @author: @dorianbaffier
 * @description: Card Flip (3D / Reduced-Motion Crossfade Interactive Card)
 * @version: 1.0.0
 * @date: 2026-10-28
 * @license: MIT
 * @website: https://kokonutui.com
 * @github: https://github.com/kokonut-labs/kokonutui
 *
 * Crystal port (UI_UX_DESIGN_REFERENCE.md §4.3, D13):
 * - Interactive 2-sided card for the Card Wallet rail on `/accounts-new` and Credit Card detail on `/accounts-new/:id`.
 * - Strictly uses `nv-*` tokens and `NvIcon`.
 * - Accessible flip button (`aria-pressed`, keyboard Enter/Space) and `aria-hidden` on the inactive face so screen
 *   readers and focus order only traverse the visible side.
 * - Respects `prefers-reduced-motion` by switching from a 3D Y-axis spring rotation to a clean opacity crossfade.
 */

import React, { useCallback, useState } from 'react';
import { motion, useReducedMotion } from 'motion/react';
import { cn } from '../../lib/utils';
import { NvIcon } from '../new/NvIcon';

export interface CardFlipProps {
  /** Content rendered on the front face of the card. */
  front: React.ReactNode;
  /** Content rendered on the back face of the card. */
  back: React.ReactNode;
  /** Controlled flip state. Omit for uncontrolled mode. */
  flipped?: boolean;
  /** Called when the user flips the card. */
  onFlipChange?: (flipped: boolean) => void;
  /** Accessible label for the flip toggle button. */
  flipLabel?: string;
  /** Optional click handler when clicking the main body of the front face (e.g. open account detail). */
  onSelect?: () => void;
  /** Fixed height class for the card container (defaults to `h-52`). */
  heightClassName?: string;
  className?: string;
}

export const CardFlip: React.FC<CardFlipProps> = ({
  front,
  back,
  flipped: controlledFlipped,
  onFlipChange,
  flipLabel = 'Flip card to view details',
  onSelect,
  heightClassName = 'h-52',
  className,
}) => {
  const [internalFlipped, setInternalFlipped] = useState(false);
  const isFlipped = controlledFlipped ?? internalFlipped;
  const reduceMotion = useReducedMotion();

  const toggleFlip = useCallback(
    (e?: React.MouseEvent | React.KeyboardEvent) => {
      e?.stopPropagation();
      const next = !isFlipped;
      if (controlledFlipped === undefined) {
        setInternalFlipped(next);
      }
      onFlipChange?.(next);
    },
    [controlledFlipped, isFlipped, onFlipChange]
  );

  return (
    <div
      className={cn('group relative w-full select-none', heightClassName, className)}
      style={reduceMotion ? undefined : { perspective: '1200px' }}
    >
      <motion.div
        className="relative h-full w-full rounded-nv-card"
        style={reduceMotion ? undefined : { transformStyle: 'preserve-3d' }}
        animate={
          reduceMotion
            ? { rotateY: 0 }
            : { rotateY: isFlipped ? 180 : 0 }
        }
        transition={
          reduceMotion
            ? { duration: 0 }
            : { type: 'spring', stiffness: 260, damping: 26, mass: 0.9 }
        }
      >
        {/* Front Face */}
        <div
          aria-hidden={isFlipped}
          onClick={onSelect ? () => { if (!isFlipped) onSelect(); } : undefined}
          role={onSelect && !isFlipped ? 'button' : undefined}
          tabIndex={onSelect && !isFlipped ? 0 : -1}
          onKeyDown={
            onSelect && !isFlipped
              ? e => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    onSelect();
                  }
                }
              : undefined
          }
          className={cn(
            'absolute inset-0 flex flex-col justify-between overflow-hidden rounded-nv-card p-5 transition-opacity duration-200 outline-none focus-visible:ring-2 focus-visible:ring-nv-violet',
            onSelect && !isFlipped && 'cursor-pointer',
            isFlipped ? 'pointer-events-none opacity-0' : 'opacity-100'
          )}
          style={reduceMotion ? undefined : { backfaceVisibility: 'hidden' }}
        >
          {front}
        </div>

        {/* Back Face */}
        <div
          aria-hidden={!isFlipped}
          onClick={onSelect ? () => { if (isFlipped) onSelect(); } : undefined}
          role={onSelect && isFlipped ? 'button' : undefined}
          tabIndex={onSelect && isFlipped ? 0 : -1}
          onKeyDown={
            onSelect && isFlipped
              ? e => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    onSelect();
                  }
                }
              : undefined
          }
          className={cn(
            'absolute inset-0 flex flex-col justify-between overflow-hidden rounded-nv-card p-5 transition-opacity duration-200 outline-none focus-visible:ring-2 focus-visible:ring-nv-violet',
            onSelect && isFlipped && 'cursor-pointer',
            isFlipped ? 'opacity-100' : 'pointer-events-none opacity-0'
          )}
          style={
            reduceMotion
              ? undefined
              : { backfaceVisibility: 'hidden', transform: 'rotateY(180deg)' }
          }
        >
          {back}
        </div>
      </motion.div>

      {/* Accessible Flip Trigger Button (Top-Right Corner) */}
      <button
        type="button"
        aria-label={flipLabel}
        aria-pressed={isFlipped}
        title={isFlipped ? 'Show card front' : 'Flip for specs & cycles'}
        onClick={toggleFlip}
        className="absolute right-3.5 top-3.5 z-dropdown inline-flex h-9 w-9 items-center justify-center rounded-full bg-nv-surface text-nv-ink transition-transform after:absolute after:-inset-1 after:content-[''] hover:bg-nv-inset active:scale-95"
      >
        <NvIcon name="repeat" size={16} />
      </button>
    </div>
  );
};

export default CardFlip;
