"use client";

import Link from "next/link";
import { useRef, useState } from "react";
import { gsap, useGSAP } from "@/storefront/lib/gsap";
import { EASE, MQ, STAGGER, START } from "@/storefront/lib/motion";
import { IconArrow } from "./ui/Icons";
import { apiPost, errorText } from "@/storefront/lib/api";
import { outfit } from "@/app/fonts";

const REST = [
  {
    title: "Company",
    links: [
      ["Our story", "/about"],
      ["Ingredients", "/ingredients"],
      ["Reviews", "/reviews"],
      ["Contact", "/contact"],
    ],
  },
  {
    title: "Help",
    links: [
      ["FAQ", "/faq"],
      ["Shipping & returns", "/shipping-returns"],
      ["Customer care: 95365 45783", "tel:+919536545783"],
    ],
  },
];

function NewsletterForm() {
  const [sent, setSent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);

  const subscribe = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (busy) return;
    const form = e.currentTarget;
    const email = String(new FormData(form).get("email") ?? "").trim();

    setBusy(true);
    setProblem(null);
    try {
      await apiPost("/newsletter", { email });
      setSent(true);
      form.reset();
    } catch (err) {
      setProblem(errorText(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <form className="mt-8 flex max-w-md items-center border-b border-cream/20 pb-3 transition-colors focus-within:border-cream/60" onSubmit={subscribe}>
        <label htmlFor="newsletter-email" className="sr-only">
          Email address
        </label>
        <input
          id="newsletter-email"
          type="email"
          name="email"
          required
          autoComplete="email"
          placeholder="your@email.com"
          className={`flex-1 bg-transparent text-[17px] text-cream outline-none placeholder:text-cream/30 ${outfit.className}`}
          suppressHydrationWarning
        />
        <button
          type="submit"
          aria-label="Subscribe to the newsletter"
          disabled={busy}
          className="flex h-11 w-11 items-center justify-center rounded-full bg-gold-3 text-ink transition-transform duration-500 hover:scale-110 disabled:opacity-50"
        >
          <IconArrow aria-hidden className="h-4 w-4" />
        </button>
      </form>
      <p role="status" aria-live="polite" className={`mt-4 text-xs font-medium tracking-wide text-gold-3 empty:mt-0 ${outfit.className}`}>
        {sent ? "Thank you. You're on the list." : ""}
      </p>
      {problem && (
        <p role="alert" className={`mt-2 text-xs font-medium text-cream/80 ${outfit.className}`}>
          {problem}
        </p>
      )}
    </>
  );
}

export default function Footer({ shopLinks = [] }: { shopLinks?: [string, string][] }) {
  const COLS = [{ title: "Shop", links: [...shopLinks, ["All products", "/shop"]] }, ...REST];
  const ref = useRef<HTMLElement>(null);

  useGSAP(
    () => {
      const mm = gsap.matchMedia();

      mm.add(MQ.motion, () => {
        gsap.fromTo(
          ".ft-letter",
          { yPercent: 105, rotate: 4 },
          {
            yPercent: 0,
            rotate: 0,
            ease: "none",
            stagger: 0.04,
            scrollTrigger: { trigger: ".ft-word", start: "top 100%", end: "bottom 85%", scrub: 0.8 },
          },
        );
        gsap.from(".ft-col", {
          y: 30,
          autoAlpha: 0,
          stagger: 0.1,
          duration: 1.2,
          ease: EASE.expo,
          scrollTrigger: { trigger: ref.current, start: START, once: true },
        });
        // The legal rules are the last thing on the page; they were also the
        // only thing on it that simply appeared.
        gsap.from(".ft-fine", {
          y: 16,
          autoAlpha: 0,
          stagger: STAGGER.normal,
          duration: 0.9,
          ease: EASE.expo,
          scrollTrigger: { trigger: ".ft-word", start: "bottom 95%", once: true },
        });
      });

      mm.add(MQ.reduced, () => {
        gsap.set(".ft-letter", { yPercent: 0, rotate: 0 });
        gsap.set(".ft-col, .ft-fine", { autoAlpha: 1, y: 0 });
      });

      return () => mm.revert();
    },
    { scope: ref },
  );

  return (
    <footer ref={ref} className="on-ink relative overflow-hidden bg-ink text-cream">
      <div className="container-x pt-20 md:pt-28">
        <div className="grid gap-14 lg:grid-cols-12 lg:gap-10">
          <div className="ft-col lg:col-span-5">
            <p className={`eyebrow text-gold-3 uppercase tracking-[0.2em] font-semibold text-sm ${outfit.className}`}>
              Newsletter
            </p>
            <h2 className={`mt-5 text-[3rem] md:text-[3.5rem] leading-[1.05] tracking-tight font-bold text-cream ${outfit.className}`}>
              Skin notes, <span className="text-gold-3">occasionally.</span>
            </h2>
            <p className="mt-3 max-w-[44ch] text-sm leading-relaxed text-cream/65">
              Launches, restocks and honest skincare reading. No noise, unsubscribe anytime.
            </p>
            <NewsletterForm />
          </div>

          <nav aria-label="Footer" className="grid grid-cols-2 gap-8 md:grid-cols-3 lg:col-span-7 lg:pl-10">
            {COLS.map((c) => (
              <div key={c.title} className="ft-col">
                <p className="eyebrow text-gold">{c.title}</p>
                <ul className="mt-4 flex flex-col gap-2.5">
                  {c.links.map(([label, href]) => (
                    <li key={label}>
                      <Link
                        href={href}
                        className="link-line text-sm text-cream/75 transition-colors hover:text-cream"
                      >
                        {label}
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </nav>
        </div>

        <div className="mt-16 overflow-hidden border-t border-cream/20 pt-8 pb-4 md:mt-24">
          <div
            aria-hidden
            className={`ft-word flex justify-center select-none text-[16vw] leading-none text-cream font-bold tracking-tighter md:text-[14.5vw] ${outfit.className}`}
          >
            {"OsmeKos".split("").map((c, i) => (
              <span key={i} className="ft-letter inline-block" style={{ marginRight: "-0.02em" }}>
                {c}
              </span>
            ))}
          </div>
        </div>

        <div className="ft-fine flex flex-col gap-2 border-t border-line-inv py-4 text-eyebrow uppercase tracking-[0.2em] text-cream/45 md:flex-row md:items-center md:justify-between">
          <p>© 2026 Osmekos Essentials Pvt. Ltd. New Delhi</p>
          <p className="flex flex-wrap items-center gap-x-4 gap-y-2">
            <Link href="/privacy" className="link-line transition-colors hover:text-cream">
              Privacy
            </Link>
            <Link href="/terms" className="link-line transition-colors hover:text-cream">
              Terms
            </Link>
            <span>Made in India</span>
          </p>
        </div>

        <div className="ft-fine flex justify-center border-t border-line-inv py-4">
          <p className="group flex items-center gap-2 text-xs tracking-[0.04em] text-cream/70">
            Made by
            <span className="font-display text-base italic text-cream transition-colors duration-500 group-hover:text-gold">
              The Angaar Labs
            </span>
          </p>
        </div>
      </div>
    </footer>
  );
}
