"use client";

import { useRef } from "react";
import { gsap, useGSAP } from "@/storefront/lib/gsap";
import { MARQUEE_HOME } from "@/storefront/lib/content";
import VelocityMarquee from "@/storefront/components/fx/VelocityMarquee";
import { outfit } from "@/app/fonts";

export default function TapeMarquee() {
  const ref = useRef<HTMLElement>(null);
  
  useGSAP(
    () => {
      const el = ref.current;
      if (!el) return;
      
      const mm = gsap.matchMedia();
      
      mm.add("(prefers-reduced-motion: no-preference)", () => {
        // Tapes entry animations
        gsap.fromTo(
          ".tape-1",
          { xPercent: -15, autoAlpha: 0, rotation: 0 },
          { 
            xPercent: 0, 
            autoAlpha: 1, 
            rotation: -3, 
            duration: 1.2, 
            ease: "power3.out",
            scrollTrigger: {
              trigger: el,
              start: "top 85%",
            }
          }
        );
        
        gsap.fromTo(
          ".tape-2",
          { xPercent: 15, autoAlpha: 0, rotation: 0 },
          { 
            xPercent: 0, 
            autoAlpha: 1, 
            rotation: 3, 
            duration: 1.2, 
            ease: "power3.out",
            scrollTrigger: {
              trigger: el,
              start: "top 85%",
            }
          }
        );

        // Parallax scroll for the tapes container to give it depth
        gsap.to(".tapes-container", {
          yPercent: -5,
          ease: "none",
          scrollTrigger: {
            trigger: el,
            start: "top bottom",
            end: "bottom top",
            scrub: true,
          }
        });
      });
      
      return () => mm.revert();
    },
    { scope: ref }
  );

  // We reverse the array for the second tape so they don't look identical
  const REVERSED_MARQUEE = [...MARQUEE_HOME].reverse();

  return (
    <section ref={ref} className="relative z-20 flex h-[220px] md:h-[320px] w-full flex-col items-center justify-center overflow-hidden -mb-16 md:-mb-32 pointer-events-none">
      
      {/* Premium Frosted Glass Blend Effect (faded at the bottom to blend with Intro) */}
      <div className="absolute inset-0 bg-cream/10 backdrop-blur-[30px] [mask-image:linear-gradient(to_bottom,black_10%,black_70%,transparent)] -z-10" />
      <div className="absolute inset-0 bg-gradient-to-b from-transparent via-sand/40 to-transparent -z-10" />

      <div className="tapes-container relative flex w-full flex-1 items-center justify-center pointer-events-auto">
        {/* Tape 1: Dark, Angled Up */}
        <div className="tape-1 absolute z-10 w-[105%] -rotate-[3deg] bg-ink py-4 md:py-6 shadow-xl will-change-transform">
          <VelocityMarquee speed={35}>
            {MARQUEE_HOME.map((word) => (
              <span
                key={word}
                className={`flex items-center gap-12 md:gap-16 pr-12 md:pr-16 text-[20px] md:text-[28px] font-semibold uppercase tracking-[0.25em] text-cream ${outfit.className}`}
              >
                {word}
                <span aria-hidden className="h-2 w-2 md:h-2.5 md:w-2.5 rounded-full bg-gold" />
              </span>
            ))}
          </VelocityMarquee>
        </div>

        {/* Tape 2: Sand, Angled Down */}
        <div className="tape-2 absolute z-20 w-[105%] rotate-[3deg] bg-[#cfc1ac] py-4 md:py-6 shadow-xl will-change-transform">
          <VelocityMarquee speed={35} reverse>
            {REVERSED_MARQUEE.map((word, i) => (
              <span
                key={word + i}
                className={`flex items-center gap-12 md:gap-16 pr-12 md:pr-16 text-[20px] md:text-[28px] font-semibold uppercase tracking-[0.25em] text-ink ${outfit.className}`}
              >
                {word}
                <span aria-hidden className="h-2 w-2 md:h-2.5 md:w-2.5 rounded-full bg-ink/20" />
              </span>
            ))}
          </VelocityMarquee>
        </div>
      </div>
      
    </section>
  );
}
