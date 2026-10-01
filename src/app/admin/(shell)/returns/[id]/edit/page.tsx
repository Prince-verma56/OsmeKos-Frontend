'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { api, money, errorMessage, type Paged } from '@/lib/api';
import { ComboSelect } from '@/components/ComboSelect';
import {
  Button, Card, EmptyRow, ErrorBox, Field, Input, Loading, PageHeader,
  Select, Table, Td, Textarea, Th, Spinner,
} from '@/components/ui';
import { SaveBar } from '@/components/form/SaveBar';
import { PageCrumb } from '@/lib/crumbs';

type Location = { id: string; name: string; isDefault: boolean };

type ReturnLine = {
  id: string;
  quantity: number;
  quantityAccepted: number;
  restock: boolean;
  condition: string | null;
  orderLine: {
    id: string; name: string; variantTitle: string | null; sku: string | null;
    quantity: number; quantityFulfilled: number; quantityReturned: number;
    unitPrice: string;
  } | null;
};

type SalesReturn = {
  id: string;
  returnNumber: string;
  status: string;
  reason: string | null;
  notes: string | null;
  locationId: string | null;
  creditOnly: boolean;
  restocked: boolean;
  createdAt: string;
  order: { id: string; orderNumber: string } | null;
  lines: ReturnLine[];
  creditNotes: { id: string; creditNumber: string }[];
};

