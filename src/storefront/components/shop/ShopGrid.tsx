"use client";

import { useMemo, useRef, useState } from "react";
import { gsap, useGSAP } from "@/storefront/lib/gsap";
import { prefersReduced } from "@/storefront/lib/motion";
import type { Product, ShopCollection } from "@/storefront/lib/products";
import ProductCard from "./ProductCard";

const FALLBACK = [
  { key: "lotion", label: "Lotion" },
  { key: "set", label: "Sets" },
  { key: "soon", label: "Coming soon" },
];

export default function ShopGrid({
  products,
  collections = [],
}: {
  products: Product[];
  collections?: ShopCollection[];
}) {
  const [filter, setFilter] = useState("all");
  const ref = useRef<HTMLDivElement>(null);

  const grouped = collections.filter((c) => products.some((p) => p.collections?.includes(c.handle)));
  const soon = products.some((p) => p.category === "soon");
  const filters = [
    { key: "all", label: "All" },
    ...(grouped.length
      ? grouped.map((c) => ({ key: c.handle, label: c.title }))
      : FALLBACK.filter((f) => products.some((p) => p.category === f.key))),
    ...(grouped.length && soon ? [{ key: "soon", label: "Coming soon" }] : []),
  ];

  // Memoised so the entrance timeline below re-runs on a filter change only.
  // An inline .filter() would hand useGSAP a new array identity every render.
  const list = useMemo(
    () =>
      products.filter((p) =>
        filter === "all"
          ? true
          : filter === "soon"
            ? p.category === "soon"
            : p.collections?.includes(filter) || p.category === filter,
      ),
    [products, filter],
  );

  useGSAP(
    () => {
      const items = gsap.utils.toArray(".grid-item");
      if (items.length === 0) return;
      if (prefersReduced()) {
        gsap.set(items, { autoAlpha: 1, y: 0 });
        return;
      }
      gsap.fromTo(items, { y: 40, autoAlpha: 0 }, { y: 0, autoAlpha: 1, stagger: 0.08, duration: 1.1, ease: "expo.out", overwrite: true });
    },
    { scope: ref, dependencies: [filter, list] },
  );

  return (
    <div ref={ref}>
      <div className="flex flex-wrap gap-2">
        {filters.map((f) => (
          <button
            key={f.key}
            onClick={() => setFilter(f.key)}
            className={`rounded-full border px-5 py-2.5 text-[11px] font-bold uppercase tracking-[0.2em] transition-colors duration-400 ${filter === f.key ? "border-ink bg-ink text-cream" : "border-ink/20 text-ink hover:border-ink"}`}
          >
            {f.label}
          </button>
        ))}
      </div>
      {products.length === 0 && (
        <p className="mt-12 text-sm text-muted">The shop is being restocked. Please check back shortly.</p>
      )}
      <div className="mt-12 grid grid-cols-2 gap-x-4 gap-y-12 md:grid-cols-3 md:gap-x-8 md:gap-y-16">
        {list.map((p) => (
          <div key={p.slug} className="grid-item">
            <ProductCard product={p} />
          </div>
        ))}
      </div>
    </div>
  );
}
