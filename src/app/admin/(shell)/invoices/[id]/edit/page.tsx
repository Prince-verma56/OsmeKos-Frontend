'use client';

import { Suspense, useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { api, errorMessage } from '@/lib/api';
import { ErrorBox, Loading } from '@/components/ui';
import { InvoiceForm, type ExistingInvoice } from '@/components/InvoiceForm';

export default function EditInvoicePage() {
  const { id } = useParams<{ id: string }>();
  const [invoice, setInvoice] = useState<ExistingInvoice | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    let cancelled = false;
    api
      .get<{ data: ExistingInvoice }>(`/invoices/${id}`)
      .then((r) => {
        if (!cancelled) setInvoice(r.data);
      })
      .catch((err) => {
        if (!cancelled) setError(errorMessage(err));
      });
    return () => {
      cancelled = true;
    };
  }, [id]);

  if (error) return <ErrorBox message={error} />;
  if (!invoice) return <Loading />;

  return (
    <Suspense fallback={<Loading />}>
      <InvoiceForm existing={invoice} />
    </Suspense>
  );
}
