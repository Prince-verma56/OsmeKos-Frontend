'use client';

import { Suspense } from 'react';
import { ReceiptForm } from '@/components/ReceiptForm';
import { Loading } from '@/components/ui';

export default function NewPaymentReceivedPage() {
  return (
    <Suspense fallback={<Loading />}>
      <ReceiptForm />
    </Suspense>
  );
}
