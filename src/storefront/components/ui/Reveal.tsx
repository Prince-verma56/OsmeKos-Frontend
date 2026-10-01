"use client";

import { useRef, type ReactNode, type ElementType } from "react";
import { gsap, useGSAP } from "@/storefront/lib/gsap";
import { DUR, EASE, MQ, STAGGER, START } from "@/storefront/lib/motion";

type Props = {
  children: ReactNode;
  className?: string;
  as?: ElementType;
  delay?: number;
  y?: number;
  duration?: number;
  start?: string;
  stagger?: number;
  /** animate direct children instead of the wrapper */
  children_?: boolean;
};

/**
 * Brings a block into the reading flow without drawing attention to itself.
 * The slight blur is what makes it read as a camera focusing rather than a
 * div fading.
 *
 * The hidden start state lives INSIDE the motion branch, so a reduced-motion
 * user — or a visitor whose JS fails after mount — never ends up with
 * permanently invisible content.
 */
export default function Reveal({
  children,
  className,
  as: Tag = "div",
  delay = 0,
  y = 28,
  duration = DUR.reveal,
  start = START,
  stagger = STAGGER.normal,
  children_ = false,
}: Props) {
  const ref = useRef<HTMLElement>(null);

  useGSAP(
    () => {
      const el = ref.current;
      if (!el) return;
      const targets = children_ ? Array.from(el.children) : el;
      const mm = gsap.matchMedia();

      mm.add(MQ.motion, () => {
        gsap.from(targets, {
          y,
          autoAlpha: 0,
          filter: "blur(4px)",
          clearProps: "filter",
          duration,
          delay,
          ease: EASE.expo,
          stagger,
          scrollTrigger: { trigger: el, start, once: true },
        });
      });

      mm.add(MQ.reduced, () => {
        gsap.set(targets, { autoAlpha: 1, y: 0, filter: "none" });
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
