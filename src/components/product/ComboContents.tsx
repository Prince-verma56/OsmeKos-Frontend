'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { AlertTriangle, Plus, Save, X } from 'lucide-react';
import { api, errorMessage, money } from '@/lib/api';
import { useToast } from '@/lib/toast';
import { Badge, Button, Field, Input, Spinner } from '../ui';
import { SearchSelect } from '../SearchSelect';

export type ComboComponent = {
  componentVariantId: string;
  quantity: number;
  title: string;
  productId: string;
  productTitle: string;
  sku: string | null;
  mrp: string | null;
  available: number | null;
  canMake: number | null;
  taxRate: number | null;
  hsnCode: string | null;
};

export type ComboVariant = {
  id: string;
  title: string;
  components?: ComboComponent[];
  availability?: { available: number | null };
  suggestedTax?: { rate: number; hsnCode: string | null; mixedRates: boolean; note: string } | null;
};

export type PickableVariant = { value: string; label: string; hint?: string; tag?: string | null };

export function ComboContents({
  productId,
  variant,
  pickable,
  hsCode,
  taxRate,
  onTaxChange,
  onSaved,
}: {
  productId: string;
  variant: ComboVariant;
  pickable: PickableVariant[];
  hsCode: string;
  taxRate: string;
  onTaxChange: (patch: { hsCode?: string; bundleTaxRate?: string }) => void;
  onSaved: () => void;
}) {
  const toast = useToast();
  const initial = useMemo(
    () => (variant.components ?? []).map((c) => ({ componentVariantId: c.componentVariantId, quantity: String(c.quantity) })),
    [variant.components]
  );
  const [rows, setRows] = useState(initial);
  const [busy, setBusy] = useState(false);
  const changed = JSON.stringify(rows) !== JSON.stringify(initial);

  async function save() {
    const clean = rows.filter((r) => r.componentVariantId);
    setBusy(true);
    try {
      const res = await api.put<{ message: string }>(`/products/${productId}/variants/${variant.id}/components`, {
        components: clean.map((r) => ({ componentVariantId: r.componentVariantId, quantity: Number(r.quantity || 1) })),
      });
      toast.success(res.message);
      onSaved();
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  const suggestedTax = variant.suggestedTax;
  const suggested =
    suggestedTax &&
    taxRate.trim() !== '' &&
    Number(taxRate) === suggestedTax.rate &&
    (!suggestedTax.hsnCode || hsCode.trim() === suggestedTax.hsnCode)
      ? null
      : suggestedTax;
  const byId = new Map((variant.components ?? []).map((c) => [c.componentVariantId, c]));

  return (
    <div className="rounded-lg border border-border bg-card shadow-xs">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border px-4 py-2.5">
        <div>
          <h2 className="font-display text-[15px] font-medium tracking-wide text-foreground">{variant.title}</h2>
          <p className="text-xs text-muted-foreground">Products packed inside this combo</p>
        </div>
        <Badge tone={(variant.availability?.available ?? 0) > 0 ? 'green' : 'amber'}>
          {variant.availability?.available == null ? 'Not tracked' : `${variant.availability.available} can be packed`}
        </Badge>
      </div>

      <div className="space-y-2 p-4">
        {rows.length === 0 && (
          <p className="rounded-md border border-dashed border-border px-3 py-4 text-center text-xs text-muted-foreground">
            Add the products that go into this combo. Stock is taken from them when it is sold.
          </p>
        )}
        {rows.map((row, i) => {
          const info = byId.get(row.componentVariantId);
          const saved = info && !changed;
          return (
            <div key={i} className="flex flex-wrap items-center gap-2 rounded-md border border-border p-2 sm:flex-nowrap">
              <SearchSelect
                value={row.componentVariantId}
                options={pickable.filter((p) => p.value === row.componentVariantId || !rows.some((r) => r.componentVariantId === p.value))}
                onChange={(v) => setRows(rows.map((r, idx) => (idx === i ? { ...r, componentVariantId: v } : r)))}
                placeholder="Pick a product"
                searchPlaceholder="Search products"
                className="min-w-0 flex-1 basis-full sm:basis-auto"
              />
              <div className="flex items-center gap-1.5">
                <span className="text-xs text-muted-foreground">×</span>
                <Input
                  type="number"
                  min="1"
                  max="100"
                  step="1"
                  value={row.quantity}
                  onChange={(e) => setRows(rows.map((r, idx) => (idx === i ? { ...r, quantity: e.target.value } : r)))}
                  className="w-16 text-right"
                  aria-label="Quantity in the combo"
                />
              </div>
              <div className="w-32 text-right text-xs tabular-nums text-muted-foreground">
                {saved && info.available !== null ? (
                  <>
                    <span className="block">{info.available} in stock</span>
                    <span className="block">makes {info.canMake}</span>
                  </>
                ) : saved ? (
                  'Not tracked'
                ) : (
                  'Save to see stock'
                )}
              </div>
              <Button variant="ghost" size="icon-sm" aria-label="Remove" onClick={() => setRows(rows.filter((_, idx) => idx !== i))}>
                <X strokeWidth={1.5} />
              </Button>
            </div>
          );
        })}
        <div className="flex flex-wrap items-center gap-2 pt-1">
          <Button size="sm" onClick={() => setRows([...rows, { componentVariantId: '', quantity: '1' }])}>
            <Plus /> Add product
          </Button>
          <Button size="sm" variant="primary" onClick={save} disabled={busy || !changed}>
            {busy ? <Spinner className="border-primary-foreground/30 border-t-primary-foreground" /> : <Save />}
            Save contents
          </Button>
          {changed && <span className="text-xs text-warning">Contents not saved yet</span>}
        </div>

        {(variant.components ?? []).length > 0 && !changed && (
          <div className="mt-3 rounded-md bg-muted/40 p-3 text-xs text-muted-foreground">
            MRP of the parts:{' '}
            <span className="font-medium tabular-nums text-foreground">
              {money((variant.components ?? []).reduce((sum, c) => sum + Number(c.mrp ?? 0) * c.quantity, 0))}
            </span>
            {' · '}
            {(variant.components ?? []).map((c, i) => (
              <span key={c.componentVariantId}>
                {i > 0 && ', '}
                <Link href={`/admin/products/${c.productId}`} className="text-gold-ink hover:underline">
                  {c.productTitle}
                  {c.title && c.title !== 'Default' ? ` (${c.title})` : ''}
                </Link>{' '}
                ×{c.quantity}
              </span>
            ))}
          </div>
        )}
      </div>

      <div className="grid gap-4 border-t border-border p-4 sm:grid-cols-2">
        <Field label="HSN code" hint="For the combo as sold">
          <Input value={hsCode} onChange={(e) => onTaxChange({ hsCode: e.target.value })} placeholder="e.g. 33049990" />
        </Field>
        <Field label="GST rate" hint="Used on orders and invoices for this combo">
          <div className="relative">
            <Input
              type="number"
              min="0"
              max="100"
              step="0.01"
              value={taxRate}
              onChange={(e) => onTaxChange({ bundleTaxRate: e.target.value })}
              className="pr-7"
            />
            <span className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">%</span>
          </div>
        </Field>
        {suggested && (
          <div className="flex flex-wrap items-start gap-3 rounded-md border border-gold/30 bg-gold-soft p-3 text-xs sm:col-span-2">
            <AlertTriangle className="mt-0.5 size-4 shrink-0 text-gold-ink" strokeWidth={1.5} />
            <div className="min-w-0 flex-1 text-foreground">
              Suggested: <strong>{suggested.rate}% GST</strong>
              {suggested.hsnCode && <> with HSN <strong>{suggested.hsnCode}</strong></>}.{' '}
              {suggested.mixedRates ? 'The products inside have different GST rates. ' : ''}
              <span className="text-muted-foreground">{suggested.note}</span>
            </div>
            <Button
              size="xs"
              onClick={() => onTaxChange({ bundleTaxRate: String(suggested.rate), ...(suggested.hsnCode && { hsCode: suggested.hsnCode }) })}
            >
              Use suggested
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
