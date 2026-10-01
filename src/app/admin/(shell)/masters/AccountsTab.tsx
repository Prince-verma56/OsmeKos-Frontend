'use client';

import { useState } from 'react';
import { Badge, Card, Select } from '@/components/ui';
import { MasterCrud, type MasterColumn } from '@/components/MasterCrud';

type Account = {
  id: string;
  name: string;
  code: string | null;
  type: string;
  description: string | null;
  isSystem: boolean;
  isActive: boolean;
};

export const ACCOUNT_TYPES = [
  'OTHER_CURRENT_ASSET', 'CASH', 'BANK', 'FIXED_ASSET', 'STOCK', 'PAYMENT_CLEARING',
  'OTHER_CURRENT_LIABILITY', 'CREDIT_CARD', 'LONG_TERM_LIABILITY', 'OTHER_LIABILITY',
  'EQUITY', 'INCOME', 'OTHER_INCOME', 'EXPENSE', 'COST_OF_GOODS_SOLD', 'OTHER_EXPENSE',
] as const;

const LABEL: Record<string, string> = {
  OTHER_CURRENT_ASSET: 'Other Current Asset',
  CASH: 'Cash',
  BANK: 'Bank',
  FIXED_ASSET: 'Fixed Asset',
  STOCK: 'Stock',
  PAYMENT_CLEARING: 'Payment Clearing',
  OTHER_CURRENT_LIABILITY: 'Other Current Liability',
  CREDIT_CARD: 'Credit Card',
  LONG_TERM_LIABILITY: 'Long Term Liability',
  OTHER_LIABILITY: 'Other Liability',
  EQUITY: 'Equity',
  INCOME: 'Income',
  OTHER_INCOME: 'Other Income',
  EXPENSE: 'Expense',
  COST_OF_GOODS_SOLD: 'Cost of Goods Sold',
  OTHER_EXPENSE: 'Other Expense',
};

const SIDE: Record<string, 'blue' | 'green' | 'amber' | 'purple'> = {
  OTHER_CURRENT_ASSET: 'blue', CASH: 'blue', BANK: 'blue', FIXED_ASSET: 'blue',
  STOCK: 'blue', PAYMENT_CLEARING: 'blue',
  OTHER_CURRENT_LIABILITY: 'amber', CREDIT_CARD: 'amber',
  LONG_TERM_LIABILITY: 'amber', OTHER_LIABILITY: 'amber',
  EQUITY: 'purple',
  INCOME: 'green', OTHER_INCOME: 'green',
  EXPENSE: 'amber', COST_OF_GOODS_SOLD: 'amber', OTHER_EXPENSE: 'amber',
};

export function AccountsTab({ canWrite }: { canWrite: boolean }) {
  const [type, setType] = useState('');
  const [showInactive, setShowInactive] = useState(true);

  const columns: MasterColumn<Account>[] = [
    {
      header: 'Account',
      cell: (a) => (
        <div className="min-w-0">
          <div className="text-foreground">{a.name}</div>
          {a.description && (
            <div className="truncate text-xs text-muted-foreground">
              {a.description}
            </div>
          )}
        </div>
      ),
    },
    {
      header: 'Code',
      className: 'whitespace-nowrap font-mono text-xs',
      cell: (a) => a.code ?? '—',
    },
    {
      header: 'Type',
      cell: (a) => <Badge tone={SIDE[a.type] ?? 'gray'}>{LABEL[a.type] ?? a.type}</Badge>,
    },
    {
      header: 'Status',
      cell: (a) => (
        <div className="flex flex-wrap gap-1">
          {a.isActive ? <Badge tone="green">Active</Badge> : <Badge tone="gray">Switched off</Badge>}
          {a.isSystem && <Badge tone="blue">System</Badge>}
        </div>
      ),
    },
  ];

  return (
    <Card
      title="Chart of accounts"
      padded={false}
      collapsible
      action={
        <div className="flex flex-wrap items-center gap-2">
          <Select value={type} onChange={(e) => setType(e.target.value)} className="w-52">
            <option value="">All types</option>
            {ACCOUNT_TYPES.map((t) => (
              <option key={t} value={t}>
                {LABEL[t]}
              </option>
            ))}
          </Select>
          <label className="flex items-center gap-2 text-xs text-muted-foreground">
            <input
              type="checkbox"
              checked={showInactive}
              onChange={(e) => setShowInactive(e.target.checked)}
              className="h-4 w-4 rounded border-border"
            />
            Show switched-off
          </label>
        </div>
      }
    >
      <div className="p-4">
        <MasterCrud<Account>
          endpoint="/accounts"
          singular="Account"
          canWrite={canWrite}
          columns={columns}
          listParams={{
            type: type || undefined,
            includeInactive: showInactive ? 'true' : undefined,
          }}
          searchOn={(a) => `${a.name} ${a.code ?? ''} ${LABEL[a.type] ?? a.type}`}
          note="Every bill line, payment and stock posting picks one of these."
          deleteHint="A system account cannot be deleted — switch it off instead."
          deletable={(a) => !a.isSystem}
          sort={(a, b) => a.type.localeCompare(b.type) || a.name.localeCompare(b.name)}
          blank={{ name: '', type: 'EXPENSE', code: '', description: '', isActive: true }}
          toForm={(a) => ({
            name: a.name,
            type: a.type,
            code: a.code ?? '',
            description: a.description ?? '',
            isActive: a.isActive,
          })}
          fields={[
            { name: 'name', label: 'Account name', required: true, wide: true },
            {
              name: 'type',
              label: 'Type',
              type: 'select',
              required: true,
              options: ACCOUNT_TYPES.map((t) => ({ value: t, label: LABEL[t] })),
            },
            {
              name: 'code',
              label: 'Code',
              placeholder: '4001',
              hint: 'Optional. Must be unique if given.',
            },
            { name: 'description', label: 'Description', type: 'textarea', wide: true },
            { name: 'isActive', label: 'Offer this account in pickers', type: 'checkbox' },
          ]}
        />
      </div>
    </Card>
  );
}
