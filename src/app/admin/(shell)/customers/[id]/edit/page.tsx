'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { api, errorMessage } from '@/lib/api';
import { ErrorBox, Loading } from '@/components/ui';
import { CustomerForm, type ExistingCustomer } from '@/components/CustomerForm';

export default function EditCustomerPage() {
  const { id } = useParams<{ id: string }>();
  const [customer, setCustomer] = useState<ExistingCustomer | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    let cancelled = false;
    api
      .get<{ data: ExistingCustomer }>(`/customers/${id}`)
      .then((r) => {
        if (!cancelled) setCustomer(r.data);
      })
      .catch((err) => {
        if (!cancelled) setError(errorMessage(err));
      });
    return () => {
      cancelled = true;
    };
  }, [id]);

  if (error) return <ErrorBox message={error} />;
  if (!customer) return <Loading />;

  return <CustomerForm existing={customer} />;
}
