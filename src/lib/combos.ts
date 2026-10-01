import { api, type Paged } from '@/lib/api';

export const COMBO_PREFIX = 'combo:';

export type ComboChoice = {
  id: string;
  variantId: string;
  name: string;
  sku: string | null;
  unit: string;
  hsnCode: string | null;
  sellingPrice: string | null;
  sellingTaxTreatment: string | null;
  mrp: string | null;
  intraStateTaxRate: string | null;
  imageUrls: string[];
};

type ComboProduct = {
  id: string;
  title: string;
  variants: {
    id: string;
    title: string;
    sku: string | null;
    price: string | null;
    mrp: string | null;
    hsCode?: string | null;
    bundleTaxRate?: string | null;
    imageUrl: string | null;
    isActive?: boolean;
  }[];
};

export async function loadComboChoices(): Promise<ComboChoice[]> {
  const res = await api
    .get<Paged<ComboProduct>>('/products', { kind: 'BUNDLE', status: 'ACTIVE', limit: 100 })
    .catch(() => ({ data: [] as ComboProduct[] }));

  return res.data.flatMap((p) =>
    p.variants
      .filter((v) => v.isActive !== false)
      .map((v) => ({
        id: `${COMBO_PREFIX}${v.id}`,
        variantId: v.id,
        name: v.title && v.title !== 'Default' ? `${p.title} - ${v.title}` : p.title,
        sku: v.sku,
        unit: 'pcs',
        hsnCode: v.hsCode ?? null,
        sellingPrice: v.price,
        sellingTaxTreatment: 'INCLUSIVE',
        mrp: v.mrp,
        intraStateTaxRate: v.bundleTaxRate ?? null,
        imageUrls: v.imageUrl ? [v.imageUrl] : [],
      }))
  );
}

export const comboVariantOf = (value: string) =>
  value.startsWith(COMBO_PREFIX) ? value.slice(COMBO_PREFIX.length) : null;
