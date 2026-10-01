'use client';

import { usePdfView } from '@/lib/pdfView';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { api, money, shortDate, errorMessage, numberLocale, todayIso } from '@/lib/api';
import { amountInWords } from '@/lib/amountInWords';
import { stateName } from '@/lib/states';
import { DocumentPdf, type PdfOrg } from '@/components/DocumentPdf';
import { PdfCustomize, type PdfTemplate } from '@/components/PdfCustomize';
import { AccountSelect } from '@/components/AccountSelect';
import { ConfirmModal, Modal } from '@/components/Modal';
import {
  Badge, Button, Card, EmptyRow, ErrorBox, Field, Input, Loading,
  PageHeader, Select, Spinner, Table, Td, Textarea, Th,
} from '@/components/ui';
import { useToast } from '@/lib/toast';
import { Thumb } from '@/components/SearchSelect';
import { PageCrumb } from '@/lib/crumbs';

const REASON_LABEL: Record<string, string> = {
  SALES_RETURN: 'Sales Return',
  POST_SALE_DISCOUNT: 'Post Sale Discount',
  DEFICIENCY_IN_SERVICE: 'Deficiency in service',
  CORRECTION_IN_INVOICE: 'Correction in invoice',
  CHANGE_IN_POS: 'Change in POS',
  FINALIZATION_OF_PROVISIONAL_ASSESSMENT: 'Finalization of Provisional assessment',
  OTHERS: 'Others',
};

const MODE_LABEL: Record<string, string> = {
  BANK_TRANSFER: 'Bank Transfer',
  CHEQUE: 'Cheque',
  UPI: 'UPI',
  CASH: 'Cash',
  CARD: 'Card',
  OTHER: 'Other',
};

type Address = {
  attention?: string | null; line1?: string | null; line2?: string | null;
  city?: string | null; state?: string | null; pincode?: string | null;
  country?: string | null; phone?: string | null;
};

type CreditLine = {
  id: string; itemName: string; description: string | null; sku: string | null;
  hsnCode: string | null; unit: string; quantity: string; rate: string;
  discountAmount: string; taxRate: string; taxAmount: string;
  cgstAmount: string; sgstAmount: string; igstAmount: string; lineTotal: string;
  imageUrl?: string | null;
};

type Application = {
  id: string; amount: string; createdAt: string;
  invoice: {
    id: string; invoiceNumber: string; invoiceDate: string;
    grandTotal: string; balanceDue: string; status: string;
  };
};

type Refund = {
  id: string; refundDate: string; amount: string; paymentMode: string;
  refundFrom: string | null; referenceNumber: string | null; notes: string | null;
};

type CreditNote = {
  id: string;
  creditNumber: string;
  creditDate: string;
  reason: string | null;
  referenceNumber: string | null;
  subject: string | null;
  status: string;
  sourceOfSupplyCode: string | null;
  placeOfSupplyCode: string | null;
  gstin: string | null;
  billingAddress: Address | null;
  shippingAddress: Address | null;
  taxTreatment: 'EXCLUSIVE' | 'INCLUSIVE';
  discountPercent: string | null;
  subtotal: string;
  discountTotal: string;
  cgstTotal: string;
  sgstTotal: string;
  igstTotal: string;
  taxWithholdingType: 'TDS' | 'TCS' | null;
  taxWithholdingName: string | null;
  taxWithholdingAmount: string;
  shippingCharge: string;
  codCharge?: string;
  adjustment: string;
  adjustmentLabel: string | null;
  roundOff?: string;
  roundOffManual?: boolean;
  grandTotal: string;
  amountApplied: string;
  amountRefunded: string;
  balance: string;
  stockReturned: boolean;
  customerNotes: string | null;
  terms: string | null;
  customer: { id: string; displayName: string | null } | null;
  invoice: { id: string; invoiceNumber: string; invoiceDate: string } | null;
  location: { id: string; name: string } | null;
  warehouseLocation: { id: string; name: string } | null;
  lines: CreditLine[];
  applications: Application[];
  refunds: Refund[];
  salesReturn?: { id: string; returnNumber: string; status: string } | null;
};

