'use client';

import { Fragment } from 'react';
import { money, shortDate, numberLocale } from '@/lib/api';

export type PdfOrg = {
  legalName?: string | null;
  name?: string | null;
  brandName?: string | null;
  logoUrl?: string | null;
  gstin?: string | null;
  email?: string | null;
  website?: string | null;
  addressLine1?: string | null;
  addressLine2?: string | null;
  city?: string | null;
  state?: string | null;
  pincode?: string | null;
  country?: string | null;
};

export type PdfParty = {
  heading: string;
  name: string;
  lines: string[];
  gstin?: string | null;
  extras?: string[];
};

export type PdfLine = {
  name: string;
  description?: string | null;
  hsnCode?: string | null;
  quantity: string | number;
  unit?: string | null;
  rate?: string | number | null;
  amount?: string | number | null;
  taxRate?: string | number | null;
  cgstAmount?: string | number | null;
  sgstAmount?: string | number | null;
  igstAmount?: string | number | null;
  group?: string | null;
  mrp?: string | number | null;
  discount?: string | null;
};

export type PdfTotal = {
  label: string;
  value: string;
  strong?: boolean;
  negative?: boolean;
  sub?: string | null;
};

export type PdfField = { label: string; value: string };

export type PdfTable = {
  title?: string;
  columns: { label: string; align?: 'left' | 'right' }[];
  rows: { cells: string[]; href?: string | null }[];
};

