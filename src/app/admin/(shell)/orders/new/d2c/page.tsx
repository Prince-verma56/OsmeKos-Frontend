'use client';

import { Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { OrderForm } from '@/components/OrderForm';
import { Loading } from '@/components/ui';

function NewD2cOrder() {
  const customerId = useSearchParams().get('customerId') ?? undefined;
  return <OrderForm type="D2C" initialCustomerId={customerId} />;
}

export default function NewD2cOrderPage() {
  return (
    <Suspense fallback={<Loading />}>
      <NewD2cOrder />
    </Suspense>
  );
}
