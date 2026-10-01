'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { api, errorMessage } from '@/lib/api';
import { useSaveNav, SaveStalled } from '@/lib/useSaveNav';
import { INDIAN_STATES, stateLabel, stateName } from '@/lib/states';
import { cleanGstin, gstinInfo } from '@/lib/gstin';
import { PHONE_INPUT, PINCODE_INPUT, panProblem, panValue, phoneValue, pincodeValue } from '@/lib/inputs';
import { PaymentTermSelect, useDefaultPaymentTerm } from './PaymentTermSelect';
import {
  Button, Card, Field, Input, PageHeader, Select, Spinner, Textarea,
} from './ui';
import { SaveBar } from './form/SaveBar';
import { PageCrumb } from '@/lib/crumbs';

export type CustomerAddress = {
  id?: string;
  type: string;
  attention: string;
  line1: string;
  line2: string;
  city: string;
  state: string;
  stateCode: string;
  pincode: string;
  country: string;
  phone: string;
};

export type ContactPerson = {
  salutation: string;
  firstName: string;
  lastName: string;
  email: string;
  workPhone: string;
  mobile: string;
  designation: string;
};

export type ExistingCustomer = {
  id: string;
  salutation: string | null;
  firstName: string | null;
  lastName: string | null;
  displayName: string | null;
  email: string | null;
  phone: string | null;
  workPhone: string | null;
  customerType: 'D2C' | 'B2B';
  b2bAccountId: string | null;
  acceptsMarketing: boolean;
  notes: string | null;
  status: string;
  b2bAccount: {
    id: string;
    companyName: string;
    gstin: string | null;
    pan: string | null;
    gstTreatment: string;
    placeOfSupplyCode: string | null;
    taxPreference: string;
    paymentTerms: string;
    legalName: string | null;
    tradeName: string | null;
    contacts: ContactPerson[];
  } | null;
  addresses: (CustomerAddress & { id: string })[];
};

const GST_TREATMENTS = [
  ['REGISTERED_REGULAR', 'Registered Business — Regular'],
  ['REGISTERED_COMPOSITION', 'Registered Business — Composition'],
  ['UNREGISTERED', 'Unregistered Business'],
  ['CONSUMER', 'Consumer'],
  ['OVERSEAS', 'Overseas'],
  ['SEZ', 'SEZ'],
] as const;

const TABS = ['Other Details', 'Address', 'Contact Persons', 'Remarks'] as const;
type Tab = (typeof TABS)[number];

const blankAddress = (type: string): CustomerAddress => ({
  type, attention: '', line1: '', line2: '', city: '', state: '',
  stateCode: '', pincode: '', country: 'India', phone: '',
});

const text = (v: unknown) => (v === null || v === undefined ? '' : String(v));

const addressDraft = (a: Partial<Record<keyof CustomerAddress, unknown>> | undefined, type: string): CustomerAddress =>
  a
    ? {
        id: a.id ? String(a.id) : undefined,
        type,
        attention: text(a.attention),
        line1: text(a.line1),
        line2: text(a.line2),
        city: text(a.city),
        state: text(a.state),
        stateCode: text(a.stateCode),
        pincode: text(a.pincode),
        country: text(a.country) || 'India',
        phone: text(a.phone),
      }
    : blankAddress(type);

const contactDraft = (c: Partial<Record<keyof ContactPerson, unknown>>): ContactPerson => ({
  salutation: text(c.salutation),
  firstName: text(c.firstName),
  lastName: text(c.lastName),
  email: text(c.email),
  workPhone: text(c.workPhone),
  mobile: text(c.mobile),
  designation: text(c.designation),
});

const contactPayload = (c: ContactPerson) =>
  Object.fromEntries(
    Object.entries(c)
      .map(([k, v]) => [k, v.trim()])
      .filter(([, v]) => v !== '')
  );

const blankContact = (): ContactPerson => ({
  salutation: '', firstName: '', lastName: '', email: '',
  workPhone: '', mobile: '', designation: '',
});

