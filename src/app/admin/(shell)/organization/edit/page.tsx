'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { api, errorMessage } from '@/lib/api';
import { FileUpload } from '@/components/FileUpload';
import { INDIAN_STATES, stateLabel } from '@/lib/states';
import {
  Button, Card, ErrorBox, Field, Input, Loading, PageHeader, Select, Spinner,
} from '@/components/ui';
import { useToast } from '@/lib/toast';
import { roundOffOptions, type RoundOffMode } from '@/lib/roundOff';
import { forgetPaymentOptions } from '@/lib/payments';
import { GstinField } from '@/components/GstinField';
import { PHONE_INPUT, PINCODE_INPUT, panProblem, panValue, phoneValue, pincodeValue } from '@/lib/inputs';
import { CURRENCIES, setFormatPrefs, timeZoneOffset, timeZones } from '@/lib/formatPrefs';
import { PageCrumb } from '@/lib/crumbs';
import { SaveBar } from '@/components/form/SaveBar';

type Organization = {
  id: string;
  name: string;
  legalName: string | null;
  brandName: string | null;
  gstin: string | null;
  pan: string | null;
  cin: string | null;
  email: string | null;
  phone: string | null;
  website: string | null;
  logoUrl: string | null;
  bankName: string | null;
  bankBranch: string | null;
  bankAccountNumber: string | null;
  bankIfscCode: string | null;
  upiId: string | null;
  paymentLinkUrl: string | null;
  roundOffMode: RoundOffMode;
  defaultTaxTreatment?: 'INCLUSIVE' | 'EXCLUSIVE';
  notificationSettings?: Record<string, { email: boolean; whatsapp: boolean }>;
  mail?: { enabled: boolean; fromEmail: string | null; fromName: string | null };
  addressLine1: string | null;
  addressLine2: string | null;
  city: string | null;
  state: string | null;
  stateCode: string | null;
  pincode: string | null;
  country: string;
  baseCurrency: string;
  fiscalYearStart: number;
  timezone: string;
};

const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

const str = (v: unknown) => (v === null || v === undefined ? '' : String(v));

const NOTIFY_EVENTS = [
  { key: 'invoice_sent', label: 'Invoice', hint: 'The PDF, when you Save and Send' },
  { key: 'order_confirmation', label: 'Order confirmation', hint: 'When an order is placed, with the payment link if unpaid' },
  { key: 'order_shipped', label: 'Shipped', hint: 'When an order ships, with the tracking number' },
  { key: 'payment_receipt', label: 'Payment receipt', hint: 'When a payment is recorded' },
];

