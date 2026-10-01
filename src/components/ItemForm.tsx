'use client';

import { SIZE_UNITS, TAX_TREATMENTS, priceAs } from '@/lib/items';
import { offMrpText } from '@/lib/mrp';
import { money } from '@/lib/api';
import { ComboSelect } from './ComboSelect';
import { Card, Field, Input, Select, Textarea, Button } from './ui';
import { FileUpload } from './FileUpload';
import { TaxRateSelect } from './TaxRateSelect';
import { ItemKindPicker } from './ItemKindPicker';
import { CostItemSelect, costOf } from './CostItemSelect';

export type Location = { id: string; name: string; code: string; isDefault: boolean };
export type Vendor = { id: string; displayName?: string; name?: string; companyName?: string };
export type ItemFacets = { brands: string[]; manufacturers: string[]; hsnCodes: string[] };

export const SALES_ACCOUNTS = [
  'Sales', 'General Income', 'Discount', 'Shipping Charge', 'Other Charges',
];
export const PURCHASE_ACCOUNTS = [
  'Cost of Goods Sold', 'Job Costing', 'Labour', 'Materials', 'Subcontractor',
];
export const INVENTORY_ACCOUNTS = [
  'Inventory Asset', 'Finished Goods', 'Raw Materials', 'Packaging',
];
export const UNITS = ['pcs', 'box', 'btl', 'ml', 'ltr', 'g', 'kg', 'pack', 'set', 'dz'];

export const MAX_IMAGES = 15;
const IMAGE_SLOTS = ['Front view', 'Rear view'];

export const vendorName = (v: Vendor) =>
  v.displayName || v.companyName || v.name || 'Unnamed vendor';

export const ITEM_CATEGORIES = [
  { value: 'FINISHED_GOOD', label: 'Finished product', hint: 'What customers buy - bought from the factory' },
  { value: 'PACKAGING', label: 'Packaging', hint: 'Boxes, cartons and shipping material' },
  { value: 'RAW_MATERIAL', label: 'Raw material', hint: 'Bought in to make something else' },
  { value: 'CONSUMABLE', label: 'Consumable', hint: 'Used up in the business, not sold' },
];

export type ItemFormValues = {
  name: string;
  sku: string;
  type: string;
  itemCategory: string;
  itemKindId: string;
  parentItemId: string;
  unit: string;
  hasVariants: boolean;
  brand: string;
  manufacturer: string;
  hsnCode: string;
  taxPreference: string;
  description: string;
  status: string;

  isSalesItem: boolean;
  sellingPrice: string;
  sellingTaxTreatment: string;
  mrp: string;
  sizeValue: string;
  sizeUnit: string;
  salesAccount: string;
  salesDescription: string;

  isPurchaseItem: boolean;
  costPrice: string;
  costTaxTreatment: string;
  otherCosts: { name: string; amount: string; itemId?: string }[];
  purchaseAccount: string;
  purchaseDescription: string;
  preferredVendorId: string;

  intraStateTaxRate: string;
  interStateTaxRate: string;

  trackInventory: boolean;
  inventoryAccount: string;
  valuationMethod: string;
  reorderPoint: string;
  openingStock: string;
  openingStockValue: string;
  openingStockLocationId: string;
  stockLocationId: string;

  isReturnable: boolean;

  length: string;
  width: string;
  height: string;
  dimensionUnit: string;
  weight: string;
  weightUnit: string;
};

export const emptyItemForm = (): ItemFormValues => ({
  name: '', sku: '', type: 'GOODS', itemCategory: 'FINISHED_GOOD', itemKindId: '', parentItemId: '', unit: 'pcs', hasVariants: false,
  brand: '', manufacturer: '', hsnCode: '', taxPreference: 'TAXABLE',
  description: '', status: 'ACTIVE',
  isSalesItem: true, sellingPrice: '', sellingTaxTreatment: 'INCLUSIVE', mrp: '',
  sizeValue: '', sizeUnit: '',
  salesAccount: 'Sales', salesDescription: '',
  isPurchaseItem: true, costPrice: '', costTaxTreatment: 'EXCLUSIVE', otherCosts: [], purchaseAccount: 'Cost of Goods Sold',
  purchaseDescription: '', preferredVendorId: '',
  intraStateTaxRate: '', interStateTaxRate: '',
  trackInventory: true, inventoryAccount: 'Inventory Asset', valuationMethod: 'FIFO',
  reorderPoint: '', openingStock: '', openingStockValue: '', openingStockLocationId: '', stockLocationId: '',
  isReturnable: true,
  length: '', width: '', height: '', dimensionUnit: 'CM', weight: '', weightUnit: 'KG',
});

const str = (v: unknown) => (v === null || v === undefined ? '' : String(v));

