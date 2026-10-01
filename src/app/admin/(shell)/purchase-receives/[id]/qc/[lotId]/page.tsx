'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { Camera, Check, FileText, ShieldCheck, Upload, X } from 'lucide-react';
import { api, API_BASE, authHeader, errorMessage, shortDate } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { useToast } from '@/lib/toast';
import { cn } from '@/lib/cn';
import { PageCrumb } from '@/lib/crumbs';
import { Badge, Button, Card, ErrorBox, Loading, PageHeader, Spinner, Textarea } from '@/components/ui';
import { SaveBar } from '@/components/form/SaveBar';
import { Stepper } from '@/components/Stepper';
import { fmtQty, lotStatusOf, type LotStatus, type QcCheck, type QcReason, type QcResult } from '@/lib/quality';

type UploadedFile = { url: string; fileName: string; mimeType: string; sizeBytes: number };

type Inspection = {
  id: string;
  inspectionNumber: string;
  status: 'COMPLETED' | 'VOIDED';
  quantityInspected: string;
  quantityAccepted: string;
  quantityRejected: string;
  sampleSize: number | null;
  rejectReason: string | null;
  notes: string | null;
  photoUrls: string[];
  inspectedAt: string;
  voidReason: string | null;
  inspectedBy: { id: string; name: string } | null;
  coa: { id: string; fileName: string; fileUrl: string } | null;
  lines: { id: string; label: string; result: QcResult; notes: string | null }[];
};

type Lot = {
  id: string;
  batchNo: string | null;
  mfgDate: string | null;
  expiryDate: string | null;
  artworkVersion: string | null;
  status: LotStatus;
  quantityReceived: string;
  quantityRemaining: string;
  needsLabelling: boolean;
  labelledAt: string | null;
  item: { id: string; name: string; sku: string | null; unit: string; itemCategory: string; imageUrls: string[] };
  vendor: { id: string; displayName: string } | null;
  receive: { id: string; receiveNumber: string; receiveDate: string; purchaseOrder: { id: string; poNumber: string } | null } | null;
  location: { id: string; name: string } | null;
  coa: { id: string; fileName: string; fileUrl: string } | null;
  inspections: Inspection[];
  checks: QcCheck[];
  reasons: QcReason[];
  qcGroup: 'PRODUCT' | 'PACKAGING';
  batchTracked: boolean;
  coaRequired: boolean;
};

const RESULTS: { value: QcResult; label: string; active: string }[] = [
  { value: 'PASS', label: 'Pass', active: 'border-success bg-success text-white dark:text-background' },
  { value: 'FAIL', label: 'Fail', active: 'border-destructive bg-destructive text-white dark:text-background' },
  { value: 'NOT_APPLICABLE', label: 'N/A', active: 'border-foreground/60 bg-muted text-foreground' },
];

async function uploadFiles(files: FileList, many: boolean): Promise<UploadedFile[]> {
  const body = new FormData();
  if (many) for (const f of Array.from(files).slice(0, 10)) body.append('files', f);
  else body.append('file', files[0]);
  const res = await fetch(`${API_BASE}/uploads${many ? '/many' : ''}`, { method: 'POST', headers: authHeader(), body });
  const json = await res.json().catch(() => null);
  if (!res.ok) throw new Error(json?.message ?? `Upload failed (${res.status})`);
  return Array.isArray(json.data) ? json.data : [json.data];
}

