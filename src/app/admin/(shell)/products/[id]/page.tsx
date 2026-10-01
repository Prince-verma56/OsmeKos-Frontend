'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import { Boxes, FlaskConical, PackagePlus } from 'lucide-react';
import { api, money, dateTime, errorMessage } from '@/lib/api';
import { CategoryPicker } from '@/components/CategoryPicker';
import {
  Badge, Button, Card, ErrorBox, Field, Input, Loading, PageHeader,
  Select, Textarea, Spinner,
} from '@/components/ui';
import { marginOf } from '@/lib/pricing';
import { useToast } from '@/lib/toast';
import { MediaEditor, type MediaDraft, type MediaType } from '@/components/MediaEditor';
import { VariantBuilder, rowsToApi, type BuilderValue } from '@/components/VariantBuilder';
import { LoadedSalesSummary } from '@/components/SalesSummary';
import { TagInput } from '@/components/TagInput';
import { SaveBar } from '@/components/form/SaveBar';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Checkbox } from '@/components/ui/misc';
import { KeyActivesEditor } from '@/components/product/KeyActivesEditor';
import { ReadinessCard } from '@/components/product/ReadinessCard';
import { ShopCardFields } from '@/components/product/ShopCardFields';
import { HowToUseSteps, StoryFields, type HowToStep, type Story } from '@/components/product/StoryFields';
import { ComboContents, type ComboVariant, type PickableVariant } from '@/components/product/ComboContents';
import {
  NET_UNITS, eanProblem, inciCount, perUnit, productStatusLabel, unitSalePrice,
  type KeyActive, type Manufacturer, type Readiness,
} from '@/lib/labels';
import {
  fromApiOptions, packOf, rowKey, singleRowFor, skuPrefix, toApiOptions, type ApiOption,
} from '@/lib/variants';
import { PageCrumb } from '@/lib/crumbs';
import { plainText } from '@/lib/text';

type Variant = ComboVariant & {
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
  itemId: string | null;
  option1: string | null;
  option2: string | null;
  option3: string | null;
  packSize: number;
  isActive: boolean;
  imageUrl: string | null;
  position: number;
  netQuantity: string | null;
  netUnit: 'ML' | 'G' | 'PCS' | null;
  isSample: boolean;
  isTester: boolean;
  hsCode: string | null;
  bundleTaxRate: string | null;
  unitSalePrice: number | null;
  item?: { id: string; name: string; sku: string | null; hsnCode: string | null; intraStateTaxRate: string | null } | null;
};

type Category = { id: string; name: string; parentId: string | null; path: string | null };

type Product = {
  id: string;
  sku: string | null;
  title: string;
  handle: string;
  kind: 'STANDARD' | 'BUNDLE';
  descriptionHtml: string | null;
  status: 'ACTIVE' | 'DRAFT' | 'ARCHIVED';
  productType: string | null;
  brand: string | null;
  tags: string[];
  metafields: Record<string, unknown> | null;
  hasVariants: boolean;
  trackInventory: boolean;
  options?: ApiOption[];
  createdAt: string;
  updatedAt: string;
  category: { id: string; name: string; path: string | null } | null;
  variants: Variant[];
  collections: { id: string; title: string }[];
  media?: { url: string; type: MediaType; alt?: string | null; variantId?: string | null }[];
  subtitle: string | null;
  keyActives: { name: string; percent: number | null; short?: string | null }[];
  howToUseSteps: { title: string; text: string }[];
  claims: string[];
  skinTypes: string[];
  ingredientsInci: string | null;
  howToUse: string | null;
  caution: string | null;
  storage: string | null;
  shelfLifeMonths: number;
  countryOfOrigin: string;
  manufacturerVendorId: string | null;
  manufacturer: Manufacturer | null;
  readiness: Readiness | null;
};

type Item = { id: string; name: string; sku: string | null; costPrice?: string | null; otherCostTotal?: string | null; imageUrls?: string[] };

type VariantLabel = {
  netQuantity: string;
  netUnit: string;
  mrp: string;
  barcode: string;
  isSample: boolean;
  isTester: boolean;
  hsCode: string;
  bundleTaxRate: string;
};

