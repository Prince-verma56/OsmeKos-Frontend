import type { Metadata } from "next";
import PageHeader from "@/storefront/components/PageHeader";
import ParallaxImage from "@/storefront/components/ui/ParallaxImage";
import Reveal from "@/storefront/components/ui/Reveal";
import SplitReveal from "@/storefront/components/ui/SplitReveal";
import Button from "@/storefront/components/ui/Button";
import Link from "next/link";

export const metadata: Metadata = { title: "Our Story" };

const VALUES = [
  { n: "01", t: "Disclose everything", d: "Concentrations on the front, full INCI on the back. If it's in the bottle, it's on the label." },
  { n: "02", t: "Barrier first", d: "We formulate around the skin barrier, because healthy skin is mostly a barrier that's been left alone to work." },
  { n: "03", t: "Feel over hype", d: "Texture, absorption and finish are judged by hand, again and again, until it simply feels right." },
  { n: "04", t: "Priced honestly", d: "₹899 for 200 ml of a ceramide lotion. Good skincare shouldn't be a luxury purchase." },
];

export default function AboutPage() {
  return (
    <div className="pb-24 md:pb-40">
      <PageHeader eyebrow="Our story" title={<>Skincare that <em>feels right.</em></>} text="OsmeKos started with a simple frustration: lotions that promised the world and left a greasy film. We wanted one bottle that did the basics beautifully." />

      <div className="container-x mt-16 grid gap-6 md:mt-24 md:grid-cols-12">
        <ParallaxImage src="/products/brand-hero.webp" alt="OsmeKos" speed={0.7} className="aspect-[4/5] rounded-[2rem] md:col-span-7" sizes="60vw" />
        <ParallaxImage src="/products/lightweight.webp" alt="Lotion on skin" speed={1.3} className="aspect-[4/5] rounded-[2rem] md:col-span-5 md:mt-32" sizes="40vw" />
      </div>

      <section className="container-x mt-28 grid gap-12 md:mt-40 lg:grid-cols-12">
        <div className="lg:col-span-5">
          <Reveal><p className="eyebrow">What we believe</p></Reveal>
          <SplitReveal className="display mt-5 text-5xl md:text-6xl">Fewer promises. <em>Better</em> lotion.</SplitReveal>
        </div>
        <div className="lg:col-span-6 lg:col-start-7">
          {VALUES.map((v) => (
            <Reveal key={v.n} className="border-t border-line py-8 last:border-b">
              <div className="grid grid-cols-[auto_1fr] gap-8">
                <span className="font-display text-3xl text-gold-2">{v.n}</span>
                <div>
                  <h3 className="font-display text-2xl md:text-3xl">{v.t}</h3>
                  <p className="mt-2 max-w-md text-[15px] leading-relaxed text-ink-2">{v.d}</p>
                </div>
              </div>
            </Reveal>
          ))}
        </div>
      </section>

      <section id="help" className="container-x mt-28 md:mt-40">
        <div className="grid gap-10 rounded-[2rem] bg-sand p-8 md:grid-cols-3 md:p-14">
          <Reveal>
            <p className="eyebrow">Marketed by</p>
            <p className="mt-3 text-sm leading-relaxed text-ink-2">Osmekos Essentials Pvt. Ltd.<br />K-15 A, Sheikh Sarai Phase II<br />New Delhi 110017</p>
          </Reveal>
          <Reveal delay={0.1}>
            <p className="eyebrow">Customer care</p>
            <p className="mt-3 text-sm leading-relaxed text-ink-2">+91 95365 45783<br />support@osmekos.com<br />Mon to Sat, 10am to 6pm</p>
            <Link href="/contact" className="link-line mt-3 inline-block text-sm font-semibold">Contact us</Link>
          </Reveal>
          <Reveal delay={0.2}>
            <p className="eyebrow">Shipping & returns</p>
            <p className="mt-3 text-sm leading-relaxed text-ink-2">Dispatch within 24h. Free shipping over ₹999. Unopened returns within 14 days.</p>
            <Link href="/shipping-returns" className="link-line mt-3 inline-block text-sm font-semibold">Full policy</Link>
          </Reveal>
        </div>
        <Reveal className="mt-16 text-center">
          <div className="flex flex-wrap justify-center gap-3">
            <Button href="/product/body-lotion" arrow>Try the lotion</Button>
            <Button href="/ingredients" variant="outline">See the ingredients</Button>
          </div>
        </Reveal>
      </section>
    </div>
  );
}
