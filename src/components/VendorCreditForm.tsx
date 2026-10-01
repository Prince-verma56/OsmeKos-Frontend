'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { api, money, errorMessage, type Paged, todayIso } from '@/lib/api';
import { priceAs, switchRate, type RateMemo } from '@/lib/items';
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
import { VendorSelect } from './VendorSelect';
import { ComboSelect } from './ComboSelect';
import { SaveBar } from './form/SaveBar';
import { PageCrumb } from '@/lib/crumbs';

type VendorAddress = {
  id: string; type: string; attention: string | null;
  line1: string; line2: string | null; city: string; state: string;
  stateCode: string | null; pincode: string; country: string; phone: string | null;
};

type Vendor = {
  id: string;
  displayName: string;
  gstin?: string | null;
  gstTreatment?: string | null;
  sourceOfSupplyCode?: string | null;
};

const GST_TREATMENT: Record<string, string> = {
  REGISTERED_REGULAR: 'Registered Business — Regular',
  REGISTERED_COMPOSITION: 'Registered Business — Composition',
  UNREGISTERED: 'Unregistered Business',
  CONSUMER: 'Consumer',
  OVERSEAS: 'Overseas',
  SEZ: 'SEZ',
};

const MAX_ATTACHMENTS = 5;
type Location = { id: string; name: string; isDefault: boolean; stateCode?: string | null };
type Item = {
  id: string; name: string; sku: string | null; unit: string;
  hsnCode: string | null; costPrice: string | null; costTaxTreatment?: string | null;
  imageUrls?: string[];
};
type TaxRate = { id: string; name: string; rate: string; type: string; isDefault: boolean };
type OpenBill = {
  id: string;
  billNumber: string;
  balanceDue: string;
  status?: string;
  purchaseOrderId?: string | null;
};
type SourceLine = {
  itemId: string | null; itemName: string; description: string | null; account: string | null;
  hsnCode: string | null; unit: string; quantity: string; rate: string;
  discountPercent: string | null; taxRate: string;
};
type BillDetail = {
  id: string;
  billNumber: string;
  purchaseOrderId: string | null;
  purchaseOrder?: { id: string; poNumber: string } | null;
  locationId: string | null;
  taxTreatment: string;
  discountLevel: string;
  sourceOfSupplyCode: string | null;
  destinationOfSupplyCode: string | null;
  isReverseCharge: boolean;
  lines: SourceLine[];
};
type VendorPo = { id: string; poNumber: string; poDate: string; status: string; grandTotal: string };
type PoDetail = {
  id: string;
  poNumber: string;
  locationId: string | null;
  lines: {
    itemId: string; itemName: string; description: string | null; account: string | null;
    hsnCode: string | null; unit: string; quantity: string; rate: string;
    discountPercent: string | null; taxRate: string;
  }[];
};

type LineDraft = {
  itemId: string;
  itemName: string;
  description: string;
  account: string;
  hsnCode: string;
  unit: string;
  quantity: string;
  rate: string;
  discountPercent: string;
  taxRateId: string;
  seededTaxPercent?: number;
  hint?: string;
  rateMemo?: RateMemo;
};

const returnLine = (l: SourceLine, from: 'billed' | 'ordered'): LineDraft => ({
  itemId: l.itemId ?? '',
  itemName: l.itemName,
  description: l.description ?? '',
  account: l.account ?? '',
  hsnCode: l.hsnCode ?? '',
  unit: l.unit,
  quantity: '0',
  rate: String(Number(l.rate)),
  discountPercent: l.discountPercent ? String(Number(l.discountPercent)) : '',
  taxRateId: '',
  seededTaxPercent: Number(l.taxRate),
  hint: `of ${Number(l.quantity)} ${from}`,
});

