"use client";

import { useEffect, useRef, useState } from "react";
import { useCart } from "@/storefront/store/cart";
import Button from "@/storefront/components/ui/Button";
import Magnetic from "@/storefront/components/ui/Magnetic";
import { IconMinus, IconPlus } from "@/storefront/components/ui/Icons";

export default function AddToCart({
  slug,
  available,
  comingSoon = false,
  withQty = false,
  className = "",
}: {
  slug: string;
  available: boolean;
  comingSoon?: boolean;
  withQty?: boolean;
  className?: string;
}) {
  const add = useCart((s) => s.add);
  const [qty, setQty] = useState(1);
  const [added, setAdded] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => () => { if (timer.current) clearTimeout(timer.current); }, []);

  if (!available) {
    return (
      <Button variant="outline" disabled className={className}>
        {comingSoon ? "Coming soon" : "Sold out"}
      </Button>
    );
  }

  return (
    <div className={`flex flex-wrap items-center gap-4 ${className}`}>
      {withQty && (
        <div className="flex items-center overflow-hidden rounded-chip border border-ink/20">
          <button
            className="stepper-btn h-[52px] w-12"
            onClick={() => setQty((q) => Math.max(1, q - 1))}
            disabled={qty === 1}
            aria-label={`Decrease quantity, currently ${qty}`}
          >
            <IconMinus className="h-4 w-4" />
          </button>
          {/* Announced on change so the value is not visual-only. */}
          <span className="num w-10 text-center" role="status" aria-live="polite">
            {qty}
          </span>
          <button
            className="stepper-btn h-[52px] w-12"
            onClick={() => setQty((q) => q + 1)}
            aria-label={`Increase quantity, currently ${qty}`}
          >
            <IconPlus className="h-4 w-4" />
          </button>
        </div>
      )}

      <Magnetic>
        <Button
          arrow
          onClick={() => {
            add(slug, qty);
            setAdded(true);
            if (timer.current) clearTimeout(timer.current);
            timer.current = setTimeout(() => setAdded(false), 1800);
          }}
        >
          {added ? "Added to bag" : "Add to bag"}
        </Button>
      </Magnetic>

      <span className="sr-only" role="status" aria-live="polite">
        {added ? `Added ${qty} to your bag` : ""}
      </span>
    </div>
  );
}
