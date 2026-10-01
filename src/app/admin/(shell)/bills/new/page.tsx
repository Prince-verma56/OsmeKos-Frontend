'use client';

import { Suspense } from 'react';
import { BillForm } from '@/components/BillForm';
import { Loading } from '@/components/ui';

export default function NewBillPage() {
  return (
    <Suspense fallback={<Loading />}>
      <BillForm mode="create" />
    </Suspense>
  );
}