const labelOf = (v: Variant): VariantLabel => ({
  netQuantity: v.netQuantity != null ? String(Number(v.netQuantity)) : '',
  netUnit: v.netUnit ?? 'ML',
  mrp: v.mrp != null ? String(Number(v.mrp)) : '',
  barcode: v.barcode ?? '',
  isSample: v.isSample,
  isTester: v.isTester,
  hsCode: v.hsCode ?? '',
  bundleTaxRate: v.bundleTaxRate != null ? String(Number(v.bundleTaxRate)) : '',
});

const splitList = (s: string) => s.split(',').map((t) => t.trim()).filter(Boolean);

const COMING_SOON_TAG = 'coming-soon';

export default function ProductDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const search = useSearchParams();
  const toast = useToast();

  const [product, setProduct] = useState<Product | null>(null);
  const [items, setItems] = useState<Item[]>([]);
  const [pickable, setPickable] = useState<PickableVariant[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [builder, setBuilder] = useState<BuilderValue>({ options: [], rows: [] });
  const [builderDirty, setBuilderDirty] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const [tab, setTab] = useState(search.get('tab') ?? 'overview');
  const [stockItemBusy, setStockItemBusy] = useState('');
  const [previewVariantId, setPreviewVariantId] = useState('');

  const [form, setForm] = useState({ title: '', descriptionHtml: '', status: 'DRAFT', productType: '', categoryId: '', brand: '' });
  const [label, setLabel] = useState({
    subtitle: '',
    keyActives: [] as KeyActive[],
    claims: '',
    skinTypes: '',
    ingredientsInci: '',
    howToUse: '',
    caution: '',
    storage: '',
    shelfLifeMonths: '24',
    countryOfOrigin: 'India',
    manufacturerVendorId: '',
  });
  const [variantLabels, setVariantLabels] = useState<Record<string, VariantLabel>>({});
  const [media, setMedia] = useState<MediaDraft[]>([]);
  const [shop, setShop] = useState({ badge: '', comingSoon: false });
  const [steps, setSteps] = useState<HowToStep[]>([]);
  const [story, setStory] = useState<Story>({ heading: '', body: '', image: '' });

  const costOf = (itemId: string | null) => {
    const cost = items.find((i) => i.id === itemId)?.costPrice;
    return cost != null && Number(cost) > 0 ? Number(cost) : null;
  };

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const [p, i, cat, catalogue] = await Promise.all([
        api.get<{ data: Product }>(`/products/${id}`),
        api.get<{ data: Item[] }>('/items', { limit: 100 }),
        api.get<{ data: Category[] }>('/categories'),
        api.get<{ data: { id: string; title: string; kind: string; variants: { id: string; title: string; sku: string | null; itemId: string | null }[] }[] }>(
          '/products',
          { limit: 100, kind: 'STANDARD' }
        ),
      ]);
      const data = p.data;
      setProduct(data);
      setItems(i.data);
      setCategories(cat.data);
      setPickable(
        catalogue.data.flatMap((prod) =>
          prod.variants
            .filter((x) => x.itemId)
            .map((x) => ({ value: x.id, label: x.title && x.title !== 'Default' ? `${prod.title} — ${x.title}` : prod.title, tag: x.sku }))
        )
      );
      const options = fromApiOptions(data.options);
      setBuilder({
        options,
        rows: data.variants.map((row) => {
          const values = options.map((_, idx) => [row.option1, row.option2, row.option3][idx] ?? '');
          return {
            key: values.length ? rowKey(values) : `id-${row.id}`,
            id: row.id,
            values,
            title: row.title,
            sku: row.sku ?? '',
            price: String(Number(row.price)),
            compareAtPrice: row.compareAtPrice != null ? String(Number(row.compareAtPrice)) : '',
            compareManual: !!row.compareAtManual,
            priceManual: !!row.priceManual,
            mrpManual: !!row.mrpManual,
            mrp: row.mrp != null ? String(Number(row.mrp)) : '',
            itemId: row.itemId ?? '',
            barcode: row.barcode ?? '',
            barcodeType: row.barcodeType ?? '',
          };
        }),
      });
      setBuilderDirty(false);
      setForm({
        title: data.title,
        descriptionHtml: plainText(data.descriptionHtml),
        status: data.status,
        productType: data.productType ?? '',
        categoryId: data.category?.id ?? '',
        brand: data.brand ?? '',
      });
      setLabel({
        subtitle: data.subtitle ?? '',
        keyActives: (data.keyActives ?? []).map((a) => ({ name: a.name, percent: a.percent != null ? String(a.percent) : '', short: a.short ?? '' })),
        claims: (data.claims ?? []).join(', '),
        skinTypes: (data.skinTypes ?? []).join(', '),
        ingredientsInci: data.ingredientsInci ?? '',
        howToUse: data.howToUse ?? '',
        caution: data.caution ?? '',
        storage: data.storage ?? '',
        shelfLifeMonths: String(data.shelfLifeMonths ?? 24),
        countryOfOrigin: data.countryOfOrigin ?? 'India',
        manufacturerVendorId: data.manufacturerVendorId ?? '',
      });
      setVariantLabels(Object.fromEntries(data.variants.map((row) => [row.id, labelOf(row)])));
      setPreviewVariantId((prev) => (data.variants.some((x) => x.id === prev) ? prev : data.variants[0]?.id ?? ''));
      setMedia((data.media ?? []).map((m) => ({ url: m.url, type: m.type, alt: m.alt ?? '', variantId: m.variantId ?? null })));
      setShop({
        badge: typeof data.metafields?.badge === 'string' ? data.metafields.badge : '',
        comingSoon: (data.tags ?? []).includes(COMING_SOON_TAG),
      });
      setSteps(data.howToUseSteps ?? []);
      const saved = (data.metafields?.story ?? {}) as Partial<Story>;
      setStory({ heading: saved.heading ?? '', body: saved.body ?? '', image: saved.image ?? '' });
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    const t = setTimeout(load, 0);
    return () => clearTimeout(t);
  }, [load]);

  const isCombo = product?.kind === 'BUNDLE';

  const setVariantLabel = (variantId: string, patch: Partial<VariantLabel>) =>
    setVariantLabels((prev) => ({ ...prev, [variantId]: { ...prev[variantId], ...patch } }));

  const barcodeProblems = Object.entries(variantLabels)
    .map(([vid, v]) => [vid, eanProblem(v.barcode)] as const)
    .filter(([, p]) => p);

  function variantsReady() {
    const { options, rows } = builder;
    const unpriced = rows.filter((r) => {
      const { size } = packOf(options, r.values);
      return r.price === '' && !(size > 1 && singleRowFor(options, rows, r));
    });
    if (unpriced.length) {
      setError(`Price ${unpriced.map((r) => r.title || 'the variant').join(', ')} - packs are priced from these`);
      return false;
    }
    if (options.some((o) => !o.name.trim() && o.valuesText.trim())) {
      setError('Every option needs a name, such as Size');
      return false;
    }
    const kept = new Set(rows.map((r) => r.id).filter(Boolean));
    const dropping = (product?.variants ?? []).filter((v) => !kept.has(v.id));
    if (dropping.length && !confirm(`This removes ${dropping.map((v) => v.title).join(', ')}. Past orders keep them, but they can no longer be sold. Continue?`)) {
      return false;
    }
    return true;
  }

  async function save() {
    if (!product) return;
    if (builderDirty && !variantsReady()) return;
    if (barcodeProblems.length) {
      setError(`Fix the barcode first: ${barcodeProblems[0][1]}`);
      setTab(isCombo ? 'combo' : 'label');
      return;
    }
    setSaving(true);
    setError('');
    try {
      const tags = [
        ...product.tags.filter((t) => t !== COMING_SOON_TAG),
        ...(shop.comingSoon ? [COMING_SOON_TAG] : []),
      ];

      await api.patch(`/products/${id}`, {
        title: form.title,
        descriptionHtml: form.descriptionHtml || undefined,
        productType: form.productType || undefined,
        categoryId: form.categoryId || null,
        brand: form.brand || undefined,
        tags,
        metafields: {
          ...(product.metafields ?? {}),
          badge: shop.badge.trim() || undefined,
          story: story.heading.trim() || story.body.trim() || story.image
            ? { heading: story.heading.trim(), body: story.body.trim(), image: story.image }
            : undefined,
        },
        subtitle: label.subtitle || null,
        media: media.map((m, i) => ({ url: m.url, type: m.type, alt: m.alt || undefined, position: i, variantId: m.variantId ?? undefined })),
        ...(isCombo
          ? {}
          : {
              keyActives: label.keyActives
                .filter((a) => a.name.trim())
                .map((a) => ({
                  name: a.name.trim(),
                  percent: a.percent === '' ? null : Number(a.percent),
                  short: a.short?.trim() || null,
                })),
              howToUseSteps: steps.filter((st) => st.title.trim() && st.text.trim()),
              claims: splitList(label.claims),
              skinTypes: splitList(label.skinTypes),
              ingredientsInci: label.ingredientsInci || null,
            }),
      });
      if (builderDirty) {
        const prefix = skuPrefix(product.title, product.sku);
        await api.put(`/products/${id}/variants`, { options: toApiOptions(builder.options), variants: rowsToApi(builder, prefix) });
      }
      for (const v of product.variants) {
        const before = labelOf(v);
        const after = variantLabels[v.id];
        if (!after || JSON.stringify(before) === JSON.stringify(after)) continue;
        await api.patch(`/products/${id}/variants/${v.id}`, {
          netQuantity: after.netQuantity === '' ? null : Number(after.netQuantity),
          netUnit: after.netQuantity === '' ? null : after.netUnit,
          mrp: after.mrp === '' ? null : Number(after.mrp),
          barcode: after.barcode.trim() || null,
          isSample: after.isSample,
          isTester: after.isTester,
          hsCode: after.hsCode.trim() || undefined,
          bundleTaxRate: after.bundleTaxRate === '' ? null : Number(after.bundleTaxRate),
        });
      }
      if (form.status !== product.status) {
        await api.patch(`/products/${id}/status`, { status: form.status });
      }
      toast.success('Saved');
      await load();
    } catch (err) {
      setError(errorMessage(err));
      await load().catch(() => undefined);
    } finally {
      setSaving(false);
    }
  }

  async function deleteProduct() {
    if (!confirm(`Delete "${product?.title}"? This cannot be undone.`)) return;
    try {
      await api.del(`/products/${id}`);
      router.push(isCombo ? '/bundles' : '/products');
    } catch (err) {
      setError(errorMessage(err));
    }
  }

  if (loading && !product) return <Loading />;
  if (!product) return <ErrorBox message={error || 'Product not found'} onRetry={load} />;

  const createStockItem = async (variantId: string) => {
    setStockItemBusy(variantId);
    try {
      const res = await api.post<{ message: string; data: { hsnNote: string | null } }>(
        `/products/${product.id}/variants/${variantId}/stock-item`,
        {}
      );
      toast.success(res.data.hsnNote ? `${res.message}. ${res.data.hsnNote}` : res.message);
      await load();
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setStockItemBusy('');
    }
  };
  const previewVariant = product.variants.find((v) => v.id === previewVariantId) ?? product.variants[0];
  const readiness = product.readiness;
  const readyBlocked = form.status !== 'ACTIVE' && product.status !== 'ACTIVE' && readiness && !readiness.ready;

  return (
    <>
      <PageCrumb label={product.title} />

      <PageHeader
        eyebrow={isCombo ? 'Combo / gift set' : undefined}
        title={product.title}
        subtitle={`${product.handle} · updated ${dateTime(product.updatedAt)}`}
        actions={
          <>
            <Badge status={product.status}>{productStatusLabel(product.status)}</Badge>
            <Button variant="danger" onClick={deleteProduct}>
              Delete
            </Button>
          </>
        }
      />

      {error && (
        <div className="mb-4">
          <ErrorBox message={error} />
        </div>
      )}

      <div className="grid gap-5 lg:grid-cols-3">
        <div className="min-w-0 space-y-5 lg:col-span-2">
          <Tabs value={tab} onValueChange={setTab}>
            <TabsList className="max-w-full overflow-x-auto">
              <TabsTrigger value="overview">Overview</TabsTrigger>
              {isCombo ? (
                <TabsTrigger value="combo">
                  <Boxes className="size-3.5" strokeWidth={1.5} /> Combo contents
                </TabsTrigger>
              ) : (
                <TabsTrigger value="label">
                  <FlaskConical className="size-3.5" strokeWidth={1.5} /> Label &amp; compliance
                </TabsTrigger>
              )}
              <TabsTrigger value="media">Media</TabsTrigger>
              <TabsTrigger value="sales">Sales</TabsTrigger>
            </TabsList>

            <TabsContent value="overview" className="space-y-5">
              <Card title="Details">
                <div className="space-y-4">
                  <Field label="Title" required>
                    <Input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} />
                  </Field>
                  <Field label="Description" hint="What the product is and does, in plain words">
                    <Textarea rows={5} value={form.descriptionHtml} onChange={(e) => setForm({ ...form, descriptionHtml: e.target.value })} />
                  </Field>
                  <div className="grid gap-4 sm:grid-cols-2">
                    <Field label="Product type">
                      <Input value={form.productType} onChange={(e) => setForm({ ...form, productType: e.target.value })} placeholder={isCombo ? 'Gift set' : 'Body lotion'} />
                    </Field>
                    <Field label="Brand">
                      <Input value={form.brand} onChange={(e) => setForm({ ...form, brand: e.target.value })} placeholder="OsmeKos" />
                    </Field>
                    <Field label="Category" hint="Where it files in the catalogue">
                      <CategoryPicker
                        value={form.categoryId}
                        categories={categories}
                        onChange={(categoryId) => setForm((f) => ({ ...f, categoryId }))}
                        onCreated={(c) => setCategories((list) => [...list, { id: c.id, name: c.name, parentId: c.parentId ?? null, path: c.path ?? null }])}
                      />
                    </Field>
                  </div>
                </div>
              </Card>

              <Card title="On the shop">
                <div className="space-y-4">
                  <ShopCardFields
                    subtitle={label.subtitle}
                    onSubtitle={(subtitle) => setLabel({ ...label, subtitle })}
                    media={media}
                    onMedia={setMedia}
                  />
                  <div className="grid gap-4 sm:grid-cols-2">
                    <Field label="Badge" hint='The corner tag on the card, e.g. "Bestseller" or "Save Rs.99"'>
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
                  <p className="text-xs text-muted-foreground">
                    {product.status === 'ACTIVE' ? (
                      <>
                        Live at <span className="font-mono">/product/{product.handle}</span>. Photos come from the Media tab.
                      </>
                    ) : (
                      <>Not on the shop yet - set the status to Ready to sell to publish it.</>
                    )}
                  </p>
                </div>
              </Card>

              <Card title="The story section" >
                <StoryFields value={story} onChange={setStory} />
              </Card>

              <Card title="Sizes & prices" padded={false}>
                <VariantBuilder
                  value={builder}
                  onChange={(next) => {
                    setBuilder(next);
                    setBuilderDirty(true);
                  }}
                  items={isCombo ? [] : items}
                  prefix={skuPrefix(product.title, product.sku)}
                  productTitle={product.title}
                  rowExtra={(row) =>
                    row.id ? (
                      <Link href={`/admin/products/${id}/variants/${row.id}`} className="rounded-md border border-border px-2.5 py-1 text-xs text-gold-ink hover:underline">
                        Details
                      </Link>
                    ) : null
                  }
                />
                <p className="px-4 py-2.5 text-xs text-muted-foreground">
                  {isCombo
                    ? 'A combo has no stock item of its own - add what goes inside on the Combo contents tab.'
                    : 'Net quantity, MRP, barcode and stock items are on the Label & compliance tab.'}
                </p>
              </Card>
            </TabsContent>

            {!isCombo && (
              <TabsContent value="label" className="space-y-5">
                <Card title="Key ingredients">
                  <div className="space-y-4">
                    <div>
                      <span className="mb-1.5 block text-xs font-medium text-muted-foreground">Key actives</span>
                      <KeyActivesEditor value={label.keyActives} onChange={(keyActives) => setLabel({ ...label, keyActives })} />
                    </div>
                    <div className="grid gap-4 sm:grid-cols-2">
                      <Field label="Claims" hint="e.g. Deep hydration, Soft smooth skin">
                        <TagInput value={label.claims} onChange={(claims) => setLabel({ ...label, claims })} placeholder="Type a claim and press Enter" />
                      </Field>
                      <Field label="Skin types" hint="e.g. All skin types, Dry skin">
                        <TagInput value={label.skinTypes} onChange={(skinTypes) => setLabel({ ...label, skinTypes })} placeholder="Type a skin type and press Enter" />
                      </Field>
                    </div>
                  </div>
                </Card>

                <Card title="Full ingredient list">
                  <div className="space-y-4">
                    <Field
                      label="Ingredients (INCI)"
                      hint={`${inciCount(label.ingredientsInci)} ingredient${inciCount(label.ingredientsInci) === 1 ? '' : 's'} · separate with commas, in descending order as on the label`}
                    >
                      <Textarea rows={5} value={label.ingredientsInci} onChange={(e) => setLabel({ ...label, ingredientsInci: e.target.value })} placeholder="Aqua, Glycerin, Butyrospermum Parkii Butter, Niacinamide, …" />
                    </Field>
                  </div>
                </Card>

                <Card title="How to use">
                  <HowToUseSteps value={steps} onChange={setSteps} />
                </Card>

                <Card title="Per size" padded={false}>
                  <div className="divide-y divide-border">
                    {product.variants.map((v) => {
                      const l = variantLabels[v.id];
                      if (!l) return null;
                      const usp = unitSalePrice(l.mrp, l.netQuantity);
                      const barcodeError = eanProblem(l.barcode);
                      const overMrp = l.mrp !== '' && Number(v.price) > Number(l.mrp);
                      const isPack = (v.packSize ?? 1) > 1;
                      return (
                        <div key={v.id} className="space-y-3 p-4">
                          <div className="flex flex-wrap items-center justify-between gap-2">
                            <div className="min-w-0">
                              <div className="font-medium text-foreground">{v.title}</div>
                              <div className="text-xs text-muted-foreground">
                                Selling price {money(v.price)}
                                {v.sku ? ` · ${v.sku}` : ''}
                                {isPack ? ` · pack of ${v.packSize}` : ''}
                              </div>
                            </div>
                            {v.item ? (
                              <Link href={`/admin/items/${v.item.id}`} className="inline-flex items-center gap-1.5 text-xs text-gold-ink hover:underline">
                                <Boxes className="size-3.5" strokeWidth={1.5} /> {v.item.name}
                              </Link>
                            ) : isPack ? (
                              <span className="text-xs text-muted-foreground">Uses the single&apos;s stock item</span>
                            ) : (
                              <Button size="sm" onClick={() => createStockItem(v.id)} disabled={stockItemBusy === v.id}>
                                <PackagePlus /> Create stock item
                              </Button>
                            )}
                          </div>
                          <div className="grid gap-3 sm:grid-cols-2">
                            <Field label="Net quantity" required>
                              <div className="flex gap-1.5">
                                <Input type="number" min="0" step="0.001" value={l.netQuantity} onChange={(e) => setVariantLabel(v.id, { netQuantity: e.target.value })} className="min-w-0 flex-1" />
                                <Select value={l.netUnit} onChange={(e) => setVariantLabel(v.id, { netUnit: e.target.value })} className="w-20" aria-label="Unit">
                                  {NET_UNITS.map((u) => (
                                    <option key={u.value} value={u.value}>
                                      {u.label}
                                    </option>
                                  ))}
                                </Select>
                              </div>
                            </Field>
                            <Field label="MRP (incl. of all taxes)" required error={overMrp ? `Selling price ${money(v.price)} is above this MRP` : undefined}>
                              <Input type="number" min="0" step="0.01" value={l.mrp} onChange={(e) => setVariantLabel(v.id, { mrp: e.target.value })} />
                            </Field>
                            <Field label="Unit sale price" hint="MRP ÷ net quantity">
                              <div className="flex h-9 items-center rounded-md border border-dashed border-border bg-muted/30 px-3 text-sm font-medium tabular-nums text-foreground">
                                {usp !== null ? `₹${usp.toFixed(3)} / ${perUnit(l.netUnit)}` : '—'}
                              </div>
                            </Field>
                            <Field label="Barcode (EAN-13)" error={barcodeError ?? undefined} hint={l.barcode ? 'Check digit OK' : 'Optional until GS1 numbers arrive'}>
                              <Input inputMode="numeric" maxLength={13} value={l.barcode} onChange={(e) => setVariantLabel(v.id, { barcode: e.target.value.replace(/\D/g, '') })} className="font-mono" placeholder="890…" />
                            </Field>
                          </div>
                          <div className="flex flex-wrap gap-5 text-sm">
                            <label className="flex items-center gap-2">
                              <Checkbox checked={l.isSample} onCheckedChange={(c) => setVariantLabel(v.id, { isSample: Boolean(c) })} /> Mini / sample
                            </label>
                            <label className="flex items-center gap-2">
                              <Checkbox checked={l.isTester} onCheckedChange={(c) => setVariantLabel(v.id, { isTester: Boolean(c) })} /> Tester
                            </label>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </Card>
              </TabsContent>
            )}

            {isCombo && (
              <TabsContent value="combo" className="space-y-5">
                {product.variants.map((v) => (
                  <ComboContents
                    key={`${v.id}-${JSON.stringify(v.components ?? [])}`}
                    productId={product.id}
                    variant={v}
                    pickable={pickable}
                    hsCode={variantLabels[v.id]?.hsCode ?? ''}
                    taxRate={variantLabels[v.id]?.bundleTaxRate ?? ''}
                    onTaxChange={(patch) => setVariantLabel(v.id, patch)}
                    onSaved={load}
                  />
                ))}
                {product.variants.map((v) => {
                  const l = variantLabels[v.id];
                  if (!l) return null;
                  return (
                    <Card key={`mrp-${v.id}`} title={`${v.title} — MRP & barcode`}>
                      <div className="grid gap-3 sm:grid-cols-2">
                        <Field label="MRP (incl. of all taxes)" required>
                          <Input type="number" min="0" step="0.01" value={l.mrp} onChange={(e) => setVariantLabel(v.id, { mrp: e.target.value })} />
                        </Field>
                        <Field label="Barcode (EAN-13)" error={eanProblem(l.barcode) ?? undefined}>
                          <Input inputMode="numeric" maxLength={13} value={l.barcode} onChange={(e) => setVariantLabel(v.id, { barcode: e.target.value.replace(/\D/g, '') })} className="font-mono" />
                        </Field>
                      </div>
                    </Card>
                  );
                })}
              </TabsContent>
            )}

            <TabsContent value="media">
              <MediaEditor media={media} onChange={setMedia} />
            </TabsContent>

            <TabsContent value="sales">
              <LoadedSalesSummary
                endpoint={`/products/${id}/sales-summary`}
                title="Sales"
                quantityLabel="Units sold"
                revenueLabel="Sales"
                emptyMessage="Nothing sold in this period. Cancelled and draft orders are left out."
              />
            </TabsContent>
          </Tabs>
        </div>

        <div className="space-y-5">
          <Card title="Status">
            <Field
              label="Product status"
              hint={readyBlocked ? 'Ready to sell unlocks once the basics below are ticked' : undefined}
            >
              <Select value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })} className="w-full">
                <option value="ACTIVE" disabled={Boolean(readyBlocked)}>
                  Ready to sell
                </option>
                <option value="DRAFT">Draft</option>
                <option value="ARCHIVED">Archived</option>
              </Select>
            </Field>
          </Card>

          <ReadinessCard readiness={readiness} />

          {!isCombo && tab === 'label' && (
            <div className="space-y-2">
              {product.variants.length > 1 && (
                <Select value={previewVariant?.id ?? ''} onChange={(e) => setPreviewVariantId(e.target.value)} className="w-full" aria-label="Preview size">
                  {product.variants.map((v) => (
                    <option key={v.id} value={v.id}>
                      Preview: {v.title}
                    </option>
                  ))}
                </Select>
              )}
            </div>
          )}

          {tab !== 'label' && (
            <Card title="Pricing summary">
              <div className="space-y-2 text-sm">
                {product.variants.map((v) => {
                  const unit = costOf(v.itemId);
                  const m = marginOf(v.price, unit != null ? unit * (v.packSize ?? 1) : null);
                  return (
                    <div key={v.id} className="flex items-baseline justify-between gap-2">
                      <span className="min-w-0 truncate text-muted-foreground">{v.title}</span>
                      <span className="shrink-0 text-right">
                        <span className="font-medium tabular-nums">{money(v.price)}</span>
                        <span className={`ml-2 text-xs tabular-nums ${m == null ? 'text-muted-foreground/60' : m.margin < 0 ? 'font-medium text-destructive' : 'text-muted-foreground'}`}>
                          {m ? `${m.margin.toFixed(1)}%` : isCombo ? '' : 'no cost'}
                        </span>
                      </span>
                    </div>
                  );
                })}
              </div>
            </Card>
          )}
        </div>
      </div>

      <SaveBar>
        <Button variant="primary" onClick={save} disabled={saving}>
          {saving && <Spinner className="border-primary-foreground/30 border-t-primary-foreground" />}
          Save
        </Button>
        <Button asChild variant="ghost">
          <Link href={isCombo ? '/bundles' : '/products'}>Cancel</Link>
        </Button>
      </SaveBar>

    </>
  );
}
