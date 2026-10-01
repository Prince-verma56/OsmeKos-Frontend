"use client";

import { useRef } from "react";
import { gsap, useGSAP } from "@/storefront/lib/gsap";
import { useUI } from "@/storefront/store/ui";
import { outfit } from "@/app/fonts";

export default function Preloader() {
  const ref     = useRef<HTMLDivElement>(null);
  const textRef = useRef<HTMLSpanElement>(null); // single text — no duplicate
  const numRef  = useRef<HTMLSpanElement>(null);
  const barRef  = useRef<HTMLDivElement>(null);

  const setLoaded = useUI((s) => s.setLoaded);

  useGSAP(
    () => {
      const el = ref.current!;
      const text = textRef.current!;
      const num = numRef.current!;
      const bar = barRef.current!;
      const counter = { v: 0 };

      // This panel covers the whole viewport. If anything stops the sequence
      // short the site is simply gone, so lifting it is made unconditional:
      // every exit path runs through finish(), and a watchdog runs it anyway.
      let done = false;
      const finish = () => {
        if (done) return;
        done = true;
        setLoaded(true);
        el.style.display = "none";
      };
      const watchdog = setTimeout(finish, 6000);

      // A panel that comes and goes inside a few frames reads as a flash rather
      // than an introduction, so both motion paths below are built to stay up
      // for at least a second: ~1.35s returning, ~3.6s on a first visit.

      // One value drives the counter, the bar and the gradient boundary, so
      // the three can never disagree about how far along the load is.
      const setProgress = (v: number) => {
        const pct = Math.round(v);
        num.textContent = String(pct).padStart(3, "0") + "%";
        text.style.setProperty("--fill-pct", `${v}%`);
        bar.style.transform = `scaleX(${v / 100})`;
      };
      setProgress(0);

      let seen = false;
      try {
        seen = sessionStorage.getItem("osmekos-seen") === "1";
        sessionStorage.setItem("osmekos-seen", "1");
      } catch {}

      // A full-screen wipe is a vestibular trigger and the counter has nothing
      // to report. Reduced motion gets the content, not the overture.
      if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
        setProgress(100);
        gsap.to(el, { autoAlpha: 0, duration: 0.25, ease: "none", onComplete: finish });
        return () => clearTimeout(watchdog);
      }

      // Returning within the session: no counter to replay, but the panel
      // still holds past MIN_VISIBLE so the lift reads as a move rather than
      // a cut, and power3 keeps it from snapping through the middle the way
      // expo.inOut did.
      if (seen) {
        setProgress(100);
        gsap
          .timeline({ onComplete: finish })
          .to(el, { yPercent: -100, duration: 1.05, ease: "power3.inOut" }, 0.3)
          .to(".pl-inner", { yPercent: 28, duration: 1.05, ease: "power3.inOut" }, "<");
        return () => clearTimeout(watchdog);
      }

      const tl = gsap.timeline({ defaults: { ease: "power3.out" }, onComplete: finish });

      tl.from(".pl-meta", { autoAlpha: 0, y: 12, duration: 0.9, stagger: 0.12 }, 0.1)
        .from(text, { autoAlpha: 0, y: 26, duration: 1.2 }, 0.1)
        // power1.inOut holds a near-constant rate through the middle, so the
        // fill, the bar and the counter sweep instead of stalling at both ends.
        .to(
          counter,
          {
            v: 100,
            duration: 1.9,
            ease: "power1.inOut",
            onUpdate: () => setProgress(counter.v),
          },
          0.35,
        )
        // Overlapped, not queued: the panel starts leaving while the labels are
        // still going, which is what makes the exit read as one movement.
        .to(".pl-meta", { autoAlpha: 0, y: -12, duration: 0.6, ease: "power2.in" }, "-=0.25")
        .to(el, { yPercent: -100, duration: 1.3, ease: "power3.inOut" }, "-=0.35")
        .to(".pl-inner", { yPercent: 28, duration: 1.3, ease: "power3.inOut" }, "<");

      return () => clearTimeout(watchdog);
    },
    { scope: ref },
  );

  return (
    <div ref={ref} className="fixed inset-0 z-[400] overflow-hidden bg-cream text-ink">

      {/* corner reticles */}
      <div className="pointer-events-none absolute left-6  top-6    h-8 w-8 border-l-2 border-t-2 border-gold/30 md:left-10 md:top-10"    />
      <div className="pointer-events-none absolute right-6 top-6    h-8 w-8 border-r-2 border-t-2 border-gold/30 md:right-10 md:top-10"   />
      <div className="pointer-events-none absolute left-6  bottom-6 h-8 w-8 border-l-2 border-b-2 border-gold/30 md:left-10 md:bottom-10" />
      <div className="pointer-events-none absolute right-6 bottom-6 h-8 w-8 border-r-2 border-b-2 border-gold/30 md:right-10 md:bottom-10"/>

      <div className="pl-inner flex h-full flex-col justify-between px-10 py-10 md:px-16 md:py-14">

        {/* top label */}
        <p className={`pl-meta flex items-center gap-3 text-xs font-semibold uppercase tracking-[0.22em] text-muted ${outfit.className}`}>
          <span className="inline-block h-px w-5 bg-gold/40" />
          Skincare Essentials
        </p>

        {/* brand name — single centered text, fills via CSS gradient */}
        <div className="pl-text-wrap w-full select-none text-center">
          <span
            ref={textRef}
            className={`inline-block font-bold leading-none tracking-tighter ${outfit.className}`}
            style={{
              fontSize: "clamp(54px, 13vw, 168px)",
              // gradient: left = solid ink, right = faint ink/10
              // --fill-pct drives the fill boundary left to right
              background: "linear-gradient(to right, #1c1612 var(--fill-pct, 0%), rgba(28,22,18,0.10) var(--fill-pct, 0%))",
              WebkitBackgroundClip: "text",
              backgroundClip: "text",
              WebkitTextFillColor: "transparent",
              color: "transparent",
            } as React.CSSProperties}
          >
            OsmeKos
          </span>
        </div>

        {/* bottom row */}
        <div className="flex items-end justify-between">
          <p className={`pl-meta flex items-center gap-3 text-xs font-semibold uppercase tracking-[0.22em] text-muted ${outfit.className}`}>
            <span className="inline-block h-px w-5 bg-gold/40" />
            Nourish · Hydrate · Soften
          </p>
          <span
            ref={numRef}
            className={`pl-num font-bold tabular-nums tracking-tighter text-gold-2 ${outfit.className}`}
            style={{ fontSize: "clamp(30px, 6vw, 80px)", lineHeight: 1 }}
          >
            000%
          </span>
        </div>

      </div>

      {/* progress bar */}
      <div
        ref={barRef}
        className="absolute bottom-0 left-0 h-[3px] w-full bg-gold-2"
        style={{ transform: "scaleX(0)", transformOrigin: "left center" }}
      />
    </div>
  );
}

