'use client';

import Link from 'next/link';
import { Icon } from '@/components/Icon';
import { PageHeader } from '@/components/ui';
import { useAuth } from '@/lib/auth';

type Report = {
  href: string;
  title: string;
  blurb: string;
  icon: string;
  answers: string;
  permissions: string[];
};

const SECTIONS: { heading: string; note: string; reports: Report[] }[] = [
  {
    heading: 'Money in',
    note: 'What customers bought and what they still owe.',
    reports: [
      {
        href: '/admin/reports/sales',
        title: 'Sales',
        blurb: 'What sold, to whom, and how much of it stuck.',
        icon: 'reports',
        answers: 'Which items and customers actually carry the revenue?',
        permissions: ['reports:sales'],
      },
      {
        href: '/admin/reports/b2b-sales',
        title: 'B2B Sales',
        blurb: 'What each business account bought, and what they still owe.',
        icon: 'org',
        answers: 'Which salons and shops carry the business, and who is late paying?',
        permissions: ['reports:sales'],
      },
      {
        href: '/admin/reports/offers',
        title: 'Offer Usage',
        blurb: 'How each discount was used, and what it gave away.',
        icon: 'discount',
        answers: 'Are my offers bringing in bigger orders?',
        permissions: ['reports:sales'],
      },
      {
        href: '/admin/reports/receivables',
        title: 'Receivables Ageing',
        blurb: 'Who owes you, bucketed by days past the due date.',
        icon: 'received',
        answers: 'Who do I chase first this week?',
        permissions: ['reports:receivables'],
      },
      {
        href: '/admin/reports/profit',
        title: 'Profit & Margin',
        blurb: 'What you made, after what the goods cost you.',
        icon: 'profit',
        answers: 'Is a big seller earning anything, or just moving?',
        permissions: ['reports:profit', 'costs:read'],
      },
    ],
  },
  {
    heading: 'Money out',
    note: 'What you bought and what suppliers are still owed.',
    reports: [
      {
        href: '/admin/reports/purchases',
        title: 'Purchases',
        blurb: 'What you bought, from whom, and what is still owed on it.',
        icon: 'po',
        answers: 'Where is the spend going?',
        permissions: ['reports:purchases'],
      },
      {
        href: '/admin/reports/payables',
        title: 'Payables Ageing',
        blurb: 'What you owe suppliers, and how late — the mirror of receivables.',
        icon: 'made',
        answers: 'Which bills are overdue right now?',
        permissions: ['reports:payables'],
      },
    ],
  },
  {
    heading: 'Goods and compliance',
    note: 'What is on the shelf, and what the department expects to see.',
    reports: [
      {
        href: '/admin/reports/stock',
        title: 'Stock',
        blurb: 'What is on the shelf, and how much can actually be sold.',
        icon: 'stock',
        answers: 'What is about to run out, and what is dead weight?',
        permissions: ['reports:stock'],
      },
      {
        href: '/admin/reports/stock-by-type',
        title: 'Stock by Type',
        blurb: 'Stock and its value split into finished products, packaging, raw materials and consumables.',
        icon: 'stock',
        answers: 'How much money is sitting in packaging versus finished products?',
        permissions: ['reports:stock'],
      },
      {
        href: '/admin/reports/batch-expiry',
        title: 'Batch Expiry',
        blurb: 'Batches still in stock, grouped by how soon they expire.',
        icon: 'clock',
        answers: 'What must be sold or cleared first?',
        permissions: ['reports:stock'],
      },
      {
        href: '/admin/reports/batch-trace',
        title: 'Batch History',
        blurb: 'Every batch you received, and where its units went.',
        icon: 'receives',
        answers: 'Who got units from this batch, and how many are left?',
        permissions: ['reports:stock'],
      },
      {
        href: '/admin/reports/qc',
        title: 'QC Rejections',
        blurb: 'What failed quality checks, which vendor sent it, and why.',
        icon: 'gst',
        answers: 'Which vendor keeps sending bad stock, and has it been credited?',
        permissions: ['qc:read'],
      },
      {
        href: '/admin/reports/gst',
        title: 'GST Return',
        blurb: 'Outward supplies in the tables GSTR-1 asks for, set against input credit.',
        icon: 'gst',
        answers: 'What do I hand the CA at month end?',
        permissions: ['reports:gst'],
      },
    ],
  },
];

export default function ReportsIndexPage() {
  const { can } = useAuth();
  const visible = SECTIONS.map((section) => ({
    ...section,
    reports: section.reports.filter((r) => r.permissions.every((p) => can(p))),
  })).filter((section) => section.reports.length > 0);

  return (
    <>
      <PageHeader
        title="Reports"
        subtitle="Money, stock, batches and quality - every report exports to Excel, CSV or PDF"
      />

      <div className="space-y-7">
        {visible.map((section) => (
          <section key={section.heading}>
            <div className="mb-3">
              <h2 className="text-sm font-semibold text-foreground">
                {section.heading}
              </h2>
              <p className="text-xs text-muted-foreground">{section.note}</p>
            </div>

            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
              {section.reports.map((r) => (
                <Link
                  key={r.href}
                  href={r.href}
                  className="group flex flex-col rounded-lg border border-border bg-card p-4
                    shadow-sm transition-all hover:border-border hover:shadow-md
                    focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold/20
"
                >
                  <div className="flex items-center gap-2.5">
                    <span
                      className="flex h-8 w-8 items-center justify-center rounded-md bg-muted
                        text-muted-foreground transition-colors group-hover:bg-primary
                        group-hover:text-primary-foreground
"
                    >
                      <Icon name={r.icon} className="h-4 w-4" />
                    </span>
                    <h3 className="font-medium text-foreground">{r.title}</h3>
                  </div>

                  <p className="mt-2.5 text-sm text-muted-foreground">{r.blurb}</p>

                  <p className="mt-auto pt-3 text-xs text-muted-foreground">
                    {r.answers}
                  </p>
                </Link>
              ))}
            </div>
          </section>
        ))}
      </div>

      <p className="mt-8 max-w-3xl text-xs text-muted-foreground">
        Every report reads the same rows the rest of the admin does — nothing is precomputed or
        cached, so a figure here always matches the document it came from. Tick rows to export just
        those, or export the whole report as it is filtered on screen.
      </p>
    </>
  );
}
