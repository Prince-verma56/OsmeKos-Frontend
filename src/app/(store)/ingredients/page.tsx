import type { Metadata } from "next";
import PageHeader from "@/storefront/components/PageHeader";
import ParallaxImage from "@/storefront/components/ui/ParallaxImage";
import Reveal from "@/storefront/components/ui/Reveal";
import SplitReveal from "@/storefront/components/ui/SplitReveal";
import ActivesGrid from "@/storefront/components/pages/ActivesGrid";
import InciTable from "@/storefront/components/pages/InciTable";
import CtaBand from "@/storefront/components/pages/CtaBand";

export const metadata: Metadata = {
  title: "Ingredients",
  description:
    "Every ingredient in the OsmeKos Body Lotion, with its percentage and what it does: Glycerin, Shea Butter, Coconut Oil, Niacinamide, Triple Ceramides and Vitamin E.",
};

const FREE_FROM = [
  { t: "Parabens", d: "Preserved with phenoxyethanol and sodium benzoate instead." },
  { t: "Sulfates", d: "Nothing that strips the skin's natural oils." },
  { t: "Mineral oil", d: "Moisture comes from shea butter, coconut oil and fatty acids." },
];

export default function IngredientsPage() {
  return (
    <div className="pb-24 md:pb-32">
      <PageHeader
        eyebrow="Ingredients"
        title={
          <>
            Nothing <em>hidden.</em>
          </>
        }
        text="Six actives with their exact percentages on the front of the bottle, and every other ingredient on the back. Here is what each one does."
      />

      <section className="container-x mt-16 grid items-center gap-8 md:mt-24 lg:grid-cols-12 lg:gap-12">
        <ParallaxImage
          mode="card"
          src="/products/formulated.webp"
          alt="The six key ingredients of the OsmeKos Body Lotion"
          speed={0.5}
          sizes="(max-width: 1024px) 100vw, 50vw"
          className="aspect-square rounded-[2rem] lg:col-span-6"
        />
        <div className="lg:col-span-5 lg:col-start-8">
          <Reveal>
            <p className="eyebrow">The formula at a glance</p>
          </Reveal>
          <SplitReveal className="display mt-4 text-4xl md:text-5xl">
            Barrier first, <em>always.</em>
          </SplitReveal>
          <Reveal delay={0.1}>
            <p className="lead mt-6">
              Glycerin pulls water in. Shea butter, coconut oil and fatty acids keep it there. Ceramides and niacinamide
              rebuild the barrier that stops it escaping. Vitamin E protects all of it.
            </p>
          </Reveal>
          <Reveal delay={0.2} children_ stagger={0.08} className="mt-8 grid grid-cols-3 gap-4 border-t border-line pt-6">
            {[
              ["6", "Actives"],
              ["29", "Ingredients in total"],
              ["100%", "Disclosed"],
            ].map(([n, l]) => (
              <div key={l}>
                <p className="font-display text-4xl leading-none">{n}</p>
                <p className="mt-2 text-[10px] uppercase tracking-[0.2em] text-muted">{l}</p>
              </div>
            ))}
          </Reveal>
        </div>
      </section>

      <section className="container-x mt-24 md:mt-32">
        <div className="max-w-2xl">
          <Reveal>
            <p className="eyebrow">The six actives</p>
          </Reveal>
          <SplitReveal className="display mt-4 text-4xl md:text-6xl">
            What they do, and <em>why that amount.</em>
          </SplitReveal>
        </div>
        <div className="mt-12 md:mt-16">
          <ActivesGrid />
        </div>
      </section>

      <section className="mt-24 bg-sand py-20 md:mt-32 md:py-28">
        <div className="container-x grid gap-12 lg:grid-cols-12">
          <div className="lg:col-span-4">
            <div className="lg:sticky lg:top-32">
              <Reveal>
                <p className="eyebrow">Full ingredient list</p>
              </Reveal>
              <SplitReveal className="display mt-4 text-4xl md:text-5xl">
                Every line of the label, <em>decoded.</em>
              </SplitReveal>
              <Reveal delay={0.1}>
                <p className="mt-6 max-w-sm text-[15px] leading-relaxed text-ink-2">
                  In the order it appears on the bottle, from the highest concentration to the lowest. Tap a category to
                  see which ingredients do what.
                </p>
              </Reveal>
            </div>
          </div>
          <div className="lg:col-span-8">
            <InciTable />
          </div>
        </div>
      </section>

      <section className="container-x mt-24 md:mt-32">
        <div className="grid gap-10 lg:grid-cols-12">
          <div className="lg:col-span-4">
            <Reveal>
              <p className="eyebrow">Free from</p>
            </Reveal>
            <SplitReveal className="display mt-4 text-4xl md:text-5xl">
              What we <em>left out.</em>
            </SplitReveal>
          </div>
          <div className="lg:col-span-8">
            <Reveal children_ stagger={0.1} className="grid gap-4 md:grid-cols-3">
              {FREE_FROM.map((f) => (
                <div key={f.t} className="rounded-[1.5rem] border border-line p-6">
                  <p className="flex items-center gap-3 font-display text-2xl">
                    <span className="relative flex h-7 w-7 items-center justify-center rounded-full border border-ink/25">
                      <span className="absolute h-px w-4 rotate-45 bg-ink" />
                    </span>
                    {f.t}
                  </p>
                  <p className="mt-3 text-[14px] leading-relaxed text-ink-2">{f.d}</p>
                </div>
              ))}
            </Reveal>
            <Reveal delay={0.2}>
              <p className="mt-6 max-w-2xl text-[13.5px] leading-relaxed text-muted">
                In the interest of full honesty: the lotion does contain a light fragrance, and the fragrance components
                are declared individually above. If your skin is reactive, patch test on your inner arm first.
              </p>
            </Reveal>
          </div>
        </div>
      </section>

      <CtaBand
        eyebrow="Try it"
        title={
          <>
            Now you know <em>what&apos;s inside.</em>
          </>
        }
        text="200 ml of barrier-first body care, with every percentage on the label."
        primary={{ href: "/product/body-lotion", label: "Shop Body Lotion" }}
        secondary={{ href: "/faq", label: "Read the FAQ" }}
      />
    </div>
  );
}
