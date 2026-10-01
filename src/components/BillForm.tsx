'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { api, money, errorMessage, type Paged, todayIso } from '@/lib/api';
import { priceAs, switchRate, type RateMemo } from '@/lib/items';
import { useSaveNav, SaveStalled } from '@/lib/useSaveNav';
import { RoundOffRow } from '@/components/RoundOffRow';
import { resolveRoundOff, type RoundOffMode } from '@/lib/roundOff';
import { taxBreakdown } from '@/lib/taxBreakdown';
import { PaymentTermSelect, useDefaultPaymentTerm, dueDateFrom } from './PaymentTermSelect';
import { INDIAN_STATES, stateLabel, stateCodeFromGstin } from '@/lib/states';
import { AccountSelect } from '@/components/AccountSelect';
import { TaxWithholdingRow, type WithholdingKind } from '@/components/TaxWithholding';
import { VendorAddressModal, type VendorAddress } from '@/components/VendorAddressModal';
import { FileUpload, type Uploaded } from '@/components/FileUpload';
import {
  Badge, Button, Card, EmptyRow, ErrorBox, Field, Input, PageHeader,
  Select, Table, Td, Textarea, Th, Spinner,
} from '@/components/ui';
import { ItemSelect } from './ItemSelect';
import { VendorSelect } from './VendorSelect';
import { SearchSelect } from './SearchSelect';
import { SaveBar } from './form/SaveBar';
import { PageCrumb } from '@/lib/crumbs';

type Vendor = {
  id: string;
  displayName: string;
  email?: string | null;
  paymentTerms?: string;
  gstin?: string | null;
  gstTreatment?: string | null;
  sourceOfSupplyState?: string | null;
  sourceOfSupplyCode?: string | null;
};

type Location = { id: string; name: string; code: string; isDefault: boolean; stateCode?: string | null };
type Item = {
  id: string; name: string; sku: string | null; unit: string;
  costPrice: string | null; purchaseAccount: string | null; hsnCode: string | null;
  costTaxTreatment?: string | null;
  imageUrls?: string[];
};
type TaxRate = { id: string; name: string; rate: string; type: string; isDefault: boolean; isActive: boolean };
type Organization = { stateCode?: string | null; legalName?: string | null; roundOffMode?: RoundOffMode };

type OpenPo = {
  id: string;
  poNumber: string;
  poDate: string;
  grandTotal?: string;
  taxTreatment?: 'EXCLUSIVE' | 'INCLUSIVE';
  lines: {
    id: string; itemId: string; itemName: string; description: string | null;
    account: string | null; hsnCode: string | null; unit: string;
    quantityToBill: number; rate: string; discountPercent: string | null; taxRate: string;
  }[];
  receives?: { id: string; receiveNumber: string; receiveDate: string; lines: { poLineId: string; quantity: number }[] }[];
};

export type ExistingBill = {
  id: string;
  billNumber: string;
  updatedPurchaseOrder?: boolean;
  vendorId: string;
  purchaseOrderId: string | null;
  billDate: string;
  dueDate: string | null;
  referenceNumber: string | null;
  orderNumber: string | null;
  paymentTerms: string;
  isReverseCharge: boolean;
  sourceOfSupplyCode: string | null;
  destinationOfSupplyCode: string | null;
  taxTreatment: 'EXCLUSIVE' | 'INCLUSIVE';
  discountLevel: 'TRANSACTION' | 'LINE_ITEM';
  discountPercent: string | null;
  taxWithholdingType: 'TDS' | 'TCS' | null;
  taxWithholdingTaxId?: string | null;
  shippingCharge?: string;
  adjustment: string;
  adjustmentLabel: string | null;
  roundOff?: string;
  roundOffManual?: boolean;
  notes: string | null;
  vendor?: { id: string } | null;
  lines: {
    itemId: string | null; poLineId: string | null; itemName: string; description: string | null;
    account: string | null; hsnCode: string | null; quantity: string; rate: string;
    discountPercent: string | null; taxRate: string;
  }[];
};

