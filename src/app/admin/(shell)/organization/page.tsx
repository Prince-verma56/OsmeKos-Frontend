'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { api, errorMessage } from '@/lib/api';
import { stateLabel } from '@/lib/states';
import { roundOffOptions, type RoundOffMode } from '@/lib/roundOff';
import { Button, Card, ErrorBox, Loading, PageHeader } from '@/components/ui';
import { ClearDataCard } from '@/components/ClearDataCard';

type Organization = {
  id: string;
  name: string;
  legalName: string | null;
  brandName: string | null;
  gstin: string | null;
  pan: string | null;
  cin: string | null;
  email: string | null;
  phone: string | null;
  website: string | null;
  logoUrl: string | null;
  bankName: string | null;
  bankBranch: string | null;
  bankAccountNumber: string | null;
  bankIfscCode: string | null;
  upiId: string | null;
  paymentLinkUrl?: string | null;
  addressLine1: string | null;
  addressLine2: string | null;
  city: string | null;
  state: string | null;
  stateCode: string | null;
  pincode: string | null;
  country: string;
  baseCurrency: string;
  fiscalYearStart: number;
  timezone: string;
  roundOffMode?: RoundOffMode;
};

type Location = {
  id: string;
  name: string;
  code: string;
  type: string;
  isDefault: boolean;
  isActive: boolean;
  contactName: string | null;
  phone: string | null;
  addressLine1: string | null;
  addressLine2: string | null;
  city: string | null;
  state: string | null;
  stateCode: string | null;
  pincode: string | null;
  country: string | null;
};

const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

function Row({
  label,
  value,
  mono = false,
  hint,
}: {
  label: string;
  value?: string | null;
  mono?: boolean;
  hint?: string;
}) {
  return (
    <div className="flex items-baseline justify-between gap-4 border-b border-border py-2 last:border-0">
      <dt className="shrink-0 text-xs text-muted-foreground">
        {label}
        {hint && (
          <span className="block text-[11px] text-muted-foreground">{hint}</span>
        )}
      </dt>
      <dd
        className={`min-w-0 break-words text-right text-sm ${
          value
            ? `text-foreground ${mono ? 'font-mono' : ''}`
            : 'text-muted-foreground/60'
        }`}
      >
        {value || 'Not set'}
      </dd>
    </div>
  );
}

