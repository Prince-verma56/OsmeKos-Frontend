'use client';

import { currencySymbol, todayIso } from './formatPrefs';

export type Align = 'left' | 'right' | 'center';

export type Column<Row> = {
  header: string;
  value(row: Row): string | number | null | undefined;
  align?: Align;
  money?: boolean;
  width?: number;
};

export type ExportSpec<Row> = {
  title: string;
  subtitle?: string;
  columns: Column<Row>[];
  rows: Row[];
  totals?: (string | number | null)[];
  footnote?: string;
  orientation?: 'portrait' | 'landscape';
};

export type ExportFormat = 'csv' | 'xlsx' | 'pdf';

export type AnyExportSpec = ExportSpec<unknown>;

const stamp = () => todayIso();

const fileName = (title: string, ext: string) =>
  `${title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')}-${stamp()}.${ext}`;

function download(blob: Blob, name: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

const cellText = (v: string | number | null | undefined) =>
  v === null || v === undefined ? '' : String(v);

function toCsv<Row>(spec: ExportSpec<Row>): string {
  const q = (v: unknown) => `"${String(v ?? '').replaceAll('"', '""')}"`;
  const lines = [
    [spec.title],
    ...(spec.subtitle ? [[spec.subtitle]] : []),
    [],
    spec.columns.map((c) => c.header),
    ...spec.rows.map((r) => spec.columns.map((c) => cellText(c.value(r)))),
    ...(spec.totals ? [spec.totals.map(cellText)] : []),
  ];
  return '﻿' + lines.map((l) => l.map(q).join(',')).join('\r\n');
}

async function toXlsx<Row>(spec: ExportSpec<Row>): Promise<Blob> {
  const ExcelJS = (await import('exceljs')).default;
  const wb = new ExcelJS.Workbook();
  wb.creator = 'OsmeKos';
  wb.created = new Date();

  const sheet = wb.addWorksheet(spec.title.replace(/[*?:/\\[\]]/g, ' ').slice(0, 31), {
    views: [{ state: 'frozen', ySplit: spec.subtitle ? 4 : 3 }],
    pageSetup: { orientation: spec.orientation ?? 'landscape', fitToPage: true, fitToWidth: 1 },
  });

  const lastCol = spec.columns.length;
  const titleRow = sheet.addRow([spec.title]);
  titleRow.font = { bold: true, size: 14 };
  sheet.mergeCells(1, 1, 1, Math.max(1, lastCol));

  if (spec.subtitle) {
    const sub = sheet.addRow([spec.subtitle]);
    sub.font = { size: 10, color: { argb: 'FF6B7280' } };
    sheet.mergeCells(sub.number, 1, sub.number, Math.max(1, lastCol));
  }
  sheet.addRow([]);

  const header = sheet.addRow(spec.columns.map((c) => c.header));
  header.font = { bold: true, color: { argb: 'FFFFFFFF' } };
  header.alignment = { vertical: 'middle' };
  header.eachCell((cell) => {
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1E293B' } };
  });

  for (const r of spec.rows) {
    const row = sheet.addRow(spec.columns.map((c) => c.value(r) ?? ''));
    spec.columns.forEach((c, i) => {
      const cell = row.getCell(i + 1);
      if (c.money) cell.numFmt = `"${currencySymbol()}"#,##0.00`;
      if (c.align) cell.alignment = { horizontal: c.align };
      else if (c.money) cell.alignment = { horizontal: 'right' };
    });
  }

  if (spec.totals) {
    const row = sheet.addRow(spec.totals.map((v) => v ?? ''));
    row.font = { bold: true };
    row.eachCell((cell) => {
      cell.border = { top: { style: 'double', color: { argb: 'FF334155' } } };
    });
    spec.columns.forEach((c, i) => {
      if (c.money) row.getCell(i + 1).numFmt = `"${currencySymbol()}"#,##0.00`;
    });
  }

  if (spec.footnote) {
    sheet.addRow([]);
    const note = sheet.addRow([spec.footnote]);
    note.font = { size: 9, italic: true, color: { argb: 'FF6B7280' } };
  }

  spec.columns.forEach((c, i) => {
    const widest = spec.rows.reduce(
      (n, r) => Math.max(n, cellText(c.value(r)).length),
      c.header.length
    );
    sheet.getColumn(i + 1).width = Math.min(46, Math.max(11, widest + 2));
  });

  sheet.autoFilter = {
    from: { row: header.number, column: 1 },
    to: { row: header.number, column: Math.max(1, lastCol) },
  };

  const buf = await wb.xlsx.writeBuffer();
  return new Blob([buf], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  });
}

async function toPdf<Row>(spec: ExportSpec<Row>): Promise<Blob> {
  const { jsPDF } = await import('jspdf');
  const autoTable = (await import('jspdf-autotable')).default;

  const doc = new jsPDF({
    orientation: spec.orientation ?? 'landscape',
    unit: 'pt',
    format: 'a4',
  });
  const pageWidth = doc.internal.pageSize.getWidth();

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(15);
  doc.text(spec.title, 40, 44);

  if (spec.subtitle) {
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9.5);
    doc.setTextColor(107, 114, 128);
    doc.text(spec.subtitle, 40, 60);
  }

  doc.setFontSize(9);
  doc.setTextColor(156, 163, 175);
  doc.text(`Generated ${new Date().toLocaleString('en-IN')}`, pageWidth - 40, 44, {
    align: 'right',
  });

  const body = spec.rows.map((r) => spec.columns.map((c) => cellText(c.value(r))));
  if (spec.totals) body.push(spec.totals.map(cellText));
  const totalsIndex = spec.totals ? body.length - 1 : -1;

  autoTable(doc, {
    head: [spec.columns.map((c) => c.header)],
    body,
    startY: spec.subtitle ? 76 : 60,
    margin: { left: 40, right: 40, bottom: 42 },
    styles: { fontSize: 8, cellPadding: 4, overflow: 'linebreak', textColor: [30, 41, 59] },
    headStyles: { fillColor: [30, 41, 59], textColor: 255, fontStyle: 'bold', fontSize: 8 },
    alternateRowStyles: { fillColor: [248, 250, 252] },
    columnStyles: Object.fromEntries(
      spec.columns.map((c, i) => [
        i,
        { halign: c.align ?? (c.money ? 'right' : 'left'), ...(c.width ? { cellWidth: c.width } : {}) },
      ])
    ),
    didParseCell: (data) => {
      if (data.section === 'body' && data.row.index === totalsIndex) {
        data.cell.styles.fontStyle = 'bold';
        data.cell.styles.fillColor = [226, 232, 240];
      }
    },
    didDrawPage: () => {
      const h = doc.internal.pageSize.getHeight();
      doc.setFontSize(7.5);
      doc.setTextColor(156, 163, 175);
      if (spec.footnote) doc.text(spec.footnote, 40, h - 22, { maxWidth: pageWidth - 160 });
      doc.text(
        `Page ${doc.getNumberOfPages()}`,
        pageWidth - 40,
        h - 22,
        { align: 'right' }
      );
    },
  });

  return doc.output('blob');
}

export async function exportReport<Row>(format: ExportFormat, spec: ExportSpec<Row>) {
  if (format === 'csv') {
    download(new Blob([toCsv(spec)], { type: 'text/csv;charset=utf-8' }), fileName(spec.title, 'csv'));
    return;
  }
  if (format === 'xlsx') {
    download(await toXlsx(spec), fileName(spec.title, 'xlsx'));
    return;
  }
  download(await toPdf(spec), fileName(spec.title, 'pdf'));
}
