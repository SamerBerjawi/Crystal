import React, { useEffect, useMemo, useState } from 'react';
import { HugeiconsIcon } from '@hugeicons/react';
import {
  Airplane01Icon, Atm01Icon, Baby01Icon, BankIcon, Book01Icon, BookOpen01Icon, Briefcase01Icon, Building02Icon, Building03Icon, Bus01Icon,
  Calendar03Icon, Car01Icon, ChartIncreaseIcon, ChartLineData01Icon, Coffee01Icon, Coins01Icon, CreditCardIcon, DiamondIcon, Dumbbell01Icon,
  Exchange01Icon, FlashIcon, Folder01Icon, FootballIcon, FuelStationIcon, GiftIcon, Globe02Icon, GraduationScrollIcon, Hamburger01Icon,
  HeartCheckIcon, HelpCircleIcon, Home01Icon, Hospital01Icon, Hotel01Icon, Invoice01Icon, Layers01Icon, Luggage01Icon, Mail01Icon,
  MedicineBottle01Icon, MoneyBag01Icon, Music01Icon, PaintBoardIcon, Package01Icon, ParkingAreaSquareIcon, PawPrintIcon, PiggyBankIcon,
  PieChartIcon, Pizza01Icon, Restaurant01Icon, SchoolIcon, Shield01Icon, Shirt01Icon, ShoppingBag01Icon, ShoppingCart01Icon, SmartPhone01Icon,
  Sofa01Icon, StarIcon, Stethoscope02Icon, Store01Icon, Tag01Icon, TaxiIcon, Ticket01Icon, Train01Icon, Tv01Icon, UserGroupIcon, UserIcon,
  Video01Icon, Wallet01Icon, Wifi01Icon, Wrench01Icon,
} from '@hugeicons/core-free-icons';
import { cn } from '../../lib/utils';
import type { AccountType } from '../../types';
import { getAccountBrandfetchUrl } from '../../utils/brandfetch';
import { usePreferencesContextOptional } from '../../contexts/DomainProviders';
import { NvIcon, type NvIconName } from './NvIcon';

/*
 * Icons and logos for the things money is attached to: categories and tags (an icon the user picked, stored by name),
 * financial institutions and merchants (a logo, else an icon or a letter). UI_UX_DESIGN_REFERENCE.md N14.
 *
 * Stored names come in three spellings (old Material names such as `shopping_cart`, Phosphor names such as
 * `ShoppingCart`, and a few Untitled names); they are compared with case and separators removed. A curated list
 * keeps the bundle to the icons in use: a name that is not here falls back to a letter.
 */

type IconData = typeof Restaurant01Icon;

