"use client";

import { useRef } from "react";
import { gsap, useGSAP } from "@/storefront/lib/gsap";
import { MQ } from "@/storefront/lib/motion";

/** Thin gold bar at the very top that fills as the page scrolls. */
export default function ScrollProgress() {
  const ref = useRef<HTMLDivElement>(null);

  useGSAP(() => {
    const mm = gsap.matchMedia();
    mm.add(MQ.motion, () => {
      gsap.fromTo(
        ref.current,
        { scaleX: 0 },
        { scaleX: 1, ease: "none", scrollTrigger: { start: 0, end: "max", scrub: 0.3 } },
      );
    });
    mm.add(MQ.reduced, () => {
      gsap.set(ref.current, { autoAlpha: 0 });
    });
    return () => mm.revert();
  });

  return (
    <div
      ref={ref}
      aria-hidden
      className="pointer-events-none fixed left-0 top-0 z-[105] h-[3px] w-full origin-left bg-gradient-to-r from-gold-2 via-gold to-[#f3dc9c]"
    />
  );
}