type LineDraft = {
  itemId: string;
  poLineId: string;
  itemName: string;
  description: string;
  account: string;
  hsnCode: string;
  quantity: string;
  rate: string;
  discountPercent: string;
  taxRateId: string;
  seededTaxPercent?: number;
  rateMemo?: RateMemo;
};

const blankLine = (): LineDraft => ({
  itemId: '', poLineId: '', itemName: '', description: '', account: '',
  hsnCode: '', quantity: '1', rate: '', discountPercent: '', taxRateId: '',
});

const MAX_ATTACHMENTS = 5;

export function BillForm({
  mode = 'create',
  existing = null,
}: {
  mode?: 'create' | 'edit';
  existing?: ExistingBill | null;
}) {
  const params = useSearchParams();
  const isEdit = mode === 'edit';

  const [vendors, setVendors] = useState<Vendor[]>([]);
  const [locations, setLocations] = useState<Location[]>([]);
  const [items, setItems] = useState<Item[]>([]);
  const [taxRates, setTaxRates] = useState<TaxRate[]>([]);
  const [vendorDetail, setVendorDetail] = useState<(Vendor & { addresses: VendorAddress[] }) | null>(null);
  const [openPos, setOpenPos] = useState<OpenPo[]>([]);
  const [attachments, setAttachments] = useState<Uploaded[]>([]);
  const [addingAddress, setAddingAddress] = useState(false);
  const [extraAddresses, setExtraAddresses] = useState<VendorAddress[]>([]);

  const [error, setError] = useState('');
  const { saving, stalledHref, begin: beginSave, done: doneSave, fail: failSave } =
    useSaveNav();

  const [form, setForm] = useState({
    vendorId: existing?.vendorId ?? params.get('vendorId') ?? '',
    purchaseOrderId: existing?.purchaseOrderId ?? params.get('purchaseOrderId') ?? '',
    locationId: '',
    billNumber: existing?.billNumber ?? '',
    orderNumber: existing?.orderNumber ?? '',
    referenceNumber: existing?.referenceNumber ?? '',
    billDate: existing?.billDate.slice(0, 10) ?? todayIso(),
    dueDate: existing?.dueDate?.slice(0, 10) ?? '',
    paymentTerms: existing?.paymentTerms ?? 'DUE_ON_RECEIPT',
    isReverseCharge: existing?.isReverseCharge ?? false,
    sourceOfSupplyCode: existing?.sourceOfSupplyCode ?? '',
    destinationOfSupplyCode: existing?.destinationOfSupplyCode ?? '',
    taxTreatment: (existing?.taxTreatment ?? 'EXCLUSIVE') as 'EXCLUSIVE' | 'INCLUSIVE',
    discountLevel: (existing?.discountLevel ?? 'TRANSACTION') as 'TRANSACTION' | 'LINE_ITEM',
    discountPercent: existing?.discountPercent ? String(Number(existing.discountPercent)) : '0',
    taxWithholdingType: (existing?.taxWithholdingType ?? '') as WithholdingKind,
    taxWithholdingTaxId: existing?.taxWithholdingTaxId ?? '',
    shippingCharge: existing ? String(Number(existing.shippingCharge ?? 0)) : '0',
    adjustment: existing ? String(Number(existing.adjustment)) : '0',
    adjustmentLabel: existing?.adjustmentLabel ?? 'Adjustment',
    roundOff: existing?.roundOffManual ? String(Number(existing.roundOff ?? 0)) : '',
    notes: existing?.notes ?? '',
  });
  const [roundOffMode, setRoundOffMode] = useState<RoundOffMode>('NEAREST_1');
  const set = (patch: Partial<typeof form>) => setForm((f) => ({ ...f, ...patch }));
  useDefaultPaymentTerm(
    (code) => setForm((f) => (!f.vendorId && f.paymentTerms === 'DUE_ON_RECEIPT' ? { ...f, paymentTerms: code } : f)),
    !isEdit
  );

  const [lines, setLines] = useState<LineDraft[]>(() =>
    existing?.lines.length
      ? existing.lines.map((l) => ({
          itemId: l.itemId ?? '',
          poLineId: l.poLineId ?? '',
          itemName: l.itemName,
          description: l.description ?? '',
          account: l.account ?? '',
          hsnCode: l.hsnCode ?? '',
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
        const [v, l, i, tr, o] = await Promise.all([
          api.get<Paged<Vendor>>('/vendors', { limit: 100 }),
          api.get<Paged<Location>>('/locations', { limit: 50 }),
          api.get<Paged<Item>>('/items', { limit: 100 }),
          api.get<{ data: TaxRate[] }>('/sales/tax-rates'),
          api.get<{ data: Organization }>('/organization').catch(() => null),
        ]);
        if (cancelled) return;
        setVendors(v.data);
        setLocations(l.data);
        setItems(i.data);
        setTaxRates(tr.data.filter((t) => t.isActive));
        if (o?.data?.roundOffMode) setRoundOffMode(o.data.roundOffMode);

        const defaultLocation = l.data.find((x) => x.isDefault) ?? l.data[0];
        setForm((f) => ({
          ...f,
          locationId: f.locationId || (defaultLocation?.id ?? ''),
          destinationOfSupplyCode:
            f.destinationOfSupplyCode || o?.data?.stateCode || defaultLocation?.stateCode || '',
        }));
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
      .get<{ data: Vendor & { addresses: VendorAddress[] } }>(`/vendors/${form.vendorId}`)
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

  const [advances, setAdvances] = useState<{ id: string; paymentNumber: string; unapplied: number; purchaseOrderId?: string | null }[]>([]);
  const [applyAdvance, setApplyAdvance] = useState(false);

  useEffect(() => {
    let cancelled = false;
    if (!form.vendorId || isEdit) {
      const clear = setTimeout(() => setAdvances([]), 0);
      return () => {
        cancelled = true;
        clearTimeout(clear);
      };
    }
    api
      .get<{ data: { id: string; paymentNumber: string; unapplied: number; purchaseOrderId?: string | null }[] }>(
        '/bills/payments',
        { vendorId: form.vendorId, view: 'unapplied', limit: 100 }
      )
      .then((r) => {
        if (!cancelled) setAdvances(r.data.filter((a) => Number(a.unapplied) > 0));
      })
      .catch(() => {
        if (!cancelled) setAdvances([]);
      });
    return () => {
      cancelled = true;
    };
  }, [form.vendorId, isEdit]);

  useEffect(() => {
    if (!form.vendorId) return;
    let cancelled = false;
    api
      .get<{ data: OpenPo[] }>('/bills/open-purchase-orders', { vendorId: form.vendorId })
      .then((r) => {
        if (!cancelled) setOpenPos(r.data);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [form.vendorId]);

  const vendor = vendorDetail?.id === form.vendorId ? vendorDetail : null;
  const availablePos = form.vendorId ? openPos : [];

  const linkedPo = form.purchaseOrderId ? availablePos.find((p) => p.id === form.purchaseOrderId) ?? null : null;

  const poDifferences = useMemo(() => {
    if (!linkedPo) return [];
    return linkedPo.lines
      .map((pl) => {
        const here = lines.filter((l) => l.poLineId === pl.id);
        const quantity = here.reduce((n, l) => n + Number(l.quantity || 0), 0);
        const rate = here.length ? Number(here[0].rate || 0) : Number(pl.rate);
        const poRate = Number(
          priceAs(pl.rate, linkedPo.taxTreatment ?? 'EXCLUSIVE', form.taxTreatment, Number(pl.taxRate || 0))
        );
        return {
          line: pl,
          quantity,
          rate,
          poRate,
          quantityDiffers: Math.round((quantity - pl.quantityToBill) * 100) / 100 !== 0,
          rateDiffers: here.length > 0 && Math.abs(rate - poRate) > 0.004,
        };
      })
      .filter((d) => d.quantityDiffers || d.rateDiffers);
  }, [linkedPo, lines, form.taxTreatment]);

  const intraState =
    !!form.sourceOfSupplyCode &&
    !!form.destinationOfSupplyCode &&
    form.sourceOfSupplyCode === form.destinationOfSupplyCode;
  const taxFamily: 'GST' | 'IGST' = intraState ? 'GST' : 'IGST';

  const slabs = useMemo(() => taxRates.filter((t) => t.type === taxFamily), [taxRates, taxFamily]);
  const otherSlabs = useMemo(
    () => taxRates.filter((t) => t.type !== taxFamily && t.type !== 'TDS' && t.type !== 'TCS'),
    [taxRates, taxFamily]
  );

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

  function changeTaxTreatment(next: 'EXCLUSIVE' | 'INCLUSIVE') {
    const from = form.taxTreatment;
    setLines((rows) => rows.map((l) => ({ ...l, ...switchRate(l.rate, l.rateMemo, from, next, pctOf(l)) })));
    set({ taxTreatment: next });
  }

  const setLine = (i: number, patch: Partial<LineDraft>) =>
    setLines((rows) => rows.map((r, idx) => (idx === i ? { ...r, ...patch } : r)));

  function pickItem(i: number, itemId: string) {
    const it = items.find((x) => x.id === itemId);
    setLine(i, {
      itemId,
      itemName: it?.name ?? '',
      hsnCode: it?.hsnCode ?? '',
      account: it?.purchaseAccount || lines[i].account,
      rate: it?.costPrice
        ? String(priceAs(it.costPrice, it.costTaxTreatment, form.taxTreatment, pctOf(lines[i])))
        : lines[i].rate,
    });
  }

  function includePo(po: OpenPo, receiveId?: string) {
    const receive = receiveId ? po.receives?.find((r) => r.id === receiveId) : null;
    const quantityFor = (poLineId: string, fallback: number) =>
      receive ? receive.lines.find((l) => l.poLineId === poLineId)?.quantity ?? 0 : fallback;
    setForm((f) => ({ ...f, purchaseOrderId: po.id }));
    setBillSource(receive ? `${po.id}:${receive.id}` : po.id);
    setLines((rows) => {
      const base = rows.filter((r) => (r.itemName || r.itemId) && !r.poLineId);
      return [
        ...base,
        ...po.lines
          .map((l) => ({ line: l, quantity: quantityFor(l.id, l.quantityToBill) }))
          .filter(({ quantity }) => quantity > 0)
          .map(({ line: l, quantity }) => ({
            itemId: l.itemId,
            poLineId: l.id,
            itemName: l.itemName,
            description: l.description ?? '',
            account: l.account ?? '',
            hsnCode: l.hsnCode ?? '',
            quantity: String(quantity),
            rate: String(priceAs(Number(l.rate), po.taxTreatment ?? 'EXCLUSIVE', form.taxTreatment, Number(l.taxRate))),
            discountPercent: l.discountPercent ? String(Number(l.discountPercent)) : '',
            taxRateId: '',
            seededTaxPercent: Number(l.taxRate),
          })),
      ];
    });
  }

  const [billSource, setBillSource] = useState(existing?.purchaseOrderId ?? params.get('purchaseOrderId') ?? '');
  const [updatePo, setUpdatePo] = useState(!!existing?.updatedPurchaseOrder);
  const sourceOptions = availablePos.flatMap((po) => [
    {
      value: po.id,
      label: `${po.poNumber} - whole order`,
      hint: `${po.lines.length} line${po.lines.length === 1 ? '' : 's'} left to bill${po.grandTotal ? ` · ${money(po.grandTotal)}` : ''}`,
      group: po.poNumber,
    },
    ...(po.receives ?? []).map((r) => ({
      value: `${po.id}:${r.id}`,
      label: `${r.receiveNumber} - what was received`,
      hint: `${r.lines.reduce((n, l) => n + l.quantity, 0)} units received on ${new Date(r.receiveDate).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}`,
      group: po.poNumber,
    })),
  ]);

  function pickBillSource(value: string) {
    if (!value) {
      setBillSource('');
      setForm((f) => ({ ...f, purchaseOrderId: '' }));
      setLines((rows) => (rows.some((r) => !r.poLineId && (r.itemName || r.itemId)) ? rows.filter((r) => !r.poLineId) : [blankLine()]));
      return;
    }
    const [poId, receiveId] = value.split(':');
    const po = availablePos.find((p) => p.id === poId);
    if (po) includePo(po, receiveId);
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

  const withholdingRate = Number(taxRates.find((t) => t.id === form.taxWithholdingTaxId)?.rate ?? 0);
  const withholdingAmount = form.taxWithholdingType ? (netSubtotal * withholdingRate) / 100 : 0;

  const beforeRounding =
    netSubtotal +
    taxTotal +
    Number(form.shippingCharge || 0) +
    Number(form.adjustment || 0) +
    (form.taxWithholdingType === 'TCS' ? withholdingAmount : 0) -
    (form.taxWithholdingType === 'TDS' ? withholdingAmount : 0);
  const rounding = resolveRoundOff(beforeRounding, form.roundOff, roundOffMode);
  const grandTotal = beforeRounding + rounding.value;

  const advanceOrder = [...advances].sort(
    (a, b) =>
      (a.purchaseOrderId === form.purchaseOrderId ? 0 : 1) - (b.purchaseOrderId === form.purchaseOrderId ? 0 : 1)
  );
  const advanceTotal = advanceOrder.reduce((n, a) => n + Number(a.unapplied), 0);
  const advanceOnOrder = form.purchaseOrderId
    ? advanceOrder
        .filter((a) => a.purchaseOrderId === form.purchaseOrderId)
        .reduce((n, a) => n + Number(a.unapplied), 0)
    : 0;

  const lineAmount = (l: LineDraft) =>
    inclusive ? Number(l.quantity || 0) * Number(l.rate || 0) : lineTaxable(l) * (1 + pctOf(l) / 100);

  async function submit(status: 'DRAFT' | 'OPEN') {
    setError('');

    const payloadLines = lines
      .filter((l) => l.itemName.trim() && l.quantity !== '' && l.rate !== '')
      .map((l) => ({
        itemId: l.itemId || undefined,
        poLineId: l.poLineId || undefined,
        itemName: l.itemName.trim(),
        description: l.description.trim() || undefined,
        account: l.account || undefined,
        hsnCode: l.hsnCode.trim() || undefined,
        quantity: Number(l.quantity),
        rate: Number(l.rate),
        discountPercent:
          perLineDiscount && l.discountPercent !== '' ? Number(l.discountPercent) : undefined,
        taxRate: pctOf(l),
      }));

    if (!form.vendorId) return setError('Pick a vendor');
    if (!isEdit && !form.billNumber.trim()) return setError("Enter the supplier's bill number");
    if (!payloadLines.length) return setError('Add at least one line with a name, quantity and rate');
    if (form.taxWithholdingType && !form.taxWithholdingTaxId) {
      return setError(`Pick which ${form.taxWithholdingType} tax applies`);
    }
    if (Math.abs(rounding.value) > 1) return setError('Round off must be between -1 and 1');

    beginSave();
    try {
      const body = {
        vendorId: form.vendorId,
        purchaseOrderId: form.purchaseOrderId || null,
        updatePurchaseOrder: !!form.purchaseOrderId && updatePo,
        locationId: form.locationId || undefined,
        billDate: form.billDate,
        dueDate: form.dueDate || undefined,
        referenceNumber: form.referenceNumber.trim() || undefined,
        orderNumber: form.orderNumber.trim() || undefined,
        paymentTerms: form.paymentTerms,
        isReverseCharge: form.isReverseCharge,
        sourceOfSupplyCode: form.sourceOfSupplyCode || undefined,
        destinationOfSupplyCode: form.destinationOfSupplyCode || undefined,
        taxTreatment: form.taxTreatment,
        discountLevel: form.discountLevel,
        discountPercent: perLineDiscount ? undefined : Number(form.discountPercent || 0),
        taxWithholdingType: form.taxWithholdingType || null,
        taxWithholdingTaxId: form.taxWithholdingTaxId || null,
        shippingCharge: Number(form.shippingCharge || 0),
        adjustment: Number(form.adjustment || 0),
        adjustmentLabel: form.adjustmentLabel.trim() || undefined,
        roundOff: rounding.payload,
        notes: form.notes.trim() || undefined,
        lines: payloadLines,
      };

      const res = isEdit
        ? await api.patch<{ data: { id: string } }>(`/bills/${existing!.id}`, body)
        : await api.post<{ data: { id: string } }>('/bills', {
            ...body,
            billNumber: form.billNumber.trim(),
            status,
          });

      const billId = res.data.id;

      if (!isEdit && applyAdvance && advanceTotal > 0) {
        let left = Math.min(advanceTotal, grandTotal);
        for (const advance of advanceOrder) {
          if (left <= 0.009) break;
          const amount = Math.min(Number(advance.unapplied), left);
          try {
            await api.post(`/bills/payments/${advance.id}/apply`, {
              allocations: [{ billId, amount }],
            });
            left -= amount;
          } catch (err) {
            setError(`The bill was saved, but the advance could not be put against it: ${errorMessage(err)}`);
            break;
          }
        }
      }

      for (const f of attachments) {
        await api
          .post('/shared/attachments', {
            ownerType: 'BILL',
            ownerId: billId,
            fileName: f.fileName,
            fileUrl: f.url,
            mimeType: f.mimeType,
            sizeBytes: f.sizeBytes,
          })
          .catch(() => {});
      }

      doneSave(`/bills/${billId}`);
    } catch (err) {
      setError(errorMessage(err));
      failSave();
    }
  }

  const vendorAddresses = [...extraAddresses, ...(vendor?.addresses ?? [])];
  const billing = vendorAddresses.find((a) => a.type === 'BILLING') ?? vendorAddresses[0] ?? null;
  const label = 'mb-1 block text-xs font-medium text-muted-foreground';

  return (
    <>
      <PageCrumb label={isEdit ? `Edit ${existing!.billNumber}` : 'New bill'} />

      <PageHeader title={isEdit ? `Edit ${existing!.billNumber}` : 'New Bill'} />

      <SaveStalled href={stalledHref} />

      {error && <div className="mb-4"><ErrorBox message={error} /></div>}

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
                    set({ vendorId, purchaseOrderId: '' });
                  }}
                />

                {vendor && (
                  <div className="mt-3 rounded-md border border-border bg-muted/60 p-3 text-xs">
                    <div className="mb-1 flex items-center gap-2">
                      <span className="font-medium text-muted-foreground">
                        BILLING ADDRESS
                      </span>
                      <button
                        type="button"
                        onClick={() => setAddingAddress(true)}
                        className="text-gold-ink hover:underline"
                      >
                        New Address
                      </button>
                    </div>
                    {billing ? (
                      [
                        billing.line1,
                        billing.line2,
                        `${billing.city}, ${billing.state}`,
                        `${billing.country} ${billing.pincode}`,
                      ]
                        .filter(Boolean)
                        .map((l, i) => (
                          <div key={i} className="text-foreground">{l}</div>
                        ))
                    ) : (
                      <div className="text-muted-foreground">No address on file</div>
                    )}
                    <div className="mt-2">
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

              {form.vendorId && (availablePos.length > 0 || form.purchaseOrderId) && (
                <div>
                  <span className={label}>Bill from a purchase order</span>
                  <SearchSelect
                    value={billSource}
                    onChange={pickBillSource}
                    options={sourceOptions}
                    placeholder="Nothing - typed by hand"
                    searchPlaceholder="Search PO or receive number…"
                    emptyMessage="No open purchase orders for this vendor"
                    clearable
                    className="w-full"
                    ariaLabel="Bill from purchase order or receive"
                  />
                  {availablePos.length > 0 && (
                    <ul className="mt-2 space-y-1">
                      {availablePos.map((po) => (
                        <li
                          key={po.id}
                          className="flex items-center justify-between gap-3 rounded-md border border-border bg-muted/40 px-3 py-1.5 text-xs"
                        >
                          <span className="min-w-0">
                            <span className="font-medium text-foreground">{po.poNumber}</span>
                            <span className="ml-2 text-muted-foreground">
                              {po.lines.length} line{po.lines.length === 1 ? '' : 's'} left to bill
                              {po.grandTotal ? ` · ${money(po.grandTotal)}` : ''}
                            </span>
                          </span>
                          {form.purchaseOrderId === po.id ? (
                            <span className="shrink-0 text-success">On this bill</span>
                          ) : (
                            <button
                              type="button"
                              onClick={() => includePo(po)}
                              className="shrink-0 text-gold-ink hover:underline"
                            >
                              Bill this order
                            </button>
                          )}
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              )}

              {!isEdit && advanceTotal > 0 && (
                <label className="flex cursor-pointer items-start gap-2 rounded-md border border-success/30 bg-success/10 p-3 text-sm">
                  <input
                    type="checkbox"
                    checked={applyAdvance}
                    onChange={(e) => setApplyAdvance(e.target.checked)}
                    className="mt-0.5 h-4 w-4 rounded border-border"
                  />
                  <span>
                    <span className="font-medium text-foreground">
                      Put {money(Math.min(advanceTotal, grandTotal || advanceTotal))} of this vendor&apos;s advance against this bill
                    </span>
                    <span className="block text-xs text-muted-foreground">
                      {money(advanceTotal)} was paid ahead and is still unused
                      {grandTotal > 0 && advanceTotal > grandTotal
                        ? ` · ${money(advanceTotal - grandTotal)} would stay with the vendor for next time`
                        : ''}
                      {advanceOnOrder > 0 && form.purchaseOrderId
                        ? ` · ${money(advanceOnOrder)} of it was paid against this order, and goes first`
                        : ''}
                    </span>
                  </span>
                </label>
              )}

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

              <Field label="Location">
                <Select
                  value={form.locationId}
                  onChange={(e) => set({ locationId: e.target.value })}
                  className="w-full"
                >
                  {locations.map((l) => (
                    <option key={l.id} value={l.id}>
                      {l.name}{l.isDefault ? ' (default)' : ''}
                    </option>
                  ))}
                </Select>
              </Field>
            </div>

            <div className="space-y-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="Bill#" required hint={isEdit ? undefined : "The supplier's invoice number"}>
                  <Input
                    value={form.billNumber}
                    onChange={(e) => set({ billNumber: e.target.value })}
                    readOnly={isEdit}
                    className={isEdit ? 'font-mono' : ''}
                  />
                </Field>
                <Field label="Order Number">
                  <Input
                    value={form.orderNumber}
                    onChange={(e) => set({ orderNumber: e.target.value })}
                  />
                </Field>
                <Field label="Bill Date" required>
                  <Input
                    type="date"
                    value={form.billDate}
                    onChange={(e) => set({ billDate: e.target.value })}
                  />
                </Field>
                <Field label="Due Date">
                  <Input
                    type="date"
                    value={form.dueDate}
                    onChange={(e) => set({ dueDate: e.target.value })}
                  />
                </Field>
                <Field label="Payment Terms">
                  <PaymentTermSelect
                    value={form.paymentTerms}
                    onChange={(paymentTerms) => set({ paymentTerms })}
                    onTermChange={(t) =>
                      set({ dueDate: dueDateFrom(form.billDate, t.days) })
                    }
                  />
                </Field>
                <Field label="Reference#">
                  <Input
                    value={form.referenceNumber}
                    onChange={(e) => set({ referenceNumber: e.target.value })}
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
                onChange={(e) => set({ discountLevel: e.target.value as 'TRANSACTION' | 'LINE_ITEM' })}
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
                      onChange={(v) => pickItem(i, v)}
                      className="mb-1 w-full min-w-[188px] max-w-[212px]"
                    />
                    <Input
                      value={l.itemName}
                      onChange={(e) => setLine(i, { itemName: e.target.value })}
                      placeholder="or type a description"
                      className="min-w-[188px]"
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
                      onChange={(e) => setLine(i, { taxRateId: e.target.value, seededTaxPercent: undefined })}
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
                  <Td className="whitespace-nowrap text-right font-medium">{money(lineAmount(l))}</Td>
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

          <div className="flex flex-wrap items-center gap-2 px-4 py-3">
            <Button size="sm" onClick={() => setLines([...lines, blankLine()])}>
              + Add line
            </Button>
            {form.purchaseOrderId && (
              <div className="flex flex-wrap items-center gap-3">
                {form.purchaseOrderId && (
                  <div className="space-y-2">
                    {poDifferences.length > 0 && linkedPo && (
                      <div className="rounded-md border border-warning/30 bg-warning/10 p-3 text-sm">
                        <p className="mb-1.5 font-medium text-warning">
                          This bill differs from {linkedPo.poNumber}
                        </p>
                        <ul className="space-y-0.5 text-xs text-warning">
                          {poDifferences.map((d) => (
                            <li key={d.line.id}>
                              {d.line.itemName}:{' '}
                              {d.quantityDiffers &&
                                (d.quantity === 0
                                  ? `not billed, ${d.line.quantityToBill} still ordered`
                                  : `${d.quantity} billed against ${d.line.quantityToBill} ordered`)}
                              {d.quantityDiffers && d.rateDiffers ? ' · ' : ''}
                              {d.rateDiffers && `rate ${money(d.rate)} instead of ${money(d.poRate)}`}
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                    <label className="flex items-start gap-2 text-sm text-foreground">
                      <input
                        type="checkbox"
                        checked={updatePo}
                        onChange={(e) => setUpdatePo(e.target.checked)}
                        className="mt-0.5 h-4 w-4 rounded border-border"
                      />
                      <span>
                        <span className="font-medium">Amend the purchase order to match this bill</span>
                        <span className="block text-xs text-muted-foreground">
                          Tick this when the vendor sent less (or more) than ordered and nothing more is coming. The
                          order keeps its original amount for reference. Leave it unticked if the rest will be billed
                          later.
                        </span>
                      </span>
                    </label>
                  </div>
                )}
              </div>
            )}
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

              <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-2">
                <dt className="text-muted-foreground">Shipping charges</dt>
                <dd className="flex flex-wrap items-center justify-end gap-2">
                  <Input
                    type="number" step="0.01" min="0"
                    value={form.shippingCharge}
                    onChange={(e) => set({ shippingCharge: e.target.value })}
                    className="w-28 text-right"
                    aria-label="Shipping charges"
                  />
                  <span className="w-24 text-right">{money(Number(form.shippingCharge || 0))}</span>
                </dd>
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
            <Field label="Notes" hint="Not shown on the printed bill">
              <Textarea rows={4} value={form.notes} onChange={(e) => set({ notes: e.target.value })} />
            </Field>
          </Card>
          <Card>
            <span className={label}>Attach File(s) to Bill</span>
            <FileUpload
              multiple
              accept="image/*,application/pdf"
              label="Upload File"
              disabled={attachments.length >= MAX_ATTACHMENTS}
              onUploaded={(files) =>
                setAttachments((prev) => [...prev, ...files].slice(0, MAX_ATTACHMENTS))
              }
            />
            <p className="mt-1.5 text-xs text-muted-foreground">
              You can upload a maximum of {MAX_ATTACHMENTS} files, 10MB each.
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
          </Card>
        </div>
      </div>

      {form.vendorId && (
        <VendorAddressModal
          open={addingAddress}
          onClose={() => setAddingAddress(false)}
          vendorId={form.vendorId}
          defaultType="BILLING"
          onSaved={(a) => setExtraAddresses((prev) => [a, ...prev])}
        />
      )}

      <SaveBar>
        {isEdit ? (
          <Button type="button" variant="success" disabled={saving} onClick={() => submit('OPEN')}>
            {saving && <Spinner className="border-card/40 border-t-card" />}
            Save
          </Button>
        ) : (
          <>
            <Button type="button" disabled={saving} onClick={() => submit('DRAFT')}>
              Save as Draft
            </Button>
            <Button type="button" variant="success" disabled={saving} onClick={() => submit('OPEN')}>
              {saving && <Spinner className="border-card/40 border-t-card" />}
              Save as Open
            </Button>
          </>
        )}
        <Link href={isEdit ? `/bills/${existing!.id}` : '/bills'}>
          <Button type="button" variant="ghost">Cancel</Button>
        </Link>
        <span className="ml-auto text-sm text-muted-foreground">
          Total <strong className="text-foreground">{money(grandTotal)}</strong>
        </span>
      </SaveBar>
    </>
  );
}
