'use client';

import { money } from '@/lib/api';
import { Spinner } from './ui';

export type QuotedRate = {
  id: string;
  name: string;
  price: string;
  codCharge: number;
  total: number;
  estimatedDays: number | null;
};

export type ShippingQuote = {
  serviceable: boolean;
  deliveryMethod: 'COD' | 'PREPAID';
  zone: { id: string; name: string } | null;
  note?: string;
  parcel: {
    weight: number;
    goods: number;
    box: number;
    volumetric: number;
    basis: string;
    packageName: string | null;
    itemsWithoutWeight: number;
    weightUsed: number;
  };
  rates: QuotedRate[];
};

export function ShippingQuoteNote({
  quote,
  quoting,
  suggested,
  cod,
  overridden,
  onApply,
}: {
  quote: ShippingQuote | null;
  quoting: boolean;
  suggested: QuotedRate | null;
  cod: boolean;
  overridden: boolean;
  onApply: () => void;
}) {
  if (quoting) {
    return (
      <span className="mt-1 flex items-center gap-1.5 text-xs text-muted-foreground">
        <Spinner className="h-3 w-3" />
        Checking rates…
      </span>
    );
  }

  if (!quote) {
    return (
      <span className="mt-1 block text-xs text-muted-foreground">
        Add a pincode and items to have this quoted.
      </span>
    );
  }

  if (!quote.serviceable || !suggested) {
    return (
      <span className="mt-1 block text-xs text-warning">
        {quote.note ??
          (quote.zone
            ? `No rate in ${quote.zone.name} fits this order — check the weight and value bands in Masters → Shipping.`
            : 'No shipping zone covers this destination.')}
      </span>
    );
  }

  const p = quote.parcel;

  return (
    <div className="mt-1.5 space-y-1 text-xs">
      <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
        <span className="text-muted-foreground">
          {quote.zone?.name} · {suggested.name}
        </span>
        <span className="text-foreground">
          {money(suggested.price)}
          {cod && suggested.codCharge > 0 && (
            <span className="text-warning">
              {' '}
              + {money(suggested.codCharge)} COD
            </span>
          )}
          {' = '}
          <span className="font-semibold">{money(suggested.total)}</span>
        </span>
        {suggested.estimatedDays != null && (
          <span className="text-muted-foreground">
            · ~{suggested.estimatedDays} days
          </span>
        )}
      </div>

      <div className="text-muted-foreground">
        Priced on {p.weightUsed} kg
        {p.basis === 'volumetric'
          ? ` (volumetric — ${p.packageName ?? 'the box'} is bulkier than the goods weigh)`
          : p.box > 0
            ? ` (${p.goods} kg goods + ${p.box} kg box)`
            : ''}
        {p.itemsWithoutWeight > 0 && (
          <span className="text-warning">
            {' '}
            · {p.itemsWithoutWeight} item{p.itemsWithoutWeight === 1 ? ' has' : 's have'} no weight
            set, so this is an estimate
          </span>
        )}
      </div>

      {overridden && (
        <button
          type="button"
          onClick={onApply}
          className="text-gold-ink hover:underline"
        >
          Use the quoted {money(suggested.total)} instead
        </button>
      )}
    </div>
  );
}
