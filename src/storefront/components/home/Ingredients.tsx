"use client";

import Image from "next/image";
import { useRef } from "react";
import { gsap, useGSAP } from "@/storefront/lib/gsap";
import { EASE, MQ, STAGGER } from "@/storefront/lib/motion";
import { INGREDIENTS, type Ingredient } from "@/storefront/lib/products";
import SplitReveal from "@/storefront/components/ui/SplitReveal";
import Reveal from "@/storefront/components/ui/Reveal";
import VelocityMarquee from "@/storefront/components/fx/VelocityMarquee";
import CountUp from "@/storefront/components/fx/CountUp";
import { outfit } from "@/app/fonts";
import Button from "@/storefront/components/ui/Button";

const MAX_PCT = 6;
const pctValue = (pct: string) => parseFloat(pct);

function Row({ ing }: { ing: Ingredient }) {
  const value = pctValue(ing.pct);
  const strong = value >= 2;

  return (
    <li className="ing-row relative bg-cream/80 backdrop-blur-xl rounded-3xl p-8 mb-6 shadow-[0_10px_40px_rgba(0,0,0,0.08)] border border-white/50">
      <div className="flex items-baseline gap-4 md:gap-6">
        <p
          className={`ing-pct num display w-[4.5rem] shrink-0 text-[2.5rem] leading-none md:w-[5.5rem] font-bold ${outfit.className} ${
            strong ? "text-gold-2" : "text-ink-3"
          }`}
        >
          {ing.pct}
        </p>
        <div className="ing-name min-w-0 flex-1">
          <h3 className={`display text-[1.75rem] md:text-[2rem] font-semibold leading-tight ${outfit.className}`}>{ing.name}</h3>
          <p className="mt-1 text-xs font-semibold uppercase tracking-[0.2em] text-gold-3">
            {ing.short}
          </p>
        </div>
      </div>

      <div aria-hidden className="mt-4 h-[3px] w-full bg-line-2">
        <span
          className={`ing-bar block h-full origin-left ${strong ? "bg-gold-2" : "bg-stone"}`}
          style={{ width: `${(value / MAX_PCT) * 100}%` }}
        />
      </div>

      <p className="ing-copy mt-4 max-w-[52ch] text-[15px] font-medium leading-relaxed text-ink-2 max-[480px]:hidden">
        {ing.long}
      </p>
    </li>
  );
}

