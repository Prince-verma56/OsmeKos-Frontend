'use client';

import { useEffect, useRef } from 'react';
import { api } from '@/lib/api';

export type TermsDocType = 'invoice' | 'delivery_challan' | 'credit_note' | 'purchase_order';

export const TERMS_SCOPE = 'document_terms';

export const TERMS_DOC_LABEL: Record<TermsDocType, string> = {
  invoice: 'invoices',
  delivery_challan: 'delivery challans',
  credit_note: 'credit notes',
  purchase_order: 'purchase orders',
};

export async function loadDefaultTerms(docType: TermsDocType) {
  const res = await api.get<{ data: { key: string; value: unknown }[] }>('/shared/settings', { scope: TERMS_SCOPE });
  const found = res.data.find((s) => s.key === docType)?.value;
  return typeof found === 'string' ? found : '';
}

export function saveDefaultTerms(docType: TermsDocType, terms: string) {
  return api.put('/shared/settings', {
    scope: TERMS_SCOPE,
    key: docType,
    value: terms,
    description: `Default terms and conditions for new ${TERMS_DOC_LABEL[docType]}`,
  });
}

export function useDefaultTerms(docType: TermsDocType, enabled: boolean, onLoad: (terms: string) => void) {
  const onLoadRef = useRef(onLoad);
  useEffect(() => {
    onLoadRef.current = onLoad;
  });
  useEffect(() => {
    if (!enabled) return;
    let cancelled = false;
    loadDefaultTerms(docType)
      .then((terms) => {
        if (!cancelled && terms.trim()) onLoadRef.current(terms);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [docType, enabled]);
}
