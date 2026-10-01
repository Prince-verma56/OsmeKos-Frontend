'use client';

import { Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { OrderForm } from '@/components/OrderForm';
import { Loading } from '@/components/ui';

function NewB2bOrder() {
  const customerId = useSearchParams().get('customerId') ?? undefined;
  return <OrderForm type="B2B" initialCustomerId={customerId} />;
}

export default function NewB2bOrderPage() {
  return (
    <Suspense fallback={<Loading />}>
      <NewB2bOrder />
    </Suspense>
  );
}
