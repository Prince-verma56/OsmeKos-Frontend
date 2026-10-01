'use client';

import { useMemo, useState } from 'react';
import {
  columnVisibilityFeature,
  createColumnHelper,
  rowSelectionFeature,
  rowSortingFeature,
  tableFeatures,
  useTable,
  type ColumnDef,
  type ColumnVisibilityState,
  type RowData,
  type RowSelectionState,
  type SortingState,
  type Updater,
} from '@tanstack/react-table';
import { ArrowDown, ArrowUp, ArrowUpDown, Bookmark, Check, Columns3, Inbox, Search, Trash2, X } from 'lucide-react';
import { cn } from '@/lib/cn';
import { useLocalStore } from '@/lib/localStore';
import { Button, EmptyState, ErrorBox, Input, Pagination, TableSkeleton } from './ui';
import { Checkbox } from './ui/misc';
import {
  DropdownMenu, DropdownMenuCheckboxItem, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel,
  DropdownMenuSeparator, DropdownMenuTrigger,
} from './ui/dropdown-menu';
import { Modal } from './Modal';

export const dataTableFeatures = tableFeatures({ rowSelectionFeature, columnVisibilityFeature, rowSortingFeature });
type Features = typeof dataTableFeatures;

export type ColumnExtras = { label?: string; align?: 'left' | 'right' | 'center'; className?: string; headerClassName?: string };
export type DataColumn<T extends RowData> = ColumnDef<Features, T, unknown> & ColumnExtras;
const extras = (def: unknown) => def as ColumnExtras;
export const dataColumns = <T extends RowData>() => createColumnHelper<Features, T>();

const EMPTY_ROWS: never[] = [];
const resolve = <S,>(updater: Updater<S>, prev: S): S =>
  typeof updater === 'function' ? (updater as (old: S) => S)(prev) : updater;

