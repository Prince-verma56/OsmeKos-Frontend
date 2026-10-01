'use client';

import { Suspense } from 'react';
import { ChallanForm } from '@/components/ChallanForm';
import { Loading } from '@/components/ui';

export default function NewChallanPage() {
  return (
    <Suspense fallback={<Loading />}>
      <ChallanForm />
    </Suspense>
  );
}
