'use client';

import { Badge, Card } from '@/components/ui';
import { MasterCrud, type MasterColumn } from '@/components/MasterCrud';

type Transporter = {
  id: string;
  name: string;
  transporterId: string | null;
  phone: string | null;
  isActive: boolean;
};

const status = (on: boolean) =>
  on ? <Badge tone="green">Active</Badge> : <Badge tone="gray">Switched off</Badge>;

export function PeopleTab({ canWrite }: { canWrite: boolean }) {
  const transporters: MasterColumn<Transporter>[] = [
    { header: 'Name', cell: (t) => t.name },
    {
      header: 'Transporter ID',
      className: 'whitespace-nowrap font-mono text-xs',
      cell: (t) => t.transporterId ?? '—',
    },
    {
      header: 'Phone',
      className: 'whitespace-nowrap text-xs',
      cell: (t) => t.phone ?? '—',
    },
    { header: 'Status', cell: (t) => status(t.isActive) },
  ];

  return (
    <div className="space-y-4">
      <Card title="Transporters" padded={false} collapsible>
        <div className="p-4">
          <MasterCrud<Transporter>
            endpoint="/transporters"
            singular="Transporter"
            canWrite={canWrite}
            columns={transporters}
            listParams={{ includeInactive: 'true' }}
            searchOn={(t) => `${t.name} ${t.transporterId ?? ''} ${t.phone ?? ''}`}
            note="The carrier named on a delivery challan and on Part B of an e-Way bill."
            sort={(a, b) => a.name.localeCompare(b.name)}
            blank={{ name: '', transporterId: '', phone: '', isActive: true }}
            toForm={(t) => ({
              name: t.name,
              transporterId: t.transporterId ?? '',
              phone: t.phone ?? '',
              isActive: t.isActive,
            })}
            fields={[
              { name: 'name', label: 'Name', required: true, wide: true },
              {
                name: 'transporterId',
                label: 'Transporter ID',
                placeholder: '09AALCP7274M1ZT',
                hint: 'The 15-character GSTIN or enrolment number that goes on the e-Way bill.',
              },
              { name: 'phone', label: 'Phone' },
              { name: 'isActive', label: 'Offer on challans and e-Way bills', type: 'checkbox' },
            ]}
          />
        </div>
      </Card>
    </div>
  );
}
