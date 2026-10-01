'use client';

import { Fragment, useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { api, money, shortDate, errorMessage, type Paged, todayIso, currencySymbol } from '@/lib/api';
import { useToast } from '@/lib/toast';
import { useSaveNav, SaveStalled } from '@/lib/useSaveNav';
import { RoundOffRow } from '@/components/RoundOffRow';
import { resolveRoundOff, type RoundOffMode } from '@/lib/roundOff';
import { taxBreakdown } from '@/lib/taxBreakdown';
import { INDIAN_STATES, stateLabel } from '@/lib/states';
import { FileUpload, type Uploaded } from '@/components/FileUpload';
import { PaymentTermSelect, usePaymentTerms, useDefaultPaymentTerm, dueDateFrom } from '@/components/PaymentTermSelect';
import { useDefaultTerms } from '@/lib/documentTerms';
import { TaxWithholdingRow, type WithholdingKind } from '@/components/TaxWithholding';
import {
  Button, Card, EmptyRow, ErrorBox, Field, Input, PageHeader,
  Select, Table, Td, Textarea, Th, Spinner,
} from '@/components/ui';
import { ItemSelect } from './ItemSelect';
import { COMBO_PREFIX, comboVariantOf, loadComboChoices, type ComboChoice } from '@/lib/combos';
import { CustomerSelect } from './CustomerSelect';
import { GstinField } from './GstinField';
import { itemLabel, priceAs, switchRate, type RateMemo } from '@/lib/items';
import { SaveBar } from './form/SaveBar';
import { PageCrumb } from '@/lib/crumbs';
import { MrpTotalRows, OffMrpCell, OffMrpNote } from '@/components/OffMrp';
import { pctSuffix } from '@/lib/mrp';

type Address = {
  attention?: string | null; line1?: string | null; line2?: string | null;
  city?: string | null; state?: string | null; stateCode?: string | null;
  pincode?: string | null; country?: string | null; phone?: string | null;
  type?: string;
};

type Customer = {
  id: string;
  displayName: string | null;
  customerType?: string;
  b2bAccount?: {
    companyName: string | null;
    gstin: string | null;
    gstTreatment: string | null;
    placeOfSupplyCode: string | null;
    paymentTerms?: string | null;
  } | null;
};

type Location = { id: string; name: string; isDefault: boolean; stateCode?: string | null };
type Item = {
  id: string; name: string; sku: string | null; unit: string;
  hsnCode: string | null; sellingPrice: string | null; sellingTaxTreatment?: string | null;
  imageUrls?: string[];
  mrp?: string | null; discountPercent?: string | null;
  sizeValue?: string | null; sizeUnit?: string | null;
  intraStateTaxRate?: string | null;
};
type TaxRate = { id: string; name: string; rate: string; type: string; isDefault: boolean };
type SalesOrder = {
  id: string;
  orderNumber: string;
  orderStatus?: string;
  isDraft?: boolean;
  lines?: { quantity: number | string; quantityInvoiced?: number | string | null }[];
};

const billable = (o: SalesOrder) =>
  o.orderStatus !== 'CANCELLED' &&
  !o.isDraft &&
  !(o.lines?.length && o.lines.every((l) => Number(l.quantityInvoiced ?? 0) >= Number(l.quantity)));

const GST_TREATMENT: Record<string, string> = {
  REGISTERED_REGULAR: 'Registered Business — Regular',
  REGISTERED_COMPOSITION: 'Registered Business — Composition',
  UNREGISTERED: 'Unregistered Business',
  CONSUMER: 'Consumer',
  OVERSEAS: 'Overseas',
  SEZ: 'SEZ',
};

const MAX_ATTACHMENTS = 5;

type LineDraft = {
  itemId: string;
  variantId?: string;
  itemName: string;
  description: string;
  hsnCode: string;
  unit: string;
  quantity: string;
  rate: string;
  discountPercent: string;
  discountUnit?: '%' | '₹';
  taxRateId: string;
  seededTaxPercent?: number;
  packSize?: number;
  mrp?: string;
  orderId?: string | null;
  orderNumber?: string | null;
  rateMemo?: RateMemo;
};

type OrderLineSeed = {
  orderId: string;
  itemId: string | null;
  itemName: string;
  hsnCode: string | null;
  quantity: number;
  rate: number;
  taxRate: number;
  packSize?: number;
  discountAmount?: number | null;
  mrp?: number | null;
};

type UnbilledOrder = {
  id: string;
  orderNumber: string;
  placedAt: string;
  grandTotal: string;
  fulfillmentStatus: string;
  shippingTotal: number;
  codCharge?: number;
  adjustment: number;
  hasDiscount: boolean;
  lines: OrderLineSeed[];
};

type DocAddress = Record<string, string | null | undefined>;

type OrderSeed = {
  orderId: string; orderNumber: string; customerId: string | null; referenceNumber: string | null;
  paymentTerms: string; locationId: string | null;
  placeOfSupplyCode: string | null; gstin: string | null; taxTreatment: string;
  shippingCharge: string; codCharge?: string | null; terms: string | null;
  discountLevel?: string | null;
  adjustment?: string | null;
  adjustmentLabel?: string | null;
  roundOff?: string | null;
  billingAddress?: DocAddress | null;
  shippingAddress?: DocAddress | null;
  lines: OrderLineSeed[];
};

async function fetchOrderSeed(orderId: string, include: string[]) {
  const { data } = await api.get<{ data: OrderSeed }>(`/invoices/from-order/${orderId}`);
  const extra =
    include.length && data.customerId
      ? ((
          await api
            .get<{ data: UnbilledOrder[] }>(`/invoices/unbilled-orders/${data.customerId}`, {
              excludeOrderId: data.orderId,
            })
            .catch(() => null)
        )?.data ?? []).filter((o) => include.includes(o.id))
      : [];
  return { seed: data, extra };
}

const addressText = (a: DocAddress | null | undefined) =>
  a
    ? ([
        [a.firstName, a.lastName].filter(Boolean).join(' '),
        a.attention,
        a.line1,
        a.line2,
        a.city,
        [a.state, a.pincode].filter(Boolean).join(' '),
        a.country,
      ].filter(Boolean) as string[])
    : [];

const draftFrom = (l: OrderLineSeed, orderNumber: string): LineDraft => ({
  itemId: l.itemId ?? '',
  itemName: l.itemName,
  description: '',
  hsnCode: l.hsnCode ?? '',
  unit: 'pcs',
  quantity: String(l.quantity),
  rate: String(l.rate),
  discountPercent: '',
  taxRateId: '',
  seededTaxPercent: l.taxRate,
  packSize: l.packSize ?? 1,
  mrp: l.mrp != null ? String(l.mrp) : '',
  orderId: l.orderId,
  orderNumber,
  ...(l.discountAmount ? { discountPercent: String(l.discountAmount), discountUnit: '₹' as const } : {}),
});

export type ExistingInvoice = {
  id: string;
  invoiceNumber: string;
  customerId: string;
  orderId: string | null;
  locationId: string | null;
  invoiceDate: string;
  dueDate: string | null;
  paymentTerms: string;
  referenceNumber: string | null;
  subject: string | null;
  sourceOfSupplyCode: string | null;
  placeOfSupplyCode: string | null;
  gstin: string | null;
  gstTreatment: string;
  taxTreatment: string;
  discountLevel: string;
  discountPercent: string | null;
  taxWithholdingType: string | null;
  discountTotal?: string;
  billingAddress?: DocAddress | null;
  shippingAddress?: DocAddress | null;
  shippingCharge: string;
  codCharge?: string;
  adjustment: string;
  adjustmentLabel: string;
  roundOff?: string;
  roundOffManual?: boolean;
  previousBalance?: string | null;
  customerNotes: string | null;
  terms: string | null;
  lines: {
    itemId: string | null; variantId?: string | null; itemName: string; description: string | null;
    hsnCode: string | null; unit: string; quantity: string; rate: string;
    discountPercent: string | null; discountAmount?: string; taxRate: string; packSize?: number; mrp?: string | null;
    orderId?: string | null; order?: { id: string; orderNumber: string } | null;
  }[];
};

type CustomerDues = {
  isB2b: boolean;
  dues: number;
  credits: number;
  net: number;
  invoices: {
    id: string; invoiceNumber: string; invoiceDate: string; balanceDue: string;
    overdueByDays: number | null;
  }[];
};

const blankLine = (): LineDraft => ({
  itemId: '', itemName: '', description: '', hsnCode: '', unit: 'pcs',
  quantity: '1', rate: '0', discountPercent: '', taxRateId: '',
});

export function InvoiceForm({ existing }: { existing?: ExistingInvoice }) {
  const router = useRouter();
  const params = useSearchParams();
  const { terms: paymentTerms } = usePaymentTerms();
  const isEdit = !!existing;

  const fromOrderId = params.get('orderId');
  const includeParam = params.get('include') ?? '';
  const duplicateId = isEdit ? null : params.get('duplicate');
  const fromChallanId = isEdit ? null : params.get('challanId');
  const fromCustomerId = isEdit ? null : params.get('customerId');

  const [customers, setCustomers] = useState<Customer[]>([]);
  const [locations, setLocations] = useState<Location[]>([]);
  const [items, setItems] = useState<Item[]>([]);
  const [combos, setCombos] = useState<ComboChoice[]>([]);
  const [taxRates, setTaxRates] = useState<TaxRate[]>([]);
  const [orders, setOrders] = useState<SalesOrder[]>([]);
  const [seededOrder, setSeededOrder] = useState<SalesOrder | null>(null);
  const [addresses, setAddresses] = useState<Address[]>([]);
  const [attachments, setAttachments] = useState<Uploaded[]>([]);
  const [orgState, setOrgState] = useState<string | null>(null);
  const [roundOffMode, setRoundOffMode] = useState<RoundOffMode>('NEAREST_1');
  const [dues, setDues] = useState<CustomerDues | null>(null);
  const [duesOpen, setDuesOpen] = useState(false);
  const [advances, setAdvances] = useState<{ id: string; paymentNumber: string; paymentDate: string; unapplied: number }[]>([]);
  const [applyAdvance, setApplyAdvance] = useState(false);
  const toast = useToast();

  const [error, setError] = useState('');
  const { saving, stalledHref, begin: beginSave, done: doneSave, fail: failSave } =
    useSaveNav();
  const [seeding, setSeeding] = useState(!!fromOrderId || !!duplicateId || !!fromChallanId);
  const [challan, setChallan] = useState<{ id: string; challanNumber: string } | null>(null);
  const [nextNumber, setNextNumber] = useState('');

  const [form, setForm] = useState({
    invoiceNumber: existing?.invoiceNumber ?? '',
    customerId: existing?.customerId ?? fromCustomerId ?? '',
    orderId: existing?.orderId ?? '',
    locationId: existing?.locationId ?? '',
    invoiceDate: (existing?.invoiceDate ?? todayIso()).slice(0, 10),
    dueDate: existing?.dueDate ? existing.dueDate.slice(0, 10) : '',
    paymentTerms: existing?.paymentTerms ?? 'DUE_ON_RECEIPT',
    referenceNumber: existing?.referenceNumber ?? '',
    subject: existing?.subject ?? '',
    sourceOfSupplyCode: existing?.sourceOfSupplyCode ?? '',
    placeOfSupplyCode: existing?.placeOfSupplyCode ?? '',
    gstin: existing?.gstin ?? '',
    gstTreatment: existing?.gstTreatment ?? '',
    taxTreatment: existing?.taxTreatment ?? '',
    discountLevel: existing?.discountLevel ?? 'TRANSACTION',
    discountPercent: existing?.discountPercent
      ? String(Number(existing.discountPercent))
      : existing?.discountLevel === 'TRANSACTION' && Number(existing?.discountTotal ?? 0) > 0
        ? String(Number(existing.discountTotal))
        : '',
    discountUnit: (existing && !Number(existing.discountPercent ?? 0) && Number(existing.discountTotal ?? 0) > 0
      ? '₹'
      : '%') as '%' | '₹',
    taxWithholdingType: (existing?.taxWithholdingType ?? '') as WithholdingKind,
    taxWithholdingTaxId: '',
    shippingCharge: existing ? String(Number(existing.shippingCharge)) : '',
    codCharge: existing && Number(existing.codCharge ?? 0) > 0 ? String(Number(existing.codCharge)) : '',
    adjustment: existing ? String(Number(existing.adjustment)) : '',
    adjustmentLabel: existing?.adjustmentLabel ?? 'Adjustment',
    roundOff: existing?.roundOffManual ? String(Number(existing.roundOff ?? 0)) : '',
    showPreviousBalance: existing ? existing.previousBalance != null : true,
    customerNotes: existing?.customerNotes ?? 'Thanks for your business.',
    terms: existing?.terms ?? '',
  });
  const set = (patch: Partial<typeof form>) => setForm((f) => ({ ...f, ...patch }));
  const defaultTerm = useDefaultPaymentTerm(
    (code) =>
      setForm((f) =>
        !f.customerId && !f.orderId && f.paymentTerms === 'DUE_ON_RECEIPT' ? { ...f, paymentTerms: code, dueDate: '' } : f
      ),
    !isEdit
  );
  useDefaultTerms('invoice', !isEdit && !duplicateId, (terms) => setForm((f) => (f.terms ? f : { ...f, terms })));

  const [lines, setLines] = useState<LineDraft[]>(() =>
    existing?.lines.length
      ? existing.lines.map((l) => ({
          itemId: l.itemId ?? '',
          variantId: l.variantId ?? '',
          itemName: l.itemName,
          description: l.description ?? '',
          hsnCode: l.hsnCode ?? '',
          unit: l.unit,
          quantity: String(Number(l.quantity)),
          rate: String(Number(l.rate)),
          discountPercent: l.discountPercent
            ? String(Number(l.discountPercent))
            : Number(l.discountAmount ?? 0) > 0
              ? String(Number(l.discountAmount))
              : '',
          discountUnit: (!l.discountPercent && Number(l.discountAmount ?? 0) > 0 ? '₹' : '%') as '%' | '₹',
          taxRateId: '',
          seededTaxPercent: Number(l.taxRate),
          packSize: l.packSize ?? 1,
          mrp: l.mrp != null ? String(Number(l.mrp)) : '',
          orderId: l.orderId ?? null,
          orderNumber: l.order?.orderNumber ?? null,
        }))
      : [blankLine()]
  );
  const [unbilled, setUnbilled] = useState<UnbilledOrder[]>([]);
  const [parked, setParked] = useState<UnbilledOrder[]>([]);
  const [docAddresses, setDocAddresses] = useState<{ billing: DocAddress | null; shipping: DocAddress | null } | null>(
    () => (existing ? { billing: existing.billingAddress ?? null, shipping: existing.shippingAddress ?? null } : null)
  );
  const [addedCharges, setAddedCharges] = useState<Record<string, { shipping: number; cod: number; adjustment: number }>>({});

  useEffect(() => {
    if (!existing) return;
    const ids = [...new Set([existing.orderId, ...existing.lines.map((l) => l.orderId)].filter(Boolean))] as string[];
    if (!ids.length) return;
    let cancelled = false;
    Promise.all(
      ids.map((id) =>
        api
          .get<{ data: { id: string; shippingTotal: string; codCharge?: string; adjustment: string } }>(`/orders/${id}`)
          .then((r) => r.data)
          .catch(() => null)
      )
    ).then((list) => {
      if (cancelled) return;
      setAddedCharges(
        Object.fromEntries(
          list
            .filter((o): o is { id: string; shippingTotal: string; codCharge?: string; adjustment: string } => !!o)
            .map((o) => [
              o.id,
              { shipping: Number(o.shippingTotal || 0), cod: Number(o.codCharge || 0), adjustment: Number(o.adjustment || 0) },
            ])
        )
      );
    });
    return () => {
      cancelled = true;
    };
  }, [existing]);
  const [loadingOrder, setLoadingOrder] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const [c, loc, it, tr, org] = await Promise.all([
          api.get<Paged<Customer>>('/customers', { limit: 100 }),
          api.get<Paged<Location>>('/locations', { limit: 50 }),
          api.get<Paged<Item>>('/items', { limit: 100 }),
          api.get<{ data: TaxRate[] }>('/sales/tax-rates'),
          api
            .get<{ data: { stateCode?: string | null; roundOffMode?: RoundOffMode; defaultTaxTreatment?: string } }>('/organization')
            .catch(() => null),
        ]);
        if (cancelled) return;
        setCustomers(c.data);
        setLocations(loc.data);
        setItems(it.data);
        setTaxRates(tr.data);
        setOrgState(org?.data?.stateCode ?? null);
        loadComboChoices().then((list) => {
          if (!cancelled) setCombos(list);
        });
        const preset = fromCustomerId ? c.data.find((x) => x.id === fromCustomerId) : null;
        if (preset?.b2bAccount?.paymentTerms) {
          const terms = preset.b2bAccount.paymentTerms;
          setForm((f) => (f.customerId === preset.id && !f.orderId ? { ...f, paymentTerms: terms, dueDate: '' } : f));
        }
        if (org?.data?.roundOffMode) setRoundOffMode(org.data.roundOffMode);
        setForm((f) => (f.taxTreatment ? f : { ...f, taxTreatment: org?.data?.defaultTaxTreatment ?? 'INCLUSIVE' }));
        if (!existing) {
          const def = loc.data.find((l) => l.isDefault) ?? loc.data[0];
          if (def) setForm((f) => (f.locationId ? f : { ...f, locationId: def.id }));
        }
      } catch (err) {
        if (!cancelled) setError(errorMessage(err));
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [existing, fromCustomerId]);

  const applyOrderSeed = useCallback((d: OrderSeed, extra: UnbilledOrder[]) => {
    const extraShipping = extra.reduce((n, o) => n + Number(o.shippingTotal || 0), 0);
    const extraCod = extra.reduce((n, o) => n + Number(o.codCharge || 0), 0);
    const extraAdjustment = extra.reduce((n, o) => n + Number(o.adjustment || 0), 0);
    const lineLevel = d.discountLevel === 'LINE_ITEM' || extra.some((o) => o.hasDiscount);
    setSeededOrder({ id: d.orderId, orderNumber: d.orderNumber });
    setDocAddresses({ billing: d.billingAddress ?? null, shipping: d.shippingAddress ?? null });
    setAddedCharges(
      Object.fromEntries([
        [d.orderId, { shipping: Number(d.shippingCharge ?? 0), cod: Number(d.codCharge ?? 0), adjustment: Number(d.adjustment ?? 0) }],
        ...extra.map((o) => [o.id, { shipping: Number(o.shippingTotal || 0), cod: Number(o.codCharge || 0), adjustment: Number(o.adjustment || 0) }]),
      ])
    );
    setForm((f) => ({
      ...f,
      orderId: d.orderId,
      customerId: d.customerId ?? f.customerId,
      referenceNumber: d.referenceNumber ?? f.referenceNumber,
      paymentTerms: d.paymentTerms ?? f.paymentTerms,
      locationId: d.locationId ?? f.locationId,
      placeOfSupplyCode: d.placeOfSupplyCode ?? f.placeOfSupplyCode,
      gstin: d.gstin ?? f.gstin,
      taxTreatment: d.taxTreatment ?? f.taxTreatment,
      shippingCharge: String(Number(d.shippingCharge ?? 0) + extraShipping || ''),
      codCharge: String(Number(d.codCharge ?? 0) + extraCod || ''),
      adjustment: String(Number(d.adjustment ?? 0) + extraAdjustment || ''),
      adjustmentLabel: d.adjustmentLabel || f.adjustmentLabel,
      roundOff: d.roundOff != null ? String(Number(d.roundOff)) : '',
      discountLevel: lineLevel ? 'LINE_ITEM' : 'TRANSACTION',
      discountPercent: '',
      discountUnit: '%',
      terms: d.terms ?? f.terms,
    }));
    const seeded = [
      ...d.lines.map((l) => draftFrom(l, d.orderNumber)),
      ...extra.flatMap((o) => o.lines.map((l) => draftFrom(l, o.orderNumber))),
    ];
    if (seeded.length) setLines(seeded);
  }, []);

  useEffect(() => {
    if (!fromOrderId || isEdit) return;
    let cancelled = false;
    fetchOrderSeed(fromOrderId, includeParam.split(',').filter(Boolean))
      .then(({ seed, extra }) => {
        if (!cancelled) applyOrderSeed(seed, extra);
      })
      .catch((err) => {
        if (!cancelled) setError(errorMessage(err));
      })
      .finally(() => {
        if (!cancelled) setSeeding(false);
      });
    return () => {
      cancelled = true;
    };
  }, [fromOrderId, includeParam, isEdit, applyOrderSeed]);

  useEffect(() => {
    if (isEdit) return;
    let cancelled = false;
    api
      .get<{ data: { number: string } }>('/sales/document-numbers/invoice/next', { date: form.invoiceDate })
      .then((r) => {
        if (!cancelled) setNextNumber(r.data.number);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [isEdit, form.invoiceDate]);

  useEffect(() => {
    if (!fromChallanId) return;
    let cancelled = false;
    api
      .get<{
        data: {
          challanId: string; challanNumber: string; orderId: string | null; orderNumber?: string | null;
          paymentTerms?: string | null;
          customerId: string; referenceNumber: string | null; locationId: string | null;
          sourceOfSupplyCode: string | null; placeOfSupplyCode: string | null; gstin: string | null; gstTreatment: string | null;
          taxTreatment: string; discountLevel: string; discountPercent: string | null; discountTotal?: string | null;
          adjustment: string | null; adjustmentLabel: string | null; terms: string | null;
          shippingCharge?: string | null; codCharge?: string | null;
          billingAddress?: DocAddress | null; shippingAddress?: DocAddress | null;
          lines: {
            itemId: string | null; itemName: string; description: string | null; hsnCode: string | null; unit: string | null;
            quantity: number; rate: number; discountPercent: number | null; discountAmount?: number | null; taxRate: number;
            mrp?: number | null; orderId?: string | null; orderNumber?: string | null;
          }[];
        };
      }>(`/invoices/from-challan/${fromChallanId}`)
      .then(({ data: d }) => {
        if (cancelled) return;
        setChallan({ id: d.challanId, challanNumber: d.challanNumber });
        if (d.orderId && d.orderNumber) setSeededOrder({ id: d.orderId, orderNumber: d.orderNumber });
        setDocAddresses({ billing: d.billingAddress ?? null, shipping: d.shippingAddress ?? null });
        const flatHeader = d.discountLevel === 'TRANSACTION' && !Number(d.discountPercent ?? 0) && Number(d.discountTotal ?? 0) > 0;
        setForm((f) => ({
          ...f,
          customerId: d.customerId,
          orderId: d.orderId ?? '',
          referenceNumber: d.referenceNumber ?? f.referenceNumber,
          locationId: d.locationId ?? f.locationId,
          sourceOfSupplyCode: d.sourceOfSupplyCode ?? f.sourceOfSupplyCode,
          placeOfSupplyCode: d.placeOfSupplyCode ?? f.placeOfSupplyCode,
          gstin: d.gstin ?? f.gstin,
          gstTreatment: d.gstTreatment ?? f.gstTreatment,
          taxTreatment: d.taxTreatment ?? f.taxTreatment,
          discountLevel: d.discountLevel ?? f.discountLevel,
          discountPercent: flatHeader ? String(Number(d.discountTotal)) : d.discountPercent ? String(Number(d.discountPercent)) : '',
          discountUnit: flatHeader ? '₹' : '%',
          shippingCharge: String(Number(d.shippingCharge ?? 0) || ''),
          codCharge: String(Number(d.codCharge ?? 0) || ''),
          adjustment: String(Number(d.adjustment ?? 0) || ''),
          adjustmentLabel: d.adjustmentLabel || f.adjustmentLabel,
          paymentTerms: d.paymentTerms ?? f.paymentTerms,
          dueDate: '',
          terms: f.terms,
        }));
        if (d.lines.length) {
          setLines(
            d.lines.map((l) => ({
              itemId: l.itemId ?? '',
              itemName: l.itemName,
              description: l.description ?? '',
              hsnCode: l.hsnCode ?? '',
              unit: l.unit ?? 'pcs',
              quantity: String(l.quantity),
              rate: String(l.rate),
              discountPercent: l.discountPercent
                ? String(l.discountPercent)
                : Number(l.discountAmount ?? 0) > 0
                  ? String(l.discountAmount)
                  : '',
              discountUnit: (!l.discountPercent && Number(l.discountAmount ?? 0) > 0 ? '₹' : '%') as '%' | '₹',
              taxRateId: '',
              seededTaxPercent: l.taxRate,
              packSize: 1,
              mrp: l.mrp != null ? String(l.mrp) : '',
              orderId: l.orderId ?? d.orderId,
              orderNumber: l.orderNumber ?? d.orderNumber ?? null,
            }))
          );
        }
      })
      .catch((err) => {
        if (!cancelled) setError(errorMessage(err));
      })
      .finally(() => {
        if (!cancelled) setSeeding(false);
      });
    return () => {
      cancelled = true;
    };
  }, [fromChallanId]);

  useEffect(() => {
    if (!duplicateId) return;
    let cancelled = false;
    api
      .get<{ data: ExistingInvoice & { order?: { id: string; orderNumber: string } | null } }>(`/invoices/${duplicateId}`)
      .then(({ data: d }) => {
        if (cancelled) return;
        setDocAddresses({ billing: d.billingAddress ?? null, shipping: d.shippingAddress ?? null });
        setForm((f) => ({
          ...f,
          customerId: d.customerId,
          locationId: d.locationId ?? f.locationId,
          paymentTerms: d.paymentTerms,
          subject: d.subject ?? '',
          sourceOfSupplyCode: d.sourceOfSupplyCode ?? '',
          placeOfSupplyCode: d.placeOfSupplyCode ?? '',
          gstin: d.gstin ?? '',
          gstTreatment: d.gstTreatment,
          taxTreatment: d.taxTreatment,
          discountLevel: d.discountLevel,
          discountPercent: d.discountPercent
            ? String(Number(d.discountPercent))
            : d.discountLevel === 'TRANSACTION' && Number(d.discountTotal ?? 0) > 0
              ? String(Number(d.discountTotal))
              : '',
          discountUnit: !Number(d.discountPercent ?? 0) && Number(d.discountTotal ?? 0) > 0 ? '₹' : '%',
          shippingCharge: String(Number(d.shippingCharge) || ''),
          codCharge: String(Number(d.codCharge ?? 0) || ''),
          adjustment: String(Number(d.adjustment) || ''),
          adjustmentLabel: d.adjustmentLabel,
          customerNotes: d.customerNotes ?? '',
          terms: d.terms ?? '',
        }));
        setLines(
          d.lines.map((l) => ({
            itemId: l.itemId ?? '',
            itemName: l.itemName,
            description: l.description ?? '',
            hsnCode: l.hsnCode ?? '',
            unit: l.unit,
            quantity: String(Number(l.quantity)),
            rate: String(Number(l.rate)),
            discountPercent: l.discountPercent
              ? String(Number(l.discountPercent))
              : Number(l.discountAmount ?? 0) > 0
                ? String(Number(l.discountAmount))
                : '',
            discountUnit: (!l.discountPercent && Number(l.discountAmount ?? 0) > 0 ? '₹' : '%') as '%' | '₹',
            taxRateId: '',
            seededTaxPercent: Number(l.taxRate),
            packSize: l.packSize ?? 1,
            mrp: l.mrp != null ? String(Number(l.mrp)) : '',
          }))
        );
      })
      .catch((err) => {
        if (!cancelled) setError(errorMessage(err));
      })
      .finally(() => {
        if (!cancelled) setSeeding(false);
      });
    return () => {
      cancelled = true;
    };
  }, [duplicateId]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!form.customerId) {
        setAddresses([]);
        setOrders([]);
        return;
      }
      const [c, o] = await Promise.all([
        api
          .get<{ data: { addresses?: Address[] } }>(`/customers/${form.customerId}`)
          .catch(() => null),
        api
          .get<Paged<SalesOrder>>('/orders', { customerId: form.customerId, limit: 50 })
          .catch(() => null),
      ]);
      if (cancelled) return;
      setAddresses(c?.data?.addresses ?? []);
      setOrders(o?.data ?? []);
    })();
    return () => {
      cancelled = true;
    };
  }, [form.customerId]);

  useEffect(() => {
    let cancelled = false;
    const t = setTimeout(async () => {
      if (!form.customerId) {
        setDues(null);
        return;
      }
      const r = await api
        .get<{ data: CustomerDues }>(`/invoices/customer-balance/${form.customerId}`, {
          excludeInvoiceId: existing?.id,
          asOf: form.invoiceDate || undefined,
        })
        .catch(() => null);
      if (!cancelled) setDues(r?.data ?? null);
    }, 0);
    return () => {
      cancelled = true;
      clearTimeout(t);
    };
  }, [form.customerId, form.invoiceDate, existing?.id]);

  useEffect(() => {
    let cancelled = false;
    const t = setTimeout(async () => {
      if (!form.customerId) {
        setAdvances([]);
        return;
      }
      const r = await api
        .get<{ data: { id: string; paymentNumber: string; paymentDate: string; unapplied: number }[] }>(
          '/payments-received',
          { customerId: form.customerId, view: 'unapplied', limit: 100 }
        )
        .catch(() => null);
      if (!cancelled) setAdvances((r?.data ?? []).filter((p) => Number(p.unapplied) > 0));
    }, 0);
    return () => {
      cancelled = true;
      clearTimeout(t);
    };
  }, [form.customerId]);

  useEffect(() => {
    let cancelled = false;
    const t = setTimeout(async () => {
      if (!form.customerId) {
        setUnbilled([]);
        return;
      }
      const r = await api
        .get<{ data: UnbilledOrder[] }>(`/invoices/unbilled-orders/${form.customerId}`, {
          excludeOrderId: form.orderId || undefined,
        })
        .catch(() => null);
      if (!cancelled) setUnbilled(r?.data ?? []);
    }, 0);
    return () => {
      cancelled = true;
      clearTimeout(t);
    };
  }, [form.customerId, form.orderId]);

  const addedOrders = [
    ...new Map(
      lines
        .filter((l) => l.orderId && l.orderId !== form.orderId)
        .map((l) => [l.orderId as string, l.orderNumber ?? 'order'])
    ),
  ].map(([id, orderNumber]) => ({ id, orderNumber }));
  const waiting = [...new Map([...unbilled, ...parked].map((o) => [o.id, o])).values()]
    .filter((o) => o.id !== form.orderId && !lines.some((l) => l.orderId === o.id))
    .sort((a, b) => a.placedAt.localeCompare(b.placedAt));
  const waitingTotal = waiting.reduce((n, o) => n + Number(o.grandTotal), 0);
  const mainOrderNumber =
    (seededOrder && seededOrder.id === form.orderId ? seededOrder.orderNumber : null) ??
    orders.find((o) => o.id === form.orderId)?.orderNumber ??
    lines.find((l) => l.orderId === form.orderId)?.orderNumber ??
    null;
  const attachedOrders = [
    ...(form.orderId ? [{ id: form.orderId, orderNumber: mainOrderNumber ?? 'order' }] : []),
    ...addedOrders,
  ];
  const orderChoices = (
    seededOrder && !orders.some((o) => o.id === seededOrder.id) ? [seededOrder, ...orders] : orders
  ).filter((o) => !attachedOrders.some((a) => a.id === o.id) && billable(o));
  const groupKey = (l: LineDraft) => l.orderId || form.orderId || '';
  const groupLabel = (l: LineDraft) =>
    l.orderId && l.orderId !== form.orderId
      ? `Order ${l.orderNumber}`
      : form.orderId
        ? `Order ${mainOrderNumber ?? ''}`
        : 'Other items';

  function addOrders(list: UnbilledOrder[]) {
    const added = list.flatMap((o) => o.lines.map((l) => draftFrom(l, o.orderNumber)));
    setLines((ls) => [...ls.filter((l) => l.itemName.trim() || l.itemId), ...added]);
    const shipping = list.reduce((n, o) => n + Number(o.shippingTotal || 0), 0);
    const cod = list.reduce((n, o) => n + Number(o.codCharge || 0), 0);
    const adjustment = list.reduce((n, o) => n + Number(o.adjustment || 0), 0);
    setAddedCharges((c) => ({
      ...c,
      ...Object.fromEntries(
        list.map((o) => [o.id, { shipping: Number(o.shippingTotal || 0), cod: Number(o.codCharge || 0), adjustment: Number(o.adjustment || 0) }])
      ),
    }));
    setForm((f) => ({
      ...f,
      shippingCharge: String(Number(f.shippingCharge || 0) + shipping || ''),
      codCharge: String(Number(f.codCharge || 0) + cod || ''),
      adjustment: String(Number(f.adjustment || 0) + adjustment || ''),
      ...(list.some((o) => o.hasDiscount) && { discountLevel: 'LINE_ITEM' }),
    }));
  }

  function removeOrder(orderId: string) {
    const gone = lines.filter((l) => l.orderId === orderId);
    const known = [...unbilled, ...parked].some((o) => o.id === orderId);
    if (!known && gone.length) {
      setParked((p) => [
        ...p,
        {
          id: orderId,
          orderNumber: gone[0].orderNumber ?? 'order',
          placedAt: '',
          grandTotal: String(gone.reduce((n, l) => n + lineAmount(l), 0)),
          fulfillmentStatus: '',
          shippingTotal: addedCharges[orderId]?.shipping ?? 0,
          codCharge: addedCharges[orderId]?.cod ?? 0,
          adjustment: addedCharges[orderId]?.adjustment ?? 0,
          hasDiscount: gone.some((l) => l.discountUnit === '₹' && Number(l.discountPercent || 0) > 0),
          lines: gone.map((l) => ({
            orderId,
            itemId: l.itemId || null,
            itemName: l.itemName,
            hsnCode: l.hsnCode || null,
            quantity: Number(l.quantity),
            rate: Number(l.rate),
            taxRate: pctOf(l),
            packSize: l.packSize,
            discountAmount: l.discountUnit === '₹' ? Number(l.discountPercent || 0) : null,
          })),
        },
      ]);
    }
    const charges = addedCharges[orderId];
    if (charges) {
      setForm((f) => ({
        ...f,
        shippingCharge: String(Math.max(0, Number(f.shippingCharge || 0) - charges.shipping) || ''),
        codCharge: String(Math.max(0, Number(f.codCharge || 0) - charges.cod) || ''),
        adjustment: String(Number(f.adjustment || 0) - charges.adjustment || ''),
      }));
      setAddedCharges((c) => {
        const next = { ...c };
        delete next[orderId];
        return next;
      });
    }
    setLines((ls) => {
      const kept = ls.filter((l) => l.orderId !== orderId);
      return kept.length ? kept : [blankLine()];
    });
    if (orderId === form.orderId) {
      set({ orderId: addedOrders.find((o) => o.id !== orderId)?.id ?? '' });
    }
  }

  async function makeMainOrder(orderId: string, extra: UnbilledOrder[]) {
    setLoadingOrder(true);
    try {
      const { seed } = await fetchOrderSeed(orderId, []);
      const keep = lines.filter((l) => !l.orderId && (l.itemName.trim() || l.itemId));
      applyOrderSeed(seed, extra);
      if (keep.length) setLines((ls) => [...keep, ...ls]);
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setLoadingOrder(false);
    }
  }

  function billOrders(list: UnbilledOrder[]) {
    if (!list.length) return;
    if (form.orderId) {
      addOrders(list);
      return;
    }
    const [first, ...rest] = list;
    makeMainOrder(first.id, rest);
  }

  async function attachOrder(orderId: string) {
    if (!orderId || attachedOrders.some((o) => o.id === orderId)) return;
    if (!form.orderId) {
      await makeMainOrder(orderId, []);
      return;
    }
    const known = waiting.find((o) => o.id === orderId);
    if (known) {
      addOrders([known]);
      return;
    }
    setLoadingOrder(true);
    try {
      const { seed } = await fetchOrderSeed(orderId, []);
      addOrders([
        {
          id: seed.orderId,
          orderNumber: seed.orderNumber,
          placedAt: '',
          grandTotal: '0',
          fulfillmentStatus: '',
          shippingTotal: Number(seed.shippingCharge ?? 0),
          codCharge: Number(seed.codCharge ?? 0),
          adjustment: Number(seed.adjustment ?? 0),
          hasDiscount: seed.discountLevel === 'LINE_ITEM',
          lines: seed.lines,
        },
      ]);
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setLoadingOrder(false);
    }
  }

  const hasDues = !!dues?.isB2b && (dues.dues > 0 || dues.credits > 0);
  const advanceLeft = advances.reduce((n, a) => n + Number(a.unapplied), 0);
  const printPrevious = hasDues && form.showPreviousBalance;

  const customer = customers.find((c) => c.id === form.customerId) ?? null;
  const location = locations.find((l) => l.id === form.locationId) ?? null;
  const billing = addresses.find((a) => a.type === 'BILLING') ?? addresses[0] ?? null;
  const shippingSaved = addresses.find((a) => a.type === 'SHIPPING') ?? null;
  const billTo = docAddresses?.billing ? addressText(docAddresses.billing) : addressText(billing as DocAddress | null);
  const shipTo = docAddresses?.shipping
    ? addressText(docAddresses.shipping)
    : addressText(shippingSaved as DocAddress | null);

  const source = form.sourceOfSupplyCode || location?.stateCode || orgState || '';
  const place =
    form.placeOfSupplyCode ||
    customer?.b2bAccount?.placeOfSupplyCode ||
    billing?.stateCode ||
    '';
  const effectivePlace = place || source;
  const intraState = !!source && !!effectivePlace && source === effectivePlace;
  const taxFamily: 'GST' | 'IGST' = intraState ? 'GST' : 'IGST';

  const slabs = useMemo(() => taxRates.filter((t) => t.type === taxFamily), [taxRates, taxFamily]);
  const defaultSlab =
    slabs.find((t) => t.isDefault) ?? slabs.find((t) => Number(t.rate) === 18) ?? slabs[0] ?? null;

  const resolveSlab = (l: LineDraft): TaxRate | null => {
    const chosen =
      taxRates.find((t) => t.id === l.taxRateId) ??
      (l.seededTaxPercent != null
        ? (slabs.find((t) => Number(t.rate) === l.seededTaxPercent) ?? null)
        : null);
    if (chosen?.type === taxFamily) return chosen;
    if (chosen) {
      const sameRate = slabs.find((t) => Number(t.rate) === Number(chosen.rate));
      if (sameRate) return sameRate;
    }
    return defaultSlab;
  };
  const pctOf = (l: LineDraft) => Number(resolveSlab(l)?.rate ?? 0);

  function changeTaxTreatment(next: string) {
    const from = form.taxTreatment || 'INCLUSIVE';
    setLines((rows) => rows.map((l) => ({ ...l, ...switchRate(l.rate, l.rateMemo, from, next, pctOf(l)) })));
    set({ taxTreatment: next });
  }

  const setLine = (i: number, patch: Partial<LineDraft>) =>
    setLines((ls) => ls.map((l, x) => (x === i ? { ...l, ...patch } : l)));

  function pickItem(i: number, picked: string) {
    const comboId = comboVariantOf(picked);
    const itemId = comboId ? '' : picked;
    const it: Item | ComboChoice | undefined = comboId
      ? combos.find((c) => c.id === picked)
      : items.find((x) => x.id === picked);
    const discount = '';
    const seed = it?.intraStateTaxRate != null ? { taxRateId: '', seededTaxPercent: Number(it.intraStateTaxRate) } : {};
    const pct = pctOf({ ...lines[i], ...seed });
    setLine(i, {
      itemId,
      variantId: comboId ?? '',
      packSize: 1,
      ...(it && {
        itemName: comboId ? it.name : itemLabel(it as Item),
        hsnCode: it.hsnCode ?? '',
        unit: it.unit,
        rate: it.sellingPrice
          ? String(priceAs(it.sellingPrice, it.sellingTaxTreatment, form.taxTreatment || 'INCLUSIVE', pct))
          : '0',
        mrp: it.mrp != null ? String(Number(it.mrp)) : '',
        discountPercent: discount,
        discountUnit: '%' as const,
        ...seed,
      }),
    });
  }

  const perLineDiscount = form.discountLevel === 'LINE_ITEM';
  const inclusive = form.taxTreatment === 'INCLUSIVE';

  const lineGross = (l: LineDraft) => {
    const gross = Number(l.quantity || 0) * Number(l.rate || 0);
    return inclusive ? gross / (1 + pctOf(l) / 100) : gross;
  };
  const lineDiscountOf = (l: LineDraft) => {
    if (!perLineDiscount) return 0;
    const taxable = lineGross(l);
    const typed = Number(l.discountPercent || 0);
    return l.discountUnit === '₹' ? Math.min(typed, taxable) : (taxable * typed) / 100;
  };
  const lineTaxable = (l: LineDraft) => lineGross(l) - lineDiscountOf(l);

  const subTotal = lines.reduce((n, l) => n + lineTaxable(l), 0);
  const itemDiscounts = lines.reduce((n, l) => n + lineDiscountOf(l), 0);
  const typedHeader = Number(form.discountPercent || 0);
  const headerDiscount = perLineDiscount
    ? 0
    : form.discountUnit === '₹'
      ? Math.min(typedHeader, subTotal)
      : (subTotal * typedHeader) / 100;
  const taxTotal = lines.reduce((n, l) => {
    const share = subTotal === 0 ? 0 : (headerDiscount * lineTaxable(l)) / subTotal;
    return n + (lineTaxable(l) - share) * (pctOf(l) / 100);
  }, 0);

  const hasMrp = lines.some((l) => l.mrp && Number(l.mrp) > 0);
  const mrpLines = lines.map((l) => ({ mrp: l.mrp, quantity: l.quantity, netTaxable: lineTaxable(l), taxPercent: pctOf(l) }));
  const grossBeforeLineDiscount = lines.reduce((n, l) => n + lineGross(l), 0);
  const headerDiscountRatio = subTotal > 0 ? headerDiscount / subTotal : 0;

  const totalQuantity = lines.reduce(
    (n, l) => n + (l.itemId || l.itemName.trim() ? Number(l.quantity || 0) : 0),
    0,
  );
  const taxRows = taxBreakdown(lines, {
    taxableOf: lineTaxable,
    slabOf: resolveSlab,
    subTotal,
    headerDiscount,
    intraState,
  });

  const withholdingRate = Number(taxRates.find((t) => t.id === form.taxWithholdingTaxId)?.rate ?? 0);
  const netSubtotal = subTotal - headerDiscount;
  const withholdingAmount = form.taxWithholdingType ? (netSubtotal * withholdingRate) / 100 : 0;

  const beforeRounding =
    netSubtotal +
    taxTotal +
    Number(form.shippingCharge || 0) +
    Number(form.codCharge || 0) +
    Number(form.adjustment || 0) +
    (form.taxWithholdingType === 'TCS' ? withholdingAmount : 0) -
    (form.taxWithholdingType === 'TDS' ? withholdingAmount : 0);
  const rounding = resolveRoundOff(beforeRounding, form.roundOff, roundOffMode);
  const grandTotal = beforeRounding + rounding.value;

  const lineAmount = (l: LineDraft) =>
    inclusive ? Number(l.quantity || 0) * Number(l.rate || 0) : lineTaxable(l) * (1 + pctOf(l) / 100);

  const termDays = paymentTerms.find((t) => t.code === form.paymentTerms)?.days ?? 0;
  const derivedDue = dueDateFrom(form.invoiceDate, termDays);

  async function submit(status: 'DRAFT' | 'SENT') {
    setError('');
    if (!form.customerId) return setError('Pick a customer');
    const filled = lines.filter((l) => l.itemName.trim() && Number(l.quantity) > 0);
    if (!filled.length) return setError('Add at least one line');
    const firstSeen = new Map<string, number>();
    filled.forEach((l, i) => {
      if (!firstSeen.has(groupKey(l))) firstSeen.set(groupKey(l), i);
    });
    const usable = [...filled].sort(
      (a, b) => (firstSeen.get(groupKey(a)) ?? 0) - (firstSeen.get(groupKey(b)) ?? 0)
    );
    if (Math.abs(rounding.value) > 1) return setError('Round off must be between -1 and 1');

    const blank = isEdit ? null : undefined;
    const typedNumber = form.invoiceNumber.trim();
    const body = {
      ...(isEdit
        ? typedNumber && typedNumber !== existing.invoiceNumber && { invoiceNumber: typedNumber }
        : typedNumber && { invoiceNumber: typedNumber }),
      customerId: form.customerId,
      orderId: form.orderId || blank,
      ...(challan && { challanId: challan.id }),
      locationId: form.locationId || blank,
      invoiceDate: form.invoiceDate,
      dueDate: form.dueDate || blank,
      paymentTerms: form.paymentTerms,
      referenceNumber: form.referenceNumber.trim() || blank,
      subject: form.subject.trim() || blank,
      sourceOfSupplyCode: source || blank,
      placeOfSupplyCode: effectivePlace || blank,
      gstin: form.gstin.trim() || blank,
      ...(form.gstTreatment && { gstTreatment: form.gstTreatment }),
      taxTreatment: form.taxTreatment || 'INCLUSIVE',
      discountLevel: form.discountLevel,
      discountPercent: form.discountUnit === '%' ? Number(form.discountPercent || 0) : 0,
      discountAmount: form.discountUnit === '₹' ? Number(form.discountPercent || 0) : 0,
      ...(docAddresses && { billingAddress: docAddresses.billing, shippingAddress: docAddresses.shipping }),
      taxWithholdingType: form.taxWithholdingType || null,
      taxWithholdingTaxId: form.taxWithholdingTaxId || null,
      shippingCharge: Number(form.shippingCharge || 0),
      codCharge: Number(form.codCharge || 0),
      adjustment: Number(form.adjustment || 0),
      adjustmentLabel: form.adjustmentLabel.trim() || 'Adjustment',
      roundOff: rounding.payload,
      ...(dues?.isB2b ? { showPreviousBalance: printPrevious } : {}),
      status,
      customerNotes: form.customerNotes.trim() || blank,
      terms: form.terms.trim() || blank,
      lines: usable.map((l) => ({
        itemId: l.itemId || null,
        variantId: l.variantId || null,
        orderId: l.orderId || null,
        itemName: l.itemName.trim(),
        description: l.description.trim() || undefined,
        hsnCode: l.hsnCode.trim() || undefined,
        unit: l.unit || 'pcs',
        quantity: Number(l.quantity),
        packSize: l.packSize ?? 1,
        rate: Number(l.rate),
        mrp: l.mrp ? Number(l.mrp) : null,
        discountPercent: perLineDiscount && l.discountUnit !== '₹' ? Number(l.discountPercent || 0) : null,
        discountAmount: perLineDiscount && l.discountUnit === '₹' ? Number(l.discountPercent || 0) : null,
        taxRate: pctOf(l),
      })),
    };

    beginSave();
    try {
      const invoiceId = isEdit
        ? (await api.patch<{ data: { id: string } }>(`/invoices/${existing.id}`, body)).data.id
        : (await api.post<{ data: { id: string } }>('/invoices', body)).data.id;

      if (status === 'SENT' && applyAdvance && advances.length) {
        let applied = 0;
        try {
          const saved = await api.get<{ data: { balanceDue: string; invoiceNumber: string } }>(`/invoices/${invoiceId}`);
          let left = Number(saved.data.balanceDue);
          const oldestFirst = [...advances].sort((a, b) => a.paymentDate.localeCompare(b.paymentDate));
          for (const a of oldestFirst) {
            if (left <= 0.004) break;
            const amount = Math.round(Math.min(Number(a.unapplied), left) * 100) / 100;
            if (amount <= 0) continue;
            await api.post(`/payments-received/${a.id}/apply`, { allocations: [{ invoiceId, amount }] });
            left -= amount;
            applied += amount;
          }
          if (applied > 0) toast.success(`${money(applied)} of the advance applied to ${saved.data.invoiceNumber}`);
        } catch (err) {
          toast.error(
            applied > 0
              ? `${money(applied)} of the advance was applied, then it stopped: ${errorMessage(err)}`
              : `The invoice is saved, but the advance could not be applied: ${errorMessage(err)}`
          );
        }
      }

      for (const f of attachments) {
        await api
          .post('/shared/attachments', {
            ownerType: 'INVOICE',
            ownerId: invoiceId,
            fileName: f.fileName,
            fileUrl: f.url,
            mimeType: f.mimeType,
            sizeBytes: f.sizeBytes,
          })
          .catch(() => {});
      }

      doneSave(`/invoices/${invoiceId}`);
    } catch (err) {
      setError(errorMessage(err));
      failSave();
    }
  }

  if (seeding) {
    return (
      <div className="flex items-center gap-2 p-8 text-sm text-muted-foreground">
        <Spinner /> {duplicateId ? 'Copying the invoice…' : fromChallanId ? 'Loading the delivery challan…' : 'Loading the sales order…'}
      </div>
    );
  }

  return (
    <>
      <PageCrumb label={isEdit ? existing.invoiceNumber : 'New'} />

      <PageHeader title={isEdit ? `Edit ${existing.invoiceNumber}` : 'New Invoice'} />

      <SaveStalled href={stalledHref} />

      {error && <div className="mb-4"><ErrorBox message={error} /></div>}

      <div className="space-y-5">
        <Card>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <Field label="Customer Name" required>
              <CustomerSelect
                value={form.customerId}
                customers={customers}
                onChange={(customerId, picked) => {
                if (picked && !customers.some((c) => c.id === picked.id)) setCustomers((cs) => [...cs, picked]);
                  const nextTerms = isEdit
                    ? null
                    : (picked ?? customers.find((c) => c.id === customerId))?.b2bAccount?.paymentTerms ??
                      defaultTerm ??
                      'DUE_ON_RECEIPT';
                  const extraShipping = Object.values(addedCharges).reduce((n, c) => n + c.shipping, 0);
                  const extraCod = Object.values(addedCharges).reduce((n, c) => n + c.cod, 0);
                  const extraAdjustment = Object.values(addedCharges).reduce((n, c) => n + c.adjustment, 0);
                  setForm((f) => ({
                    ...f,
                    customerId,
                    orderId: '',
                    gstin: '',
                    placeOfSupplyCode: '',
                    gstTreatment: '',
                    ...(nextTerms ? { paymentTerms: nextTerms, dueDate: '' } : {}),
                    shippingCharge: String(Math.max(0, Number(f.shippingCharge || 0) - extraShipping) || ''),
                    codCharge: String(Math.max(0, Number(f.codCharge || 0) - extraCod) || ''),
                    adjustment: String(Number(f.adjustment || 0) - extraAdjustment || ''),
                  }));
                  setDocAddresses(null);
                  setAddedCharges({});
                  setParked([]);
                  setLines((ls) => {
                    const kept = ls.filter((l) => !l.orderId);
                    return kept.length ? kept : [blankLine()];
                  });
                }}
              />
            </Field>

            {hasDues && dues && (
              <div className="rounded-md border border-warning/25 bg-warning/10 px-3 py-2.5 text-sm sm:col-span-2 lg:col-span-3">
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <p className="text-warning">
                    {dues.dues > 0 ? (
                      <>
                        <strong className="tabular-nums">{money(dues.dues)}</strong> still due on{' '}
                        {dues.invoices.length} earlier invoice{dues.invoices.length === 1 ? '' : 's'}
                      </>
                    ) : (
                      'Nothing due on earlier invoices'
                    )}
                    {dues.credits > 0 && (
                      <> · <span className="tabular-nums">{money(dues.credits)}</span> unused credit</>
                    )}
                  </p>
                  {dues.invoices.length > 0 && (
                    <button
                      type="button"
                      onClick={() => setDuesOpen((v) => !v)}
                      className="text-xs text-warning underline"
                    >
                      {duesOpen ? 'Hide invoices' : 'Show invoices'}
                    </button>
                  )}
                </div>
                {duesOpen && (
                  <ul className="mt-2 divide-y divide-warning/30 text-xs">
                    {dues.invoices.map((i) => (
                      <li key={i.id} className="flex items-baseline justify-between gap-3 py-1">
                        <Link
                          href={`/admin/invoices/${i.id}`}
                          target="_blank"
                          className="font-mono text-gold-ink hover:underline"
                        >
                          {i.invoiceNumber}
                        </Link>
                        <span className="text-warning/80">
                          {shortDate(i.invoiceDate)}
                          {i.overdueByDays ? ` · ${i.overdueByDays} days overdue` : ''}
                        </span>
                        <span className="ml-auto tabular-nums">{money(i.balanceDue)}</span>
                      </li>
                    ))}
                  </ul>
                )}
                <label className="mt-2 flex items-start gap-2 text-warning">
                  <input
                    type="checkbox"
                    checked={form.showPreviousBalance}
                    onChange={(e) => set({ showPreviousBalance: e.target.checked })}
                    className="mt-0.5"
                  />
                  <span>
                    Print it on this invoice as Previous balance + This invoice = Total payable. This
                    invoice&apos;s own total and GST stay as they are.
                  </span>
                </label>
              </div>
            )}

            {advanceLeft > 0 && (
              <div className="rounded-md border border-success/30 bg-success/10 px-3 py-2.5 text-sm sm:col-span-2 lg:col-span-3">
                <label className="flex items-start gap-2 text-success">
                  <input
                    type="checkbox"
                    checked={applyAdvance}
                    onChange={(e) => setApplyAdvance(e.target.checked)}
                    className="mt-0.5"
                  />
                  <span>
                    <strong className="font-medium">
                      Apply {money(Math.min(advanceLeft, grandTotal))} of this customer&apos;s unused advance to this invoice
                    </strong>
                    <span className="block text-xs">
                      {money(advanceLeft)} unused across{' '}
                      {advances.length === 1
                        ? advances[0].paymentNumber
                        : `${advances.length} payments (${advances.map((a) => a.paymentNumber).join(', ')})`}
                      . It is applied when you Save and Send, oldest payment first. A draft keeps it aside until
                      the invoice is sent.
                    </span>
                  </span>
                </label>
              </div>
            )}

            {waiting.length > 0 && (
              <div className="rounded-md border border-gold/30 bg-gold-soft/60 px-3 py-2.5 text-sm sm:col-span-2 lg:col-span-3">
                {waiting.length > 0 && (
                  <>
                    <div className="flex flex-wrap items-baseline justify-between gap-2">
                      <p className="text-foreground">
                        <strong>
                          {waiting.length} earlier order{waiting.length === 1 ? '' : 's'}
                        </strong>{' '}
                        not invoiced yet ·{' '}
                        <span className="tabular-nums">{money(waitingTotal)}</span> unpaid
                      </p>
                      {waiting.length > 1 && (
                        <button
                          type="button"
                          onClick={() => billOrders(waiting)}
                          className="text-xs font-medium text-gold-ink underline"
                        >
                          Add all to this invoice
                        </button>
                      )}
                    </div>
                    <ul className="mt-2 divide-y divide-gold/25 text-xs">
                      {waiting.map((o) => (
                        <li key={o.id} className="flex items-center gap-3 py-1.5">
                          <Link
                            href={`/admin/orders/${o.id}`}
                            target="_blank"
                            className="font-mono text-gold-ink hover:underline"
                          >
                            {o.orderNumber}
                          </Link>
                          <span className="text-muted-foreground">
                            {o.placedAt ? `${shortDate(o.placedAt)} · ` : ''}
                            {o.lines.length} item{o.lines.length === 1 ? '' : 's'}
                            {o.fulfillmentStatus === 'UNFULFILLED' ? ' · not shipped yet' : ''}
                          </span>
                          <span className="ml-auto tabular-nums">{money(o.grandTotal)}</span>
                          <Button type="button" size="sm" disabled={loadingOrder} onClick={() => billOrders([o])}>
                            Add
                          </Button>
                        </li>
                      ))}
                    </ul>
                    <p className="mt-2 text-xs text-muted-foreground">
                      Adding an order puts its items on this invoice, so one tax invoice bills them all and
                      the order counts as invoiced.
                      {' Their discounts, shipping and adjustments are added too.'}
                    </p>
                  </>
                )}
              </div>
            )}

            {(billTo.length > 0 || shipTo.length > 0) && (
              <div className="grid gap-4 text-xs leading-5 text-muted-foreground sm:col-span-2 sm:grid-cols-2">
                <div>
                  <div className="mb-1 font-medium text-muted-foreground">BILLING ADDRESS</div>
                  <p className="font-medium text-foreground">{customer?.displayName}</p>
                  {billTo.map((l, i) => (
                    <p key={i}>{l}</p>
                  ))}
                  {customer?.b2bAccount?.gstTreatment && (
                    <p className="mt-2">
                      GST Treatment:{' '}
                      <span className="text-foreground">
                        {GST_TREATMENT[customer.b2bAccount.gstTreatment] ?? '—'}
                      </span>
                    </p>
                  )}
                </div>
                {shipTo.length > 0 && (
                  <div>
                    <div className="mb-1 font-medium text-muted-foreground">SHIPPING ADDRESS</div>
                    {shipTo.map((l, i) => (
                      <p key={i}>{l}</p>
                    ))}
                  </div>
                )}
              </div>
            )}

            <Field
              label="Invoice#"
              hint={isEdit ? 'Change it only if the number printed on the invoice must differ' : 'Leave empty to use the next number from Masters'}
            >
              <Input
                value={form.invoiceNumber}
                onChange={(e) => set({ invoiceNumber: e.target.value })}
                placeholder={nextNumber || 'Next number'}
                className="font-mono"
              />
            </Field>

            <Field
              label="Sales Order#"
              hint={
                attachedOrders.length > 1
                  ? `This invoice bills ${attachedOrders.length} orders - the first one sets its terms and addresses`
                  : 'The orders this invoice bills - add one or more'
              }
            >
              <div className="space-y-2">
                {attachedOrders.length > 0 && (
                  <div className="flex flex-wrap gap-1.5">
                    {attachedOrders.map((o) => (
                      <span
                        key={o.id}
                        className="inline-flex items-center gap-1 rounded-full bg-gold-soft px-2 py-0.5 font-mono text-xs text-gold-ink ring-1 ring-gold/40"
                      >
                        {o.orderNumber}
                        <button
                          type="button"
                          onClick={() => removeOrder(o.id)}
                          disabled={loadingOrder}
                          className="text-muted-foreground hover:text-destructive"
                          aria-label={`Take ${o.orderNumber} off this invoice`}
                        >
                          ×
                        </button>
                      </span>
                    ))}
                  </div>
                )}
                <Select
                  value=""
                  onChange={(e) => attachOrder(e.target.value)}
                  className="w-full"
                  disabled={(!form.customerId && !seededOrder) || loadingOrder}
                >
                  <option value="">
                    {loadingOrder
                      ? 'Adding the order…'
                      : attachedOrders.length
                        ? 'Add another order…'
                        : 'Not against an order'}
                  </option>
                  {orderChoices.map((o) => (
                    <option key={o.id} value={o.id}>{o.orderNumber}</option>
                  ))}
                </Select>
              </div>
            </Field>

            <Field label="Reference#" hint="The customer's own number">
              <Input
                value={form.referenceNumber}
                onChange={(e) => set({ referenceNumber: e.target.value })}
              />
            </Field>

            <Field label="Invoice Date" required>
              <Input
                type="date"
                value={form.invoiceDate}
                onChange={(e) => set({ invoiceDate: e.target.value })}
              />
            </Field>

            <Field label="Terms">
              <PaymentTermSelect
                value={form.paymentTerms}
                onChange={(paymentTerms) => set({ paymentTerms, dueDate: '' })}
              />
            </Field>

            <Field
              label="Due Date"
              hint={
                !form.dueDate && derivedDue
                  ? `Follows the term — ${derivedDue}`
                  : 'Override the term'
              }
            >
              <Input
                type="date"
                value={form.dueDate || derivedDue || ''}
                onChange={(e) => set({ dueDate: e.target.value })}
              />
            </Field>

            <Field label="Location" hint="Which warehouse the goods leave">
              <Select
                value={form.locationId}
                onChange={(e) => set({ locationId: e.target.value })}
                className="w-full"
              >
                <option value="">Select a location…</option>
                {locations.map((l) => (
                  <option key={l.id} value={l.id}>{l.name}</option>
                ))}
              </Select>
            </Field>

            <Field label="Source of Supply" hint="Our state — where the goods leave from">
              <Select
                value={source}
                onChange={(e) => set({ sourceOfSupplyCode: e.target.value })}
                className="w-full"
              >
                <option value="">Select</option>
                {INDIAN_STATES.map((s) => (
                  <option key={s.code} value={s.code}>{stateLabel(s.code)}</option>
                ))}
              </Select>
            </Field>

            <Field label="Place of Supply" hint="The customer's state — this decides the GST split">
              <Select
                value={effectivePlace}
                onChange={(e) => set({ placeOfSupplyCode: e.target.value })}
                className="w-full"
              >
                <option value="">Select</option>
                {INDIAN_STATES.map((s) => (
                  <option key={s.code} value={s.code}>{stateLabel(s.code)}</option>
                ))}
              </Select>
            </Field>

            <GstinField
              value={form.gstin}
              placeholder={customer?.b2bAccount?.gstin ?? '09AAAAA0000A1Z5'}
              hint="Leave empty for a consumer"
              onChange={(gstin, info) =>
                set({
                  gstin,
                  ...(info.complete && !form.placeOfSupplyCode ? { placeOfSupplyCode: info.stateCode } : {}),
                })
              }
            />

            <div className="sm:col-span-2">
              <Field label="Subject" hint="Let your customer know what this invoice is for">
                <Input
                  value={form.subject}
                  onChange={(e) => set({ subject: e.target.value })}
                />
              </Field>
            </div>
          </div>
        </Card>

        <Card padded={false}>
          <div className="flex flex-wrap items-center gap-4 border-b border-border p-4">
            <Field label="Tax treatment">
              <Select
                value={form.taxTreatment}
                onChange={(e) => changeTaxTreatment(e.target.value)}
              >
                <option value="EXCLUSIVE">Rates exclude GST</option>
                <option value="INCLUSIVE">Rates include GST</option>
              </Select>
            </Field>
            <Field label="Discount">
              <Select
                value={form.discountLevel}
                onChange={(e) => set({ discountLevel: e.target.value })}
              >
                <option value="TRANSACTION">On the total</option>
                <option value="LINE_ITEM">On each line</option>
              </Select>
            </Field>
            <span className="ml-auto rounded px-2 py-1 text-xs font-medium ring-1 ring-inset ring-gold/40">
              {intraState ? 'CGST + SGST' : 'IGST'}
            </span>
          </div>

          <Table dense minWidth={hasMrp ? '1000px' : '900px'}>
            <thead>
              <tr>
                <Th>ITEM DETAILS</Th>
                <Th className="text-right">QUANTITY</Th>
                {hasMrp && <Th className="text-right">MRP</Th>}
                <Th className="text-right">SELLING PRICE</Th>
                {hasMrp && <Th className="text-right">OFF MRP</Th>}
                {perLineDiscount && <Th className="text-right">DISCOUNT</Th>}
                <Th>TAX</Th>
                <Th className="text-right">AMOUNT</Th>
                <Th />
              </tr>
            </thead>
            <tbody>
              {lines.length === 0 && <EmptyRow colSpan={(perLineDiscount ? 7 : 6) + (hasMrp ? 2 : 0)} />}
              {lines.map((l, i) => (
                <Fragment key={i}>
                  {addedOrders.length > 0 && (i === 0 || groupKey(l) !== groupKey(lines[i - 1])) && (
                    <tr className="bg-gold-soft/60">
                      <td
                        colSpan={(perLineDiscount ? 7 : 6) + (hasMrp ? 2 : 0)}
                        className="px-3 py-1.5 text-xs font-semibold uppercase tracking-wide text-gold-ink"
                      >
                        <div className="flex items-center gap-3">
                          {groupLabel(l)}
                          {l.orderId && l.orderId !== form.orderId && (
                            <button
                              type="button"
                              onClick={() => removeOrder(l.orderId as string)}
                              className="ml-auto text-[11px] font-medium normal-case tracking-normal text-muted-foreground hover:text-destructive"
                            >
                              Take off this invoice
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  )}
                  <tr>
                    <Td>
                      <ItemSelect
                        value={l.variantId ? `${COMBO_PREFIX}${l.variantId}` : l.itemId}
                        items={[...items, ...combos]}
                        onChange={(v) => pickItem(i, v)}
                        className="mb-1 w-full min-w-[240px]"
                      />
                      {l.mrp && Number(l.mrp) > 0 && (
                        <OffMrpNote mrp={l.mrp} rate={l.rate} inclusive={inclusive} taxPercent={pctOf(l)} className="mb-1" />
                      )}
                      <Input
                        value={l.itemName}
                        onChange={(e) => setLine(i, { itemName: e.target.value })}
                        placeholder="or type a name"
                        className="min-w-[240px]"
                      />
                      <Textarea
                        rows={2}
                        value={l.description}
                        onChange={(e) => setLine(i, { description: e.target.value })}
                        placeholder="Add a description to your item"
                        className="mt-1 min-w-[240px] text-xs"
                      />
                      {l.itemId ? (
                        l.hsnCode && (
                          <p className="mt-1 text-[11px] text-muted-foreground">HSN {l.hsnCode}</p>
                        )
                      ) : (
                        <Input
                          value={l.hsnCode}
                          onChange={(e) => setLine(i, { hsnCode: e.target.value })}
                          placeholder="HSN or SAC"
                          aria-label="HSN or SAC code for this line"
                          className="mt-1 w-32 font-mono text-xs"
                        />
                      )}
                    </Td>
                    <Td>
                      <Input
                        type="number" step="0.01" min="0"
                        value={l.quantity}
                        onChange={(e) => setLine(i, { quantity: e.target.value })}
                        className="w-20 text-right"
                      />
                    </Td>
                    {hasMrp && (
                      <Td className="whitespace-nowrap text-right text-xs">
                        {l.mrp && Number(l.mrp) > 0 ? money(Number(l.mrp)) : '—'}
                      </Td>
                    )}
                    <Td>
                      <Input
                        type="number" step="0.01" min="0"
                        value={l.rate}
                        onChange={(e) => setLine(i, { rate: e.target.value })}
                        className="w-24 text-right"
                      />
                    </Td>
                    {hasMrp && (
                      <Td className="whitespace-nowrap text-right text-xs">
                        <OffMrpCell mrp={l.mrp} rate={l.rate} inclusive={inclusive} taxPercent={pctOf(l)} />
                      </Td>
                    )}
                    {perLineDiscount && (
                      <Td>
                        <Input
                          type="number" step="0.01" min="0"
                          value={l.discountPercent}
                          onChange={(e) => setLine(i, { discountPercent: e.target.value })}
                          className="w-20 text-right"
                        />
                        <Select
                          value={l.discountUnit ?? '%'}
                          onChange={(e) => setLine(i, { discountUnit: e.target.value as '%' | '₹' })}
                          aria-label={`Discount in % or ${currencySymbol()}`}
                          className="mt-1 w-20"
                        >
                          <option value="%">%</option>
                          <option value="₹">{currencySymbol()}</option>
                        </Select>
                      </Td>
                    )}
                    <Td>
                      <Select
                        value={resolveSlab(l)?.id ?? ''}
                        onChange={(e) =>
                          setLine(i, { taxRateId: e.target.value, seededTaxPercent: undefined })
                        }
                        className="min-w-[150px]"
                      >
                        <option value="">Select a Tax</option>
                        {slabs.map((t) => (
                          <option key={t.id} value={t.id}>
                            {t.name} [{Number(t.rate)}%]
                          </option>
                        ))}
                      </Select>
                    </Td>
                    <Td className="whitespace-nowrap text-right font-medium">
                      {money(lineAmount(l))}
                    </Td>
                    <Td>
                      <button
                        type="button"
                        onClick={() => setLines((ls) => ls.filter((_, x) => x !== i))}
                        className="text-muted-foreground hover:text-destructive"
                        aria-label="Remove line"
                      >
                        ×
                      </button>
                    </Td>
                  </tr>
                </Fragment>
              ))}
            </tbody>
          </Table>

          <div className="border-t border-border p-3">
            <Button size="sm" onClick={() => setLines((ls) => [...ls, blankLine()])}>
              + Add line
            </Button>
          </div>

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
                <dd className="font-medium">{money(subTotal + itemDiscounts)}</dd>
              </div>

              <MrpTotalRows lines={mrpLines} headerDiscountRatio={headerDiscountRatio} />

              {perLineDiscount && itemDiscounts > 0 && (
                <div className="flex items-center justify-between">
                  <dt className="text-muted-foreground">Item discounts{pctSuffix(itemDiscounts, grossBeforeLineDiscount)}</dt>
                  <dd className="w-24 text-right">-{money(itemDiscounts)}</dd>
                </div>
              )}

              {!perLineDiscount && (
                <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-2">
                  <dt className="text-muted-foreground">Discount{form.discountUnit === '₹' ? pctSuffix(headerDiscount, subTotal) : ''}</dt>
                  <dd className="flex flex-wrap items-center justify-end gap-2">
                    <Input
                      type="number" step="0.01" min="0"
                      value={form.discountPercent}
                      onChange={(e) => set({ discountPercent: e.target.value })}
                      className="w-24 text-right"
                    />
                    <Select
                      value={form.discountUnit}
                      onChange={(e) => set({ discountUnit: e.target.value as '%' | '₹' })}
                      aria-label={`Discount in % or ${currencySymbol()}`}
                      className="w-16"
                    >
                      <option value="%">%</option>
                      <option value="₹">{currencySymbol()}</option>
                    </Select>
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
                  <dd className="w-24 text-right text-muted-foreground">{money(0)}</dd>
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

              <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-2">
                <dt className="text-muted-foreground">Shipping Charge</dt>
                <dd className="flex flex-wrap items-center justify-end gap-2">
                  <Input
                    type="number" step="0.01" min="0"
                    value={form.shippingCharge}
                    onChange={(e) => set({ shippingCharge: e.target.value })}
                    className="w-28 text-right"
                  />
                  <span className="w-24 text-right">
                    {money(Number(form.shippingCharge || 0))}
                  </span>
                </dd>
              </div>
              {form.codCharge !== '' && (
                <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-2">
                  <dt className="text-muted-foreground">COD Charge</dt>
                  <dd className="flex flex-wrap items-center justify-end gap-2">
                    <Input
                      type="number" step="0.01" min="0"
                      value={form.codCharge}
                      onChange={(e) => set({ codCharge: e.target.value })}
                      className="w-28 text-right"
                    />
                    <span className="w-24 text-right">{money(Number(form.codCharge || 0))}</span>
                  </dd>
                </div>
              )}

              <TaxWithholdingRow
                kind={form.taxWithholdingType}
                taxId={form.taxWithholdingTaxId}
                amount={withholdingAmount}
                money={money}
                onKindChange={(k) => set({ taxWithholdingType: k, taxWithholdingTaxId: '' })}
                onTaxChange={(id) => set({ taxWithholdingTaxId: id })}
              />

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

              {printPrevious && dues && (
                <div className="space-y-1 rounded-md bg-muted/60 px-3 py-2 text-xs">
                  <div className="flex justify-between">
                    <dt className="text-muted-foreground">Previous balance</dt>
                    <dd className="tabular-nums">{money(dues.dues)}</dd>
                  </div>
                  {dues.credits > 0 && (
                    <div className="flex justify-between">
                      <dt className="text-muted-foreground">Less unused credits</dt>
                      <dd className="tabular-nums">-{money(dues.credits)}</dd>
                    </div>
                  )}
                  <div className="flex justify-between font-medium">
                    <dt>Total payable</dt>
                    <dd className="tabular-nums">{money(dues.net + grandTotal)}</dd>
                  </div>
                </div>
              )}

              <p className="pt-1 text-xs text-muted-foreground">
                Final figures are worked out again when you save.
              </p>
            </dl>
          </div>
        </Card>

        <div className="grid gap-5 lg:grid-cols-2">
          <Card>
            <Field label="Customer Notes" hint="Printed on the invoice">
              <Textarea
                rows={4}
                value={form.customerNotes}
                onChange={(e) => set({ customerNotes: e.target.value })}
              />
            </Field>
          </Card>
          <Card>
            <Field label="Terms & Conditions">
              <Textarea rows={4} value={form.terms} onChange={(e) => set({ terms: e.target.value })} />
            </Field>

            <div className="mt-5 border-t border-border pt-4">
              <span className="mb-1 block text-xs font-medium text-muted-foreground">
                Attach File(s) to Invoice
              </span>
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
                You can upload a maximum of {MAX_ATTACHMENTS} files, 10MB each.
                {isEdit ? '' : ' They attach once the invoice is saved.'}
              </p>
              {attachments.length > 0 && (
                <ul className="mt-3 space-y-1.5">
                  {attachments.map((f, i) => (
                    <li
                      key={`${f.url}-${i}`}
                      className="flex items-center justify-between rounded-md border border-border px-2.5 py-1.5 text-xs"
                    >
                      <span className="truncate text-foreground">
                        {f.fileName}
                      </span>
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
            </div>
          </Card>
        </div>
      </div>

      <SaveBar>
        <Button onClick={() => submit('DRAFT')} disabled={saving}>
          {saving && <Spinner />}
          Save as Draft
        </Button>
        <Button
          variant="primary"
          onClick={() => submit('SENT')}
          disabled={saving}
          title="Marks it sent and emails the PDF to the customer, when email is set up and switched on"
        >
          {saving && <Spinner />}
          Save and Send
        </Button>
        <Button variant="ghost" onClick={() => router.back()}>Cancel</Button>
        <span className="ml-auto text-sm text-muted-foreground">
          Total <strong className="text-foreground">{money(grandTotal)}</strong>
        </span>
      </SaveBar>
    </>
  );
}
