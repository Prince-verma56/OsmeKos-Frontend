/**
 * Shared motion vocabulary for the storefront.
 *
 * Every duration, ease and stagger in the site resolves to one of these, so
 * the whole page reads as a single motion system rather than a collection of
 * independently tuned components.
 *
 * See osmekos_brain/07_MOTION_PRINCIPLES.md.
 */

/** Seconds. Mirrors --dur-* in store.css. */
export const DUR = {
  micro: 0.18,
  ui: 0.4,
  reveal: 1.1,
  scene: 1.6,
} as const;

export const EASE = {
  /** Entrances. Long tail, no overshoot. */
  expo: 'expo.out',
  /** Symmetric moves (open/close of the same element). */
  smooth: 'power2.inOut',
  /** Departures — faster than the matching entrance. */
  exit: 'power2.in',
  /** UI micro-moves. */
  glide: 'power2.out',
  /** Scrub only; the scroll supplies the easing. */
  none: 'none',
} as const;

export const STAGGER = {
  tight: 0.04,
  normal: 0.08,
  loose: 0.14,
} as const;

/**
 * Single trigger point for every section reveal. The site previously used six
 * different values, which made sections feel arbitrarily timed.
 */
export const START = 'top 82%';

/** Short elements sitting near the viewport bottom (counters, footers). */
export const START_LATE = 'top 90%';

const mq = (query: string) =>
  typeof window !== 'undefined' && window.matchMedia(query).matches;

export const prefersReduced = () => mq('(prefers-reduced-motion: reduce)');

export const isCoarse = () => mq('(pointer: coarse)');

/**
 * matchMedia conditions used with gsap.matchMedia(). Pairing `MOTION` with a
 * `REDUCED` branch is the standard shape for every animated component:
 *
 *   const mm = gsap.matchMedia();
 *   mm.add(MQ.motion, () => { ...animation... });
 *   mm.add(MQ.reduced, () => { ...final state... });
 *   return () => mm.revert();
 */
export const MQ = {
  /** Animate only when the user has not asked for reduced motion. */
  motion: '(prefers-reduced-motion: no-preference)',
  reduced: '(prefers-reduced-motion: reduce)',
  /** Desktop editorial grid, motion allowed. */
  desktopMotion: '(min-width: 1024px) and (prefers-reduced-motion: no-preference)',
  /** Tablet-and-up, motion allowed — used by the pinned gallery. */
  wideMotion: '(min-width: 768px) and (prefers-reduced-motion: no-preference)',
  /** Anything that must fall back to a static stacked layout. */
  stacked: '(max-width: 1023px), (prefers-reduced-motion: reduce)',
  stackedNarrow: '(max-width: 767px), (prefers-reduced-motion: reduce)',
  /** Parallax is disabled below this width — short viewports play scrubs too fast. */
  parallax: '(min-width: 768px) and (prefers-reduced-motion: no-preference)',
} as const;
