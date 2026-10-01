"use client";

import Image from "next/image";
import Link from "next/link";
import { useCart } from "@/storefront/store/cart";
import { useBag } from "@/storefront/store/bag";
import { formatPrice } from "@/storefront/lib/format";
import PageHeader from "@/storefront/components/PageHeader";
import Button from "@/storefront/components/ui/Button";
import { IconMinus, IconPlus } from "@/storefront/components/ui/Icons";

export default function CartPage() {
  const { setQty, remove } = useCart();
  const { lines: items, subtotal, shipping, total, hydrated, freeShippingOver, problem } = useBag();

  return (
    <div className="pb-24 md:pb-40">
      <PageHeader eyebrow="Your bag" title={<>Almost <em>there.</em></>} />
      <div className="container-x mt-14 grid gap-14 lg:grid-cols-12">
        <div className="lg:col-span-7">
          {!hydrated ? null : items.length === 0 ? (
            <div className="rounded-[2rem] border border-line p-10 text-center">
              <p className="font-display text-3xl">Your bag is empty.</p>
              <Button href="/shop" className="mt-6">Browse the shop</Button>
            </div>
          ) : (
            <ul className="divide-y divide-line border-y border-line">
              {items.map((line) => (
                <li key={line.slug} className="flex gap-6 py-6">
                  <Link href={`/product/${line.slug}`} className="relative h-36 w-28 shrink-0 overflow-hidden rounded-2xl bg-sand">
                    {line.image && <Image src={line.image} alt={line.name} fill sizes="112px" className="object-cover" />}
                  </Link>
                  <div className="flex flex-1 flex-col">
                    <div className="flex justify-between gap-4">
                      <div>
                        <Link href={`/product/${line.slug}`} className="text-lg font-semibold">{line.name}</Link>
                        <p className="mt-1 text-sm text-muted">{line.subtitle}</p>
                        <p className="text-xs text-muted">{line.size}</p>
                      </div>
                      <p className="font-semibold tabular-nums">{formatPrice(line.lineTotal)}</p>
                    </div>
                    <div className="mt-auto flex items-center justify-between pt-4">
                      <div className="flex items-center overflow-hidden rounded-full border border-ink/15">
                        <button className="stepper-btn" onClick={() => setQty(line.slug, line.quantity - 1)} aria-label="Decrease"><IconMinus className="h-4 w-4" /></button>
                        <span className="w-8 text-center text-sm tabular-nums">{line.quantity}</span>
                        <button className="stepper-btn" onClick={() => setQty(line.slug, line.quantity + 1)} aria-label="Increase"><IconPlus className="h-4 w-4" /></button>
                      </div>
                      <button onClick={() => remove(line.slug)} className="link-line text-[11px] uppercase tracking-[0.2em] text-muted">Remove</button>
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>

        <aside className="lg:col-span-4 lg:col-start-9">
          <div className="sticky top-28 rounded-[2rem] bg-sand p-8">
            <h2 className="text-[12px] font-bold uppercase tracking-[0.25em]">Summary</h2>
            <dl className="mt-6 flex flex-col gap-3 text-sm">
              <div className="flex justify-between"><dt className="text-muted">Subtotal</dt><dd className="tabular-nums">{formatPrice(subtotal)}</dd></div>
              <div className="flex justify-between"><dt className="text-muted">Shipping</dt><dd className="tabular-nums">{shipping === 0 ? "Free" : formatPrice(shipping)}</dd></div>
              <div className="flex justify-between border-t border-ink/15 pt-4 text-base font-semibold"><dt>Total</dt><dd className="tabular-nums">{formatPrice(total)}</dd></div>
            </dl>
            <Button href="/checkout" className="mt-8 w-full" arrow disabled={items.length === 0}>Checkout</Button>
            <p className="mt-4 text-center text-xs text-muted">
              Taxes included. Free shipping over {formatPrice(freeShippingOver)}.
            </p>
            {problem && <p className="mt-3 text-center text-xs text-red-700">{problem}</p>}
          </div>
        </aside>
      </div>
    </div>
  );
}
