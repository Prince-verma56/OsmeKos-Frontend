"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useRef } from "react";
import { gsap, useGSAP } from "@/storefront/lib/gsap";
import { useCart } from "@/storefront/store/cart";
import { useBag } from "@/storefront/store/bag";
import { useUI } from "@/storefront/store/ui";
import { formatPrice } from "@/storefront/lib/format";
import { EASE, prefersReduced } from "@/storefront/lib/motion";
import { IconClose, IconMinus, IconPlus } from "./ui/Icons";
import Button from "./ui/Button";
import { outfit } from "@/app/fonts";

export default function CartDrawer() {
  const ref = useRef<HTMLDivElement>(null);
  const panelRef = useRef<HTMLElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);
  const { isOpen, close, setQty, remove } = useCart();
  const lenis = useUI((s) => s.lenis);
  const { lines: items, subtotal, shipping, total, count, hydrated, freeShippingOver, problem } = useBag();
  const wasOpen = useRef(isOpen);

  useGSAP(
    () => {
      const el = ref.current!;
      const panel = el.querySelector(".cart-panel");
      const overlay = el.querySelector(".cart-overlay");
      const reduced = prefersReduced();

      // If it's closed and was never open, just instantly set the hidden state.
      // This is safe for React 18 Strict Mode double-mounts.
      if (!isOpen && !wasOpen.current) {
        gsap.set(panel, { xPercent: 100, autoAlpha: 0 });
        gsap.set(overlay, { autoAlpha: 0 });
        return;
      }

      if (isOpen) {
        wasOpen.current = true;
        gsap.set(el, { pointerEvents: "auto" });
        gsap.set(panel, { autoAlpha: 1 });
        gsap
          .timeline({ defaults: { ease: EASE.expo } })
          .to(overlay, { autoAlpha: 1, duration: reduced ? 0.2 : 0.5 }, 0)
          .to(panel, { xPercent: 0, duration: reduced ? 0.2 : 0.9 }, 0)
          .from(
            ".cart-row",
            reduced
              ? { autoAlpha: 0, duration: 0.2 }
              : { x: 30, autoAlpha: 0, stagger: 0.06, duration: 0.8 },
            0.25,
          );
        lenis?.stop();
      } else {
        wasOpen.current = false;
        gsap
          .timeline({
            defaults: { ease: "power2.in" },
            onComplete: () => gsap.set(el, { pointerEvents: "none" }),
          })
          .to(panel, { xPercent: 100, autoAlpha: 0, duration: reduced ? 0.2 : 0.5 }, 0)
          .to(overlay, { autoAlpha: 0, duration: reduced ? 0.2 : 0.4 }, 0);
        lenis?.start();
      }
    },
    { scope: ref, dependencies: [isOpen] },
  );

  // Escape, focus management and the body scroll lock all belong to the open
  // state only. lenis.stop() alone does not stop native touch scrolling.
  useEffect(() => {
    if (!isOpen) return;

    const opener = document.activeElement as HTMLElement | null;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.stopPropagation();
        close();
        return;
      }
      if (e.key !== "Tab") return;

      const focusables = panelRef.current?.querySelectorAll<HTMLElement>(
        'a[href], button:not([disabled]), input, [tabindex]:not([tabindex="-1"])',
      );
      if (!focusables?.length) return;
      const first = focusables[0];
      const last = focusables[focusables.length - 1];
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    };

    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", onKey);
    const t = setTimeout(() => closeRef.current?.focus(), 60);

    return () => {
      clearTimeout(t);
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = prevOverflow;
      opener?.focus?.();
    };
  }, [isOpen, close]);

  return (
    <div ref={ref} className="pointer-events-none fixed inset-0 z-[150]">
      <div className="cart-overlay absolute inset-0 bg-ink/40 backdrop-blur-sm" onClick={close} />
      <aside
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-label="Your bag"
        className="cart-panel absolute right-0 top-0 flex h-full w-full max-w-[480px] flex-col bg-cream shadow-2xl"
      >
        <div className="flex items-center justify-between border-b border-line px-6 py-5 md:px-8">
          <h2 className="text-cap font-bold uppercase tracking-[0.25em]">
            Your bag <span className="text-muted num">({hydrated ? count : 0})</span>
          </h2>
          <button
            ref={closeRef}
            onClick={close}
            aria-label="Close bag"
            className="flex h-11 w-11 items-center justify-center rounded-chip transition-colors duration-200 hover:bg-ink hover:text-cream"
          >
            <IconClose className="h-5 w-5" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-6 py-6 md:px-8" data-lenis-prevent>
          {items.length === 0 ? (
            <div className="cart-row flex h-full flex-col items-center justify-center text-center">
              <p className={`text-[2.5rem] font-bold leading-[1.1] tracking-tight text-ink ${outfit.className}`}>
                Your bag is <span className="text-gold-3">empty.</span>
              </p>
              <p className={`mt-4 max-w-xs text-[15px] leading-relaxed text-ink-2 font-medium ${outfit.className}`}>
                Softer skin is one click away. Start with the Body Lotion.
              </p>
              <Button href="/shop" className="mt-8" onClick={close}>
                Shop the lotion
              </Button>
            </div>
          ) : (
            <ul className="flex flex-col gap-6">
              {items.map((line) => (
                <li key={line.slug} className="cart-row flex gap-5">
                  <div className="relative h-28 w-24 shrink-0 overflow-hidden rounded-field bg-sand">
                    {line.image && (
                      <Image src={line.image} alt="" fill sizes="96px" quality={75} className="object-cover" />
                    )}
                  </div>
                  <div className="flex flex-1 flex-col">
                    <div className="flex items-start justify-between gap-4">
                      <div>
                        <Link href={`/product/${line.slug}`} onClick={close} className="font-semibold">
                          {line.name}
                        </Link>
                        <p className="mt-0.5 text-xs text-muted">{line.size}</p>
                      </div>
                      <p className="num font-semibold">{formatPrice(line.lineTotal)}</p>
                    </div>
                    <div className="mt-auto flex items-center justify-between">
                      <div className="flex items-center overflow-hidden rounded-chip border border-ink/15">
                        <button
                          className="stepper-btn"
                          onClick={() => setQty(line.slug, line.quantity - 1)}
                          aria-label={`Decrease ${line.name} quantity, currently ${line.quantity}`}
                        >
                          <IconMinus className="h-4 w-4" />
                        </button>
                        <span className="num w-8 text-center text-sm" aria-hidden>
                          {line.quantity}
                        </span>
                        <button
                          className="stepper-btn"
                          onClick={() => setQty(line.slug, line.quantity + 1)}
                          aria-label={`Increase ${line.name} quantity, currently ${line.quantity}`}
                        >
                          <IconPlus className="h-4 w-4" />
                        </button>
                      </div>
                      <button
                        onClick={() => remove(line.slug)}
                        className="link-line text-eyebrow uppercase tracking-[0.2em] text-muted"
                      >
                        Remove<span className="sr-only"> {line.name}</span>
                      </button>
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>

        {items.length > 0 && (
          <div className="cart-row border-t border-line px-6 py-6 md:px-8">
            <div className="flex justify-between text-sm">
              <span className="text-muted">Subtotal</span>
              <span className="num">{formatPrice(subtotal)}</span>
            </div>
            <div className="mt-2 flex justify-between text-sm">
              <span className="text-muted">Shipping</span>
              <span className="num">{shipping === 0 ? "Free" : formatPrice(shipping)}</span>
            </div>
            {subtotal < freeShippingOver && (
              <p className="mt-3 text-xs text-gold-3" role="status">
                Add {formatPrice(freeShippingOver - subtotal)} more for free shipping.
              </p>
            )}
            {problem && (
              <p className="mt-3 text-xs text-danger" role="alert">
                {problem}
              </p>
            )}
            <div className="mt-4 flex justify-between border-t border-line pt-4 text-base font-semibold">
              <span>Total</span>
              <span className="num">{formatPrice(total)}</span>
            </div>
            <Button href="/checkout" className="mt-6 w-full" arrow onClick={close}>
              Checkout
            </Button>
          </div>
        )}
      </aside>
    </div>
  );
}
