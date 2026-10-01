'use client';

import { Badge, Card } from '@/components/ui';
import { MasterCrud, type MasterColumn } from '@/components/MasterCrud';
import { BASE_CATEGORIES } from '@/components/ItemKindPicker';

type ItemKind = {
  id: string;
  name: string;
  baseCategory: string;
  hint: string | null;
  isSystem: boolean;
  isActive: boolean;
  _count?: { items: number };
};

const behavesLike = (value: string) =>
  BASE_CATEGORIES.find((c) => c.value === value)?.label ?? value;

export function ItemKindsTab({ canWrite }: { canWrite: boolean }) {
  const columns: MasterColumn<ItemKind>[] = [
    { header: 'Name', cell: (k) => k.name },
    { header: 'Treated like', className: 'whitespace-nowrap text-xs', cell: (k) => behavesLike(k.baseCategory) },
    { header: 'Note', className: 'text-xs text-muted-foreground', cell: (k) => k.hint ?? '—' },
    {
      header: 'Items',
      className: 'text-right tabular-nums text-xs',
      cell: (k) => k._count?.items ?? 0,
    },
    {
      header: 'Status',
      cell: (k) => (
        <div className="flex flex-wrap gap-1">
          {k.isActive ? <Badge tone="green">Active</Badge> : <Badge tone="gray">Switched off</Badge>}
          {k.isSystem && <Badge tone="blue">Built in</Badge>}
        </div>
      ),
    },
  ];

  return (
    <Card title="Kinds of item" padded={false} collapsible>
      <div className="p-4">
        <MasterCrud<ItemKind>
          endpoint="/item-kinds"
          singular="Item kind"
          canWrite={canWrite}
          columns={columns}
          searchOn={(k) => k.name}
          listParams={{ includeInactive: true }}
          deletable={(k) => !k.isSystem && (k._count?.items ?? 0) === 0}
          deleteHint="A built-in kind, or one still used by items, cannot be removed."
          note="The buttons under “What kind of item is this?” on the item screen. What a kind is treated like decides how its items behave in stock, sales and purchases."
          blank={{ name: '', baseCategory: 'FINISHED_GOOD', hint: '', isActive: true }}
          toForm={(k) => ({
            name: k.name,
            baseCategory: k.baseCategory,
            hint: k.hint ?? '',
            isActive: k.isActive,
          })}
          fields={[
            { name: 'name', label: 'Name', required: true },
            {
              name: 'baseCategory',
              label: 'Treat it like',
              type: 'select',
              options: BASE_CATEGORIES.map((c) => ({ value: c.value, label: c.label })),
              hint: 'Built-in kinds cannot be changed.',
            },
            { name: 'hint', label: 'Note', wide: true, hint: 'Shown under the buttons on the item screen.' },
            { name: 'isActive', label: 'Offer this kind on the item screen', type: 'checkbox' },
          ]}
        />
      </div>
    </Card>
  );
}
