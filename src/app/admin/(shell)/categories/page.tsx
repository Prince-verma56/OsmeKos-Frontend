'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { api, errorMessage } from '@/lib/api';
import {
  useRowSelection, SelectBox, BulkBar,
} from '@/components/BulkActions';
import {
  Badge, Button, Card, ErrorBox, Field, Input, Loading, PageHeader,
  Select, Spinner, Textarea,
} from '@/components/ui';
import { Chevron } from '@/components/SearchSelect';

type Category = {
  id: string;
  name: string;
  slug: string;
  parentId: string | null;
  path: string | null;
  taxonomyRef: string | null;
  description: string | null;
  imageUrl: string | null;
  position: number;
  isActive: boolean;
  createdAt: string;
  productCount: number;
  childCount: number;
};

type Node = Category & { depth: number };

type FormState = {
  name: string;
  slug: string;
  parentId: string;
  description: string;
  taxonomyRef: string;
  position: string;
  isActive: boolean;
};

const blankForm = (parentId = ''): FormState => ({
  name: '',
  slug: '',
  parentId,
  description: '',
  taxonomyRef: '',
  position: '0',
  isActive: true,
});

const slugify = (s: string) =>
  s.toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');

function flatten(rows: Category[]): Node[] {
  const byParent = new Map<string | null, Category[]>();
  for (const c of rows) {
    const key = c.parentId ?? null;
    if (!byParent.has(key)) byParent.set(key, []);
    byParent.get(key)!.push(c);
  }
  for (const list of byParent.values()) {
    list.sort((a, b) => a.position - b.position || a.name.localeCompare(b.name));
  }

  const known = new Set(rows.map((r) => r.id));
  const out: Node[] = [];
  const walk = (parentId: string | null, depth: number) => {
    for (const c of byParent.get(parentId) ?? []) {
      out.push({ ...c, depth });
      walk(c.id, depth + 1);
    }
  };
  walk(null, 0);
  for (const c of rows) {
    if (c.parentId && !known.has(c.parentId)) out.push({ ...c, depth: 0 });
  }
  return out;
}

function ancestorNames(rows: Category[], node: Category): string[] {
  const byId = new Map(rows.map((c) => [c.id, c]));
  const out: string[] = [];
  const seen = new Set([node.id]);
  let cur = node.parentId;
  while (cur && byId.has(cur) && !seen.has(cur)) {
    seen.add(cur);
    const parent = byId.get(cur)!;
    out.unshift(parent.name);
    cur = parent.parentId;
  }
  return out;
}

function subtreeIds(rows: Category[], id: string): Set<string> {
  const out = new Set([id]);
  let grew = true;
  while (grew) {
    grew = false;
    for (const c of rows) {
      if (c.parentId && out.has(c.parentId) && !out.has(c.id)) {
        out.add(c.id);
        grew = true;
      }
    }
  }
  return out;
}

