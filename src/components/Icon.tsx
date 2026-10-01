'use client';

import type { LucideIcon } from 'lucide-react';
import {
  LayoutDashboard, Users, ShoppingBag, FileText, Truck, ArrowDownToLine, ArrowUpFromLine, ReceiptText,
  FileBadge, Undo2, Package, FolderTree, LayoutGrid, Tag, Plus, Warehouse, SlidersHorizontal, Store,
  ClipboardList, PackageCheck, Receipt, LineChart, TrendingUp, ShieldCheck, Boxes, MapPin, KeyRound,
  UserCog, Building2, Percent, ScrollText, Search, ChevronRight, ChevronDown, Sun, Moon, LogOut, Check,
  AlertTriangle, X, Menu, Mail, Phone, Box, Clock, IndianRupee, ExternalLink,
} from 'lucide-react';
import { cn } from '@/lib/cn';

const ICONS: Record<string, LucideIcon> = {
  dashboard: LayoutDashboard,
  customers: Users,
  orders: ShoppingBag,
  invoices: FileText,
  challans: Truck,
  received: ArrowDownToLine,
  made: ArrowUpFromLine,
  creditnote: ReceiptText,
  eway: FileBadge,
  returns: Undo2,
  products: Package,
  categories: FolderTree,
  collections: LayoutGrid,
  items: Tag,
  plus: Plus,
  inventory: Warehouse,
  adjustments: SlidersHorizontal,
  vendors: Store,
  po: ClipboardList,
  receives: PackageCheck,
  bills: Receipt,
  reports: LineChart,
  profit: TrendingUp,
  gst: ShieldCheck,
  stock: Boxes,
  locations: MapPin,
  roles: KeyRound,
  users: UserCog,
  org: Building2,
  discount: Percent,
  audit: ScrollText,
  search: Search,
  chevron: ChevronRight,
  chevronDown: ChevronDown,
  sun: Sun,
  moon: Moon,
  logout: LogOut,
  check: Check,
  alert: AlertTriangle,
  close: X,
  menu: Menu,
  mail: Mail,
  phone: Phone,
  pin: MapPin,
  box: Box,
  truck: Truck,
  clock: Clock,
  rupee: IndianRupee,
  external: ExternalLink,
};

export type IconName = keyof typeof ICONS;

export function Icon({ name, className = 'h-4 w-4' }: { name: string; className?: string }) {
  const Glyph = ICONS[name];
  if (!Glyph) return null;
  return <Glyph strokeWidth={1.5} aria-hidden className={cn('shrink-0', className)} />;
}
