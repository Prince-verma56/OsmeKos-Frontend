'use client';

import { money } from '@/lib/api';
import { perUnit, unitSalePrice, type KeyActive, type Manufacturer } from '@/lib/labels';
import { Monogram } from '../Brand';

type Org = {
  legalName?: string | null;
  name?: string | null;
  addressLine1?: string | null;
  addressLine2?: string | null;
  city?: string | null;
  state?: string | null;
  pincode?: string | null;
  email?: string | null;
  phone?: string | null;
};

type PreviewVariant = { title: string; netQuantity: string; netUnit: string; mrp: string };

const joinAddress = (parts: (string | null | undefined)[]) => parts.filter((p) => p && p.trim()).join(', ');

export function LabelPreview({
  title,
  subtitle,
  keyActives,
  ingredients,
  howToUse,
  caution,
  storage,
  shelfLifeMonths,
  countryOfOrigin,
  manufacturer,
  org,
  variant,
}: {
  title: string;
  subtitle: string;
  keyActives: KeyActive[];
  ingredients: string;
  howToUse: string;
  caution: string;
  storage: string;
  shelfLifeMonths: string;
  countryOfOrigin: string;
  manufacturer: Manufacturer | null;
  org: Org | null;
  variant: PreviewVariant | null;
}) {
  const usp = variant ? unitSalePrice(variant.mrp, variant.netQuantity) : null;
  const unit = perUnit(variant?.netUnit);
  const missing = (text: string) => <span className="italic text-muted-foreground/70">{text}</span>;
  const mfgAddress = manufacturer?.addresses?.[0];

  return (
    <div className="rounded-lg border border-border bg-card shadow-xs">
      <div className="flex items-center justify-between border-b border-border px-4 py-2.5">
        <h2 className="font-display text-[15px] font-medium tracking-wide text-foreground">Back label preview</h2>
        <span className="caps-label text-[10px]">For proof-reading</span>
      </div>
      <div className="p-4">
        <div className="mx-auto max-w-sm rounded-md border border-foreground/15 bg-[#fbf8f3] p-4 font-sans text-[11px] leading-snug text-[#2a2420] dark:bg-[#f3ece1]">
          <div className="flex items-center gap-2 border-b border-[#2a2420]/15 pb-2">
            <Monogram className="h-5 w-auto" />
            <div className="min-w-0">
              <div className="font-display text-[13px] font-medium tracking-wide">{title || missing('Product name')}</div>
              {subtitle ? <div className="text-[10px] tracking-wide text-[#5e544b]">{subtitle}</div> : null}
            </div>
            {variant && (
              <div className="ml-auto text-right text-[10px] font-medium">
                Net {variant.netQuantity ? `${Number(variant.netQuantity)} ${unit}` : '—'}
              </div>
            )}
          </div>

          {keyActives.filter((a) => a.name.trim()).length > 0 && (
            <p className="mt-2 text-[10px] font-medium">
              {keyActives
                .filter((a) => a.name.trim())
                .map((a) => (a.percent ? `${Number(a.percent)}% ${a.name.trim()}` : a.name.trim()))
                .join(' · ')}
            </p>
          )}

          <p className="mt-2">
            <span className="font-semibold">Ingredients: </span>
            {ingredients.trim() || missing('Ingredient list (INCI) goes here')}
          </p>
          <p className="mt-1.5">
            <span className="font-semibold">How to use: </span>
            {howToUse.trim() || missing('Directions')}
          </p>
          <p className="mt-1.5">
            <span className="font-semibold">Caution: </span>
            {caution.trim() || missing('Caution')}
          </p>
          <p className="mt-1.5">
            <span className="font-semibold">Storage: </span>
            {storage.trim() || missing('Storage')}
          </p>

          <div className="mt-2.5 grid grid-cols-2 gap-x-3 gap-y-0.5 rounded border border-[#2a2420]/40 p-2 text-[10px] tabular-nums">
            <span>Batch No.: ________</span>
            <span>Mfg. Date: MM/YYYY</span>
            <span>
              MRP ₹: {variant?.mrp ? money(variant.mrp) : '—'}
              <span className="block text-[8.5px] text-[#5e544b]">(incl. of all taxes)</span>
            </span>
            <span>USP: {usp !== null ? `₹${usp.toFixed(3)}/${unit}` : '—'}</span>
            <span className="col-span-2">
              Best before {shelfLifeMonths ? `${shelfLifeMonths} months` : '—'} from manufacture
            </span>
          </div>

          <p className="mt-2">
            <span className="font-semibold">Marketed by: </span>
            {org ? joinAddress([org.legalName ?? org.name, org.addressLine1, org.addressLine2, org.city, org.state, org.pincode]) : missing('Your company')}
          </p>
          <p className="mt-1">
            <span className="font-semibold">Manufactured by: </span>
            {manufacturer
              ? joinAddress([manufacturer.companyName || manufacturer.displayName, mfgAddress?.line1, mfgAddress?.line2, mfgAddress?.city, mfgAddress?.state, mfgAddress?.pincode])
              : missing('Pick the manufacturer')}
            {manufacturer && (
              <span className="block">
                Mfg. Lic. No.: {manufacturer.cosmeticsLicenceNo || missing('licence no. missing on the vendor')}
              </span>
            )}
          </p>
          <p className="mt-1">
            <span className="font-semibold">Country of origin: </span>
            {countryOfOrigin || 'India'}
          </p>
          <p className="mt-1">
            <span className="font-semibold">Customer care: </span>
            {org && (org.email || org.phone) ? [org.email, org.phone].filter(Boolean).join(' · ') : missing('Add email and phone in Organization settings')}
          </p>
        </div>
        <p className="mt-2 text-center text-[11px] text-muted-foreground">
          The layout is a guide. Your regulatory consultant confirms the exact wording required on the label.
        </p>
      </div>
    </div>
  );
}
