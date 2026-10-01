'use client';

import { useCallback, useEffect, useState } from 'react';
import { api, errorMessage, type Paged } from '@/lib/api';
import {
  Badge, Button, Card, EmptyRow, ErrorBox, Field, Input, Loading,
  PageHeader, Select, Table, Td, Th, Spinner,
} from '@/components/ui';

import { CardList, RecordCard } from '@/components/CardList';
import { StateSelect, stateSelectHint } from '@/components/StateSelect';
type Location = {
  id: string;
  name: string;
  code: string;
  type: 'WAREHOUSE' | 'STORE' | 'VIRTUAL';
  isDefault: boolean;
  isActive: boolean;
  contactName: string | null;
  phone: string | null;
  email: string | null;
  addressLine1: string | null;
  addressLine2: string | null;
  city: string | null;
  state: string | null;
  stateCode: string | null;
  pincode: string | null;
  country: string | null;
};

type FormState = {
  name: string; code: string; type: string;
  isDefault: boolean; isActive: boolean;
  contactName: string; phone: string; email: string;
  addressLine1: string; addressLine2: string;
  city: string; state: string; stateCode: string; pincode: string; country: string;
};

const blank = (): FormState => ({
  name: '', code: '', type: 'WAREHOUSE',
  isDefault: false, isActive: true,
  contactName: '', phone: '', email: '',
  addressLine1: '', addressLine2: '',
  city: '', state: '', stateCode: '', pincode: '', country: 'India',
});

const str = (v: string | null) => v ?? '';

