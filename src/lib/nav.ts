import type { ReactNode } from 'react';
import type { LucideIcon } from 'lucide-react';
import {
  LayoutDashboard, ShoppingBag, FileText, Wallet, ReceiptText, Undo2, Truck, FileBadge,
  Users, Building2, Tags, Package, Gift, FolderTree, LayoutGrid, Warehouse, FlaskConical,
  ClipboardCheck, Megaphone, ArrowLeftRight, Box, Store, ClipboardList, Receipt,
  HandCoins, FileMinus, Percent, Sparkles, Star, BarChart3, TrendingUp, PackageSearch,
  CalendarClock, GitBranch, ShieldCheck, Coins, Award, Landmark, CreditCard, Layers, TicketPercent,
  ShoppingCart, Settings2, MapPin, SlidersHorizontal, Bell, Plug, KeyRound, UserCog, ScrollText,
} from 'lucide-react';

export type NavItem = {
  label: string;
  href: string;
  icon: LucideIcon;
  permission?: string;
  soon?: boolean;
  exact?: boolean;
  base?: string;
};

export type NavGroup = { group: string; items: NavItem[] };

export const NAV: NavGroup[] = [
  { group: '', items: [{ label: 'Dashboard', href: '/admin', icon: LayoutDashboard, permission: 'dashboard:read', exact: true }] },
  {
    group: 'Sales',
    items: [
      { label: 'Orders', href: '/admin/orders', icon: ShoppingBag, permission: 'orders:read' },
      { label: 'Invoices', href: '/admin/invoices', icon: FileText, permission: 'invoices:read' },
      { label: 'Payments received', href: '/admin/payments-received', icon: Wallet, permission: 'payments-received:read' },
      { label: 'Credit notes', href: '/admin/credit-notes', icon: ReceiptText, permission: 'credit-notes:read' },
      { label: 'Returns & replacements', href: '/admin/returns', icon: Undo2, permission: 'returns:read' },
      { label: 'Delivery challans', href: '/admin/delivery-challans', icon: Truck, permission: 'delivery-challans:read' },
      { label: 'e-Way bills', href: '/admin/eway-bills', icon: FileBadge, permission: 'eway-bills:read' },
    ],
  },
  {
    group: 'Customers',
    items: [
      { label: 'Customers', href: '/admin/customers', icon: Users, permission: 'customers:read' },
    ],
  },
  {
    group: 'B2B (wholesale)',
    items: [
      { label: 'B2B orders', href: '/admin/b2b-orders', icon: ShoppingBag, permission: 'orders:read' },
      { label: 'Business accounts', href: '/admin/business-accounts', icon: Building2, permission: 'b2b-accounts:read' },
      { label: 'B2B sales', href: '/admin/reports/b2b-sales', icon: BarChart3, permission: 'reports:sales' },
      { label: 'Price lists', href: '/price-lists', icon: Tags, permission: 'b2b-accounts:read', soon: true },
    ],
  },
  {
    group: 'Catalogue',
    items: [
      { label: 'Products', href: '/admin/products', icon: Package, permission: 'products:read' },
      { label: 'Combos & gift sets', href: '/admin/bundles', icon: Gift, permission: 'products:read' },
      { label: 'Categories', href: '/admin/categories', icon: FolderTree, permission: 'categories:read' },
      { label: 'Collections', href: '/admin/collections', icon: LayoutGrid, permission: 'collections:read' },
    ],
  },
  {
    group: 'Inventory',
    items: [
      { label: 'Stock', href: '/admin/inventory', icon: Warehouse, permission: 'inventory:read' },
      { label: 'Batches', href: '/admin/batches', icon: FlaskConical, permission: 'inventory:read' },
      { label: 'Purchase receives', href: '/admin/purchase-receives', icon: ClipboardCheck, permission: 'purchase-receives:read' },
      { label: 'Quality check', href: '/admin/quality-check', icon: ShieldCheck, permission: 'qc:read' },
      { label: 'Samples & marketing', href: '/marketing-issues', icon: Megaphone, permission: 'inventory:read', soon: true },
      { label: 'Adjustments & transfers', href: '/admin/inventory/adjustments', icon: ArrowLeftRight, permission: 'inventory:read' },
      { label: 'Items', href: '/admin/items', icon: Box, permission: 'items:read' },
    ],
  },
  {
    group: 'Purchases',
    items: [
      { label: 'Vendors', href: '/admin/vendors', icon: Store, permission: 'vendors:read' },
      { label: 'Purchase orders', href: '/admin/purchase-orders', icon: ClipboardList, permission: 'purchase-orders:read' },
      { label: 'Bills', href: '/admin/bills', icon: Receipt, permission: 'bills:read' },
      { label: 'Payments made', href: '/admin/payments-made', icon: HandCoins, permission: 'payments-made:read' },
      { label: 'Vendor credits', href: '/admin/vendor-credits', icon: FileMinus, permission: 'vendor-credits:read' },
      { label: 'Expenses', href: '/admin/expenses', icon: Coins, permission: 'expenses:read' },
    ],
  },
  {
    group: 'Marketing',
    items: [
      { label: 'Overview', href: '/admin/marketing', icon: Megaphone, permission: 'marketing:read' },
      { label: 'Offers & discounts', href: '/admin/discounts', icon: Percent, permission: 'discounts:read' },
      { label: 'Influencers', href: '/influencers', icon: Sparkles, permission: 'discounts:read', soon: true },
      { label: 'Reviews', href: '/reviews', icon: Star, permission: 'products:read', soon: true },
    ],
  },
  {
    group: 'Reports',
    items: [
      { label: 'Sales', href: '/admin/reports/sales', icon: BarChart3, permission: 'reports:sales' },
      { label: 'Offer usage', href: '/admin/reports/offers', icon: TicketPercent, permission: 'reports:sales' },
      { label: 'Unit economics', href: '/admin/unit-economics', icon: Coins, permission: 'costs:read' },
      { label: 'Profit & margin', href: '/admin/reports/profit', icon: TrendingUp, permission: 'reports:profit' },
      { label: 'Stock & valuation', href: '/admin/reports/stock', icon: PackageSearch, permission: 'reports:stock' },
      { label: 'Stock by type', href: '/admin/reports/stock-by-type', icon: Layers, permission: 'reports:stock' },
      { label: 'Batch expiry', href: '/admin/reports/batch-expiry', icon: CalendarClock, permission: 'reports:stock' },
      { label: 'Batch history', href: '/admin/reports/batch-trace', icon: GitBranch, permission: 'reports:stock' },
      { label: 'QC rejections', href: '/admin/reports/qc', icon: ShieldCheck, permission: 'qc:read' },
      { label: 'Marketing cost', href: '/admin/reports/marketing', icon: Coins, permission: 'reports:sales', soon: true },
      { label: 'Influencers', href: '/admin/reports/influencers', icon: Award, permission: 'reports:sales', soon: true },
      { label: 'Paid & outstanding', href: '/admin/money', icon: Coins, permission: 'reports:receivables' },
      { label: 'Receivables', href: '/admin/reports/receivables', icon: Landmark, permission: 'reports:receivables' },
      { label: 'Payables', href: '/admin/reports/payables', icon: CreditCard, permission: 'reports:payables' },
      { label: 'Purchases', href: '/admin/reports/purchases', icon: ShoppingCart, permission: 'reports:purchases' },
      { label: 'GST return', href: '/admin/reports/gst', icon: FileText, permission: 'reports:gst' },
    ],
  },
  {
    group: 'Settings',
    items: [
      { label: 'Organization & brand', href: '/admin/organization', icon: Settings2, permission: 'settings:read' },
      { label: 'Locations', href: '/admin/locations', icon: MapPin, permission: 'locations:read' },
      { label: 'Masters', href: '/admin/masters', icon: SlidersHorizontal, permission: 'masters:read' },
      { label: 'Notifications & templates', href: '/notifications', icon: Bell, permission: 'settings:read', soon: true },
      { label: 'Integrations', href: '/integrations', icon: Plug, permission: 'settings:read', soon: true },
      { label: 'Roles', href: '/admin/roles', icon: KeyRound, permission: 'roles:read' },
      { label: 'Staff', href: '/admin/admin-users', icon: UserCog, permission: 'users:read' },
      { label: 'Audit trail', href: '/admin/audit-logs', icon: ScrollText, permission: 'audit:read' },
    ],
  },
];

