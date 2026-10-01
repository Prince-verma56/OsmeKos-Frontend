"use client";

import { useRef } from "react";
import { gsap, useGSAP } from "@/storefront/lib/gsap";
import { EASE, MQ, STAGGER } from "@/storefront/lib/motion";
import type { Product } from "@/storefront/lib/products";
import { INGREDIENTS } from "@/storefront/lib/products";
import { formatPrice } from "@/storefront/lib/format";
import ParallaxImage from "@/storefront/components/ui/ParallaxImage";
import { outfit } from "@/app/fonts";

import SplitReveal from "@/storefront/components/ui/SplitReveal";
import Reveal from "@/storefront/components/ui/Reveal";
import Button from "@/storefront/components/ui/Button";
import AddToCart from "@/storefront/components/shop/AddToCart";
import { IconTruck, IconLeaf } from "@/storefront/components/ui/Icons";

/** The six printed percentages, at the moment of purchase. This is the
 *  strongest argument the brand has and the page has been building to it. */
function FormulaBlock() {
  return (
    <dl className="mt-8 grid grid-cols-1 gap-x-8 gap-y-2 border-y border-ink/12 py-5 min-[480px]:grid-cols-2">
      {INGREDIENTS.map((ing) => (
        <div key={ing.name} className="cta-formula flex items-baseline gap-3">
          <dd className="num w-12 shrink-0 text-sm font-semibold text-gold-3">{ing.pct}</dd>
          <dt className="text-sm text-ink-2">{ing.name}</dt>
        </div>
      ))}
    </dl>
  );
}

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <section className="section relative">
      <div className="container-x">
        <div className="cta-card on-sand grid overflow-hidden rounded-card bg-sand md:rounded-media lg:grid-cols-12">
          <ParallaxImage
            src="/products/brand-hero.webp"
            alt="The OsmeKos Body Lotion standing on a travertine ledge"
            speed={0.8}
            quality={85}
            sizes="(max-width: 1024px) 100vw, 50vw"
            className="aspect-[4/3] lg:col-span-6 lg:aspect-auto lg:min-h-[680px]"
          />
          <div className="flex flex-col justify-center p-6 md:p-12 lg:col-span-6 lg:p-16">{children}</div>
        </div>
      </div>
    </section>
  );
}

/** Rendered when the backend is unreachable. Every other section degrades
 *  gracefully; the page must not simply end without a call to action. */
function StaticFallback() {
  return (
    <Shell>
      <p className="eyebrow">Shop</p>
      <h2 className={`display mt-5 text-d2 font-bold tracking-tight text-ink ${outfit.className}`}>
        Your skin&apos;s new <em className={`not-italic font-medium text-gold-3 pr-1 ${outfit.className}`}>daily ritual.</em>
      </h2>
      <p className="lead mt-6 max-w-[38ch]">
        Triple Ceramide Complex + Niacinamide. 200ml. Made in India.
      </p>
      <FormulaBlock />
      <div className="mt-8">
        <Button href="/shop" arrow>
          Shop the lotion
        </Button>
      </div>
    </Shell>
  );
}

export default function ShopCta({ product }: { product: Product | null }) {
  const ref = useRef<HTMLDivElement>(null);

  useGSAP(
    () => {
      if (!product) return;
      const mm = gsap.matchMedia();

      mm.add(MQ.motion, () => {
        const trigger = { trigger: ".cta-card", start: "top 85%", once: true } as const;
        // The card squares off as it arrives — an object being set down.
        gsap.from(".cta-card", {
          scale: 0.94,
          borderRadius: "4rem",
          duration: 1.5,
          ease: EASE.expo,
          scrollTrigger: trigger,
        });
        gsap.from(".cta-body", {
          y: 20,
          autoAlpha: 0,
          stagger: STAGGER.normal,
          duration: 0.9,
          delay: 0.35,
          ease: EASE.expo,
          scrollTrigger: trigger,
        });
      });

      mm.add(MQ.reduced, () => {
        gsap.set(".cta-card", { scale: 1, clearProps: "borderRadius,transform" });
        gsap.set(".cta-body", { autoAlpha: 1, y: 0 });
      });

      return () => mm.revert();
    },
    { scope: ref, dependencies: [product] },
  );

  if (!product) return <StaticFallback />;

  return (
    <div ref={ref}>
      <Shell>
        <Reveal>
          <p className="eyebrow">Shop</p>
        </Reveal>
        <SplitReveal className={`display mt-5 text-d2 font-bold tracking-tight text-ink ${outfit.className}`}>
          Your skin&apos;s new <em className={`not-italic font-medium text-gold-3 pr-1 ${outfit.className}`}>daily ritual.</em>
        </SplitReveal>

        <p className="cta-body lead mt-6 max-w-[38ch]">
          {product.subtitle}. {product.size}. Made in India.
        </p>

        <div className="cta-body mt-8 flex flex-wrap items-baseline gap-x-4 gap-y-1">
          <span className="num text-[2.75rem] font-semibold leading-none tracking-[-0.02em]">
            {formatPrice(product.price)}
          </span>
          {product.compareAt && (
            <s className="num text-xl text-muted">
              <span className="sr-only">Was </span>
              {formatPrice(product.compareAt)}
            </s>
          )}
          <span className="text-eyebrow uppercase tracking-[0.2em] text-muted">incl. of all taxes</span>
        </div>

        <div className="cta-body">
          <FormulaBlock />
        </div>

        <div className="cta-body mt-8">
          <AddToCart
            slug={product.slug}
            available={product.available}
            comingSoon={product.comingSoon}
            withQty
          />
        </div>

        <ul className="cta-body mt-8 flex flex-wrap gap-x-8 gap-y-3 text-eyebrow uppercase tracking-[0.2em] text-muted">
          <li className="flex items-center gap-2">
            <IconTruck aria-hidden className="h-4 w-4" /> Free shipping over ₹999
          </li>
          <li className="flex items-center gap-2">
            <IconLeaf aria-hidden className="h-4 w-4" /> All skin types
          </li>
        </ul>
      </Shell>
    </div>
  );
}
