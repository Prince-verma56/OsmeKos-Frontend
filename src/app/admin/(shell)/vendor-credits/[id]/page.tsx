'use client';

import { usePdfView } from '@/lib/pdfView';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { api, money, shortDate, errorMessage } from '@/lib/api';
import { stateName } from '@/lib/states';
import { DocumentPdf, type PdfOrg } from '@/components/DocumentPdf';
import { Modal, ConfirmModal } from '@/components/Modal';
import {
  Badge, Button, Card, EmptyRow, ErrorBox, Input, Loading, PageHeader,
  Spinner, Table, Td, Th,
} from '@/components/ui';
import { Thumb } from '@/components/SearchSelect';
import { PageCrumb } from '@/lib/crumbs';

type Credit = {
  id: string;
  creditNumber: string;
  creditDate: string;
  reason: string | null;
  referenceNumber: string | null;
  orderNumber: string | null;
  status: string;
  stockReturned: boolean;
  sourceOfSupplyCode: string | null;
  destinationOfSupplyCode: string | null;
  isReverseCharge: boolean;
  taxTreatment: string;
  discountPercent: string | null;
  subtotal: string;
  discountTotal: string;
  cgstTotal: string;
  sgstTotal: string;
  igstTotal: string;
  taxTotal: string;
  taxWithholdingType: string | null;
  taxWithholdingName: string | null;
  taxWithholdingAmount: string;
  adjustment: string;
  adjustmentLabel: string;
  roundOff?: string;
  roundOffManual?: boolean;
  grandTotal: string;
  amountApplied: string;
  balance: string;
  notes: string | null;
  terms: string | null;
  vendor: {
    id: string; displayName: string; gstin: string | null;
    addresses?: {
      id: string; type: string; attention: string | null;
      line1: string; line2: string | null; city: string; state: string;
      stateCode: string | null; pincode: string; country: string;
    }[];
  } | null;
  bill: { id: string; billNumber: string } | null;
  purchaseOrder?: { id: string; poNumber: string } | null;
  purchaseReceive?: { id: string; receiveNumber: string } | null;
  replacementRequested?: boolean;
  location: { id: string; name: string } | null;
  lines: {
    id: string; itemName: string; description: string | null; hsnCode: string | null;
    unit: string; quantity: string; rate: string; taxRate: string; lineTotal: string;
    imageUrl?: string | null;
  }[];
  applications: {
    id: string; amount: string;
    bill: {
      id: string; billNumber: string; billDate: string;
      grandTotal: string; balanceDue: string; status: string;
    };
  }[];
};

type OpenBill = {
  id: string; billNumber: string; billDate: string;
  grandTotal: string; balanceDue: string; status: string;
};

