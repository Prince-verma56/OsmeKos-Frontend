export type Overview = {
  spend: { total: number; byChannel: { name: string; total: number }[] };
  revenue: number;
  orders: number;
  discountGiven: number;
  costPerOrder: number | null;
  roas: number | null;
  shareOfRevenue: number | null;
  customers: {
    newCustomers: number;
    returning: number;
    boughtAgain: number;
    repeatRate: number | null;
    newRevenue: number;
    returningRevenue: number;
    broughtBack: { variantId: string; product: string; variant: string; quantity: number }[];
  };
  discounts: {
    id: string;
    code: string | null;
    title: string;
    type: string;
    value: number;
    usedCount: number;
    usageLimit: number | null;
    isActive: boolean;
    live: boolean;
  }[];
};

export type Campaign = {
  id: string;
  name: string;
  channel: string;
  startsOn: string;
  endsOn: string | null;
  budget: number | null;
  notes: string | null;
  discount: { id: string; code: string | null; title: string } | null;
  spent: number;
  orders: number;
  revenue: number;
  costPerOrder: number | null;
  roas: number | null;
  leftOfBudget: number | null;
};
