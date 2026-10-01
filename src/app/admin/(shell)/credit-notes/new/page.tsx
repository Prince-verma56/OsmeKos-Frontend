'use client';

import { Suspense } from 'react';
import { CreditNoteForm } from '@/components/CreditNoteForm';
import { Loading } from '@/components/ui';

export default function NewCreditNotePage() {
  return (
    <Suspense fallback={<Loading />}>
      <CreditNoteForm />
    </Suspense>
  );
}
