"use client";

import { useRef, useState, type ReactNode } from "react";
import { ScrollTrigger, useGSAP } from "@/storefront/lib/gsap";
import { useUI } from "@/storefront/store/ui";

export type PolicySection = { id: string; title: string; body: ReactNode };

/** Two-column policy layout: sticky contents list with scroll-spy, and the article. */
export default function PolicyLayout({ sections, updated }: { sections: PolicySection[]; updated: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const [active, setActive] = useState(sections[0]?.id);

  useGSAP(
    () => {
      sections.forEach((s) => {
        ScrollTrigger.create({
          trigger: `#${s.id}`,
          start: "top 45%",
          end: "bottom 45%",
          onToggle: (self) => self.isActive && setActive(s.id),
        });
      });
    },
    { scope: ref },
  );

  const go = (id: string) => {
    const el = document.getElementById(id);
    if (!el) return;
    const lenis = useUI.getState().lenis;
    if (lenis) lenis.scrollTo(el, { offset: -120 });
    else el.scrollIntoView({ behavior: "smooth" });
  };

  return (
    <div ref={ref} className="container-x mt-14 grid gap-12 md:mt-20 lg:grid-cols-12">
      <aside className="lg:col-span-3">
        <div className="lg:sticky lg:top-32">
          <p className="eyebrow">On this page</p>
          <nav className="mt-5 flex flex-wrap gap-2 lg:flex-col lg:gap-0.5">
            {sections.map((s, i) => (
              <button
                key={s.id}
                onClick={() => go(s.id)}
                className={`group flex items-center gap-3 rounded-full border px-4 py-2 text-left text-[13px] transition-colors duration-300 lg:rounded-none lg:border-0 lg:px-0 lg:py-2 ${
                  active === s.id ? "border-ink bg-ink text-cream lg:bg-transparent lg:text-ink" : "border-ink/15 text-muted hover:text-ink"
                }`}
              >
                <span
                  className={`hidden h-px bg-gold transition-all duration-500 lg:block ${active === s.id ? "w-8" : "w-3 group-hover:w-5"}`}
                />
                <span className="hidden font-display text-[12px] text-gold-2 lg:inline">{String(i + 1).padStart(2, "0")}</span>
                {s.title}
              </button>
            ))}
          </nav>
          <p className="mt-8 hidden text-[11px] uppercase tracking-[0.2em] text-muted lg:block">Last updated · {updated}</p>
        </div>
      </aside>

      <article className="lg:col-span-8 lg:col-start-5">
        {sections.map((s, i) => (
          <section key={s.id} id={s.id} className="scroll-mt-32 border-t border-line py-10 first:border-t-0 first:pt-0 md:py-12">
            <p className="font-display text-sm text-gold-2">{String(i + 1).padStart(2, "0")}</p>
            <h2 className="display mt-2 text-3xl md:text-4xl">{s.title}</h2>
            <div className="prose-policy mt-5">{s.body}</div>
          </section>
        ))}
        <p className="border-t border-line pt-8 text-[11px] uppercase tracking-[0.2em] text-muted lg:hidden">Last updated · {updated}</p>
      </article>
    </div>
  );
}