export function itemToForm(i: Record<string, unknown>): ItemFormValues {
  const base = emptyItemForm();
  const levels = Array.isArray(i.locations) ? (i.locations as { locationId: string; onHand: string }[]) : [];
  const holding = levels.find((l) => Number(l.onHand) > 0) ?? levels[0];
  return {
    ...base,
    stockLocationId: holding?.locationId ?? '',
    name: str(i.name),
    sku: str(i.sku),
    type: str(i.type) || base.type,
    itemCategory: str(i.itemCategory) || base.itemCategory,
    itemKindId: str(i.itemKindId),
    parentItemId: str(i.parentItemId),
    unit: str(i.unit) || base.unit,
    hasVariants: Boolean(i.hasVariants),
    brand: str(i.brand),
    manufacturer: str(i.manufacturer),
    hsnCode: str(i.hsnCode),
    taxPreference: str(i.taxPreference) || base.taxPreference,
    description: str(i.description),
    status: str(i.status) || base.status,
    isSalesItem: i.isSalesItem !== false,
    sellingPrice: str(i.sellingPrice),
    sellingTaxTreatment: str(i.sellingTaxTreatment) || base.sellingTaxTreatment,
    mrp: str(i.mrp),
    sizeValue: i.sizeValue != null ? String(Number(i.sizeValue)) : '',
    sizeUnit: str(i.sizeUnit),
    salesAccount: str(i.salesAccount),
    salesDescription: str(i.salesDescription),
    isPurchaseItem: i.isPurchaseItem !== false,
    costPrice: str(i.costPrice),
    costTaxTreatment: str(i.costTaxTreatment) || base.costTaxTreatment,
    otherCosts: Array.isArray(i.otherCosts)
      ? (i.otherCosts as { name?: string; amount?: unknown; itemId?: unknown }[]).map((c) => ({
          name: str(c.name),
          amount: str(c.amount),
          itemId: str(c.itemId) || undefined,
        }))
      : [],
    purchaseAccount: str(i.purchaseAccount),
    purchaseDescription: str(i.purchaseDescription),
    preferredVendorId: str(i.preferredVendorId),
    intraStateTaxRate: str(i.intraStateTaxRate),
    interStateTaxRate: str(i.interStateTaxRate),
    trackInventory: i.trackInventory !== false,
    inventoryAccount: str(i.inventoryAccount),
    valuationMethod: str(i.valuationMethod) || base.valuationMethod,
    reorderPoint: str(i.reorderPoint),
    isReturnable: i.isReturnable !== false,
    length: str(i.length),
    width: str(i.width),
    height: str(i.height),
    dimensionUnit: str(i.dimensionUnit) || base.dimensionUnit,
    weight: str(i.weight),
    weightUnit: str(i.weightUnit) || base.weightUnit,
  };
}

const num = (v: string) => (v === '' ? undefined : Number(v));

export function suggestSku(f: Pick<ItemFormValues, 'name' | 'sizeValue' | 'sizeUnit'>) {
  const words = f.name
    .toUpperCase()
    .replace(/[^A-Z0-9 ]/g, ' ')
    .split(/\s+/)
    .filter((w) => w && !/^\d+(ML|L|G|KG|MG)?$/.test(w))
    .slice(0, 3)
    .map((w) => w.slice(0, 4));
  const size = f.sizeValue ? `${Number(f.sizeValue)}${(f.sizeUnit || '').toUpperCase()}` : '';
  return [...words, size].filter(Boolean).join('-');
}

export function itemFormProblem(f: ItemFormValues) {
  if (f.taxPreference !== 'TAXABLE') return null;
  const missing = [
    f.intraStateTaxRate === '' && 'intra-state (CGST + SGST)',
    f.interStateTaxRate === '' && 'inter-state (IGST)',
  ].filter(Boolean);
  return missing.length
    ? `A taxable item needs its ${missing.join(' and ')} GST rate - set it under Default tax rates, or change the tax preference if the item is not taxed`
    : null;
}

