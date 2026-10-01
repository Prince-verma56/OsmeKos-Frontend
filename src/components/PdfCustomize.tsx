'use client';

import { useState } from 'react';
import { api, errorMessage } from '@/lib/api';
import { Modal } from './Modal';
import { FileUpload } from './FileUpload';
import { Button, Field, Input, Textarea } from './ui';
import { Checkbox } from './ui/misc';
import { useAuth } from '@/lib/auth';
import { loadDefaultTerms, saveDefaultTerms, TERMS_DOC_LABEL, type TermsDocType } from '@/lib/documentTerms';
import type { PdfOrg } from './DocumentPdf';

export type PdfTemplate = 'standard' | 'compact' | 'detailed';

const TEMPLATES: { value: PdfTemplate; label: string; hint: string }[] = [
  { value: 'standard', label: 'Standard Template', hint: 'Full letterhead with statutory details' },
  { value: 'compact', label: 'Compact Template', hint: 'Drops our own address block — for an internal copy' },
  { value: 'detailed', label: 'Detailed Template', hint: 'Always prints the HSN/SAC column' },
];

export function PdfCustomize({
  template,
  onTemplateChange,
  org,
  onOrgSaved,
  termsDocType,
  documentTerms,
  onDocumentTermsSaved,
  onTermsDone,
}: {
  template: PdfTemplate;
  onTemplateChange: (t: PdfTemplate) => void;
  org: PdfOrg | null;
  onOrgSaved: (org: PdfOrg) => void;
  termsDocType?: TermsDocType;
  documentTerms?: string;
  onDocumentTermsSaved?: (terms: string) => Promise<unknown>;
  onTermsDone?: () => void;
}) {
  const { can } = useAuth();
  const canSaveDefault = can('settings:write');
  const [alsoDefault, setAlsoDefault] = useState(false);
  const [loadingTerms, setLoadingTerms] = useState(false);
  const [loadFailed, setLoadFailed] = useState(false);
  const [open, setOpen] = useState(false);
  const [dialog, setDialog] = useState<'' | 'template' | 'logo' | 'terms'>('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const [logoForm, setLogoForm] = useState({
    logoUrl: org?.logoUrl ?? '',
    legalName: org?.legalName ?? '',
    addressLine1: org?.addressLine1 ?? '',
    addressLine2: org?.addressLine2 ?? '',
    city: org?.city ?? '',
    state: org?.state ?? '',
    pincode: org?.pincode ?? '',
    email: org?.email ?? '',
    website: org?.website ?? '',
  });
  const [termsDraft, setTermsDraft] = useState('');

  function openDialog(which: 'template' | 'logo' | 'terms') {
    setOpen(false);
    setError('');
    if (which === 'logo') {
      setLogoForm({
        logoUrl: org?.logoUrl ?? '',
        legalName: org?.legalName ?? '',
        addressLine1: org?.addressLine1 ?? '',
        addressLine2: org?.addressLine2 ?? '',
        city: org?.city ?? '',
        state: org?.state ?? '',
        pincode: org?.pincode ?? '',
        email: org?.email ?? '',
        website: org?.website ?? '',
      });
    }
    if (which === 'terms' && termsDocType) {
      setAlsoDefault(false);
      setLoadFailed(false);
      if (onDocumentTermsSaved) {
        setTermsDraft(documentTerms ?? '');
      } else {
        setTermsDraft('');
        setLoadingTerms(true);
        loadDefaultTerms(termsDocType)
          .then(setTermsDraft)
          .catch((err) => {
            setError(errorMessage(err));
            setLoadFailed(true);
          })
          .finally(() => setLoadingTerms(false));
      }
    }
    setDialog(which);
  }

  async function saveOrg() {
    setSaving(true);
    setError('');
    try {
      const res = await api.patch<{ data: PdfOrg }>('/organization', {
        logoUrl: logoForm.logoUrl.trim() || undefined,
        legalName: logoForm.legalName.trim() || undefined,
        addressLine1: logoForm.addressLine1.trim() || undefined,
        addressLine2: logoForm.addressLine2.trim() || undefined,
        city: logoForm.city.trim() || undefined,
        state: logoForm.state.trim() || undefined,
        pincode: logoForm.pincode.trim() || undefined,
        email: logoForm.email.trim() || undefined,
        website: logoForm.website.trim() || undefined,
      });
      onOrgSaved(res.data);
      setDialog('');
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setSaving(false);
    }
  }

  async function saveTerms() {
    if (!termsDocType) return;
    setSaving(true);
    setError('');
    try {
      if (onDocumentTermsSaved) await onDocumentTermsSaved(termsDraft);
      if (!onDocumentTermsSaved || alsoDefault) await saveDefaultTerms(termsDocType, termsDraft);
      setDialog('');
      onTermsDone?.();
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setSaving(false);
    }
  }

  const item =
    'block w-full px-4 py-2 text-left text-sm text-foreground hover:bg-primary hover:text-primary-foreground';

  return (
    <>
      <div className="relative print:hidden">
        <Button size="sm" variant="success" onClick={() => setOpen((v) => !v)}>
          ⚙ Customize ▾
        </Button>
        {open && (
          <>
            <div className="fixed inset-0 z-10" onClick={() => setOpen(false)} />
            <div className="absolute right-0 z-20 mt-1 w-56 overflow-hidden rounded-md border border-border bg-card py-1 shadow-lg">
              <div className="px-4 py-1.5 text-xs font-semibold text-muted-foreground">
                {TEMPLATES.find((t) => t.value === template)?.label}
              </div>
              <button className={item} onClick={() => openDialog('template')}>
                Change Template
              </button>
              <div className="my-1 border-t border-border" />
              <button className={item} onClick={() => openDialog('logo')}>
                Update Logo &amp; Address
              </button>
              {termsDocType && (
                <button className={item} onClick={() => openDialog('terms')}>
                  Terms &amp; Conditions
                </button>
              )}
            </div>
          </>
        )}
      </div>

      <Modal
        open={dialog === 'template'}
        onClose={() => setDialog('')}
        title="Change Template"
        footer={<Button onClick={() => setDialog('')}>Done</Button>}
      >
        <div className="space-y-2">
          {TEMPLATES.map((t) => (
            <button
              key={t.value}
              type="button"
              onClick={() => onTemplateChange(t.value)}
              className={`block w-full rounded-md border px-3 py-2 text-left ${
                template === t.value
                  ? 'border-gold bg-gold-soft'
                  : 'border-border hover:bg-muted/60'
              }`}
            >
              <div className="text-sm font-medium text-foreground">{t.label}</div>
              <div className="text-xs text-muted-foreground">{t.hint}</div>
            </button>
          ))}
        </div>
      </Modal>

      <Modal
        open={dialog === 'logo'}
        onClose={() => setDialog('')}
        title="Update Logo & Address"
        footer={
          <>
            <Button onClick={() => setDialog('')} disabled={saving}>Cancel</Button>
            <Button variant="primary" onClick={saveOrg} disabled={saving}>
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
          <div>
            <span className="mb-1 block text-xs font-medium text-muted-foreground">
              Logo
            </span>
            <div className="flex items-center gap-3">
              {logoForm.logoUrl && (
                <img
                  src={logoForm.logoUrl}
                  alt=""
                  className="h-14 w-auto rounded border border-border object-contain"
                />
              )}
              <FileUpload
                accept="image/*"
                label={logoForm.logoUrl ? 'Replace logo' : 'Upload logo'}
                onUploaded={(files) =>
                  files[0] && setLogoForm((f) => ({ ...f, logoUrl: files[0].url }))
                }
              />
              {logoForm.logoUrl && (
                <button
                  type="button"
                  onClick={() => setLogoForm((f) => ({ ...f, logoUrl: '' }))}
                  className="text-xs text-muted-foreground hover:text-destructive"
                >
                  Remove
                </button>
              )}
            </div>
            <p className="mt-1.5 text-xs text-muted-foreground">
              Printed at the top-left of every document. Without one, the brand name is used.
            </p>
          </div>

          <Field label="Legal name">
            <Input
              value={logoForm.legalName}
              onChange={(e) => setLogoForm({ ...logoForm, legalName: e.target.value })}
            />
          </Field>
          <Field label="Address line 1">
            <Input
              value={logoForm.addressLine1}
              onChange={(e) => setLogoForm({ ...logoForm, addressLine1: e.target.value })}
            />
          </Field>
          <Field label="Address line 2">
            <Input
              value={logoForm.addressLine2}
              onChange={(e) => setLogoForm({ ...logoForm, addressLine2: e.target.value })}
            />
          </Field>
          <div className="grid gap-4 sm:grid-cols-3">
            <Field label="City">
              <Input value={logoForm.city} onChange={(e) => setLogoForm({ ...logoForm, city: e.target.value })} />
            </Field>
            <Field label="State">
              <Input value={logoForm.state} onChange={(e) => setLogoForm({ ...logoForm, state: e.target.value })} />
            </Field>
            <Field label="Pincode">
              <Input value={logoForm.pincode} onChange={(e) => setLogoForm({ ...logoForm, pincode: e.target.value })} />
            </Field>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Email">
              <Input value={logoForm.email} onChange={(e) => setLogoForm({ ...logoForm, email: e.target.value })} />
            </Field>
            <Field label="Website">
              <Input value={logoForm.website} onChange={(e) => setLogoForm({ ...logoForm, website: e.target.value })} />
            </Field>
          </div>
          <p className="text-xs text-muted-foreground">
            The GSTIN is also printed — it lives on the organization record and is changed there.
          </p>
        </div>
      </Modal>

      <Modal
        open={dialog === 'terms'}
        onClose={() => setDialog('')}
        title={
          onDocumentTermsSaved || !termsDocType
            ? 'Terms & Conditions'
            : `Default terms for new ${TERMS_DOC_LABEL[termsDocType]}`
        }
        footer={
          <>
            <Button onClick={() => setDialog('')} disabled={saving}>
              {onDocumentTermsSaved || canSaveDefault ? 'Cancel' : 'Close'}
            </Button>
            {(onDocumentTermsSaved || canSaveDefault) && (
              <Button variant="primary" onClick={saveTerms} disabled={saving || loadingTerms || loadFailed}>
                {saving ? 'Saving…' : 'Save'}
              </Button>
            )}
          </>
        }
      >
        <div className="space-y-3">
          {error && (
            <p className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
              {error}
            </p>
          )}
          <Field
            label={
              onDocumentTermsSaved ? 'Printed at the foot of this document' : 'Filled in on every new document of this kind'
            }
          >
            <Textarea
              rows={6}
              value={termsDraft}
              onChange={(e) => setTermsDraft(e.target.value)}
              readOnly={loadingTerms || loadFailed || (!onDocumentTermsSaved && !canSaveDefault)}
              maxLength={termsDocType === 'purchase_order' ? 2000 : 4000}
              placeholder={loadingTerms ? 'Loading…' : ''}
            />
          </Field>
          {onDocumentTermsSaved && termsDocType && canSaveDefault && (
            <label className="flex cursor-pointer items-center gap-2 text-sm text-foreground">
              <Checkbox checked={alsoDefault} onCheckedChange={(c) => setAlsoDefault(Boolean(c))} />
              Also use as the default for new {TERMS_DOC_LABEL[termsDocType]}
            </label>
          )}
          {!onDocumentTermsSaved && termsDocType && (
            <p className="text-xs text-muted-foreground">
              New {TERMS_DOC_LABEL[termsDocType]} start with these terms, and staff can still change them on each one.
              Documents already made keep their own terms.
              {!canSaveDefault && ' Only the owner can change the default.'}
            </p>
          )}
        </div>
      </Modal>
    </>
  );
}
