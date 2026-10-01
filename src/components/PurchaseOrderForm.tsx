'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { api, money, errorMessage, shortDate, type Paged, todayIso } from '@/lib/api';
import { priceAs, switchRate, type RateMemo } from '@/lib/items';
import { useSaveNav, SaveStalled } from '@/lib/useSaveNav';
import { RoundOffRow } from '@/components/RoundOffRow';
import { resolveRoundOff, type RoundOffMode } from '@/lib/roundOff';
import { taxBreakdown } from '@/lib/taxBreakdown';
import { PaymentTermSelect, useDefaultPaymentTerm } from './PaymentTermSelect';
import { useDefaultTerms } from '@/lib/documentTerms';
import { INDIAN_STATES, stateLabel, stateCodeFromGstin } from '@/lib/states';
import { FileUpload, type Uploaded } from '@/components/FileUpload';
import { AccountSelect } from '@/components/AccountSelect';
import { TaxWithholdingRow, type WithholdingKind } from '@/components/TaxWithholding';
import { VendorAddressModal, type VendorAddress } from '@/components/VendorAddressModal';
import {
  Button, Card, EmptyRow, ErrorBox, Field, Input, PageHeader,
  Select, Table, Td, Textarea, Th, Spinner, Badge,
} from '@/components/ui';
import { ItemSelect } from './ItemSelect';
import { Thumb } from './SearchSelect';
import { VendorSelect } from './VendorSelect';
import { ComboSelect } from './ComboSelect';
import { SaveBar } from './form/SaveBar';
import { PageCrumb } from '@/lib/crumbs';

type Address = {
  id: string;
  line1: string; line2?: string | null; landmark?: string | null;
  city: string; state: string; stateCode?: string | null; pincode: string; country: string;
  type: 'BILLING' | 'SHIPPING' | 'OTHER';
  isDefaultShipping?: boolean;
};

type Vendor = {
  id: string;
  displayName: string;
  companyName?: string | null;
  email?: string | null;
  paymentTerms?: string;
  gstin?: string | null;
  gstTreatment?: string | null;
  sourceOfSupplyState?: string | null;
  sourceOfSupplyCode?: string | null;
};

type Location = {
  id: string; name: string; code: string; isDefault: boolean;
  addressLine1?: string | null; addressLine2?: string | null;
  city?: string | null; state?: string | null; stateCode?: string | null;
  pincode?: string | null; country?: string | null;
};

type Customer = {
  id: string; firstName: string | null; lastName: string | null;
  email: string | null; phone: string | null;
};

type Item = {
  id: string; name: string; sku: string | null; unit: string;
  costPrice: string | null; purchaseAccount: string | null; costTaxTreatment?: string | null;
  intraStateTaxRate: string | null; interStateTaxRate: string | null;
  imageUrls?: string[];
};

type TaxRate = {
  id: string; name: string; rate: string;
  type: 'GST' | 'IGST' | 'CESS' | 'TDS' | 'TCS'; isDefault: boolean; isActive: boolean;
};

type Organization = {
  legalName?: string | null;
  roundOffMode?: RoundOffMode;
};

const MAX_ATTACHMENTS = 10;

export type ExistingPurchaseOrder = {
  id: string;
  poNumber: string;
  vendorId: string;
  locationId: string;
  deliveryTarget: 'LOCATION' | 'CUSTOMER';
  deliveryLocationId: string | null;
  deliveryCustomerId: string | null;
  sourceOfSupplyCode: string | null;
  destinationOfSupplyCode: string | null;
  referenceNumber: string | null;
  poDate: string;
  expectedDeliveryDate: string | null;
  paymentTerms: string;
  shipmentPreference: string | null;
  isReverseCharge: boolean;
  taxTreatment: 'EXCLUSIVE' | 'INCLUSIVE';
  discountLevel: 'TRANSACTION' | 'LINE_ITEM';
  discountPercent: string | null;
  taxWithholdingType: 'TDS' | 'TCS' | null;
  taxWithholdingTaxId?: string | null;
  shippingCharge: string;
  adjustment: string;
  adjustmentLabel: string | null;
  roundOff?: string;
  roundOffManual?: boolean;
  customerNotes: string | null;
  termsConditions: string | null;
  lines: {
    itemId: string;
    description: string | null;
    account: string | null;
    quantity: string;
    rate: string;
    discountPercent: string | null;
    taxRate: string;
  }[];
};

type LineDraft = {
  itemId: string;
  description: string;
  account: string;
  quantity: string;
  rate: string;
  discountPercent: string;
  taxRateId: string;
  seededTaxPercent?: number;
  rateMemo?: RateMemo;
};

const blankLine = (): LineDraft => ({
  itemId: '', description: '', account: '',
  quantity: '1', rate: '', discountPercent: '', taxRateId: '',
});

function addressLines(a?: Address | Location | null): string[] {
  if (!a) return [];
  const isVendorAddress = 'line1' in a;
  const line1 = isVendorAddress ? a.line1 : a.addressLine1;
  const line2 = isVendorAddress ? a.line2 : a.addressLine2;
  return [
    line1, line2,
    [a.city, a.state].filter(Boolean).join(', '),
    [a.country ?? 'India', a.pincode].filter(Boolean).join(' , '),
  ].filter(Boolean) as string[];
}

export type PurchaseOrderFormProps = {
  mode?: 'create' | 'edit';
  existing?: ExistingPurchaseOrder | null;
};

