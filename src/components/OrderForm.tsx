'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { api, money, errorMessage, type Paged, currencySymbol } from '@/lib/api';
import {
  Button, Card, EmptyRow, ErrorBox, Field, Input, PageHeader,
  Select, Table, Td, Textarea, Th, Spinner,
} from '@/components/ui';
import { FileUpload } from '@/components/FileUpload';
import { stateName } from '@/lib/states';
import { PaymentTermSelect, useDefaultPaymentTerm } from '@/components/PaymentTermSelect';
import { TransporterSelect } from '@/components/TransporterSelect';
import { ItemSelect, type SelectableItem } from './ItemSelect';
import { SearchSelect } from './SearchSelect';
import { itemLabel, priceAs, switchRate, type RateMemo } from '@/lib/items';
import { StateSelect, stateSelectHint } from './StateSelect';
import { CustomerSelect } from './CustomerSelect';
import { GstinField } from './GstinField';
import { resolveRoundOff, type RoundOffMode } from '@/lib/roundOff';
import { DiscountSelect } from './DiscountSelect';
import { MrpTotalRows, OffMrpNote } from './OffMrp';
import { pctSuffix, wholePercentOff } from '@/lib/mrp';
import { ShippingQuoteNote, type ShippingQuote } from '@/components/ShippingQuoteNote';
import { REPLACEMENT_REASONS } from '@/lib/replacements';
import { usePaymentOptions } from '@/lib/payments';
import { useToast } from '@/lib/toast';
import { PageCrumb } from '@/lib/crumbs';
import { SaveBar } from './form/SaveBar';

type Customer = {
  id: string;
  firstName: string | null;
  lastName: string | null;
  email: string | null;
  phone: string | null;
  customerType?: string | null;
};

type Location = {
  id: string;
  name: string;
  code: string;
  isDefault: boolean;
  stateCode: string | null;
};
type TaxRate = {
  id: string;
  name: string;
  rate: string;
  type: string;
  isDefault: boolean;
};
type FileDraft = { fileName: string; fileUrl: string };

type LineDraft = {
  variantId: string;
  itemId: string;
  name: string;
  unitPrice: string;
  mrp: string;
  quantity: string;
  discountAmount: string;
  discountUnit: '%' | '₹';
  taxRate: string;
  taxSource?: string;
  isCustom: boolean;
  rateMemo?: RateMemo;
};

type StockItem = SelectableItem & {
  discountPercent?: string | null;
  intraStateTaxRate?: string | null;
  sellingTaxTreatment?: string | null;
};

type ProductChoice = {
  id: string;
  title: string;
  media?: { url: string }[];
  variants?: {
    id: string;
    title: string;
    sku: string | null;
    price: string;
    mrp?: string | null;
    imageUrl?: string | null;
    listPrice?: string | null;
    discountPercent?: string | null;
  }[];
};

const blankLine = (): LineDraft => ({
  variantId: '', itemId: '', name: '', unitPrice: '', mrp: '', quantity: '1',
  discountAmount: '', discountUnit: '%', taxRate: '', taxSource: undefined, isCustom: false,
});

const blankAddress = () => ({
  firstName: '', lastName: '', phone: '', email: '',
  line1: '', line2: '', landmark: '',
  city: '', state: '', stateCode: '', pincode: '', country: 'India',
});

type SavedAddress = {
  id: string;
  type: 'SHIPPING' | 'BILLING' | string;
  label: string | null;
  firstName: string | null;
  lastName: string | null;
  phone: string | null;
  line1: string;
  line2: string | null;
  landmark: string | null;
  city: string;
  state: string;
  stateCode: string | null;
  pincode: string;
  country: string;
  isDefaultShipping: boolean;
  isDefaultBilling: boolean;
};

type CustomerDetail = Customer & {
  addresses?: SavedAddress[];
  b2bAccount?: {
    gstin: string | null;
    paymentTerms: string | null;
    defaultShipmentType: string | null;
    placeOfSupplyCode: string | null;
    addresses?: SavedAddress[];
  } | null;
};

const ORDER_TYPES = [
  { value: 'B2B', label: 'B2B order', hint: 'For a business customer, invoiced on their GSTIN' },
  { value: 'D2C', label: 'D2C order', hint: 'For an individual customer - a phone, WhatsApp or website order' },
];

const REPLACEMENT_CHARGES = [
  { value: 'FREE', label: 'Send it free', hint: 'A zero-value order - nothing to collect and no shipping charged' },
  { value: 'CHARGED', label: 'Charge the customer', hint: 'Priced like any order, with its own payment' },
];

function ChoiceCard({
  name, value, checked, label, hint, onPick,
}: {
  name: string; value: string; checked: boolean; label: string; hint: string; onPick: () => void;
}) {
  return (
    <label
      className={`flex cursor-pointer gap-2.5 rounded-md border px-3 py-2.5 text-sm transition-colors ${
        checked
          ? 'border-gold bg-gold-soft/60'
          : 'border-border hover:border-border'
      }`}
    >
      <input type="radio" name={name} value={value} checked={checked} onChange={onPick} className="mt-0.5" />
      <span>
        <span className="block font-medium text-foreground">{label}</span>
        <span className="block text-xs text-muted-foreground">{hint}</span>
      </span>
    </label>
  );
}

const addressSummary = (a: SavedAddress) =>
  [a.line1, a.line2, a.city, a.state, a.pincode].filter(Boolean).join(', ');


export type ExistingOrder = {
  id: string;
  orderNumber: string;
  isDraft: boolean;
  orderType: string;
  orderStatus: string;
  fulfillmentStatus: string;
  deliveryStatus: string;
  customerId: string | null;
  customer?: {
    firstName: string | null; lastName: string | null; phone: string | null; email: string | null;
  } | null;
  replacementForId?: string | null;
  replacementReason?: string | null;
  isFreeReplacement?: boolean;
  paymentLinkUrl?: string | null;
  replacementFor?: { id: string; orderNumber: string } | null;
  sourceLocationId: string | null;
  paymentMethod: string;
  deliveryMethod: string;
  shipmentType: string | null;
  billingSameAsShipping: boolean;
  shippingTotal: string;
  codCharge?: string;
  discountTotal: string;
  discountCode: string | null;
  gstin: string | null;
  notes: string | null;
  internalNotes: string | null;
  referenceNumber: string | null;
  expectedShipmentDate: string | null;
  paymentTerms: string | null;
  transporter: string | null;
  adjustment: string | null;
  adjustmentLabel: string | null;
  roundOff?: string;
  roundOffManual?: boolean;
  taxTreatment?: string;
  terms: string | null;
  shippingAddress: Record<string, string | null> | null;
  billingAddress: Record<string, string | null> | null;
  invoices?: { id: string; invoiceNumber: string; status: string }[];
  lines: {
    id: string;
    variantId: string | null;
    itemId?: string | null;
    name: string;
    variantTitle?: string | null;
    unitPrice: string;
    mrp?: string | null;
    quantity: number;
    discountAmount: string;
    lineDiscount?: string;
    discountPercent?: string | null;
    taxRate: string;
    isCustomItem: boolean;
  }[];
};

const str = (v: unknown) => (v === null || v === undefined ? '' : String(v));

const addressFrom = (a: Record<string, string | null> | null | undefined) =>
  a
    ? {
        firstName: str(a.firstName), lastName: str(a.lastName),
        phone: str(a.phone), email: str(a.email),
        line1: str(a.line1), line2: str(a.line2), landmark: str(a.landmark),
        city: str(a.city), state: str(a.state), stateCode: str(a.stateCode),
        pincode: str(a.pincode), country: str(a.country) || 'India',
      }
    : blankAddress();

