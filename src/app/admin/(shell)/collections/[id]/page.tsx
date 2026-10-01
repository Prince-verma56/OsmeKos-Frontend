'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { api, money, dateTime, errorMessage, type Paged } from '@/lib/api';
import {
  Badge, Button, Card, EmptyRow, ErrorBox, Field, Input, Loading, PageHeader,
  Select, Table, Td, Textarea, Th, Spinner,
} from '@/components/ui';
import { RuleBuilder, blankRule, type RuleDraft } from '@/components/RuleBuilder';
import { useToast } from '@/lib/toast';
import { Thumb } from '@/components/SearchSelect';
import { PageCrumb } from '@/lib/crumbs';

type Collection = {
  id: string;
  title: string;
  handle: string;
  descriptionHtml: string | null;
  type: 'MANUAL' | 'AUTOMATIC';
  ruleMatch: 'ALL' | 'ANY';
  sortOrder: string;
  status: 'ACTIVE' | 'DRAFT' | 'ARCHIVED';
  productCount: number;
  updatedAt: string;
  rules: (RuleDraft & { id: string })[];
};

type Member = {
  id: string;
  title: string;
  handle: string;
  status: string;
  productType: string | null;
  variants: { id: string; price: string; sku: string | null }[];
  media?: { url: string }[];
};

type Candidate = { id: string; title: string; priceMin: number | null; media?: { url: string }[] };

