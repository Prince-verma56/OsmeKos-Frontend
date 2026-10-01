"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { gsap } from "@/storefront/lib/gsap";
import { useUI } from "@/storefront/store/ui";

/**
 * A masthead rule, not a sales banner: it idles at a slow drift and picks up
 * speed with scroll velocity, easing through zero when the user reverses so
 * the strip reads as something with mass rather than a switch being thrown.
 *
 * Runs on the shared gsap.ticker — never its own rAF loop.
 */
export default function VelocityMarquee({
  children,
  className = "",
  speed = 28,
  reverse = false,
}: {
  children: ReactNode;
  className?: string;
  /** Idle drift in px/s. */
  speed?: number;
  reverse?: boolean;
}) {
  const track = useRef<HTMLDivElement>(null);
  const [reduced, setReduced] = useState(false);

  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    const sync = () => setReduced(mq.matches);
    sync();
    mq.addEventListener("change", sync);
    return () => mq.removeEventListener("change", sync);
  }, []);

  useEffect(() => {
    const el = track.current;
    if (!el || reduced) return;

    // Measure after fonts resolve, or the loop point is wrong and the strip
    // visibly jumps when the webfont swaps in.
    let half = el.scrollWidth / 2;
    const measure = () => {
      half = el.scrollWidth / 2;
    };
    document.fonts.ready.then(measure);
    const ro = new ResizeObserver(measure);
    ro.observe(el);

    const base = reverse ? -1 : 1;
    let x = 0;
    let current = base * speed;

    // quickSetter skips the per-frame property parse that gsap.set() repeats.
    // Three of these strips run on the homepage, every frame, forever.
    const setX = gsap.quickSetter(el, "x", "px");

    const tick = (_t: number, dt: number) => {
      const lenis = useUI.getState().lenis;
      const v = lenis?.velocity ?? 0;
      const dir = lenis && lenis.direction ? (lenis.direction > 0 ? 1 : -1) : 1;
      const target = base * dir * (speed + Math.min(Math.abs(v) * 26, 520));

      // Glide toward the target over ~220ms instead of snapping.
      current += (target - current) * Math.min(1, dt / 220);
      x -= (current * dt) / 1000;
      if (half > 0) {
        if (x <= -half) x += half;
        if (x > 0) x -= half;
      }
      setX(x);
    };

    // A strip the user cannot see still costs a transform write and a style
    // recalc on every frame. Park it while it is off screen; nothing about the
    // visible result changes, because there is no visible result.
    let running = false;
    const run = (on: boolean) => {
      if (on === running) return;
      running = on;
      if (on) gsap.ticker.add(tick);
      else gsap.ticker.remove(tick);
    };

    const io = new IntersectionObserver(([entry]) => run(entry.isIntersecting), {
      rootMargin: "200px 0px",
    });
    io.observe(el);

    return () => {
      io.disconnect();
      run(false);
      ro.disconnect();
    };
  }, [speed, reverse, reduced]);

  // Static, wrapped, centred — every term still readable, nothing moving.
  if (reduced) {
    return (
      <div className={className}>
        <div className="container-x flex flex-wrap items-center justify-center gap-x-10 gap-y-2 py-4">
          {children}
        </div>
      </div>
    );
  }

  return (
    <div className={`overflow-hidden ${className}`}>
      <div ref={track} className="flex w-max will-change-transform">
        <div className="flex shrink-0 items-center">{children}</div>
        <div className="flex shrink-0 items-center" aria-hidden>
          {children}
        </div>
      </div>
    </div>
  );
}
