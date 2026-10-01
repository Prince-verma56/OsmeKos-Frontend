export const REPLACEMENT_REASONS = [
  { value: 'LOST_IN_TRANSIT', label: 'Lost in transit' },
  { value: 'RETURNED_TO_ORIGIN', label: 'Returned to us (RTO)' },
  { value: 'DELIVERY_FAILED', label: 'Delivery failed' },
  { value: 'DAMAGED_IN_TRANSIT', label: 'Damaged in transit' },
  { value: 'OTHER', label: 'Other' },
] as const;

export const reasonLabel = (value?: string | null) =>
  REPLACEMENT_REASONS.find((r) => r.value === value)?.label ?? 'Other';

type Replaceable = {
  orderNumber: string;
  orderType: string;
  isDraft: boolean;
  orderStatus: string;
  fulfillmentStatus: string;
  deliveryStatus: string;
};

export function whyNotReplaceable(o: Replaceable): string | null {
  const n = o.orderNumber;
  if (o.orderType !== 'D2C') {
    return `${n} is a B2B order. Replacements are for D2C parcels - for a B2B customer raise a new order or a credit note.`;
  }
  if (o.isDraft) return `${n} is still a draft, so nothing was sent to replace.`;
  if (o.orderStatus === 'CANCELLED') return `${n} was cancelled, so nothing was sent to replace.`;
  if (o.fulfillmentStatus === 'UNFULFILLED') {
    return `Nothing on ${n} has shipped yet. Ship it instead of sending a replacement.`;
  }
  if (o.deliveryStatus === 'DELIVERED') {
    return `${n} was delivered. If something arrived damaged or wrong, raise a return against it instead.`;
  }
  return null;
}
