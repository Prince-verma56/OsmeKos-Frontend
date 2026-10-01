'use client';

import { Suspense, useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { api, errorMessage } from '@/lib/api';
import { ErrorBox, Loading } from '@/components/ui';
import { PaymentForm, type ExistingPayment } from '@/components/PaymentForm';

export default function EditPaymentPage() {
  const { id } = useParams<{ id: string }>();
  const [payment, setPayment] = useState<ExistingPayment | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    let cancelled = false;
    api
      .get<{ data: ExistingPayment }>(`/bills/payments/${id}`)
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
      <PaymentForm existing={payment} />
    </Suspense>
  );
}
