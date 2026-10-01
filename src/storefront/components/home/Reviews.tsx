"use client";

import { useEffect, useState } from "react";
import { REVIEWS } from "@/storefront/lib/products";
import Marquee from "@/storefront/components/ui/Marquee";
import SplitReveal from "@/storefront/components/ui/SplitReveal";
import Reveal from "@/storefront/components/ui/Reveal";
import Button from "@/storefront/components/ui/Button";
import { outfit } from "@/app/fonts";

/**
 * The previous version rendered five hard-coded stars on every card with no
 * rating field behind them, under a "4.9 from 1,200+ verified reviews" figure
 * that nothing in the repo substantiates. A brand whose whole proposition is
 * printing its real numbers cannot invent those, so both are gone and the
 * quotes carry the section instead — larger, one row, fully readable.
 */
function Card({ r }: { r: (typeof REVIEWS)[number] }) {
  return (
    <div className="mx-3 h-full pb-4 pt-2">
      <figure className="group relative flex h-full w-[280px] shrink-0 flex-col justify-between overflow-hidden rounded-3xl border border-cream-2/60 bg-white/70 p-8 shadow-[0_8px_30px_rgb(35,31,26,0.04)] backdrop-blur-md transition-all duration-500 hover:-translate-y-2 hover:border-gold/30 hover:shadow-[0_20px_40px_rgb(35,31,26,0.08)] hover:bg-white sm:w-[340px] md:w-[420px] lg:w-[480px]">
        {/* Subtle decorative gradient blob in top right */}
        <div className="absolute -right-20 -top-20 h-40 w-40 rounded-full bg-gold/5 blur-3xl transition-opacity duration-500 group-hover:bg-gold/10" aria-hidden />
        
        <div className="relative z-10">
          <p className="text-eyebrow font-semibold uppercase tracking-[0.2em] text-gold-3">{r.tag}</p>
          <blockquote className="mt-6">
            <p className={`display text-d4 leading-snug font-bold tracking-tight text-ink ${outfit.className}`}>&ldquo;{r.text}&rdquo;</p>
          </blockquote>
        </div>
        <figcaption className="relative z-10 mt-10 border-t border-line pt-5 text-eyebrow uppercase tracking-[0.22em] text-muted transition-colors duration-500 group-hover:border-line-2">
          <cite className="not-italic">
            {r.name} <span className="mx-1 text-gold-3/40">•</span> {r.city}
          </cite>
        </figcaption>
      </figure>
    </div>
  );
}

export default function Reviews() {
  const [reduced, setReduced] = useState(false);

  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    const sync = () => setReduced(mq.matches);
    sync();
    mq.addEventListener("change", sync);
    return () => mq.removeEventListener("change", sync);
  }, []);

  return (
    <section id="reviews" className="section relative overflow-hidden">
      <div className="container-x text-center">
        <Reveal>
          <p className="eyebrow">Reviews</p>
        </Reveal>
        <SplitReveal className={`display mx-auto mt-5 max-w-[24ch] text-d2 font-bold tracking-tight text-ink ${outfit.className}`}>
          Loved by skin <em className={`not-italic font-medium text-gold-3 pr-1 ${outfit.className}`}>everywhere.</em>
        </SplitReveal>
        <Reveal delay={0.15}>
          <p className="lead mx-auto mt-6 max-w-[46ch]">
            Notes people have sent us since launch, printed as written.
          </p>
        </Reveal>
      </div>

      {reduced ? (
        // Static grid so every review stays reachable with no motion.
        <div className="container-x mt-14 grid gap-5 md:grid-cols-2">
          {REVIEWS.map((r) => (
            <Card key={r.name} r={r} />
          ))}
        </div>
      ) : (
        <div className="mt-16">
          <Marquee duration={75}>
            {REVIEWS.map((r) => (
              <Card key={r.name} r={r} />
            ))}
          </Marquee>
        </div>
      )}

      <Reveal className="mt-14 flex justify-center">
        <Button href="/reviews" variant="outline" arrow>
          Read all reviews
        </Button>
      </Reveal>
    </section>
  );
}
