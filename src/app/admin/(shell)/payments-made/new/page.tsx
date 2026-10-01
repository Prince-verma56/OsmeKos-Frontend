'use client';

import { Suspense } from 'react';
import { Loading } from '@/components/ui';
import { PaymentForm } from '@/components/PaymentForm';

export default function NewPaymentPage() {
  return (
    <Suspense fallback={<Loading />}>
      <PaymentForm />
    </Suspense>
  );
}
