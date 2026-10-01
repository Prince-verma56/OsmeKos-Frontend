'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { api, money, errorMessage, type Paged } from '@/lib/api';
import {
  Badge, Button, Card, Derived, EmptyRow, ErrorBox, Field, Input, Loading,
  PageHeader, Select, Table, Td, Th, Spinner,
} from '@/components/ui';
import { marginOf } from '@/lib/pricing';
import { FileUpload } from '@/components/FileUpload';
import { useToast } from '@/lib/toast';
import { ItemSelect } from '@/components/ItemSelect';
import { ComboSelect } from '@/components/ComboSelect';
import { UnitPriceField, computeUnitPrice } from '@/components/UnitPriceField';
import { PageCrumb } from '@/lib/crumbs';
import { productStatusLabel } from '@/lib/labels';
import type { ComboComponent } from '@/components/product/ComboContents';

type Variant = {
  id: string;
  title: string;
  sku: string | null;
  barcode: string | null;
  barcodeType: string | null;
  price: string;
  compareAtPrice: string | null;
  compareAtManual?: boolean;
  priceManual?: boolean;
  mrpManual?: boolean;
  mrp?: string | null;
  costPrice: string | null;
  unitPriceValue: string | null;
  unitPriceUnit: string | null;
  unitPriceTotal: string | null;
  unitPriceTotalUnit: string | null;
  unitPriceBase: string | null;
  unitPriceBaseUnit: string | null;
  chargeTax: boolean;
  itemId: string | null;
  weight: string | null;
  weightUnit: string | null;
  packageId: string | null;
  countryOfOrigin: string | null;
  hsCode: string | null;
  continueSellingOos: boolean;
  option1: string | null;
  option2: string | null;
  option3: string | null;
  packSize: number;
  imageUrl: string | null;
  isActive: boolean;
  components?: (ComboComponent & { itemId?: string | null })[];
  availability?: { available: number | null };
};

type Product = {
  id: string;
  title: string;
  status: string;
  kind?: 'STANDARD' | 'BUNDLE';
  options?: {
    name: string;
    values: string[];
    packs?: { value: string; size: number; discountPercent: number }[];
  }[];
  variants: Variant[];
};

type ItemOption = {
  id: string;
  name: string;
  sku: string | null;
  trackInventory: boolean;
  costPrice?: string | null;
  otherCostTotal?: string | null;
  weight?: string | null;
  weightUnit?: string | null;
};

const linkedItemCost = (item: { costPrice?: string | null; otherCostTotal?: string | null } | null | undefined) =>
  item?.costPrice != null && Number(item.costPrice) > 0 ? Number(item.costPrice) + Number(item.otherCostTotal ?? 0) : null;

const toKg = (value: unknown, unit: string | null | undefined) => {
  const n = Number(value ?? NaN);
  if (!Number.isFinite(n)) return null;
  const factor = unit === 'G' ? 0.001 : unit === 'LB' ? 0.45359237 : unit === 'OZ' ? 0.028349523 : 1;
  return n * factor;
};

const fromKg = (kg: number, unit: string) => {
  const factor = unit === 'G' ? 1000 : unit === 'LB' ? 1 / 0.45359237 : unit === 'OZ' ? 1 / 0.028349523 : 1;
  return Math.round(kg * factor * 1000) / 1000;
};

const showWeight = (kg: number, unit: string) => `${fromKg(kg, unit)} ${unit.toLowerCase()}`;

type StockLevel = {
  locationId: string;
  onHand: string;
  committed: string;
  unavailable: string;
  incoming: string;
  available: number;
  location: { id: string; name: string; code: string };
};

type PackageOption = {
  id: string;
  name: string;
  length: string | null;
  width: string | null;
  height: string | null;
  dimensionUnit: string;
  emptyWeight: string | null;
  weightUnit: string;
};

