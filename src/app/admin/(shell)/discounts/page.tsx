'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { api, money, shortDate, errorMessage, type Paged, todayIso, currencySymbol } from '@/lib/api';
import { useToast } from '@/lib/toast';
import { Modal, ConfirmModal } from '@/components/Modal';
import {
  Badge, Button, Card, EmptyRow, ErrorBox, Field, Input, Loading,
  PageHeader, Pagination, Select, Spinner, StatCard, Table, Td, Th,
} from '@/components/ui';
import { Thumb } from '@/components/SearchSelect';

import { CardList, RecordCard } from '@/components/CardList';
type DiscountType = 'PERCENTAGE' | 'FIXED_AMOUNT' | 'FREE_SHIPPING' | 'BUY_X_GET_Y';
type AppliesTo = 'ALL' | 'PRODUCTS' | 'COLLECTIONS' | 'VARIANTS' | 'ITEMS';

const TARGET_NOUN: Record<Exclude<AppliesTo, 'ALL'>, string> = {
  PRODUCTS: 'product',
  COLLECTIONS: 'collection',
  VARIANTS: 'variant',
  ITEMS: 'item',
};
type Eligibility = 'ALL' | 'D2C_ONLY' | 'B2B_ONLY' | 'SPECIFIC';

type Discount = {
  id: string;
  code: string | null;
  isAutomatic: boolean;
  title: string;
  type: DiscountType;
  value: string;
  appliesTo: AppliesTo;
  targetIds: string[];
  minimumSubtotal: string | null;
  minimumQuantity: number | null;
  usageLimit: number | null;
  usageLimitPerCustomer: number | null;
  usedCount: number;
  customerEligibility: Eligibility;
  eligibleCustomerIds: string[];
  startsAt: string;
  endsAt: string | null;
  isActive: boolean;
  isExpired: boolean;
  isScheduled: boolean;
  isExhausted: boolean;
};

type Pick = { id: string; label: string; imageUrl?: string | null };

const TYPE_LABEL: Record<DiscountType, string> = {
  PERCENTAGE: 'Percentage off',
  FIXED_AMOUNT: 'Fixed amount off',
  FREE_SHIPPING: 'Free shipping',
  BUY_X_GET_Y: 'Buy X get Y',
};

const ELIGIBILITY_LABEL: Record<Eligibility, string> = {
  ALL: 'Everyone',
  D2C_ONLY: 'D2C customers only',
  B2B_ONLY: 'B2B customers only',
  SPECIFIC: 'Chosen customers',
};

type FormState = {
  code: string; isAutomatic: boolean; title: string; type: DiscountType; value: string;
  appliesTo: AppliesTo; targetIds: string[];
  minimumSubtotal: string; minimumQuantity: string;
  usageLimit: string; usageLimitPerCustomer: string;
  customerEligibility: Eligibility; eligibleCustomerIds: string[];
  startsAt: string; endsAt: string; isActive: boolean;
};

const today = () => todayIso();

const blank = (): FormState => ({
  code: '', isAutomatic: false, title: '', type: 'PERCENTAGE', value: '',
  appliesTo: 'ALL', targetIds: [],
  minimumSubtotal: '', minimumQuantity: '',
  usageLimit: '', usageLimitPerCustomer: '',
  customerEligibility: 'ALL', eligibleCustomerIds: [],
  startsAt: today(), endsAt: '', isActive: true,
});

function offer(d: Discount) {
  const n = Number(d.value);
  switch (d.type) {
    case 'PERCENTAGE':
      return `${n}% off`;
    case 'FIXED_AMOUNT':
      return `${money(n)} off`;
    case 'FREE_SHIPPING':
      return 'Free shipping';
    case 'BUY_X_GET_Y':
      return `Buy ${n} get 1`;
  }
}

function state(d: Discount): { label: string; tone: 'green' | 'gray' | 'amber' | 'red' | 'blue' } {
  if (!d.isActive) return { label: 'Off', tone: 'gray' };
  if (d.isExpired) return { label: 'Expired', tone: 'red' };
  if (d.isScheduled) return { label: 'Scheduled', tone: 'blue' };
  if (d.isExhausted) return { label: 'Used up', tone: 'amber' };
  return { label: 'Live', tone: 'green' };
}

