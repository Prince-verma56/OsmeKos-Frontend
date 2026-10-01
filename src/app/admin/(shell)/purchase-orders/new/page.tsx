'use client';

import { Suspense } from 'react';
import { PurchaseOrderForm } from '@/components/PurchaseOrderForm';
import { Loading } from '@/components/ui';

export default function NewPurchaseOrderPage() {
  return (
    <Suspense fallback={<Loading />}>
      <PurchaseOrderForm mode="create" />
    </Suspense>
  );
}
