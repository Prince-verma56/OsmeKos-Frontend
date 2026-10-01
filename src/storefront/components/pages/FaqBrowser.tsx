"use client";

import Link from "next/link";
import { useMemo, useRef, useState } from "react";
import { gsap, useGSAP } from "@/storefront/lib/gsap";
import { prefersReduced } from "@/storefront/lib/motion";
import { FAQS } from "@/storefront/lib/faq";
import { Accordion, AccordionItem } from "@/storefront/components/ui/Accordion";

export default function FaqBrowser() {
  const [q, setQ] = useState("");
  const [group, setGroup] = useState<string>("all");
  const ref = useRef<HTMLDivElement>(null);

  const groups = useMemo(() => {
    const term = q.trim().toLowerCase();
    return FAQS.filter((g) => group === "all" || g.id === group)
      .map((g) => ({
        ...g,
        items: g.items.filter((it) => !term || it.q.toLowerCase().includes(term) || it.a.toLowerCase().includes(term)),
      }))
      .filter((g) => g.items.length);
  }, [q, group]);

  const total = groups.reduce((n, g) => n + g.items.length, 0);

  useGSAP(
    () => {
      if (prefersReduced()) {
        gsap.set(".faq-group", { autoAlpha: 1, y: 0 });
        return;
      }
      gsap.fromTo(".faq-group", { autoAlpha: 0, y: 24 }, { autoAlpha: 1, y: 0, duration: 0.8, stagger: 0.08, ease: "expo.out", overwrite: true });
    },
    { scope: ref, dependencies: [group] },
  );

  return (
    <div ref={ref} className="grid gap-10 lg:grid-cols-12">
      <aside className="lg:col-span-4">
        <div className="lg:sticky lg:top-32">
          <label className="relative block">
            <span className="sr-only">Search questions</span>
            <svg viewBox="0 0 24 24" className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" fill="none" stroke="currentColor" strokeWidth={1.6}>
              <circle cx="11" cy="11" r="6.5" />
              <path d="m16 16 4 4" strokeLinecap="round" />
            </svg>
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Search, e.g. delivery"
              className="input pl-11"
            />
          </label>

          <nav className="mt-6 flex flex-wrap gap-2 lg:flex-col lg:gap-1">
            {[{ id: "all", title: "All questions" }, ...FAQS].map((g) => (
              <button
                key={g.id}
                onClick={() => setGroup(g.id)}
                className={`rounded-full border px-4 py-2 text-left text-[13px] transition-colors duration-300 lg:rounded-xl lg:border-transparent lg:px-4 lg:py-3 ${
                  group === g.id ? "border-ink bg-ink text-cream" : "border-ink/15 text-ink-2 hover:bg-white/60 hover:text-ink"
                }`}
              >
                {g.title}
              </button>
            ))}
          </nav>
        </div>
      </aside>

      <div className="lg:col-span-8">
        {total === 0 ? (
          <div className="rounded-[1.6rem] border border-line p-10 text-center">
            <p className="font-display text-3xl">No matching questions.</p>
            <p className="mt-3 text-[14.5px] text-ink-2">
              Try another word, or{" "}
              <Link href="/contact" className="font-semibold text-ink underline decoration-gold underline-offset-4">
                ask us directly
              </Link>
              .
            </p>
          </div>
        ) : (
          groups.map((g) => (
            <section key={g.id} className="faq-group mb-12 last:mb-0">
              <div className="mb-2 flex items-baseline justify-between">
                <h2 className="display text-3xl md:text-4xl">{g.title}</h2>
                <span className="text-[11px] uppercase tracking-[0.2em] text-muted">{g.items.length} questions</span>
              </div>
              <Accordion>
                {g.items.map((it) => (
                  <AccordionItem key={it.q} title={it.q}>
                    {it.a}
                  </AccordionItem>
                ))}
              </Accordion>
            </section>
          ))
        )}
      </div>
    </div>
  );
}