function Picker({
  options,
  chosen,
  onToggle,
  emptyLabel,
}: {
  options: Pick[];
  chosen: string[];
  onToggle: (id: string) => void;
  emptyLabel: string;
}) {
  const [filter, setFilter] = useState('');
  const shown = useMemo(() => {
    const q = filter.trim().toLowerCase();
    return q ? options.filter((o) => o.label.toLowerCase().includes(q)) : options;
  }, [options, filter]);

  return (
    <div className="rounded-md border border-border">
      <div className="border-b border-border p-2">
        <Input
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          placeholder="Filter…"
          className="text-xs"
        />
      </div>
      <div className="max-h-44 overflow-y-auto p-2">
        {shown.length === 0 && (
          <p className="py-3 text-center text-xs text-muted-foreground">
            {emptyLabel}
          </p>
        )}
        {shown.map((o) => (
          <label
            key={o.id}
            className="flex cursor-pointer items-center gap-2 rounded px-1 py-1 text-sm
              text-foreground hover:bg-muted/60"
          >
            <input
              type="checkbox"
              checked={chosen.includes(o.id)}
              onChange={() => onToggle(o.id)}
            />
            {o.imageUrl !== undefined && <Thumb url={o.imageUrl} label={o.label} />}
            <span className="truncate">{o.label}</span>
          </label>
        ))}
      </div>
      <div className="border-t border-border px-2 py-1.5 text-[11px] text-muted-foreground">
        {chosen.length} selected
      </div>
    </div>
  );
}

