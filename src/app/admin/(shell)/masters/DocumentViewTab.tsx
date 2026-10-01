'use client';

import { useEffect, useState } from 'react';
import { Card, ErrorBox, Loading } from '@/components/ui';
import { errorMessage } from '@/lib/api';
import { useToast } from '@/lib/toast';
import { PDF_DOC_TYPES, loadPdfDefaults, savePdfDefault, type PdfDocType } from '@/lib/pdfView';

export function DocumentViewTab({ canWrite }: { canWrite: boolean }) {
  const toast = useToast();
  const [values, setValues] = useState<Record<string, boolean> | null>(null);
  const [saving, setSaving] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    let dropped = false;
    loadPdfDefaults(true).then((saved) => {
      if (dropped) return;
      setValues(
        Object.fromEntries(PDF_DOC_TYPES.map((d) => [d.key, saved[d.key] ?? d.fallback]))
      );
    });
    return () => {
      dropped = true;
    };
  }, []);

  async function toggle(key: PdfDocType, on: boolean) {
    setValues((v) => ({ ...(v ?? {}), [key]: on }));
    setSaving(key);
    setError('');
    try {
      await savePdfDefault(key, on);
      toast.success('Saved');
    } catch (err) {
      setValues((v) => ({ ...(v ?? {}), [key]: !on }));
      setError(errorMessage(err));
    } finally {
      setSaving('');
    }
  }

  return (
    <Card title="Which documents open as a PDF">
      <p className="mb-3 text-sm text-muted-foreground">
        A document set to PDF view opens looking like the printed copy. Switched off, it opens as
        the working screen with the buttons and tables. Anyone can still flip the switch on the
        page itself.
      </p>
      {error && <div className="mb-3"><ErrorBox message={error} /></div>}
      {!values ? (
        <Loading />
      ) : (
        <ul className="divide-y divide-border">
          {PDF_DOC_TYPES.map((d) => (
            <li key={d.key} className="flex items-center justify-between gap-4 py-2.5">
              <div>
                <div className="text-sm font-medium text-foreground">{d.label}</div>
                <div className="text-xs text-muted-foreground">
                  {values[d.key] ? 'Opens as a PDF' : 'Opens as the working screen'}
                </div>
              </div>
              <label className="inline-flex cursor-pointer items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={!!values[d.key]}
                  disabled={!canWrite || saving === d.key}
                  onChange={(e) => toggle(d.key, e.target.checked)}
                />
                PDF view
              </label>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}
