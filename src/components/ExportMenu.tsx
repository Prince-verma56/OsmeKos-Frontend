'use client';

import { useState } from 'react';
import { ChevronDown, Download, FileSpreadsheet, FileText, Sheet } from 'lucide-react';
import { exportReport, type AnyExportSpec, type ExportFormat } from '@/lib/export';
import { useToast } from '@/lib/toast';
import { Button, Spinner } from './ui';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuTrigger } from './ui/dropdown-menu';

const FORMATS: { key: ExportFormat; label: string; hint: string; icon: typeof Sheet }[] = [
  { key: 'xlsx', label: 'Excel', hint: 'Figures stay numeric — sums and pivots work', icon: FileSpreadsheet },
  { key: 'csv', label: 'CSV', hint: 'Plain text, opens anywhere', icon: Sheet },
  { key: 'pdf', label: 'PDF', hint: 'Laid out for printing or sending on', icon: FileText },
];

export function ExportMenu({
  spec,
  disabled = false,
  label = 'Export',
}: {
  spec: () => AnyExportSpec;
  disabled?: boolean;
  label?: string;
}) {
  const [busy, setBusy] = useState<ExportFormat | null>(null);
  const toast = useToast();

  async function run(format: ExportFormat) {
    setBusy(format);
    try {
      await exportReport(format, spec());
    } catch (err) {
      toast.error(err instanceof Error ? `Export failed: ${err.message}` : 'Export failed. Try again.');
    } finally {
      setBusy(null);
    }
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button disabled={disabled || Boolean(busy)}>
          {busy ? <Spinner /> : <Download strokeWidth={1.5} />}
          {label}
          <ChevronDown className="size-3 opacity-60" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-64">
        <DropdownMenuLabel>Download as</DropdownMenuLabel>
        {FORMATS.map((f) => (
          <DropdownMenuItem key={f.key} onSelect={() => run(f.key)} className="items-start py-2">
            <f.icon strokeWidth={1.5} className="mt-0.5" />
            <span className="min-w-0 flex-1">
              <span className="block text-sm font-medium text-foreground">{f.label}</span>
              <span className="block text-xs text-muted-foreground">{f.hint}</span>
            </span>
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
