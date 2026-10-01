export type PackDraft = { size: string; discount: string };

export type OptionDraft = {
  name: string;
  valuesText: string;
  pack: boolean;
  packs: Record<string, PackDraft>;
};

export type VariantRow = {
  key: string;
  id?: string;
  values: string[];
  title: string;
  sku: string;
  price: string;
  compareAtPrice: string;
  compareManual?: boolean;
  priceManual?: boolean;
  mrpManual?: boolean;
  mrp: string;
  itemId: string;
  barcode: string;
  barcodeType: string;
};

export type ApiOption = {
  name: string;
  values: string[];
  packs?: { value: string; size: number; discountPercent: number }[];
};

export const parseValues = (text: string) =>
  [...new Set(text.split(',').map((v) => v.trim()).filter(Boolean))];

export const rowKey = (values: string[]) => values.join('␟');

export function combinations(options: OptionDraft[]): string[][] {
  const lists = options.map((o) => parseValues(o.valuesText)).filter((v) => v.length);
  if (!lists.length) return [];
  return lists.reduce<string[][]>(
    (acc, values) => acc.flatMap((combo) => values.map((v) => [...combo, v])),
    [[]]
  );
}

const STOP = new Set(['of', 'and', 'the', 'with', 'ml', 'l', 'ltr', 'g', 'gm', 'kg', 'mg', 'pcs', 'pc', 'x']);

export function valueCode(value: string) {
  const words = value.split(/[^A-Za-z0-9]+/).filter(Boolean);
  const letters = words
    .filter((w) => /^[A-Za-z]/.test(w) && !STOP.has(w.toLowerCase()))
    .map((w) => w[0].toUpperCase())
    .join('');
  const digits = words.filter((w) => /^\d/.test(w)).join('');
  return (letters + digits) || value.replace(/[^A-Za-z0-9]/g, '').slice(0, 3).toUpperCase();
}

export function skuPrefix(title: string, productSku?: string | null) {
  if (productSku?.trim()) return productSku.trim().toUpperCase();
  const letters = title
    .split(/[^A-Za-z0-9]+/)
    .filter((w) => /^[A-Za-z]/.test(w) && !STOP.has(w.toLowerCase()))
    .map((w) => w[0].toUpperCase())
    .join('');
  return letters.slice(0, 4) || 'SKU';
}

export const skuFor = (prefix: string, values: string[]) =>
  [prefix, ...values.map(valueCode)].join('-');

export const guessPackSize = (value: string, index: number) => {
  const digits = value.match(/\d+/);
  return digits ? digits[0] : String(index + 1);
};

export function packIndex(options: OptionDraft[]) {
  return options.findIndex((o) => o.pack);
}

export function packOf(options: OptionDraft[], values: string[]) {
  const i = packIndex(options);
  if (i === -1) return { size: 1, discount: 0 };
  const p = options[i].packs[values[i]];
  return {
    size: Math.max(1, Math.floor(Number(p?.size || 1))),
    discount: Math.min(90, Math.max(0, Number(p?.discount || 0))),
  };
}

export function singleRowFor(options: OptionDraft[], rows: VariantRow[], row: VariantRow) {
  const i = packIndex(options);
  if (i === -1) return null;
  return (
    rows.find(
      (r) =>
        r.values.every((v, j) => j === i || v === row.values[j]) &&
        packOf(options, r.values).size === 1
    ) ?? null
  );
}

export function packPricing(single: { price: string; compareAtPrice: string; mrp?: string }, size: number, discount: number) {
  const base = Number(single.price || 0);
  const mrpBase = Number(single.mrp || 0) > 0 ? Number(single.mrp) : base;
  const full = Math.round(base * size * 100) / 100;
  const fromMrp = Math.round(mrpBase * size * 100) / 100;
  const price = discount > 0 ? Math.round(fromMrp * (1 - discount / 100)) : full;
  const compareAt =
    discount > 0
      ? fromMrp
      : single.compareAtPrice && Number(single.compareAtPrice) > base
        ? Math.round(Number(single.compareAtPrice) * size * 100) / 100
        : null;
  return { price, compareAt };
}

export function toApiOptions(options: OptionDraft[]): ApiOption[] {
  return options
    .map((o) => ({ o, values: parseValues(o.valuesText) }))
    .filter(({ o, values }) => o.name.trim() && values.length)
    .map(({ o, values }) => ({
      name: o.name.trim(),
      values,
      ...(o.pack && {
        packs: values.map((v, i) => ({
          value: v,
          size: Math.max(1, Math.floor(Number(o.packs[v]?.size || guessPackSize(v, i)))),
          discountPercent: Math.min(90, Math.max(0, Number(o.packs[v]?.discount || 0))),
        })),
      }),
    }));
}