type OpenInvoice = {
  id: string; invoiceNumber: string; invoiceDate: string; dueDate: string | null;
  grandTotal: string; balanceDue: string; status: string;
};

const addressLines = (a: Address | null | undefined): string[] =>
  a
    ? ([
        a.attention,
        a.line1,
        a.line2,
        a.city,
        [a.state, a.pincode].filter(Boolean).join(' '),
        a.country ?? 'India',
        a.phone ? `Phone: ${a.phone}` : null,
      ].filter(Boolean) as string[])
    : [];

export default function CreditNoteDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();

  const [credit, setCredit] = useState<CreditNote | null>(null);
  const [org, setOrg] = useState<PdfOrg | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState('');
  const toast = useToast();
  const [reloadKey, setReloadKey] = useState(0);

  const [showPdf, setShowPdf] = usePdfView('credit_note');
  const [template, setTemplate] = useState<PdfTemplate>('standard');
  const [menuOpen, setMenuOpen] = useState(false);
  const [dialog, setDialog] = useState<'' | 'apply' | 'refund' | 'void' | 'delete'>('');

  const [openInvoices, setOpenInvoices] = useState<OpenInvoice[]>([]);
  const [applyRows, setApplyRows] = useState<Record<string, string>>({});

  const [refundForm, setRefundForm] = useState({
    refundDate: todayIso(),
    amount: '',
    paymentMode: 'BANK_TRANSFER',
    refundFrom: '',
    referenceNumber: '',
    notes: '',
  });

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        const [res, orgRes] = await Promise.all([
          api.get<{ data: CreditNote }>(`/credit-notes/${id}`),
          api.get<{ data: PdfOrg }>('/organization').catch(() => null),
        ]);
        if (cancelled) return;
        setCredit(res.data);
        setOrg(orgRes?.data ?? null);
        setRefundForm((f) => ({ ...f, amount: String(Number(res.data.balance)) }));
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

  useEffect(() => {
    if (dialog !== 'apply') return;
    let cancelled = false;
    api
      .get<{ data: OpenInvoice[] }>(`/credit-notes/${id}/open-invoices`)
      .then((r) => {
        if (!cancelled) setOpenInvoices(r.data);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [dialog, id]);

  async function act(label: string, fn: () => Promise<unknown>, redirect?: string) {
    setBusy(label);
    setError('');
    setMenuOpen(false);
    try {
      await fn();
      if (redirect) {
        router.push(redirect);
        return;
      }
      toast.success(label);
      setDialog('');
      setApplyRows({});
      setReloadKey((k) => k + 1);
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy('');
    }
  }

  if (loading) return <Loading />;
  if (!credit) {
    return (
      <ErrorBox message={error || 'Credit note not found'} onRetry={() => setReloadKey((k) => k + 1)} />
    );
  }

  const isVoid = credit.status === 'VOID';
  const isDraft = credit.status === 'DRAFT';
  const used = credit.applications.length > 0 || credit.refunds.length > 0;
  const available = Number(credit.balance);

  const intraState =
    !!credit.sourceOfSupplyCode &&
    !!credit.placeOfSupplyCode &&
    credit.sourceOfSupplyCode === credit.placeOfSupplyCode;

  const rates = [...new Set(credit.lines.map((l) => Number(l.taxRate)))];
  const uniformRate = rates.length === 1 ? rates[0] : null;
  const grossSubtotal = Number(credit.subtotal) + Number(credit.discountTotal);

  const totals = [
    {
      label: 'Sub Total',
      value: money(grossSubtotal),
      sub: credit.taxTreatment === 'INCLUSIVE' ? 'Rates include GST' : null,
    },
    ...(Number(credit.discountTotal) > 0
      ? [{
          label: `Discount${credit.discountPercent && Number(credit.discountPercent) > 0 ? `(${Number(credit.discountPercent)}%)` : ''}`,
          value: `(-) ${money(credit.discountTotal)}`,
          sub: `(Applied on ${money(grossSubtotal)})`,
          negative: true,
        }]
      : []),
    ...(intraState
      ? [
          { label: `CGST${uniformRate != null ? ` (${uniformRate / 2}%)` : ''}`, value: money(credit.cgstTotal) },
          { label: `SGST${uniformRate != null ? ` (${uniformRate / 2}%)` : ''}`, value: money(credit.sgstTotal) },
        ]
      : [{ label: `IGST${uniformRate != null ? ` (${uniformRate}%)` : ''}`, value: money(credit.igstTotal) }]),
    ...(Number(credit.shippingCharge) > 0
      ? [{ label: 'Shipping Charges', value: money(credit.shippingCharge) }]
      : []),
    ...(Number(credit.codCharge ?? 0) > 0
      ? [{ label: 'COD Charge', value: money(credit.codCharge ?? 0) }]
      : []),
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
    ...(Number(credit.amountRefunded) > 0
      ? [{ label: 'Refund', value: `(-) ${money(credit.amountRefunded)}`, negative: true }]
      : []),
    ...(Number(credit.amountApplied) > 0
      ? [{ label: 'Credits Used', value: `(-) ${money(credit.amountApplied)}`, negative: true }]
      : []),
    { label: 'Credits Remaining', value: money(credit.balance), strong: true },
  ];

  const applyTotal = Math.round(Object.values(applyRows).reduce((n, v) => n + Number(v || 0), 0) * 100) / 100;

  const menuItem =
    'block w-full px-3 py-1.5 text-left text-sm text-foreground hover:bg-primary hover:text-primary-foreground';

  return (
    <>
      <div className="print:hidden">
        <PageCrumb label={credit.customer?.displayName ?? '—'} />

        <PageHeader
          title={credit.creditNumber}
          subtitle={credit.subject ?? undefined}
        />

        <div className="mb-4 flex flex-wrap items-center gap-1 border-y border-border py-2">
          {!isVoid && !used && (
            <Link href={`/admin/credit-notes/${credit.id}/edit`}>
              <Button size="sm" variant="ghost">✎ Edit</Button>
            </Link>
          )}
          <Button size="sm" variant="ghost" onClick={() => window.print()}>
            🖨 PDF/Print
          </Button>
          {isDraft && (
            <Button
              size="sm"
              variant="primary"
              disabled={!!busy}
              onClick={() => act('Opened', () => api.post(`/credit-notes/${credit.id}/open`))}
            >
              Convert to Open
            </Button>
          )}
          {!isVoid && !isDraft && available > 0 && (
            <>
              <Button size="sm" variant="primary" onClick={() => setDialog('apply')}>
                Apply to Invoices
              </Button>
              <Button size="sm" variant="success" onClick={() => setDialog('refund')}>
                Refund
              </Button>
            </>
          )}

          <div className="relative">
            <Button size="sm" variant="ghost" onClick={() => setMenuOpen((v) => !v)}>⋯</Button>
            {menuOpen && (
              <>
                <div className="fixed inset-0 z-10" onClick={() => setMenuOpen(false)} />
                <div className="absolute left-0 z-20 mt-1 w-48 overflow-hidden rounded-md border border-border bg-card py-1 shadow-lg">
                  {!isVoid && (
                    <button className={menuItem} onClick={() => { setMenuOpen(false); setDialog('void'); }}>
                      Mark as Void
                    </button>
                  )}
                  <button className={menuItem} onClick={() => { setMenuOpen(false); setDialog('delete'); }}>
                    Delete
                  </button>
                </div>
              </>
            )}
          </div>
        </div>

        {error && <div className="mb-4"><ErrorBox message={error} /></div>}

        {credit.applications.length > 0 && (
          <Card padded={false} className="mb-4">
            <div className="border-b border-border px-4 py-2.5 text-sm font-medium">
              Credit Applied Invoices{' '}
              <span className="text-muted-foreground">
                {credit.applications.length}
              </span>
            </div>
            <Table>
              <thead>
                <tr>
                  <Th>DATE</Th>
                  <Th>INVOICE NUMBER</Th>
                  <Th className="text-right">AMOUNT CREDITED</Th>
                  <Th className="w-16" />
                </tr>
              </thead>
              <tbody>
                {credit.applications.map((a) => (
                  <tr key={a.id} className="hover:bg-muted/60">
                    <Td className="text-xs text-muted-foreground">
                      {shortDate(a.createdAt)}
                    </Td>
                    <Td>
                      <Link
                        href={`/admin/invoices/${a.invoice.id}`}
                        className="font-medium text-gold-ink hover:underline"
                      >
                        {a.invoice.invoiceNumber}
                      </Link>
                    </Td>
                    <Td className="text-right font-medium">{money(a.amount)}</Td>
                    <Td className="text-right">
                      {!isVoid && (
                        <button
                          onClick={() =>
                            act('Unapplied', () =>
                              api.del(`/credit-notes/${credit.id}/applications/${a.id}`)
                            )
                          }
                          className="text-xs text-muted-foreground hover:text-destructive"
                        >
                          Unapply
                        </button>
                      )}
                    </Td>
                  </tr>
                ))}
              </tbody>
            </Table>
          </Card>
        )}

        {credit.refunds.length > 0 && (
          <Card padded={false} className="mb-4">
            <div className="border-b border-border px-4 py-2.5 text-sm font-medium">
              Refund History{' '}
              <span className="text-muted-foreground">{credit.refunds.length}</span>
            </div>
            <Table>
              <thead>
                <tr>
                  <Th>DATE</Th>
                  <Th>PAYMENT MODE</Th>
                  <Th>REFUNDED FROM</Th>
                  <Th>REFERENCE#</Th>
                  <Th className="text-right">AMOUNT REFUNDED</Th>
                  <Th className="w-16" />
                </tr>
              </thead>
              <tbody>
                {credit.refunds.map((r) => (
                  <tr key={r.id} className="hover:bg-muted/60">
                    <Td className="text-xs text-muted-foreground">
                      {shortDate(r.refundDate)}
                    </Td>
                    <Td className="text-xs">{MODE_LABEL[r.paymentMode] ?? r.paymentMode}</Td>
                    <Td className="text-xs">{r.refundFrom ?? '—'}</Td>
                    <Td className="text-xs">{r.referenceNumber ?? '—'}</Td>
                    <Td className="text-right font-medium">{money(r.amount)}</Td>
                    <Td className="text-right">
                      {credit.salesReturn && r.referenceNumber === `Return ${credit.salesReturn.returnNumber}` ? (
                        <span className="text-xs text-muted-foreground">Paid on the return</span>
                      ) : (
                        !isVoid && (
                          <button
                            onClick={() =>
                              act('Refund removed', () =>
                                api.del(`/credit-notes/${credit.id}/refunds/${r.id}`)
                              )
                            }
                            className="text-xs text-muted-foreground hover:text-destructive"
                          >
                            Remove
                          </button>
                        )
                      )}
                    </Td>
                  </tr>
                ))}
              </tbody>
            </Table>
          </Card>
        )}

        <div className="mb-4 flex flex-wrap items-center gap-4 text-sm">
          <Badge status={credit.status}>{credit.status}</Badge>
          {credit.reason && (
            <span className="text-muted-foreground">
              Reason: {REASON_LABEL[credit.reason] ?? credit.reason}
            </span>
          )}
          {credit.invoice && (
            <span className="text-muted-foreground">
              Against:{' '}
              <Link
                href={`/admin/invoices/${credit.invoice.id}`}
                className="font-medium text-gold-ink hover:underline"
              >
                {credit.invoice.invoiceNumber}
              </Link>
            </span>
          )}
          {credit.stockReturned && (
            <Badge tone="green">
              Stock returned{credit.warehouseLocation ? ` to ${credit.warehouseLocation.name}` : ''}
            </Badge>
          )}
          {credit.sourceOfSupplyCode && credit.placeOfSupplyCode && (
            <Badge tone={intraState ? 'green' : 'blue'}>
              {stateName(credit.sourceOfSupplyCode)} → {stateName(credit.placeOfSupplyCode)}
            </Badge>
          )}

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
      </div>

      {showPdf && (
        <div className="mx-auto mb-2 flex max-w-3xl justify-end print:hidden">
          <PdfCustomize
            template={template}
            onTemplateChange={setTemplate}
            org={org}
            onOrgSaved={setOrg}
            termsDocType="credit_note"
          />
        </div>
      )}

      {showPdf ? (
        <DocumentPdf
          template={template}
          title="CREDIT NOTE"
          org={org}
          ribbon={
            isVoid
              ? { label: 'Void', tone: 'red' }
              : isDraft
                ? { label: 'Draft', tone: 'amber' }
                : available <= 0
                  ? { label: 'Closed', tone: 'green' }
                  : { label: 'Open', tone: 'blue' }
          }
          numberLabel="Credit Note#"
          numberValue={credit.creditNumber}
          balanceLabel="Credits Remaining"
          balanceValue={money(credit.balance)}
          party={{
            heading: 'Bill To',
            name: credit.customer?.displayName ?? '—',
            lines: addressLines(credit.billingAddress),
            gstin: credit.gstin,
          }}
          meta={[
            { label: '#', value: credit.creditNumber },
            { label: 'Credit Date', value: shortDate(credit.creditDate) },
            ...(credit.invoice
              ? [
                  { label: 'Invoice#', value: credit.invoice.invoiceNumber },
                  { label: 'Invoice Date', value: shortDate(credit.invoice.invoiceDate) },
                ]
              : []),
            ...(credit.referenceNumber
              ? [{ label: 'Reference#', value: credit.referenceNumber }]
              : []),
            ...(credit.placeOfSupplyCode
              ? [{
                  label: 'Place Of Supply',
                  value: `${stateName(credit.placeOfSupplyCode)} (${credit.placeOfSupplyCode})`,
                }]
              : []),
          ]}
          lines={credit.lines.map((l) => ({
            name: l.itemName,
            description: l.description ?? l.sku,
            hsnCode: l.hsnCode,
            quantity: l.quantity,
            unit: l.unit,
            rate: l.rate,
            amount: l.lineTotal,
          }))}
          totals={totals}
          amountInWords={amountInWords(credit.grandTotal)}
          notes={credit.customerNotes}
          terms={credit.terms}
        />
      ) : (
        <div className="grid gap-5 lg:grid-cols-3">
          <div className="lg:col-span-2 min-w-0">
            <Card title="Items" padded={false}>
              <Table minWidth="780px">
                <thead>
                  <tr>
                    <Th>ITEM</Th>
                    <Th className="text-right">QTY</Th>
                    <Th className="text-right">SELLING PRICE</Th>
                    <Th className="text-right">TAX</Th>
                    <Th className="text-right">AMOUNT</Th>
                  </tr>
                </thead>
                <tbody>
                  {credit.lines.map((l) => (
                    <tr key={l.id} className="hover:bg-muted/60">
                      <Td>
                        <div className="flex items-start gap-2.5">
                          <Thumb url={l.imageUrl} label={l.itemName} />
                          <div className="min-w-0">
                            <div className="font-medium">{l.itemName}</div>
                        {(l.description || l.sku) && (
                          <div className="text-xs text-muted-foreground">
                            {l.description ?? l.sku}
                          </div>
                        )}
                          </div>
                        </div>
                      </Td>
                      <Td className="whitespace-nowrap text-right">
                        {Number(l.quantity).toLocaleString(numberLocale())} {l.unit}
                      </Td>
                      <Td className="whitespace-nowrap text-right">{money(l.rate)}</Td>
                      <Td className="whitespace-nowrap text-right">
                        <div>{money(l.taxAmount)}</div>
                        <div className="text-xs text-muted-foreground">
                          {Number(l.taxRate)}%
                        </div>
                      </Td>
                      <Td className="whitespace-nowrap text-right font-medium">
                        {money(l.lineTotal)}
                      </Td>
                    </tr>
                  ))}
                </tbody>
              </Table>
            </Card>
          </div>

          <Card title="Totals">
            <dl className="space-y-1.5 text-sm">
              {totals.map((t) => (
                <div key={t.label} className={`flex justify-between ${t.strong ? 'font-semibold' : ''}`}>
                  <dt className="text-muted-foreground">{t.label}</dt>
                  <dd className={t.negative ? 'text-destructive' : ''}>{t.value}</dd>
                </div>
              ))}
            </dl>
          </Card>
        </div>
      )}

      <Modal
        open={dialog === 'apply'}
        onClose={() => setDialog('')}
        title={`Apply ${credit.creditNumber} to invoices`}
        width="max-w-3xl"
      >
        <p className="mb-3 text-sm text-muted-foreground">
          {money(available)} of this credit note is still available.
        </p>
        <Table minWidth="620px">
          <thead>
            <tr>
              <Th>INVOICE#</Th>
              <Th>DATE</Th>
              <Th className="text-right">AMOUNT DUE</Th>
              <Th className="text-right">APPLY</Th>
            </tr>
          </thead>
          <tbody>
            {openInvoices.length === 0 && (
              <EmptyRow colSpan={4} message="Nothing outstanding for this customer" />
            )}
            {openInvoices.map((i) => (
              <tr key={i.id}>
                <Td className="font-medium">{i.invoiceNumber}</Td>
                <Td className="text-xs text-muted-foreground">
                  {shortDate(i.invoiceDate)}
                </Td>
                <Td className="text-right">{money(i.balanceDue)}</Td>
                <Td>
                  <div className="flex flex-col items-end gap-0.5">
                    <Input
                      type="number" step="0.01" min="0"
                      value={applyRows[i.id] ?? ''}
                      onChange={(e) => setApplyRows((r) => ({ ...r, [i.id]: e.target.value }))}
                      className="w-28 text-right"
                    />
                    <button
                      type="button"
                      onClick={() =>
                        setApplyRows((r) => ({
                          ...r,
                          [i.id]: String(Math.min(Number(i.balanceDue), available)),
                        }))
                      }
                      className="text-[11px] text-gold-ink hover:underline"
                    >
                      Credit in Full
                    </button>
                  </div>
                </Td>
              </tr>
            ))}
          </tbody>
        </Table>
        <div className="mt-4 flex items-center gap-3">
          <Button
            variant="primary"
            disabled={!applyTotal || applyTotal > available || !!busy}
            onClick={() =>
              act('Applied', () =>
                api.post(`/credit-notes/${credit.id}/apply`, {
                  allocations: Object.entries(applyRows)
                    .filter(([, v]) => Number(v) > 0)
                    .map(([invoiceId, v]) => ({ invoiceId, amount: Number(v) })),
                })
              )
            }
          >
            {busy === 'Applied' && <Spinner className="border-card/40 border-t-card" />}
            Apply {applyTotal > 0 ? money(applyTotal) : ''}
          </Button>
          <Button variant="ghost" onClick={() => setDialog('')}>Cancel</Button>
          {applyTotal > available && (
            <span className="text-xs text-destructive">
              That is more than the {money(available)} still available.
            </span>
          )}
        </div>
      </Modal>

      <Modal
        open={dialog === 'refund'}
        onClose={() => setDialog('')}
        title={`Refund against ${credit.creditNumber}`}
      >
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Refund date" required>
            <Input
              type="date"
              value={refundForm.refundDate}
              onChange={(e) => setRefundForm((f) => ({ ...f, refundDate: e.target.value }))}
            />
          </Field>
          <Field label="Amount" required hint={`${money(available)} available`}>
            <Input
              type="number" step="0.01" min="0"
              value={refundForm.amount}
              onChange={(e) => setRefundForm((f) => ({ ...f, amount: e.target.value }))}
            />
          </Field>
          <Field label="Payment mode">
            <Select
              value={refundForm.paymentMode}
              onChange={(e) => setRefundForm((f) => ({ ...f, paymentMode: e.target.value }))}
              className="w-full"
            >
              {Object.entries(MODE_LABEL).map(([k, label]) => (
                <option key={k} value={k}>{label}</option>
              ))}
            </Select>
          </Field>
          <div>
            <span className="mb-1 block text-xs font-medium text-muted-foreground">
              Refund from <span className="text-destructive">*</span>
            </span>
            <AccountSelect
              value={refundForm.refundFrom}
              onChange={(name) => setRefundForm((f) => ({ ...f, refundFrom: name }))}
              usage="payment"
              placeholder="Select an account"
            />
            <p className="mt-1.5 text-xs text-muted-foreground">
              Where the money leaves from. The mode is free — a customer who paid by cheque can
              be refunded in cash.
            </p>
          </div>
          <Field label="Reference#">
            <Input
              value={refundForm.referenceNumber}
              onChange={(e) => setRefundForm((f) => ({ ...f, referenceNumber: e.target.value }))}
            />
          </Field>
          <div className="sm:col-span-2">
            <Field label="Notes">
              <Textarea
                rows={2}
                value={refundForm.notes}
                onChange={(e) => setRefundForm((f) => ({ ...f, notes: e.target.value }))}
              />
            </Field>
          </div>
        </div>
        <div className="mt-4 flex items-center gap-3">
          <Button
            variant="success"
            disabled={!Number(refundForm.amount) || Number(refundForm.amount) > available || !!busy}
            onClick={() =>
              act('Refund recorded', () =>
                api.post(`/credit-notes/${credit.id}/refunds`, {
                  refundDate: refundForm.refundDate,
                  amount: Number(refundForm.amount),
                  paymentMode: refundForm.paymentMode,
                  refundFrom: refundForm.refundFrom.trim() || undefined,
                  referenceNumber: refundForm.referenceNumber.trim() || undefined,
                  notes: refundForm.notes.trim() || undefined,
                })
              )
            }
          >
            {busy === 'Refund recorded' && <Spinner className="border-card/40 border-t-card" />}
            Record refund
          </Button>
          <Button variant="ghost" onClick={() => setDialog('')}>Cancel</Button>
        </div>
      </Modal>

      <ConfirmModal
        open={dialog === 'void'}
        title="Mark this credit note as void?"
        message={
          credit.stockReturned
            ? `${credit.creditNumber} returned stock — voiding it takes those units back off the shelf.`
            : `${credit.creditNumber} will stop counting as available credit. The number stays used, which is what the GST return expects.`
        }
        confirmLabel="Mark as void"
        busy={busy === 'Voided'}
        onClose={() => setDialog('')}
        onConfirm={() => act('Voided', () => api.post(`/credit-notes/${credit.id}/void`))}
      />

      <ConfirmModal
        open={dialog === 'delete'}
        title="Delete this credit note?"
        message={`${credit.creditNumber} will be removed${credit.stockReturned ? ', and the stock it returned will come back off the shelf' : ''}. Void it instead if it was ever sent to the customer.`}
        confirmLabel="Delete"
        busy={busy === 'Deleted'}
        onClose={() => setDialog('')}
        onConfirm={() => act('Deleted', () => api.del(`/credit-notes/${credit.id}`), '/credit-notes')}
      />
    </>
  );
}
