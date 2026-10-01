'use client';

import { useState } from 'react';
import { Badge, Card } from '@/components/ui';
import { MasterCrud, type MasterColumn } from '@/components/MasterCrud';

type TaxRate = {
  id: string;
  name: string;
  rate: string;
  type: 'GST' | 'IGST' | 'CESS' | 'TDS' | 'TCS';
  hsnPrefix: string | null;
  section: string | null;
  natureOfCollection: string | null;
  isCompound: boolean;
  isDefault: boolean;
  isActive: boolean;
};

const TYPE_TONE: Record<string, 'blue' | 'purple' | 'amber' | 'gray'> = {
  GST: 'blue',
  IGST: 'blue',
  CESS: 'gray',
  TDS: 'purple',
  TCS: 'amber',
};

export function TaxRatesTab({ canWrite }: { canWrite: boolean }) {
  const [showInactive, setShowInactive] = useState(true);

  const columns: MasterColumn<TaxRate>[] = [
    {
      header: 'Name',
      cell: (r) => (
        <div className="min-w-0">
          <div className="text-foreground">{r.name}</div>
          {r.natureOfCollection && (
            <div className="text-xs text-muted-foreground">
              {r.natureOfCollection}
            </div>
          )}
        </div>
      ),
    },
    {
      header: 'Type',
      cell: (r) => <Badge tone={TYPE_TONE[r.type] ?? 'gray'}>{r.type}</Badge>,
    },
    {
      header: 'Section',
      className: 'whitespace-nowrap font-mono text-xs',
      cell: (r) => r.section ?? r.hsnPrefix ?? '—',
    },
    {
      header: 'Rate',
      className: 'text-right whitespace-nowrap tabular-nums',
      cell: (r) => `${Number(r.rate)}%`,
    },
    {
      header: 'Status',
      cell: (r) => (
        <div className="flex flex-wrap gap-1">
          {r.isActive ? (
            <Badge tone="green">Active</Badge>
          ) : (
            <Badge tone="gray">Switched off</Badge>
          )}
          {r.isDefault && <Badge tone="blue">Default</Badge>}
          {r.isCompound && <Badge tone="gray">Compound</Badge>}
        </div>
      ),
    },
  ];

  return (
    <div className="space-y-4">
      <Card title="Before you change a rate" collapsible defaultOpen={false}>
        <ul className="ml-4 list-disc space-y-1 text-sm text-muted-foreground">
          <li>
            Documents store their own copy of the tax name and rate, so editing one here never
            rewrites an invoice or bill that has already been raised.
          </li>
          <li>
            Prefer switching a rate off over deleting it — an off rate disappears from the
            pickers but stays readable in this list.
          </li>
          <li>
            TDS and TCS rates carry a section (194C, 194J, 206C(1H)); GST rates carry an HSN
            prefix instead.
          </li>
        </ul>
      </Card>

      <Card
        title="Tax rates"
        collapsible
        action={
          <label className="flex items-center gap-2 text-xs text-muted-foreground">
            <input
              type="checkbox"
              checked={showInactive}
              onChange={(e) => setShowInactive(e.target.checked)}
              className="h-4 w-4 rounded border-border"
            />
            Show switched-off rates
          </label>
        }
        padded={false}
      >
        <div className="p-4">
          <MasterCrud<TaxRate>
            endpoint="/sales/tax-rates"
            singular="Tax rate"
            listParams={{ includeInactive: showInactive ? 'true' : undefined }}
            canWrite={canWrite}
            columns={columns}
            searchOn={(r) => `${r.name} ${r.type} ${r.section ?? ''} ${r.rate}`}
            note="Feeds the tax picker on orders and invoices, and the TDS/TCS picker on bills."
            deleteHint="Switching it off is usually the better move — it keeps the record of what the rate was."
            sort={(a, b) =>
              a.type.localeCompare(b.type) || Number(a.rate) - Number(b.rate)
            }
            blank={{
              name: '',
              type: 'GST',
              rate: '',
              hsnPrefix: '',
              section: '',
              natureOfCollection: '',
              isCompound: false,
              isDefault: false,
              isActive: true,
            }}
            toForm={(r) => ({
              name: r.name,
              type: r.type,
              rate: r.rate,
              hsnPrefix: r.hsnPrefix ?? '',
              section: r.section ?? '',
              natureOfCollection: r.natureOfCollection ?? '',
              isCompound: r.isCompound,
              isDefault: r.isDefault,
              isActive: r.isActive,
            })}
            fields={[
              {
                name: 'name',
                label: 'Name',
                required: true,
                wide: true,
                placeholder: 'GST18, or Professional Fees',
              },
              {
                name: 'type',
                label: 'Type',
                type: 'select',
                required: true,
                options: [
                  { value: 'GST', label: 'GST — within the state (CGST + SGST)' },
                  { value: 'IGST', label: 'IGST — across states' },
                  { value: 'CESS', label: 'Cess' },
                  { value: 'TDS', label: 'TDS — deducted when we pay' },
                  { value: 'TCS', label: 'TCS — collected when we sell' },
                ],
              },
              {
                name: 'rate',
                label: 'Rate (%)',
                type: 'number',
                step: '0.01',
                required: true,
                placeholder: '18',
              },
              {
                name: 'section',
                label: 'Section',
                placeholder: '194C',
                hint: 'The Income Tax section this deduction falls under.',
                when: (v) => v.type === 'TDS' || v.type === 'TCS',
              },
              {
                name: 'natureOfCollection',
                label: 'Nature of payment',
                placeholder: 'Payment to contractors',
                when: (v) => v.type === 'TDS' || v.type === 'TCS',
              },
              {
                name: 'hsnPrefix',
                label: 'HSN prefix',
                placeholder: '3004',
                hint: 'Optional. Applies this rate to items whose HSN starts with these digits.',
                when: (v) => v.type === 'GST' || v.type === 'IGST' || v.type === 'CESS',
              },
              { name: 'isActive', label: 'Offer this rate in pickers', type: 'checkbox' },
              { name: 'isDefault', label: 'Use as the default rate', type: 'checkbox' },
              {
                name: 'isCompound',
                label: 'Compound (charged on top of other taxes)',
                type: 'checkbox',
                wide: true,
                when: (v) => v.type === 'CESS',
              },
            ]}
          />
        </div>
      </Card>
    </div>
  );
}
