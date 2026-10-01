'use client';

import { useEffect, useState } from 'react';
import QRCode from 'qrcode';
import { api } from '@/lib/api';

export type PaymentOptions = {
  razorpayEnabled: boolean;
  upiId: string | null;
  payeeName: string | null;
  defaultLinkUrl: string | null;
};

const encode = (v: string) => encodeURIComponent(v).replace(/%40/g, '@');

export function upiLink({
  vpa, name, amount, note,
}: {
  vpa: string; name?: string | null; amount: number; note?: string | null;
}) {
  const params: [string, string][] = [
    ['pa', vpa.trim()],
    ...(name ? ([['pn', name.slice(0, 50)]] as [string, string][]) : []),
    ['am', amount.toFixed(2)],
    ['cu', 'INR'],
    ...(note ? ([['tn', note.slice(0, 50)]] as [string, string][]) : []),
  ];
  return `upi://pay?${params.map(([k, v]) => `${k}=${encode(v)}`).join('&')}`;
}

export function whatsappLink(phone: string | null | undefined, text: string) {
  const digits = (phone ?? '').replace(/\D/g, '');
  const to = digits.length === 10 ? `91${digits}` : digits.length > 10 ? digits : '';
  return `https://wa.me/${to}?text=${encodeURIComponent(text)}`;
}

let optionsRequest: Promise<PaymentOptions | null> | null = null;

export function usePaymentOptions() {
  const [options, setOptions] = useState<PaymentOptions | null>(null);
  useEffect(() => {
    let live = true;
    optionsRequest ??= api
      .get<{ data: PaymentOptions }>('/orders/payment-options')
      .then((r) => r.data)
      .catch(() => {
        optionsRequest = null;
        return null;
      });
    optionsRequest.then((o) => {
      if (live) setOptions(o);
    });
    return () => {
      live = false;
    };
  }, []);
  return options;
}

export function useQrDataUrl(text: string | null, size = 240) {
  const [qr, setQr] = useState<{ text: string; url: string } | null>(null);
  useEffect(() => {
    if (!text) return;
    let live = true;
    QRCode.toDataURL(text, { width: size, margin: 1, errorCorrectionLevel: 'M' })
      .then((url) => {
        if (live) setQr({ text, url });
      })
      .catch(() => {});
    return () => {
      live = false;
    };
  }, [text, size]);
  return text && qr?.text === text ? qr.url : null;
}

export function forgetPaymentOptions() {
  optionsRequest = null;
}

export function paymentReferenceField(mode: string) {
  switch (mode) {
    case 'UPI':
      return { label: 'UPI transaction ID', placeholder: '12-digit UTR / UPI ref no.', mono: true };
    case 'BANK_TRANSFER':
      return { label: 'UTR number', placeholder: '12 or 16-digit UTR', mono: true };
    case 'CHEQUE':
      return { label: 'Cheque number', placeholder: '000123', mono: true };
    case 'CARD':
      return { label: 'Card transaction ID', placeholder: 'RRN / approval code', mono: true };
    case 'CASH':
      return { label: 'Receipt number', placeholder: '', mono: false, hint: 'Optional - a receipt number if you wrote one' };
    default:
      return { label: 'Reference#', placeholder: '', mono: false };
  }
}
