'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { api, money, shortDate, errorMessage } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { useToast } from '@/lib/toast';
import {
  Badge, Button, Card, EmptyRow, ErrorBox, Loading, PageHeader,
  Select, StatCard, Table, Td, Th,
} from '@/components/ui';
import { CampaignDialog } from '@/components/marketing/CampaignDialog';
import type { Campaign, Overview } from '@/components/marketing/types';

const RANGES = [
  { key: '30', label: 'Last 30 days' },
  { key: '90', label: 'Last 90 days' },
  { key: '365', label: 'Last year' },
  { key: 'all', label: 'All time' },
];

const since = (key: string) => {
  if (key === 'all') return undefined;
  const days = Number(key);
  const d = new Date();
  d.setDate(d.getDate() - days);
  return d.toISOString().slice(0, 10);
};

const CHANNEL_LABEL: Record<string, string> = {
  META: 'Meta',
  GOOGLE: 'Google',
  INFLUENCER: 'Influencer',
  EMAIL: 'Email',
  OFFLINE: 'Offline',
  OTHER: 'Other',
};

export default function MarketingPage() {
  const { can } = useAuth();
  const toast = useToast();
  const canWrite = can('marketing:write');

  const [range, setRange] = useState('90');
  const [overview, setOverview] = useState<Overview | null>(null);
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [editing, setEditing] = useState<Campaign | null>(null);
  const [adding, setAdding] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const from = since(range);
      const query = from ? { from } : {};
      const [o, c] = await Promise.all([
        api.get<{ data: Overview }>('/marketing/overview', query),
        api.get<{ data: Campaign[] }>('/marketing/campaigns', query),
      ]);
      setOverview(o.data);
      setCampaigns(c.data);
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setLoading(false);
    }
  }, [range]);

  useEffect(() => {
    const id = setTimeout(load, 0);
    return () => clearTimeout(id);
  }, [load]);

  async function removeCampaign(row: Campaign) {
    if (!confirm(`Remove ${row.name}? What you spent on it stays on the books.`)) return;
    try {
      await api.del(`/marketing/campaigns/${row.id}`);
      toast.success(`${row.name} removed`);
      load();
    } catch (err) {
      toast.error(errorMessage(err));
    }
  }

  const c = overview?.customers;

  return (
    <>
      <PageHeader
        title="Marketing"
        subtitle="What you spend to sell, and what it brings back"
        actions={
          <div className="flex items-center gap-2">
            <Select value={range} onChange={(e) => setRange(e.target.value)}>
              {RANGES.map((r) => (
                <option key={r.key} value={r.key}>
                  {r.label}
                </option>
              ))}
            </Select>
            {canWrite && (
              <Button variant="primary" onClick={() => setAdding(true)}>
                + Campaign
              </Button>
            )}
          </div>
        }
      />

      {error && (
        <div className="mb-4">
          <ErrorBox message={error} onRetry={load} />
        </div>
      )}

      {loading ? (
        <Loading />
      ) : (
        <>
          <div className="mb-5 grid grid-cols-2 gap-4 lg:grid-cols-4">
            <StatCard label="Spent on marketing" value={money(overview?.spend.total ?? 0)} sub="in this period" />
            <StatCard label="Revenue" value={money(overview?.revenue ?? 0)} sub={`${overview?.orders ?? 0} orders`} tone="green" />
            <StatCard
              label="Cost per order"
              value={overview?.costPerOrder == null ? '—' : money(overview.costPerOrder)}
              sub="spend ÷ orders"
              tone="blue"
            />
            <StatCard
              label="Back per rupee"
              value={overview?.roas == null ? '—' : `${overview.roas}x`}
              sub={overview?.shareOfRevenue != null ? `${overview.shareOfRevenue}% of revenue` : 'nothing spent yet'}
              tone={overview?.roas != null && overview.roas < 1 ? 'red' : undefined}
            />
          </div>

          <div className="mb-5 grid gap-5 lg:grid-cols-2">
            <Card title="Where the money went" padded={false}>
              <Table>
                <thead>
                  <tr>
                    <Th>Channel</Th>
                    <Th className="text-right">Spent</Th>
                  </tr>
                </thead>
                <tbody>
                  {!overview?.spend.byChannel.length && (
                    <EmptyRow colSpan={2} message="Nothing filed under Marketing yet" />
                  )}
                  {overview?.spend.byChannel.map((row) => (
                    <tr key={row.name}>
                      <Td>{row.name}</Td>
                      <Td className="whitespace-nowrap text-right font-medium">{money(row.total)}</Td>
                    </tr>
                  ))}
                </tbody>
              </Table>
              <p className="px-4 py-2.5 text-xs text-muted-foreground">
                Taken from{' '}
                <Link href="/admin/expenses" className="text-gold-ink hover:underline">
                  expenses
                </Link>{' '}
                filed under Marketing, plus anything tagged to a campaign.
              </p>
            </Card>

            <Card title="Who is buying" padded={false}>
              <Table>
                <thead>
                  <tr>
                    <Th>.</Th>
                    <Th className="text-right">Customers</Th>
                    <Th className="text-right">Revenue</Th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <Td>New to us</Td>
                    <Td className="text-right font-medium">{c?.newCustomers ?? 0}</Td>
                    <Td className="text-right">{money(c?.newRevenue ?? 0)}</Td>
                  </tr>
                  <tr>
                    <Td>Bought before</Td>
                    <Td className="text-right font-medium">{c?.returning ?? 0}</Td>
                    <Td className="text-right">{money(c?.returningRevenue ?? 0)}</Td>
                  </tr>
                  <tr>
                    <Td>Bought more than once in this period</Td>
                    <Td className="text-right font-medium">{c?.boughtAgain ?? 0}</Td>
                    <Td className="text-right text-muted-foreground">
                      {c?.repeatRate == null ? '—' : `${c.repeatRate}%`}
                    </Td>
                  </tr>
                </tbody>
              </Table>
              {c?.broughtBack.length ? (
                <div className="border-t border-border px-4 py-3">
                  <div className="caps-label mb-1.5 text-[10px] text-muted-foreground">What repeat buyers take</div>
                  <div className="flex flex-wrap gap-2">
                    {c.broughtBack.map((b) => (
                      <span key={b.variantId} className="rounded-full border border-border bg-muted/40 px-3 py-1 text-xs">
                        {b.product} <span className="text-muted-foreground">×{b.quantity}</span>
                      </span>
                    ))}
                  </div>
                </div>
              ) : null}
            </Card>
          </div>

          <div className="mb-5 rounded-lg border border-border bg-card">
            <div className="flex items-center justify-between border-b border-border px-4 py-2.5">
              <h2 className="font-display text-[15px] font-medium tracking-wide">Campaigns</h2>
              <span className="text-xs text-muted-foreground">{campaigns.length} in all</span>
            </div>
            <Table>
              <thead>
                <tr>
                  <Th>Campaign</Th>
                  <Th>Code</Th>
                  <Th className="text-right">Budget</Th>
                  <Th className="text-right">Spent</Th>
                  <Th className="text-right">Orders</Th>
                  <Th className="text-right">Revenue</Th>
                  <Th className="text-right">Back per rupee</Th>
                  {canWrite && <Th className="text-right">Actions</Th>}
                </tr>
              </thead>
              <tbody>
                {!campaigns.length && (
                  <EmptyRow colSpan={canWrite ? 8 : 7} message="No campaigns yet" />
                )}
                {campaigns.map((row) => (
                  <tr key={row.id}>
                    <Td>
                      <div className="font-medium text-foreground">{row.name}</div>
                      <div className="text-xs text-muted-foreground">
                        {CHANNEL_LABEL[row.channel] ?? row.channel} · {shortDate(row.startsOn)}
                        {row.endsOn ? ` – ${shortDate(row.endsOn)}` : ' – running'}
                      </div>
                    </Td>
                    <Td>{row.discount ? <Badge>{row.discount.code ?? row.discount.title}</Badge> : '—'}</Td>
                    <Td className="whitespace-nowrap text-right">{row.budget == null ? '—' : money(row.budget)}</Td>
                    <Td className="whitespace-nowrap text-right font-medium">
                      {money(row.spent)}
                      {row.leftOfBudget != null && row.leftOfBudget < 0 && (
                        <div className="text-xs text-destructive">over by {money(-row.leftOfBudget)}</div>
                      )}
                    </Td>
                    <Td className="text-right">{row.discount ? row.orders : '—'}</Td>
                    <Td className="whitespace-nowrap text-right">{row.discount ? money(row.revenue) : '—'}</Td>
                    <Td className="whitespace-nowrap text-right font-medium">
                      {row.roas == null ? '—' : `${row.roas}x`}
                    </Td>
                    {canWrite && (
                      <Td className="whitespace-nowrap text-right">
                        <button onClick={() => setEditing(row)} className="text-xs text-gold-ink hover:underline">
                          Edit
                        </button>
                        <button
                          onClick={() => removeCampaign(row)}
                          className="ml-3 text-xs text-muted-foreground hover:text-destructive"
                        >
                          Remove
                        </button>
                      </Td>
                    )}
                  </tr>
                ))}
              </tbody>
            </Table>
            <p className="px-4 py-2.5 text-xs text-muted-foreground">
              Orders and revenue are the ones that used the campaign&apos;s discount code. Tag its spend on an expense to
              fill the Spent column.
            </p>
          </div>

          <Card
            title="Discount codes"
            padded={false}
            action={
              <Link href="/admin/reports/offers" className="text-xs text-gold-ink hover:underline">
                Full offer report
              </Link>
            }
          >
            <Table>
              <thead>
                <tr>
                  <Th>Code</Th>
                  <Th>Offer</Th>
                  <Th className="text-right">Used</Th>
                  <Th className="text-right">Limit</Th>
                  <Th>Status</Th>
                </tr>
              </thead>
              <tbody>
                {!overview?.discounts.length && <EmptyRow colSpan={5} message="No discounts set up yet" />}
                {overview?.discounts.map((d) => (
                  <tr key={d.id}>
                    <Td className="font-mono text-xs">{d.code ?? 'automatic'}</Td>
                    <Td>
                      {d.title}
                      <span className="ml-2 text-xs text-muted-foreground">
                        {d.type === 'PERCENTAGE' ? `${d.value}% off` : `${money(d.value)} off`}
                      </span>
                    </Td>
                    <Td className="text-right font-medium">{d.usedCount}</Td>
                    <Td className="text-right text-muted-foreground">{d.usageLimit ?? '—'}</Td>
                    <Td>{d.live ? <Badge tone="green">Live</Badge> : <Badge>Off</Badge>}</Td>
                  </tr>
                ))}
              </tbody>
            </Table>
          </Card>
        </>
      )}

      {(adding || editing) && (
        <CampaignDialog
          campaign={editing}
          onClose={() => {
            setAdding(false);
            setEditing(null);
          }}
          onSaved={() => {
            setAdding(false);
            setEditing(null);
            load();
          }}
        />
      )}
    </>
  );
}
