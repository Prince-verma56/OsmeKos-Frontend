'use client';

import { Suspense, useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { api, errorMessage } from '@/lib/api';
import { PurchaseReceiveForm, type ExistingReceive } from '@/components/PurchaseReceiveForm';
import { ErrorBox, Loading } from '@/components/ui';

export default function EditPurchaseReceivePage() {
  const { id } = useParams<{ id: string }>();
  const [receipt, setReceipt] = useState<ExistingReceive | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await api.get<{ data: ExistingReceive }>(`/purchase-receives/${id}`);
        if (!cancelled) setReceipt(res.data);
      } catch (err) {
        if (!cancelled) setError(errorMessage(err));
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [id]);

  if (error) return <ErrorBox message={error} />;
  if (!receipt) return <Loading />;

  return (
    <Suspense fallback={<Loading />}>
      <PurchaseReceiveForm mode="edit" existing={receipt} />
    </Suspense>
  );
}
