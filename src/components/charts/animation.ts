import type { Transition } from "motion/react";

/** Default clip-reveal easing for cartesian charts. */
export const DEFAULT_ANIMATION_EASING = "cubic-bezier(0.645, 0.045, 0.355, 1)";

export const DEFAULT_ANIMATION_DURATION_MS = 1400;

/** Default enter transition — matches the original line chart reveal. */
export const DEFAULT_CHART_ENTER_TRANSITION: Transition = {
  type: "tween",
  duration: DEFAULT_ANIMATION_DURATION_MS / 1000,
  ease: [0.645, 0.045, 0.355, 1],
};

/** Bars grow from the baseline, one after another. */
export const BAR_ENTER_TRANSITION: Transition = { type: "tween", duration: 0.9, ease: [0.165, 0.84, 0.44, 1] };
export const BAR_STAGGER_SECONDS = 0.035;

/** Donuts and rings sweep round. */
export const ARC_ENTER_TRANSITION: Transition = { type: "tween", duration: 1, ease: [0.77, 0, 0.175, 1] };

const isAnimationActive = typeof window === "undefined" || !window.matchMedia("(prefers-reduced-motion: reduce)").matches;

/** The same timing for the charts still drawn with Recharts. */
export const LINE_MOTION = { isAnimationActive, animationDuration: DEFAULT_ANIMATION_DURATION_MS, animationEasing: "ease-in-out" } as const;
export const BAR_MOTION = { isAnimationActive, animationDuration: 900, animationEasing: "ease-out" } as const;
export const ARC_MOTION = { isAnimationActive, animationDuration: 1000, animationEasing: "ease-in-out" } as const;

/**
 * Clip-path width reveal must use tween — spring does not reliably animate SVG width.
 */
export function clipRevealTransition(enterTransition?: Transition): Transition {
  if (enterTransition?.type === "tween") {
    return {
      ...enterTransition,
      ease: enterTransition.ease ?? DEFAULT_CHART_ENTER_TRANSITION.ease,
    };
  }

  const duration =
    typeof enterTransition?.duration === "number"
      ? enterTransition.duration
      : DEFAULT_ANIMATION_DURATION_MS / 1000;

  return {
    type: "tween",
    duration,
    ease: DEFAULT_CHART_ENTER_TRANSITION.ease,
  };
}
