'use client';

import { useEffect, useState } from 'react';
import { Badge, Card, Spinner } from '@/components/ui';
import { MasterCrud, type MasterColumn } from '@/components/MasterCrud';
import { api, errorMessage } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { useToast } from '@/lib/toast';
import { cn } from '@/lib/cn';
import { COA_RULES, QC_APPLIES_TO, type CoaRule, type QcCheck, type QcReason } from '@/lib/quality';

function CoaSetting() {
  const { can } = useAuth();
  const toast = useToast();
  const editable = can('settings:write');
  const [rule, setRule] = useState<CoaRule | null>(null);
  const [saving, setSaving] = useState<CoaRule | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    let cancelled = false;
    api
      .get<{ data: { coaRequiredFor: CoaRule } }>('/quality/settings')
      .then((r) => {
        if (!cancelled) setRule(r.data.coaRequiredFor);
      })
      .catch((err) => {
        if (!cancelled) setError(errorMessage(err));
      });
    return () => {
      cancelled = true;
    };
  }, []);

  async function choose(next: CoaRule) {
    if (!editable || next === rule) return;
    setSaving(next);
    setError('');
    try {
      await api.patch('/quality/settings', { coaRequiredFor: next });
      setRule(next);
      toast.success('COA rule saved');
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setSaving(null);
    }
  }

  return (
    <Card title="Certificate of analysis (COA)">
      <p className="mb-3 text-sm text-muted-foreground">
        Which deliveries need the factory&apos;s COA uploaded before QC can accept them.
        {!editable && ' Changing this needs the settings permission.'}
      </p>
      {error && <p className="mb-3 text-sm text-destructive">{error}</p>}
      {rule === null && !error ? (
        <Spinner />
      ) : (
        <div role="radiogroup" aria-label="COA required for" className="grid gap-2 sm:grid-cols-3">
          {COA_RULES.map((option) => {
            const active = rule === option.value;
            return (
              <button
                key={option.value}
                type="button"
                role="radio"
                aria-checked={active}
                disabled={!editable || !!saving}
                onClick={() => choose(option.value)}
                className={cn(
                  'rounded-md border px-3 py-2.5 text-left transition-colors disabled:cursor-not-allowed',
                  active ? 'border-gold bg-gold-soft/60' : 'border-border bg-card hover:border-muted-foreground/40'
                )}
              >
                <span className="flex items-center gap-2 text-sm font-medium text-foreground">
                  {option.label}
                  {saving === option.value && <Spinner />}
                </span>
                <span className="mt-0.5 block text-xs text-muted-foreground">{option.hint}</span>
              </button>
            );
          })}
        </div>
      )}
    </Card>
  );
}

export function QualityTab({ canWrite }: { canWrite: boolean }) {
  const checkColumns: MasterColumn<QcCheck>[] = [
    {
      header: 'Check',
      cell: (c) => (
        <div className="min-w-48">
          <div className="font-medium text-foreground">{c.name}</div>
          {c.description && <div className="text-xs text-muted-foreground">{c.description}</div>}
        </div>
      ),
    },
    {
      header: 'For',
      className: 'whitespace-nowrap',
      cell: (c) => QC_APPLIES_TO.find((a) => a.value === c.appliesTo)?.label ?? c.appliesTo,
    },
    {
      header: 'Order',
      className: 'text-right tabular-nums',
      cell: (c) => c.position + 1,
    },
    {
      header: 'Status',
      cell: (c) => (c.isActive ? <Badge tone="green">In use</Badge> : <Badge tone="gray">Switched off</Badge>),
    },
  ];

  const reasonColumns: MasterColumn<QcReason>[] = [
    { header: 'Reason', cell: (r) => r.name },
    { header: 'Order', className: 'text-right tabular-nums', cell: (r) => r.position + 1 },
    {
      header: 'Status',
      cell: (r) => (r.isActive ? <Badge tone="green">In use</Badge> : <Badge tone="gray">Switched off</Badge>),
    },
  ];

  return (
    <div className="space-y-4">
      <CoaSetting />

      <Card title="QC checklist" padded={false} collapsible>
        <div className="p-4">
          <MasterCrud<QcCheck>
            endpoint="/quality/checks"
            singular="Checklist item"
            canWrite={canWrite}
            columns={checkColumns}
            searchOn={(c) => `${c.name} ${c.description ?? ''}`}
            sort={(a, b) => a.position - b.position}
            note="Every delivery is checked against these before it can be accepted. Products get the product checks, packaging gets the packaging checks."
            blank={{ name: '', description: '', appliesTo: 'PRODUCT', position: 0, isActive: true }}
            toForm={(c) => ({
              name: c.name,
              description: c.description ?? '',
              appliesTo: c.appliesTo,
              position: c.position,
              isActive: c.isActive,
            })}
            fields={[
              { name: 'name', label: 'Check', required: true, placeholder: 'No leakage' },
              { name: 'appliesTo', label: 'Used for', type: 'select', options: QC_APPLIES_TO },
              {
                name: 'description',
                label: 'How to check',
                type: 'textarea',
                wide: true,
                placeholder: 'Turn five bottles upside down and squeeze gently',
              },
              { name: 'position', label: 'Order', type: 'number', step: '1', hint: 'Lower numbers come first on the QC screen.' },
              { name: 'isActive', label: 'Show this check on the QC screen', type: 'checkbox' },
            ]}
          />
        </div>
      </Card>

      <Card title="Reject reasons" padded={false} collapsible>
        <div className="p-4">
          <MasterCrud<QcReason>
            endpoint="/quality/reject-reasons"
            singular="Reject reason"
            canWrite={canWrite}
            columns={reasonColumns}
            searchOn={(r) => r.name}
            sort={(a, b) => a.position - b.position}
            note="The inspector picks one of these whenever units are rejected. It is printed on the vendor credit."
            blank={{ name: '', position: 0, isActive: true }}
            toForm={(r) => ({ name: r.name, position: r.position, isActive: r.isActive })}
            fields={[
              { name: 'name', label: 'Reason', required: true, placeholder: 'Leaking or damaged' },
              { name: 'position', label: 'Order', type: 'number', step: '1' },
              { name: 'isActive', label: 'Offer this reason on the QC screen', type: 'checkbox' },
            ]}
          />
        </div>
      </Card>
    </div>
  );
}
