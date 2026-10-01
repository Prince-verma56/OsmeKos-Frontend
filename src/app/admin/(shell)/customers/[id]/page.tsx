'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { api, money, shortDate, dateTime, errorMessage, type Paged } from '@/lib/api';
import { stateName } from '@/lib/states';
import { ConfirmModal } from '@/components/Modal';
import { useToast } from '@/lib/toast';
import { useAuth } from '@/lib/auth';
import { usePaymentTerms } from '@/components/PaymentTermSelect';
import { type PdfOrg } from '@/components/DocumentPdf';
import { LoadedSalesSummary } from '@/components/SalesSummary';
import {
  Badge, Button, Card, EmptyRow, ErrorBox, Loading, PageHeader,
  Select, Spinner, Table, Td, Textarea, Th,
} from '@/components/ui';
import { PageCrumb } from '@/lib/crumbs';

type Address = {
  id: string; type: string; attention: string | null;
  line1: string; line2: string | null; city: string; state: string;
  stateCode: string | null; pincode: string; country: string; phone: string | null;
};

type Customer = {
  id: string;
  salutation: string | null;
  firstName: string | null;
  lastName: string | null;
  displayName: string | null;
  email: string | null;
  emailVerifiedAt: string | null;
  phone: string | null;
  phoneVerifiedAt: string | null;
  workPhone: string | null;
  customerType: 'D2C' | 'B2B';
  isGuest: boolean;
  acceptsMarketing: boolean;
  notes: string | null;
  status: string;
  totalOrders: number;
  totalSpent: string;
  lastOrderAt: string | null;
  createdAt: string;
  summary?: {
    invoiced: number; received: number;
    outstandingReceivables: number; unusedCredits: number;
    itemsToBePacked: number; itemsToBeShipped: number;
  };
  b2bAccount: {
    id: string; companyName: string; gstin: string | null; pan: string | null;
    gstTreatment: string; placeOfSupplyCode: string | null;
    taxPreference: string; paymentTerms: string;
    legalName: string | null; tradeName: string | null;
    approvalStatus: string; isActive: boolean;
    contacts: {
      salutation?: string; firstName?: string; lastName?: string;
      email?: string; workPhone?: string; mobile?: string; designation?: string;
    }[];
  } | null;
  identities: { id: string; provider: string; email: string | null; linkedAt: string }[];
  addresses: Address[];
  orders: {
    id: string; orderNumber: string; orderStatus: string; fulfillmentStatus: string;
    paymentStatus: string; grandTotal: string; amountPaid?: string; balanceDue?: string;
    placedAt: string | null; createdAt: string;
  }[];
};

type RailRow = {
  id: string; displayName: string | null; firstName: string | null; lastName: string | null;
  email: string | null; phone: string | null;
};

type Activity = {
  id: string; eventType: string; message: string | null;
  actorName: string | null; isComment: boolean; isInternal?: boolean; occurredAt: string;
};

type Mail = {
  id: string; subject: string; toEmail: string; status: string; createdAt: string;
};

const GST_LABEL: Record<string, string> = {
  REGISTERED_REGULAR: 'Registered Business — Regular',
  REGISTERED_COMPOSITION: 'Registered Business — Composition',
  UNREGISTERED: 'Unregistered Business',
  CONSUMER: 'Consumer',
  OVERSEAS: 'Overseas',
  SEZ: 'SEZ',
};

type CustomerStatement = {
  summary: {
    openingBalance: number;
    invoicedAmount: number;
    amountReceived: number;
    creditNotes: number;
    refunds: number;
    balanceDue: number;
  };
  ledger: {
    id: string;
    kind: string;
    date: string;
    transaction: string;
    details: string;
    amount: number;
    payment: number;
    balance: number;
  }[];
};

type CustomerInvoice = {
  id: string;
  invoiceNumber: string;
  invoiceDate: string;
  dueDate: string | null;
  status: string;
  grandTotal: string;
  balanceDue: string;
};

const TABS = ['Overview', 'Comments', 'Transactions', 'Mails', 'Statement'] as const;

const dayKey = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
type Tab = (typeof TABS)[number];

const RANGES = [
  ['this-fiscal', 'This Fiscal Year'],
  ['previous-fiscal', 'Previous Fiscal Year'],
  ['this-month', 'This Month'],
  ['this-quarter', 'This Quarter'],
  ['this-year', 'This Calendar Year'],
  ['previous-month', 'Previous Month'],
  ['previous-year', 'Previous Calendar Year'],
  ['all', 'All Time'],
] as const;

const dmy = (d: Date | null) =>
  d
    ? `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()}`
    : '';

const nameOf = (c: { displayName?: string | null; firstName?: string | null; lastName?: string | null; email?: string | null; phone?: string | null }) =>
  c.displayName || [c.firstName, c.lastName].filter(Boolean).join(' ') || c.email || c.phone || '—';

const addressLines = (a: Address) =>
  [
    a.line1,
    a.line2,
    a.city,
    [a.state, a.pincode].filter(Boolean).join(' '),
    a.country,
    a.phone ? `Phone: ${a.phone}` : null,
  ].filter(Boolean) as string[];

