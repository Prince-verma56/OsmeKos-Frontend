'use client';

import { useCallback, useEffect, useState } from 'react';
import { api, errorMessage } from '@/lib/api';
import { useToast } from '@/lib/toast';
import { Button, Card, ErrorBox, Input, Loading, Table, Td, Th } from '@/components/ui';

type Row = {
  key: string;
  label: string;
  prefix: string;
  suffix: string;
  nextNumber: number;
  padding: number;
  preview: string;
  fiscalYear?: string;
};

type Draft = { prefix: string; suffix: string; nextNumber: string; padding: string };

const fyNow = () => {
  const d = new Date();
  const start = d.getMonth() < 3 ? d.getFullYear() - 1 : d.getFullYear();
  return `${String(start).slice(-2)}-${String(start + 1).slice(-2)}`;
};

const previewOf = (d: Draft, fy: string) => {
  const fill = (v: string) => v.replaceAll('{FY}', fy);
  const n = Math.max(1, Math.floor(Number(d.nextNumber) || 1));
  const pad = Math.min(10, Math.max(1, Math.floor(Number(d.padding) || 1)));
  return `${fill(d.prefix)}${String(n).padStart(pad, '0')}${fill(d.suffix)}`;
};

export function DocumentNumbersTab({ canWrite }: { canWrite: boolean }) {
  const toast = useToast();
  const [rows, setRows] = useState<Row[]>([]);
  const [drafts, setDrafts] = useState<Record<string, Draft>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState('');
  const fy = rows[0]?.fiscalYear ?? fyNow();

  const load = useCallback(async () => {
    setError('');
    try {
      const r = await api.get<{ data: Row[] }>('/sales/document-numbers');
      setRows(r.data);
      setDrafts(
        Object.fromEntries(
          r.data.map((x) => [
            x.key,
            { prefix: x.prefix, suffix: x.suffix, nextNumber: String(x.nextNumber), padding: String(x.padding) },
          ])
        )
      );
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

  const setDraft = (key: string, patch: Partial<Draft>) =>
    setDrafts((d) => ({ ...d, [key]: { ...d[key], ...patch } }));

  const changed = (r: Row) => {
    const d = drafts[r.key];
    return (
      !!d &&
      (d.prefix !== r.prefix ||
        d.suffix !== r.suffix ||
        Number(d.nextNumber) !== r.nextNumber ||
        Number(d.padding) !== r.padding)
    );
  };

  async function save(r: Row) {
    const d = drafts[r.key];
    setSaving(r.key);
    setError('');
    try {
      await api.patch(`/sales/document-numbers/${r.key}`, {
        prefix: d.prefix,
        suffix: d.suffix,
        nextNumber: Number(d.nextNumber),
        padding: Number(d.padding),
      });
      toast.success(`${r.label} numbering saved`);
      await load();
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setSaving('');
    }
  }

  return (
    <Card title="Document numbers" padded={false} collapsible>
      <p className="px-4 pt-3 text-xs text-muted-foreground">
        How each document is numbered. Use <span className="font-mono">{'{FY}'}</span> in the prefix for the
        financial year, e.g. <span className="font-mono">INV/{'{FY}'}/</span> gives{' '}
        <span className="font-mono">INV/{fy}/001</span>. A single invoice can still be given its own number
        on the invoice form.
      </p>
      {error && (
        <div className="px-4 pt-3">
          <ErrorBox message={error} />
        </div>
      )}
      {loading ? (
        <Loading />
      ) : (
        <Table minWidth="760px">
          <thead>
            <tr>
              <Th>Document</Th>
              <Th>Prefix</Th>
              <Th className="text-right">Next number</Th>
              <Th className="text-right">Digits</Th>
              <Th>Suffix</Th>
              <Th>Next one will be</Th>
              <Th />
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => {
              const d = drafts[r.key];
              if (!d) return null;
              return (
                <tr key={r.key}>
                  <Td className="font-medium">{r.label}</Td>
                  <Td>
                    <Input
                      value={d.prefix}
                      onChange={(e) => setDraft(r.key, { prefix: e.target.value })}
                      className="w-36 font-mono text-xs"
                      disabled={!canWrite}
                      aria-label={`${r.label} prefix`}
                    />
                  </Td>
                  <Td>
                    <Input
                      type="number" min="1" step="1"
                      value={d.nextNumber}
                      onChange={(e) => setDraft(r.key, { nextNumber: e.target.value })}
                      className="w-24 text-right"
                      disabled={!canWrite}
                      aria-label={`${r.label} next number`}
                    />
                  </Td>
                  <Td>
                    <Input
                      type="number" min="1" max="10" step="1"
                      value={d.padding}
                      onChange={(e) => setDraft(r.key, { padding: e.target.value })}
                      className="w-16 text-right"
                      disabled={!canWrite}
                      aria-label={`${r.label} digits`}
                    />
                  </Td>
                  <Td>
                    <Input
                      value={d.suffix}
                      onChange={(e) => setDraft(r.key, { suffix: e.target.value })}
                      className="w-24 font-mono text-xs"
                      disabled={!canWrite}
                      aria-label={`${r.label} suffix`}
                    />
                  </Td>
                  <Td className="whitespace-nowrap font-mono text-xs">{previewOf(d, fy)}</Td>
                  <Td>
                    {canWrite && changed(r) && (
                      <Button size="sm" variant="primary" disabled={saving === r.key} onClick={() => save(r)}>
                        Save
                      </Button>
                    )}
                  </Td>
                </tr>
              );
            })}
          </tbody>
        </Table>
      )}
    </Card>
  );
}