export function PurchaseOrderForm({ mode = 'create', existing = null }: PurchaseOrderFormProps) {
  const params = useSearchParams();
  const isEdit = mode === 'edit';

  const [vendors, setVendors] = useState<Vendor[]>([]);
  const [locations, setLocations] = useState<Location[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [items, setItems] = useState<Item[]>([]);
  const [taxRates, setTaxRates] = useState<TaxRate[]>([]);
  const [org, setOrg] = useState<Organization | null>(null);
  const [vendorDetail, setVendorDetail] = useState<(Vendor & { addresses: Address[] }) | null>(null);

  const [attachments, setAttachments] = useState<Uploaded[]>([]);
  const [bulkOpen, setBulkOpen] = useState(false);
  const [bulkPicked, setBulkPicked] = useState<Set<string>>(new Set());
  const [addingAddress, setAddingAddress] = useState(false);
  const [extraAddresses, setExtraAddresses] = useState<VendorAddress[]>([]);

  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const { saving, stalledHref, begin: beginSave, done: doneSave, fail: failSave } =
    useSaveNav();

  const [form, setForm] = useState({
    vendorId: existing?.vendorId ?? params.get('vendorId') ?? '',
    sourceOfSupplyCode: existing?.sourceOfSupplyCode ?? '',
    destinationOfSupplyCode: existing?.destinationOfSupplyCode ?? '',
    locationId: existing?.locationId ?? '',
    deliveryTarget: (existing?.deliveryTarget ?? 'LOCATION') as 'LOCATION' | 'CUSTOMER',
    deliveryLocationId: existing?.deliveryLocationId ?? existing?.locationId ?? '',
    deliveryCustomerId: existing?.deliveryCustomerId ?? '',
    poNumber: existing?.poNumber ?? '',
    referenceNumber: existing?.referenceNumber ?? '',
    poDate: existing?.poDate.slice(0, 10) ?? todayIso(),
    expectedDeliveryDate: existing?.expectedDeliveryDate?.slice(0, 10) ?? '',
    paymentTerms: existing?.paymentTerms ?? 'DUE_ON_RECEIPT',
    shipmentPreference: existing?.shipmentPreference ?? '',
    isReverseCharge: existing?.isReverseCharge ?? false,
    taxTreatment: (existing?.taxTreatment ?? 'EXCLUSIVE') as 'EXCLUSIVE' | 'INCLUSIVE',
    discountLevel: (existing?.discountLevel ?? 'TRANSACTION') as 'TRANSACTION' | 'LINE_ITEM',
    discountPercent: existing?.discountPercent ? String(Number(existing.discountPercent)) : '0',
    taxWithholdingType: (existing?.taxWithholdingType ?? '') as WithholdingKind,
    taxWithholdingTaxId: existing?.taxWithholdingTaxId ?? '',
    shippingCharge: existing ? String(Number(existing.shippingCharge)) : '0',
    adjustment: existing ? String(Number(existing.adjustment)) : '0',
    adjustmentLabel: existing?.adjustmentLabel ?? 'Adjustment',
    roundOff: existing?.roundOffManual ? String(Number(existing.roundOff ?? 0)) : '',
    customerNotes: existing?.customerNotes ?? '',
    termsConditions: existing?.termsConditions ?? '',
  });
  const set = (patch: Partial<typeof form>) => setForm((f) => ({ ...f, ...patch }));
  useDefaultPaymentTerm(
    (code) => setForm((f) => (!f.vendorId && f.paymentTerms === 'DUE_ON_RECEIPT' ? { ...f, paymentTerms: code } : f)),
    !isEdit
  );
  useDefaultTerms('purchase_order', !isEdit, (terms) =>
    setForm((f) => (f.termsConditions ? f : { ...f, termsConditions: terms }))
  );

  const [lines, setLines] = useState<LineDraft[]>(() =>
    existing?.lines.length
      ? existing.lines.map((l) => ({
          itemId: l.itemId,
          description: l.description ?? '',
          account: l.account ?? '',
          quantity: String(Number(l.quantity)),
          rate: String(Number(l.rate)),
          discountPercent: l.discountPercent ? String(Number(l.discountPercent)) : '',
          taxRateId: '',
          seededTaxPercent: Number(l.taxRate),
        }))
      : [blankLine()]
  );

  useEffect(() => {
    (async () => {
      try {
        const [v, l, i, tr, n, c, o] = await Promise.all([
          api.get<Paged<Vendor>>('/vendors', { limit: 100 }),
          api.get<Paged<Location>>('/locations', { limit: 50 }),
          api.get<Paged<Item>>('/items', { limit: 100 }),
          api.get<{ data: TaxRate[] }>('/sales/tax-rates'),
          existing
            ? Promise.resolve(null)
            : api
                .get<{ data: { poNumber?: string; docNumber?: string } }>('/purchase-orders/next-number')
                .catch(() => null),
          api.get<Paged<Customer>>('/customers', { limit: 100 }).catch(() => ({ data: [] as Customer[] })),
          api.get<{ data: Organization }>('/organization').catch(() => null),
        ]);

        setVendors(v.data);
        setLocations(l.data);
        setItems(i.data);
        setTaxRates(tr.data.filter((t) => t.isActive));
        setCustomers(c.data);
        setOrg(o?.data ?? null);

        const defaultLocation = l.data.find((x) => x.isDefault) ?? l.data[0];
        setForm((f) => ({
          ...f,
          poNumber: existing?.poNumber ?? n?.data.poNumber ?? n?.data.docNumber ?? '',
          locationId: f.locationId || existing?.locationId || (defaultLocation?.id ?? ''),
          deliveryLocationId: f.deliveryLocationId || (defaultLocation?.id ?? ''),
          destinationOfSupplyCode: f.destinationOfSupplyCode || (defaultLocation?.stateCode ?? ''),
        }));
      } catch (err) {
        setError(errorMessage(err));
      }
    })();
  }, [existing]);

  const [advances, setAdvances] = useState<
    { id: string; paymentNumber: string; paymentDate: string; unapplied: number; purchaseOrderId?: string | null }[]
  >([]);
  const [useAdvance, setUseAdvance] = useState<Record<string, boolean>>({});

  useEffect(() => {
    let cancelled = false;
    if (!form.vendorId) {
      const clear = setTimeout(() => setAdvances([]), 0);
      return () => {
        cancelled = true;
        clearTimeout(clear);
      };
    }
    api
      .get<{
        data: { id: string; paymentNumber: string; paymentDate: string; unapplied: number; purchaseOrderId?: string | null }[];
      }>('/bills/payments', { vendorId: form.vendorId, view: 'unapplied', limit: 100 })
      .then((r) => {
        if (!cancelled) setAdvances(r.data.filter((a) => Number(a.unapplied) > 0));
      })
      .catch(() => {
        if (!cancelled) setAdvances([]);
      });
    return () => {
      cancelled = true;
    };
  }, [form.vendorId]);

  useEffect(() => {
    if (!form.vendorId) return;
    let cancelled = false;
    api
      .get<{ data: Vendor & { addresses: Address[] } }>(`/vendors/${form.vendorId}`)
      .then((r) => {
        if (cancelled) return;
        setVendorDetail(r.data);
        const code = r.data.sourceOfSupplyCode ?? stateCodeFromGstin(r.data.gstin);
        setForm((f) => ({
          ...f,
          sourceOfSupplyCode: code ?? f.sourceOfSupplyCode,
          ...(!isEdit && r.data.paymentTerms ? { paymentTerms: r.data.paymentTerms } : {}),
        }));
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [form.vendorId, isEdit]);

  const vendor = vendorDetail?.id === form.vendorId ? vendorDetail : null;
  const advanceTotal = advances.reduce((n, a) => n + Number(a.unapplied), 0);
  const advanceChosen = advances
    .filter((a) => useAdvance[a.id])
    .reduce((n, a) => n + Number(a.unapplied), 0);

  const pickLocation = (locationId: string) =>
    set({
      locationId,
      deliveryLocationId: locationId,
      destinationOfSupplyCode:
        locations.find((l) => l.id === locationId)?.stateCode ?? form.destinationOfSupplyCode,
    });

  const intraState =
    !!form.sourceOfSupplyCode &&
    !!form.destinationOfSupplyCode &&
    form.sourceOfSupplyCode === form.destinationOfSupplyCode;
  const taxFamily: 'GST' | 'IGST' = intraState ? 'GST' : 'IGST';

  const slabs = useMemo(
    () => taxRates.filter((t) => t.type === taxFamily),
    [taxRates, taxFamily]
  );
  const otherSlabs = useMemo(
    () => taxRates.filter((t) => t.type !== taxFamily && t.type !== 'TDS' && t.type !== 'TCS'),
    [taxRates, taxFamily]
  );

  const defaultSlab =
    slabs.find((t) => t.isDefault) ?? slabs.find((t) => Number(t.rate) === 18) ?? slabs[0] ?? null;
  const defaultSlabId = defaultSlab?.id ?? '';

  const resolveSlab = (l: LineDraft): TaxRate | null => {
    const chosen =
      taxRates.find((t) => t.id === l.taxRateId) ??
      (l.seededTaxPercent != null
        ? (slabs.find((t) => Number(t.rate) === l.seededTaxPercent) ??
           taxRates.find((t) => Number(t.rate) === l.seededTaxPercent) ??
           null)
        : null);
    if (chosen?.type === taxFamily) return chosen;
    if (chosen) {
      const sameRate = slabs.find((t) => Number(t.rate) === Number(chosen.rate));
      if (sameRate) return sameRate;
    }
    return chosen && chosen.type !== 'GST' && chosen.type !== 'IGST' ? chosen : defaultSlab;
  };

  const pctOf = (l: LineDraft) => Number(resolveSlab(l)?.rate ?? 0);

  function changeTaxTreatment(next: 'EXCLUSIVE' | 'INCLUSIVE') {
    const from = form.taxTreatment;
    setLines((rows) => rows.map((l) => ({ ...l, ...switchRate(l.rate, l.rateMemo, from, next, pctOf(l)) })));
    set({ taxTreatment: next });
  }

  function setLine(i: number, patch: Partial<LineDraft>) {
    setLines((rows) => rows.map((r, idx) => (idx === i ? { ...r, ...patch } : r)));
  }

  function applyItem(row: LineDraft, itemId: string): LineDraft {
    const it = items.find((x) => x.id === itemId);
    if (!it) return { ...row, itemId };

    const itemRate = intraState ? it.intraStateTaxRate : it.interStateTaxRate;
    const matched = itemRate != null ? slabs.find((s) => Number(s.rate) === Number(itemRate)) : null;

    const taxRateId =
      (matched ?? slabs.find((s) => s.id === row.taxRateId))?.id ?? (row.taxRateId || defaultSlabId);
    return {
      ...row,
      itemId,
      description: it.name,
      rate: it.costPrice
        ? String(priceAs(it.costPrice, it.costTaxTreatment, form.taxTreatment, pctOf({ ...row, taxRateId })))
        : row.rate,
      account: it.purchaseAccount || row.account,
      taxRateId,
    };
  }

  const addRow = () => setLines((rows) => [...rows, { ...blankLine(), taxRateId: defaultSlabId }]);

  function addBulk() {
    const picked = items.filter((it) => bulkPicked.has(it.id));
    if (!picked.length) return;
    setLines((rows) => {
      const base = rows.length === 1 && !rows[0].itemId ? [] : rows;
      return [...base, ...picked.map((it) => applyItem({ ...blankLine(), taxRateId: defaultSlabId }, it.id))];
    });
    setBulkPicked(new Set());
    setBulkOpen(false);
  }

  const perLineDiscount = form.discountLevel === 'LINE_ITEM';
  const inclusive = form.taxTreatment === 'INCLUSIVE';

  const lineTaxable = (l: LineDraft) => {
    const gross = Number(l.quantity || 0) * Number(l.rate || 0);
    const taxable = inclusive ? gross / (1 + pctOf(l) / 100) : gross;
    const disc = perLineDiscount ? (taxable * Number(l.discountPercent || 0)) / 100 : 0;
    return taxable - disc;
  };

  const subTotal = lines.reduce((n, l) => n + lineTaxable(l), 0);
  const headerDiscount = perLineDiscount ? 0 : (subTotal * Number(form.discountPercent || 0)) / 100;
  const netSubtotal = subTotal - headerDiscount;
  const taxTotal = lines.reduce((n, l) => {
    const share = subTotal === 0 ? 0 : (headerDiscount * lineTaxable(l)) / subTotal;
    return n + (lineTaxable(l) - share) * (pctOf(l) / 100);
  }, 0);

  const totalQuantity = lines.reduce((n, l) => n + Number(l.quantity || 0), 0);

  const taxRows = taxBreakdown(lines, {
    taxableOf: lineTaxable,
    slabOf: resolveSlab,
    subTotal,
    headerDiscount,
    intraState,
  });

  const withholdingRate = Number(
    taxRates.find((t) => t.id === form.taxWithholdingTaxId)?.rate ?? 0
  );
  const withholdingAmount = form.taxWithholdingType ? (netSubtotal * withholdingRate) / 100 : 0;

  const beforeRounding =
    netSubtotal +
    taxTotal +
    Number(form.shippingCharge || 0) +
    Number(form.adjustment || 0) +
    (form.taxWithholdingType === 'TCS' ? withholdingAmount : 0) -
    (form.taxWithholdingType === 'TDS' ? withholdingAmount : 0);
  const roundOffMode = org?.roundOffMode ?? 'NEAREST_1';
  const rounding = resolveRoundOff(beforeRounding, form.roundOff, roundOffMode);
  const grandTotal = beforeRounding + rounding.value;

  const lineAmount = (l: LineDraft) =>
    inclusive ? Number(l.quantity || 0) * Number(l.rate || 0) : lineTaxable(l) * (1 + pctOf(l) / 100);

  async function submit(status: 'DRAFT' | 'ISSUED', andSend = false) {
    if (isEdit) return saveEdit();
    setError('');
    setNotice('');

    const payloadLines = lines
      .filter((l) => l.itemId && l.quantity !== '' && l.rate !== '')
      .map((l) => ({
        itemId: l.itemId,
        description: l.description.trim() || undefined,
        quantity: Number(l.quantity),
        rate: Number(l.rate),
        account: l.account || undefined,
        discountPercent:
          perLineDiscount && l.discountPercent !== '' ? Number(l.discountPercent) : undefined,
        taxRate: pctOf(l),
      }));

    if (!form.vendorId) return setError('Pick a vendor');
    if (!payloadLines.length) {
      return setError('Add at least one line with an item, quantity and rate');
    }
    if (form.taxWithholdingType && !form.taxWithholdingTaxId) {
      return setError(`Pick which ${form.taxWithholdingType} tax applies`);
    }
    if (form.deliveryTarget === 'CUSTOMER' && !form.deliveryCustomerId) {
      return setError('Pick the customer this order ships to');
    }
    if (Math.abs(rounding.value) > 1) return setError('Round off must be between -1 and 1');

    beginSave();
    try {
      const res = await api.post<{ data: { id: string; poNumber: string } }>('/purchase-orders', {
        vendorId: form.vendorId,
        locationId: form.locationId,
        deliveryTarget: form.deliveryTarget,
        deliveryLocationId:
          form.deliveryTarget === 'LOCATION' ? form.deliveryLocationId || undefined : undefined,
        deliveryCustomerId:
          form.deliveryTarget === 'CUSTOMER' ? form.deliveryCustomerId || undefined : undefined,
        sourceOfSupplyCode: form.sourceOfSupplyCode || undefined,
        destinationOfSupplyCode: form.destinationOfSupplyCode || undefined,
        referenceNumber: form.referenceNumber.trim() || undefined,
        poDate: form.poDate,
        expectedDeliveryDate: form.expectedDeliveryDate || undefined,
        paymentTerms: form.paymentTerms,
        shipmentPreference: form.shipmentPreference.trim() || undefined,
        isReverseCharge: form.isReverseCharge,
        taxTreatment: form.taxTreatment,
        discountLevel: form.discountLevel,
        discountPercent: perLineDiscount ? undefined : Number(form.discountPercent || 0),
        taxWithholdingType: form.taxWithholdingType || null,
        taxWithholdingTaxId: form.taxWithholdingTaxId || null,
        shippingCharge: Number(form.shippingCharge || 0),
        adjustment: Number(form.adjustment || 0),
        adjustmentLabel: form.adjustmentLabel.trim() || undefined,
        roundOff: rounding.payload,
        customerNotes: form.customerNotes.trim() || undefined,
        termsConditions: form.termsConditions.trim() || undefined,
        status,
        lines: payloadLines,
      });

      const poId = res.data.id;

      for (const f of attachments) {
        await api
          .post('/shared/attachments', {
            ownerType: 'PURCHASE_ORDER',
            ownerId: poId,
            fileName: f.fileName,
            fileUrl: f.url,
            mimeType: f.mimeType,
            sizeBytes: f.sizeBytes,
          })
          .catch(() => {});
      }

      const chosen = advances.filter((a) => useAdvance[a.id]);
      for (const advance of chosen) {
        await api
          .patch(`/bills/payments/${advance.id}`, { purchaseOrderId: poId })
          .catch((err) => {
            setError(`The order was saved, but ${advance.paymentNumber} could not be put on it: ${errorMessage(err)}`);
          });
      }

      if (andSend) {
        const to = vendor?.email ?? null;
        if (to) {
          await api
            .post('/emails', {
              ownerType: 'PURCHASE_ORDER',
              ownerId: poId,
              to,
              subject: `Purchase Order ${res.data.poNumber} from ${org?.legalName ?? 'OsmeKos'}`,
              body:
                `Dear ${vendor?.displayName ?? 'Supplier'},\n\n` +
                `Please find our purchase order ${res.data.poNumber} dated ${form.poDate} ` +
                `for a total of Rs.${grandTotal.toFixed(2)}.\n\n` +
                `${form.customerNotes}\n\nRegards,\n${org?.legalName ?? 'OsmeKos'}`,
              template: 'po_notification',
            })
            .catch(() => {});
        }
      }

      doneSave(`/purchase-orders/${poId}`);
    } catch (err) {
      setError(errorMessage(err));
      failSave();
    }
  }

  async function saveEdit() {
    setError('');
    setNotice('');

    const payloadLines = lines
      .filter((l) => l.itemId && l.quantity !== '' && l.rate !== '')
      .map((l) => ({
        itemId: l.itemId,
        description: l.description.trim() || undefined,
        quantity: Number(l.quantity),
        rate: Number(l.rate),
        account: l.account || undefined,
        discountPercent:
          perLineDiscount && l.discountPercent !== '' ? Number(l.discountPercent) : undefined,
        taxRate: pctOf(l),
      }));

    if (!payloadLines.length) {
      return setError('Add at least one line with an item, quantity and rate');
    }
    if (Math.abs(rounding.value) > 1) return setError('Round off must be between -1 and 1');

    beginSave();
    try {
      await api.patch(`/purchase-orders/${existing!.id}`, {
        vendorId: form.vendorId,
        locationId: form.locationId,
        deliveryTarget: form.deliveryTarget,
        deliveryLocationId:
          form.deliveryTarget === 'LOCATION' ? form.deliveryLocationId || undefined : undefined,
        deliveryCustomerId:
          form.deliveryTarget === 'CUSTOMER' ? form.deliveryCustomerId || undefined : undefined,
        sourceOfSupplyCode: form.sourceOfSupplyCode || undefined,
        destinationOfSupplyCode: form.destinationOfSupplyCode || undefined,
        referenceNumber: form.referenceNumber.trim() || undefined,
        poDate: form.poDate,
        expectedDeliveryDate: form.expectedDeliveryDate || undefined,
        paymentTerms: form.paymentTerms,
        shipmentPreference: form.shipmentPreference.trim() || undefined,
        isReverseCharge: form.isReverseCharge,
        taxTreatment: form.taxTreatment,
        discountLevel: form.discountLevel,
        discountPercent: perLineDiscount ? undefined : Number(form.discountPercent || 0),
        taxWithholdingType: form.taxWithholdingType || null,
        taxWithholdingTaxId: form.taxWithholdingTaxId || null,
        shippingCharge: Number(form.shippingCharge || 0),
        adjustment: Number(form.adjustment || 0),
        adjustmentLabel: form.adjustmentLabel.trim() || undefined,
        roundOff: rounding.payload,
        customerNotes: form.customerNotes.trim() || undefined,
        termsConditions: form.termsConditions.trim() || undefined,
        lines: payloadLines,
      });
      doneSave(`/purchase-orders/${existing!.id}`);
    } catch (err) {
      setError(errorMessage(err));
      failSave();
    }
  }

  const deliveryLocation = locations.find((l) => l.id === form.deliveryLocationId) ?? null;
  const vendorAddresses = [...extraAddresses, ...(vendor?.addresses ?? [])];
  const billing =
    vendorAddresses.find((a) => a.type === 'BILLING') ?? vendorAddresses[0] ?? null;
  const shipping = vendorAddresses.find((a) => a.type === 'SHIPPING') ?? null;

  const label = 'mb-1 block text-xs font-medium text-muted-foreground';

  return (
    <>
      <PageCrumb label={isEdit ? `Edit ${existing!.poNumber}` : 'New purchase order'} />

      <PageHeader title={isEdit ? `Edit ${existing!.poNumber}` : 'New Purchase Order'} />

      <SaveStalled href={stalledHref} />

      {error && <div className="mb-4"><ErrorBox message={error} /></div>}
      {notice && (
        <p className="mb-4 rounded-md border border-gold/30 bg-gold-soft/60 px-3 py-2 text-sm text-foreground">
          {notice}
        </p>
      )}

      <div className="space-y-5">
        <Card>
          <div className="grid gap-4 lg:grid-cols-2">
            <div className="space-y-4">
              <div>
                <span className={label}>
                  Vendor Name <span className="text-destructive">*</span>
                </span>
                <VendorSelect
                  value={form.vendorId}
                  vendors={vendors}
                  onChange={(vendorId, picked) => {
                    if (picked && !vendors.some((v) => v.id === picked.id)) setVendors((vs) => [...vs, picked]);
                    set({ vendorId });
                  }}
                />

                {!isEdit && advanceTotal > 0 && (
                  <div className="mt-3 rounded-md border border-success/30 bg-success/10 p-3">
                    <p className="text-sm font-medium text-foreground">
                      This vendor is holding {money(advanceTotal)} of yours
                    </p>
                    <p className="mb-2 text-xs text-muted-foreground">
                      Tick what belongs to this order. It waits here and goes against the bill when that bill is
                      raised - only as much as the bill needs, and the rest stays with the vendor for next time.
                    </p>
                    <ul className="space-y-1">
                      {advances.map((a) => (
                        <li key={a.id}>
                          <label className="flex cursor-pointer items-center justify-between gap-3 text-sm">
                            <span className="flex items-center gap-2">
                              <input
                                type="checkbox"
                                checked={!!useAdvance[a.id]}
                                onChange={(e) => setUseAdvance((u) => ({ ...u, [a.id]: e.target.checked }))}
                                className="h-4 w-4 rounded border-border"
                              />
                              <span className="font-mono text-xs">{a.paymentNumber}</span>
                              <span className="text-xs text-muted-foreground">
                                paid {shortDate(a.paymentDate)}
                                {a.purchaseOrderId ? ' · left over from another order' : ''}
                              </span>
                            </span>
                            <span className="tabular-nums">{money(a.unapplied)}</span>
                          </label>
                        </li>
                      ))}
                    </ul>
                    {advanceChosen > 0 && (
                      <p className="mt-2 text-xs text-success">
                        {money(advanceChosen)} will sit on this order
                        {grandTotal > 0 && advanceChosen >= grandTotal
                          ? ' - enough to cover the whole order'
                          : grandTotal > 0
                            ? ` - ${money(grandTotal - advanceChosen)} of the order would still be to pay`
                            : ''}
                      </p>
                    )}
                  </div>
                )}

                {vendor && (
                  <div className="mt-3 grid gap-4 rounded-md border border-border bg-muted/60 p-3 text-xs sm:grid-cols-2">
                    <div>
                      <div className="mb-1 font-medium text-muted-foreground">
                        BILLING ADDRESS
                      </div>
                      {billing ? (
                        addressLines(billing).map((l, i) => (
                          <div key={i} className="text-foreground">{l}</div>
                        ))
                      ) : (
                        <div className="text-muted-foreground">No billing address on file</div>
                      )}
                    </div>
                    <div>
                      <div className="mb-1 flex items-center gap-2">
                        <span className="font-medium text-muted-foreground">
                          SHIPPING ADDRESS
                        </span>
                        <button
                          type="button"
                          onClick={() => setAddingAddress(true)}
                          className="text-gold-ink hover:underline"
                        >
                          New Address
                        </button>
                      </div>
                      {shipping ? (
                        addressLines(shipping).map((l, i) => (
                          <div key={i} className="text-foreground">{l}</div>
                        ))
                      ) : (
                        <div className="text-muted-foreground">Same as billing</div>
                      )}
                    </div>
                    <div className="sm:col-span-2">
                      <span className="text-muted-foreground">GST Treatment: </span>
                      <span className="text-foreground">
                        {(vendor.gstTreatment ?? '—').replaceAll('_', ' ')}
                      </span>
                      {vendor.gstin && (
                        <>
                          <span className="mx-2 text-muted-foreground/60">·</span>
                          <span className="text-muted-foreground">GSTIN: </span>
                          <span className="font-mono text-foreground">
                            {vendor.gstin}
                          </span>
                        </>
                      )}
                    </div>
                  </div>
                )}
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <span className={label}>
                    Source of Supply <span className="text-destructive">*</span>
                  </span>
                  <Select
                    value={form.sourceOfSupplyCode}
                    onChange={(e) => set({ sourceOfSupplyCode: e.target.value })}
                    className="w-full"
                  >
                    <option value="">Select</option>
                    {INDIAN_STATES.map((s) => (
                      <option key={s.code} value={s.code}>{stateLabel(s.code)}</option>
                    ))}
                  </Select>
                </div>
                <div>
                  <span className={label}>
                    Destination of Supply <span className="text-destructive">*</span>
                  </span>
                  <Select
                    value={form.destinationOfSupplyCode}
                    onChange={(e) => set({ destinationOfSupplyCode: e.target.value })}
                    className="w-full"
                  >
                    <option value="">Select</option>
                    {INDIAN_STATES.map((s) => (
                      <option key={s.code} value={s.code}>{stateLabel(s.code)}</option>
                    ))}
                  </Select>
                </div>
              </div>

              <Field label="Location" hint="The warehouse the stock is booked against">
                <Select
                  value={form.locationId}
                  onChange={(e) => pickLocation(e.target.value)}
                  className="w-full"
                >
                  {locations.map((l) => (
                    <option key={l.id} value={l.id}>
                      {l.name}{l.isDefault ? ' (default)' : ''}
                    </option>
                  ))}
                </Select>
              </Field>

              <div>
                <span className={label}>
                  Delivery Address <span className="text-destructive">*</span>
                </span>
                <div className="mb-2 flex gap-4 text-sm">
                  {(['LOCATION', 'CUSTOMER'] as const).map((t) => (
                    <label key={t} className="flex items-center gap-1.5">
                      <input
                        type="radio"
                        name="deliveryTarget"
                        checked={form.deliveryTarget === t}
                        onChange={() => set({ deliveryTarget: t })}
                      />
                      <span className="text-foreground">
                        {t === 'LOCATION' ? 'Locations' : 'Customer'}
                      </span>
                    </label>
                  ))}
                </div>

                {form.deliveryTarget === 'LOCATION' ? (
                  <>
                    <Select
                      value={form.deliveryLocationId}
                      onChange={(e) => set({ deliveryLocationId: e.target.value })}
                      className="w-full"
                    >
                      {locations.map((l) => (
                        <option key={l.id} value={l.id}>{l.name}</option>
                      ))}
                    </Select>
                    {deliveryLocation && (
                      <div className="mt-2 rounded-md border border-border p-2.5 text-xs">
                        <div className="font-medium text-foreground">
                          {deliveryLocation.name}
                        </div>
                        {addressLines(deliveryLocation).map((l, i) => (
                          <div key={i} className="text-muted-foreground">{l}</div>
                        ))}
                      </div>
                    )}
                  </>
                ) : (
                  <>
                    <Select
                      value={form.deliveryCustomerId}
                      onChange={(e) => set({ deliveryCustomerId: e.target.value })}
                      className="w-full"
                    >
                      <option value="">Select a customer…</option>
                      {customers.map((c) => (
                        <option key={c.id} value={c.id}>
                          {[c.firstName, c.lastName].filter(Boolean).join(' ') || c.phone || c.email}
                        </option>
                      ))}
                    </Select>
                    <p className="mt-1.5 text-xs text-muted-foreground">
                      Drop-ship: the vendor delivers straight to this customer, so nothing lands in
                      a warehouse.
                    </p>
                  </>
                )}
              </div>
            </div>

            <div className="space-y-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <Field
                  label="Purchase Order#"
                  required
                  hint={isEdit ? 'Numbers are not reassigned' : 'Reserved for this order'}
                >
                  <Input value={form.poNumber} readOnly className="font-mono" />
                </Field>
                <Field label="Reference#">
                  <Input
                    value={form.referenceNumber}
                    onChange={(e) => set({ referenceNumber: e.target.value })}
                  />
                </Field>
                <Field label="Date">
                  <Input
                    type="date"
                    value={form.poDate}
                    onChange={(e) => set({ poDate: e.target.value })}
                  />
                </Field>
                <Field label="Delivery Date">
                  <Input
                    type="date"
                    value={form.expectedDeliveryDate}
                    onChange={(e) => set({ expectedDeliveryDate: e.target.value })}
                  />
                </Field>
                <Field label="Payment Terms">
                  <PaymentTermSelect
                    value={form.paymentTerms}
                    onChange={(paymentTerms) => set({ paymentTerms })}
                  />
                </Field>
                <Field label="Shipment Preference">
                  <ComboSelect
                    value={form.shipmentPreference}
                    options={['Road transport', 'Courier', 'Vendor delivers', 'We collect', 'Rail', 'Air']}
                    onChange={(shipmentPreference) => set({ shipmentPreference })}
                    placeholder="Not set"
                    addLabel="+ Something else"
                    newPlaceholder="How it ships"
                  />
                </Field>
              </div>

              <label className="flex items-start gap-2 text-sm">
                <input
                  type="checkbox"
                  className="mt-0.5"
                  checked={form.isReverseCharge}
                  onChange={(e) => set({ isReverseCharge: e.target.checked })}
                />
                <span className="text-foreground">
                  This transaction is applicable for reverse charge
                  <span className="block text-xs text-muted-foreground">
                    GST is paid by us rather than the vendor — usual for an unregistered supplier.
                  </span>
                </span>
              </label>
            </div>
          </div>
        </Card>

        <Card padded={false}>
          <div className="flex flex-wrap items-end gap-4 border-b border-border px-4 py-3">
            <div>
              <span className={label}>Tax treatment</span>
              <Select
                value={form.taxTreatment}
                onChange={(e) => changeTaxTreatment(e.target.value as 'EXCLUSIVE' | 'INCLUSIVE')}
              >
                <option value="EXCLUSIVE">Rates exclude GST</option>
                <option value="INCLUSIVE">Rates include GST</option>
              </Select>
            </div>
            <div>
              <span className={label}>Discount</span>
              <Select
                value={form.discountLevel}
                onChange={(e) =>
                  set({ discountLevel: e.target.value as 'TRANSACTION' | 'LINE_ITEM' })
                }
              >
                <option value="TRANSACTION">On the total</option>
                <option value="LINE_ITEM">On each line</option>
              </Select>
            </div>
            <div className="ml-auto self-center">
              <Badge tone={intraState ? 'green' : 'blue'}>
                {intraState ? 'CGST + SGST' : 'IGST'}
              </Badge>
            </div>
          </div>

          <Table dense minWidth={perLineDiscount ? '900px' : '820px'}>
            <thead>
              <tr>
                <Th>ITEM DETAILS</Th>
                <Th>ACCOUNT</Th>
                <Th className="text-right">QUANTITY</Th>
                <Th className="text-right">PURCHASE PRICE</Th>
                {perLineDiscount && <Th className="text-right">DISCOUNT %</Th>}
                <Th>TAX</Th>
                <Th className="text-right">AMOUNT</Th>
                <Th />
              </tr>
            </thead>
            <tbody>
              {lines.length === 0 && <EmptyRow colSpan={perLineDiscount ? 8 : 7} />}
              {lines.map((l, i) => (
                <tr key={i}>
                  <Td>
                    <ItemSelect
                      value={l.itemId}
                      items={items}
                      onChange={(v) => setLines((r) => r.map((row, idx) => (idx === i ? applyItem(row, v) : row)))}
                      className="w-full min-w-[188px] max-w-[212px]"
                    />
                  </Td>
                  <Td>
                    <AccountSelect
                      value={l.account}
                      onChange={(name) => setLine(i, { account: name })}
                      className="min-w-[138px] max-w-[150px]"
                    />
                  </Td>
                  <Td>
                    <Input
                      type="number" step="0.01" min="0"
                      value={l.quantity}
                      onChange={(e) => setLine(i, { quantity: e.target.value })}
                      className="w-16 text-right"
                    />
                  </Td>
                  <Td>
                    <Input
                      type="number" step="0.01" min="0"
                      value={l.rate}
                      onChange={(e) => setLine(i, { rate: e.target.value })}
                      className="w-24 text-right"
                    />
                  </Td>
                  {perLineDiscount && (
                    <Td>
                      <Input
                        type="number" step="0.01" min="0" max="100"
                        value={l.discountPercent}
                        onChange={(e) => setLine(i, { discountPercent: e.target.value })}
                        className="w-16 text-right"
                      />
                    </Td>
                  )}
                  <Td>
                    <Select
                      value={resolveSlab(l)?.id ?? ''}
                      onChange={(e) => setLine(i, { taxRateId: e.target.value })}
                      className="min-w-[120px]"
                    >
                      <option value="">Select a Tax</option>
                      <optgroup label={intraState ? 'GST (CGST + SGST)' : 'IGST'}>
                        {slabs.map((t) => (
                          <option key={t.id} value={t.id}>
                            {t.name} [{Number(t.rate)}%]
                          </option>
                        ))}
                      </optgroup>
                      {otherSlabs.length > 0 && (
                        <optgroup label="Other">
                          {otherSlabs.map((t) => (
                            <option key={t.id} value={t.id}>
                              {t.name} [{Number(t.rate)}%]
                            </option>
                          ))}
                        </optgroup>
                      )}
                    </Select>
                  </Td>
                  <Td className="whitespace-nowrap text-right font-medium">
                    {money(lineAmount(l))}
                  </Td>
                  <Td>
                    {lines.length > 1 && (
                      <button
                        type="button"
                        title="Remove this line"
                        onClick={() => setLines(lines.filter((_, idx) => idx !== i))}
                        className="rounded px-1.5 text-lg leading-none text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                      >
                        ×
                      </button>
                    )}
                  </Td>
                </tr>
              ))}
            </tbody>
          </Table>

          <div className="flex gap-2 px-4 py-3">
            <Button size="sm" onClick={addRow}>+ Add line</Button>
            <Button size="sm" onClick={() => setBulkOpen((v) => !v)}>
              {bulkOpen ? 'Close bulk picker' : '+ Add Items in Bulk'}
            </Button>
          </div>

          {bulkOpen && (
            <div className="border-t border-border px-4 py-3">
              <div className="max-h-64 overflow-y-auto rounded-md border border-border">
                {items.length === 0 && (
                  <p className="p-3 text-sm text-muted-foreground">No items yet.</p>
                )}
                {items.map((it) => (
                  <label
                    key={it.id}
                    className="flex cursor-pointer items-center gap-2 border-b border-border px-3 py-1.5 text-sm last:border-0 hover:bg-muted/60"
                  >
                    <input
                      type="checkbox"
                      checked={bulkPicked.has(it.id)}
                      onChange={(e) => {
                        const next = new Set(bulkPicked);
                        if (e.target.checked) next.add(it.id);
                        else next.delete(it.id);
                        setBulkPicked(next);
                      }}
                    />
                    <Thumb url={it.imageUrls?.[0]} label={it.name} />
                    <span className="text-foreground">{it.name}</span>
                    {it.sku && (
                      <span className="font-mono text-xs text-muted-foreground">
                        {it.sku}
                      </span>
                    )}
                    {it.costPrice && (
                      <span className="ml-auto text-xs text-muted-foreground">
                        {money(it.costPrice)}
                      </span>
                    )}
                  </label>
                ))}
              </div>
              <div className="mt-2 flex items-center gap-2">
                <Button size="sm" variant="primary" onClick={addBulk} disabled={!bulkPicked.size}>
                  Add {bulkPicked.size || ''} item{bulkPicked.size === 1 ? '' : 's'}
                </Button>
                {bulkPicked.size > 0 && (
                  <Button size="sm" variant="ghost" onClick={() => setBulkPicked(new Set())}>
                    Clear
                  </Button>
                )}
              </div>
            </div>
          )}

          <div className="grid gap-4 border-t border-border p-4 lg:grid-cols-2 [&>*]:min-w-0">
            <div />
            <dl className="min-w-0 space-y-2.5 rounded-md bg-muted/60 p-4 text-sm">
              <div className="flex items-start justify-between">
                <dt className="font-medium text-foreground">
                  Sub Total
                  <span className="block text-xs font-normal text-muted-foreground">
                    Total Quantity : {totalQuantity}
                  </span>
                </dt>
                <dd className="font-medium">{money(subTotal)}</dd>
              </div>

              {!perLineDiscount && (
                <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-2">
                  <dt className="text-muted-foreground">Discount</dt>
                  <dd className="flex flex-wrap items-center justify-end gap-2">
                    <Input
                      type="number" step="0.01" min="0" max="100"
                      value={form.discountPercent}
                      onChange={(e) => set({ discountPercent: e.target.value })}
                      className="w-24 text-right"
                    />
                    <span className="text-xs text-muted-foreground">%</span>
                    <span className="w-24 text-right">
                      {Math.round(headerDiscount * 100) > 0 && '-'}
                      {money(headerDiscount)}
                    </span>
                  </dd>
                </div>
              )}


              {taxRows.length === 0 ? (
                <div className="flex items-center justify-between">
                  <dt className="text-muted-foreground">Tax</dt>
                  <dd className="w-24 text-right text-muted-foreground">
                    {money(0)}
                  </dd>
                </div>
              ) : (
                taxRows.map((t) => (
                  <div key={t.key} className="flex items-center justify-between">
                    <dt className="text-muted-foreground">{t.label}</dt>
                    <dd className="w-24 text-right">{money(t.amount)}</dd>
                  </div>
                ))
              )}

              <div className="flex items-center justify-between border-t border-border pt-2.5">
                <dt className="text-muted-foreground">Total Tax Amount</dt>
                <dd className="w-24 text-right font-medium">{money(taxTotal)}</dd>
              </div>

              <TaxWithholdingRow
                kind={form.taxWithholdingType}
                taxId={form.taxWithholdingTaxId}
                amount={withholdingAmount}
                money={money}
                onKindChange={(k) => set({ taxWithholdingType: k, taxWithholdingTaxId: '' })}
                onTaxChange={(id) => set({ taxWithholdingTaxId: id })}
              />

              <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-2">
                <dt className="text-muted-foreground">Shipping charge</dt>
                <dd className="flex flex-wrap items-center justify-end gap-2">
                  <Input
                    type="number" step="0.01" min="0"
                    value={form.shippingCharge}
                    onChange={(e) => set({ shippingCharge: e.target.value })}
                    className="w-28 text-right"
                  />
                  <span className="w-24 text-right">{money(Number(form.shippingCharge || 0))}</span>
                </dd>
              </div>

              <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-2">
                <dt>
                  <Input
                    value={form.adjustmentLabel}
                    onChange={(e) => set({ adjustmentLabel: e.target.value })}
                    className="w-32"
                  />
                </dt>
                <dd className="flex flex-wrap items-center justify-end gap-2">
                  <Input
                    type="number" step="0.01"
                    value={form.adjustment}
                    onChange={(e) => set({ adjustment: e.target.value })}
                    className="w-28 text-right"
                  />
                  <span className="w-24 text-right">{money(Number(form.adjustment || 0))}</span>
                </dd>
              </div>

              <RoundOffRow
                value={form.roundOff}
                onChange={(v) => set({ roundOff: v })}
                auto={resolveRoundOff(beforeRounding, '', roundOffMode).value}
                applied={rounding.value}
                money={money}
              />

              <div className="flex justify-between border-t border-border pt-2.5 text-base font-semibold">
                <dt>Total</dt>
                <dd>{money(grandTotal)}</dd>
              </div>

              <p className="pt-1 text-xs text-muted-foreground">
                Final figures are worked out again when you save.
              </p>
            </dl>
          </div>
        </Card>

        <div className="grid gap-5 lg:grid-cols-2">
          <Card>
            <div className="space-y-4">
              <Field label="Notes" hint="Printed on the purchase order">
                <Textarea
                  rows={3}
                  value={form.customerNotes}
                  onChange={(e) => set({ customerNotes: e.target.value })}
                />
              </Field>
              <Field label="Terms & Conditions">
                <Textarea
                  rows={3}
                  placeholder="Enter the terms and conditions of your business to be displayed in your transaction"
                  value={form.termsConditions}
                  onChange={(e) => set({ termsConditions: e.target.value })}
                />
              </Field>
            </div>
          </Card>

          <Card>
            <span className={label}>Attach File(s) to Purchase Order</span>
            <FileUpload
              multiple
              accept="image/*,application/pdf,.csv,.doc,.docx,.xls,.xlsx"
              label="Upload File"
              disabled={attachments.length >= MAX_ATTACHMENTS}
              onUploaded={(files) =>
                setAttachments((prev) => [...prev, ...files].slice(0, MAX_ATTACHMENTS))
              }
            />
            <p className="mt-1.5 text-xs text-muted-foreground">
              You can upload a maximum of {MAX_ATTACHMENTS} files, 10MB each. They attach once the
              order is saved.
            </p>
            {attachments.length > 0 && (
              <ul className="mt-3 space-y-1.5">
                {attachments.map((f, i) => (
                  <li
                    key={`${f.url}-${i}`}
                    className="flex items-center justify-between rounded-md border border-border px-2.5 py-1.5 text-xs"
                  >
                    <span className="truncate text-foreground">{f.fileName}</span>
                    <button
                      type="button"
                      onClick={() => setAttachments(attachments.filter((_, idx) => idx !== i))}
                      className="ml-2 shrink-0 text-muted-foreground hover:text-destructive"
                    >
                      Remove
                    </button>
                  </li>
                ))}
              </ul>
            )}

            <div className="mt-5 border-t border-border pt-4">
              <span className={label}>Email Communications</span>
              {vendor?.email ? (
                <p className="text-sm text-muted-foreground">
                  <strong>Save and Send</strong> records a message to{' '}
                  <span className="font-medium">{vendor.email}</span>. With no SMTP configured
                  it is filed against the order rather than delivered.
                </p>
              ) : (
                <p className="text-sm text-warning">
                  {form.vendorId
                    ? 'This vendor has no email address, so nothing can be sent.'
                    : 'No contact persons found.'}
                </p>
              )}
            </div>
          </Card>
        </div>
      </div>

      {form.vendorId && (
        <VendorAddressModal
          open={addingAddress}
          onClose={() => setAddingAddress(false)}
          vendorId={form.vendorId}
          onSaved={(a) => setExtraAddresses((prev) => [a, ...prev])}
        />
      )}

      <SaveBar>
        {isEdit ? (
          <Button type="button" variant="success" disabled={saving} onClick={saveEdit}>
            {saving && <Spinner className="border-card/40 border-t-card" />}
            Save
          </Button>
        ) : (
          <>
            <Button type="button" disabled={saving} onClick={() => submit('DRAFT')}>
              Save as Draft
            </Button>
            <Button
              type="button"
              variant="success"
              disabled={saving}
              onClick={() => submit('ISSUED', true)}
            >
              {saving && <Spinner className="border-card/40 border-t-card" />}
              Save and Send
            </Button>
          </>
        )}
        <Link href={isEdit ? `/purchase-orders/${existing!.id}` : '/purchase-orders'}>
          <Button type="button" variant="ghost">Cancel</Button>
        </Link>
        <span className="ml-auto text-sm text-muted-foreground">
          Total <strong className="text-foreground">{money(grandTotal)}</strong>
        </span>
      </SaveBar>
    </>
  );
}