export default function Ingredients() {
  const ref = useRef<HTMLElement>(null);

  useGSAP(
    () => {
      const mm = gsap.matchMedia();

      mm.add(MQ.motion, () => {
        const rows = gsap.utils.toArray(".ing-row") as HTMLElement[];

        rows.forEach((row) => {
          // One trigger per card drives the whole card, so the parts can never
          // drift out of step with the surface they sit on.
          const start = { trigger: row, start: "top 90%", once: true } as const;

          gsap.from(row, {
            y: 40,
            autoAlpha: 0,
            duration: 1,
            ease: EASE.expo,
            scrollTrigger: start,
          });

          // Percentage, name and copy land in reading order inside the card.
          gsap.from(row.querySelectorAll(".ing-pct, .ing-name, .ing-copy"), {
            y: 14,
            autoAlpha: 0,
            duration: 0.9,
            delay: 0.15,
            stagger: STAGGER.tight,
            ease: EASE.expo,
            scrollTrigger: start,
          });

          const bar = row.querySelector(".ing-bar");
          if (bar) {
            gsap.from(bar, {
              scaleX: 0,
              transformOrigin: "left",
              duration: 1.4,
              delay: 0.2, // slight delay after the card appears
              ease: EASE.expo,
              scrollTrigger: start,
            });
          }
        });
      });

      mm.add(MQ.reduced, () => {
        gsap.set(".ing-row, .ing-pct, .ing-name, .ing-copy", { autoAlpha: 1, y: 0 });
        gsap.set(".ing-bar", { scaleX: 1 });
      });

      return () => mm.revert();
    },
    { scope: ref },
  );

  return (
    <section ref={ref} id="ingredients" className="on-sand section !pt-0 relative bg-sand overflow-clip">
      
      {/* 1) Top Image Section */}
      <div className="relative w-full lg:aspect-[21/9] xl:aspect-[24/10] min-h-[700px] lg:min-h-[90vh] flex items-center py-24 lg:py-0">
        
        {/* Premium Blur Separator to blend with the section ABOVE this entire component */}
        <div className="absolute inset-x-0 top-0 h-32 lg:h-48 backdrop-blur-[30px] z-20 [mask-image:linear-gradient(to_bottom,black_10%,transparent_90%)]" />

        <div className="absolute inset-0 z-0 bg-sand">
          <Image
            src="/Images/BG%20Images/ThoughtfulBG.webp"
            alt="OsmeKos Body Lotion"
            fill
            sizes="100vw"
            className="intro-bg object-cover object-center"
          />
        </div>

        <div className="container-x relative z-10 w-full h-full flex items-center mt-10">
          <div className="grid gap-8 lg:grid-cols-12 w-full">
            <div className="lg:col-start-6 lg:col-span-7 flex flex-col justify-center">
              
              <div className="grid gap-8 lg:grid-cols-12 items-end">
                <div className="lg:col-span-7">
                  <Reveal>
                    <p className="eyebrow text-gold-3">Thoughtfully formulated</p>
                  </Reveal>
                  <SplitReveal className={`display mt-4 text-[3rem] lg:text-[4rem] font-bold leading-[1] tracking-tight text-ink ${outfit.className}`}>
                    Powerful ingredients for <span className={`text-gold-3 italic font-medium pr-1 ${outfit.className}`}>healthy,</span> nourished skin.
                  </SplitReveal>
                </div>
                
                <div className="lg:col-span-5 lg:pb-3">
                  <Reveal delay={0.1}>
                    <p className="text-[14px] leading-relaxed text-ink-2 font-medium">
                      Six actives, every percentage printed on the label. We disclose concentrations because you deserve to know what goes on your skin, and exactly how much of it.
                    </p>
                  </Reveal>
                </div>
              </div>

              <div className="mt-10 lg:mt-12 border-t border-ink/10 pt-8">
                <Reveal delay={0.2}>
                  <dl className="grid grid-cols-3 gap-4">
                    {[
                      { v: "6", l: "Actives", count: true },
                      { v: "0.5–6%", l: "Range", count: false },
                      { v: "100%", l: "Disclosed", count: true },
                    ].map(({ v, l, count }) => (
                      <div key={l}>
                        <dd className={`display text-[2rem] leading-none text-gold-2 font-semibold ${outfit.className}`}>
                          {count ? <CountUp value={v} /> : <span className="num">{v}</span>}
                        </dd>
                        <dt className="mt-2 block text-xs uppercase tracking-[0.2em] font-semibold text-muted">{l}</dt>
                      </div>
                    ))}
                  </dl>
                </Reveal>
              </div>

            </div>
          </div>
        </div>
      </div>

      {/* 2) Marquee Tape (Floating over the gap) */}
      <div className="relative z-30 w-full -my-8 md:-my-12 overflow-hidden pointer-events-none">
        {/* Massive Frosted Blur behind tape to seamlessly blend top & bottom images */}
        <div className="absolute inset-0 bg-cream/10 backdrop-blur-[40px] [mask-image:linear-gradient(to_bottom,transparent,black_40%,black_60%,transparent)] -z-10" />
        
        <VelocityMarquee className="py-4 md:py-6 pointer-events-auto bg-ink/5 backdrop-blur-md border-y border-white/20 shadow-2xl" speed={24} reverse>
          {INGREDIENTS.map((ing) => (
            <span
              key={ing.name}
              className={`flex items-center gap-10 pr-10 text-[16px] md:text-[20px] font-semibold uppercase tracking-[0.3em] text-ink ${outfit.className}`}
            >
              <span className="num text-gold-3 font-bold">{ing.pct}</span>
              {ing.name}
              <span aria-hidden className="h-2 w-2 rounded-full bg-gold" />
            </span>
          ))}
        </VelocityMarquee>
      </div>

      {/* 3) Bottom Image Section (Pinned Background + Scrolling List) */}
      <div className="relative w-full">
        {/* Native CSS Sticky Background */}
        <div className="sticky top-0 h-screen w-full z-0 overflow-hidden bg-sand">
          <Image
            src="/Images/BG%20Images/IngradientsBG.webp"
            alt="Ingredients Background"
            fill
            quality={90}
            sizes="100vw"
            className="object-cover object-center"
          />
        </div>

        {/* Scrolling List overlapping the sticky background */}
        <div className="relative z-10 w-full -mt-[100vh] pt-[25vh] pb-[15vh]">
          <div className="container-x">
            <ul className="ing-list w-full lg:w-[38%] flex flex-col">
              {INGREDIENTS.map((ing) => (
                <Row key={ing.name} ing={ing} />
              ))}
            </ul>

            <div className="w-full lg:w-[38%] flex justify-center mt-12">
              <Reveal>
                <div className="bg-cream/80 backdrop-blur-xl rounded-full shadow-[0_10px_30px_rgba(0,0,0,0.1)] border border-white/50 inline-block p-1">
                  <Button href="/ingredients" variant="outline" arrow>
                    Explore every ingredient
                  </Button>
                </div>
              </Reveal>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