export default function EditSalesReturnPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();

  const [doc, setDoc] = useState<SalesReturn | null>(null);
  const [locations, setLocations] = useState<Location[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const [form, setForm] = useState({
    returnDate: '',
    reason: '',
    notes: '',
    locationId: '',
    creditOnly: false,
  });
  const set = (patch: Partial<typeof form>) => setForm((f) => ({ ...f, ...patch }));

  const [qty, setQty] = useState<Record<string, string>>({});

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        const [res, loc] = await Promise.all([
          api.get<{ data: SalesReturn }>(`/returns/${id}`),
          api.get<Paged<Location>>('/locations', { limit: 50 }).catch(() => null),
        ]);
        if (cancelled) return;
        const d = res.data;
        setDoc(d);
        setLocations(loc?.data ?? []);
        setForm({
          returnDate: d.createdAt.slice(0, 10),
          reason: d.reason ?? '',
          notes: d.notes ?? '',
          locationId: d.locationId ?? loc?.data.find((l) => l.isDefault)?.id ?? '',
          creditOnly: d.creditOnly,
        });
        setQty(Object.fromEntries(d.lines.map((l) => [l.id, String(l.quantity)])));
        setError('');
      } catch (err) {
        if (!cancelled) setError(errorMessage(err));
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [id]);

  if (loading) return <Loading />;
  if (!doc) return <ErrorBox message={error || 'Return not found'} />;

  const totalItems = doc.lines.reduce((n, l) => n + Number(qty[l.id] || 0), 0);
  const totalValue = doc.lines.reduce(
    (n, l) => n + Number(qty[l.id] || 0) * Number(l.orderLine?.unitPrice ?? 0),
    0
  );

  const credited = doc.creditNotes.length > 0;
  const locked = credited || doc.restocked;

  async function save(approve: boolean) {
    setError('');
    const lines = doc!.lines
      .map((l) => ({ id: l.id, quantity: Number(qty[l.id] || 0) }))
      .filter((l) => l.quantity > 0);

    if (!lines.length) return setError('At least one line needs a return quantity');

    setSaving(true);
    try {
      await api.patch(`/returns/${doc!.id}`, {
        returnDate: form.returnDate,
        reason: form.reason.trim() || null,
        notes: form.notes.trim() || null,
        locationId: form.locationId || null,
        creditOnly: form.creditOnly,
        lines,
      });
      if (approve) {
        await api.post(`/returns/${doc!.id}/status`, { status: 'APPROVED' });
      }
      router.push(`/admin/returns/${doc!.id}`);
    } catch (err) {
      setError(errorMessage(err));
      setSaving(false);
    }
  }

  return (
    <>
      <PageCrumb label="Edit" />

      <PageHeader title={`Edit ${doc.returnNumber}`} />

      {error && <div className="mb-4"><ErrorBox message={error} /></div>}

      {locked && (
        <div className="mb-4 rounded-md border border-warning/30 bg-warning/10 px-3 py-2 text-sm text-warning">
          {credited
            ? `${doc.returnNumber} has been credited — void the credit note before changing it, or GSTR-1 will disagree with the document.`
            : `${doc.returnNumber} has already put stock back. Reverse that before changing the quantities.`}
        </div>
      )}

      <div className="space-y-5">
        <Card>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <Field label="RMA#">
              <Input value={doc.returnNumber} disabled />
            </Field>
            <Field label="Date" required>
              <Input
                type="date"
                value={form.returnDate}
                onChange={(e) => set({ returnDate: e.target.value })}
              />
            </Field>
            <Field label="Sales order">
              <Input value={doc.order?.orderNumber ?? '—'} disabled />
            </Field>

            <Field label="Location" hint="Where the goods come back to">
              <Select
                value={form.locationId}
                onChange={(e) => set({ locationId: e.target.value })}
                className="w-full"
              >
                <option value="">Select a location…</option>
                {locations.map((l) => (
                  <option key={l.id} value={l.id}>{l.name}</option>
                ))}
              </Select>
            </Field>

            <div className="sm:col-span-2">
              <Field label="Reason">
                <ComboSelect
                  value={form.reason}
                  options={['Damaged in transit', 'Wrong item delivered', 'Expired or near expiry', 'Leaking or broken seal', 'Quality issue', 'Ordered by mistake', 'Not delivered on time']}
                  onChange={(reason) => set({ reason })}
                  placeholder="Select a reason"
                  addLabel="+ Another reason"
                  newPlaceholder="Why it came back"
                />
              </Field>
            </div>
          </div>

          <label className="mt-4 flex items-start gap-2 text-sm">
            <input
              type="checkbox"
              className="mt-0.5"
              checked={form.creditOnly}
              onChange={(e) => set({ creditOnly: e.target.checked })}
            />
            <span className="text-foreground">
              This sales return contains credit-only goods
              <span className="mt-0.5 block text-xs text-muted-foreground">
                The customer keeps the goods and you credit them anyway — a damaged carton not
                worth the freight back, or a short-dated batch written off. Nothing returns to
                the shelf.
              </span>
            </span>
          </label>
        </Card>

        <Card padded={false}>
          <Table minWidth="860px">
            <thead>
              <tr>
                <Th>ITEMS &amp; DESCRIPTION</Th>
                <Th className="text-right">SHIPPED / FULFILLED</Th>
                <Th className="text-right">RETURNED</Th>
                <Th className="text-right">RETURN QUANTITY</Th>
              </tr>
            </thead>
            <tbody>
              {doc.lines.length === 0 && <EmptyRow colSpan={4} message="No lines on this return" />}
              {doc.lines.map((l) => (
                <tr key={l.id}>
                  <Td>
                    <div className="font-medium">
                      {[l.orderLine?.name, l.orderLine?.variantTitle].filter(Boolean).join(' - ')}
                    </div>
                    {l.orderLine?.sku && (
                      <div className="text-xs text-muted-foreground">
                        SKU: {l.orderLine.sku}
                      </div>
                    )}
                  </Td>
                  <Td className="text-right">{l.orderLine?.quantityFulfilled ?? 0}</Td>
                  <Td className="text-right">
                    {Math.max(0, (l.orderLine?.quantityReturned ?? 0) - l.quantity)}
                  </Td>
                  <Td>
                    <div className="flex flex-col items-end gap-0.5">
                      <Input
                        type="number" min="1" step="1"
                        value={qty[l.id] ?? ''}
                        onChange={(e) => setQty((q) => ({ ...q, [l.id]: e.target.value }))}
                        className="w-24 text-right"
                        disabled={locked}
                      />
                      <span className="text-[11px] text-muted-foreground">
                        {locations.find((x) => x.id === form.locationId)?.name ?? 'No location'}
                      </span>
                    </div>
                  </Td>
                </tr>
              ))}
            </tbody>
          </Table>
          <div className="flex items-center justify-end gap-6 border-t border-border px-4 py-3 text-sm">
            <span className="text-muted-foreground">
              Total Items : <strong className="text-foreground">{totalItems}</strong>
            </span>
            <span className="text-muted-foreground">
              Value <strong className="text-foreground">{money(totalValue)}</strong>
            </span>
          </div>
        </Card>

        <Card>
          <Field label="Notes" hint="Internal — not shown to the customer">
            <Textarea rows={3} value={form.notes} onChange={(e) => set({ notes: e.target.value })} />
          </Field>
        </Card>
      </div>

      <SaveBar>
        <Button variant="success" onClick={() => save(false)} disabled={saving || locked}>
          {saving && <Spinner className="border-card/40 border-t-card" />}
          Save
        </Button>
        {doc.status === 'REQUESTED' && (
          <Button onClick={() => save(true)} disabled={saving || locked}>
            {saving && <Spinner />}
            Save and Approve
          </Button>
        )}
        <Link href={`/admin/returns/${doc.id}`}>
          <Button variant="ghost">Cancel</Button>
        </Link>
      </SaveBar>
    </>
  );
}
