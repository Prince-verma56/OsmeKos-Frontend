'use client';

import { useCallback, useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { api, errorMessage } from '@/lib/api';
import { OrderForm, type ExistingOrder } from '@/components/OrderForm';
import { ErrorBox, Loading } from '@/components/ui';

export default function EditOrderPage() {
  const { id } = useParams<{ id: string }>();
  const [order, setOrder] = useState<ExistingOrder | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const res = await api.get<{ data: ExistingOrder }>(`/orders/${id}`);
      setOrder(res.data);
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    const t = setTimeout(load, 0);
    return () => clearTimeout(t);
  }, [load]);

  if (loading) return <Loading />;
  if (!order) return <ErrorBox message={error || 'Order not found'} onRetry={load} />;
  if (order.orderStatus === 'CANCELLED') {
    return <ErrorBox message="A cancelled order cannot be edited." />;
  }

  return <OrderForm key={order.id} existing={order} />;
}
