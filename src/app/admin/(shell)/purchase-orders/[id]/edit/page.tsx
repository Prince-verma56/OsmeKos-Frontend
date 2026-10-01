'use client';

import { Suspense, useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { api, errorMessage } from '@/lib/api';
import { PurchaseOrderForm, type ExistingPurchaseOrder } from '@/components/PurchaseOrderForm';
import { ErrorBox, Loading } from '@/components/ui';

export default function EditPurchaseOrderPage() {
  const { id } = useParams<{ id: string }>();
  const [po, setPo] = useState<ExistingPurchaseOrder | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await api.get<{ data: ExistingPurchaseOrder & { vendor?: { id: string }; location?: { id: string } } }>(
          `/purchase-orders/${id}`
        );
        if (cancelled) return;
        setPo({
          ...res.data,
          vendorId: res.data.vendorId ?? res.data.vendor?.id ?? '',
          locationId: res.data.locationId ?? res.data.location?.id ?? '',
        });
      } catch (err) {
        if (!cancelled) setError(errorMessage(err));
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [id]);

  if (error) return <ErrorBox message={error} />;
  if (!po) return <Loading />;

  return (
    <Suspense fallback={<Loading />}>
      <PurchaseOrderForm mode="edit" existing={po} />
    </Suspense>
  );
}
