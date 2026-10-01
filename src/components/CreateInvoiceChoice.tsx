'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { api, money, shortDate } from '@/lib/api';
import { Modal } from '@/components/Modal';
import { Button } from '@/components/ui';

type Waiting = {
  id: string;
  orderNumber: string;
  placedAt: string;
  grandTotal: string;
  fulfillmentStatus: string;
  shippingTotal: number;
  codCharge?: number;
  lines: unknown[];
};

export function CreateInvoiceChoice({
  order,
  customerName,
  className,
}: {
  order: { id: string; orderNumber: string; grandTotal: string; customerId: string | null };
  customerName: string;
  className?: string;
}) {
  const router = useRouter();
  const [checking, setChecking] = useState(false);
  const [waiting, setWaiting] = useState<Waiting[] | null>(null);
  const [picked, setPicked] = useState<string[]>([]);

  const go = (ids: string[]) =>
    router.push(`/admin/invoices/new?orderId=${order.id}${ids.length ? `&include=${ids.join(',')}` : ''}`);

  async function start() {
    if (!order.customerId) return go([]);
    setChecking(true);
    const r = await api
      .get<{ data: Waiting[] }>(`/invoices/unbilled-orders/${order.customerId}`, { excludeOrderId: order.id })
      .catch(() => null);
    setChecking(false);
    if (!r?.data.length) return go([]);
    setWaiting(r.data);
    setPicked(r.data.map((o) => o.id));
  }

  const toggle = (id: string) =>
    setPicked((p) => (p.includes(id) ? p.filter((x) => x !== id) : [...p, id]));

  const list = waiting ?? [];
  const chosen = list.filter((o) => picked.includes(o.id));
  const total = Number(order.grandTotal) + chosen.reduce((n, o) => n + Number(o.grandTotal), 0);

  return (
    <>
      <button type="button" onClick={start} disabled={checking} className={className}>
        {checking ? 'Checking…' : 'Create invoice'}
      </button>

      <Modal
        open={!!waiting}
        onClose={() => setWaiting(null)}
        title="Bill earlier orders on this invoice too?"
        width="max-w-xl"
        footer={
          <>
            <Button type="button" variant="ghost" onClick={() => go([])}>
              Only {order.orderNumber}
            </Button>
            <Button type="button" variant="primary" disabled={!chosen.length} onClick={() => go(picked)}>
              Invoice {chosen.length + 1} orders together
            </Button>
          </>
        }
      >
        <p className="text-sm text-muted-foreground">
          {customerName} has {list.length} earlier order{list.length === 1 ? '' : 's'} that{' '}
          {list.length === 1 ? 'is' : 'are'} not invoiced or paid yet. Tick the ones to bill on one invoice with{' '}
          <span className="font-mono">{order.orderNumber}</span>.
        </p>

        <ul className="mt-3 divide-y divide-border rounded-md border border-border">
          {list.map((o) => (
            <li key={o.id}>
              <label className="flex cursor-pointer items-center gap-3 px-3 py-2.5 text-sm hover:bg-muted/60">
                <input type="checkbox" checked={picked.includes(o.id)} onChange={() => toggle(o.id)} />
                <span className="min-w-0">
                  <Link
                    href={`/admin/orders/${o.id}`}
                    target="_blank"
                    onClick={(e) => e.stopPropagation()}
                    className="font-mono font-medium text-gold-ink hover:underline"
                  >
                    {o.orderNumber}
                  </Link>
                  <span className="block text-xs text-muted-foreground">
                    {shortDate(o.placedAt)} · {o.lines.length} item{o.lines.length === 1 ? '' : 's'}
                    {o.fulfillmentStatus === 'UNFULFILLED' ? ' · not shipped yet' : ''}
                  </span>
                </span>
                <span className="ml-auto tabular-nums">{money(o.grandTotal)}</span>
              </label>
            </li>
          ))}
        </ul>

        <dl className="mt-3 space-y-1 text-sm">
          <div className="flex justify-between text-muted-foreground">
            <dt>{order.orderNumber}</dt>
            <dd className="tabular-nums">{money(order.grandTotal)}</dd>
          </div>
          {chosen.length > 0 && (
            <div className="flex justify-between text-muted-foreground">
              <dt>{chosen.length} earlier order{chosen.length === 1 ? '' : 's'}</dt>
              <dd className="tabular-nums">{money(total - Number(order.grandTotal))}</dd>
            </div>
          )}
          <div className="flex justify-between border-t border-border pt-1 font-semibold">
            <dt>Invoice total</dt>
            <dd className="tabular-nums">{money(total)}</dd>
          </div>
        </dl>

        <p className="mt-3 text-xs text-muted-foreground">
          Their items are added to the invoice, grouped under each order, with GST charged on them. You can still
          add or take off orders on the next screen.
          {chosen.some((o) => Number(o.shippingTotal) > 0 || Number(o.codCharge ?? 0) > 0) &&
            ' Their shipping and COD charges are added to the invoice too.'}
        </p>
      </Modal>
    </>
  );
}
