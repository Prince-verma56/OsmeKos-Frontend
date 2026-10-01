'use client';

import { Suspense } from 'react';
import { OrdersView } from '../orders/page';
import { Loading } from '@/components/ui';
import { PageCrumb } from '@/lib/crumbs';

export default function B2bOrdersPage() {
  return (
    <Suspense fallback={<Loading />}>
      <PageCrumb label="B2B orders" />
      <OrdersView only="b2b" />
    </Suspense>
  );
}
