import React from 'react';
import { HugeiconsIcon } from '@hugeicons/react';
import {
  Add01Icon, AlertCircleIcon, Analytics01Icon, ArrowDown01Icon, ArrowLeft01Icon, ArrowRight01Icon,
  ArrowUpRight01Icon, Award01Icon, BankIcon, Calendar03Icon, Cancel01Icon, ChartIncreaseIcon,
  ChartLineData01Icon, CommandIcon, ComputerIcon, CreditCardIcon, DashboardSquare01Icon, Home01Icon,
  Invoice01Icon, LinkSquare02Icon, Logout01Icon, Menu01Icon, Money01Icon, Moon02Icon, MoreHorizontalIcon,
  Notification01Icon, PieChartIcon, Refresh01Icon, RepeatIcon, Search01Icon, Settings01Icon, SparklesIcon,
  Sun01Icon, TaskDone01Icon, Tick02Icon, ViewIcon, ViewOffSlashIcon, Wallet01Icon,
  ArrowDataTransferHorizontalIcon, Delete02Icon, Archive02Icon, InformationCircleIcon, Alert02Icon, Copy01Icon,
  Undo02Icon, CheckmarkCircle02Icon,
} from '@hugeicons/core-free-icons';

/**
 * Hugeicons for the New pages (decision Q11). A curated name map keeps the bundle to the icons in use.
 * User-chosen category and account icons (stored by name) get their own lookup when the pages that show them are built.
 */
const ICONS = {
  add: Add01Icon,
  alert: AlertCircleIcon,
  analytics: Analytics01Icon,
  archive: Archive02Icon,
  arrowDown: ArrowDown01Icon,
  arrowLeft: ArrowLeft01Icon,
  arrowRight: ArrowRight01Icon,
  arrowUpRight: ArrowUpRight01Icon,
  award: Award01Icon,
  bank: BankIcon,
  budget: PieChartIcon,
  calendar: Calendar03Icon,
  card: CreditCardIcon,
  check: Tick02Icon,
  close: Cancel01Icon,
  checkCircle: CheckmarkCircle02Icon,
  command: CommandIcon,
  copy: Copy01Icon,
  dashboard: DashboardSquare01Icon,
  delete: Delete02Icon,
  external: LinkSquare02Icon,
  forecast: ChartLineData01Icon,
  home: Home01Icon,
  info: InformationCircleIcon,
  investments: ChartIncreaseIcon,
  invoice: Invoice01Icon,
  logout: Logout01Icon,
  menu: Menu01Icon,
  money: Money01Icon,
  moon: Moon02Icon,
  more: MoreHorizontalIcon,
  notification: Notification01Icon,
  refresh: Refresh01Icon,
  repeat: RepeatIcon,
  search: Search01Icon,
  settings: Settings01Icon,
  sparkles: SparklesIcon,
  sun: Sun01Icon,
  system: ComputerIcon,
  tasks: TaskDone01Icon,
  transactions: ArrowDataTransferHorizontalIcon,
  undo: Undo02Icon,
  view: ViewIcon,
  viewOff: ViewOffSlashIcon,
  wallet: Wallet01Icon,
  warning: Alert02Icon,
} as const;

export type NvIconName = keyof typeof ICONS;

export const NvIcon: React.FC<{ name: NvIconName; size?: number; strokeWidth?: number; className?: string }> = ({
  name, size = 20, strokeWidth = 1.6, className,
}) => <HugeiconsIcon icon={ICONS[name]} size={size} strokeWidth={strokeWidth} color="currentColor" className={className} aria-hidden />;
