'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { api, money, shortDate, errorMessage, type Paged } from '@/lib/api';
import { stateLabel } from '@/lib/states';
import { TransporterSelect } from '@/components/TransporterSelect';
import {
  Button, Card, ErrorBox, Field, Input, PageHeader, Select, Spinner,
} from '@/components/ui';
import { PageCrumb } from '@/lib/crumbs';
import { SaveBar } from '@/components/form/SaveBar';

type DocType = 'INVOICE' | 'CREDIT_NOTE' | 'DELIVERY_CHALLAN';

type DocOption = {
  id: string;
  number: string;
  date: string;
  total?: string;
  party?: string | null;
};

type PortalSheet = {
  partA: {
    documentNumber: string;
    documentDate: string;
    fromGstin: string | null;
    fromTradeName: string | null;
    fromStateCode: string | null;
    dispatchFrom: string | null;
    toGstin: string | null;
    toTradeName: string | null;
    toStateCode: string | null;
    taxableValue: number;
    cgst: number;
    sgst: number;
    igst: number;
    totalValue: number;
  };
  items: {
    description: string; hsnCode: string | null; quantity: number;
    unit: string; taxableValue: number; taxRate: number;
  }[];
  partB: { transporterName: string | null; transporterId: string | null; raisedByShiprocket: boolean };
  missing: string[];
};

const DOC_LABEL: Record<DocType, string> = {
  INVOICE: 'Invoices',
  CREDIT_NOTE: 'Credit Notes',
  DELIVERY_CHALLAN: 'Delivery Challans',
};

