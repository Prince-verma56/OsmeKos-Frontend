'use client';

import { money } from '@/lib/api';
import { mrpSummary, offMrp, rateWithTax, type MrpLine } from '@/lib/mrp';

export function OffMrpNote({ mrp, rate, inclusive = true, taxPercent = 0, className = '' }: { mrp: unknown; rate: unknown; inclusive?: boolean; taxPercent?: number; className?: string }) {
  const off = offMrp(mrp, rateWithTax(rate, inclusive, taxPercent));
  if (!off) return null;
  return (
    <p className={`text-[11px] ${off.above ? 'text-destructive' : 'text-muted-foreground'} ${className}`}>
      MRP {money(off.mrp)}
      {off.above ? ` · ${money(-off.amount)} above MRP` : off.amount > 0 ? ` · ${off.percent}% off MRP` : ' · at MRP'}
    </p>
  );
}

export function OffMrpCell({ mrp, rate, inclusive = true, taxPercent = 0 }: { mrp: unknown; rate: unknown; inclusive?: boolean; taxPercent?: number }) {
  const off = offMrp(mrp, rateWithTax(rate, inclusive, taxPercent));
  if (!off) return <span className="text-muted-foreground">—</span>;
  if (off.above) return <span className="text-destructive">above MRP</span>;
  if (off.amount === 0) return <span className="text-muted-foreground">at MRP</span>;
  return <span>{off.percent}%</span>;
}

export function MrpTotalRows({ lines, headerDiscountRatio = 0, valueClass = 'w-24 text-right' }: { lines: MrpLine[]; headerDiscountRatio?: number; valueClass?: string }) {
  const s = mrpSummary(lines, headerDiscountRatio);
  if (!s) return null;
  return (
    <div className="flex items-start justify-between">
      <dt className="text-muted-foreground">
        MRP (incl. GST)
        <span className={`block text-xs ${s.above ? 'text-destructive' : ''}`}>
          {s.above ? `${money(-s.off)} above MRP` : s.off > 0 ? `${money(s.off)} (${s.percent}%) off MRP` : 'Sold at MRP'}
          {s.partial ? ' · lines without an MRP left out' : ''}
        </span>
      </dt>
      <dd className={valueClass}>{money(s.mrpTotal)}</dd>
    </div>
  );
}