export default function CollectionDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();

  const [collection, setCollection] = useState<Collection | null>(null);
  const [members, setMembers] = useState<Member[]>([]);
  const [resolvedBy, setResolvedBy] = useState<string>('');
  const [candidates, setCandidates] = useState<Candidate[]>([]);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const toast = useToast();

  const [form, setForm] = useState({
    title: '',
    descriptionHtml: '',
    status: 'ACTIVE',
    sortOrder: 'BEST_SELLING',
    ruleMatch: 'ALL' as 'ALL' | 'ANY',
  });
  const [rules, setRules] = useState<RuleDraft[]>([]);
  const [addIds, setAddIds] = useState<string[]>([]);

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const [c, p] = await Promise.all([
        api.get<{ data: Collection }>(`/collections/${id}`),
        api.get<Paged<Member>>(`/collections/${id}/products`, { limit: 100 }),
      ]);
      setCollection(c.data);
      setMembers(p.data);
      setResolvedBy(String(p.meta.resolvedBy ?? ''));
      setForm({
        title: c.data.title,
        descriptionHtml: c.data.descriptionHtml ?? '',
        status: c.data.status,
        sortOrder: c.data.sortOrder,
        ruleMatch: c.data.ruleMatch,
      });
      setRules(c.data.rules.length ? c.data.rules : [blankRule()]);

      if (c.data.type === 'MANUAL') {
        const all = await api.get<Paged<Candidate>>('/products', { limit: 100 });
        setCandidates(all.data);
      }
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

  function flash(m: string) {
    toast.success(m);
  }

  async function save() {
    if (!collection) return;
    setSaving(true);
    setError('');
    try {
      await api.patch(`/collections/${id}`, {
        title: form.title,
        descriptionHtml: form.descriptionHtml || undefined,
        status: form.status,
        sortOrder: form.sortOrder,
        ruleMatch: form.ruleMatch,
        ...(collection.type === 'AUTOMATIC' && {
          rules: rules.filter((r) => r.value.trim()),
        }),
      });
      flash('Saved');
      await load();
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setSaving(false);
    }
  }

  async function addProducts() {
    if (!addIds.length) return;
    try {
      await api.post(`/collections/${id}/products`, { productIds: addIds });
      setAddIds([]);
      flash('Products added');
      await load();
    } catch (err) {
      setError(errorMessage(err));
    }
  }

  async function removeProduct(productId: string) {
    try {
      await api.del(`/collections/${id}/products`, { productIds: [productId] });
      flash('Product removed');
      await load();
    } catch (err) {
      setError(errorMessage(err));
    }
  }

  async function remove() {
    if (!confirm(`Delete "${collection?.title}"?`)) return;
    try {
      await api.del(`/collections/${id}`);
      router.push('/admin/collections');
    } catch (err) {
      setError(errorMessage(err));
    }
  }

  if (loading) return <Loading />;
  if (!collection) return <ErrorBox message={error || 'Collection not found'} onRetry={load} />;

  const isAuto = collection.type === 'AUTOMATIC';
  const memberIds = new Set(members.map((m) => m.id));
  const addable = candidates.filter((c) => !memberIds.has(c.id));

  return (
    <>
      <PageCrumb label={collection.title} />

      <PageHeader
        title={collection.title}
        subtitle={`${collection.handle} · updated ${dateTime(collection.updatedAt)}`}
        actions={
          <>
            <Badge tone={isAuto ? 'purple' : 'gray'}>{isAuto ? 'Automatic' : 'Manual'}</Badge>
            <Badge status={collection.status}>{collection.status}</Badge>
            <Button variant="danger" onClick={remove}>
              Delete
            </Button>
            <Button variant="primary" onClick={save} disabled={saving}>
              {saving && <Spinner className="border-card/40 border-t-card" />}
              Save
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
        <div className="space-y-5 lg:col-span-2 min-w-0">
          <Card title="Details">
            <div className="space-y-4">
              <Field label="Title" required>
                <Input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} />
              </Field>
              <Field label="Description">
                <Textarea
                  rows={4}
                  value={form.descriptionHtml}
                  onChange={(e) => setForm({ ...form, descriptionHtml: e.target.value })}
                />
              </Field>
            </div>
          </Card>

          {isAuto && (
            <Card title="Conditions">
              <RuleBuilder
                rules={rules}
                onChange={setRules}
                ruleMatch={form.ruleMatch}
                onMatchChange={(m) => setForm({ ...form, ruleMatch: m })}
              />
            </Card>
          )}

          <Card
            title={`Products (${members.length})`}
            padded={false}
            action={
              <span className="text-xs text-muted-foreground">
                {resolvedBy === 'rules' ? 'resolved live from conditions' : 'hand-picked'}
              </span>
            }
          >
            <Table>
              <thead>
                <tr>
                  <Th>Product</Th>
                  <Th>Status</Th>
                  <Th>Type</Th>
                  <Th>Price</Th>
                  {!isAuto && <Th />}
                </tr>
              </thead>
              <tbody>
                {members.length === 0 && (
                  <EmptyRow
                    colSpan={isAuto ? 4 : 5}
                    message={isAuto ? 'No products match these conditions' : 'No products added yet'}
                  />
                )}
                {members.map((m) => (
                  <tr key={m.id} className="hover:bg-muted/60">
                    <Td>
                      <div className="flex items-center gap-2.5">
                        <Thumb url={m.media?.[0]?.url} label={m.title} />
                        <Link
                          href={`/admin/products/${m.id}`}
                          className="min-w-0 font-medium text-gold-ink hover:underline"
                        >
                          {m.title}
                        </Link>
                      </div>
                    </Td>
                    <Td>
                      <Badge status={m.status}>{m.status}</Badge>
                    </Td>
                    <Td>{m.productType ?? '—'}</Td>
                    <Td>{m.variants[0] ? money(m.variants[0].price) : '—'}</Td>
                    {!isAuto && (
                      <Td>
                        <Button size="sm" variant="danger" onClick={() => removeProduct(m.id)}>
                          Remove
                        </Button>
                      </Td>
                    )}
                  </tr>
                ))}
              </tbody>
            </Table>
          </Card>

          {!isAuto && (
            <Card
              title="Add products"
              action={
                <Button size="sm" variant="primary" disabled={!addIds.length} onClick={addProducts}>
                  Add {addIds.length || ''}
                </Button>
              }
            >
              {addable.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  Every product is already in this collection.
                </p>
              ) : (
                <div className="max-h-60 space-y-1 overflow-y-auto">
                  {addable.map((c) => (
                    <label
                      key={c.id}
                      className="flex cursor-pointer items-center gap-2 rounded px-2 py-1.5 text-sm
                        hover:bg-muted/60"
                    >
                      <input
                        type="checkbox"
                        checked={addIds.includes(c.id)}
                        onChange={(e) =>
                          setAddIds(
                            e.target.checked
                              ? [...addIds, c.id]
                              : addIds.filter((x) => x !== c.id)
                          )
                        }
                        className="rounded border-border"
                      />
                      <Thumb url={c.media?.[0]?.url} label={c.title} />
                      <span className="flex-1 truncate text-foreground">
                        {c.title}
                      </span>
                      {c.priceMin !== null && (
                        <span className="text-xs text-muted-foreground">
                          {money(c.priceMin)}
                        </span>
                      )}
                    </label>
                  ))}
                </div>
              )}
            </Card>
          )}
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
                <option value="ARCHIVED">Archived</option>
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

          {isAuto && (
            <Card title="How this works">
              <p className="text-xs leading-relaxed text-muted-foreground">
                Membership is evaluated live against the conditions every time the collection is
                opened, so products join and leave automatically as they change. Hand-picking is
                disabled for automatic collections.
              </p>
            </Card>
          )}
        </div>
      </div>
    </>
  );
}
