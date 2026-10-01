'use client';

import { useEffect, useState } from 'react';
import { api, errorMessage } from '@/lib/api';
import { SearchSelect, type SearchOption } from './SearchSelect';
import { Modal } from './Modal';
import { Button, Field, Input, Select, Textarea } from './ui';

export type Account = {
  id: string;
  name: string;
  code: string | null;
  type: string;
  parentId: string | null;
  isSystem: boolean;
  isActive: boolean;
};

type AccountGroup = { type: string; label: string; accounts: Account[] };
type AccountType = { value: string; label: string };

export function AccountSelect({
  value,
  onChange,
  usage = 'purchase',
  className = '',
  placeholder = 'Select an account',
}: {
  value: string;
  onChange: (name: string) => void;
  usage?: 'purchase' | 'sales' | 'inventory' | 'payment' | 'deposit';
  className?: string;
  placeholder?: string;
}) {
  const [groups, setGroups] = useState<AccountGroup[]>([]);
  const [types, setTypes] = useState<AccountType[]>([]);
  const [adding, setAdding] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [draft, setDraft] = useState({ name: '', type: '', description: '' });

  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await api.get<{
          data: Account[];
          meta: { groups: AccountGroup[]; types: AccountType[] };
        }>('/accounts', { usage });
        if (cancelled) return;
        setGroups(res.meta.groups);
        setTypes(res.meta.types);
      } catch {
        if (!cancelled) setGroups([]);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [usage, reloadKey]);

  const options: SearchOption[] = groups.flatMap((g) =>
    g.accounts.map((a) => ({
      value: a.name,
      label: a.name,
      group: g.label,
      nested: !!a.parentId,
    }))
  );

  if (value && !options.some((o) => o.value === value)) {
    options.unshift({ value, label: value, group: 'On this line' });
  }

  async function createAccount() {
    setError('');
    if (!draft.name.trim()) return setError('Enter an account name');
    if (!draft.type) return setError('Pick an account type');

    setSaving(true);
    try {
      const res = await api.post<{ data: Account }>('/accounts', {
        name: draft.name.trim(),
        type: draft.type,
        description: draft.description.trim() || undefined,
      });
      onChange(res.data.name);
      setReloadKey((k) => k + 1);
      setAdding(false);
      setDraft({ name: '', type: '', description: '' });
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
      <SearchSelect
        value={value}
        options={options}
        onChange={onChange}
        placeholder={placeholder}
        searchPlaceholder="Search accounts"
        emptyMessage="No accounts found"
        className={className}
        action={{ label: '+ New Account', onClick: () => setAdding(true) }}
      />

      <Modal
        open={adding}
        onClose={() => setAdding(false)}
        title="New Account"
        footer={
          <>
            <Button type="button" onClick={() => setAdding(false)} disabled={saving}>
              Cancel
            </Button>
            <Button type="button" variant="primary" onClick={createAccount} disabled={saving}>
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
          <Field label="Account Type" required>
            <Select
              value={draft.type}
              onChange={(e) => setDraft({ ...draft, type: e.target.value })}
              className="w-full"
            >
              <option value="">Select a type…</option>
              {types.map((t) => (
                <option key={t.value} value={t.value}>{t.label}</option>
              ))}
            </Select>
          </Field>
          <Field label="Account Name" required>
            <Input
              value={draft.name}
              onChange={(e) => setDraft({ ...draft, name: e.target.value })}
              placeholder="Freight and Forwarding"
              autoFocus
            />
          </Field>
          <Field label="Description">
            <Textarea
              rows={2}
              value={draft.description}
              onChange={(e) => setDraft({ ...draft, description: e.target.value })}
            />
          </Field>
        </div>
      </Modal>
    </>
  );
}
