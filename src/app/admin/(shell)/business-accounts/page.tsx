'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { keepPreviousData, useQuery, useQueryClient } from '@tanstack/react-query';
import { Building2 } from 'lucide-react';
import { api, errorMessage, shortDate, type Paged } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { useToast } from '@/lib/toast';
import { useListParams } from '@/lib/useListParams';
import { Badge, Button, Input, PageHeader, Select } from '@/components/ui';
import { ExportMenu } from '@/components/ExportMenu';
import { ConfirmModal } from '@/components/Modal';
import { DataTable, type DataColumn } from '@/components/DataTable';
import { usePaymentTerms } from '@/components/PaymentTermSelect';
import type { Column } from '@/lib/export';

type Approval = 'PENDING' | 'APPROVED' | 'REJECTED' | 'SUSPENDED';

type Contact = {
  salutation?: string; firstName?: string; lastName?: string;
  email?: string; workPhone?: string; mobile?: string; designation?: string; isPrimary?: boolean;
};

type Login = {
  id: string; firstName: string | null; lastName: string | null;
  displayName: string | null; email: string | null; phone: string | null;
};

type Account = {
  id: string;
  companyName: string;
  legalName: string | null;
  tradeName: string | null;
  gstin: string | null;
  pan: string | null;
  paymentTerms: string;
  approvalStatus: Approval;
  approvedAt: string | null;
  isActive: boolean;
  notes: string | null;
  contacts: Contact[];
  customers: Login[];
  contactCount: number;
  createdAt: string;
};

const STATUS: Record<Approval, { label: string; tone: 'green' | 'amber' | 'red' | 'gray' }> = {
  PENDING: { label: 'Awaiting approval', tone: 'amber' },
  APPROVED: { label: 'Approved', tone: 'green' },
  REJECTED: { label: 'Rejected', tone: 'red' },
  SUSPENDED: { label: 'Suspended', tone: 'red' },
};

const statusOf = (a: Account) =>
  a.approvalStatus === 'APPROVED' && !a.isActive ? { label: 'Switched off', tone: 'gray' as const } : STATUS[a.approvalStatus];

const contactName = (c: Contact) => [c.salutation, c.firstName, c.lastName].filter(Boolean).join(' ');
const loginName = (l: Login) => l.displayName || [l.firstName, l.lastName].filter(Boolean).join(' ') || l.email || l.phone || 'Login';

function personOf(a: Account) {
  const c = a.contacts.find((x) => x.isPrimary) ?? a.contacts[0];
  if (c && (contactName(c) || c.email || c.mobile || c.workPhone)) {
    return { name: contactName(c) || c.email || '', line: c.email || c.mobile || c.workPhone || '' };
  }
  const l = a.customers[0];
  if (l) return { name: loginName(l), line: l.email || l.phone || '' };
  return { name: '', line: '' };
}

const DEFAULTS = { page: '1', limit: '20', search: '', approvalStatus: '', isActive: '' };

type Decision = { account: Account; to: Approval | 'OFF' | 'ON' };

const DECISION: Record<Decision['to'], { title: string; message: string; label: string; body: { approvalStatus?: Approval; isActive: boolean } }> = {
  APPROVED: {
    title: 'Approve this account?',
    message: 'The salon can then place orders at business prices and on its payment terms.',
    label: 'Approve',
    body: { approvalStatus: 'APPROVED', isActive: true },
  },
  REJECTED: {
    title: 'Reject this account?',
    message: 'The salon stays on file but cannot order. You can approve it later.',
    label: 'Reject',
    body: { approvalStatus: 'REJECTED', isActive: true },
  },
  SUSPENDED: {
    title: 'Suspend this account?',
    message: 'New orders are blocked until the account is approved again. Open orders and invoices are not affected.',
    label: 'Suspend',
    body: { approvalStatus: 'SUSPENDED', isActive: true },
  },
  PENDING: {
    title: 'Move back to awaiting approval?',
    message: 'The account goes back into the approval queue.',
    label: 'Move back',
    body: { approvalStatus: 'PENDING', isActive: true },
  },
  OFF: {
    title: 'Switch this account off?',
    message: 'It cannot order until switched on again. Nothing is deleted.',
    label: 'Switch off',
    body: { isActive: false },
  },
  ON: {
    title: 'Switch this account on?',
    message: 'Ordering works again straight away.',
    label: 'Switch on',
    body: { isActive: true },
  },
};

