'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { api, errorMessage, type Paged } from '@/lib/api';
import { ComboSelect } from '@/components/ComboSelect';
import { CategoryPicker } from '@/components/CategoryPicker';
import { MediaEditor, type MediaDraft } from '@/components/MediaEditor';
import { ShopCardFields } from '@/components/product/ShopCardFields';
import { HowToUseSteps, StoryFields, type HowToStep, type Story } from '@/components/product/StoryFields';
import { KeyActivesEditor } from '@/components/product/KeyActivesEditor';
import { TagInput } from '@/components/TagInput';
import type { KeyActive } from '@/lib/labels';
import { VariantBuilder, rowsToApi, type BuilderItem, type BuilderValue } from '@/components/VariantBuilder';
import { blankRow, packOf, singleRowFor, skuPrefix, toApiOptions } from '@/lib/variants';
import {
  Button, Card, ErrorBox, Field, Input, PageHeader, Select, Textarea, Spinner,
} from '@/components/ui';
import { PageCrumb } from '@/lib/crumbs';
import { SaveBar } from '@/components/form/SaveBar';

type Collection = { id: string; title: string };
type Facets = { productTypes: string[]; brands: string[] };
type Category = { id: string; name: string; parentId: string | null; path: string | null };

export default function NewProductPage() {
  const router = useRouter();

  const [categories, setCategories] = useState<Category[]>([]);
  const [collections, setCollections] = useState<Collection[]>([]);
  const [facets, setFacets] = useState<Facets>({ productTypes: [], brands: [] });
  const [media, setMedia] = useState<MediaDraft[]>([]);
  const [stockItems, setStockItems] = useState<BuilderItem[]>([]);
  const [collectionIds, setCollectionIds] = useState<string[]>([]);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  const [shop, setShop] = useState({ badge: '', comingSoon: false });
  const [keyActives, setKeyActives] = useState<KeyActive[]>([]);
  const [claims, setClaims] = useState('');
  const [inci, setInci] = useState('');
  const [steps, setSteps] = useState<HowToStep[]>([]);
  const [story, setStory] = useState<Story>({ heading: '', body: '', image: '' });

  const [form, setForm] = useState({
    title: '',
    subtitle: '',
    descriptionHtml: '',
    status: 'DRAFT',
    productType: '',
    categoryId: '',
    brand: 'OsmeKos',
    sku: '',
    chargeTax: true,
  });

  const [builder, setBuilder] = useState<BuilderValue>({ options: [], rows: [blankRow()] });

  function changeBuilder(next: BuilderValue) {
    const picked = next.rows.find((r) => r.itemId && !builder.rows.some((b) => b.key === r.key && b.itemId === r.itemId));
    const item = picked ? stockItems.find((i) => i.id === picked.itemId) : null;
    if (item && !form.title.trim()) setForm((f) => ({ ...f, title: item.name }));
    setBuilder(next);
  }
  const prefix = skuPrefix(form.title, form.sku);

  useEffect(() => {
    (async () => {
      try {
        const [cat, col, fac, itm] = await Promise.all([
          api.get<{ data: Category[] }>('/categories'),
          api.get<Paged<Collection>>('/collections', { limit: 100 }),
          api.get<{ data: Facets }>('/products/facets'),
          api.get<Paged<BuilderItem>>('/items', { limit: 100 }),
        ]);
        setCategories(cat.data);
        setCollections(col.data);
        setFacets(fac.data);
        setStockItems(itm.data);
      } catch (err) {
        setError(errorMessage(err));
      }
    })();
  }, []);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError('');

    const { options, rows } = builder;
    const needsPrice = rows.filter((r) => {
      const { size } = packOf(options, r.values);
      return !(size > 1 && singleRowFor(options, rows, r));
    });
    const unpriced = needsPrice.filter((r) => r.price === '');
    if (unpriced.length) {
      setError(
        unpriced.length === rows.length && rows.length === 1
          ? 'Give the product a price'
          : `Price ${unpriced.map((r) => r.title || 'the variant').join(', ')} - packs are priced from these`
      );
      return;
    }
    if (options.some((o) => !o.name.trim() && o.valuesText.trim())) {
      setError('Every option needs a name, such as Flavour or Pack');
      return;
    }

    const variants = rowsToApi(builder, prefix, form.chargeTax).map((v, i) => ({
      ...v,
      title:
        builder.rows[i].values.length || builder.rows[i].title.trim()
          ? v.title
          : rows.length === 1
            ? form.title.trim() || 'Default'
            : `Variant ${i + 1}`,
      compareAtPrice: v.compareAtPrice ?? undefined,
      mrp: v.mrp ?? undefined,
      itemId: v.itemId ?? undefined,
    }));

    setSaving(true);
    try {
      const res = await api.post<{ data: { id: string } }>('/products', {
        title: form.title,
        subtitle: form.subtitle.trim() || undefined,
        tags: shop.comingSoon ? ['coming-soon'] : [],
        metafields: {
          ...(shop.badge.trim() ? { badge: shop.badge.trim() } : {}),
          ...(story.heading.trim() || story.body.trim() || story.image
            ? { story: { heading: story.heading.trim(), body: story.body.trim(), image: story.image } }
            : {}),
        },
        keyActives: keyActives
          .filter((a) => a.name.trim())
          .map((a) => ({
            name: a.name.trim(),
            percent: a.percent === '' ? null : Number(a.percent),
            short: a.short?.trim() || null,
          })),
        claims: claims
          .split(',')
          .map((c) => c.trim())
          .filter(Boolean),
        ingredientsInci: inci.trim() || undefined,
        howToUseSteps: steps.filter((st) => st.title.trim() && st.text.trim()),
        sku: form.sku.trim() || undefined,
        descriptionHtml: form.descriptionHtml || undefined,
        status: form.status,
        productType: form.productType || undefined,
        categoryId: form.categoryId || undefined,
        brand: form.brand || undefined,
        options: toApiOptions(options),
        variants,
        media: media.map((m, i) => ({
          url: m.url,
          type: m.type,
          alt: m.alt || undefined,
          position: i,
        })),
        collectionIds,
      });
      router.push(`/admin/products/${res.data.id}?tab=label`);
    } catch (err) {
      setError(errorMessage(err));
      setSaving(false);
    }
  }

  return (
    <form onSubmit={submit}>
      <PageCrumb label="New product" />

      <PageHeader
        title="Add product"
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
                  placeholder="OsmeKos Body Lotion"
                  required
                />
              </Field>
              <Field label="Description">
                <Textarea
                  rows={4}
                  value={form.descriptionHtml}
                  onChange={(e) => setForm({ ...form, descriptionHtml: e.target.value })}
                  placeholder="A light, fast-absorbing body lotion with shea butter and niacinamide."
                />
              </Field>
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="Product type">
                  <ComboSelect
                    value={form.productType}
                    options={facets.productTypes}
                    onChange={(v) => setForm((f) => ({ ...f, productType: v }))}
                    placeholder="No product type"
                    newPlaceholder="New product type"
                  />
                </Field>
                <Field label="Vendor">
                  <ComboSelect
                    value={form.brand}
                    options={facets.brands}
                    onChange={(v) => setForm((f) => ({ ...f, brand: v }))}
                    placeholder="No vendor"
                    newPlaceholder="New vendor"
                  />
                </Field>
                <Field label="Category" hint="The one place in the catalogue tree this product files under">
                  <CategoryPicker
                    value={form.categoryId}
                    categories={categories}
                    onChange={(categoryId) => setForm((f) => ({ ...f, categoryId }))}
                    onCreated={(c) => setCategories((list) => [...list, { id: c.id, name: c.name, parentId: c.parentId ?? null, path: c.path ?? null }])}
                  />
                </Field>
                <Field
                  label="SKU code"
                  hint={
                    form.sku.trim()
                      ? `Every variant SKU starts with ${prefix}`
                      : form.title.trim()
                        ? `Leave blank to use ${prefix}, taken from the title`
                        : 'Every variant SKU starts with this. Leave blank to take it from the title.'
                  }
                >
                  <Input
                    value={form.sku}
                    onChange={(e) => setForm({ ...form, sku: e.target.value.toUpperCase() })}
                    placeholder="OK-BL"
                    className="font-mono"
                  />
                </Field>
              </div>
            </div>
          </Card>

          <Card title="On the shop">
            <div className="space-y-4">
              <ShopCardFields
                subtitle={form.subtitle}
                onSubtitle={(subtitle) => setForm({ ...form, subtitle })}
                media={media}
                onMedia={setMedia}
              />
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="Badge" hint='The corner tag on the card, e.g. "Bestseller"'>
                  <Input value={shop.badge} onChange={(e) => setShop({ ...shop, badge: e.target.value })} placeholder="No badge" />
                </Field>
                <Field label="Coming soon" hint="Shown on the shop but cannot be bought yet">
                  <label className="flex h-9 items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      className="size-4 accent-foreground"
                      checked={shop.comingSoon}
                      onChange={(e) => setShop({ ...shop, comingSoon: e.target.checked })}
                    />
                    Announce it without selling it
                  </label>
                </Field>
              </div>
            </div>
          </Card>

          <Card title="Key ingredients">
            <KeyActivesEditor value={keyActives} onChange={setKeyActives} />
          </Card>

          <Card title="Full ingredient list">
            <div className="space-y-4">
              <Field label="INCI" hint="Exactly as printed on the back of the pack">
                <Textarea
                  rows={5}
                  value={inci}
                  onChange={(e) => setInci(e.target.value)}
                  placeholder="Aqua, Glycerin 6%, Cetearyl Alcohol, ..."
                />
              </Field>
              <Field label="Benefits" hint="The bullet points on the shop, separated by commas">
                <TagInput value={claims} onChange={setClaims} placeholder="Type a benefit and press Enter" />
              </Field>
            </div>
          </Card>

          <Card title="How to use">
            <HowToUseSteps value={steps} onChange={setSteps} />
          </Card>

          <Card title="The story section">
            <StoryFields value={story} onChange={setStory} />
          </Card>

          <MediaEditor media={media} onChange={setMedia} />

          <Card title="Options & variants" padded={false}>
            <label className="flex items-center gap-2 border-b border-border px-4 py-3 text-sm text-foreground">
              <input
                type="checkbox"
                checked={form.chargeTax}
                onChange={(e) => setForm({ ...form, chargeTax: e.target.checked })}
                className="h-4 w-4 rounded border-border"
              />
              Charge tax on this product
            </label>
            <VariantBuilder
              value={builder}
              onChange={changeBuilder}
              items={stockItems}
              prefix={prefix}
              productTitle={form.title}
            />
            <p className="px-4 py-2.5 text-xs text-muted-foreground">
              A blank SKU is filled in from the SKU code and the option values - type over any you
              want to change. Barcode, weight and HS code are set on each variant after saving.
            </p>
          </Card>
        </div>

        <div className="space-y-5">
          <Card title="Status">
            <Field label="Product status" hint="New products start as a draft. Fill in the label data, then mark it Ready to sell.">
              <Select
                value={form.status}
                onChange={(e) => setForm({ ...form, status: e.target.value })}
                className="w-full"
                disabled
              >
                <option value="DRAFT">Draft</option>
              </Select>
            </Field>
          </Card>

          <Card title="Collections">
            {collections.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                No collections yet.
              </p>
            ) : (
              <div className="space-y-2">
                {collections.map((c) => (
                  <label
                    key={c.id}
                    className="flex items-center gap-2 text-sm text-foreground"
                  >
                    <input
                      type="checkbox"
                      checked={collectionIds.includes(c.id)}
                      onChange={(e) =>
                        setCollectionIds(
                          e.target.checked
                            ? [...collectionIds, c.id]
                            : collectionIds.filter((id) => id !== c.id)
                        )
                      }
                      className="rounded border-border"
                    />
                    {c.title}
                  </label>
                ))}
              </div>
            )}
            <p className="mt-3 text-xs text-muted-foreground">
              Automated collections pick their own members by rule — adding a product here only
              affects manual ones.
            </p>
          </Card>
        </div>
      </div>
      <SaveBar>
        <Link href="/admin/products">
          <Button type="button">Cancel</Button>
        </Link>
        <Button type="submit" variant="primary" disabled={saving}>
          {saving && <Spinner className="border-card/40 border-t-card" />}
          Save product
        </Button>
      </SaveBar>
    </form>
  );
}

