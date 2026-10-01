'use client';

import { useCallback, useEffect, useState } from 'react';
import { api, money, errorMessage, currencySymbol } from '@/lib/api';
import { useToast } from '@/lib/toast';
import { INDIAN_STATES } from '@/lib/states';
import { Modal, ConfirmModal } from '@/components/Modal';
import {
  Badge, Button, Card, ErrorBox, Field, Input, Loading, Table, Td, Th,
} from '@/components/ui';
import { Icon } from '@/components/Icon';
import { ShiprocketSettings } from '@/components/ShiprocketSettings';

type Rate = {
  id: string;
  name: string;
  price: string;
  minWeight: string | null;
  maxWeight: string | null;
  minSubtotal: string | null;
  maxSubtotal: string | null;
  isCodAvailable: boolean;
  codCharge: string | null;
  estimatedDays: number | null;
  isActive: boolean;
};

type Zone = {
  id: string;
  name: string;
  states: string[];
  countries: string[];
  pincodeRanges: { from: string; to: string }[];
  isDefault: boolean;
  isActive: boolean;
  rates: Rate[];
};

const N = (v: string | null | undefined) => (v == null || v === '' ? null : Number(v));

const blankZone = {
  name: '',
  states: [] as string[],
  pincodeRanges: [] as { from: string; to: string }[],
  isDefault: false,
  isActive: true,
};

const blankRate = {
  name: '',
  price: '',
  minWeight: '',
  maxWeight: '',
  minSubtotal: '',
  maxSubtotal: '',
  isCodAvailable: true,
  codCharge: '',
  estimatedDays: '',
  isActive: true,
};

function band(min: string | null, max: string | null, unit: string) {
  const lo = N(min);
  const hi = N(max);
  if (lo == null && hi == null) return `any ${unit}`;
  if (lo == null) return `up to ${hi}${unit === 'weight' ? ' kg' : ''}`;
  if (hi == null) return `${lo}${unit === 'weight' ? ' kg' : ''} and up`;
  return `${lo}–${hi}${unit === 'weight' ? ' kg' : ''}`;
}