export function DataTable<T extends RowData>({
  columns,
  data,
  getRowId,
  total,
  page,
  pageSize,
  onPageChange,
  onPageSizeChange,
  sortBy = '',
  sortOrder = '',
  onSortChange,
  loading = false,
  error,
  onRetry,
  empty,
  filtered = false,
  onClearFilters,
  toolbar,
  selectable = false,
  bulkActions,
  viewKey,
  views,
  mobileCard,
  rowClassName,
}: {
  columns: DataColumn<T>[];
  data: T[] | undefined;
  getRowId: (row: T) => string;
  total: number;
  page: number;
  pageSize: number;
  onPageChange: (page: number) => void;
  onPageSizeChange: (size: number) => void;
  sortBy?: string;
  sortOrder?: string;
  onSortChange?: (sortBy: string, sortOrder: 'asc' | 'desc' | '') => void;
  loading?: boolean;
  error?: string;
  onRetry?: () => void;
  empty: { title: string; description?: React.ReactNode; action?: React.ReactNode; icon?: React.ReactNode };
  filtered?: boolean;
  onClearFilters?: () => void;
  toolbar?: React.ReactNode;
  selectable?: boolean;
  bulkActions?: (ids: string[], clear: () => void) => React.ReactNode;
  viewKey: string;
  views?: { query: string; apply: (query: string) => void };
  mobileCard?: (row: T, select: React.ReactNode) => React.ReactNode;
  rowClassName?: (row: T) => string | undefined;
}) {
  const rows = data ?? (EMPTY_ROWS as T[]);
  const [rowSelection, setRowSelection] = useState<RowSelectionState>({});
  const [columnVisibility, setColumnVisibility] = useLocalStore<ColumnVisibilityState>(`osmekos.columns.${viewKey}`, {});

  const sorting = useMemo<SortingState>(
    () => (sortBy && sortOrder ? [{ id: sortBy, desc: sortOrder === 'desc' }] : []),
    [sortBy, sortOrder]
  );

  const allColumns = useMemo<DataColumn<T>[]>(() => {
    const withAccessors = columns.map((col) => {
      const def = col as DataColumn<T> & { accessorKey?: string; accessorFn?: unknown; id?: string };
      if (def.accessorKey || def.accessorFn || !def.id || def.enableSorting === false) return col;
      const key = def.id;
      return { ...def, accessorFn: (row: T) => (row as Record<string, unknown>)[key] } as DataColumn<T>;
    });
    if (!selectable) return withAccessors;
    const select: DataColumn<T> = {
      id: '__select',
      enableSorting: false,
      enableHiding: false,
      className: 'w-9',
      headerClassName: 'w-9',
      header: ({ table }) => (
        <Checkbox
          aria-label="Select all on this page"
          checked={table.getIsAllPageRowsSelected() ? true : table.getIsSomePageRowsSelected() ? 'indeterminate' : false}
          onCheckedChange={(v) => table.toggleAllPageRowsSelected(Boolean(v))}
        />
      ),
      cell: ({ row }) => (
        <Checkbox
          aria-label="Select row"
          checked={row.getIsSelected()}
          onCheckedChange={(v) => row.toggleSelected(Boolean(v))}
        />
      ),
    };
    return [select, ...withAccessors];
  }, [columns, selectable]);

  const table = useTable({
    features: dataTableFeatures,
    columns: allColumns,
    data: rows,
    getRowId,
    manualSorting: true,
    enableMultiSort: false,
    enableSortingRemoval: true,
    state: { rowSelection, columnVisibility, sorting },
    onRowSelectionChange: (u) => setRowSelection((prev) => resolve(u, prev)),
    onColumnVisibilityChange: (u) => setColumnVisibility(resolve(u, columnVisibility)),
    onSortingChange: (u) => {
      if (!onSortChange) return;
      const next = resolve(u, sorting);
      const first = next[0];
      onSortChange(first ? first.id : '', first ? (first.desc ? 'desc' : 'asc') : '');
    },
  });

  const selectedIds = Object.keys(rowSelection);
  const clearSelection = () => setRowSelection({});
  const hideable = table.getAllLeafColumns().filter((c) => c.getCanHide());
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const firstLoad = loading && !data;
  const visibleCount = table.getVisibleLeafColumns().length;

  return (
    <div className="overflow-hidden rounded-lg border border-border bg-card shadow-xs">
      <div className="flex flex-wrap items-center gap-2 border-b border-border p-3">
        <div className="flex min-w-0 flex-1 flex-wrap items-center gap-2">{toolbar}</div>
        <div className="flex items-center gap-1.5">
          {filtered && onClearFilters && (
            <Button variant="ghost" size="sm" onClick={onClearFilters}>
              <X /> Clear filters
            </Button>
          )}
          {views && <SavedViews viewKey={viewKey} query={views.query} apply={views.apply} />}
          {hideable.length > 0 && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm" aria-label="Choose columns">
                  <Columns3 strokeWidth={1.5} />
                  <span className="hidden sm:inline">Columns</span>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-52">
                <DropdownMenuLabel>Show columns</DropdownMenuLabel>
                {hideable.map((column) => (
                  <DropdownMenuCheckboxItem
                    key={column.id}
                    checked={column.getIsVisible()}
                    onCheckedChange={(v) => column.toggleVisibility(Boolean(v))}
                    onSelect={(e) => e.preventDefault()}
                  >
                    {extras(column.columnDef).label ?? column.id}
                  </DropdownMenuCheckboxItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
          )}
        </div>
      </div>

      {selectable && selectedIds.length > 0 && (
        <div className="fade-up flex flex-wrap items-center gap-3 border-b border-gold/30 bg-gold-soft px-3 py-2 text-sm">
          <span className="font-medium text-foreground">
            {selectedIds.length} selected
          </span>
          {bulkActions?.(selectedIds, clearSelection)}
          <button type="button" onClick={clearSelection} className="ml-auto text-xs text-muted-foreground hover:text-foreground hover:underline">
            Clear selection
          </button>
        </div>
      )}

      {error && (
        <div className="border-b border-border p-3">
          <ErrorBox message={error} onRetry={onRetry} />
        </div>
      )}

      {firstLoad ? (
        <TableSkeleton rows={8} cols={Math.min(visibleCount, 6)} />
      ) : rows.length === 0 && !error ? (
        <EmptyState
          icon={empty.icon ?? (filtered ? <Search /> : <Inbox />)}
          title={filtered ? 'Nothing matches these filters' : empty.title}
          description={filtered ? 'Try a different search, or clear the filters to see everything.' : empty.description}
          action={
            filtered && onClearFilters ? (
              <Button onClick={onClearFilters}>
                <X /> Clear filters
              </Button>
            ) : (
              empty.action
            )
          }
        />
      ) : (
        <div className={cn('transition-opacity', loading && 'opacity-60')} aria-busy={loading}>
          {mobileCard && (
            <ul className="divide-y divide-border md:hidden">
              {table.getRowModel().rows.map((row) => (
                <li key={row.id} className={cn('px-3 py-2.5', row.getIsSelected() && 'bg-gold-soft')}>
                  {mobileCard(
                    row.original,
                    selectable ? (
                      <Checkbox aria-label="Select row" checked={row.getIsSelected()} onCheckedChange={(v) => row.toggleSelected(Boolean(v))} />
                    ) : null
                  )}
                </li>
              ))}
            </ul>
          )}
          <div className={cn('max-h-[calc(100vh-18rem)] overflow-auto', mobileCard && 'hidden md:block')}>
            <table className="data-table w-full border-separate border-spacing-0 text-sm">
              <thead>
                {table.getHeaderGroups().map((group) => (
                  <tr key={group.id}>
                    {group.headers.map((header) => {
                      const meta = extras(header.column.columnDef);
                      const canSort = Boolean(onSortChange) && header.column.getCanSort();
                      const dir = header.column.getIsSorted();
                      return (
                        <th
                          key={header.id}
                          scope="col"
                          aria-sort={dir === 'asc' ? 'ascending' : dir === 'desc' ? 'descending' : undefined}
                          className={cn(
                            'sticky top-0 z-10 whitespace-nowrap border-b border-border bg-muted px-3 py-2 text-left font-display text-[11px] font-medium uppercase tracking-[0.14em] text-muted-foreground',
                            meta?.align === 'right' && 'text-right',
                            meta?.align === 'center' && 'text-center',
                            meta?.headerClassName
                          )}
                        >
                          {header.isPlaceholder ? null : canSort ? (
                            <button
                              type="button"
                              onClick={header.column.getToggleSortingHandler()}
                              className={cn(
                                'group inline-flex items-center gap-1 rounded-sm uppercase tracking-[0.14em] transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                                meta?.align === 'right' && 'flex-row-reverse',
                                dir && 'text-foreground'
                              )}
                            >
                              <table.FlexRender header={header} />
                              {dir === 'asc' ? (
                                <ArrowUp className="size-3 text-gold-ink" />
                              ) : dir === 'desc' ? (
                                <ArrowDown className="size-3 text-gold-ink" />
                              ) : (
                                <ArrowUpDown className="size-3 opacity-0 transition-opacity group-hover:opacity-60" />
                              )}
                            </button>
                          ) : (
                            <table.FlexRender header={header} />
                          )}
                        </th>
                      );
                    })}
                  </tr>
                ))}
              </thead>
              <tbody>
                {table.getRowModel().rows.map((row) => (
                  <tr key={row.id} className={rowClassName?.(row.original)} data-state={row.getIsSelected() ? 'selected' : undefined}>
                    {row.getVisibleCells().map((cell) => {
                      const meta = extras(cell.column.columnDef);
                      return (
                        <td
                          key={cell.id}
                          className={cn(
                            'border-b border-border/70 px-3 py-2 align-middle tabular-nums text-foreground/90',
                            row.getIsSelected() && 'bg-gold-soft',
                            meta?.align === 'right' && 'whitespace-nowrap text-right',
                            meta?.align === 'center' && 'text-center',
                            meta?.className
                          )}
                        >
                          <table.FlexRender cell={cell} />
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {!firstLoad && total > 0 && (
        <Pagination
          page={page}
          totalPages={totalPages}
          total={total}
          onPage={onPageChange}
          pageSize={pageSize}
          onPageSize={onPageSizeChange}
        />
      )}
    </div>
  );
}

type SavedView = { name: string; query: string };

function SavedViews({ viewKey, query, apply }: { viewKey: string; query: string; apply: (query: string) => void }) {
  const [views, setViews] = useLocalStore<SavedView[]>(`osmekos.views.${viewKey}`, []);
  const [naming, setNaming] = useState(false);
  const [name, setName] = useState('');
  const clean = (q: string) => {
    const sp = new URLSearchParams(q);
    sp.delete('page');
    sp.sort();
    return sp.toString();
  };
  const current = clean(query);
  const active = views.find((v) => clean(v.query) === current);

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="outline" size="sm" aria-label="Saved views">
            <Bookmark strokeWidth={1.5} className={active ? 'fill-gold text-gold' : undefined} />
            <span className="hidden max-w-32 truncate sm:inline">{active ? active.name : 'Views'}</span>
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-60">
          <DropdownMenuLabel>Saved views</DropdownMenuLabel>
          {views.length === 0 && <p className="px-2 pb-2 text-xs text-muted-foreground">Save the filters you use often to get back to them in one click.</p>}
          {views.map((v) => (
            <DropdownMenuItem key={v.name} onSelect={() => apply(v.query)} className="group pr-1">
              <Check className={cn('size-3.5', active?.name === v.name ? 'opacity-100 text-gold-ink' : 'opacity-0')} />
              <span className="min-w-0 flex-1 truncate">{v.name}</span>
              <button
                type="button"
                aria-label={`Delete view ${v.name}`}
                onPointerDown={(e) => e.stopPropagation()}
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  setViews(views.filter((x) => x.name !== v.name));
                }}
                className="rounded p-1 text-muted-foreground opacity-0 transition-opacity hover:bg-destructive/10 hover:text-destructive focus-visible:opacity-100 group-hover:opacity-100 group-focus:opacity-100"
              >
                <Trash2 className="size-3.5" />
              </button>
            </DropdownMenuItem>
          ))}
          <DropdownMenuSeparator />
          <DropdownMenuItem
            disabled={!current}
            onSelect={() => {
              setName('');
              setNaming(true);
            }}
          >
            <Bookmark strokeWidth={1.5} />
            Save current filters…
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
      <Modal
        open={naming}
        onClose={() => setNaming(false)}
        title="Save this view"
        width="max-w-sm"
        footer={
          <>
            <Button onClick={() => setNaming(false)}>Cancel</Button>
            <Button
              variant="primary"
              disabled={!name.trim()}
              onClick={() => {
                const n = name.trim();
                setViews([...views.filter((v) => v.name !== n), { name: n, query: current }]);
                setNaming(false);
              }}
            >
              Save view
            </Button>
          </>
        }
      >
        <label className="block">
          <span className="mb-1 block text-xs font-medium text-muted-foreground">Name</span>
          <Input
            autoFocus
            value={name}
            onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && name.trim()) {
                const n = name.trim();
                setViews([...views.filter((v) => v.name !== n), { name: n, query: current }]);
                setNaming(false);
              }
            }}
            placeholder="e.g. Manufacturers with dues"
          />
        </label>
        <p className="mt-2 text-xs text-muted-foreground">Saved on this browser for you. It remembers the search, filters and sorting.</p>
      </Modal>
    </>
  );
}
