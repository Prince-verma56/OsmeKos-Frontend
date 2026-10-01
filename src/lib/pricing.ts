export function marginOf(
  price: string | number | null | undefined,
  cost: string | number | null | undefined
) {
  if (price === '' || price == null || cost === '' || cost == null) return null;
  const p = Number(price);
  const c = Number(cost);
  if (!Number.isFinite(p) || !Number.isFinite(c) || p <= 0) return null;
  const profit = p - c;
  return { profit, margin: (profit / p) * 100 };
}
