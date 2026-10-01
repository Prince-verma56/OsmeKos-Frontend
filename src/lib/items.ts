export const SIZE_UNITS = ['ml', 'L', 'g', 'kg', 'mm', 'cm', 'pcs'] as const;

export const TAX_TREATMENTS = [
  { value: 'INCLUSIVE', label: 'Tax included' },
  { value: 'EXCLUSIVE', label: 'Tax excluded' },
] as const;

export function priceAs(
  amount: string | number | null | undefined,
  from: string | null | undefined,
  to: string | null | undefined,
  taxPercent: number
) {
  const value = Number(amount ?? 0);
  if (!from || !to || from === to || !taxPercent) return value;
  const factor = 1 + taxPercent / 100;
  return Math.round((from === 'INCLUSIVE' ? value / factor : value * factor) * 100) / 100;
}

export type RateMemo = { from: string; to: string; percent: number; before: string; after: string };

export function switchRate(
  rate: string,
  memo: RateMemo | undefined,
  from: string,
  to: string,
  percent: number
): { rate: string; rateMemo?: RateMemo } {
  if (from === to || !percent || rate.trim() === '' || !Number.isFinite(Number(rate))) {
    return { rate, rateMemo: memo };
  }
  if (memo && memo.from === to && memo.to === from && memo.percent === percent && memo.after === rate) {
    return { rate: memo.before, rateMemo: undefined };
  }
  const after = String(priceAs(rate, from, to, percent));
  return { rate: after, rateMemo: { from, to, percent, before: rate, after } };
}

export type SizedItem = {
  name: string;
  sizeValue?: string | number | null;
  sizeUnit?: string | null;
};

export function sizeLabel(item: SizedItem | null | undefined) {
  if (item?.sizeValue == null || item.sizeValue === '' || !item.sizeUnit) return null;
  return `${Number(item.sizeValue)} ${item.sizeUnit}`;
}

export function itemLabel(item: SizedItem) {
  const size = sizeLabel(item);
  if (!size) return item.name;
  const squash = (v: string) => v.toLowerCase().replace(/\s+/g, '');
  return squash(item.name).includes(squash(size)) ? item.name : `${item.name} ${size}`;
}
