'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { api, money, errorMessage, type Paged, todayIso, currencySymbol, shortDate } from '@/lib/api';
import { priceAs, switchRate, type RateMemo } from '@/lib/items';
import { CustomerSelect } from './CustomerSelect';
import { useDefaultTerms } from '@/lib/documentTerms';
import { useSaveNav, SaveStalled } from '@/lib/useSaveNav';
import { RoundOffRow } from '@/components/RoundOffRow';
import { resolveRoundOff, type RoundOffMode } from '@/lib/roundOff';
import { taxBreakdown } from '@/lib/taxBreakdown';
import { INDIAN_STATES, stateLabel } from '@/lib/states';
import { AccountSelect } from '@/components/AccountSelect';
import { FileUpload, type Uploaded } from '@/components/FileUpload';
import { TaxWithholdingRow, type WithholdingKind } from '@/components/TaxWithholding';
import {
  Button, Card, EmptyRow, ErrorBox, Field, Input, PageHeader,
  Select, Table, Td, Textarea, Th, Spinner,
} from '@/components/ui';
import { ItemSelect } from './ItemSelect';
import { COMBO_PREFIX, comboVariantOf, loadComboChoices, type ComboChoice } from '@/lib/combos';
import { SaveBar } from './form/SaveBar';
import { PageCrumb } from '@/lib/crumbs';

type Address = {
  type?: string; attention?: string | null; line1?: string | null; line2?: string | null;
  city?: string | null; state?: string | null; stateCode?: string | null;
  pincode?: string | null; country?: string | null; phone?: string | null;
};

type Customer = {
  id: string;
  displayName: string | null;
  b2bAccount?: {
    companyName: string | null; gstin: string | null;
    gstTreatment: string | null; placeOfSupplyCode: string | null;
  } | null;
};

type Location = { id: string; name: string; isDefault: boolean; stateCode?: string | null };
type Item = {
  id: string; name: string; sku: string | null; unit: string;
  hsnCode: string | null; sellingPrice: string | null; sellingTaxTreatment?: string | null;
  imageUrls?: string[];
};
type TaxRate = { id: string; name: string; rate: string; type: string; isDefault: boolean };
type InvoiceOption = { id: string; invoiceNumber: string; invoiceDate: string; grandTotal?: string | number | null };

const GST_TREATMENT: Record<string, string> = {
  REGISTERED_REGULAR: 'Registered Business — Regular',
  REGISTERED_COMPOSITION: 'Registered Business — Composition',
  UNREGISTERED: 'Unregistered Business',
  CONSUMER: 'Consumer',
  OVERSEAS: 'Overseas',
  SEZ: 'SEZ',
};

const REASONS: { value: string; label: string }[] = [
  { value: 'SALES_RETURN', label: 'Sales Return' },
  { value: 'POST_SALE_DISCOUNT', label: 'Post Sale Discount' },
  { value: 'DEFICIENCY_IN_SERVICE', label: 'Deficiency in service' },
  { value: 'CORRECTION_IN_INVOICE', label: 'Correction in invoice' },
  { value: 'CHANGE_IN_POS', label: 'Change in POS' },
  { value: 'FINALIZATION_OF_PROVISIONAL_ASSESSMENT', label: 'Finalization of Provisional assessment' },
  { value: 'OTHERS', label: 'Others' },
];

const INVOICE_TYPES: { value: string; label: string; hint: string }[] = [
  { value: 'REGISTERED', label: 'Registered', hint: 'Customer is a registered business — regular or composition' },
  { value: 'DEEMED_EXPORT', label: 'Deemed Export', hint: 'Customer GST treatment is Deemed Export' },
  { value: 'SEZ_WITH_PAYMENT', label: 'SEZ With Payment', hint: 'SEZ unit, tax paid without a LUT bond' },
  { value: 'SEZ_WITHOUT_PAYMENT', label: 'SEZ Without Payment', hint: 'SEZ unit, supplied under a LUT bond' },
  { value: 'EXPORT_WITH_PAYMENT', label: 'Export With Payment', hint: 'Overseas, tax paid' },
  { value: 'EXPORT_WITHOUT_PAYMENT', label: 'Export Without Payment', hint: 'Overseas, under a LUT bond' },
  { value: 'B2C_LARGE', label: 'B2C Large', hint: 'Unregistered, inter-state, above the threshold' },
  { value: 'B2C_OTHERS', label: 'B2C Others', hint: 'Everything else unregistered' },
];

