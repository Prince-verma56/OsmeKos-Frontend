'use client';

import { Suspense } from 'react';
import { PurchaseReceiveForm } from '@/components/PurchaseReceiveForm';
import { Loading } from '@/components/ui';

export default function NewPurchaseReceivePage() {
  return (
    <Suspense fallback={<Loading />}>
      <PurchaseReceiveForm mode="create" />
    </Suspense>
  );
}
