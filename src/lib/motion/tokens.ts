/**
 * @license SPDX-License-Identifier: Apache-2.0
 *
 * motion/tokens.ts — canonical Phase-1b homepage motion-budget tokens.
 *
 * Single source of truth for the homepage motion budget. Consumers (Home.tsx,
 * HomeCard, etc.) import durations / easings / staggers from here instead of
 * inlining their own literals. Values are byte-identical to the literals that
 * Home.tsx inlined before this module existed (zero visual drift):
 *
 *   EASE      [0.22, 1, 0.36, 1]     (Home.tsx line 50)
 *   stagger   staggerChildren 0.12   (Home.tsx lines 52-55)
 *              delayChildren 0.05
 *   fadeUp    y 26, duration 0.7     (Home.tsx lines 57-64)
 *   long-fade duration 0.9 / 0.8     (Home.tsx line ~222)
 *
 * Reduced-motion is honored in *code* here: consumers call useMotionTokens(),
 * which returns a reduced variant when prefers-reduced-motion is active, so
 * animation is collapsed even beyond the CSS-level block in globals.css:277.
 */

import { useReducedMotion } from 'motion/react';

/** Shared phase-1b motion budget. */
export const DURATIONS = {
  /** Base fade-up entrance. */
  base: 0.7,
  /** Secondary / background entrances. */
  long: 0.9,
  /** Hover / micro-interaction. */
  short: 0.2,
} as const;

/** Canonical easing curve: cubic-bezier(0.22, 1, 0.36, 1). */
export const EASE: readonly [number, number, number, number] = [0.22, 1, 0.36, 1];

/** Staggered-entrance budget shared by hero + grid blocks. */
export const STAGGER = {
  staggerChildren: 0.12,
  delayChildren: 0.05,
} as const;

/** Distances used by fade-up entrances, in px. */
export const DISTANCES = {
  /** fadeUp y. */
  fadeUp: 26,
} as const;

/**
 * Reduced-motion token set — returned by useMotionTokens() when the user
 * prefers reduced motion. Durations collapse to a near-instant fade and all
 * translation distances zero out, mirroring the globals.css:277 block in code.
 */
export const REDUCED_MOTION = {
  duration: 0.001,
  translate: 0,
  stagger: 0,
} as const;

export interface MotionTokens {
  duration: number;
  ease: readonly [number, number, number, number];
  staggerChildren: number;
  delayChildren: number;
  fadeUpY: number;
}

/** Standard tokens (no reduced motion). */
export const STANDARD_TOKENS: MotionTokens = {
  duration: DURATIONS.base,
  ease: EASE,
  staggerChildren: STAGGER.staggerChildren,
  delayChildren: STAGGER.delayChildren,
  fadeUpY: DISTANCES.fadeUp,
};

/** Reduced-motion tokens — instant fade, no translation, no stagger. */
export const REDUCED_TOKENS: MotionTokens = {
  duration: REDUCED_MOTION.duration,
  ease: EASE,
  staggerChildren: 0,
  delayChildren: 0,
  fadeUpY: 0,
};

/**
 * Returns the appropriate token set for the caller's motion preference.
 * Honor the result in code (conditionals, transition props), not only via CSS.
 */
export function getMotionTokens(reduced = false): MotionTokens {
  return reduced ? REDUCED_TOKENS : STANDARD_TOKENS;
}

export interface ProcuredMotion {
  duration: number;
  ease: readonly [number, number, number, number];
  staggerChildren: number;
  delayChildren: number;
  fadeUpY: number;
  reduceMotion: boolean;
}

/**
 * Hook that reads prefers-reduced-motion and returns the matching token set.
 * Use in components that own framer-motion variants so the homepage honors
 * reduced motion in code (Phase 1b requirement), not just at the CSS layer.
 */
export function useMotionTokens(): ProcuredMotion {
  const reduced = useReducedMotion();
  const tokens = getMotionTokens(reduced === true);
  return { ...tokens, reduceMotion: reduced === true };
}

/** Compatibility alias kept for existing callers. */
export const useReducedMotionTokens = useMotionTokens;