const MAX_ATTACHMENTS = 5;

type LineDraft = {
  itemId: string;
  variantId?: string;
  itemName: string;
  description: string;
  account: string;
  hsnCode: string;
  unit: string;
  quantity: string;
  rate: string;
  discountPercent: string;
  discountUnit?: '%' | '₹';
  flatFor?: { quantity: number; amount: number };
  taxRateId: string;
  seededTaxPercent?: number;
  packSize?: number;
  rateMemo?: RateMemo;
};

type InvoiceSeed = {
  invoiceId: string; invoiceNumber: string; invoiceDate: string;
  customerId: string | null; locationId: string | null;
  placeOfSupplyCode: string | null; sourceOfSupplyCode: string | null;
  gstin: string | null; taxTreatment: string; discountLevel: string;
  discountPercent: string | null; discountTotal?: string | null; terms: string | null;
  shippingCharge?: string | null;
  codCharge?: string | null;
  adjustment?: string | null;
  adjustmentLabel?: string | null;
  roundOff?: string | null;
  lines: {
    itemId: string | null; variantId?: string | null; itemName: string; description: string | null;
    sku: string | null; hsnCode: string | null; unit: string;
    quantity: number; rate: number; discountPercent: number | null; discountAmount?: number | null; taxRate: number;
    packSize?: number;
  }[];
};

export type ExistingCreditNote = {
  id: string;
  creditNumber: string;
  customerId: string;
  invoiceId: string | null;
  returnId: string | null;
  invoiceType: string | null;
  locationId: string | null;
  warehouseLocationId: string | null;
  creditDate: string;
  reason: string | null;
  referenceNumber: string | null;
  subject: string | null;
  sourceOfSupplyCode: string | null;
  placeOfSupplyCode: string | null;
  gstin: string | null;
  taxTreatment: string;
  discountLevel: string;
  discountPercent: string | null;
  discountTotal?: string;
  taxWithholdingType: string | null;
  shippingCharge: string;
  codCharge?: string;
  adjustment: string;
  adjustmentLabel: string;
  customerNotes: string | null;
  roundOff?: string;
  roundOffManual?: boolean;
  terms: string | null;
  lines: {
    itemId: string | null; variantId?: string | null; itemName: string; description: string | null;
    account: string | null; hsnCode: string | null; unit: string;
    quantity: string; rate: string; discountPercent: string | null; discountAmount?: string; taxRate: string;
    packSize?: number;
  }[];
};

const blankLine = (): LineDraft => ({
  itemId: '', itemName: '', description: '', account: '', hsnCode: '', unit: 'pcs',
  quantity: '1', rate: '0', discountPercent: '', taxRateId: '',
});

