"use client";

import Image from "next/image";
import Link from "next/link";
import type { Product } from "@/storefront/lib/products";
import { formatPrice } from "@/storefront/lib/format";
import { useCart } from "@/storefront/store/cart";

export default function ProductCard({ product }: { product: Product }) {
  const add = useCart((s) => s.add);
  return (
    <div className="group relative">
      <Link href={`/product/${product.slug}`} className="block">
        <div className="relative aspect-[4/5] overflow-hidden rounded-[1.5rem] bg-sand md:rounded-[2rem]">
          {product.images[0] && (
            <Image
              src={product.images[0]}
              alt={product.name}
              fill
              quality={90}
              sizes="(max-width:768px) 50vw, 33vw"
              className="object-cover transition-transform duration-[1200ms] ease-[var(--ease-expo)] group-hover:scale-105"
            />
          )}
          {product.images[1] && (
            <Image
              src={product.images[1]}
              alt=""
              fill
              sizes="(max-width:768px) 50vw, 33vw"
              className="object-cover opacity-0 transition-opacity duration-700 group-hover:opacity-100"
            />
          )}
          {product.badge && (
            <span className={`absolute left-4 top-4 rounded-full px-3 py-1.5 text-[10px] font-bold uppercase tracking-[0.2em] ${product.available ? "bg-cream text-ink" : "bg-ink text-cream"}`}>
              {product.badge}
            </span>
          )}
          {!product.available && <div className="absolute inset-0 bg-cream/30 backdrop-grayscale-[0.4]" />}
        </div>
      </Link>

      {product.available && (
        <button
          onClick={() => add(product.slug)}
          className="absolute bottom-[6.5rem] left-1/2 hidden -translate-x-1/2 translate-y-3 rounded-chip bg-ink px-6 py-3 text-eyebrow font-bold uppercase tracking-[0.2em] text-cream opacity-0 shadow-lift transition-all duration-500 ease-expo hover:bg-gold hover:text-ink focus-visible:translate-y-0 focus-visible:opacity-100 group-hover:translate-y-0 group-hover:opacity-100 md:block"
        >
          Quick add
        </button>
      )}

      <div className="mt-5 flex items-start justify-between gap-4">
        <div>
          <Link href={`/product/${product.slug}`} className="font-semibold">
            {product.name}
          </Link>
          <p className="mt-1 text-sm text-muted">{product.subtitle}</p>
        </div>
        <div className="text-right">
          <p className="font-semibold tabular-nums">{formatPrice(product.price)}</p>
          {product.compareAt && <p className="text-xs text-muted line-through">{formatPrice(product.compareAt)}</p>}
        </div>
      </div>
    </div>
  );
}