export default function EditOrganizationPage() {
  const router = useRouter();
  const [org, setOrg] = useState<Organization | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const toast = useToast();

  const blank = {
    name: '', legalName: '', brandName: '',
    gstin: '', pan: '', cin: '',
    email: '', phone: '', website: '', logoUrl: '',
    bankName: '', bankBranch: '', bankAccountNumber: '', bankIfscCode: '', upiId: '', paymentLinkUrl: '',
    addressLine1: '', addressLine2: '', city: '', state: '', stateCode: '',
    pincode: '', country: 'India',
    baseCurrency: 'INR', fiscalYearStart: 4, timezone: 'Asia/Kolkata',
    roundOffMode: 'NEAREST_1' as RoundOffMode,
    defaultTaxTreatment: 'INCLUSIVE' as 'INCLUSIVE' | 'EXCLUSIVE',
  };
  const [form, setForm] = useState(blank);
  const set = (patch: Partial<typeof form>) => setForm((f) => ({ ...f, ...patch }));
  const [ifscNote, setIfscNote] = useState({ text: '', error: '' });

  async function lookupIfsc(ifsc: string) {
    if (!/^[A-Z]{4}0[A-Z0-9]{6}$/.test(ifsc)) {
      setIfscNote({ text: '', error: 'IFSC is 4 letters, a 0, then 6 letters or digits' });
      return;
    }
    setIfscNote({ text: 'Looking up the branch…', error: '' });
    try {
      const r = await api.get<{ data: { bankName: string | null; branch: string | null; city: string | null; state: string | null } }>(
        `/vendors/ifsc/${ifsc}`
      );
      setForm((f) =>
        f.bankIfscCode === ifsc
          ? { ...f, bankName: f.bankName || r.data.bankName || '', bankBranch: f.bankBranch || r.data.branch || '' }
          : f
      );
      setIfscNote({ text: [r.data.bankName, r.data.branch, r.data.city].filter(Boolean).join(' · '), error: '' });
    } catch (err) {
      setIfscNote({ text: '', error: errorMessage(err) });
    }
  }

  const [notify, setNotify] = useState<Record<string, { email: boolean; whatsapp: boolean }>>({});

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const res = await api.get<{ data: Organization }>('/organization');
      const d = res.data;
      setOrg(d);
      setForm({
        name: str(d.name), legalName: str(d.legalName), brandName: str(d.brandName),
        gstin: str(d.gstin), pan: str(d.pan), cin: str(d.cin),
        email: str(d.email), phone: str(d.phone), website: str(d.website),
        logoUrl: str(d.logoUrl),
        bankName: str(d.bankName), bankBranch: str(d.bankBranch),
        bankAccountNumber: str(d.bankAccountNumber), bankIfscCode: str(d.bankIfscCode),
        upiId: str(d.upiId),
        paymentLinkUrl: str(d.paymentLinkUrl),
        addressLine1: str(d.addressLine1), addressLine2: str(d.addressLine2),
        city: str(d.city), state: str(d.state), stateCode: str(d.stateCode),
        pincode: str(d.pincode), country: str(d.country) || 'India',
        baseCurrency: d.baseCurrency || 'INR',
        fiscalYearStart: d.fiscalYearStart ?? 4,
        timezone: d.timezone || 'Asia/Kolkata',
        roundOffMode: d.roundOffMode ?? 'NEAREST_1',
        defaultTaxTreatment: d.defaultTaxTreatment ?? 'INCLUSIVE',
      });
      setNotify(d.notificationSettings ?? {});
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const t = setTimeout(load, 0);
    return () => clearTimeout(t);
  }, [load]);

  async function save() {
    setSaving(true);
    setError('');
    try {
      const send = (v: string) => (v.trim() ? v.trim() : undefined);
      const clearable = (v: string) => (v.trim() ? v.trim() : null);

      await api.patch('/organization', {
        name: send(form.name),
        legalName: send(form.legalName),
        brandName: send(form.brandName),
        gstin: send(form.gstin),
        pan: send(form.pan),
        cin: send(form.cin),
        email: send(form.email),
        phone: send(form.phone),
        website: send(form.website),
        logoUrl: send(form.logoUrl),
        bankName: clearable(form.bankName),
        bankBranch: clearable(form.bankBranch),
        bankAccountNumber: clearable(form.bankAccountNumber),
        bankIfscCode: clearable(form.bankIfscCode),
        upiId: clearable(form.upiId),
        paymentLinkUrl: clearable(form.paymentLinkUrl),
        addressLine1: send(form.addressLine1),
        addressLine2: send(form.addressLine2),
        city: send(form.city),
        state: send(form.state),
        stateCode: send(form.stateCode),
        pincode: send(form.pincode),
        country: send(form.country),
        baseCurrency: send(form.baseCurrency),
        fiscalYearStart: form.fiscalYearStart,
        timezone: send(form.timezone),
        roundOffMode: form.roundOffMode,
        defaultTaxTreatment: form.defaultTaxTreatment,
        notificationSettings: Object.fromEntries(
          NOTIFY_EVENTS.map((e) => [e.key, { email: notify[e.key]?.email ?? true }])
        ),
      });
      forgetPaymentOptions();
      setFormatPrefs({ baseCurrency: form.baseCurrency, timezone: form.timezone });
      toast.success('Saved');
      router.push('/admin/organization');
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setSaving(false);
    }
  }

  if (loading) return <Loading />;
  if (!org) return <ErrorBox message={error || 'Organization not found'} onRetry={load} />;

  function pickState(code: string) {
    set({ stateCode: code, state: code ? stateLabel(code).replace(/^\[\d{2}\]\s*/, '') : '' });
  }

  return (
    <>
      <PageCrumb label="Edit" />

      <PageHeader
        title="Edit organization"
        subtitle="Who you are on every document you send — invoices, credit notes, e-way bills"
      />

      {error && <div className="mb-4"><ErrorBox message={error} /></div>}

      <div className="grid gap-5 pb-8 lg:grid-cols-3">
        <div className="space-y-5 lg:col-span-2 min-w-0">
          <Card title="Identity">
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Display name" required hint="What appears in the app">
                <Input value={form.name} onChange={(e) => set({ name: e.target.value })} />
              </Field>
              <Field
                label="Legal name"
                hint="As registered — this is what a tax invoice must print"
              >
                <Input value={form.legalName} onChange={(e) => set({ legalName: e.target.value })} />
              </Field>
              <Field label="Brand name" hint="What is over the shop door">
                <Input value={form.brandName} onChange={(e) => set({ brandName: e.target.value })} />
              </Field>
              <Field label="Website">
                <Input value={form.website} onChange={(e) => set({ website: e.target.value })} />
              </Field>
              <Field label="Email">
                <Input
                  type="email"
                  value={form.email}
                  onChange={(e) => set({ email: e.target.value })}
                />
              </Field>
              <Field label="Phone">
                <Input {...PHONE_INPUT} value={form.phone} onChange={(e) => set({ phone: phoneValue(e.target.value) })} />
              </Field>
            </div>
          </Card>

          <Card title="Statutory">
            <div className="grid gap-4 sm:grid-cols-2">
              <GstinField
                value={form.gstin}
                placeholder="09AALCP7274M1ZT"
                hint="Drives the GST return and every e-way bill"
                onChange={(gstin, info) =>
                  set({
                    gstin,
                    ...(info.complete && !form.pan ? { pan: info.pan } : {}),
                  })
                }
              />
              <Field label="PAN" hint={panProblem(form.pan) ? <span className="text-destructive">{panProblem(form.pan)}</span> : 'Filled in from the GSTIN when it is complete'}>
                <Input
                  value={form.pan}
                  onChange={(e) => set({ pan: panValue(e.target.value) })}
                  maxLength={10}
                  placeholder="ABCDE1234F"
                  className="font-mono uppercase"
                />
              </Field>
              <Field label="CIN" hint="Company identification number">
                <Input
                  value={form.cin}
                  onChange={(e) => set({ cin: e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 21) })}
                  maxLength={21}
                  className="font-mono"
                />
              </Field>
            </div>
          </Card>

          <Card title="Registered address">
            <p className="mb-3 text-xs text-muted-foreground">
              The state here is your <strong>source of supply</strong> — it decides CGST+SGST versus
              IGST on every invoice you raise.
            </p>
            <div className="space-y-4">
              <Field label="Address line 1">
                <Input
                  value={form.addressLine1}
                  onChange={(e) => set({ addressLine1: e.target.value })}
                />
              </Field>
              <Field label="Address line 2">
                <Input
                  value={form.addressLine2}
                  onChange={(e) => set({ addressLine2: e.target.value })}
                />
              </Field>
              <div className="grid gap-4 sm:grid-cols-4">
                <Field label="City">
                  <Input value={form.city} onChange={(e) => set({ city: e.target.value })} />
                </Field>
                <Field label="State" hint="Sets the GST code">
                  <Select
                    value={form.stateCode}
                    onChange={(e) => pickState(e.target.value)}
                    className="w-full"
                  >
                    <option value="">Select</option>
                    {INDIAN_STATES.map((s) => (
                      <option key={s.code} value={s.code}>{stateLabel(s.code)}</option>
                    ))}
                  </Select>
                </Field>
                <Field label="Pincode">
                  <Input
                    {...PINCODE_INPUT}
                    value={form.pincode}
                    onChange={(e) => set({ pincode: pincodeValue(e.target.value) })}
                  />
                </Field>
                <Field label="Country">
                  <Input value={form.country} onChange={(e) => set({ country: e.target.value })} />
                </Field>
              </div>
            </div>
          </Card>

          <Card title="Bank details">
            <p className="mb-3 rounded-md border border-border bg-muted/60 px-3 py-2 text-xs text-muted-foreground">
              Printed on every invoice so a customer knows where to pay. Each invoice keeps its own
              copy of these, frozen when it was raised — changing them here affects
              <strong> new invoices only</strong>, never one already sent.
            </p>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Bank name">
                <Input value={form.bankName} onChange={(e) => set({ bankName: e.target.value })} />
              </Field>
              <Field label="Branch">
                <Input
                  value={form.bankBranch}
                  onChange={(e) => set({ bankBranch: e.target.value })}
                />
              </Field>
              <Field label="Account number">
                <Input
                  inputMode="numeric"
                  value={form.bankAccountNumber}
                  onChange={(e) => set({ bankAccountNumber: e.target.value.replace(/\D/g, '').slice(0, 18) })}
                  maxLength={18}
                  className="font-mono"
                />
              </Field>
              <Field
                label="IFSC"
                hint={
                  ifscNote.error ? (
                    <span className="text-destructive">{ifscNote.error}</span>
                  ) : (
                    ifscNote.text || 'Fills the bank name and branch, e.g. KKBK0005203'
                  )
                }
              >
                <Input
                  value={form.bankIfscCode}
                  onChange={(e) => {
                    const ifsc = e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 11);
                    set({ bankIfscCode: ifsc });
                    if (ifsc.length === 11) lookupIfsc(ifsc);
                    else setIfscNote({ text: '', error: '' });
                  }}
                  maxLength={11}
                  placeholder="KKBK0005203"
                  className="font-mono uppercase"
                />
              </Field>
              <Field label="UPI ID" hint="Orders and invoices show a QR for the exact amount due">
                <Input
                  value={form.upiId}
                  onChange={(e) => set({ upiId: e.target.value })}
                  placeholder="yourname@okaxis"
                  className="font-mono"
                />
              </Field>
              <Field
                label="Default payment link"
                hint="e.g. your razorpay.me page - shown when an order has no link of its own"
              >
                <Input
                  value={form.paymentLinkUrl}
                  onChange={(e) => set({ paymentLinkUrl: e.target.value })}
                  placeholder="https://razorpay.me/@yourbusiness"
                />
              </Field>
            </div>
          </Card>
        </div>

        <div className="space-y-5">
          <Card title="Logo">
            <div className="flex items-start gap-3">
              <div className="flex h-24 w-24 shrink-0 items-center justify-center overflow-hidden rounded-md border border-border bg-muted/60">
                {form.logoUrl ? (
                  <img
                    src={form.logoUrl}
                    alt={form.name || 'Logo'}
                    className="h-full w-full object-contain"
                    onError={(e) => {
                      e.currentTarget.style.display = 'none';
                    }}
                  />
                ) : (
                  <span className="text-[10px] text-muted-foreground">No logo</span>
                )}
              </div>
              <div className="min-w-0 flex-1 space-y-2">
                <div className="flex gap-2">
                  <FileUpload
                    label={form.logoUrl ? 'Replace' : 'Upload'}
                    accept="image/*"
                    onUploaded={(files) => {
                      if (files[0]) set({ logoUrl: files[0].url });
                    }}
                  />
                  {form.logoUrl && (
                    <Button
                      type="button"
                      size="sm"
                      variant="danger"
                      onClick={() => set({ logoUrl: '' })}
                    >
                      Remove
                    </Button>
                  )}
                </div>
                <Input
                  value={form.logoUrl}
                  onChange={(e) => set({ logoUrl: e.target.value })}
                  placeholder="…or paste a URL"
                  className="text-xs"
                />
              </div>
            </div>
            <p className="mt-3 text-xs text-muted-foreground">
              Appears on printed invoices and delivery challans. A wide transparent PNG prints best.
            </p>
          </Card>

          <Card title="Accounting">
            <div className="space-y-4">
              <Field
                label="Currency"
                hint="Every amount in the app, on PDFs and in emails is shown in this"
              >
                <Select
                  value={form.baseCurrency}
                  onChange={(e) => set({ baseCurrency: e.target.value })}
                  className="w-full"
                >
                  {!CURRENCIES[form.baseCurrency] && (
                    <option value={form.baseCurrency}>{form.baseCurrency}</option>
                  )}
                  {Object.entries(CURRENCIES).map(([code, c]) => (
                    <option key={code} value={code}>
                      {code} — {c.name}
                    </option>
                  ))}
                </Select>
              </Field>
              <Field
                label="Financial year starts"
                hint="April in India — this is what {FY} on a document number follows"
              >
                <Select
                  value={String(form.fiscalYearStart)}
                  onChange={(e) => set({ fiscalYearStart: Number(e.target.value) })}
                  className="w-full"
                >
                  {MONTHS.map((m, i) => (
                    <option key={m} value={i + 1}>{m}</option>
                  ))}
                </Select>
              </Field>
              <Field
                label="Timezone"
                hint="Dates and times across the app, on PDFs and in emails follow this"
              >
                <Select
                  value={form.timezone}
                  onChange={(e) => set({ timezone: e.target.value })}
                  className="w-full"
                >
                  {(timeZones().includes(form.timezone) ? timeZones() : [form.timezone, ...timeZones()]).map((tz) => (
                    <option key={tz} value={tz}>
                      {tz.replaceAll('_', ' ')} {timeZoneOffset(tz) && `(${timeZoneOffset(tz)})`}
                    </option>
                  ))}
                </Select>
              </Field>
              <Field
                label="Round off totals"
                hint={roundOffOptions().find((o) => o.value === form.roundOffMode)?.hint}
              >
                <Select
                  value={form.roundOffMode}
                  onChange={(e) => set({ roundOffMode: e.target.value as RoundOffMode })}
                  className="w-full"
                >
                  {roundOffOptions().map((o) => (
                    <option key={o.value} value={o.value}>{o.label}</option>
                  ))}
                </Select>
              </Field>
              <p className="text-xs text-muted-foreground">
                Applies to orders, invoices, bills, purchase orders and credits when they are saved.
                Any single document can still be rounded by hand.
              </p>
              <Field
                label="Prices you enter"
                hint="The starting choice on new sales orders, invoices and challans. Each document can still be switched."
              >
                <Select
                  value={form.defaultTaxTreatment}
                  onChange={(e) => set({ defaultTaxTreatment: e.target.value as 'INCLUSIVE' | 'EXCLUSIVE' })}
                  className="w-full"
                >
                  <option value="INCLUSIVE">Include GST (MRP-style prices)</option>
                  <option value="EXCLUSIVE">Exclude GST (GST added on top)</option>
                </Select>
              </Field>
            </div>
          </Card>

          <Card title="Customer notifications">
            <p
              className={`mb-3 rounded-md px-3 py-2 text-xs ${
                org.mail?.enabled
                  ? 'bg-success/10 text-success'
                  : 'bg-warning/10 text-warning'
              }`}
            >
              {org.mail?.enabled ? (
                <>
                  Sending through Brevo from{' '}
                  <strong>
                    {org.mail.fromName ? `${org.mail.fromName} <${org.mail.fromEmail}>` : org.mail.fromEmail}
                  </strong>
                  .
                </>
              ) : (
                <>
                  Email is off until a Brevo key and a sender address are added to the server
                  settings. Nothing is sent until then.
                </>
              )}
            </p>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-xs text-muted-foreground">
                    <th className="pb-2 text-left font-medium">Message</th>
                    <th className="px-3 pb-2 font-medium">Email</th>
                    <th className="px-3 pb-2 font-medium">WhatsApp</th>
                  </tr>
                </thead>
                <tbody>
                  {NOTIFY_EVENTS.map((e) => (
                    <tr key={e.key} className="border-t border-border">
                      <td className="py-2 pr-2">
                        <div className="font-medium text-foreground">{e.label}</div>
                        <div className="text-xs text-muted-foreground">{e.hint}</div>
                      </td>
                      <td className="px-3 py-2 text-center">
                        <input
                          type="checkbox"
                          checked={notify[e.key]?.email ?? true}
                          onChange={(ev) =>
                            setNotify((n) => ({
                              ...n,
                              [e.key]: { email: ev.target.checked, whatsapp: n[e.key]?.whatsapp ?? false },
                            }))
                          }
                          aria-label={`Email: ${e.label}`}
                        />
                      </td>
                      <td className="px-3 py-2 text-center">
                        <input
                          type="checkbox"
                          checked={false}
                          disabled
                          aria-label={`WhatsApp: ${e.label}`}
                          title="Turns on once AiSensy is connected"
                        />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="mt-2 text-xs text-muted-foreground">
              A message only goes out when the customer has an email address. WhatsApp switches turn
              on once AiSensy is connected.
            </p>
          </Card>

          <Card title="Where these appear">
            <ul className="space-y-2 text-xs text-muted-foreground">
              <li>
                <strong className="text-foreground">GSTIN &amp; state</strong> —
                the GST return, and the CGST/SGST-versus-IGST split on every invoice
              </li>
              <li>
                <strong className="text-foreground">Legal name &amp; address</strong>{' '}
                — the consignor on every e-way bill
              </li>
              <li>
                <strong className="text-foreground">Bank details</strong> — the
                footer of each invoice, snapshotted when it is raised
              </li>
              <li>
                <strong className="text-foreground">Logo</strong> — printed
                documents
              </li>
            </ul>
          </Card>
        </div>
      </div>
      <SaveBar>
        <Link href="/admin/organization">
          <Button type="button">Cancel</Button>
        </Link>
        <Button variant="primary" onClick={save} disabled={saving}>
          {saving && <Spinner className="border-card/40 border-t-card" />}
          Save changes
        </Button>
      </SaveBar>
    </>
  );
}
