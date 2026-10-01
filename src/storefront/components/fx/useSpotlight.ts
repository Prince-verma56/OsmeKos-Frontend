"use client";

import { useEffect, type RefObject } from "react";
import { gsap } from "@/storefront/lib/gsap";

/**
 * Adds a gold spotlight that follows the pointer, a subtle 3D tilt and a hover lift
 * to every element matching `selector` inside `scope`. Lift is done in GSAP (not a
 * Tailwind translate class) so it composes with GSAP's own transforms.
 */
export function useSpotlight(scope: RefObject<HTMLElement | null>, selector: string, { tilt = 4, lift = 6 } = {}) {
  useEffect(() => {
    const root = scope.current;
    if (
      !root ||
      window.matchMedia("(pointer: coarse)").matches ||
      window.matchMedia("(prefers-reduced-motion: reduce)").matches
    )
      return;
    // Skip aria-hidden duplicates (marquee clones) — they would double the
    // listener count for content the user cannot reach.
    const els = Array.from(root.querySelectorAll<HTMLElement>(selector)).filter(
      (el) => !el.closest("[aria-hidden='true']"),
    );
    const offs = els.map((el) => {
      el.classList.add("spotlight");
      gsap.set(el, { transformPerspective: 900 });
      const rx = gsap.quickTo(el, "rotationX", { duration: 0.7, ease: "power3" });
      const ry = gsap.quickTo(el, "rotationY", { duration: 0.7, ease: "power3" });
      const yy = gsap.quickTo(el, "y", { duration: 0.7, ease: "power3" });
      const move = (e: PointerEvent) => {
        const r = el.getBoundingClientRect();
        const px = (e.clientX - r.left) / r.width;
        const py = (e.clientY - r.top) / r.height;
        el.style.setProperty("--mx", `${px * 100}%`);
        el.style.setProperty("--my", `${py * 100}%`);
        ry((px - 0.5) * tilt);
        rx(-(py - 0.5) * tilt);
      };
      const enter = () => yy(-lift);
      const leave = () => {
        rx(0);
        ry(0);
        yy(0);
      };
      el.addEventListener("pointermove", move);
      el.addEventListener("pointerenter", enter);
      el.addEventListener("pointerleave", leave);
      return () => {
        el.removeEventListener("pointermove", move);
        el.removeEventListener("pointerenter", enter);
        el.removeEventListener("pointerleave", leave);
      };
    });
    return () => offs.forEach((off) => off());
  }, [scope, selector, tilt, lift]);
}