export default function DiscountsPage() {
  const toast = useToast();

  const [rows, setRows] = useState<Discount[]>([]);
  const [meta, setMeta] = useState({ page: 1, totalPages: 1, total: 0 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const [search, setSearch] = useState('');
  const [activeFilter, setActiveFilter] = useState('');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);

  const [open, setOpen] = useState(false);
  const [editingId, setEditingId] = useState('');
  const [form, setFormState] = useState<FormState>(blank());
  const [formError, setFormError] = useState('');
  const [saving, setSaving] = useState(false);

  const [confirming, setConfirming] = useState<Discount | null>(null);
  const [busy, setBusy] = useState(false);

  const [products, setProducts] = useState<Pick[]>([]);
  const [collections, setCollections] = useState<Pick[]>([]);
  const [variantPicks, setVariantPicks] = useState<Pick[]>([]);
  const [itemPicks, setItemPicks] = useState<Pick[]>([]);
  const [customers, setCustomers] = useState<Pick[]>([]);

  const set = (patch: Partial<FormState>) => setFormState((f) => ({ ...f, ...patch }));

  const load = useCallback(async () => {
    setError('');
    try {
      const res = await api.get<Paged<Discount>>('/sales/discounts', {
        page,
        limit: pageSize,
        search: search || undefined,
        isActive: activeFilter || undefined,
      });
      setRows(res.data);
      setMeta({ page: res.meta.page, totalPages: res.meta.totalPages, total: res.meta.total });
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setLoading(false);
    }
  }, [page, search, activeFilter, pageSize]);

  useEffect(() => {
    const t = setTimeout(load, search ? 300 : 0);
    return () => clearTimeout(t);
  }, [load, search]);

  const loadPickers = useCallback(async () => {
    try {
      const [p, c, cu, it] = await Promise.all([
        api.get<
          Paged<{
            id: string;
            title: string;
            media?: { url: string }[];
            variants?: { id: string; title: string; sku: string | null; imageUrl?: string | null }[];
          }>
        >('/products', {
          limit: 100,
        }),
        api.get<Paged<{ id: string; title: string }>>('/collections', { limit: 100 }),
        api.get<Paged<{ id: string; displayName: string | null; email: string | null }>>(
          '/customers',
          { limit: 100 }
        ),
        api
          .get<Paged<{ id: string; name: string; sku: string | null; imageUrls?: string[] }>>('/items', { limit: 100 })
          .catch(() => ({ data: [] as { id: string; name: string; sku: string | null; imageUrls?: string[] }[] })),
      ]);
      setVariantPicks(
        p.data.flatMap((x) =>
          (x.variants ?? []).map((v) => ({
            id: v.id,
            label: `${x.title} - ${v.title}${v.sku ? ` (${v.sku})` : ''}`,
            imageUrl: v.imageUrl ?? x.media?.[0]?.url ?? null,
          }))
        )
      );
      setItemPicks(
        it.data.map((x) => ({ id: x.id, label: `${x.name}${x.sku ? ` (${x.sku})` : ''}`, imageUrl: x.imageUrls?.[0] ?? null }))
      );
      setProducts(p.data.map((x) => ({ id: x.id, label: x.title, imageUrl: x.media?.[0]?.url ?? null })));
      setCollections(c.data.map((x) => ({ id: x.id, label: x.title })));
      setCustomers(
        cu.data.map((x) => ({ id: x.id, label: x.displayName ?? x.email ?? x.id }))
      );
    } catch {
    }
  }, []);

  function startCreate() {
    setEditingId('');
    setFormState(blank());
    setFormError('');
    setOpen(true);
    loadPickers();
  }

  const startEdit = useCallback((d: Discount) => {
    setEditingId(d.id);
    setFormState({
      code: d.code ?? '',
      isAutomatic: d.isAutomatic,
      title: d.title,
      type: d.type,
      value: String(Number(d.value)),
      appliesTo: d.appliesTo,
      targetIds: d.targetIds,
      minimumSubtotal: d.minimumSubtotal ? String(Number(d.minimumSubtotal)) : '',
      minimumQuantity: d.minimumQuantity ? String(d.minimumQuantity) : '',
      usageLimit: d.usageLimit ? String(d.usageLimit) : '',
      usageLimitPerCustomer: d.usageLimitPerCustomer ? String(d.usageLimitPerCustomer) : '',
      customerEligibility: d.customerEligibility,
      eligibleCustomerIds: d.eligibleCustomerIds,
      startsAt: d.startsAt.slice(0, 10),
      endsAt: d.endsAt ? d.endsAt.slice(0, 10) : '',
      isActive: d.isActive,
    });
    setFormError('');
    setOpen(true);
    loadPickers();
  }, [loadPickers]);

  useEffect(() => {
    const wanted = new URLSearchParams(window.location.search).get('edit');
    const row = wanted ? rows.find((r) => r.id === wanted) : undefined;
    if (!row) return;
    const t = setTimeout(() => {
      startEdit(row);
      const url = new URL(window.location.href);
      url.searchParams.delete('edit');
      window.history.replaceState(null, '', url.toString());
    }, 0);
    return () => clearTimeout(t);
  }, [rows, startEdit]);

  function toggleTarget(id: string) {
    setFormState((f) => ({
      ...f,
      targetIds: f.targetIds.includes(id)
        ? f.targetIds.filter((x) => x !== id)
        : [...f.targetIds, id],
    }));
  }

  function toggleCustomer(id: string) {
    setFormState((f) => ({
      ...f,
      eligibleCustomerIds: f.eligibleCustomerIds.includes(id)
        ? f.eligibleCustomerIds.filter((x) => x !== id)
        : [...f.eligibleCustomerIds, id],
    }));
  }

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setFormError('');

    if (!form.isAutomatic && form.code.trim().length < 3) {
      setFormError('A manual discount needs a code of at least 3 characters');
      return;
    }
    if (form.type === 'PERCENTAGE' && Number(form.value) > 100) {
      setFormError('A percentage discount cannot exceed 100');
      return;
    }
    if (form.appliesTo !== 'ALL' && form.targetIds.length === 0) {
      setFormError('Pick at least one product or collection for this discount');
      return;
    }
    if (form.customerEligibility === 'SPECIFIC' && form.eligibleCustomerIds.length === 0) {
      setFormError('Pick at least one customer, or open it up to everyone');
      return;
    }

    const payload = {
      code: form.isAutomatic ? null : form.code.trim().toUpperCase(),
      isAutomatic: form.isAutomatic,
      title: form.title.trim(),
      type: form.type,
      value: Number(form.value) || 0,
      appliesTo: form.appliesTo,
      targetIds: form.appliesTo === 'ALL' ? [] : form.targetIds,
      minimumSubtotal: form.minimumSubtotal ? Number(form.minimumSubtotal) : undefined,
      minimumQuantity: form.minimumQuantity ? Number(form.minimumQuantity) : undefined,
      usageLimit: form.usageLimit ? Number(form.usageLimit) : undefined,
      usageLimitPerCustomer: form.usageLimitPerCustomer
        ? Number(form.usageLimitPerCustomer)
        : undefined,
      customerEligibility: form.customerEligibility,
      eligibleCustomerIds:
        form.customerEligibility === 'SPECIFIC' ? form.eligibleCustomerIds : [],
      startsAt: form.startsAt || today(),
      endsAt: form.endsAt || undefined,
      isActive: form.isActive,
    };

    setSaving(true);
    try {
      if (editingId) {
        await api.patch(`/sales/discounts/${editingId}`, payload);
        toast.success(`${payload.code ?? payload.title} updated`);
      } else {
        await api.post('/sales/discounts', payload);
        toast.success(`${payload.code ?? payload.title} created`);
      }
      setOpen(false);
      await load();
    } catch (err) {
      setFormError(errorMessage(err));
    } finally {
      setSaving(false);
    }
  }

  async function remove() {
    if (!confirming) return;
    setBusy(true);
    try {
      await api.del(`/sales/discounts/${confirming.id}`);
      toast.success(`${confirming.code ?? confirming.title} deleted`);
      setConfirming(null);
      await load();
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  const live = rows.filter((d) => state(d).label === 'Live').length;
  const scheduled = rows.filter((d) => d.isScheduled && d.isActive).length;
  const redeemed = rows.reduce((n, d) => n + d.usedCount, 0);

  const targetOptions =
    form.appliesTo === 'COLLECTIONS'
      ? collections
      : form.appliesTo === 'VARIANTS'
        ? variantPicks
        : form.appliesTo === 'ITEMS'
          ? itemPicks
          : products;

  return (
    <>
      <PageHeader
        title="Discounts"
        subtitle="Codes customers type at checkout, and the rules that decide whether they work"
        actions={
          <Button variant="primary" onClick={startCreate}>
            + New discount
          </Button>
        }
      />

      {error && (
        <div className="mb-4">
          <ErrorBox message={error} onRetry={load} />
        </div>
      )}

      <div className="mb-5 grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard label="Codes" value={meta.total} />
        <StatCard label="Live now" value={live} tone="green" />
        <StatCard label="Scheduled" value={scheduled} tone="blue" />
        <StatCard label="Times redeemed" value={redeemed} tone="purple" />
      </div>

      <Card padded={false}>
        <div className="flex flex-wrap items-center gap-2 border-b border-border p-3">
          <Input
            placeholder="Search code or title…"
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
            className="max-w-xs"
          />
          <Select
            value={activeFilter}
            onChange={(e) => {
              setActiveFilter(e.target.value);
              setPage(1);
            }}
          >
            <option value="">On and off</option>
            <option value="true">Switched on</option>
            <option value="false">Switched off</option>
          </Select>
        </div>

        {loading ? (
          <Loading label="Loading discounts…" />
        ) : (
          <>
            <CardList empty="No discount codes yet — create the first one">
              {rows.map((d) => {
                const s = state(d);
                return (
                  <RecordCard
                    key={d.id}
                    href={`/admin/discounts/${d.id}`}
                    title={d.isAutomatic ? 'Automatic' : d.code}
                    mono={!d.isAutomatic}
                    amount={offer(d)}
                    date={d.title}
                    primary={
                      d.appliesTo === 'ALL'
                        ? 'Everything'
                        : `${d.targetIds.length} ${TARGET_NOUN[d.appliesTo]}${d.targetIds.length === 1 ? '' : 's'}`
                    }
                    secondary={[
                      d.minimumSubtotal ? `over ${money(d.minimumSubtotal)}` : null,
                      d.customerEligibility === 'SPECIFIC'
                        ? `${d.eligibleCustomerIds.length} customer${
                            d.eligibleCustomerIds.length === 1 ? '' : 's'
                          }`
                        : ELIGIBILITY_LABEL[d.customerEligibility],
                    ]
                      .filter(Boolean)
                      .join(' · ')}
                    footer={`${shortDate(d.startsAt)} ${
                      d.endsAt ? `to ${shortDate(d.endsAt)}` : '— no end date'
                    } · used ${d.usedCount}${d.usageLimit != null ? `/${d.usageLimit}` : ''}`}
                    badges={
                      <>
                        <Badge tone={s.tone}>{s.label}</Badge>
                        {d.isAutomatic && <Badge tone="blue">automatic</Badge>}
                      </>
                    }
                    actions={
                      <>
                        <Button size="sm" onClick={() => startEdit(d)}>
                          Edit
                        </Button>
                        <Button size="sm" variant="danger" onClick={() => setConfirming(d)}>
                          Delete
                        </Button>
                      </>
                    }
                  />
                );
              })}
            </CardList>

            <div className="hidden md:block">
            <Table minWidth="820px">
              <thead>
                <tr>
                  <Th>Code</Th>
                  <Th>Offer</Th>
                  <Th>Applies to</Th>
                  <Th>Who</Th>
                  <Th>Window</Th>
                  <Th className="text-right">Used</Th>
                  <Th>Status</Th>
                  <Th />
                </tr>
              </thead>
              <tbody>
                {rows.length === 0 && (
                  <EmptyRow colSpan={8} message="No discount codes yet — create the first one" />
                )}
                {rows.map((d) => {
                  const s = state(d);
                  return (
                    <tr key={d.id}>
                      <Td>
                        <Link href={`/admin/discounts/${d.id}`} className="hover:underline">
                          {d.isAutomatic ? (
                            <Badge tone="blue">automatic</Badge>
                          ) : (
                            <span className="font-mono font-medium text-gold-ink">
                              {d.code}
                            </span>
                          )}
                          <div className="text-xs text-muted-foreground">{d.title}</div>
                        </Link>
                      </Td>
                      <Td className="whitespace-nowrap">{offer(d)}</Td>
                      <Td className="text-xs">
                        {d.appliesTo === 'ALL'
                          ? 'Everything'
                          : `${d.targetIds.length} ${TARGET_NOUN[d.appliesTo]}${d.targetIds.length === 1 ? '' : 's'}`}
                        {d.minimumSubtotal && (
                          <div className="text-muted-foreground">
                            over {money(d.minimumSubtotal)}
                          </div>
                        )}
                      </Td>
                      <Td className="text-xs">
                        {d.customerEligibility === 'SPECIFIC'
                          ? `${d.eligibleCustomerIds.length} customer${d.eligibleCustomerIds.length === 1 ? '' : 's'}`
                          : ELIGIBILITY_LABEL[d.customerEligibility]}
                      </Td>
                      <Td className="whitespace-nowrap text-xs text-muted-foreground">
                        {shortDate(d.startsAt)}
                        <div>{d.endsAt ? `to ${shortDate(d.endsAt)}` : 'no end date'}</div>
                      </Td>
                      <Td className="text-right text-xs">
                        {d.usedCount}
                        {d.usageLimit != null && (
                          <span className="text-muted-foreground">
                            {' / '}
                            {d.usageLimit}
                          </span>
                        )}
                      </Td>
                      <Td>
                        <Badge tone={s.tone}>{s.label}</Badge>
                      </Td>
                      <Td>
                        <div className="flex justify-end gap-1.5">
                          <Button size="sm" onClick={() => startEdit(d)}>
                            Edit
                          </Button>
                          <Button size="sm" variant="danger" onClick={() => setConfirming(d)}>
                            Delete
                          </Button>
                        </div>
                      </Td>
                    </tr>
                  );
                })}
              </tbody>
            </Table>
            </div>
            <Pagination
              pageSize={pageSize}
              onPageSize={(n) => {
                setPageSize(n);
                setPage(1);
              }}
              page={meta.page}
              totalPages={meta.totalPages}
              total={meta.total}
              onPage={setPage}
            />
          </>
        )}
      </Card>

      <p className="mt-3 max-w-3xl text-xs text-muted-foreground">
        An automatic discount applies itself to any order that qualifies, with nothing typed. Where
        several qualify the customer gets the largest. A typed code always wins over an automatic
        one — someone who entered a code expects that code, not whatever the shop was running.
      </p>
      <p className="mt-2 max-w-3xl text-xs text-muted-foreground">
        A code has to clear every rule set on it — the window, the minimum, the usage caps and who
        is eligible. The storefront checks all of them before the discount lands on the cart, so a
        code that looks live here can still be refused for a customer who does not qualify.
      </p>

      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title={editingId ? `Edit ${form.code || form.title}` : 'New discount'}
        width="max-w-3xl"
        footer={
          <>
            <Button type="button" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" form="discount-form" variant="primary" disabled={saving}>
              {saving && <Spinner className="border-card/40 border-t-card" />}
              {editingId ? 'Save changes' : 'Create discount'}
            </Button>
          </>
        }
      >
        {formError && (
          <div className="mb-4">
            <ErrorBox message={formError} />
          </div>
        )}

        <form id="discount-form" onSubmit={save} className="space-y-5">
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-2">
              <Field
                label="Code"
                required={!form.isAutomatic}
                hint={
                  form.isAutomatic
                    ? 'Not used — an automatic discount applies on its own'
                    : 'What the customer types — letters, numbers, - and _'
                }
              >
                <Input
                  value={form.isAutomatic ? '' : form.code}
                  onChange={(e) => set({ code: e.target.value.toUpperCase().replace(/[^A-Z0-9_-]/g, '') })}
                  placeholder={form.isAutomatic ? 'No code needed' : 'DIWALI10'}
                  className="font-mono"
                  disabled={form.isAutomatic}
                  required={!form.isAutomatic}
                />
              </Field>
              <label className="flex items-center gap-2 text-sm text-foreground">
                <input
                  type="checkbox"
                  checked={form.isAutomatic}
                  onChange={(e) => set({ isAutomatic: e.target.checked })}
                />
                Apply automatically, with no code
              </label>
            </div>
            <Field label="Title" required hint="For your own reference, not shown at checkout">
              <Input
                value={form.title}
                onChange={(e) => set({ title: e.target.value })}
                placeholder="Diwali 2026 — 10% off everything"
                required
              />
            </Field>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Type">
              <Select
                value={form.type}
                onChange={(e) => set({ type: e.target.value as DiscountType })}
                className="w-full"
              >
                {(Object.keys(TYPE_LABEL) as DiscountType[]).map((t) => (
                  <option key={t} value={t}>
                    {TYPE_LABEL[t]}
                  </option>
                ))}
              </Select>
            </Field>
            <Field
              label={
                form.type === 'PERCENTAGE'
                  ? 'Percent off'
                  : form.type === 'FIXED_AMOUNT'
                    ? `Amount off (${currencySymbol()})`
                    : form.type === 'BUY_X_GET_Y'
                      ? 'Quantity to buy'
                      : 'Value'
              }
              hint={form.type === 'FREE_SHIPPING' ? 'Not used for free shipping' : undefined}
            >
              <Input
                type="number"
                min={0}
                max={form.type === 'PERCENTAGE' ? 100 : undefined}
                step="0.01"
                value={form.value}
                onChange={(e) => set({ value: e.target.value })}
                disabled={form.type === 'FREE_SHIPPING'}
              />
            </Field>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-3">
              <Field label="Applies to">
                <Select
                  value={form.appliesTo}
                  onChange={(e) => set({ appliesTo: e.target.value as AppliesTo, targetIds: [] })}
                  className="w-full"
                >
                  <option value="ALL">Everything in the catalogue</option>
                  <option value="PRODUCTS">Chosen products</option>
                  <option value="VARIANTS">Chosen variants (flavours, packs)</option>
                  <option value="ITEMS">Chosen items</option>
                  <option value="COLLECTIONS">Chosen collections</option>
                </Select>
              </Field>
              {form.appliesTo !== 'ALL' && (
                <Picker
                  options={targetOptions}
                  chosen={form.targetIds}
                  onToggle={toggleTarget}
                  emptyLabel={`No ${TARGET_NOUN[form.appliesTo]}s found`}
                />
              )}
            </div>

            <div className="space-y-3">
              <Field label="Who can use it">
                <Select
                  value={form.customerEligibility}
                  onChange={(e) =>
                    set({
                      customerEligibility: e.target.value as Eligibility,
                      eligibleCustomerIds: [],
                    })
                  }
                  className="w-full"
                >
                  {(Object.keys(ELIGIBILITY_LABEL) as Eligibility[]).map((k) => (
                    <option key={k} value={k}>
                      {ELIGIBILITY_LABEL[k]}
                    </option>
                  ))}
                </Select>
              </Field>
              {form.customerEligibility === 'SPECIFIC' && (
                <Picker
                  options={customers}
                  chosen={form.eligibleCustomerIds}
                  onToggle={toggleCustomer}
                  emptyLabel="No customers found"
                />
              )}
            </div>
          </div>

          <div>
            <h3 className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Conditions
            </h3>
            <div className="grid gap-3 sm:grid-cols-4">
              <Field label={`Minimum subtotal (${currencySymbol()})`}>
                <Input
                  type="number"
                  min={0}
                  value={form.minimumSubtotal}
                  onChange={(e) => set({ minimumSubtotal: e.target.value })}
                  placeholder="Any"
                />
              </Field>
              <Field label="Minimum quantity">
                <Input
                  type="number"
                  min={1}
                  value={form.minimumQuantity}
                  onChange={(e) => set({ minimumQuantity: e.target.value })}
                  placeholder="Any"
                />
              </Field>
              <Field label="Total uses">
                <Input
                  type="number"
                  min={1}
                  value={form.usageLimit}
                  onChange={(e) => set({ usageLimit: e.target.value })}
                  placeholder="Unlimited"
                />
              </Field>
              <Field label="Uses per customer">
                <Input
                  type="number"
                  min={1}
                  value={form.usageLimitPerCustomer}
                  onChange={(e) => set({ usageLimitPerCustomer: e.target.value })}
                  placeholder="Unlimited"
                />
              </Field>
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Starts on">
              <Input
                type="date"
                value={form.startsAt}
                onChange={(e) => set({ startsAt: e.target.value })}
              />
            </Field>
            <Field label="Ends on" hint="Leave blank to run until you switch it off">
              <Input
                type="date"
                min={form.startsAt || undefined}
                value={form.endsAt}
                onChange={(e) => set({ endsAt: e.target.value })}
              />
            </Field>
          </div>

          <label className="flex items-center gap-2 text-sm text-foreground">
            <input
              type="checkbox"
              checked={form.isActive}
              onChange={(e) => set({ isActive: e.target.checked })}
            />
            Switched on
          </label>
        </form>

      </Modal>

      <ConfirmModal
        open={Boolean(confirming)}
        onClose={() => setConfirming(null)}
        onConfirm={remove}
        busy={busy}
        title="Delete this discount?"
        confirmLabel="Delete"
        message={
          confirming ? (
            <>
              <span className="font-mono">{confirming.code}</span> has been used{' '}
              {confirming.usedCount} time{confirming.usedCount === 1 ? '' : 's'}. Orders that
              already used it keep the discount they were given — only the code stops working.
            </>
          ) : (
            ''
          )
        }
      />
    </>
  );
}
