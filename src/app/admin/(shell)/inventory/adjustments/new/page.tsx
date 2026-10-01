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
};

type LineDraft = { itemId: string; newQuantityOnHand: string; quantityAdjusted: string };

const blankLine = (): LineDraft => ({ itemId: '', newQuantityOnHand: '', quantityAdjusted: '' });

export default function NewAdjustmentPage() {
  const router = useRouter();

  const [locations, setLocations] = useState<Location[]>([]);
  const [items, setItems] = useState<Item[]>([]);
  const [nextNumber, setNextNumber] = useState('');
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  const [form, setForm] = useState({
    reason: 'MANUAL_CORRECTION',
    locationId: '',
    referenceNumber: '',
    account: 'Cost of Goods Sold',
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
            type: 'ADJUSTMENT',
          }),
        ]);
        setLocations(l.data);
        setItems(i.data.filter((x) => x.trackInventory));
        setNextNumber(n.data.docNumber ?? '');
        const def = l.data.find((x) => x.isDefault) ?? l.data[0];
        if (def) setForm((f) => ({ ...f, locationId: def.id }));
      } catch (err) {
        setError(errorMessage(err));
      }
    })();
  }, []);

  function setLine(i: number, patch: Partial<LineDraft>) {
    setLines((rows) => rows.map((r, idx) => (idx === i ? { ...r, ...patch } : r)));
  }

  async function submit(status: 'DRAFT' | 'ADJUSTED') {
    setError('');
    setSaving(true);

    const payloadLines = lines
      .filter((l) => l.itemId && (l.newQuantityOnHand !== '' || l.quantityAdjusted !== ''))
      .map((l) =>
        l.quantityAdjusted !== ''
          ? { itemId: l.itemId, quantityAdjusted: Number(l.quantityAdjusted) }
          : { itemId: l.itemId, newQuantityOnHand: Number(l.newQuantityOnHand) }
      );

    if (!payloadLines.length) {
      setError('Add at least one line with a new quantity or an adjustment');
      setSaving(false);
      return;
    }

    try {
      await api.post('/inventory/adjustments', {
        reason: form.reason,
        locationId: form.locationId,
        referenceNumber: form.referenceNumber || undefined,
        account: form.account || undefined,
        description: form.description || undefined,
        documentDate: form.documentDate,
        status,
        lines: payloadLines,
      });
      router.push('/admin/inventory/adjustments');
    } catch (err) {
      setError(errorMessage(err));
      setSaving(false);
    }
  }

  const itemById = new Map(items.map((i) => [i.id, i]));

  return (
    <>
      <PageCrumb label="New adjustment" />

      <PageHeader
        title="New adjustment"
        subtitle={nextNumber ? `Will be numbered ${nextNumber}` : undefined}
      />

      {error && (
        <div className="mb-4">
          <ErrorBox message={error} />
        </div>
      )}

      <div className="space-y-5">
        <Card title="Adjustment details">
          <div className="grid gap-4 sm:grid-cols-3">
            <Field label="Reason" required>
              <Select
                value={form.reason}
                onChange={(e) => setForm({ ...form, reason: e.target.value })}
                className="w-full"
              >
                <option value="MANUAL_CORRECTION">Manual correction</option>
                <option value="GIVEAWAY">Giveaway</option>
                <option value="SAMPLE">Sample</option>
                <option value="REVALUATION">Inventory revaluation</option>
                <option value="DAMAGED">Damaged goods</option>
                <option value="STOCK_RECEIVED">Stock received</option>
                <option value="EXPIRED">Expired stock</option>
                <option value="STOLEN">Stolen goods</option>
              </Select>
            </Field>
            <Field label="Location" required>
              <Select
                value={form.locationId}
                onChange={(e) => setForm({ ...form, locationId: e.target.value })}
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
            <Field label="Date">
              <Input
                type="date"
                value={form.documentDate}
                onChange={(e) => setForm({ ...form, documentDate: e.target.value })}
              />
            </Field>
            <Field label="Reference number">
              <Input
                value={form.referenceNumber}
                onChange={(e) => setForm({ ...form, referenceNumber: e.target.value })}
              />
            </Field>
            <Field label="Account">
              <Select
                value={form.account}
                onChange={(e) => setForm({ ...form, account: e.target.value })}
                className="w-full"
              >
                <option>Cost of Goods Sold</option>
                <option>Inventory Asset</option>
                <option>Packaging Material</option>
              </Select>
            </Field>
          </div>
          <div className="mt-4">
            <Field label="Description">
              <Textarea
                rows={2}
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
                placeholder="Broken in transit"
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
                <Th className="text-right">Available now</Th>
                <Th className="text-right">New quantity on hand</Th>
                <Th className="text-right">Or adjust by</Th>
                <Th />
              </tr>
            </thead>
            <tbody>
              {lines.length === 0 && <EmptyRow colSpan={5} />}
              {lines.map((l, i) => {
                const item = itemById.get(l.itemId);
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
                      {item ? `${item.stock.available} ${item.unit}` : '—'}
                    </Td>
                    <Td className="text-right">
                      <Input
                        type="number"
                        step="0.01"
                        value={l.newQuantityOnHand}
                        onChange={(e) =>
                          setLine(i, { newQuantityOnHand: e.target.value, quantityAdjusted: '' })
                        }
                        placeholder="1000"
                        className="w-28 text-right"
                        disabled={l.quantityAdjusted !== ''}
                      />
                    </Td>
                    <Td className="text-right">
                      <Input
                        value={l.quantityAdjusted}
                        onChange={(e) =>
                          setLine(i, { quantityAdjusted: e.target.value, newQuantityOnHand: '' })
                        }
                        placeholder="-10"
                        className="w-24 text-right"
                        disabled={l.newQuantityOnHand !== ''}
                      />
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
            Give either an absolute new quantity or a signed delta such as <code>-10</code> — filling
            one disables the other.
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
        <Button type="button" variant="success" disabled={saving} onClick={() => submit('ADJUSTED')}>
          {saving && <Spinner className="border-card/40 border-t-card" />}
          Post adjustment
        </Button>
      </SaveBar>
    </>
  );
}