export function CustomerForm({ existing }: { existing?: ExistingCustomer }) {
  const router = useRouter();
  const isEdit = !!existing;

  const [tab, setTab] = useState<Tab>('Other Details');
  const [error, setError] = useState('');
  const { saving, stalledHref, begin: beginSave, done: doneSave, fail: failSave } =
    useSaveNav();

  const [form, setForm] = useState({
    customerType: existing?.customerType ?? 'D2C',
    salutation: existing?.salutation ?? '',
    firstName: existing?.firstName ?? '',
    lastName: existing?.lastName ?? '',
    displayName: existing?.displayName ?? '',
    email: existing?.email ?? '',
    phone: existing?.phone ?? '',
    workPhone: existing?.workPhone ?? '',
    acceptsMarketing: existing?.acceptsMarketing ?? false,
    notes: existing?.notes ?? '',
    status: existing?.status ?? 'ACTIVE',

    companyName: existing?.b2bAccount?.companyName ?? '',
    legalName: existing?.b2bAccount?.legalName ?? '',
    tradeName: existing?.b2bAccount?.tradeName ?? '',
    gstin: existing?.b2bAccount?.gstin ?? '',
    pan: existing?.b2bAccount?.pan ?? '',
    gstTreatment: existing?.b2bAccount?.gstTreatment ?? 'REGISTERED_REGULAR',
    placeOfSupplyCode: existing?.b2bAccount?.placeOfSupplyCode ?? '',
    taxPreference: existing?.b2bAccount?.taxPreference ?? 'TAXABLE',
    paymentTerms: existing?.b2bAccount?.paymentTerms ?? 'DUE_ON_RECEIPT',
  });
  const set = (patch: Partial<typeof form>) => setForm((f) => ({ ...f, ...patch }));
  useDefaultPaymentTerm(
    (code) => setForm((f) => (f.paymentTerms === 'DUE_ON_RECEIPT' ? { ...f, paymentTerms: code } : f)),
    !existing?.b2bAccount
  );

  const isBusiness = form.customerType === 'B2B';

  const gst = gstinInfo(form.gstin);
  const placeOfSupply = form.placeOfSupplyCode || gst.stateCode;

  const [billing, setBilling] = useState<CustomerAddress>(
    () =>
      addressDraft(existing?.addresses.find((a) => a.type === 'BILLING'), 'BILLING')
  );
  const [shipping, setShipping] = useState<CustomerAddress>(
    () =>
      addressDraft(existing?.addresses.find((a) => a.type === 'SHIPPING'), 'SHIPPING')
  );
  const [contacts, setContacts] = useState<ContactPerson[]>(
    () => (existing?.b2bAccount?.contacts?.length ? existing.b2bAccount.contacts.map(contactDraft) : [blankContact()])
  );

  const setAddr = (which: 'billing' | 'shipping', patch: Partial<CustomerAddress>) =>
    (which === 'billing' ? setBilling : setShipping)((a) => ({ ...a, ...patch }));

  const addressPayload = (a: CustomerAddress) =>
    a.line1.trim() && a.city.trim() && a.state.trim() && a.pincode.trim()
      ? {
          type: a.type,
          attention: a.attention.trim() || undefined,
          line1: a.line1.trim(),
          line2: a.line2.trim() || undefined,
          city: a.city.trim(),
          state: a.state.trim(),
          stateCode: a.stateCode || undefined,
          pincode: a.pincode.trim(),
          country: a.country.trim() || 'India',
          phone: a.phone.trim() || undefined,
        }
      : null;

  async function submit() {
    setError('');
    if (!form.firstName.trim()) return setError('Enter a first name');
    if (!form.email.trim() && !form.phone.trim()) {
      return setError('A customer needs at least an email or a phone number');
    }

    beginSave();
    try {
      let b2bAccountId = existing?.b2bAccountId ?? null;
      if (isBusiness) {
        const account = {
          companyName:
            form.companyName.trim() ||
            [form.firstName, form.lastName].filter(Boolean).join(' ').trim() ||
            'Unnamed company',
          legalName: form.legalName.trim() || undefined,
          tradeName: form.tradeName.trim() || undefined,
          gstin: form.gstin.trim() || undefined,
          pan: form.pan.trim() || undefined,
          gstTreatment: form.gstTreatment,
          placeOfSupplyCode: placeOfSupply || null,
          taxPreference: form.taxPreference,
          paymentTerms: form.paymentTerms,
          contacts: contacts.filter((c) => c.firstName.trim() || c.email.trim()).map(contactPayload),
        };
        b2bAccountId = b2bAccountId
          ? (await api.patch<{ data: { id: string } }>(`/b2b-accounts/${b2bAccountId}`, account))
              .data.id
          : (await api.post<{ data: { id: string } }>('/b2b-accounts', account)).data.id;
      }

      const blank = isEdit ? null : undefined;
      const body = {
        salutation: form.salutation.trim() || blank,
        firstName: form.firstName.trim(),
        lastName: form.lastName.trim() || blank,
        displayName:
          form.displayName.trim() ||
          (isBusiness
            ? form.companyName.trim()
            : [form.firstName, form.lastName].filter(Boolean).join(' ').trim()),
        email: form.email.trim() || undefined,
        phone: form.phone.trim() || undefined,
        workPhone: form.workPhone.trim() || blank,
        customerType: form.customerType,
        b2bAccountId: isBusiness ? b2bAccountId : blank,
        acceptsMarketing: form.acceptsMarketing,
        notes: form.notes.trim() || blank,
        ...(isEdit && { status: form.status }),
      };

      const customerId = isEdit
        ? existing.id
        : (await api.post<{ data: { id: string } }>('/customers', body)).data.id;
      if (isEdit) await api.patch(`/customers/${existing.id}`, body);

      for (const draft of [billing, shipping]) {
        const payload = addressPayload(draft);
        if (!payload) continue;
        const known = existing?.addresses.find((a) => a.type === draft.type);
        if (known) await api.patch(`/customers/${customerId}/addresses/${known.id}`, payload);
        else await api.post(`/customers/${customerId}/addresses`, payload);
      }

      doneSave(`/customers/${customerId}`);
    } catch (err) {
      setError(errorMessage(err));
      failSave();
    }
  }

  const tabClass = (t: Tab) =>
    `-mb-px shrink-0 whitespace-nowrap border-b-2 px-4 py-2.5 text-sm transition-colors ${
      tab === t
        ? 'border-border font-medium text-foreground'
        : 'border-transparent text-muted-foreground hover:text-foreground'
    }`;

  const addressBlock = (which: 'billing' | 'shipping', a: CustomerAddress) => (
    <div className="space-y-3">
      <Field label="Attention">
        <Input value={a.attention} onChange={(e) => setAddr(which, { attention: e.target.value })} />
      </Field>
      <Field label="Country / Region">
        <Input value={a.country} onChange={(e) => setAddr(which, { country: e.target.value })} />
      </Field>
      <Field label="Address">
        <Textarea
          rows={2}
          value={a.line1}
          onChange={(e) => setAddr(which, { line1: e.target.value })}
        />
      </Field>
      <Textarea
        rows={2}
        value={a.line2}
        onChange={(e) => setAddr(which, { line2: e.target.value })}
        placeholder="Street 2"
      />
      <Field label="City">
        <Input value={a.city} onChange={(e) => setAddr(which, { city: e.target.value })} />
      </Field>
      <Field label="State">
        <Select
          value={a.stateCode}
          onChange={(e) =>
            setAddr(which, { stateCode: e.target.value, state: stateName(e.target.value) })
          }
          className="w-full"
        >
          <option value="">Select a state…</option>
          {INDIAN_STATES.map((s) => (
            <option key={s.code} value={s.code}>{stateLabel(s.code)}</option>
          ))}
        </Select>
      </Field>
      <Field label="Pin Code">
        <Input {...PINCODE_INPUT} value={a.pincode} onChange={(e) => setAddr(which, { pincode: pincodeValue(e.target.value) })} />
      </Field>
      <Field label="Phone">
        <Input {...PHONE_INPUT} value={a.phone} onChange={(e) => setAddr(which, { phone: phoneValue(e.target.value) })} />
      </Field>
    </div>
  );

  return (
    <>
      <PageCrumb label={isEdit ? existing.displayName || 'Edit' : 'New'} />

      <PageHeader title={isEdit ? 'Edit Customer' : 'New Customer'} />

      <SaveStalled href={stalledHref} />

      {error && (
        <div className="mb-4 rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {error}
        </div>
      )}

      <div className="space-y-5">
        <Card>
          <div className="mb-4 flex flex-wrap items-center gap-4">
            <span className="text-xs font-medium text-muted-foreground">
              Customer Type
            </span>
            {(['B2B', 'D2C'] as const).map((t) => (
              <label key={t} className="flex items-center gap-1.5 text-sm">
                <input
                  type="radio"
                  checked={form.customerType === t}
                  onChange={() => set({ customerType: t })}
                />
                <span className="text-foreground">
                  {t === 'B2B' ? 'Business' : 'Individual'}
                </span>
              </label>
            ))}
          </div>

          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <Field label="Primary Contact" className="sm:col-span-2">
              <div className="grid gap-2 sm:grid-cols-[10rem_minmax(0,1fr)_minmax(0,1fr)]">
                <Select
                  value={form.salutation}
                  onChange={(e) => set({ salutation: e.target.value })}
                  className="w-full"
                >
                  <option value="">Salutation</option>
                  {['Mr.', 'Mrs.', 'Ms.', 'Dr.'].map((s) => (
                    <option key={s} value={s}>{s}</option>
                  ))}
                </Select>
                <Input
                  value={form.firstName}
                  onChange={(e) => set({ firstName: e.target.value })}
                  placeholder="First Name"
                  className="min-w-0"
                />
                <Input
                  value={form.lastName}
                  onChange={(e) => set({ lastName: e.target.value })}
                  placeholder="Last Name"
                  className="min-w-0"
                />
              </div>
            </Field>

            {isBusiness && (
              <Field label="Company Name">
                <Input
                  value={form.companyName}
                  onChange={(e) => set({ companyName: e.target.value })}
                />
              </Field>
            )}

            <Field
              label="Display Name"
              hint="How the customer appears on every document"
            >
              <Input
                value={form.displayName}
                onChange={(e) => set({ displayName: e.target.value })}
                placeholder={
                  isBusiness
                    ? form.companyName || 'Company name'
                    : [form.firstName, form.lastName].filter(Boolean).join(' ') || 'Full name'
                }
              />
            </Field>

            <Field label="Email Address">
              <Input
                type="email"
                value={form.email}
                onChange={(e) => set({ email: e.target.value })}
              />
            </Field>

            <Field label="Work Phone">
              <Input {...PHONE_INPUT} value={form.workPhone} onChange={(e) => set({ workPhone: phoneValue(e.target.value) })} />
            </Field>

            <Field label="Mobile" hint="Identity for guest checkout">
              <Input {...PHONE_INPUT} value={form.phone} onChange={(e) => set({ phone: phoneValue(e.target.value) })} placeholder="98765 43210" />
            </Field>

            {isEdit && (
              <Field label="Status">
                <Select
                  value={form.status}
                  onChange={(e) => set({ status: e.target.value })}
                  className="w-full"
                >
                  <option value="ACTIVE">Active</option>
                  <option value="INACTIVE">Inactive</option>
                  <option value="BLOCKED">Blocked</option>
                </Select>
              </Field>
            )}
          </div>

          <label className="mt-4 flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={form.acceptsMarketing}
              onChange={(e) => set({ acceptsMarketing: e.target.checked })}
            />
            <span className="text-foreground">
              Accepts marketing email and SMS
            </span>
          </label>
        </Card>

        <Card padded={false}>
          <div className="flex gap-1 overflow-x-auto border-b border-border px-4">
            {TABS.map((t) => (
              <button key={t} type="button" className={tabClass(t)} onClick={() => setTab(t)}>
                {t}
              </button>
            ))}
          </div>

          <div className="p-4">
            {tab === 'Other Details' && (
              <div className="grid max-w-3xl gap-4 sm:grid-cols-2">
                {isBusiness ? (
                  <>
                    <Field label="GST Treatment">
                      <Select
                        value={form.gstTreatment}
                        onChange={(e) => set({ gstTreatment: e.target.value })}
                        className="w-full"
                      >
                        {GST_TREATMENTS.map(([v, l]) => (
                          <option key={v} value={v}>{l}</option>
                        ))}
                      </Select>
                    </Field>
                    <Field
                      label="GSTIN"
                      hint={
                        gst.error ? (
                          <span className="text-destructive">{gst.error}</span>
                        ) : gst.warning ? (
                          <span className="text-warning">{gst.warning}</span>
                        ) : (
                          gst.summary ?? '15 characters — the place of supply and PAN fill in from it'
                        )
                      }
                    >
                      <Input
                        value={form.gstin}
                        onChange={(e) => {
                          const gstin = cleanGstin(e.target.value);
                          const info = gstinInfo(gstin);
                          set({
                            gstin,
                            ...(info.complete && !form.pan.trim() ? { pan: info.pan } : {}),
                          });
                        }}
                        maxLength={15}
                        placeholder="09AALCP7274M1ZT"
                        className="font-mono"
                      />
                    </Field>
                    <Field
                      label="Place of Supply"
                      hint="Against our state this decides CGST+SGST versus IGST — needed before a GST invoice can be raised"
                    >
                      <Select
                        value={placeOfSupply}
                        onChange={(e) => set({ placeOfSupplyCode: e.target.value })}
                        className="w-full"
                      >
                        <option value="">Select a state…</option>
                        {INDIAN_STATES.map((s) => (
                          <option key={s.code} value={s.code}>{stateLabel(s.code)}</option>
                        ))}
                      </Select>
                    </Field>
                    <Field label="PAN" hint={panProblem(form.pan) ? <span className="text-destructive">{panProblem(form.pan)}</span> : '10 characters, e.g. ABCDE1234F'}>
                      <Input
                        value={form.pan}
                        onChange={(e) => set({ pan: panValue(e.target.value) })}
                        maxLength={10}
                        placeholder="ABCDE1234F"
                        className="font-mono uppercase"
                      />
                    </Field>
                    <div>
                      <span className="mb-1 block text-xs font-medium text-muted-foreground">
                        Tax Preference
                      </span>
                      <div className="flex gap-4 pt-1.5">
                        {(['TAXABLE', 'TAX_EXEMPT'] as const).map((p) => (
                          <label key={p} className="flex items-center gap-1.5 text-sm">
                            <input
                              type="radio"
                              checked={form.taxPreference === p}
                              onChange={() => set({ taxPreference: p })}
                            />
                            <span className="text-foreground">
                              {p === 'TAXABLE' ? 'Taxable' : 'Tax Exempt'}
                            </span>
                          </label>
                        ))}
                      </div>
                    </div>
                    <Field label="Payment Terms">
                      <PaymentTermSelect
                        value={form.paymentTerms}
                        onChange={(paymentTerms) => set({ paymentTerms })}
                      />
                    </Field>
                    <Field
                      label="Business Legal Name"
                      hint="Exactly as it appears on the GST registration"
                    >
                      <Input
                        value={form.legalName}
                        onChange={(e) => set({ legalName: e.target.value })}
                        placeholder="GLOW SALON PRIVATE LIMITED"
                      />
                    </Field>
                    <Field label="Business Trade Name" hint="What they trade as, if different">
                      <Input
                        value={form.tradeName}
                        onChange={(e) => set({ tradeName: e.target.value })}
                        placeholder="Glow Salon"
                      />
                    </Field>
                  </>
                ) : (
                  <p className="text-sm text-muted-foreground sm:col-span-2">
                    An individual is billed as a consumer — no GSTIN, no place of supply, and
                    no company name. Switch Customer Type to <strong>Business</strong> if this
                    buyer needs a tax invoice in a company name.
                  </p>
                )}
              </div>
            )}

            {tab === 'Address' && (
              <div className="grid gap-8 lg:grid-cols-2">
                <div>
                  <h3 className="mb-3 text-sm font-semibold">Billing Address</h3>
                  {addressBlock('billing', billing)}
                </div>
                <div>
                  <div className="mb-3 flex items-center gap-3">
                    <h3 className="text-sm font-semibold">Shipping Address</h3>
                    <button
                      type="button"
                      onClick={() => setShipping({ ...billing, id: shipping.id, type: 'SHIPPING' })}
                      className="text-xs text-gold-ink hover:underline"
                    >
                      ↓ Copy billing address
                    </button>
                  </div>
                  {addressBlock('shipping', shipping)}
                </div>
              </div>
            )}

            {tab === 'Contact Persons' && (
              <>
                {!isBusiness ? (
                  <p className="text-sm text-muted-foreground">
                    Contact persons belong to a company. Switch Customer Type to Business to
                    add them.
                  </p>
                ) : (
                  <div className="space-y-4">
                    {contacts.map((c, i) => (
                      <div
                        key={i}
                        className="grid gap-3 rounded-md border border-border p-3 sm:grid-cols-3"
                      >
                        <Input
                          value={c.firstName}
                          onChange={(e) =>
                            setContacts(contacts.map((x, idx) => (idx === i ? { ...x, firstName: e.target.value } : x)))
                          }
                          placeholder="First name"
                        />
                        <Input
                          value={c.lastName}
                          onChange={(e) =>
                            setContacts(contacts.map((x, idx) => (idx === i ? { ...x, lastName: e.target.value } : x)))
                          }
                          placeholder="Last name"
                        />
                        <Input
                          value={c.designation}
                          onChange={(e) =>
                            setContacts(contacts.map((x, idx) => (idx === i ? { ...x, designation: e.target.value } : x)))
                          }
                          placeholder="Designation"
                        />
                        <Input
                          value={c.email}
                          onChange={(e) =>
                            setContacts(contacts.map((x, idx) => (idx === i ? { ...x, email: e.target.value } : x)))
                          }
                          placeholder="Email"
                        />
                        <Input
                          {...PHONE_INPUT}
                          value={c.workPhone}
                          onChange={(e) =>
                            setContacts(contacts.map((x, idx) => (idx === i ? { ...x, workPhone: phoneValue(e.target.value) } : x)))
                          }
                          placeholder="Work phone"
                        />
                        <div className="flex items-center gap-2">
                          <Input
                            {...PHONE_INPUT}
                            value={c.mobile}
                            onChange={(e) =>
                              setContacts(contacts.map((x, idx) => (idx === i ? { ...x, mobile: phoneValue(e.target.value) } : x)))
                            }
                            placeholder="Mobile"
                          />
                          {contacts.length > 1 && (
                            <button
                              type="button"
                              onClick={() => setContacts(contacts.filter((_, idx) => idx !== i))}
                              className="shrink-0 text-muted-foreground hover:text-destructive"
                            >
                              ×
                            </button>
                          )}
                        </div>
                      </div>
                    ))}
                    <Button size="sm" onClick={() => setContacts([...contacts, blankContact()])}>
                      + Add Contact Person
                    </Button>
                  </div>
                )}
              </>
            )}

            {tab === 'Remarks' && (
              <Field label="Remarks" hint="Internal only — never shown to the customer">
                <Textarea rows={4} value={form.notes} onChange={(e) => set({ notes: e.target.value })} />
              </Field>
            )}
          </div>
        </Card>
      </div>

      <SaveBar>
        <Button variant="primary" onClick={submit} disabled={saving}>
          {saving && <Spinner />}
          Save
        </Button>
        <Button variant="ghost" onClick={() => router.back()}>Cancel</Button>
      </SaveBar>
    </>
  );
}
