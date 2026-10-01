'use client';

import { useCallback, useEffect, useState } from 'react';
import { api, errorMessage } from '@/lib/api';
import { useToast } from '@/lib/toast';
import { Badge, Button, Card, Field, Spinner } from '@/components/ui';
import { SearchSelect } from '@/components/SearchSelect';

type Pickup = {
  id: number;
  nickname: string;
  city: string;
  state: string;
  pincode: string;
  address: string;
  verified: boolean;
};

export function ShiprocketSettings({ canWrite }: { canWrite: boolean }) {
  const toast = useToast();
  const [enabled, setEnabled] = useState<boolean | null>(null);
  const [pickupLocation, setPickupLocation] = useState('');
  const [saved, setSaved] = useState('');
  const [locations, setLocations] = useState<Pickup[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const loadLocations = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const res = await api.get<{ data: Pickup[] }>('/shipping/pickup-locations');
      setLocations(res.data);
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    api
      .get<{ data: { enabled: boolean; pickupLocation: string | null } }>('/shipping/status')
      .then((r) => {
        setEnabled(r.data.enabled);
        setPickupLocation(r.data.pickupLocation ?? '');
        setSaved(r.data.pickupLocation ?? '');
        if (r.data.enabled) loadLocations();
      })
      .catch(() => setEnabled(false));
  }, [loadLocations]);

  async function save() {
    setBusy(true);
    try {
      await api.put('/shipping/settings', { pickupLocation });
      setSaved(pickupLocation);
      toast.success('Pickup address saved');
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  if (enabled === null) return null;

  const chosen = locations.find((l) => l.nickname === pickupLocation) ?? null;

  return (
    <Card title="Shiprocket">
      {!enabled ? (
        <p className="text-sm text-muted-foreground">
          Not set up on this server. Add the Shiprocket API user email and password to the server settings and restart it, then
          orders can be booked with a courier from the order page.
        </p>
      ) : (
        <div className="space-y-3">
          <p className="text-sm text-muted-foreground">
            Parcels are collected from this address. It comes from your Shiprocket account - add or change addresses there.
          </p>
          <div className="grid gap-3 sm:grid-cols-[1fr_auto] sm:items-end">
            <Field label="Pickup address">
              <SearchSelect
                value={pickupLocation}
                onChange={setPickupLocation}
                options={locations.map((l) => ({
                  value: l.nickname,
                  label: l.nickname,
                  hint: `${l.city} ${l.pincode}${l.verified ? '' : ' · not verified'}`,
                }))}
                placeholder={loading ? 'Loading from Shiprocket…' : 'Pick an address'}
                searchPlaceholder="Search addresses…"
                emptyMessage="No pickup address in Shiprocket yet"
                className="w-full"
                disabled={!canWrite || loading}
                ariaLabel="Shiprocket pickup address"
              />
            </Field>
            <div className="flex gap-2">
              <Button onClick={loadLocations} disabled={loading}>
                {loading && <Spinner />}
                Refresh
              </Button>
              <Button variant="primary" onClick={save} disabled={!canWrite || busy || !pickupLocation || pickupLocation === saved}>
                {busy && <Spinner className="border-card/40 border-t-card" />}
                Save
              </Button>
            </div>
          </div>
          {chosen && (
            <p className="text-xs text-muted-foreground">
              {chosen.address}, {chosen.city} {chosen.pincode}, {chosen.state}{' '}
              {chosen.verified ? <Badge tone="green">Verified</Badge> : <Badge tone="amber">Not verified in Shiprocket</Badge>}
            </p>
          )}
          {error && <p className="text-sm text-destructive">{error}</p>}
        </div>
      )}
    </Card>
  );
}