export default function OrganizationPage() {
  const [org, setOrg] = useState<Organization | null>(null);
  const [locations, setLocations] = useState<Location[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const [res, locs] = await Promise.all([
        api.get<{ data: Organization }>('/organization'),
        api
          .get<{ data: Location[] }>('/locations', { limit: 50 })
          .catch(() => ({ data: [] as Location[] })),
      ]);
      setOrg(res.data);
      setLocations(locs.data ?? []);
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

  if (loading) return <Loading />;
  if (!org) return <ErrorBox message={error || 'Organization not found'} onRetry={load} />;

  const address = [
    org.addressLine1,
    org.addressLine2,
    org.city,
    [org.state, org.pincode].filter(Boolean).join(' '),
    org.country,
  ]
    .filter(Boolean)
    .join(', ');

  const gaps = [
    !org.gstin && 'GSTIN — the GST return and the tax split on every invoice need it',
    !org.stateCode && 'State — without it no invoice can decide CGST+SGST versus IGST',
    !org.legalName && 'Legal name — what a tax invoice is required to print',
    !org.bankAccountNumber && 'Bank details — customers will not know where to pay',
  ].filter(Boolean) as string[];

  return (
    <>
      <PageHeader
        title="Organization"
        subtitle="Who you are on every document you send"
        actions={
          <Link href="/admin/organization/edit">
            <Button variant="primary">&#9998; Edit</Button>
          </Link>
        }
      />

      {error && <div className="mb-4"><ErrorBox message={error} /></div>}

      <div className="mb-5 flex flex-wrap items-center gap-5 rounded-lg border border-border bg-card p-5">
        <div className="flex h-20 w-20 shrink-0 items-center justify-center overflow-hidden rounded-lg border border-border bg-muted/60">
          {org.logoUrl ? (
            <img
              src={org.logoUrl}
              alt={org.name}
              className="h-full w-full object-contain"
              onError={(e) => {
                e.currentTarget.style.display = 'none';
              }}
            />
          ) : (
            <span className="text-2xl font-semibold text-muted-foreground/60">
              {org.name.slice(0, 1).toUpperCase()}
            </span>
          )}
        </div>

        <div className="min-w-0 flex-1">
          <h2 className="text-lg font-semibold text-foreground">
            {org.legalName || org.name}
          </h2>
          {org.brandName && org.brandName !== org.legalName && (
            <p className="text-sm text-muted-foreground">
              trading as {org.brandName}
            </p>
          )}
          {address && (
            <p className="mt-1 max-w-xl text-sm text-muted-foreground">{address}</p>
          )}
          <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
            {org.phone && <span>{org.phone}</span>}
            {org.email && <span>{org.email}</span>}
            {org.website && <span>{org.website}</span>}
          </div>
        </div>

        {org.gstin && (
          <div className="rounded-md border border-border px-3 py-2 text-right">
            <div className="text-[10px] uppercase tracking-wide text-muted-foreground">
              GSTIN
            </div>
            <div className="font-mono text-sm text-foreground">{org.gstin}</div>
            {org.stateCode && (
              <div className="text-[11px] text-muted-foreground">
                {stateLabel(org.stateCode)}
              </div>
            )}
          </div>
        )}
      </div>

      {gaps.length > 0 && (
        <div className="mb-5 rounded-md border border-warning/30 bg-warning/10 px-3 py-2.5 text-xs text-warning">
          <strong>Documents will be incomplete until these are set:</strong>
          <ul className="mt-1 list-inside list-disc space-y-0.5">
            {gaps.map((g) => (
              <li key={g}>{g}</li>
            ))}
          </ul>
        </div>
      )}

      <div className="grid gap-5 pb-8 lg:grid-cols-2">
        <Card title="Statutory">
          <dl>
            <Row label="GSTIN" value={org.gstin} mono />
            <Row label="PAN" value={org.pan} mono />
            <Row label="CIN" value={org.cin} mono />
          </dl>
        </Card>

        <Card title="Bank details">
          <dl>
            <Row label="Bank" value={org.bankName} />
            <Row label="Branch" value={org.bankBranch} />
            <Row label="Account number" value={org.bankAccountNumber} mono />
            <Row label="IFSC" value={org.bankIfscCode} mono />
            <Row label="UPI ID" value={org.upiId} mono />
            <Row label="Default payment link" value={org.paymentLinkUrl} />
          </dl>
          <p className="mt-3 text-xs text-muted-foreground">
            Printed on every invoice. Each one keeps its own copy, frozen when it was raised —
            changing these affects new invoices only.
          </p>
        </Card>

        <Card title="Registered address">
          <dl>
            <Row label="Line 1" value={org.addressLine1} />
            <Row label="Line 2" value={org.addressLine2} />
            <Row label="City" value={org.city} />
            <Row
              label="State"
              value={org.stateCode ? stateLabel(org.stateCode) : org.state}
              hint="Your source of supply"
            />
            <Row label="Pincode" value={org.pincode} mono />
            <Row label="Country" value={org.country} />
          </dl>
        </Card>

        <Card
          title={`Locations (${locations.length})`}
          action={
            <Link
              href="/admin/locations"
              className="text-xs text-gold-ink hover:underline"
            >
              Manage
            </Link>
          }
        >
          <p className="mb-3 text-xs text-muted-foreground">
            Every stock quantity belongs to one of these, and the state on each is the source of
            supply for anything shipped from it — which is what decides CGST+SGST versus IGST.
          </p>

          {locations.length === 0 ? (
            <p className="text-sm text-muted-foreground/60">
              No locations yet — stock cannot be held without one.
            </p>
          ) : (
            <ul className="space-y-2">
              {locations.map((l) => (
                <li
                  key={l.id}
                  className="rounded-md border border-border p-3"
                >
                  <div className="flex flex-wrap items-baseline gap-2">
                    <span className="font-medium text-foreground">{l.name}</span>
                    <span className="font-mono text-[11px] text-muted-foreground">
                      {l.code}
                    </span>
                    {l.isDefault && (
                      <span className="rounded bg-muted px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground">
                        default
                      </span>
                    )}
                    {!l.isActive && (
                      <span className="text-[10px] text-muted-foreground">
                        inactive
                      </span>
                    )}
                  </div>

                  {[l.addressLine1, l.addressLine2, l.city, l.pincode].some(Boolean) && (
                    <p className="mt-1 text-xs text-muted-foreground">
                      {[l.addressLine1, l.addressLine2, l.city, l.pincode]
                        .filter(Boolean)
                        .join(', ')}
                    </p>
                  )}

                  <div className="mt-1 flex flex-wrap gap-x-3 gap-y-0.5 text-[11px] text-muted-foreground">
                    {l.stateCode ? (
                      <span>{stateLabel(l.stateCode)}</span>
                    ) : (
                      <span className="text-warning">
                        No GST state code set
                      </span>
                    )}
                    {l.contactName && <span>{l.contactName}</span>}
                    {l.phone && <span>{l.phone}</span>}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </Card>

        <Card title="Accounting">
          <dl>
            <Row label="Base currency" value={org.baseCurrency} mono />
            <Row
              label="Financial year starts"
              value={MONTHS[(org.fiscalYearStart || 4) - 1]}
              hint="What {FY} on a document number follows"
            />
            <Row label="Timezone" value={org.timezone} />
            <Row
              label="Round off totals"
              value={roundOffOptions().find((o) => o.value === (org.roundOffMode ?? 'NEAREST_1'))?.label}
              hint="Orders, invoices, bills, purchase orders and credits"
            />
          </dl>
        </Card>

        <ClearDataCard />
      </div>
    </>
  );
}