function rangeStart(key: string): Date | null {
  const now = new Date();
  const y = now.getFullYear();
  const m = now.getMonth();
  const fy = m < 3 ? y - 1 : y;
  switch (key) {
    case 'this-fiscal': return new Date(fy, 3, 1);
    case 'previous-fiscal': return new Date(fy - 1, 3, 1);
    case 'this-month': return new Date(y, m, 1);
    case 'this-quarter': return new Date(y, Math.floor(m / 3) * 3, 1);
    case 'this-year': return new Date(y, 0, 1);
    case 'previous-month': return new Date(y, m - 1, 1);
    case 'previous-year': return new Date(y - 1, 0, 1);
    default: return null;
  }
}

function rangeEnd(key: string): Date | null {
  const now = new Date();
  const y = now.getFullYear();
  const m = now.getMonth();
  const fy = m < 3 ? y - 1 : y;
  switch (key) {
    case 'this-fiscal': return new Date(fy + 1, 2, 31, 23, 59, 59);
    case 'previous-fiscal': return new Date(fy, 2, 31, 23, 59, 59);
    case 'this-month': return new Date(y, m + 1, 0, 23, 59, 59);
    case 'this-quarter': return new Date(y, Math.floor(m / 3) * 3 + 3, 0, 23, 59, 59);
    case 'this-year': return new Date(y, 11, 31, 23, 59, 59);
    case 'previous-month': return new Date(y, m, 0, 23, 59, 59);
    case 'previous-year': return new Date(y - 1, 11, 31, 23, 59, 59);
    default: return null;
  }
}