const GROUPS: [IconData, string[]][] = [
  [Restaurant01Icon, ['restaurant', 'restaurantmenu', 'forkknife', 'dining', 'food', 'localdining', 'deliverydining', 'cookingpot']],
  [Hamburger01Icon, ['hamburger', 'fastfood', 'lunchdining']],
  [Pizza01Icon, ['pizza', 'localpizza']],
  [Coffee01Icon, ['localcafe', 'coffee', 'cup', 'cafe', 'bakerydining']],
  [ShoppingCart01Icon, ['shoppingcart', 'cart', 'shoppingbasket', 'localgrocerystore', 'grocery']],
  [ShoppingBag01Icon, ['shoppingbag', 'bag', 'handbag', 'localmall']],
  [Store01Icon, ['storefront', 'store', 'storefrontoutlined', 'shop']],
  [Home01Icon, ['home', 'house', 'houseline', 'cottage']],
  [Building03Icon, ['apartment', 'buildings', 'building', 'realestateagent', 'domain']],
  [Building02Icon, ['building02', 'office', 'business']],
  [Wrench01Icon, ['homerepairservice', 'engineering', 'carrepair', 'handyman', 'wrench', 'build', 'construction', 'cleaningservices', 'plumbing']],
  [Car01Icon, ['directionscar', 'car', 'carcrash', 'commute', 'caralt']],
  [TaxiIcon, ['localtaxi', 'taxi']],
  [Train01Icon, ['train', 'tram', 'subway', 'directionstransit']],
  [Bus01Icon, ['bus', 'directionsbus']],
  [FuelStationIcon, ['localgasstation', 'gaspump', 'fuel', 'evstation']],
  [ParkingAreaSquareIcon, ['localparking', 'parking', 'cparking']],
  [Airplane01Icon, ['flight', 'flighttakeoff', 'airplane', 'airplanetilt', 'flightland']],
  [Hotel01Icon, ['hotel', 'bed', 'bedroomparent']],
  [Luggage01Icon, ['tour', 'luggage', 'suitcase', 'suitcaserolling', 'tent', 'beachaccess', 'explore']],
  [FlashIcon, ['zap', 'bolt', 'lightning', 'electricbolt', 'power']],
  [Wifi01Icon, ['router', 'wifi', 'wifihigh', 'cell']],
  [SmartPhone01Icon, ['smartphone', 'phone', 'devices', 'devicemobile', 'phoneandroid']],
  [Tv01Icon, ['tv', 'television', 'monitor', 'desktop', 'laptop']],
  [Hospital01Icon, ['medicalservices', 'hospital', 'localhospital', 'firstaid', 'firstaidkit']],
  [MedicineBottle01Icon, ['medication', 'vaccines', 'pill', 'localpharmacy', 'pharmacy']],
  [Stethoscope02Icon, ['stethoscope', 'healthandsafety']],
  [HeartCheckIcon, ['monitorheart', 'heart', 'heartbeat', 'favorite', 'volunteeractivism', 'selfimprovement']],
  [Book01Icon, ['book', 'books', 'menubook']],
  [BookOpen01Icon, ['bookopen', 'bookopen01', 'autostories', 'import']],
  [SchoolIcon, ['school', 'castforeducation']],
  [GraduationScrollIcon, ['graduationcap', 'certificate', 'certificate01', 'workspacepremium', 'assignmentreturn']],
  [Video01Icon, ['movie', 'theaters', 'film', 'filmslate', 'videocam', 'popcorn']],
  [Music01Icon, ['music', 'musicnote', 'musicnotes', 'headphones', 'queuemusic']],
  [Ticket01Icon, ['confirmationnumber', 'ticket', 'eventseat']],
  [PawPrintIcon, ['pets', 'pawprint', 'dog', 'cat']],
  [Baby01Icon, ['stroller', 'childcare', 'toys', 'babychangingstation', 'baby', 'face3', 'familyrestroom']],
  [Dumbbell01Icon, ['fitnesscenter', 'barbell', 'barbellfitness', 'sports']],
  [FootballIcon, ['sportssoccer', 'soccerball', 'football', 'sportsbasketball']],
  [PaintBoardIcon, ['palette', 'paintbrush', 'brush', 'colorlens']],
  [Shirt01Icon, ['checkroom', 'tshirt', 'shirt', 'dress']],
  [Sofa01Icon, ['chair', 'couch', 'weekend', 'bedroomchild']],
  [Shield01Icon, ['shield', 'security', 'policy', 'shieldcheck', 'localpolice', 'verifieduser', 'gavel', 'lock']],
  [GiftIcon, ['cardgiftcard', 'gift', 'redeem']],
  [Briefcase01Icon, ['work', 'briefcase', 'badge', 'businesscenter']],
  [MoneyBag01Icon, ['attachmoney', 'money', 'currencydollar', 'pricecheck', 'payments', 'monetizationon', 'cashregister']],
  [Coins01Icon, ['coinsstacked', 'coins', 'coin', 'savings']],
  [PiggyBankIcon, ['piggybank', 'piggybank01']],
  [Wallet01Icon, ['wallet', 'accountbalancewallet']],
  [CreditCardIcon, ['creditcard', 'credit', 'card']],
  [BankIcon, ['bank', 'accountbalance', 'assuredworkload', 'institution']],
  [Atm01Icon, ['atm', 'localatm']],
  [Exchange01Icon, ['currencyexchange', 'swaphoriz', 'swapvert', 'arrowsleftright', 'transfer', 'sync']],
  [UserIcon, ['person', 'user', 'face', 'account', 'accountcircle', 'sentimentverydissatisfied']],
  [UserGroupIcon, ['groups', 'users', 'people', 'group', 'diversity']],
  [Tag01Icon, ['tag', 'tags', 'label', 'localoffer', 'sell']],
  [Folder01Icon, ['folder', 'category', 'folderopen']],
  [Invoice01Icon, ['receipt', 'receiptlong', 'receiptcheck', 'receiptx', 'filecheck', 'description', 'article', 'requestquote']],
  [ChartIncreaseIcon, ['trendingup', 'trendup', 'chartlineup', 'linechartup01', 'showchart', 'candlestickchart']],
  [ChartLineData01Icon, ['barchart', 'chartbar', 'presentationchart01', 'analytics', 'insights', 'sliders']],
  [PieChartIcon, ['piechart', 'chartpie']],
  [DiamondIcon, ['diamond', 'gem', 'workspacepremium2', 'trophy01', 'trophy']],
  [Calendar03Icon, ['calendar', 'event', 'schedule', 'clock', 'calendarblank']],
  [StarIcon, ['star', 'grade', 'starfilled']],
  [Globe02Icon, ['globe', 'public', 'language', 'cloud', 'clouddownload', 'download']],
  [Package01Icon, ['box', 'package', 'inventory', 'localshipping', 'deployedcode']],
  [Mail01Icon, ['mail', 'email', 'envelope']],
  [Layers01Icon, ['extension', 'layers', 'apps', 'layoutalt']],
  [HelpCircleIcon, ['helpoutline', 'help', 'question', 'checkcircle']],
];

