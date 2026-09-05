import React, { useState, useMemo, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { MapContainer, TileLayer, Marker as LeafletMarker, useMap } from 'react-leaflet';
import L from 'leaflet';
import { Transaction, Account, Tag, Category } from '../types';

const MapContainerAny = MapContainer as any;
const TileLayerAny = TileLayer as any;
const MarkerAny = LeafletMarker as any;
import { formatCurrency, parseLocalDate } from '../utils';
import { getMerchantLogoUrl, normalizeMerchantKey } from '../utils/brandfetch';
import { usePreferencesSelector } from '../contexts/DomainProviders';
import Icon from './ui/Icon';

interface TransactionDetailModalProps {
  isOpen: boolean;
  onClose: () => void;
  title?: string;
  transactions: Transaction[];
  accounts: Account[];
  tags: Tag[];
  allCategories?: Category[];
  onEdit?: (transaction: Transaction) => void;
  onDelete?: (transaction: Transaction) => void;
}

// Helper to center and lock Leaflet map
const MapCenterController: React.FC<{ center: [number, number]; zoom?: number }> = ({ center, zoom = 14 }) => {
  const map = useMap();
  useEffect(() => {
    map.setView(center, zoom, { animate: false });
    map.invalidateSize();
  }, [map, center, zoom]);
  return null;
};

// Create custom Apple Workout fluorescent neon pin marker
const createAppleNeonPinIcon = (iconName: string = 'shopping_bag', logoUrl?: string | null) => {
  const html = `
    <div class="relative flex items-center justify-center -translate-x-1/2 -translate-y-1/2">
      <!-- Pulsing Aura Ring -->
      <div class="absolute -inset-2 rounded-full bg-[#a3e635]/30 animate-ping opacity-75"></div>
      
      <!-- Glowing Outer Badge -->
      <div class="relative w-12 h-12 rounded-full bg-[#a3e635] shadow-[0_0_22px_rgba(163,230,53,0.9)] flex items-center justify-center p-0">
        ${
          logoUrl
            ? `<img src="${logoUrl}" class="w-full h-full object-cover rounded-full bg-black/10 p-0 border-0" onerror="this.style.display='none'" />`
            : `<div class="w-full h-full flex items-center justify-center text-black font-black text-sm">📍</div>`
        }
      </div>

      <!-- Teardrop Bottom Point -->
      <div class="absolute -bottom-1.5 left-1/2 -translate-x-1/2 w-2.5 h-2.5 bg-[#a3e635] rotate-45 border-r border-b border-black"></div>
    </div>
  `;

  return L.divIcon({
    className: 'custom-apple-neon-pin',
    html,
    iconSize: [48, 48],
    iconAnchor: [24, 48],
  });
};

const TransactionDetailModal: React.FC<TransactionDetailModalProps> = ({
  isOpen,
  onClose,
  title,
  transactions,
  accounts,
  tags,
  allCategories = [],
  onEdit,
  onDelete,
}) => {
  const [isVisible, setIsVisible] = useState(false);
  const brandfetchClientId = usePreferencesSelector(p => (p.brandfetchClientId || '').trim());
  const merchantLogoOverrides = usePreferencesSelector(p => p.merchantLogoOverrides || {});
  const [logoLoadError, setLogoLoadError] = useState(false);

  // Entrance & Exit animation handling
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
      const frame = requestAnimationFrame(() => setIsVisible(true));
      const handleKeyDown = (e: KeyboardEvent) => {
        if (e.key === 'Escape') handleClose();
      };
      window.addEventListener('keydown', handleKeyDown);
      return () => {
        cancelAnimationFrame(frame);
        document.body.style.overflow = '';
        window.removeEventListener('keydown', handleKeyDown);
      };
    }
  }, [isOpen]);

  const handleClose = () => {
    setIsVisible(false);
    setTimeout(onClose, 280);
  };

  const primaryTx = useMemo(() => transactions[0] || null, [transactions]);

  const counterpartTx = useMemo(() => {
    if (transactions.length > 1) {
      return transactions.find(t => t.id !== primaryTx?.id) || null;
    }
    return null;
  }, [transactions, primaryTx]);

  const account = useMemo(() => {
    if (!primaryTx) return null;
    return accounts.find(a => a.id === primaryTx.accountId) || null;
  }, [accounts, primaryTx]);

  const counterpartAccount = useMemo(() => {
    if (!counterpartTx) return null;
    return accounts.find(a => a.id === counterpartTx.accountId) || null;
  }, [accounts, counterpartTx]);

  // Merchant Branding
  const merchantQuery = primaryTx?.merchant || primaryTx?.description || '';
  const merchantLogoUrl = useMemo(() => {
    if (!merchantQuery.trim()) return null;
    return getMerchantLogoUrl(merchantQuery, brandfetchClientId, merchantLogoOverrides, {
      fallback: 'lettermark',
      type: 'icon',
      width: 96,
      height: 96,
    });
  }, [merchantQuery, brandfetchClientId, merchantLogoOverrides]);

  const institutionLogoUrl = useMemo(() => {
    if (!account?.financialInstitution && !account?.name) return null;
    return getMerchantLogoUrl(account.financialInstitution || account.name, brandfetchClientId, merchantLogoOverrides, {
      fallback: 'lettermark',
      type: 'icon',
      width: 64,
      height: 64,
    });
  }, [account, brandfetchClientId, merchantLogoOverrides]);

  const isTransfer = Boolean(primaryTx?.transferId || counterpartTx);
  const isIncome = primaryTx?.type === 'income';

  // Resolved Coordinates
  const hasCoordinates = primaryTx?.latitude !== undefined && primaryTx?.longitude !== undefined && !isNaN(primaryTx.latitude) && !isNaN(primaryTx.longitude);
  const mapCenter: [number, number] = useMemo(() => {
    if (hasCoordinates) {
      return [primaryTx!.latitude!, primaryTx!.longitude!];
    }
    // Default fallback coordinates (Brussels / Central Europe)
    return [50.8503, 4.3517];
  }, [hasCoordinates, primaryTx]);

  const pinIcon = useMemo(() => {
    return createAppleNeonPinIcon('store', (!logoLoadError && merchantLogoUrl) ? merchantLogoUrl : null);
  }, [merchantLogoUrl, logoLoadError]);

  if (!isOpen || !primaryTx) return null;

  const dateObj = parseLocalDate(primaryTx.date);
  const formattedFullDate = dateObj.toLocaleDateString('en-US', {
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  });

  const cityName = primaryTx.city || primaryTx.placeName || (primaryTx.address ? primaryTx.address.split(',')[0] : null);
  const locationSubtitle = primaryTx.locationLabel || primaryTx.placeName || primaryTx.city || primaryTx.country || 'Digital Transaction';

  const txTags = (primaryTx.tagIds || [])
    .map(id => tags.find(t => t.id === id))
    .filter(Boolean) as Tag[];

  const modalContent = (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center p-3 sm:p-4 overflow-y-auto">
      {/* Backdrop */}
      <div
        className={`fixed inset-0 bg-black/60 backdrop-blur-sm transition-opacity duration-300 ${
          isVisible ? 'opacity-100' : 'opacity-0'
        }`}
        onClick={handleClose}
      />

      {/* Portrait Apple Workout Overview Card */}
      <div
        className={`relative w-full max-w-[430px] max-h-[94vh] sm:max-h-[90vh] bg-[#0c0d12] text-white rounded-[2.5rem] sm:rounded-[2.75rem] shadow-[0_25px_70px_-15px_rgba(0,0,0,0.95)] border border-white/10 flex flex-col overflow-hidden transform transition-all duration-300 ease-[cubic-bezier(0.16,1,0.3,1)] ${
          isVisible ? 'scale-100 opacity-100 translate-y-0' : 'scale-95 opacity-0 translate-y-4'
        }`}
        onClick={e => e.stopPropagation()}
      >
        {/* Top Floating Glass Controls (Location Badge & Close Only) */}
        <div className="absolute top-4 left-4 right-4 z-40 flex items-center justify-between pointer-events-none">
          {/* Location Badge (Apple Workout style, e.g. 🧭 Evere) */}
          <div className="pointer-events-auto inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-black/50 backdrop-blur-md border border-white/10 text-white text-xs font-semibold shadow-md">
            <Icon name="marker_pin" className="text-[#a3e635] text-xs" />
            <span className="truncate max-w-[190px]">{cityName || locationSubtitle}</span>
          </div>

          {/* Close Button Only */}
          <div className="pointer-events-auto flex items-center">
            <button
              type="button"
              onClick={handleClose}
              className="w-9 h-9 rounded-full bg-black/50 backdrop-blur-md border border-white/10 hover:bg-white/20 text-white flex items-center justify-center transition-all cursor-pointer shadow-md active:scale-95"
              title="Close (Esc)"
            >
              <Icon name="close" className="text-base" />
            </button>
          </div>
        </div>

        {/* Scrollable Container */}
        <div className="flex-1 overflow-y-auto pb-8 safe-bottom custom-scrollbar">
          
          {/* 1. TOP HERO MAP VIEWPORT */}
          <div className="relative w-full h-[300px] sm:h-[330px] bg-[#12141a] overflow-hidden shrink-0">
            {hasCoordinates ? (
              <div className="absolute inset-0 z-0 isolate overflow-hidden">
                <MapContainerAny
                  key={`apple-map-${primaryTx.id}-${primaryTx.latitude}-${primaryTx.longitude}`}
                  center={mapCenter}
                  zoom={15}
                  zoomControl={false}
                  attributionControl={false}
                  dragging={false}
                  scrollWheelZoom={false}
                  doubleClickZoom={false}
                  touchZoom={false}
                  className="w-full h-full !z-0"
                >
                  <TileLayerAny
                    url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
                    maxZoom={19}
                  />
                  <MarkerAny position={mapCenter} icon={pinIcon} />
                  <MapCenterController center={mapCenter} zoom={15} />
                </MapContainerAny>
              </div>
            ) : (
              /* Stylized Apple Vector Topographic / Dark Map Background */
              <div className="absolute inset-0 z-0 isolate bg-gradient-to-br from-[#0c1624] via-[#09101b] to-[#040608] flex items-center justify-center overflow-hidden">
                {/* Cartographic Grid & Geometry */}
                <div className="absolute inset-0 opacity-20 bg-[radial-gradient(#38bdf8_1px,transparent_1px)] [background-size:16px_16px]"></div>
                <div className="absolute w-80 h-80 rounded-full border border-sky-500/15 animate-pulse"></div>
                <div className="absolute w-52 h-52 rounded-full border border-[#a3e635]/20"></div>

                {/* Glowing Apple Neon Pin in Center */}
                <div className="relative z-10 flex flex-col items-center">
                  <div className="relative flex items-center justify-center">
                    <div className="absolute -inset-3.5 rounded-full bg-[#a3e635]/20 animate-ping"></div>
                    <div className="w-16 h-16 rounded-full bg-[#a3e635] flex items-center justify-center p-0 shadow-[0_0_28px_rgba(163,230,53,0.95)] overflow-hidden">
                      {merchantLogoUrl && !logoLoadError ? (
                        <img
                          src={merchantLogoUrl}
                          alt={merchantQuery}
                          className="w-full h-full object-cover rounded-full p-0 border-0"
                          onError={() => setLogoLoadError(true)}
                        />
                      ) : (
                        <span className="text-black font-black text-xl">
                          {primaryTx.merchant?.charAt(0)?.toUpperCase() || '📍'}
                        </span>
                      )}
                    </div>
                  </div>
                  <span className="mt-2.5 text-2xs font-bold uppercase tracking-wider text-[#a3e635] bg-black/60 px-2.5 py-0.5 rounded-full border border-[#a3e635]/30">
                    {locationSubtitle}
                  </span>
                </div>
              </div>
            )}

            {/* Bottom Gradient Shade Overlay (blends map effortlessly into dark body) */}
            <div className="absolute inset-x-0 bottom-0 h-40 bg-gradient-to-t from-[#0c0d12] via-[#0c0d12]/85 to-transparent pointer-events-none z-[15]" />

            {/* Float Overlay Content: Title & Highlight Metric over bottom of map */}
            <div className="absolute inset-x-0 bottom-0 p-5 sm:p-6 z-[20] space-y-1.5 pointer-events-auto">
              <div className="flex items-center gap-2 text-2xs font-semibold text-gray-400">
                <span>{formattedFullDate}</span>
                <span>•</span>
                <span className="text-gray-300 font-medium">
                  {isTransfer ? 'Transfer' : (account?.name || 'Account')}
                </span>
              </div>

              {/* Big Bold Apple Title (e.g. Racquetball) */}
              <h2 className="text-2xl sm:text-3xl font-black text-white tracking-tight truncate leading-tight drop-shadow-sm">
                {primaryTx.merchant || primaryTx.description}
              </h2>

              {/* Fluorescent Apple Highlight Metric (e.g. 664CAL / €195.40) */}
              <div className="flex items-baseline gap-2 pt-0.5">
                <span
                  className={`text-3xl sm:text-4xl font-black font-mono tracking-tight ${
                    isIncome
                      ? 'text-[#34d399] drop-shadow-[0_0_15px_rgba(52,211,153,0.5)]'
                      : isTransfer
                      ? 'text-[#60a5fa] drop-shadow-[0_0_15px_rgba(96,165,250,0.5)]'
                      : 'text-[#a3e635] drop-shadow-[0_0_15px_rgba(163,230,53,0.55)]'
                  }`}
                >
                  {isIncome ? '+' : ''}
                  {formatCurrency(primaryTx.amount, primaryTx.currency)}
                </span>

                <span className="text-xs font-bold text-gray-400 uppercase tracking-wider font-mono">
                  {primaryTx.currency}
                </span>
              </div>
            </div>
          </div>

          {/* 2. APPLE CONTEXT WEATHER / METADATA PILLS */}
          <div className="px-5 sm:px-6 py-2.5 flex items-center gap-5 text-xs text-gray-300 border-b border-white/5 overflow-x-auto no-scrollbar">
            <div className="flex items-center gap-1.5 shrink-0">
              <Icon name="loyalty" className="text-amber-400 text-sm shrink-0" />
              <div className="flex flex-col">
                <span className="text-2xs uppercase text-gray-500 font-bold tracking-wider">Category</span>
                <span className="font-bold text-white text-xs">{primaryTx.category || 'General'}</span>
              </div>
            </div>

            <div className="h-6 w-px bg-white/10 shrink-0" />

            <div className="flex items-center gap-1.5 shrink-0">
              <Icon name="credit_card" className="text-sky-400 text-sm shrink-0" />
              <div className="flex flex-col">
                <span className="text-2xs uppercase text-gray-500 font-bold tracking-wider">Method</span>
                <span className="font-bold text-white text-xs">{account?.type || 'Direct'}</span>
              </div>
            </div>

            {(primaryTx as any).status && (
              <>
                <div className="h-6 w-px bg-white/10 shrink-0" />
                <div className="flex items-center gap-1.5 shrink-0">
                  <Icon name="check_circle" className="text-emerald-400 text-sm shrink-0" />
                  <div className="flex flex-col">
                    <span className="text-2xs uppercase text-gray-500 font-bold tracking-wider">Status</span>
                    <span className="font-bold text-white text-xs capitalize">{(primaryTx as any).status}</span>
                  </div>
                </div>
              </>
            )}
          </div>

          {/* 3. "TRANSACTION DETAILS >" INTERACTIVE STRIP (Single "Edit Entry" trigger) */}
          <div className="px-5 sm:px-6 py-4 flex items-center justify-between">
            <h3 className="text-base sm:text-lg font-bold text-white tracking-tight flex items-center gap-1.5">
              <span>Transaction Details</span>
            </h3>

            {onEdit && (
              <button
                type="button"
                onClick={() => {
                  handleClose();
                  setTimeout(() => onEdit(primaryTx), 100);
                }}
                className="inline-flex items-center gap-1 text-xs font-bold text-[#a3e635] hover:text-white transition-colors cursor-pointer group py-1 px-2.5 rounded-xl hover:bg-white/5 active:scale-95"
              >
                <span>Edit Entry</span>
                <Icon name="chevron_right" className="text-sm transition-transform group-hover:translate-x-0.5" />
              </button>
            )}
          </div>

          {/* 4. APPLE WORKOUT 2x2 METRIC GRID CARD WITH SPACIOUS DETAILS */}
          <div className="px-5 sm:px-6 pb-8 space-y-4">
            <div className="p-5 sm:p-6 rounded-3xl bg-[#181920] border border-white/5 space-y-5 shadow-inner">
              <div className="grid grid-cols-2 gap-5">
                {/* Metric 1: Account (Gold/Amber highlight in Apple Workout with larger institution logo) */}
                <div className="space-y-1.5">
                  <p className="text-2xs font-bold text-gray-400 uppercase tracking-wider">
                    Account
                  </p>
                  <div className="flex items-center gap-2.5 min-w-0">
                    {institutionLogoUrl ? (
                      <div className="w-7 h-7 rounded-lg overflow-hidden bg-white/10 border border-white/10 flex items-center justify-center shrink-0 shadow-2xs">
                        <img
                          src={institutionLogoUrl}
                          alt={account?.name || 'Account'}
                          className="w-full h-full object-cover"
                        />
                      </div>
                    ) : (
                      <div className="w-7 h-7 rounded-lg bg-amber-500/10 text-amber-400 flex items-center justify-center shrink-0 border border-amber-500/20">
                        <Icon name="wallet" className="text-sm" />
                      </div>
                    )}
                    <div className="min-w-0">
                      <p className="text-sm sm:text-base font-black text-amber-400 truncate leading-tight font-mono">
                        {account?.name || 'Account'}
                      </p>
                      {account?.last4 && (
                        <p className="text-2xs text-gray-500 font-mono mt-0.5">•••• {account.last4}</p>
                      )}
                    </div>
                  </div>
                </div>

                {/* Metric 2: Amount (Vibrant Coral/Pink highlight) */}
                <div className="space-y-1.5 text-right">
                  <p className="text-2xs font-bold text-gray-400 uppercase tracking-wider">
                    Net Flow
                  </p>
                  <p
                    className={`text-sm sm:text-base font-black truncate leading-tight font-mono ${
                      isIncome ? 'text-[#34d399]' : 'text-[#ff375f]'
                    }`}
                  >
                    {isIncome ? '+' : ''}
                    {formatCurrency(primaryTx.amount, primaryTx.currency)}
                  </p>
                  <p className="text-2xs text-gray-500 capitalize">{primaryTx.type}</p>
                </div>

                {/* Metric 3: Category */}
                <div className="space-y-1.5">
                  <p className="text-2xs font-bold text-gray-400 uppercase tracking-wider">
                    Classification
                  </p>
                  <p className="text-sm sm:text-base font-black text-white truncate leading-tight">
                    {primaryTx.category || 'Uncategorized'}
                  </p>
                  <p className="text-2xs text-gray-500">General Category</p>
                </div>

                {/* Metric 4: Route / Execution */}
                <div className="space-y-1.5 text-right">
                  <p className="text-2xs font-bold text-gray-400 uppercase tracking-wider">
                    Execution
                  </p>
                  <p className="text-sm sm:text-base font-black text-sky-400 truncate leading-tight font-mono">
                    {isTransfer ? 'Transfer' : (account?.financialInstitution || 'Direct')}
                  </p>
                  <p className="text-2xs text-gray-500">{primaryTx.date}</p>
                </div>
              </div>

              {/* Transfer Details Card (if Transfer) */}
              {isTransfer && counterpartAccount && (
                <div className="pt-4 border-t border-white/5 space-y-2">
                  <p className="text-2xs font-bold text-gray-400 uppercase tracking-wider">
                    Transfer Bridge
                  </p>
                  <div className="flex items-center justify-between bg-black/30 p-3 rounded-2xl text-xs font-semibold border border-white/5">
                    <span className="text-amber-400 truncate">{account?.name}</span>
                    <Icon name="arrow_forward" className="text-xs text-gray-400 mx-2 shrink-0" />
                    <span className="text-emerald-400 truncate">{counterpartAccount.name}</span>
                  </div>
                </div>
              )}

              {/* Physical Location Card */}
              {(primaryTx.placeName || primaryTx.locationLabel || primaryTx.city || primaryTx.address) && (
                <div className="pt-4 border-t border-white/5 space-y-2">
                  <div className="flex items-center justify-between">
                    <p className="text-2xs font-bold text-gray-400 uppercase tracking-wider">
                      Location
                    </p>
                    <a
                      href={
                        primaryTx.latitude !== undefined && primaryTx.longitude !== undefined
                          ? `https://www.google.com/maps/search/?api=1&query=${primaryTx.latitude},${primaryTx.longitude}`
                          : `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(primaryTx.address || primaryTx.placeName || primaryTx.city || '')}`
                      }
                      target="_blank"
                      rel="noreferrer"
                      className="text-2xs font-bold text-[#a3e635] hover:underline inline-flex items-center gap-0.5"
                    >
                      <span>Google Maps</span>
                      <Icon name="open_in_new" className="text-2xs" />
                    </a>
                  </div>
                  <div className="bg-black/30 p-3 rounded-2xl text-xs text-gray-300 border border-white/5 flex items-center justify-between gap-2.5">
                    <div className="flex items-center gap-2.5 min-w-0">
                      <Icon name="marker_pin" className="text-sm text-[#a3e635] shrink-0" />
                      <span className="leading-snug text-xs font-semibold text-white truncate">
                        {primaryTx.locationLabel || primaryTx.placeName || primaryTx.city || (primaryTx.address ? primaryTx.address.split(',')[0] : 'Storefront')}
                      </span>
                    </div>
                    {primaryTx.city && primaryTx.city !== (primaryTx.locationLabel || primaryTx.placeName) && (
                      <span className="text-2xs font-bold text-[#a3e635] bg-[#a3e635]/10 px-2 py-0.5 rounded-full shrink-0 border border-[#a3e635]/20">
                        {primaryTx.city}
                      </span>
                    )}
                  </div>
                </div>
              )}

              {/* Description / Memo */}
              {primaryTx.description && primaryTx.description !== primaryTx.merchant && (
                <div className="pt-4 border-t border-white/5 space-y-2">
                  <p className="text-2xs font-bold text-gray-400 uppercase tracking-wider">
                    Internal Memo
                  </p>
                  <p className="text-xs text-gray-200 leading-relaxed font-medium bg-black/20 p-3 rounded-2xl border border-white/5">
                    {primaryTx.description}
                  </p>
                </div>
              )}

              {/* Notes */}
              {primaryTx.notes && (
                <div className="pt-4 border-t border-white/5 space-y-2">
                  <p className="text-2xs font-bold text-gray-400 uppercase tracking-wider">
                    Notes & Remarks
                  </p>
                  <div className="bg-black/30 p-3 rounded-2xl text-xs text-gray-300 whitespace-pre-wrap border border-white/5 leading-relaxed">
                    {primaryTx.notes}
                  </div>
                </div>
              )}

              {/* Tags */}
              {txTags.length > 0 && (
                <div className="pt-4 border-t border-white/5 space-y-2">
                  <p className="text-2xs font-bold text-gray-400 uppercase tracking-wider">
                    Tags
                  </p>
                  <div className="flex flex-wrap gap-1.5">
                    {txTags.map(tag => (
                      <span
                        key={tag.id}
                        className="px-2.5 py-1 rounded-xl text-xs font-semibold border border-white/10"
                        style={{ backgroundColor: `${tag.color}25`, color: tag.color }}
                      >
                        #{tag.name}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {/* Loan Breakdown if applicable */}
              {(primaryTx.principalAmount || primaryTx.interestAmount) && (
                <div className="pt-4 border-t border-white/5 space-y-2">
                  <p className="text-2xs font-bold text-gray-400 uppercase tracking-wider">
                    Loan Payment Breakdown
                  </p>
                  <div className="grid grid-cols-2 gap-3 bg-black/30 p-3 rounded-2xl border border-white/5">
                    <div>
                      <span className="text-2xs text-gray-400">Principal</span>
                      <p className="text-xs font-bold font-mono text-emerald-400 mt-0.5">
                        {formatCurrency(primaryTx.principalAmount || 0, primaryTx.currency)}
                      </p>
                    </div>
                    <div>
                      <span className="text-2xs text-gray-400">Interest</span>
                      <p className="text-xs font-bold font-mono text-rose-400 mt-0.5">
                        {formatCurrency(primaryTx.interestAmount || 0, primaryTx.currency)}
                      </p>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );

  return createPortal(modalContent, document.body);
};

export default TransactionDetailModal;
