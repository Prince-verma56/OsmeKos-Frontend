'use client';

import { Suspense, useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { api, errorMessage } from '@/lib/api';
import { ErrorBox, Loading } from '@/components/ui';
import { ReceiptForm, type ExistingReceipt } from '@/components/ReceiptForm';

export default function EditPaymentReceivedPage() {
  const { id } = useParams<{ id: string }>();
  const [payment, setPayment] = useState<ExistingReceipt | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    let cancelled = false;
    api
      .get<{ data: ExistingReceipt }>(`/payments-received/${id}`)
      .then((r) => {
        if (!cancelled) setPayment(r.data);
      })
      .catch((err) => {
        if (!cancelled) setError(errorMessage(err));
      });
    return () => {
      cancelled = true;
    };
  }, [id]);

  if (error) return <ErrorBox message={error} />;
  if (!payment) return <Loading />;

  return (
    <Suspense fallback={<Loading />}>
      <ReceiptForm existing={payment} />
    </Suspense>
  );
}
