'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { api, money, dateTime, errorMessage } from '@/lib/api';
import { usePaymentTerms } from '@/components/PaymentTermSelect';
import {
  VendorFormFields, vendorToForm, vendorFormToPayload, emptyVendorForm, bankMismatch,
  blankAddress, blankContact, blankBank, contactsToDrafts, banksToDrafts,
  certificateState, certificateTypeLabel, vendorTypeLabel,
  type AddressDraft, type BankDraft, type ContactDraft, type DocumentDraft, type VendorFormValues,
} from '@/components/VendorForm';
import {
  Badge, Button, Card, EmptyRow, ErrorBox, Field, Input, Loading, PageHeader,
  Table, Td, Textarea, Th, Spinner,
} from '@/components/ui';
import { useToast } from '@/lib/toast';
import { LoadedSalesSummary } from '@/components/SalesSummary';
import { PageCrumb } from '@/lib/crumbs';

type Address = {
  id?: string;
  type: string;
  attention: string | null;
  line1: string;
  line2: string | null;
  city: string;
  state: string;
  stateCode: string | null;
  pincode: string;
  country: string | null;
  phone: string | null;
};

type Contact = {
  salutation?: string; firstName?: string; lastName?: string;
  email?: string; workPhone?: string; mobile?: string; designation?: string; isPrimary?: boolean;
};

type Bank = {
  accountHolderName?: string; bankName?: string; accountNumber?: string;
  ifscCode?: string; branch?: string; isPrimary?: boolean;
};

type Vendor = {
  id: string;
  displayName: string;
  status: 'ACTIVE' | 'INACTIVE';
  payablesBalance: string | null;
  unusedCredits: string | null;
  createdAt: string;
  updatedAt: string;
  addresses?: Address[];
  contacts?: Contact[];
  bankAccounts?: Bank[];
} & Record<string, unknown>;

type Txns = {
  purchaseOrders: {
    id: string; poNumber: string; poDate: string; status: string;
    grandTotal: string; receivedStatus: string; billedStatus: string;
  }[];
  bills: {
    id: string; billNumber: string; billDate: string; dueDate: string | null;
    status: string; grandTotal: string; balanceDue: string;
  }[];
  payments: {
    id: string; paymentNumber: string; paymentDate: string; amount: string; paymentMode: string;
  }[];
  credits: {
    id: string; creditNumber: string; creditDate: string; status: string;
    grandTotal: string; balance: string;
  }[];
  receives?: {
    id: string; receiveNumber?: string; receiveDate: string; purchaseOrderId?: string;
  }[];
};

type Statement = {
  vendor: { displayName: string; companyName: string | null; gstin: string | null };
  period: { from: string; to: string };
  summary: { openingBalance: number; billedAmount: number; amountPaid: number; balanceDue: number };
  ledger: { date: string; transaction: string; details: string; amount: number; payment: number; balance: number }[];
};

type Mail = {
  id: string;
  toAddress: string;
  ccAddress: string | null;
  subject: string;
  bodyText: string | null;
  template: string | null;
  status: 'RECORDED' | 'QUEUED' | 'SENT' | 'FAILED';
  error: string | null;
  sentAt: string | null;
  sentByName: string | null;
  createdAt: string;
};

type Activity = {
  id: string;
  eventType: string;
  message: string | null;
  actorName: string | null;
  isComment: boolean;
  isInternal?: boolean;
  occurredAt: string;
};

const TABS = ['Overview', 'Comments', 'Transactions', 'Mails', 'Statement'] as const;
type Tab = (typeof TABS)[number];

const GST_TREATMENT: Record<string, string> = {
  REGISTERED_REGULAR: 'Registered business — regular',
  REGISTERED_COMPOSITION: 'Registered business — composition',
  UNREGISTERED: 'Unregistered',
  CONSUMER: 'Consumer',
  OVERSEAS: 'Overseas',
  SEZ: 'SEZ',
};

const show = (v: unknown, fallback = '—') =>
  v === null || v === undefined || v === '' ? fallback : String(v);

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex gap-3 py-1">
      <dt className="w-36 shrink-0 text-xs text-muted-foreground">{label}</dt>
      <dd className="text-sm text-foreground">{value}</dd>
    </div>
  );
}

