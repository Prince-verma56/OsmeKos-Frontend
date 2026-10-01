'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { api, errorMessage, type Paged } from '@/lib/api';
import { useToast } from '@/lib/toast';
import {
  Badge, Button, Card, ErrorBox, Field, Input, Loading,
  PageHeader, Spinner, Textarea,
} from '@/components/ui';

type Role = {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  permissions: string[];
  isSystem: boolean;
  adminUserCount: number;
};

type Group = { group: string; permissions: string[] };

const WILDCARD = '*';

const CHANGES = /:(write|manage)$/;

const readOf = (permission: string) => permission.replace(CHANGES, ':read');
const moduleOf = (permission: string) => permission.slice(0, permission.indexOf(':'));
const actionOf = (permission: string) => permission.slice(permission.indexOf(':') + 1);

const COLUMNS = [
  { key: 'read', label: 'Read', actions: ['read'] },
  { key: 'write', label: 'Write', actions: ['write', 'manage'] },
  { key: 'delete', label: 'Delete', actions: ['delete'] },
];

const COLUMN_ACTIONS = new Set(COLUMNS.flatMap((c) => c.actions));

const ACTION_LABELS: Record<string, string> = { gst: 'GST' };

const actionLabel = (action: string) =>
  ACTION_LABELS[action] ?? action.charAt(0).toUpperCase() + action.slice(1);

