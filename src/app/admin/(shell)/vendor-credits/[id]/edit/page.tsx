'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { api, errorMessage } from '@/lib/api';
import { ErrorBox, Loading } from '@/components/ui';
import { VendorCreditForm, type ExistingCredit } from '@/components/VendorCreditForm';

export default function EditVendorCreditPage() {
  const { id } = useParams<{ id: string }>();
  const [credit, setCredit] = useState<ExistingCredit | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    let cancelled = false;
    api
      .get<{ data: ExistingCredit }>(`/vendor-credits/${id}`)
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

  return <VendorCreditForm existing={credit} />;
}