export function OrderForm({
  existing,
  replacing,
  type,
  initialCustomerId,
}: {
  existing?: ExistingOrder;
  replacing?: ExistingOrder;
  type?: 'D2C' | 'B2B';
  initialCustomerId?: string;
}) {
  const router = useRouter();
  const isEdit = !!existing;
  const seedFrom = existing ?? replacing;
  const linesLocked =
    isEdit &&
    (existing.fulfillmentStatus !== 'UNFULFILLED' ||
      (existing.invoices ?? []).some((i) => i.status !== 'VOID'));

  const [customers, setCustomers] = useState<Customer[]>([]);
  const [stockItems, setStockItems] = useState<StockItem[]>([]);
  const [products, setProducts] = useState<ProductChoice[]>([]);
  const [locations, setLocations] = useState<Location[]>([]);
  const [taxRates, setTaxRates] = useState<TaxRate[]>([]);

  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const payOptions = usePaymentOptions();
  const toast = useToast();

  const [form, setForm] = useState({
    orderType: existing?.orderType ?? (replacing ? 'D2C' : type ?? 'B2B'),
    customerId: seedFrom?.customerId ?? '',
    sourceLocationId: seedFrom?.sourceLocationId ?? '',
    paymentMethod: existing?.paymentMethod ?? 'RAZORPAY',
    deliveryMethod: existing?.deliveryMethod ?? (replacing || type === 'D2C' ? 'PREPAID' : 'B2B_TRANSPORT'),
    shipmentType:
      existing?.shipmentType ??
      (replacing
        ? replacing.shipmentType ?? 'D2C_SHIPROCKET'
        : type === 'D2C'
          ? 'D2C_SHIPROCKET'
          : 'B2B_SHIPROCKET'),
    shippingTotal: existing ? String(Number(existing.shippingTotal)) : '0',
    codCharge: existing ? String(Number(existing.codCharge ?? 0)) : '0',
    discountTotal: existing
      ? String(
          Math.max(
            0,
            Number(existing.discountTotal) -
              existing.lines.reduce((n, l) => n + Number(l.lineDiscount ?? 0), 0)
          )
        )
      : '0',
    discountCode: existing?.discountCode ?? '',
    gstin: existing?.gstin ?? '',
    notes: existing?.notes ?? '',
    internalNotes: existing?.internalNotes ?? '',
    billingSameAsShipping: seedFrom?.billingSameAsShipping ?? true,

    referenceNumber: existing?.referenceNumber ?? '',
    expectedShipmentDate: existing?.expectedShipmentDate?.slice(0, 10) ?? '',
    paymentTerms: existing?.paymentTerms ?? 'DUE_ON_RECEIPT',
    transporter: existing?.transporter ?? '',
    adjustment: existing?.adjustment ? String(Number(existing.adjustment)) : '',
    adjustmentLabel: existing?.adjustmentLabel ?? 'Adjustment',
    roundOff: existing?.roundOffManual ? String(Number(existing.roundOff ?? 0)) : '',
    terms: existing?.terms ?? '',
    taxTreatment: existing?.taxTreatment ?? '',
    replacementReason: '',
    replacementCharge: '' as '' | 'FREE' | 'CHARGED',
    paymentLinkUrl: existing?.paymentLinkUrl ?? '',
    autoLink: true,
  });
  const set = useCallback((patch: Partial<typeof form>) => setForm((f) => ({ ...f, ...patch })), []);
  const defaultTerm = useDefaultPaymentTerm((code) =>
    setForm((f) => (!existing && !f.customerId && f.paymentTerms === 'DUE_ON_RECEIPT' ? { ...f, paymentTerms: code } : f))
  );

  const free = (!!replacing && form.replacementCharge === 'FREE') || !!existing?.isFreeReplacement;
  const chargesLocked = linesLocked || free;

  const [address, setAddress] = useState(() => addressFrom(seedFrom?.shippingAddress));
  const setAddr = (patch: Partial<ReturnType<typeof blankAddress>>) =>
    setAddress((a) => ({ ...a, ...patch }));

  const [savedAddresses, setSavedAddresses] = useState<SavedAddress[]>([]);
  const [addressBookState, setAddressBookState] = useState<'idle' | 'loading' | 'ready'>('idle');
  const [pickedAddressId, setPickedAddressId] = useState('');
  const [seeded, setSeeded] = useState<string[]>([]);

  const [billing, setBilling] = useState(() => addressFrom(seedFrom?.billingAddress));
  const setBill = (patch: Partial<ReturnType<typeof blankAddress>>) =>
    setBilling((a) => ({ ...a, ...patch }));
  const [pickedBillingId, setPickedBillingId] = useState('');

  const shippingOptions = savedAddresses.filter((a) => a.type !== 'BILLING');
  const billingOptions = savedAddresses.filter((a) => a.type !== 'SHIPPING');

  const [lines, setLines] = useState<LineDraft[]>(() =>
    seedFrom?.lines?.length
      ? seedFrom.lines.map((l) => ({
          variantId: l.variantId ?? '',
          itemId: l.variantId ? '' : l.itemId ?? '',
          name: [l.name, l.variantTitle].filter(Boolean).join(' - '),
          unitPrice: String(Number(l.unitPrice)),
          mrp: l.mrp != null ? String(Number(l.mrp)) : '',
          quantity: String(l.quantity),
          discountAmount: l.discountPercent
            ? String(Number(l.discountPercent))
            : Number(l.lineDiscount ?? 0) > 0
              ? String(Number(l.lineDiscount))
              : '',
          discountUnit: (l.discountPercent ? '%' : Number(l.lineDiscount ?? 0) > 0 ? '₹' : '%') as '%' | '₹',
          taxRate: String(Number(l.taxRate)),
          isCustom: l.isCustomItem,
        }))
      : [blankLine()]
  );

  const [files, setFiles] = useState<FileDraft[]>([]);
  const [fileError, setFileError] = useState('');
  const [roundOffMode, setRoundOffMode] = useState<RoundOffMode>('NEAREST_1');

  useEffect(() => {
    (async () => {
      try {
        const [cu, it, lo, tr, org, pr] = await Promise.all([
          api.get<Paged<Customer>>('/customers', { limit: 100 }).catch(() => ({ data: [] as Customer[] })),
          api.get<Paged<StockItem>>('/items', { limit: 100, status: 'ACTIVE' }),
          api.get<Paged<Location>>('/locations', { limit: 50 }),
          api.get<{ data: TaxRate[] }>('/sales/tax-rates').catch(() => ({ data: [] as TaxRate[] })),
          api
            .get<{ data: { defaultTaxTreatment?: string; roundOffMode?: RoundOffMode } }>('/organization')
            .catch(() => null),
          api
            .get<Paged<ProductChoice>>('/products', { limit: 100, status: 'ACTIVE' })
            .catch(() => ({ data: [] as ProductChoice[] })),
        ]);
        setCustomers(cu.data);
        setLocations(lo.data);
        setStockItems(it.data);
        setProducts(pr.data);
        setTaxRates(tr.data);
        if (org?.data?.roundOffMode) setRoundOffMode(org.data.roundOffMode);
        setForm((f) => (f.taxTreatment ? f : { ...f, taxTreatment: org?.data?.defaultTaxTreatment ?? 'INCLUSIVE' }));

        const def = lo.data.find((l) => l.isDefault) ?? lo.data[0];
        if (def && !existing && !replacing?.sourceLocationId) set({ sourceLocationId: def.id });
      } catch (err) {
        setError(errorMessage(err));
      }
    })();
  }, [existing, replacing?.sourceLocationId, set]);

  const customerApplied = useRef(false);
  useEffect(() => {
    if (customerApplied.current || !initialCustomerId || existing || replacing || !customers.length) return;
    customerApplied.current = true;
    const t = setTimeout(() => pickCustomer(initialCustomerId), 0);
    return () => clearTimeout(t);
  });

  const sourceState = locations.find((l) => l.id === form.sourceLocationId)?.stateCode ?? '';
  const destinationState = address.stateCode || sourceState;
  const intraState = !!sourceState && !!destinationState && sourceState === destinationState;
  const taxFamily = intraState ? 'GST' : 'IGST';

  const slabs = useMemo(
    () => taxRates.filter((t) => t.type === taxFamily).sort((a, b) => Number(a.rate) - Number(b.rate)),
    [taxRates, taxFamily]
  );

  const slabFor = (l: LineDraft): TaxRate | null => {
    if (l.taxRate === '') return null;
    return slabs.find((t) => Number(t.rate) === Number(l.taxRate)) ?? null;
  };

  function toFormAddress(a: SavedAddress, customer?: Customer | null) {
    return {
      firstName: a.firstName ?? customer?.firstName ?? '',
      lastName: a.lastName ?? customer?.lastName ?? '',
      phone: a.phone ?? customer?.phone ?? '',
      email: customer?.email ?? '',
      line1: a.line1,
      line2: a.line2 ?? '',
      landmark: a.landmark ?? '',
      city: a.city,
      state: a.state,
      stateCode: a.stateCode ?? '',
      pincode: a.pincode,
      country: a.country || 'India',
    };
  }

  function applySavedAddress(a: SavedAddress, customer?: Customer | null) {
    setPickedAddressId(a.id);
    setAddress(toFormAddress(a, customer));
  }

  function applyBillingAddress(a: SavedAddress, customer?: Customer | null) {
    setPickedBillingId(a.id);
    setBilling(toFormAddress(a, customer));
  }

  async function pickCustomer(customerId: string, picked: Customer | null = null) {
    const c = picked ?? customers.find((x) => x.id === customerId) ?? null;
    if (picked && !customers.some((x) => x.id === picked.id)) setCustomers((cs) => [...cs, picked]);
    set({ customerId });
    setPickedAddressId('');
    setSavedAddresses([]);
    setSeeded([]);

    if (!customerId) {
      setAddressBookState('idle');
      setAddress(blankAddress());
      set({ gstin: '', paymentTerms: defaultTerm ?? 'DUE_ON_RECEIPT' });
      return;
    }

    setAddress({
      ...blankAddress(),
      firstName: c?.firstName ?? '',
      lastName: c?.lastName ?? '',
      phone: c?.phone ?? '',
      email: c?.email ?? '',
    });

    setAddressBookState('loading');
    try {
      const res = await api.get<{ data: CustomerDetail }>(`/customers/${customerId}`);
      const d = res.data;
      const filled: string[] = [];

      const book = [...(d.addresses ?? []), ...(d.b2bAccount?.addresses ?? [])];
      const seen = new Set<string>();
      const unique = book.filter((a) => !seen.has(a.id) && seen.add(a.id));
      setSavedAddresses(unique);

      const patch: Partial<typeof form> = {};

      const ship =
        unique.find((a) => a.isDefaultShipping) ??
        unique.find((a) => a.type === 'SHIPPING') ??
        unique[0];
      if (ship) {
        applySavedAddress(ship, c);
        filled.push('shipping address');
      }

      const bill =
        unique.find((a) => a.isDefaultBilling) ?? unique.find((a) => a.type === 'BILLING');
      if (bill && bill.id !== ship?.id) {
        applyBillingAddress(bill, c);
        patch.billingSameAsShipping = false;
        filled.push('billing address');
      } else {
        setPickedBillingId('');
        setBilling(blankAddress());
        patch.billingSameAsShipping = true;
      }

      if (d.b2bAccount?.gstin) {
        patch.gstin = d.b2bAccount.gstin;
        filled.push('GSTIN');
      }
      if (d.b2bAccount?.paymentTerms) {
        patch.paymentTerms = d.b2bAccount.paymentTerms;
        filled.push('payment terms');
      }
      if (d.b2bAccount?.defaultShipmentType) {
        patch.shipmentType = d.b2bAccount.defaultShipmentType;
        filled.push('shipping route');
      }
      set(patch);
      setSeeded(filled);
    } catch {
      setSavedAddresses([]);
    } finally {
      setAddressBookState('ready');
    }
  }

  function setLine(i: number, patch: Partial<LineDraft>) {
    setLines((rows) => rows.map((r, idx) => (idx === i ? { ...r, ...patch } : r)));
  }

  const variantChoices = useMemo(
    () =>
      products.flatMap((p) =>
        (p.variants ?? []).map((v) => ({
          value: v.id,
          label: v.title,
          group: p.title,
          imageUrl: v.imageUrl ?? p.media?.[0]?.url ?? null,
          tag: v.sku ?? null,
          hint: `${money(Number(v.price))} incl. tax${v.mrp != null && Number(v.mrp) > 0 ? ` · MRP ${money(Number(v.mrp))}` : ''}`,
        }))
      ),
    [products]
  );

  async function pickVariant(i: number, variantId: string) {
    const product = products.find((p) => p.variants?.some((v) => v.id === variantId));
    const variant = product?.variants?.find((v) => v.id === variantId);
    if (!product || !variant) {
      setLine(i, { variantId: '', name: '', unitPrice: '', mrp: '', discountAmount: '', discountUnit: '%', taxRate: '', taxSource: undefined });
      return;
    }
    const packDiscount = variant.listPrice != null ? Number(variant.discountPercent ?? 0) : 0;
    const mrpOff = packDiscount > 0 ? null : wholePercentOff(variant.mrp, variant.price);
    const listed = packDiscount > 0 ? variant.listPrice : mrpOff ? Number(variant.mrp) : variant.price;
    const lineDiscount = packDiscount > 0 ? packDiscount : mrpOff ?? 0;
    const treatment = form.taxTreatment || 'INCLUSIVE';
    const provisional = String(priceAs(listed, 'INCLUSIVE', treatment, 18));
    setLine(i, {
      variantId,
      itemId: '',
      isCustom: false,
      name: `${product.title} - ${variant.title}`,
      unitPrice: provisional,
      rateMemo: undefined,
      mrp: variant.mrp != null ? String(Number(variant.mrp)) : '',
      discountAmount: lineDiscount > 0 ? String(lineDiscount) : '',
      discountUnit: '%',
      taxRate: '',
      taxSource: undefined,
    });
    try {
      const res = await api.get<{ data: { variantId: string; rate: number; source: string }[] }>(
        '/sales/tax-rates/resolve',
        { variantIds: variantId }
      );
      const hit = res.data?.[0];
      if (hit) {
        const exact = String(priceAs(listed, 'INCLUSIVE', treatment, hit.rate));
        setLines((rows) =>
          rows.map((r, idx) =>
            idx === i && r.variantId === variantId
              ? { ...r, taxRate: String(hit.rate), taxSource: hit.source, ...(r.unitPrice === provisional && { unitPrice: exact }) }
              : r
          )
        );
      }
    } catch {
    }
  }

  function pickItem(i: number, itemId: string) {
    const item = stockItems.find((x) => x.id === itemId);
    if (!item) {
      setLine(i, { itemId: '', name: '', unitPrice: '', mrp: '', discountAmount: '', discountUnit: '%' });
      return;
    }
    const taxRate = item.intraStateTaxRate != null ? String(Number(item.intraStateTaxRate)) : '';
    const gst = taxRate === '' ? 18 : Number(taxRate);
    const sellingIncl = item.sellingPrice != null ? priceAs(item.sellingPrice, item.sellingTaxTreatment, 'INCLUSIVE', gst) : null;
    const mrpOff = sellingIncl != null ? wholePercentOff(item.mrp, sellingIncl) : null;
    const listed = sellingIncl == null ? null : mrpOff ? Number(item.mrp) : sellingIncl;
    setLine(i, {
      itemId,
      variantId: '',
      isCustom: false,
      name: itemLabel(item),
      unitPrice: listed != null ? String(priceAs(listed, 'INCLUSIVE', form.taxTreatment, gst)) : '',
      rateMemo: undefined,
      mrp: item.mrp != null ? String(Number(item.mrp)) : '',
      discountAmount: mrpOff ? String(mrpOff) : '',
      discountUnit: '%',
      taxRate,
      taxSource: item.intraStateTaxRate != null ? 'item' : undefined,
    });
  }

  const [autoDiscount, setAutoDiscount] = useState<{
    amount: number;
    label: string;
    automatic: boolean;
    reasons: string[];
  } | null>(null);

  const [quote, setQuote] = useState<ShippingQuote | null>(null);
  const [quoting, setQuoting] = useState(false);
  const [shippingTouched, setShippingTouched] = useState(Boolean(existing));
  const [codTouched, setCodTouched] = useState(Boolean(existing));

  const inclusive = form.taxTreatment === 'INCLUSIVE';
  const lineRate = (l: LineDraft) => (l.taxRate === '' ? 18 : Number(l.taxRate));

  function changeTaxTreatment(next: string) {
    const from = form.taxTreatment || 'INCLUSIVE';
    setLines((rows) =>
      rows.map((l) => {
        const switched = switchRate(l.unitPrice, l.rateMemo, from, next, lineRate(l));
        return { ...l, unitPrice: switched.rate, rateMemo: switched.rateMemo };
      })
    );
    set({ taxTreatment: next });
  }
  const lineTaxable = (l: LineDraft) => {
    if (free) return 0;
    const gross = Number(l.quantity || 0) * Number(l.unitPrice || 0);
    return inclusive ? gross / (1 + lineRate(l) / 100) : gross;
  };
  const lineDiscountOf = (l: LineDraft) => {
    const taxable = lineTaxable(l);
    const typed = Math.max(0, Number(l.discountAmount || 0));
    const disc = l.discountUnit === '%' ? (taxable * typed) / 100 : typed;
    return Math.round(Math.min(disc, taxable) * 100) / 100;
  };
  const lineNet = (l: LineDraft) => Math.max(0, lineTaxable(l) - lineDiscountOf(l));
  const subtotal = lines.reduce((sum, l) => sum + lineNet(l), 0);
  const itemsBeforeDiscount = lines.reduce((sum, l) => sum + lineTaxable(l), 0);
  const itemDiscounts = lines.reduce((sum, l) => sum + lineDiscountOf(l), 0);

  const quantityTotal = lines.reduce((n, l) => n + Number(l.quantity || 0), 0);
  const typedCode = form.discountCode.trim();
  const discountLines = JSON.stringify(
    lines
      .filter((l) => (l.itemId || l.variantId) && lineNet(l) > 0)
      .map((l) => ({
        variantId: l.variantId || undefined,
        itemId: l.itemId || undefined,
        net: Math.round(lineNet(l) * 100) / 100,
      }))
  );

  useEffect(() => {
    const t = setTimeout(async () => {
      if (subtotal <= 0) {
        setAutoDiscount(null);
        return;
      }
      try {
        const res = await api.get<{
          data: {
            valid: boolean;
            reasons: string[];
            discountAmount: number;
            discount: { code: string | null; title: string; isAutomatic: boolean } | null;
          };
        }>('/sales/discounts/validate', {
          code: typedCode || undefined,
          subtotal,
          quantity: quantityTotal,
          customerId: form.customerId || undefined,
          lines: discountLines,
        });
        const d = res.data;
        setAutoDiscount(
          d.discount
            ? {
                amount: d.valid ? d.discountAmount : 0,
                label: d.discount.code ?? d.discount.title,
                automatic: d.discount.isAutomatic,
                reasons: d.reasons,
              }
            : null
        );
      } catch {
        setAutoDiscount(null);
      }
    }, 350);
    return () => clearTimeout(t);
  }, [subtotal, quantityTotal, typedCode, form.customerId, discountLines]);

  const serverDiscount = autoDiscount?.amount ?? 0;

  const codeWins = serverDiscount > 0;
  const effectiveDiscount = free ? 0 : codeWins ? serverDiscount : Number(form.discountTotal || 0);
  const orderDiscount = Math.min(effectiveDiscount, subtotal);
  const codNow = !free && (form.paymentMethod === 'COD' || form.deliveryMethod === 'COD');
  const codCharge = codNow ? Number(form.codCharge || 0) : 0;
  const paise = (v: number) => Math.round(v * 100) / 100;
  const estimatedTax = lines.reduce((n, l) => {
    const net = lineNet(l);
    const share = subtotal > 0 ? (orderDiscount * net) / subtotal : 0;
    return n + paise((paise(net - share) * lineRate(l)) / 100);
  }, 0);
  const beforeRounding =
    paise(subtotal) -
    paise(orderDiscount) +
    paise(estimatedTax) +
    (free ? 0 : Number(form.shippingTotal || 0)) +
    codCharge +
    (free ? 0 : Number(form.adjustment || 0));
  const rounding = resolveRoundOff(beforeRounding, free ? '' : form.roundOff, roundOffMode);
  const estimatedTotal = beforeRounding + rounding.value;


  const basket = lines
    .filter((l) => l.variantId && !l.isCustom && Number(l.quantity) > 0)
    .map((l) => `${l.variantId}:${Number(l.quantity)}`)
    .join(',');

  useEffect(() => {
    const blank = !address.pincode.trim() && !address.state.trim();
    const t = setTimeout(async () => {
      if (blank) {
        setQuote(null);
        return;
      }
      setQuoting(true);
      try {
        const res = await api.get<{ data: ShippingQuote }>('/sales/shipping/quote', {
          pincode: address.pincode.trim() || undefined,
          state: address.state.trim() || undefined,
          subtotal: subtotal || 0,
          items: basket || undefined,
          paymentMethod: form.paymentMethod,
          deliveryMethod: form.deliveryMethod,
        });
        setQuote(res.data);
      } catch {
        setQuote(null);
      } finally {
        setQuoting(false);
      }
    }, 400);
    return () => clearTimeout(t);
  }, [address.pincode, address.state, basket, subtotal, form.paymentMethod, form.deliveryMethod]);

  const suggested = quote?.rates?.[0] ?? null;
  const lastQuoted = useRef<{ shipping: number | null; cod: number | null }>({ shipping: null, cod: null });

  useEffect(() => {
    if (!suggested || free) return;
    const quotedShipping = Number(suggested.price);
    const quotedCod = Number(suggested.codCharge || 0);
    const shipping = Number(form.shippingTotal || 0);
    const cod = Number(form.codCharge || 0);
    const followShipping = !shippingTouched || shipping === lastQuoted.current.shipping;
    const followCod = !codTouched || cod === lastQuoted.current.cod;
    const t = setTimeout(() => {
      lastQuoted.current = { shipping: quotedShipping, cod: quotedCod };
      const next: Partial<typeof form> = {};
      if (followShipping && shipping !== quotedShipping) next.shippingTotal = String(quotedShipping);
      if (followCod && cod !== quotedCod) next.codCharge = String(quotedCod);
      if (Object.keys(next).length) set(next);
    }, 0);
    return () => clearTimeout(t);
  }, [suggested, free, form.shippingTotal, form.codCharge, shippingTouched, codTouched, set]);

  async function submit(isDraft: boolean) {
    setError('');

    const payloadLines = lines
      .filter((l) => (l.isCustom ? l.name.trim() && l.unitPrice !== '' : l.itemId || l.variantId))
      .map((l) => ({
        ...(l.isCustom
          ? { name: l.name.trim() }
          : l.variantId
            ? { variantId: l.variantId }
            : { itemId: l.itemId }),
        ...(l.unitPrice !== '' ? { unitPrice: Number(l.unitPrice) } : {}),
        ...(l.mrp !== '' ? { mrp: Number(l.mrp) } : {}),
        quantity: Number(l.quantity || 1),
        ...(l.discountUnit === '%'
          ? { discountPercent: Number(l.discountAmount || 0), discountAmount: 0 }
          : { discountAmount: Number(l.discountAmount || 0), discountPercent: null }),
        ...(l.taxRate !== '' ? { taxRate: Number(l.taxRate) } : {}),
      }));

    if (!payloadLines.length) {
      setError('Add at least one line - pick an item, or tick Custom and give a name and rate');
      return;
    }
    if (replacing && !form.replacementReason) {
      setError('Pick why the replacement is being sent');
      return;
    }
    if (replacing && !form.replacementCharge) {
      setError('Choose whether this replacement is sent free or charged to the customer');
      return;
    }
    if (form.orderType === 'B2B' && !form.customerId) {
      setError('Pick a customer — a B2B order must be raised against an existing one');
      return;
    }
    if (
      form.orderType === 'D2C' && !isDraft && !form.customerId &&
      !address.phone.trim() && !address.email.trim()
    ) {
      setError("Pick a customer, or put the customer's phone or email in the shipping address so we can reach them");
      return;
    }
    if (!isDraft && (!address.line1.trim() || !address.city.trim() || !address.state.trim() || !address.pincode.trim())) {
      setError('A real order needs a shipping address: line 1, city, state and pincode');
      return;
    }

    const pastedLink = form.paymentMethod === 'RAZORPAY' && !free ? form.paymentLinkUrl.trim() : '';
    if (pastedLink && !/^https?:\/\/\S+\.\S+/i.test(pastedLink)) {
      setError('Paste the full payment link, starting with https://');
      return;
    }

    const typedRoundOff = form.roundOff.trim() === '' ? null : Number(form.roundOff);
    if (typedRoundOff !== null && !(Math.abs(typedRoundOff) <= 1)) {
      setError('Round off must be between -1 and 1 — or leave it blank to round automatically');
      return;
    }

    if (
      !isDraft &&
      !form.billingSameAsShipping &&
      (!billing.line1.trim() || !billing.city.trim() || !billing.state.trim() || !billing.pincode.trim())
    ) {
      setError(
        'The billing address needs line 1, city, state and pincode — or tick "Same as shipping address"'
      );
      return;
    }

    setSaving(true);
    try {
      const hasAddress = Boolean(address.line1.trim());
      const body = {
        orderType: form.orderType,
        isDraft,
        customerId: form.customerId || undefined,
        sourceLocationId: form.sourceLocationId || undefined,
        paymentMethod: form.paymentMethod,
        deliveryMethod: form.deliveryMethod,
        shipmentType: form.shipmentType,
        billingSameAsShipping: form.billingSameAsShipping,
        shippingTotal: Number(form.shippingTotal || 0),
        codCharge,
        discountTotal: Number(form.discountTotal || 0),
        taxTreatment: form.taxTreatment || 'INCLUSIVE',
        discountCode: form.discountCode.trim() || undefined,
        gstin: form.gstin.trim() || undefined,
        notes: form.notes.trim() || undefined,
        internalNotes: form.internalNotes.trim() || undefined,

        referenceNumber: form.referenceNumber.trim() || undefined,
        expectedShipmentDate: form.expectedShipmentDate || undefined,
        paymentTerms: form.paymentTerms,
        transporter: form.transporter.trim() || undefined,
        adjustment: Number(form.adjustment || 0),
        adjustmentLabel: form.adjustmentLabel.trim() || 'Adjustment',
        roundOff: typedRoundOff,
        terms: form.terms.trim() || undefined,
        ...(hasAddress
          ? {
              shippingAddress: {
                firstName: address.firstName.trim() || undefined,
                lastName: address.lastName.trim() || undefined,
                phone: address.phone.trim() || undefined,
                email: address.email.trim() || undefined,
                line1: address.line1.trim(),
                line2: address.line2.trim() || undefined,
                landmark: address.landmark.trim() || undefined,
                city: address.city.trim(),
                state: address.state.trim(),
                stateCode: address.stateCode.trim() || undefined,
                pincode: address.pincode.trim(),
                country: address.country.trim() || 'India',
              },
            }
          : {}),
        ...(!form.billingSameAsShipping && billing.line1.trim()
          ? {
              billingAddress: {
                firstName: billing.firstName.trim() || undefined,
                lastName: billing.lastName.trim() || undefined,
                phone: billing.phone.trim() || undefined,
                email: billing.email.trim() || undefined,
                line1: billing.line1.trim(),
                line2: billing.line2.trim() || undefined,
                landmark: billing.landmark.trim() || undefined,
                city: billing.city.trim(),
                state: billing.state.trim(),
                stateCode: billing.stateCode.trim() || undefined,
                pincode: billing.pincode.trim(),
                country: billing.country.trim() || 'India',
              },
            }
          : {}),
        lines: payloadLines,
        ...(form.paymentMethod === 'RAZORPAY' && !free
          ? isEdit
            ? { paymentLinkUrl: pastedLink || null }
            : pastedLink
              ? { paymentLinkUrl: pastedLink }
              : { generatePaymentLink: !!payOptions?.razorpayEnabled && form.autoLink && !isDraft }
          : {}),
        ...(replacing
          ? {
              replacementForId: replacing.id,
              replacementReason: form.replacementReason,
              isFreeReplacement: form.replacementCharge === 'FREE',
            }
          : {}),
      };

      let linkError: string | null = null;
      const res = isEdit
        ? await api
            .patch<{ data: { id: string } }>(`/orders/${existing.id}`, {
              ...body,
              isDraft: undefined,
              orderType: undefined,
              ...(linesLocked ? { lines: undefined } : {}),
            })
            .then(() => ({ data: { id: existing.id } }))
        : await api
            .post<{ data: { id: string }; meta?: { paymentLinkError?: string } }>('/orders', body)
            .then((r) => {
              linkError = r.meta?.paymentLinkError ?? null;
              return r;
            });
      if (linkError) {
        toast.error(
          `Order saved, but the Razorpay link could not be created: ${linkError} ` +
            'Create it from the order page.'
        );
      }
      const failed = [];
      for (const f of files) {
        try {
          await api.post('/shared/attachments', {
            ownerType: 'ORDER',
            ownerId: res.data.id,
            fileName: f.fileName,
            fileUrl: f.fileUrl,
          });
        } catch {
          failed.push(f.fileName);
        }
      }
      if (failed.length) {
        setError(
          `Order saved, but these attachments failed: ${failed.join(', ')}. ` +
            'Add them again from the order page.'
        );
        setSaving(false);
        setTimeout(() => router.push(`/admin/orders/${res.data.id}`), 2500);
        return;
      }

      router.push(`/admin/orders/${res.data.id}`);
    } catch (err) {
      setError(errorMessage(err));
      setSaving(false);
    }
  }

  const title = isEdit
    ? `Edit ${existing.orderNumber}`
    : replacing
      ? `Send replacement for ${replacing.orderNumber}`
      : form.orderType === 'D2C'
        ? 'Create D2C order'
        : 'Create B2B order';

  const customerOptions =
    form.orderType === 'D2C' ? customers.filter((c) => c.customerType !== 'B2B') : customers;

  function switchType(orderType: string) {
    const current = customers.find((c) => c.id === form.customerId);
    if (orderType === 'D2C' && current?.customerType === 'B2B') pickCustomer('');
    set(
      orderType === 'D2C'
        ? { orderType, deliveryMethod: 'PREPAID', shipmentType: 'D2C_SHIPROCKET' }
        : { orderType, deliveryMethod: 'B2B_TRANSPORT', shipmentType: 'B2B_SHIPROCKET' }
    );
  }

  const replacingName = replacing?.customer
    ? [replacing.customer.firstName, replacing.customer.lastName].filter(Boolean).join(' ') ||
      replacing.customer.phone ||
      replacing.customer.email
    : null;

  return (
    <>
      <PageCrumb label={isEdit ? 'Edit' : replacing ? 'Send replacement' : title} />

      <PageHeader
        title={title}
      />

      {linesLocked && (
        <p className="mb-4 rounded-md border border-warning/30 bg-warning/10 px-3 py-2 text-sm text-warning">
          Items and charges on this order are locked
          {existing?.fulfillmentStatus !== 'UNFULFILLED'
            ? ' because part of it has already shipped'
            : ' because it has been invoiced'}
          . Notes, addresses and everything else here still save. To change what was ordered, raise a return for what is
          coming back, or cancel this order and re-raise it.
        </p>
      )}

      {existing?.replacementForId && (
        <p className="mb-4 rounded-md border border-gold/30 bg-gold-soft/60 px-3 py-2 text-sm text-foreground">
          Replacement for{' '}
          <Link href={`/admin/orders/${existing.replacementForId}`} className="font-medium underline">
            {existing.replacementFor?.orderNumber ?? 'the original order'}
          </Link>
          {existing.isFreeReplacement
            ? ` - sent free, so its prices and charges stay at ${money(0)}.`
            : ' - charged to the customer.'}
        </p>
      )}

      {error && <div className="mb-4"><ErrorBox message={error} /></div>}

      <div className="grid gap-5 lg:grid-cols-3">
        <div className="space-y-5 lg:col-span-2 min-w-0">
          {replacing && (
            <Card title={`Replacing ${replacing.orderNumber}`}>
              <div className="space-y-4">
                <Field label="Why is it being sent again?" required>
                  <Select
                    value={form.replacementReason}
                    onChange={(e) => set({ replacementReason: e.target.value })}
                    className="w-full"
                  >
                    <option value="">Select a reason…</option>
                    {REPLACEMENT_REASONS.map((r) => (
                      <option key={r.value} value={r.value}>{r.label}</option>
                    ))}
                  </Select>
                </Field>
                <div>
                  <span className="mb-1.5 block text-xs font-medium text-muted-foreground">
                    Charge <span className="text-destructive">*</span>
                  </span>
                  <div className="grid gap-2 sm:grid-cols-2">
                    {REPLACEMENT_CHARGES.map((c) => (
                      <ChoiceCard
                        key={c.value}
                        name="replacementCharge"
                        value={c.value}
                        checked={form.replacementCharge === c.value}
                        label={c.label}
                        hint={c.hint}
                        onPick={() => set({ replacementCharge: c.value as 'FREE' | 'CHARGED' })}
                      />
                    ))}
                  </div>
                </div>
                <p className="text-xs text-muted-foreground">
                  The items and address below are copied from {replacing.orderNumber} - change
                  anything that is different this time. The new parcel holds stock like any order.
                  {' '}{replacing.orderNumber} stays as it is; if that parcel comes back, record it
                  as a return so the goods go back into stock.
                </p>
              </div>
            </Card>
          )}

          <Card title="Customer">
            {replacing ? (
              <p className="text-sm text-muted-foreground">
                Goes to the same customer as {replacing.orderNumber}
                {replacingName ? (
                  <>
                    : <strong className="text-foreground">{replacingName}</strong>
                    {replacing.customer?.phone && replacingName !== replacing.customer.phone
                      ? ` · ${replacing.customer.phone}`
                      : ''}
                  </>
                ) : (
                  ' - a guest, so the address below is all there is.'
                )}
              </p>
            ) : (
              <>
                {!isEdit && !type && (
                  <div className="mb-4 grid gap-2 sm:grid-cols-2">
                    {ORDER_TYPES.map((t) => (
                      <ChoiceCard
                        key={t.value}
                        name="orderType"
                        value={t.value}
                        checked={form.orderType === t.value}
                        label={t.label}
                        hint={t.hint}
                        onPick={() => switchType(t.value)}
                      />
                    ))}
                  </div>
                )}
                <Field
                  label="Customer"
                  required={form.orderType === 'B2B'}
                  hint={
                    form.orderType === 'B2B'
                      ? 'A B2B order must belong to an existing customer'
                      : 'If the phone or email in the shipping address belongs to an existing customer, the order goes to them - otherwise a new customer is added'
                  }
                >
                  <CustomerSelect
                    value={form.customerId}
                    customers={customerOptions}
                    include={form.orderType === 'D2C' ? (c) => c.customerType !== 'B2B' : undefined}
                    placeholder={form.orderType === 'B2B' ? 'Select a customer' : 'New customer - from the shipping address'}
                    onChange={(customerId, picked) => pickCustomer(customerId, picked)}
                  />
                </Field>
                {form.orderType === 'B2B' && customers.length === 0 && (
                  <p className="mt-2 text-xs text-warning">
                    No customers found — create one first, a B2B order cannot be raised without it.
                  </p>
                )}
                {seeded.length > 0 && (
                  <p className="mt-2 text-xs text-success">
                    Filled in from their record: {seeded.join(', ')}. Change anything below that is
                    different for this order.
                  </p>
                )}
              </>
            )}
          </Card>

          <Card
            title="Items"
            padded={false}
            action={
              <span className="flex min-w-0 flex-wrap items-center justify-end gap-x-3 gap-y-2">
                {sourceState && (
                  <span className="text-xs text-muted-foreground">
                    {intraState ? (
                      <>
                        <strong className="text-foreground">CGST + SGST</strong>
                        {' — '}within {stateName(sourceState)}
                      </>
                    ) : (
                      <>
                        <strong className="text-foreground">IGST</strong>
                        {' — '}
                        {stateName(sourceState)} → {stateName(destinationState) || 'destination not set'}
                      </>
                    )}
                  </span>
                )}
                <Select
                  value={form.taxTreatment}
                  onChange={(e) => changeTaxTreatment(e.target.value)}
                  aria-label="Amounts are"
                  className="w-40"
                  disabled={chargesLocked}
                >
                  <option value="INCLUSIVE">Rates include GST</option>
                  <option value="EXCLUSIVE">Rates exclude GST</option>
                </Select>
                <Button size="sm" onClick={() => setLines([...lines, blankLine()])} disabled={linesLocked}>
                  + Add line
                </Button>
              </span>
            }
          >
            <Table>
              <thead>
                <tr>
                  <Th>{form.orderType === 'D2C' ? 'Product' : 'Item'}</Th>
                  <Th className="text-right">Qty</Th>
                  <Th className="text-right">Selling price</Th>
                  <Th className="text-right">Discount</Th>
                  <Th>Tax</Th>
                  <Th className="right-0 z-2 text-right shadow-[inset_1px_0_0_var(--border)]">Total</Th>
                </tr>
              </thead>
              <tbody>
                {lines.length === 0 && <EmptyRow colSpan={6} />}
                {lines.map((l, i) => {
                  const gross = free ? 0 : Number(l.quantity || 0) * Number(l.unitPrice || 0);
                  const typed = Number(l.discountAmount || 0);
                  const lineTotal = gross - (l.discountUnit === '%' ? (gross * typed) / 100 : typed);
                  return (
                    <tr key={i}>
                      <Td>
                        {l.isCustom ? (
                          <Input
                            value={l.name}
                            onChange={(e) => setLine(i, { name: e.target.value })}
                            placeholder="Custom item name"
                            className="min-w-[200px]"
                            disabled={linesLocked}
                          />
                        ) : (
                          form.orderType === 'D2C' && !l.itemId ? (
                            <SearchSelect
                              value={l.variantId}
                              onChange={(v) => pickVariant(i, v)}
                              className="w-full min-w-[260px]"
                              placeholder="Select a product…"
                              searchPlaceholder="Search by product, flavour, pack or SKU…"
                              emptyMessage="No products match"
                              clearable
                              disabled={linesLocked}
                              options={
                                l.variantId
                                  ? variantChoices.map((o) =>
                                      o.value === l.variantId ? { ...o, label: `${o.group} - ${o.label}` } : o
                                    )
                                  : variantChoices
                              }
                            />
                          ) : l.variantId ? (
                            <div className="min-w-[240px] text-sm">
                              {l.name}
                              <span className="block text-[11px] text-muted-foreground">
                                Product variant
                              </span>
                            </div>
                          ) : (
                            <ItemSelect
                              value={l.itemId}
                              items={stockItems}
                              onChange={(v) => pickItem(i, v)}
                              className="w-full min-w-[260px]"
                              placeholder="Select an item…"
                              disabled={linesLocked}
                            />
                          )
                        )}
                        {l.mrp !== '' && Number(l.mrp) > 0 && (
                          <OffMrpNote
                            mrp={l.mrp}
                            rate={free ? 0 : (lineNet(l) * (1 + lineRate(l) / 100)) / Math.max(1, Number(l.quantity || 1))}
                            inclusive
                            className="mt-1"
                          />
                        )}
                        <label className="mt-1 flex items-center gap-1.5 text-xs text-muted-foreground">
                          <input
                            type="checkbox"
                            checked={l.isCustom}
                            disabled={linesLocked}
                            onChange={(e) =>
                              setLine(i, {
                                isCustom: e.target.checked,
                                variantId: '',
                                itemId: '',
                                name: '',
                                unitPrice: '',
                                mrp: '',
                              })
                            }
                          />
                          Custom item
                        </label>
                      </Td>
                      <Td>
                        <Input
                          type="number" min="1"
                          value={l.quantity}
                          onChange={(e) => setLine(i, { quantity: e.target.value })}
                          className="w-16 text-right"
                          disabled={linesLocked}
                        />
                      </Td>
                      <Td>
                        <Input
                          type="number" step="0.01" min="0"
                          value={free ? '0' : l.unitPrice}
                          onChange={(e) => setLine(i, { unitPrice: e.target.value })}
                          className="w-24 text-right"
                          disabled={chargesLocked}
                        />
                      </Td>
                      <Td>
                        <div className="flex items-center gap-1">
                          <Input
                            type="number" step="0.01" min="0"
                            value={free ? '0' : l.discountAmount}
                            onChange={(e) => setLine(i, { discountAmount: e.target.value })}
                            className="w-20 text-right"
                            disabled={chargesLocked}
                          />
                          <Select
                            value={l.discountUnit}
                            onChange={(e) => setLine(i, { discountUnit: e.target.value as '%' | '₹' })}
                            aria-label={`Discount in % or ${currencySymbol()}`}
                            className="w-14 px-1"
                            disabled={chargesLocked}
                          >
                            <option value="%">%</option>
                            <option value="₹">{currencySymbol()}</option>
                          </Select>
                        </div>
                      </Td>
                      <Td>
                        <Select
                          value={slabFor(l)?.id ?? ''}
                          onChange={(e) => {
                            const t = slabs.find((x) => x.id === e.target.value);
                            setLine(i, { taxRate: t ? String(Number(t.rate)) : '' });
                          }}
                          className="min-w-[140px]"
                          disabled={linesLocked}
                        >
                          <option value="">
                            {slabs.length ? 'Default (18%)' : 'No slabs set up'}
                          </option>
                          {slabs.map((t) => (
                            <option key={t.id} value={t.id}>
                              {t.name} [{Number(t.rate)}%]
                            </option>
                          ))}
                        </Select>
                      </Td>
                      <Td className="sticky right-0 z-1 bg-card shadow-[inset_1px_0_0_var(--border)] [tr:has(input:checked)>&]:bg-gold-soft [tr:hover>&]:bg-[color-mix(in_srgb,var(--muted)_55%,var(--card))]">
                        <div className="flex items-center justify-end gap-2 whitespace-nowrap font-medium">
                          {money(Math.max(0, lineTotal))}
                          {lines.length > 1 && (
                            <Button
                              size="sm"
                              variant="danger"
                              aria-label="Remove line"
                              onClick={() => setLines(lines.filter((_, idx) => idx !== i))}
                              disabled={linesLocked}
                            >
                              ×
                            </Button>
                          )}
                        </div>
                      </Td>
                    </tr>
                  );
                })}
              </tbody>
            </Table>
            <p className="px-4 py-2.5 text-xs text-muted-foreground">
              Left on Default, a taxable item is charged at 18% — the slab list is not read from
              the HSN, so set it here when an item sits on a different one. Placing the order
              reserves stock into <strong>committed</strong>.
            </p>
          </Card>

          <Card title="Shipping address">
            {form.customerId && addressBookState === 'loading' && (
              <p className="mb-4 text-xs text-muted-foreground">
                Looking up this customer&apos;s saved addresses…
              </p>
            )}

            {shippingOptions.length > 0 && (
              <div className="mb-4">
                <Field
                  label="Saved address"
                  hint="Filled in from the customer's address book — edit below if this delivery goes elsewhere"
                >
                  <Select
                    value={pickedAddressId}
                    onChange={(e) => {
                      const a = shippingOptions.find((x) => x.id === e.target.value);
                      if (a) {
                        applySavedAddress(a, customers.find((c) => c.id === form.customerId));
                      } else {
                        setPickedAddressId('');
                        setAddr({
                          line1: '', line2: '', landmark: '',
                          city: '', state: '', stateCode: '', pincode: '',
                        });
                      }
                    }}
                    className="w-full"
                  >
                    {shippingOptions.map((a) => (
                      <option key={a.id} value={a.id}>
                        {a.label ? `${a.label} — ` : ''}
                        {addressSummary(a)}
                        {a.isDefaultShipping ? ' (default)' : ''}
                      </option>
                    ))}
                    <option value="">Ship somewhere else…</option>
                  </Select>
                </Field>
              </div>
            )}

            {form.customerId && addressBookState === 'ready' && savedAddresses.length === 0 && (
              <p className="mb-4 rounded-md border border-warning/30 bg-warning/10 px-3 py-2 text-xs text-warning">
                This customer has no address on file yet — fill it in below.{' '}
                <Link
                  href={`/admin/customers/${form.customerId}`}
                  target="_blank"
                  className="font-medium underline"
                >
                  Add it to their record
                </Link>{' '}
                so it is there next time.
              </p>
            )}

            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="First name">
                <Input value={address.firstName} onChange={(e) => setAddr({ firstName: e.target.value })} />
              </Field>
              <Field label="Last name">
                <Input value={address.lastName} onChange={(e) => setAddr({ lastName: e.target.value })} />
              </Field>
              <Field label="Phone">
                <Input
                  type="tel"
                  inputMode="tel"
                  autoComplete="tel"
                  value={address.phone}
                  onChange={(e) => setAddr({ phone: e.target.value.replace(/[^\d+\s-]/g, '') })}
                  placeholder="98765 43210"
                />
              </Field>
              <Field label="Email">
                <Input
                  type="email"
                  autoComplete="email"
                  value={address.email}
                  onChange={(e) => setAddr({ email: e.target.value })}
                />
              </Field>
            </div>
            <div className="mt-4 space-y-4">
              <Field label="Address line 1" required>
                <Input
                  value={address.line1}
                  onChange={(e) => setAddr({ line1: e.target.value })}
                  placeholder="Flat no 201, Tower 3"
                />
              </Field>
              <Field label="Address line 2">
                <Input value={address.line2} onChange={(e) => setAddr({ line2: e.target.value })} />
              </Field>
              <div className="grid gap-4 sm:grid-cols-3">
                <Field label="City" required>
                  <Input value={address.city} onChange={(e) => setAddr({ city: e.target.value })} />
                </Field>
                <Field
                  label="State"
                  required
                  hint={stateSelectHint(address.stateCode, address.state) ?? 'Decides CGST + SGST or IGST'}
                >
                  <StateSelect
                    code={address.stateCode}
                    name={address.state}
                    onChange={(st) => setAddr({ state: st?.name ?? '', stateCode: st?.code ?? '' })}
                  />
                </Field>
                <Field label="Pincode" required>
                  <Input
                    inputMode="numeric"
                    autoComplete="postal-code"
                    maxLength={6}
                    value={address.pincode}
                    onChange={(e) => setAddr({ pincode: e.target.value.replace(/\D/g, '').slice(0, 6) })}
                    placeholder="226028"
                  />
                </Field>
              </div>
            </div>
          </Card>

          <Card title="Billing address">
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={form.billingSameAsShipping}
                onChange={(e) => set({ billingSameAsShipping: e.target.checked })}
              />
              <span className="text-foreground">Same as shipping address</span>
            </label>

            {!form.billingSameAsShipping && (
              <div className="mt-4">
                {billingOptions.length > 0 && (
                  <div className="mb-4">
                    <Field
                      label="Saved address"
                      hint="Where the invoice goes — often a head office rather than the delivery point"
                    >
                      <Select
                        value={pickedBillingId}
                        onChange={(e) => {
                          const a = billingOptions.find((x) => x.id === e.target.value);
                          if (a) {
                            applyBillingAddress(a, customers.find((c) => c.id === form.customerId));
                          } else {
                            setPickedBillingId('');
                            setBilling(blankAddress());
                          }
                        }}
                        className="w-full"
                      >
                        {billingOptions.map((a) => (
                          <option key={a.id} value={a.id}>
                            {a.label ? `${a.label} — ` : ''}
                            {addressSummary(a)}
                            {a.isDefaultBilling ? ' (default)' : ''}
                          </option>
                        ))}
                        <option value="">Bill somewhere else…</option>
                      </Select>
                    </Field>
                  </div>
                )}

                <div className="grid gap-4 sm:grid-cols-2">
                  <Field label="First name">
                    <Input value={billing.firstName} onChange={(e) => setBill({ firstName: e.target.value })} />
                  </Field>
                  <Field label="Last name">
                    <Input value={billing.lastName} onChange={(e) => setBill({ lastName: e.target.value })} />
                  </Field>
                  <Field label="Phone">
                    <Input
                      type="tel"
                      inputMode="tel"
                      value={billing.phone}
                      onChange={(e) => setBill({ phone: e.target.value.replace(/[^\d+\s-]/g, '') })}
                    />
                  </Field>
                  <Field label="Email">
                    <Input type="email" value={billing.email} onChange={(e) => setBill({ email: e.target.value })} />
                  </Field>
                </div>
                <div className="mt-4 space-y-4">
                  <Field label="Address line 1" required>
                    <Input value={billing.line1} onChange={(e) => setBill({ line1: e.target.value })} />
                  </Field>
                  <Field label="Address line 2">
                    <Input value={billing.line2} onChange={(e) => setBill({ line2: e.target.value })} />
                  </Field>
                  <div className="grid gap-4 sm:grid-cols-3">
                    <Field label="City" required>
                      <Input value={billing.city} onChange={(e) => setBill({ city: e.target.value })} />
                    </Field>
                    <Field label="State" required hint={stateSelectHint(billing.stateCode, billing.state) ?? undefined}>
                      <StateSelect
                        code={billing.stateCode}
                        name={billing.state}
                        onChange={(st) => setBill({ state: st?.name ?? '', stateCode: st?.code ?? '' })}
                      />
                    </Field>
                    <Field label="Pincode" required>
                      <Input
                        inputMode="numeric"
                        maxLength={6}
                        value={billing.pincode}
                        onChange={(e) => setBill({ pincode: e.target.value.replace(/\D/g, '').slice(0, 6) })}
                      />
                    </Field>
                  </div>
                </div>
                <p className="mt-3 text-xs text-muted-foreground">
                  Place of supply still comes from the shipping address — this only changes who the
                  invoice is addressed to.
                </p>
              </div>
            )}
          </Card>
        </div>

        <div className="space-y-5">
          <Card title="Payment & delivery">
            <div className="space-y-4">
              <Field
                label="Payment method"
                hint={free ? 'Nothing to collect on a free replacement' : undefined}
              >
                <Select
                  value={free ? 'MANUAL' : form.paymentMethod}
                  onChange={(e) => {
                    const paymentMethod = e.target.value;
                    set({
                      paymentMethod,
                      ...(paymentMethod === 'COD'
                        ? { deliveryMethod: 'COD' }
                        : form.deliveryMethod === 'COD'
                          ? { deliveryMethod: form.orderType === 'B2B' ? 'B2B_TRANSPORT' : 'PREPAID' }
                          : {}),
                    });
                  }}
                  className="w-full"
                  disabled={free}
                >
                  <option value="RAZORPAY">Razorpay</option>
                  <option value="COD">Cash on delivery</option>
                  <option value="UPI">UPI</option>
                  <option value="BANK_TRANSFER">Bank transfer</option>
                  <option value="CARD">Card</option>
                  <option value="MANUAL">Manual</option>
                </Select>
              </Field>
              {form.paymentMethod === 'RAZORPAY' && !free && (
                <div className="space-y-3 rounded-md border border-border p-3">
                  {!isEdit && payOptions?.razorpayEnabled && (
                    <label className="flex items-start gap-2 text-sm text-foreground">
                      <input
                        type="checkbox"
                        checked={form.autoLink && !form.paymentLinkUrl.trim()}
                        disabled={!!form.paymentLinkUrl.trim()}
                        onChange={(e) => set({ autoLink: e.target.checked })}
                        className="mt-0.5"
                      />
                      <span>Create a Razorpay payment link for the total when the order is placed</span>
                    </label>
                  )}
                  <Field
                    label={!isEdit && payOptions?.razorpayEnabled ? 'Or paste a link' : 'Payment link'}
                    hint={
                      payOptions?.defaultLinkUrl
                        ? 'Leave it empty and your default link is shown on the order instead'
                        : 'Made in the Razorpay dashboard. You can also add one from the order page later.'
                    }
                  >
                    <Input
                      value={form.paymentLinkUrl}
                      onChange={(e) => set({ paymentLinkUrl: e.target.value })}
                      placeholder="https://rzp.io/l/…"
                    />
                  </Field>
                </div>
              )}
              {form.paymentMethod === 'UPI' && !free && (
                <p className="text-xs text-muted-foreground">
                  {payOptions?.upiId ? (
                    <>
                      A QR for the exact amount, paid to{' '}
                      <span className="font-mono">{payOptions.upiId}</span>, is shown on the order and
                      its PDF.
                    </>
                  ) : (
                    <>
                      <Link
                        href="/admin/organization/edit"
                        className="text-gold-ink hover:underline"
                      >
                        Add your UPI ID
                      </Link>{' '}
                      so a QR for the exact amount can be shown on the order.
                    </>
                  )}
                </p>
              )}
              <Field
                label="Ship via"
                hint="Who carries the goods. Shiprocket bookings are raised from the order once it is packed."
              >
                <Select
                  value={form.shipmentType}
                  onChange={(e) => set({ shipmentType: e.target.value })}
                  className="w-full"
                >
                  <option value="D2C_SHIPROCKET">Shiprocket — D2C (courier)</option>
                  <option value="B2B_SHIPROCKET">Shiprocket — B2B (freight)</option>
                  <option value="MANUAL">Direct — our own transport</option>
                </Select>
              </Field>
              <Field
                label="Delivery terms"
                hint="How the delivery is settled, not who carries it"
              >
                <Select
                  value={free ? 'PREPAID' : form.deliveryMethod}
                  onChange={(e) => {
                    const deliveryMethod = e.target.value;
                    set({
                      deliveryMethod,
                      ...(deliveryMethod === 'COD'
                        ? { paymentMethod: 'COD' }
                        : form.paymentMethod === 'COD'
                          ? { paymentMethod: form.orderType === 'B2B' ? 'BANK_TRANSFER' : 'UPI' }
                          : {}),
                    });
                  }}
                  className="w-full"
                  disabled={free}
                >
                  <option value="PREPAID">Prepaid</option>
                  <option value="COD">COD</option>
                  <option value="B2B_TRANSPORT">B2B transport</option>
                  <option value="SELF_PICKUP">Self pickup</option>
                  <option value="MANUAL">Manual</option>
                </Select>
              </Field>
              <Field label="Ship from location">
                <Select
                  value={form.sourceLocationId}
                  onChange={(e) => set({ sourceLocationId: e.target.value })}
                  className="w-full"
                >
                  {locations.map((l) => (
                    <option key={l.id} value={l.id}>
                      {l.code}{l.name.length <= 24 && l.name !== l.code ? ` - ${l.name}` : ''}{l.isDefault ? ' (default)' : ''}
                    </option>
                  ))}
                </Select>
              </Field>
              {codNow && form.deliveryMethod === 'COD' && (
                <p className="text-xs text-warning">
                  COD orders open a 12-hour confirmation window. Stock stays committed until it is
                  confirmed or expires.
                </p>
              )}
            </div>
          </Card>

          <Card title="Order details">
            <div className="space-y-4">
              <Field
                label="Reference#"
                hint="The customer's own number - their PO, or the channel's order id"
              >
                <Input
                  value={form.referenceNumber}
                  onChange={(e) => set({ referenceNumber: e.target.value })}
                />
              </Field>
              <Field label="Expected shipment date">
                <Input
                  type="date"
                  value={form.expectedShipmentDate}
                  onChange={(e) => set({ expectedShipmentDate: e.target.value })}
                />
              </Field>
              <Field label="Payment terms">
                <PaymentTermSelect
                  value={form.paymentTerms}
                  onChange={(paymentTerms) => set({ paymentTerms })}
                />
              </Field>
              {form.shipmentType === 'MANUAL' ? (
                <Field
                  label="Transporter"
                  hint="The carrier for the e-way bill — required above ₹50,000 of goods"
                >
                  <TransporterSelect
                    value={form.transporter}
                    onChange={(transporter) => set({ transporter })}
                  />
                </Field>
              ) : (
                <p className="text-xs text-muted-foreground">
                  Shiprocket picks the courier when the shipment is booked, so there is no
                  transporter to name here.
                </p>
              )}
            </div>
          </Card>

          <Card title="Charges">
            <div className="space-y-4">
              <Field label="Shipping">
                <Input
                  type="number" step="0.01" min="0"
                  value={free ? '0' : form.shippingTotal}
                  onChange={(e) => {
                    setShippingTouched(true);
                    set({ shippingTotal: e.target.value });
                  }}
                  disabled={chargesLocked}
                />
                <ShippingQuoteNote
                  quote={quote}
                  quoting={quoting}
                  suggested={suggested}
                  cod={codNow}
                  overridden={
                    !!suggested &&
                    (Number(suggested.price) !== Number(form.shippingTotal || 0) ||
                      (codNow && Number(suggested.codCharge || 0) !== codCharge))
                  }
                  onApply={() => {
                    if (!suggested) return;
                    setShippingTouched(false);
                    setCodTouched(false);
                    set({ shippingTotal: String(Number(suggested.price)), codCharge: String(Number(suggested.codCharge || 0)) });
                  }}
                />
              </Field>
              {codNow && (
                <Field label="COD charge" hint="Charged on top of shipping for cash on delivery - shown on the order and its invoice">
                  <Input
                    type="number" step="0.01" min="0"
                    value={form.codCharge}
                    onChange={(e) => {
                      setCodTouched(true);
                      set({ codCharge: e.target.value });
                    }}
                    disabled={chargesLocked}
                  />
                </Field>
              )}
              <Field
                label="Order discount"
                hint={
                  codeWins
                    ? undefined
                    : 'A one-off amount off this order. A discount code replaces it.'
                }
              >
                <Input
                  type="number" step="0.01" min="0"
                  value={free ? '0' : form.discountTotal}
                  onChange={(e) => set({ discountTotal: e.target.value })}
                  disabled={codeWins || chargesLocked}
                />
                {codeWins && (
                  <span className="mt-1 block text-xs text-warning">
                    {autoDiscount?.label ?? 'A discount code'} is applied, so it sets the
                    discount instead. Clear the code to type your own amount.
                  </span>
                )}
              </Field>
              <Field label="Discount code">
                <DiscountSelect
                  value={form.discountCode}
                  onChange={(code) => set({ discountCode: code })}
                  disabled={chargesLocked}
                />
              </Field>
              {(form.orderType === 'B2B' || form.gstin.trim() !== '') && (
                <GstinField
                  value={form.gstin}
                  hint="Filled in from the customer - printed on the invoice"
                  onChange={(gstin) => set({ gstin })}
                />
              )}
              <div className="grid grid-cols-2 gap-3">
                <Field label="Adjustment label">
                  <Input
                    value={form.adjustmentLabel}
                    onChange={(e) => set({ adjustmentLabel: e.target.value })}
                  />
                </Field>
                <Field label="Adjustment" hint="A one-off charge or deduction">
                  <Input
                    type="number" step="0.01"
                    value={free ? '' : form.adjustment}
                    onChange={(e) => set({ adjustment: e.target.value })}
                    disabled={chargesLocked}
                  />
                </Field>
              </div>
              <Field
                label="Round off"
                hint="Leave blank to round the final total automatically, as set on your organization"
              >
                <div className="flex items-center gap-2">
                  <Input
                    type="number" step="0.01" min="-1" max="1"
                    value={form.roundOff}
                    placeholder="Auto"
                    onChange={(e) => set({ roundOff: e.target.value })}
                    disabled={chargesLocked}
                    className="w-32"
                  />
                  {form.roundOff.trim() !== '' && !chargesLocked && (
                    <button
                      type="button"
                      onClick={() => set({ roundOff: '' })}
                      className="text-xs text-gold-ink hover:underline"
                    >
                      Use auto
                    </button>
                  )}
                </div>
              </Field>
            </div>

            <dl className="mt-4 space-y-1.5 border-t border-border pt-3 text-sm">
              <div className="flex justify-between">
                <dt className="text-muted-foreground">
                  Items{inclusive ? ' (GST taken out)' : ''}
                </dt>
                <dd>{money(itemsBeforeDiscount)}</dd>
              </div>
              <MrpTotalRows
                lines={lines.map((l) => ({ mrp: l.mrp, quantity: l.quantity, netTaxable: lineNet(l), taxPercent: lineRate(l) }))}
                headerDiscountRatio={subtotal > 0 ? orderDiscount / subtotal : 0}
                valueClass=""
              />
              {itemDiscounts > 0 && (
                <div className="flex justify-between">
                  <dt className="text-muted-foreground">Item discounts{pctSuffix(itemDiscounts, itemsBeforeDiscount)}</dt>
                  <dd>− {money(itemDiscounts)}</dd>
                </div>
              )}
              {!codeWins && orderDiscount > 0 && (
                <div className="flex justify-between">
                  <dt className="text-muted-foreground">Order discount{pctSuffix(orderDiscount, subtotal)}</dt>
                  <dd>− {money(orderDiscount)}</dd>
                </div>
              )}
              {autoDiscount && autoDiscount.amount > 0 && (
                <div className="flex justify-between text-success">
                  <dt>
                    {autoDiscount.label}
                    {pctSuffix(autoDiscount.amount, subtotal)}
                    <span className="ml-1.5 text-xs opacity-70">
                      {autoDiscount.automatic ? 'automatic' : 'code'}
                    </span>
                  </dt>
                  <dd>− {money(autoDiscount.amount)}</dd>
                </div>
              )}
              <div className="flex justify-between">
                <dt className="text-muted-foreground">GST</dt>
                <dd>{money(estimatedTax)}</dd>
              </div>
              {!free && Number(form.shippingTotal || 0) > 0 && (
                <div className="flex justify-between">
                  <dt className="text-muted-foreground">Shipping</dt>
                  <dd>{money(Number(form.shippingTotal))}</dd>
                </div>
              )}
              {codCharge > 0 && (
                <div className="flex justify-between">
                  <dt className="text-muted-foreground">COD charge</dt>
                  <dd>{money(codCharge)}</dd>
                </div>
              )}
              {!free && Number(form.adjustment || 0) !== 0 && (
                <div className="flex justify-between">
                  <dt className="text-muted-foreground">{form.adjustmentLabel || 'Adjustment'}</dt>
                  <dd>{money(Number(form.adjustment))}</dd>
                </div>
              )}
              {rounding.value !== 0 && (
                <div className="flex justify-between">
                  <dt className="text-muted-foreground">Round off</dt>
                  <dd>{rounding.value > 0 ? '+ ' : '− '}{money(Math.abs(rounding.value))}</dd>
                </div>
              )}
              <div className="flex justify-between border-t border-border pt-1.5 font-medium">
                <dt>Total</dt>
                <dd>{money(Math.max(0, estimatedTotal))}</dd>
              </div>
            </dl>
            {autoDiscount && autoDiscount.amount === 0 && autoDiscount.reasons.length > 0 && (
              <p className="mt-2 text-xs text-warning">
                {autoDiscount.label} will be refused: {autoDiscount.reasons.join(' · ')}
              </p>
            )}
            <p className="mt-2 text-xs text-muted-foreground">
              Final figures are worked out again when you save.
            </p>
          </Card>

          <Card title={`Attachments (${files.length}/10)`}>
            {files.length > 0 && (
              <ul className="mb-3 space-y-2">
                {files.map((f, i) => (
                  <li key={f.fileUrl} className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <div className="truncate text-sm font-medium text-foreground">
                        {f.fileName}
                      </div>
                      <div className="truncate text-xs text-muted-foreground">
                        {f.fileUrl}
                      </div>
                    </div>
                    <Button
                      size="sm"
                      variant="danger"
                      onClick={() => setFiles(files.filter((_, idx) => idx !== i))}
                    >
                      x
                    </Button>
                  </li>
                ))}
              </ul>
            )}

            <div className="space-y-2">
              <div className="flex gap-2">
                <FileUpload
                  label="Upload file"
                  accept="image/*,application/pdf,.csv,.xlsx,.docx"
                  multiple
                  onUploaded={(uploaded) => {
                    setFiles([
                      ...files,
                      ...uploaded
                        .filter((u) => !files.some((f) => f.fileUrl === u.url))
                        .map((u) => ({ fileName: u.fileName, fileUrl: u.url })),
                    ].slice(0, 10));
                    setFileError('');
                  }}
                />
              </div>
              {fileError && (
                <p className="text-xs text-destructive">{fileError}</p>
              )}
              <p className="text-xs text-muted-foreground">
                Up to 10 files - images, PDF, CSV, Excel or Word. They are attached when you save.
              </p>
            </div>
          </Card>

          <Card title="Notes">
            <div className="space-y-4">
              <Field label="Customer note">
                <Textarea rows={2} value={form.notes} onChange={(e) => set({ notes: e.target.value })} />
              </Field>
              <Field label="Internal note">
                <Textarea
                  rows={2}
                  value={form.internalNotes}
                  onChange={(e) => set({ internalNotes: e.target.value })}
                />
              </Field>
            </div>
          </Card>
        </div>
      </div>
      <SaveBar>
        <Link href={seedFrom ? `/orders/${seedFrom.id}` : '/orders'}>
          <Button type="button">Cancel</Button>
        </Link>
        {!isEdit && !replacing && (
          <Button type="button" disabled={saving} onClick={() => submit(true)}>
            Save as draft
          </Button>
        )}
        <Button
          type="button"
          variant="primary"
          disabled={saving}
          onClick={() => submit(isEdit ? existing.isDraft : false)}
        >
          {saving && <Spinner className="border-card/40 border-t-card" />}
          {isEdit ? 'Save changes' : replacing ? 'Send replacement' : 'Create order'}
        </Button>
      </SaveBar>
    </>
  );
}