function SectionHeading({ children }: { children: React.ReactNode }) {
  return (
    <h3 className="mb-2 border-b border-border pb-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
      {children}
    </h3>
  );
}

function AddressBlock({ a }: { a: Address | undefined }) {
  if (!a) return <p className="text-sm text-muted-foreground">Not provided</p>;
  return (
    <div className="text-sm text-foreground">
      {a.attention && <div>{a.attention}</div>}
      <div>{a.line1}</div>
      {a.line2 && <div>{a.line2}</div>}
      <div>{a.city}</div>
      <div>
        {[a.state, a.pincode].filter(Boolean).join(' ')}
      </div>
      <div>{a.country}</div>
      {a.phone && <div className="text-muted-foreground">{a.phone}</div>}
    </div>
  );
}

export default function VendorDetailPage() {
  const { label: termName } = usePaymentTerms();
  const { id } = useParams<{ id: string }>();
  const router = useRouter();

  const [vendor, setVendor] = useState<Vendor | null>(null);
  const [txns, setTxns] = useState<Txns>({ purchaseOrders: [], bills: [], payments: [], credits: [], receives: [] });
  const [statement, setStatement] = useState<Statement | null>(null);
  const [activity, setActivity] = useState<Activity[]>([]);
  const [mails, setMails] = useState<Mail[]>([]);
  const [mailTransport, setMailTransport] = useState(false);
  const [mailDraft, setMailDraft] = useState({ to: '', subject: '', body: '' });

  const [tab, setTab] = useState<Tab>('Overview');
  const [editing, setEditing] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const toast = useToast();
  const [comment, setComment] = useState('');
  const [busy, setBusy] = useState(false);

  const [form, setFormState] = useState<VendorFormValues>(emptyVendorForm());
  const setForm = (patch: Partial<VendorFormValues>) => setFormState((f) => ({ ...f, ...patch }));
  const [addresses, setAddresses] = useState<AddressDraft[]>([blankAddress('BILLING'), blankAddress('SHIPPING')]);
  const [contacts, setContacts] = useState<ContactDraft[]>([blankContact()]);
  const [banks, setBanks] = useState<BankDraft[]>([blankBank()]);
  const [documents, setDocuments] = useState<DocumentDraft[]>([]);

  const seed = useCallback((v: Vendor) => {
    setFormState(vendorToForm(v));
    const list = Array.isArray(v.addresses) ? v.addresses : [];
    const toDraft = (a: Address): AddressDraft => ({
      type: a.type ?? 'BILLING',
      attention: a.attention ?? '',
      line1: a.line1 ?? '',
      line2: a.line2 ?? '',
      city: a.city ?? '',
      state: a.state ?? '',
      stateCode: a.stateCode ?? '',
      pincode: a.pincode ?? '',
      country: a.country ?? 'India',
      phone: a.phone ?? '',
    });
    const billing = list.find((a) => a.type === 'BILLING');
    const shipping = list.find((a) => a.type === 'SHIPPING');
    setAddresses([
      billing ? toDraft(billing) : blankAddress('BILLING'),
      shipping ? toDraft(shipping) : blankAddress('SHIPPING'),
    ]);
    setContacts(contactsToDrafts(v.contacts));
    setBanks(banksToDrafts(v.bankAccounts));
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const [v, t, st, act, ml] = await Promise.all([
        api.get<{ data: Vendor }>(`/vendors/${id}`),
        api
          .get<{ data: Txns }>(`/vendors/${id}/transactions`)
          .catch(() => ({ data: { purchaseOrders: [], bills: [], payments: [], credits: [], receives: [] } })),
        api.get<{ data: Statement }>(`/vendors/${id}/statement`).catch(() => null),
        api
          .get<{ data: Activity[] }>('/shared/activity', { ownerType: 'VENDOR', ownerId: id })
          .catch(() => ({ data: [] as Activity[] })),
        api
          .get<{ data: Mail[]; meta: { transportConfigured: boolean } }>('/emails', {
            ownerType: 'VENDOR',
            ownerId: id,
          })
          .catch(() => null),
      ]);
      setVendor(v.data);
      setTxns(t.data);
      setStatement(st?.data ?? null);
      setActivity(act.data);
      if (ml) {
        setMails(ml.data);
        setMailTransport(ml.meta.transportConfigured);
      }
      setMailDraft((d) => (d.to ? d : { ...d, to: String(v.data.email ?? '') }));
      seed(v.data);
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setLoading(false);
    }
  }, [id, seed]);

  useEffect(() => {
    const t = setTimeout(load, 0);
    return () => clearTimeout(t);
  }, [load]);

  function flash(m: string) {
    toast.success(m);
  }

  async function save(e?: React.FormEvent) {
    e?.preventDefault();
    const bankError = bankMismatch(banks);
    if (bankError) {
      setError(bankError);
      return;
    }
    setSaving(true);
    setError('');
    try {
      await api.patch(`/vendors/${id}`, vendorFormToPayload(form, addresses, contacts, banks));
      flash('Saved');
      setEditing(false);
      await load();
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setSaving(false);
    }
  }

  async function addComment() {
    if (!comment.trim()) return;
    setBusy(true);
    setError('');
    try {
      await api.post('/shared/activity/comments', {
        ownerType: 'VENDOR',
        ownerId: id,
        message: comment.trim(),
        isInternal: true,
      });
      setComment('');
      flash('Comment added');
      await load();
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  async function sendMail() {
    if (!mailDraft.to.trim() || !mailDraft.subject.trim() || !mailDraft.body.trim()) {
      setError('An email needs a recipient, a subject and a body');
      return;
    }
    setBusy(true);
    setError('');
    try {
      const res = await api.post<{ message: string }>('/emails', {
        ownerType: 'VENDOR',
        ownerId: id,
        to: mailDraft.to.trim(),
        subject: mailDraft.subject.trim(),
        body: mailDraft.body.trim(),
        template: 'manual',
      });
      setMailDraft((d) => ({ ...d, subject: '', body: '' }));
      flash(res.message.startsWith('Email recorded') ? 'Recorded' : 'Sent');
      await load();
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  async function remove() {
    if (!confirm(`Delete "${vendor?.displayName}"?`)) return;
    try {
      await api.del(`/vendors/${id}`);
      router.push('/admin/vendors');
    } catch (err) {
      setError(errorMessage(err));
    }
  }

  if (loading) return <Loading />;
  if (!vendor) return <ErrorBox message={error || 'Vendor not found'} onRetry={load} />;

  const outstanding = Number(vendor.payablesBalance ?? 0);
  const credits = Number(vendor.unusedCredits ?? 0);
  const billing = (vendor.addresses ?? []).find((a) => a.type === 'BILLING');
  const shipping = (vendor.addresses ?? []).find((a) => a.type === 'SHIPPING');
  const primaryContact = [form.salutation, form.firstName, form.lastName].filter(Boolean).join(' ');
  const itemsToReceive = txns.purchaseOrders.filter((p) =>
    ['ISSUED', 'PARTIALLY_RECEIVED'].includes(p.status)
  ).length;

  return (
    <>
      <PageCrumb label={vendor.displayName} />

      <PageHeader
        title={vendor.displayName}
        actions={
          <>
            <Badge tone={vendor.status === 'ACTIVE' ? 'green' : 'gray'}>{vendor.status}</Badge>
            {editing ? (
              <>
                <Button
                  type="button"
                  onClick={() => {
                    setEditing(false);
                    seed(vendor);
                  }}
                >
                  Cancel
                </Button>
                <Button type="button" variant="primary" disabled={saving} onClick={() => save()}>
                  {saving && <Spinner className="border-card/40 border-t-card" />}
                  Save
                </Button>
              </>
            ) : (
              <>
                <Link href={`/admin/purchase-orders/new?vendorId=${vendor.id}`}>
                  <Button variant="success">New transaction</Button>
                </Link>
                <Button type="button" variant="danger" onClick={remove}>Delete</Button>
                <Button type="button" variant="primary" onClick={() => setEditing(true)}>Edit</Button>
              </>
            )}
          </>
        }
      />

      {error && <div className="mb-4"><ErrorBox message={error} /></div>}

      <div className="mb-5 flex gap-1 overflow-x-auto border-b border-border">
        {TABS.map((t) => (
          <button
            key={t}
            type="button"
            onClick={() => setTab(t)}
            className={`shrink-0 whitespace-nowrap px-3 py-2 text-sm ${
              tab === t
                ? 'border-b-2 border-gold font-medium text-foreground'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            {t}
          </button>
        ))}
      </div>

      {tab === 'Overview' &&
        (editing ? (
          <form onSubmit={save}>
            <VendorFormFields
              form={form}
              setForm={setForm}
              addresses={addresses}
              setAddresses={setAddresses}
              contacts={contacts}
              setContacts={setContacts}
              banks={banks}
              setBanks={setBanks}
              documents={documents}
              setDocuments={setDocuments}
            />
          </form>
        ) : (
          <div className="grid gap-5 lg:grid-cols-3">
            <div className="space-y-5">
              <Card title={vendor.displayName}>
                {primaryContact || form.email || form.workPhone || form.mobile ? (
                  <div className="text-sm">
                    {primaryContact && <div className="text-foreground">{primaryContact}</div>}
                    {form.email && (
                      <div className="break-all text-muted-foreground">{form.email}</div>
                    )}
                    {(form.workPhone || form.mobile) && (
                      <div className="text-muted-foreground">
                        {[form.workPhone, form.mobile].filter(Boolean).join(' · ')}
                      </div>
                    )}
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground">
                    There is no primary contact information.{' '}
                    <button
                      type="button"
                      onClick={() => setEditing(true)}
                      className="font-medium text-gold-ink hover:underline"
                    >
                      Add
                    </button>
                  </p>
                )}
              </Card>

              <Card title="Address">
                <SectionHeading>Billing address</SectionHeading>
                <AddressBlock a={billing} />
                <div className="mt-4">
                  <SectionHeading>Shipping address</SectionHeading>
                  <AddressBlock a={shipping} />
                </div>
              </Card>

              <Card title="Other details">
                <dl>
                  <Row label="Default currency" value={show(form.currency)} />
                  <Row
                    label="GST treatment"
                    value={GST_TREATMENT[form.gstTreatment] ?? form.gstTreatment}
                  />
                  <Row label="GSTIN" value={<span className="font-mono">{show(form.gstin)}</span>} />
                  <Row label="Source of supply" value={show(form.sourceOfSupplyState)} />
                  <Row label="PAN" value={<span className="font-mono">{show(form.pan)}</span>} />
                  <Row label="MSME" value={form.isMsme ? `Yes — ${show(form.msmeRegistrationNo)}` : 'No'} />
                  <Row label="Vendor type" value={vendorTypeLabel(form.vendorType)} />
                  {form.vendorType === 'MANUFACTURER' && (
                    <Row label="Cosmetics licence" value={<span className="font-mono">{show(form.cosmeticsLicenceNo)}</span>} />
                  )}
                </dl>
              </Card>

              <Card title="Certificates">
                {form.certificates.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No certificates uploaded yet</p>
                ) : (
                  <div className="space-y-3 text-sm">
                    {form.certificates.map((c, i) => {
                      const state = certificateState(c.expiresOn);
                      return (
                        <div key={i} className="flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <div className="text-foreground">
                              {c.fileUrl ? (
                                <a
                                  href={c.fileUrl}
                                  target="_blank"
                                  rel="noreferrer"
                                  className="text-gold-ink hover:underline"
                                >
                                  {certificateTypeLabel(c.type)}
                                </a>
                              ) : (
                                certificateTypeLabel(c.type)
                              )}
                            </div>
                            <div className="truncate font-mono text-xs text-muted-foreground">
                              {[c.number, c.expiresOn && `valid until ${c.expiresOn.split('-').reverse().join('/')}`]
                                .filter(Boolean)
                                .join(' · ') || '—'}
                            </div>
                          </div>
                          {state && <Badge tone={state.tone}>{state.label}</Badge>}
                        </div>
                      );
                    })}
                  </div>
                )}
              </Card>

              <Card title="Tax information">
                <dl>
                  <Row label="TDS" value={show(form.tdsSection)} />
                </dl>
              </Card>

              <Card title="Contact persons">
                {(vendor.contacts ?? []).length === 0 ? (
                  <p className="text-sm text-muted-foreground">
                    No contact persons found.
                  </p>
                ) : (
                  <div className="space-y-3 text-sm">
                    {(vendor.contacts ?? []).map((c, i) => (
                      <div key={i}>
                        <div className="text-foreground">
                          {[c.salutation, c.firstName, c.lastName].filter(Boolean).join(' ')}
                          {c.isPrimary && (
                            <span className="ml-2 text-xs text-muted-foreground">primary</span>
                          )}
                        </div>
                        <div className="text-xs text-muted-foreground">
                          {[c.email, c.workPhone, c.mobile].filter(Boolean).join(' · ') || '—'}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </Card>

              <Card title="Bank account details">
                {(vendor.bankAccounts ?? []).length === 0 ? (
                  <p className="text-sm text-muted-foreground">
                    No bank account added yet
                  </p>
                ) : (
                  <div className="space-y-3 text-sm">
                    {(vendor.bankAccounts ?? []).map((b, i) => (
                      <div key={i}>
                        <div className="text-foreground">
                          {show(b.bankName, 'Bank')}
                        </div>
                        <div className="font-mono text-xs text-muted-foreground">
                          {show(b.accountNumber)} · {show(b.ifscCode)}
                        </div>
                        {b.branch && (
                          <div className="text-xs text-muted-foreground">{b.branch}</div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </Card>

              <Card title="Record info">
                <dl>
                  <Row label="Created" value={dateTime(vendor.createdAt)} />
                  <Row label="Last updated" value={dateTime(vendor.updatedAt)} />
                </dl>
              </Card>
            </div>

            <div className="space-y-5 lg:col-span-2 min-w-0">
              <Card title="Payment due period">
                <p className="text-sm text-foreground">
                  {termName(form.paymentTerms)}
                </p>
              </Card>

              <Card title="Payables" padded={false}>
                <Table>
                  <thead>
                    <tr>
                      <Th>Currency</Th>
                      <Th className="text-right">Outstanding payables</Th>
                      <Th className="text-right">Unused credits</Th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr>
                      <Td>{form.currency} — Indian Rupee</Td>
                      <Td className="text-right font-medium">
                        {outstanding > 0 ? (
                          <span className="text-warning">
                            {money(outstanding)}
                          </span>
                        ) : (
                          money(0)
                        )}
                      </Td>
                      <Td className="text-right">{money(credits)}</Td>
                    </tr>
                  </tbody>
                </Table>
                <div className="flex gap-6 border-t border-border px-4 py-2.5 text-xs text-muted-foreground">
                  <span>
                    Purchase orders awaiting receipt:{' '}
                    <strong className="text-foreground">{itemsToReceive}</strong>
                  </span>
                  <span>
                    Total purchase orders:{' '}
                    <strong className="text-foreground">
                      {txns.purchaseOrders.length}
                    </strong>
                  </span>
                </div>
              </Card>

              <LoadedSalesSummary
                endpoint={`/vendors/${id}/purchase-summary`}
                title="Bills and spend"
                quantityLabel="Bills"
                revenueLabel="Spend"
                unitsCaption="bills received"
                totalCaption="total billed"
                emptyMessage="No bills in this period. Draft and void bills are left out."
              />

              <Card title="Activity">
                {activity.length === 0 ? (
                  <p className="text-sm text-muted-foreground">
                    Nothing logged for this vendor yet.
                  </p>
                ) : (
                  <ul className="space-y-3">
                    {activity.map((a) => (
                      <li
                        key={a.id}
                        className="border-l-2 border-border pl-3"
                      >
                        <div className="text-sm text-foreground">
                          {a.message ?? a.eventType.replaceAll('_', ' ')}
                        </div>
                        <div className="text-xs text-muted-foreground">
                          {dateTime(a.occurredAt)}
                          {a.actorName ? ` · ${a.actorName}` : ''}
                        </div>
                      </li>
                    ))}
                  </ul>
                )}
              </Card>
            </div>
          </div>
        ))}

      {tab === 'Comments' && (
        <Card title="Comments">
          <div className="mb-4 flex gap-2">
            <Textarea
              rows={3}
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              placeholder="Leave a note about this vendor…"
            />
            <Button disabled={busy || !comment.trim()} onClick={addComment}>
              {busy && <Spinner className="border-card/40 border-t-card" />}
              Add comment
            </Button>
          </div>

          <SectionHeading>All comments</SectionHeading>
          {activity.filter((a) => a.isComment).length === 0 ? (
            <p className="text-sm text-muted-foreground">No comments yet.</p>
          ) : (
            <ul className="space-y-3">
              {activity
                .filter((a) => a.isComment)
                .map((a) => (
                  <li key={a.id} className="border-l-2 border-border pl-3">
                    <div className="text-sm text-foreground">{a.message}</div>
                    <div className="mt-0.5 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                      <span>
                        {dateTime(a.occurredAt)}
                        {a.actorName ? ` · ${a.actorName}` : ''}
                      </span>
                      {a.isInternal !== false && <Badge tone="amber">Internal</Badge>}
                    </div>
                  </li>
                ))}
            </ul>
          )}
        </Card>
      )}

      {tab === 'Transactions' && (
        <div className="space-y-5">
          <Card
            title={`Bills (${txns.bills.length})`}
            padded={false}
            action={<Link href="/admin/bills"><Button size="sm">+ New</Button></Link>}
          >
            <Table>
              <thead>
                <tr>
                  <Th>Date</Th>
                  <Th>Bill #</Th>
                  <Th>Due</Th>
                  <Th>Status</Th>
                  <Th className="text-right">Amount</Th>
                  <Th className="text-right">Balance due</Th>
                </tr>
              </thead>
              <tbody>
                {txns.bills.length === 0 && <EmptyRow colSpan={6} message="No bills yet" />}
                {txns.bills.map((b) => (
                  <tr key={b.id}>
                    <Td className="whitespace-nowrap text-xs">{dateTime(b.billDate).split(',')[0]}</Td>
                    <Td className="font-mono text-xs">{b.billNumber}</Td>
                    <Td className="whitespace-nowrap text-xs">
                      {b.dueDate ? dateTime(b.dueDate).split(',')[0] : '—'}
                    </Td>
                    <Td><Badge status={b.status}>{b.status}</Badge></Td>
                    <Td className="whitespace-nowrap text-right">{money(b.grandTotal)}</Td>
                    <Td className="whitespace-nowrap text-right font-medium">
                      {Number(b.balanceDue) > 0 ? (
                        <span className="text-warning">
                          {money(b.balanceDue)}
                        </span>
                      ) : (
                        money(0)
                      )}
                    </Td>
                  </tr>
                ))}
              </tbody>
            </Table>
          </Card>

          <Card title={`Bill payments (${txns.payments.length})`} padded={false}>
            <Table>
              <thead>
                <tr>
                  <Th>Date</Th>
                  <Th>Payment #</Th>
                  <Th>Mode</Th>
                  <Th className="text-right">Amount paid</Th>
                </tr>
              </thead>
              <tbody>
                {txns.payments.length === 0 && (
                  <EmptyRow colSpan={4} message="No payments made yet" />
                )}
                {txns.payments.map((p) => (
                  <tr key={p.id}>
                    <Td className="whitespace-nowrap text-xs">
                      {dateTime(p.paymentDate).split(',')[0]}
                    </Td>
                    <Td className="font-mono text-xs">{p.paymentNumber}</Td>
                    <Td className="text-xs">{p.paymentMode?.replaceAll('_', ' ')}</Td>
                    <Td className="whitespace-nowrap text-right font-medium">{money(p.amount)}</Td>
                  </tr>
                ))}
              </tbody>
            </Table>
          </Card>

          <Card
            title={`Purchase orders (${txns.purchaseOrders.length})`}
            padded={false}
            action={
              <Link href={`/admin/purchase-orders/new?vendorId=${vendor.id}`}>
                <Button size="sm">+ New</Button>
              </Link>
            }
          >
            <Table>
              <thead>
                <tr>
                  <Th>PO #</Th>
                  <Th>Date</Th>
                  <Th>Status</Th>
                  <Th>Received</Th>
                  <Th>Billed</Th>
                  <Th className="text-right">Amount</Th>
                </tr>
              </thead>
              <tbody>
                {txns.purchaseOrders.length === 0 && (
                  <EmptyRow colSpan={6} message="There are no purchase orders" />
                )}
                {txns.purchaseOrders.map((p) => (
                  <tr key={p.id}>
                    <Td>
                      <Link
                        href={`/admin/purchase-orders/${p.id}`}
                        className="font-mono font-medium text-gold-ink hover:underline"
                      >
                        {p.poNumber}
                      </Link>
                    </Td>
                    <Td className="whitespace-nowrap text-xs">{dateTime(p.poDate).split(',')[0]}</Td>
                    <Td><Badge status={p.status}>{p.status.replaceAll('_', ' ')}</Badge></Td>
                    <Td className="text-xs">{p.receivedStatus}</Td>
                    <Td className="text-xs">{p.billedStatus}</Td>
                    <Td className="whitespace-nowrap text-right font-medium">
                      {money(p.grandTotal)}
                    </Td>
                  </tr>
                ))}
              </tbody>
            </Table>
          </Card>

          <Card title={`Vendor credits (${txns.credits.length})`} padded={false}>
            <Table>
              <thead>
                <tr>
                  <Th>Date</Th>
                  <Th>Credit note #</Th>
                  <Th>Status</Th>
                  <Th className="text-right">Amount</Th>
                  <Th className="text-right">Balance</Th>
                </tr>
              </thead>
              <tbody>
                {txns.credits.length === 0 && <EmptyRow colSpan={5} message="No data to display" />}
                {txns.credits.map((c) => (
                  <tr key={c.id}>
                    <Td className="whitespace-nowrap text-xs">
                      {dateTime(c.creditDate).split(',')[0]}
                    </Td>
                    <Td className="font-mono text-xs">{c.creditNumber}</Td>
                    <Td><Badge status={c.status}>{c.status}</Badge></Td>
                    <Td className="whitespace-nowrap text-right">{money(c.grandTotal)}</Td>
                    <Td className="whitespace-nowrap text-right font-medium">{money(c.balance)}</Td>
                  </tr>
                ))}
              </tbody>
            </Table>
          </Card>
        </div>
      )}

      {tab === 'Mails' && (
        <div className="space-y-5">
          {!mailTransport && (
            <div className="rounded-lg border border-warning/30 bg-warning/10 p-3 text-sm text-warning">
              No SMTP transport is configured, so mail is <strong>recorded but not delivered</strong>.
              The trail below is still complete — set <code>SMTP_HOST</code> and{' '}
              <code>SMTP_USER</code> to start sending for real.
            </div>
          )}

          <Card title="Send an email">
            <div className="space-y-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="To" required>
                  <Input
                    type="email"
                    value={mailDraft.to}
                    onChange={(e) => setMailDraft({ ...mailDraft, to: e.target.value })}
                    placeholder="purchasing@vendor.example.com"
                  />
                </Field>
                <Field label="Subject" required>
                  <Input
                    value={mailDraft.subject}
                    onChange={(e) => setMailDraft({ ...mailDraft, subject: e.target.value })}
                    placeholder="Purchase Order Notification"
                  />
                </Field>
              </div>
              <Field label="Message" required>
                <Textarea
                  rows={5}
                  value={mailDraft.body}
                  onChange={(e) => setMailDraft({ ...mailDraft, body: e.target.value })}
                />
              </Field>
              <Button variant="primary" disabled={busy} onClick={sendMail}>
                {busy && <Spinner className="border-card/40 border-t-card" />}
                {mailTransport ? 'Send email' : 'Record email'}
              </Button>
            </div>
          </Card>

          <Card title={`System mails (${mails.length})`} padded={false}>
            <Table>
              <thead>
                <tr>
                  <Th>Date</Th>
                  <Th>To</Th>
                  <Th>Subject</Th>
                  <Th>Type</Th>
                  <Th>Status</Th>
                  <Th>Sent by</Th>
                </tr>
              </thead>
              <tbody>
                {mails.length === 0 && <EmptyRow colSpan={6} message="No mail for this vendor yet" />}
                {mails.map((m) => (
                  <tr key={m.id}>
                    <Td className="whitespace-nowrap text-xs text-muted-foreground">
                      {dateTime(m.sentAt ?? m.createdAt)}
                    </Td>
                    <Td className="text-xs">{m.toAddress}</Td>
                    <Td>
                      <div className="text-foreground">{m.subject}</div>
                      {m.bodyText && (
                        <div className="truncate text-xs text-muted-foreground">
                          {m.bodyText}
                        </div>
                      )}
                    </Td>
                    <Td className="text-xs">{m.template ?? 'manual'}</Td>
                    <Td>
                      <Badge
                        tone={
                          m.status === 'SENT'
                            ? 'green'
                            : m.status === 'FAILED'
                              ? 'red'
                              : m.status === 'QUEUED'
                                ? 'amber'
                                : 'gray'
                        }
                      >
                        {m.status}
                      </Badge>
                      {m.error && (
                        <div className="text-xs text-destructive">{m.error}</div>
                      )}
                    </Td>
                    <Td className="text-xs">{m.sentByName ?? '—'}</Td>
                  </tr>
                ))}
              </tbody>
            </Table>
          </Card>
        </div>
      )}

      {tab === 'Statement' && (
        <Card title="Statement of accounts" padded={false}>
          {!statement ? (
            <div className="p-4">
              <p className="text-sm text-muted-foreground">
                No statement available.
              </p>
            </div>
          ) : (
            <>
              <div className="grid gap-4 border-b border-border p-4 sm:grid-cols-4">
                {[
                  ['Opening balance', statement.summary.openingBalance],
                  ['Billed amount', statement.summary.billedAmount],
                  ['Amount paid', statement.summary.amountPaid],
                  ['Balance due', statement.summary.balanceDue],
                ].map(([label, val], i) => (
                  <div key={label as string}>
                    <div
                      className={`text-lg font-semibold ${
                        i === 3 && Number(val) > 0
                          ? 'text-warning'
                          : 'text-foreground'
                      }`}
                    >
                      {money(val as number)}
                    </div>
                    <div className="text-xs text-muted-foreground">{label}</div>
                  </div>
                ))}
              </div>

              <div className="px-4 py-2 text-xs text-muted-foreground">
                {dateTime(statement.period.from).split(',')[0]} to{' '}
                {dateTime(statement.period.to).split(',')[0]}
              </div>

              <Table>
                <thead>
                  <tr>
                    <Th>Date</Th>
                    <Th>Transaction</Th>
                    <Th>Details</Th>
                    <Th className="text-right">Amount</Th>
                    <Th className="text-right">Payments</Th>
                    <Th className="text-right">Balance</Th>
                  </tr>
                </thead>
                <tbody>
                  {statement.ledger.length === 0 && (
                    <EmptyRow colSpan={6} message="No transactions in this period" />
                  )}
                  {statement.ledger.map((r, i) => (
                    <tr key={i}>
                      <Td className="whitespace-nowrap text-xs">{dateTime(r.date).split(',')[0]}</Td>
                      <Td>{r.transaction}</Td>
                      <Td className="font-mono text-xs">{r.details}</Td>
                      <Td className="whitespace-nowrap text-right">{money(r.amount)}</Td>
                      <Td className="whitespace-nowrap text-right">{money(r.payment)}</Td>
                      <Td className="whitespace-nowrap text-right font-medium">
                        {money(r.balance)}
                      </Td>
                    </tr>
                  ))}
                </tbody>
              </Table>
            </>
          )}
        </Card>
      )}
    </>
  );
}
