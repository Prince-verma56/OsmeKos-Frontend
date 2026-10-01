'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { api, errorMessage, type Paged, todayIso } from '@/lib/api';
import { useSaveNav, SaveStalled } from '@/lib/useSaveNav';
import { FileUpload, type Uploaded } from '@/components/FileUpload';
import {
  Button, Card, ErrorBox, Field, Input, PageHeader,
  Select, Table, Td, Textarea, Th, Spinner,
} from '@/components/ui';
import { VendorSelect } from './VendorSelect';
import { SaveBar } from './form/SaveBar';
import { PageCrumb } from '@/lib/crumbs';
import { addMonthsIso, type BatchRule } from '@/lib/quality';

type Vendor = { id: string; displayName: string };
type Location = { id: string; name: string; code: string; isDefault: boolean };

type PoLine = {
  id: string;
  itemId: string;
  itemName: string;
  description: string | null;
  unit: string;
  quantity: string;
  quantityReceived: string;
  quantityReplacement?: string;
  rate: string;
};

type PurchaseOrder = {
  id: string;
  poNumber: string;
  locationId: string;
  status: string;
  lines: PoLine[];
};

type BillLine = {
  id: string;
  itemId: string | null;
  itemName: string;
  description: string | null;
  quantity: string;
  quantityReceived?: number;
  rate: string;
};

type BillOption = {
  id: string;
  billNumber: string;
  status: string;
  locationId: string | null;
  purchaseOrderId: string | null;
  lines: BillLine[];
};

type Source = {
  kind: 'PO' | 'BILL';
  id: string;
  number: string;
  locationId: string | null;
  lines: PoLine[];
};

const RECEIVABLE_BILL_STATUSES = ['OPEN', 'PARTIALLY_PAID', 'PAID', 'OVERDUE'];

const billToSource = (bill: BillOption): Source => ({
  kind: 'BILL',
  id: bill.id,
  number: bill.billNumber,
  locationId: bill.locationId,
  lines: bill.lines
    .filter((l) => l.itemId)
    .map((l) => ({
      id: l.id,
      itemId: l.itemId as string,
      itemName: l.itemName,
      description: l.description,
      unit: 'pcs',
      quantity: l.quantity,
      quantityReceived: String(l.quantityReceived ?? 0),
      rate: l.rate,
    })),
});

const poToSource = (po: PurchaseOrder): Source => ({
  kind: 'PO',
  id: po.id,
  number: po.poNumber,
  locationId: po.locationId,
  lines: po.lines,
});

export type ExistingReceive = {
  id: string;
  receiveNumber: string;
  receiveDate: string;
  status: string;
  billedStatus?: string;
  trackingNumber: string | null;
  trackingUrl: string | null;
  notes: string | null;
  purchaseOrder: { id: string } | null;
  bill?: { id: string; billNumber: string } | null;
  vendor: { id: string } | null;
  location: { id: string } | null;
  lines: {
    poLineId: string | null;
    billLineId?: string | null;
    quantityReceived: string;
    batchNo: string | null;
    mfgDate?: string | null;
    expiryDate: string | null;
    artworkVersion?: string | null;
    alreadyLabelled?: boolean;
  }[];
};

type LineDraft = {
  qty: string;
  batchNo: string;
  mfgDate: string;
  expiryDate: string;
  expiryTouched: boolean;
  artworkVersion: string;
  alreadyLabelled: boolean;
};

const outstandingOf = (l: PoLine) =>
  Number(l.quantity) + Number(l.quantityReplacement ?? 0) - Number(l.quantityReceived);

const MAX_ATTACHMENTS = 5;