export default function LocationsPage() {
  const [rows, setRows] = useState<Location[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [formError, setFormError] = useState('');
  const [saving, setSaving] = useState(false);
  const [busyId, setBusyId] = useState('');
  const [search, setSearch] = useState('');

  const [editingId, setEditingId] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  const [form, setFormState] = useState<FormState>(blank());
  const set = (patch: Partial<FormState>) => setFormState((f) => ({ ...f, ...patch }));

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const res = await api.get<Paged<Location>>('/locations', {
        limit: 100,
        search: search || undefined,
      });
      setRows(res.data);
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setLoading(false);
    }
  }, [search]);

  useEffect(() => {
    const t = setTimeout(load, search ? 300 : 0);
    return () => clearTimeout(t);
  }, [load, search]);

  function startCreate() {
    setEditingId(null);
    setFormState(blank());
    setFormError('');
    setOpen(true);
  }

  function startEdit(l: Location) {
    setEditingId(l.id);
    setFormState({
      name: l.name,
      code: l.code,
      type: l.type,
      isDefault: l.isDefault,
      isActive: l.isActive,
      contactName: str(l.contactName),
      phone: str(l.phone),
      email: str(l.email),
      addressLine1: str(l.addressLine1),
      addressLine2: str(l.addressLine2),
      city: str(l.city),
      state: str(l.state),
      stateCode: str(l.stateCode),
      pincode: str(l.pincode),
      country: l.country ?? 'India',
    });
    setFormError('');
    setOpen(true);
  }

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setFormError('');
    if (!form.name.trim() || form.code.trim().length < 2) {
      setFormError('Name is required and code must be at least 2 characters');
      return;
    }
    setSaving(true);

    const payload = {
      name: form.name.trim(),
      code: form.code.trim().toUpperCase(),
      type: form.type,
      isDefault: form.isDefault,
      isActive: form.isActive,
      contactName: form.contactName.trim() || undefined,
      phone: form.phone.trim() || undefined,
      email: form.email.trim() || undefined,
      addressLine1: form.addressLine1.trim() || undefined,
      addressLine2: form.addressLine2.trim() || undefined,
      city: form.city.trim() || undefined,
      state: form.state.trim() || undefined,
      stateCode: form.stateCode.trim() || undefined,
      pincode: form.pincode.trim() || undefined,
      country: form.country.trim() || 'India',
    };

    try {
      if (editingId) await api.patch(`/locations/${editingId}`, payload);
      else await api.post('/locations', payload);
      setOpen(false);
      await load();
    } catch (err) {
      setFormError(errorMessage(err));
    } finally {
      setSaving(false);
    }
  }

  async function remove(l: Location) {
    if (!confirm(`Delete "${l.name}"?`)) return;
    setBusyId(l.id);
    setError('');
    try {
      await api.del(`/locations/${l.id}`);
      if (editingId === l.id) setOpen(false);
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
        title="Locations"
        subtitle="Warehouses and stores stock is held at"
        actions={
          <Button variant="primary" onClick={startCreate}>
            + New location
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
            <div className="flex flex-wrap items-center gap-2 border-b border-border p-3">
              <Input
                placeholder="Search locations…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="max-w-xs"
              />
              <span className="ml-auto text-xs text-muted-foreground">
                {rows.length} location{rows.length === 1 ? '' : 's'}
              </span>
            </div>

            {loading ? (
              <Loading />
            ) : (
              <>
              <CardList empty="No locations yet — create the first one">
                {rows.map((l) => (
                  <RecordCard
                    key={l.id}
                    title={l.code}
                    date={l.name}
                    primary={[l.city, l.state].filter(Boolean).join(', ') || '—'}
                    secondary={l.stateCode ? `GST state ${l.stateCode}` : undefined}
                    footer={l.type.toLowerCase()}
                    badges={
                      <>
                        <Badge tone={l.isActive ? 'green' : 'gray'}>
                          {l.isActive ? 'Active' : 'Inactive'}
                        </Badge>
                        {l.isDefault && <Badge tone="blue">default</Badge>}
                      </>
                    }
                    actions={
                      <>
                        <Button size="sm" onClick={() => startEdit(l)}>
                          Edit
                        </Button>
                        <Button
                          size="sm"
                          variant="danger"
                          disabled={busyId === l.id || l.isDefault}
                          onClick={() => remove(l)}
                        >
                          Delete
                        </Button>
                      </>
                    }
                  />
                ))}
              </CardList>

              <div className="hidden md:block">
              <Table>
                <thead>
                  <tr>
                    <Th>Location</Th>
                    <Th>Type</Th>
                    <Th>City</Th>
                    <Th>State</Th>
                    <Th>Status</Th>
                    <Th />
                  </tr>
                </thead>
                <tbody>
                  {rows.length === 0 && (
                    <EmptyRow colSpan={6} message="No locations yet — create the first one" />
                  )}
                  {rows.map((l) => (
                    <tr key={l.id} className="hover:bg-muted/60">
                      <Td>
                        <span className="font-medium text-foreground">
                          {l.code}
                        </span>
                        {l.isDefault && (
                          <Badge tone="blue" className="ml-2">
                            default
                          </Badge>
                        )}
                        <div className="text-xs text-muted-foreground">{l.name}</div>
                      </Td>
                      <Td className="text-xs">{l.type.toLowerCase()}</Td>
                      <Td className="text-xs">{l.city ?? '—'}</Td>
                      <Td className="text-xs">
                        {l.state ?? '—'}
                        {l.stateCode && (
                          <div className="text-muted-foreground">
                            GST {l.stateCode}
                          </div>
                        )}
                      </Td>
                      <Td>
                        <Badge tone={l.isActive ? 'green' : 'gray'}>
                          {l.isActive ? 'Active' : 'Inactive'}
                        </Badge>
                      </Td>
                      <Td>
                        <div className="flex gap-1.5">
                          <Button size="sm" onClick={() => startEdit(l)}>
                            Edit
                          </Button>
                          <Button
                            size="sm"
                            variant="danger"
                            disabled={busyId === l.id || l.isDefault}
                            onClick={() => remove(l)}
                          >
                            Delete
                          </Button>
                        </div>
                      </Td>
                    </tr>
                  ))}
                </tbody>
              </Table>
              </div>
              </>
            )}
          </div>

          <p className="mt-3 text-xs text-muted-foreground">
            Stock is held per location, so every item&apos;s on-hand figure is the sum across these.
            The default location is used when a document does not name one — it cannot be deleted.
          </p>
        </div>

        <div>
          {open ? (
            <Card title={editingId ? 'Edit location' : 'New location'}>
              {formError && (
                <div className="mb-4">
                  <ErrorBox message={formError} />
                </div>
              )}
              <form onSubmit={save} className="space-y-4">
                <Field label="Name" required>
                  <Input
                    value={form.name}
                    onChange={(e) => set({ name: e.target.value })}
                    placeholder="Chinhat Warehouse"
                    required
                  />
                </Field>
                <div className="grid grid-cols-2 gap-3">
                  <Field label="Code" required hint="Letters, numbers, - and _">
                    <Input
                      value={form.code}
                      onChange={(e) => set({ code: e.target.value.toUpperCase() })}
                      placeholder="CHINHAT"
                      className="font-mono"
                      required
                    />
                  </Field>
                  <Field label="Type">
                    <Select
                      value={form.type}
                      onChange={(e) => set({ type: e.target.value })}
                      className="w-full"
                    >
                      <option value="WAREHOUSE">Warehouse</option>
                      <option value="STORE">Store</option>
                      <option value="VIRTUAL">Virtual</option>
                    </Select>
                  </Field>
                </div>

                <Field label="Address line 1">
                  <Input
                    value={form.addressLine1}
                    onChange={(e) => set({ addressLine1: e.target.value })}
                    placeholder="P. No. B-32, Govind Vihar"
                  />
                </Field>
                <Field label="Address line 2">
                  <Input
                    value={form.addressLine2}
                    onChange={(e) => set({ addressLine2: e.target.value })}
                    placeholder="Kamta"
                  />
                </Field>

                <div className="grid grid-cols-2 gap-3">
                  <Field label="City">
                    <Input
                      value={form.city}
                      onChange={(e) => set({ city: e.target.value })}
                      placeholder="Lucknow"
                    />
                  </Field>
                  <Field label="Pincode">
                    <Input
                      inputMode="numeric"
                      maxLength={6}
                      value={form.pincode}
                      onChange={(e) => set({ pincode: e.target.value.replace(/\D/g, '').slice(0, 6) })}
                      placeholder="226028"
                    />
                  </Field>
                </div>
                <Field
                  label="State"
                  hint={stateSelectHint(form.stateCode, form.state) ?? 'Decides CGST + SGST or IGST on what ships from here'}
                >
                  <StateSelect
                    code={form.stateCode}
                    name={form.state}
                    onChange={(st) => set({ state: st?.name ?? '', stateCode: st?.code ?? '' })}
                  />
                </Field>

                <Field label="Country">
                  <Input value={form.country} onChange={(e) => set({ country: e.target.value })} />
                </Field>

                <div className="grid grid-cols-2 gap-3">
                  <Field label="Contact name">
                    <Input
                      value={form.contactName}
                      onChange={(e) => set({ contactName: e.target.value })}
                    />
                  </Field>
                  <Field label="Phone">
                    <Input
                      type="tel"
                      inputMode="tel"
                      value={form.phone}
                      onChange={(e) => set({ phone: e.target.value.replace(/[^\d+\s-]/g, '') })}
                    />
                  </Field>
                </div>
                <Field label="Email">
                  <Input
                    type="email"
                    value={form.email}
                    onChange={(e) => set({ email: e.target.value })}
                  />
                </Field>

                <label className="flex items-center gap-2 text-sm text-foreground">
                  <input
                    type="checkbox"
                    checked={form.isDefault}
                    onChange={(e) => set({ isDefault: e.target.checked })}
                  />
                  Default location
                </label>
                <label className="flex items-center gap-2 text-sm text-foreground">
                  <input
                    type="checkbox"
                    checked={form.isActive}
                    onChange={(e) => set({ isActive: e.target.checked })}
                  />
                  Active
                </label>

                <div className="flex gap-2 pt-1">
                  <Button type="submit" variant="primary" disabled={saving}>
                    {saving && <Spinner className="border-card/40 border-t-card" />}
                    {editingId ? 'Save changes' : 'Create location'}
                  </Button>
                  <Button type="button" onClick={() => setOpen(false)}>
                    Cancel
                  </Button>
                </div>
              </form>
            </Card>
          ) : (
            <Card title="Locations">
              <p className="text-sm text-muted-foreground">
                A location is a physical place stock sits. Items hold a separate on-hand figure at
                each one, and transfers move stock between them.
              </p>
              <p className="mt-2 text-sm text-muted-foreground">
                The state matters: it is compared with where the goods go to decide CGST + SGST or
                IGST.
              </p>
              <div className="mt-3">
                <Button variant="primary" onClick={startCreate}>
                  + New location
                </Button>
              </div>
            </Card>
          )}
        </div>
      </div>
    </>
  );
}
