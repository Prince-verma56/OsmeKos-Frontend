'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { api, money, shortDate, errorMessage } from '@/lib/api';
import { stateLabel } from '@/lib/states';
import { ComboSelect } from '@/components/ComboSelect';
import { useToast } from '@/lib/toast';
import {
  Badge, Button, Card, ErrorBox, Field, Input, Loading,
  PageHeader, Select, Spinner, Textarea,
} from '@/components/ui';

type EwayBill = {
  id: string;
  ewayBillNumber: string | null;
  status: 'NOT_GENERATED' | 'GENERATED' | 'CANCELLED' | 'EXPIRED';
  generatedAt: string | null;
  validUntil: string | null;
  cancelledAt: string | null;
  cancelReason: string | null;
  documentType: 'INVOICE' | 'CREDIT_NOTE' | 'DELIVERY_CHALLAN';
  transactionSubType: string;
  transactionType: string;
  placeOfDeliveryCode: string | null;
  placeOfDeliveryState: string | null;
  transporter: string | null;
  transporterId: string | null;
  distanceKm: number;
  transportMode: 'ROAD' | 'RAIL' | 'AIR' | 'SHIP' | null;
  vehicleType: 'REGULAR' | 'OVER_DIMENSIONAL_CARGO';
  vehicleNumber: string | null;
  transporterDocNumber: string | null;
  transporterDocDate: string | null;
  notes: string | null;
  createdAt: string;
  invoice: {
    id: string; invoiceNumber: string; invoiceDate: string; grandTotal: string;
    gstin: string | null; placeOfSupplyCode: string | null;
    customer: { id: string; displayName: string | null } | null;
  } | null;
  creditNote: { id: string; creditNumber: string; creditDate: string; grandTotal: string } | null;
  challan: { id: string; challanNumber: string; challanDate: string } | null;
  customer: { id: string; displayName: string | null } | null;
};

const STATUS_TONE: Record<string, 'gray' | 'green' | 'red' | 'amber'> = {
  NOT_GENERATED: 'gray',
  GENERATED: 'green',
  CANCELLED: 'red',
  EXPIRED: 'amber',
};

const STATUS_LABEL: Record<string, string> = {
  NOT_GENERATED: 'Not generated',
  GENERATED: 'Generated',
  CANCELLED: 'Cancelled',
  EXPIRED: 'Expired',
};

const DOC_LABEL: Record<string, string> = {
  INVOICE: 'Invoice',
  CREDIT_NOTE: 'Credit note',
  DELIVERY_CHALLAN: 'Delivery challan',
};

const SUBTYPE_LABEL: Record<string, string> = {
  SUPPLY: 'Supply',
  EXPORT: 'Export',
  SKD_CKD: 'SKD/CKD',
};

const TXN_LABEL: Record<string, string> = {
  REGULAR: 'Regular',
  BILL_TO_SHIP_TO: 'Bill to — Ship to',
  BILL_FROM_DISPATCH_FROM: 'Bill from — Dispatch from',
  COMBINATION: 'Combination',
};

const MODE_LABEL: Record<string, string> = {
  ROAD: 'Road', RAIL: 'Rail', AIR: 'Air', SHIP: 'Ship',
};

const dateInput = (v: string | null) => (v ? v.slice(0, 10) : '');

function Line({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-4 py-1.5">
      <span className="text-xs text-muted-foreground">{label}</span>
      <span className="text-right text-sm text-foreground">{children}</span>
    </div>
  );
}

