'use client';

import { Badge, Card } from '@/components/ui';
import { MasterCrud, type MasterColumn } from '@/components/MasterCrud';

type PaymentTerm = {
  id: string;
  name: string;
  code: string;
  days: number;
  isDefault: boolean;
  isActive: boolean;
};

export function PaymentTermsTab({ canWrite }: { canWrite: boolean }) {
  const columns: MasterColumn<PaymentTerm>[] = [
    { header: 'Name', cell: (t) => t.name },
    {
      header: 'Code',
      className: 'whitespace-nowrap font-mono text-xs',
      cell: (t) => t.code,
    },
    {
      header: 'Due after',
      className: 'text-right whitespace-nowrap tabular-nums',
      cell: (t) => (t.days === 0 ? 'Same day' : `${t.days} day${t.days === 1 ? '' : 's'}`),
    },
    {
      header: 'Status',
      cell: (t) => (
        <div className="flex flex-wrap gap-1">
          {t.isActive ? <Badge tone="green">Active</Badge> : <Badge tone="gray">Switched off</Badge>}
          {t.isDefault && <Badge tone="blue">Default</Badge>}
        </div>
      ),
    },
  ];

  return (
    <Card title="Payment terms" padded={false} collapsible>
      <div className="p-4">
        <MasterCrud<PaymentTerm>
          endpoint="/payment-terms"
          singular="Payment term"
          canWrite={canWrite}
          columns={columns}
          listParams={{ includeInactive: 'true' }}
          searchOn={(t) => `${t.name} ${t.code}`}
          note="Sets the due date on invoices and bills, which drives both ageing reports."
          sort={(a, b) => a.days - b.days}
          blank={{ name: '', days: 0, isDefault: false, isActive: true }}
          toForm={(t) => ({
            name: t.name,
            days: t.days,
            isDefault: t.isDefault,
            isActive: t.isActive,
          })}
          fields={[
            {
              name: 'name',
              label: 'Name',
              required: true,
              placeholder: 'Net 30',
              hint: 'The code is generated from this.',
            },
            {
              name: 'days',
              label: 'Days until due',
              type: 'number',
              required: true,
              placeholder: '30',
              hint: '0 means due on receipt.',
            },
            { name: 'isActive', label: 'Offer this term in pickers', type: 'checkbox' },
            { name: 'isDefault', label: 'Use as the default term', type: 'checkbox' },
          ]}
        />
      </div>
    </Card>
  );
}