function PastInspection({ inspection, receiptId }: { inspection: Inspection; receiptId: string }) {
  const accepted = Number(inspection.quantityAccepted);
  const rejected = Number(inspection.quantityRejected);
  return (
    <Card title={`${inspection.inspectionNumber}${inspection.status === 'VOIDED' ? ' · undone' : ''}`}>
      <div className="grid gap-3 text-sm sm:grid-cols-3">
        <div>
          <div className="text-xs text-muted-foreground">Accepted</div>
          <div className="text-xl font-medium tabular-nums text-success">{fmtQty(accepted)}</div>
        </div>
        <div>
          <div className="text-xs text-muted-foreground">Rejected</div>
          <div className="text-xl font-medium tabular-nums text-destructive">{fmtQty(rejected)}</div>
          {inspection.rejectReason && <div className="text-xs text-muted-foreground">{inspection.rejectReason}</div>}
        </div>
        <div>
          <div className="text-xs text-muted-foreground">Checked</div>
          <div className="text-foreground">{shortDate(inspection.inspectedAt)}</div>
          <div className="text-xs text-muted-foreground">
            {inspection.inspectedBy?.name ?? 'Staff'}
            {inspection.sampleSize ? ` · sample of ${inspection.sampleSize}` : ''}
          </div>
        </div>
      </div>
      {inspection.lines.length > 0 && (
        <ul className="mt-4 divide-y divide-border rounded-md border border-border">
          {inspection.lines.map((l) => (
            <li key={l.id} className="flex items-start justify-between gap-3 px-3 py-2 text-sm">
              <span className="min-w-0">
                {l.label}
                {l.notes && <span className="block text-xs text-muted-foreground">{l.notes}</span>}
              </span>
              <Badge tone={l.result === 'PASS' ? 'green' : l.result === 'FAIL' ? 'red' : 'gray'}>
                {RESULTS.find((r) => r.value === l.result)?.label}
              </Badge>
            </li>
          ))}
        </ul>
      )}
      {(inspection.coa || inspection.photoUrls.length > 0 || inspection.notes) && (
        <div className="mt-4 space-y-2 text-sm">
          {inspection.coa && (
            <a href={inspection.coa.fileUrl} target="_blank" rel="noreferrer noopener" className="inline-flex items-center gap-1.5 text-gold-ink hover:underline">
              <FileText className="size-4" strokeWidth={1.5} /> {inspection.coa.fileName}
            </a>
          )}
          {inspection.notes && <p className="whitespace-pre-line text-muted-foreground">{inspection.notes}</p>}
          {inspection.photoUrls.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {inspection.photoUrls.map((url) => (
                <a key={url} href={url} target="_blank" rel="noreferrer noopener">
                  <img src={url} alt="QC photo" className="size-20 rounded-md border border-border object-cover" />
                </a>
              ))}
            </div>
          )}
        </div>
      )}
      {inspection.status === 'VOIDED' && inspection.voidReason && (
        <p className="mt-3 text-xs text-muted-foreground">Undone: {inspection.voidReason}</p>
      )}
      {inspection.status === 'COMPLETED' && (
        <p className="mt-4 text-xs text-muted-foreground">
          To change this result, use <strong>Undo QC</strong> on the{' '}
          <Link href={`/admin/purchase-receives/${receiptId}`} className="text-gold-ink hover:underline">receipt</Link>.
        </p>
      )}
    </Card>
  );
}