function Section({
  title,
  action,
  children,
}: {
  title: string;
  action?: React.ReactNode;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(true);
  return (
    <div className="border-b border-border py-3 last:border-0">
      <div className="flex items-center justify-between">
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          className="flex items-center gap-1.5 text-xs font-medium tracking-wide text-muted-foreground"
        >
          {title}
          <span className="text-[10px]">{open ? '▲' : '▼'}</span>
        </button>
        {action}
      </div>
      {open && <div className="mt-3">{children}</div>}
    </div>
  );
}

export default function CustomerDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { label: termName } = usePaymentTerms();

  const [customer, setCustomer] = useState<Customer | null>(null);
  const [rail, setRail] = useState<RailRow[]>([]);
  const [activity, setActivity] = useState<Activity[]>([]);
  const [mails, setMails] = useState<Mail[]>([]);
  const [org, setOrg] = useState<PdfOrg | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [tab, setTab] = useState<Tab>('Overview');
  const [confirming, setConfirming] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [deciding, setDeciding] = useState(false);
  const toast = useToast();
  const { can } = useAuth();
  const [reloadKey, setReloadKey] = useState(0);

  const [comment, setComment] = useState('');
  const [range, setRange] = useState<string>('this-fiscal');
  const canStatement = can('invoices:read') && can('payments-received:read') && can('credit-notes:read');
  const canInvoices = can('invoices:read');
  const [statementLoad, setStatementLoad] = useState<{
    key: string;
    data: CustomerStatement | null;
    error: string;
  } | null>(null);
  const [invoiceLoad, setInvoiceLoad] = useState<{
    key: string;
    rows: CustomerInvoice[];
    total: number;
    error: string;
  } | null>(null);

  useEffect(() => {
    if (tab !== 'Statement' || !canStatement) return;
    let cancelled = false;
    const key = `${id}|${range}|${reloadKey}`;
    const start = rangeStart(range);
    const end = rangeEnd(range);
    api
      .get<{ data: CustomerStatement }>(`/customers/${id}/statement`, {
        ...(start && { from: dayKey(start) }),
        ...(end && { to: dayKey(end) }),
      })
      .then((r) => {
        if (!cancelled) setStatementLoad({ key, data: r.data, error: '' });
      })
      .catch((err) => {
        if (!cancelled) setStatementLoad({ key, data: null, error: errorMessage(err) });
      });
    return () => {
      cancelled = true;
    };
  }, [id, tab, range, reloadKey, canStatement]);

  useEffect(() => {
    if (tab !== 'Transactions' || !canInvoices) return;
    let cancelled = false;
    const key = `${id}|${reloadKey}`;
    api
      .get<Paged<CustomerInvoice>>('/invoices', { customerId: id, limit: 50 })
      .then((r) => {
        if (!cancelled) setInvoiceLoad({ key, rows: r.data, total: r.meta?.total ?? r.data.length, error: '' });
      })
      .catch((err) => {
        if (!cancelled) setInvoiceLoad({ key, rows: [], total: 0, error: errorMessage(err) });
      });
    return () => {
      cancelled = true;
    };
  }, [id, tab, reloadKey, canInvoices]);

  const statementView = statementLoad?.key === `${id}|${range}|${reloadKey}` ? statementLoad : null;
  const statement = statementView?.data ?? null;
  const statementError = statementView?.error ?? '';
  const invoiceView = invoiceLoad?.key === `${id}|${reloadKey}` ? invoiceLoad : null;
  const invoices = invoiceView?.rows ?? [];

  const gather = useCallback(async (customerId: string) => {
    try {
      const [res, list, acts, mail, orgRes] = await Promise.all([
        api.get<{ data: Customer }>(`/customers/${customerId}`),
        api.get<Paged<RailRow>>('/customers', { limit: 100 }).catch(() => ({ data: [] as RailRow[] })),
        api
          .get<{ data: Activity[] }>('/shared/activity', { ownerType: 'CUSTOMER', ownerId: customerId })
          .catch(() => ({ data: [] as Activity[] })),
        api
          .get<{ data: Mail[] }>('/emails', { ownerType: 'CUSTOMER', ownerId: customerId })
          .catch(() => ({ data: [] as Mail[] })),
        api.get<{ data: PdfOrg }>('/organization').catch(() => null),
      ]);
      return {
        customer: res.data,
        rail: list.data,
        activity: acts.data,
        mails: mail.data,
        org: orgRes?.data ?? null,
        error: '',
      };
    } catch (err) {
      return { customer: null, rail: [], activity: [], mails: [], org: null, error: errorMessage(err) };
    }
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const fresh = await gather(id);
      if (cancelled || !fresh) return;
      setCustomer(fresh.customer);
      setRail(fresh.rail);
      setActivity(fresh.activity);
      setMails(fresh.mails);
      setOrg(fresh.org);
      setError(fresh.error);
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [id, reloadKey, gather]);

  async function addComment() {
    if (!comment.trim()) return;
    setBusy(true);
    try {
      await api.post('/shared/activity/comments', {
        ownerType: 'CUSTOMER',
        ownerId: id,
        message: comment.trim(),
      });
      setComment('');
      setReloadKey((k) => k + 1);
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  async function remove() {
    setBusy(true);
    try {
      await api.del(`/customers/${id}`);
      router.push('/admin/customers');
    } catch (err) {
      setError(errorMessage(err));
      setConfirming(false);
      setBusy(false);
    }
  }

  if (loading) return <Loading />;
  if (!customer) return <ErrorBox message={error || 'Customer not found'} />;

  async function setApproval(approvalStatus: string) {
    const id = customer?.b2bAccount?.id;
    if (!id) return;
    setDeciding(true);
    try {
      await api.patch(`/b2b-accounts/${id}`, { approvalStatus, isActive: true });
      toast.success(
        approvalStatus === 'APPROVED'
          ? 'Account approved — it can place orders now'
          : `Account marked ${approvalStatus.toLowerCase()}`
      );
      setReloadKey((k) => k + 1);
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setDeciding(false);
    }
  }

  const name = nameOf(customer);
  const account = customer.b2bAccount;
  const approved = account?.approvalStatus === 'APPROVED' && account.isActive;
  const billing = customer.addresses.find((a) => a.type === 'BILLING');
  const shipping = customer.addresses.find((a) => a.type === 'SHIPPING');
  const s = customer.summary ?? {
    invoiced: 0, received: 0, outstandingReceivables: 0,
    unusedCredits: 0, itemsToBePacked: 0, itemsToBeShipped: 0,
  };

  const other: [string, React.ReactNode][] = [
    ['Customer Type', customer.customerType === 'B2B' ? 'Business' : 'Individual'],
    ['Default Currency', 'INR'],
    ['GST Treatment', account ? (GST_LABEL[account.gstTreatment] ?? account.gstTreatment) : 'Consumer'],
    [
      'Place of Supply',
      account?.placeOfSupplyCode ? stateName(account.placeOfSupplyCode) : '—',
    ],
    ['Tax Preference', account?.taxPreference === 'TAX_EXEMPT' ? 'Tax Exempt' : 'Taxable'],
    ...(account
      ? ([
          ['Business Legal Name', account.legalName ?? account.companyName ?? '—'],
          ...(account.tradeName ? [['Business Trade Name', account.tradeName]] : []),
          ['GSTIN', account.gstin ?? '—'],
          ['PAN', account.pan ?? '—'],
        ] as [string, React.ReactNode][])
      : []),
    [
      'Source',
      customer.isGuest
        ? 'Guest checkout'
        : customer.identities.length
          ? customer.identities.map((i) => i.provider).join(', ')
          : 'Added by staff',
    ],
    ['Status', <Badge key="st" status={customer.status}>{customer.status}</Badge>],
  ];

  const from = rangeStart(range);
  const to = rangeEnd(range);

  const opening = statement?.summary.openingBalance ?? 0;
  const closing = statement?.summary.balanceDue ?? opening;

  const tabClass = (t: Tab) =>
    `-mb-px border-b-2 px-4 py-2.5 text-sm transition-colors ${
      tab === t
        ? 'border-border font-medium text-foreground'
        : 'border-transparent text-muted-foreground hover:text-foreground'
    }`;

  const menuItem =
    'block w-full px-3 py-2 text-left text-sm text-foreground hover:bg-muted';

  return (
    <div className="flex gap-5">
      <aside className="hidden w-64 shrink-0 xl:block">
        <div className="sticky top-4 rounded-lg border border-border bg-card">
          <div className="flex items-center justify-between border-b border-border px-3 py-2">
            <Link href="/admin/customers" className="text-sm font-medium hover:underline">
              All Customers
            </Link>
            <Link href="/admin/customers/new">
              <Button size="sm" variant="primary">+</Button>
            </Link>
          </div>
          <ul className="max-h-[70vh] overflow-y-auto">
            {rail.map((r) => (
              <li key={r.id}>
                <Link
                  href={`/admin/customers/${r.id}`}
                  className={`block border-b border-border px-3 py-2 text-sm last:border-0  ${
                    r.id === customer.id
                      ? 'bg-muted font-medium'
                      : 'hover:bg-muted/60'
                  }`}
                >
                  <span className="block truncate text-foreground">
                    {nameOf(r)}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </div>
      </aside>

      <div className="@container min-w-0 flex-1">
        <PageCrumb label={name} />

        <PageHeader
          title={name}
          actions={
            <div className="flex flex-wrap items-center gap-2">
              {account && (
                <Badge tone={approved ? 'green' : account.approvalStatus === 'PENDING' ? 'amber' : 'red'}>
                  {approved
                    ? 'Approved'
                    : account.approvalStatus.charAt(0) +
                      account.approvalStatus.slice(1).toLowerCase()}
                </Badge>
              )}
              {account && approved && can('customers:write') && (
                <Button size="sm" onClick={() => setApproval('SUSPENDED')} disabled={deciding}>
                  Suspend
                </Button>
              )}
              <Link href={`/admin/customers/${customer.id}/edit`}>
                <Button size="sm">✎ Edit</Button>
              </Link>
              <div className="relative">
                <Button size="sm" variant="primary" onClick={() => setMenuOpen((v) => !v)}>
                  New Transaction ▾
                </Button>
                {menuOpen && (
                  <div
                    className="absolute right-0 z-20 mt-1 w-52 rounded-md border border-border bg-card py-1 shadow-lg"
                    onMouseLeave={() => setMenuOpen(false)}
                  >
                    <Link
                      href={`/admin/orders/new/${customer.customerType === 'B2B' ? 'b2b' : 'd2c'}?customerId=${customer.id}`}
                      className={menuItem}
                      onClick={() => setMenuOpen(false)}
                    >
                      Sales Order
                    </Link>
                    {[
                      ['Invoice', `/invoices/new?customerId=${customer.id}`, 'invoices:write'],
                      ['Customer Payment', `/payments-received/new?customerId=${customer.id}`, 'payments-received:write'],
                      ['Delivery Challan', `/delivery-challans/new?customerId=${customer.id}`, 'delivery-challans:write'],
                      ['Credit Note', `/credit-notes/new?customerId=${customer.id}`, 'credit-notes:write'],
                    ]
                      .filter(([, , perm]) => can(perm))
                      .map(([label, href]) => (
                        <Link key={label} href={href} className={menuItem} onClick={() => setMenuOpen(false)}>
                          {label}
                        </Link>
                      ))}
                  </div>
                )}
              </div>
              <Button size="sm" variant="danger" onClick={() => setConfirming(true)} disabled={busy}>
                {busy && <Spinner />}
                Delete
              </Button>
            </div>
          }
        />

        {error && <div className="mb-4"><ErrorBox message={error} /></div>}

        {account && !approved && (
          <div
            className="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-lg border
              border-warning/30 bg-warning/10 px-4 py-3"
          >
            <div className="min-w-0">
              <div className="text-sm font-medium text-warning">
                {account.approvalStatus === 'PENDING'
                  ? 'This account is awaiting approval'
                  : account.approvalStatus === 'REJECTED'
                    ? 'This account was rejected'
                    : account.approvalStatus === 'SUSPENDED'
                      ? 'This account is suspended'
                      : 'This account is switched off'}
              </div>
              <div className="text-xs text-warning">
                {account.companyName} cannot place an order until it is approved. Drafts still
                work, so a quote can be prepared in the meantime.
              </div>
            </div>
            {can('customers:write') && (
              <div className="flex shrink-0 gap-2">
                <Button
                  size="sm"
                  variant="success"
                  onClick={() => setApproval('APPROVED')}
                  disabled={deciding}
                >
                  {deciding && <Spinner />}
                  Approve account
                </Button>
                {account.approvalStatus === 'PENDING' && (
                  <Button
                    size="sm"
                    variant="danger"
                    onClick={() => setApproval('REJECTED')}
                    disabled={deciding}
                  >
                    Reject
                  </Button>
                )}
              </div>
            )}
          </div>
        )}

        <div className="mb-5 flex gap-1 overflow-x-auto border-b border-border">
          {TABS.filter((t) => t !== 'Statement' || canStatement).map((t) => (
            <button key={t} type="button" className={tabClass(t)} onClick={() => setTab(t)}>
              {t}
              {t === 'Transactions' && customer.orders.length > 0 && (
                <span className="ml-1.5 text-xs text-muted-foreground">{customer.orders.length}</span>
              )}
              {t === 'Mails' && mails.length > 0 && (
                <span className="ml-1.5 text-xs text-muted-foreground">{mails.length}</span>
              )}
            </button>
          ))}
        </div>

        {tab === 'Overview' && (
          <div className="grid grid-cols-1 gap-5 @4xl:grid-cols-2">
            <Card padded={false}>
              <div className="flex items-start gap-3 border-b border-border bg-muted/60 p-4">
                <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-border text-lg font-semibold text-muted-foreground">
                  {name.charAt(0).toUpperCase()}
                </div>
                <div className="min-w-0">
                  <p className="font-semibold text-foreground">{name}</p>
                  {customer.email && (
                    <p className="truncate text-sm text-muted-foreground">
                      {customer.email}
                      {customer.emailVerifiedAt && (
                        <span className="ml-1.5 text-xs text-success">
                          verified
                        </span>
                      )}
                    </p>
                  )}
                  {customer.phone && (
                    <p className="text-sm text-muted-foreground">{customer.phone}</p>
                  )}
                </div>
              </div>

              <div className="px-4">
                <Section
                  title="ADDRESS"
                  action={
                    <Link
                      href={`/admin/customers/${customer.id}/edit`}
                      className="text-xs text-gold-ink hover:underline"
                    >
                      Edit
                    </Link>
                  }
                >
                  {billing || shipping ? (
                    <div className="space-y-4 text-sm leading-6">
                      {billing && (
                        <div>
                          <p className="text-xs text-muted-foreground">Billing Address</p>
                          <p className="font-semibold text-foreground">
                            {billing.attention || name}
                          </p>
                          {addressLines(billing).map((l, i) => (
                            <p key={i} className="text-foreground">{l}</p>
                          ))}
                        </div>
                      )}
                      {shipping && (
                        <div>
                          <p className="text-xs text-muted-foreground">Shipping Address</p>
                          <p className="font-semibold text-foreground">
                            {shipping.attention || name}
                          </p>
                          {addressLines(shipping).map((l, i) => (
                            <p key={i} className="text-foreground">{l}</p>
                          ))}
                        </div>
                      )}
                    </div>
                  ) : (
                    <p className="text-sm text-muted-foreground">No address on file.</p>
                  )}
                </Section>

                <Section title="OTHER DETAILS">
                  <dl className="space-y-2 text-sm">
                    {other.map(([label, value]) => (
                      <div key={label} className="flex justify-between gap-3">
                        <dt className="text-muted-foreground">{label}</dt>
                        <dd className="text-right text-foreground">{value}</dd>
                      </div>
                    ))}
                  </dl>
                </Section>

                <Section title="CONTACT PERSONS">
                  {account?.contacts.length ? (
                    <ul className="space-y-2 text-sm">
                      {account.contacts.map((c, i) => (
                        <li key={i} className="flex justify-between gap-3">
                          <span className="text-foreground">
                            {[c.salutation, c.firstName, c.lastName].filter(Boolean).join(' ')}
                            {c.designation && (
                              <span className="ml-1.5 text-xs text-muted-foreground">{c.designation}</span>
                            )}
                          </span>
                          <span className="text-xs text-muted-foreground">
                            {c.email || c.mobile || c.workPhone || ''}
                          </span>
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className="text-sm text-muted-foreground">
                      No contact persons found.
                    </p>
                  )}
                </Section>

                <Section title="RECORD INFO">
                  <dl className="space-y-2 text-sm">
                    <div className="flex justify-between gap-3">
                      <dt className="text-muted-foreground">Customer ID</dt>
                      <dd className="break-all text-right font-mono text-xs">{customer.id}</dd>
                    </div>
                    <div className="flex justify-between gap-3">
                      <dt className="text-muted-foreground">Created On</dt>
                      <dd>{shortDate(customer.createdAt)}</dd>
                    </div>
                    <div className="flex justify-between gap-3">
                      <dt className="text-muted-foreground">Marketing</dt>
                      <dd>{customer.acceptsMarketing ? 'Subscribed' : 'Not subscribed'}</dd>
                    </div>
                  </dl>
                </Section>
              </div>
            </Card>

            <div className="space-y-5">
              <Card>
                <div className="flex justify-between gap-3 text-sm">
                  <span className="text-muted-foreground">Payment due period</span>
                  <span className="font-medium">
                    {account ? termName(account.paymentTerms) : 'Due on Receipt'}
                  </span>
                </div>
              </Card>

              <Card title="Receivables" padded={false}>
                <Table>
                  <thead>
                    <tr>
                      <Th>CURRENCY</Th>
                      <Th className="text-right">OUTSTANDING</Th>
                      <Th className="text-right">UNUSED CREDITS</Th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr>
                      <Td>INR</Td>
                      <Td className="text-right font-medium">
                        {money(s.outstandingReceivables)}
                      </Td>
                      <Td className="text-right">{money(s.unusedCredits)}</Td>
                    </tr>
                  </tbody>
                </Table>
                <div className="flex flex-wrap gap-6 border-t border-border px-4 py-3 text-sm">
                  <span>
                    <span className="text-muted-foreground">Items to be packed: </span>
                    <strong className={s.itemsToBePacked ? 'text-warning' : ''}>
                      {s.itemsToBePacked.toFixed(2)}
                    </strong>
                  </span>
                  <span>
                    <span className="text-muted-foreground">Items to be shipped: </span>
                    <strong className={s.itemsToBeShipped ? 'text-warning' : ''}>
                      {s.itemsToBeShipped.toFixed(2)}
                    </strong>
                  </span>
                </div>
                <p className="border-t border-border px-4 py-2 text-xs text-muted-foreground">
                  Outstanding is what is still unpaid on invoices. Unused credits are open credit notes and
                  payments not yet matched to an invoice.
                </p>
              </Card>

              <LoadedSalesSummary
                endpoint={`/customers/${customer.id}/sales-summary`}
                title="Orders and spend"
                quantityLabel="Orders"
                revenueLabel="Spend"
                unitsCaption="orders placed"
                totalCaption="total spend"
                emptyMessage="No orders in this period. Cancelled and draft orders are left out."
              />

              <Card title="Activity">
                {activity.length === 0 ? (
                  <p className="text-sm text-muted-foreground">
                    Nothing recorded against this customer yet.
                  </p>
                ) : (
                  <ol className="space-y-4 border-l border-border pl-4">
                    {activity.map((a) => (
                      <li key={a.id} className="relative">
                        <span className="absolute -left-[21px] top-1.5 h-2 w-2 rounded-full bg-border" />
                        <p className="text-xs text-muted-foreground">
                          {dateTime(a.occurredAt)}
                        </p>
                        <p className="text-sm text-foreground">
                          {a.message ?? a.eventType.replaceAll('_', ' ')}
                        </p>
                        {a.actorName && (
                          <p className="text-xs text-muted-foreground">
                            by {a.actorName}
                          </p>
                        )}
                      </li>
                    ))}
                  </ol>
                )}
              </Card>
            </div>
          </div>
        )}

        {tab === 'Comments' && (
          <Card title="Comments">
            <div className="mb-4 flex gap-2">
              <Textarea
                rows={2}
                value={comment}
                onChange={(e) => setComment(e.target.value)}
                placeholder="Add a comment. Internal only — the customer never sees it."
              />
              <Button variant="primary" onClick={addComment} disabled={busy || !comment.trim()}>
                {busy && <Spinner />}
                Post
              </Button>
            </div>
            {activity.filter((a) => a.isComment).length === 0 ? (
              <p className="text-sm text-muted-foreground">No comments yet.</p>
            ) : (
              <ul className="space-y-3">
                {activity
                  .filter((a) => a.isComment)
                  .map((a) => (
                    <li
                      key={a.id}
                      className="rounded-md border border-border p-3 text-sm"
                    >
                      <p className="text-foreground">{a.message}</p>
                      <p className="mt-1 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                        <span>
                          {a.actorName ?? 'System'} · {dateTime(a.occurredAt)}
                        </span>
                        {a.isInternal !== false && <Badge tone="amber">Internal</Badge>}
                      </p>
                    </li>
                  ))}
              </ul>
            )}
          </Card>
        )}

        {tab === 'Transactions' && (
          <div className="space-y-5">
            <Card title={`Sales Orders (${customer.orders.length})`} padded={false}>
              <Table minWidth="560px">
                <thead>
                  <tr>
                    <Th>DATE</Th>
                    <Th>ORDER#</Th>
                    <Th>STATUS</Th>
                    <Th>FULFILMENT</Th>
                    <Th>PAYMENT</Th>
                    <Th className="text-right">AMOUNT</Th>
                  </tr>
                </thead>
                <tbody>
                  {customer.orders.length === 0 && (
                    <EmptyRow colSpan={6} message="This customer has not ordered yet" />
                  )}
                  {customer.orders.map((o) => (
                    <tr key={o.id} className="hover:bg-muted/60">
                      <Td className="whitespace-nowrap text-xs text-muted-foreground">
                        {shortDate(o.placedAt ?? o.createdAt)}
                      </Td>
                      <Td>
                        <Link
                          href={`/admin/orders/${o.id}`}
                          className="font-medium text-gold-ink hover:underline"
                        >
                          {o.orderNumber}
                        </Link>
                      </Td>
                      <Td><Badge status={o.orderStatus}>{o.orderStatus}</Badge></Td>
                      <Td className="text-xs">{o.fulfillmentStatus.replaceAll('_', ' ')}</Td>
                      <Td className="text-xs">{o.paymentStatus.replaceAll('_', ' ')}</Td>
                      <Td className="whitespace-nowrap text-right font-medium">
                        {money(o.grandTotal)}
                      </Td>
                    </tr>
                  ))}
                </tbody>
              </Table>
            </Card>

            {canInvoices && (
            <Card title={`Invoices (${invoiceView?.total ?? 0})`} padded={false}>
              {invoiceView?.error && (
                <div className="p-4">
                  <ErrorBox message={invoiceView.error} />
                </div>
              )}
              <Table minWidth="520px">
                <thead>
                  <tr>
                    <Th>DATE</Th>
                    <Th>INVOICE#</Th>
                    <Th>STATUS</Th>
                    <Th className="text-right">AMOUNT</Th>
                    <Th className="text-right">BALANCE DUE</Th>
                  </tr>
                </thead>
                <tbody>
                  {invoiceView && !invoiceView.error && invoices.length === 0 && (
                    <EmptyRow colSpan={5} message="No invoices for this customer yet" />
                  )}
                  {invoices.map((i) => (
                    <tr key={i.id} className="hover:bg-muted/60">
                      <Td className="whitespace-nowrap text-xs text-muted-foreground">
                        {shortDate(i.invoiceDate)}
                        {i.dueDate && <span className="block">Due {shortDate(i.dueDate)}</span>}
                      </Td>
                      <Td>
                        <Link
                          href={`/admin/invoices/${i.id}`}
                          className="font-medium text-gold-ink hover:underline"
                        >
                          {i.invoiceNumber}
                        </Link>
                      </Td>
                      <Td><Badge status={i.status}>{i.status.replaceAll('_', ' ')}</Badge></Td>
                      <Td className="whitespace-nowrap text-right font-medium">{money(i.grandTotal)}</Td>
                      <Td className="whitespace-nowrap text-right">{money(i.balanceDue)}</Td>
                    </tr>
                  ))}
                </tbody>
              </Table>
              {invoiceView && invoiceView.total > invoices.length && (
                <p className="border-t border-border px-4 py-2 text-xs text-muted-foreground">
                  Showing the latest {invoices.length} of {invoiceView.total} invoices.
                </p>
              )}
            </Card>
            )}
          </div>
        )}

        {tab === 'Mails' && (
          <Card title={`Mails (${mails.length})`} padded={false}>
            <Table minWidth="600px">
              <thead>
                <tr>
                  <Th>DATE</Th>
                  <Th>SUBJECT</Th>
                  <Th>TO</Th>
                  <Th>STATUS</Th>
                </tr>
              </thead>
              <tbody>
                {mails.length === 0 && (
                  <EmptyRow colSpan={4} message="No mail has been sent to this customer" />
                )}
                {mails.map((m) => (
                  <tr key={m.id}>
                    <Td className="whitespace-nowrap text-xs text-muted-foreground">
                      {shortDate(m.createdAt)}
                    </Td>
                    <Td>{m.subject}</Td>
                    <Td className="text-xs">{m.toEmail}</Td>
                    <Td><Badge status={m.status}>{m.status}</Badge></Td>
                  </tr>
                ))}
              </tbody>
            </Table>
          </Card>
        )}

        {tab === 'Statement' && (
          <>
            <div className="mb-4 flex flex-wrap items-center gap-2 print:hidden">
              <Select value={range} onChange={(e) => setRange(e.target.value)} aria-label="Statement period">
                {RANGES.map(([v, l]) => (
                  <option key={v} value={v}>{l}</option>
                ))}
              </Select>
              <Button size="sm" onClick={() => window.print()} disabled={!statement}>🖨 Print</Button>
            </div>

            <div className="mx-auto max-w-3xl border border-border bg-card p-4 font-serif sm:p-10 text-[13px] text-foreground print:max-w-none print:border-0 print:p-0">
              <div className="mb-10 flex flex-col gap-6 sm:flex-row sm:items-start sm:justify-between sm:gap-8">
                <div className="pt-2">
                  {org?.logoUrl ? (
                    <img src={org.logoUrl} alt="" className="h-28 w-auto object-contain" />
                  ) : (
                    <div className="text-2xl font-bold tracking-tight text-foreground">
                      {org?.brandName ?? org?.name ?? ''}
                    </div>
                  )}
                </div>
                <div className="text-right text-[12px] leading-5">
                  <p className="font-bold">{org?.legalName ?? org?.name}</p>
                  {[
                    org?.addressLine1,
                    org?.addressLine2,
                    [org?.city, org?.state, org?.pincode].filter(Boolean).join(' '),
                    org?.country ?? 'India',
                  ]
                    .filter(Boolean)
                    .map((l, i) => (
                      <p key={i}>{l}</p>
                    ))}
                  {org?.gstin && <p>GSTIN {org.gstin}</p>}
                  {org?.brandName && <p>Brand: {org.brandName}®</p>}
                  {org?.email && <p>{org.email}</p>}
                  {org?.website && <p>{org.website}</p>}
                </div>
              </div>

              <div className="mb-10 flex flex-col gap-6 sm:flex-row sm:items-start sm:justify-between sm:gap-8">
                <div className="text-[12px] leading-5">
                  <p className="mb-1 font-bold">To</p>
                  <p className="font-semibold text-info">{name}</p>
                  {billing
                    ? addressLines(billing).map((l, i) => <p key={i}>{l}</p>)
                    : shipping
                      ? addressLines(shipping).map((l, i) => <p key={i}>{l}</p>)
                      : null}
                </div>

                <div className="sm:shrink-0 sm:text-right">
                  <h3 className="border-b border-border pb-1 text-base font-bold">
                    Statement of Accounts
                  </h3>
                  <p className="mt-1 text-[12px]">
                    {from ? dmy(from) : 'Beginning'} To {to ? dmy(to) : dmy(new Date())}
                  </p>

                  <table className="mt-6 w-full text-[12px] sm:ml-auto sm:w-72">
                    <tbody>
                      <tr className="bg-muted">
                        <td className="px-3 py-1.5 font-semibold" colSpan={2}>
                          Account Summary
                        </td>
                      </tr>
                      <tr>
                        <td className="px-3 py-1.5 text-left">Opening Balance</td>
                        <td className="px-3 py-1.5 text-right">{money(opening)}</td>
                      </tr>
                      <tr>
                        <td className="px-3 py-1.5 text-left">Invoiced Amount</td>
                        <td className="px-3 py-1.5 text-right">{money(statement?.summary.invoicedAmount ?? 0)}</td>
                      </tr>
                      {(statement?.summary.refunds ?? 0) > 0 && (
                        <tr>
                          <td className="px-3 py-1.5 text-left">Refunds</td>
                          <td className="px-3 py-1.5 text-right">{money(statement?.summary.refunds ?? 0)}</td>
                        </tr>
                      )}
                      {(statement?.summary.creditNotes ?? 0) > 0 && (
                        <tr>
                          <td className="px-3 py-1.5 text-left">Credit Notes</td>
                          <td className="px-3 py-1.5 text-right">{money(statement?.summary.creditNotes ?? 0)}</td>
                        </tr>
                      )}
                      <tr className="border-b border-muted-foreground/40">
                        <td className="px-3 py-1.5 text-left">Amount Received</td>
                        <td className="px-3 py-1.5 text-right">{money(statement?.summary.amountReceived ?? 0)}</td>
                      </tr>
                      <tr>
                        <td className="px-3 py-1.5 text-left">Balance Due</td>
                        <td className="px-3 py-1.5 text-right">{money(closing)}</td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </div>

              <div className="overflow-x-auto">
              <table className="w-full min-w-[520px] text-[12px]">
                <thead>
                  <tr className="bg-primary text-primary-foreground">
                    <th className="px-3 py-2 text-left font-semibold">Date</th>
                    <th className="px-3 py-2 text-left font-semibold">Transactions</th>
                    <th className="px-3 py-2 text-left font-semibold">Details</th>
                    <th className="px-3 py-2 text-right font-semibold">Amount</th>
                    <th className="px-3 py-2 text-right font-semibold">Payments</th>
                    <th className="px-3 py-2 text-right font-semibold">Balance</th>
                  </tr>
                </thead>
                <tbody>
                  <tr className="border-b border-border">
                    <td className="px-3 py-2">{from ? dmy(from) : ''}</td>
                    <td className="px-3 py-2 font-semibold">***Opening Balance***</td>
                    <td className="px-3 py-2" />
                    <td className="px-3 py-2 text-right">{opening.toFixed(2)}</td>
                    <td className="px-3 py-2 text-right" />
                    <td className="px-3 py-2 text-right">{opening.toFixed(2)}</td>
                  </tr>
                  {!statement && !statementError && (
                    <tr>
                      <td colSpan={6} className="px-3 py-3 text-center text-muted-foreground">
                        Loading…
                      </td>
                    </tr>
                  )}
                  {(statement?.ledger ?? []).map((r) => (
                    <tr key={r.id} className="border-b border-border">
                      <td className="px-3 py-2">{dmy(new Date(`${r.date.slice(0, 10)}T00:00:00`))}</td>
                      <td className="px-3 py-2">{r.transaction}</td>
                      <td className="px-3 py-2 text-muted-foreground">{r.details}</td>
                      <td className="px-3 py-2 text-right">{r.amount.toFixed(2)}</td>
                      <td className="px-3 py-2 text-right">{r.payment.toFixed(2)}</td>
                      <td className="px-3 py-2 text-right">{r.balance.toFixed(2)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              </div>

              <div className="mt-6 flex justify-end gap-10 text-[12px] font-bold">
                <span>Balance Due</span>
                <span>{money(closing)}</span>
              </div>

              {statementError && (
                <p className="mt-6 text-sm text-destructive">{statementError}</p>
              )}
              <p className="mt-10 text-[11px] text-muted-foreground print:hidden">
                Built from invoices, payments received, credit notes and refunds. Draft and void invoices are left out.
              </p>
            </div>
          </>
        )}
      </div>

      <ConfirmModal
        open={confirming}
        onClose={() => setConfirming(false)}
        onConfirm={remove}
        title="Delete customer"
        confirmLabel="Delete"
        busy={busy}
        message={`${name} will be removed. Past orders keep their own snapshot of the customer, so history stays readable.`}
      />
    </div>
  );
}