export function DocumentPdf({
  title,
  ribbon,
  org,
  party,
  deliverTo = null,
  meta = [],
  lines = [],
  totals = [],
  notes,
  terms,
  showSignature = true,
  numberLabel,
  numberValue,
  balanceLabel,
  balanceValue,
  template = 'standard',
  quantityLabel = 'Qty',
  rateLabel = 'Selling Price',
  fields,
  amountBox,
  table,
  amountInWords,
  bankDetails,
  payment,
  accountSummary,
}: {
  title: string;
  ribbon?: { label: string; tone: 'blue' | 'green' | 'amber' | 'red' } | null;
  org: PdfOrg | null;
  party: PdfParty | null;
  deliverTo?: PdfParty | null;
  meta?: { label: string; value: string }[];
  lines?: PdfLine[];
  totals?: PdfTotal[];
  notes?: string | null;
  terms?: string | null;
  showSignature?: boolean;
  numberLabel?: string;
  numberValue?: string;
  balanceLabel?: string;
  balanceValue?: string;
  template?: 'standard' | 'compact' | 'detailed';
  quantityLabel?: string;
  rateLabel?: string;
  fields?: PdfField[];
  amountBox?: { label: string; value: string };
  table?: PdfTable;
  amountInWords?: string | null;
  bankDetails?: { label: string; value: string }[] | null;
  payment?: { amount: string; qr?: string | null; upiId?: string | null; linkUrl?: string | null } | null;
  accountSummary?: {
    title: string;
    rows: { label: string; value: string; strong?: boolean }[];
    note?: string | null;
  } | null;
}) {
  const isReceipt = !!fields;
  const ribbonTone = {
    blue: 'bg-info',
    green: 'bg-success',
    amber: 'bg-warning',
    red: 'bg-destructive',
  };

  const showHsn = template === 'detailed' || lines.some((l) => l.hsnCode);

  const showCgst = lines.some((l) => Number(l.cgstAmount ?? 0) > 0);
  const showIgst = lines.some((l) => Number(l.igstAmount ?? 0) > 0);
  const showRate = lines.some((l) => l.rate != null);
  const showMrp = lines.some((l) => l.mrp != null && Number(l.mrp) > 0);
  const showDiscount = lines.some((l) => l.discount);
  const showAmount = lines.some((l) => l.amount != null);

  const taxCell = (rate: string | number | null | undefined, amount: string | number | null | undefined) => (
    <td className="px-3 py-2 text-right">
      <div className="text-[11px] text-muted-foreground">{Number(rate ?? 0) / 2}%</div>
      <div>{Number(amount ?? 0).toFixed(2)}</div>
    </td>
  );

  const orgAddress = [
    org?.addressLine1,
    org?.addressLine2,
    [org?.city, org?.state, org?.pincode].filter(Boolean).join(' '),
    org?.country ?? 'India',
  ].filter(Boolean) as string[];

  return (
    <div
      className="relative mx-auto max-w-3xl overflow-hidden border border-border bg-card p-10
        font-serif text-[13px] text-foreground print:max-w-none print:border-0 print:p-0"
    >
      {ribbon && (
        <div
          className={`absolute -left-12 top-6 w-40 -rotate-45 py-1 text-center text-xs font-semibold
            text-white dark:text-background ${ribbonTone[ribbon.tone]}`}
        >
          {ribbon.label}
        </div>
      )}

      <div className="mb-8 flex items-start justify-between gap-6">
        <div className="pt-2">
          {org?.logoUrl ? (
            <img src={org.logoUrl} alt="" className="h-24 w-auto object-contain" />
          ) : (
            <div className="text-2xl font-bold tracking-tight text-foreground">
              {org?.brandName ?? org?.name ?? ''}
            </div>
          )}
        </div>
        {!isReceipt && (
          <div className="text-right">
            <h1 className="text-3xl tracking-wide">{title}</h1>
            {numberValue && (
              <p className="mt-2 text-sm font-semibold">
                {numberLabel ?? '#'} {numberValue}
              </p>
            )}
            {balanceValue && (
              <div className="mt-4">
                <p className="text-xs font-semibold">{balanceLabel ?? 'Balance Due'}</p>
                <p className="text-sm font-semibold">{balanceValue}</p>
              </div>
            )}
          </div>
        )}
      </div>

      <div className={`mb-6 text-[12px] leading-5 ${template === 'compact' ? 'hidden' : ''}`}>
        <p className="font-bold">{org?.legalName ?? org?.name}</p>
        {orgAddress.map((l, i) => (
          <p key={i}>{l}</p>
        ))}
        {org?.gstin && <p>GSTIN {org.gstin}</p>}
        {org?.brandName && <p>Brand: {org.brandName}®</p>}
        {org?.email && <p>{org.email}</p>}
        {org?.website && <p>{org.website}</p>}
      </div>

      {isReceipt && (
        <>
          <h1 className="mb-8 text-center text-base tracking-wide underline underline-offset-4">
            {title}
          </h1>

          <div className="mb-10 flex items-start justify-between gap-8">
            <table className="text-[12px]">
              <tbody>
                {fields.map((f) => (
                  <tr key={f.label} className="align-top">
                    <td className="w-44 py-2 pr-6 text-muted-foreground">{f.label}</td>
                    <td className="border-b border-border py-2 pr-6 font-semibold">
                      {f.value}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            {amountBox && (
              <div className="shrink-0 bg-success px-8 py-5 text-center text-white dark:text-background">
                <p className="text-[12px]">{amountBox.label}</p>
                <p className="mt-1 text-lg font-semibold">{amountBox.value}</p>
              </div>
            )}
          </div>

          {party && (
            <div className="mb-8 text-[12px] leading-5">
              <p className="mb-2 text-muted-foreground">{party.heading}</p>
              <p className="font-semibold">{party.name}</p>
              {party.lines.map((l, i) => (
                <p key={i}>{l}</p>
              ))}
              {party.gstin && <p>GSTIN {party.gstin}</p>}
              {party.extras?.map((l, i) => (
                <p key={`x${i}`}>{l}</p>
              ))}
            </div>
          )}

          {table && table.rows.length > 0 && (
            <div className="mb-8">
              {table.title && <p className="mb-3 text-sm font-semibold">{table.title}</p>}
              <table className="w-full text-[12px]">
                <thead>
                  <tr className="bg-muted">
                    {table.columns.map((c) => (
                      <th
                        key={c.label}
                        className={`px-3 py-2 font-normal text-muted-foreground ${
                          c.align === 'right' ? 'text-right' : 'text-left'
                        }`}
                      >
                        {c.label}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {table.rows.map((r, i) => (
                    <tr key={i} className="border-b border-border">
                      {r.cells.map((cell, j) => (
                        <td
                          key={j}
                          className={`px-3 py-2 ${
                            table.columns[j]?.align === 'right' ? 'text-right' : 'text-left'
                          } ${j === 0 ? 'text-info' : ''}`}
                        >
                          {cell}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {notes && (
            <div className="mb-5 text-[12px]">
              <p className="mb-1 text-muted-foreground">Notes</p>
              <p className="whitespace-pre-line text-foreground">{notes}</p>
            </div>
          )}
        </>
      )}

      {!isReceipt && (
        <>
      <div className="mb-6 flex justify-between gap-8 text-[12px] leading-5">
        <div className="space-y-5">
          {([party, deliverTo].filter(Boolean) as PdfParty[]).map((pty, idx) => (
            <div key={idx}>
              <p className="mb-1">{pty.heading}</p>
              <p className="font-semibold text-info">{pty.name}</p>
              {pty.lines.map((l, i) => (
                <p key={i}>{l}</p>
              ))}
              {pty.gstin && <p>GSTIN {pty.gstin}</p>}
              {pty.extras?.map((l, i) => (
                <p key={`x${i}`}>{l}</p>
              ))}
            </div>
          ))}
        </div>

        {meta.length > 0 && (
          <div className="shrink-0 self-end">
            <table>
              <tbody>
                {meta.map((m) => (
                  <tr key={m.label}>
                    <td className="py-0.5 pr-8">{m.label} :</td>
                    <td className="py-0.5 text-right">{m.value}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <table className="mb-6 w-full text-[12px]">
        <thead>
          <tr className="bg-primary text-primary-foreground">
            <th className="px-3 py-2 text-left font-normal">#</th>
            <th className="px-3 py-2 text-left font-normal">Item &amp; Description</th>
            {showHsn && (
              <th className="px-3 py-2 text-right font-normal">HSN/SAC</th>
            )}
            {showMrp && <th className="px-3 py-2 text-right font-normal">MRP</th>}
            <th className="px-3 py-2 text-right font-normal">{quantityLabel}</th>
            {showRate && <th className="px-3 py-2 text-right font-normal">{rateLabel}</th>}
            {showDiscount && <th className="px-3 py-2 text-right font-normal">Disc.</th>}
            {showCgst && (
              <>
                <th className="px-3 py-2 text-right font-normal">CGST</th>
                <th className="px-3 py-2 text-right font-normal">SGST</th>
              </>
            )}
            {showIgst && <th className="px-3 py-2 text-right font-normal">IGST</th>}
            {showAmount && <th className="px-3 py-2 text-right font-normal">Amount</th>}
          </tr>
        </thead>
        <tbody>
          {lines.map((l, i) => (
            <Fragment key={i}>
              {l.group && l.group !== lines[i - 1]?.group && (
                <tr className="border-b border-border bg-muted">
                  <td
                    colSpan={
                      3 + Number(showHsn) + Number(showMrp) + Number(showRate) + Number(showDiscount) + (showCgst ? 2 : 0) + Number(showIgst) + Number(showAmount)
                    }
                    className="px-3 py-1.5 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground"
                  >
                    {l.group}
                  </td>
                </tr>
              )}
              <tr className="border-b border-border align-top">
                <td className="px-3 py-2">{i + 1}</td>
                <td className="px-3 py-2">
                  <div>{l.name}</div>
                  {l.description && (
                    <div className="whitespace-pre-line text-[11px] text-muted-foreground">
                      {l.description}
                    </div>
                  )}
                </td>
                {showHsn && (
                  <td className="px-3 py-2 text-right">{l.hsnCode ?? ''}</td>
                )}
                {showMrp && (
                  <td className="px-3 py-2 text-right">
                    {l.mrp != null && Number(l.mrp) > 0 ? Number(l.mrp).toFixed(2) : ''}
                  </td>
                )}
                <td className="px-3 py-2 text-right">
                  <div>
                    {Number(l.quantity).toLocaleString(numberLocale(), { minimumFractionDigits: 2 })}
                  </div>
                  {l.unit && <div className="text-[11px] text-muted-foreground">{l.unit}</div>}
                </td>
                {showRate && (
                  <td className="px-3 py-2 text-right">
                    {l.rate != null ? Number(l.rate).toFixed(2) : ''}
                  </td>
                )}
                {showDiscount && <td className="px-3 py-2 text-right">{l.discount ?? ''}</td>}
                {showCgst && (
                  <>
                    {taxCell(l.taxRate, l.cgstAmount)}
                    {taxCell(l.taxRate, l.sgstAmount)}
                  </>
                )}
                {showIgst && (
                  <td className="px-3 py-2 text-right">
                    <div className="text-[11px] text-muted-foreground">{Number(l.taxRate ?? 0)}%</div>
                    <div>{Number(l.igstAmount ?? 0).toFixed(2)}</div>
                  </td>
                )}
                {showAmount && (
                  <td className="px-3 py-2 text-right">
                    {l.amount != null ? Number(l.amount).toLocaleString(numberLocale(), { minimumFractionDigits: 2 }) : ''}
                  </td>
                )}
              </tr>
            </Fragment>
          ))}
        </tbody>
      </table>

      {totals.length > 0 && (
        <div className="mb-8 flex justify-end">
          <table className="text-[12px]">
            <tbody>
              {totals.map((t) => (
                <tr key={t.label} className={t.strong ? 'font-semibold' : ''}>
                  <td className="py-1 pr-10 text-right align-top">
                    <div>{t.label}</div>
                    {t.sub && (
                      <div className={`text-[10px] font-normal ${t.negative ? 'text-destructive' : 'text-muted-foreground'}`}>{t.sub}</div>
                    )}
                  </td>
                  <td className={`py-1 text-right align-top ${t.negative ? 'text-destructive' : ''}`}>
                    {t.value}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {accountSummary && (
        <div className="mb-8 flex justify-end break-inside-avoid">
          <div className="min-w-[260px] rounded border border-border px-3 py-2 text-[12px]">
            <p className="mb-1 font-medium">{accountSummary.title}</p>
            <table className="w-full">
              <tbody>
                {accountSummary.rows.map((r) => (
                  <tr
                    key={r.label}
                    className={r.strong ? 'border-t border-border font-semibold' : ''}
                  >
                    <td className="py-0.5 pr-8">{r.label}</td>
                    <td className="py-0.5 text-right">{r.value}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {accountSummary.note && (
              <p className="mt-1.5 max-w-[300px] text-[10px] text-muted-foreground">{accountSummary.note}</p>
            )}
          </div>
        </div>
      )}

      {amountInWords && (
        <div className="mb-6 border-t border-border pt-3 text-[12px]">
          <span className="text-muted-foreground">Total In Words</span>
          <div className="italic">{amountInWords}</div>
        </div>
      )}

      {bankDetails && bankDetails.length > 0 && (
        <div className="mb-6 text-[12px]">
          <p className="mb-1 font-medium">Bank Details</p>
          <table>
            <tbody>
              {bankDetails.map((b) => (
                <tr key={b.label}>
                  <td className="py-0.5 pr-6 text-muted-foreground">{b.label}</td>
                  <td className="py-0.5">{b.value}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {payment && (payment.qr || payment.linkUrl) && (
        <div className="mb-6 flex break-inside-avoid items-start gap-4 rounded border border-border p-3 text-[12px]">
          {payment.qr && (
            <img src={payment.qr} alt="UPI QR code" className="h-28 w-28 shrink-0" />
          )}
          <div className="space-y-1">
            <p className="font-medium">Pay {payment.amount}</p>
            {payment.qr && payment.upiId && (
              <p className="text-muted-foreground">
                Scan with any UPI app, or pay to <span className="font-mono">{payment.upiId}</span>
              </p>
            )}
            {payment.linkUrl && (
              <p className="text-muted-foreground">
                Pay online: <span className="break-all">{payment.linkUrl}</span>
              </p>
            )}
          </div>
        </div>
      )}

      {notes && (
        <div className="mb-5 text-[12px]">
          <p className="mb-1">Notes</p>
          <p className="whitespace-pre-line text-foreground">{notes}</p>
        </div>
      )}

      {terms && (
        <div className="mb-8 text-[12px]">
          <p className="mb-1">Terms &amp; Conditions</p>
          <p className="whitespace-pre-line text-foreground">{terms}</p>
        </div>
      )}

      {showSignature && (
        <div className="mt-12 text-[12px]">
          <span>Authorized Signature</span>
          <span className="ml-3 inline-block w-56 border-b border-muted-foreground/40 align-bottom" />
        </div>
      )}
        </>
      )}
    </div>
  );
}

export const pdfMoney = (v: unknown) => money(v);
export const pdfDate = (v?: string | null) => shortDate(v);
