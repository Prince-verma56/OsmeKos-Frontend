'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { api, money, dateTime, errorMessage, type Paged, todayIso } from '@/lib/api';
import {
  ItemFormFields, itemToForm, itemFormProblem, itemFormToPayload, emptyItemForm, ITEM_CATEGORIES,
  type ItemFacets, type ItemFormValues, type Location, type Vendor,
} from '@/components/ItemForm';
import {
  Badge, Button, Card, EmptyRow, ErrorBox, Field, Input, Loading,
  PageHeader, Select, Table, Td, Th, Spinner,
} from '@/components/ui';
import { SalesSummary, type SalesPoint } from '@/components/SalesSummary';
import { useToast } from '@/lib/toast';
import { PageCrumb } from '@/lib/crumbs';
import { lotStatusOf } from '@/lib/quality';
import { offMrpText } from '@/lib/mrp';
import { priceAs } from '@/lib/items';

type Level = {
  locationId: string;
  onHand: string;
  committed: string;
  unavailable: string;
  incoming: string;
  available: number;
  location: { id: string; name: string; code: string };
};

type Lot = {
  id: string;
  lotNo: string | null;
  batchNo: string | null;
  expiryDate: string | null;
  quantityRemaining: string;
  unitCost: string;
  receivedAt: string;
  status: string;
  sourceType: string | null;
  sourceId: string | null;
  needsLabelling?: boolean;
  labelledAt?: string | null;
};

type Item = {
  id: string;
  name: string;
  sku: string | null;
  itemKind?: { id: string; name: string } | null;
  mrp?: string | null;
  sellingPrice?: string | null;
  sellingTaxTreatment?: string | null;
  costPrice?: string | null;
  costTaxTreatment?: string | null;
  otherCosts?: { name: string; amount: number | string }[] | null;
  intraStateTaxRate?: string | null;
  taxPreference?: string | null;
  unitEconomics?: { batchSize: number; opex: { name: string; amount: number; percentOfPrice?: number | null }[] } | null;
  trackInventory: boolean;
  status: 'ACTIVE' | 'INACTIVE';
  updatedAt: string;
  createdAt: string;
  imageUrls?: string[];
  stock: { onHand: number; committed: number; unavailable: number; available: number; incoming: number };
  locations: Level[];
  lots: Lot[];
  productVariants: {
    id: string;
    title: string;
    sku: string | null;
    price: string;
    product: { id: string; title: string };
  }[];
} & Record<string, unknown>;

type LedgerEntry = {
  id: string;
  movementType: string;
  quantityDelta: string;
  balanceAfter: string;
  unitCost: string | null;
  reason: string | null;
  occurredAt: string;
};

type TxnType =
  | 'SALES_ORDERS'
  | 'PURCHASE_ORDERS'
  | 'PURCHASE_RECEIVES'
  | 'BILLS'
  | 'VENDOR_CREDITS';

type Txn = {
  id: string;
  date: string;
  documentId: string;
  documentNumber: string;
  party: string;
  status: string;
  quantity: number;
  quantityDone: number | null;
  doneLabel: string | null;
  rate: number;
  amount: number;
};

type TxnMeta = { count: number; quantityTotal: number; amountTotal: number };

const TXN_FAMILIES: {
  value: TxnType;
  label: string;
  href: string | null;
  numberHeading: string;
  partyHeading: string;
  statuses: string[];
}[] = [
  {
    value: 'SALES_ORDERS',
    label: 'Sales Orders',
    href: '/admin/orders',
    numberHeading: 'ORDER#',
    partyHeading: 'CUSTOMER',
    statuses: ['DRAFT', 'OPEN', 'CLOSED', 'CANCELLED'],
  },
  {
    value: 'PURCHASE_ORDERS',
    label: 'Purchase Orders',
    href: '/admin/purchase-orders',
    numberHeading: 'PURCHASE ORDER#',
    partyHeading: 'VENDOR NAME',
    statuses: ['DRAFT', 'ISSUED', 'PARTIALLY_RECEIVED', 'RECEIVED', 'CLOSED', 'CANCELLED'],
  },
  {
    value: 'PURCHASE_RECEIVES',
    label: 'Purchase Receives',
    href: '/admin/purchase-receives',
    numberHeading: 'RECEIVE#',
    partyHeading: 'VENDOR NAME',
    statuses: [
      'DRAFT', 'PENDING_APPROVAL', 'APPROVED', 'REJECTED',
      'IN_TRANSIT', 'RECEIVED', 'CANCELLED',
    ],
  },
  {
    value: 'BILLS',
    label: 'Bills',
    href: '/admin/bills',
    numberHeading: 'BILL#',
    partyHeading: 'VENDOR NAME',
    statuses: ['DRAFT', 'OPEN', 'OVERDUE', 'PARTIALLY_PAID', 'PAID', 'VOID'],
  },
  {
    value: 'VENDOR_CREDITS',
    label: 'Vendor Credits',
    href: null,
    numberHeading: 'CREDIT NOTE#',
    partyHeading: 'VENDOR NAME',
    statuses: ['DRAFT', 'OPEN', 'CLOSED', 'VOID'],
  },
];

