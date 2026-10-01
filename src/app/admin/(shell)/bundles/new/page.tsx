'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { api, errorMessage } from '@/lib/api';
import { PageCrumb } from '@/lib/crumbs';
import { Button, Card, ErrorBox, Field, Input, PageHeader, Spinner, Textarea } from '@/components/ui';
import { SaveBar } from '@/components/form/SaveBar';

export default function NewBundlePage() {
  const router = useRouter();
  const [form, setForm] = useState({ title: '', description: '', price: '', mrp: '', sku: '' });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  async function save(e?: React.FormEvent) {
    e?.preventDefault();
    if (!form.title.trim()) return setError('Give the combo a name');
    if (!(Number(form.price) > 0)) return setError('Set the price the combo sells at');
    if (form.mrp && Number(form.price) > Number(form.mrp)) return setError('The price cannot be more than the MRP');
    setSaving(true);
    setError('');
    try {
      const res = await api.post<{ data: { id: string } }>('/products', {
        title: form.title.trim(),
        kind: 'BUNDLE',
        productType: 'Gift set',
        descriptionHtml: form.description || undefined,
        status: 'DRAFT',
        variants: [
          {
            title: 'Default',
            sku: form.sku.trim() || undefined,
            price: Number(form.price),
            mrp: form.mrp ? Number(form.mrp) : null,
          },
        ],
      });
      router.push(`/admin/products/${res.data.id}?tab=combo`);
    } catch (err) {
      setError(errorMessage(err));
      setSaving(false);
    }
  }

  return (
    <form onSubmit={save}>
      <PageCrumb label="New combo" />
      <PageHeader title="New combo" subtitle="Name and price first — you add what goes inside on the next screen" />
      {error && (
        <div className="mb-4">
          <ErrorBox message={error} />
        </div>
      )}
      <div className="grid gap-5 lg:grid-cols-3">
        <Card title="Combo" className="lg:col-span-2">
          <div className="space-y-4">
            <Field label="Name" required>
              <Input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder="Glow Duo — Body Lotion + Face Wash" autoFocus />
            </Field>
            <Field label="Description" hint="Plain text">
              <Textarea rows={4} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
            </Field>
            <div className="grid gap-4 sm:grid-cols-3">
              <Field label="Selling price" required hint="Including GST">
                <Input type="number" min="0" step="0.01" value={form.price} onChange={(e) => setForm({ ...form, price: e.target.value })} />
              </Field>
              <Field label="MRP" hint="Including GST">
                <Input type="number" min="0" step="0.01" value={form.mrp} onChange={(e) => setForm({ ...form, mrp: e.target.value })} />
              </Field>
              <Field label="SKU">
                <Input value={form.sku} onChange={(e) => setForm({ ...form, sku: e.target.value })} placeholder="OK-DUO-01" />
              </Field>
            </div>
          </div>
        </Card>
        <Card title="How combos work">
          <ul className="list-disc space-y-2 pl-4 text-sm text-muted-foreground">
            <li>A combo has no stock of its own. When it is ordered, stock is held and shipped from the products inside.</li>
            <li>How many you can sell is limited by the product that runs out first.</li>
            <li>GST suggests the highest rate among the products inside — confirm mixed sets with your CA.</li>
          </ul>
        </Card>
      </div>
      <SaveBar>
        <Button type="submit" variant="primary" disabled={saving}>
          {saving && <Spinner className="border-primary-foreground/30 border-t-primary-foreground" />}
          Create combo
        </Button>
        <Button asChild variant="ghost">
          <Link href="/admin/bundles">Cancel</Link>
        </Button>
      </SaveBar>
    </form>
  );
}
