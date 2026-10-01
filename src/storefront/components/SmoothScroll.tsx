"use client";

import { useEffect } from "react";
import Lenis from "lenis";
import { usePathname } from "next/navigation";
import { gsap, ScrollTrigger } from "@/storefront/lib/gsap";
import { useUI } from "@/storefront/store/ui";

/**
 * Lenis, driven from gsap.ticker so the whole page runs on ONE rAF loop.
 * Order matters: lenis.raf() writes the scroll position, then synchronously
 * emits "scroll" -> ScrollTrigger.update(), so scrubs never lag a frame.
 *
 * Smooth scrolling is a common vestibular trigger, so under
 * prefers-reduced-motion Lenis is never instantiated and the browser scrolls
 * natively. Everything that reads `useUI.lenis` already tolerates null.
 */
export default function SmoothScroll() {
  const setLenis = useUI((s) => s.setLenis);
  const pathname = usePathname();

  useEffect(() => {
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)");
    let lenis: Lenis | null = null;
    let tick: ((time: number) => void) | null = null;

    const start = () => {
      if (lenis || reduce.matches) return;
      lenis = new Lenis({
        lerp: 0.085, // heavy, weighted glide — deliberate for this brand
        smoothWheel: true,
        syncTouch: false, // native momentum on touch beats anything we'd fake
        touchMultiplier: 1.6,
        anchors: { offset: -80 }, // clear the fixed navbar
        overscroll: false, // stops iOS rubber-band fighting the pinned gallery
      });
      setLenis(lenis);
      lenis.on("scroll", ScrollTrigger.update);
      tick = (time: number) => lenis?.raf(time * 1000);
      gsap.ticker.add(tick);
      gsap.ticker.lagSmoothing(0);
    };

    const stop = () => {
      if (tick) gsap.ticker.remove(tick);
      tick = null;
      lenis?.destroy();
      lenis = null;
      setLenis(null);
    };

    start();

    // Honour a mid-session change to the OS setting without a reload.
    const onPrefChange = () => {
      stop();
      start();
      ScrollTrigger.refresh();
    };
    reduce.addEventListener("change", onPrefChange);

    return () => {
      reduce.removeEventListener("change", onPrefChange);
      stop();
    };
  }, [setLenis]);

  // Refresh on real signals rather than a guessed timeout: pin start/end
  // positions are wrong if they are measured before fonts and images settle.
  useEffect(() => {
    const lenis = useUI.getState().lenis;
    if (lenis) lenis.scrollTo(0, { immediate: true });
    else window.scrollTo(0, 0);

    let frame = 0;
    // Baseline is re-read AFTER each refresh: refresh() lays out the gallery's
    // pin spacer, which changes body height, which the observer below would
    // otherwise read back as a fresh reason to refresh again.
    let lastHeight = document.body.offsetHeight;
    const refresh = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        ScrollTrigger.refresh();
        lastHeight = document.body.offsetHeight;
      });
    };

    document.fonts.ready.then(refresh);
    window.addEventListener("load", refresh);

    let timer: ReturnType<typeof setTimeout>;
    const ro = new ResizeObserver(() => {
      // Only a real change in document height can move a trigger's start/end.
      // Width is already handled by ScrollTrigger's own resize listener, and
      // sub-pixel reflow noise is not worth re-measuring every trigger for.
      const height = document.body.offsetHeight;
      if (Math.abs(height - lastHeight) < 8) return;
      lastHeight = height;
      clearTimeout(timer);
      timer = setTimeout(refresh, 150); // refresh() is expensive; debounce it
    });
    ro.observe(document.body);

    return () => {
      cancelAnimationFrame(frame);
      clearTimeout(timer);
      ro.disconnect();
      window.removeEventListener("load", refresh);
    };
  }, [pathname]);

  return null;
}
