"use client";

import Image from "next/image";
import { useRef } from "react";
import { gsap, useGSAP } from "@/storefront/lib/gsap";
import { EASE, MQ, STAGGER, START } from "@/storefront/lib/motion";
import { TEXTURE } from "@/storefront/lib/content";
import ParallaxImage from "@/storefront/components/ui/ParallaxImage";
import SplitReveal from "@/storefront/components/ui/SplitReveal";
import Reveal from "@/storefront/components/ui/Reveal";
import { outfit } from "@/app/fonts";

/**
 * One photograph, large and close. Everything else is a caption.
 * The image is the section's only continuously moving element.
 */
export default function Texture() {
  const ref = useRef<HTMLElement>(null);

  useGSAP(
    () => {
      const mm = gsap.matchMedia();
      const trigger = { trigger: ".tx-features", start: START, once: true } as const;

      mm.add(MQ.motion, () => {
        gsap.from(".tx-rule", {
          scaleX: 0,
          transformOrigin: "left",
          stagger: STAGGER.normal,
          duration: 1,
          ease: EASE.expo,
          scrollTrigger: trigger,
        });
        gsap.from(".tx-feature", {
          x: -20,
          autoAlpha: 0,
          stagger: STAGGER.normal,
          duration: 1,
          delay: 0.1,
          ease: EASE.expo,
          scrollTrigger: trigger,
        });
      });

      mm.add(MQ.reduced, () => {
        gsap.set(".tx-rule", { scaleX: 1 });
        gsap.set(".tx-feature", { autoAlpha: 1, x: 0 });
      });

      return () => mm.revert();
    },
    { scope: ref },
  );

  return (
    <section ref={ref} className="on-paper section relative overflow-hidden">
      {/* Background Image */}
      <div className="absolute inset-0 z-0 pointer-events-none">
        <Image
          src="/Images/BG%20Images/TextureBG.webp"
          alt="Texture Background"
          fill
          className="object-cover object-center"
          quality={90}
        />
      </div>

      <div className="container-x relative z-10 grid items-center gap-14 lg:grid-cols-12">
        <div className="lg:col-span-6">
          <ParallaxImage
            src="/products/swatch.webp"
            alt="Macro detail of the lotion part-worked into skin, showing its finish"
            speed={0.6}
            quality={90}
            sizes="(max-width: 1024px) 100vw, 50vw"
            className="mx-auto aspect-square max-w-[560px] rounded-media min-[480px]:aspect-[4/5]"
          />
          <Reveal start="top 90%">
            <p className="mt-4 text-center text-eyebrow uppercase tracking-[0.2em] text-muted lg:text-left">
              {TEXTURE.caption}
            </p>
          </Reveal>
        </div>

        <div className="lg:col-span-5 lg:col-start-8">
          <Reveal>
            <p className="eyebrow">{TEXTURE.eyebrow}</p>
          </Reveal>
          <SplitReveal className={`display mt-5 text-d2 font-bold tracking-tight ${outfit.className}`}>
            Lightweight. <em className={`not-italic font-medium text-gold-3 pr-1 ${outfit.className}`}>Deeply</em> nourishing.
          </SplitReveal>
          <Reveal delay={0.15}>
            <p className="lead mt-8 max-w-[42ch]">{TEXTURE.lead}</p>
          </Reveal>

          {/* Text and rules only — the icons here carried no meaning and
              repeated a treatment used three times elsewhere on the page. */}
          <ul className="tx-features mt-10 flex flex-col">
            {TEXTURE.features.map((text) => (
              <li key={text} className="relative py-4">
                <span aria-hidden className="tx-rule absolute inset-x-0 top-0 h-px bg-line" />
                <span className="tx-feature block text-base text-ink transition-colors duration-200">
                  {text}
                </span>
              </li>
            ))}
            <span aria-hidden className="tx-rule block h-px bg-line" />
          </ul>
        </div>
      </div>
    </section>
  );
}
