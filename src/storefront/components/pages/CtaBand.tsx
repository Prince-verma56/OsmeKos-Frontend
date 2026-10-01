import Reveal from "@/storefront/components/ui/Reveal";
import SplitReveal from "@/storefront/components/ui/SplitReveal";
import Button from "@/storefront/components/ui/Button";
import type { ReactNode } from "react";

/** Dark closing band used at the bottom of content pages. */
export default function CtaBand({
  eyebrow,
  title,
  text,
  primary,
  secondary,
}: {
  eyebrow: string;
  title: ReactNode;
  text?: string;
  primary: { href: string; label: string };
  secondary?: { href: string; label: string };
}) {
  return (
    <section className="container-x mt-24 md:mt-32">
      <div className="relative overflow-hidden rounded-[2rem] bg-ink px-7 py-14 text-cream md:rounded-[2.5rem] md:px-16 md:py-20">
        <div className="pointer-events-none absolute -right-24 -top-24 h-80 w-80 rounded-full bg-[radial-gradient(closest-side,rgb(201_162_78_/_0.35),transparent)]" />
        <div className="relative grid items-end gap-8 md:grid-cols-12">
          <div className="md:col-span-7">
            <Reveal>
              <p className="eyebrow text-gold">{eyebrow}</p>
            </Reveal>
            <SplitReveal className="display mt-4 text-4xl md:text-6xl [&_em]:text-gold">{title}</SplitReveal>
            {text && (
              <Reveal delay={0.1}>
                <p className="mt-5 max-w-md text-[15px] leading-relaxed text-cream/65">{text}</p>
              </Reveal>
            )}
          </div>
          <Reveal delay={0.2} className="flex flex-wrap gap-3 md:col-span-5 md:justify-end">
            <Button href={primary.href} variant="gold" arrow>
              {primary.label}
            </Button>
            {secondary && (
              <Button href={secondary.href} variant="light">
                {secondary.label}
              </Button>
            )}
          </Reveal>
        </div>
      </div>
    </section>
  );
}
