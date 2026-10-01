'use client';

import { Suspense } from 'react';
import { InvoiceForm } from '@/components/InvoiceForm';
import { Loading } from '@/components/ui';

export default function NewInvoicePage() {
  return (
    <Suspense fallback={<Loading />}>
      <InvoiceForm />
    </Suspense>
  );
}