export default function EwayBillDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const toast = useToast();

  const [bill, setBill] = useState<EwayBill | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const [editing, setEditing] = useState(false);
  const [cancelling, setCancelling] = useState(false);
  const [cancelReason, setCancelReason] = useState('');
  const [formError, setFormError] = useState('');
  const [saving, setSaving] = useState(false);
  const [busy, setBusy] = useState(false);

  const [ewayBillNumber, setEwayBillNumber] = useState('');
  const [generatedAt, setGeneratedAt] = useState('');
  const [validUntil, setValidUntil] = useState('');
  const [transporter, setTransporter] = useState('');
  const [transporterId, setTransporterId] = useState('');
  const [distanceKm, setDistanceKm] = useState('0');
  const [transportMode, setTransportMode] = useState('');
  const [vehicleType, setVehicleType] = useState('REGULAR');
  const [vehicleNumber, setVehicleNumber] = useState('');
  const [docNumber, setDocNumber] = useState('');
  const [docDate, setDocDate] = useState('');
  const [notes, setNotes] = useState('');

  const load = useCallback(async () => {
    setError('');
    try {
      const res = await api.get<{ data: EwayBill }>(`/eway-bills/${id}`);
      setBill(res.data);
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

  function startEdit() {
    if (!bill) return;
    setEwayBillNumber(bill.ewayBillNumber ?? '');
    setGeneratedAt(dateInput(bill.generatedAt));
    setValidUntil(dateInput(bill.validUntil));
    setTransporter(bill.transporter ?? '');
    setTransporterId(bill.transporterId ?? '');
    setDistanceKm(String(bill.distanceKm ?? 0));
    setTransportMode(bill.transportMode ?? '');
    setVehicleType(bill.vehicleType);
    setVehicleNumber(bill.vehicleNumber ?? '');
    setDocNumber(bill.transporterDocNumber ?? '');
    setDocDate(dateInput(bill.transporterDocDate));
    setNotes(bill.notes ?? '');
    setFormError('');
    setEditing(true);
  }

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setFormError('');

    const number = ewayBillNumber.trim();
    try {
      await api.patch(`/eway-bills/${id}`, {
        ewayBillNumber: number || null,
        status: number ? 'GENERATED' : 'NOT_GENERATED',
        generatedAt: generatedAt || null,
        validUntil: validUntil || null,
        transporter: transporter.trim() || null,
        transporterId: transporterId.trim() || null,
        distanceKm: Number(distanceKm) || 0,
        transportMode: transportMode || null,
        vehicleType,
        vehicleNumber: vehicleNumber.trim() || null,
        transporterDocNumber: docNumber.trim() || null,
        transporterDocDate: docDate || null,
        notes: notes.trim() || null,
      });
      toast.success('e-Way bill updated');
      setEditing(false);
      await load();
    } catch (err) {
      setFormError(errorMessage(err));
    } finally {
      setSaving(false);
    }
  }

  async function cancel(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setFormError('');
    try {
      await api.patch(`/eway-bills/${id}`, {
        status: 'CANCELLED',
        cancelReason: cancelReason.trim() || null,
      });
      toast.success('e-Way bill marked cancelled');
      setCancelling(false);
      setCancelReason('');
      await load();
    } catch (err) {
      setFormError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  async function remove() {
    if (!bill) return;
    if (!confirm('Delete this e-way bill record? The document it covers is not affected.')) return;
    setBusy(true);
    try {
      await api.del(`/eway-bills/${id}`);
      toast.success('e-Way bill record deleted');
      router.push('/admin/eway-bills');
    } catch (err) {
      setError(errorMessage(err));
      setBusy(false);
    }
  }

  if (loading) return <Loading label="Loading e-way bill…" />;
  if (error && !bill) return <ErrorBox message={error} onRetry={load} />;
  if (!bill) return null;

  const docNumberText =
    bill.invoice?.invoiceNumber ?? bill.creditNote?.creditNumber ?? bill.challan?.challanNumber ?? '—';
  const docHref = bill.invoice
    ? `/invoices/${bill.invoice.id}`
    : bill.creditNote
      ? `/credit-notes/${bill.creditNote.id}`
      : bill.challan
        ? `/delivery-challans/${bill.challan.id}`
        : null;
  const docDateText =
    bill.invoice?.invoiceDate ?? bill.creditNote?.creditDate ?? bill.challan?.challanDate ?? null;
  const total = bill.invoice?.grandTotal ?? bill.creditNote?.grandTotal ?? null;
  const customerName =
    bill.customer?.displayName ?? bill.invoice?.customer?.displayName ?? '—';
  const deliveryCode = bill.placeOfDeliveryCode ?? bill.invoice?.placeOfSupplyCode ?? null;
  const isCancelled = bill.status === 'CANCELLED';

  return (
    <>
      <div className="mb-1 flex items-center gap-1.5 text-xs text-muted-foreground">
        <Link href="/admin/eway-bills" className="hover:underline">
          e-Way Bills
        </Link>
        <span>/</span>
        <span className="text-foreground">
          {bill.ewayBillNumber ?? 'Not generated'}
        </span>
      </div>

      <PageHeader
        title={bill.ewayBillNumber ?? 'No number recorded yet'}
        subtitle={`${DOC_LABEL[bill.documentType]} ${docNumberText} · ${customerName}`}
        actions={
          <div className="flex items-center gap-2">
            <Badge tone={STATUS_TONE[bill.status]}>{STATUS_LABEL[bill.status]}</Badge>
            {!editing && !isCancelled && (
              <Button variant="primary" onClick={startEdit}>
                Edit
              </Button>
            )}
            {!editing && !isCancelled && bill.status === 'GENERATED' && (
              <Button variant="danger" onClick={() => setCancelling(true)}>
                Mark cancelled
              </Button>
            )}
            <Button variant="danger" disabled={busy} onClick={remove}>
              Delete
            </Button>
          </div>
        }
      />

      {error && (
        <div className="mb-4">
          <ErrorBox message={error} />
        </div>
      )}

      {cancelling && (
        <div className="mb-5">
          <Card title="Mark this e-way bill cancelled">
            <form onSubmit={cancel} className="space-y-3">
              <p className="text-sm text-muted-foreground">
                This records that the bill was cancelled on the NIC portal. It does not cancel
                anything there — do that on the portal first, within 24 hours of generating it.
              </p>
              <Field label="Reason" hint="The same reason you picked on the portal">
                <ComboSelect
                  value={cancelReason}
                  options={['Duplicate', 'Order cancelled', 'Data entry mistake', 'Others']}
                  onChange={setCancelReason}
                  placeholder="Select a reason"
                  addLabel="+ Write the reason"
                  newPlaceholder="Wrong vehicle number entered"
                />
              </Field>
              <div className="flex gap-2">
                <Button type="submit" variant="danger" disabled={busy}>
                  {busy && <Spinner className="h-3 w-3" />}
                  Mark cancelled
                </Button>
                <Button type="button" onClick={() => setCancelling(false)}>
                  Keep it
                </Button>
              </div>
            </form>
          </Card>
        </div>
      )}

      <div className="grid gap-5 lg:grid-cols-3">
        <div className="space-y-5 lg:col-span-2 min-w-0">
          {editing ? (
            <Card title="Edit e-way bill">
              {formError && (
                <div className="mb-4">
                  <ErrorBox message={formError} />
                </div>
              )}
              <form onSubmit={save} className="space-y-5">
                <div>
                  <h3 className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    From the portal
                  </h3>
                  <div className="grid gap-3 sm:grid-cols-3">
                    <Field label="e-Way Bill number" hint="12 digits from the NIC portal">
                      <Input
                        value={ewayBillNumber}
                        onChange={(e) => setEwayBillNumber(e.target.value)}
                        placeholder="181000012345"
                        className="font-mono"
                      />
                    </Field>
                    <Field label="Generated on">
                      <Input
                        type="date"
                        value={generatedAt}
                        onChange={(e) => setGeneratedAt(e.target.value)}
                      />
                    </Field>
                    <Field label="Valid until">
                      <Input
                        type="date"
                        value={validUntil}
                        onChange={(e) => setValidUntil(e.target.value)}
                      />
                    </Field>
                  </div>
                </div>

                <div>
                  <h3 className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    Part A — transporter
                  </h3>
                  <div className="grid gap-3 sm:grid-cols-3">
                    <Field label="Transporter">
                      <Input
                        value={transporter}
                        onChange={(e) => setTransporter(e.target.value)}
                        placeholder="Delhivery"
                      />
                    </Field>
                    <Field label="Transporter ID" hint="15-char GSTIN or TRANSIN">
                      <Input
                        value={transporterId}
                        onChange={(e) => setTransporterId(e.target.value)}
                        className="font-mono"
                        maxLength={20}
                      />
                    </Field>
                    <Field label="Distance (km)">
                      <Input
                        type="number"
                        min={0}
                        value={distanceKm}
                        onChange={(e) => setDistanceKm(e.target.value)}
                      />
                    </Field>
                  </div>
                </div>

                <div>
                  <h3 className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    Part B — vehicle
                  </h3>
                  <div className="grid gap-3 sm:grid-cols-2">
                    <Field label="Mode of transportation">
                      <Select
                        value={transportMode}
                        onChange={(e) => setTransportMode(e.target.value)}
                        className="w-full"
                      >
                        <option value="">Not set</option>
                        <option value="ROAD">Road</option>
                        <option value="RAIL">Rail</option>
                        <option value="AIR">Air</option>
                        <option value="SHIP">Ship</option>
                      </Select>
                    </Field>
                    <Field label="Vehicle type">
                      <Select
                        value={vehicleType}
                        onChange={(e) => setVehicleType(e.target.value)}
                        className="w-full"
                      >
                        <option value="REGULAR">Regular</option>
                        <option value="OVER_DIMENSIONAL_CARGO">Over dimensional cargo</option>
                      </Select>
                    </Field>
                    <Field label="Vehicle no.">
                      <Input
                        value={vehicleNumber}
                        onChange={(e) => setVehicleNumber(e.target.value.toUpperCase())}
                        placeholder="UP32AB1234"
                        className="font-mono"
                      />
                    </Field>
                    <div className="grid grid-cols-2 gap-3">
                      <Field label="Transporter's doc no.">
                        <Input value={docNumber} onChange={(e) => setDocNumber(e.target.value)} />
                      </Field>
                      <Field label="Doc date">
                        <Input
                          type="date"
                          value={docDate}
                          onChange={(e) => setDocDate(e.target.value)}
                        />
                      </Field>
                    </div>
                  </div>
                </div>

                <Field label="Notes">
                  <Textarea rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} />
                </Field>

                <div className="flex gap-2">
                  <Button type="submit" variant="primary" disabled={saving}>
                    {saving && <Spinner className="border-card/40 border-t-card" />}
                    Save changes
                  </Button>
                  <Button type="button" onClick={() => setEditing(false)}>
                    Cancel
                  </Button>
                </div>
              </form>
            </Card>
          ) : (
            <>
              <Card title="Consignment">
                <div className="divide-y divide-border">
                  <Line label="Document">
                    {docHref ? (
                      <Link
                        href={docHref}
                        className="text-gold-ink hover:underline"
                      >
                        {docNumberText}
                      </Link>
                    ) : (
                      docNumberText
                    )}
                    <span className="ml-1.5 text-xs text-muted-foreground">
                      {DOC_LABEL[bill.documentType]}
                    </span>
                  </Line>
                  <Line label="Document date">{shortDate(docDateText)}</Line>
                  {total && <Line label="Value">{money(total)}</Line>}
                  <Line label="Customer">{customerName}</Line>
                  {bill.invoice?.gstin && (
                    <Line label="Customer GSTIN">
                      <span className="font-mono text-xs">{bill.invoice.gstin}</span>
                    </Line>
                  )}
                  <Line label="Place of delivery">
                    {deliveryCode
                      ? stateLabel(deliveryCode)
                      : (bill.placeOfDeliveryState ?? '—')}
                  </Line>
                  <Line label="Transaction sub type">
                    {SUBTYPE_LABEL[bill.transactionSubType] ?? bill.transactionSubType}
                  </Line>
                  <Line label="Transaction type">
                    {TXN_LABEL[bill.transactionType] ?? bill.transactionType}
                  </Line>
                </div>
              </Card>

              <Card title="Transport">
                <div className="divide-y divide-border">
                  <Line label="Transporter">{bill.transporter ?? '—'}</Line>
                  <Line label="Transporter ID">
                    {bill.transporterId ? (
                      <span className="font-mono text-xs">{bill.transporterId}</span>
                    ) : (
                      '—'
                    )}
                  </Line>
                  <Line label="Distance">
                    {bill.distanceKm ? `${bill.distanceKm} km` : '—'}
                  </Line>
                  <Line label="Mode">
                    {bill.transportMode ? MODE_LABEL[bill.transportMode] : '—'}
                  </Line>
                  <Line label="Vehicle type">
                    {bill.vehicleType === 'OVER_DIMENSIONAL_CARGO'
                      ? 'Over dimensional cargo'
                      : 'Regular'}
                  </Line>
                  <Line label="Vehicle no.">
                    {bill.vehicleNumber ? (
                      <span className="font-mono">{bill.vehicleNumber}</span>
                    ) : (
                      '—'
                    )}
                  </Line>
                  <Line label="Transporter's doc">
                    {bill.transporterDocNumber ?? '—'}
                    {bill.transporterDocDate && (
                      <span className="ml-1.5 text-xs text-muted-foreground">
                        {shortDate(bill.transporterDocDate)}
                      </span>
                    )}
                  </Line>
                </div>
              </Card>

              {bill.notes && (
                <Card title="Notes">
                  <p className="whitespace-pre-wrap text-sm text-foreground">
                    {bill.notes}
                  </p>
                </Card>
              )}
            </>
          )}
        </div>

        <div className="space-y-5">
          <Card title="Status">
            <div className="divide-y divide-border">
              <Line label="State">
                <Badge tone={STATUS_TONE[bill.status]}>{STATUS_LABEL[bill.status]}</Badge>
              </Line>
              <Line label="Number">
                {bill.ewayBillNumber ? (
                  <span className="font-mono">{bill.ewayBillNumber}</span>
                ) : (
                  <span className="text-muted-foreground">Not recorded</span>
                )}
              </Line>
              <Line label="Generated on">{shortDate(bill.generatedAt)}</Line>
              <Line label="Valid until">{shortDate(bill.validUntil)}</Line>
              {bill.cancelledAt && <Line label="Cancelled on">{shortDate(bill.cancelledAt)}</Line>}
              {bill.cancelReason && <Line label="Reason">{bill.cancelReason}</Line>}
              <Line label="Recorded">{shortDate(bill.createdAt)}</Line>
            </div>
          </Card>

          {bill.invoice && (
            <Card title="Copy into the portal">
              <p className="text-sm text-muted-foreground">
                Everything the NIC portal asks for, laid out in its own field order, so you can
                type it across without hunting through this page.
              </p>
              <div className="mt-3">
                <Link href={`/admin/eway-bills/new?invoiceId=${bill.invoice.id}`}>
                  <Button>Open portal sheet</Button>
                </Link>
              </div>
            </Card>
          )}

          <Card title="What this record is">
            <p className="text-sm text-muted-foreground">
              Only the NIC portal issues a valid e-way bill number. This page stores the number that
              was issued and keeps it beside the document it covers, so the number is findable when
              a vehicle is stopped or the return is filed.
            </p>
            <p className="mt-2 text-sm text-muted-foreground">
              Where Shiprocket carries the goods, they raise the bill and the number belongs here
              too — paste it in rather than leaving the record blank.
            </p>
          </Card>
        </div>
      </div>
    </>
  );
}
