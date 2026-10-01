import type { Metadata } from "next";
import PageHeader from "@/storefront/components/PageHeader";
import Reveal from "@/storefront/components/ui/Reveal";
import CountUp from "@/storefront/components/fx/CountUp";
import ReviewsWall from "@/storefront/components/pages/ReviewsWall";
import CtaBand from "@/storefront/components/pages/CtaBand";
import { IconStar } from "@/storefront/components/ui/Icons";
import { SITE } from "@/storefront/lib/site";

export const metadata: Metadata = {
  title: "Reviews",
  description: "What people across India say about the OsmeKos Body Lotion.",
};

const HIGHLIGHTS = [
  ["Absorbs fast", "What people notice first"],
  ["No greasy film", "Dress straight after applying"],
  ["Calmer, softer skin", "Especially through dry winters"],
];

export default function ReviewsPage() {
  return (
    <div className="pb-24 md:pb-32">
      <PageHeader
        eyebrow="Reviews"
        title={
          <>
            Loved by skin <em>everywhere.</em>
          </>
        }
        text="Real words from people who use the Body Lotion every day, from Bengaluru to Kolkata."
      />

      <section className="container-x mt-14 md:mt-20">
        <Reveal className="grid gap-6 rounded-[2rem] bg-sand p-8 md:grid-cols-12 md:items-center md:p-12">
          <div className="md:col-span-4">
            <div className="flex items-end gap-3">
              <CountUp value="4.9" className="font-display text-[5.5rem] leading-none text-ink" />
              <span className="mb-3 text-sm text-muted">/ 5</span>
            </div>
            <div className="mt-3 flex gap-1 text-gold">
              {Array.from({ length: 5 }).map((_, i) => (
                <IconStar key={i} className="h-4 w-4" />
              ))}
            </div>
            <p className="mt-3 text-sm text-ink-2">
              Average from <CountUp value="1,200" className="font-semibold text-ink" />+ reviews
            </p>
          </div>
          <div className="grid gap-5 border-t border-ink/12 pt-6 sm:grid-cols-3 md:col-span-8 md:border-l md:border-t-0 md:pl-10 md:pt-0">
            {HIGHLIGHTS.map(([t, d]) => (
              <div key={t}>
                <p className="font-display text-2xl leading-tight">{t}</p>
                <p className="mt-2 text-[13px] text-muted">{d}</p>
              </div>
            ))}
          </div>
        </Reveal>
      </section>

      <section className="container-x mt-16 md:mt-24">
        <ReviewsWall />
      </section>

      <CtaBand
        eyebrow="Your turn"
        title={
          <>
            Tried it? <em>Tell us.</em>
          </>
        }
        text="We read every message. Tell us how your skin feels, and we may feature your review."
        primary={{ href: `mailto:${SITE.email}?subject=${encodeURIComponent("My OsmeKos review")}`, label: "Write a review" }}
        secondary={{ href: "/product/body-lotion", label: "Shop the lotion" }}
      />
    </div>
  );
}