export default function CategoriesPage() {
  const [rows, setRows] = useState<Category[]>([]);
  const sel = useRowSelection(rows.map((r) => r.id));
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [formError, setFormError] = useState('');
  const [saving, setSaving] = useState(false);
  const [busyId, setBusyId] = useState('');
  const [search, setSearch] = useState('');

  const [editingId, setEditingId] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<FormState>(blankForm());
  const [slugTouched, setSlugTouched] = useState(false);

  const [quickName, setQuickName] = useState('');
  const [quickParent, setQuickParent] = useState('');
  const [quickBusy, setQuickBusy] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const res = await api.get<{ data: Category[] }>('/categories');
      setRows(res.data);
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const t = setTimeout(load, 0);
    return () => clearTimeout(t);
  }, [load]);

  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());

  const toggleNode = (id: string) =>
    setCollapsed((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const nodes = useMemo(() => {
    const tree = flatten(rows);
    if (!search.trim()) {
      if (collapsed.size === 0) return tree;
      const out: typeof tree = [];
      let hideBelow: number | null = null;
      for (const n of tree) {
        if (hideBelow !== null && n.depth > hideBelow) continue;
        hideBelow = null;
        out.push(n);
        if (collapsed.has(n.id)) hideBelow = n.depth;
      }
      return out;
    }
    const q = search.trim().toLowerCase();
    return tree
      .filter(
        (n) =>
          n.name.toLowerCase().includes(q) ||
          n.slug.toLowerCase().includes(q) ||
          (n.path ?? '').toLowerCase().includes(q)
      )
      .map((n) => ({ ...n, depth: 0 }));
  }, [rows, search, collapsed]);

  const parentOptions = useMemo(() => {
    const banned = editingId ? subtreeIds(rows, editingId) : new Set<string>();
    return flatten(rows).filter((n) => !banned.has(n.id));
  }, [rows, editingId]);

  function startCreate(parentId = '') {
    setEditingId(null);
    setForm(blankForm(parentId));
    setSlugTouched(false);
    setFormError('');
    setOpen(true);
  }

  function startEdit(c: Category) {
    setEditingId(c.id);
    setForm({
      name: c.name,
      slug: c.slug,
      parentId: c.parentId ?? '',
      description: c.description ?? '',
      taxonomyRef: c.taxonomyRef ?? '',
      position: String(c.position),
      isActive: c.isActive,
    });
    setSlugTouched(true);
    setFormError('');
    setOpen(true);
  }

  async function save() {
    setFormError('');
    if (!form.name.trim()) {
      setFormError('Name is required');
      return;
    }
    setSaving(true);

    const payload = {
      name: form.name.trim(),
      slug: (form.slug.trim() || slugify(form.name)) || undefined,
      parentId: form.parentId || null,
      description: form.description.trim() || undefined,
      taxonomyRef: form.taxonomyRef.trim() || undefined,
      position: Number(form.position) || 0,
      isActive: form.isActive,
    };

    try {
      if (editingId) await api.patch(`/categories/${editingId}`, payload);
      else await api.post('/categories', payload);
      setOpen(false);
      await load();
    } catch (err) {
      setFormError(errorMessage(err));
    } finally {
      setSaving(false);
    }
  }

  async function quickAdd() {
    const name = quickName.trim();
    if (!name) return;
    setQuickBusy(true);
    setError('');
    try {
      await api.post('/categories', {
        name,
        slug: slugify(name),
        parentId: quickParent || null,
      });
      setQuickName('');
      await load();
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setQuickBusy(false);
    }
  }

  async function remove(c: Category) {
    if (!confirm(`Delete "${c.name}"?`)) return;
    setBusyId(c.id);
    setError('');
    try {
      await api.del(`/categories/${c.id}`);
      if (editingId === c.id) setOpen(false);
      await load();
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusyId('');
    }
  }

  return (
    <>
      <PageHeader
        title="Categories"
        subtitle="The catalogue tree products are filed under"
        actions={
          <Button variant="primary" onClick={() => startCreate()}>
            + New category
          </Button>
        }
      />

      {error && (
        <div className="mb-4">
          <ErrorBox message={error} onRetry={load} />
        </div>
      )}

      <div className="grid gap-5 lg:grid-cols-3">
        <div className="lg:col-span-2 min-w-0">
          <div className="rounded-lg border border-border bg-card">
            <div className="flex flex-wrap items-end gap-2 border-b border-border p-3">
              <Field label="New category name">
                <Input
                  value={quickName}
                  onChange={(e) => setQuickName(e.target.value)}
                  placeholder="Body lotion"
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      quickAdd();
                    }
                  }}
                />
              </Field>
              <Field label="Under">
                <Select value={quickParent} onChange={(e) => setQuickParent(e.target.value)}>
                  <option value="">- Top level -</option>
                  {flatten(rows).map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.depth > 0 ? '└ ' : ''}
                      {p.name}
                    </option>
                  ))}
                </Select>
              </Field>
              <Button variant="primary" disabled={quickBusy || !quickName.trim()} onClick={quickAdd}>
                {quickBusy && <Spinner className="border-card/40 border-t-card" />}
                Create
              </Button>
              <span className="text-xs text-muted-foreground">slug auto-generated</span>
            </div>

            <div className="flex flex-wrap items-center gap-2 border-b border-border p-3">
              <Input
                placeholder="Search categories…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="max-w-xs"
              />
              {search && (
                <Button variant="ghost" onClick={() => setSearch('')}>
                  Clear
                </Button>
              )}
              <span className="ml-auto text-xs text-muted-foreground">
                {rows.length} categor{rows.length === 1 ? 'y' : 'ies'}
              </span>
            </div>

            {sel.count > 0 && (
              <div className="border-b border-border px-4 py-2">
                <BulkBar
                  count={sel.count}
                  noun="category"
                  endpoint="/categories/bulk-delete"
                  ids={sel.selected}
                  onDone={() => {
                    sel.clear();
                    load();
                  }}
                  onClear={sel.clear}
                />
              </div>
            )}

            {loading ? (
              <Loading />
            ) : nodes.length === 0 ? (
              <div className="px-4 py-10 text-center text-sm text-muted-foreground">
                {search ? 'Nothing matches that search' : 'No categories yet — create the first one'}
              </div>
            ) : (
              <ul className="divide-y divide-border">
                {nodes.map((n) => (
                  <li
                    key={n.id}
                    className="flex items-center gap-3 px-4 py-2.5 hover:bg-muted/60"
                  >
                    <SelectBox checked={sel.isSelected(n.id)} onChange={() => sel.toggle(n.id)} />
                    <div
                      className="flex min-w-0 flex-1 items-start gap-1.5"
                      style={{ paddingLeft: `${n.depth * 22}px` }}
                    >
                      {n.childCount > 0 && !search.trim() ? (
                        <button
                          type="button"
                          onClick={() => toggleNode(n.id)}
                          aria-expanded={!collapsed.has(n.id)}
                          aria-label={
                            collapsed.has(n.id)
                              ? `Show sub-categories of ${n.name}`
                              : `Hide sub-categories of ${n.name}`
                          }
                          className="mt-0.5 rounded p-0.5 text-muted-foreground transition-colors
                            hover:bg-border hover:text-foreground focus-visible:outline-none
                            focus-visible:ring-2 focus-visible:ring-gold/20
"
                        >
                          <Chevron open={!collapsed.has(n.id)} />
                        </button>
                      ) : (
                        <span className="w-[18px] shrink-0" aria-hidden="true" />
                      )}
                      <div className="min-w-0 flex-1">
                      {(() => {
                        const trail = ancestorNames(rows, n);
                        return trail.length > 0 ? (
                          <div className="truncate text-xs text-muted-foreground">
                            {trail.join(' › ')} ›
                          </div>
                        ) : null;
                      })()}
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="truncate text-[15px] font-medium text-foreground">
                          {n.name}
                        </span>
                        {!n.isActive && <Badge tone="gray">Inactive</Badge>}
                        {n.childCount > 0 && (
                          <span className="text-xs text-muted-foreground">
                            {n.childCount} sub-categor{n.childCount === 1 ? 'y' : 'ies'}
                          </span>
                        )}
                        </div>
                      </div>
                    </div>

                    {n.productCount > 0 ? (
                      <Link href={`/admin/products?categoryId=${n.id}`}>
                        <Badge tone="blue">
                          {n.productCount} product{n.productCount === 1 ? '' : 's'}
                        </Badge>
                      </Link>
                    ) : (
                      <Badge tone="gray">no products</Badge>
                    )}

                    <div className="flex shrink-0 gap-1.5">
                      <Button size="sm" onClick={() => startCreate(n.id)}>
                        + Sub
                      </Button>
                      <Button size="sm" onClick={() => startEdit(n)}>
                        Edit
                      </Button>
                      <Button
                        size="sm"
                        variant="danger"
                        disabled={busyId === n.id}
                        onClick={() => remove(n)}
                      >
                        Delete
                      </Button>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <p className="mt-3 text-xs text-muted-foreground">
            Name the category for what it is — “Body lotion”, not “Body lotion in Body care”. Its place in
            the tree already supplies the context, and the URL slug is derived for you. A category
            cannot be deleted while it still holds sub-categories or products.
          </p>
        </div>

        <div>
          {open ? (
            <Card title={editingId ? 'Edit category' : 'New category'}>
              {formError && (
                <div className="mb-4">
                  <ErrorBox message={formError} />
                </div>
              )}

              <div className="space-y-4">
                <Field label="Name" required>
                  <Input
                    value={form.name}
                    onChange={(e) => {
                      const name = e.target.value;
                      setForm((f) => ({
                        ...f,
                        name,
                        slug: slugTouched ? f.slug : slugify(name),
                      }));
                    }}
                    placeholder="Body lotion"
                  />
                </Field>

                <Field label="Slug" hint="Lowercase letters, numbers and hyphens only">
                  <Input
                    value={form.slug}
                    onChange={(e) => {
                      setSlugTouched(true);
                      setForm({ ...form, slug: e.target.value });
                    }}
                    placeholder="body-lotion"
                    className="font-mono"
                  />
                </Field>

                <Field label="Parent category">
                  <Select
                    value={form.parentId}
                    onChange={(e) => setForm({ ...form, parentId: e.target.value })}
                    className="w-full"
                  >
                    <option value="">— Top level —</option>
                    {parentOptions.map((p) => (
                      <option key={p.id} value={p.id}>
                        {' '.repeat(p.depth * 3)}
                        {p.depth > 0 ? '└ ' : ''}
                        {p.name}
                      </option>
                    ))}
                  </Select>
                </Field>

                <Field label="Description">
                  <Textarea
                    rows={3}
                    value={form.description}
                    onChange={(e) => setForm({ ...form, description: e.target.value })}
                    placeholder="Everyday lotions and body butters"
                  />
                </Field>

                <div className="grid grid-cols-2 gap-3">
                  <Field label="Position" hint="Sort order among siblings">
                    <Input
                      type="number"
                      min="0"
                      value={form.position}
                      onChange={(e) => setForm({ ...form, position: e.target.value })}
                    />
                  </Field>
                  <Field label="Taxonomy ref" hint="Optional external mapping">
                    <Input
                      value={form.taxonomyRef}
                      onChange={(e) => setForm({ ...form, taxonomyRef: e.target.value })}
                      placeholder="gid://shopify/…"
                    />
                  </Field>
                </div>

                <label className="flex items-center gap-2 text-sm text-foreground">
                  <input
                    type="checkbox"
                    checked={form.isActive}
                    onChange={(e) => setForm({ ...form, isActive: e.target.checked })}
                    className="h-4 w-4 rounded border-border"
                  />
                  Active
                </label>

                <div className="flex gap-2 pt-1">
                  <Button variant="primary" disabled={saving} onClick={save}>
                    {saving && <Spinner className="border-card/40 border-t-card" />}
                    {editingId ? 'Save changes' : 'Create category'}
                  </Button>
                  <Button onClick={() => setOpen(false)}>Cancel</Button>
                </div>
              </div>
            </Card>
          ) : (
            <Card title="Category tree">
              <p className="text-sm text-muted-foreground">
                Categories are a single hierarchy — each product files under exactly one of them.
                Use <strong>Collections</strong> instead for merchandising groups a product can
                belong to many of at once.
              </p>
              <div className="mt-3">
                <Button variant="primary" onClick={() => startCreate()}>
                  + New category
                </Button>
              </div>
            </Card>
          )}
        </div>
      </div>
    </>
  );
}
