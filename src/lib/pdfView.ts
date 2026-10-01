'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { api } from '@/lib/api';

export const PDF_VIEW_SCOPE = 'document_view';

export const PDF_DOC_TYPES = [
  { key: 'invoice', label: 'Invoices', fallback: true },
  { key: 'order', label: 'Sales orders', fallback: false },
  { key: 'delivery_challan', label: 'Delivery challans', fallback: true },
  { key: 'credit_note', label: 'Credit notes', fallback: true },
  { key: 'return', label: 'Returns', fallback: true },
  { key: 'payment_received', label: 'Payments received', fallback: true },
  { key: 'purchase_order', label: 'Purchase orders', fallback: true },
  { key: 'purchase_receive', label: 'Purchase receipts', fallback: true },
  { key: 'bill', label: 'Bills', fallback: true },
  { key: 'vendor_credit', label: 'Vendor credits', fallback: false },
  { key: 'payment_made', label: 'Payments made', fallback: false },
] as const;

export type PdfDocType = (typeof PDF_DOC_TYPES)[number]['key'];

const fallbackOf = (docType: PdfDocType) =>
  PDF_DOC_TYPES.find((d) => d.key === docType)?.fallback ?? true;

const labelOf = (docType: PdfDocType) =>
  PDF_DOC_TYPES.find((d) => d.key === docType)?.label ?? docType;

let cache: Promise<Record<string, boolean>> | null = null;

export function loadPdfDefaults(refresh = false) {
  if (!cache || refresh) {
    cache = api
      .get<{ data: { key: string; value: unknown }[] }>('/shared/settings', { scope: PDF_VIEW_SCOPE })
      .then((res) =>
        Object.fromEntries(res.data.map((s) => [s.key, s.value === true || s.value === 'true']))
      )
      .catch(() => ({}) as Record<string, boolean>);
  }
  return cache;
}

export async function savePdfDefault(docType: PdfDocType, on: boolean) {
  await api.put('/shared/settings', {
    scope: PDF_VIEW_SCOPE,
    key: docType,
    value: on,
    description: `Open ${labelOf(docType).toLowerCase()} in PDF view by default`,
  });
  cache = null;
}

export function usePdfView(docType: PdfDocType) {
  const [showPdf, setShowPdf] = useState(fallbackOf(docType));
  const touched = useRef(false);

  useEffect(() => {
    let dropped = false;
    loadPdfDefaults().then((saved) => {
      if (dropped || touched.current || saved[docType] === undefined) return;
      setShowPdf(saved[docType]);
    });
    return () => {
      dropped = true;
    };
  }, [docType]);

  const set = useCallback((next: boolean | ((prev: boolean) => boolean)) => {
    touched.current = true;
    setShowPdf(next);
  }, []);

  return [showPdf, set] as const;
}
