'use client';

import { Suspense, useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { api, errorMessage } from '@/lib/api';
import { ErrorBox, Loading } from '@/components/ui';
import { CreditNoteForm, type ExistingCreditNote } from '@/components/CreditNoteForm';

export default function EditCreditNotePage() {
  const { id } = useParams<{ id: string }>();
  const [credit, setCredit] = useState<ExistingCreditNote | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    let cancelled = false;
    api
      .get<{ data: ExistingCreditNote }>(`/credit-notes/${id}`)
      .then((r) => {
        if (!cancelled) setCredit(r.data);
      })
      .catch((err) => {
        if (!cancelled) setError(errorMessage(err));
      });
    return () => {
      cancelled = true;
    };
  }, [id]);

  if (error) return <ErrorBox message={error} />;
  if (!credit) return <Loading />;

  return (
    <Suspense fallback={<Loading />}>
      <CreditNoteForm existing={credit} />
    </Suspense>
  );
}
