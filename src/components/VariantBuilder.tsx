'use client';

import { useState } from 'react';
import { money } from '@/lib/api';
import { marginOf } from '@/lib/pricing';
import { offMrpText } from '@/lib/mrp';
import { priceAs } from '@/lib/items';
import { ItemSelect } from '@/components/ItemSelect';
import { Button, Field, Input } from '@/components/ui';
import {
  DEFAULT_PACKS, blankRow, groupRows, packIndex, packOf, packOptionFrom, packPricing, packRowsOf,
  packValue, singleRowFor, skuFor, syncRows, type OptionDraft, type PackRow, type VariantRow,
} from '@/lib/variants';

export type BuilderItem = {
  id: string;
  name: string;
  sku?: string | null;
  costPrice?: string | null;
  otherCostTotal?: string | null;
  imageUrls?: string[] | null;
  hasVariants?: boolean;
  sellingPrice?: string | null;
  sellingTaxTreatment?: string | null;
  intraStateTaxRate?: string | null;
  mrp?: string | null;
  sizeValue?: string | null;
  sizeUnit?: string | null;
};

export type BuilderValue = { options: OptionDraft[]; rows: VariantRow[] };

function PackSizeInput({ size, taken, onCommit }: { size: number; taken: number[]; onCommit: (n: number) => void }) {
  const [draft, setDraft] = useState(String(size));
  const commit = () => {
    const n = Math.floor(Number(draft));
    if (n >= 2 && n <= 1000 && !taken.includes(n)) onCommit(n);
    else setDraft(String(size));
  };
  return (
    <Input
      type="number" min="2" step="1"
      value={draft}
      onChange={(e) => setDraft(e.target.value)}
      onBlur={commit}
      onKeyDown={(e) => {
        if (e.key === 'Enter') {
          e.preventDefault();
          commit();
        }
      }}
      className="w-16 text-right"
      aria-label="Singles in this pack"
    />
  );
}

