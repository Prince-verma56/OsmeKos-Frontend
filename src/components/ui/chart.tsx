'use client';

import * as React from 'react';
import * as RechartsPrimitive from 'recharts';
import { cn } from '@/lib/cn';
import { currencySymbol, numberLocale } from '@/lib/api';

export type ChartConfig = Record<
  string,
  { label?: React.ReactNode; color?: string; dark?: string }
>;

export const CHART_COLORS = {
  teal: { color: '#b8893e', dark: '#d4a95a' },
  purple: { color: '#4a3b30', dark: '#cdbb9e' },
  amber: { color: '#c07a55', dark: '#d08f6b' },
  sky: { color: '#6c8ca8', dark: '#8db3d0' },
  rose: { color: '#a85d3b', dark: '#e0a184' },
  emerald: { color: '#6f8f72', dark: '#7fa583' },
  slate: { color: '#8c7f72', dark: '#b3a594' },
} as const;

export const CHART_SWATCH: Record<keyof typeof CHART_COLORS, string> = {
  teal: 'bg-[#b8893e] dark:bg-[#d4a95a]',
  purple: 'bg-[#4a3b30] dark:bg-[#cdbb9e]',
  amber: 'bg-[#c07a55] dark:bg-[#d08f6b]',
  sky: 'bg-[#6c8ca8] dark:bg-[#8db3d0]',
  rose: 'bg-[#a85d3b] dark:bg-[#e0a184]',
  emerald: 'bg-[#6f8f72] dark:bg-[#7fa583]',
  slate: 'bg-[#8c7f72] dark:bg-[#b3a594]',
};

const ChartContext = React.createContext<{ config: ChartConfig } | null>(null);

function useChart() {
  const context = React.useContext(ChartContext);
  if (!context) throw new Error('Chart parts must sit inside a ChartContainer');
  return context;
}

function ChartStyle({ id, config }: { id: string; config: ChartConfig }) {
  const entries = Object.entries(config).filter(([, c]) => c.color);
  if (!entries.length) return null;
  const light = entries.map(([key, c]) => `  --color-${key}: ${c.color};`).join('\n');
  const dark = entries.map(([key, c]) => `  --color-${key}: ${c.dark ?? c.color};`).join('\n');
  return (
    <style
      dangerouslySetInnerHTML={{
        __html: `[data-chart=${id}] {\n${light}\n}\n.dark [data-chart=${id}] {\n${dark}\n}`,
      }}
    />
  );
}

export function ChartContainer({
  id,
  className,
  children,
  config,
  ...props
}: React.ComponentProps<'div'> & {
  config: ChartConfig;
  children: React.ComponentProps<typeof RechartsPrimitive.ResponsiveContainer>['children'];
}) {
  const uniqueId = React.useId();
  const chartId = `chart-${id ?? uniqueId.replace(/[^a-zA-Z0-9]/g, '')}`;
  return (
    <ChartContext.Provider value={{ config }}>
      <div
        data-chart={chartId}
        className={cn(
          'flex aspect-video w-full justify-center text-xs',
          '[&_.recharts-cartesian-axis-tick-value]:fill-muted-foreground',
          '[&_.recharts-label-list_text]:fill-muted-foreground',
          '[&_.recharts-cartesian-grid_line]:stroke-border',
          '[&_.recharts-curve.recharts-tooltip-cursor]:stroke-border',
          '[&_.recharts-rectangle.recharts-tooltip-cursor]:fill-muted',
          '[&_.recharts-polar-grid_[stroke="#ccc"]]:stroke-border [&_.recharts-reference-line_[stroke="#ccc"]]:stroke-border',
          '[&_.recharts-sector]:outline-none [&_.recharts-surface]:outline-none [&_.recharts-layer]:outline-none',
          className
        )}
        {...props}
      >
        <ChartStyle id={chartId} config={config} />
        <RechartsPrimitive.ResponsiveContainer debounce={150}>{children}</RechartsPrimitive.ResponsiveContainer>
      </div>
    </ChartContext.Provider>
  );
}

export const ChartTooltip = RechartsPrimitive.Tooltip;
export const ChartLegend = RechartsPrimitive.Legend;