export default function QcInspectionPage() {
  const { id, lotId } = useParams<{ id: string; lotId: string }>();
  const router = useRouter();
  const toast = useToast();
  const { can } = useAuth();
  const canInspect = can('qc:write');

  const [lot, setLot] = useState<Lot | null>(null);
  const [error, setError] = useState('');
  const [saveError, setSaveError] = useState('');
  const [saving, setSaving] = useState(false);
  const [touched, setTouched] = useState(false);

  const [results, setResults] = useState<Record<string, { result?: QcResult; notes: string }>>({});
  const [sampleSize, setSampleSize] = useState(0);
  const [accepted, setAccepted] = useState(0);
  const [reasonId, setReasonId] = useState('');
  const [notes, setNotes] = useState('');
  const [photos, setPhotos] = useState<UploadedFile[]>([]);
  const [coa, setCoa] = useState<UploadedFile | null>(null);
  const [uploading, setUploading] = useState<'' | 'photos' | 'coa'>('');
  const photoInput = useRef<HTMLInputElement>(null);
  const coaInput = useRef<HTMLInputElement>(null);

  useEffect(() => {
    let cancelled = false;
    api
      .get<{ data: Lot }>(`/quality/lots/${lotId}`)
      .then((r) => {
        if (cancelled) return;
        setLot(r.data);
        const total = Number(r.data.quantityRemaining);
        setAccepted(total);
        setSampleSize(Math.min(total, Math.max(1, Math.ceil(Math.sqrt(total)) + 1)));
      })
      .catch((err) => {
        if (!cancelled) setError(errorMessage(err));
      });
    return () => {
      cancelled = true;
    };
  }, [lotId]);

  const total = lot ? Number(lot.quantityRemaining) : 0;
  const rejected = Math.max(0, total - accepted);
  const unanswered = useMemo(() => (lot?.checks ?? []).filter((c) => !results[c.id]?.result), [lot, results]);
  const failed = (lot?.checks ?? []).filter((c) => results[c.id]?.result === 'FAIL');
  const needsCoa = !!lot?.coaRequired && accepted > 0 && !coa && !lot.coa;

  const problems = [
    unanswered.length > 0 && `${unanswered.length} checklist item${unanswered.length === 1 ? '' : 's'} still open`,
    rejected > 0 && !reasonId && 'pick a reason for the rejected units',
    needsCoa && 'upload the COA',
    sampleSize > total && 'the sample is bigger than the delivery',
  ].filter(Boolean) as string[];

  const touch = () => setTouched(true);

  function setResult(checkId: string, result: QcResult) {
    touch();
    setResults((r) => ({ ...r, [checkId]: { notes: r[checkId]?.notes ?? '', result } }));
  }

  async function onPhotos(files: FileList | null) {
    if (!files?.length) return;
    setUploading('photos');
    setSaveError('');
    try {
      const added = await uploadFiles(files, true);
      setPhotos((p) => [...p, ...added].slice(0, 12));
      touch();
    } catch (err) {
      setSaveError(errorMessage(err));
    } finally {
      setUploading('');
      if (photoInput.current) photoInput.current.value = '';
    }
  }

  async function onCoa(files: FileList | null) {
    if (!files?.length) return;
    setUploading('coa');
    setSaveError('');
    try {
      const [file] = await uploadFiles(files, false);
      setCoa(file);
      touch();
    } catch (err) {
      setSaveError(errorMessage(err));
    } finally {
      setUploading('');
      if (coaInput.current) coaInput.current.value = '';
    }
  }

  async function save() {
    if (!lot || problems.length) return;
    setSaving(true);
    setSaveError('');
    try {
      const res = await api.post<{ message: string }>('/quality/inspections', {
        lotId: lot.id,
        sampleSize: sampleSize > 0 ? sampleSize : null,
        quantityAccepted: accepted,
        quantityRejected: rejected,
        rejectReasonId: rejected > 0 ? reasonId : null,
        checks: lot.checks.map((c) => ({
          checkId: c.id,
          result: results[c.id]?.result,
          notes: results[c.id]?.notes?.trim() || null,
        })),
        notes: notes.trim() || null,
        photoUrls: photos.map((p) => p.url),
        coa: coa ? { url: coa.url, fileName: coa.fileName, mimeType: coa.mimeType, sizeBytes: coa.sizeBytes } : null,
      });
      setTouched(false);
      toast.success(res.message ?? 'QC saved');
      router.push(`/admin/purchase-receives/${id}`);
    } catch (err) {
      setSaveError(errorMessage(err));
      setSaving(false);
    }
  }

  if (error) return <ErrorBox message={error} />;
  if (!lot) return <Loading />;

  const status = lotStatusOf(lot.status);
  const batchLabel = lot.batchNo ? `Batch ${lot.batchNo}` : 'Delivery';
  const pending = lot.status === 'PENDING_QC';
  const image = lot.item.imageUrls?.[0];

  return (
    <>
      <PageCrumb label={`QC · ${lot.batchNo ?? lot.item.name}`} />
      <PageHeader
        eyebrow="Quality check"
        title={lot.item.name}
        subtitle={[
          batchLabel,
          `${fmtQty(lot.quantityRemaining)} ${lot.item.unit}`,
          lot.vendor?.displayName && `from ${lot.vendor.displayName}`,
        ]
          .filter(Boolean)
          .join(' · ')}
        actions={<Badge tone={status.tone}>{status.label}</Badge>}
      />

      <div className="mb-5 flex flex-wrap items-center gap-4 rounded-lg border border-border bg-card p-4 shadow-xs">
        {image ? (
          <img src={image} alt="" className="size-16 shrink-0 rounded-md border border-border object-cover" />
        ) : (
          <div className="flex size-16 shrink-0 items-center justify-center rounded-md border border-border bg-muted">
            <ShieldCheck className="size-6 text-muted-foreground" strokeWidth={1.5} />
          </div>
        )}
        <dl className="grid flex-1 grid-cols-2 gap-x-6 gap-y-2 text-sm sm:grid-cols-4">
          <div>
            <dt className="text-xs text-muted-foreground">Receipt</dt>
            <dd>
              {lot.receive ? (
                <Link href={`/admin/purchase-receives/${lot.receive.id}`} className="font-mono text-gold-ink hover:underline">
                  {lot.receive.receiveNumber}
                </Link>
              ) : (
                '—'
              )}
            </dd>
          </div>
          {lot.qcGroup === 'PACKAGING' ? (
            <div>
              <dt className="text-xs text-muted-foreground">Artwork</dt>
              <dd>{lot.artworkVersion ?? '—'}</dd>
            </div>
          ) : (
            <div>
              <dt className="text-xs text-muted-foreground">Mfg date</dt>
              <dd>{lot.mfgDate ? shortDate(lot.mfgDate) : '—'}</dd>
            </div>
          )}
          <div>
            <dt className="text-xs text-muted-foreground">Expiry</dt>
            <dd>{lot.expiryDate ? shortDate(lot.expiryDate) : lot.qcGroup === 'PACKAGING' ? 'None' : '—'}</dd>
          </div>
          <div>
            <dt className="text-xs text-muted-foreground">Into</dt>
            <dd>{lot.location?.name ?? '—'}</dd>
          </div>
        </dl>
      </div>

      {!pending && (
        <div className="space-y-4">
          {lot.inspections.length === 0 ? (
            <Card>
              <p className="text-sm text-muted-foreground">This batch is {status.label.toLowerCase()} and was not checked on a QC screen.</p>
            </Card>
          ) : (
            lot.inspections.map((i) => <PastInspection key={i.id} inspection={i} receiptId={id} />)
          )}
          <Link href={`/admin/purchase-receives/${id}`}>
            <Button variant="ghost">Back to receipt</Button>
          </Link>
        </div>
      )}

      {pending && !canInspect && (
        <Card>
          <p className="text-sm text-muted-foreground">
            This batch is waiting for QC. Your role can view it but not record the result - ask someone with the QC permission.
          </p>
        </Card>
      )}

      {pending && canInspect && (
        <div className="space-y-5">
          <Card
            title="Checklist"
            action={
              lot.checks.length > 0 ? (
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => {
                    touch();
                    setResults((r) =>
                      Object.fromEntries(lot.checks.map((c) => [c.id, { notes: r[c.id]?.notes ?? '', result: r[c.id]?.result ?? 'PASS' }]))
                    );
                  }}
                >
                  <Check /> Pass the rest
                </Button>
              ) : null
            }
          >
            {lot.checks.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                No checklist items for {lot.qcGroup === 'PACKAGING' ? 'labels and packaging' : 'products'} yet. Add them under Masters → Quality control.
              </p>
            ) : (
              <ol className="divide-y divide-border">
                {lot.checks.map((c, i) => {
                  const current = results[c.id];
                  return (
                    <li key={c.id} className="py-3 first:pt-0 last:pb-0">
                      <div className="flex flex-wrap items-center gap-3">
                        <div className="min-w-0 flex-1 basis-56">
                          <div className="text-[15px] font-medium text-foreground">
                            <span className="mr-2 tabular-nums text-muted-foreground">{i + 1}.</span>
                            {c.name}
                          </div>
                          {c.description && <p className="mt-0.5 text-sm text-muted-foreground">{c.description}</p>}
                        </div>
                        <div role="radiogroup" aria-label={c.name} className="flex gap-2">
                          {RESULTS.map((r) => {
                            const on = current?.result === r.value;
                            return (
                              <button
                                key={r.value}
                                type="button"
                                role="radio"
                                aria-checked={on}
                                onClick={() => setResult(c.id, r.value)}
                                className={cn(
                                  'h-11 min-w-[4.5rem] rounded-lg border px-3 text-sm font-medium transition-colors',
                                  on ? r.active : 'border-input bg-card text-foreground hover:bg-muted'
                                )}
                              >
                                {r.label}
                              </button>
                            );
                          })}
                        </div>
                      </div>
                      {current?.result === 'FAIL' && (
                        <input
                          value={current.notes}
                          onChange={(e) => {
                            touch();
                            setResults((rs) => ({ ...rs, [c.id]: { ...rs[c.id], notes: e.target.value } }));
                          }}
                          placeholder="What was wrong? e.g. 6 of 20 bottles leaked at the pump"
                          aria-label={`What failed on ${c.name}`}
                          className="mt-2.5 h-11 w-full rounded-lg border border-destructive/40 bg-card px-3 text-sm text-foreground outline-none focus:border-destructive"
                        />
                      )}
                    </li>
                  );
                })}
              </ol>
            )}
          </Card>

          <Card title="Result">
            <div className="grid gap-4 md:grid-cols-3">
              <Stepper
                label="Sample checked"
                value={sampleSize}
                max={total}
                onChange={(v) => {
                  touch();
                  setSampleSize(v);
                }}
                hint={`of ${fmtQty(total)}`}
              />
              <Stepper
                label="Accepted"
                value={accepted}
                max={total}
                tone="success"
                onChange={(v) => {
                  touch();
                  setAccepted(v);
                }}
              />
              <Stepper
                label="Rejected"
                value={rejected}
                max={total}
                tone="destructive"
                onChange={(v) => {
                  touch();
                  setAccepted(total - v);
                }}
              />
            </div>
            <div className="mt-3 flex flex-wrap gap-2">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  touch();
                  setAccepted(total);
                }}
              >
                Accept all {fmtQty(total)}
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  touch();
                  setAccepted(0);
                }}
              >
                Reject all
              </Button>
              {failed.length > 0 && rejected === 0 && (
                <span className="self-center text-xs text-warning">
                  {failed.length} check{failed.length === 1 ? '' : 's'} failed but nothing is rejected
                </span>
              )}
            </div>

            {rejected > 0 && (
              <div className="mt-5">
                <div className="mb-2 text-sm font-medium text-foreground">
                  Why were {fmtQty(rejected)} rejected? <span className="text-destructive">*</span>
                </div>
                <div role="radiogroup" aria-label="Reject reason" className="flex flex-wrap gap-2">
                  {lot.reasons.map((r) => (
                    <button
                      key={r.id}
                      type="button"
                      role="radio"
                      aria-checked={reasonId === r.id}
                      onClick={() => {
                        touch();
                        setReasonId(r.id);
                      }}
                      className={cn(
                        'h-11 rounded-full border px-4 text-sm transition-colors',
                        reasonId === r.id
                          ? 'border-destructive bg-destructive/10 font-medium text-destructive'
                          : 'border-input bg-card text-foreground hover:bg-muted'
                      )}
                    >
                      {r.name}
                    </button>
                  ))}
                </div>
                {lot.reasons.length === 0 && (
                  <p className="text-sm text-warning">No reject reasons are set up. Add them under Masters → Quality control.</p>
                )}
              </div>
            )}
          </Card>

          <div className="grid gap-5 lg:grid-cols-2">
            <Card title="Photos">
              <input
                ref={photoInput}
                type="file"
                accept="image/*"
                capture="environment"
                multiple
                className="hidden"
                onChange={(e) => onPhotos(e.target.files)}
                data-no-dirty
              />
              <button
                type="button"
                onClick={() => photoInput.current?.click()}
                disabled={!!uploading || photos.length >= 12}
                className="flex h-16 w-full items-center justify-center gap-2 rounded-lg border border-dashed border-input bg-card text-sm font-medium text-foreground hover:bg-muted disabled:opacity-50"
              >
                {uploading === 'photos' ? <Spinner /> : <Camera className="size-5" strokeWidth={1.5} />}
                Take or add photos
              </button>
              {photos.length > 0 && (
                <div className="mt-3 flex flex-wrap gap-2">
                  {photos.map((p) => (
                    <div key={p.url} className="relative">
                      <img src={p.url} alt={p.fileName} className="size-20 rounded-md border border-border object-cover" />
                      <button
                        type="button"
                        onClick={() => setPhotos((all) => all.filter((x) => x.url !== p.url))}
                        className="absolute -right-2 -top-2 flex size-7 items-center justify-center rounded-full border border-border bg-card text-foreground shadow-sm"
                        aria-label={`Remove ${p.fileName}`}
                      >
                        <X className="size-3.5" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
              <p className="mt-2 text-xs text-muted-foreground">Leaks, damage or print faults - up to 12 photos.</p>
            </Card>

            <Card
              title="Certificate of analysis"
              action={
                lot.coaRequired ? (
                  <Badge tone={needsCoa ? 'amber' : 'green'}>{needsCoa ? 'Needed to accept' : 'Required'}</Badge>
                ) : (
                  <Badge tone="gray">Optional</Badge>
                )
              }
            >
              <input
                ref={coaInput}
                type="file"
                accept="application/pdf,image/*"
                className="hidden"
                onChange={(e) => onCoa(e.target.files)}
                data-no-dirty
              />
              {coa || lot.coa ? (
                <div className="flex items-center gap-3 rounded-lg border border-border bg-muted/40 px-3 py-3">
                  <FileText className="size-5 shrink-0 text-gold-ink" strokeWidth={1.5} />
                  <a
                    href={(coa?.url ?? lot.coa?.fileUrl) as string}
                    target="_blank"
                    rel="noreferrer noopener"
                    className="min-w-0 flex-1 truncate text-sm text-gold-ink hover:underline"
                  >
                    {coa?.fileName ?? lot.coa?.fileName}
                  </a>
                  <Button size="sm" variant="ghost" onClick={() => coaInput.current?.click()} disabled={!!uploading}>
                    Replace
                  </Button>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => coaInput.current?.click()}
                  disabled={!!uploading}
                  className={cn(
                    'flex h-16 w-full items-center justify-center gap-2 rounded-lg border border-dashed bg-card text-sm font-medium text-foreground hover:bg-muted disabled:opacity-50',
                    needsCoa ? 'border-warning/60' : 'border-input'
                  )}
                >
                  {uploading === 'coa' ? <Spinner /> : <Upload className="size-5" strokeWidth={1.5} />}
                  Upload the COA (PDF or photo)
                </button>
              )}
              <p className="mt-2 text-xs text-muted-foreground">
                {lot.coaRequired
                  ? 'The factory’s certificate for this batch. Needed before any units can be accepted.'
                  : 'Attach it if the vendor sent one.'}
              </p>
            </Card>
          </div>

          {lot.needsLabelling && !lot.labelledAt && (
            <p className="rounded-md border border-gold/30 bg-gold-soft/60 px-3 py-2 text-sm text-foreground">
              These units arrived unlabelled. After QC, mark them labelled on the receipt or batch page to make them available to sell.
            </p>
          )}

          <Card title="Notes">
            <Textarea
              rows={3}
              value={notes}
              onChange={(e) => {
                touch();
                setNotes(e.target.value);
              }}
              placeholder="Anything the next person should know about this batch"
            />
          </Card>

          {saveError && <ErrorBox message={saveError} />}

          <SaveBar
            dirty={touched && !saving}
            aside={
              <span className="text-sm">
                <strong className="tabular-nums text-success">{fmtQty(accepted)}</strong> accept ·{' '}
                <strong className="tabular-nums text-destructive">{fmtQty(rejected)}</strong> reject
              </span>
            }
          >
            <Button variant="primary" size="lg" className="h-12 px-6 text-base" onClick={save} disabled={saving || problems.length > 0 || !!uploading}>
              {saving ? <Spinner className="border-primary-foreground/30 border-t-primary-foreground" /> : <ShieldCheck />}
              Save QC result
            </Button>
            <Link href={`/admin/purchase-receives/${id}`}>
              <Button variant="ghost" size="lg" className="h-12 px-5 text-base">
                Cancel
              </Button>
            </Link>
            {problems.length > 0 && (
              <span className="basis-full text-xs text-warning sm:basis-auto">To save: {problems.join(', ')}</span>
            )}
          </SaveBar>
        </div>
      )}
    </>
  );
}
