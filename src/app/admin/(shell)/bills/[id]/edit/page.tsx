'use client';

import { Suspense, useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { api, errorMessage } from '@/lib/api';
import { BillForm, type ExistingBill } from '@/components/BillForm';
import { ErrorBox, Loading } from '@/components/ui';

export default function EditBillPage() {
  const { id } = useParams<{ id: string }>();
  const [bill, setBill] = useState<ExistingBill | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await api.get<{ data: ExistingBill }>(`/bills/${id}`);
        if (cancelled) return;
        setBill({ ...res.data, vendorId: res.data.vendorId ?? res.data.vendor?.id ?? '' });
      } catch (err) {
        if (!cancelled) setError(errorMessage(err));
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [id]);

  if (error) return <ErrorBox message={error} />;
  if (!bill) return <Loading />;

  return (
    <Suspense fallback={<Loading />}>
      <BillForm mode="edit" existing={bill} />
    </Suspense>
  );
}
