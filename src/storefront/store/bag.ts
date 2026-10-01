"use client";

import { useEffect, useState } from "react";
import { apiPost } from "@/storefront/lib/api";
import { showable } from "@/storefront/lib/images";
import { useCart } from "@/storefront/store/cart";

export type QuoteLine = {
  slug: string;
  variantId: string;
  name: string;
  subtitle: string;
  image: string | null;
  size: string;
  unitPrice: number;
  quantity: number;
  trimmedFrom?: number;
  lineTotal: number;
};

export type Quote = {
  lines: QuoteLine[];
  removed: { slug: string; reason: string }[];
  count: number;
  subtotal: number;
  shipping: number;
  total: number;
  freeShippingOver: number;
};

const EMPTY: Quote = {
  lines: [],
  removed: [],
  count: 0,
  subtotal: 0,
  shipping: 0,
  total: 0,
  freeShippingOver: 999,
};

export function useBag() {
  const lines = useCart((s) => s.lines);
  const hydrated = useCart((s) => s.hydrated);
  const setHydrated = useCart((s) => s.setHydrated);
  const remove = useCart((s) => s.remove);

  const [quote, setQuote] = useState<Quote>(EMPTY);
  const [loading, setLoading] = useState(true);
  const [problem, setProblem] = useState<string | null>(null);

  useEffect(() => {
    useCart.persist.rehydrate();
    setHydrated();
  }, [setHydrated]);

  const empty = lines.length === 0;

  useEffect(() => {
    if (!hydrated || empty) return;

    let cancelled = false;

    // Debounced: rapid +/- taps would otherwise fire one round-trip per tap.
    const timer = setTimeout(() => {
      apiPost<Quote>("/cart/quote", { lines: lines.map((l) => ({ slug: l.slug, quantity: l.qty })) })
        .then((priced) => {
          if (cancelled) return;
          setQuote({
            ...priced,
            lines: priced.lines.map((l) => ({ ...l, image: showable(l.image) ? l.image : null })),
          });
          setProblem(null);
          // Re-entrant by design: removing a line changes `lines`, which
          // re-runs this effect. It terminates because the line is gone.
          priced.removed.forEach((gone) => remove(gone.slug));
        })
        .catch(() => {
          if (!cancelled) setProblem("We could not price your bag just now. Refresh and try again.");
        })
        .finally(() => {
          if (!cancelled) setLoading(false);
        });
    }, 250);

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [lines, hydrated, empty, remove]);

  const view = empty ? EMPTY : quote;

  return { ...view, hydrated, loading: loading && !empty, problem: empty ? null : problem };
}
