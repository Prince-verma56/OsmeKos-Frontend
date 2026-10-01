import type { BadgeTone } from '@/components/ui/badge';

export type LotStatus = 'PENDING_QC' | 'AVAILABLE' | 'ON_HOLD' | 'REJECTED' | 'EXPIRED' | 'RECALLED';

export const LOT_STATUS: Record<LotStatus, { label: string; tone: BadgeTone }> = {
  PENDING_QC: { label: 'Waiting for QC', tone: 'amber' },
  AVAILABLE: { label: 'Accepted', tone: 'green' },
  ON_HOLD: { label: 'On hold', tone: 'amber-outline' },
  REJECTED: { label: 'Rejected', tone: 'red' },
  EXPIRED: { label: 'Expired', tone: 'gray' },
  RECALLED: { label: 'Recalled', tone: 'red-outline' },
};

export const lotStatusOf = (status: string) => LOT_STATUS[status as LotStatus] ?? { label: status, tone: 'gray' as BadgeTone };

export type BatchRule = {
  itemId: string;
  name: string;
  category: string;
  batchRequired: boolean;
  expiryRequired: boolean;
  isPackaging: boolean;
  labelTracked: boolean;
  shelfLifeMonths: number | null;
  qcGroup: 'PRODUCT' | 'PACKAGING';
  coaRequired: boolean;
};

export type QcResult = 'PASS' | 'FAIL' | 'NOT_APPLICABLE';

export type QcCheck = {
  id: string;
  name: string;
  description: string | null;
  appliesTo: 'PRODUCT' | 'PACKAGING' | 'ALL';
  position: number;
  isActive: boolean;
};

export type QcReason = { id: string; name: string; position: number; isActive: boolean };

export type CoaRule = 'PRODUCTS' | 'ALL' | 'NONE';

export const COA_RULES: { value: CoaRule; label: string; hint: string }[] = [
  { value: 'PRODUCTS', label: 'Product batches', hint: 'Finished products and raw materials need a COA. Packaging does not.' },
  { value: 'ALL', label: 'Every batch', hint: 'Nothing can be accepted without a COA, packaging included.' },
  { value: 'NONE', label: 'Optional', hint: 'Staff can attach a COA, but QC can be finished without one.' },
];

export const QC_APPLIES_TO: { value: QcCheck['appliesTo']; label: string }[] = [
  { value: 'PRODUCT', label: 'Bottles & products' },
  { value: 'PACKAGING', label: 'Packaging' },
  { value: 'ALL', label: 'Everything' },
];

export type QcInspectionSummary = {
  id: string;
  inspectionNumber: string;
  status: 'COMPLETED' | 'VOIDED';
  quantityInspected: string;
  quantityAccepted: string;
  quantityRejected: string;
  rejectReason: string | null;
  inspectedAt: string;
  rejectedLotId: string | null;
};

export type ReceiptLot = {
  id: string;
  itemId: string;
  receiveLineId: string | null;
  batchNo: string | null;
  mfgDate: string | null;
  expiryDate: string | null;
  artworkVersion: string | null;
  status: LotStatus;
  quantityReceived: string;
  quantityRemaining: string;
  unitCost: string;
  splitFromLotId: string | null;
  coaAttachmentId: string | null;
  needsLabelling: boolean;
  labelledAt: string | null;
  item: { id: string; name: string; sku: string | null; unit: string; itemCategory: string };
  inspections: QcInspectionSummary[];
  creditLines: {
    quantity: string;
    credit: { id: string; creditNumber: string; status: string; replacementRequested: boolean };
  }[];
};

export type QcSummary = { pending: number; accepted: number; rejected: number; rejectedLeft: number; batches: number; toLabel: number; state: 'PENDING' | 'DONE' | 'NONE' };

export const needsLabel = (lot: { status: string; needsLabelling?: boolean; labelledAt?: string | null }) =>
  lot.status === 'AVAILABLE' && !!lot.needsLabelling && !lot.labelledAt;

export function addMonthsIso(iso: string, months: number | null) {
  if (!iso || !months) return '';
  const [y, m, d] = iso.split('-').map(Number);
  if (!y || !m || !d) return '';
  const target = new Date(Date.UTC(y, m - 1 + months, 1));
  const last = new Date(Date.UTC(target.getUTCFullYear(), target.getUTCMonth() + 1, 0)).getUTCDate();
  target.setUTCDate(Math.min(d, last));
  return target.toISOString().slice(0, 10);
}

export const fmtQty = (value: string | number) => {
  const n = Number(value);
  return Number.isInteger(n) ? String(n) : n.toFixed(2);
};