export type QuickAction = { label: string; href: string; permission: string; icon: LucideIcon; group: string };

export const QUICK_ACTIONS: QuickAction[] = [
  { label: 'D2C order', href: '/admin/orders/new/d2c', permission: 'orders:write', icon: ShoppingBag, group: 'Sales' },
  { label: 'B2B order', href: '/admin/orders/new/b2b', permission: 'orders:write', icon: ShoppingBag, group: 'Sales' },
  { label: 'Invoice', href: '/admin/invoices/new', permission: 'invoices:write', icon: FileText, group: 'Sales' },
  { label: 'Payment received', href: '/admin/payments-received/new', permission: 'payments-received:write', icon: Wallet, group: 'Sales' },
  { label: 'Credit note', href: '/admin/credit-notes/new', permission: 'credit-notes:write', icon: ReceiptText, group: 'Sales' },
  { label: 'Delivery challan', href: '/admin/delivery-challans/new', permission: 'delivery-challans:write', icon: Truck, group: 'Sales' },
  { label: 'e-Way bill', href: '/admin/eway-bills/new', permission: 'eway-bills:write', icon: FileBadge, group: 'Sales' },
  { label: 'Customer', href: '/admin/customers/new', permission: 'customers:write', icon: Users, group: 'Customers' },
  { label: 'Product', href: '/admin/products/new', permission: 'products:write', icon: Package, group: 'Catalogue' },
  { label: 'Collection', href: '/admin/collections/new', permission: 'collections:write', icon: LayoutGrid, group: 'Catalogue' },
  { label: 'Item', href: '/admin/items/new', permission: 'items:write', icon: Box, group: 'Inventory' },
  { label: 'Stock adjustment', href: '/admin/inventory/adjustments/new', permission: 'inventory:write', icon: ArrowLeftRight, group: 'Inventory' },
  { label: 'Stock transfer', href: '/admin/inventory/transfers/new', permission: 'inventory:write', icon: ArrowLeftRight, group: 'Inventory' },
  { label: 'Vendor', href: '/admin/vendors/new', permission: 'vendors:write', icon: Store, group: 'Purchases' },
  { label: 'Purchase order', href: '/admin/purchase-orders/new', permission: 'purchase-orders:write', icon: ClipboardList, group: 'Purchases' },
  { label: 'Receipt', href: '/admin/purchase-receives/new', permission: 'purchase-receives:write', icon: ClipboardCheck, group: 'Purchases' },
  { label: 'Bill', href: '/admin/bills/new', permission: 'bills:write', icon: Receipt, group: 'Purchases' },
  { label: 'Payment made', href: '/admin/payments-made/new', permission: 'payments-made:write', icon: HandCoins, group: 'Purchases' },
  { label: 'Vendor credit', href: '/admin/vendor-credits/new', permission: 'vendor-credits:write', icon: FileMinus, group: 'Purchases' },
];

