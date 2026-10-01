"use client";

import Image from "next/image";
import { useRef, useState } from "react";
import { gsap, useGSAP } from "@/storefront/lib/gsap";
import { EASE, MQ, STAGGER, START } from "@/storefront/lib/motion";
import {
  motion,
  type MotionValue,
  MotionConfig,
  useScroll,
  useTransform,
  useMotionValueEvent,
  AnimatePresence,
} from "framer-motion";
import { SHOWCASE } from "@/storefront/lib/content";
import { outfit } from "@/app/fonts";

const StickyCard_001 = ({
  p,
  i,
  progress,
}: {
  p: (typeof SHOWCASE)[number];
  i: number;
  progress: MotionValue<number>;
}) => {
  // exact math from skiper16.tsx
  const targetScale = Math.max(0.5, 1 - (SHOWCASE.length - i - 1) * 0.1);
  const range: [number, number] = [i * (1 / SHOWCASE.length), 1];
  const scale = useTransform(progress, range, [1, targetScale]);

  return (
    <div className="sticky top-0 h-screen flex items-center justify-center w-full">
      <motion.div
        style={{
          scale,
          top: `calc(${i * 20}px)`,
        }}
        // Elegantly integrated into the theme without a harsh border, using a subtle tinted glow
        className="relative aspect-[3/4] w-full max-w-[480px] overflow-hidden rounded-[2.5rem] bg-transparent shadow-[0_30px_60px_rgba(202,176,140,0.25)] origin-top"
      >
        <Image
          src={p.image}
          alt={p.title}
          fill
          quality={85}
          loading="lazy"
          sizes="(max-width: 1024px) 90vw, 45vw"
          className="object-cover"
        />
      </motion.div>
    </div>
  );
};