const norm = (name: string) => name.toLowerCase().replace(/[^a-z0-9]/g, '');

const LOOKUP = new Map<string, IconData>(GROUPS.flatMap(([icon, names]) => names.map(n => [norm(n), icon] as [string, IconData])));

/** Whether a stored icon name has a glyph here. */
export const hasEntityIcon = (name?: string) => !!name && LOOKUP.has(norm(name));

/** The glyph for a stored icon name, or a letter in the entity's colour when the name is unknown. */
export const EntityGlyph: React.FC<{ icon?: string; label: string; color?: string; size?: number; className?: string }> = ({ icon, label, color, size = 16, className }) => {
  const data = icon ? LOOKUP.get(norm(icon)) : undefined;
  return data ? (
    <HugeiconsIcon icon={data} size={size} strokeWidth={1.7} color={color || 'currentColor'} className={cn('shrink-0', className)} aria-hidden />
  ) : (
    <span className={cn('flex shrink-0 items-center justify-center font-semibold leading-none', className)} style={{ width: size, height: size, fontSize: Math.round(size * 0.78), color: color || undefined }} aria-hidden>
      {(label.trim()[0] || '?').toUpperCase()}
    </span>
  );
};

/**
 * A logo on a white chip, else (when the logo is missing or does not load) the fallback: a letter by default, or
 * an icon. Used for merchants, vendors and financial institutions.
 */
export const LogoTile: React.FC<{
  url?: string | null; label: string; size?: number; rounded?: 'full' | 'lg'; fallbackIcon?: 'bank'; className?: string;
}> = ({ url, label, size = 32, rounded = 'lg', fallbackIcon, className }) => {
  const [failed, setFailed] = useState(false);
  const shape = rounded === 'full' ? 'rounded-full' : size >= 40 ? 'rounded-xl' : 'rounded-lg';
  const style = { width: size, height: size };
  if (url && !failed) {
    return (
      <span className={cn('flex shrink-0 items-center justify-center overflow-hidden bg-white', shape, className)} style={style} aria-hidden>
        <img src={url} alt="" loading="lazy" onError={() => setFailed(true)} className="h-full w-full object-cover" />
      </span>
    );
  }
  return (
    <span className={cn('flex shrink-0 items-center justify-center bg-nv-surface text-nv-muted', shape, className)} style={style} aria-hidden>
      {fallbackIcon ? <NvIcon name={fallbackIcon} size={Math.round(size * 0.5)} /> : <span className="font-semibold" style={{ fontSize: Math.round(size * 0.42) }}>{(label.trim()[0] || '?').toUpperCase()}</span>}
    </span>
  );
};

/** A category or tag with its icon in its colour, then the name. */
export const EntityLabel: React.FC<{ icon?: string; label: string; color?: string; size?: number; className?: string; children?: React.ReactNode }> = ({ icon, label, color, size = 15, className, children }) => (
  <span className={cn('inline-flex min-w-0 items-center gap-1.5', className)}>
    <EntityGlyph icon={icon} label={label} color={color} size={size} />
    <span className="truncate">{children ?? label}</span>
  </span>
);

/**
 * Standard icon mapping for account archetypes across all account surfaces.
 */