export function itemFormToPayload(f: ItemFormValues, images: string[], withOpeningStock: boolean) {
  return {
    name: f.name.trim(),
    sku: f.sku.trim() || undefined,
    type: f.type,
    itemCategory: f.itemCategory,
    itemKindId: f.itemKindId || undefined,
    parentItemId: f.parentItemId || null,
    unit: f.unit,
    hasVariants: f.hasVariants,
    brand: f.brand.trim() || undefined,
    manufacturer: f.manufacturer.trim() || undefined,
    hsnCode: f.hsnCode.trim() || undefined,
    taxPreference: f.taxPreference,
    description: f.description.trim() || undefined,
    status: f.status,

    isSalesItem: f.isSalesItem,
    sellingPrice: f.isSalesItem ? num(f.sellingPrice) : undefined,
    sellingTaxTreatment: f.isSalesItem ? f.sellingTaxTreatment : undefined,
    mrp: f.isSalesItem ? num(f.mrp) ?? null : undefined,
    sizeValue: num(f.sizeValue) ?? null,
    sizeUnit: f.sizeValue !== '' && f.sizeUnit ? f.sizeUnit : null,
    salesAccount: f.isSalesItem ? f.salesAccount || undefined : undefined,
    salesDescription: f.isSalesItem ? f.salesDescription.trim() || undefined : undefined,

    isPurchaseItem: f.isPurchaseItem,
    costPrice: f.isPurchaseItem ? num(f.costPrice) : undefined,
    costTaxTreatment: f.isPurchaseItem ? f.costTaxTreatment : undefined,
    otherCosts: f.isPurchaseItem
      ? f.otherCosts
          .filter((c) => c.name.trim() && Number(c.amount) > 0)
          .map((c) => ({ name: c.name.trim(), amount: Number(c.amount), itemId: c.itemId || undefined }))
      : [],
    purchaseAccount: f.isPurchaseItem ? f.purchaseAccount || undefined : undefined,
    purchaseDescription: f.isPurchaseItem ? f.purchaseDescription.trim() || undefined : undefined,
    preferredVendorId: f.preferredVendorId || undefined,

    intraStateTaxRate: num(f.intraStateTaxRate),
    interStateTaxRate: num(f.interStateTaxRate),

    trackInventory: f.trackInventory,
    inventoryAccount: f.trackInventory ? f.inventoryAccount || undefined : undefined,
    valuationMethod: f.valuationMethod,
    reorderPoint: num(f.reorderPoint),
    ...(!withOpeningStock && f.trackInventory && f.stockLocationId ? { stockLocationId: f.stockLocationId } : {}),
    ...(withOpeningStock && f.trackInventory && f.openingStock !== ''
      ? {
          openingStock: Number(f.openingStock),
          openingStockValue: num(f.openingStockValue),
          openingStockLocationId: f.openingStockLocationId || undefined,
        }
      : {}),

    isReturnable: f.isReturnable,

    length: num(f.length),
    width: num(f.width),
    height: num(f.height),
    dimensionUnit: f.dimensionUnit,
    weight: num(f.weight),
    weightUnit: f.weightUnit,

    imageUrls: images.map((i) => i.trim()).filter(Boolean).slice(0, MAX_IMAGES),
  };
}