const titleCase = (v: string) =>
  v.replaceAll('_', ' ').toLowerCase().replace(/\b\w/g, (c) => c.toUpperCase());

const MOVEMENT_TONE: Record<string, 'green' | 'red' | 'blue' | 'gray' | 'amber'> = {
  OPENING_STOCK: 'blue',
  PURCHASE_RECEIVE: 'green',
  SALE: 'red',
  RETURN: 'green',
  ADJUSTMENT: 'amber',
  TRANSFER_IN: 'blue',
  TRANSFER_OUT: 'blue',
  RESERVATION: 'gray',
  RELEASE: 'gray',
  QC_HOLD: 'amber',
  QC_RELEASE: 'green',
  PURCHASE_RETURN: 'red',
  LABELLED: 'green',
  BATCH_BLOCK: 'red',
  BATCH_RELEASE: 'green',
};

const TABS = ['Overview', 'Locations', 'Transactions', 'History'] as const;
type Tab = (typeof TABS)[number];

const show = (v: unknown, fallback = '—') =>
  v === null || v === undefined || v === '' ? fallback : String(v);

const taxLabel = (treatment: string) => (treatment === 'EXCLUSIVE' ? 'tax excluded' : 'tax included');

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex gap-4 py-1.5">
      <dt className="w-44 shrink-0 text-sm text-muted-foreground">{label}</dt>
      <dd className="text-sm text-foreground">{value}</dd>
    </div>
  );
}

function StockLine({ label, value, tone = '' }: { label: string; value: React.ReactNode; tone?: string }) {
  return (
    <div className="flex justify-between py-1 text-sm">
      <span className="text-muted-foreground">{label}</span>
      <span className={`font-medium ${tone}`}>{value}</span>
    </div>
  );
}