export default function VendorCreditDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();

  const [credit, setCredit] = useState<Credit | null>(null);
  const [org, setOrg] = useState<PdfOrg | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [showPdf, setShowPdf] = usePdfView('vendor_credit');
  const [dialog, setDialog] = useState<'' | 'void' | 'delete'>('');
  const [reloadKey, setReloadKey] = useState(0);

  const [applying, setApplying] = useState(false);
  const [openBills, setOpenBills] = useState<OpenBill[]>([]);
  const [draft, setDraft] = useState<Record<string, string>>({});
  const [applyError, setApplyError] = useState('');

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        const [res, orgRes] = await Promise.all([
          api.get<{ data: Credit }>(`/vendor-credits/${id}`),
          api.get<{ data: PdfOrg }>('/organization').catch(() => null),
        ]);
        if (cancelled) return;
        setCredit(res.data);
        setOrg(orgRes?.data ?? null);
        setError('');
      } catch (err) {
        if (!cancelled) setError(errorMessage(err));
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [id, reloadKey]);

  async function act(fn: () => Promise<unknown>) {
    setBusy(true);
    setError('');
    try {
      await fn();
      setDialog('');
      setReloadKey((k) => k + 1);
    } catch (err) {
      setError(errorMessage(err));
      setDialog('');
    } finally {
      setBusy(false);
    }
  }

  async function openApply() {
    setApplying(true);
    setApplyError('');
    setDraft({});
    try {
      const res = await api.get<{ data: OpenBill[] }>(`/vendor-credits/${id}/open-bills`);
      setOpenBills(res.data);
    } catch (err) {
      setApplyError(errorMessage(err));
    }
  }

  async function submitApply() {
    const applications = Object.entries(draft)
      .map(([billId, amount]) => ({ billId, amount: Number(amount) }))
      .filter((a) => a.amount > 0);
    if (!applications.length) {
      setApplyError('Enter an amount against at least one bill');
      return;
    }
    setBusy(true);
    setApplyError('');
    try {
      await api.post(`/vendor-credits/${id}/apply`, { applications });
      setApplying(false);
      setReloadKey((k) => k + 1);
    } catch (err) {
      setApplyError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  if (loading) return <Loading />;
  if (!credit) return <ErrorBox message={error || 'Vendor credit not found'} />;

  const billing =
    credit.vendor?.addresses?.find((a) => a.type === 'BILLING') ??
    credit.vendor?.addresses?.[0] ??
    null;
  const vendorAddress = billing
    ? ([
        billing.line1,
        billing.line2,
        billing.city,
        [billing.pincode, billing.state].filter(Boolean).join(' '),
        billing.country,
      ].filter(Boolean) as string[])
    : [];

  const intraState =
    !!credit.sourceOfSupplyCode &&
    credit.sourceOfSupplyCode === credit.destinationOfSupplyCode;

  const uniformRate =
    credit.lines.length && credit.lines.every((l) => Number(l.taxRate) === Number(credit.lines[0].taxRate))
      ? Number(credit.lines[0].taxRate)
      : null;

  const draftTotal = Math.round(Object.values(draft).reduce((n, v) => n + (Number(v) || 0), 0) * 100) / 100;
  const remaining = Number(credit.balance);

  const totals = [
    { label: 'Sub Total', value: money(Number(credit.subtotal) + Number(credit.discountTotal)) },
    ...(Number(credit.discountTotal) > 0
      ? [{
          label: `Discount${credit.discountPercent && Number(credit.discountPercent) > 0 ? ` (${Number(credit.discountPercent)}%)` : ''}`,
          value: `(-) ${money(credit.discountTotal)}`,
          negative: true,
        }]
      : []),
    ...(intraState
      ? [
          { label: `CGST${uniformRate != null ? `${uniformRate / 2} (${uniformRate / 2}%)` : ''}`, value: money(credit.cgstTotal) },
          { label: `SGST${uniformRate != null ? `${uniformRate / 2} (${uniformRate / 2}%)` : ''}`, value: money(credit.sgstTotal) },
        ]
      : [{ label: `IGST${uniformRate != null ? `${uniformRate} (${uniformRate}%)` : ''}`, value: money(credit.igstTotal) }]),
    ...(credit.taxWithholdingType
      ? [{
          label: `${credit.taxWithholdingType}${credit.taxWithholdingName ? ` (${credit.taxWithholdingName})` : ''}`,
          value: `${credit.taxWithholdingType === 'TDS' ? '(-) ' : '(+) '}${money(credit.taxWithholdingAmount)}`,
          negative: credit.taxWithholdingType === 'TDS',
        }]
      : []),
    ...(Number(credit.adjustment) !== 0
      ? [{ label: credit.adjustmentLabel || 'Adjustment', value: money(credit.adjustment) }]
      : []),
    ...(Number(credit.roundOff ?? 0) !== 0
      ? [{ label: 'Round Off', value: money(credit.roundOff ?? 0) }]
      : []),
    { label: 'Total', value: money(credit.grandTotal), strong: true },
    { label: 'Credits Remaining', value: money(credit.balance), strong: true },
  ];

  return (
    <>
      <div className="print:hidden">
        <PageCrumb label={credit.vendor?.displayName ?? '—'} />

        <PageHeader
          title={credit.creditNumber}
          actions={
            <div className="flex items-center gap-2">
              <Badge status={credit.status}>{credit.status}</Badge>
              {credit.stockReturned && <Badge tone="blue">Goods returned</Badge>}
            </div>
          }
        />

        {credit.bill && (
          <p className="mb-3 text-sm text-muted-foreground">
            Associated Bill:{' '}
            <Link
              href={`/admin/bills/${credit.bill.id}`}
              className="font-medium text-gold-ink hover:underline"
            >
              {credit.bill.billNumber}
            </Link>
          </p>
        )}
        {credit.purchaseOrder && (
          <p className="mb-3 text-sm text-muted-foreground">
            Purchase order:{' '}
            <Link
              href={`/admin/purchase-orders/${credit.purchaseOrder.id}`}
              className="font-medium text-gold-ink hover:underline"
            >
              {credit.purchaseOrder.poNumber}
            </Link>
          </p>
        )}
        {credit.purchaseReceive && (
          <p className="mb-3 flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
            <span>
              Returns units rejected at QC on{' '}
              <Link
                href={`/admin/purchase-receives/${credit.purchaseReceive.id}`}
                className="font-medium text-gold-ink hover:underline"
              >
                {credit.purchaseReceive.receiveNumber}
              </Link>
            </span>
            {credit.replacementRequested && <Badge tone="gold">Replacement asked</Badge>}
          </p>
        )}

        <div className="mb-4 flex flex-wrap items-center gap-1 border-y border-border py-2">
          {credit.status !== 'VOID' && (
            <Link href={`/admin/vendor-credits/${credit.id}/edit`}>
              <Button size="sm" variant="ghost">✎ Edit</Button>
            </Link>
          )}
          <Button size="sm" variant="ghost" onClick={() => window.print()}>
            🖨 PDF/Print
          </Button>
          {remaining > 0 && credit.status === 'OPEN' && (
            <Button size="sm" variant="primary" onClick={openApply}>
              Apply to Bills
            </Button>
          )}
          {credit.status !== 'VOID' && (
            <Button size="sm" variant="ghost" onClick={() => setDialog('void')} disabled={busy}>
              Mark as Void
            </Button>
          )}
          <Button size="sm" variant="danger" onClick={() => setDialog('delete')} disabled={busy}>
            {busy && <Spinner />}
            Delete
          </Button>

          <label className="ml-auto flex cursor-pointer items-center gap-2 text-sm italic text-muted-foreground">
            Show PDF View
            <span
              onClick={() => setShowPdf((v) => !v)}
              className={`relative h-5 w-9 rounded-full transition-colors ${showPdf ? 'bg-primary' : 'bg-border'}`}
            >
              <span
                className={`absolute top-0.5 h-4 w-4 rounded-full bg-card transition-all ${showPdf ? 'left-[18px]' : 'left-0.5'}`}
              />
            </span>
          </label>
        </div>

        {error && <div className="mb-4"><ErrorBox message={error} /></div>}
      </div>

      {showPdf ? (
        <DocumentPdf
          rateLabel="Purchase Price"
          title="VENDOR CREDITS"
          org={org}
          ribbon={{
            label: credit.status === 'VOID' ? 'Void' : credit.status === 'CLOSED' ? 'Closed' : 'Open',
            tone: credit.status === 'VOID' ? 'red' : credit.status === 'CLOSED' ? 'green' : 'blue',
          }}
          numberLabel="CreditNote#"
          numberValue={credit.creditNumber}
          balanceLabel="Credits Remaining"
          balanceValue={money(credit.balance)}
          party={{
            heading: 'Vendor Address',
            name: credit.vendor?.displayName ?? '—',
            lines: vendorAddress,
            gstin: credit.vendor?.gstin,
          }}
          meta={[{ label: 'Date', value: shortDate(credit.creditDate) }]}
          lines={credit.lines.map((l) => ({
            name: l.itemName,
            description: l.description,
            hsnCode: l.hsnCode,
            quantity: l.quantity,
            unit: l.unit,
            rate: l.rate,
            amount: l.lineTotal,
          }))}
          totals={totals}
          notes={credit.notes}
          terms={credit.terms}
        />
      ) : (
        <div className="grid gap-5 lg:grid-cols-3">
          <div className="space-y-5 lg:col-span-2 min-w-0">
            <Card title={`Items (${credit.lines.length})`} padded={false}>
              <Table minWidth="620px">
                <thead>
                  <tr>
                    <Th>ITEM</Th>
                    <Th>HSN/SAC</Th>
                    <Th className="text-right">QTY</Th>
                    <Th className="text-right">PURCHASE PRICE</Th>
                    <Th className="text-right">TAX</Th>
                    <Th className="text-right">AMOUNT</Th>
                  </tr>
                </thead>
                <tbody>
                  {credit.lines.length === 0 && <EmptyRow colSpan={6} message="No lines" />}
                  {credit.lines.map((l) => (
                    <tr key={l.id}>
                      <Td>
                        <div className="flex items-start gap-2.5">
                          <Thumb url={l.imageUrl} label={l.itemName} />
                          <div className="min-w-0">
                            <div className="font-medium">{l.itemName}</div>
                        {l.description && (
                          <div className="text-xs text-muted-foreground">
                            {l.description}
                          </div>
                        )}
                          </div>
                        </div>
                      </Td>
                      <Td className="text-xs">{l.hsnCode ?? '—'}</Td>
                      <Td className="text-right">
                        {Number(l.quantity)} {l.unit}
                      </Td>
                      <Td className="text-right">{money(l.rate)}</Td>
                      <Td className="text-right text-xs">{Number(l.taxRate)}%</Td>
                      <Td className="text-right font-medium">{money(l.lineTotal)}</Td>
                    </tr>
                  ))}
                </tbody>
              </Table>
              <div className="border-t border-border p-4">
                <dl className="ml-auto max-w-xs space-y-1.5 text-sm">
                  {totals.map((t) => (
                    <div
                      key={t.label}
                      className={`flex justify-between ${t.strong ? 'border-t border-border pt-1.5 font-semibold' : ''}`}
                    >
                      <dt className="text-muted-foreground">{t.label}</dt>
                      <dd className={t.negative ? 'text-destructive' : ''}>{t.value}</dd>
                    </div>
                  ))}
                </dl>
              </div>
            </Card>

            <Card title={`Applied to bills (${credit.applications.length})`} padded={false}>
              <Table minWidth="620px">
                <thead>
                  <tr>
                    <Th>BILL#</Th>
                    <Th>BILL DATE</Th>
                    <Th>STATUS</Th>
                    <Th className="text-right">STILL DUE</Th>
                    <Th className="text-right">APPLIED</Th>
                    <Th />
                  </tr>
                </thead>
                <tbody>
                  {credit.applications.length === 0 && (
                    <EmptyRow colSpan={6} message="Not used against any bill yet" />
                  )}
                  {credit.applications.map((a) => (
                    <tr key={a.id}>
                      <Td>
                        <Link
                          href={`/admin/bills/${a.bill.id}`}
                          className="font-medium text-gold-ink hover:underline"
                        >
                          {a.bill.billNumber}
                        </Link>
                      </Td>
                      <Td className="text-xs text-muted-foreground">
                        {shortDate(a.bill.billDate)}
                      </Td>
                      <Td>
                        <Badge status={a.bill.status}>{a.bill.status.replaceAll('_', ' ')}</Badge>
                      </Td>
                      <Td className="text-right">{money(a.bill.balanceDue)}</Td>
                      <Td className="text-right font-medium">{money(a.amount)}</Td>
                      <Td className="text-right">
                        <button
                          type="button"
                          onClick={() =>
                            act(() =>
                              api.del(`/vendor-credits/${credit.id}/applications/${a.id}`)
                            )
                          }
                          className="text-xs text-gold-ink hover:underline"
                        >
                          Remove
                        </button>
                      </Td>
                    </tr>
                  ))}
                </tbody>
              </Table>
              <div className="flex items-center justify-between border-t border-border px-4 py-3 text-sm">
                <span className="text-muted-foreground">Credits remaining</span>
                <span className="font-semibold">{money(credit.balance)}</span>
              </div>
            </Card>
          </div>

          <div className="space-y-5">
            <Card title="Details">
              <dl className="space-y-2 text-sm">
                {[
                  ['Date', shortDate(credit.creditDate)],
                  ['Reference#', credit.referenceNumber ?? '—'],
                  ['Order number', credit.orderNumber ?? '—'],
                  ['Reason', credit.reason ?? '—'],
                  ['Location', credit.location?.name ?? '—'],
                  [
                    'Place of supply',
                    credit.sourceOfSupplyCode
                      ? `${stateName(credit.sourceOfSupplyCode)} → ${stateName(credit.destinationOfSupplyCode ?? '')}`
                      : '—',
                  ],
                  ['Tax treatment', credit.taxTreatment === 'INCLUSIVE' ? 'Rates include GST' : 'Rates exclude GST'],
                  ...(credit.isReverseCharge ? [['Reverse charge', 'Applicable']] : []),
                ].map(([label, value]) => (
                  <div key={label} className="flex justify-between gap-3">
                    <dt className="text-muted-foreground">{label}</dt>
                    <dd className="text-right text-foreground">{value}</dd>
                  </div>
                ))}
              </dl>
              {credit.notes && (
                <div className="mt-4 border-t border-border pt-3">
                  <div className="mb-1 text-xs font-medium text-muted-foreground">
                    NOTES
                  </div>
                  <p className="whitespace-pre-line text-sm text-foreground">
                    {credit.notes}
                  </p>
                </div>
              )}
            </Card>

            <Card title="Vendor">
              {credit.vendor ? (
                <>
                  <Link
                    href={`/admin/vendors/${credit.vendor.id}`}
                    className="font-medium text-gold-ink hover:underline"
                  >
                    {credit.vendor.displayName}
                  </Link>
                  {vendorAddress.length > 0 && (
                    <p className="mt-2 whitespace-pre-line text-xs text-muted-foreground">
                      {vendorAddress.join('\n')}
                    </p>
                  )}
                  {credit.vendor.gstin && (
                    <p className="mt-2 font-mono text-xs">GSTIN {credit.vendor.gstin}</p>
                  )}
                </>
              ) : (
                <p className="text-sm text-muted-foreground">No vendor.</p>
              )}
            </Card>
          </div>
        </div>
      )}

      <Modal
        open={applying}
        onClose={() => setApplying(false)}
        title={`Apply ${money(credit.balance)} to bills`}
        width="max-w-2xl"
        footer={
          <>
            <Button variant="ghost" onClick={() => setApplying(false)}>Cancel</Button>
            <Button variant="primary" onClick={submitApply} disabled={busy}>
              {busy && <Spinner />}
              Apply {money(draftTotal)}
            </Button>
          </>
        }
      >
        {applyError && <div className="mb-3"><ErrorBox message={applyError} /></div>}
        <p className="mb-3 text-sm text-muted-foreground">
          Each bill&apos;s balance falls by what you put against it. Anything left stays as credit
          with the vendor.
        </p>
        <Table minWidth="480px">
          <thead>
            <tr>
              <Th>BILL#</Th>
              <Th>DATE</Th>
              <Th className="text-right">STILL DUE</Th>
              <Th className="text-right">APPLY</Th>
            </tr>
          </thead>
          <tbody>
            {openBills.length === 0 && (
              <EmptyRow colSpan={4} message="This vendor has no bills with a balance" />
            )}
            {openBills.map((b) => (
              <tr key={b.id}>
                <Td className="font-medium">{b.billNumber}</Td>
                <Td className="text-xs text-muted-foreground">
                  {shortDate(b.billDate)}
                </Td>
                <Td className="text-right">{money(b.balanceDue)}</Td>
                <Td className="text-right">
                  <Input
                    type="number" step="0.01" min="0" max={b.balanceDue}
                    className="w-28 text-right"
                    value={draft[b.id] ?? ''}
                    onChange={(e) => setDraft((d) => ({ ...d, [b.id]: e.target.value }))}
                    placeholder="0.00"
                  />
                </Td>
              </tr>
            ))}
          </tbody>
        </Table>
        {draftTotal > remaining && (
          <p className="mt-3 text-sm text-destructive">
            That is {money(draftTotal - remaining)} more than this credit has left.
          </p>
        )}
      </Modal>

      <ConfirmModal
        open={dialog === 'void'}
        onClose={() => setDialog('')}
        danger={false}
        confirmLabel="Mark as Void"
        busy={busy}
        title="Mark as Void"
        message={
          credit.stockReturned
            ? `${credit.creditNumber} will be voided and the returned goods put back on stock at ${credit.location?.name ?? 'the location'}.`
            : `${credit.creditNumber} will be voided. Its balance stops counting towards the vendor's credits.`
        }
        onConfirm={() => act(() => api.post(`/vendor-credits/${credit.id}/void`))}
      />

      <ConfirmModal
        open={dialog === 'delete'}
        onClose={() => setDialog('')}
        confirmLabel="Delete"
        busy={busy}
        title="Delete vendor credit"
        message={
          credit.stockReturned
            ? `${credit.creditNumber} will be deleted and the returned goods put back on stock.`
            : `${credit.creditNumber} will be deleted.`
        }
        onConfirm={() =>
          act(async () => {
            await api.del(`/vendor-credits/${credit.id}`);
            router.push('/admin/vendor-credits');
          })
        }
      />
    </>
  );
}
