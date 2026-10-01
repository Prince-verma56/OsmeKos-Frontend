export type TaxRow = { key: string; label: string; amount: number };

type Slab = { name: string; rate: string | number } | null;

export function taxBreakdown<L>(
  lines: L[],
  opts: {
    taxableOf: (line: L) => number;
    slabOf: (line: L) => Slab;
    subTotal: number;
    headerDiscount: number;
    intraState: boolean;
  }
): TaxRow[] {
  const { taxableOf, slabOf, subTotal, headerDiscount, intraState } = opts;

  const bySlab = new Map<string, { name: string; rate: number; amount: number }>();

  for (const line of lines) {
    const slab = slabOf(line);
    const rate = Number(slab?.rate ?? 0);
    if (!rate) continue;

    const taxable = taxableOf(line);
    const share = subTotal === 0 ? 0 : (headerDiscount * taxable) / subTotal;
    const amount = (taxable - share) * (rate / 100);

    const name = slab?.name ?? `${rate}%`;
    const key = `${name}:${rate}`;
    const seen = bySlab.get(key);
    if (seen) seen.amount += amount;
    else bySlab.set(key, { name, rate, amount });
  }

  const slabs = [...bySlab.values()].sort((a, b) => a.rate - b.rate);

  return slabs.flatMap(({ name, rate, amount }) => {
    if (!intraState) return [{ key: name, label: `${name} [${rate}%]`, amount }];

    const half = rate / 2;
    return [
      { key: `CGST${half}`, label: `CGST${half} [${half}%]`, amount: amount / 2 },
      { key: `SGST${half}`, label: `SGST${half} [${half}%]`, amount: amount / 2 },
    ];
  });
}
