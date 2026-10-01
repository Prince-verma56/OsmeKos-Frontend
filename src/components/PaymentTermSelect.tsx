'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { api, errorMessage } from '@/lib/api';
import { SearchSelect } from './SearchSelect';
import { Modal } from './Modal';
import { Button, ErrorBox, Field, Input, Spinner } from './ui';

export type PaymentTerm = {
  id: string;
  name: string;
  code: string;
  days: number;
  isDefault: boolean;
  isSystem: boolean;
  isActive: boolean;
};

export function PaymentTermSelect({
  value,
  onChange,
  onTermChange,
  className = '',
  reloadKey = 0,
}: {
  value: string;
  onChange: (code: string) => void;
  onTermChange?: (term: PaymentTerm) => void;
  className?: string;
  reloadKey?: number;
}) {
  const [terms, setTerms] = useState<PaymentTerm[]>([]);
  const [adding, setAdding] = useState(false);
  const [draft, setDraft] = useState({ name: '', days: '' });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [version, setVersion] = useState(0);

  useEffect(() => {
    let cancelled = false;
    api
      .get<{ data: PaymentTerm[] }>('/payment-terms')
      .then((r) => {
        if (!cancelled) setTerms(r.data);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [version, reloadKey]);

  const pick = useCallback(
    (code: string) => {
      onChange(code);
      const term = terms.find((t) => t.code === code);
      if (term) onTermChange?.(term);
    },
    [onChange, onTermChange, terms]
  );

  async function save() {
    const name = draft.name.trim();
    if (!name) {
      setError('Give the term a name');
      return;
    }
    setBusy(true);
    setError('');
    try {
      const res = await api.post<{ data: PaymentTerm }>('/payment-terms', {
        name,
        days: Number(draft.days || 0),
      });
      setAdding(false);
      setDraft({ name: '', days: '' });
      setVersion((v) => v + 1);
      onChange(res.data.code);
      onTermChange?.(res.data);
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  const options = terms.map((t) => ({
    value: t.code,
    label: t.name,
    hint: t.days > 0 ? `Due in ${t.days} days` : 'Due before supply',
  }));
  if (value && !terms.some((t) => t.code === value)) {
    options.push({ value, label: value.replaceAll('_', ' '), hint: 'No longer offered' });
  }

  return (
    <>
      <SearchSelect
        value={value}
        options={options}
        onChange={pick}
        placeholder="Select a term"
        searchPlaceholder="Search"
        emptyMessage="No payment terms found"
        action={{ label: '+ New Payment Term', onClick: () => setAdding(true) }}
        className={className}
      />

      <Modal
        open={adding}
        onClose={() => setAdding(false)}
        title="New Payment Term"
        footer={
          <>
            <Button variant="ghost" onClick={() => setAdding(false)}>Cancel</Button>
            <Button variant="primary" onClick={save} disabled={busy}>
              {busy && <Spinner />}
              Save
            </Button>
          </>
        }
      >
        {error && <div className="mb-3"><ErrorBox message={error} /></div>}
        <div className="space-y-4">
          <Field label="Term Name" required hint="Shown on the document, e.g. Net 7">
            <Input
              value={draft.name}
              onChange={(e) => setDraft({ ...draft, name: e.target.value })}
              placeholder="Net 7"
            />
          </Field>
          <Field
            label="Number of Days"
            hint="How long after the document date payment is due. Leave at 0 for advance terms."
          >
            <Input
              type="number"
              min="0"
              max="365"
              value={draft.days}
              onChange={(e) => setDraft({ ...draft, days: e.target.value })}
              placeholder="0"
              className="w-32"
            />
          </Field>
        </div>
      </Modal>
    </>
  );
}

export function usePaymentTerms() {
  const [terms, setTerms] = useState<PaymentTerm[]>([]);

  useEffect(() => {
    let cancelled = false;
    api
      .get<{ data: PaymentTerm[] }>('/payment-terms', { includeInactive: true })
      .then((r) => {
        if (!cancelled) setTerms(r.data);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);

  const label = useCallback(
    (code: string) =>
      terms.find((t) => t.code === code)?.name ??
      code.replaceAll('_', ' ').replace(/\bPCT\b/, '%'),
    [terms]
  );

  return { terms, label };
}

export function dueDateFrom(startDate: string, days: number): string {
  if (!startDate) return '';
  const d = new Date(startDate);
  if (Number.isNaN(d.getTime())) return '';
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

export function useDefaultPaymentTerm(onLoad?: (code: string) => void, enabled = true) {
  const [code, setCode] = useState<string | null>(null);
  const onLoadRef = useRef(onLoad);
  useEffect(() => {
    onLoadRef.current = onLoad;
  });
  useEffect(() => {
    if (!enabled) return;
    let cancelled = false;
    api
      .get<{ data: PaymentTerm[]; meta?: { defaultCode?: string | null } }>('/payment-terms')
      .then((r) => {
        const found = r.meta?.defaultCode ?? null;
        if (cancelled || !found) return;
        setCode(found);
        onLoadRef.current?.(found);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [enabled]);
  return code;
}
