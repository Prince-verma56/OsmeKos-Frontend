'use client';

import { Button, Select, Input } from './ui';

export type RuleDraft = {
  field: string;
  operator: string;
  value: string;
  isExclusion: boolean;
};

export const RULE_FIELDS = [
  { value: 'TITLE', label: 'Product title' },
  { value: 'TYPE', label: 'Product type' },
  { value: 'BRAND', label: 'Brand' },
  { value: 'PRICE', label: 'Price' },
  { value: 'COMPARE_AT_PRICE', label: 'Compare-at price' },
  { value: 'WEIGHT', label: 'Weight' },
  { value: 'SKU', label: 'SKU' },
  { value: 'INVENTORY_STOCK', label: 'Inventory stock' },
];

const TEXT_OPS = ['EQUALS', 'NOT_EQUALS', 'CONTAINS', 'NOT_CONTAINS', 'STARTS_WITH', 'ENDS_WITH'];
const NUM_OPS = ['EQUALS', 'NOT_EQUALS', 'GREATER_THAN', 'LESS_THAN'];

const OP_LABEL: Record<string, string> = {
  EQUALS: 'is equal to',
  NOT_EQUALS: 'is not equal to',
  GREATER_THAN: 'is greater than',
  LESS_THAN: 'is less than',
  CONTAINS: 'contains',
  NOT_CONTAINS: 'does not contain',
  STARTS_WITH: 'starts with',
  ENDS_WITH: 'ends with',
};

const isNumeric = (field: string) =>
  ['PRICE', 'COMPARE_AT_PRICE', 'WEIGHT', 'INVENTORY_STOCK'].includes(field);

export const blankRule = (): RuleDraft => ({
  field: 'TYPE',
  operator: 'EQUALS',
  value: '',
  isExclusion: false,
});

export function RuleBuilder({
  rules,
  onChange,
  ruleMatch,
  onMatchChange,
}: {
  rules: RuleDraft[];
  onChange: (rules: RuleDraft[]) => void;
  ruleMatch: 'ALL' | 'ANY';
  onMatchChange: (m: 'ALL' | 'ANY') => void;
}) {
  function update(i: number, patch: Partial<RuleDraft>) {
    onChange(
      rules.map((r, idx) => {
        if (idx !== i) return r;
        const next = { ...r, ...patch };
        const allowed = isNumeric(next.field) ? NUM_OPS : TEXT_OPS;
        if (!allowed.includes(next.operator)) next.operator = allowed[0];
        return next;
      })
    );
  }

  return (
    <div>
      <div className="mb-3 flex items-center gap-2 text-sm">
        <span className="text-muted-foreground">Products must match</span>
        <Select value={ruleMatch} onChange={(e) => onMatchChange(e.target.value as 'ALL' | 'ANY')}>
          <option value="ALL">all conditions</option>
          <option value="ANY">any condition</option>
        </Select>
      </div>

      <div className="space-y-2">
        {rules.map((r, i) => {
          const ops = isNumeric(r.field) ? NUM_OPS : TEXT_OPS;
          return (
            <div key={i} className="flex flex-wrap items-center gap-2">
              <Select
                value={r.field}
                onChange={(e) => update(i, { field: e.target.value })}
                className="min-w-[150px]"
              >
                {RULE_FIELDS.map((f) => (
                  <option key={f.value} value={f.value}>
                    {f.label}
                  </option>
                ))}
              </Select>

              <Select
                value={r.operator}
                onChange={(e) => update(i, { operator: e.target.value })}
                className="min-w-[150px]"
              >
                {ops.map((o) => (
                  <option key={o} value={o}>
                    {OP_LABEL[o]}
                  </option>
                ))}
              </Select>

              <Input
                value={r.value}
                onChange={(e) => update(i, { value: e.target.value })}
                placeholder={isNumeric(r.field) ? '0' : 'Body Lotion'}
                className="max-w-[180px]"
              />

              <label className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <input
                  type="checkbox"
                  checked={r.isExclusion}
                  onChange={(e) => update(i, { isExclusion: e.target.checked })}
                  className="rounded border-border"
                />
                Exclude
              </label>

              {rules.length > 1 && (
                <Button
                  type="button"
                  size="sm"
                  variant="danger"
                  onClick={() => onChange(rules.filter((_, idx) => idx !== i))}
                >
                  ×
                </Button>
              )}
            </div>
          );
        })}
      </div>

      <Button type="button" size="sm" className="mt-3" onClick={() => onChange([...rules, blankRule()])}>
        + Add condition
      </Button>

      {rules.some((r) => r.field === 'INVENTORY_STOCK') && (
        <p className="mt-2 text-xs text-warning">
          Inventory stock conditions are stored but not yet resolved by the API, so they will not
          filter products.
        </p>
      )}
    </div>
  );
}
