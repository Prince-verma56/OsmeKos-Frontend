import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Link from "next/link";
import { INGREDIENTS, INCI, HOW_TO_USE, fetchProductOrNothing } from "@/storefront/lib/products";
import { formatPrice } from "@/storefront/lib/format";
import ProductGallery from "@/storefront/components/shop/ProductGallery";
import AddToCart from "@/storefront/components/shop/AddToCart";
import ProductCard from "@/storefront/components/shop/ProductCard";
import Reveal from "@/storefront/components/ui/Reveal";
import SplitReveal from "@/storefront/components/ui/SplitReveal";
import ParallaxImage from "@/storefront/components/ui/ParallaxImage";
import { Accordion, AccordionItem } from "@/storefront/components/ui/Accordion";
import { IconStar, IconTruck, IconShield, IconLeaf } from "@/storefront/components/ui/Icons";

export const revalidate = 300;

const load = (slug: string) => fetchProductOrNothing(slug);

export async function generateMetadata({ params }: PageProps<"/product/[slug]">): Promise<Metadata> {
  const { slug } = await params;
  const p = await load(slug);
  return { title: p ? p.name : "Product", description: p?.description };
}

export default async function ProductPage({ params }: PageProps<"/product/[slug]">) {
  const { slug } = await params;
  const product = await load(slug);
  if (!product) notFound();
  const related = product.related;
  const ingredients = product.ingredients.length ? product.ingredients : INGREDIENTS;
  const steps = product.howToUseSteps.length ? product.howToUseSteps : HOW_TO_USE;
  const story = product.story;

  return (
    <div className="pb-24 md:pb-40">
      <div className="container-x pt-[110px] md:pt-[130px]">
        <Reveal>
          <nav className="flex gap-2 text-[11px] uppercase tracking-[0.2em] text-muted">
            <Link href="/shop" className="link-line">Shop</Link>
            <span>/</span>
            <span className="text-ink">{product.name}</span>
          </nav>
        </Reveal>

        <div className="mt-8 grid gap-12 lg:grid-cols-12 lg:gap-16">
          <div className="lg:col-span-7">
            <ProductGallery images={product.images} name={product.name} />
          </div>

          <div className="lg:col-span-5">
            <div className="lg:sticky lg:top-28">
              <Reveal>
                <p className="eyebrow">{product.badge ?? "OsmeKos"}</p>
              </Reveal>
              <SplitReveal as="h1" className="display mt-4 text-5xl md:text-6xl">
                {product.name}
              </SplitReveal>
              <Reveal delay={0.1}>
                <p className="mt-3 text-lg text-ink-2">{product.subtitle}</p>
                <div className="mt-4 flex items-center gap-3 text-sm text-muted">
                  <span className="flex gap-0.5 text-gold">
                    {Array.from({ length: 5 }).map((_, i) => (
                      <IconStar key={i} />
                    ))}
                  </span>
                  4.9 · 1,200+ reviews
                </div>
                <div className="mt-8 flex items-baseline gap-4">
                  <span className="font-display text-5xl">{formatPrice(product.price)}</span>
                  {product.compareAt && <span className="text-lg text-muted line-through">{formatPrice(product.compareAt)}</span>}
                  <span className="text-sm text-muted">{product.size}</span>
                </div>
                <p className="mt-6 text-[15px] leading-relaxed text-ink-2">{product.description}</p>
                <div className="mt-8">
                  <AddToCart
                    slug={product.slug}
                    available={product.available}
                    comingSoon={product.comingSoon}
                    withQty
                  />
                </div>
                <ul className="mt-8 grid grid-cols-3 gap-3 border-y border-line py-5 text-[10px] uppercase tracking-[0.18em] text-muted">
                  <li className="flex items-center gap-2"><IconTruck className="h-4 w-4 shrink-0" /> Free ship over ₹999</li>
                  <li className="flex items-center gap-2"><IconShield className="h-4 w-4 shrink-0" /> Patch-test friendly</li>
                  <li className="flex items-center gap-2"><IconLeaf className="h-4 w-4 shrink-0" /> All skin types</li>
                </ul>
                <Accordion className="mt-8" defaultOpen={["Key ingredients"]}>
                  <AccordionItem title="Key ingredients">
                    <ul className="flex flex-col gap-2">
                      {ingredients.map((i) => (
                        <li key={i.name} className="flex justify-between gap-4">
                          <span><span className="font-semibold text-ink">{i.pct}</span> {i.name}</span>
                          <span className="text-right text-muted">{i.short}</span>
                        </li>
                      ))}
                    </ul>
                  </AccordionItem>
                  <AccordionItem title="Full ingredient list">
                    <p className="text-sm">{product.inci ?? INCI}</p>
                    <Link href="/ingredients" className="mt-3 inline-block text-sm font-semibold text-ink underline decoration-gold underline-offset-4">
                      What each ingredient does
                    </Link>
                  </AccordionItem>
                  <AccordionItem title="How to use">
                    <ol className="flex flex-col gap-2">
                      {steps.map((s, i) => (
                        <li key={s.title}><span className="font-semibold text-ink">{i + 1}. {s.title}.</span> {s.text}</li>
                      ))}
                    </ol>
                  </AccordionItem>
                  <AccordionItem title="Shipping & returns">
                    Dispatched within 24 hours from New Delhi. Free shipping on orders over ₹999, otherwise ₹79. Unopened
                    products can be returned within 14 days. Best before 24 months from date of manufacture.{" "}
                    <Link href="/shipping-returns" className="font-semibold text-ink underline decoration-gold underline-offset-4">
                      Read the full policy
                    </Link>
                  </AccordionItem>
                  {product.contents && (
                    <AccordionItem title="What's in the set">
                      <ul>{product.contents.map((c) => <li key={c}>{c}</li>)}</ul>
                    </AccordionItem>
                  )}
                </Accordion>
              </Reveal>
            </div>
          </div>
        </div>
      </div>

      <section className="container-x mt-28 grid items-center gap-12 md:mt-40 lg:grid-cols-12">
        <div className="lg:col-span-5">
          <Reveal><p className="eyebrow">The care within</p></Reveal>
          <SplitReveal className="display mt-5 text-5xl md:text-6xl">
            {story?.heading ?? <>Honest by <em>design.</em></>}
          </SplitReveal>
          <Reveal delay={0.15}>
            <p className="lead mt-6">
              {story?.body ??
                'Every bottle carries the full ingredient list, the concentration of each active, its batch number and best-before date. Marketed by Osmekos Essentials Pvt. Ltd., New Delhi. Made in India.'}
            </p>
          </Reveal>
          <Reveal delay={0.25}>
            <ul className="mt-8 grid grid-cols-2 gap-4">
              {product.benefits.map((b) => (
                <li key={b} className="flex items-center gap-3 text-sm"><span className="h-1.5 w-1.5 rounded-full bg-gold" />{b}</li>
              ))}
            </ul>
          </Reveal>
        </div>
        <ParallaxImage
          src={story?.image ?? "/products/back-label-scene.webp"}
          alt="Back label with full ingredient list"
          speed={0.8}
          className="aspect-[4/5] rounded-[2rem] lg:col-span-6 lg:col-start-7"
        />
      </section>

      <section className="container-x mt-28 md:mt-40">
        <div className="flex items-end justify-between">
          <SplitReveal className="display text-4xl md:text-5xl">You may also <em>like.</em></SplitReveal>
          <Link href="/shop" className="link-line hidden text-[11px] font-bold uppercase tracking-[0.2em] md:block">View all</Link>
        </div>
        <Reveal children_ className="mt-12 grid grid-cols-2 gap-x-4 gap-y-12 md:grid-cols-3 md:gap-x-8" stagger={0.12}>
          {related.map((p) => (
            <ProductCard key={p.slug} product={p} />
          ))}
        </Reveal>
      </section>
    </div>
  );
}
