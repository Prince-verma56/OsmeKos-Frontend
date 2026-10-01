"use client";

import { useRef, useEffect, useCallback } from "react";
import { outfit, manrope } from "@/app/fonts";
import { gsap, SplitText, useGSAP } from "@/storefront/lib/gsap";
import { EASE, MQ } from "@/storefront/lib/motion";
import Button from "@/storefront/components/ui/Button";
import Magnetic from "@/storefront/components/ui/Magnetic";
import { IconDrop, IconSparkle, IconWaves, IconLeaf } from "@/storefront/components/ui/Icons";
import { useUI } from "@/storefront/store/ui";


const PILLARS = [
  { Icon: IconDrop, label: "Deep Hydration", sub: "6% Glycerin" },
  { Icon: IconSparkle, label: "Nourishment", sub: "Shea + Vitamin E" },
  { Icon: IconWaves, label: "Soft, Smooth Skin", sub: "Triple Ceramides" },
  { Icon: IconLeaf, label: "For All Skin Types", sub: "Gentle daily care" },
];

export default function Hero() {
  const ref = useRef<HTMLElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const tlRef = useRef<gsap.core.Timeline | null>(null);
  const revealedRef = useRef(false);
  const loaded = useUI((s) => s.loaded);

  /**
   * The copy is held hidden until the film hands over, so EVERY path that can
   * end the film early has to hand over too. Autoplay refusal (iOS Low Power
   * Mode, data saver), a stalled download and a 404 are all normal outcomes —
   * none of them may leave the fold blank. Idempotent, so the paths can race.
   */
  const revealHero = useCallback(() => {
    if (revealedRef.current) return;
    revealedRef.current = true;
    // null while document.fonts.ready is still pending; the timeline builder
    // checks this same flag and plays itself the moment it exists.
    tlRef.current?.play();
    window.dispatchEvent(new Event("videoReveal"));
  }, []);

  useEffect(() => {
    if (!loaded) return;
    const video = videoRef.current;
    if (!video) return;

    let watchdog: ReturnType<typeof setTimeout>;
    // Small natural delay so it doesn't snap instantly after the preloader.
    const start = setTimeout(() => {
      void video.play().then(
        () => {
          // Back the intended timeupdate cue with a deadline derived from the
          // film's own length, so a mid-play stall still hands over.
          const d = video.duration;
          watchdog = setTimeout(revealHero, d > 2 ? (d - 2) * 1000 + 3000 : 5000);
        },
        revealHero,
      );
    }, 300);

    return () => {
      clearTimeout(start);
      clearTimeout(watchdog);
    };
  }, [loaded, revealHero]);

  useGSAP(
    () => {
      const el = ref.current!;
      const mm = gsap.matchMedia();

      mm.add(MQ.motion, () => {
        let split: SplitText | undefined;
        let cancelled = false;

        document.fonts.ready.then(() => {
          if (cancelled) return;
          // aria: "none" stops SplitText writing aria-label onto the <span>s it
          // splits, where the attribute is not permitted. The <h1> below carries
          // the heading's accessible name instead.
          split = SplitText.create(".hero-line", { type: "chars", mask: "chars", aria: "none" });

          // Start text elements hidden so they wait for the video
          gsap.set(".hero-eyebrow, .hero-lead, .hero-cta, .hero-pillar", { autoAlpha: 0 });
          gsap.set(split.chars, { yPercent: 115, filter: "blur(8px)" });
          gsap.set(".hero-em", { yPercent: 110, filter: "blur(10px)" });

          // Cinematic Intro for the video itself (plays immediately on load)
          gsap.set(videoRef.current, { scale: 1.25 });
          gsap.to(videoRef.current, {
            scale: 1,
            duration: 3.5,
            ease: "power3.inOut",
          });

          const tl = gsap.timeline({ defaults: { ease: EASE.expo }, paused: true });
          tlRef.current = tl;

          tl.fromTo(".hero-eyebrow", { autoAlpha: 0, y: 16 }, { autoAlpha: 1, y: 0, duration: 0.9 }, 0)
            .to(split.chars, { yPercent: 0, filter: "blur(0px)", duration: 1.3, stagger: 0.028 }, 0.1)
            .to(".hero-em", { yPercent: 0, filter: "blur(0px)", duration: 1.5 }, 0.26)
            .fromTo(".hero-lead", { autoAlpha: 0, y: 20 }, { autoAlpha: 1, y: 0, duration: 1 }, 0.65)
            .fromTo(".hero-cta", { autoAlpha: 0, y: 18 }, { autoAlpha: 1, y: 0, duration: 0.9, stagger: 0.08 }, 0.8)
            .fromTo(".hero-pillar", { autoAlpha: 0, y: 20 }, { autoAlpha: 1, y: 0, duration: 0.9, stagger: 0.07 }, 0.95);

          // The film can reach its cue before the webfonts resolve. If it did,
          // the timeline has to catch up rather than wait for a second cue that
          // is never coming.
          if (revealedRef.current) tl.play();
        });

        // Scroll: cinematic clip-path shrinking and blurring effect
        gsap.fromTo(".hero-media", 
          {
            clipPath: "polygon(0% 0%, 100% 0%, 100% 100%, 0% 100%)",
            borderRadius: "0% 0% 0% 0%",
            yPercent: 0,
          },
          {
            clipPath: "polygon(2% 0%, 98% 0%, 95% 92%, 5% 92%)",
            borderRadius: "0% 0% 25% 25%",
            yPercent: 5,
            ease: "power1.inOut",
            scrollTrigger: { trigger: el, start: "top top", end: "bottom top", scrub: 1.2 },
          }
        );

        if (videoRef.current) {
          gsap.to(videoRef.current, {
            filter: "blur(6px)",
            ease: "none",
            scrollTrigger: {
              trigger: el,
              start: "20% top",
              end: "bottom top",
              scrub: 1.2,
            }
          });
        }

        gsap.to(".hero-layer", {
          yPercent: -15,
          autoAlpha: 0,
          ease: "none",
          scrollTrigger: { trigger: el, start: "35% top", end: "bottom top", scrub: true },
        });

        return () => {
          cancelled = true;
          tlRef.current?.kill();
          split?.revert();
        };
      });

      return () => mm.revert();
    },
    { scope: ref },
  );

  const handleTimeUpdate = () => {
    const video = videoRef.current;
    if (!video || revealedRef.current) return;
    const { duration, currentTime } = video;
    // The intended cue: hand over 2 seconds before the film ends.
    if (duration > 0 && duration - currentTime <= 2) revealHero();
  };

  return (
    <section
      ref={ref}
      className={`relative flex min-h-[92svh] w-full flex-col overflow-hidden bg-cream pb-8 pt-[104px] md:min-h-[660px] md:pb-10 md:pt-[138px] lg:h-[100svh] lg:max-h-[940px] ${manrope.className}`}
    >
      <div className="hero-media absolute inset-0 bg-cream will-change-transform" aria-hidden>
        <video
          poster="/videos/HeroVideo-poster.webp"
          ref={videoRef}
          src="/videos/HeroVideo-opt.mp4"
          muted
          playsInline
          // Buffers behind the preloader, so playback does not stall on reveal.
          preload="auto"
          onTimeUpdate={handleTimeUpdate}
          onEnded={(e) => {
            // Freeze on last frame — seek back slightly so poster never flashes
            const v = e.currentTarget;
            if (v.duration > 0.1) v.currentTime = v.duration - 0.05;
            revealHero();
          }}
          onError={revealHero}
          className="h-full w-full object-cover object-[center_top] md:object-[center_15%]"
        />
        {/* Premium frosted glass fade effect for text readability with a radial mask to remove any hard edges */}
        <div 
          className="absolute inset-0 w-full md:w-[70%] bg-gradient-to-r from-cream/80 via-cream/40 to-transparent backdrop-blur-md"
          style={{ maskImage: 'radial-gradient(circle at left center, black 10%, transparent 80%)', WebkitMaskImage: 'radial-gradient(circle at left center, black 10%, transparent 80%)' }}
        />
      </div>

      <div className="hero-layer container-x relative z-20 flex flex-1 flex-col justify-center gap-10 md:gap-16">
          <div className="flex w-full items-center">
            <div className="max-w-3xl">
              <p className="hero-eyebrow flex items-center gap-3 text-[12px] font-semibold uppercase tracking-[0.2em] text-ink-3">
                <span aria-hidden className="h-px w-8 bg-gold" />
                More than moisture
                <span className="hidden sm:inline"> · Skincare that feels right</span>
              </p>

              <h1
                aria-label="Skin, deeply nourished."
                className={`mt-4 text-[4rem] md:text-[5.5rem] lg:text-[7rem] font-bold leading-[0.9] tracking-[-0.03em] ${outfit.className}`}
              >
                <span className="hero-line block">Skin,</span>
                <span className="-mb-[0.1em] block overflow-hidden">
                  <span className="hero-em inline-block pb-[0.1em] pr-[0.1em] text-gold-2">deeply</span>
                </span>
                <span className="hero-line block">nourished.</span>
              </h1>

              <p className="hero-lead mt-6 max-w-[30ch] text-[18px] md:text-[20px] leading-[1.6] text-ink-2">
                Daily care for softer, smoother, healthier-looking skin.
              </p>

              <div className="mt-8 flex flex-wrap items-center gap-3 md:gap-4">
                <Magnetic className="hero-cta inline-block">
                  <Button href="/shop" arrow>
                    Shop body lotion
                  </Button>
                </Magnetic>
                <Button href="/#ingredients" variant="outline" arrow className="hero-cta bg-white/40 backdrop-blur-md border-transparent hover:bg-white/60">
                  See what&apos;s inside
                </Button>
              </div>

              {/* Minimalistic Premium Pillars */}
              <div className="mt-10 md:mt-12 grid grid-cols-2 gap-y-5 gap-x-4 border-t border-ink/10 pt-6">
                {PILLARS.map(({ Icon, label, sub }) => (
                  <div key={label} className="hero-pillar flex items-start gap-3">
                    <Icon aria-hidden className="h-5 w-5 text-gold shrink-0 mt-0.5" />
                    <div className="flex flex-col">
                      <span className="text-[13px] font-semibold tracking-wide text-ink">{label}</span>
                      <span className="text-[12px] text-ink-3">{sub}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
    </section>
  );
}
