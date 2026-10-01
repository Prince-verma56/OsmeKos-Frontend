'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { api, shortDate, errorMessage, type Paged } from '@/lib/api';
import {
  useRowSelection, SelectAllBox, SelectBox, BulkBar,
} from '@/components/BulkActions';
import {
  Badge, Button, EmptyRow, ErrorBox, Input, Loading, PageHeader,
  Pagination, Select, Table, Td, Th,
} from '@/components/ui';

import { CardList, RecordCard } from '@/components/CardList';
type Rule = { id: string; field: string; operator: string; value: string; isExclusion: boolean };

type Collection = {
  id: string;
  title: string;
  handle: string;
  imageUrl: string | null;
  type: 'MANUAL' | 'AUTOMATIC';
  ruleMatch: 'ALL' | 'ANY';
  sortOrder: string;
  status: 'ACTIVE' | 'DRAFT' | 'ARCHIVED';
  productCount: number;
  updatedAt: string;
  rules: Rule[];
};

const OPERATORS: Record<string, string> = {
  EQUALS: 'is equal to',
  NOT_EQUALS: 'is not equal to',
  GREATER_THAN: 'is greater than',
  LESS_THAN: 'is less than',
  CONTAINS: 'contains',
  NOT_CONTAINS: 'does not contain',
  STARTS_WITH: 'starts with',
  ENDS_WITH: 'ends with',
};

export function ruleText(r: Rule) {
  const field = r.field.replaceAll('_', ' ').toLowerCase();
  return `${r.isExclusion ? 'Exclude ' : ''}${field} ${OPERATORS[r.operator] ?? r.operator} ${r.value}`;
}

