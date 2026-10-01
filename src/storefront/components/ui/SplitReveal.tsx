"use client";

import { useRef, type ReactNode, type ElementType } from "react";
import { gsap, SplitText, useGSAP } from "@/storefront/lib/gsap";
import { EASE, MQ, START } from "@/storefront/lib/motion";

type Props = {
  children: ReactNode;
  className?: string;
  as?: ElementType;
  delay?: number;
  start?: string;
  type?: "lines" | "words" | "chars";
  stagger?: number;
  duration?: number;
};

/**
 * Line-by-line heading reveal.
 *
 * Splitting must wait for document.fonts.ready — splitting against fallback
 * metrics produces wrong line breaks that never re-flow. `autoSplit` re-splits
 * on resize, and `.split-line-mask` (store.css) stops the line masks clipping
 * serif descenders.
 */
export default function SplitReveal({
  children,
  className,
  as: Tag = "h2",
  delay = 0,
  start = START,
  type = "lines",
  stagger,
  duration = 1.4,
}: Props) {
  const ref = useRef<HTMLElement>(null);

  useGSAP(
    () => {
      const el = ref.current;
      if (!el) return;
      const mm = gsap.matchMedia();

      mm.add(MQ.motion, () => {
        let split: SplitText | undefined;
        let tween: gsap.core.Tween | undefined;
        let cancelled = false;

        document.fonts.ready.then(() => {
          if (cancelled) return;
          gsap.set(el, { autoAlpha: 1 });
          split = SplitText.create(el, {
            type,
            mask: type,
            linesClass: "split-line",
            autoSplit: true,
            onSplit: (self) => {
              const targets =
                type === "lines" ? self.lines : type === "words" ? self.words : self.chars;
              tween = gsap.from(targets, {
                yPercent: 130,
                filter: "blur(8px)",
                clearProps: "filter",
                duration,
                delay,
                ease: EASE.expo,
                stagger: stagger ?? (type === "lines" ? 0.09 : type === "words" ? 0.04 : 0.02),
                scrollTrigger: { trigger: el, start, once: true },
              });
              return tween;
            },
          });
        });

        return () => {
          cancelled = true;
          tween?.scrollTrigger?.kill();
          tween?.kill();
          split?.revert();
        };
      });

      // Reduced motion: never split at all. Saves the DOM work and guarantees
      // the heading is selectable, readable and correctly wrapped.
      mm.add(MQ.reduced, () => {
        gsap.set(el, { autoAlpha: 1 });
      });

      return () => mm.revert();
    },
    { scope: ref },
  );

  return (
    <Tag ref={ref} className={className}>
      {children}
    </Tag>
  );
}
