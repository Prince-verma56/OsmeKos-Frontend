export type OpexRow = { name: string; amount: number; percentOfPrice: number | null };

export type Assumptions = { opex: OpexRow[] };

export type MarginRow = {
  variantId: string;
  productId: string;
  product: string;
  variant: string;
  sku: string | null;
  handle: string;
  isCombo: boolean;
  itemId: string | null;
  itemName: string | null;
  mrp: number | null;
  sellingPrice: number;
  gstRate: number;
  gstCollected: number;
  netRevenue: number;
  cogsRows: { name: string; amount: number }[];
  cogs: number;
  opexRows: (OpexRow & { value: number })[];
  opex: number;
  opexOverridden: boolean;
  grossProfit: number;
  netProfit: number;
  grossMargin: number | null;
  netMargin: number | null;
  breakEvenPrice: number | null;
};