export default function Showcase() {
  const container = useRef<HTMLElement>(null);
  const { scrollYProgress } = useScroll({
    target: container,
    offset: ["start start", "end end"],
  });

  const [activeIndex, setActiveIndex] = useState(0);

  // The stacked-card choreography is desktop-only; below lg the section was a
  // plain static list. Give the mobile layout the same arrival the rest of the
  // page has.
  useGSAP(
    () => {
      const mm = gsap.matchMedia();

      mm.add(MQ.motion, () => {
        gsap.from(".sc-m-head > *", {
          y: 24,
          autoAlpha: 0,
          filter: "blur(4px)",
          clearProps: "filter",
          duration: 1.1,
          ease: EASE.expo,
          stagger: STAGGER.normal,
          scrollTrigger: { trigger: ".sc-m-head", start: START, once: true },
        });
        gsap.from(".sc-m-card", {
          y: 36,
          autoAlpha: 0,
          duration: 1.1,
          ease: EASE.expo,
          stagger: STAGGER.loose,
          scrollTrigger: { trigger: ".sc-m-list", start: START, once: true },
        });
      });

      mm.add(MQ.reduced, () => {
        gsap.set(".sc-m-head > *, .sc-m-card", { autoAlpha: 1, y: 0, filter: "none" });
      });

      return () => mm.revert();
    },
    { scope: container },
  );

  useMotionValueEvent(scrollYProgress, "change", (latest) => {
    // Determine which of the 3 items is currently active
    const index = Math.min(
      SHOWCASE.length - 1,
      Math.floor(latest * SHOWCASE.length)
    );
    if (index !== activeIndex) {
      setActiveIndex(index);
    }
  });

  return (
    // reducedMotion="user" drops the transform half of the crossfade and keeps
    // the opacity half, so the copy still changes with the stack but nothing
    // slides. The scroll-linked card scale is the section's layout, not an
    // embellishment, so it is left alone.
    <MotionConfig reducedMotion="user">
    <section ref={container} className="relative w-full pb-24 md:pb-0 -mt-[15vh] z-20">
      
      {/* Pure Blur Separator straddling the boundary to elegantly combine the sections */}
      <div className="absolute inset-x-0 top-[-10vh] h-[20vh] backdrop-blur-[40px] z-20 [mask-image:linear-gradient(to_bottom,transparent_0%,black_30%,black_70%,transparent_100%)]" />

      {/* Pinned Background Image */}
      <div className="absolute inset-0 z-0 pointer-events-none">
        <div className="sticky top-0 h-screen w-full">
          <Image
            src="/Images/BG%20Images/ShowCaseBG.webp"
            alt="Showcase Background"
            fill
            className="object-cover object-center"
            quality={90}
          />
        </div>
      </div>

      {/* Desktop Version: Skiper16 Pinned Layout */}
      <div className="hidden lg:grid container-x grid-cols-12 gap-10 relative items-start z-10">
        
        {/* Left Column: Pinned Text that Crossfades cleanly */}
        <div className="col-span-5 lg:pl-12 xl:pl-20 relative h-[300vh]">
          <div className="sticky top-0 h-screen flex flex-col justify-center">
            <div className="relative p-10 -ml-10 rounded-[2.5rem] backdrop-blur-md bg-white/40 border border-white/50 shadow-[0_8px_32px_rgba(0,0,0,0.06)] max-w-[540px]">
              <AnimatePresence mode="wait">
                <motion.div 
                  key={activeIndex}
                  initial={{ opacity: 0, y: 15 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -15 }}
                  transition={{ duration: 0.3, ease: "easeOut" }}
                  className="flex flex-col"
                >
                  <p className={`text-gold-3 text-sm font-semibold tracking-[0.2em] uppercase ${outfit.className}`}>
                    {SHOWCASE[activeIndex].n} / 0{SHOWCASE.length}
                  </p>
                  <h3 className={`mt-5 text-[3.5rem] leading-[1.05] font-bold text-ink tracking-tight ${outfit.className}`}>
                    {SHOWCASE[activeIndex].title}
                  </h3>
                  <p className="mt-6 max-w-[42ch] text-[16px] leading-relaxed text-ink-2 font-medium">
                    {SHOWCASE[activeIndex].text}
                  </p>
                </motion.div>
              </AnimatePresence>
            </div>
          </div>
        </div>

        {/* Right Column: Skiper16 Sticky Image Stack */}
        <div className="col-span-6 col-start-7 lg:pr-10 xl:pr-16 relative">
          {SHOWCASE.map((p, i) => (
            <StickyCard_001 key={i} p={p} i={i} progress={scrollYProgress} />
          ))}
        </div>
      </div>

      {/* Mobile Version: Native Horizontal Snap */}
      <div className="lg:hidden">
        <div className="sc-m-head container-x pt-24">
          <p className="eyebrow text-gold-3">The object</p>
          <h2 className={`display mt-4 text-[2.5rem] font-bold leading-[1] tracking-tight text-ink ${outfit.className}`}>
            Three details worth knowing.
          </h2>
        </div>
        <ul
          data-lenis-prevent
          tabIndex={0}
          aria-label="Product details, scrollable"
          className="sc-m-list mt-10 flex snap-x snap-mandatory gap-5 overflow-x-auto px-6 pb-4 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
        >
          {SHOWCASE.map((p, i) => (
            <li key={i} className="sc-m-card w-[84vw] max-w-[460px] shrink-0 snap-center sm:w-[70vw]">
              <div className="relative aspect-[4/5] overflow-hidden rounded-media bg-sand shadow-lg">
                <Image
                  src={p.image}
                  alt={p.title}
                  fill
                  quality={85}
                  loading="lazy"
                  sizes="(max-width: 640px) 84vw, 70vw"
                  className="object-cover"
                />
              </div>
              <p className={`mt-6 text-xs font-semibold tracking-[0.2em] text-gold-3 uppercase ${outfit.className}`}>
                {p.n} / 0{SHOWCASE.length}
              </p>
              <h3 className={`mt-2 text-[1.75rem] font-bold text-ink ${outfit.className}`}>{p.title}</h3>
              <p className="mt-3 max-w-[46ch] text-sm leading-relaxed text-ink-2 font-medium">{p.text}</p>
            </li>
          ))}
        </ul>
      </div>
    </section>
    </MotionConfig>
  );
}