export function ShippingTab({ canWrite }: { canWrite: boolean }) {
  const toast = useToast();
  const [zones, setZones] = useState<Zone[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const [zoneOpen, setZoneOpen] = useState(false);
  const [editingZone, setEditingZone] = useState<Zone | null>(null);
  const [zoneForm, setZoneForm] = useState({ ...blankZone });

  const [rateOpen, setRateOpen] = useState(false);
  const [rateZone, setRateZone] = useState<Zone | null>(null);
  const [editingRate, setEditingRate] = useState<Rate | null>(null);
  const [rateForm, setRateForm] = useState({ ...blankRate });

  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState('');
  const [doomed, setDoomed] = useState<
    { kind: 'zone'; zone: Zone } | { kind: 'rate'; zone: Zone; rate: Rate } | null
  >(null);
  const [deleting, setDeleting] = useState(false);

  const load = useCallback(async () => {
    setError('');
    try {
      const res = await api.get<{ data: Zone[] }>('/sales/shipping/zones');
      setZones(res.data ?? []);
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

  function newZone() {
    setEditingZone(null);
    setZoneForm({ ...blankZone });
    setFormError('');
    setZoneOpen(true);
  }

  function editZone(z: Zone) {
    setEditingZone(z);
    setZoneForm({
      name: z.name,
      states: z.states ?? [],
      pincodeRanges: z.pincodeRanges ?? [],
      isDefault: z.isDefault,
      isActive: z.isActive,
    });
    setFormError('');
    setZoneOpen(true);
  }

  async function saveZone() {
    setSaving(true);
    setFormError('');
    try {
      const body = {
        name: zoneForm.name,
        states: zoneForm.states,
        countries: ['India'],
        pincodeRanges: zoneForm.pincodeRanges.filter((r) => r.from && r.to),
        isDefault: zoneForm.isDefault,
        isActive: zoneForm.isActive,
      };
      if (editingZone) await api.patch(`/sales/shipping/zones/${editingZone.id}`, body);
      else await api.post('/sales/shipping/zones', body);
      toast.success(editingZone ? 'Zone updated' : 'Zone created');
      setZoneOpen(false);
      await load();
    } catch (err) {
      setFormError(errorMessage(err));
    } finally {
      setSaving(false);
    }
  }

  function newRate(z: Zone) {
    setRateZone(z);
    setEditingRate(null);
    setRateForm({ ...blankRate });
    setFormError('');
    setRateOpen(true);
  }

  function editRate(z: Zone, r: Rate) {
    setRateZone(z);
    setEditingRate(r);
    setRateForm({
      name: r.name,
      price: r.price ?? '',
      minWeight: r.minWeight ?? '',
      maxWeight: r.maxWeight ?? '',
      minSubtotal: r.minSubtotal ?? '',
      maxSubtotal: r.maxSubtotal ?? '',
      isCodAvailable: r.isCodAvailable,
      codCharge: r.codCharge ?? '',
      estimatedDays: r.estimatedDays == null ? '' : String(r.estimatedDays),
      isActive: r.isActive,
    });
    setFormError('');
    setRateOpen(true);
  }

  async function saveRate() {
    if (!rateZone) return;
    setSaving(true);
    setFormError('');
    try {
      const body = {
        name: rateForm.name,
        price: Number(rateForm.price || 0),
        ...(N(rateForm.minWeight) != null && { minWeight: N(rateForm.minWeight) }),
        ...(N(rateForm.maxWeight) != null && { maxWeight: N(rateForm.maxWeight) }),
        ...(N(rateForm.minSubtotal) != null && { minSubtotal: N(rateForm.minSubtotal) }),
        ...(N(rateForm.maxSubtotal) != null && { maxSubtotal: N(rateForm.maxSubtotal) }),
        isCodAvailable: rateForm.isCodAvailable,
        codCharge: rateForm.isCodAvailable ? Number(rateForm.codCharge || 0) : 0,
        ...(N(rateForm.estimatedDays) != null && { estimatedDays: N(rateForm.estimatedDays) }),
        isActive: rateForm.isActive,
      };
      if (editingRate) {
        await api.patch(`/sales/shipping/zones/${rateZone.id}/rates/${editingRate.id}`, body);
      } else {
        await api.post(`/sales/shipping/zones/${rateZone.id}/rates`, body);
      }
      toast.success(editingRate ? 'Rate updated' : 'Rate added');
      setRateOpen(false);
      await load();
    } catch (err) {
      setFormError(errorMessage(err));
    } finally {
      setSaving(false);
    }
  }

  async function remove() {
    if (!doomed) return;
    setDeleting(true);
    try {
      if (doomed.kind === 'zone') {
        await api.del(`/sales/shipping/zones/${doomed.zone.id}`);
        toast.success('Zone deleted');
      } else {
        await api.del(`/sales/shipping/zones/${doomed.zone.id}/rates/${doomed.rate.id}`);
        toast.success('Rate deleted');
      }
      setDoomed(null);
      await load();
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setDeleting(false);
    }
  }

  const setZ = (patch: Partial<typeof zoneForm>) => setZoneForm((p) => ({ ...p, ...patch }));
  const setR = (patch: Partial<typeof rateForm>) => setRateForm((p) => ({ ...p, ...patch }));

  if (loading) return <Loading label="Loading shipping zones…" />;
  if (error) return <ErrorBox message={error} onRetry={load} />;

  return (
    <div className="space-y-4">
      <ShiprocketSettings canWrite={canWrite} />

      <Card title="How a quote is picked" collapsible defaultOpen={false}>
        <ul className="ml-4 list-disc space-y-1 text-sm text-muted-foreground">
          <li>
            The first zone whose states or pincode ranges cover the destination wins; the zone
            marked default catches everything else.
          </li>
          <li>
            Within that zone, every rate whose weight and order-value bands fit is offered. A
            rate with no bands fits everything &mdash; leaving them blank is usually right.
          </li>
          <li>
            For a cash-on-delivery order, rates that do not carry COD are dropped and the COD
            charge is added to the ones that do.
          </li>
          <li>
            Switching a rate off keeps it here but takes it out of quotes.
          </li>
        </ul>
      </Card>

      {zones.length === 0 && (
        <Card title="Shipping zones">
          <p className="text-sm text-muted-foreground">
            No zones yet. Add one to start quoting shipping.
          </p>
          {canWrite && (
            <Button variant="primary" className="mt-3" onClick={newZone}>
              New zone
            </Button>
          )}
        </Card>
      )}

      {zones.length > 0 && canWrite && (
        <div className="flex justify-end">
          <Button variant="primary" onClick={newZone}>
            New zone
          </Button>
        </div>
      )}

      {zones.map((z) => {
        const noRates = z.rates.length === 0;
        const noActive = !noRates && z.rates.every((r) => !r.isActive);
        return (
          <Card
            key={z.id}
            collapsible
            padded={false}
            title={z.name}
            action={
              <div className="flex flex-wrap items-center gap-2">
                {z.isDefault && <Badge tone="blue">Default</Badge>}
                {z.isActive ? (
                  <Badge tone="green">Active</Badge>
                ) : (
                  <Badge tone="gray">Switched off</Badge>
                )}
                {canWrite && (
                  <>
                    <Button size="sm" onClick={() => editZone(z)}>
                      Edit zone
                    </Button>
                    <Button size="sm" onClick={() => newRate(z)}>
                      Add rate
                    </Button>
                    <Button
                      size="sm"
                      variant="danger"
                      onClick={() => setDoomed({ kind: 'zone', zone: z })}
                    >
                      Delete
                    </Button>
                  </>
                )}
              </div>
            }
          >
            <div className="p-4">
              <div className="mb-3 flex flex-wrap gap-4 text-xs text-muted-foreground">
                <span className="flex items-center gap-1.5">
                  <Icon name="pin" className="h-3.5 w-3.5" />
                  {z.states.length ? z.states.join(', ') : 'No states listed'}
                </span>
                <span className="flex items-center gap-1.5">
                  <Icon name="eway" className="h-3.5 w-3.5" />
                  {z.pincodeRanges.length
                    ? z.pincodeRanges.map((r) => `${r.from}–${r.to}`).join(', ')
                    : 'No pincode ranges'}
                </span>
              </div>

              {(noRates || noActive) && (
                <div className="mb-3 rounded-md border border-warning/30 bg-warning/10 px-3 py-2 text-xs text-warning">
                  {noRates
                    ? 'This zone has no rates, so nothing shipping here can be quoted.'
                    : 'Every rate in this zone is switched off, so nothing shipping here can be quoted.'}
                </div>
              )}

              {!noRates && (
                <Table>
                  <thead>
                    <tr>
                      <Th>Rate</Th>
                      <Th className="text-right">Price</Th>
                      <Th>Cash on delivery</Th>
                      <Th>Weight</Th>
                      <Th>Order value</Th>
                      <Th className="text-right">Days</Th>
                      <Th className="text-right">{canWrite ? 'Actions' : ''}</Th>
                    </tr>
                  </thead>
                  <tbody>
                    {z.rates.map((r) => (
                      <tr key={r.id} className="hover:bg-muted/60">
                        <Td>
                          <span className="text-foreground">{r.name}</span>
                          {!r.isActive && (
                            <span className="ml-2">
                              <Badge tone="gray">Off</Badge>
                            </span>
                          )}
                        </Td>
                        <Td className="text-right tabular-nums">{money(r.price)}</Td>
                        <Td>
                          {r.isCodAvailable ? (
                            <span className="text-foreground">
                              {N(r.codCharge) ? `+ ${money(r.codCharge as string)}` : 'No extra charge'}
                            </span>
                          ) : (
                            <span className="text-muted-foreground">Not offered</span>
                          )}
                        </Td>
                        <Td className="whitespace-nowrap text-xs">
                          {band(r.minWeight, r.maxWeight, 'weight')}
                        </Td>
                        <Td className="whitespace-nowrap text-xs">
                          {N(r.minSubtotal) == null && N(r.maxSubtotal) == null
                            ? 'any value'
                            : `${N(r.minSubtotal) != null ? money(r.minSubtotal as string) : '—'} – ${
                                N(r.maxSubtotal) != null ? money(r.maxSubtotal as string) : '—'
                              }`}
                        </Td>
                        <Td className="text-right tabular-nums">{r.estimatedDays ?? '—'}</Td>
                        <Td className="text-right">
                          {canWrite && (
                            <div className="flex justify-end gap-1.5 whitespace-nowrap">
                              <Button size="sm" onClick={() => editRate(z, r)}>
                                Edit
                              </Button>
                              <Button
                                size="sm"
                                variant="danger"
                                onClick={() => setDoomed({ kind: 'rate', zone: z, rate: r })}
                              >
                                Delete
                              </Button>
                            </div>
                          )}
                        </Td>
                      </tr>
                    ))}
                  </tbody>
                </Table>
              )}
            </div>
          </Card>
        );
      })}

      {!canWrite && (
        <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <Icon name="roles" className="h-3.5 w-3.5" />
          Your role can read shipping zones but not change them.
        </p>
      )}

      <Modal
        open={zoneOpen}
        onClose={() => setZoneOpen(false)}
        title={editingZone ? 'Edit zone' : 'New zone'}
        footer={
          <>
            <Button type="button" onClick={() => setZoneOpen(false)} disabled={saving}>
              Cancel
            </Button>
            <Button type="button" variant="primary" onClick={saveZone} disabled={saving}>
              {saving ? 'Saving…' : editingZone ? 'Save changes' : 'Create zone'}
            </Button>
          </>
        }
      >
        {formError && (
          <div className="mb-3 rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
            {formError}
          </div>
        )}
        <div className="space-y-3">
          <Field label="Zone name" required>
            <Input
              value={zoneForm.name}
              onChange={(e) => setZ({ name: e.target.value })}
              placeholder="North India"
            />
          </Field>

          <div>
            <span className="mb-1 block text-xs font-medium text-muted-foreground">
              States covered
            </span>
            <div className="max-h-44 overflow-y-auto rounded-md border border-border p-2">
              <div className="grid gap-1 sm:grid-cols-2">
                {INDIAN_STATES.map((st) => (
                  <label key={st.code} className="flex items-center gap-2 text-xs">
                    <input
                      type="checkbox"
                      checked={zoneForm.states.includes(st.name)}
                      onChange={(e) =>
                        setZ({
                          states: e.target.checked
                            ? [...zoneForm.states, st.name]
                            : zoneForm.states.filter((x) => x !== st.name),
                        })
                      }
                      className="h-3.5 w-3.5 rounded border-border"
                    />
                    <span className="text-foreground">{st.name}</span>
                  </label>
                ))}
              </div>
            </div>
            <span className="mt-1 block text-xs text-muted-foreground">
              {zoneForm.states.length} selected. A zone can also match on pincode alone.
            </span>
          </div>

          <div>
            <span className="mb-1 block text-xs font-medium text-muted-foreground">
              Pincode ranges
            </span>
            <div className="space-y-2">
              {zoneForm.pincodeRanges.map((r, i) => (
                <div key={i} className="flex items-center gap-2">
                  <Input
                    value={r.from}
                    placeholder="110001"
                    className="font-mono"
                    onChange={(e) =>
                      setZ({
                        pincodeRanges: zoneForm.pincodeRanges.map((x, j) =>
                          j === i ? { ...x, from: e.target.value } : x
                        ),
                      })
                    }
                  />
                  <span className="text-xs text-muted-foreground">to</span>
                  <Input
                    value={r.to}
                    placeholder="299999"
                    className="font-mono"
                    onChange={(e) =>
                      setZ({
                        pincodeRanges: zoneForm.pincodeRanges.map((x, j) =>
                          j === i ? { ...x, to: e.target.value } : x
                        ),
                      })
                    }
                  />
                  <Button
                    type="button"
                    size="sm"
                    variant="danger"
                    onClick={() =>
                      setZ({ pincodeRanges: zoneForm.pincodeRanges.filter((_, j) => j !== i) })
                    }
                  >
                    ×
                  </Button>
                </div>
              ))}
            </div>
            <Button
              type="button"
              size="sm"
              className="mt-2"
              onClick={() =>
                setZ({ pincodeRanges: [...zoneForm.pincodeRanges, { from: '', to: '' }] })
              }
            >
              + Add range
            </Button>
          </div>

          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={zoneForm.isActive}
              onChange={(e) => setZ({ isActive: e.target.checked })}
              className="h-4 w-4 rounded border-border"
            />
            <span className="text-foreground">Zone is active</span>
          </label>
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={zoneForm.isDefault}
              onChange={(e) => setZ({ isDefault: e.target.checked })}
              className="h-4 w-4 rounded border-border"
            />
            <span className="text-foreground">
              Catch-all for destinations no other zone covers
            </span>
          </label>
        </div>
      </Modal>

      <Modal
        open={rateOpen}
        onClose={() => setRateOpen(false)}
        title={`${editingRate ? 'Edit' : 'New'} rate${rateZone ? ` — ${rateZone.name}` : ''}`}
        footer={
          <>
            <Button type="button" onClick={() => setRateOpen(false)} disabled={saving}>
              Cancel
            </Button>
            <Button type="button" variant="primary" onClick={saveRate} disabled={saving}>
              {saving ? 'Saving…' : editingRate ? 'Save changes' : 'Add rate'}
            </Button>
          </>
        }
      >
        {formError && (
          <div className="mb-3 rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
            {formError}
          </div>
        )}
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <Field label="Rate name" required>
              <Input
                value={rateForm.name}
                onChange={(e) => setR({ name: e.target.value })}
                placeholder="Standard"
              />
            </Field>
          </div>
          <Field label={`Price (${currencySymbol()})`} required>
            <Input
              type="number"
              step="0.01"
              min="0"
              value={rateForm.price}
              onChange={(e) => setR({ price: e.target.value })}
              placeholder="49"
            />
          </Field>
          <Field label="Estimated days" hint="Shown to the customer. Optional.">
            <Input
              type="number"
              min="0"
              max="90"
              value={rateForm.estimatedDays}
              onChange={(e) => setR({ estimatedDays: e.target.value })}
              placeholder="4"
            />
          </Field>

          <div className="sm:col-span-2 rounded-md border border-border p-3">
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={rateForm.isCodAvailable}
                onChange={(e) => setR({ isCodAvailable: e.target.checked })}
                className="h-4 w-4 rounded border-border"
              />
              <span className="text-foreground">
                Cash on delivery is available on this rate
              </span>
            </label>
            {rateForm.isCodAvailable && (
              <div className="mt-3">
                <Field
                  label={`COD charge (${currencySymbol()})`}
                  hint="Added on top of the price when the order is COD. 0 to absorb it."
                >
                  <Input
                    type="number"
                    step="0.01"
                    min="0"
                    value={rateForm.codCharge}
                    onChange={(e) => setR({ codCharge: e.target.value })}
                    placeholder="30"
                  />
                </Field>
                {Number(rateForm.price) > 0 && (
                  <p className="mt-1.5 text-xs text-muted-foreground">
                    A COD order here would be charged{' '}
                    <span className="font-medium text-foreground">
                      {money(Number(rateForm.price || 0) + Number(rateForm.codCharge || 0))}
                    </span>{' '}
                    against {money(Number(rateForm.price || 0))} prepaid.
                  </p>
                )}
              </div>
            )}
          </div>

          <Field label="Min weight (kg)" hint="Blank means no lower limit.">
            <Input
              type="number"
              step="0.001"
              min="0"
              value={rateForm.minWeight}
              onChange={(e) => setR({ minWeight: e.target.value })}
            />
          </Field>
          <Field label="Max weight (kg)" hint="Blank means no upper limit.">
            <Input
              type="number"
              step="0.001"
              min="0"
              value={rateForm.maxWeight}
              onChange={(e) => setR({ maxWeight: e.target.value })}
            />
          </Field>
          <Field label={`Min order value (${currencySymbol()})`}>
            <Input
              type="number"
              step="0.01"
              min="0"
              value={rateForm.minSubtotal}
              onChange={(e) => setR({ minSubtotal: e.target.value })}
            />
          </Field>
          <Field label={`Max order value (${currencySymbol()})`} hint="Use with price 0 for free shipping over a value.">
            <Input
              type="number"
              step="0.01"
              min="0"
              value={rateForm.maxSubtotal}
              onChange={(e) => setR({ maxSubtotal: e.target.value })}
            />
          </Field>

          <div className="sm:col-span-2">
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={rateForm.isActive}
                onChange={(e) => setR({ isActive: e.target.checked })}
                className="h-4 w-4 rounded border-border"
              />
              <span className="text-foreground">Offer this rate in quotes</span>
            </label>
          </div>
        </div>
      </Modal>

      <ConfirmModal
        open={Boolean(doomed)}
        onClose={() => setDoomed(null)}
        onConfirm={remove}
        busy={deleting}
        confirmLabel="Delete"
        title={doomed?.kind === 'zone' ? 'Delete this zone?' : 'Delete this rate?'}
        message={
          doomed?.kind === 'zone' ? (
            <>
              &ldquo;{doomed.zone.name}&rdquo; and its {doomed.zone.rates.length} rate
              {doomed.zone.rates.length === 1 ? '' : 's'} go with it. Orders already raised keep
              the shipping they were charged.
              <span className="mt-2 block text-muted-foreground">
                Switching the zone off instead keeps it here and out of quotes.
              </span>
            </>
          ) : (
            <>
              Destinations in this zone will no longer be offered this rate.
              <span className="mt-2 block text-muted-foreground">
                Switching it off instead keeps the record of what it was.
              </span>
            </>
          )
        }
      />
    </div>
  );
}