export default function NewEwayBillPage() {
  const router = useRouter();
  const params = useSearchParams();

  const [documentType, setDocumentType] = useState<DocType>('INVOICE');
  const [docs, setDocs] = useState<DocOption[]>([]);
  const [docId, setDocId] = useState(params.get('invoiceId') ?? '');
  const [sheet, setSheet] = useState<PortalSheet | null>(null);

  const [form, setForm] = useState({
    transactionSubType: 'SUPPLY',
    transactionType: 'REGULAR',
    transporter: '',
    distanceKm: '0',
    transportMode: 'ROAD',
    vehicleType: 'REGULAR',
    vehicleNumber: '',
    transporterDocNumber: '',
    transporterDocDate: '',
    ewayBillNumber: '',
    generatedAt: '',
    validUntil: '',
    notes: '',
  });
  const set = (patch: Partial<typeof form>) => setForm((f) => ({ ...f, ...patch }));

  const [loadingDocs, setLoadingDocs] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const loadDocs = useCallback(async () => {
    setLoadingDocs(true);
    try {
      if (documentType === 'INVOICE') {
        const r = await api.get<Paged<{
          id: string; invoiceNumber: string; invoiceDate: string; grandTotal: string;
          customer: { displayName: string | null } | null;
        }>>('/invoices', { limit: 100 });
        setDocs(
          r.data.map((d) => ({
            id: d.id, number: d.invoiceNumber, date: d.invoiceDate,
            total: d.grandTotal, party: d.customer?.displayName ?? null,
          }))
        );
      } else if (documentType === 'CREDIT_NOTE') {
        const r = await api.get<Paged<{
          id: string; creditNumber: string; creditDate: string; grandTotal: string;
          customer: { displayName: string | null } | null;
        }>>('/credit-notes', { limit: 100 });
        setDocs(
          r.data.map((d) => ({
            id: d.id, number: d.creditNumber, date: d.creditDate,
            total: d.grandTotal, party: d.customer?.displayName ?? null,
          }))
        );
      } else {
        const r = await api.get<Paged<{
          id: string; challanNumber: string; challanDate: string;
          customer: { displayName: string | null } | null;
        }>>('/delivery-challans', { limit: 100 });
        setDocs(
          r.data.map((d) => ({
            id: d.id, number: d.challanNumber, date: d.challanDate,
            party: d.customer?.displayName ?? null,
          }))
        );
      }
    } catch (err) {
      setError(errorMessage(err));
      setDocs([]);
    } finally {
      setLoadingDocs(false);
    }
  }, [documentType]);

  useEffect(() => {
    const t = setTimeout(loadDocs, 0);
    return () => clearTimeout(t);
  }, [loadDocs]);

  useEffect(() => {
    let cancelled = false;
    if (!docId || documentType !== 'INVOICE') {
      const t = setTimeout(() => {
        if (!cancelled) setSheet(null);
      }, 0);
      return () => {
        cancelled = true;
        clearTimeout(t);
      };
    }
    api
      .get<{ data: PortalSheet }>(`/eway-bills/portal-sheet/${docId}`)
      .then((r) => {
        if (cancelled) return;
        setSheet(r.data);
        if (r.data.partB.transporterName) {
          setForm((f) => (f.transporter ? f : { ...f, transporter: r.data.partB.transporterName! }));
        }
      })
      .catch(() => {
        if (!cancelled) setSheet(null);
      });
    return () => {
      cancelled = true;
    };
  }, [docId, documentType]);

  async function save() {
    setError('');
    if (!docId) return setError('Pick the document this e-way bill covers');

    setSaving(true);
    try {
      await api.post('/eway-bills', {
        documentType,
        invoiceId: documentType === 'INVOICE' ? docId : undefined,
        creditNoteId: documentType === 'CREDIT_NOTE' ? docId : undefined,
        challanId: documentType === 'DELIVERY_CHALLAN' ? docId : undefined,
        transactionSubType: form.transactionSubType,
        transactionType: form.transactionType,
        transporter: form.transporter.trim() || undefined,
        distanceKm: Number(form.distanceKm || 0),
        transportMode: form.transportMode || undefined,
        vehicleType: form.vehicleType,
        vehicleNumber: form.vehicleNumber.trim() || undefined,
        transporterDocNumber: form.transporterDocNumber.trim() || undefined,
        transporterDocDate: form.transporterDocDate || undefined,
        ewayBillNumber: form.ewayBillNumber.trim() || undefined,
        generatedAt: form.generatedAt || undefined,
        validUntil: form.validUntil || undefined,
        notes: form.notes.trim() || undefined,
      });
      router.push('/admin/eway-bills');
    } catch (err) {
      setError(errorMessage(err));
      setSaving(false);
    }
  }

  const chosen = docs.find((d) => d.id === docId) ?? null;

  return (
    <>
      <PageCrumb label="New" />

      <PageHeader
        title="New e-Way Bill"
        subtitle="Recorded here, generated on the government portal"
      />

      {error && <div className="mb-4"><ErrorBox message={error} /></div>}

      <div className="grid gap-5 pb-8 lg:grid-cols-3">
        <div className="space-y-5 lg:col-span-2 min-w-0">
          <Card title="Document">
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Document type" required>
                <Select
                  value={documentType}
                  onChange={(e) => {
                    setDocumentType(e.target.value as DocType);
                    setDocId('');
                    setSheet(null);
                  }}
                  className="w-full"
                >
                  {(Object.keys(DOC_LABEL) as DocType[]).map((k) => (
                    <option key={k} value={k}>{DOC_LABEL[k]}</option>
                  ))}
                </Select>
              </Field>

              <Field label="Transaction sub type" required>
                <Select
                  value={form.transactionSubType}
                  onChange={(e) => set({ transactionSubType: e.target.value })}
                  className="w-full"
                >
                  <option value="SUPPLY">Supply</option>
                  <option value="EXPORT">Export</option>
                  <option value="SKD_CKD">SKD/CKD</option>
                </Select>
              </Field>

              <Field
                label={documentType === 'INVOICE' ? 'Invoice' : documentType === 'CREDIT_NOTE' ? 'Credit note' : 'Delivery challan'}
                required
                hint={loadingDocs ? 'Loading…' : `${docs.length} available`}
              >
                <Select
                  value={docId}
                  onChange={(e) => setDocId(e.target.value)}
                  className="w-full"
                  disabled={loadingDocs}
                >
                  <option value="">Select…</option>
                  {docs.map((d) => (
                    <option key={d.id} value={d.id}>
                      {d.number}
                      {d.party ? ` — ${d.party}` : ''}
                      {d.total ? ` · ${money(d.total)}` : ''}
                    </option>
                  ))}
                </Select>
              </Field>

              <Field label="Transaction type" hint="Whether billing and delivery are the same pair">
                <Select
                  value={form.transactionType}
                  onChange={(e) => set({ transactionType: e.target.value })}
                  className="w-full"
                >
                  <option value="REGULAR">Regular</option>
                  <option value="BILL_TO_SHIP_TO">Bill to — Ship to</option>
                  <option value="BILL_FROM_DISPATCH_FROM">Bill from — Dispatch from</option>
                  <option value="COMBINATION">Combination</option>
                </Select>
              </Field>
            </div>

            {chosen && (
              <p className="mt-3 text-xs text-muted-foreground">
                {chosen.number} · {shortDate(chosen.date)}
                {chosen.total ? ` · ${money(chosen.total)}` : ''}
              </p>
            )}
          </Card>

          <Card title="Transportation">
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <span className="mb-1 block text-xs font-medium text-muted-foreground">
                  Transporter
                </span>
                <TransporterSelect
                  value={form.transporter}
                  onChange={(transporter) => set({ transporter })}
                />
              </div>
              <Field
                label="Distance (in km)"
                hint="Leave 0 and the portal works it out from the two addresses"
              >
                <Input
                  type="number"
                  min="0"
                  value={form.distanceKm}
                  onChange={(e) => set({ distanceKm: e.target.value })}
                />
              </Field>
            </div>

            <div className="mt-4 border-t border-border pt-4">
              <div className="mb-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Part B
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="Mode of transportation">
                  <Select
                    value={form.transportMode}
                    onChange={(e) => set({ transportMode: e.target.value })}
                    className="w-full"
                  >
                    <option value="ROAD">Road</option>
                    <option value="RAIL">Rail</option>
                    <option value="AIR">Air</option>
                    <option value="SHIP">Ship</option>
                  </Select>
                </Field>
                <Field label="Vehicle type">
                  <Select
                    value={form.vehicleType}
                    onChange={(e) => set({ vehicleType: e.target.value })}
                    className="w-full"
                  >
                    <option value="REGULAR">Regular</option>
                    <option value="OVER_DIMENSIONAL_CARGO">Over dimensional cargo</option>
                  </Select>
                </Field>
                <Field label="Vehicle no.">
                  <Input
                    value={form.vehicleNumber}
                    onChange={(e) => set({ vehicleNumber: e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, '') })}
                    placeholder="UP32AB1234"
                    maxLength={12}
                    className="font-mono"
                  />
                </Field>
                <div className="grid grid-cols-2 gap-3">
                  <Field label="Transporter's doc no.">
                    <Input
                      value={form.transporterDocNumber}
                      onChange={(e) => set({ transporterDocNumber: e.target.value })}
                    />
                  </Field>
                  <Field label="Doc date">
                    <Input
                      type="date"
                      value={form.transporterDocDate}
                      onChange={(e) => set({ transporterDocDate: e.target.value })}
                    />
                  </Field>
                </div>
              </div>
            </div>
          </Card>

          <Card title="Portal reference">
            <p className="mb-3 text-xs text-muted-foreground">
              Fill these in after generating on{' '}
              <a href="https://ewaybillgst.gov.in" target="_blank" rel="noreferrer" className="underline">
                ewaybillgst.gov.in
              </a>
              . Leave them blank to save this as a draft and come back to it.
            </p>
            <div className="grid gap-4 sm:grid-cols-3">
              <Field
                label="e-Way Bill number"
                hint={
                  form.ewayBillNumber && form.ewayBillNumber.length !== 12 ? (
                    <span className="text-warning">The portal issues 12 digits</span>
                  ) : undefined
                }
              >
                <Input
                  inputMode="numeric"
                  value={form.ewayBillNumber}
                  onChange={(e) => set({ ewayBillNumber: e.target.value.replace(/\D/g, '').slice(0, 12) })}
                  maxLength={12}
                  placeholder="12 digits"
                  className="font-mono"
                />
              </Field>
              <Field label="Generated on">
                <Input
                  type="date"
                  value={form.generatedAt}
                  onChange={(e) => set({ generatedAt: e.target.value })}
                />
              </Field>
              <Field label="Valid until">
                <Input
                  type="date"
                  value={form.validUntil}
                  onChange={(e) => set({ validUntil: e.target.value })}
                />
              </Field>
            </div>
          </Card>
        </div>

        <div className="space-y-5">
          {sheet ? (
            <>
              {sheet.missing.length > 0 && (
                <div className="rounded-md border border-warning/30 bg-warning/10 px-3 py-2.5 text-xs text-warning">
                  <strong>The portal will reject this until fixed:</strong>
                  <ul className="mt-1 list-inside list-disc space-y-0.5">
                    {sheet.missing.map((m) => (
                      <li key={m}>{m}</li>
                    ))}
                  </ul>
                </div>
              )}

              {sheet.partB.raisedByShiprocket && (
                <div className="rounded-md border border-gold/30 bg-gold-soft/60 px-3 py-2.5 text-xs text-foreground">
                  This consignment ships via Shiprocket, which raises its own e-way bill. Record one
                  here only if you are generating it yourself.
                </div>
              )}

              <Card title="Copy into the portal">
                <p className="mb-3 text-xs text-muted-foreground">
                  Part A, in the order the portal asks for it. Every figure comes off the document —
                  nothing here is retyped.
                </p>
                <dl className="space-y-1.5 text-xs">
                  {[
                    ['Document', `${sheet.partA.documentNumber} · ${shortDate(sheet.partA.documentDate)}`],
                    ['From GSTIN', sheet.partA.fromGstin],
                    ['From', sheet.partA.fromTradeName],
                    ['Dispatch from', sheet.partA.dispatchFrom],
                    ['To GSTIN', sheet.partA.toGstin],
                    ['To', sheet.partA.toTradeName],
                    ['Place of delivery', sheet.partA.toStateCode ? stateLabel(sheet.partA.toStateCode) : null],
                    ['Taxable value', money(sheet.partA.taxableValue)],
                    ['CGST', money(sheet.partA.cgst)],
                    ['SGST', money(sheet.partA.sgst)],
                    ['IGST', money(sheet.partA.igst)],
                    ['Total value', money(sheet.partA.totalValue)],
                  ].map(([label, value]) => (
                    <div
                      key={label as string}
                      className="flex justify-between gap-3 border-b border-border pb-1 last:border-0"
                    >
                      <dt className="shrink-0 text-muted-foreground">{label}</dt>
                      <dd className="text-right text-foreground">
                        {value || <span className="text-muted-foreground/60">—</span>}
                      </dd>
                    </div>
                  ))}
                </dl>

                <div className="mt-3 border-t border-border pt-3">
                  <div className="mb-1.5 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                    Items
                  </div>
                  <ul className="space-y-1.5 text-xs">
                    {sheet.items.map((it, i) => (
                      <li key={i} className="text-foreground">
                        {it.description}
                        <span className="block text-muted-foreground">
                          HSN{' '}
                          {it.hsnCode ?? (
                            <span className="text-destructive">not set</span>
                          )}{' '}
                          · {it.quantity} {it.unit} · {money(it.taxableValue)} · {it.taxRate}%
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>
              </Card>
            </>
          ) : (
            <Card title="Copy into the portal">
              <p className="text-xs text-muted-foreground">
                Pick an invoice and everything the portal asks for appears here, ready to copy
                across.
              </p>
            </Card>
          )}
        </div>
      </div>
      <SaveBar>
        <Link href="/admin/eway-bills"><Button type="button">Cancel</Button></Link>
        <Button variant="primary" onClick={save} disabled={saving || !docId}>
          {saving && <Spinner className="border-card/40 border-t-card" />}
          Save
        </Button>
      </SaveBar>
    </>
  );
}
