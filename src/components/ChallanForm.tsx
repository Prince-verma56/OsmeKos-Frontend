'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { api, money, errorMessage, type Paged, todayIso, currencySymbol, shortDate } from '@/lib/api';
import { useSaveNav, SaveStalled } from '@/lib/useSaveNav';
import { taxBreakdown } from '@/lib/taxBreakdown';
import { INDIAN_STATES, stateLabel } from '@/lib/states';
import {
  Button, Card, EmptyRow, ErrorBox, Field, Input, PageHeader,
  Select, Table, Td, Textarea, Th, Spinner,
} from '@/components/ui';
import { ItemSelect } from './ItemSelect';
import { COMBO_PREFIX, comboVariantOf, loadComboChoices, type ComboChoice } from '@/lib/combos';
import { itemLabel, priceAs, switchRate, type RateMemo } from '@/lib/items';
import { CustomerSelect } from './CustomerSelect';
import { GstinField } from './GstinField';
import { TransporterSelect } from './TransporterSelect';
import { SaveBar } from './form/SaveBar';
import { useDefaultTerms } from '@/lib/documentTerms';
import { PageCrumb } from '@/lib/crumbs';
import { MrpTotalRows, OffMrpCell, OffMrpNote } from '@/components/OffMrp';
import { pctSuffix } from '@/lib/mrp';

type Address = {
  type?: string; line1?: string | null; line2?: string | null;
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
  mrp?: string | null; discountPercent?: string | null;
  sizeValue?: string | null; sizeUnit?: string | null;
  intraStateTaxRate?: string | null;
};
type TaxRate = { id: string; name: string; rate: string; type: string; isDefault: boolean };
type OrderOption = { id: string; orderNumber: string };

const CHALLAN_TYPES: { value: string; label: string; hint: string }[] = [
  {
    value: 'JOB_WORK',
    label: 'Job Work',
    hint: 'Material sent to a processor and expected back',
  },
  {
    value: 'SUPPLY_ON_APPROVAL',
    label: 'Supply on Approval',
    hint: 'Goods the customer may keep or return',
  },
  {
    value: 'SAMPLES_MARKETING',
    label: 'Samples & Marketing',
    hint: 'Samples, testers or gifts sent out free of charge',
  },
  {
    value: 'STOCK_TRANSFER',
    label: 'Stock Transfer',
    hint: 'Goods moving between your own locations',
  },
  {
    value: 'OTHERS',
    label: 'Others',
    hint: 'Anything else moving ahead of the invoice',
  },
];

type LineDraft = {
  orderId?: string;
  orderNumber?: string;
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
  mrp?: string;
  rateMemo?: RateMemo;
};

type DocAddress = Record<string, string | null | undefined>;

type ChallanSeed = {
  orderId: string; orderNumber: string; customerId: string | null;
  referenceNumber: string | null;
  locationId: string | null; placeOfSupplyCode: string | null;
  gstin: string | null; taxTreatment: string; transporter: string | null;
  terms: string | null;
  shippingCharge?: string | null;
  codCharge?: string | null;
  adjustment?: string | null;
  discountLevel?: string | null;
  billingAddress?: DocAddress | null;
  shippingAddress?: DocAddress | null;
  lines: {
    orderId?: string | null;
    itemId: string | null; variantId?: string | null; itemName: string; sku: string | null;
    hsnCode: string | null; quantity: number; rate: number; taxRate: number;
    discountAmount?: number | null;
    mrp?: number | null;
  }[];
};

type WaitingOrder = ChallanSeed & {
  placedAt: string;
  grandTotal: string;
  fulfillmentStatus: string;
  shipsTo: string | null;
};

const addressKey = (a: DocAddress | null | undefined) => {
  if (!a) return null;
  const key = [a.line1, a.pincode].map((v) => String(v ?? '').toLowerCase().replace(/[^a-z0-9]/g, '')).join('|');
  return key === '|' ? null : key;
};

