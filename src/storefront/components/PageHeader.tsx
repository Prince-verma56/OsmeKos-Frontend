import SplitReveal from "@/storefront/components/ui/SplitReveal";
import Reveal from "@/storefront/components/ui/Reveal";
import type { ReactNode } from "react";

export default function PageHeader({ eyebrow, title, text }: { eyebrow: string; title: ReactNode; text?: string }) {
  return (
    <div className="container-x pt-[130px] md:pt-[170px]">
      <Reveal>
        <p className="eyebrow">{eyebrow}</p>
      </Reveal>
      <SplitReveal as="h1" className="display mt-5 max-w-4xl text-[13vw] sm:text-6xl md:text-7xl lg:text-8xl">
        {title}
      </SplitReveal>
      {text && (
        <Reveal delay={0.15}>
          <p className="lead mt-6 max-w-xl">{text}</p>
        </Reveal>
      )}
    </div>
  );
}
