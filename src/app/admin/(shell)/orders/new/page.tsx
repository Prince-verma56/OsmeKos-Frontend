'use client';

import { Suspense, useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { api, errorMessage } from '@/lib/api';
import { OrderForm, type ExistingOrder } from '@/components/OrderForm';
import { ErrorBox, Loading, PageHeader } from '@/components/ui';
import { PageCrumb } from '@/lib/crumbs';
import { whyNotReplaceable } from '@/lib/replacements';

const KINDS = [
  {
    href: '/admin/orders/new/d2c',
    title: 'D2C order',
    hint: 'For an individual customer - a phone, WhatsApp or website order. Ships by Shiprocket, prepaid or COD.',
  },
  {
    href: '/admin/orders/new/b2b',
    title: 'B2B order',
    hint: 'For a salon, retailer or distributor - invoiced on their GSTIN, with payment terms and a transporter.',
  },
];

function PickKind({ customerId }: { customerId: string | null }) {
  const suffix = customerId ? `?customerId=${customerId}` : '';
  return (
    <>
      <PageCrumb label="New order" />
      <PageHeader title="New order" subtitle="Which kind of order is this?" />
      <div className="grid gap-4 sm:grid-cols-2">
        {KINDS.map((k) => (
          <Link
            key={k.href}
            href={`${k.href}${suffix}`}
            className="rounded-lg border border-border bg-card p-5 shadow-xs transition-colors hover:border-gold/60 hover:bg-gold-soft/40"
          >
            <div className="font-display text-lg font-medium text-foreground">{k.title}</div>
            <p className="mt-1.5 text-sm text-muted-foreground">{k.hint}</p>
          </Link>
        ))}
      </div>
    </>
  );
}

function NewOrder() {
  const params = useSearchParams();
  const replacementFor = params.get('replacementFor');
  const [original, setOriginal] = useState<ExistingOrder | null>(null);
  const [loading, setLoading] = useState(!!replacementFor);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    if (!replacementFor) return;
    setLoading(true);
    setError('');
    try {
      const res = await api.get<{ data: ExistingOrder }>(`/orders/${replacementFor}`);
      setOriginal(res.data);
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setLoading(false);
    }
  }, [replacementFor]);

  useEffect(() => {
    const t = setTimeout(load, 0);
    return () => clearTimeout(t);
  }, [load]);

  if (!replacementFor) return <PickKind customerId={params.get('customerId')} />;
  if (loading) return <Loading />;
  if (!original) return <ErrorBox message={error || 'Order not found'} onRetry={load} />;

  const blocked = whyNotReplaceable(original);
  if (blocked) return <ErrorBox message={blocked} />;

  return <OrderForm key={original.id} replacing={original} />;
}

export default function NewOrderPage() {
  return (
    <Suspense fallback={<Loading />}>
      <NewOrder />
    </Suspense>
  );
}
