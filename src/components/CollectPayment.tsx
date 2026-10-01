'use client';

import { useState } from 'react';
import Link from 'next/link';
import { api, errorMessage, money, shortDate } from '@/lib/api';
import { useToast } from '@/lib/toast';
import { upiLink, usePaymentOptions, useQrDataUrl, whatsappLink } from '@/lib/payments';
import { Button, Card, ErrorBox, Input } from '@/components/ui';

export type CollectDoc = {
  id: string;
  number: string;
  balanceDue: string | number;
  paymentMethod?: string | null;
  paymentLinkUrl?: string | null;
  paymentLinkId?: string | null;
  paymentLinkAmount?: string | number | null;
  paymentLinkCreatedAt?: string | null;
  customerName?: string | null;
  customerPhone?: string | null;
};

export function CollectPayment({
  kind,
  doc,
  generateBlockedReason = null,
  upiId = null,
  wide = false,
  onChange,
}: {
  kind: 'orders' | 'invoices';
  doc: CollectDoc;
  generateBlockedReason?: string | null;
  upiId?: string | null;
  wide?: boolean;
  onChange: () => void | Promise<void>;
}) {
  const options = usePaymentOptions();
  const toast = useToast();
  const [busy, setBusy] = useState('');
  const [error, setError] = useState('');
  const [pasting, setPasting] = useState(false);
  const [pasteUrl, setPasteUrl] = useState('');

  const label = kind === 'orders' ? 'order' : 'invoice';
  const due = Number(doc.balanceDue ?? 0);
  const link = doc.paymentLinkUrl || null;
  const generated = !!doc.paymentLinkId;
  const linkAmount = doc.paymentLinkAmount != null ? Number(doc.paymentLinkAmount) : null;
  const stale = generated && linkAmount != null && Math.abs(linkAmount - due) > 0.005;
  const defaultLink = !link ? options?.defaultLinkUrl ?? null : null;
  const vpa = upiId || options?.upiId || null;

  const upi =
    vpa && due > 0
      ? upiLink({ vpa, name: options?.payeeName, amount: due, note: `${label} ${doc.number}` })
      : null;
  const qr = useQrDataUrl(upi);

  if (due <= 0) return null;

  const base = `/${kind}/${doc.id}/payment-link`;

  async function run(what: string, fn: () => Promise<{ message?: string }>) {
    setBusy(what);
    setError('');
    try {
      const r = await fn();
      toast.success(r.message ?? 'Done');
      setPasting(false);
      setPasteUrl('');
      await onChange();
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy('');
    }
  }

  function copy(text: string, what: string) {
    navigator.clipboard
      .writeText(text)
      .then(() => toast.success(`${what} copied`))
      .catch(() => toast.error('Could not copy - select it and copy by hand'));
  }

  const shareText = (url: string | null) =>
    [
      `Hi${doc.customerName ? ` ${doc.customerName}` : ''}, ${money(due)} is due for ${label} ${doc.number}.`,
      url ? `Pay online: ${url}` : null,
      vpa ? `Or pay by UPI to ${vpa}.` : null,
    ]
      .filter(Boolean)
      .join('\n');

  const shareButtons = (url: string) => (
    <>
      <Button size="sm" type="button" onClick={() => copy(url, 'Link')}>Copy</Button>
      <a href={whatsappLink(doc.customerPhone, shareText(url))} target="_blank" rel="noreferrer">
        <Button size="sm" type="button">WhatsApp</Button>
      </a>
    </>
  );

  const linkSection = (
    <section className="space-y-2">
      <h3 className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
        Payment link
      </h3>

      {link ? (
        <>
          <a
            href={link}
            target="_blank"
            rel="noreferrer"
            className="block break-all text-sm text-gold-ink hover:underline"
          >
            {link}
          </a>
          <p className="text-xs text-muted-foreground">
            {generated
              ? `Razorpay link for ${money(linkAmount ?? due)}${doc.paymentLinkCreatedAt ? ` · made ${shortDate(doc.paymentLinkCreatedAt)}` : ''}`
              : 'Pasted in - payments on it are recorded by hand'}
          </p>
          {stale && (
            <p className="rounded-md border border-warning/30 bg-warning/10 px-2.5 py-1.5 text-xs text-warning">
              This link asks for {money(linkAmount)} but {money(due)} is due now. Make a new one so the
              customer pays the right amount.
            </p>
          )}
          <div className="flex flex-wrap gap-2">
            {shareButtons(link)}
            {generated && (
              <Button
                size="sm"
                type="button"
                variant="primary"
                disabled={!!busy}
                onClick={() => run('check', () => api.post(`${base}/check`))}
              >
                {busy === 'check' ? 'Checking…' : 'Check payment'}
              </Button>
            )}
            {options?.razorpayEnabled && !generateBlockedReason && (
              <Button
                size="sm"
                type="button"
                disabled={!!busy}
                onClick={() => run('generate', () => api.post(base, {}))}
              >
                {stale ? `New link for ${money(due)}` : 'New link'}
              </Button>
            )}
            <Button
              size="sm"
              type="button"
              variant="ghost"
              disabled={!!busy}
              onClick={() => run('remove', () => api.del(base))}
            >
              Remove
            </Button>
          </div>
        </>
      ) : (
        <>
          {options?.razorpayEnabled ? (
            generateBlockedReason ? (
              <p className="text-xs text-muted-foreground">{generateBlockedReason}</p>
            ) : (
              <Button
                type="button"
                variant="primary"
                disabled={!!busy}
                onClick={() => run('generate', () => api.post(base, {}))}
              >
                {busy === 'generate' ? 'Creating…' : `Create Razorpay link for ${money(due)}`}
              </Button>
            )
          ) : (
            options && (
              <p className="text-xs text-muted-foreground">
                To create Razorpay links here, add <code>RAZORPAY_KEY_ID</code> and{' '}
                <code>RAZORPAY_KEY_SECRET</code> to <code>backend/.env</code> and restart the server.
                Until then, paste a link made in the Razorpay dashboard.
              </p>
            )
          )}
          {defaultLink && (
            <div className="space-y-1.5 rounded-md border border-border px-2.5 py-2">
              <p className="text-xs text-muted-foreground">
                Your default link - the customer types the amount themselves
              </p>
              <a
                href={defaultLink}
                target="_blank"
                rel="noreferrer"
                className="block break-all text-sm text-gold-ink hover:underline"
              >
                {defaultLink}
              </a>
              <div className="flex gap-2">{shareButtons(defaultLink)}</div>
            </div>
          )}
        </>
      )}

      {pasting ? (
        <div className="flex gap-2">
          <Input
            value={pasteUrl}
            onChange={(e) => setPasteUrl(e.target.value)}
            placeholder="https://rzp.io/l/…"
            aria-label="Payment link"
            autoFocus
          />
          <Button
            size="sm"
            type="button"
            variant="primary"
            disabled={!!busy || !pasteUrl.trim()}
            onClick={() => run('paste', () => api.post(base, { url: pasteUrl.trim() }))}
          >
            Save
          </Button>
          <Button size="sm" type="button" variant="ghost" onClick={() => setPasting(false)}>
            Cancel
          </Button>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => setPasting(true)}
          className="text-xs text-gold-ink hover:underline"
        >
          {link ? 'Paste a different link' : 'Paste a link instead'}
        </button>
      )}
    </section>
  );

  const upiSection = (
    <section className="space-y-2">
      <h3 className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
        UPI
      </h3>
      {vpa ? (
        <div className="flex items-start gap-3">
          <div className="flex h-36 w-36 shrink-0 items-center justify-center rounded-md border border-border bg-card p-1.5">
            {qr ? (
              <img src={qr} alt={`UPI QR code to pay ${money(due)}`} className="h-full w-full" />
            ) : (
              <span className="text-[11px] text-muted-foreground">Drawing…</span>
            )}
          </div>
          <div className="min-w-0 space-y-2 text-sm">
            <p className="text-muted-foreground">
              Scan with any UPI app to pay{' '}
              <strong className="text-foreground">{money(due)}</strong> to{' '}
              <span className="font-mono text-xs">{vpa}</span>
            </p>
            <div className="flex flex-wrap gap-2">
              <Button size="sm" type="button" onClick={() => copy(vpa, 'UPI ID')}>
                Copy UPI ID
              </Button>
              <a href={whatsappLink(doc.customerPhone, shareText(link ?? defaultLink))} target="_blank" rel="noreferrer">
                <Button size="sm" type="button">WhatsApp</Button>
              </a>
            </div>
          </div>
        </div>
      ) : (
        options && (
          <p className="text-xs text-muted-foreground">
            <Link href="/admin/organization/edit" className="text-gold-ink hover:underline">
              Add your UPI ID
            </Link>{' '}
            to show a QR for the exact amount here and on the PDF.
          </p>
        )
      )}
    </section>
  );

  const upiFirst = doc.paymentMethod === 'UPI';

  return (
    <Card title="Collect payment">
      <div className="space-y-4">
        <div className="flex items-baseline justify-between">
          <span className="text-sm text-muted-foreground">Due now</span>
          <span className="text-lg font-semibold tabular-nums text-foreground">
            {money(due)}
          </span>
        </div>
        {error && <ErrorBox message={error} />}
        {wide ? (
          <div className="grid gap-6 md:grid-cols-2">
            {upiFirst ? upiSection : linkSection}
            {upiFirst ? linkSection : upiSection}
          </div>
        ) : (
          <>
            {upiFirst ? upiSection : linkSection}
            <div className="border-t border-border" />
            {upiFirst ? linkSection : upiSection}
          </>
        )}
      </div>
    </Card>
  );
}
