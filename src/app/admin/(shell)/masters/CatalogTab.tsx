'use client';

import { Badge, Card } from '@/components/ui';
import { MasterCrud, type MasterColumn } from '@/components/MasterCrud';

type PackageBox = {
  id: string;
  name: string;
  length: string | null;
  width: string | null;
  height: string | null;
  dimensionUnit: 'CM' | 'IN' | 'M';
  emptyWeight: string | null;
  weightUnit: 'KG' | 'G' | 'LB' | 'OZ';
  isDefault: boolean;
  isActive: boolean;
};

const status = (on: boolean) =>
  on ? <Badge tone="green">Active</Badge> : <Badge tone="gray">Switched off</Badge>;

const size = (p: PackageBox) => {
  const parts = [p.length, p.width, p.height].filter((n) => n != null && Number(n) > 0);
  return parts.length === 3 ? `${parts.map(Number).join(' × ')} ${p.dimensionUnit.toLowerCase()}` : '—';
};

export function CatalogTab({ canWrite }: { canWrite: boolean }) {
  const packages: MasterColumn<PackageBox>[] = [
    { header: 'Name', cell: (p) => p.name },
    { header: 'Size', className: 'whitespace-nowrap text-xs', cell: size },
    {
      header: 'Empty weight',
      className: 'whitespace-nowrap text-right text-xs tabular-nums',
      cell: (p) =>
        p.emptyWeight && Number(p.emptyWeight) > 0
          ? `${Number(p.emptyWeight)} ${p.weightUnit.toLowerCase()}`
          : '—',
    },
    {
      header: 'Status',
      cell: (p) => (
        <div className="flex flex-wrap gap-1">
          {status(p.isActive)}
          {p.isDefault && <Badge tone="blue">Default</Badge>}
        </div>
      ),
    },
  ];

  return (
    <div className="space-y-4">
      <Card title="Packages" padded={false} collapsible>
        <div className="p-4">
          <MasterCrud<PackageBox>
            endpoint="/catalog/packages"
            singular="Package"
            canWrite={canWrite}
            columns={packages}
            searchOn={(p) => p.name}
            note="Box sizes offered when packing a shipment; the empty weight is added to the parcel."
            sort={(a, b) => a.name.localeCompare(b.name)}
            blank={{
              name: '',
              length: '',
              width: '',
              height: '',
              dimensionUnit: 'CM',
              emptyWeight: '',
              weightUnit: 'KG',
              isDefault: false,
              isActive: true,
            }}
            toForm={(p) => ({
              name: p.name,
              length: p.length ?? '',
              width: p.width ?? '',
              height: p.height ?? '',
              dimensionUnit: p.dimensionUnit,
              emptyWeight: p.emptyWeight ?? '',
              weightUnit: p.weightUnit,
              isDefault: p.isDefault,
              isActive: p.isActive,
            })}
            fields={[
              { name: 'name', label: 'Name', required: true, wide: true },
              { name: 'length', label: 'Length', type: 'number', step: '0.1' },
              { name: 'width', label: 'Width', type: 'number', step: '0.1' },
              { name: 'height', label: 'Height', type: 'number', step: '0.1' },
              {
                name: 'dimensionUnit',
                label: 'Measured in',
                type: 'select',
                options: [
                  { value: 'CM', label: 'Centimetres' },
                  { value: 'IN', label: 'Inches' },
                  { value: 'M', label: 'Metres' },
                ],
              },
              { name: 'emptyWeight', label: 'Empty weight', type: 'number', step: '0.001' },
              {
                name: 'weightUnit',
                label: 'Weighed in',
                type: 'select',
                options: [
                  { value: 'KG', label: 'Kilograms' },
                  { value: 'G', label: 'Grams' },
                  { value: 'LB', label: 'Pounds' },
                  { value: 'OZ', label: 'Ounces' },
                ],
              },
              { name: 'isActive', label: 'Offer when packing', type: 'checkbox' },
              { name: 'isDefault', label: 'Use as the default box', type: 'checkbox' },
            ]}
          />
        </div>
      </Card>
    </div>
  );
}
