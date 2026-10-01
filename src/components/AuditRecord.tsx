'use client';

import { money, dateTime, shortDate } from '@/lib/api';
import { Badge, Table, Td, Th } from '@/components/ui';

const LABELS: Record<string, string> = {
  orderNumber: 'Order number', invoiceNumber: 'Invoice number', creditNumber: 'Credit note',
  challanNumber: 'Challan number', billNumber: 'Bill number', poNumber: 'PO number',
  receiveNumber: 'Receive number', paymentNumber: 'Payment number', returnNumber: 'Return number',
  ewayBillNumber: 'e-Way bill', orderType: 'Type', orderStatus: 'Order status',
  paymentStatus: 'Payment status', fulfillmentStatus: 'Fulfilment', deliveryStatus: 'Delivery',
  grandTotal: 'Grand total', subTotal: 'Subtotal', subtotal: 'Subtotal',
  discountTotal: 'Discount', shippingTotal: 'Shipping', shippingCharge: 'Shipping', codCharge: 'COD charge',
  taxTotal: 'Tax', balanceDue: 'Balance due', amountPaid: 'Paid', balanceAmount: 'Balance',
  adjustment: 'Adjustment', placedAt: 'Placed', invoiceDate: 'Invoice date', dueDate: 'Due',
  creditDate: 'Credit date', challanDate: 'Challan date', billDate: 'Bill date', poDate: 'PO date',
  createdAt: 'Created', customerSnapshot: 'Customer', customerName: 'Customer',
  vendorName: 'Vendor', shippingAddress: 'Ship to', billingAddress: 'Bill to',
  placeOfSupplyCode: 'Place of supply', displayName: 'Name', customerType: 'Customer type',
  totalOrders: 'Orders', totalSpent: 'Lifetime spend', sellingPrice: 'Selling price',
  costPrice: 'Cost price', sellingTaxTreatment: 'Selling price tax', costTaxTreatment: 'Cost price tax', hsnCode: 'HSN', itemCategory: 'Category', isActive: 'Active',
  lastLoginAt: 'Last signed in', productType: 'Product type', discountCode: 'Discount code',
};

const MONEY = new Set([
  'grandTotal', 'subTotal', 'subtotal', 'discountTotal', 'shippingTotal', 'shippingCharge', 'codCharge',
  'taxTotal', 'balanceDue', 'amountPaid', 'balanceAmount', 'adjustment', 'unitPrice',
  'lineTotal', 'rate', 'amount', 'sellingPrice', 'costPrice', 'totalSpent', 'price',
]);

const DATE = /(At|Date)$/;

const FIELD_ORDER = [
  'orderNumber', 'invoiceNumber', 'creditNumber', 'challanNumber', 'billNumber', 'poNumber',
  'receiveNumber', 'paymentNumber', 'returnNumber', 'ewayBillNumber',
  'name', 'title', 'displayName', 'customerName', 'vendorName', 'code', 'sku', 'hsnCode',
  'orderType', 'customerType', 'itemCategory', 'productType', 'unit',
  'status', 'orderStatus', 'paymentStatus', 'fulfillmentStatus', 'deliveryStatus', 'isActive',
  'placedAt', 'invoiceDate', 'creditDate', 'challanDate', 'billDate', 'poDate', 'dueDate',
  'createdAt', 'lastLoginAt',
  'email', 'phone', 'placeOfSupplyCode', 'totalOrders',
  'subtotal', 'subTotal', 'discountTotal', 'shippingTotal', 'shippingCharge', 'codCharge', 'taxTotal',
  'adjustment', 'grandTotal', 'amountPaid', 'balanceDue', 'balanceAmount',
  'sellingPrice', 'costPrice', 'totalSpent',
];

const ADDRESS_ORDER = [
  'firstName', 'lastName', 'company', 'attention',
  'line1', 'line2', 'city', 'state', 'pincode', 'country', 'phone', 'email',
];

const LINE_ORDER = [
  'name', 'itemName', 'variantTitle', 'description', 'sku', 'hsnCode',
  'quantity', 'unitPrice', 'rate', 'amount', 'lineTotal',
];

function ordered(keys: string[], order: string[]) {
  const known = order.filter((k) => keys.includes(k));
  const rest = keys.filter((k) => !order.includes(k)).sort();
  return [...known, ...rest];
}

const label = (k: string) =>
  LABELS[k] ?? k.replace(/([a-z])([A-Z])/g, '$1 $2').replace(/^./, (c) => c.toUpperCase());

