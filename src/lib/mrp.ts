const num = (v: unknown) => {
  const n = typeof v === 'number' ? v : Number(v ?? NaN);
  return Number.isFinite(n) ? n : null;
};

export const roundRupee = (v: number) => Math.round(v);

export function priceFromMrp(mrp: number, percentOff: number) {
  return roundRupee(mrp * (1 - percentOff / 100));
}

export function offMrp(mrpValue: unknown, priceValue: unknown) {
  const mrp = num(mrpValue);
  const price = num(priceValue);
  if (mrp == null || price == null || mrp <= 0) return null;
  const amount = Math.round((mrp - price) * 100) / 100;
  const percent = Math.round(((mrp - price) / mrp) * 100);
  return { mrp, price, amount, percent, above: price > mrp };
}

export function wholePercentOff(mrpValue: unknown, priceValue: unknown) {
  const off = offMrp(mrpValue, priceValue);
  if (!off || off.above || off.percent <= 0 || off.percent >= 100) return null;
  return Math.abs(priceFromMrp(off.mrp, off.percent) - off.price) < 0.005 ? off.percent : null;
}

export function offMrpText(mrpValue: unknown, priceValue: unknown, money: (v: number) => string) {
  const off = offMrp(mrpValue, priceValue);
  if (!off) return null;
  if (off.above) return { text: `${money(-off.amount)} above MRP`, above: true };
  if (off.amount === 0) return { text: 'At MRP', above: false };
  return { text: `${money(off.amount)} · ${off.percent}% off MRP`, above: false };
}

export type MrpLine = { mrp?: string | number | null; quantity?: string | number | null; netTaxable: number; taxPercent?: number };

export function rateWithTax(rate: unknown, inclusive: boolean, taxPercent: number) {
  const r = num(rate) ?? 0;
  return inclusive ? r : r * (1 + (taxPercent || 0) / 100);
}

export function mrpSummary(lines: MrpLine[], headerDiscountRatio = 0) {
  let mrpTotal = 0;
  let sellTotal = 0;
  let counted = 0;
  let priced = 0;
  for (const l of lines) {
    const qty = num(l.quantity) ?? 0;
    if (qty <= 0) continue;
    priced += 1;
    const mrp = num(l.mrp);
    if (mrp == null || mrp <= 0) continue;
    counted += 1;
    mrpTotal += mrp * qty;
    sellTotal += l.netTaxable * (1 - headerDiscountRatio) * (1 + (l.taxPercent ?? 0) / 100);
  }
  if (!counted || mrpTotal <= 0) return null;
  const off = Math.round((mrpTotal - sellTotal) * 100) / 100;
  return { mrpTotal, sellTotal, off, percent: Math.round((off / mrpTotal) * 100), above: off < 0, partial: counted < priced };
}

export function percentOf(part: number, whole: number) {
  if (!(whole > 0) || !(part > 0)) return null;
  const pct = (part / whole) * 100;
  const rounded = Math.round(pct * 10) / 10;
  return Number.isInteger(rounded) ? String(rounded) : rounded.toFixed(1);
}

export const pctSuffix = (part: number, whole: number) => {
  const p = percentOf(part, whole);
  return p ? ` (${p}%)` : '';
};

export type MrpTotalEntry = { label: string; value: string; sub?: string | null; negative?: boolean; strong?: boolean };

export function mrpPdfTotals(lines: MrpLine[], money: (v: number | string) => string, headerDiscountRatio = 0): MrpTotalEntry[] {
  const s = mrpSummary(lines, headerDiscountRatio);
  if (!s) return [];
  return [
    {
      label: 'MRP (incl. GST)',
      value: money(s.mrpTotal),
      sub: s.above ? `${money(-s.off)} above MRP` : s.off > 0 ? `${money(s.off)} (${s.percent}%) off MRP` : 'Sold at MRP',
      negative: s.above,
    },
  ];
}

export function lineDiscountText(l: { discountPercent?: string | number | null; discountAmount?: string | number | null }, money: (v: number | string) => string) {
  if (l.discountPercent != null && Number(l.discountPercent) > 0) return `${Number(l.discountPercent)}%`;
  if (l.discountAmount != null && Number(l.discountAmount) > 0) return money(l.discountAmount);
  return '';
}