export default function ItemDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();

  const [item, setItem] = useState<Item | null>(null);
  const [ledger, setLedger] = useState<LedgerEntry[]>([]);
  const [txns, setTxns] = useState<Txn[]>([]);
  const [sales, setSales] = useState<SalesPoint[]>([]);
  const [salesMeta, setSalesMeta] = useState({ totalQuantity: 0, totalRevenue: 0 });
  const [months, setMonths] = useState(12);
  const [locations, setLocations] = useState<Location[]>([]);
  const [vendors, setVendors] = useState<Vendor[]>([]);
  const [facets, setFacets] = useState<ItemFacets>({ brands: [], manufacturers: [], hsnCodes: [] });

  const [tab, setTab] = useState<Tab>('Overview');
  const [txnType, setTxnType] = useState<TxnType>('SALES_ORDERS');
  const [txnStatus, setTxnStatus] = useState('');
  const [txnMeta, setTxnMeta] = useState<TxnMeta | null>(null);
  const [txnLoading, setTxnLoading] = useState(false);
  const [editing, setEditing] = useState(false);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const toast = useToast();

  const [images, setImages] = useState<string[]>(['', '']);
  const [form, setFormState] = useState<ItemFormValues>(emptyItemForm());
  const setForm = (patch: Partial<ItemFormValues>) => setFormState((f) => ({ ...f, ...patch }));

  const [adj, setAdj] = useState({ locationId: '', mode: 'set', quantity: '', reason: 'MANUAL_CORRECTION' });
  const [adjBusy, setAdjBusy] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setTxnLoading(true);
      try {
        const r = await api.get<{ data: Txn[]; meta: TxnMeta }>(
          `/items/${id}/transactions`,
          { type: txnType, status: txnStatus || undefined }
        );
        if (cancelled) return;
        setTxns(r.data);
        setTxnMeta(r.meta);
      } catch {
        if (cancelled) return;
        setTxns([]);
        setTxnMeta(null);
      } finally {
        if (!cancelled) setTxnLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [id, txnType, txnStatus]);

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const [i, l, loc, ven, fac, sum] = await Promise.all([
        api.get<{ data: Item }>(`/items/${id}`),
        api.get<{ data: LedgerEntry[] }>(`/items/${id}/ledger`, { limit: 100 }),
        api.get<Paged<Location>>('/locations', { limit: 50 }),
        api.get<Paged<Vendor>>('/vendors', { limit: 100 }).catch(() => ({ data: [] as Vendor[] })),
        api.get<{ data: ItemFacets }>('/items/facets'),
        api
          .get<{ data: SalesPoint[]; meta: { totalQuantity: number; totalRevenue: number } }>(
            `/items/${id}/sales-summary`,
            { months }
          )
          .catch(() => null),
      ]);
      setItem(i.data);
      setLedger(l.data);
      setLocations(loc.data);
      setVendors(ven.data);
      setFacets(fac.data);
      if (sum) {
        setSales(sum.data);
        setSalesMeta({ totalQuantity: sum.meta.totalQuantity, totalRevenue: sum.meta.totalRevenue });
      }
      setFormState(itemToForm(i.data));
      setAdj((a) =>
        a.locationId ? a : { ...a, locationId: (loc.data.find((x) => x.isDefault) ?? loc.data[0])?.id ?? '' }
      );
      const urls = Array.isArray(i.data.imageUrls) ? i.data.imageUrls : [];
      setImages(urls.length >= 2 ? urls : [...urls, ...Array(2 - urls.length).fill('')]);
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setLoading(false);
    }
  }, [id, months]);

  useEffect(() => {
    const t = setTimeout(load, 0);
    return () => clearTimeout(t);
  }, [load]);

  function flash(m: string) {
    toast.success(m);
  }

  async function save(e?: React.FormEvent) {
    e?.preventDefault();
    const problem = itemFormProblem(form);
    if (problem) {
      setError(problem);
      return;
    }
    setSaving(true);
    setError('');
    try {
      await api.patch(`/items/${id}`, itemFormToPayload(form, images, false));
      flash('Saved');
      setEditing(false);
      await load();
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setSaving(false);
    }
  }

  async function applyAdjustment() {
    if (adj.quantity === '' || !adj.locationId) return;
    setAdjBusy(true);
    setError('');
    try {
      await api.post('/inventory/adjustments', {
        reason: adj.reason,
        locationId: adj.locationId,
        documentDate: todayIso(),
        status: 'ADJUSTED',
        lines: [
          adj.mode === 'set'
            ? { itemId: id, newQuantityOnHand: Number(adj.quantity) }
            : { itemId: id, quantityAdjusted: Number(adj.quantity) },
        ],
      });
      setAdj((a) => ({ ...a, quantity: '' }));
      flash('Stock adjusted');
      await load();
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setAdjBusy(false);
    }
  }

  async function remove() {
    if (!confirm(`Delete "${item?.name}"?`)) return;
    try {
      await api.del(`/items/${id}`);
      router.push('/admin/items');
    } catch (err) {
      setError(errorMessage(err));
    }
  }

  if (loading) return <Loading />;
  if (!item) return <ErrorBox message={error || 'Item not found'} onRetry={load} />;

  const family = TXN_FAMILIES.find((f) => f.value === txnType) ?? TXN_FAMILIES[0];
  const doneHeading = txns.find((t) => t.doneLabel)?.doneLabel ?? null;
  const showDone = doneHeading !== null;

  const s = item.stock;
  const reorder = form.reorderPoint === '' ? null : Number(form.reorderPoint);
  const low = reorder !== null && s.available <= reorder;

  return (
    <>
      <PageCrumb label={item.name} />

      <PageHeader
        title={item.name}
        subtitle={
          [
            item.sku ?? 'no SKU',
            form.isReturnable ? 'Returnable item' : 'Non-returnable',
            `updated ${dateTime(item.updatedAt)}`,
          ].join(' · ')
        }
        actions={
          <>
            <Badge status={item.status}>{item.status}</Badge>
            {editing ? (
              <>
                <Button
                  type="button"
                  onClick={() => {
                    setEditing(false);
                    setFormState(itemToForm(item));
                  }}
                >
                  Cancel
                </Button>
                <Button type="button" variant="primary" disabled={saving} onClick={() => save()}>
                  {saving && <Spinner className="border-card/40 border-t-card" />}
                  Save
                </Button>
              </>
            ) : (
              <>
                <Button type="button" variant="danger" onClick={remove}>Delete</Button>
                <Link href={`/admin/items/new?duplicate=${item.id}`}>
                  <Button type="button">⧉ Duplicate</Button>
                </Link>
                <Button type="button" variant="primary" onClick={() => setEditing(true)}>
                  Edit
                </Button>
              </>
            )}
          </>
        }
      />

      {error && <div className="mb-4"><ErrorBox message={error} /></div>}

      <div className="mb-5 flex gap-1 border-b border-border">
        {TABS.map((t) => (
          <button
            key={t}
            type="button"
            onClick={() => setTab(t)}
            className={`px-3 py-2 text-sm ${
              tab === t
                ? 'border-b-2 border-gold font-medium text-foreground'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            {t}
          </button>
        ))}
      </div>

      {tab === 'Overview' &&
        (editing ? (
          <form onSubmit={save}>
            <ItemFormFields
              mode="edit"
              itemId={item.id}
              form={form}
              setForm={setForm}
              images={images}
              setImages={setImages}
              locations={locations}
              vendors={vendors}
              facets={facets}
            />
          </form>
        ) : (
          <div className="grid gap-5 lg:grid-cols-3">
            <div className="space-y-5 lg:col-span-2 min-w-0">
              <Card title="Primary details">
                <dl>
                  <Row label="Item name" value={item.name} />
                  <Row
                    label="Kind"
                    value={
                      item.itemKind?.name ??
                      ITEM_CATEGORIES.find((c) => c.value === form.itemCategory)?.label ??
                      '—'
                    }
                  />
                  <Row label="Item type" value={form.hasVariants ? 'Has variants' : 'Single item'} />
                  <Row label="Goods or service" value={form.type === 'SERVICE' ? 'Service' : 'Goods'} />
                  <Row label="SKU" value={<span className="font-mono">{show(item.sku)}</span>} />
                  <Row label="Unit" value={show(form.unit)} />
                  <Row label="Size" value={form.sizeValue && form.sizeUnit ? `${Number(form.sizeValue)} ${form.sizeUnit}` : '—'} />
                  <Row label="Brand" value={show(form.brand)} />
                  <Row label="Manufacturer" value={show(form.manufacturer)} />
                  <Row label="HSN code" value={<span className="font-mono">{show(form.hsnCode)}</span>} />
                  <Row
                    label="Tax preference"
                    value={form.taxPreference.replaceAll('_', ' ').toLowerCase()}
                  />
                  <Row
                    label="Intra state tax rate"
                    value={form.intraStateTaxRate ? `GST ${form.intraStateTaxRate}%` : '—'}
                  />
                  <Row
                    label="Inter state tax rate"
                    value={form.interStateTaxRate ? `IGST ${form.interStateTaxRate}%` : '—'}
                  />
                  <Row label="Inventory account" value={show(form.inventoryAccount)} />
                  <Row
                    label="Inventory valuation"
                    value={form.valuationMethod === 'FIFO' ? 'FIFO (First In First Out)' : 'Weighted average'}
                  />
                  <Row label="Returnable item" value={form.isReturnable ? 'Yes' : 'No'} />
                  <Row label="Description" value={show(form.description)} />
                </dl>
              </Card>

              <Card title="Images">
                {images.filter(Boolean).length === 0 ? (
                  <p className="text-sm text-muted-foreground">
                    No images. Use Edit to add up to 15 — front, rear and others.
                  </p>
                ) : (
                  <div className="flex flex-wrap gap-3">
                    {images.filter(Boolean).map((src, i) => (
                      <div key={src} className="w-28">
                        <div className="flex h-28 w-28 items-center justify-center overflow-hidden rounded-md border border-border bg-muted/60">
                          <img
                            src={src}
                            alt={i === 0 ? 'Front view' : i === 1 ? 'Rear view' : `Image ${i + 1}`}
                            className="h-full w-full object-cover"
                            onError={(e) => {
                              e.currentTarget.style.display = 'none';
                            }}
                          />
                        </div>
                        <div className="mt-1 text-center text-xs text-muted-foreground">
                          {i === 0 ? 'Front view' : i === 1 ? 'Rear view' : `Image ${i + 1}`}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </Card>

              <Card title="Purchase information">
                <dl>
                  <Row
                    label="Cost price"
                    value={form.costPrice ? `${money(form.costPrice)} · ${taxLabel(form.costTaxTreatment)}` : '—'}
                  />
                  {form.otherCosts.length > 0 && (
                    <Row
                      label="Other costs"
                      value={form.otherCosts.map((c) => `${c.name} ${money(c.amount)}`).join(' · ')}
                    />
                  )}
                  {form.costPrice && form.otherCosts.length > 0 && (
                    <Row
                      label="Final cost"
                      value={`${money(
                        priceAs(form.costPrice, form.costTaxTreatment, 'EXCLUSIVE', form.intraStateTaxRate ? Number(form.intraStateTaxRate) : 18) +
                          form.otherCosts.reduce((n, c) => n + Number(c.amount || 0), 0)
                      )} per unit before GST`}
                    />
                  )}
                  <Row label="Purchase account" value={show(form.purchaseAccount)} />
                  <Row label="Description" value={show(form.purchaseDescription)} />
                  <Row
                    label="Preferred vendor"
                    value={show(vendors.find((v) => v.id === form.preferredVendorId)?.displayName)}
                  />
                </dl>
              </Card>

              <Card title="Sales information">
                <dl>
                  <Row label="MRP" value={form.mrp ? money(form.mrp) : '—'} />
                  <Row
                    label="Selling price"
                    value={form.sellingPrice ? `${money(form.sellingPrice)} · ${taxLabel(form.sellingTaxTreatment)}` : '—'}
                  />
                  <Row
                    label="Default discount"
                    value={(() => {
                      const off =
                        form.mrp && form.sellingPrice
                          ? offMrpText(
                              form.mrp,
                              priceAs(form.sellingPrice, form.sellingTaxTreatment, 'INCLUSIVE', form.intraStateTaxRate ? Number(form.intraStateTaxRate) : 18),
                              money
                            )
                          : null;
                      if (!off) return '—';
                      return <span className={off.above ? 'text-destructive' : undefined}>{off.text}</span>;
                    })()}
                  />
                  <Row label="Sales account" value={show(form.salesAccount)} />
                  <Row label="Description" value={show(form.salesDescription)} />
                </dl>
              </Card>

              <Card title="Fulfilment details">
                <dl>
                  <Row
                    label="Dimensions"
                    value={
                      form.length || form.width || form.height
                        ? `${show(form.length, '0')} × ${show(form.width, '0')} × ${show(form.height, '0')} ${form.dimensionUnit.toLowerCase()}`
                        : '—'
                    }
                  />
                  <Row
                    label="Weight"
                    value={form.weight ? `${form.weight} ${form.weightUnit.toLowerCase()}` : '—'}
                  />
                </dl>
              </Card>

              <SalesSummary
                points={sales}
                totalQuantity={salesMeta.totalQuantity}
                totalRevenue={salesMeta.totalRevenue}
                months={months}
                onMonthsChange={setMonths}
              />


              <Card title="Sold as">
                {item.productVariants.length === 0 ? (
                  <p className="text-sm text-muted-foreground">
                    No variant sells this item, so it is warehouse-only stock.
                  </p>
                ) : (
                  <div className="space-y-2 text-sm">
                    {item.productVariants.map((v) => (
                      <div key={v.id}>
                        <Link
                          href={`/admin/products/${v.product.id}/variants/${v.id}`}
                          className="font-medium text-gold-ink hover:underline"
                        >
                          {v.product.title}
                        </Link>
                        <div className="text-xs text-muted-foreground">
                          {v.title} · {money(v.price)}
                        </div>
                      </div>
                    ))}
                    {item.productVariants.length > 1 && (
                      <p className="text-xs text-warning">
                        These variants share one stock pool — selling either moves the same number.
                      </p>
                    )}
                  </div>
                )}
              </Card>
            </div>

            <div className="space-y-5">
              {item.trackInventory ? (
                <>
                  <Card title="Accounting stock">
                    <StockLine label="Opening stock" value={show(form.openingStock, '—')} />
                    <div className="my-2 border-t border-border" />
                    <StockLine label="Stock on hand" value={s.onHand} />
                    <StockLine label="Committed stock" value={s.committed} tone="text-warning " />
                    <StockLine label="Unavailable" value={s.unavailable} tone="text-destructive " />
                    <StockLine
                      label="Available for sale"
                      value={s.available}
                      tone={
                        s.available <= 0
                          ? 'text-destructive'
                          : low
                            ? 'text-warning'
                            : 'text-success'
                      }
                    />
                    <p className="mt-2 text-xs text-muted-foreground">
                      Available = on hand − committed − unavailable. Derived, never stored.
                    </p>
                  </Card>

                  <div className="grid grid-cols-2 gap-3">
                    {[
                      ['To be shipped', s.committed],
                      ['To be received', s.incoming],
                    ].map(([label, val]) => (
                      <div
                        key={label as string}
                        className="rounded-lg border border-border bg-card p-3"
                      >
                        <div className="text-xl font-semibold text-foreground">
                          {val as number}
                        </div>
                        <div className="text-xs text-muted-foreground">{label}</div>
                      </div>
                    ))}
                  </div>

                  <Card title="Reorder point">
                    <p className="text-sm">
                      {reorder === null ? (
                        <span className="text-muted-foreground">Not set</span>
                      ) : (
                        <>
                          {reorder}{' '}
                          {low && (
                            <span className="text-warning">
                              — at or below reorder point
                            </span>
                          )}
                        </>
                      )}
                    </p>
                  </Card>

                  <Card title="Adjust stock">
                    <div className="space-y-3">
                      <Field label="Location">
                        <Select
                          value={adj.locationId}
                          onChange={(e) => setAdj({ ...adj, locationId: e.target.value })}
                          className="w-full"
                        >
                          {locations.map((l) => (
                            <option key={l.id} value={l.id}>
                              {l.code}{l.isDefault ? ' (default)' : ''}
                            </option>
                          ))}
                        </Select>
                      </Field>
                      <Field label="Mode">
                        <Select
                          value={adj.mode}
                          onChange={(e) => setAdj({ ...adj, mode: e.target.value })}
                          className="w-full"
                        >
                          <option value="set">Set new quantity on hand</option>
                          <option value="delta">Adjust by (+/-)</option>
                        </Select>
                      </Field>
                      <Field label="Quantity">
                        <Input
                          type="number"
                          step="0.01"
                          value={adj.quantity}
                          onChange={(e) => setAdj({ ...adj, quantity: e.target.value })}
                          placeholder={adj.mode === 'set' ? '100' : '-10'}
                        />
                      </Field>
                      <Field label="Reason">
                        <Select
                          value={adj.reason}
                          onChange={(e) => setAdj({ ...adj, reason: e.target.value })}
                          className="w-full"
                        >
                          <option value="MANUAL_CORRECTION">Manual correction</option>
                          <option value="GIVEAWAY">Giveaway</option>
                          <option value="SAMPLE">Sample</option>
                          <option value="STOCK_RECEIVED">Stock received</option>
                          <option value="DAMAGED">Damaged</option>
                          <option value="EXPIRED">Expired</option>
                          <option value="STOLEN">Stolen</option>
                          <option value="REVALUATION">Revaluation</option>
                        </Select>
                      </Field>
                      <Button
                        variant="primary"
                        disabled={adjBusy || adj.quantity === ''}
                        onClick={applyAdjustment}
                      >
                        {adjBusy && <Spinner className="border-card/40 border-t-card" />}
                        Post adjustment
                      </Button>
                      <p className="text-xs text-muted-foreground">
                        Posts a real adjustment so the ledger keeps both sides.
                      </p>
                    </div>
                  </Card>
                </>
              ) : (
                <Card title="Inventory">
                  <p className="text-sm text-muted-foreground">
                    Inventory tracking is off for this item, so it holds no stock.
                  </p>
                </Card>
              )}

              {item.lots.length > 0 && (
                <Card title={`Batches (${item.lots.length})`}>
                  <div className="space-y-2">
                    {item.lots.map((l) => (
                      <div
                        key={l.id}
                        className="rounded-md border border-border px-3 py-2 text-sm"
                      >
                        <div className="flex items-center justify-between gap-2">
                          <Link href={`/admin/batches/${l.id}`} className="font-mono font-medium text-gold-ink hover:underline">
                            {l.batchNo ?? l.lotNo ?? 'Unbatched'}
                          </Link>
                          <span className="flex items-center gap-2">
                            {l.status && l.status !== 'AVAILABLE' && (
                              <Badge tone={lotStatusOf(l.status).tone}>{lotStatusOf(l.status).label}</Badge>
                            )}
                            {l.status === 'AVAILABLE' && l.needsLabelling && !l.labelledAt && <Badge tone="amber">Not labelled</Badge>}
                            {Number(l.quantityRemaining)} left
                          </span>
                        </div>
                        <div className="mt-0.5 text-xs text-muted-foreground">
                          {money(l.unitCost)} / unit
                          {l.expiryDate && ` · expires ${dateTime(l.expiryDate).split(',')[0]}`}
                          {l.status === 'PENDING_QC' && l.sourceType === 'purchase_receive' && l.sourceId && (
                            <>
                              {' · '}
                              <Link href={`/admin/purchase-receives/${l.sourceId}/qc/${l.id}`} className="text-gold-ink hover:underline">
                                Inspect
                              </Link>
                            </>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </Card>
              )}
            </div>
          </div>
        ))}

      {tab === 'Locations' && (
        <Card title="Stock locations" padded={false}>
          <Table>
            <thead>
              <tr>
                <Th>Location name</Th>
                <Th className="text-right">Stock on hand</Th>
                <Th className="text-right">Committed stock</Th>
                <Th className="text-right">Unavailable</Th>
                <Th className="text-right">Available for sale</Th>
                <Th className="text-right">Incoming</Th>
              </tr>
            </thead>
            <tbody>
              {item.locations.length === 0 && (
                <EmptyRow colSpan={6} message="This item holds no stock at any location" />
              )}
              {item.locations.map((l) => (
                <tr key={l.locationId}>
                  <Td>
                    <span className="font-medium text-foreground">
                      {l.location.name}
                    </span>
                    <div className="text-xs text-muted-foreground">{l.location.code}</div>
                  </Td>
                  <Td className="text-right">{Number(l.onHand)}</Td>
                  <Td className="text-right">{Number(l.committed)}</Td>
                  <Td className="text-right">{Number(l.unavailable)}</Td>
                  <Td
                    className={`text-right font-medium ${
                      l.available < 0 ? 'text-destructive' : ''
                    }`}
                  >
                    {l.available}
                  </Td>
                  <Td className="text-right">{Number(l.incoming)}</Td>
                </tr>
              ))}
            </tbody>
          </Table>
          <p className="px-4 py-2.5 text-xs text-muted-foreground">
            Locations this item has never held stock at do not appear until a movement creates the row.
          </p>
        </Card>
      )}

      {tab === 'Transactions' && (
        <Card title="Transactions" padded={false}>
          <div className="flex flex-wrap items-center gap-3 border-b border-border p-3">
            <label className="flex items-center gap-2 text-sm text-muted-foreground">
              Filter By:
              <Select
                value={txnType}
                onChange={(e) => {
                  setTxnType(e.target.value as TxnType);
                  setTxnStatus('');
                }}
                className="w-52"
              >
                {TXN_FAMILIES.map((f) => (
                  <option key={f.value} value={f.value}>{f.label}</option>
                ))}
              </Select>
            </label>
            <label className="flex items-center gap-2 text-sm text-muted-foreground">
              Status:
              <Select
                value={txnStatus}
                onChange={(e) => setTxnStatus(e.target.value)}
                className="w-44"
              >
                <option value="">All</option>
                {family.statuses.map((st) => (
                  <option key={st} value={st}>{titleCase(st)}</option>
                ))}
              </Select>
            </label>
            {txnMeta && !txnLoading && (
              <span className="ml-auto text-xs text-muted-foreground">
                {txnMeta.count} row(s) · {txnMeta.quantityTotal} {String(item.unit ?? '')} ·{' '}
                {money(txnMeta.amountTotal)}
              </span>
            )}
          </div>

          {txnLoading ? (
            <Loading />
          ) : (
            <Table minWidth="820px">
              <thead>
                <tr>
                  <Th>DATE</Th>
                  <Th>{family.numberHeading}</Th>
                  <Th>{family.partyHeading}</Th>
                  <Th>STATUS</Th>
                  <Th className="text-right">QUANTITY</Th>
                  {showDone && <Th className="text-right">{doneHeading}</Th>}
                  <Th className="text-right">SELLING PRICE</Th>
                  <Th className="text-right">AMOUNT</Th>
                </tr>
              </thead>
              <tbody>
                {txns.length === 0 && (
                  <EmptyRow
                    colSpan={showDone ? 8 : 7}
                    message={`No ${family.label.toLowerCase()} carry this item`}
                  />
                )}
                {txns.map((t) => (
                  <tr key={t.id} className="hover:bg-muted/60">
                    <Td className="whitespace-nowrap text-xs text-muted-foreground">
                      {dateTime(t.date).split(',')[0]}
                    </Td>
                    <Td>
                      {family.href ? (
                        <Link
                          href={`${family.href}/${t.documentId}`}
                          className="font-mono font-medium text-gold-ink hover:underline"
                        >
                          {t.documentNumber}
                        </Link>
                      ) : (
                        <span className="font-mono font-medium">{t.documentNumber}</span>
                      )}
                    </Td>
                    <Td>{t.party}</Td>
                    <Td>
                      <Badge status={t.status}>{titleCase(t.status)}</Badge>
                    </Td>
                    <Td className="text-right">{t.quantity}</Td>
                    {showDone && (
                      <Td className="text-right text-muted-foreground">
                        {t.quantityDone ?? '—'}
                      </Td>
                    )}
                    <Td className="whitespace-nowrap text-right">{money(t.rate)}</Td>
                    <Td className="whitespace-nowrap text-right font-medium">{money(t.amount)}</Td>
                  </tr>
                ))}
              </tbody>
            </Table>
          )}
        </Card>
      )}

      {tab === 'History' && (
        <Card title="Stock ledger" padded={false}>
          <Table>
            <thead>
              <tr>
                <Th>Date</Th>
                <Th>Movement</Th>
                <Th className="text-right">Change</Th>
                <Th className="text-right">Balance</Th>
                <Th>Details</Th>
              </tr>
            </thead>
            <tbody>
              {ledger.length === 0 && <EmptyRow colSpan={5} message="Nothing has moved yet" />}
              {ledger.map((e) => {
                const delta = Number(e.quantityDelta);
                return (
                  <tr key={e.id}>
                    <Td className="whitespace-nowrap text-xs text-muted-foreground">
                      {dateTime(e.occurredAt)}
                    </Td>
                    <Td>
                      <Badge tone={MOVEMENT_TONE[e.movementType] ?? 'gray'}>
                        {e.movementType.replaceAll('_', ' ')}
                      </Badge>
                    </Td>
                    <Td
                      className={`text-right font-medium ${
                        delta > 0
                          ? 'text-success'
                          : 'text-destructive'
                      }`}
                    >
                      {delta > 0 ? '+' : ''}
                      {delta}
                    </Td>
                    <Td className="text-right">{Number(e.balanceAfter)}</Td>
                    <Td className="text-xs text-muted-foreground">
                      {e.reason ?? '—'}
                      {e.unitCost && (
                        <span className="text-muted-foreground">
                          {' '}· {money(e.unitCost)}/unit
                        </span>
                      )}
                    </Td>
                  </tr>
                );
              })}
            </tbody>
          </Table>
          <p className="px-4 py-2.5 text-xs text-muted-foreground">
            Append-only — entries are never edited, so the balance can always be reconstructed.
          </p>
        </Card>
      )}
    </>
  );
}