export default function CollectionsPage() {
  const [rows, setRows] = useState<Collection[]>([]);
  const sel = useRowSelection(rows.map((r) => r.id));
  const [meta, setMeta] = useState<Paged<Collection>['meta'] | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const [search, setSearch] = useState('');
  const [type, setType] = useState('');
  const [status, setStatus] = useState('');
  const [page, setPage] = useState(1);

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const res = await api.get<Paged<Collection>>('/collections', {
        page,
        limit: 20,
        search: search || undefined,
        type: type || undefined,
        status: status || undefined,
      });
      setRows(res.data);
      setMeta(res.meta);
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setLoading(false);
    }
  }, [page, search, type, status]);

  useEffect(() => {
    const t = setTimeout(load, search ? 300 : 0);
    return () => clearTimeout(t);
  }, [load, search]);

  return (
    <>
      <PageHeader
        title="Collections"
        subtitle="Group products manually or with automatic conditions"
        actions={
          <Link href="/admin/collections/new">
            <Button variant="primary">+ Add collection</Button>
          </Link>
        }
      />

      <BulkBar
        count={sel.count}
        noun="collection"
        endpoint="/collections/bulk-delete"
        ids={sel.selected}
        onDone={() => {
          sel.clear();
          load();
        }}
        onClear={sel.clear}
      />

      <div className="rounded-lg border border-border bg-card">
        <div className="flex flex-wrap gap-2 border-b border-border p-3">
          <Input
            placeholder="Search collections…"
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
            className="max-w-xs"
          />
          <Select
            value={type}
            onChange={(e) => {
              setType(e.target.value);
              setPage(1);
            }}
          >
            <option value="">All types</option>
            <option value="MANUAL">Manual</option>
            <option value="AUTOMATIC">Automatic</option>
          </Select>
          <Select
            value={status}
            onChange={(e) => {
              setStatus(e.target.value);
              setPage(1);
            }}
          >
            <option value="">All statuses</option>
            <option value="ACTIVE">Active</option>
            <option value="DRAFT">Draft</option>
            <option value="ARCHIVED">Archived</option>
          </Select>
          {(search || type || status) && (
            <Button
              variant="ghost"
              onClick={() => {
                setSearch('');
                setType('');
                setStatus('');
                setPage(1);
              }}
            >
              Clear
            </Button>
          )}
        </div>

        {error ? (
          <div className="p-4">
            <ErrorBox message={error} onRetry={load} />
          </div>
        ) : loading ? (
          <Loading />
        ) : (
          <>
            <CardList empty="No collections yet">
              {rows.map((c) => (
                <RecordCard
                  key={c.id}
                  href={`/admin/collections/${c.id}`}
                  mono={false}
                  title={c.title}
                  date={c.handle}
                  primary={
                    c.type === 'AUTOMATIC'
                      ? (c.rules.slice(0, 2).map(ruleText).join(' · ') || 'No rules yet')
                      : `${c.productCount} product${c.productCount === 1 ? '' : 's'}`
                  }
                  secondary={
                    c.type === 'AUTOMATIC' && c.rules.length > 2
                      ? `+${c.rules.length - 2} more rule${c.rules.length - 2 === 1 ? '' : 's'}`
                      : undefined
                  }
                  footer={`Updated ${shortDate(c.updatedAt)}`}
                  select={
                    <SelectBox checked={sel.isSelected(c.id)} onChange={() => sel.toggle(c.id)} />
                  }
                  badges={
                    <>
                      <Badge tone={c.type === 'AUTOMATIC' ? 'purple' : 'gray'}>
                        {c.type === 'AUTOMATIC' ? 'Automatic' : 'Manual'}
                      </Badge>
                      <Badge status={c.status}>{c.status}</Badge>
                    </>
                  }
                />
              ))}
            </CardList>

            <div className="hidden md:block">
            <Table>
              <thead>
                <tr>
                  <Th className="w-8">
                    <SelectAllBox
                      checked={sel.allOnPage}
                      indeterminate={sel.someOnPage}
                      onChange={sel.toggleAll}
                    />
                  </Th>
                  <Th>Title</Th>
                  <Th>Type</Th>
                  <Th>Products</Th>
                  <Th>Conditions</Th>
                  <Th>Status</Th>
                  <Th>Updated</Th>
                </tr>
              </thead>
              <tbody>
                {rows.length === 0 && <EmptyRow colSpan={7} message="No collections yet" />}
                {rows.map((c) => (
                  <tr key={c.id} className="hover:bg-muted/60">
                    <Td>
                      <SelectBox checked={sel.isSelected(c.id)} onChange={() => sel.toggle(c.id)} />
                    </Td>
                    <Td>
                      <Link
                        href={`/admin/collections/${c.id}`}
                        className="font-medium text-gold-ink hover:underline"
                      >
                        {c.title}
                      </Link>
                      <div className="text-xs text-muted-foreground">{c.handle}</div>
                    </Td>
                    <Td>
                      <Badge tone={c.type === 'AUTOMATIC' ? 'purple' : 'gray'}>
                        {c.type === 'AUTOMATIC' ? 'Automatic' : 'Manual'}
                      </Badge>
                    </Td>
                    <Td>
                      {c.type === 'AUTOMATIC' ? (
                        <span className="text-muted-foreground">rule-based</span>
                      ) : (
                        c.productCount
                      )}
                    </Td>
                    <Td className="max-w-xs">
                      {c.rules.length === 0 ? (
                        <span className="text-muted-foreground">—</span>
                      ) : (
                        <div className="space-y-0.5">
                          {c.rules.slice(0, 2).map((r) => (
                            <div key={r.id} className="truncate text-xs text-muted-foreground">
                              {ruleText(r)}
                            </div>
                          ))}
                          {c.rules.length > 2 && (
                            <div className="text-xs text-muted-foreground">
                              +{c.rules.length - 2} more
                            </div>
                          )}
                        </div>
                      )}
                    </Td>
                    <Td>
                      <Badge status={c.status}>{c.status}</Badge>
                    </Td>
                    <Td className="whitespace-nowrap text-xs text-muted-foreground">
                      {shortDate(c.updatedAt)}
                    </Td>
                  </tr>
                ))}
              </tbody>
            </Table>

            </div>
            {meta && (
              <Pagination
                page={meta.page}
                totalPages={meta.totalPages}
                total={meta.total}
                onPage={setPage}
              />
            )}
          </>
        )}
      </div>
    </>
  );
}