export function fromApiOptions(options: ApiOption[] | null | undefined): OptionDraft[] {
  return (options ?? []).map((o) => ({
    name: o.name,
    valuesText: o.values.join(', '),
    pack: !!o.packs?.length,
    packs: Object.fromEntries(
      (o.packs ?? []).map((p) => [p.value, { size: String(p.size), discount: String(p.discountPercent ?? 0) }])
    ),
  }));
}

const isSubsequence = (short: string[], long: string[]) => {
  let j = 0;
  for (const v of long) if (v === short[j]) j += 1;
  return j === short.length;
};

export function syncRows(options: OptionDraft[], rows: VariantRow[]): VariantRow[] {
  const combos = combinations(options);
  if (!combos.length) {
    return rows.length ? rows.map((r) => (r.values.length ? { ...r, values: [] } : r)) : [blankRow()];
  }

  const byKey = new Map(rows.map((r) => [r.key, r]));
  const used = new Set<string>();
  const exact = combos.map((values) => byKey.get(rowKey(values)) ?? null);
  exact.forEach((r) => r && used.add(r.key));
  const current = options.map((o) => parseValues(o.valuesText));

  const renamed = (values: string[]) =>
    rows.find((r) => {
      if (used.has(r.key) || r.values.length !== values.length) return false;
      const diff = r.values.map((v, j) => (v === values[j] ? -1 : j)).filter((j) => j !== -1);
      return diff.length === 1 && !current[diff[0]]?.includes(r.values[diff[0]]);
    });
  const reshaped = (values: string[]) =>
    rows.find(
      (r) =>
        !used.has(r.key) &&
        r.values.length > 0 &&
        r.values.length !== values.length &&
        (isSubsequence(r.values, values) || isSubsequence(values, r.values))
    );
  const spare = () => rows.find((r) => !used.has(r.key) && !r.values.length && r.id);

  return combos.map((values, i) => {
    const key = rowKey(values);
    const title = values.join(' / ');
    if (exact[i]) return { ...exact[i], title };
    const reuse = renamed(values) ?? reshaped(values) ?? spare();
    if (reuse) {
      used.add(reuse.key);
      return { ...reuse, key, values, title };
    }
    return {
      key,
      values,
      title,
      sku: '',
      price: '',
      compareAtPrice: '',
      mrp: '',
      itemId: '',
      barcode: '',
      barcodeType: '',
    };
  });
}

export type PackRow = { value: string; size: number; discount: string };

export const packValue = (size: number) => `Pack of ${size}`;

export const DEFAULT_PACKS: PackRow[] = [
  { value: packValue(1), size: 1, discount: '0' },
  { value: packValue(2), size: 2, discount: '0' },
  { value: packValue(3), size: 3, discount: '0' },
];

export function packRowsOf(option: OptionDraft): PackRow[] {
  return parseValues(option.valuesText)
    .map((v, i) => ({
      value: v,
      size: Math.max(1, Math.floor(Number(option.packs[v]?.size || guessPackSize(v, i)))),
      discount: option.packs[v]?.discount ?? '0',
    }))
    .sort((a, b) => a.size - b.size);
}

export function packOptionFrom(packs: PackRow[], name = 'Pack'): OptionDraft {
  return {
    name,
    valuesText: packs.map((p) => p.value).join(', '),
    pack: true,
    packs: Object.fromEntries(packs.map((p) => [p.value, { size: String(p.size), discount: p.discount }])),
  };
}

export type RowGroup = { key: string; values: string[]; single: VariantRow | null; packs: VariantRow[] };

export function groupRows(options: OptionDraft[], rows: VariantRow[]): RowGroup[] {
  const i = packIndex(options);
  if (i === -1) return rows.map((r) => ({ key: r.key, values: r.values, single: r, packs: [] }));

  const groups: RowGroup[] = [];
  const byKey = new Map<string, RowGroup>();
  for (const r of rows) {
    const others = r.values.filter((_, j) => j !== i);
    const k = rowKey(others);
    let g = byKey.get(k);
    if (!g) {
      g = { key: `group-${k}`, values: others, single: null, packs: [] };
      byKey.set(k, g);
      groups.push(g);
    }
    if (packOf(options, r.values).size > 1) g.packs.push(r);
    else if (!g.single) g.single = r;
    else groups.push({ key: r.key, values: others, single: r, packs: [] });
  }
  for (const g of groups) g.packs.sort((a, b) => packOf(options, a.values).size - packOf(options, b.values).size);
  return groups;
}

export function blankRow(): VariantRow {
  return {
    key: `row-${Math.random().toString(36).slice(2, 10)}`,
    values: [],
    title: '',
    sku: '',
    price: '',
    compareAtPrice: '',
    mrp: '',
    itemId: '',
    barcode: '',
    barcodeType: '',
  };
}
