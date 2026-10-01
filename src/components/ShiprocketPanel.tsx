'use client';

import { useCallback, useEffect, useState } from 'react';
import { api, money, errorMessage } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { useToast } from '@/lib/toast';
import { Badge, Button, Card, Field, Input, Spinner } from '@/components/ui';

type Courier = {
  courierId: number;
  name: string;
  rate: number;
  codCharge: number;
  etd: string | null;
  estimatedDays: number | null;
  rating: number | null;
  isSurface: boolean;
  recommended: boolean;
};

type Quote = {
  pickup: { nickname: string; city: string; pincode: string; verified: boolean };
  parcel: {
    weight: number; goods: number; box: number; volumetric: number; basis: string;
    packageName?: string | null;
    dimensions?: { length: number; breadth: number; height: number } | null;
    itemsWithoutWeight?: number;
  };
  cod: boolean;
  codAmount: number;
  deliveryPincode: string;
  couriers: Courier[];
  pendingLines: number;
};

export function ShiprocketPanel({ orderId, onShipped }: { orderId: string; onShipped: () => void }) {
  const { can } = useAuth();
  const toast = useToast();
  const [enabled, setEnabled] = useState<boolean | null>(null);
  const [quote, setQuote] = useState<Quote | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [courierId, setCourierId] = useState<number | null>(null);
  const [weight, setWeight] = useState('');
  const [dims, setDims] = useState({ length: '', breadth: '', height: '' });
  const [requestPickup, setRequestPickup] = useState(true);
  const [booking, setBooking] = useState(false);

  useEffect(() => {
    api
      .get<{ data: { enabled: boolean } }>('/shipping/status')
      .then((r) => setEnabled(r.data.enabled))
      .catch(() => setEnabled(false));
  }, []);

  const loadQuote = useCallback(
    async (overrideWeight?: string) => {
      setLoading(true);
      setError('');
      try {
        const res = await api.get<{ data: Quote }>(`/shipping/orders/${orderId}/quote`, {
          ...(overrideWeight ? { weight: overrideWeight } : {}),
        });
        setQuote(res.data);
        setWeight((w) => (overrideWeight ? overrideWeight : w || String(res.data.parcel.weight)));
        const boxDims = res.data.parcel.dimensions;
        if (boxDims) {
          setDims((d) =>
            d.length || d.breadth || d.height
              ? d
              : { length: String(boxDims.length), breadth: String(boxDims.breadth), height: String(boxDims.height) }
          );
        }
        setCourierId((c) => c ?? res.data.couriers.find((x) => x.recommended)?.courierId ?? res.data.couriers[0]?.courierId ?? null);
      } catch (err) {
        setError(errorMessage(err));
        setQuote(null);
      } finally {
        setLoading(false);
      }
    },
    [orderId]
  );

  async function book() {
    if (!courierId) return;
    setBooking(true);
    try {
      const res = await api.post<{ message: string }>(`/shipping/orders/${orderId}/ship`, {
        courierId,
        weight: Number(weight) || quote?.parcel.weight || 0.5,
        ...(dims.length ? { length: Number(dims.length) } : {}),
        ...(dims.breadth ? { breadth: Number(dims.breadth) } : {}),
        ...(dims.height ? { height: Number(dims.height) } : {}),
        requestPickup,
      });
      toast.success(res.message);
      onShipped();
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setBooking(false);
    }
  }

  if (enabled === null) return null;
  if (!enabled) {
    return (
      <Card title="Ship with Shiprocket">
        <p className="text-sm text-muted-foreground">
          Shiprocket is not set up on this server yet. Add the API user email and password to the server settings, then this
          panel books couriers, buys the AWB and tracks the parcel.
        </p>
      </Card>
    );
  }

  const chosen = quote?.couriers.find((c) => c.courierId === courierId) ?? null;

  return (
    <Card title="Ship with Shiprocket">
      {!quote && (
        <div className="space-y-3">
          <p className="text-sm text-muted-foreground">
            Check which couriers serve this address and what they charge. Nothing is booked and no money is spent until you
            press Book.
          </p>
          <Button variant="primary" onClick={() => loadQuote()} disabled={loading}>
            {loading && <Spinner className="border-card/40 border-t-card" />}
            Check couriers and rates
          </Button>
          {error && <p className="text-sm text-destructive">{error}</p>}
        </div>
      )}

      {quote && (
        <div className="space-y-4">
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
            <span>
              From <strong className="text-foreground">{quote.pickup.nickname}</strong> ({quote.pickup.pincode})
              {!quote.pickup.verified && <span className="ml-1 text-warning">· not verified in Shiprocket</span>}
            </span>
            <span>To {quote.deliveryPincode}</span>
            {quote.cod && <Badge tone="amber">COD {money(quote.codAmount)}</Badge>}
            <span>
              Parcel {quote.parcel.weight} kg
              {quote.parcel.packageName ? ` · ${quote.parcel.packageName}` : ''}
              {quote.parcel.dimensions
                ? ` · ${quote.parcel.dimensions.length} × ${quote.parcel.dimensions.breadth} × ${quote.parcel.dimensions.height} cm`
                : ''}
              {quote.parcel.basis === 'volumetric' ? ' · volumetric' : ''}
            </span>
          </div>

          {(quote.parcel.itemsWithoutWeight ?? 0) > 0 && (
            <p className="rounded-md border border-warning/30 bg-warning/10 px-3 py-2 text-xs text-warning">
              {quote.parcel.itemsWithoutWeight} item(s) on this order have no weight saved, so the parcel weight is a guess.
              Type the real weight below - the courier bills on what they measure.
            </p>
          )}

          <div className="grid gap-3 sm:grid-cols-4">
            <Field label="Weight (kg)" required>
              <Input
                type="number" step="0.01" min="0.1"
                value={weight}
                onChange={(e) => setWeight(e.target.value)}
                onBlur={() => weight && Number(weight) !== quote.parcel.weight && loadQuote(weight)}
              />
            </Field>
            <Field label="Length (cm)">
              <Input type="number" step="1" min="1" value={dims.length} onChange={(e) => setDims({ ...dims, length: e.target.value })} placeholder="15" />
            </Field>
            <Field label="Breadth (cm)">
              <Input type="number" step="1" min="1" value={dims.breadth} onChange={(e) => setDims({ ...dims, breadth: e.target.value })} placeholder="12" />
            </Field>
            <Field label="Height (cm)">
              <Input type="number" step="1" min="1" value={dims.height} onChange={(e) => setDims({ ...dims, height: e.target.value })} placeholder="8" />
            </Field>
          </div>

          {quote.couriers.length === 0 ? (
            <p className="text-sm text-destructive">
              No courier serves {quote.deliveryPincode} from {quote.pickup.pincode} at this weight
              {quote.cod ? ' for COD' : ''}.
            </p>
          ) : (
            <ul className="divide-y divide-border rounded-md border border-border">
              {quote.couriers.slice(0, 8).map((c) => (
                <li key={c.courierId}>
                  <label className="flex cursor-pointer items-center gap-3 px-3 py-2.5 text-sm hover:bg-muted/60">
                    <input
                      type="radio"
                      name="courier"
                      checked={courierId === c.courierId}
                      onChange={() => setCourierId(c.courierId)}
                      className="h-4 w-4"
                    />
                    <span className="min-w-0 flex-1">
                      <span className="font-medium text-foreground">{c.name}</span>
                      {c.recommended && <Badge tone="gold" className="ml-2">Shiprocket pick</Badge>}
                      <span className="block text-xs text-muted-foreground">
                        {c.etd ? `Delivery by ${c.etd}` : c.estimatedDays ? `About ${c.estimatedDays} days` : 'No estimate'}
                        {c.rating != null ? ` · rated ${c.rating.toFixed(1)}` : ''}
                        {c.isSurface ? ' · surface' : ' · air'}
                      </span>
                    </span>
                    <span className="shrink-0 text-right">
                      <span className="font-medium tabular-nums">{money(c.rate)}</span>
                      {quote.cod && c.codCharge > 0 && (
                        <span className="block text-[11px] text-muted-foreground">+ {money(c.codCharge)} COD fee</span>
                      )}
                    </span>
                  </label>
                </li>
              ))}
            </ul>
          )}

          <label className="flex items-center gap-2 text-sm text-foreground">
            <input type="checkbox" checked={requestPickup} onChange={(e) => setRequestPickup(e.target.checked)} className="h-4 w-4 rounded border-border" />
            Ask the courier to collect it today
          </label>

          <div className="flex flex-wrap items-center gap-2">
            <Button variant="primary" onClick={book} disabled={!courierId || booking || !can('orders:fulfil')}>
              {booking && <Spinner className="border-card/40 border-t-card" />}
              {chosen ? `Book ${chosen.name} for ${money(chosen.rate)}` : 'Book'}
            </Button>
            <Button onClick={() => loadQuote(weight)} disabled={loading || booking}>
              {loading && <Spinner />}
              Refresh rates
            </Button>
            <span className="text-xs text-muted-foreground">
              Booking buys the AWB from your Shiprocket balance and ships the stock out of this order.
            </span>
          </div>
          {error && <p className="text-sm text-destructive">{error}</p>}
        </div>
      )}
    </Card>
  );
}
