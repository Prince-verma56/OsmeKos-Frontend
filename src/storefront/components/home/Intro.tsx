"use client";

import { useRef } from "react";
import { outfit } from "@/app/fonts";
import { gsap, useGSAP } from "@/storefront/lib/gsap";
import { EASE, MQ, STAGGER, START } from "@/storefront/lib/motion";
import { INTRO } from "@/storefront/lib/content";
import SplitReveal from "@/storefront/components/ui/SplitReveal";
import Reveal from "@/storefront/components/ui/Reveal";

import Image from "next/image";
import Button from "@/storefront/components/ui/Button";
import Magnetic from "@/storefront/components/ui/Magnetic";

export default function Intro() {
  const ref = useRef<HTMLElement>(null);

  useGSAP(
    () => {
      const el = ref.current;
      if (!el) return;
      const mm = gsap.matchMedia();

      mm.add(MQ.motion, () => {
        const trigger = { trigger: ".benefits", start: START, once: true } as const;

        // Fast, subtle background parallax without heavy cropping
        gsap.fromTo(
          ".intro-bg",
          { yPercent: -5, scale: 1.03 },
          {
            yPercent: 5,
            scale: 1.03,
            ease: "none",
            scrollTrigger: {
              trigger: el,
              start: "top bottom",
              end: "bottom top",
              scrub: true,
            },
          }
        );

        gsap.from(".benefit-line", {
          scaleX: 0,
          transformOrigin: "left",
          stagger: STAGGER.loose,
          duration: 1.2,
          ease: EASE.expo,
          scrollTrigger: trigger,
        });
        gsap.from(".benefit-figure", {
          y: 20,
          autoAlpha: 0,
          stagger: STAGGER.loose,
          duration: 1,
          delay: 0.1,
          ease: EASE.expo,
          scrollTrigger: trigger,
        });
        gsap.from(".benefit-body", {
          y: 24,
          autoAlpha: 0,
          stagger: STAGGER.loose,
          duration: 1,
          delay: 0.18,
          ease: EASE.expo,
          scrollTrigger: trigger,
        });
      });

      mm.add(MQ.reduced, () => {
        gsap.set(".benefit-line", { scaleX: 1 });
        gsap.set(".benefit-figure, .benefit-body", { autoAlpha: 1, y: 0 });
      });

      return () => mm.revert();
    },
    { scope: ref },
  );

  return (
    <section ref={ref} className="section relative flex items-center border-t border-line/5 w-full lg:aspect-[16/9] min-h-[800px] lg:min-h-0 py-24 md:py-32 lg:py-0">
      <div className="absolute inset-0 overflow-hidden z-0">
        <Image
          src="/Images/BG%20Images/DailyCareBg.webp"
          alt="Daily Care Flowing Cream"
          fill
          sizes="100vw"
          className="intro-bg object-cover object-center"
        />
        <div className="absolute inset-0 bg-white/10 md:bg-transparent pointer-events-none" />
      </div>

      <div className="container-x relative z-10 w-full h-full">
        <div className="grid gap-16 lg:grid-cols-12 h-full">
          {/* Left Column - Anchored HIGH UP to avoid the bottom cream swirl */}
          <div className="lg:col-span-4 lg:col-start-2 flex flex-col justify-start self-start pt-24 lg:pt-[8vw]">
            <Reveal>
              <p className="eyebrow">{INTRO.eyebrow}</p>
            </Reveal>
            <SplitReveal className={`display mt-4 text-[3.5rem] lg:text-[4.5rem] font-bold leading-[0.95] tracking-tight text-ink ${outfit.className}`}>
              Built to work <span className={`text-gold-3 italic font-medium pr-1 ${outfit.className}`}>with</span> your skin.
            </SplitReveal>
            <Reveal delay={0.2}>
              <p className="lead mt-6 max-w-[30ch] text-ink-2 font-medium ml-4 md:ml-12 lg:ml-16 border-l-2 border-gold-2/30 pl-4">{INTRO.lead}</p>
            </Reveal>
            <Reveal delay={0.4}>
              <div className="mt-8 ml-4 md:ml-12 lg:ml-16">
                <Magnetic className="inline-block">
                  <Button href="/ingredients" arrow className="bg-[#1A1814] text-cream hover:bg-black border-none px-8 py-4 rounded-full text-xs tracking-[0.2em] uppercase font-bold shadow-2xl">
                    EXPLORE INGREDIENTS
                  </Button>
                </Magnetic>
              </div>
            </Reveal>
          </div>

          {/* Right Column - Shifted massively right to completely clear the coconut */}
          <ul className="benefits lg:col-span-4 lg:col-start-9 flex flex-col justify-center h-full lg:pt-[2%] lg:pl-12 xl:pl-16">
            {INTRO.benefits.map(({ pct, extra, title, text }) => (
              <li key={title} className="relative py-8 lg:py-10 first:pt-0 last:pb-0">
                <span aria-hidden className="benefit-line absolute inset-x-0 top-0 h-px bg-ink/10" />
                <div className="flex flex-col gap-2 sm:flex-row sm:gap-6 lg:gap-8">
                  <p className="benefit-figure flex shrink-0 items-baseline gap-2 sm:w-[5rem] sm:flex-col sm:gap-0">
                    <span className={`num display text-[2.5rem] leading-none text-gold-2 ${outfit.className}`}>{pct}</span>
                    {extra && (
                      <span className="num mt-1 text-[13px] font-semibold text-muted">{extra}</span>
                    )}
                  </p>
                  <div className="benefit-body">
                    <h3 className={`display text-[1.75rem] md:text-[2rem] font-semibold text-ink ${outfit.className}`}>{title}</h3>
                    <p className="mt-2 max-w-[36ch] text-[14px] leading-relaxed text-ink-2 font-medium">{text}</p>
                  </div>
                </div>
              </li>
            ))}
          </ul>
        </div>
      </div>

      {/* Premium Blur Separator to blend with the section below */}
      <div className="absolute inset-x-0 bottom-0 h-48 lg:h-64 bg-gradient-to-t from-sand/80 via-sand/30 to-transparent backdrop-blur-2xl z-20 [mask-image:linear-gradient(to_top,black_10%,transparent_90%)]" />
    </section>
  );
}
