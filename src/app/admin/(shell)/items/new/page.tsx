'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { api, errorMessage, type Paged } from '@/lib/api';
import {
  ItemFormFields, emptyItemForm, itemFormProblem, itemFormToPayload, itemToForm,
  type ItemFacets, type ItemFormValues, type Location, type Vendor,
} from '@/components/ItemForm';
import { Button, ErrorBox, PageHeader, Spinner } from '@/components/ui';
import { PageCrumb } from '@/lib/crumbs';
import { SaveBar } from '@/components/form/SaveBar';

export default function NewItemPage() {
  const router = useRouter();
  const params = useSearchParams();
  const duplicateOf = params.get('duplicate');
  const [copiedFrom, setCopiedFrom] = useState('');

  const [locations, setLocations] = useState<Location[]>([]);
  const [vendors, setVendors] = useState<Vendor[]>([]);
  const [facets, setFacets] = useState<ItemFacets>({ brands: [], manufacturers: [], hsnCodes: [] });

  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  const [images, setImages] = useState<string[]>(['', '']);
  const [form, setFormState] = useState<ItemFormValues>(emptyItemForm());
  const setForm = (patch: Partial<ItemFormValues>) => setFormState((f) => ({ ...f, ...patch }));

  useEffect(() => {
    (async () => {
      try {
        const [loc, ven, fac, org] = await Promise.all([
          api.get<Paged<Location>>('/locations', { limit: 50 }),
          api.get<Paged<Vendor>>('/vendors', { limit: 100 }).catch(() => ({ data: [] as Vendor[] })),
          api.get<{ data: ItemFacets }>('/items/facets'),
          api.get<{ data: { defaultTaxTreatment?: string } }>('/organization').catch(() => null),
        ]);
        setLocations(loc.data);
        setVendors(ven.data);
        setFacets(fac.data);
        const def = loc.data.find((l) => l.isDefault) ?? loc.data[0];
        setForm({
          ...(def && { openingStockLocationId: def.id }),
          ...(org?.data?.defaultTaxTreatment && { sellingTaxTreatment: org.data.defaultTaxTreatment }),
        });
        if (duplicateOf) {
          const src = await api.get<{ data: Record<string, unknown> & { name: string; imageUrls?: string[] } }>(
            `/items/${duplicateOf}`
          );
          const copy = itemToForm(src.data);
          setFormState({
            ...copy,
            name: `${src.data.name} (copy)`,
            sku: '',
            openingStock: '',
            openingStockValue: '',
            openingStockLocationId: def?.id ?? '',
            stockLocationId: '',
          });
          setImages([...(src.data.imageUrls ?? []), '', ''].slice(0, Math.max(2, src.data.imageUrls?.length ?? 0)));
          setCopiedFrom(src.data.name);
        }
      } catch (err) {
        setError(errorMessage(err));
      }
    })();
  }, [duplicateOf]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const problem = itemFormProblem(form);
    if (problem) {
      setError(problem);
      return;
    }
    setError('');
    setSaving(true);
    try {
      const res = await api.post<{ data: { id: string } }>(
        '/items',
        itemFormToPayload(form, images, true)
      );
      router.push(`/admin/items/${res.data.id}`);
    } catch (err) {
      setError(errorMessage(err));
      setSaving(false);
    }
  }

  return (
    <form onSubmit={submit}>
      <PageCrumb label="New item" />

      <PageHeader
        title="New item"
        subtitle={copiedFrom ? `Copied from ${copiedFrom} - change the name and SKU before saving. Stock is not copied.` : undefined}
      />

      {error && <div className="mb-4"><ErrorBox message={error} /></div>}

      <ItemFormFields
        mode="create"
        form={form}
        setForm={setForm}
        images={images}
        setImages={setImages}
        locations={locations}
        vendors={vendors}
        facets={facets}
      />
      <SaveBar>
        <Link href="/admin/items"><Button type="button">Cancel</Button></Link>
        <Button type="submit" variant="primary" disabled={saving}>
          {saving && <Spinner className="border-card/40 border-t-card" />}
          Save item
        </Button>
      </SaveBar>
    </form>
  );
}