export function ItemFormFields({
  form,
  setForm,
  images,
  setImages,
  locations,
  vendors,
  facets,
  mode,
  itemId,
}: {
  form: ItemFormValues;
  setForm: (patch: Partial<ItemFormValues>) => void;
  images: string[];
  setImages: (next: string[]) => void;
  locations: Location[];
  vendors: Vendor[];
  facets: ItemFacets;
  mode: 'create' | 'edit';
  itemId?: string;
}) {
  const set = setForm;
  const isService = form.type === 'SERVICE';
  const gstPercent =
    form.taxPreference !== 'TAXABLE' ? 0 : form.intraStateTaxRate !== '' ? Number(form.intraStateTaxRate) : 18;
  const mrp = Number(form.mrp);
  const selling = Number(form.sellingPrice);
  const sellingWithTax = priceAs(selling, form.sellingTaxTreatment, 'INCLUSIVE', gstPercent);
  const sellingBeforeTax = priceAs(selling, form.sellingTaxTreatment, 'EXCLUSIVE', gstPercent);
  const cost = Number(form.costPrice);
  const costBeforeTax = priceAs(cost, form.costTaxTreatment, 'EXCLUSIVE', gstPercent);
  const costWithTax = priceAs(cost, form.costTaxTreatment, 'INCLUSIVE', gstPercent);
  const sellingHint = () => {
    if (!(selling > 0)) {
      return form.sellingTaxTreatment === 'EXCLUSIVE' ? `GST at ${gstPercent}% is added on top` : 'GST is inside this price';
    }
    const other =
      form.sellingTaxTreatment === 'EXCLUSIVE'
        ? `₹${sellingWithTax.toFixed(2)} with ${gstPercent}% GST`
        : `₹${sellingBeforeTax.toFixed(2)} before ${gstPercent}% GST`;
    const off = mrp > 0 ? offMrpText(mrp, sellingWithTax, money) : null;
    if (off?.above) {
      return <span className="text-destructive">{other} - {off.text}</span>;
    }
    return off ? `${other} · ${off.text}` : other;
  };
  const defaultDiscount = mrp > 0 && selling > 0 ? offMrpText(mrp, sellingWithTax, money) : null;
  const otherCostTotal = form.otherCosts.reduce((n, c) => n + (Number(c.amount) > 0 ? Number(c.amount) : 0), 0);
  const finalCost = costBeforeTax + otherCostTotal;
  const setOtherCost = (i: number, patch: Partial<{ name: string; amount: string; itemId: string | undefined }>) =>
    set({ otherCosts: form.otherCosts.map((c, idx) => (idx === i ? { ...c, ...patch } : c)) });
  const costHint = () => {
    if (!(cost > 0)) {
      return form.costTaxTreatment === 'EXCLUSIVE' ? 'Before GST, as vendor bills show it' : 'GST is inside this price';
    }
    return form.costTaxTreatment === 'EXCLUSIVE'
      ? `₹${costWithTax.toFixed(2)} with ${gstPercent}% GST`
      : `₹${costBeforeTax.toFixed(2)} before ${gstPercent}% GST`;
  };

  return (
    <div className="space-y-5">
      <Card title="Item details">
        <div className="mb-4 flex flex-wrap gap-6">
          <div>
            <span className="mb-1 block text-xs font-medium text-muted-foreground">
              Item type
            </span>
            <div className="flex gap-4">
              {([['Single item', false], ['Has variants', true]] as const).map(([label, val]) => (
                <label key={label} className="flex items-center gap-2 text-sm">
                  <input
                    type="radio"
                    name="hasVariants"
                    checked={form.hasVariants === val}
                    onChange={() => set({ hasVariants: val })}
                  />
                  {label}
                </label>
              ))}
            </div>
          </div>

          <div>
            <span className="mb-1 block text-xs font-medium text-muted-foreground">
              Goods or service
            </span>
            <div className="flex gap-4">
              {(['GOODS', 'SERVICE'] as const).map((t) => (
                <label key={t} className="flex items-center gap-2 text-sm">
                  <input
                    type="radio"
                    name="type"
                    checked={form.type === t}
                    onChange={() =>
                      set(t === 'SERVICE' ? { type: t, trackInventory: false } : { type: t })
                    }
                  />
                  {t === 'GOODS' ? 'Goods' : 'Service'}
                </label>
              ))}
            </div>
          </div>
        </div>

        <ItemKindPicker
          kindId={form.itemKindId}
          category={form.itemCategory}
          onPick={(kind) =>
            set(
              kind.baseCategory === 'FINISHED_GOOD'
                ? { itemKindId: kind.id, itemCategory: kind.baseCategory, isSalesItem: true }
                : kind.baseCategory === 'PACKAGING' || kind.baseCategory === 'RAW_MATERIAL'
                  ? { itemKindId: kind.id, itemCategory: kind.baseCategory, isSalesItem: false, isPurchaseItem: true }
                  : { itemKindId: kind.id, itemCategory: kind.baseCategory }
            )
          }
        />

        <Field
          label="Sits under"
          hint="Leave this empty for a main item. Pick a main item to make this one of its sub-items - it then appears under it in the items list."
          className="sm:max-w-md"
        >
          <CostItemSelect
            value={form.parentItemId}
            exceptId={itemId}
            placeholder="A main item of its own"
            emptyLabel="A main item of its own"
            onPick={(picked) => set({ parentItemId: picked?.id ?? '' })}
          />
        </Field>

        <div className="grid gap-4 sm:grid-cols-3">
          <Field label="Name" required>
            <Input
              value={form.name}
              onChange={(e) => set({ name: e.target.value })}
              placeholder="Body Lotion 200ml"
              required
            />
          </Field>
          <Field label="SKU" hint="Your own stock code - leave empty if you do not use one">
            <div className="flex gap-2">
              <Input
                value={form.sku}
                onChange={(e) => set({ sku: e.target.value.toUpperCase() })}
                placeholder="OK-BL-200"
                className="min-w-0 flex-1 font-mono"
              />
              {!form.sku && form.name.trim() && (
                <Button type="button" size="sm" onClick={() => set({ sku: suggestSku(form) })}>
                  Suggest
                </Button>
              )}
            </div>
          </Field>
          <Field label="Unit" required={isService ? undefined : true}>
            <Select value={form.unit} onChange={(e) => set({ unit: e.target.value })} className="w-full">
              {UNITS.map((u) => (
                <option key={u} value={u}>{u}</option>
              ))}
            </Select>
          </Field>
          {!isService && (
            <Field label="Size" hint="Net content, e.g. 200 ml or 50 g - shown next to the name on orders and invoices">
              <div className="flex gap-2">
                <Input
                  type="number" step="0.01" min="0"
                  value={form.sizeValue}
                  onChange={(e) => set({ sizeValue: e.target.value, sizeUnit: form.sizeUnit || 'ml' })}
                  placeholder="250"
                />
                <Select
                  value={form.sizeUnit}
                  onChange={(e) => set({ sizeUnit: e.target.value })}
                  className="w-32"
                  aria-label="Size unit"
                >
                  <option value="">Unit</option>
                  {SIZE_UNITS.map((u) => (
                    <option key={u} value={u}>{u}</option>
                  ))}
                </Select>
              </div>
            </Field>
          )}

          <Field label="Brand">
            <ComboSelect
              value={form.brand}
              options={facets.brands}
              onChange={(v) => set({ brand: v })}
              placeholder="No brand"
              addLabel="+ Add new brand"
              newPlaceholder="New brand"
            />
          </Field>
          <Field label="Manufacturer">
            <ComboSelect
              value={form.manufacturer}
              options={facets.manufacturers}
              onChange={(v) => set({ manufacturer: v })}
              placeholder="No manufacturer"
              addLabel="+ Add new manufacturer"
              newPlaceholder="New manufacturer"
            />
          </Field>
          <Field
            label={isService ? 'SAC' : 'HSN code'}
            required={form.isSalesItem && form.taxPreference === 'TAXABLE'}
            hint={
              isService
                ? 'Services Accounting Code - 6 digits starting 99'
                : form.isSalesItem && form.taxPreference === 'TAXABLE'
                  ? 'Goes on every invoice and GST return - 4, 6 or 8 digits'
                  : undefined
            }
          >
            <ComboSelect
              value={form.hsnCode}
              options={facets.hsnCodes}
              onChange={(v) => set({ hsnCode: v })}
              placeholder={isService ? 'No SAC' : 'No HSN code'}
              addLabel={isService ? '+ Add new SAC' : '+ Add new HSN code'}
              newPlaceholder={isService ? 'e.g. 999312' : 'e.g. 33069000'}
            />
          </Field>

          <Field label="Tax preference">
            <Select
              value={form.taxPreference}
              onChange={(e) => set({ taxPreference: e.target.value })}
              className="w-full"
            >
              <option value="TAXABLE">Taxable</option>
              <option value="NON_TAXABLE">Non-taxable</option>
              <option value="OUT_OF_SCOPE">Out of scope</option>
              <option value="NON_GST">Non-GST supply</option>
            </Select>
          </Field>
          <Field label="Status">
            <Select
              value={form.status}
              onChange={(e) => set({ status: e.target.value })}
              className="w-full"
            >
              <option value="ACTIVE">Active</option>
              <option value="INACTIVE">Inactive</option>
            </Select>
          </Field>
        </div>

        <div className="mt-4">
          <Field label="Description">
            <Textarea
              rows={2}
              value={form.description}
              onChange={(e) => set({ description: e.target.value })}
            />
          </Field>
        </div>
      </Card>

      <Card title={`Images (${images.filter(Boolean).length}/${MAX_IMAGES})`}>
        <div className="grid gap-4 sm:grid-cols-2">
          {images.map((src, i) => (
            <Field key={i} label={IMAGE_SLOTS[i] ?? `Image ${i + 1}`}>
              <div className="flex items-start gap-2">
                {src ? (
                  <div className="h-20 w-20 shrink-0 overflow-hidden rounded-md border border-border bg-muted/60">
                    <img
                      src={src}
                      alt={IMAGE_SLOTS[i] ?? `Image ${i + 1}`}
                      className="h-full w-full object-cover"
                      onError={(e) => {
                        e.currentTarget.style.display = 'none';
                      }}
                    />
                  </div>
                ) : (
                  <div className="flex h-20 w-20 shrink-0 items-center justify-center rounded-md border border-dashed border-border text-xs text-muted-foreground">
                    none
                  </div>
                )}
                <div className="min-w-0 flex-1 space-y-2">
                  <Input
                    value={src}
                    onChange={(e) => setImages(images.map((r, idx) => (idx === i ? e.target.value : r)))}
                    placeholder="Upload a file, or paste a URL"
                  />
                  <div className="flex gap-2">
                    <FileUpload
                      label={src ? 'Replace' : 'Upload'}
                      accept="image/*"
                      onUploaded={(f) =>
                        setImages(images.map((r, idx) => (idx === i ? f[0].url : r)))
                      }
                    />
                    {src && (
                      <Button
                        type="button"
                        size="sm"
                        onClick={() => setImages(images.map((r, idx) => (idx === i ? '' : r)))}
                      >
                        Clear
                      </Button>
                    )}
                    {i >= IMAGE_SLOTS.length && (
                      <Button
                        type="button"
                        size="sm"
                        variant="danger"
                        onClick={() => setImages(images.filter((_, idx) => idx !== i))}
                      >
                        Remove
                      </Button>
                    )}
                  </div>
                </div>
              </div>
            </Field>
          ))}
        </div>
        <div className="mt-3 flex gap-2">
          <FileUpload
            label="Upload images"
            accept="image/*"
            multiple
            disabled={images.filter(Boolean).length >= MAX_IMAGES}
            onUploaded={(files) => {
              const next = [...images];
              for (const f of files) {
                const empty = next.findIndex((x) => !x);
                if (empty >= 0) next[empty] = f.url;
                else if (next.length < MAX_IMAGES) next.push(f.url);
              }
              setImages(next.slice(0, MAX_IMAGES));
            }}
          />
          <Button
            type="button"
            disabled={images.length >= MAX_IMAGES}
            onClick={() => setImages([...images, ''])}
          >
            + Add image slot
          </Button>
        </div>
        <p className="mt-2 text-xs text-muted-foreground">
          Upload a file or paste a URL. Images are capped at 5 MB each, up to {MAX_IMAGES}.
        </p>
      </Card>

      <Card title="Sales information">
        <label className="mb-3 flex items-center gap-2 text-sm text-foreground">
          <input
            type="checkbox"
            checked={form.isSalesItem}
            onChange={(e) => set({ isSalesItem: e.target.checked })}
          />
          This item is sold to customers
        </label>
        {form.isSalesItem && (
          <div className="grid gap-4 sm:grid-cols-3">
            <Field label="MRP" hint="Maximum retail price, including GST">
              <Input
                type="number" step="0.01" min="0"
                value={form.mrp}
                onChange={(e) => set({ mrp: e.target.value })}
                placeholder="399.00"
              />
            </Field>
            <Field label="Selling price (rate)" hint={sellingHint()}>
              <div className="flex gap-2">
                <Input
                  type="number" step="0.01" min="0"
                  className="min-w-0 flex-1"
                  value={form.sellingPrice}
                  onChange={(e) => set({ sellingPrice: e.target.value })}
                  placeholder="349.00"
                />
                <Select
                  aria-label="Selling price tax"
                  className="shrink-0"
                  value={form.sellingTaxTreatment}
                  onChange={(e) => set({ sellingTaxTreatment: e.target.value })}
                >
                  {TAX_TREATMENTS.map((t) => (
                    <option key={t.value} value={t.value}>{t.label}</option>
                  ))}
                </Select>
              </div>
            </Field>
            <Field label="Default discount" hint="The gap between the MRP and the selling price - shown on sales documents as Off MRP">
              <div className={`flex h-9 items-center rounded-md border border-border bg-muted/40 px-3 text-sm ${defaultDiscount?.above ? 'text-destructive' : 'text-foreground'}`}>
                {defaultDiscount ? defaultDiscount.text : 'Set the MRP and selling price'}
              </div>
            </Field>
            <Field label="Account">
              <ComboSelect
                value={form.salesAccount}
                options={SALES_ACCOUNTS}
                onChange={(v) => set({ salesAccount: v })}
                placeholder="No account"
                addLabel="+ Add new account"
              />
            </Field>
            <Field label="Description">
              <Input
                value={form.salesDescription}
                onChange={(e) => set({ salesDescription: e.target.value })}
              />
            </Field>
          </div>
        )}
      </Card>

      <Card title="Purchase information">
        <label className="mb-3 flex items-center gap-2 text-sm text-foreground">
          <input
            type="checkbox"
            checked={form.isPurchaseItem}
            onChange={(e) => set({ isPurchaseItem: e.target.checked })}
          />
          This item is purchased from vendors
        </label>
        {form.isPurchaseItem && (
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Cost price" hint={costHint()}>
              <div className="flex gap-2">
                <Input
                  type="number" step="0.01" min="0"
                  className="min-w-0 flex-1"
                  value={form.costPrice}
                  onChange={(e) => set({ costPrice: e.target.value })}
                  placeholder="125.00"
                />
                <Select
                  aria-label="Cost price tax"
                  className="shrink-0"
                  value={form.costTaxTreatment}
                  onChange={(e) => set({ costTaxTreatment: e.target.value })}
                >
                  {TAX_TREATMENTS.map((t) => (
                    <option key={t.value} value={t.value}>{t.label}</option>
                  ))}
                </Select>
              </div>
            </Field>
            <Field label="Account">
              <ComboSelect
                value={form.purchaseAccount}
                options={PURCHASE_ACCOUNTS}
                onChange={(v) => set({ purchaseAccount: v })}
                placeholder="No account"
                addLabel="+ Add new account"
              />
            </Field>
            <div className="sm:col-span-2">
              <Field
                label="Other costs"
                hint="Per unit, before GST - label, box, freight, testing. Pick a stock item to take its cost, or type the cost in yourself. Added to the cost price for profit, stock value and margins."
              >
                <div className="space-y-2">
                  {form.otherCosts.map((c, i) => (
                    <div key={i} className="flex flex-wrap gap-2">
                      <CostItemSelect
                        value={c.itemId ?? ''}
                        onPick={(picked) =>
                          setOtherCost(
                            i,
                            picked
                              ? {
                                  itemId: picked.id,
                                  name: picked.name,
                                  amount: costOf(picked) > 0 ? String(costOf(picked)) : c.amount,
                                }
                              : { itemId: undefined }
                          )
                        }
                        className="w-48"
                      />
                      <Input
                        value={c.name}
                        onChange={(e) => setOtherCost(i, { name: e.target.value, itemId: undefined })}
                        placeholder="Label printing"
                        className="min-w-0 flex-1"
                        aria-label={`Other cost ${i + 1} name`}
                      />
                      <Input
                        type="number" step="0.01" min="0"
                        value={c.amount}
                        onChange={(e) => setOtherCost(i, { amount: e.target.value })}
                        placeholder="0.00"
                        className="w-32 text-right"
                        aria-label={`Other cost ${i + 1} amount`}
                      />
                      <Button
                        type="button"
                        size="sm"
                        variant="ghost"
                        aria-label="Remove this cost"
                        onClick={() => set({ otherCosts: form.otherCosts.filter((_, idx) => idx !== i) })}
                      >
                        ×
                      </Button>
                    </div>
                  ))}
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <Button type="button" size="sm" onClick={() => set({ otherCosts: [...form.otherCosts, { name: '', amount: '', itemId: undefined }] })}>
                      + Add a cost
                    </Button>
                    {(cost > 0 || otherCostTotal > 0) && (
                      <span className="text-xs text-muted-foreground">
                        Cost {money(costBeforeTax)} + other costs {money(otherCostTotal)} ={' '}
                        <span className="font-medium text-foreground">final cost {money(finalCost)}</span> per unit
                      </span>
                    )}
                  </div>
                </div>
              </Field>
            </div>
            <Field label="Preferred vendor">
              <Select
                value={form.preferredVendorId}
                onChange={(e) => set({ preferredVendorId: e.target.value })}
                className="w-full"
              >
                <option value="">No preferred vendor</option>
                {vendors.map((v) => (
                  <option key={v.id} value={v.id}>{vendorName(v)}</option>
                ))}
              </Select>
            </Field>
            <Field label="Description">
              <Input
                value={form.purchaseDescription}
                onChange={(e) => set({ purchaseDescription: e.target.value })}
              />
            </Field>
          </div>
        )}
      </Card>

      <Card title="Default tax rates">
        <div className="grid gap-4 sm:grid-cols-2">
          <Field
            label="Intra-state tax rate"
            required={form.taxPreference === 'TAXABLE'}
            hint="Within the same state — CGST + SGST. Fills the inter-state rate too."
          >
            <TaxRateSelect
              type="GST"
              value={form.intraStateTaxRate}
              onChange={(v) =>
                set({
                  intraStateTaxRate: v,
                  ...(form.interStateTaxRate === '' || form.interStateTaxRate === form.intraStateTaxRate
                    ? { interStateTaxRate: v }
                    : {}),
                })
              }
            />
          </Field>
          <Field label="Inter-state tax rate" required={form.taxPreference === 'TAXABLE'} hint="Across states — IGST">
            <TaxRateSelect
              type="IGST"
              value={form.interStateTaxRate}
              onChange={(v) =>
                set({
                  interStateTaxRate: v,
                  ...(form.intraStateTaxRate === '' ? { intraStateTaxRate: v } : {}),
                })
              }
            />
          </Field>
        </div>
        <div className="mt-3 flex flex-wrap items-center gap-3 text-xs">
          <a
            href="/admin/masters"
            target="_blank"
            rel="noreferrer"
            className="text-gold-ink hover:underline"
          >
            &#9881; Manage tax rates
          </a>
          <span className="text-muted-foreground">
            Slabs come from Masters &rarr; Taxes. Add or retire one there and it changes here.
          </span>
        </div>
      </Card>

      <Card title="Inventory">
        {isService ? (
          <p className="text-sm text-muted-foreground">
            A service holds no stock, so there is nothing to track, value or reorder.
          </p>
        ) : (
        <>
        <label className="mb-3 flex items-center gap-2 text-sm text-foreground">
          <input
            type="checkbox"
            checked={form.trackInventory}
            onChange={(e) => set({ trackInventory: e.target.checked })}
          />
          Track inventory for this item
        </label>

        {form.trackInventory && (
          <div className="grid gap-4 sm:grid-cols-3">
            <Field label="Inventory account">
              <ComboSelect
                value={form.inventoryAccount}
                options={INVENTORY_ACCOUNTS}
                onChange={(v) => set({ inventoryAccount: v })}
                placeholder="No account"
                addLabel="+ Add new account"
              />
            </Field>
            <Field label="Valuation method">
              <Select
                value={form.valuationMethod}
                onChange={(e) => set({ valuationMethod: e.target.value })}
                className="w-full"
              >
                <option value="FIFO">FIFO</option>
                <option value="AVERAGE">Weighted average</option>
              </Select>
            </Field>
            <Field label="Reorder point">
              <Input
                type="number" step="0.01" min="0"
                value={form.reorderPoint}
                onChange={(e) => set({ reorderPoint: e.target.value })}
                placeholder="100"
              />
            </Field>

            {mode === 'edit' && (
              <Field
                label="Stock location"
                hint="Changing this moves everything this item holds, recorded as a stock transfer"
              >
                <Select
                  value={form.stockLocationId}
                  onChange={(e) => set({ stockLocationId: e.target.value })}
                  className="w-full"
                >
                  <option value="">No stock yet</option>
                  {locations.map((l) => (
                    <option key={l.id} value={l.id}>
                      {l.code}{l.isDefault ? ' (default)' : ''}
                    </option>
                  ))}
                </Select>
              </Field>
            )}

            {mode === 'create' && (
              <>
                <Field label="Opening stock">
                  <Input
                    type="number" step="0.01" min="0"
                    value={form.openingStock}
                    onChange={(e) => set({ openingStock: e.target.value })}
                    placeholder="0"
                  />
                </Field>
                <Field label="Opening stock value per unit">
                  <Input
                    type="number" step="0.01" min="0"
                    value={form.openingStockValue}
                    onChange={(e) => set({ openingStockValue: e.target.value })}
                    placeholder="0.00"
                  />
                </Field>
                <Field label="Opening stock location">
                  <Select
                    value={form.openingStockLocationId}
                    onChange={(e) => set({ openingStockLocationId: e.target.value })}
                    className="w-full"
                  >
                    {locations.map((l) => (
                      <option key={l.id} value={l.id}>
                        {l.code}{l.isDefault ? ' (default)' : ''}
                      </option>
                    ))}
                  </Select>
                </Field>
              </>
            )}
          </div>
        )}
        {mode === 'edit' && form.trackInventory && (
          <p className="mt-3 text-xs text-muted-foreground">
            Opening stock is set once at creation. Change the quantity afterwards with an inventory
            adjustment so the ledger keeps both sides.
          </p>
        )}
        </>
        )}
      </Card>

      <Card title="Cancellation and returns">
        <span className="mb-1 block text-xs font-medium text-muted-foreground">
          Returnable item
        </span>
        <div className="flex gap-4">
          {([true, false] as const).map((val) => (
            <label key={String(val)} className="flex items-center gap-2 text-sm">
              <input
                type="radio"
                name="isReturnable"
                checked={form.isReturnable === val}
                onChange={() => set({ isReturnable: val })}
              />
              {val ? 'Yes' : 'No'}
            </label>
          ))}
        </div>
      </Card>

      <Card title="Fulfilment details">
        {isService ? (
          <p className="text-sm text-muted-foreground">
            A service is not shipped, so it has no dimensions or weight.
          </p>
        ) : (
        <div className="grid gap-4 sm:grid-cols-4">
          <Field label="Length">
            <Input type="number" step="0.01" min="0" value={form.length}
              onChange={(e) => set({ length: e.target.value })} />
          </Field>
          <Field label="Width">
            <Input type="number" step="0.01" min="0" value={form.width}
              onChange={(e) => set({ width: e.target.value })} />
          </Field>
          <Field label="Height">
            <Input type="number" step="0.01" min="0" value={form.height}
              onChange={(e) => set({ height: e.target.value })} />
          </Field>
          <Field label="Dimension unit">
            <Select value={form.dimensionUnit}
              onChange={(e) => set({ dimensionUnit: e.target.value })} className="w-full">
              <option value="CM">cm</option>
              <option value="IN">in</option>
              <option value="M">m</option>
            </Select>
          </Field>

          <Field label="Weight">
            <Input type="number" step="0.001" min="0" value={form.weight}
              onChange={(e) => set({ weight: e.target.value })} />
          </Field>
          <Field label="Weight unit">
            <Select value={form.weightUnit}
              onChange={(e) => set({ weightUnit: e.target.value })} className="w-full">
              <option value="KG">kg</option>
              <option value="G">g</option>
              <option value="LB">lb</option>
              <option value="OZ">oz</option>
            </Select>
          </Field>
        </div>
        )}
      </Card>
    </div>
  );
}