export function VariantBuilder({
  value,
  onChange,
  items,
  prefix,
  productTitle,
  rowExtra,
  showOptions = true,
}: {
  value: BuilderValue;
  onChange: (next: BuilderValue) => void;
  items: BuilderItem[];
  prefix: string;
  productTitle?: string;
  rowExtra?: (row: VariantRow) => React.ReactNode;
  showOptions?: boolean;
}) {
  const { options, rows } = value;
  const pIdx = packIndex(options);
  const packOption = pIdx === -1 ? null : options[pIdx];
  const packs = packOption ? packRowsOf(packOption) : [];
  const choiceIdx = options.map((o, i) => (o.pack ? -1 : i)).filter((i) => i !== -1);

  const commit = (nextOptions: OptionDraft[]) =>
    onChange({ options: nextOptions, rows: syncRows(nextOptions, rows) });

  const setChoice = (i: number, patch: Partial<OptionDraft>) =>
    commit(options.map((o, idx) => (idx === i ? { ...o, ...patch } : o)));
  const addChoice = () => {
    const blank: OptionDraft = { name: '', valuesText: '', pack: false, packs: {} };
    commit(pIdx === -1 ? [...options, blank] : [...options.slice(0, pIdx), blank, ...options.slice(pIdx)]);
  };
  const removeChoice = (i: number) => commit(options.filter((_, idx) => idx !== i));

  const setPacks = (next: PackRow[] | null) => {
    if (!next) return commit(options.filter((o) => !o.pack));
    const option = packOptionFrom(next, packOption?.name || 'Pack');
    commit(pIdx === -1 ? [...options, option] : options.map((o, idx) => (idx === pIdx ? option : o)));
  };
  const setPackDiscount = (p: PackRow, discount: string) => {
    const option = packOptionFrom(
      packs.map((x) => (x.value === p.value ? { ...x, discount } : x)),
      packOption?.name || 'Pack'
    );
    const nextOptions = options.map((o, idx) => (idx === pIdx ? option : o));
    onChange({
      options: nextOptions,
      rows: syncRows(nextOptions, rows).map((r) =>
        r.values[pIdx] === p.value && (r.priceManual || r.compareManual)
          ? { ...r, priceManual: false, price: '', compareManual: false, compareAtPrice: '' }
          : r
      ),
    });
  };
  const renamePack = (p: PackRow, size: number) =>
    setPacks(packs.map((x) => (x.value === p.value ? { ...x, size, value: packValue(size) } : x)));
  const addPack = () => {
    const size = Math.max(1, ...packs.map((p) => p.size)) + 1;
    setPacks([...packs, { value: packValue(size), size, discount: '0' }]);
  };

  const setRow = (key: string, patch: Partial<VariantRow>) =>
    onChange({ options, rows: rows.map((r) => (r.key === key ? { ...r, ...patch } : r)) });

  const itemOf = (id: string) => items.find((i) => i.id === id) ?? null;
  const costOf = (id: string) => {
    const item = itemOf(id);
    const c = item?.costPrice;
    return c != null && Number(c) > 0 ? Number(c) + Number(item?.otherCostTotal ?? 0) : null;
  };

  const groups = groupRows(options, rows);
  const manual = options.length === 0;

  const skuInput = (r: VariantRow) => (
    <Input
      value={r.sku}
      onChange={(e) => setRow(r.key, { sku: e.target.value })}
      placeholder={r.values.length ? skuFor(prefix, r.values) : 'SKU'}
      className="font-mono text-xs"
      aria-label={`SKU for ${r.title || 'this variant'}`}
    />
  );

  const pickRowItem = (r: VariantRow, id: string) => {
    const item = itemOf(id);
    if (!item) return setRow(r.key, { itemId: id });
    const gst = item.intraStateTaxRate != null ? Number(item.intraStateTaxRate) : 18;
    const price =
      r.price === '' && item.sellingPrice != null
        ? String(priceAs(item.sellingPrice, item.sellingTaxTreatment, 'INCLUSIVE', gst))
        : r.price;
    const mrp = r.mrp === '' && item.mrp != null ? String(Number(item.mrp)) : r.mrp;
    setRow(r.key, { itemId: id, price, mrp });
  };

  const offLine = (mrp: unknown, price: unknown) => {
    const off = offMrpText(mrp, price, money);
    if (!off) return null;
    return (
      <span className={off.above ? 'ml-2 text-destructive' : 'ml-2'}>
        {off.above ? off.text : `Default discount ${off.text}`}
      </span>
    );
  };

  const singleLine = (r: VariantRow, label: string) => {
    const cost = costOf(r.itemId);
    const margin = marginOf(r.price, cost);
    return (
      <div>
        <div className="flex flex-wrap items-end gap-3">
          <div className="min-w-0 flex-1 basis-40">
            {manual ? (
              <Field label="Title">
                <Input
                  value={r.title}
                  onChange={(e) => setRow(r.key, { title: e.target.value })}
                  placeholder={productTitle || 'Default'}
                />
              </Field>
            ) : (
              <div className="pb-1.5">
                <div className="font-medium text-foreground">{label}</div>
                {packOption && <div className="text-xs text-muted-foreground">Pack of 1</div>}
              </div>
            )}
          </div>
          <div className="w-28 shrink-0">
            <Field label="MRP">
              <Input
                type="number" step="0.01" min="0"
                value={r.mrp}
                onChange={(e) => setRow(r.key, { mrp: e.target.value })}
                placeholder="Optional"
                aria-label={`MRP for ${label}`}
              />
            </Field>
          </div>
          <div className="w-28 shrink-0">
            <Field label="Selling price">
              <Input
                type="number" step="0.01" min="0"
                value={r.price}
                onChange={(e) => setRow(r.key, { price: e.target.value })}
                aria-label={`Selling price for ${label}`}
              />
            </Field>
          </div>
          <div className="w-28 shrink-0">
            <Field label="Compare at">
              <Input
                type="number" step="0.01" min="0"
                value={r.compareAtPrice}
                onChange={(e) => setRow(r.key, { compareAtPrice: e.target.value })}
                placeholder="Optional"
              />
            </Field>
          </div>
          <div className="min-w-0 flex-1 basis-56">
            <Field label="Stock item">
              <ItemSelect
                value={r.itemId}
                items={items}
                onChange={(id) => pickRowItem(r, id)}
                placeholder="Not tracked"
              />
            </Field>
          </div>
          <div className="w-36 shrink-0">
            <Field label="SKU">{skuInput(r)}</Field>
          </div>
          {(rowExtra || (manual && rows.length > 1)) && (
            <div className="flex shrink-0 items-center gap-1.5 pb-0.5">
              {rowExtra?.(r)}
              {manual && rows.length > 1 && (
                <Button
                  type="button"
                  size="sm"
                  variant="danger"
                  aria-label={`Remove ${r.title || 'variant'}`}
                  onClick={() => onChange({ options, rows: rows.filter((x) => x.key !== r.key) })}
                >
                  ×
                </Button>
              )}
            </div>
          )}
        </div>
        {(cost != null || Number(r.mrp) > 0) && (
          <p className="mt-1 text-xs text-muted-foreground">
            {cost != null && `Cost ${money(cost)}${margin ? ` · margin ${margin.margin.toFixed(1)}%` : ''}`}
            {Number(r.mrp) > 0 && r.price !== '' && offLine(r.mrp, r.price)}
          </p>
        )}
      </div>
    );
  };

  const packLine = (r: VariantRow, single: VariantRow | null) => {
    const { size, discount } = packOf(options, r.values);
    const priced = single && single.price !== '' ? packPricing(single, size, discount) : null;
    const item = single ? itemOf(single.itemId) : null;
    const autoMrp = single && Number(single.mrp) > 0 ? Math.round(Number(single.mrp) * size * 100) / 100 : null;
    const rate = r.priceManual && r.price !== '' ? Number(r.price) : priced?.price ?? null;
    const mrp = r.mrpManual && r.mrp !== '' ? Number(r.mrp) : autoMrp;
    const compare = r.compareManual && r.compareAtPrice !== '' ? Number(r.compareAtPrice) : priced?.compareAt ?? null;
    const typed = [r.mrpManual && 'MRP', r.priceManual && 'rate', r.compareManual && 'compare-at'].filter(Boolean);
    const packName = r.values[pIdx];
    return (
      <li key={r.key} className="text-sm">
        <div className="flex flex-wrap items-end gap-3">
          <div className="w-28 shrink-0 pb-1.5">
            <div className="font-medium text-foreground">{packName}</div>
            <div className="truncate text-[11px] text-muted-foreground">
              {item ? `${size} × ${item.name}` : `${size} singles`}
            </div>
          </div>
          <div className="w-28 shrink-0">
            <Field label="MRP">
              <Input
                type="number" step="0.01" min="0"
                value={r.mrpManual ? r.mrp : ''}
                onChange={(e) => setRow(r.key, { mrp: e.target.value, mrpManual: e.target.value !== '' })}
                placeholder={autoMrp != null ? String(autoMrp) : 'Optional'}
                aria-label={`MRP for ${packName}`}
                title="Leave empty to use the worked-out MRP"
              />
            </Field>
          </div>
          <div className="w-28 shrink-0">
            <Field label="Selling price">
              <Input
                type="number" step="0.01" min="0"
                value={r.priceManual ? r.price : ''}
                onChange={(e) => setRow(r.key, { price: e.target.value, priceManual: e.target.value !== '' })}
                placeholder={priced ? String(priced.price) : 'Selling price'}
                aria-label={`Selling price for ${packName}`}
                title="Leave empty to use the worked-out rate"
              />
            </Field>
          </div>
          <div className="w-28 shrink-0">
            <Field label="Compare at">
              <Input
                type="number" step="0.01" min="0"
                value={r.compareManual ? r.compareAtPrice : ''}
                onChange={(e) =>
                  setRow(r.key, { compareAtPrice: e.target.value, compareManual: e.target.value !== '' })
                }
                placeholder={priced?.compareAt != null ? String(priced.compareAt) : 'Optional'}
                aria-label={`Compare-at price for ${packName}`}
                title="Leave empty to use the worked-out compare-at price"
              />
            </Field>
          </div>
          <div className="w-36 shrink-0">
            <Field label="SKU">{skuInput(r)}</Field>
          </div>
          {rowExtra && <div className="flex shrink-0 items-center pb-0.5">{rowExtra(r)}</div>}
        </div>
        <p className="mt-1 text-xs text-muted-foreground">
          {rate != null ? (
            <>
              Sells at <span className="font-medium tabular-nums text-foreground">{money(rate)}</span>
              {compare != null && compare > rate && (
                <span className="ml-1.5 text-muted-foreground line-through">{money(compare)}</span>
              )}
              {mrp != null && <span className="tabular-nums"> · MRP {money(mrp)}</span>}
              {mrp != null && offLine(mrp, rate)}
            </>
          ) : (
            'Rate the Pack of 1, or type a rate for this pack'
          )}
          {typed.length
            ? ` · typed for this pack: ${typed.join(', ')} - clear a box to go back to the worked-out value`
            : ' · worked out from the Pack of 1'}
        </p>
      </li>
    );
  };

  return (
    <div>
      {showOptions && (
      <section className="space-y-3 border-b border-border p-4">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h3 className="text-sm font-medium text-foreground">Options</h3>
            <p className="text-xs text-muted-foreground">
              What the customer chooses, such as Flavour. Leave it empty if there is only one kind.
            </p>
          </div>
          {choiceIdx.length < (packOption ? 2 : 3) && (
            <Button type="button" size="sm" onClick={addChoice}>
              + Add option
            </Button>
          )}
        </div>
        {choiceIdx.map((i, n) => (
          <div key={i} className="flex flex-wrap items-end gap-3">
            <div className="w-40">
              <Field label="Option">
                <Input
                  value={options[i].name}
                  onChange={(e) => setChoice(i, { name: e.target.value })}
                  placeholder={n === 0 ? 'Flavour' : 'Size'}
                />
              </Field>
            </div>
            <div className="min-w-0 flex-1 basis-64">
              <Field label="Values" hint="Separate them with commas">
                <Input
                  value={options[i].valuesText}
                  onChange={(e) => setChoice(i, { valuesText: e.target.value })}
                  placeholder={n === 0 ? 'Cardamom Mint, Spicy Vanilla' : '250 ml, 50 ml'}
                />
              </Field>
            </div>
            <Button
              type="button"
              size="sm"
              variant="danger"
              aria-label={`Remove ${options[i].name || 'option'}`}
              onClick={() => removeChoice(i)}
            >
              ×
            </Button>
          </div>
        ))}
      </section>
      )}

      <section className="space-y-3 border-b border-border p-4">
        <label className="flex items-start gap-2.5">
          <input
            type="checkbox"
            checked={!!packOption}
            onChange={(e) => setPacks(e.target.checked ? DEFAULT_PACKS : null)}
            className="mt-0.5"
          />
          <span>
            <span className="block text-sm font-medium text-foreground">Also sell in packs</span>
            <span className="block text-xs text-muted-foreground">
              Packs are made from singles - a pack of 3 takes 3 from stock. A pack rate is its % off the pack MRP (the Pack of 1 MRP times the size), and you can type your own MRP, rate or compare-at on any pack.
            </span>
          </span>
        </label>

        {packOption && (
          <div className="space-y-2 pl-6">
            {packs.map((p) => (
              <div key={p.value} className="flex flex-wrap items-center gap-2 text-sm text-foreground">
                {p.size === 1 ? (
                  <span className="text-muted-foreground">Pack of 1 - rate, MRP and compare-at are set below</span>
                ) : (
                  <>
                    <span className="w-14">Pack of</span>
                    <PackSizeInput
                      key={p.size}
                      size={p.size}
                      taken={packs.map((x) => x.size).filter((s) => s !== p.size)}
                      onCommit={(n) => renamePack(p, n)}
                    />
                    <span className="ml-3">with</span>
                    <Input
                      type="number" min="0" max="90" step="0.5"
                      value={p.discount}
                      onChange={(e) => setPackDiscount(p, e.target.value)}
                      className="w-20 text-right"
                      aria-label={`Discount on ${p.value}`}
                    />
                    <span>% off MRP</span>
                    <Button
                      type="button"
                      size="sm"
                      variant="ghost"
                      onClick={() => setPacks(packs.filter((x) => x.value !== p.value))}
                    >
                      Remove
                    </Button>
                  </>
                )}
              </div>
            ))}
            <Button type="button" size="sm" onClick={addPack}>
              + Add pack size
            </Button>
          </div>
        )}
      </section>

      <div className="flex items-center justify-between gap-3 px-4 pt-3">
        <h3 className="text-sm font-medium text-foreground">Prices & stock</h3>
        <div className="flex gap-2">
          {rows.some((r) => r.values.length) && (
            <Button
              type="button"
              size="sm"
              variant="ghost"
              onClick={() =>
                onChange({ options, rows: rows.map((r) => (r.values.length ? { ...r, sku: '' } : r)) })
              }
            >
              Use generated SKUs
            </Button>
          )}
          {manual && (
            <Button type="button" size="sm" onClick={() => onChange({ options, rows: [...rows, blankRow()] })}>
              + Add variant
            </Button>
          )}
        </div>
      </div>

      <ul className="divide-y divide-border">
        {groups.map((g) => {
          const label = g.values.join(' / ') || productTitle || 'Pack of 1';
          return (
            <li key={g.key} className="px-4 py-3">
              {g.single && singleLine(g.single, g.single.values.length && !packOption ? g.single.title : label)}
              {g.packs.length > 0 && (
                <ul className="ml-1 mt-3 space-y-2 border-l-2 border-border pl-3">
                  {g.packs.map((p) => packLine(p, g.single))}
                </ul>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}

export function rowsToApi(value: BuilderValue, prefix: string, chargeTax?: boolean) {
  const { options, rows } = value;
  return rows.map((r) => {
    const { size, discount } = packOf(options, r.values);
    const single = size > 1 ? singleRowFor(options, rows, r) : null;
    const priced = single && single.price !== '' ? packPricing(single, size, discount) : null;
    const typedPrice = !!(r.priceManual && r.price !== '');
    const typedMrp = !!(r.mrpManual && r.mrp !== '');
    const typedCompare = !!(r.compareManual && r.compareAtPrice !== '');
    return {
      ...(r.id && { id: r.id }),
      title: r.title.trim() || 'Default',
      sku: r.sku.trim() || (r.values.length ? skuFor(prefix, r.values) : undefined),
      price: single ? (typedPrice ? Number(r.price) : priced?.price ?? 0) : Number(r.price || 0),
      compareAtPrice: single
        ? typedCompare
          ? Number(r.compareAtPrice)
          : priced?.compareAt ?? null
        : r.compareAtPrice === ''
          ? null
          : Number(r.compareAtPrice),
      ...(single && { compareAtManual: typedCompare, priceManual: typedPrice, mrpManual: typedMrp }),
      mrp: single
        ? typedMrp
          ? Number(r.mrp)
          : Number(single.mrp) > 0
            ? Math.round(Number(single.mrp) * size * 100) / 100
            : null
        : r.mrp === ''
          ? null
          : Number(r.mrp),
      itemId: (single ? single.itemId : r.itemId) || null,
      barcode: r.barcode.trim() || undefined,
      barcodeType: r.barcodeType || undefined,
      option1: r.values[0],
      option2: r.values[1],
      option3: r.values[2],
      ...(chargeTax !== undefined && { chargeTax }),
    };
  });
}
