"use client";

import { useRef } from "react";
import { gsap, useGSAP } from "@/storefront/lib/gsap";
import { prefersReduced } from "@/storefront/lib/motion";
import { INGREDIENTS } from "@/storefront/lib/products";
import { useSpotlight } from "@/storefront/components/fx/useSpotlight";
import { IconDrop, IconHeart, IconLeaf, IconSparkle, IconShield, IconStar } from "@/storefront/components/ui/Icons";

const ICONS = [IconDrop, IconHeart, IconLeaf, IconSparkle, IconShield, IconStar];

const DETAIL: Record<string, { role: string; why: string }> = {
  Glycerin: { role: "Humectant", why: "At 6% it holds water in the skin through the day without turning the lotion sticky." },
  "Shea Butter": { role: "Emollient", why: "Enough to cushion dry elbows and knees, balanced so the texture stays light." },
  "Coconut Oil": { role: "Emollient", why: "Seals the hydration Glycerin draws in, so it doesn't evaporate straight back out." },
  Niacinamide: { role: "Vitamin B3", why: "2% is a gentle, everyday level that supports the barrier alongside the ceramides." },
  "Triple Ceramide Complex": { role: "Skin-identical lipids", why: "NP 0.5%, AP 0.2%, EOP 0.2%. Three ceramides mirror the mix your own barrier uses." },
  "Vitamin E": { role: "Antioxidant", why: "Protects the oils in the formula and in your skin from breaking down." },
};

export default function ActivesGrid() {
  const ref = useRef<HTMLDivElement>(null);
  useSpotlight(ref, ".act-card", { tilt: 5, lift: 5 });

  useGSAP(
    () => {
      if (prefersReduced()) {
        gsap.set(".act-card", { autoAlpha: 1, y: 0 });
        return;
      }
      gsap.from(".act-card", {
        autoAlpha: 0,
        y: 50,
        duration: 1.2,
        stagger: 0.08,
        ease: "expo.out",
        clearProps: "opacity,visibility",
        scrollTrigger: { trigger: ref.current, start: "top 80%", once: true },
      });
    },
    { scope: ref },
  );

  return (
    <div ref={ref} className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 lg:gap-5">
      {INGREDIENTS.map((ing, i) => {
        const Icon = ICONS[i];
        const d = DETAIL[ing.name];
        return (
          <article
            key={ing.name}
            className="act-card relative flex flex-col overflow-hidden rounded-[1.75rem] border border-ink/10 bg-white/60 p-7 transition-colors duration-500 hover:border-gold/50 hover:bg-white md:p-8"
          >
            <div className="relative flex items-start justify-between">
              <span className="font-display text-[4.5rem] leading-none text-ink md:text-[5.5rem]">{ing.pct}</span>
              <span className="mt-2 flex h-12 w-12 items-center justify-center rounded-2xl border border-gold/35 bg-cream text-gold-2">
                <Icon className="h-5 w-5" />
              </span>
            </div>
            <h3 className="relative mt-6 font-display text-[1.7rem] leading-tight">{ing.name}</h3>
            <div className="relative mt-2 flex flex-wrap items-center gap-2">
              <span className="rounded-full bg-ink px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.18em] text-cream">{d.role}</span>
              <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-gold-2">{ing.short}</span>
            </div>
            <p className="relative mt-5 text-[14.5px] leading-relaxed text-ink-2">{ing.long}</p>
            <p className="relative mt-auto border-t border-line pt-5 text-[13.5px] leading-relaxed text-muted">
              <span className="font-semibold text-ink">Why this amount. </span>
              {d.why}
            </p>
          </article>
        );
      })}
    </div>
  );
}