const blank = {
  title: '', sku: '', barcode: '', barcodeType: '',
  price: '', compareAtPrice: '', mrp: '', costPrice: '',
  unitPriceValue: '', unitPriceUnit: '',
  unitPriceTotal: '', unitPriceTotalUnit: '', unitPriceBase: '', unitPriceBaseUnit: '',
  chargeTax: true, itemId: '',
  weight: '', weightUnit: 'KG', packageId: '',
  countryOfOrigin: '', hsCode: '',
  continueSellingOos: false,
  option1: '', option2: '', option3: '',
  imageUrl: '', isActive: true,
};

const str = (v: unknown) => (v === null || v === undefined ? '' : String(v));
const num = (v: string) => (v === '' ? undefined : Number(v));

export default function VariantDetailPage() {
  const { id, variantId } = useParams<{ id: string; variantId: string }>();
  const router = useRouter();

  const [product, setProduct] = useState<Product | null>(null);
  const [items, setItems] = useState<ItemOption[]>([]);
  const [packages, setPackages] = useState<PackageOption[]>([]);
  const [levels, setLevels] = useState<StockLevel[]>([]);
  const [partPacks, setPartPacks] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const toast = useToast();
  const [search, setSearch] = useState('');

  const [form, setFormState] = useState({ ...blank });
  const set = (patch: Partial<typeof blank>) => setFormState((f) => ({ ...f, ...patch }));

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const [p, it, pk] = await Promise.all([
        api.get<{ data: Product }>(`/products/${id}`),
        api.get<Paged<ItemOption>>('/items', { limit: 100 }),
        api.get<{ data: PackageOption[] }>('/catalog/packages').catch(() => ({ data: [] })),
      ]);
      setProduct(p.data);
      setItems(it.data);
      setPackages(pk.data ?? []);

      const v = p.data.variants.find((x) => x.id === variantId);
      if (!v) {
        setError('That variant does not belong to this product');
        return;
      }
      setFormState({
        title: str(v.title), sku: str(v.sku), barcode: str(v.barcode),
        barcodeType: str(v.barcodeType),
        price: str(v.price), compareAtPrice: str(v.compareAtPrice), mrp: str(v.mrp),
        costPrice: str(v.costPrice),
        unitPriceValue: str(v.unitPriceValue), unitPriceUnit: str(v.unitPriceUnit),
        unitPriceTotal: str(v.unitPriceTotal), unitPriceTotalUnit: str(v.unitPriceTotalUnit),
        unitPriceBase: str(v.unitPriceBase), unitPriceBaseUnit: str(v.unitPriceBaseUnit),
        chargeTax: v.chargeTax, itemId: str(v.itemId),
        weight: str(v.weight), weightUnit: str(v.weightUnit) || 'KG',
        packageId: str(v.packageId),
        countryOfOrigin: str(v.countryOfOrigin), hsCode: str(v.hsCode),
        continueSellingOos: v.continueSellingOos,
        option1: str(v.option1), option2: str(v.option2), option3: str(v.option3),
        imageUrl: str(v.imageUrl), isActive: v.isActive,
      });

      if (v.itemId) {
        const inv = await api
          .get<{ data: { locations: StockLevel[] } }>(`/inventory/${v.itemId}`)
          .catch(() => null);
        setLevels(inv?.data.locations ?? []);
      } else {
        setLevels([]);
      }

      const comboParts = p.data.kind === 'BUNDLE' ? v.components ?? [] : [];
      const partVariants = await Promise.all(
        [...new Set(comboParts.map((c) => c.productId))].map((pid) =>
          api
            .get<{ data: { id: string; packSize: number }[] }>(`/products/${pid}/variants`)
            .then((r) => r.data)
            .catch(() => [])
        )
      );
      setPartPacks(Object.fromEntries(partVariants.flat().map((x) => [x.id, x.packSize || 1])));
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setLoading(false);
    }
  }, [id, variantId]);

  useEffect(() => {
    const t = setTimeout(load, 0);
    return () => clearTimeout(t);
  }, [load]);

  const current = product?.variants.find((v) => v.id === variantId) ?? null;
  const packSize = current?.packSize ?? 1;
  const packIdx = product?.options?.findIndex((o) => o.packs?.length) ?? -1;
  const packField = (['option1', 'option2', 'option3'] as const)[packIdx] ?? null;
  const packRule =
    packField && current ? product?.options?.[packIdx]?.packs?.find((p) => p.value === current[packField]) : null;
  const single =
    packField && current && packSize > 1
      ? product?.variants.find(
          (v) =>
            v.packSize === 1 &&
            (['option1', 'option2', 'option3'] as const).every((f) => f === packField || v[f] === current[f])
        ) ?? null
      : null;
  const autoPack = !!single;
  const weightFollows = autoPack && single?.weight != null;
  const chosenBox = packages.find((p) => p.id === form.packageId) ?? null;
  const goodsKg = toKg(form.weight, form.weightUnit);
  const boxKg = chosenBox ? toKg(chosenBox.emptyWeight, chosenBox.weightUnit) : null;
  const parcelKg = goodsKg != null && boxKg != null ? goodsKg + boxKg : null;

  function pickBox(packageId: string) {
    const item = items.find((i) => i.id === form.itemId) ?? null;
    const goods = form.weight === '' && item?.weight != null && Number(item.weight) > 0 ? toKg(item.weight, item.weightUnit) : null;
    set({
      packageId,
      ...(goods != null && !weightFollows && { weight: String(fromKg(goods, form.weightUnit)) }),
    });
  }

  async function save(e?: React.FormEvent) {
    e?.preventDefault();
    setSaving(true);
    setError('');
    const unitPrice = computeUnitPrice(form.price, {
      unitPriceTotal: form.unitPriceTotal,
      unitPriceTotalUnit: form.unitPriceTotalUnit,
      unitPriceBase: form.unitPriceBase,
      unitPriceBaseUnit: form.unitPriceBaseUnit,
    });
    try {
      await api.patch(`/products/${id}/variants/${variantId}`, {
        title: form.title.trim(),
        sku: form.sku.trim() || undefined,
        barcode: form.barcode.trim() || undefined,
        barcodeType: form.barcodeType || undefined,
        ...(!autoPack && {
          price: Number(form.price || 0),
          mrp: num(form.mrp) ?? null,
          compareAtPrice: num(form.compareAtPrice) ?? null,
          chargeTax: form.chargeTax,
          itemId: form.itemId || undefined,
          hsCode: form.hsCode.trim() || undefined,
        }),
        ...(autoPack &&
          form.compareAtPrice !== str(current?.compareAtPrice) && {
            compareAtPrice: num(form.compareAtPrice) ?? null,
          }),
        ...(autoPack &&
          form.price !== str(current?.price) &&
          (form.price === '' ? { priceManual: false } : { price: Number(form.price) })),
        ...(autoPack && form.mrp !== str(current?.mrp) && { mrp: num(form.mrp) ?? null }),
        unitPriceValue: unitPrice && !('error' in unitPrice) ? unitPrice.value : undefined,
        unitPriceUnit: unitPrice && !('error' in unitPrice) ? unitPrice.unit : undefined,
        unitPriceTotal: num(form.unitPriceTotal),
        unitPriceTotalUnit: form.unitPriceTotalUnit || undefined,
        unitPriceBase: num(form.unitPriceBase),
        unitPriceBaseUnit: form.unitPriceBaseUnit || undefined,
        ...(!weightFollows && { weight: num(form.weight), weightUnit: form.weightUnit }),
        packageId: form.packageId || undefined,
        countryOfOrigin: form.countryOfOrigin.trim() || undefined,
        continueSellingOos: form.continueSellingOos,
        option1: form.option1.trim() || undefined,
        imageUrl: form.imageUrl.trim() || null,
        isActive: form.isActive,
      });
      toast.success('Saved');
      await load();
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setSaving(false);
    }
  }

  async function removeVariant() {
    if (!confirm(`Delete variant "${form.title}"?`)) return;
    try {
      await api.del(`/products/${id}/variants/${variantId}`);
      router.push(`/admin/products/${id}`);
    } catch (err) {
      setError(errorMessage(err));
    }
  }

  if (loading) return <Loading />;
  if (!product) return <ErrorBox message={error || 'Product not found'} onRetry={load} />;

  const siblings = product.variants.filter(
    (v) =>
      !search.trim() ||
      v.title.toLowerCase().includes(search.trim().toLowerCase()) ||
      (v.sku ?? '').toLowerCase().includes(search.trim().toLowerCase())
  );

  const optionName = product.options?.[0]?.name ?? 'Option';
  const linkedItem = items.find((i) => i.id === form.itemId) ?? null;
  const unitCost = linkedItemCost(linkedItem);
  const isCombo = product.kind === 'BUNDLE';
  const parts = isCombo ? current?.components ?? [] : [];
  const comboCost = parts.length
    ? parts.reduce<number | null>((sum, c) => {
        const cost = linkedItemCost(items.find((i) => i.id === c.itemId)) ?? 0;
        const pack = partPacks[c.componentVariantId];
        return sum == null || !(cost > 0) || pack == null ? null : sum + cost * pack * c.quantity;
      }, 0)
    : null;
  const itemCost = isCombo ? comboCost : unitCost != null ? unitCost * packSize : null;
  const earned = marginOf(form.price, itemCost);
  const tracked = Boolean(form.itemId);
  const canPack = current?.availability?.available;

  return (
    <form onSubmit={save}>
      <PageCrumb label={form.title} />

      <PageHeader
        title={form.title || 'Variant'}
        subtitle={form.sku ? `SKU ${form.sku}` : 'no SKU'}
        actions={
          <>
            <Badge status={product.status}>{productStatusLabel(product.status)}</Badge>
            {product.variants.length > 1 && (
              <Button type="button" variant="danger" onClick={removeVariant}>Delete variant</Button>
            )}
            <Button type="submit" variant="primary" disabled={saving}>
              {saving && <Spinner className="border-card/40 border-t-card" />}
              Save
            </Button>
          </>
        }
      />

      {error && <div className="mb-4"><ErrorBox message={error} /></div>}

      <div className="grid gap-5 lg:grid-cols-3">
        <div className="space-y-5">
          <Card title={product.title}>
            <div className="mb-3 text-xs text-muted-foreground">
              {product.variants.length} variant{product.variants.length === 1 ? '' : 's'}
            </div>
            <Input
              placeholder="Search variants…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
            <ul className="mt-3 space-y-1">
              {siblings.map((v) => {
                const active = v.id === variantId;
                return (
                  <li key={v.id}>
                    <Link
                      href={`/admin/products/${product.id}/variants/${v.id}`}
                      className={`block rounded-md px-3 py-2 text-sm ${
                        active
                          ? 'bg-gold-soft font-medium text-gold-ink'
                          : 'text-foreground hover:bg-muted/60'
                      }`}
                    >
                      {v.title}
                      <div className="text-xs text-muted-foreground">
                        {v.sku ?? 'no SKU'} · {money(v.price)}
                      </div>
                    </Link>
                  </li>
                );
              })}
              {siblings.length === 0 && (
                <li className="px-3 py-2 text-sm text-muted-foreground">No variant matches</li>
              )}
            </ul>
            <div className="mt-3">
              <Link href={`/admin/products/${product.id}`}>
                <Button type="button" size="sm">← Back to product</Button>
              </Link>
            </div>
          </Card>
        </div>

        <div className="space-y-5 lg:col-span-2 min-w-0">
          <Card title="Variant">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <Field label="Title" required>
                <Input value={form.title} onChange={(e) => set({ title: e.target.value })} required />
              </Field>
              <Field label={optionName} hint="The option value this variant represents">
                <Input value={form.option1} onChange={(e) => set({ option1: e.target.value })} />
              </Field>
              <Field
                label="Image"
                hint="Shown in place of the product cover wherever this variant appears on its own"
              >
                <div className="flex items-start gap-3">
                  <div className="flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded border border-border bg-muted">
                    {form.imageUrl ? (
                      <img
                        src={form.imageUrl}
                        alt={form.title || 'Variant'}
                        className="h-full w-full object-cover"
                      />
                    ) : (
                      <span className="text-[10px] text-muted-foreground">
                        No image
                      </span>
                    )}
                  </div>
                  <div className="min-w-0 flex-1 space-y-1.5">
                    <div className="flex gap-2">
                      <FileUpload
                        label={form.imageUrl ? 'Replace' : 'Upload'}
                        accept="image/*"
                        onUploaded={(files) => {
                          if (files[0]) set({ imageUrl: files[0].url });
                        }}
                      />
                      {form.imageUrl && (
                        <Button
                          type="button"
                          size="sm"
                          variant="danger"
                          onClick={() => set({ imageUrl: '' })}
                        >
                          Remove
                        </Button>
                      )}
                    </div>
                    <p className="truncate text-xs text-muted-foreground">
                      {form.imageUrl || 'JPG, PNG or WebP, up to 5 MB'}
                    </p>
                  </div>
                </div>
              </Field>
              <Field label="Active">
                <Select
                  value={form.isActive ? 'yes' : 'no'}
                  onChange={(e) => set({ isActive: e.target.value === 'yes' })}
                  className="w-full"
                >
                  <option value="yes">Active</option>
                  <option value="no">Inactive</option>
                </Select>
              </Field>
            </div>
          </Card>

          <Card title="Price">
            {packSize > 1 && (
              <p className="mb-4 rounded-md border border-gold/40 bg-gold-soft/60 px-3 py-2 text-sm text-gold-ink">
                A pack of {packSize}
                {single ? (
                  <>
                    {' '}- its price is {packSize} ×{' '}
                    <Link
                      href={`/admin/products/${id}/variants/${single.id}`}
                      className="font-medium underline"
                    >
                      {single.title}
                    </Link>
                    {packRule?.discountPercent ? ` less ${packRule.discountPercent}%` : ''}, and it uses that
                    variant&apos;s stock item. Type your own MRP, price or compare-at below to set them for this
                    pack only.
                  </>
                ) : (
                  <> - selling one takes {packSize} of its stock item.</>
                )}
              </p>
            )}
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
              <Field
                label="MRP"
                hint={
                  Number(form.mrp) > 0 && Number(form.price) > Number(form.mrp)
                    ? 'The price is above the MRP'
                    : autoPack
                      ? current?.mrpManual
                        ? 'Typed for this pack'
                        : `Worked out as ${packSize} × the single's MRP - type to set your own`
                      : 'Maximum retail price, including GST'
                }
              >
                <Input
                  type="number" step="0.01" min="0"
                  value={form.mrp}
                  onChange={(e) => set({ mrp: e.target.value })}
                />
                {autoPack && current?.mrpManual && (
                  <button
                    type="button"
                    onClick={() => set({ mrp: '' })}
                    className="mt-1 text-xs text-gold-ink hover:underline"
                  >
                    Use the worked-out MRP
                  </button>
                )}
              </Field>
              <Field
                label="Price"
                required={!autoPack}
                hint={
                  autoPack
                    ? current?.priceManual
                      ? 'Typed for this pack'
                      : 'Worked out from the single - type to set your own'
                    : undefined
                }
              >
                <Input
                  type="number" step="0.01" min="0"
                  value={form.price}
                  onChange={(e) => set({ price: e.target.value })}
                  required={!autoPack}
                  placeholder={autoPack ? 'Worked out' : undefined}
                />
                {autoPack && current?.priceManual && (
                  <button
                    type="button"
                    onClick={() => set({ price: '' })}
                    className="mt-1 text-xs text-gold-ink hover:underline"
                  >
                    Use the worked-out price
                  </button>
                )}
              </Field>
              <Field
                label="Compare-at price"
                hint={
                  Number(form.compareAtPrice) > Number(form.price) && Number(form.price) > 0
                    ? `${Math.round(
                        ((Number(form.compareAtPrice) - Number(form.price)) /
                          Number(form.compareAtPrice)) *
                          100
                      )}% off — shown struck through`
                    : 'The higher, was-before price. Leave blank if not on offer.'
                }
              >
                <Input
                  type="number" step="0.01" min="0"
                  value={form.compareAtPrice}
                  onChange={(e) => set({ compareAtPrice: e.target.value })}
                />
                {autoPack && (
                  <p className="mt-1 text-xs text-muted-foreground">
                    {current?.compareAtManual ? (
                      <>
                        Typed for this pack.{' '}
                        <button
                          type="button"
                          onClick={() => set({ compareAtPrice: '' })}
                          className="text-gold-ink hover:underline"
                        >
                          Use the worked-out value
                        </button>
                      </>
                    ) : (
                      'Worked out from the single - type a value to set your own.'
                    )}
                  </p>
                )}
                {Number(form.compareAtPrice) > 0 && Number(form.compareAtPrice) <= Number(form.price) && (
                  <p className="mt-1 text-xs text-warning">
                    Compare-at should be higher than the price, or it will not be shown struck through.
                  </p>
                )}
              </Field>
              <Derived
                label={isCombo ? 'Cost of the contents' : packSize > 1 ? `Cost of ${packSize} singles` : 'Cost per item'}
                value={itemCost != null ? money(itemCost) : undefined}
                hint={
                  isCombo
                    ? parts.length === 0
                      ? 'Add the combo contents first'
                      : itemCost != null
                        ? 'Added up from the products inside'
                        : 'A product inside has no cost set'
                    : form.itemId
                      ? itemCost != null
                        ? 'From the stock item'
                        : 'No cost set on the item'
                      : 'Link a stock item first'
                }
              />
              <Derived label="Profit" value={earned ? money(earned.profit) : undefined} />
              <Derived
                label="Margin"
                value={earned ? `${earned.margin.toFixed(1)}%` : undefined}
                tone={earned && earned.margin < 0 ? 'bad' : undefined}
                hint={
                  !isCombo && form.itemId ? (
                    <>
                      Set on{' '}
                      <Link
                        href={`/admin/items/${form.itemId}`}
                        className="text-gold-ink hover:underline"
                      >
                        the item
                      </Link>
                    </>
                  ) : undefined
                }
              />
              <UnitPriceField
                price={form.price}
                values={{
                  unitPriceTotal: form.unitPriceTotal,
                  unitPriceTotalUnit: form.unitPriceTotalUnit,
                  unitPriceBase: form.unitPriceBase,
                  unitPriceBaseUnit: form.unitPriceBaseUnit,
                }}
                onChange={(patch) => set(patch)}
              />
            </div>
            <label className="mt-4 flex items-center gap-2 text-sm text-foreground">
              <input
                type="checkbox"
                checked={form.chargeTax}
                onChange={(e) => set({ chargeTax: e.target.checked })}
                disabled={autoPack}
              />
              Charge tax on this variant{autoPack && ' - same as the single'}
            </label>
          </Card>

          <Card title="Inventory">
            {isCombo ? (
              <div className="space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="min-w-0 text-sm text-muted-foreground">
                    A combo has no stock item of its own. Its stock and cost come from the products packed inside
                    it, and selling one takes stock from each of them.
                  </p>
                  {parts.length > 0 && (
                    <Badge tone={(canPack ?? 0) > 0 ? 'green' : 'amber'}>
                      {canPack == null ? 'Not tracked' : `${canPack} can be packed`}
                    </Badge>
                  )}
                </div>
                {parts.length === 0 ? (
                  <p className="rounded-md border border-dashed border-border px-3 py-3 text-sm text-muted-foreground">
                    Nothing is packed in this combo yet.
                  </p>
                ) : (
                  <ul className="divide-y divide-border rounded-md border border-border text-sm">
                    {parts.map((c) => (
                      <li key={c.componentVariantId} className="flex items-center justify-between gap-3 px-3 py-2">
                        <Link href={`/admin/products/${c.productId}`} className="min-w-0 truncate text-foreground hover:text-gold-ink hover:underline">
                          {c.productTitle}
                          {c.title && c.title !== 'Default' ? ` (${c.title})` : ''} ×{c.quantity}
                        </Link>
                        <span className="shrink-0 text-xs tabular-nums text-muted-foreground">
                          {c.available == null ? 'Not tracked' : `${c.available} in stock`}
                        </span>
                      </li>
                    ))}
                  </ul>
                )}
                <Link href={`/admin/products/${id}?tab=combo`} className="inline-block text-xs font-medium text-gold-ink hover:underline">
                  Change what goes inside
                </Link>
              </div>
            ) : (
              <Field
                label="Stock item"
                hint="Stock lives on the item, never on the variant. Link one to make this variant tracked."
              >
                <ItemSelect
                  value={form.itemId}
                  items={items}
                  onChange={(id) => set({ itemId: id })}
                  placeholder="Not tracked — no stock item"
                  className="w-full"
                  disabled={autoPack}
                />
              </Field>
            )}

            {isCombo ? null : tracked ? (
              <div className="mt-4">
                <Table>
                  <thead>
                    <tr>
                      <Th>Location</Th>
                      <Th className="text-right">Unavailable</Th>
                      <Th className="text-right">Committed</Th>
                      <Th className="text-right">Available</Th>
                      <Th className="text-right">On hand</Th>
                    </tr>
                  </thead>
                  <tbody>
                    {levels.length === 0 && (
                      <EmptyRow colSpan={5} message="No stock at any location yet" />
                    )}
                    {levels.map((l) => (
                      <tr key={l.locationId}>
                        <Td>{l.location.name}</Td>
                        <Td className="text-right">{Number(l.unavailable)}</Td>
                        <Td className="text-right">{Number(l.committed)}</Td>
                        <Td className="text-right font-medium">{l.available}</Td>
                        <Td className="text-right">{Number(l.onHand)}</Td>
                      </tr>
                    ))}
                  </tbody>
                </Table>
                <div className="mt-2 flex gap-3 text-xs">
                  <Link
                    href={`/admin/inventory/${form.itemId}`}
                    className="font-medium text-gold-ink hover:underline"
                  >
                    View adjustment history
                  </Link>
                  <Link
                    href="/admin/inventory/adjustments/new"
                    className="font-medium text-gold-ink hover:underline"
                  >
                    Adjust stock
                  </Link>
                  {linkedItem && !linkedItem.trackInventory && (
                    <span className="text-warning">
                      This item has inventory tracking switched off
                    </span>
                  )}
                </div>
              </div>
            ) : (
              <p className="mt-3 text-sm text-muted-foreground">
                Not tracked. Pick a stock item above and save to start tracking this variant.
              </p>
            )}

            <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
              <Field label="SKU (Stock Keeping Unit)">
                <Input
                  value={form.sku}
                  onChange={(e) => set({ sku: e.target.value })}
                  className="font-mono"
                />
              </Field>
              <Field
                label="Barcode"
                hint="ISBN, UPC, GTIN and the rest — the kind sits with the number."
              >
                <div
                  className="flex items-stretch overflow-hidden rounded-md border border-border
                    bg-card transition-colors focus-within:border-gold
                    focus-within:ring-2 focus-within:ring-gold/20
"
                >
                  <Input
                    value={form.barcode}
                    onChange={(e) => set({ barcode: e.target.value })}
                    placeholder="8901234567890"
                    className="flex-1 border-0 font-mono focus:ring-0"
                  />
                  <Select
                    value={form.barcodeType}
                    onChange={(e) => set({ barcodeType: e.target.value })}
                    aria-label="Barcode type"
                    className="w-28 shrink-0 rounded-none border-0 border-l border-border
                      bg-muted/60 text-xs focus:ring-0"
                  >
                    <option value="">Type</option>
                    <option value="CUSTOM">Custom</option>
                    <option value="GTIN">GTIN</option>
                    <option value="UPC">UPC</option>
                    <option value="EAN">EAN</option>
                    <option value="ISBN">ISBN</option>
                    <option value="ASIN">ASIN</option>
                  </Select>
                </div>
              </Field>
            </div>

            <label className="mt-3 flex items-center gap-2 text-sm text-foreground">
              <input
                type="checkbox"
                checked={form.continueSellingOos}
                onChange={(e) => set({ continueSellingOos: e.target.checked })}
              />
              Continue selling when out of stock
            </label>
          </Card>

          <Card title="Shipping">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <Field label="Weight" hint={weightFollows ? `${packSize} × the single's weight` : undefined}>
                <div className="flex gap-2">
                  <Input
                    type="number" step="0.001" min="0"
                    value={form.weight}
                    onChange={(e) => set({ weight: e.target.value })}
                    disabled={weightFollows}
                  />
                  <Select
                    value={form.weightUnit}
                    onChange={(e) => set({ weightUnit: e.target.value })}
                    className="w-24"
                    disabled={weightFollows}
                  >
                    <option value="KG">kg</option>
                    <option value="G">g</option>
                    <option value="LB">lb</option>
                    <option value="OZ">oz</option>
                  </Select>
                </div>
              </Field>
              <Field
                label="Ships in"
                hint="The box adds its own empty weight, and its size is what a courier bills volumetric weight on."
              >
                <Select
                  value={form.packageId}
                  onChange={(e) => pickBox(e.target.value)}
                >
                  <option value="">No box chosen</option>
                  {packages.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name}
                      {p.length && p.width && p.height
                        ? ` — ${Number(p.length)}×${Number(p.width)}×${Number(p.height)} ${p.dimensionUnit.toLowerCase()}`
                        : ''}
                      {p.emptyWeight && Number(p.emptyWeight) > 0
                        ? ` (${Number(p.emptyWeight)} ${p.weightUnit.toLowerCase()})`
                        : ''}
                    </option>
                  ))}
                </Select>
              </Field>
              {chosenBox && goodsKg != null && (
                <p className="text-xs text-muted-foreground sm:col-span-2">
                  Goods {showWeight(goodsKg, form.weightUnit)}
                  {boxKg != null ? ` + box ${showWeight(boxKg, form.weightUnit)} = parcel ${showWeight(parcelKg ?? goodsKg, form.weightUnit)}` : ' - the box has no empty weight set, so the parcel weight is the goods weight'}
                </p>
              )}
              <Field label="Country of origin">
                <ComboSelect
                  value={form.countryOfOrigin}
                  options={['India', 'China', 'United States', 'Germany', 'Japan', 'South Korea', 'United Kingdom', 'Italy', 'France', 'Thailand']}
                  onChange={(countryOfOrigin) => set({ countryOfOrigin })}
                  placeholder="Not set"
                  addLabel="+ Another country"
                  newPlaceholder="Country name"
                />
              </Field>
              <Field label="Harmonized System (HS) code" hint={autoPack ? 'Same as the single' : '6 to 8 digits'}>
                <Input
                  inputMode="numeric"
                  maxLength={8}
                  value={form.hsCode}
                  onChange={(e) => set({ hsCode: e.target.value.replace(/\D/g, '').slice(0, 8) })}
                  placeholder="330690"
                  disabled={autoPack}
                  className="font-mono"
                />
              </Field>
            </div>
          </Card>
        </div>
      </div>
    </form>
  );
}
