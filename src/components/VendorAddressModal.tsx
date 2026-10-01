'use client';

import { useState } from 'react';
import { api, errorMessage } from '@/lib/api';
import { INDIAN_STATES, stateName } from '@/lib/states';
import { Modal } from './Modal';
import { Button, Field, Input, Select } from './ui';

export type VendorAddress = {
  id: string;
  type: 'BILLING' | 'SHIPPING' | 'OTHER';
  attention?: string | null;
  line1: string;
  line2?: string | null;
  city: string;
  state: string;
  stateCode?: string | null;
  pincode: string;
  country: string;
  phone?: string | null;
};

export function VendorAddressModal({
  open,
  onClose,
  vendorId,
  defaultType = 'SHIPPING',
  onSaved,
}: {
  open: boolean;
  onClose: () => void;
  vendorId: string;
  defaultType?: 'BILLING' | 'SHIPPING' | 'OTHER';
  onSaved: (address: VendorAddress) => void;
}) {
  const blank = {
    type: defaultType,
    attention: '',
    line1: '',
    line2: '',
    city: '',
    stateCode: '',
    pincode: '',
    phone: '',
  };
  const [form, setForm] = useState(blank);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const set = (patch: Partial<typeof form>) => setForm((f) => ({ ...f, ...patch }));

  async function save() {
    setError('');
    if (!form.line1.trim()) return setError('Enter the street address');
    if (!form.city.trim()) return setError('Enter the city');
    if (!form.stateCode) return setError('Pick a state');
    if (!form.pincode.trim()) return setError('Enter the pincode');

    setSaving(true);
    try {
      const res = await api.post<{ data: VendorAddress }>(`/vendors/${vendorId}/addresses`, {
        type: form.type,
        attention: form.attention.trim() || undefined,
        line1: form.line1.trim(),
        line2: form.line2.trim() || undefined,
        city: form.city.trim(),
        state: stateName(form.stateCode),
        stateCode: form.stateCode,
        pincode: form.pincode.trim(),
        country: 'India',
        phone: form.phone.trim() || undefined,
      });
      onSaved(res.data);
      setForm(blank);
      onClose();
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="New Address"
      footer={
        <>
          <Button type="button" onClick={onClose} disabled={saving}>
            Cancel
          </Button>
          <Button type="button" variant="primary" onClick={save} disabled={saving}>
            {saving ? 'Saving…' : 'Save'}
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        {error && (
          <p className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
            {error}
          </p>
        )}

        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Address Type">
            <Select
              value={form.type}
              onChange={(e) => set({ type: e.target.value as typeof form.type })}
              className="w-full"
            >
              <option value="SHIPPING">Shipping</option>
              <option value="BILLING">Billing</option>
              <option value="OTHER">Other</option>
            </Select>
          </Field>
          <Field label="Attention">
            <Input value={form.attention} onChange={(e) => set({ attention: e.target.value })} />
          </Field>
        </div>

        <Field label="Address" required>
          <Input
            value={form.line1}
            onChange={(e) => set({ line1: e.target.value })}
            placeholder="Street address"
            autoFocus
          />
        </Field>
        <Field label="Street 2">
          <Input value={form.line2} onChange={(e) => set({ line2: e.target.value })} />
        </Field>

        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="City" required>
            <Input value={form.city} onChange={(e) => set({ city: e.target.value })} />
          </Field>
          <Field label="State" required>
            <Select
              value={form.stateCode}
              onChange={(e) => set({ stateCode: e.target.value })}
              className="w-full"
            >
              <option value="">Select a state…</option>
              {INDIAN_STATES.map((s) => (
                <option key={s.code} value={s.code}>{s.name}</option>
              ))}
            </Select>
          </Field>
          <Field label="Pincode" required>
            <Input
              inputMode="numeric"
              maxLength={6}
              value={form.pincode}
              onChange={(e) => set({ pincode: e.target.value.replace(/\D/g, '').slice(0, 6) })}
            />
          </Field>
          <Field label="Phone">
            <Input
              type="tel"
              inputMode="tel"
              value={form.phone}
              onChange={(e) => set({ phone: e.target.value.replace(/[^\d+\s-]/g, '').slice(0, 16) })}
            />
          </Field>
        </div>
      </div>
    </Modal>
  );
}