export type ExistingCredit = {
  id: string;
  creditNumber: string;
  vendorId: string;
  billId: string | null;
  purchaseOrderId?: string | null;
  locationId: string | null;
  creditDate: string;
  reason: string | null;
  referenceNumber: string | null;
  orderNumber: string | null;
  sourceOfSupplyCode: string | null;
  destinationOfSupplyCode: string | null;
  isReverseCharge: boolean;
  taxTreatment: string;
  discountLevel: string;
  discountPercent: string | null;
  taxWithholdingType: string | null;
  adjustment: string;
  adjustmentLabel: string;
  status: string;
  roundOff?: string;
  roundOffManual?: boolean;
  notes: string | null;
  terms: string | null;
  lines: {
    itemId: string | null; itemName: string; description: string | null;
    account: string | null; hsnCode: string | null; unit: string;
    quantity: string; rate: string; discountPercent: string | null; taxRate: string;
  }[];
};

const blankLine = (): LineDraft => ({
  itemId: '', itemName: '', description: '', account: '', hsnCode: '', unit: 'pcs',
  quantity: '1', rate: '0', discountPercent: '', taxRateId: '',
});

export function VendorCreditForm({ existing }: { existing?: ExistingCredit }) {
  const router = useRouter();
  const isEdit = !!existing;

  const [vendors, setVendors] = useState<Vendor[]>([]);
  const [locations, setLocations] = useState<Location[]>([]);
  const [items, setItems] = useState<Item[]>([]);
  const [taxRates, setTaxRates] = useState<TaxRate[]>([]);
  const [openBills, setOpenBills] = useState<OpenBill[]>([]);
  const [vendorPos, setVendorPos] = useState<VendorPo[]>([]);
  const [poBusy, setPoBusy] = useState(false);
  const [vendorDetail, setVendorDetail] = useState<
    (Vendor & { addresses: VendorAddress[] }) | null
  >(null);
  const [attachments, setAttachments] = useState<Uploaded[]>([]);
  const [orgState, setOrgState] = useState<string | null>(null);
  const [roundOffMode, setRoundOffMode] = useState<RoundOffMode>('NEAREST_1');

  const [error, setError] = useState('');
  const { saving, stalledHref, begin: beginSave, done: doneSave, fail: failSave } =
    useSaveNav();

  const [form, setForm] = useState({
    vendorId: existing?.vendorId ?? '',
    billId: existing?.billId ?? '',
    purchaseOrderId: existing?.purchaseOrderId ?? '',
    locationId: existing?.locationId ?? '',
    creditDate: (existing?.creditDate ?? todayIso()).slice(0, 10),
    reason: existing?.reason ?? '',
    referenceNumber: existing?.referenceNumber ?? '',
    orderNumber: existing?.orderNumber ?? '',
    sourceOfSupplyCode: existing?.sourceOfSupplyCode ?? '',
    destinationOfSupplyCode: existing?.destinationOfSupplyCode ?? '',
    isReverseCharge: existing?.isReverseCharge ?? false,
    taxTreatment: existing?.taxTreatment ?? 'EXCLUSIVE',
    discountLevel: existing?.discountLevel ?? 'TRANSACTION',
    discountPercent: existing?.discountPercent ? String(Number(existing.discountPercent)) : '',
    taxWithholdingType: (existing?.taxWithholdingType ?? '') as WithholdingKind,
    taxWithholdingTaxId: '',
    adjustment: existing ? String(Number(existing.adjustment)) : '',
    adjustmentLabel: existing?.adjustmentLabel ?? 'Adjustment',
    roundOff: existing?.roundOffManual ? String(Number(existing.roundOff ?? 0)) : '',
    notes: existing?.notes ?? '',
    terms: existing?.terms ?? '',
  });
  const set = (patch: Partial<typeof form>) => setForm((f) => ({ ...f, ...patch }));

  const [lines, setLines] = useState<LineDraft[]>(() =>
    existing?.lines.length
      ? existing.lines.map((l) => ({
          itemId: l.itemId ?? '',
          itemName: l.itemName,
          description: l.description ?? '',
          account: l.account ?? '',
          hsnCode: l.hsnCode ?? '',
          unit: l.unit,
          quantity: String(Number(l.quantity)),
          rate: String(Number(l.rate)),
          discountPercent: l.discountPercent ? String(Number(l.discountPercent)) : '',
          taxRateId: '',
          seededTaxPercent: Number(l.taxRate),
        }))
      : [blankLine()]
  );

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const [v, loc, it, tr, org] = await Promise.all([
          api.get<Paged<Vendor>>('/vendors', { limit: 100 }),
          api.get<Paged<Location>>('/locations', { limit: 50 }),
          api.get<Paged<Item>>('/items', { limit: 100 }),
          api.get<{ data: TaxRate[] }>('/sales/tax-rates'),
          api
            .get<{ data: { stateCode?: string | null; roundOffMode?: RoundOffMode } }>('/organization')
            .catch(() => null),
        ]);
        if (cancelled) return;
        setVendors(v.data);
        setLocations(loc.data);
        setItems(it.data);
        setTaxRates(tr.data);
        setOrgState(org?.data?.stateCode ?? null);
        if (org?.data?.roundOffMode) setRoundOffMode(org.data.roundOffMode);
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

  useEffect(() => {
    if (!form.vendorId) return;
    let cancelled = false;
    api
      .get<Paged<OpenBill>>('/bills', { vendorId: form.vendorId, limit: 100 })
      .then((r) => {
        if (!cancelled) setOpenBills(r.data);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [form.vendorId]);

  useEffect(() => {
    if (!form.vendorId) return;
    let cancelled = false;
    api
      .get<Paged<VendorPo>>('/purchase-orders', { vendorId: form.vendorId, limit: 100 })
      .then((r) => {
        if (!cancelled) setVendorPos(r.data.filter((p) => p.status !== 'DRAFT' && p.status !== 'CANCELLED'));
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [form.vendorId]);

  const liveBills = openBills.filter((b) => b.status !== 'VOID');
  const poBills = form.purchaseOrderId ? liveBills.filter((b) => b.purchaseOrderId === form.purchaseOrderId) : [];
  const billChoices = poBills.length ? poBills : liveBills;

  const keepTypedLines = (what: string) =>
    lines.every((l) => !l.itemName.trim()) ||
    window.confirm(`Replace the lines on this credit with the lines of ${what}?`);

  async function pickBill(billId: string) {
    set({ billId });
    if (!billId) return;
    const picked = openBills.find((b) => b.id === billId);
    if (!keepTypedLines(picked?.billNumber ?? 'this bill')) return;
    setPoBusy(true);
    setError('');
    try {
      const { data: bill } = await api.get<{ data: BillDetail }>(`/bills/${billId}`);
      setForm((f) => ({
        ...f,
        billId,
        purchaseOrderId: f.purchaseOrderId || bill.purchaseOrderId || '',
        orderNumber: f.orderNumber.trim() ? f.orderNumber : bill.purchaseOrder?.poNumber ?? f.orderNumber,
        locationId: f.locationId || bill.locationId || '',
        taxTreatment: bill.taxTreatment ?? f.taxTreatment,
        discountLevel: bill.discountLevel ?? f.discountLevel,
        sourceOfSupplyCode: bill.sourceOfSupplyCode ?? f.sourceOfSupplyCode,
        destinationOfSupplyCode: bill.destinationOfSupplyCode ?? f.destinationOfSupplyCode,
        isReverseCharge: bill.isReverseCharge ?? f.isReverseCharge,
      }));
      setLines(bill.lines.length ? bill.lines.map((l) => returnLine(l, 'billed')) : [blankLine()]);
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setPoBusy(false);
    }
  }

  async function pickPurchaseOrder(purchaseOrderId: string) {
    set({ purchaseOrderId });
    if (!purchaseOrderId) return;
    const ofPo = liveBills.filter((b) => b.purchaseOrderId === purchaseOrderId);
    if (ofPo.length === 1) {
      await pickBill(ofPo[0].id);
      return;
    }
    if (ofPo.length > 1) {
      if (!ofPo.some((b) => b.id === form.billId)) set({ purchaseOrderId, billId: '' });
      return;
    }
    const po = vendorPos.find((x) => x.id === purchaseOrderId);
    if (!keepTypedLines(po?.poNumber ?? 'the purchase order')) {
      if (po && !form.orderNumber.trim()) set({ purchaseOrderId, orderNumber: po.poNumber });
      return;
    }
    setPoBusy(true);
    setError('');
    try {
      const { data: detail } = await api.get<{ data: PoDetail }>(`/purchase-orders/${purchaseOrderId}`);
      setForm((f) => ({
        ...f,
        purchaseOrderId,
        billId: '',
        orderNumber: f.orderNumber.trim() ? f.orderNumber : detail.poNumber,
        locationId: f.locationId || detail.locationId || '',
      }));
      setLines(detail.lines.length ? detail.lines.map((l) => returnLine(l, 'ordered')) : [blankLine()]);
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setPoBusy(false);
    }
  }

  useEffect(() => {
    if (!form.vendorId) return;
    let cancelled = false;
    api
      .get<{ data: Vendor & { addresses: VendorAddress[] } }>(`/vendors/${form.vendorId}`)
      .then((r) => {
        if (!cancelled) setVendorDetail(r.data);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [form.vendorId]);

  const detail = vendorDetail?.id === form.vendorId ? vendorDetail : null;
  const billing =
    detail?.addresses.find((a) => a.type === 'BILLING') ?? detail?.addresses[0] ?? null;

  const vendor = vendors.find((v) => v.id === form.vendorId) ?? null;
  const location = locations.find((l) => l.id === form.locationId) ?? null;

  const source = form.sourceOfSupplyCode || vendor?.sourceOfSupplyCode || '';
  const destination = form.destinationOfSupplyCode || location?.stateCode || orgState || '';
  const intraState = !!source && !!destination && source === destination;
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

  function pickItem(i: number, itemId: string) {
    const it = items.find((x) => x.id === itemId);
    setLine(i, {
      itemId,
      ...(it && {
        itemName: it.name,
        hsnCode: it.hsnCode ?? '',
        unit: it.unit,
        rate: it.costPrice
          ? String(priceAs(it.costPrice, it.costTaxTreatment, form.taxTreatment, pctOf(lines[i])))
          : '0',
      }),
    });
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

  const withholdingRate = Number(taxRates.find((t) => t.id === form.taxWithholdingTaxId)?.rate ?? 0);
  const netSubtotal = subTotal - headerDiscount;
  const withholdingAmount = form.taxWithholdingType ? (netSubtotal * withholdingRate) / 100 : 0;

  const beforeRounding =
    netSubtotal +
    taxTotal +
    Number(form.adjustment || 0) +
    (form.taxWithholdingType === 'TCS' ? withholdingAmount : 0) -
    (form.taxWithholdingType === 'TDS' ? withholdingAmount : 0);
  const rounding = resolveRoundOff(beforeRounding, form.roundOff, roundOffMode);
  const grandTotal = beforeRounding + rounding.value;

  const lineAmount = (l: LineDraft) =>
    inclusive ? Number(l.quantity || 0) * Number(l.rate || 0) : lineTaxable(l) * (1 + pctOf(l) / 100);

  const returnsStock = lines.some((l) => l.itemId && Number(l.quantity) > 0);

  async function submit(status: 'DRAFT' | 'OPEN') {
    setError('');
    if (!form.vendorId) return setError('Pick a vendor');
    const usable = lines.filter((l) => l.itemName.trim() && Number(l.quantity) > 0);
    if (!usable.length) {
      return setError(
        lines.some((l) => l.itemName.trim())
          ? 'Enter how many of each item are going back - lines left at 0 are not put on the credit'
          : 'Add at least one line'
      );
    }
    if (status === 'OPEN' && returnsStock && !form.locationId) {
      return setError('Pick the location the goods are going back from');
    }
    if (Math.abs(rounding.value) > 1) return setError('Round off must be between -1 and 1');

    const blank = isEdit ? null : undefined;
    const body = {
      vendorId: form.vendorId,
      billId: form.billId || blank,
      purchaseOrderId: form.purchaseOrderId || blank,
      locationId: form.locationId || blank,
      creditDate: form.creditDate,
      reason: form.reason.trim() || blank,
      referenceNumber: form.referenceNumber.trim() || blank,
      orderNumber: form.orderNumber.trim() || blank,
      sourceOfSupplyCode: source || blank,
      destinationOfSupplyCode: destination || blank,
      isReverseCharge: form.isReverseCharge,
      taxTreatment: form.taxTreatment,
      discountLevel: form.discountLevel,
      discountPercent: Number(form.discountPercent || 0),
      taxWithholdingType: form.taxWithholdingType || null,
      taxWithholdingTaxId: form.taxWithholdingTaxId || null,
      adjustment: Number(form.adjustment || 0),
      adjustmentLabel: form.adjustmentLabel.trim() || 'Adjustment',
      roundOff: rounding.payload,
      status,
      notes: form.notes.trim() || blank,
      terms: form.terms.trim() || blank,
      lines: usable.map((l) => ({
        itemId: l.itemId || null,
        itemName: l.itemName.trim(),
        description: l.description.trim() || undefined,
        account: l.account.trim() || undefined,
        hsnCode: l.hsnCode.trim() || undefined,
        unit: l.unit || 'pcs',
        quantity: Number(l.quantity),
        rate: Number(l.rate),
        discountPercent: perLineDiscount ? Number(l.discountPercent || 0) : null,
        taxRate: pctOf(l),
      })),
    };

    beginSave();
    try {
      const creditId = isEdit
        ? (await api.patch<{ data: { id: string } }>(`/vendor-credits/${existing.id}`, body)).data.id
        : (await api.post<{ data: { id: string } }>('/vendor-credits', body)).data.id;

      for (const f of attachments) {
        await api
          .post('/shared/attachments', {
            ownerType: 'VENDOR_CREDIT',
            ownerId: creditId,
            fileName: f.fileName,
            fileUrl: f.url,
            mimeType: f.mimeType,
            sizeBytes: f.sizeBytes,
          })
          .catch(() => {});
      }

      doneSave(`/vendor-credits/${creditId}`);
    } catch (err) {
      setError(errorMessage(err));
      failSave();
    }
  }

  return (
    <>
      <PageCrumb label={isEdit ? existing.creditNumber : 'New'} />

      <PageHeader title={isEdit ? `Edit ${existing.creditNumber}` : 'New Vendor Credit'} />

      <SaveStalled href={stalledHref} />

      {error && <div className="mb-4"><ErrorBox message={error} /></div>}

      <div className="space-y-5">
        <Card>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <Field label="Vendor Name" required>
              <VendorSelect
                value={form.vendorId}
                vendors={vendors}
                disabled={isEdit}
                onChange={(vendorId, picked) => {
                  if (picked && !vendors.some((v) => v.id === picked.id)) setVendors((vs) => [...vs, picked]);
                  set({ vendorId, billId: '', purchaseOrderId: '' });
                }}
              />
            </Field>

            {billing && (
              <div className="text-xs leading-5 text-muted-foreground sm:col-span-2 lg:col-span-2 min-w-0">
                <div className="mb-1 font-medium text-muted-foreground">
                  BILLING ADDRESS
                </div>
                <p className="font-medium text-foreground">
                  {detail?.displayName}
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
                <p className="mt-2">
                  GST Treatment:{' '}
                  <span className="text-foreground">
                    {GST_TREATMENT[detail?.gstTreatment ?? ''] ?? '—'}
                  </span>
                </p>
                {(detail?.gstin ?? vendor?.gstin) && (
                  <p className="font-mono">GSTIN: {detail?.gstin ?? vendor?.gstin}</p>
                )}
              </div>
            )}

            <Field label="Source of Supply" required hint="The vendor's state">
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

            <Field label="Destination of Supply" required hint="Where the goods were received">
              <Select
                value={destination}
                onChange={(e) => set({ destinationOfSupplyCode: e.target.value })}
                className="w-full"
              >
                <option value="">Select</option>
                {INDIAN_STATES.map((s) => (
                  <option key={s.code} value={s.code}>{stateLabel(s.code)}</option>
                ))}
              </Select>
            </Field>

            <Field
              label="Bill#"
              hint={
                poBusy
                  ? 'Copying the lines…'
                  : poBills.length > 1 && !form.billId
                    ? `This purchase order has ${poBills.length} bills - pick the one this credit is for`
                    : form.billId
                      ? 'Lines copied at 0 - enter what is going back. Saving applies the credit to this bill.'
                      : 'Pick the bill this credit corrects - its lines are copied for you'
              }
            >
              <Select
                value={form.billId}
                onChange={(e) => pickBill(e.target.value)}
                className="w-full"
                disabled={!form.vendorId || poBusy}
              >
                <option value="">Not against a bill</option>
                {billChoices.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.billNumber}
                    {Number(b.balanceDue) > 0 ? ` · ${money(Number(b.balanceDue))} due` : ' · paid'}
                  </option>
                ))}
              </Select>
            </Field>

            <Field
              label="Purchase order"
              hint={
                poBusy
                  ? 'Copying the lines…'
                  : 'Picking one also picks its bill - or copies the order lines if it has not been billed yet'
              }
            >
              <Select
                value={form.purchaseOrderId}
                onChange={(e) => pickPurchaseOrder(e.target.value)}
                className="w-full"
                disabled={!form.vendorId || poBusy}
              >
                <option value="">Not against a purchase order</option>
                {vendorPos.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.poNumber} · {money(p.grandTotal)}
                  </option>
                ))}
              </Select>
            </Field>

            <Field
              label="Location"
              required={returnsStock}
              hint={returnsStock ? 'Where the goods are going back from' : 'Only needed when goods move'}
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

            <Field label="Credit Note#">
              <Input value={isEdit ? existing.creditNumber : ''} disabled placeholder="Reserved on save" />
            </Field>

            <Field label="Order Number">
              <Input
                value={form.orderNumber}
                onChange={(e) => set({ orderNumber: e.target.value })}
              />
            </Field>

            <Field label="Vendor Credit Date" required>
              <Input
                type="date"
                value={form.creditDate}
                onChange={(e) => set({ creditDate: e.target.value })}
              />
            </Field>

            <Field label="Reference#">
              <Input
                value={form.referenceNumber}
                onChange={(e) => set({ referenceNumber: e.target.value })}
              />
            </Field>

            <Field label="Reason" hint="Why the supplier owes this back">
              <ComboSelect
                value={form.reason}
                options={['Damaged on arrival', 'Short supplied', 'Wrong item sent', 'Expired or near expiry', 'Quality rejected', 'Price difference', 'Billed twice']}
                onChange={(reason) => set({ reason })}
                placeholder="Select a reason"
                addLabel="+ Another reason"
                newPlaceholder="Why the supplier owes this back"
              />
            </Field>
          </div>

          <label className="mt-4 flex items-start gap-2 text-sm">
            <input
              type="checkbox"
              className="mt-0.5"
              checked={form.isReverseCharge}
              onChange={(e) => set({ isReverseCharge: e.target.checked })}
            />
            <span className="text-foreground">
              This transaction is applicable for reverse charge
            </span>
          </label>
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
                <Th className="text-right">PURCHASE PRICE</Th>
                {perLineDiscount && <Th className="text-right">DISC %</Th>}
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
                    {l.hint && (
                      <p className="mt-1 whitespace-nowrap text-right text-[11px] text-muted-foreground">
                        {l.hint}
                      </p>
                    )}
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
                  These lines carry items, so saving this as open takes{' '}
                  <strong>{totalQuantity}</strong> unit(s) off stock at{' '}
                  {location?.name ?? 'the chosen location'}.
                </p>
              )}
            </div>
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
            <Field label="Notes" hint="Not shown on the printed credit note">
              <Textarea rows={4} value={form.notes} onChange={(e) => set({ notes: e.target.value })} />
            </Field>
          </Card>
          <Card>
            <Field label="Terms & Conditions">
              <Textarea rows={4} value={form.terms} onChange={(e) => set({ terms: e.target.value })} />
            </Field>

            <div className="mt-5 border-t border-border pt-4">
              <span className="mb-1 block text-xs font-medium text-muted-foreground">
                Attach File(s) to Vendor Credits
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
                {isEdit ? '' : ' They attach once the credit is saved.'}
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