export function CreditNoteForm({ existing }: { existing?: ExistingCreditNote }) {
  const router = useRouter();
  const params = useSearchParams();
  const isEdit = !!existing;

  const fromInvoiceId = params.get('invoiceId');
  const fromReturnId = params.get('returnId');
  const fromCustomerId = isEdit ? null : params.get('customerId');

  const [customers, setCustomers] = useState<Customer[]>([]);
  const [locations, setLocations] = useState<Location[]>([]);
  const [items, setItems] = useState<Item[]>([]);
  const [combos, setCombos] = useState<ComboChoice[]>([]);
  const [taxRates, setTaxRates] = useState<TaxRate[]>([]);
  const [invoices, setInvoices] = useState<InvoiceOption[]>([]);
  const [addresses, setAddresses] = useState<Address[]>([]);
  const [attachments, setAttachments] = useState<Uploaded[]>([]);
  const [orgState, setOrgState] = useState<string | null>(null);
  const [roundOffMode, setRoundOffMode] = useState<RoundOffMode>('NEAREST_1');

  const [error, setError] = useState('');
  const { saving, stalledHref, begin: beginSave, done: doneSave, fail: failSave } =
    useSaveNav();
  const [seeding, setSeeding] = useState((!!fromInvoiceId || !!fromReturnId) && !existing);

  const [form, setForm] = useState({
    customerId: existing?.customerId ?? fromCustomerId ?? '',
    invoiceId: existing?.invoiceId ?? '',
    returnId: existing?.returnId ?? '',
    invoiceType: existing?.invoiceType ?? '',
    locationId: existing?.locationId ?? '',
    warehouseLocationId: existing?.warehouseLocationId ?? '',
    creditDate: (existing?.creditDate ?? todayIso()).slice(0, 10),
    reason: existing?.reason ?? '',
    referenceNumber: existing?.referenceNumber ?? '',
    subject: existing?.subject ?? '',
    sourceOfSupplyCode: existing?.sourceOfSupplyCode ?? '',
    placeOfSupplyCode: existing?.placeOfSupplyCode ?? '',
    gstin: existing?.gstin ?? '',
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
    customerNotes: existing?.customerNotes ?? '',
    terms: existing?.terms ?? '',
  });
  const set = (patch: Partial<typeof form>) => setForm((f) => ({ ...f, ...patch }));
  useDefaultTerms('credit_note', !isEdit, (terms) => setForm((f) => (f.terms ? f : { ...f, terms })));

  const [lines, setLines] = useState<LineDraft[]>(() =>
    existing?.lines.length
      ? existing.lines.map((l) => ({
          itemId: l.itemId ?? '',
          variantId: l.variantId ?? '',
          itemName: l.itemName,
          description: l.description ?? '',
          account: l.account ?? '',
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
        }))
      : [blankLine()]
  );

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
        if (org?.data?.roundOffMode) setRoundOffMode(org.data.roundOffMode);
        loadComboChoices().then((list) => {
          if (!cancelled) setCombos(list);
        });
        setForm((f) => (f.taxTreatment ? f : { ...f, taxTreatment: org?.data?.defaultTaxTreatment ?? 'INCLUSIVE' }));
        if (!existing) {
          const def = loc.data.find((l) => l.isDefault) ?? loc.data[0];
          if (def) {
            setForm((f) => ({
              ...f,
              locationId: f.locationId || def.id,
              warehouseLocationId: f.warehouseLocationId || def.id,
            }));
          }
        }
      } catch (err) {
        if (!cancelled) setError(errorMessage(err));
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [existing]);

  useEffect(() => {
    if (!fromReturnId || isEdit) return;
    let cancelled = false;
    (async () => {
      try {
        const r = await api.get<{
          data: {
            returnId: string; returnNumber: string;
            orderId: string; orderNumber: string;
            customerId: string | null; locationId: string | null;
            placeOfSupplyCode: string | null; sourceOfSupplyCode: string | null;
            gstin: string | null; taxTreatment: string; reason: string;
            lines: {
              itemId: string | null; itemName: string; sku: string | null;
              hsnCode: string | null; quantity: number; rate: number; taxRate: number;
              packSize?: number;
            }[];
          };
        }>(`/returns/${fromReturnId}/for-credit-note`);
        if (cancelled) return;
        const d = r.data;
        setForm((f) => ({
          ...f,
          returnId: d.returnId,
          customerId: d.customerId ?? f.customerId,
          locationId: d.locationId ?? f.locationId,
          placeOfSupplyCode: d.placeOfSupplyCode ?? f.placeOfSupplyCode,
          sourceOfSupplyCode: d.sourceOfSupplyCode ?? f.sourceOfSupplyCode,
          gstin: d.gstin ?? f.gstin,
          taxTreatment: d.taxTreatment ?? f.taxTreatment,
          reason: d.reason || 'SALES_RETURN',
          subject: f.subject || `Against ${d.returnNumber} (order ${d.orderNumber})`,
        }));
        if (d.lines.length) {
          setLines(
            d.lines.map((l) => ({
              itemId: l.itemId ?? '',
              itemName: l.itemName,
              description: '',
              account: '',
              hsnCode: l.hsnCode ?? '',
              unit: 'pcs',
              quantity: String(l.quantity),
              rate: String(l.rate),
              discountPercent: '',
              taxRateId: '',
              seededTaxPercent: l.taxRate,
              packSize: l.packSize ?? 1,
            }))
          );
        }
      } catch (err) {
        if (!cancelled) setError(errorMessage(err));
      } finally {
        if (!cancelled) setSeeding(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [fromReturnId, isEdit]);

  function applyInvoiceSeed(d: InvoiceSeed) {
    setInvoices((list) =>
      list.some((i) => i.id === d.invoiceId)
        ? list
        : [...list, { id: d.invoiceId, invoiceNumber: d.invoiceNumber, invoiceDate: d.invoiceDate } as InvoiceOption]
    );
    const flatHeader = d.discountLevel === 'TRANSACTION' && !Number(d.discountPercent ?? 0) && Number(d.discountTotal ?? 0) > 0;
    setForm((f) => ({
      ...f,
      invoiceId: d.invoiceId,
      customerId: d.customerId ?? f.customerId,
      locationId: d.locationId ?? f.locationId,
      placeOfSupplyCode: d.placeOfSupplyCode ?? f.placeOfSupplyCode,
      sourceOfSupplyCode: d.sourceOfSupplyCode ?? f.sourceOfSupplyCode,
      gstin: d.gstin ?? f.gstin,
      taxTreatment: d.taxTreatment ?? f.taxTreatment,
      discountLevel: d.discountLevel ?? f.discountLevel,
      discountPercent: flatHeader ? String(Number(d.discountTotal)) : d.discountPercent ? String(Number(d.discountPercent)) : '',
      discountUnit: flatHeader ? '₹' : '%',
      shippingCharge: String(Number(d.shippingCharge ?? 0) || ''),
      codCharge: String(Number(d.codCharge ?? 0) || ''),
      adjustment: String(Number(d.adjustment ?? 0) || ''),
      adjustmentLabel: d.adjustmentLabel || f.adjustmentLabel,
      roundOff: d.roundOff != null ? String(Number(d.roundOff)) : '',
      terms: f.terms,
      reason: f.reason || 'SALES_RETURN',
    }));
    if (d.lines.length) {
      setLines(
        d.lines.map((l) => ({
          itemId: l.itemId ?? '',
          variantId: l.variantId ?? '',
          itemName: l.itemName,
          description: l.description ?? '',
          account: '',
          hsnCode: l.hsnCode ?? '',
          unit: l.unit || 'pcs',
          quantity: String(l.quantity),
          rate: String(l.rate),
          discountPercent: l.discountPercent
            ? String(l.discountPercent)
            : Number(l.discountAmount ?? 0) > 0
              ? String(l.discountAmount)
              : '',
          discountUnit: (!l.discountPercent && Number(l.discountAmount ?? 0) > 0 ? '₹' : '%') as '%' | '₹',
          ...(!l.discountPercent && Number(l.discountAmount ?? 0) > 0 && {
            flatFor: { quantity: Number(l.quantity), amount: Number(l.discountAmount) },
          }),
          taxRateId: '',
          seededTaxPercent: l.taxRate,
          packSize: l.packSize ?? 1,
        }))
      );
    }
  }

  async function pickInvoice(invoiceId: string) {
    set({ invoiceId });
    if (!invoiceId) return;
    try {
      const r = await api.get<{ data: InvoiceSeed }>(`/credit-notes/from-invoice/${invoiceId}`);
      applyInvoiceSeed(r.data);
    } catch (err) {
      setError(errorMessage(err));
    }
  }

  useEffect(() => {
    if (!fromInvoiceId || isEdit) return;
    let cancelled = false;
    api
      .get<{ data: InvoiceSeed }>(`/credit-notes/from-invoice/${fromInvoiceId}`)
      .then((r) => {
        if (!cancelled) applyInvoiceSeed(r.data);
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
  }, [fromInvoiceId, isEdit]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!form.customerId) {
        setAddresses([]);
        return;
      }
      const [c, inv] = await Promise.all([
        api.get<{ data: { addresses?: Address[] } }>(`/customers/${form.customerId}`).catch(() => null),
        api
          .get<Paged<InvoiceOption>>('/invoices', { customerId: form.customerId, limit: 100 })
          .catch(() => null),
      ]);
      if (cancelled) return;
      setAddresses(c?.data?.addresses ?? []);
      if (inv?.data?.length) setInvoices(inv.data);
    })();
    return () => {
      cancelled = true;
    };
  }, [form.customerId]);

  const customer = customers.find((c) => c.id === form.customerId) ?? null;
  const location = locations.find((l) => l.id === form.locationId) ?? null;
  const billing = addresses.find((a) => a.type === 'BILLING') ?? addresses[0] ?? null;

  const source = form.sourceOfSupplyCode || location?.stateCode || orgState || '';
  const place =
    form.placeOfSupplyCode || customer?.b2bAccount?.placeOfSupplyCode || billing?.stateCode || '';
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
    setLines((ls) =>
      ls.map((l, x) => {
        if (x !== i) return l;
        const next = { ...l, ...patch };
        if (patch.discountPercent !== undefined || patch.discountUnit !== undefined) return { ...next, flatFor: undefined };
        if (patch.quantity !== undefined && next.flatFor && next.discountUnit === '₹' && next.flatFor.quantity > 0) {
          const scaled = (next.flatFor.amount * Number(patch.quantity || 0)) / next.flatFor.quantity;
          return { ...next, discountPercent: scaled > 0 ? String(Math.round(scaled * 100) / 100) : '' };
        }
        return next;
      })
    );

  function pickItem(i: number, picked: string) {
    const comboId = comboVariantOf(picked);
    const itemId = comboId ? '' : picked;
    const it: Item | ComboChoice | undefined = comboId
      ? combos.find((c) => c.id === picked)
      : items.find((x) => x.id === picked);
    setLine(i, {
      itemId,
      variantId: comboId ?? '',
      packSize: 1,
      ...(it && {
        itemName: it.name,
        hsnCode: it.hsnCode ?? '',
        unit: it.unit,
        rate: it.sellingPrice
          ? String(priceAs(it.sellingPrice, it.sellingTaxTreatment, form.taxTreatment || 'INCLUSIVE', pctOf(lines[i])))
          : '0',
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

  const returnsStock = form.reason === 'SALES_RETURN' && lines.some((l) => l.itemId);

  async function submit(status: 'DRAFT' | 'OPEN') {
    setError('');
    if (!form.customerId) return setError('Pick a customer');
    const usable = lines.filter((l) => l.itemName.trim() && Number(l.quantity) > 0);
    if (!usable.length) return setError('Add at least one line');
    if (status === 'OPEN' && returnsStock && !form.warehouseLocationId && !form.locationId) {
      return setError('Pick the warehouse the returned goods are coming back to');
    }
    if (Math.abs(rounding.value) > 1) return setError('Round off must be between -1 and 1');

    const blank = isEdit ? null : undefined;
    const body = {
      customerId: form.customerId,
      invoiceId: form.invoiceId || blank,
      invoiceType: form.invoiceType || blank,
      locationId: form.locationId || blank,
      warehouseLocationId: form.warehouseLocationId || blank,
      creditDate: form.creditDate,
      reason: form.reason || blank,
      referenceNumber: form.referenceNumber.trim() || blank,
      subject: form.subject.trim() || blank,
      returnId: form.returnId || undefined,
      sourceOfSupplyCode: source || blank,
      placeOfSupplyCode: effectivePlace || blank,
      gstin: form.gstin.trim() || blank,
      taxTreatment: form.taxTreatment || 'INCLUSIVE',
      discountLevel: form.discountLevel,
      discountPercent: form.discountUnit === '%' ? Number(form.discountPercent || 0) : 0,
      discountAmount: form.discountUnit === '₹' ? Number(form.discountPercent || 0) : 0,
      taxWithholdingType: form.taxWithholdingType || null,
      taxWithholdingTaxId: form.taxWithholdingTaxId || null,
      shippingCharge: Number(form.shippingCharge || 0),
      codCharge: Number(form.codCharge || 0),
      adjustment: Number(form.adjustment || 0),
      adjustmentLabel: form.adjustmentLabel.trim() || 'Adjustment',
      roundOff: rounding.payload,
      status,
      customerNotes: form.customerNotes.trim() || blank,
      terms: form.terms.trim() || blank,
      lines: usable.map((l) => ({
        itemId: l.itemId || null,
        variantId: l.variantId || null,
        itemName: l.itemName.trim(),
        description: l.description.trim() || undefined,
        account: l.account.trim() || undefined,
        hsnCode: l.hsnCode.trim() || undefined,
        unit: l.unit || 'pcs',
        quantity: Number(l.quantity),
        packSize: l.packSize ?? 1,
        rate: Number(l.rate),
        discountPercent: perLineDiscount && l.discountUnit !== '₹' ? Number(l.discountPercent || 0) : null,
        discountAmount: perLineDiscount && l.discountUnit === '₹' ? Number(l.discountPercent || 0) : null,
        taxRate: pctOf(l),
      })),
    };

    beginSave();
    try {
      const creditId = isEdit
        ? (await api.patch<{ data: { id: string } }>(`/credit-notes/${existing.id}`, body)).data.id
        : (await api.post<{ data: { id: string } }>('/credit-notes', body)).data.id;

      for (const f of attachments) {
        await api
          .post('/shared/attachments', {
            ownerType: 'CREDIT_NOTE',
            ownerId: creditId,
            fileName: f.fileName,
            fileUrl: f.url,
            mimeType: f.mimeType,
            sizeBytes: f.sizeBytes,
          })
          .catch(() => {});
      }

      doneSave(`/credit-notes/${creditId}`);
    } catch (err) {
      setError(errorMessage(err));
      failSave();
    }
  }

  if (seeding) {
    return (
      <div className="flex items-center gap-2 p-8 text-sm text-muted-foreground">
        <Spinner /> Loading the invoice…
      </div>
    );
  }

  return (
    <>
      <PageCrumb label={isEdit ? existing.creditNumber : 'New'} />

      <PageHeader title={isEdit ? `Edit ${existing.creditNumber}` : 'New Credit Note'} />

      <SaveStalled href={stalledHref} />

      {error && <div className="mb-4"><ErrorBox message={error} /></div>}

      <div className="space-y-5">
        <Card>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <Field label="Customer Name" required>
              <CustomerSelect
                value={form.customerId}
                customers={customers}
                disabled={isEdit}
                onChange={(customerId, picked) => {
                if (picked && !customers.some((c) => c.id === picked.id)) setCustomers((cs) => [...cs, picked]);
                  set({ customerId, invoiceId: '' });
                }}
              />
            </Field>

            {billing && (
              <div className="text-xs leading-5 text-muted-foreground sm:col-span-2">
                <div className="mb-1 font-medium text-muted-foreground">
                  BILLING ADDRESS
                </div>
                <p className="font-medium text-foreground">
                  {customer?.displayName}
                </p>
                {[
                  billing.line1,
                  billing.line2,
                  billing.city,
                  [billing.state, billing.pincode].filter(Boolean).join(' '),
                  billing.country,
                ]
                  .filter(Boolean)
                  .map((l, i) => (
                    <p key={i}>{l}</p>
                  ))}
                {billing.phone && <p>Phone: {billing.phone}</p>}
                {customer?.b2bAccount?.gstTreatment && (
                  <p className="mt-2">
                    GST Treatment:{' '}
                    <span className="text-foreground">
                      {GST_TREATMENT[customer.b2bAccount.gstTreatment] ?? '—'}
                    </span>
                  </p>
                )}
              </div>
            )}

            <Field label="Location" hint="Sets the source of supply">
              <Select
                value={form.locationId}
                onChange={(e) =>
                  set({
                    locationId: e.target.value,
                    ...(!form.warehouseLocationId || form.warehouseLocationId === form.locationId
                      ? { warehouseLocationId: e.target.value }
                      : {}),
                  })
                }
                className="w-full"
              >
                <option value="">Select a location…</option>
                {locations.map((l) => (
                  <option key={l.id} value={l.id}>{l.name}</option>
                ))}
              </Select>
            </Field>

            <Field label="Place of Supply" required hint="The customer's state — decides the GST split">
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

            <Field label="Source of Supply" hint="Our state">
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

            <Field label="Invoice#" hint="The invoice this note corrects, if there is one">
              <Select
                value={form.invoiceId}
                onChange={(e) => pickInvoice(e.target.value)}
                className="w-full"
                disabled={!form.customerId}
              >
                <option value="">Not against an invoice</option>
                {invoices.map((i) => (
                  <option key={i.id} value={i.id}>
                    {[i.invoiceNumber, i.invoiceDate ? shortDate(i.invoiceDate) : null, i.grandTotal != null ? money(i.grandTotal) : null]
                      .filter(Boolean)
                      .join(' · ')}
                  </option>
                ))}
              </Select>
            </Field>

            <Field label="Invoice Type" hint="Which GSTR-1 table this belongs in">
              <Select
                value={form.invoiceType}
                onChange={(e) => set({ invoiceType: e.target.value })}
                className="w-full"
              >
                <option value="">Not set</option>
                {INVOICE_TYPES.map((t) => (
                  <option key={t.value} value={t.value}>{t.label} — {t.hint}</option>
                ))}
              </Select>
            </Field>

            <Field
              label="Reason"
              hint={
                form.reason === 'SALES_RETURN'
                  ? 'Goods come back on the shelf when this is saved as open'
                  : 'Only a Sales Return moves stock'
              }
            >
              <Select
                value={form.reason}
                onChange={(e) => set({ reason: e.target.value })}
                className="w-full"
              >
                <option value="">Select a reason…</option>
                {REASONS.map((r) => (
                  <option key={r.value} value={r.value}>{r.label}</option>
                ))}
              </Select>
            </Field>

            <Field label="Credit Note#">
              <Input
                value={isEdit ? existing.creditNumber : ''}
                disabled
                placeholder="Reserved on save"
              />
            </Field>

            <Field label="Reference#">
              <Input
                value={form.referenceNumber}
                onChange={(e) => set({ referenceNumber: e.target.value })}
              />
            </Field>

            <Field label="Credit Note Date" required>
              <Input
                type="date"
                value={form.creditDate}
                onChange={(e) => set({ creditDate: e.target.value })}
              />
            </Field>

            {form.reason === 'SALES_RETURN' && (
              <Field
                label="Returned goods go to"
                required={returnsStock}
                hint="The warehouse the returned stock is added back to"
              >
                <Select
                  value={form.warehouseLocationId}
                  onChange={(e) => set({ warehouseLocationId: e.target.value })}
                  className="w-full"
                >
                  <option value="">Select a warehouse…</option>
                  {locations.map((l) => (
                    <option key={l.id} value={l.id}>{l.name}</option>
                  ))}
                </Select>
              </Field>
            )}

            <div className="sm:col-span-2">
              <Field label="Subject" hint="Let your customer know what this credit note is for">
                <Input value={form.subject} onChange={(e) => set({ subject: e.target.value })} />
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

          <Table dense minWidth={perLineDiscount ? '900px' : '820px'}>
            <thead>
              <tr>
                <Th>ITEM DETAILS</Th>
                <Th>ACCOUNT</Th>
                <Th className="text-right">QUANTITY</Th>
                <Th className="text-right">SELLING PRICE</Th>
                {perLineDiscount && <Th className="text-right">DISCOUNT</Th>}
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
                      value={l.variantId && !l.itemId ? `${COMBO_PREFIX}${l.variantId}` : l.itemId}
                      items={[...items, ...combos]}
                      onChange={(v) => pickItem(i, v)}
                      className="mb-1 w-full min-w-[188px] max-w-[212px]"
                    />
                    <Input
                      value={l.itemName}
                      onChange={(e) => setLine(i, { itemName: e.target.value })}
                      placeholder="or type a name"
                      className="min-w-[188px]"
                    />
                    <Textarea
                      rows={2}
                      value={l.description}
                      onChange={(e) => setLine(i, { description: e.target.value })}
                      placeholder="Add a description to your item"
                      className="mt-1 min-w-[188px] text-xs"
                    />
                    {l.hsnCode && (
                      <p className="mt-1 text-[11px] text-muted-foreground">
                        HSN {l.hsnCode}
                      </p>
                    )}
                  </Td>
                  <Td>
                    <AccountSelect
                      value={l.account}
                      onChange={(name) => setLine(i, { account: name })}
                      usage="sales"
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
                        type="number" step="0.01" min="0"
                        value={l.discountPercent}
                        onChange={(e) => setLine(i, { discountPercent: e.target.value })}
                        className="w-16 text-right"
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
                      className="min-w-[120px]"
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
              ))}
            </tbody>
          </Table>

          <div className="border-t border-border p-3">
            <Button size="sm" onClick={() => setLines((ls) => [...ls, blankLine()])}>
              + Add line
            </Button>
          </div>

          <div className="grid gap-4 border-t border-border p-4 lg:grid-cols-2 [&>*]:min-w-0">
            <div>
              {returnsStock && (
                <p className="text-xs text-muted-foreground">
                  This is a sales return with item lines, so saving it as open puts{' '}
                  <strong>{totalQuantity}</strong> unit(s) back on the shelf at{' '}
                  {locations.find((l) => l.id === form.warehouseLocationId)?.name ??
                    'the chosen warehouse'}
                  .
                </p>
              )}
            </div>
            <dl className="min-w-0 space-y-2.5 rounded-md bg-muted/60 p-4 text-sm">
              <div className="flex items-start justify-between">
                <dt className="font-medium text-foreground">
                  Sub Total
                  <span className="block text-xs font-normal text-muted-foreground">
                    {inclusive ? 'Rates include GST · ' : ''}Total Quantity : {totalQuantity}
                  </span>
                </dt>
                <dd className="font-medium">{money(subTotal + itemDiscounts)}</dd>
              </div>

              {perLineDiscount && itemDiscounts > 0 && (
                <div className="flex items-center justify-between">
                  <dt className="text-muted-foreground">Item discounts</dt>
                  <dd className="w-24 text-right">-{money(itemDiscounts)}</dd>
                </div>
              )}

              {!perLineDiscount && (
                <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-2">
                  <dt className="text-muted-foreground">Discount</dt>
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

              <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-2">
                <dt className="text-muted-foreground">Shipping Charges</dt>
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

              <p className="pt-1 text-xs text-muted-foreground">
                Final figures are worked out again when you save.
              </p>
            </dl>
          </div>
        </Card>

        <div className="grid gap-5 lg:grid-cols-2">
          <Card>
            <Field label="Customer Notes" hint="Printed on the credit note">
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
                Attach File(s) to Credit Note
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
                {isEdit ? '' : ' They attach once the credit note is saved.'}
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
        <Button variant="primary" onClick={() => submit('OPEN')} disabled={saving}>
          {saving && <Spinner />}
          Save as Open
        </Button>
        <Button variant="ghost" onClick={() => router.back()}>Cancel</Button>
        <span className="ml-auto text-sm text-muted-foreground">
          Total <strong className="text-foreground">{money(grandTotal)}</strong>
        </span>
      </SaveBar>
    </>
  );
}
