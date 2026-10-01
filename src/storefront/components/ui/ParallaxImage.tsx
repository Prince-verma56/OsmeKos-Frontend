"use client";

import Image from "next/image";
import { useRef } from "react";
import { gsap, useGSAP } from "@/storefront/lib/gsap";
import { EASE, MQ } from "@/storefront/lib/motion";

type Props = {
  src: string;
  alt: string;
  className?: string;
  imgClassName?: string;
  /** 0–1. Scales travel within the 8% ceiling; 1 = the full 8%. */
  speed?: number;
  reveal?: boolean;
  sizes?: string;
  priority?: boolean;
  quality?: number;
  /**
   * "inner" drifts the photo inside a fixed frame (needs the overscan) — use
   * it when the frame should hold its place in the layout.
   * "card" moves the whole frame — use it for grid media where the
   * differential between neighbours is what creates depth.
   */
  mode?: "inner" | "card";
};

/** Hard ceiling from 09_PARALLAX_AND_DEPTH.md: no element travels more than
 *  8% of its own height across a full scroll pass. */
const MAX_TRAVEL = 8;

export default function ParallaxImage({
  src,
  alt,
  className = "",
  imgClassName = "",
  speed = 1,
  reveal = true,
  sizes = "(max-width: 768px) 100vw, 50vw",
  priority,
  quality = 75,
  mode = "inner",
}: Props) {
  const wrap = useRef<HTMLDivElement>(null);

  useGSAP(
    () => {
      const el = wrap.current;
      if (!el) return;
      const mm = gsap.matchMedia();
      const travel = gsap.utils.clamp(0, MAX_TRAVEL, MAX_TRAVEL * speed);

      // Parallax only from 768px up: a short viewport plays the same scrub
      // over far less scroll distance, which turns drift into a jump.
      mm.add(MQ.parallax, () => {
        const target = mode === "inner" ? el.querySelector("img") : el;
        gsap.fromTo(
          target,
          { yPercent: mode === "inner" ? -travel / 2 : travel },
          {
            yPercent: mode === "inner" ? travel / 2 : -travel,
            ease: EASE.none,
            scrollTrigger: { trigger: el, start: "top bottom", end: "bottom top", scrub: true },
          },
        );
      });

      if (reveal) {
        mm.add(MQ.motion, () => {
          gsap.from(el.firstElementChild, {
            clipPath: "inset(10% 6% 10% 6% round 2rem)",
            duration: 1.5,
            ease: EASE.expo,
            scrollTrigger: { trigger: el, start: "top 85%", once: true },
          });
        });
      }

      mm.add(MQ.reduced, () => {
        gsap.set([el, el.querySelector("img")], { yPercent: 0 });
        gsap.set(el.firstElementChild, { clipPath: "inset(0 round 0)" });
      });

      return () => mm.revert();
    },
    { scope: wrap },
  );

  return (
    <div ref={wrap} className={`relative ${className}`}>
      <div
        className="absolute inset-0 overflow-hidden rounded-[inherit]"
        style={{ clipPath: "inset(0 round 0)" }}
      >
        <Image
          src={src}
          alt={alt}
          fill
          sizes={sizes}
          priority={priority}
          quality={quality}
          className={`object-cover will-change-transform ${mode === "inner" ? "scale-[1.08]" : ""} ${imgClassName}`}
        />
      </div>
    </div>
  );
}
