'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { api, errorMessage, type Paged, todayIso } from '@/lib/api';
import {
  Button, Card, EmptyRow, ErrorBox, Field, Input, PageHeader,
  Select, Table, Td, Textarea, Th, Spinner,
} from '@/components/ui';
import { ItemSelect } from '@/components/ItemSelect';
import { PageCrumb } from '@/lib/crumbs';
import { SaveBar } from '@/components/form/SaveBar';

type Location = { id: string; name: string; code: string; isDefault: boolean };
type Item = {
  id: string;
  name: string;
  sku: string | null;
  unit: string;
  trackInventory: boolean;
  stock: { available: number; onHand: number };
  imageUrls?: string[];
  locations?: { locationId: string; available: number }[];
};

type LineDraft = { itemId: string; quantitySent: string };

const blankLine = (): LineDraft => ({ itemId: '', quantitySent: '' });

export default function NewTransferPage() {
  const router = useRouter();

  const [locations, setLocations] = useState<Location[]>([]);
  const [items, setItems] = useState<Item[]>([]);
  const [nextNumber, setNextNumber] = useState('');
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  const [form, setForm] = useState({
    locationId: '',
    toLocationId: '',
    referenceNumber: '',
    description: '',
    documentDate: todayIso(),
  });

  const [lines, setLines] = useState<LineDraft[]>([blankLine()]);

  useEffect(() => {
    (async () => {
      try {
        const [l, i, n] = await Promise.all([
          api.get<Paged<Location>>('/locations', { limit: 50 }),
          api.get<Paged<Item>>('/items', { limit: 100 }),
          api.get<{ data: { docNumber: string | null } }>('/inventory/documents/next-number', {
            type: 'TRANSFER',
          }),
        ]);
        setLocations(l.data);
        setItems(i.data.filter((x) => x.trackInventory));
        setNextNumber(n.data.docNumber ?? '');
        const from = l.data.find((x) => x.isDefault) ?? l.data[0];
        const to = l.data.find((x) => x.id !== from?.id);
        setForm((f) => ({ ...f, locationId: from?.id ?? '', toLocationId: to?.id ?? '' }));
      } catch (err) {
        setError(errorMessage(err));
      }
    })();
  }, []);

  function setLine(i: number, patch: Partial<LineDraft>) {
    setLines((rows) => rows.map((r, idx) => (idx === i ? { ...r, ...patch } : r)));
  }

  const itemById = new Map(items.map((i) => [i.id, i]));
  const freeAt = (item: Item | undefined, locationId: string) =>
    Math.max(0, Number(item?.locations?.find((x) => x.locationId === locationId)?.available ?? 0));
  const fromCode = locations.find((l) => l.id === form.locationId)?.code ?? 'the source';

  async function submit(status: 'DRAFT' | 'IN_TRANSIT') {
    setError('');

    const payloadLines = lines
      .filter((l) => l.itemId && Number(l.quantitySent) > 0)
      .map((l) => ({ itemId: l.itemId, quantitySent: Number(l.quantitySent) }));

    if (!form.locationId || !form.toLocationId) {
      setError('Pick where the stock leaves from and where it goes');
      return;
    }
    if (form.locationId === form.toLocationId) {
      setError('The two locations must be different');
      return;
    }
    if (!payloadLines.length) {
      setError('Add at least one item with a quantity to send');
      return;
    }

    setSaving(true);
    try {
      const res = await api.post<{ data: { id: string } }>('/inventory/transfers', {
        locationId: form.locationId,
        toLocationId: form.toLocationId,
        referenceNumber: form.referenceNumber.trim() || undefined,
        description: form.description.trim() || undefined,
        documentDate: form.documentDate,
        status,
        lines: payloadLines,
      });
      router.push(`/admin/inventory/adjustments/${res.data.id}`);
    } catch (err) {
      setError(errorMessage(err));
      setSaving(false);
    }
  }

  return (
    <>
      <PageCrumb label="New transfer" />

      <PageHeader
        title="New stock transfer"
        subtitle={nextNumber ? `Will be numbered ${nextNumber}` : undefined}
      />

      {error && (
        <div className="mb-4">
          <ErrorBox message={error} />
        </div>
      )}

      <div className="space-y-5">
        <Card title="Transfer details">
          <div className="grid gap-4 sm:grid-cols-3">
            <Field label="From" required>
              <Select
                value={form.locationId}
                onChange={(e) => {
                  const locationId = e.target.value;
                  setForm({
                    ...form,
                    locationId,
                    toLocationId:
                      form.toLocationId === locationId
                        ? locations.find((l) => l.id !== locationId)?.id ?? ''
                        : form.toLocationId,
                  });
                }}
                className="w-full"
              >
                {locations.map((l) => (
                  <option key={l.id} value={l.id}>
                    {l.code}
                    {l.isDefault ? ' (default)' : ''}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="To" required>
              <Select
                value={form.toLocationId}
                onChange={(e) => setForm({ ...form, toLocationId: e.target.value })}
                className="w-full"
              >
                {locations.map((l) => (
                  <option key={l.id} value={l.id} disabled={l.id === form.locationId}>
                    {l.code}
                    {l.isDefault ? ' (default)' : ''}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Date">
              <Input
                type="date"
                value={form.documentDate}
                onChange={(e) => setForm({ ...form, documentDate: e.target.value })}
              />
            </Field>
            <Field label="Reference number" hint="A gate pass or courier number, if there is one">
              <Input
                value={form.referenceNumber}
                onChange={(e) => setForm({ ...form, referenceNumber: e.target.value })}
              />
            </Field>
          </div>
          <div className="mt-4">
            <Field label="Description">
              <Textarea
                rows={2}
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
                placeholder="Restocking the secondary warehouse"
              />
            </Field>
          </div>
        </Card>

        <Card
          title="Items"
          padded={false}
          action={
            <Button size="sm" onClick={() => setLines([...lines, blankLine()])}>
              + Add row
            </Button>
          }
        >
          <Table>
            <thead>
              <tr>
                <Th>Item</Th>
                <Th className="text-right">Free at {fromCode}</Th>
                <Th className="text-right">Quantity to send</Th>
                <Th />
              </tr>
            </thead>
            <tbody>
              {lines.length === 0 && <EmptyRow colSpan={4} />}
              {lines.map((l, i) => {
                const item = itemById.get(l.itemId);
                const free = freeAt(item, form.locationId);
                const over = !!item && Number(l.quantitySent) > free;
                return (
                  <tr key={i}>
                    <Td>
                      <ItemSelect
                        value={l.itemId}
                        items={items}
                        onChange={(id) => setLine(i, { itemId: id })}
                        placeholder="Select an item…"
                        className="w-full min-w-[240px]"
                      />
                    </Td>
                    <Td className="text-right text-muted-foreground">
                      {item ? `${free} ${item.unit}` : '—'}
                    </Td>
                    <Td className="text-right">
                      <Input
                        type="number"
                        step="1"
                        min="0"
                        value={l.quantitySent}
                        onChange={(e) => setLine(i, { quantitySent: e.target.value })}
                        placeholder="10"
                        className={`w-28 text-right ${over ? 'border-destructive' : ''}`}
                      />
                      {over && (
                        <div className="mt-1 text-xs text-destructive">
                          Only {free} free to send
                        </div>
                      )}
                    </Td>
                    <Td>
                      {lines.length > 1 && (
                        <Button
                          size="sm"
                          variant="danger"
                          onClick={() => setLines(lines.filter((_, idx) => idx !== i))}
                        >
                          ×
                        </Button>
                      )}
                    </Td>
                  </tr>
                );
              })}
            </tbody>
          </Table>
          <p className="px-4 py-2.5 text-xs text-muted-foreground">
            Free stock is what is on hand less what is held for orders or marked unavailable. Sending
            takes it out of {fromCode} straight away and shows it as incoming at the other end until
            it is received.
          </p>
        </Card>
      </div>
      <SaveBar>
        <Link href="/admin/inventory/adjustments">
          <Button type="button">Cancel</Button>
        </Link>
        <Button type="button" disabled={saving} onClick={() => submit('DRAFT')}>
          Save as draft
        </Button>
        <Button type="button" variant="success" disabled={saving} onClick={() => submit('IN_TRANSIT')}>
          {saving && <Spinner className="border-card/40 border-t-card" />}
          Send now
        </Button>
      </SaveBar>
    </>
  );
}
