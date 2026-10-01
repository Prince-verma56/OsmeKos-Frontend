'use client';

import { useId } from 'react';
import {
  Area, AreaChart, Bar, BarChart, CartesianGrid, Cell, LabelList, Pie, PieChart, ReferenceLine, XAxis, YAxis,
} from 'recharts';
import { money } from '@/lib/api';
import {
  CHART_COLORS, CHART_SWATCH, ChartContainer, ChartEmpty, ChartLegend, ChartLegendContent, ChartTooltip,
  ChartTooltipContent, compactAmount, type ChartConfig,
} from '@/components/ui/chart';

export type Point = { label: string; value: number };

type Tone = keyof typeof CHART_COLORS;

const TONES: Record<string, Tone> = { blue: 'sky', emerald: 'emerald', amber: 'amber', teal: 'teal', purple: 'purple', rose: 'rose' };

const shorten = (text: string, max: number) => (text.length > max ? `${text.slice(0, max - 1)}…` : text);

const shortenKeepingEnd = (text: string, max: number) => {
  if (text.length <= max) return text;
  const cut = text.search(/\s*[-–—·|,(]\s*[^-–—·|,(]*$/);
  const tail = cut > 0 ? text.slice(cut) : '';
  if (tail && tail.length <= max - 6) {
    return `${text.slice(0, max - 1 - tail.length).trimEnd()}…${tail}`;
  }
  const head = Math.ceil((max - 1) / 2);
  return `${text.slice(0, head).trimEnd()}…${text.slice(text.length - (max - 1 - head)).trimStart()}`;
};

const distinctLabels = (labels: string[], max: number) => {
  const short = labels.map((l) => shorten(l, max));
  return labels.map((l, i) =>
    short.indexOf(short[i]) !== short.lastIndexOf(short[i]) ? shortenKeepingEnd(l, max) : short[i]
  );
};

export function TrendChart({
  points,
  height = 220,
  format,
  label,
  tone = 'teal',
}: {
  points: Point[];
  height?: number;
  format?: (n: number) => string;
  label?: string;
  tone?: 'teal' | 'emerald' | 'blue' | 'amber' | 'purple' | 'rose';
}) {
  const gradient = `trend-${useId().replace(/[^a-zA-Z0-9]/g, '')}`;

  if (points.length < 2) {
    return (
      <ChartEmpty
        className="aspect-auto"
        message={points.length === 0 ? 'Nothing in this period' : 'One period only - pick a wider range to see a trend'}
      />
    );
  }

  const config = { value: { label: label ?? 'Value', ...CHART_COLORS[TONES[tone] ?? 'teal'] } } satisfies ChartConfig;
  const hasNegative = points.some((p) => p.value < 0);
  const axis = format ?? ((n: number) => compactAmount(n));
  const value = format ?? money;

  return (
    <ChartContainer config={config} className="aspect-auto" style={{ height }} aria-label={label ?? 'Trend'}>
      <AreaChart data={points} margin={{ left: 4, right: 12, top: 8 }}>
        <defs>
          <linearGradient id={gradient} x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor="var(--color-value)" stopOpacity={0.3} />
            <stop offset="95%" stopColor="var(--color-value)" stopOpacity={0.02} />
          </linearGradient>
        </defs>
        <CartesianGrid vertical={false} strokeDasharray="3 3" />
        <XAxis dataKey="label" tickLine={false} axisLine={false} tickMargin={8} minTickGap={16} />
        <YAxis tickLine={false} axisLine={false} width={56} tickFormatter={axis} />
        {hasNegative && <ReferenceLine y={0} stroke="currentColor" strokeOpacity={0.35} strokeDasharray="4 4" />}
        <ChartTooltip
          cursor={{ strokeDasharray: '4 4' }}
          content={<ChartTooltipContent valueFormatter={(v) => value(v)} />}
        />
        <Area
          dataKey="value"
          type="monotone"
          stroke="var(--color-value)"
          strokeWidth={2.5}
          fill={`url(#${gradient})`}
          dot={{ r: 3, strokeWidth: 0, fill: 'var(--color-value)' }}
          activeDot={{ r: 5 }}
        />
      </AreaChart>
    </ChartContainer>
  );
}

export function RankChart({
  points,
  limit = 6,
  format,
  tone = 'blue',
  valueLabel,
}: {
  points: Point[];
  limit?: number;
  format?: (n: number) => string;
  tone?: 'blue' | 'emerald' | 'amber' | 'teal' | 'purple';
  valueLabel?: string;
}) {
  const rows = [...points]
    .sort((a, b) => Math.abs(b.value) - Math.abs(a.value))
    .slice(0, limit);

  if (rows.length === 0) {
    return <ChartEmpty message="Nothing to rank yet" className="aspect-auto h-[140px]" />;
  }

  const config = {
    value: { label: valueLabel ?? (format ? 'Value' : 'Amount'), ...CHART_COLORS[TONES[tone] ?? 'sky'] },
    negative: { label: 'Below zero', ...CHART_COLORS.rose },
  } satisfies ChartConfig;
  const value = format ?? money;
  const shortLabels = distinctLabels(rows.map((r) => r.label), 22);
  const data = rows.map((r, i) => ({ ...r, short: shortLabels[i] }));
  const hasNegative = rows.some((r) => r.value < 0);

  return (
    <ChartContainer config={config} className="aspect-auto" style={{ height: rows.length * 38 + 12 }}>
      <BarChart data={data} layout="vertical" margin={{ left: 0, right: 100, top: 4, bottom: 4 }}>
        <XAxis type="number" hide domain={hasNegative ? ['dataMin', 'dataMax'] : [0, 'dataMax']} />
        <YAxis type="category" dataKey="short" tickLine={false} axisLine={false} width={132} />
        {hasNegative && <ReferenceLine x={0} stroke="currentColor" strokeOpacity={0.35} />}
        <ChartTooltip
          cursor={false}
          content={
            <ChartTooltipContent
              labelFormatter={(_, payload) => String(payload[0]?.payload?.label ?? '')}
              valueFormatter={(v) => value(v)}
            />
          }
        />
        <Bar dataKey="value" radius={4} maxBarSize={18}>
          {data.map((d, i) => (
            <Cell key={`${i}-${d.label}`} fill={d.value < 0 ? 'var(--color-negative)' : 'var(--color-value)'} />
          ))}
          <LabelList
            dataKey="value"
            position="right"
            offset={8}
            className="fill-muted-foreground text-[11px] font-medium tabular-nums"
            formatter={(v: unknown) => value(Number(v))}
          />
        </Bar>
      </BarChart>
    </ChartContainer>
  );
}

const SEVERITY: Tone[] = ['teal', 'amber', 'amber', 'rose', 'rose'];

export function AgeingBucketsChart({
  buckets,
  height = 220,
}: {
  buckets: { key: string; label: string; value: number }[];
  height?: number;
}) {
  if (!buckets.some((b) => b.value > 0)) {
    return <ChartEmpty message="Nothing outstanding" className="aspect-auto" style={{ height }} />;
  }
  const config = Object.fromEntries(
    buckets.map((b, i) => [b.key, { label: b.label, ...CHART_COLORS[SEVERITY[Math.min(i, SEVERITY.length - 1)]] }])
  ) satisfies ChartConfig;

  return (
    <ChartContainer config={config} className="aspect-auto" style={{ height }}>
      <BarChart data={buckets} margin={{ left: 4, right: 8, top: 20 }}>
        <CartesianGrid vertical={false} strokeDasharray="3 3" />
        <XAxis dataKey="label" tickLine={false} axisLine={false} tickMargin={8} />
        <YAxis tickLine={false} axisLine={false} width={56} tickFormatter={(v: number) => compactAmount(v)} />
        <ChartTooltip
          cursor={false}
          content={<ChartTooltipContent hideLabel nameKey="key" valueFormatter={(v) => money(v)} />}
        />
        <Bar dataKey="value" radius={[4, 4, 0, 0]} maxBarSize={48}>
          {buckets.map((b) => (
            <Cell key={b.key} fill={`var(--color-${b.key})`} />
          ))}
          <LabelList
            dataKey="value"
            position="top"
            className="fill-muted-foreground text-[11px] font-medium tabular-nums"
            formatter={(v: unknown) => (Number(v) > 0 ? compactAmount(Number(v)) : '')}
          />
        </Bar>
      </BarChart>
    </ChartContainer>
  );
}

export function GroupedBarChart({
  data,
  categoryKey,
  series,
  height = 220,
  format,
}: {
  data: Record<string, string | number>[];
  categoryKey: string;
  series: { key: string; label: string; tone: Tone }[];
  height?: number;
  format?: (n: number) => string;
}) {
  if (!data.some((d) => series.some((s) => Number(d[s.key] ?? 0) !== 0))) {
    return <ChartEmpty message="Nothing in this period" className="aspect-auto" style={{ height }} />;
  }
  const config = Object.fromEntries(series.map((s) => [s.key, { label: s.label, ...CHART_COLORS[s.tone] }])) satisfies ChartConfig;
  const value = format ?? money;

  return (
    <ChartContainer config={config} className="aspect-auto" style={{ height }}>
      <BarChart data={data} margin={{ left: 4, right: 8, top: 8 }}>
        <CartesianGrid vertical={false} strokeDasharray="3 3" />
        <XAxis dataKey={categoryKey} tickLine={false} axisLine={false} tickMargin={8} />
        <YAxis tickLine={false} axisLine={false} width={56} tickFormatter={(v: number) => compactAmount(v)} />
        <ChartTooltip content={<ChartTooltipContent valueFormatter={(v) => value(v)} />} />
        <ChartLegend content={<ChartLegendContent />} />
        {series.map((s) => (
          <Bar key={s.key} dataKey={s.key} fill={`var(--color-${s.key})`} radius={[4, 4, 0, 0]} maxBarSize={32} />
        ))}
      </BarChart>
    </ChartContainer>
  );
}

const DONUT_TONES: Tone[] = ['teal', 'sky', 'purple', 'amber', 'rose', 'emerald', 'slate'];

export function DonutChart({
  slices,
  height = 220,
  format,
  centerLabel,
}: {
  slices: { label: string; value: number }[];
  height?: number;
  format?: (n: number) => string;
  centerLabel?: string;
}) {
  const shown = slices.filter((s) => s.value > 0);
  if (!shown.length) {
    return <ChartEmpty message="Nothing in this period" className="aspect-auto" style={{ height }} />;
  }
  const value = format ?? money;
  const data = shown.map((s, i) => ({ ...s, key: `slice${i}`, fill: `var(--color-slice${i})` }));
  const config = Object.fromEntries(
    data.map((d, i) => [d.key, { label: d.label, ...CHART_COLORS[DONUT_TONES[i % DONUT_TONES.length]] }])
  ) satisfies ChartConfig;
  const total = shown.reduce((n, s) => n + s.value, 0);

  return (
    <div className="flex flex-wrap items-center gap-4">
      <div className="relative shrink-0" style={{ width: height, height }}>
        <ChartContainer config={config} className="aspect-square h-full">
          <PieChart>
            <ChartTooltip content={<ChartTooltipContent hideLabel nameKey="key" valueFormatter={(v) => value(v)} />} />
            <Pie
              data={data}
              dataKey="value"
              nameKey="key"
              innerRadius={Math.round(height * 0.3)}
              outerRadius={Math.round(height * 0.44)}
              paddingAngle={data.length > 1 ? 2 : 0}
              strokeWidth={0}
            />
          </PieChart>
        </ChartContainer>
        <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-base font-semibold tabular-nums text-foreground">
            {format ? format(total) : compactAmount(total)}
          </span>
          {centerLabel && <span className="text-[11px] text-muted-foreground">{centerLabel}</span>}
        </div>
      </div>
      <ul className="min-w-[10rem] flex-1 space-y-1.5 text-xs">
        {data.map((d, i) => (
          <li key={d.key} className="flex items-center justify-between gap-3">
            <span className="flex min-w-0 items-center gap-2 text-muted-foreground">
              <span className={`h-2.5 w-2.5 shrink-0 rounded-[2px] ${CHART_SWATCH[DONUT_TONES[i % DONUT_TONES.length]]}`} />
              <span className="truncate">{d.label}</span>
            </span>
            <span className="shrink-0 tabular-nums text-muted-foreground">
              <span className="font-medium text-foreground">{value(d.value)}</span>
              {' · '}
              {Math.round((d.value / total) * 100)}%
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
