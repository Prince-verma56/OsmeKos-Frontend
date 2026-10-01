"use client";

import { useRef } from "react";
import { gsap, useGSAP } from "@/storefront/lib/gsap";
import { MQ, START_LATE } from "@/storefront/lib/motion";

/** Counts from 0 to the numeric part of `value` when scrolled into view.
 *  Keeps any prefix/suffix. Under reduced motion the final value is rendered
 *  straight away — it is server-rendered as `value`, so nothing is needed. */
export default function CountUp({
  value,
  className,
  duration = 2,
}: {
  value: string;
  className?: string;
  duration?: number;
}) {
  const ref = useRef<HTMLSpanElement>(null);
  const m = value.match(/^([^\d]*)([\d,]*\.?\d+)(.*)$/);

  useGSAP(
    () => {
      const el = ref.current;
      if (!el || !m) return;
      const mm = gsap.matchMedia();

      mm.add(MQ.motion, () => {
        const [, pre, num, post] = m;
        const target = parseFloat(num.replace(/,/g, ""));
        const decimals = num.includes(".") ? num.split(".")[1].length : 0;
        const comma = num.includes(",");
        const fmt = (n: number) => {
          const s = n.toFixed(decimals);
          return pre + (comma ? Number(s).toLocaleString("en-IN", { minimumFractionDigits: decimals }) : s) + post;
        };
        const o = { n: 0 };
        el.textContent = fmt(0);
        gsap.to(o, {
          n: target,
          duration,
          ease: "power3.out",
          scrollTrigger: { trigger: el, start: START_LATE, once: true },
          onUpdate: () => (el.textContent = fmt(o.n)),
        });
        return () => {
          el.textContent = value;
        };
      });

      return () => mm.revert();
    },
    { scope: ref },
  );

  return (
    <span ref={ref} className={`num ${className ?? ""}`}>
      {value}
    </span>
  );
}
