'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { api, money, errorMessage, type Paged } from '@/lib/api';
import { Button, Card, ErrorBox, Field, Input, PageHeader, Select, Textarea, Spinner } from '@/components/ui';
import { RuleBuilder, blankRule, type RuleDraft } from '@/components/RuleBuilder';
import { FileUpload } from '@/components/FileUpload';
import { Thumb } from '@/components/SearchSelect';
import { PageCrumb } from '@/lib/crumbs';
import { SaveBar } from '@/components/form/SaveBar';

type Product = { id: string; title: string; handle: string; priceMin: number | null; media?: { url: string }[] };

export default function NewCollectionPage() {
  const router = useRouter();

  const [form, setForm] = useState({
    title: '',
    descriptionHtml: '',
    type: 'MANUAL' as 'MANUAL' | 'AUTOMATIC',
    status: 'ACTIVE',
    sortOrder: 'BEST_SELLING',
    ruleMatch: 'ALL' as 'ALL' | 'ANY',
    imageUrl: '',
  });

  const [rules, setRules] = useState<RuleDraft[]>([blankRule()]);
  const [products, setProducts] = useState<Product[]>([]);
  const [productIds, setProductIds] = useState<string[]>([]);
  const [productSearch, setProductSearch] = useState('');

  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const res = await api.get<Paged<Product>>('/products', { limit: 100 });
        setProducts(res.data);
      } catch (err) {
        setError(errorMessage(err));
      }
    })();
  }, []);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setSaving(true);

    const cleanRules = rules.filter((r) => r.value.trim());

    try {
      const res = await api.post<{ data: { id: string } }>('/collections', {
        title: form.title,
        descriptionHtml: form.descriptionHtml || undefined,
        type: form.type,
        status: form.status,
        sortOrder: form.sortOrder,
        ruleMatch: form.ruleMatch,
        rules: form.type === 'AUTOMATIC' ? cleanRules : [],
        productIds: form.type === 'MANUAL' ? productIds : [],
        imageUrl: form.imageUrl.trim() || undefined,
      });
      router.push(`/admin/collections/${res.data.id}`);
    } catch (err) {
      setError(errorMessage(err));
      setSaving(false);
    }
  }

  const visible = products.filter((p) =>
    p.title.toLowerCase().includes(productSearch.toLowerCase())
  );

  return (
    <form onSubmit={submit}>
      <PageCrumb label="New collection" />

      <PageHeader
        title="Add collection"
      />

      {error && (
        <div className="mb-4">
          <ErrorBox message={error} />
        </div>
      )}

      <div className="grid gap-5 lg:grid-cols-3">
        <div className="space-y-5 lg:col-span-2 min-w-0">
          <Card title="Details">
            <div className="space-y-4">
              <Field label="Title" required>
                <Input
                  value={form.title}
                  onChange={(e) => setForm({ ...form, title: e.target.value })}
                  placeholder="Body care"
                  required
                />
              </Field>
              <Field label="Description">
                <Textarea
                  rows={4}
                  value={form.descriptionHtml}
                  onChange={(e) => setForm({ ...form, descriptionHtml: e.target.value })}
                  placeholder="Lotions, butters and washes for everyday body care…"
                />
              </Field>
              <Field
                label="Collection image"
                hint="The banner shown at the top of the collection on the storefront"
              >
                <div className="flex items-start gap-3">
                  <div className="flex h-24 w-24 shrink-0 items-center justify-center overflow-hidden rounded-md border border-border bg-muted/60">
                    {form.imageUrl.trim() ? (
                      <img
                        src={form.imageUrl}
                        alt="Collection preview"
                        className="h-full w-full object-cover"
                        onError={(e) => {
                          e.currentTarget.style.display = 'none';
                        }}
                      />
                    ) : (
                      <span className="text-[10px] text-muted-foreground">
                        No image
                      </span>
                    )}
                  </div>
                  <div className="min-w-0 flex-1 space-y-2">
                    <div className="flex gap-2">
                      <FileUpload
                        label={form.imageUrl ? 'Replace' : 'Upload'}
                        accept="image/*"
                        onUploaded={(files) => {
                          if (files[0]) setForm({ ...form, imageUrl: files[0].url });
                        }}
                      />
                      {form.imageUrl && (
                        <Button
                          type="button"
                          size="sm"
                          variant="danger"
                          onClick={() => setForm({ ...form, imageUrl: '' })}
                        >
                          Remove
                        </Button>
                      )}
                    </div>
                    <Input
                      value={form.imageUrl}
                      onChange={(e) => setForm({ ...form, imageUrl: e.target.value })}
                      placeholder="…or paste a URL"
                      className="text-xs"
                    />
                  </div>
                </div>
              </Field>
            </div>
          </Card>

          <Card title="Products">
            <div className="mb-4 flex gap-4">
              {(['MANUAL', 'AUTOMATIC'] as const).map((t) => (
                <label key={t} className="flex items-start gap-2 text-sm">
                  <input
                    type="radio"
                    name="type"
                    checked={form.type === t}
                    onChange={() => setForm({ ...form, type: t })}
                    className="mt-0.5"
                  />
                  <span>
                    <span className="font-medium text-foreground">
                      {t === 'MANUAL' ? 'Manual selection' : 'Automatic'}
                    </span>
                    <span className="block text-xs text-muted-foreground">
                      {t === 'MANUAL'
                        ? 'Pick products by hand'
                        : 'Products matching the conditions are added automatically'}
                    </span>
                  </span>
                </label>
              ))}
            </div>

            {form.type === 'AUTOMATIC' ? (
              <RuleBuilder
                rules={rules}
                onChange={setRules}
                ruleMatch={form.ruleMatch}
                onMatchChange={(m) => setForm({ ...form, ruleMatch: m })}
              />
            ) : (
              <>
                <Input
                  placeholder="Filter products…"
                  value={productSearch}
                  onChange={(e) => setProductSearch(e.target.value)}
                  className="mb-3 max-w-xs"
                />
                <div className="max-h-72 space-y-1 overflow-y-auto rounded-md border border-border p-2">
                  {visible.length === 0 && (
                    <p className="py-6 text-center text-sm text-muted-foreground">
                      No products found
                    </p>
                  )}
                  {visible.map((p) => (
                    <label
                      key={p.id}
                      className="flex cursor-pointer items-center gap-2 rounded px-2 py-1.5
                        text-sm hover:bg-muted/60"
                    >
                      <input
                        type="checkbox"
                        checked={productIds.includes(p.id)}
                        onChange={(e) =>
                          setProductIds(
                            e.target.checked
                              ? [...productIds, p.id]
                              : productIds.filter((id) => id !== p.id)
                          )
                        }
                        className="rounded border-border"
                      />
                      <Thumb url={p.media?.[0]?.url} label={p.title} />
                      <span className="flex-1 truncate text-foreground">
                        {p.title}
                      </span>
                      {p.priceMin !== null && (
                        <span className="text-xs text-muted-foreground">
                          {money(p.priceMin)}
                        </span>
                      )}
                    </label>
                  ))}
                </div>
                <p className="mt-2 text-xs text-muted-foreground">
                  {productIds.length} product(s) selected
                </p>
              </>
            )}
          </Card>
        </div>

        <div className="space-y-5">
          <Card title="Status">
            <Field label="Collection status">
              <Select
                value={form.status}
                onChange={(e) => setForm({ ...form, status: e.target.value })}
                className="w-full"
              >
                <option value="ACTIVE">Active</option>
                <option value="DRAFT">Draft</option>
              </Select>
            </Field>
          </Card>

          <Card title="Display">
            <Field label="Default sort order">
              <Select
                value={form.sortOrder}
                onChange={(e) => setForm({ ...form, sortOrder: e.target.value })}
                className="w-full"
              >
                <option value="BEST_SELLING">Best selling</option>
                <option value="TITLE_ASC">Title A–Z</option>
                <option value="TITLE_DESC">Title Z–A</option>
                <option value="PRICE_ASC">Price low to high</option>
                <option value="PRICE_DESC">Price high to low</option>
                <option value="NEWEST">Newest</option>
                <option value="OLDEST">Oldest</option>
                <option value="MANUAL">Manual</option>
              </Select>
            </Field>
          </Card>
        </div>
      </div>
      <SaveBar>
        <Link href="/admin/collections">
          <Button type="button">Cancel</Button>
        </Link>
        <Button type="submit" variant="primary" disabled={saving}>
          {saving && <Spinner className="border-card/40 border-t-card" />}
          Save collection
        </Button>
      </SaveBar>
    </form>
  );
}