export default function RolesPage() {
  const toast = useToast();

  const [rows, setRows] = useState<Role[]>([]);
  const [groups, setGroups] = useState<Group[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [picked, setPicked] = useState<string[]>([]);
  const [formError, setFormError] = useState('');
  const [saving, setSaving] = useState(false);
  const [busyId, setBusyId] = useState('');

  const load = useCallback(async () => {
    setError('');
    try {
      const [list, perms] = await Promise.all([
        api.get<Paged<Role>>('/roles', { limit: 100 }),
        api.get<{ data: { groups: Group[] } }>('/roles/permissions'),
      ]);
      setRows(list.data);
      setGroups(perms.data.groups);
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

  const selected = useMemo(
    () => rows.find((r) => r.id === selectedId) ?? null,
    [rows, selectedId]
  );

  const editing = creating || Boolean(selected);
  const isSuperAdmin = selected?.slug === 'owner';
  const hasWildcard = picked.includes(WILDCARD);

  function openRole(role: Role) {
    setCreating(false);
    setSelectedId(role.id);
    setName(role.name);
    setDescription(role.description ?? '');
    setPicked(role.permissions);
    setFormError('');
  }

  function openNew() {
    setCreating(true);
    setSelectedId(null);
    setName('');
    setDescription('');
    setPicked([]);
    setFormError('');
  }

  function closeEditor() {
    setCreating(false);
    setSelectedId(null);
    setFormError('');
  }

  const known = useMemo(() => new Set(groups.flatMap((g) => g.permissions)), [groups]);

  function toggle(permission: string, on: boolean) {
    setPicked((prev) => {
      const next = new Set(prev);
      if (on) {
        next.add(permission);
        const read = readOf(permission);
        if (read !== permission && known.has(read)) next.add(read);
      } else {
        next.delete(permission);
        if (permission.endsWith(':read')) {
          next.delete(`${moduleOf(permission)}:write`);
          next.delete(`${moduleOf(permission)}:manage`);
        }
      }
      return [...next];
    });
  }

  function toggleGroup(group: Group, on: boolean) {
    setPicked((prev) => {
      const next = new Set(prev);
      group.permissions.forEach((p) => (on ? next.add(p) : next.delete(p)));
      return [...next];
    });
  }

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setFormError('');

    if (!creating && !selected) return;
    if (creating && name.trim().length < 2) {
      setFormError('Name must be at least 2 characters');
      return;
    }

    setSaving(true);
    try {
      if (creating) {
        await api.post('/roles', {
          name: name.trim(),
          description: description.trim() || undefined,
          permissions: picked,
        });
        toast.success(`Role “${name.trim()}” created`);
      } else if (selected) {
        await api.patch(`/roles/${selected.id}`, {
          name: selected.isSystem ? undefined : name.trim(),
          description: description.trim() || undefined,
          permissions: isSuperAdmin ? undefined : picked,
        });
        toast.success(`Role “${selected.name}” updated`);
      }
      closeEditor();
      await load();
    } catch (err) {
      setFormError(errorMessage(err));
    } finally {
      setSaving(false);
    }
  }

  async function remove(role: Role) {
    if (!confirm(`Delete the role “${role.name}”?`)) return;
    setBusyId(role.id);
    setError('');
    try {
      await api.del(`/roles/${role.id}`);
      if (selectedId === role.id) closeEditor();
      toast.success(`Role “${role.name}” deleted`);
      await load();
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusyId('');
    }
  }

  const grantedCount = hasWildcard
    ? groups.reduce((n, g) => n + g.permissions.length, 0)
    : picked.length;

  return (
    <>
      <PageHeader
        title="Roles"
        subtitle="What each staff member is allowed to see and change"
        actions={
          <Button variant="primary" onClick={openNew}>
            + New role
          </Button>
        }
      />

      {error && (
        <div className="mb-4">
          <ErrorBox message={error} onRetry={load} />
        </div>
      )}

      {loading ? (
        <Loading label="Loading roles…" />
      ) : (
        <div className="grid gap-5 lg:grid-cols-3">
          <div className="space-y-2">
            {rows.map((role) => {
              const active = role.id === selectedId;
              return (
                <button
                  key={role.id}
                  type="button"
                  onClick={() => openRole(role)}
                  className={`w-full rounded-lg border p-3 text-left transition-colors
                    focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold/20
                     ${
                      active
                        ? 'border-border bg-card shadow-sm'
                        : 'border-border bg-card hover:border-border'
                    }`}
                >
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-foreground">
                      {role.name}
                    </span>
                    {role.isSystem && <Badge tone="blue">built-in</Badge>}
                  </div>
                  <div className="mt-0.5 font-mono text-[11px] text-muted-foreground">
                    {role.slug}
                  </div>
                  {role.description && (
                    <p className="mt-1.5 text-xs text-muted-foreground">
                      {role.description}
                    </p>
                  )}
                  <div className="mt-2 flex items-center gap-3 text-[11px] text-muted-foreground">
                    <span>
                      {role.permissions.includes(WILDCARD)
                        ? 'Full access'
                        : `${role.permissions.length} permission${role.permissions.length === 1 ? '' : 's'}`}
                    </span>
                    <span>·</span>
                    <span>
                      {role.adminUserCount} user{role.adminUserCount === 1 ? '' : 's'}
                    </span>
                  </div>
                </button>
              );
            })}

            <p className="pt-1 text-xs text-muted-foreground">
              Built-in roles cannot be renamed or deleted, but you can still change what they are
              allowed to do. A role given to any staff member cannot be deleted until they are moved
              to another role.
            </p>
          </div>

          <div className="lg:col-span-2 min-w-0">
            {!editing ? (
              <Card title="Permissions">
                <p className="text-sm text-muted-foreground">
                  Pick a role on the left to see and change what it can do, or create a new one.
                </p>
                <p className="mt-2 text-sm text-muted-foreground">
                  <strong>Read</strong> lets someone open the screen, <strong>write</strong> lets
                  them change what is on it, and <strong>delete</strong> lets them remove records.
                  Ticking write turns on read automatically, because write on its own does nothing.
                  A few areas, such as Orders and Reports, have extra choices named next to them.
                </p>
              </Card>
            ) : (
              <Card
                title={creating ? 'New role' : selected?.name}
                action={
                  !creating &&
                  selected &&
                  !selected.isSystem && (
                    <Button
                      size="sm"
                      variant="danger"
                      disabled={busyId === selected.id}
                      onClick={() => remove(selected)}
                    >
                      Delete role
                    </Button>
                  )
                }
              >
                {formError && (
                  <div className="mb-4">
                    <ErrorBox message={formError} />
                  </div>
                )}

                <form onSubmit={save} className="space-y-5">
                  <div className="grid gap-3 sm:grid-cols-2">
                    <Field
                      label="Name"
                      required={creating}
                      hint={selected?.isSystem ? 'Built-in roles keep their name' : undefined}
                    >
                      <Input
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        placeholder="Warehouse Staff"
                        disabled={selected?.isSystem}
                        required={creating}
                      />
                    </Field>
                    <Field label="Description">
                      <Textarea
                        rows={2}
                        value={description}
                        onChange={(e) => setDescription(e.target.value)}
                        placeholder="Receives stock and picks orders"
                      />
                    </Field>
                  </div>

                  {hasWildcard ? (
                    <div className="rounded-lg border border-gold/30 bg-gold-soft/60 p-4 text-sm text-foreground">
                      <p className="font-medium">Full access ({WILDCARD})</p>
                      <p className="mt-1">
                        This role can do everything, including anything added later.
                        {isSuperAdmin && ' Owner / Admin must always keep full access, so it cannot be taken away.'}
                      </p>
                    </div>
                  ) : (
                    <div>
                      <div className="mb-2 flex items-center justify-between">
                        <span className="text-xs font-medium text-muted-foreground">
                          Permissions
                        </span>
                        <span className="text-xs text-muted-foreground">
                          {grantedCount} granted
                        </span>
                      </div>

                      <div className="overflow-x-auto rounded-lg border border-border">
                        <table className="w-full text-sm">
                          <thead>
                            <tr className="bg-muted/60">
                              <th className="px-2 py-2 text-left text-xs font-medium text-muted-foreground sm:px-3">
                                Area
                              </th>
                              {COLUMNS.map((c) => (
                                <th
                                  key={c.key}
                                  className="w-14 px-1 py-2 text-center text-xs font-medium text-muted-foreground sm:w-20 sm:px-3"
                                >
                                  {c.label}
                                </th>
                              ))}
                              <th className="w-12 px-2 py-2 text-right text-xs font-medium text-muted-foreground sm:w-16 sm:px-3">
                                <span className="sr-only">Tick or untick the whole area</span>
                              </th>
                            </tr>
                          </thead>
                          <tbody>
                            {groups.map((g) => {
                              const all = g.permissions.every((p) => picked.includes(p));
                              const extras = g.permissions.filter((p) => !COLUMN_ACTIONS.has(actionOf(p)));
                              const inColumns = extras.length < g.permissions.length;
                              return (
                                <tr
                                  key={g.group}
                                  className="border-t border-border align-top"
                                >
                                  <td
                                    colSpan={inColumns ? undefined : COLUMNS.length + 1}
                                    className="px-2 py-2 text-foreground sm:px-3"
                                  >
                                    {g.group}
                                    {extras.length > 0 && (
                                      <div className="mt-1.5 flex flex-wrap gap-x-3 gap-y-1.5">
                                        {extras.map((p) => (
                                          <label
                                            key={p}
                                            className="inline-flex items-center gap-1.5 text-xs text-foreground/90"
                                          >
                                            <input
                                              type="checkbox"
                                              checked={picked.includes(p)}
                                              onChange={(e) => toggle(p, e.target.checked)}
                                            />
                                            {actionLabel(actionOf(p))}
                                          </label>
                                        ))}
                                      </div>
                                    )}
                                  </td>
                                  {inColumns &&
                                    COLUMNS.map((c) => {
                                      const p = g.permissions.find((x) => c.actions.includes(actionOf(x)));
                                      return (
                                        <td key={c.key} className="px-1 py-2 text-center sm:px-3">
                                          {p ? (
                                            <input
                                              type="checkbox"
                                              checked={picked.includes(p)}
                                              onChange={(e) => toggle(p, e.target.checked)}
                                              aria-label={`${g.group}: ${actionLabel(actionOf(p))}`}
                                            />
                                          ) : (
                                            <span aria-hidden className="text-muted-foreground/50">
                                              –
                                            </span>
                                          )}
                                        </td>
                                      );
                                    })}
                                  <td className="px-2 py-2 text-right sm:px-3">
                                    <button
                                      type="button"
                                      onClick={() => toggleGroup(g, !all)}
                                      aria-label={`${all ? 'Untick' : 'Tick'} everything in ${g.group}`}
                                      className="text-xs text-muted-foreground underline-offset-2
                                        hover:underline"
                                    >
                                      {all ? 'none' : 'all'}
                                    </button>
                                  </td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}

                  <div className="flex items-center gap-2">
                    <Button type="submit" variant="primary" disabled={saving}>
                      {saving && <Spinner className="border-card/40 border-t-card" />}
                      {creating ? 'Create role' : 'Save changes'}
                    </Button>
                    <Button type="button" onClick={closeEditor}>
                      Cancel
                    </Button>
                    {isSuperAdmin && (
                      <span className="text-xs text-muted-foreground">
                        Owner / Admin always keeps full access. Only the description can change.
                      </span>
                    )}
                  </div>
                </form>
              </Card>
            )}
          </div>
        </div>
      )}
    </>
  );
}
