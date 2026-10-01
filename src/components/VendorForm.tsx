'use client';

import { useRef, useState } from 'react';
import { Button, Card, EmptyRow, Field, Input, Select, Table, Td, Textarea, Th } from './ui';
import { FileUpload } from './FileUpload';
import { PaymentTermSelect } from './PaymentTermSelect';
import { TdsSelect } from './TdsSelect';
import { INDIAN_STATES, stateLabel, stateName } from '@/lib/states';
import { api, errorMessage } from '@/lib/api';
import { CURRENCIES } from '@/lib/formatPrefs';
import { GstinField } from './GstinField';
import { NEEDS_GSTIN } from '@/lib/gstin';
import { StateSelect, stateSelectHint } from './StateSelect';
import { PHONE_INPUT, PINCODE_INPUT, panProblem, panValue, phoneValue, pincodeValue } from '@/lib/inputs';

export type AddressDraft = {
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

export type ContactDraft = {
  salutation: string;
  firstName: string;
  lastName: string;
  email: string;
  workPhone: string;
  mobile: string;
  designation: string;
};

export type DocumentDraft = { fileName: string; fileUrl: string };

export const CERTIFICATE_TYPES = [
  { value: 'COSMETICS_LICENCE', label: 'Cosmetics manufacturing licence' },
  { value: 'GST', label: 'GST registration' },
  { value: 'MSME', label: 'MSME / Udyam' },
  { value: 'ISO', label: 'ISO / quality' },
  { value: 'GMP', label: 'GMP certificate' },
  { value: 'OTHER', label: 'Other' },
];

export const VENDOR_TYPES = [
  { value: 'MANUFACTURER', label: 'Manufacturer' },
  { value: 'LABEL_PRINTER', label: 'Label printer' },
  { value: 'OTHER', label: 'Other' },
];

export const vendorTypeLabel = (v: string) => VENDOR_TYPES.find((t) => t.value === v)?.label ?? v;

export const certificateTypeLabel = (v: string) => CERTIFICATE_TYPES.find((t) => t.value === v)?.label ?? v;

export type CertificateDraft = {
  type: string;
  number: string;
  fileUrl: string;
  fileName: string;
  expiresOn: string;
  notes: string;
};

export const blankCertificate = (): CertificateDraft => ({
  type: 'COSMETICS_LICENCE', number: '', fileUrl: '', fileName: '', expiresOn: '', notes: '',
});

export function certificateState(expiresOn?: string | null) {
  if (!expiresOn) return null;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const days = Math.round((new Date(`${expiresOn}T00:00:00`).getTime() - today.getTime()) / 86400000);
  if (days < 0) return { tone: 'red' as const, label: 'Expired' };
  if (days <= 30) return { tone: 'amber' as const, label: days === 0 ? 'Expires today' : `Expires in ${days}d` };
  return { tone: 'green' as const, label: 'Valid' };
}

export type BankDraft = {
  accountHolderName: string;
  bankName: string;
  accountNumber: string;
  confirmAccountNumber: string;
  ifscCode: string;
  branch: string;
};

export type VendorFormValues = {
  salutation: string;
  firstName: string;
  lastName: string;
  companyName: string;
  displayName: string;
  vendorType: string;
  email: string;
  workPhone: string;
  mobile: string;
  website: string;

  gstTreatment: string;
  gstin: string;
  sourceOfSupplyState: string;
  sourceOfSupplyCode: string;
  pan: string;
  isMsme: boolean;
  msmeRegistrationNo: string;
  msmeRegistrationType: string;
  tdsSection: string;
  tdsRate: string;

  currency: string;
  paymentTerms: string;

  department: string;
  designation: string;

  status: string;
  remarks: string;

  cosmeticsLicenceNo: string;
  certificates: CertificateDraft[];
};

export const blankAddress = (type = 'BILLING'): AddressDraft => ({
  type, attention: '', line1: '', line2: '', city: '', state: '',
  stateCode: '', pincode: '', country: 'India', phone: '',
});

export const blankContact = (): ContactDraft => ({
  salutation: '', firstName: '', lastName: '', email: '', workPhone: '', mobile: '', designation: '',
});

export const blankBank = (): BankDraft => ({
  accountHolderName: '', bankName: '', accountNumber: '',
  confirmAccountNumber: '', ifscCode: '', branch: '',
});

export const emptyVendorForm = (): VendorFormValues => ({
  salutation: '', firstName: '', lastName: '', companyName: '', displayName: '', vendorType: 'OTHER',
  email: '', workPhone: '', mobile: '', website: '',
  gstTreatment: 'REGISTERED_REGULAR', gstin: '', sourceOfSupplyState: '',
  sourceOfSupplyCode: '', pan: '', isMsme: false, msmeRegistrationNo: '',
  msmeRegistrationType: '', tdsSection: '', tdsRate: '',
  currency: 'INR', paymentTerms: 'DUE_ON_RECEIPT',
  department: '', designation: '',
  status: 'ACTIVE', remarks: '',
  cosmeticsLicenceNo: '', certificates: [],
});

const str = (v: unknown) => (v === null || v === undefined ? '' : String(v));

export function vendorToForm(v: Record<string, unknown>): VendorFormValues {
  const base = emptyVendorForm();
  return {
    ...base,
    salutation: str(v.salutation),
    firstName: str(v.firstName),
    lastName: str(v.lastName),
    companyName: str(v.companyName),
    displayName: str(v.displayName),
    vendorType: str(v.vendorType) || 'OTHER',
    email: str(v.email),
    workPhone: str(v.workPhone),
    mobile: str(v.mobile),
    website: str(v.website),
    gstTreatment: str(v.gstTreatment) || base.gstTreatment,
    gstin: str(v.gstin),
    sourceOfSupplyState: str(v.sourceOfSupplyState),
    sourceOfSupplyCode: str(v.sourceOfSupplyCode),
    pan: str(v.pan),
    isMsme: Boolean(v.isMsme),
    msmeRegistrationNo: str(v.msmeRegistrationNo),
    msmeRegistrationType: str(v.msmeRegistrationType),
    tdsSection: str(v.tdsSection),
    tdsRate: str(v.tdsRate),
    currency: str(v.currency) || 'INR',
    paymentTerms: str(v.paymentTerms) || base.paymentTerms,
    department: str(v.department),
    designation: str(v.designation),
    status: str(v.status) || 'ACTIVE',
    remarks: str(v.remarks),
    cosmeticsLicenceNo: str(v.cosmeticsLicenceNo),
    certificates: Array.isArray(v.certificates)
      ? v.certificates.map((c: Record<string, unknown>) => ({
          type: str(c.type) || 'OTHER',
          number: str(c.number),
          fileUrl: str(c.fileUrl),
          fileName: str(c.fileName),
          expiresOn: str(c.expiresOn),
          notes: str(c.notes),
        }))
      : [],
  };
}

export function contactsToDrafts(list: unknown): ContactDraft[] {
  if (!Array.isArray(list) || list.length === 0) return [blankContact()];
  return list.map((c: Record<string, unknown>) => ({
    ...blankContact(),
    salutation: str(c.salutation),
    firstName: str(c.firstName),
    lastName: str(c.lastName),
    email: str(c.email),
    workPhone: str(c.workPhone),
    mobile: str(c.mobile),
    designation: str(c.designation),
  }));
}

export function banksToDrafts(list: unknown): BankDraft[] {
  if (!Array.isArray(list) || list.length === 0) return [blankBank()];
  return list.map((b: Record<string, unknown>) => ({
    ...blankBank(),
    accountHolderName: str(b.accountHolderName),
    bankName: str(b.bankName),
    accountNumber: str(b.accountNumber),
    confirmAccountNumber: str(b.accountNumber),
    ifscCode: str(b.ifscCode),
    branch: str(b.branch),
  }));
}

const opt = (s: string) => (s.trim() ? s.trim() : undefined);
const num = (s: string) => (s === '' ? undefined : Number(s));

export function vendorFormToPayload(
  f: VendorFormValues,
  addresses: AddressDraft[],
  contacts: ContactDraft[],
  banks: BankDraft[]
) {
  return {
    salutation: opt(f.salutation),
    firstName: opt(f.firstName),
    lastName: opt(f.lastName),
    companyName: opt(f.companyName),
    displayName: f.displayName.trim(),
    vendorType: f.vendorType,
    email: opt(f.email),
    workPhone: opt(f.workPhone),
    mobile: opt(f.mobile),
    website: opt(f.website),

    gstTreatment: f.gstTreatment,
    gstin: opt(f.gstin),
    sourceOfSupplyState: opt(f.sourceOfSupplyState),
    sourceOfSupplyCode: opt(f.sourceOfSupplyCode),
    pan: opt(f.pan),
    isMsme: f.isMsme,
    msmeRegistrationNo: f.isMsme ? opt(f.msmeRegistrationNo) : undefined,
    msmeRegistrationType: f.isMsme ? opt(f.msmeRegistrationType) : undefined,
    tdsSection: opt(f.tdsSection),
    tdsRate: num(f.tdsRate),

    currency: f.currency || 'INR',
    paymentTerms: f.paymentTerms,
    department: opt(f.department),
    designation: opt(f.designation),

    status: f.status,
    remarks: opt(f.remarks),

    cosmeticsLicenceNo: f.vendorType === 'MANUFACTURER' ? f.cosmeticsLicenceNo.trim() || null : null,
    certificates: f.certificates
      .filter((c) => c.number.trim() || c.fileUrl || c.expiresOn)
      .map((c) => ({
        type: c.type,
        number: opt(c.number),
        fileUrl: c.fileUrl || undefined,
        fileName: c.fileUrl ? opt(c.fileName) : undefined,
        expiresOn: c.expiresOn || undefined,
        notes: opt(c.notes),
      })),

    addresses: addresses
      .filter((a) => a.line1.trim() && a.city.trim() && a.state.trim() && a.pincode.trim())
      .map((a) => ({
        type: a.type,
        attention: opt(a.attention),
        line1: a.line1.trim(),
        line2: opt(a.line2),
        city: a.city.trim(),
        state: a.state.trim(),
        stateCode: opt(a.stateCode),
        pincode: a.pincode.trim(),
        country: a.country.trim() || 'India',
        phone: opt(a.phone),
      })),

    contacts: contacts
      .filter((c) => c.firstName.trim() || c.lastName.trim() || c.email.trim())
      .map((c, i) => ({
        salutation: opt(c.salutation),
        firstName: opt(c.firstName),
        lastName: opt(c.lastName),
        email: opt(c.email),
        workPhone: opt(c.workPhone),
        mobile: opt(c.mobile),
        designation: opt(c.designation),
        isPrimary: i === 0,
      })),

    bankAccounts: banks
      .filter((b) => b.accountNumber.trim())
      .map((b, i) => ({
        accountHolderName: opt(b.accountHolderName),
        bankName: opt(b.bankName),
        accountNumber: b.accountNumber.trim(),
        ifscCode: opt(b.ifscCode?.toUpperCase()),
        branch: opt(b.branch),
        isPrimary: i === 0,
      })),
  };
}

export function bankMismatch(banks: BankDraft[]): string | null {
  for (const b of banks) {
    if (!b.accountNumber.trim()) continue;
    if (b.accountNumber.trim() !== b.confirmAccountNumber.trim()) {
      return 'The two account number fields do not match';
    }
    if (!b.ifscCode.trim()) return 'IFSC is required when a bank account is given';
  }
  return null;
}

const TABS = ['Other details', 'Address', 'Contact persons', 'Bank details', 'Certificates', 'Remarks'] as const;
type Tab = (typeof TABS)[number];

export function VendorFormFields({
  form,
  setForm,
  addresses,
  setAddresses,
  contacts,
  setContacts,
  banks,
  setBanks,
  documents,
  setDocuments,
}: {
  form: VendorFormValues;
  setForm: (patch: Partial<VendorFormValues>) => void;
  addresses: AddressDraft[];
  setAddresses: (next: AddressDraft[]) => void;
  contacts: ContactDraft[];
  setContacts: (next: ContactDraft[]) => void;
  banks: BankDraft[];
  setBanks: (next: BankDraft[]) => void;
  documents: DocumentDraft[];
  setDocuments: (next: DocumentDraft[]) => void;
}) {
  const set = setForm;
  const [tab, setTab] = useState<Tab>('Other details');
  const latest = useRef({ form, banks });
  latest.current = { form, banks };

  const billing = addresses.find((a) => a.type === 'BILLING') ?? blankAddress('BILLING');
  const shipping = addresses.find((a) => a.type === 'SHIPPING') ?? blankAddress('SHIPPING');

  const setAddrOfType = (type: string, patch: Partial<AddressDraft>) => {
    const i = addresses.findIndex((a) => a.type === type);
    if (i === -1) setAddresses([...addresses, { ...blankAddress(type), ...patch }]);
    else setAddresses(addresses.map((a, idx) => (idx === i ? { ...a, ...patch } : a)));
  };

  const copyBillingToShipping = () => {
    const i = addresses.findIndex((a) => a.type === 'SHIPPING');
    const copy: AddressDraft = { ...billing, type: 'SHIPPING' };
    if (i === -1) setAddresses([...addresses, copy]);
    else setAddresses(addresses.map((a, idx) => (idx === i ? copy : a)));
  };

  const setContact = (i: number, patch: Partial<ContactDraft>) =>
    setContacts(contacts.map((c, idx) => (idx === i ? { ...c, ...patch } : c)));
  const setBank = (i: number, patch: Partial<BankDraft>) =>
    setBanks(banks.map((b, idx) => (idx === i ? { ...b, ...patch } : b)));

  const [ifscState, setIfscState] = useState<Record<number, { busy?: boolean; note?: string; error?: string }>>({});
  async function lookupIfsc(i: number, code: string) {
    const ifsc = code.trim().toUpperCase();
    if (!/^[A-Z]{4}0[A-Z0-9]{6}$/.test(ifsc)) {
      setIfscState((s) => ({ ...s, [i]: ifsc ? { error: 'IFSC is 11 characters, e.g. HDFC0001234' } : {} }));
      return;
    }
    setIfscState((s) => ({ ...s, [i]: { busy: true } }));
    try {
      const r = await api.get<{ data: { bankName: string | null; branch: string | null; city: string | null; state: string | null } }>(
        `/vendors/ifsc/${ifsc}`
      );
      setBanks(
        latest.current.banks.map((b, idx) =>
          idx === i && b.ifscCode.toUpperCase() === ifsc
            ? { ...b, ifscCode: ifsc, bankName: r.data.bankName ?? b.bankName, branch: r.data.branch ?? b.branch }
            : b
        )
      );
      setIfscState((s) => ({
        ...s,
        [i]: { note: [r.data.bankName, r.data.branch, r.data.city, r.data.state].filter(Boolean).join(' · ') },
      }));
    } catch (err) {
      setIfscState((s) => ({ ...s, [i]: { error: errorMessage(err) } }));
    }
  }

  const setCertificate = (i: number, patch: Partial<CertificateDraft>) =>
    set({ certificates: latest.current.form.certificates.map((c, idx) => (idx === i ? { ...c, ...patch } : c)) });

  const addressBlock = (title: string, a: AddressDraft, type: string, extra?: React.ReactNode) => (
    <div>
      <div className="mb-3 flex items-center gap-3">
        <h3 className="text-sm font-medium text-foreground">{title}</h3>
        {extra}
      </div>
      <div className="space-y-3">
        <Field label="Attention">
          <Input
            value={a.attention}
            onChange={(e) => setAddrOfType(type, { attention: e.target.value })}
          />
        </Field>
        <Field label="Country / region">
          <Input
            value={a.country}
            onChange={(e) => setAddrOfType(type, { country: e.target.value })}
          />
        </Field>
        <Field label="Address">
          <Input
            value={a.line1}
            onChange={(e) => setAddrOfType(type, { line1: e.target.value })}
            placeholder="Street 1"
          />
        </Field>
        <Input
          value={a.line2}
          onChange={(e) => setAddrOfType(type, { line2: e.target.value })}
          placeholder="Street 2"
        />
        <div className="grid grid-cols-3 gap-3">
          <Field label="City">
            <Input value={a.city} onChange={(e) => setAddrOfType(type, { city: e.target.value })} />
          </Field>
          <Field label="State" hint={stateSelectHint(a.stateCode, a.state) ?? undefined}>
            <StateSelect
              code={a.stateCode}
              name={a.state}
              onChange={(st) => setAddrOfType(type, { state: st?.name ?? '', stateCode: st?.code ?? '' })}
            />
          </Field>
          <Field label="Pin code">
            <Input
              {...PINCODE_INPUT}
              value={a.pincode}
              onChange={(e) => setAddrOfType(type, { pincode: pincodeValue(e.target.value) })}
            />
          </Field>
        </div>
        <Field label="Phone">
          <Input {...PHONE_INPUT} value={a.phone} onChange={(e) => setAddrOfType(type, { phone: phoneValue(e.target.value) })} />
        </Field>
      </div>
    </div>
  );

  return (
    <div className="space-y-5">
      <Card title="Vendor">
        <div className="space-y-4">
          <Field label="Primary contact">
            <div className="grid gap-3 sm:grid-cols-3">
              <Select
                value={form.salutation}
                onChange={(e) => set({ salutation: e.target.value })}
                className="w-full"
              >
                <option value="">Salutation</option>
                <option value="Mr.">Mr.</option>
                <option value="Mrs.">Mrs.</option>
                <option value="Ms.">Ms.</option>
                <option value="Dr.">Dr.</option>
              </Select>
              <Input
                value={form.firstName}
                onChange={(e) => set({ firstName: e.target.value })}
                placeholder="First name"
              />
              <Input
                value={form.lastName}
                onChange={(e) => set({ lastName: e.target.value })}
                placeholder="Last name"
              />
            </div>
          </Field>

          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Company name" hint="The display name follows this until you change it yourself">
              <Input
                value={form.companyName}
                onChange={(e) => {
                  const companyName = e.target.value;
                  const follows =
                    !form.displayName.trim() || form.displayName.trim() === form.companyName.trim();
                  set(follows ? { companyName, displayName: companyName } : { companyName });
                }}
              />
            </Field>
            <Field label="Display name" required hint="How the vendor appears everywhere">
              <Input
                value={form.displayName}
                onChange={(e) => set({ displayName: e.target.value })}
                placeholder="Bo International"
                required
              />
            </Field>
            <Field label="Vendor type" hint="Manufacturers carry a cosmetics licence number">
              <Select
                value={form.vendorType}
                onChange={(e) => set({ vendorType: e.target.value })}
              >
                {VENDOR_TYPES.map((t) => (
                  <option key={t.value} value={t.value}>
                    {t.label}
                  </option>
                ))}
              </Select>
            </Field>
            {form.vendorType === 'MANUFACTURER' && (
              <Field label="Cosmetics manufacturing licence no." hint="As printed on the label, e.g. COSBHR2025000015">
                <Input
                  value={form.cosmeticsLicenceNo}
                  onChange={(e) => set({ cosmeticsLicenceNo: e.target.value.toUpperCase() })}
                  maxLength={60}
                  className="font-mono uppercase"
                />
              </Field>
            )}
            <Field label="Email address">
              <Input
                type="email"
                value={form.email}
                onChange={(e) => set({ email: e.target.value })}
              />
            </Field>
            <Field label="Phone">
              <div className="grid grid-cols-2 gap-3">
                <Input
                  {...PHONE_INPUT}
                  value={form.workPhone}
                  onChange={(e) => set({ workPhone: phoneValue(e.target.value) })}
                  placeholder="Work phone"
                />
                <Input
                  {...PHONE_INPUT}
                  value={form.mobile}
                  onChange={(e) => set({ mobile: phoneValue(e.target.value) })}
                  placeholder="Mobile"
                />
              </div>
            </Field>
          </div>
        </div>
      </Card>

      <div className="rounded-lg border border-border bg-card">
        <div className="flex flex-wrap gap-1 border-b border-border px-3 pt-3">
          {TABS.map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => setTab(t)}
              className={`px-3 py-2 text-sm ${
                tab === t
                  ? 'border-b-2 border-gold font-medium text-foreground'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              {t}
            </button>
          ))}
        </div>

        <div className="p-4">
          {tab === 'Other details' && (
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="GST treatment" required>
                <Select
                  value={form.gstTreatment}
                  onChange={(e) => set({ gstTreatment: e.target.value })}
                  className="w-full"
                >
                  <option value="REGISTERED_REGULAR">Registered — regular</option>
                  <option value="REGISTERED_COMPOSITION">Registered — composition</option>
                  <option value="UNREGISTERED">Unregistered</option>
                  <option value="CONSUMER">Consumer</option>
                  <option value="OVERSEAS">Overseas</option>
                  <option value="SEZ">SEZ</option>
                </Select>
              </Field>
              <GstinField
                value={form.gstin}
                required={NEEDS_GSTIN.includes(form.gstTreatment)}
                hint={
                  NEEDS_GSTIN.includes(form.gstTreatment)
                    ? 'Needed for a registered vendor - 15 characters, e.g. 09AAACR5055K1ZK'
                    : 'Leave this empty for a vendor that is not registered under GST'
                }
                onChange={(gstin, info) =>
                  set({
                    gstin,
                    ...(info.complete && !form.sourceOfSupplyCode
                      ? { sourceOfSupplyCode: info.stateCode, sourceOfSupplyState: stateName(info.stateCode) }
                      : {}),
                    ...(info.complete && !form.pan ? { pan: info.pan } : {}),
                  })
                }
              />

              <Field
                label="Source of supply"
                required
                hint="The state the vendor supplies from — it decides IGST versus CGST+SGST"
              >
                <Select
                  value={form.sourceOfSupplyCode}
                  onChange={(e) =>
                    set({
                      sourceOfSupplyCode: e.target.value,
                      sourceOfSupplyState: stateName(e.target.value),
                    })
                  }
                  className="w-full"
                >
                  <option value="">Select a state…</option>
                  {INDIAN_STATES.map((s) => (
                    <option key={s.code} value={s.code}>{stateLabel(s.code)}</option>
                  ))}
                </Select>
              </Field>

              <Field label="PAN" hint={panProblem(form.pan) ? <span className="text-destructive">{panProblem(form.pan)}</span> : 'Filled in from the GSTIN when it is complete'}>
                <Input
                  value={form.pan}
                  onChange={(e) => set({ pan: panValue(e.target.value) })}
                  className="font-mono uppercase"
                  maxLength={10}
                  placeholder="ABCDE1234F"
                />
              </Field>
              <Field label="Status">
                <Select
                  value={form.status}
                  onChange={(e) => set({ status: e.target.value })}
                  className="w-full"
                >
                  <option value="ACTIVE">Active</option>
                  <option value="INACTIVE">Inactive</option>
                </Select>
              </Field>

              <div className="sm:col-span-2">
                <label className="flex items-center gap-2 text-sm text-foreground">
                  <input
                    type="checkbox"
                    checked={form.isMsme}
                    onChange={(e) => set({ isMsme: e.target.checked })}
                  />
                  This vendor is MSME registered
                </label>
                {form.isMsme && (
                  <div className="mt-3 grid gap-4 sm:grid-cols-2">
                    <Field label="MSME / Udyam registration number" required>
                      <Input
                        value={form.msmeRegistrationNo}
                        onChange={(e) => set({ msmeRegistrationNo: e.target.value })}
                        placeholder="Enter the registration number"
                      />
                    </Field>
                    <Field label="MSME / Udyam registration type" required>
                      <Select
                        value={form.msmeRegistrationType}
                        onChange={(e) => set({ msmeRegistrationType: e.target.value })}
                        className="w-full"
                      >
                        <option value="">Select the registration type</option>
                        <option value="MICRO">Micro</option>
                        <option value="SMALL">Small</option>
                        <option value="MEDIUM">Medium</option>
                      </Select>
                    </Field>
                  </div>
                )}
              </div>

              <Field label="Currency">
                <Select
                  value={form.currency}
                  onChange={(e) => set({ currency: e.target.value })}
                  className="w-full"
                >
                  {!CURRENCIES[form.currency] && form.currency && (
                    <option value={form.currency}>{form.currency}</option>
                  )}
                  {Object.entries(CURRENCIES).map(([code, c]) => (
                    <option key={code} value={code}>
                      {code} - {c.name}
                    </option>
                  ))}
                </Select>
              </Field>
              <Field label="Payment terms">
                <PaymentTermSelect
                  value={form.paymentTerms}
                  onChange={(paymentTerms) => set({ paymentTerms })}
                />
              </Field>

              <Field
                label="TDS"
                hint={form.tdsRate ? `Withheld at ${form.tdsRate}%` : 'Withheld from payments to this vendor'}
              >
                <TdsSelect
                  section={form.tdsSection}
                  onChange={({ section, rate }) => set({ tdsSection: section, tdsRate: rate })}
                />
              </Field>

              <Field label="Website URL">
                <Input
                  value={form.website}
                  onChange={(e) => set({ website: e.target.value })}
                  placeholder="e.g. www.bointernational.in"
                />
              </Field>
              <Field label="Department">
                <Input
                  value={form.department}
                  onChange={(e) => set({ department: e.target.value })}
                />
              </Field>
              <Field label="Designation">
                <Input
                  value={form.designation}
                  onChange={(e) => set({ designation: e.target.value })}
                />
              </Field>

              <div className="sm:col-span-2">
                <span className="mb-1 block text-xs font-medium text-muted-foreground">
                  Documents
                </span>
                {documents.length > 0 && (
                  <ul className="mb-2 space-y-1">
                    {documents.map((d, i) => (
                      <li key={d.fileUrl} className="flex items-center justify-between gap-2 text-sm">
                        <a
                          href={d.fileUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="truncate text-gold-ink hover:underline"
                        >
                          {d.fileName}
                        </a>
                        <Button
                          type="button"
                          size="sm"
                          variant="danger"
                          onClick={() => setDocuments(documents.filter((_, idx) => idx !== i))}
                        >
                          ×
                        </Button>
                      </li>
                    ))}
                  </ul>
                )}
                <FileUpload
                  label="Upload file"
                  accept="image/*,application/pdf,.csv,.xlsx,.docx"
                  multiple
                  disabled={documents.length >= 10}
                  onUploaded={(files) =>
                    setDocuments(
                      [
                        ...documents,
                        ...files
                          .filter((f) => !documents.some((d) => d.fileUrl === f.url))
                          .map((f) => ({ fileName: f.fileName, fileUrl: f.url })),
                      ].slice(0, 10)
                    )
                  }
                />
                <p className="mt-1 text-xs text-muted-foreground">
                  You can upload a maximum of 10 files, 10 MB each. Attached once the vendor is saved.
                </p>
              </div>
            </div>
          )}

          {tab === 'Address' && (
            <div className="grid gap-8 lg:grid-cols-2">
              {addressBlock('Billing address', billing, 'BILLING')}
              {addressBlock(
                'Shipping address',
                shipping,
                'SHIPPING',
                <button
                  type="button"
                  onClick={copyBillingToShipping}
                  className="text-xs font-medium text-gold-ink hover:underline"
                >
                  ↓ Copy billing address
                </button>
              )}
              <p className="text-xs text-muted-foreground lg:col-span-2 min-w-0">
                An address is only saved once address, city, state and pin code are filled in — the
                API requires all four together.
              </p>
            </div>
          )}

          {tab === 'Contact persons' && (
            <div>
              <Table minWidth="900px">
                <thead>
                  <tr>
                    <Th>Salutation</Th>
                    <Th>First name</Th>
                    <Th>Last name</Th>
                    <Th>Email address</Th>
                    <Th>Work phone</Th>
                    <Th>Mobile</Th>
                    <Th />
                  </tr>
                </thead>
                <tbody>
                  {contacts.length === 0 && <EmptyRow colSpan={7} />}
                  {contacts.map((c, i) => (
                    <tr key={i}>
                      <Td>
                        <Select
                          value={c.salutation}
                          onChange={(e) => setContact(i, { salutation: e.target.value })}
                          className="w-24"
                        >
                          <option value=""></option>
                          <option value="Mr.">Mr.</option>
                          <option value="Mrs.">Mrs.</option>
                          <option value="Ms.">Ms.</option>
                          <option value="Dr.">Dr.</option>
                        </Select>
                      </Td>
                      <Td>
                        <Input
                          value={c.firstName}
                          onChange={(e) => setContact(i, { firstName: e.target.value })}
                          className="w-36"
                        />
                      </Td>
                      <Td>
                        <Input
                          value={c.lastName}
                          onChange={(e) => setContact(i, { lastName: e.target.value })}
                          className="w-36"
                        />
                      </Td>
                      <Td>
                        <Input
                          type="email"
                          value={c.email}
                          onChange={(e) => setContact(i, { email: e.target.value })}
                          className="w-52"
                        />
                      </Td>
                      <Td>
                        <Input
                          {...PHONE_INPUT}
                          value={c.workPhone}
                          onChange={(e) => setContact(i, { workPhone: phoneValue(e.target.value) })}
                          className="w-32"
                        />
                      </Td>
                      <Td>
                        <Input
                          {...PHONE_INPUT}
                          value={c.mobile}
                          onChange={(e) => setContact(i, { mobile: phoneValue(e.target.value) })}
                          className="w-32"
                        />
                      </Td>
                      <Td>
                        {contacts.length > 1 && (
                          <Button
                            type="button"
                            size="sm"
                            variant="danger"
                            onClick={() => setContacts(contacts.filter((_, idx) => idx !== i))}
                          >
                            ×
                          </Button>
                        )}
                      </Td>
                    </tr>
                  ))}
                </tbody>
              </Table>
              <div className="mt-3">
                <Button type="button" size="sm" onClick={() => setContacts([...contacts, blankContact()])}>
                  + Add contact person
                </Button>
              </div>
              <p className="mt-2 text-xs text-muted-foreground">
                The first row is stored as the primary contact. Blank rows are ignored.
              </p>
            </div>
          )}

          {tab === 'Bank details' && (
            <div className="space-y-5">
              {banks.map((b, i) => (
                <div key={i} className="rounded-md border border-border p-3">
                  <div className="grid gap-4 sm:grid-cols-2">
                    <Field label="Account holder name">
                      <Input
                        value={b.accountHolderName}
                        onChange={(e) => setBank(i, { accountHolderName: e.target.value })}
                      />
                    </Field>
                    <Field label="Bank name">
                      <Input
                        value={b.bankName}
                        onChange={(e) => setBank(i, { bankName: e.target.value })}
                      />
                    </Field>
                    <Field label="Account number">
                      <Input
                        value={b.accountNumber}
                        onChange={(e) => setBank(i, { accountNumber: e.target.value })}
                        className="font-mono"
                      />
                    </Field>
                    <Field label="Re-enter account number">
                      <Input
                        value={b.confirmAccountNumber}
                        onChange={(e) => setBank(i, { confirmAccountNumber: e.target.value })}
                        className="font-mono"
                      />
                    </Field>
                    <Field
                      label="IFSC"
                      hint={
                        ifscState[i]?.busy ? (
                          'Looking up the branch…'
                        ) : ifscState[i]?.error ? (
                          <span className="text-destructive">{ifscState[i]?.error}</span>
                        ) : ifscState[i]?.note ? (
                          <span className="text-success">✓ {ifscState[i]?.note}</span>
                        ) : (
                          'Bank name and branch fill in from the IFSC'
                        )
                      }
                    >
                      <div className="flex gap-2">
                        <Input
                          value={b.ifscCode}
                          onChange={(e) => {
                            const ifscCode = e.target.value.toUpperCase();
                            setBank(i, { ifscCode });
                            if (ifscCode.length === 11) lookupIfsc(i, ifscCode);
                          }}
                          onBlur={(e) => {
                            if (e.target.value.length !== 11) lookupIfsc(i, e.target.value);
                          }}
                          className="font-mono"
                          maxLength={11}
                          placeholder="HDFC0001234"
                        />
                        <Button
                          type="button"
                          size="sm"
                          variant="ghost"
                          disabled={!b.ifscCode || ifscState[i]?.busy}
                          onClick={() => lookupIfsc(i, b.ifscCode)}
                        >
                          Fetch
                        </Button>
                      </div>
                    </Field>
                    <Field label="Branch">
                      <Input
                        value={b.branch}
                        onChange={(e) => setBank(i, { branch: e.target.value })}
                      />
                    </Field>
                  </div>
                  {banks.length > 1 && (
                    <div className="mt-3">
                      <Button
                        type="button"
                        size="sm"
                        variant="danger"
                        onClick={() => setBanks(banks.filter((_, idx) => idx !== i))}
                      >
                        Remove bank
                      </Button>
                    </div>
                  )}
                </div>
              ))}
              <Button type="button" size="sm" onClick={() => setBanks([...banks, blankBank()])}>
                + Add new bank
              </Button>
              <p className="text-xs text-muted-foreground">
                A bank is saved only when an account number is given, and the two account-number
                fields must match.
              </p>
            </div>
          )}

          {tab === 'Certificates' && (
            <div className="space-y-4">
              {form.certificates.length === 0 && (
                <p className="text-sm text-muted-foreground">
                  No certificates yet. Add the vendor&apos;s cosmetics licence, GST certificate, GMP certificate and
                  similar papers with their expiry dates so you know when to ask for renewed copies.
                </p>
              )}
              {form.certificates.map((c, i) => {
                const state = certificateState(c.expiresOn);
                return (
                  <div key={i} className="rounded-md border border-border p-3">
                    <div className="grid gap-4 sm:grid-cols-3">
                      <Field label="Certificate">
                        <Select
                          value={c.type}
                          onChange={(e) => setCertificate(i, { type: e.target.value })}
                          className="w-full"
                        >
                          {CERTIFICATE_TYPES.map((t) => (
                            <option key={t.value} value={t.value}>{t.label}</option>
                          ))}
                        </Select>
                      </Field>
                      <Field label="Number">
                        <Input
                          value={c.number}
                          onChange={(e) => setCertificate(i, { number: e.target.value })}
                          className="font-mono"
                        />
                      </Field>
                      <Field
                        label="Valid until"
                        hint={
                          state ? (
                            <span
                              className={
                                state.tone === 'red'
                                  ? 'text-destructive'
                                  : state.tone === 'amber'
                                    ? 'text-warning'
                                    : 'text-success'
                              }
                            >
                              {state.label}
                            </span>
                          ) : (
                            'Leave empty if it does not expire'
                          )
                        }
                      >
                        <Input
                          type="date"
                          value={c.expiresOn}
                          onChange={(e) => setCertificate(i, { expiresOn: e.target.value })}
                        />
                      </Field>
                      <div className="sm:col-span-2">
                        <span className="mb-1 block text-xs font-medium text-muted-foreground">
                          Copy
                        </span>
                        {c.fileUrl ? (
                          <div className="flex items-center gap-2 text-sm">
                            <a
                              href={c.fileUrl}
                              target="_blank"
                              rel="noreferrer"
                              className="truncate text-gold-ink hover:underline"
                            >
                              {c.fileName || 'View file'}
                            </a>
                            <Button
                              type="button"
                              size="sm"
                              variant="ghost"
                              onClick={() => setCertificate(i, { fileUrl: '', fileName: '' })}
                            >
                              Remove file
                            </Button>
                          </div>
                        ) : (
                          <FileUpload
                            label="Upload copy"
                            accept="image/*,application/pdf"
                            onUploaded={(files) =>
                              files[0] && setCertificate(i, { fileUrl: files[0].url, fileName: files[0].fileName })
                            }
                          />
                        )}
                      </div>
                      <Field label="Notes">
                        <Input
                          value={c.notes}
                          onChange={(e) => setCertificate(i, { notes: e.target.value })}
                        />
                      </Field>
                    </div>
                    <div className="mt-3">
                      <Button
                        type="button"
                        size="sm"
                        variant="danger"
                        onClick={() => set({ certificates: form.certificates.filter((_, idx) => idx !== i) })}
                      >
                        Remove certificate
                      </Button>
                    </div>
                  </div>
                );
              })}
              <Button
                type="button"
                size="sm"
                disabled={form.certificates.length >= 30}
                onClick={() => set({ certificates: [...form.certificates, blankCertificate()] })}
              >
                + Add certificate
              </Button>
            </div>
          )}

          {tab === 'Remarks' && (
            <Field label="Remarks" hint="For internal use">
              <Textarea
                rows={5}
                value={form.remarks}
                onChange={(e) => set({ remarks: e.target.value })}
              />
            </Field>
          )}
        </div>
      </div>
    </div>
  );
}