const seedLines = (d: ChallanSeed): LineDraft[] =>
  d.lines.map((l) => ({
    orderId: l.orderId ?? d.orderId,
    orderNumber: d.orderNumber,
    itemId: l.itemId ?? '',
    variantId: l.variantId ?? '',
    itemName: l.itemName,
    description: '',
    hsnCode: l.hsnCode ?? '',
    unit: 'pcs',
    quantity: String(l.quantity),
    rate: String(l.rate),
    discountPercent: l.discountAmount ? String(l.discountAmount) : '',
    discountUnit: l.discountAmount ? '₹' : '%',
    taxRateId: '',
    seededTaxPercent: l.taxRate,
    mrp: l.mrp != null ? String(l.mrp) : '',
  }));

export type ExistingChallan = {
  id: string;
  challanNumber: string;
  challanType: string;
  customerId: string;
  orderId: string | null;
  locationId: string | null;
  challanDate: string;
  referenceNumber: string | null;
  subject: string | null;
  sourceOfSupplyCode: string | null;
  placeOfSupplyCode: string | null;
  gstin: string | null;
  transporter: string | null;
  vehicleNumber: string | null;
  ewayBillNumber: string | null;
  taxTreatment: string;
  discountLevel: string;
  discountPercent: string | null;
  discountTotal?: string;
  billingAddress?: DocAddress | null;
  shippingAddress?: DocAddress | null;
  shippingCharge?: string;
  codCharge?: string;
  adjustment: string;
  adjustmentLabel: string;
  customerNotes: string | null;
  terms: string | null;
  orders?: { id: string; orderNumber: string }[];
  lines: {
    orderId?: string | null;
    itemId: string | null; variantId?: string | null; itemName: string; description: string | null;
    hsnCode: string | null; unit: string; quantity: string; rate: string;
    discountPercent: string | null; discountAmount?: string; taxRate: string; mrp?: string | null;
  }[];
};

const blankLine = (): LineDraft => ({
  itemId: '', itemName: '', description: '', hsnCode: '', unit: 'pcs',
  quantity: '1', rate: '0', discountPercent: '', taxRateId: '',
});

