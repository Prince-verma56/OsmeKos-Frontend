"use client";

import { useRef, useState } from "react";
import { gsap, useGSAP } from "@/storefront/lib/gsap";
import { prefersReduced } from "@/storefront/lib/motion";
import { REVIEWS, REVIEW_TAGS, type ReviewTag } from "@/storefront/lib/products";
import { useSpotlight } from "@/storefront/components/fx/useSpotlight";
import { IconStar } from "@/storefront/components/ui/Icons";

export default function ReviewsWall() {
  const [tag, setTag] = useState<"All" | ReviewTag>("All");
  const ref = useRef<HTMLDivElement>(null);
  const list = REVIEWS.filter((r) => tag === "All" || r.tag === tag);
  useSpotlight(ref, ".rw-card", { tilt: 4, lift: 4 });

  useGSAP(
    () => {
      if (prefersReduced()) {
        gsap.set(".rw-card", { autoAlpha: 1, y: 0 });
        return;
      }
      gsap.fromTo(
        ".rw-card",
        { autoAlpha: 0, y: 30 },
        { autoAlpha: 1, y: 0, duration: 0.9, stagger: 0.06, ease: "expo.out", overwrite: true },
      );
    },
    { scope: ref, dependencies: [tag] },
  );

  const count = (t: "All" | ReviewTag) => (t === "All" ? REVIEWS.length : REVIEWS.filter((r) => r.tag === t).length);

  return (
    <div ref={ref}>
      <div className="flex flex-wrap gap-2">
        {(["All", ...REVIEW_TAGS] as const).map((t) => (
          <button
            key={t}
            onClick={() => setTag(t)}
            className={`flex items-center gap-2 rounded-full border px-4 py-2 text-[11px] font-bold uppercase tracking-[0.18em] transition-colors duration-300 ${
              tag === t ? "border-ink bg-ink text-cream" : "border-ink/20 text-ink hover:border-ink"
            }`}
          >
            {t}
            <span className={`font-display text-[12px] normal-case tracking-normal ${tag === t ? "text-gold" : "text-muted"}`}>{count(t)}</span>
          </button>
        ))}
      </div>

      <div className="mt-10 columns-1 gap-5 sm:columns-2 lg:columns-3">
        {list.map((r) => (
          <figure
            key={r.name}
            className="rw-card relative mb-5 break-inside-avoid overflow-hidden rounded-[1.6rem] border border-line bg-white/70 p-7 transition-colors duration-500 hover:border-gold/50 hover:bg-white"
          >
            <div className="relative flex items-center justify-between">
              <div className="flex gap-1 text-gold">
                {Array.from({ length: 5 }).map((_, i) => (
                  <IconStar key={i} />
                ))}
              </div>
              <span className="rounded-full border border-gold/40 px-2.5 py-1 text-[9px] font-bold uppercase tracking-[0.18em] text-gold-2">
                {r.tag}
              </span>
            </div>
            <blockquote className="relative mt-5 font-display text-[1.45rem] leading-snug text-ink">&ldquo;{r.text}&rdquo;</blockquote>
            <figcaption className="relative mt-6 flex items-center gap-3">
              <span className="flex h-9 w-9 items-center justify-center rounded-full bg-sand font-display text-sm text-ink">
                {r.name.charAt(0)}
              </span>
              <span className="text-[11px] uppercase tracking-[0.2em] text-muted">
                {r.name} · {r.city}
              </span>
            </figcaption>
          </figure>
        ))}
      </div>
    </div>
  );
}
