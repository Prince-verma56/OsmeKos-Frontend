'use client';

import { useMemo, useState } from 'react';
import { useAuth } from '@/lib/auth';
import { Badge, Card, PageHeader } from '@/components/ui';
import { Icon } from '@/components/Icon';
import { TaxRatesTab } from './TaxRatesTab';
import { AccountsTab } from './AccountsTab';
import { PaymentTermsTab } from './PaymentTermsTab';
import { PeopleTab } from './PeopleTab';
import { CatalogTab } from './CatalogTab';
import { ShippingTab } from './ShippingTab';
import { DocumentNumbersTab } from './DocumentNumbersTab';
import { QualityTab } from './QualityTab';
import { DocumentViewTab } from './DocumentViewTab';
import { MenuTab } from './MenuTab';
import { ItemKindsTab } from './ItemKindsTab';

type Tab = {
  key: string;
  label: string;
  icon: string;
  read: string[];
  write: string;
  render: (canWrite: boolean) => React.ReactNode;
};

const TABS: Tab[] = [
  {
    key: 'taxes',
    label: 'Taxes',
    icon: 'gst',
    read: ['masters:read'],
    write: 'masters:write',
    render: (w) => <TaxRatesTab canWrite={w} />,
  },
  {
    key: 'accounts',
    label: 'Chart of Accounts',
    icon: 'profit',
    read: ['masters:read'],
    write: 'masters:write',
    render: (w) => <AccountsTab canWrite={w} />,
  },
  {
    key: 'payment-terms',
    label: 'Payment Terms',
    icon: 'received',
    read: ['masters:read'],
    write: 'masters:write',
    render: (w) => <PaymentTermsTab canWrite={w} />,
  },
  {
    key: 'quality',
    label: 'Quality control',
    icon: 'receives',
    read: ['masters:read', 'qc:read'],
    write: 'masters:write',
    render: (w) => <QualityTab canWrite={w} />,
  },
  {
    key: 'numbers',
    label: 'Document Numbers',
    icon: 'invoices',
    read: ['masters:read'],
    write: 'settings:write',
    render: (w) => <DocumentNumbersTab canWrite={w} />,
  },
  {
    key: 'item-kinds',
    label: 'Item kinds',
    icon: 'items',
    read: ['items:read'],
    write: 'items:write',
    render: (w) => <ItemKindsTab canWrite={w} />,
  },
  {
    key: 'menu',
    label: 'Menu',
    icon: 'menu',
    read: ['settings:read'],
    write: 'settings:write',
    render: (w) => <MenuTab canWrite={w} />,
  },
  {
    key: 'document-view',
    label: 'Document view',
    icon: 'invoices',
    read: ['masters:read'],
    write: 'settings:write',
    render: (w) => <DocumentViewTab canWrite={w} />,
  },
  {
    key: 'people',
    label: 'Transporters',
    icon: 'truck',
    read: ['masters:read'],
    write: 'masters:write',
    render: (w) => <PeopleTab canWrite={w} />,
  },
  {
    key: 'shipping',
    label: 'Shipping',
    icon: 'truck',
    read: ['masters:read'],
    write: 'masters:write',
    render: (w) => <ShippingTab canWrite={w} />,
  },
  {
    key: 'catalog',
    label: 'Packages',
    icon: 'collections',
    read: ['masters:read'],
    write: 'masters:write',
    render: (w) => <CatalogTab canWrite={w} />,
  },
];

export default function MastersPage() {
  const { can } = useAuth();

  const allowed = useMemo(() => TABS.filter((t) => t.read.some((p) => can(p))), [can]);
  const [active, setActive] = useState(TABS[0].key);

  const tab = allowed.find((t) => t.key === active) ?? allowed[0];

  if (!tab) {
    return (
      <>
        <PageHeader title="Masters" subtitle="Set-up data behind the pickers across the admin" />
        <Card>
          <p className="text-sm text-muted-foreground">
            Your role does not include any of these lists. Ask an administrator for the
            permission you need.
          </p>
        </Card>
      </>
    );
  }

  const canWrite = can(tab.write);

  return (
    <>
      <PageHeader
        title="Masters"
        subtitle="The set-up data behind the pickers across the admin"
        actions={
          canWrite ? (
            <Badge tone="green">You can edit this list</Badge>
          ) : (
            <Badge tone="gray">Read only</Badge>
          )
        }
      />

      <div className="mb-4 flex flex-wrap gap-1 border-b border-border">
        {allowed.map((t) => (
          <button
            key={t.key}
            type="button"
            onClick={() => setActive(t.key)}
            className={`-mb-px flex items-center gap-1.5 border-b-2 px-3 py-2 text-sm font-medium
              transition-colors focus-visible:outline-none focus-visible:ring-2
              focus-visible:ring-gold/40 ${
                t.key === tab.key
                  ? 'border-gold text-gold-ink'
                  : 'border-transparent text-muted-foreground hover:text-foreground'
              }`}
          >
            <Icon name={t.icon} className="h-4 w-4" />
            {t.label}
          </button>
        ))}
      </div>

      {tab.render(canWrite)}
    </>
  );
}