export function PurchaseReceiveForm({
  mode = 'create',
  existing = null,
}: {
  mode?: 'create' | 'edit';
  existing?: ExistingReceive | null;
}) {
  const params = useSearchParams();
  const isEdit = mode === 'edit';
  const quantitiesLocked = isEdit && !!existing?.billedStatus && existing.billedStatus !== 'NONE';

  const [vendors, setVendors] = useState<Vendor[]>([]);
  const [locations, setLocations] = useState<Location[]>([]);
  const [fetchedOrders, setFetchedOrders] = useState<{ vendorId: string; list: PurchaseOrder[] }>({
    vendorId: '',
    list: [],
  });
  const [fetchedPo, setFetchedPo] = useState<PurchaseOrder | null>(null);
  const [fetchedBills, setFetchedBills] = useState<{ vendorId: string; list: BillOption[] }>({
    vendorId: '',
    list: [],
  });
  const [fetchedBill, setFetchedBill] = useState<BillOption | null>(null);
  const [rules, setRules] = useState<Record<string, BatchRule>>({});
  const [attachments, setAttachments] = useState<Uploaded[]>([]);

  const [error, setError] = useState('');
  const { saving, stalledHref, begin: beginSave, done: doneSave, fail: failSave } =
    useSaveNav();

  const [form, setForm] = useState({
    vendorId: existing?.vendor?.id ?? params.get('vendorId') ?? '',
    sourceKind:
      existing?.bill?.id || params.get('billId')
        ? ('BILL' as 'PO' | 'BILL')
        : ('PO' as 'PO' | 'BILL'),
    purchaseOrderId: existing?.purchaseOrder?.id ?? params.get('purchaseOrderId') ?? '',
    billId: existing?.bill?.id ?? params.get('billId') ?? '',
    receiveNumber: existing?.receiveNumber ?? '',
    receiveDate: existing?.receiveDate.slice(0, 10) ?? todayIso(),
    trackingNumber: existing?.trackingNumber ?? '',
    trackingUrl: existing?.trackingUrl ?? '',
    locationId: existing?.location?.id ?? '',
    notes: existing?.notes ?? '',
  });
  const set = (patch: Partial<typeof form>) => setForm((f) => ({ ...f, ...patch }));

  const [lines, setLines] = useState<Record<string, LineDraft>>(() =>
    existing
      ? Object.fromEntries(
          existing.lines.map((l) => [
            (l.poLineId ?? l.billLineId) as string,
            {
              qty: String(Number(l.quantityReceived)),
              batchNo: l.batchNo ?? '',
              mfgDate: l.mfgDate?.slice(0, 10) ?? '',
              expiryDate: l.expiryDate?.slice(0, 10) ?? '',
              expiryTouched: !!l.expiryDate,
              artworkVersion: l.artworkVersion ?? '',
              alreadyLabelled: !!l.alreadyLabelled,
            },
          ])
        )
      : {}
  );

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const [v, l, n] = await Promise.all([
          api.get<Paged<Vendor>>('/vendors', { limit: 100 }),
          api.get<Paged<Location>>('/locations', { limit: 50 }),
          existing
            ? Promise.resolve(null)
            : api
                .get<{ data: { receiveNumber?: string } }>('/purchase-receives/next-number')
                .catch(() => null),
        ]);
        if (cancelled) return;
        setVendors(v.data);
        setLocations(l.data);
        const defaultLocation = l.data.find((x) => x.isDefault) ?? l.data[0];
        setForm((f) => ({
          ...f,
          receiveNumber: f.receiveNumber || (n?.data.receiveNumber ?? ''),
          locationId: f.locationId || (defaultLocation?.id ?? ''),
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
    const vendorId = form.vendorId;
    let cancelled = false;
    api
      .get<Paged<PurchaseOrder>>('/purchase-orders', { vendorId, limit: 100 })
      .then((r) => {
        if (cancelled) return;
        setFetchedOrders({
          vendorId,
          list: r.data.filter((o) => ['ISSUED', 'PARTIALLY_RECEIVED'].includes(o.status)),
        });
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [form.vendorId]);

  const orders = fetchedOrders.vendorId === form.vendorId ? fetchedOrders.list : [];

  useEffect(() => {
    if (!form.vendorId || form.sourceKind !== 'BILL') return;
    const vendorId = form.vendorId;
    let cancelled = false;
    api
      .get<Paged<BillOption>>('/bills', { vendorId, limit: 100 })
      .then((r) => {
        if (cancelled) return;
        setFetchedBills({
          vendorId,
          list: r.data.filter((b) => !b.purchaseOrderId && RECEIVABLE_BILL_STATUSES.includes(b.status)),
        });
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [form.vendorId, form.sourceKind]);

  const billOptions = fetchedBills.vendorId === form.vendorId ? fetchedBills.list : [];

  useEffect(() => {
    if (!form.billId) return;
    let cancelled = false;
    api
      .get<{ data: BillOption }>(`/bills/${form.billId}`)
      .then((r) => {
        if (cancelled) return;
        setFetchedBill(r.data);
        setForm((f) => ({ ...f, locationId: f.locationId || r.data.locationId || '' }));
        const source = billToSource(r.data);
        const itemIds = [...new Set(source.lines.map((l) => l.itemId))];
        if (itemIds.length) {
          api
            .get<{ data: Record<string, BatchRule> }>('/purchase-receives/batch-rules', { itemIds: itemIds.join(',') })
            .then((res) => {
              if (!cancelled) setRules(res.data);
            })
            .catch(() => {});
        }
        if (!existing) {
          setLines(
            Object.fromEntries(
              source.lines.map((l) => {
                const left = Number(l.quantity) - Number(l.quantityReceived);
                return [
                  l.id,
                  {
                    qty: left > 0 ? String(left) : '0',
                    batchNo: '',
                    mfgDate: '',
                    expiryDate: '',
                    expiryTouched: false,
                    artworkVersion: '',
                    alreadyLabelled: false,
                  },
                ];
              })
            )
          );
        }
      })
      .catch((err) => {
        if (!cancelled) setError(errorMessage(err));
      });
    return () => {
      cancelled = true;
    };
  }, [form.billId, existing]);

  useEffect(() => {
    if (!form.purchaseOrderId) return;
    let cancelled = false;
    api
      .get<{ data: PurchaseOrder }>(`/purchase-orders/${form.purchaseOrderId}`)
      .then((r) => {
        if (cancelled) return;
        setFetchedPo(r.data);
        setForm((f) => ({ ...f, locationId: f.locationId || r.data.locationId }));
        const itemIds = [...new Set(r.data.lines.map((l) => l.itemId))];
        if (itemIds.length) {
          api
            .get<{ data: Record<string, BatchRule> }>('/purchase-receives/batch-rules', { itemIds: itemIds.join(',') })
            .then((res) => {
              if (!cancelled) setRules(res.data);
            })
            .catch(() => {});
        }
        if (!existing) {
          setLines(
            Object.fromEntries(
              r.data.lines.map((l) => {
                const outstanding = outstandingOf(l);
                return [
                  l.id,
                  {
                    qty: outstanding > 0 ? String(outstanding) : '0',
                    batchNo: '',
                    mfgDate: '',
                    expiryDate: '',
                    expiryTouched: false,
                    artworkVersion: '',
                    alreadyLabelled: false,
                  },
                ];
              })
            )
          );
        }
      })
      .catch((err) => {
        if (!cancelled) setError(errorMessage(err));
      });
    return () => {
      cancelled = true;
    };
  }, [form.purchaseOrderId, existing]);

  const po = fetchedPo?.id === form.purchaseOrderId ? fetchedPo : null;
  const orderOptions = po && !orders.some((o) => o.id === po.id) ? [...orders, po] : orders;

  const bill = fetchedBill?.id === form.billId ? fetchedBill : null;
  const billPicklist = bill && !billOptions.some((b) => b.id === bill.id) ? [...billOptions, bill] : billOptions;

  const source: Source | null =
    form.sourceKind === 'BILL' ? (bill ? billToSource(bill) : null) : po ? poToSource(po) : null;

  const blankDraft = (): LineDraft => ({
    qty: '0',
    batchNo: '',
    mfgDate: '',
    expiryDate: '',
    expiryTouched: false,
    artworkVersion: '',
    alreadyLabelled: false,
  });

  const setLine = (id: string, patch: Partial<LineDraft>) =>
    setLines((rows) => ({
      ...rows,
      [id]: { ...blankDraft(), ...rows[id], ...patch },
    }));

  const ruleOf = (lineId: string) => {
    const line = source?.lines.find((l) => l.id === lineId);
    return line ? rules[line.itemId] : undefined;
  };

  const setMfg = (poLine: PoLine, mfgDate: string) => {
    const rule = rules[poLine.itemId];
    const draft = lines[poLine.id] ?? blankDraft();
    setLine(poLine.id, {
      mfgDate,
      ...(!draft.expiryTouched && rule?.shelfLifeMonths ? { expiryDate: addMonthsIso(mfgDate, rule.shelfLifeMonths) } : {}),
    });
  };

  const totalReceiving = Object.values(lines).reduce((n, l) => n + Number(l.qty || 0), 0);

  async function submit(status: 'DRAFT' | 'IN_TRANSIT' | 'RECEIVED' | null) {
    setError('');

    const payload = Object.entries(lines)
      .filter(([, v]) => Number(v.qty) > 0)
      .map(([lineId, v]) => {
        const rule = ruleOf(lineId);
        return {
          poLineId: form.sourceKind === 'PO' ? lineId : undefined,
          billLineId: form.sourceKind === 'BILL' ? lineId : undefined,
          quantityReceived: Number(v.qty),
          batchNo: v.batchNo.trim() || undefined,
          mfgDate: rule?.isPackaging ? undefined : v.mfgDate || undefined,
          expiryDate: rule?.isPackaging ? undefined : v.expiryDate || undefined,
          artworkVersion: rule?.isPackaging ? v.artworkVersion.trim() || undefined : undefined,
          alreadyLabelled: rule?.labelTracked ? v.alreadyLabelled : undefined,
        };
      });

    if (!form.vendorId) return setError('Pick a vendor');
    if (form.sourceKind === 'BILL' && !form.billId) return setError('Pick a bill');
    if (form.sourceKind === 'PO' && !form.purchaseOrderId) return setError('Pick a purchase order');
    if (status === null && !payload.length) return setError('Enter a quantity to receive on at least one line');
    if (!payload.length) return setError('Enter a quantity to receive on at least one line');
    if (status === 'RECEIVED') {
      for (const p of payload) {
        const rule = ruleOf((p.poLineId ?? p.billLineId) as string);
        if (!rule?.batchRequired) continue;
        if (!p.batchNo) return setError(`Enter the factory batch number for "${rule.name}"`);
        if (!p.mfgDate) return setError(`Enter the mfg date of batch ${p.batchNo} ("${rule.name}")`);
        if (!p.expiryDate && !rule.shelfLifeMonths) return setError(`Enter the expiry date of batch ${p.batchNo}`);
      }
    }

    beginSave();
    try {
      const body = {
        receiveDate: form.receiveDate,
        ...(status ? { status } : {}),
        locationId: form.locationId || undefined,
        trackingNumber: form.trackingNumber.trim() || undefined,
        trackingUrl: form.trackingUrl.trim() || undefined,
        notes: form.notes.trim() || undefined,
        lines: payload,
      };

      const res = isEdit
        ? await api.patch<{ data: { id: string } }>(`/purchase-receives/${existing!.id}`, body)
        : await api.post<{ data: { id: string } }>('/purchase-receives', {
            ...body,
            ...(form.sourceKind === 'BILL'
              ? { billId: form.billId }
              : { purchaseOrderId: form.purchaseOrderId }),
          });

      const receiveId = res.data.id;

      for (const f of attachments) {
        await api
          .post('/shared/attachments', {
            ownerType: form.sourceKind === 'BILL' ? 'BILL' : 'PURCHASE_ORDER',
            ownerId: form.sourceKind === 'BILL' ? form.billId : form.purchaseOrderId,
            fileName: f.fileName,
            fileUrl: f.url,
            mimeType: f.mimeType,
            sizeBytes: f.sizeBytes,
          })
          .catch(() => {});
      }

      doneSave(`/purchase-receives/${receiveId}`);
    } catch (err) {
      setError(errorMessage(err));
      failSave();
    }
  }

  const label = 'mb-1 block text-xs font-medium text-muted-foreground';

  return (
    <>
      <PageCrumb label={isEdit ? `Edit ${existing!.receiveNumber}` : 'New purchase receive'} />

      <PageHeader title={isEdit ? `Edit ${existing!.receiveNumber}` : 'New Purchase Receive'} />

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
                  disabled={isEdit}
                  onChange={(vendorId, picked) => {
                    if (picked && !vendors.some((v) => v.id === picked.id)) setVendors((vs) => [...vs, picked]);
                    set({ vendorId, purchaseOrderId: '', billId: '' });
                    setLines({});
                  }}
                />
              </div>

              <div>
                <span className={label}>Goods arrived against</span>
                <Select
                  value={form.sourceKind}
                  onChange={(e) => {
                    setLines({});
                    set({ sourceKind: e.target.value as 'PO' | 'BILL', purchaseOrderId: '', billId: '' });
                  }}
                  disabled={isEdit}
                  className="w-full"
                >
                  <option value="PO">A purchase order</option>
                  <option value="BILL">A bill (no purchase order was raised)</option>
                </Select>
              </div>

              {form.sourceKind === 'PO' ? (
                <div>
                  <span className={label}>
                    Purchase Order# <span className="text-destructive">*</span>
                  </span>
                  <Select
                    value={form.purchaseOrderId}
                    onChange={(e) => set({ purchaseOrderId: e.target.value })}
                    disabled={isEdit || !form.vendorId}
                    className="w-full"
                  >
                    <option value="">Select a Purchase Order</option>
                    {orderOptions.map((o) => (
                      <option key={o.id} value={o.id}>{o.poNumber}</option>
                    ))}
                  </Select>
                  {!isEdit && form.vendorId && orderOptions.length === 0 && (
                    <p className="mt-1.5 text-xs text-warning">
                      This vendor has no issued purchase order waiting on goods.
                    </p>
                  )}
                </div>
              ) : (
                <div>
                  <span className={label}>
                    Bill# <span className="text-destructive">*</span>
                  </span>
                  <Select
                    value={form.billId}
                    onChange={(e) => set({ billId: e.target.value })}
                    disabled={isEdit || !form.vendorId}
                    className="w-full"
                  >
                    <option value="">Select a bill</option>
                    {billPicklist.map((b) => (
                      <option key={b.id} value={b.id}>{b.billNumber}</option>
                    ))}
                  </Select>
                  {!isEdit && form.vendorId && billPicklist.length === 0 && (
                    <p className="mt-1.5 text-xs text-warning">
                      This vendor has no open bill without a purchase order.
                    </p>
                  )}
                  <p className="mt-1.5 text-xs text-muted-foreground">
                    The goods count as billed straight away, because the bill is already on record.
                  </p>
                </div>
              )}
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Purchase Receive#" required hint={isEdit ? 'Numbers are not reassigned' : 'Reserved for this receipt'}>
                <Input value={form.receiveNumber} readOnly className="font-mono" />
              </Field>
              <Field label="Received Date" required>
                <Input
                  type="date"
                  value={form.receiveDate}
                  onChange={(e) => set({ receiveDate: e.target.value })}
                />
              </Field>
              <Field label="Tracking#">
                <Input
                  value={form.trackingNumber}
                  onChange={(e) => set({ trackingNumber: e.target.value })}
                />
              </Field>
              <Field label="Tracking URL">
                <Input
                  value={form.trackingUrl}
                  onChange={(e) => set({ trackingUrl: e.target.value })}
                  placeholder="https://…"
                />
              </Field>
            </div>
          </div>
        </Card>

        <Card padded={false}>
          <div className="flex flex-wrap items-end gap-4 border-b border-border px-4 py-3">
            <h2 className="text-sm font-semibold">Item Table</h2>
            <div className="ml-auto">
              <span className={label}>Warehouse Location</span>
              <Select
                value={form.locationId}
                onChange={(e) => set({ locationId: e.target.value })}
                className="min-w-[220px]"
              >
                <option value="">Select a location</option>
                {locations.map((l) => (
                  <option key={l.id} value={l.id}>{l.name}</option>
                ))}
              </Select>
            </div>
          </div>

          <Table minWidth="880px">
            <thead>
              <tr>
                <Th>ITEMS &amp; DESCRIPTION</Th>
                <Th className="text-right">ORDERED</Th>
                <Th className="text-right">RECEIVED</Th>
                <Th className="text-right">QUANTITY TO RECEIVE</Th>
                <Th>BATCH NO.</Th>
                <Th>MFG &amp; EXPIRY</Th>
              </tr>
            </thead>
            <tbody>
              {!source && (
                <tr>
                  <td colSpan={6} className="px-4 py-10 text-center text-sm text-muted-foreground">
                    Pick a vendor and {form.sourceKind === 'BILL' ? 'a bill' : 'a purchase order'} to load its items.
                  </td>
                </tr>
              )}
              {source && source.lines.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-4 py-10 text-center text-sm text-muted-foreground">
                    No line on {source.number} is linked to a stock item, so there is nothing to receive.
                  </td>
                </tr>
              )}
              {source?.lines.map((l) => {
                const draft = lines[l.id] ?? blankDraft();
                const outstanding = outstandingOf(l);
                const rule = rules[l.itemId];
                const replacement = Number(l.quantityReplacement ?? 0);
                return (
                  <tr key={l.id}>
                    <Td>
                      <div className="font-medium">{l.itemName}</div>
                      {l.description && (
                        <div className="whitespace-pre-line text-xs text-muted-foreground">
                          {l.description}
                        </div>
                      )}
                    </Td>
                    <Td className="text-right">
                      {Number(l.quantity)}
                      <div className="text-xs text-muted-foreground">{l.unit}</div>
                      {replacement > 0 && (
                        <div className="whitespace-nowrap text-xs text-warning">+{replacement} replacement</div>
                      )}
                    </Td>
                    <Td className="text-right">{Number(l.quantityReceived)}</Td>
                    <Td>
                      <Input
                        type="number" min="0" step="0.01" max={outstanding}
                        value={draft.qty}
                        onChange={(e) => setLine(l.id, { qty: e.target.value })}
                        className="ml-auto w-24 text-right"
                        aria-label={`Quantity to receive of ${l.itemName}`}
                        disabled={quantitiesLocked}
                        title={quantitiesLocked ? 'Locked - this receive has been billed' : undefined}
                      />
                    </Td>
                    <Td>
                      {rule?.isPackaging ? (
                        <div className="space-y-1.5">
                          <Input
                            value={draft.batchNo}
                            onChange={(e) => setLine(l.id, { batchNo: e.target.value })}
                            className="w-32"
                            placeholder="Optional"
                            aria-label={`Batch number of ${l.itemName}`}
                          />
                          <Input
                            value={draft.artworkVersion}
                            onChange={(e) => setLine(l.id, { artworkVersion: e.target.value })}
                            className="w-32"
                            placeholder="Artwork version"
                            aria-label={`Artwork version of ${l.itemName}`}
                          />
                        </div>
                      ) : (
                        <div className="space-y-1.5">
                          <Input
                            value={draft.batchNo}
                            onChange={(e) => setLine(l.id, { batchNo: e.target.value.toUpperCase() })}
                            className="w-32 font-mono"
                            placeholder={rule?.batchRequired ? 'Required' : 'Optional'}
                            aria-label={`Batch number of ${l.itemName}`}
                            aria-required={rule?.batchRequired || undefined}
                          />
                          {rule?.labelTracked && (
                            <label className="flex cursor-pointer items-center gap-1.5 text-xs text-muted-foreground">
                              <input
                                type="checkbox"
                                checked={draft.alreadyLabelled}
                                onChange={(e) => setLine(l.id, { alreadyLabelled: e.target.checked })}
                                className="size-3.5 accent-[var(--gold)]"
                              />
                              Arrived labelled
                            </label>
                          )}
                        </div>
                      )}
                    </Td>
                    <Td>
                      {rule?.isPackaging ? (
                        <span className="text-xs text-muted-foreground">No dates on packaging</span>
                      ) : (
                        <div className="grid w-44 gap-1.5">
                          <div className="grid grid-cols-[2.75rem_1fr] items-center gap-1.5">
                            <span className="text-xs text-muted-foreground">Mfg</span>
                            <Input
                              type="date"
                              value={draft.mfgDate}
                              onChange={(e) => setMfg(l, e.target.value)}
                              aria-label={`Mfg date of ${l.itemName}`}
                            />
                          </div>
                          <div className="grid grid-cols-[2.75rem_1fr] items-center gap-1.5">
                            <span className="text-xs text-muted-foreground">Expiry</span>
                            <Input
                              type="date"
                              value={draft.expiryDate}
                              onChange={(e) => setLine(l.id, { expiryDate: e.target.value, expiryTouched: !!e.target.value })}
                              aria-label={`Expiry date of ${l.itemName}`}
                            />
                          </div>
                          {rule?.shelfLifeMonths ? (
                            <p className="pl-[3.125rem] text-xs text-muted-foreground">Mfg + {rule.shelfLifeMonths} months</p>
                          ) : null}
                        </div>
                      )}
                    </Td>
                  </tr>
                );
              })}
            </tbody>
          </Table>
          <p className="border-t border-border px-4 py-2.5 text-xs text-muted-foreground">
            Everything received waits for QC. Products also need to be marked labelled (unless they arrived labelled) before they can be sold.
          </p>
        </Card>

        <div className="grid gap-5 lg:grid-cols-2">
          <Card>
            <Field label="Notes (For Internal Use)">
              <Textarea
                rows={4}
                value={form.notes}
                onChange={(e) => set({ notes: e.target.value })}
              />
            </Field>
          </Card>

          <Card>
            <span className={label}>Attach File(s) to Purchase Receive</span>
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
              You can upload a maximum of {MAX_ATTACHMENTS} files, 10MB each. They attach to the
              purchase order once this receipt is saved.
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

      <SaveBar>
        {quantitiesLocked ? (
          <Button
            type="button"
            variant="primary"
            disabled={saving}
            onClick={() => submit(null)}
          >
            {saving && <Spinner className="border-card/40 border-t-card" />}
            Save changes
          </Button>
        ) : (
          <>
            <Button type="button" disabled={saving} onClick={() => submit('DRAFT')}>
              Save as Draft
            </Button>
            <Button type="button" disabled={saving} onClick={() => submit('IN_TRANSIT')}>
              Save as In Transit
            </Button>
            <Button type="button" variant="success" disabled={saving} onClick={() => submit('RECEIVED')}>
              {saving && <Spinner className="border-card/40 border-t-card" />}
              Save as Received
            </Button>
          </>
        )}
        <Link href={isEdit ? `/purchase-receives/${existing!.id}` : '/purchase-receives'}>
          <Button type="button" variant="ghost">Cancel</Button>
        </Link>
        <span className="ml-auto text-sm text-muted-foreground">
          Receiving{' '}
          <strong className="text-foreground">{totalReceiving}</strong> unit(s)
        </span>
      </SaveBar>
    </>
  );
}
