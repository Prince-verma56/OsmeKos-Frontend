import type { Metadata } from "next";
import Link from "next/link";
import PageHeader from "@/storefront/components/PageHeader";
import Reveal from "@/storefront/components/ui/Reveal";
import ContactForm from "@/storefront/components/pages/ContactForm";
import { IconArrow } from "@/storefront/components/ui/Icons";
import { SITE } from "@/storefront/lib/site";

export const metadata: Metadata = {
  title: "Contact",
  description: `Get in touch with OsmeKos customer care. Call ${SITE.phone} or email ${SITE.email}.`,
};

const CARDS = [
  { label: "Call us", value: SITE.phone, href: SITE.phoneHref, note: SITE.hours },
  { label: "Email", value: SITE.email, href: `mailto:${SITE.email}`, note: "Write to us any time" },
  { label: "Visit", value: SITE.address.slice(0, 2).join(", "), href: SITE.mapsUrl, note: "Open in Google Maps", external: true },
];

export default function ContactPage() {
  return (
    <div className="pb-24 md:pb-32">
      <PageHeader
        eyebrow="Contact"
        title={
          <>
            We&apos;re here to <em>help.</em>
          </>
        }
        text="Questions about an order, the formula or your skin. Real people read every message."
      />

      <section className="container-x mt-14 grid gap-12 md:mt-20 lg:grid-cols-12">
        <Reveal className="lg:col-span-7">
          <div className="rounded-[2rem] border border-line bg-white/50 p-6 md:p-10">
            <h2 className="display text-3xl md:text-4xl">
              Send us a <em>message</em>
            </h2>
            <div className="mt-8">
              <ContactForm />
            </div>
          </div>
        </Reveal>

        <div className="flex flex-col gap-4 lg:col-span-5">
          {CARDS.map((c, i) => (
            <Reveal key={c.label} delay={0.08 * i}>
              <a
                href={c.href}
                target={c.external ? "_blank" : undefined}
                rel={c.external ? "noopener noreferrer" : undefined}
                className="group flex items-start justify-between gap-6 rounded-[1.6rem] bg-sand p-6 transition-colors duration-500 hover:bg-ink hover:text-cream md:p-7"
              >
                <span>
                  <span className="eyebrow block group-hover:text-gold">{c.label}</span>
                  <span className="mt-3 block font-display text-2xl leading-snug md:text-[1.7rem]">{c.value}</span>
                  <span className="mt-2 block text-[13px] text-muted transition-colors group-hover:text-cream/60">{c.note}</span>
                </span>
                <span className="mt-1 flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-ink/20 transition-all duration-500 group-hover:-rotate-45 group-hover:border-gold group-hover:bg-gold group-hover:text-ink">
                  <IconArrow className="h-4 w-4" />
                </span>
              </a>
            </Reveal>
          ))}

          <Reveal delay={0.3}>
            <div className="rounded-[1.6rem] border border-line p-6 md:p-7">
              <p className="eyebrow">Quick answers</p>
              <p className="mt-3 text-[14.5px] leading-relaxed text-ink-2">
                Delivery times, returns and how to use the lotion are covered in our help centre.
              </p>
              <div className="mt-4 flex flex-wrap gap-x-6 gap-y-2 text-[13px] font-semibold">
                <Link href="/faq" className="link-line">FAQ</Link>
                <Link href="/shipping-returns" className="link-line">Shipping &amp; returns</Link>
              </div>
            </div>
          </Reveal>

          <Reveal delay={0.35}>
            <p className="px-2 text-[12px] leading-relaxed text-muted">
              {SITE.company}
              <br />
              {SITE.address.join(", ")}
            </p>
          </Reveal>
        </div>
      </section>
    </div>
  );
}
