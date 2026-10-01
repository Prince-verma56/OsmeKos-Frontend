'use client';

import { Suspense, useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { api, errorMessage } from '@/lib/api';
import { ErrorBox, Loading } from '@/components/ui';
import { ChallanForm, type ExistingChallan } from '@/components/ChallanForm';

export default function EditChallanPage() {
  const { id } = useParams<{ id: string }>();
  const [challan, setChallan] = useState<ExistingChallan | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    let cancelled = false;
    api
      .get<{ data: ExistingChallan }>(`/delivery-challans/${id}`)
      .then((r) => {
        if (!cancelled) setChallan(r.data);
      })
      .catch((err) => {
        if (!cancelled) setError(errorMessage(err));
      });
    return () => {
      cancelled = true;
    };
  }, [id]);

  if (error) return <ErrorBox message={error} />;
  if (!challan) return <Loading />;

  return (
    <Suspense fallback={<Loading />}>
      <ChallanForm existing={challan} />
    </Suspense>
  );
}