type TooltipItem = {
  dataKey?: string | number;
  name?: string | number;
  value?: number | string | (number | string)[];
  color?: string;
  fill?: string;
  payload?: Record<string, unknown> & { fill?: string };
};

export function ChartTooltipContent({
  active,
  payload,
  label,
  hideLabel = false,
  labelFormatter,
  valueFormatter,
  nameKey,
  indicator = 'dot',
}: {
  active?: boolean;
  payload?: TooltipItem[];
  label?: React.ReactNode;
  hideLabel?: boolean;
  labelFormatter?: (label: React.ReactNode, payload: TooltipItem[]) => React.ReactNode;
  valueFormatter?: (value: number, key: string) => React.ReactNode;
  nameKey?: string;
  indicator?: 'dot' | 'line';
}) {
  const { config } = useChart();
  if (!active || !payload?.length) return null;

  const heading = hideLabel ? null : labelFormatter ? labelFormatter(label, payload) : label;

  return (
    <div className="min-w-36 rounded-lg border border-border bg-popover px-3 py-2 text-xs shadow-lg">
      {heading != null && heading !== '' && (
        <div className="mb-1.5 font-medium text-foreground">{heading}</div>
      )}
      <div className="space-y-1">
        {payload.map((item, index) => {
          const key = String(
            (nameKey && item.payload?.[nameKey]) ?? item.dataKey ?? item.name ?? index
          );
          const entry = config[key] ?? config[String(item.dataKey ?? '')];
          const color = item.payload?.fill ?? item.color ?? item.fill ?? `var(--color-${key})`;
          const raw = Array.isArray(item.value) ? item.value[0] : item.value;
          const value = Number(raw ?? 0);
          return (
            <div key={`${key}-${index}`} className="flex items-center justify-between gap-4">
              <span className="flex items-center gap-1.5 text-muted-foreground">
                <span
                  className={cn('shrink-0 rounded-[2px]', indicator === 'dot' ? 'h-2.5 w-2.5' : 'h-3 w-1')}
                  style={{ backgroundColor: color }}
                />
                {entry?.label ?? item.name ?? key}
              </span>
              <span className="font-medium tabular-nums text-foreground">
                {valueFormatter ? valueFormatter(value, key) : value.toLocaleString(numberLocale())}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

type LegendItem = { value?: string | number; dataKey?: unknown; color?: string };

export function ChartLegendContent({
  payload,
  className,
}: {
  payload?: LegendItem[];
  className?: string;
}) {
  const { config } = useChart();
  if (!payload?.length) return null;
  return (
    <div className={cn('flex flex-wrap items-center justify-center gap-x-4 gap-y-1 pt-3', className)}>
      {payload.map((item) => {
        const key = String(typeof item.dataKey === 'string' ? item.dataKey : item.value ?? '');
        return (
          <div key={key} className="flex items-center gap-1.5 text-muted-foreground">
            <span className="h-2.5 w-2.5 shrink-0 rounded-[2px]" style={{ backgroundColor: item.color }} />
            {config[key]?.label ?? item.value}
          </div>
        );
      })}
    </div>
  );
}

export function compactAmount(n: number, withSymbol = true) {
  const abs = Math.abs(n);
  const symbol = withSymbol ? currencySymbol() : '';
  if (abs >= 1e7) return `${symbol}${(n / 1e7).toFixed(1).replace(/\.0$/, '')}Cr`;
  if (abs >= 1e5) return `${symbol}${(n / 1e5).toFixed(1).replace(/\.0$/, '')}L`;
  if (abs >= 1e3) return `${symbol}${(n / 1e3).toFixed(1).replace(/\.0$/, '')}k`;
  return `${symbol}${Math.round(n)}`;
}

export function ChartEmpty({
  message,
  className,
  style,
}: {
  message: string;
  className?: string;
  style?: React.CSSProperties;
}) {
  return (
    <div
      style={style}
      className={cn(
        'flex aspect-video w-full items-center justify-center rounded-md border border-dashed border-border text-xs text-muted-foreground',
        className
      )}
    >
      {message}
    </div>
  );
}
