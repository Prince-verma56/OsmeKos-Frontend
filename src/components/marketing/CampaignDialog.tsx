'use client';

import { useEffect, useState } from 'react';
import { api, errorMessage } from '@/lib/api';
import { useToast } from '@/lib/toast';
import { Modal } from '@/components/Modal';
import { Button, ErrorBox, Field, Input, Select, Spinner, Textarea } from '@/components/ui';
import type { Campaign } from './types';

type DiscountOption = { id: string; code: string | null; title: string };

const CHANNELS = [
  { value: 'META', label: 'Meta' },
  { value: 'GOOGLE', label: 'Google' },
  { value: 'INFLUENCER', label: 'Influencer' },
  { value: 'EMAIL', label: 'Email' },
  { value: 'OFFLINE', label: 'Offline' },
  { value: 'OTHER', label: 'Other' },
];

export function CampaignDialog({
  campaign,
  onClose,
  onSaved,
}: {
  campaign: Campaign | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const toast = useToast();
  const [discounts, setDiscounts] = useState<DiscountOption[]>([]);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  const [form, setForm] = useState({
    name: campaign?.name ?? '',
    channel: campaign?.channel ?? 'META',
    startsOn: campaign ? campaign.startsOn.slice(0, 10) : new Date().toISOString().slice(0, 10),
    endsOn: campaign?.endsOn ? campaign.endsOn.slice(0, 10) : '',
    budget: campaign?.budget != null ? String(campaign.budget) : '',
    discountId: campaign?.discount?.id ?? '',
    notes: campaign?.notes ?? '',
  });

  useEffect(() => {
    api
      .get<{ data: DiscountOption[] }>('/sales/discounts', { limit: 100 })
      .then((res) => setDiscounts(res.data))
      .catch((err) => setError(`Could not load your discount codes: ${errorMessage(err)}`));
  }, []);

  async function save() {
    if (!form.name.trim()) {
      setError('Give the campaign a name');
      return;
    }

    setSaving(true);
    setError('');
    try {
      const body = {
        name: form.name.trim(),
        channel: form.channel,
        startsOn: form.startsOn,
        endsOn: form.endsOn || null,
        budget: form.budget === '' ? null : Number(form.budget),
        discountId: form.discountId || null,
        notes: form.notes.trim() || null,
      };

      if (campaign) await api.patch(`/marketing/campaigns/${campaign.id}`, body);
      else await api.post('/marketing/campaigns', body);

      toast.success(campaign ? 'Campaign updated' : 'Campaign added');
      onSaved();
    } catch (err) {
      setError(errorMessage(err));
      setSaving(false);
    }
  }

  return (
    <Modal
      open
      onClose={onClose}
      title={campaign ? 'Edit campaign' : 'New campaign'}
      description="Tie a code to it and its orders are counted for you"
      footer={
        <>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button variant="primary" onClick={save} disabled={saving}>
            {saving && <Spinner className="border-card/40 border-t-card" />}
            {campaign ? 'Save' : 'Add campaign'}
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        {error && <ErrorBox message={error} />}

        <Field label="Name" required>
          <Input
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
            placeholder="Diwali push"
            required
          />
        </Field>

        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Channel">
            <Select
              value={form.channel}
              onChange={(e) => setForm({ ...form, channel: e.target.value })}
              className="w-full"
            >
              {CHANNELS.map((c) => (
                <option key={c.value} value={c.value}>
                  {c.label}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Budget" hint="What you plan to spend">
            <Input
              type="number"
              min="0"
              step="0.01"
              value={form.budget}
              onChange={(e) => setForm({ ...form, budget: e.target.value })}
              placeholder="No budget set"
            />
          </Field>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Starts" required>
            <Input
              type="date"
              value={form.startsOn}
              onChange={(e) => setForm({ ...form, startsOn: e.target.value })}
              required
            />
          </Field>
          <Field label="Ends" hint="Leave empty while it is still running">
            <Input
              type="date"
              value={form.endsOn}
              onChange={(e) => setForm({ ...form, endsOn: e.target.value })}
            />
          </Field>
        </div>

        <Field label="Discount code" hint="Orders using this code count as the campaign's">
          <Select
            value={form.discountId}
            onChange={(e) => setForm({ ...form, discountId: e.target.value })}
            className="w-full"
          >
            <option value="">No code</option>
            {discounts.map((d) => (
              <option key={d.id} value={d.id}>
                {d.code ? `${d.code} — ${d.title}` : d.title}
              </option>
            ))}
          </Select>
        </Field>

        <Field label="Notes">
          <Textarea
            rows={2}
            value={form.notes}
            onChange={(e) => setForm({ ...form, notes: e.target.value })}
            placeholder="What you are trying, and what you expect"
          />
        </Field>
      </div>
    </Modal>
  );
}
