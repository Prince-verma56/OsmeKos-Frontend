'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { api, errorMessage } from '@/lib/api';
import {
  VendorFormFields, emptyVendorForm, vendorFormToPayload, bankMismatch,
  blankAddress, blankContact, blankBank,
  type AddressDraft, type BankDraft, type ContactDraft, type DocumentDraft, type VendorFormValues,
} from '@/components/VendorForm';
import { Button, ErrorBox, PageHeader, Spinner } from '@/components/ui';
import { useDefaultPaymentTerm } from '@/components/PaymentTermSelect';
import { PageCrumb } from '@/lib/crumbs';
import { SaveBar } from '@/components/form/SaveBar';

export default function NewVendorPage() {
  const router = useRouter();

  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  const [form, setFormState] = useState<VendorFormValues>(emptyVendorForm());
  const setForm = (patch: Partial<VendorFormValues>) => setFormState((f) => ({ ...f, ...patch }));
  useDefaultPaymentTerm((code) =>
    setFormState((f) => (f.paymentTerms === 'DUE_ON_RECEIPT' ? { ...f, paymentTerms: code } : f))
  );
  const [addresses, setAddresses] = useState<AddressDraft[]>([
    blankAddress('BILLING'),
    blankAddress('SHIPPING'),
  ]);
  const [contacts, setContacts] = useState<ContactDraft[]>([blankContact()]);
  const [banks, setBanks] = useState<BankDraft[]>([blankBank()]);
  const [documents, setDocuments] = useState<DocumentDraft[]>([]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    if (!form.displayName.trim()) {
      setError('Display name is required');
      return;
    }
    const bankError = bankMismatch(banks);
    if (bankError) {
      setError(bankError);
      return;
    }
    setSaving(true);
    try {
      const res = await api.post<{ data: { id: string } }>(
        '/vendors',
        vendorFormToPayload(form, addresses, contacts, banks)
      );
      for (const d of documents) {
        await api
          .post('/shared/attachments', {
            ownerType: 'VENDOR',
            ownerId: res.data.id,
            fileName: d.fileName,
            fileUrl: d.fileUrl,
          })
          .catch(() => {});
      }
      router.push(`/admin/vendors/${res.data.id}`);
    } catch (err) {
      setError(errorMessage(err));
      setSaving(false);
    }
  }

  return (
    <form onSubmit={submit}>
      <PageCrumb label="New vendor" />

      <PageHeader
        title="New vendor"
      />

      {error && <div className="mb-4"><ErrorBox message={error} /></div>}

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
      <SaveBar>
        <Link href="/admin/vendors"><Button type="button">Cancel</Button></Link>
        <Button type="submit" variant="primary" disabled={saving}>
          {saving && <Spinner className="border-card/40 border-t-card" />}
          Save
        </Button>
      </SaveBar>
    </form>
  );
}