export default function BusinessAccountsPage() {
  const { can } = useAuth();
  const toast = useToast();
  const queryClient = useQueryClient();
  const { label: termName } = usePaymentTerms();
  const list = useListParams(DEFAULTS);
  const { values, set } = list;
  const page = Number(values.page) || 1;
  const limit = Number(values.limit) || 20;
  const canWrite = can('b2b-accounts:write');

  const [search, setSearch] = useState(values.search);
  useEffect(() => {
    if (search === values.search) return;
    const t = setTimeout(() => set({ search }), 300);
    return () => clearTimeout(t);
  }, [search, values.search, set]);

  const query = useQuery({
    queryKey: ['b2b-accounts', values],
    queryFn: () =>
      api.get<Paged<Account>>('/b2b-accounts', {
        page,
        limit,
        search: values.search || undefined,
        approvalStatus: values.approvalStatus || undefined,
        isActive: values.isActive || undefined,
      }),
    placeholderData: keepPreviousData,
  });

  const rows = query.data?.data;
  const [decision, setDecision] = useState<Decision | null>(null);
  const [busy, setBusy] = useState(false);

  async function decide() {
    if (!decision) return;
    const spec = DECISION[decision.to];
    setBusy(true);
    try {
      await api.patch(`/b2b-accounts/${decision.account.id}`, spec.body);
      toast.success(
        decision.to === 'APPROVED'
          ? `${decision.account.companyName} approved - it can place orders now`
          : `${decision.account.companyName}: ${spec.label.toLowerCase()} done`
      );
      setDecision(null);
      queryClient.invalidateQueries({ queryKey: ['b2b-accounts'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard'] });
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  const actionsFor = (a: Account) => {
    const out: { to: Decision['to']; label: string; variant?: 'success' | 'danger' }[] = [];
    if (!a.isActive) {
      out.push({ to: 'ON', label: 'Switch on' });
      return out;
    }
    if (a.approvalStatus === 'PENDING') {
      out.push({ to: 'APPROVED', label: 'Approve', variant: 'success' }, { to: 'REJECTED', label: 'Reject', variant: 'danger' });
    } else if (a.approvalStatus === 'APPROVED') {
      out.push({ to: 'SUSPENDED', label: 'Suspend' }, { to: 'OFF', label: 'Switch off' });
    } else {
      out.push({ to: 'APPROVED', label: 'Approve', variant: 'success' }, { to: 'PENDING', label: 'Move back' });
    }
    return out;
  };

  const columns = useMemo<DataColumn<Account>[]>(
    () => [
      {
        id: 'companyName',
        label: 'Company',
        enableHiding: false,
        enableSorting: false,
        header: 'Company',
        cell: ({ row }) => {
          const a = row.original;
          const login = a.customers[0];
          return (
            <div className="min-w-0">
              {login ? (
                <Link href={`/admin/customers/${login.id}`} className="font-medium text-foreground hover:text-gold-ink hover:underline">
                  {a.companyName}
                </Link>
              ) : (
                <span className="font-medium text-foreground">{a.companyName}</span>
              )}
              <div className="truncate text-xs text-muted-foreground">
                {a.tradeName && a.tradeName !== a.companyName ? a.tradeName : a.legalName && a.legalName !== a.companyName ? a.legalName : ''}
              </div>
            </div>
          );
        },
      },
      {
        id: 'person',
        label: 'Contact person',
        header: 'Contact person',
        enableSorting: false,
        className: 'max-w-[200px]',
        cell: ({ row }) => {
          const p = personOf(row.original);
          return (
            <div className="min-w-0 text-xs">
              <div className="truncate text-foreground/90">{p.name || '—'}</div>
              <div className="truncate text-muted-foreground">{p.line}</div>
            </div>
          );
        },
      },
      {
        id: 'gstin',
        label: 'GSTIN',
        header: 'GSTIN',
        enableSorting: false,
        className: 'whitespace-nowrap',
        cell: ({ row }) => <span className="font-mono text-xs">{row.original.gstin ?? '—'}</span>,
      },
      {
        id: 'paymentTerms',
        label: 'Payment terms',
        header: 'Payment terms',
        enableSorting: false,
        cell: ({ row }) => <span className="text-xs">{termName(row.original.paymentTerms)}</span>,
      },
      {
        id: 'logins',
        label: 'Logins',
        header: 'Logins',
        align: 'center',
        enableSorting: false,
        cell: ({ row }) =>
          row.original.contactCount ? (
            <span className="text-xs">{row.original.contactCount}</span>
          ) : (
            <span className="text-xs text-muted-foreground" title="No customer login is linked to this account yet">
              None
            </span>
          ),
      },
      {
        id: 'status',
        label: 'Status',
        header: 'Status',
        enableSorting: false,
        cell: ({ row }) => {
          const s = statusOf(row.original);
          return <Badge tone={s.tone}>{s.label}</Badge>;
        },
      },
      {
        id: 'actions',
        label: 'Actions',
        header: '',
        align: 'right',
        enableSorting: false,
        enableHiding: false,
        className: 'whitespace-nowrap',
        cell: ({ row }) =>
          canWrite ? (
            <div className="flex justify-end gap-1.5">
              {actionsFor(row.original).map((x) => (
                <Button key={x.to} size="sm" variant={x.variant} onClick={() => setDecision({ account: row.original, to: x.to })}>
                  {x.label}
                </Button>
              ))}
            </div>
          ) : null,
      },
    ],
    [canWrite, termName]
  );

  function exportSpec() {
    const exportColumns: Column<Account>[] = [
      { header: 'Company', value: (r) => r.companyName, width: 160 },
      { header: 'Legal name', value: (r) => r.legalName ?? '' },
      { header: 'GSTIN', value: (r) => r.gstin ?? '' },
      { header: 'PAN', value: (r) => r.pan ?? '' },
      { header: 'Contact person', value: (r) => personOf(r).name },
      { header: 'Contact', value: (r) => personOf(r).line, width: 140 },
      { header: 'Payment terms', value: (r) => termName(r.paymentTerms) },
      { header: 'Logins', value: (r) => r.contactCount },
      { header: 'Status', value: (r) => statusOf(r).label },
      { header: 'Approved on', value: (r) => (r.approvedAt ? shortDate(r.approvedAt) : '') },
      { header: 'Since', value: (r) => shortDate(r.createdAt) },
    ];
    return {
      title: 'Business accounts',
      subtitle: `${rows?.length ?? 0} account(s) on this page`,
      columns: exportColumns,
      rows: rows ?? [],
      footnote: 'Only approved, switched-on accounts can place orders at business prices.',
      orientation: 'landscape' as const,
    };
  }

  const clearFilters = () => {
    setSearch('');
    list.reset();
  };

  const pending = rows?.filter((r) => r.approvalStatus === 'PENDING').length ?? 0;

  return (
    <>
      <PageHeader
        title="Business accounts"
        subtitle="Salons, spas and resellers who buy at business prices - approve them here"
        actions={<ExportMenu spec={exportSpec} disabled={!rows?.length} />}
      />

      {pending > 0 && !values.approvalStatus && (
        <div className="mb-4 rounded-lg border border-warning/30 bg-warning/10 px-4 py-3 text-sm text-warning">
          {pending === 1 ? '1 account is' : `${pending} accounts are`} waiting for approval on this page - they cannot order until approved.
        </div>
      )}

      <DataTable
        viewKey="business-accounts"
        columns={columns}
        data={rows}
        getRowId={(r) => r.id}
        total={query.data?.meta.total ?? 0}
        page={page}
        pageSize={limit}
        onPageChange={(p) => set({ page: String(p) }, { resetPage: false })}
        onPageSizeChange={(n) => set({ limit: String(n) })}
        loading={query.isFetching}
        error={query.error ? errorMessage(query.error) : undefined}
        onRetry={() => query.refetch()}
        filtered={list.filtered}
        onClearFilters={clearFilters}
        views={{ query: list.query, apply: list.apply }}
        empty={{
          icon: <Building2 />,
          title: values.approvalStatus === 'PENDING' ? 'Nothing waiting for approval' : 'No business accounts yet',
          description:
            values.approvalStatus === 'PENDING'
              ? 'New salon sign-ups from the website will appear here.'
              : 'A business account is created when a salon signs up on the website, or from a customer marked as B2B.',
        }}
        toolbar={
          <>
            <Input
              placeholder="Search company or GSTIN…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full sm:max-w-xs"
              aria-label="Search business accounts"
            />
            <Select value={values.approvalStatus} onChange={(e) => set({ approvalStatus: e.target.value })} aria-label="Approval" className="w-auto">
              <option value="">Any status</option>
              <option value="PENDING">Awaiting approval</option>
              <option value="APPROVED">Approved</option>
              <option value="REJECTED">Rejected</option>
              <option value="SUSPENDED">Suspended</option>
            </Select>
            <Select value={values.isActive} onChange={(e) => set({ isActive: e.target.value })} aria-label="Switched on" className="w-auto">
              <option value="">On or off</option>
              <option value="true">Switched on</option>
              <option value="false">Switched off</option>
            </Select>
          </>
        }
        mobileCard={(a) => {
          const s = statusOf(a);
          const p = personOf(a);
          const login = a.customers[0];
          return (
            <div className="min-w-0">
              <div className="flex items-start justify-between gap-2">
                {login ? (
                  <Link href={`/admin/customers/${login.id}`} className="truncate font-medium text-foreground">
                    {a.companyName}
                  </Link>
                ) : (
                  <span className="truncate font-medium text-foreground">{a.companyName}</span>
                )}
                <Badge tone={s.tone}>{s.label}</Badge>
              </div>
              <div className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted-foreground">
                {p.name && <span>{p.name}</span>}
                {a.gstin && <span className="font-mono">{a.gstin}</span>}
                <span>{termName(a.paymentTerms)}</span>
              </div>
              {canWrite && (
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {actionsFor(a).map((x) => (
                    <Button key={x.to} size="sm" variant={x.variant} onClick={() => setDecision({ account: a, to: x.to })}>
                      {x.label}
                    </Button>
                  ))}
                </div>
              )}
            </div>
          );
        }}
      />

      <ConfirmModal
        open={Boolean(decision)}
        onClose={() => setDecision(null)}
        onConfirm={decide}
        busy={busy}
        title={decision ? DECISION[decision.to].title : ''}
        message={decision ? `${decision.account.companyName}: ${DECISION[decision.to].message}` : ''}
        confirmLabel={decision ? DECISION[decision.to].label : 'Confirm'}
        danger={decision?.to === 'REJECTED' || decision?.to === 'SUSPENDED' || decision?.to === 'OFF'}
      />
    </>
  );
}