export const accountTypeIcon = (account: { type: string; subType?: string; otherSubType?: string; name?: string }): NvIconName => {
  if (account.otherSubType === 'Meal Voucher' || account.subType === 'Meal Voucher') return 'card';
  if (account.type === 'Checking') return 'bank';
  if (account.type === 'Savings') return 'piggy';
  if (account.type === 'Credit Card') return 'card';
  if (account.type === 'Loan') return 'invoice';
  if (account.type === 'Lending') return 'transactions';
  if (account.type === 'Property') return 'home';
  if (account.type === 'Vehicle') return 'pin';
  if (account.type === 'Investment') {
    return account.subType === 'Spare Change' ? 'piggy' : 'investments';
  }
  if (account.type === 'Other Liabilities') return 'warning';
  return 'wallet';
};

export interface AccountLogoProps {
  account: {
    id?: string;
    name: string;
    type: AccountType;
    subType?: string;
    icon?: string;
    imageUrl?: string | null;
    financialInstitution?: string | null;
    cardNetwork?: string | null;
    website?: string | null;
  };
  brandfetchClientId?: string | null;
  merchantLogoOverrides?: Record<string, string>;
  size?: number;
  rounded?: 'full' | 'lg' | 'xl';
  className?: string;
}

/**
 * 3-tier Account Logo Component (UI_UX_DESIGN_REFERENCE.md §20.5):
 * 1. Brandfetch logo (if configured with brandfetchClientId, with fallback=404).
 * 2. User's uploaded image (account.imageUrl) if Brandfetch not configured or failed to load.
 * 3. Icon (account.icon if recognizable entity glyph, else archetype icon).
 */
export const AccountLogo: React.FC<AccountLogoProps> = ({
  account,
  brandfetchClientId,
  merchantLogoOverrides,
  size = 40,
  rounded = 'xl',
  className,
}) => {
  const prefContext = usePreferencesContextOptional();
  const effectiveClientId = brandfetchClientId ?? prefContext?.preferences?.brandfetchClientId;
  const effectiveOverrides = merchantLogoOverrides ?? prefContext?.preferences?.merchantLogoOverrides;

  // Tier 1: Brandfetch URL
  const brandfetchUrl = useMemo(
    () =>
      getAccountBrandfetchUrl(account, effectiveClientId, effectiveOverrides, {
        width: size * 2,
        height: size * 2,
      }),
    [account, effectiveClientId, effectiveOverrides, size]
  );

  // Tier 2: User's uploaded image
  const uploadedUrl = account.imageUrl?.trim() || null;

  const [brandfetchFailed, setBrandfetchFailed] = useState(false);
  const [uploadedFailed, setUploadedFailed] = useState(false);

  useEffect(() => {
    setBrandfetchFailed(false);
    setUploadedFailed(false);
  }, [account.id, brandfetchUrl, uploadedUrl]);

  const shapeClass =
    rounded === 'full' ? 'rounded-full' : rounded === 'lg' || (size < 40 && rounded !== 'xl') ? 'rounded-lg' : 'rounded-xl';
  const style = { width: size, height: size };
  const iconSize = Math.max(12, Math.round(size * 0.5));

  // 1. Tier 1: Brandfetch
  if (brandfetchUrl && !brandfetchFailed) {
    return (
      <span
        className={cn(
          'flex shrink-0 items-center justify-center overflow-hidden bg-white shadow-xs',
          shapeClass,
          className
        )}
        style={style}
        aria-hidden
      >
        <img
          src={brandfetchUrl}
          alt=""
          loading="lazy"
          onError={() => setBrandfetchFailed(true)}
          className="h-full w-full object-cover"
        />
      </span>
    );
  }

  // 2. Tier 2: User's uploaded image
  if (uploadedUrl && !uploadedFailed) {
    return (
      <span
        className={cn(
          'flex shrink-0 items-center justify-center overflow-hidden bg-white shadow-xs',
          shapeClass,
          className
        )}
        style={style}
        aria-hidden
      >
        <img
          src={uploadedUrl}
          alt=""
          loading="lazy"
          onError={() => setUploadedFailed(true)}
          className="h-full w-full object-cover"
        />
      </span>
    );
  }

  // 3. Tier 3: Icon
  return (
    <span
      className={cn(
        'flex shrink-0 items-center justify-center bg-nv-inset text-nv-ink',
        shapeClass,
        className
      )}
      style={style}
      aria-hidden
    >
      {account.icon && hasEntityIcon(account.icon) ? (
        <EntityGlyph icon={account.icon} label={account.name} size={iconSize} />
      ) : (
        <NvIcon name={accountTypeIcon(account)} size={iconSize} />
      )}
    </span>
  );
};