export type NavHit = { group: string; label: string; href: string; base: string; exact?: boolean };

const UNLISTED_PAGES: NavHit[] = [
  { base: '/reports', group: '', label: 'Reports', href: '/admin/reports' },
  { base: '/inventory/transfers', group: 'Inventory', label: 'Adjustments & transfers', href: '/admin/inventory/adjustments' },
];

const PAGES: NavHit[] = [
  ...NAV.flatMap((g) =>
    g.items
      .filter((i) => !i.soon)
      .map((i) => ({ group: g.group, label: i.label, href: i.href, base: i.base ?? i.href, exact: i.exact }))
  ),
  ...UNLISTED_PAGES,
];

const matches = (pathname: string, base: string, exact?: boolean) =>
  exact ? pathname === base : pathname === base || pathname.startsWith(base + '/');

export function findNav(pathname: string): NavHit | null {
  let best: NavHit | null = null;
  for (const page of PAGES) {
    if (matches(pathname, page.base, page.exact) && (!best || page.base.length > best.base.length)) best = page;
  }
  return best;
}

export type Crumb = { label: ReactNode; href?: string };

export function breadcrumbs(pathname: string): Crumb[] {
  const hit = findNav(pathname);
  if (!hit) return [];
  const crumbs: Crumb[] = [];
  if (hit.group) crumbs.push({ label: hit.group });
  crumbs.push({ label: hit.label, href: hit.href });
  const rest = pathname.slice(hit.base.length).split('/').filter(Boolean);
  rest.forEach((seg, i) => {
    const last = i === rest.length - 1;
    const isId = /^[0-9a-f-]{20,}$/i.test(seg);
    if (isId && rest[i + 1] === 'qc') {
      crumbs.push({ label: 'Receipt', href: `${hit.base}/${seg}` });
      return;
    }
    if (seg === 'variants' || seg === 'qc' || (isId && !last)) return;
    if (seg === 'new') crumbs.push({ label: 'New' });
    else if (seg === 'edit') crumbs.push({ label: 'Edit' });
    else if (seg === 'adjustments') crumbs.push({ label: 'Adjustments' });
    else if (seg === 'transfers') crumbs.push({ label: 'Transfers' });
    else if (seg === 'd2c' || seg === 'b2b') crumbs.push({ label: seg.toUpperCase() });
    else if (isId) crumbs.push({ label: 'Detail' });
    else crumbs.push({ label: seg.charAt(0).toUpperCase() + seg.slice(1) });
  });
  return crumbs;
}
