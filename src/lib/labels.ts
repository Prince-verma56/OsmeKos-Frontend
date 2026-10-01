export type NetUnit = 'ML' | 'G' | 'PCS';

export const NET_UNITS: { value: NetUnit; label: string; per: string }[] = [
  { value: 'ML', label: 'ml', per: 'ml' },
  { value: 'G', label: 'g', per: 'g' },
  { value: 'PCS', label: 'pcs', per: 'pc' },
];

export type KeyActive = { name: string; percent: string; short?: string };

export type ReadinessCheck = { key: string; label: string; ok: boolean; required: boolean; detail: string | null };
export type Readiness = { ready: boolean; shopComplete: boolean; checks: ReadinessCheck[] };

export type Manufacturer = {
  id: string;
  displayName: string;
  companyName?: string | null;
  vendorType?: string;
  cosmeticsLicenceNo: string | null;
  addresses?: { line1: string; line2: string | null; city: string; state: string; pincode: string }[];
};

export function eanProblem(value: string): string | null {
  const code = value.replace(/\s/g, '');
  if (!code) return null;
  if (!/^\d+$/.test(code)) return null;
  if (code.length !== 13) return `An EAN-13 barcode has 13 digits - this one has ${code.length}`;
  const sum = code
    .slice(0, 12)
    .split('')
    .reduce((total, d, i) => total + Number(d) * (i % 2 === 0 ? 1 : 3), 0);
  const expected = String((10 - (sum % 10)) % 10);
  return code[12] === expected ? null : `The last digit should be ${expected} - check the barcode for a typo`;
}

export function unitSalePrice(mrp: string | number | null | undefined, netQuantity: string | number | null | undefined) {
  const price = Number(mrp);
  const qty = Number(netQuantity);
  if (!(price > 0) || !(qty > 0)) return null;
  return Math.round((price / qty) * 1000) / 1000;
}

export const perUnit = (unit: string | null | undefined) => NET_UNITS.find((u) => u.value === unit)?.per ?? 'unit';

export function inciCount(text: string) {
  return text
    .split(/[,;\n]/)
    .map((s) => s.trim())
    .filter(Boolean).length;
}

export const productStatusLabel = (status: string) =>
  status === 'ACTIVE' ? 'Ready to sell' : status === 'DRAFT' ? 'Draft' : status === 'ARCHIVED' ? 'Archived' : status;
