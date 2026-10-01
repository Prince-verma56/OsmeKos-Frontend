"use client";

import Image from "next/image";
import Link from "next/link";
import { useRef } from "react";
import { gsap, ScrollTrigger, useGSAP } from "@/storefront/lib/gsap";
import { EASE, MQ, STAGGER, START } from "@/storefront/lib/motion";
import { GALLERY } from "@/storefront/lib/content";
import { useUI } from "@/storefront/store/ui";
import Reveal from "@/storefront/components/ui/Reveal";
import { outfit } from "@/app/fonts";

/**
 * Desktop: vertical scroll drives a horizontal walk past the shots, with
 * varied ratios and heights hanging off a shared baseline.
 * Below md — and under reduced motion — an editorial masonry with no pin.
 * The pin previously ran on phones too, where the track is ~2000px wide.
 */
export default function Gallery() {
  const ref = useRef<HTMLElement>(null);

  useGSAP(
    () => {
      const mm = gsap.matchMedia();

      mm.add(MQ.wideMotion, () => {
        const track = ref.current!.querySelector<HTMLElement>(".gal-track");
        if (!track) return;
        const dist = () => Math.max(0, track.scrollWidth - window.innerWidth);

        // The track and its progress bar read the same scroll range, so they
        // share one trigger. Two triggers meant two pin measurements and two
        // dist() passes per refresh for a single movement.
        const walk = gsap
          .timeline({
            scrollTrigger: {
              id: "gallery",
              trigger: ref.current,
              start: "top top",
              end: () => `+=${dist()}`,
              pin: true,
              scrub: 0.8,
              invalidateOnRefresh: true,
            },
          })
          .to(track, { x: () => -dist(), ease: "none" }, 0)
          .to(".gal-progress", { scaleX: 1, ease: "none" }, 0);

        // Each shot arrives as the track walks it into frame rather than all
        // six firing at once off-screen. containerAnimation re-expresses the
        // trigger in the horizontal track's own space, so "left 92%" means
        // 92% across the viewport, not down it.
        gsap.utils.toArray<HTMLElement>(".gal-fig").forEach((fig) => {
          gsap.from(fig, {
            y: 48,
            autoAlpha: 0,
            duration: 1.1,
            ease: EASE.expo,
            scrollTrigger: {
              trigger: fig,
              containerAnimation: walk,
              start: "left 92%",
              once: true,
            },
          });
        });
      });

      // The heading sits outside the pinned track, so it reveals on the
      // ordinary vertical pass in both layouts.
      mm.add(MQ.motion, () => {
        gsap.from(".gal-head-item", {
          y: 26,
          autoAlpha: 0,
          filter: "blur(4px)",
          clearProps: "filter",
          duration: 1.1,
          ease: EASE.expo,
          stagger: STAGGER.normal,
          scrollTrigger: { trigger: ".gal-head", start: START, once: true },
        });
      });

      mm.add(MQ.reduced, () => {
        gsap.set(".gal-head-item, .gal-fig", { autoAlpha: 1, y: 0, filter: "none" });
      });

      return () => mm.revert();
    },
    { scope: ref },
  );

  /** Keyboard users tab through the figures; drive the pinned track so the
   *  focused card is actually on screen. Without this, cards 2-6 are a dead
   *  zone for anyone not using a mouse. */
  const focusCard = (i: number) => {
    const st = ScrollTrigger.getById("gallery");
    if (!st) return;
    const progress = GALLERY.length > 1 ? i / (GALLERY.length - 1) : 0;
    const y = st.start + (st.end - st.start) * progress;
    const lenis = useUI.getState().lenis;
    if (lenis) lenis.scrollTo(y, { duration: 0.6 });
    else window.scrollTo({ top: y, behavior: "smooth" });
  };

  return (
    <section ref={ref} className="relative overflow-hidden motion-safe:md:h-svh -mt-[10vh] z-20">
      
      {/* Pure Blur Separator straddling the boundary to elegantly combine the sections */}
      <div className="absolute inset-x-0 top-[-10vh] h-[20vh] backdrop-blur-[40px] z-20 [mask-image:linear-gradient(to_bottom,transparent_0%,black_30%,black_70%,transparent_100%)]" />

      {/* Background Image */}
      <div className="absolute inset-0 z-0 pointer-events-none">
        <Image
          src="/Images/BG%20Images/RitualBG.webp"
          alt="Ritual Background"
          fill
          className="object-cover object-center"
          quality={90}
        />
      </div>

      <div className="container-x relative z-10 pt-[15vh] motion-safe:md:absolute motion-safe:md:inset-x-0 motion-safe:md:top-14 motion-safe:md:pt-0">
        <div className="gal-head flex flex-col items-center md:flex-row md:justify-between md:items-end gap-8">
          
          {/* Left Column (Spacer for flex centering) */}
          <div className="hidden md:block flex-1"></div>

          {/* Center Column: Clean Centered Heading with Outfit font */}
          <div className="flex flex-col items-center text-center shrink-0">
            <p className={`gal-head-item eyebrow flex items-center gap-4 text-gold-3 uppercase tracking-[0.2em] font-semibold text-sm ${outfit.className}`}>
              <span className="w-8 h-px bg-gold-3"></span>
              A daily ritual
              <span className="w-8 h-px bg-gold-3"></span>
            </p>
            <h2 className={`gal-head-item mt-6 text-[2.5rem] md:text-[3.5rem] leading-[1.1] tracking-tight text-ink font-bold whitespace-nowrap ${outfit.className}`}>
              For healthier-looking <span className="text-gold-3">skin.</span>
            </h2>
            <p className={`gal-head-item mt-6 eyebrow flex items-center gap-4 text-ink-2 uppercase tracking-[0.2em] text-xs font-medium ${outfit.className}`}>
              <span className="w-8 h-px bg-ink-2/30"></span>
              Simple care. Visible difference.
              <span className="w-8 h-px bg-ink-2/30"></span>
            </p>
          </div>

          {/* Right Column: Progress Bar */}
          <div aria-hidden className="hidden md:flex justify-end flex-1 pb-4">
            <div className="gal-head-item w-40 shrink-0">
              <p className="num mb-2 text-eyebrow uppercase tracking-[0.2em] text-muted text-right">
                01 — 0{GALLERY.length}
              </p>
              <span className="block h-px w-full bg-line">
                <span className="gal-progress block h-full w-full origin-left scale-x-0 bg-ink" />
              </span>
            </div>
          </div>

        </div>
      </div>

      {/* Horizontal track — desktop, motion allowed */}
      <div className="gal-track hidden h-full items-end gap-8 pb-14 pl-[var(--space-gutter)] pr-[10vw] will-change-transform motion-safe:md:flex">
        {GALLERY.map((s, i) => (
          <figure key={s.src} className="gal-fig shrink-0">
            <Link
              href="/shop"
              onFocus={() => focusCard(i)}
              className="group block overflow-hidden rounded-media bg-sand shadow-card transition-[translate,box-shadow] duration-700 ease-expo hover:-translate-y-3 hover:shadow-lift"
            >
              <div className={`relative ${s.ratio}`} style={{ height: s.h }}>
                <Image
                  src={s.src}
                  alt=""
                  fill
                  quality={75}
                  loading="lazy"
                  fetchPriority="low"
                  sizes="(max-width: 768px) 46vw, 46vh"
                  className="object-cover transition-transform duration-[900ms] ease-expo group-hover:scale-[1.04]"
                />
              </div>
            </Link>
            <figcaption className="mt-4 flex items-center justify-between text-eyebrow uppercase tracking-[0.22em] text-ink font-semibold">
              <span>{s.cap}</span>
              <span className="num">0{i + 1}</span>
            </figcaption>
          </figure>
        ))}
      </div>

      {/* Masonry — below md, and whenever motion is reduced */}
      <div className="container-x grid grid-cols-2 gap-4 pb-[var(--space-section-sm)] pt-10 motion-safe:md:hidden">
        {GALLERY.map((s, i) => (
          <Reveal key={s.src} start="top 88%" className={i === 4 ? "col-span-2" : ""}>
            <figure>
              <div
                className={`relative overflow-hidden rounded-card bg-sand ${
                  i === 4 ? "aspect-[3/2]" : s.ratio
                }`}
              >
                <Image
                  src={s.src}
                  alt=""
                  fill
                  quality={75}
                  loading="lazy"
                  sizes={i === 4 ? "92vw" : "46vw"}
                  className="object-cover"
                />
              </div>
              <figcaption className="mt-3 flex items-center justify-between text-[10px] uppercase tracking-[0.2em] text-ink font-semibold">
                <span>{s.cap}</span>
                <span className="num">0{i + 1}</span>
              </figcaption>
            </figure>
          </Reveal>
        ))}
      </div>
    </section>
  );
}