const isLines = (v: unknown): v is Record<string, unknown>[] =>
  Array.isArray(v) && v.length > 0 && typeof v[0] === 'object' && v[0] !== null;

function Value({ name, value }: { name: string; value: unknown }) {
  if (value === null || value === undefined || value === '') {
    return <span className="text-muted-foreground">—</span>;
  }
  if (typeof value === 'boolean') {
    return <Badge tone={value ? 'green' : 'gray'}>{value ? 'Yes' : 'No'}</Badge>;
  }
  if (String(value) === '[redacted]') {
    return (
      <span className="rounded bg-muted px-1.5 py-0.5 font-mono text-xs text-muted-foreground">
        hidden
      </span>
    );
  }
  if (MONEY.has(name) && !Number.isNaN(Number(value))) return <>{money(value as string)}</>;
  if (DATE.test(name) && typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return <>{shortDate(value)}</>;
  }
  if (DATE.test(name) && !Number.isNaN(Date.parse(String(value)))) {
    return <>{dateTime(String(value))}</>;
  }
  if (typeof value === 'string' && /^[A-Z][A-Z_]{2,}$/.test(value)) {
    return <Badge status={value}>{value.replaceAll('_', ' ')}</Badge>;
  }
  return <>{String(value)}</>;
}

function Block({ data }: { data: Record<string, unknown> }) {
  const keys = ordered(
    Object.keys(data).filter((k) => k !== 'id' && data[k] != null && data[k] !== ''),
    ADDRESS_ORDER
  );
  const parts = keys.map((k) => String(data[k]));
  return (
    <span className="text-foreground">{parts.join(', ') || '—'}</span>
  );
}

function Lines({ rows }: { rows: Record<string, unknown>[] }) {
  const cols = ordered(
    [...new Set(rows.flatMap((r) => Object.keys(r)))].filter(
      (c) => c !== 'id' && rows.some((r) => r[c] != null && r[c] !== '')
    ),
    LINE_ORDER
  );
  return (
    <Table>
      <thead>
        <tr>
          {cols.map((c) => (
            <Th
              key={c}
              className={MONEY.has(c) || c === 'quantity' ? 'text-right' : ''}
            >
              {label(c)}
            </Th>
          ))}
        </tr>
      </thead>
      <tbody>
        {rows.map((r, i) => (
          <tr key={i}>
            {cols.map((c) => (
              <Td
                key={c}
                className={MONEY.has(c) || c === 'quantity' ? 'text-right tabular-nums' : ''}
              >
                <Value name={c} value={r[c]} />
              </Td>
            ))}
          </tr>
        ))}
      </tbody>
    </Table>
  );
}

export function AuditRecord({ record }: { record: Record<string, unknown> }) {
  const entries = ordered(
    Object.keys(record).filter((k) => k !== 'id'),
    FIELD_ORDER
  ).map((k) => [k, record[k]] as [string, unknown]);
  const lineFields = entries.filter(([, v]) => isLines(v));
  const scalars = entries.filter(([, v]) => !isLines(v) && (typeof v !== 'object' || v === null));
  const blocks = entries.filter(
    ([, v]) => v !== null && typeof v === 'object' && !Array.isArray(v)
  );

  return (
    <div className="space-y-4">
      {(scalars.length > 0 || blocks.length > 0) && (
        <dl className="grid gap-x-6 gap-y-1 sm:grid-cols-2">
          {scalars.map(([k, v]) => (
            <div
              key={k}
              className="flex items-baseline justify-between gap-3 border-b border-border py-1.5"
            >
              <dt className="shrink-0 text-xs text-muted-foreground">{label(k)}</dt>
              <dd className="min-w-0 text-right text-sm text-foreground">
                <Value name={k} value={v} />
              </dd>
            </div>
          ))}
          {blocks.map(([k, v]) => (
            <div
              key={k}
              className="flex items-baseline justify-between gap-3 border-b border-border py-1.5 sm:col-span-2"
            >
              <dt className="shrink-0 text-xs text-muted-foreground">{label(k)}</dt>
              <dd className="min-w-0 text-right text-sm">
                <Block data={v as Record<string, unknown>} />
              </dd>
            </div>
          ))}
        </dl>
      )}

      {lineFields.map(([k, v]) => (
        <div key={k}>
          <div className="mb-1.5 text-xs font-medium text-muted-foreground">
            {label(k)} ({(v as unknown[]).length})
          </div>
          <Lines rows={v as Record<string, unknown>[]} />
        </div>
      ))}
    </div>
  );
}