export function ChallanForm({ existing }: { existing?: ExistingChallan }) {
  const router = useRouter();
  const params = useSearchParams();
  const isEdit = !!existing;

  const fromOrderId = params.get('orderId');
  const fromCustomerId = isEdit ? null : params.get('customerId');

  const [customers, setCustomers] = useState<Customer[]>([]);
  const [locations, setLocations] = useState<Location[]>([]);
  const [items, setItems] = useState<Item[]>([]);
  const [combos, setCombos] = useState<ComboChoice[]>([]);
  const [taxRates, setTaxRates] = useState<TaxRate[]>([]);
  const [orders, setOrders] = useState<OrderOption[]>([]);
  const [seededOrder, setSeededOrder] = useState<OrderOption | null>(null);
  const [addresses, setAddresses] = useState<Address[]>([]);
  const [orgState, setOrgState] = useState<string | null>(null);

  const [error, setError] = useState('');
  const { saving, stalledHref, begin: beginSave, done: doneSave, fail: failSave } =
    useSaveNav();
  const [seeding, setSeeding] = useState(!!fromOrderId && !existing);

  const [form, setForm] = useState({
    customerId: existing?.customerId ?? fromCustomerId ?? '',
    challanType: existing?.challanType ?? '',
    orderId: existing?.orderId ?? '',
    locationId: existing?.locationId ?? '',
    challanDate: (existing?.challanDate ?? todayIso()).slice(0, 10),
    referenceNumber: existing?.referenceNumber ?? '',
    subject: existing?.subject ?? '',
    sourceOfSupplyCode: existing?.sourceOfSupplyCode ?? '',
    placeOfSupplyCode: existing?.placeOfSupplyCode ?? '',
    gstin: existing?.gstin ?? '',
    transporter: existing?.transporter ?? '',
    vehicleNumber: existing?.vehicleNumber ?? '',
    ewayBillNumber: existing?.ewayBillNumber ?? '',
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
    shippingCharge: existing && Number(existing.shippingCharge ?? 0) > 0 ? String(Number(existing.shippingCharge)) : '',
    codCharge: existing && Number(existing.codCharge ?? 0) > 0 ? String(Number(existing.codCharge)) : '',
    adjustment: existing ? String(Number(existing.adjustment)) : '',
    adjustmentLabel: existing?.adjustmentLabel ?? 'Adjustment',
    customerNotes: existing?.customerNotes ?? '',
    terms: existing?.terms ?? '',
  });
  const set = (patch: Partial<typeof form>) => setForm((f) => ({ ...f, ...patch }));
  useDefaultTerms('delivery_challan', !isEdit, (terms) => setForm((f) => (f.terms ? f : { ...f, terms })));

  const [lines, setLines] = useState<LineDraft[]>(() =>
    existing?.lines.length
      ? existing.lines.map((l) => ({
          orderId: l.orderId ?? existing.orderId ?? '',
          orderNumber: existing.orders?.find((o) => o.id === (l.orderId ?? existing.orderId))?.orderNumber ?? '',
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
          mrp: l.mrp != null ? String(Number(l.mrp)) : '',
        }))
      : [blankLine()]
  );
  const [docAddresses, setDocAddresses] = useState<{ billing: DocAddress | null; shipping: DocAddress | null } | null>(
    () => (existing ? { billing: existing.billingAddress ?? null, shipping: existing.shippingAddress ?? null } : null)
  );
  const [loadingOrder, setLoadingOrder] = useState(false);
  const [waiting, setWaiting] = useState<WaitingOrder[]>([]);
  const [charges, setCharges] = useState<Record<string, { shipping: number; cod: number }>>({});

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
            .get<{ data: { stateCode?: string | null; defaultTaxTreatment?: string } }>('/organization')
            .catch(() => null),
        ]);
        if (cancelled) return;
        setCustomers(c.data);
        setLocations(loc.data);
        setItems(it.data);
        setTaxRates(tr.data);
        setOrgState(org?.data?.stateCode ?? null);
        setForm((f) => (f.taxTreatment ? f : { ...f, taxTreatment: org?.data?.defaultTaxTreatment ?? 'INCLUSIVE' }));
        loadComboChoices().then((list) => {
          if (!cancelled) setCombos(list);
        });
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
  }, [existing]);

  const applyOrderSeed = useCallback((d: ChallanSeed) => {
    setSeededOrder({ id: d.orderId, orderNumber: d.orderNumber });
    setCharges({ [d.orderId]: { shipping: Number(d.shippingCharge ?? 0), cod: Number(d.codCharge ?? 0) } });
    setDocAddresses({ billing: d.billingAddress ?? null, shipping: d.shippingAddress ?? null });
    setForm((f) => ({
      ...f,
      orderId: d.orderId,
      customerId: d.customerId ?? f.customerId,
      referenceNumber: d.referenceNumber ?? f.referenceNumber,
      locationId: d.locationId ?? f.locationId,
      placeOfSupplyCode: d.placeOfSupplyCode ?? f.placeOfSupplyCode,
      gstin: d.gstin ?? f.gstin,
      taxTreatment: d.taxTreatment ?? f.taxTreatment,
      transporter: d.transporter ?? f.transporter,
      terms: d.terms ?? f.terms,
      shippingCharge: String(Number(d.shippingCharge ?? 0) || ''),
      codCharge: String(Number(d.codCharge ?? 0) || ''),
      adjustment: String(Number(d.adjustment ?? 0) || ''),
      discountLevel: d.discountLevel === 'LINE_ITEM' ? 'LINE_ITEM' : 'TRANSACTION',
      discountPercent: '',
      discountUnit: '%',
      challanType: f.challanType || 'OTHERS',
    }));
    setLines(d.lines.length ? seedLines(d) : [blankLine()]);
  }, []);

  useEffect(() => {
    if (!fromOrderId || isEdit) return;
    let cancelled = false;
    api
      .get<{ data: ChallanSeed }>(`/delivery-challans/from-order/${fromOrderId}`)
      .then((r) => {
        if (!cancelled) applyOrderSeed(r.data);
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
  }, [fromOrderId, isEdit, applyOrderSeed]);

  useEffect(() => {
    let cancelled = false;
    const t = setTimeout(async () => {
      if (!form.customerId) {
        setWaiting([]);
        return;
      }
      const r = await api
        .get<{ data: WaitingOrder[] }>(`/delivery-challans/undelivered-orders/${form.customerId}`, {
          excludeOrderId: form.orderId || undefined,
        })
        .catch(() => null);
      if (!cancelled) setWaiting(r?.data ?? []);
    }, 0);
    return () => {
      cancelled = true;
      clearTimeout(t);
    };
  }, [form.customerId, form.orderId]);

  const mainOrderNumber =
    (seededOrder && seededOrder.id === form.orderId ? seededOrder.orderNumber : null) ??
    lines.find((l) => l.orderId === form.orderId)?.orderNumber ??
    orders.find((o) => o.id === form.orderId)?.orderNumber ??
    null;
  const attachedOrders = [
    ...new Map(
      [
        ...(form.orderId ? [[form.orderId, mainOrderNumber ?? 'order'] as const] : []),
        ...lines.filter((l) => l.orderId).map((l) => [l.orderId as string, l.orderNumber || 'order'] as const),
      ]
    ),
  ].map(([id, orderNumber]) => ({ id, orderNumber }));
  const mainShipsTo = addressKey(docAddresses?.shipping);
  const waitingHere = waiting.filter((o) => !attachedOrders.some((a) => a.id === o.orderId));
  const sameAddress = (o: { shipsTo: string | null }) => !mainShipsTo || !o.shipsTo || o.shipsTo === mainShipsTo;
  const orderChoices = (
    seededOrder && !orders.some((o) => o.id === seededOrder.id) ? [seededOrder, ...orders] : orders
  ).filter((o) => !attachedOrders.some((a) => a.id === o.id));

  function addOrderSeed(d: ChallanSeed) {
    if (attachedOrders.some((a) => a.id === d.orderId)) return;
    const key = addressKey(d.shippingAddress);
    if (form.orderId && mainShipsTo && key && key !== mainShipsTo) {
      setError(`${d.orderNumber} ships to a different address - one challan covers one delivery address`);
      return;
    }
    const shipping = Number(d.shippingCharge ?? 0);
    const cod = Number(d.codCharge ?? 0);
    setCharges((c) => ({ ...c, [d.orderId]: { shipping, cod } }));
    setLines((ls) => [...ls.filter((l) => l.itemName.trim() || l.itemId), ...seedLines(d)]);
    setForm((f) => ({
      ...f,
      shippingCharge: String(Number(f.shippingCharge || 0) + shipping || ''),
      codCharge: String(Number(f.codCharge || 0) + cod || ''),
      ...(d.discountLevel === 'LINE_ITEM' && { discountLevel: 'LINE_ITEM' }),
    }));
  }

  async function makeMainOrder(orderId: string, extra: ChallanSeed[] = []) {
    setLoadingOrder(true);
    setError('');
    try {
      const r = await api.get<{ data: ChallanSeed }>(`/delivery-challans/from-order/${orderId}`);
      const keep = lines.filter((l) => !l.orderId && (l.itemName.trim() || l.itemId));
      const main = r.data;
      const key = addressKey(main.shippingAddress);
      const fits = extra.filter((o) => !key || !addressKey(o.shippingAddress) || addressKey(o.shippingAddress) === key);
      applyOrderSeed(main);
      setCharges(
        Object.fromEntries(
          [main, ...fits].map((o) => [o.orderId, { shipping: Number(o.shippingCharge ?? 0), cod: Number(o.codCharge ?? 0) }])
        )
      );
      setForm((f) => ({
        ...f,
        shippingCharge: String([main, ...fits].reduce((n, o) => n + Number(o.shippingCharge ?? 0), 0) || ''),
        codCharge: String([main, ...fits].reduce((n, o) => n + Number(o.codCharge ?? 0), 0) || ''),
        ...(fits.some((o) => o.discountLevel === 'LINE_ITEM') && { discountLevel: 'LINE_ITEM' }),
      }));
      setLines([...keep, ...seedLines(main), ...fits.flatMap(seedLines)]);
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setLoadingOrder(false);
    }
  }

  function deliverOrders(list: WaitingOrder[]) {
    if (!list.length) return;
    if (form.orderId) {
      list.filter(sameAddress).forEach(addOrderSeed);
      return;
    }
    const [first, ...rest] = list;
    makeMainOrder(first.orderId, rest);
  }

  async function attachOrder(orderId: string) {
    if (!orderId || attachedOrders.some((a) => a.id === orderId)) return;
    if (!form.orderId) {
      await makeMainOrder(orderId);
      return;
    }
    const known = waiting.find((o) => o.orderId === orderId);
    if (known) {
      addOrderSeed(known);
      return;
    }
    setLoadingOrder(true);
    try {
      const r = await api.get<{ data: ChallanSeed }>(`/delivery-challans/from-order/${orderId}`);
      addOrderSeed(r.data);
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setLoadingOrder(false);
    }
  }

  function removeOrder(orderId: string) {
    const charge = charges[orderId];
    if (charge) {
      setForm((f) => ({
        ...f,
        shippingCharge: String(Math.max(0, Number(f.shippingCharge || 0) - charge.shipping) || ''),
        codCharge: String(Math.max(0, Number(f.codCharge || 0) - charge.cod) || ''),
      }));
      setCharges((c) => {
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
      set({ orderId: attachedOrders.find((o) => o.id !== orderId)?.id ?? '' });
    }
  }

  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!form.customerId) {
        setAddresses([]);
        setOrders([]);
        return;
      }
      const [c, o] = await Promise.all([
        api.get<{ data: { addresses?: Address[] } }>(`/customers/${form.customerId}`).catch(() => null),
        api
          .get<Paged<OrderOption>>('/orders', { customerId: form.customerId, limit: 50 })
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

  const customer = customers.find((c) => c.id === form.customerId) ?? null;
  const location = locations.find((l) => l.id === form.locationId) ?? null;
  const shipping = addresses.find((a) => a.type === 'SHIPPING') ?? addresses[0] ?? null;

  const source = form.sourceOfSupplyCode || location?.stateCode || orgState || '';
  const place =
    form.placeOfSupplyCode ||
    customer?.b2bAccount?.placeOfSupplyCode ||
    shipping?.stateCode ||
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

  const hasMrp = lines.some((l) => l.mrp && Number(l.mrp) > 0);
  const mrpLines = lines.map((l) => ({ mrp: l.mrp, quantity: l.quantity, netTaxable: lineTaxable(l), taxPercent: pctOf(l) }));
  const grossBeforeLineDiscount = lines.reduce((n, l) => n + lineGross(l), 0);
  const headerDiscountRatio = subTotal > 0 ? headerDiscount / subTotal : 0;

  const totalQuantity = lines.reduce((n, l) => n + Number(l.quantity || 0), 0);
  const taxRows = taxBreakdown(lines, {
    taxableOf: lineTaxable,
    slabOf: resolveSlab,
    subTotal,
    headerDiscount,
    intraState,
  });

  const seedCod = Number(existing?.codCharge ?? 0);
  const paise = (v: number) => Math.round(v * 100) / 100;
  const goodsTotal = lines.reduce((n, l) => {
    const share = subTotal === 0 ? 0 : paise((headerDiscount * lineTaxable(l)) / subTotal);
    const net = paise(lineTaxable(l) - share);
    return n + net + paise((net * pctOf(l)) / 100);
  }, 0);
  const grandTotal =
    goodsTotal +
    Number(form.shippingCharge || 0) +
    Number(form.codCharge || 0) +
    Number(form.adjustment || 0);

  const lineAmount = (l: LineDraft) =>
    inclusive ? Number(l.quantity || 0) * Number(l.rate || 0) : lineTaxable(l) * (1 + pctOf(l) / 100);

  const holdsStock = !form.orderId && !lines.some((l) => l.orderId) && lines.some((l) => l.itemId);

  async function submit(status: 'DRAFT' | 'OPEN') {
    setError('');
    if (!form.customerId) return setError('Pick a customer');
    if (!form.challanType) return setError('Pick a challan type — Rule 55 requires one');
    const usable = lines.filter((l) => l.itemName.trim() && Number(l.quantity) > 0);
    if (!usable.length) return setError('Add at least one line');
    if (status === 'OPEN' && holdsStock && !form.locationId) {
      return setError('Pick the location the goods are leaving from');
    }

    const blank = isEdit ? null : undefined;
    const body = {
      customerId: form.customerId,
      challanType: form.challanType,
      orderId: form.orderId || blank,
      locationId: form.locationId || blank,
      challanDate: form.challanDate,
      referenceNumber: form.referenceNumber.trim() || blank,
      subject: form.subject.trim() || blank,
      sourceOfSupplyCode: source || blank,
      placeOfSupplyCode: effectivePlace || blank,
      gstin: form.gstin.trim() || blank,
      transporter: form.transporter.trim() || blank,
      vehicleNumber: form.vehicleNumber.trim() || blank,
      ewayBillNumber: form.ewayBillNumber.trim() || blank,
      taxTreatment: form.taxTreatment || 'INCLUSIVE',
      discountLevel: form.discountLevel,
      discountPercent: form.discountUnit === '%' ? Number(form.discountPercent || 0) : 0,
      discountAmount: form.discountUnit === '₹' ? Number(form.discountPercent || 0) : 0,
      ...(docAddresses && { billingAddress: docAddresses.billing, shippingAddress: docAddresses.shipping }),
      shippingCharge: Number(form.shippingCharge || 0),
      codCharge: Number(form.codCharge || 0),
      adjustment: Number(form.adjustment || 0),
      adjustmentLabel: form.adjustmentLabel.trim() || 'Adjustment',
      status,
      customerNotes: form.customerNotes.trim() || blank,
      terms: form.terms.trim() || blank,
      lines: usable.map((l) => ({
        orderId: l.orderId || null,
        itemId: l.itemId || null,
        variantId: l.variantId || null,
        itemName: l.itemName.trim(),
        description: l.description.trim() || undefined,
        hsnCode: l.hsnCode.trim() || undefined,
        unit: l.unit || 'pcs',
        quantity: Number(l.quantity),
        rate: Number(l.rate),
        mrp: l.mrp ? Number(l.mrp) : null,
        discountPercent: perLineDiscount && l.discountUnit !== '₹' ? Number(l.discountPercent || 0) : null,
        discountAmount: perLineDiscount && l.discountUnit === '₹' ? Number(l.discountPercent || 0) : null,
        taxRate: pctOf(l),
      })),
    };

    beginSave();
    try {
      const challanId = isEdit
        ? (await api.patch<{ data: { id: string } }>(`/delivery-challans/${existing.id}`, body)).data.id
        : (await api.post<{ data: { id: string } }>('/delivery-challans', body)).data.id;
      doneSave(`/delivery-challans/${challanId}`);
    } catch (err) {
      setError(errorMessage(err));
      failSave();
    }
  }

  if (seeding) {
    return (
      <div className="flex items-center gap-2 p-8 text-sm text-muted-foreground">
        <Spinner /> Loading the sales order…
      </div>
    );
  }

  return (
    <>
      <PageCrumb label={isEdit ? existing.challanNumber : 'New'} />

      <PageHeader title={isEdit ? `Edit ${existing.challanNumber}` : 'New Delivery Challan'} />

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
                  set({
                    customerId,
                    orderId: '',
                    gstin: '',
                    placeOfSupplyCode: '',
                    shippingCharge: '',
                    codCharge: '',
                  });
                  setDocAddresses(null);
                  setCharges({});
                  setLines((ls) => {
                    const kept = ls.filter((l) => !l.orderId);
                    return kept.length ? kept : [blankLine()];
                  });
                }}
              />
            </Field>

            <Field
              label="Challan Type"
              required
              hint={CHALLAN_TYPES.find((t) => t.value === form.challanType)?.hint ?? 'Rule 55 requires one of four'}
            >
              <Select
                value={form.challanType}
                onChange={(e) => set({ challanType: e.target.value })}
                className="w-full"
              >
                <option value="">Select a type…</option>
                {CHALLAN_TYPES.map((t) => (
                  <option key={t.value} value={t.value}>{t.label}</option>
                ))}
              </Select>
            </Field>

            <Field label="Challan Date" required>
              <Input
                type="date"
                value={form.challanDate}
                onChange={(e) => set({ challanDate: e.target.value })}
              />
            </Field>

            {shipping && (
              <div className="text-xs leading-5 text-muted-foreground sm:col-span-2">
                <div className="mb-1 font-medium text-muted-foreground">DELIVER TO</div>
                <p className="font-medium text-foreground">
                  {customer?.displayName}
                </p>
                {[
                  shipping.line1,
                  shipping.line2,
                  shipping.city,
                  [shipping.state, shipping.pincode].filter(Boolean).join(' '),
                  shipping.country,
                ]
                  .filter(Boolean)
                  .map((l, i) => (
                    <p key={i}>{l}</p>
                  ))}
                {shipping.phone && <p>Phone: {shipping.phone}</p>}
              </div>
            )}

            <Field label="Challan#">
              <Input
                value={isEdit ? existing.challanNumber : ''}
                disabled
                placeholder="Reserved on save"
              />
            </Field>

            <Field
              label="Sales Order#"
              hint={
                attachedOrders.length > 1
                  ? `Delivers ${attachedOrders.length} orders to one address - stock stays with the orders`
                  : form.orderId
                    ? 'Stock stays with the order — this challan holds none'
                    : 'Leave empty for job work or samples, or add one or more orders'
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
                          aria-label={`Take ${o.orderNumber} off this challan`}
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

            {waitingHere.length > 0 && (
              <div className="rounded-md border border-gold/30 bg-gold-soft/60 px-3 py-2.5 text-sm sm:col-span-2 lg:col-span-3">
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <p className="text-foreground">
                    <strong>
                      {waitingHere.length} order{waitingHere.length === 1 ? '' : 's'}
                    </strong>{' '}
                    for this customer not delivered yet
                  </p>
                  {waitingHere.filter(sameAddress).length > 1 && (
                    <button
                      type="button"
                      onClick={() => deliverOrders(waitingHere.filter(sameAddress))}
                      disabled={loadingOrder}
                      className="text-xs font-medium text-gold-ink underline"
                    >
                      Add all going to this address
                    </button>
                  )}
                </div>
                <ul className="mt-2 divide-y divide-gold/25 text-xs">
                  {waitingHere.map((o) => {
                    const fits = sameAddress(o);
                    return (
                      <li key={o.orderId} className={`flex items-center gap-3 py-1.5 ${fits ? '' : 'opacity-60'}`}>
                        <Link
                          href={`/admin/orders/${o.orderId}`}
                          target="_blank"
                          className="font-mono text-gold-ink hover:underline"
                        >
                          {o.orderNumber}
                        </Link>
                        <span className="text-muted-foreground">
                          {o.placedAt ? `${shortDate(o.placedAt)} · ` : ''}
                          {o.lines.length} item{o.lines.length === 1 ? '' : 's'} to send
                          {o.fulfillmentStatus === 'PARTIALLY_FULFILLED' ? ' · part sent' : ''}
                          {fits ? '' : ' · ships to another address'}
                        </span>
                        <span className="ml-auto tabular-nums">{money(Number(o.grandTotal))}</span>
                        <Button
                          type="button"
                          size="sm"
                          disabled={!fits || loadingOrder}
                          onClick={() => deliverOrders([o])}
                        >
                          Add
                        </Button>
                      </li>
                    );
                  })}
                </ul>
                <p className="mt-2 text-xs text-muted-foreground">
                  Orders going to the same address can travel on one challan. Each order&rsquo;s items,
                  shipping and COD charge are added, and each order is marked sent when the challan opens.
                </p>
              </div>
            )}

            <Field label="Reference#">
              <Input
                value={form.referenceNumber}
                onChange={(e) => set({ referenceNumber: e.target.value })}
              />
            </Field>

            <Field
              label="Location"
              required={holdsStock}
              hint={holdsStock ? 'Where the goods leave from' : 'Sets the source of supply'}
            >
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

            <Field label="Place of Supply" hint="Where the goods are going">
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

            <div className="sm:col-span-2 lg:col-span-3 min-w-0">
              <Field label="Subject" hint="What this dispatch is for">
                <Input value={form.subject} onChange={(e) => set({ subject: e.target.value })} />
              </Field>
            </div>
          </div>
        </Card>

        <Card title="Transport">
          <div className="grid gap-4 sm:grid-cols-3">
            <Field label="Transporter" hint="Who carries the goods - pick one or add it">
              <TransporterSelect
                value={form.transporter}
                onChange={(transporter) => set({ transporter })}
              />
            </Field>
            <Field label="Vehicle Number">
              <Input
                value={form.vehicleNumber}
                onChange={(e) => set({ vehicleNumber: e.target.value.toUpperCase().replace(/[^A-Z0-9 ]/g, '') })}
                placeholder="UP32 AB 1234"
                maxLength={13}
                className="font-mono"
              />
            </Field>
            <Field
              label="E-Way Bill#"
              hint={
                form.ewayBillNumber && form.ewayBillNumber.length !== 12 ? (
                  <span className="text-warning">An e-way bill number is 12 digits</span>
                ) : (
                  'Needed above ₹50,000 in most movements'
                )
              }
            >
              <Input
                inputMode="numeric"
                maxLength={12}
                value={form.ewayBillNumber}
                onChange={(e) => set({ ewayBillNumber: e.target.value.replace(/\D/g, '').slice(0, 12) })}
                placeholder="12 digits"
                className="font-mono"
              />
            </Field>
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

          <Table dense minWidth={hasMrp ? '980px' : '880px'}>
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
                <tr key={i}>
                  <Td>
                    <ItemSelect
                      value={l.variantId && !l.itemId ? `${COMBO_PREFIX}${l.variantId}` : l.itemId}
                      items={[...items, ...combos]}
                      onChange={(v) => pickItem(i, v)}
                      className="mb-1 w-full min-w-[240px]"
                    />
                    {attachedOrders.length > 1 && l.orderNumber && (
                      <p className="mb-1 font-mono text-[11px] text-gold-ink">Order {l.orderNumber}</p>
                    )}
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
                    {l.hsnCode && (
                      <p className="mt-1 text-[11px] text-muted-foreground">
                        HSN {l.hsnCode}
                      </p>
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
              ))}
            </tbody>
          </Table>

          <div className="border-t border-border p-3">
            <Button size="sm" onClick={() => setLines((ls) => [...ls, blankLine()])}>
              + Add line
            </Button>
          </div>

          <div className="grid gap-4 border-t border-border p-4 lg:grid-cols-2 [&>*]:min-w-0">
            <div className="text-xs text-muted-foreground">
              {holdsStock ? (
                <p>
                  This challan is not against a sales order, so saving it as open moves{' '}
                  <strong>{totalQuantity}</strong> unit(s) off available at{' '}
                  {location?.name ?? 'the chosen location'} — still owned by you, just not
                  sellable. Marking it returned puts them back.
                </p>
              ) : form.orderId ? (
                <p>
                  Against a sales order, so the order&rsquo;s fulfilment moves the stock — this
                  challan moves none, or the same units would leave twice.
                </p>
              ) : null}
              <p className="mt-2">
                Nothing is owed on a challan, so there is no due date, no freight line and no
                TDS/TCS. The value below is the declaration Rule 55 asks for.
              </p>
            </div>
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

              <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-2">
                <dt className="text-muted-foreground">Shipping Charge</dt>
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

              {(form.codCharge !== '' || Number(seedCod) > 0) && (
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

              <div className="flex justify-between border-t border-border pt-2.5 text-base font-semibold">
                <dt>Total Value ( Rs. )</dt>
                <dd>{money(grandTotal)}</dd>
              </div>
            </dl>
          </div>
        </Card>

        <div className="grid gap-5 lg:grid-cols-2">
          <Card>
            <Field label="Customer Notes" hint="Printed on the challan">
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
          Value <strong className="text-foreground">{money(grandTotal)}</strong>
        </span>
      </SaveBar>
    </>
  );
}
