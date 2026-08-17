import React, { useState, useMemo, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { MapContainer, TileLayer, Marker as LeafletMarker, useMap } from 'react-leaflet';
import L from 'leaflet';
import { MerchantRule, Transaction, Category, MerchantLocation } from '../types';

const MapContainerAny = MapContainer as any;
const TileLayerAny = TileLayer as any;
const MarkerAny = LeafletMarker as any;
import { formatCurrency, parseLocalDate } from '../utils';
import { getMerchantLogoUrl } from '../utils/brandfetch';
import { usePreferencesSelector } from '../contexts/DomainProviders';
import Icon from './ui/Icon';

interface MerchantOverviewModalProps {
  isOpen: boolean;
  onClose: () => void;
  merchantName: string;
  logoKey: string;
  rule?: MerchantRule;
  entityType?: 'Merchant' | 'Institution';
  totalValue: number;
  count: number;
  lastActivity?: string;
  transactions?: Transaction[];
  onEdit?: () => void;
}

// Auto-fit map bounds across all locations or center on a single location
const MultiLocationBoundsFitter: React.FC<{ locations: { lat: number; lon: number }[] }> = ({ locations }) => {
  const map = useMap();
  useEffect(() => {
    if (locations.length === 1) {
      map.setView([locations[0].lat, locations[0].lon], 15, { animate: false });
    } else if (locations.length > 1) {
      const bounds = L.latLngBounds(locations.map(l => [l.lat, l.lon]));
      map.fitBounds(bounds, { padding: [40, 40], maxZoom: 16 });
    }
    map.invalidateSize();
  }, [map, locations]);
  return null;
};

// Create custom Apple Workout fluorescent neon pin marker for branches
const createAppleNeonPinIcon = (logoUrl?: string | null, label?: string) => {
  const html = `
    <div class="relative flex items-center justify-center -translate-x-1/2 -translate-y-1/2 group">
      <!-- Pulsing Aura Ring -->
      <div class="absolute -inset-2 rounded-full bg-[#a3e635]/30 animate-ping opacity-75"></div>
      
      <!-- Glowing Outer Badge -->
      <div class="relative w-11 h-11 rounded-full bg-[#a3e635] shadow-[0_0_22px_rgba(163,230,53,0.9)] border-2 border-black flex items-center justify-center p-1">
        ${
          logoUrl
            ? `<img src="${logoUrl}" class="w-full h-full object-cover rounded-full bg-black/10" onerror="this.style.display='none'" />`
            : `<div class="w-full h-full flex items-center justify-center text-black font-black text-xs">🏢</div>`
        }
      </div>

      <!-- Teardrop Bottom Point -->
      <div class="absolute -bottom-1.5 left-1/2 -translate-x-1/2 w-2.5 h-2.5 bg-[#a3e635] rotate-45 border-r border-b border-black"></div>
    </div>
  `;

  return L.divIcon({
    className: 'custom-apple-neon-pin',
    html,
    iconSize: [44, 44],
    iconAnchor: [22, 44],
  });
};

const MerchantOverviewModal: React.FC<MerchantOverviewModalProps> = ({
  isOpen,
  onClose,
  merchantName,
  logoKey,
  rule,
  entityType = 'Merchant',
  totalValue,
  count,
  lastActivity,
  transactions = [],
  onEdit,
}) => {
  const [isVisible, setIsVisible] = useState(false);
  const brandfetchClientId = usePreferencesSelector(p => (p.brandfetchClientId || '').trim());
  const merchantLogoOverrides = usePreferencesSelector(p => p.merchantLogoOverrides || {});
  const transactionRules = usePreferencesSelector(p => p.transactionRules || []);
  const [logoLoadError, setLogoLoadError] = useState(false);

  const linkedRules = useMemo(() => {
    const norm = merchantName.toLowerCase();
    return (transactionRules || []).filter(r => 
      r.actions?.some(a => a.field === 'merchant' && a.value.toLowerCase() === norm) ||
      r.conditions?.some(c => c.value?.toLowerCase() === norm)
    );
  }, [transactionRules, merchantName]);

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

  // Merchant Logo
  const logoUrl = useMemo(() => {
    if (rule?.logo) return rule.logo;
    return getMerchantLogoUrl(merchantName, brandfetchClientId, merchantLogoOverrides, {
      fallback: 'lettermark',
      type: 'icon',
      width: 96,
      height: 96,
    });
  }, [merchantName, rule?.logo, brandfetchClientId, merchantLogoOverrides]);

  // Extract all valid geographic locations
  const resolvedLocations = useMemo(() => {
    const list: { id: string; label: string; address: string; lat: number; lon: number; isPrimary?: boolean; city?: string }[] = [];
    
    if (rule?.locations && rule.locations.length > 0) {
      rule.locations.forEach(loc => {
        if (loc.latitude !== undefined && loc.longitude !== undefined && !isNaN(loc.latitude) && !isNaN(loc.longitude)) {
          list.push({
            id: loc.id,
            label: loc.label || loc.placeName || 'Branch',
            address: loc.address,
            lat: loc.latitude,
            lon: loc.longitude,
            isPrimary: loc.isPrimary,
            city: loc.city,
          });
        }
      });
    } else if (rule?.latitude !== undefined && rule?.longitude !== undefined && !isNaN(rule.latitude) && !isNaN(rule.longitude)) {
      list.push({
        id: 'primary-loc',
        label: rule.placeName || 'Main Store',
        address: rule.address || '',
        lat: rule.latitude,
        lon: rule.longitude,
        isPrimary: true,
        city: rule.city,
      });
    }

    return list;
  }, [rule]);

  const hasMapLocations = resolvedLocations.length > 0;

  // Merchant Transactions Filtering & Analytics
  const merchantTransactions = useMemo(() => {
    const q = merchantName.toLowerCase().trim();
    return transactions
      .filter(t => (t.merchant && t.merchant.toLowerCase().trim() === q) || (t.description && t.description.toLowerCase().includes(q)))
      .sort((a, b) => parseLocalDate(b.date).getTime() - parseLocalDate(a.date).getTime());
  }, [transactions, merchantName]);

  const avgTicket = useMemo(() => {
    if (count <= 0) return 0;
    return Math.abs(totalValue) / count;
  }, [totalValue, count]);

  // Top accounts breakdown for this merchant
  const topAccountsBreakdown = useMemo(() => {
    const counts: Record<string, { count: number; total: number }> = {};
    merchantTransactions.forEach(t => {
      const accId = t.accountId || 'Unknown';
      if (!counts[accId]) counts[accId] = { count: 0, total: 0 };
      counts[accId].count += 1;
      counts[accId].total += Math.abs(t.amount);
    });

    return Object.entries(counts)
      .map(([accId, data]) => ({ accId, ...data }))
      .sort((a, b) => b.total - a.total)
      .slice(0, 3);
  }, [merchantTransactions]);

  const pinIcon = useMemo(() => {
    return createAppleNeonPinIcon((!logoLoadError && logoUrl) ? logoUrl : null, merchantName);
  }, [logoUrl, logoLoadError, merchantName]);

  if (!isOpen) return null;

  const locationSubtitle = rule?.isOnline
    ? 'Online Service'
    : resolvedLocations.length > 1
    ? `${resolvedLocations.length} Registered Branches`
    : resolvedLocations[0]?.city || rule?.city || rule?.address || 'Physical Storefront';

  const modalContent = (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center p-3 sm:p-4 overflow-y-auto">
      {/* Backdrop */}
      <div
        className={`fixed inset-0 bg-black/60 dark:bg-black/85 backdrop-blur-md transition-opacity duration-300 ${
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
        {/* Top Floating Glass Controls */}
        <div className="absolute top-4 left-4 right-4 z-40 flex items-center justify-between pointer-events-none">
          {/* Location Badge (Apple Workout style) */}
          <div className="pointer-events-auto inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-black/50 backdrop-blur-md border border-white/10 text-white text-xs font-semibold shadow-md">
            <Icon name={rule?.isOnline ? "globe" : "marker_pin"} className="text-[#a3e635] text-xs shrink-0" />
            <span className="truncate max-w-[190px]">{locationSubtitle}</span>
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
        <div className="flex-1 overflow-y-auto custom-scrollbar">
          
          {/* 1. TOP HERO MULTI-LOCATION MAP VIEWPORT */}
          <div className="relative w-full h-[300px] sm:h-[330px] bg-[#12141a] overflow-hidden shrink-0">
            {hasMapLocations ? (
              <div className="absolute inset-0 z-0 isolate overflow-hidden">
                <MapContainerAny
                  key={`apple-merchant-map-${merchantName}-${resolvedLocations.length}`}
                  center={[resolvedLocations[0].lat, resolvedLocations[0].lon]}
                  zoom={14}
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
                  {resolvedLocations.map(loc => (
                    <MarkerAny
                      key={loc.id}
                      position={[loc.lat, loc.lon]}
                      icon={pinIcon}
                    />
                  ))}
                  <MultiLocationBoundsFitter locations={resolvedLocations} />
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
                    <div className="w-16 h-16 rounded-full bg-[#a3e635] border-2 border-black flex items-center justify-center p-1.5 shadow-[0_0_28px_rgba(163,230,53,0.95)]">
                      {logoUrl && !logoLoadError ? (
                        <img
                          src={logoUrl}
                          alt={merchantName}
                          className="w-full h-full object-cover rounded-full"
                          onError={() => setLogoLoadError(true)}
                        />
                      ) : (
                        <span className="text-black font-black text-xl">
                          {merchantName?.charAt(0)?.toUpperCase() || '🏢'}
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
                <span>{entityType === 'Institution' ? 'Financial Institution' : 'Entity Intelligence'}</span>
                <span>•</span>
                <span className="text-gray-300 font-medium">
                  {count} {count === 1 ? 'Event' : 'Observed Events'}
                </span>
              </div>

              {/* Big Bold Apple Title (e.g. Colruyt) */}
              <h2 className="text-2xl sm:text-3xl font-black text-white tracking-tight truncate leading-tight drop-shadow-sm">
                {merchantName}
              </h2>

              {/* Fluorescent Apple Highlight Metric (Cumulative Volume) */}
              <div className="flex items-baseline gap-2 pt-0.5">
                <span
                  className={`text-3xl sm:text-4xl font-black font-mono tracking-tight ${
                    totalValue >= 0
                      ? 'text-[#34d399] drop-shadow-[0_0_15px_rgba(52,211,153,0.5)]'
                      : 'text-[#a3e635] drop-shadow-[0_0_15px_rgba(163,230,53,0.55)]'
                  }`}
                >
                  {formatCurrency(totalValue, 'EUR')}
                </span>

                <span className="text-xs font-bold text-gray-400 uppercase tracking-wider font-mono">
                  EUR Volume
                </span>
              </div>
            </div>
          </div>

          {/* 2. APPLE CONTEXT WEATHER / METADATA PILLS */}
          <div className="px-5 sm:px-6 py-2.5 flex items-center gap-5 text-xs text-gray-300 border-b border-white/5 overflow-x-auto no-scrollbar">
            <div className="flex items-center gap-1.5 shrink-0">
              <Icon name="loyalty" className="text-amber-400 text-sm shrink-0" />
              <div className="flex flex-col">
                <span className="text-2xs uppercase text-gray-500 font-bold tracking-wider">Classification</span>
                <span className="font-bold text-white text-xs">{rule?.category || 'Uncategorized'}</span>
              </div>
            </div>

            <div className="h-6 w-px bg-white/10 shrink-0" />

            <div className="flex items-center gap-1.5 shrink-0">
              <Icon name={rule?.isOnline ? "globe" : "building"} className="text-sky-400 text-sm shrink-0" />
              <div className="flex flex-col">
                <span className="text-2xs uppercase text-gray-500 font-bold tracking-wider">Presence</span>
                <span className="font-bold text-white text-xs">
                  {rule?.isOnline ? 'Online Service' : (resolvedLocations.length > 1 ? `${resolvedLocations.length} Branches` : 'Physical')}
                </span>
              </div>
            </div>

            <div className="h-6 w-px bg-white/10 shrink-0" />

            <div className="flex items-center gap-1.5 shrink-0">
              <Icon name="bar_chart" className="text-emerald-400 text-sm shrink-0" />
              <div className="flex flex-col">
                <span className="text-2xs uppercase text-gray-500 font-bold tracking-wider">Average</span>
                <span className="font-bold text-white text-xs font-mono">
                  {formatCurrency(avgTicket, 'EUR')}
                </span>
              </div>
            </div>
          </div>

          {/* 3. "MERCHANT DETAILS >" INTERACTIVE STRIP (Single "Edit Merchant >" trigger) */}
          <div className="px-5 sm:px-6 py-4 flex items-center justify-between">
            <h3 className="text-base sm:text-lg font-bold text-white tracking-tight flex items-center gap-1.5">
              <span>Merchant Intelligence</span>
            </h3>

            {onEdit && (
              <button
                type="button"
                onClick={() => {
                  handleClose();
                  setTimeout(() => onEdit(), 100);
                }}
                className="inline-flex items-center gap-1 text-xs font-bold text-[#a3e635] hover:text-white transition-colors cursor-pointer group py-1 px-2.5 rounded-xl hover:bg-white/5 active:scale-95"
              >
                <span>Edit Merchant</span>
                <Icon name="chevron_right" className="text-sm transition-transform group-hover:translate-x-0.5" />
              </button>
            )}
          </div>

          {/* 4. APPLE WORKOUT 2x2 METRIC GRID CARD */}
          <div className="px-5 sm:px-6 pb-8 space-y-4">
            <div className="p-5 sm:p-6 rounded-3xl bg-[#181920] border border-white/5 space-y-5 shadow-inner">
              <div className="grid grid-cols-2 gap-5">
                {/* Metric 1: Frequency */}
                <div className="space-y-1.5">
                  <p className="text-2xs font-bold text-gray-400 uppercase tracking-wider">
                    Total Events
                  </p>
                  <p className="text-sm sm:text-base font-black text-amber-400 truncate leading-tight font-mono">
                    {count} Transactions
                  </p>
                  <p className="text-2xs text-gray-500 font-mono">Total Activity</p>
                </div>

                {/* Metric 2: Lifetime Spend */}
                <div className="space-y-1.5 text-right">
                  <p className="text-2xs font-bold text-gray-400 uppercase tracking-wider">
                    Cumulative Volume
                  </p>
                  <p className="text-sm sm:text-base font-black text-[#ff375f] truncate leading-tight font-mono">
                    {formatCurrency(totalValue, 'EUR')}
                  </p>
                  <p className="text-2xs text-gray-500 font-mono">Total Volume</p>
                </div>

                {/* Metric 3: Average Ticket */}
                <div className="space-y-1.5">
                  <p className="text-2xs font-bold text-gray-400 uppercase tracking-wider">
                    Average Ticket
                  </p>
                  <p className="text-sm sm:text-base font-black text-[#38bdf8] truncate leading-tight font-mono">
                    {formatCurrency(avgTicket, 'EUR')}
                  </p>
                  <p className="text-2xs text-gray-500 font-mono">Average Per Transaction</p>
                </div>

                {/* Metric 4: Last Active */}
                <div className="space-y-1.5 text-right">
                  <p className="text-2xs font-bold text-gray-400 uppercase tracking-wider">
                    Last Activity
                  </p>
                  <p className="text-sm sm:text-base font-black text-[#c084fc] truncate leading-tight font-mono">
                    {lastActivity ? parseLocalDate(lastActivity).toLocaleDateString([], { month: 'short', day: 'numeric' }) : 'None'}
                  </p>
                  <p className="text-2xs text-gray-500 font-mono">Most Recent Entry</p>
                </div>
              </div>

              {/* Automation Rules Card */}
              <div className="pt-4 border-t border-white/5 space-y-2.5">
                <p className="text-2xs font-bold text-gray-400 uppercase tracking-wider">
                  Classification Directive
                </p>
                <div className="bg-black/30 p-3 rounded-2xl border border-white/5 space-y-2">
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-gray-400">Assigned Category:</span>
                    <span className="font-bold text-[#a3e635]">
                      {rule?.category || 'Unclassified'}
                    </span>
                  </div>
                  {rule?.defaultDescription && (
                    <div className="flex items-center justify-between text-xs pt-1 border-t border-white/5">
                      <span className="text-gray-400">Default Memo:</span>
                      <span className="font-medium text-white truncate max-w-[180px]">
                        {rule.defaultDescription}
                      </span>
                    </div>
                  )}

                  {/* Matching Keyword Triggers */}
                  <div className="pt-2 border-t border-white/5 space-y-1.5">
                    <div className="flex items-center justify-between text-2xs text-gray-400 uppercase font-bold tracking-wider">
                      <span>Keyword Triggers</span>
                      {onEdit && (
                        <button
                          type="button"
                          onClick={() => {
                            handleClose();
                            setTimeout(() => onEdit(), 100);
                          }}
                          className="text-[#a3e635] hover:underline cursor-pointer lowercase font-medium"
                        >
                          + manage triggers
                        </button>
                      )}
                    </div>
                    {linkedRules.length > 0 ? (
                      <div className="flex flex-wrap gap-1.5 pt-0.5">
                        {linkedRules.map(r => {
                          const kw = r.conditions.find(c => c.field === 'description' || c.field === 'merchant')?.value;
                          if (!kw) return null;
                          return (
                            <span key={r.id} className="text-2xs font-mono font-bold px-2 py-0.5 rounded-lg bg-teal-500/15 text-teal-300 border border-teal-500/25">
                              "{kw}"
                            </span>
                          );
                        })}
                      </div>
                    ) : (
                      <p className="text-2xs text-gray-500 italic">No automated keyword triggers yet</p>
                    )}
                  </div>
                </div>
              </div>

              {/* Registered Locations / Branches */}
              {resolvedLocations.length > 0 && (
                <div className="pt-4 border-t border-white/5 space-y-2.5">
                  <div className="flex items-center justify-between">
                    <p className="text-2xs font-bold text-gray-400 uppercase tracking-wider">
                      Branches & Locations ({resolvedLocations.length})
                    </p>
                  </div>
                  <div className="space-y-2">
                    {resolvedLocations.map(loc => (
                      <div
                        key={loc.id}
                        className="bg-black/30 p-3 rounded-2xl border border-white/5 flex items-center justify-between gap-2.5"
                      >
                        <div className="flex items-center gap-2.5 min-w-0 flex-1">
                          <Icon name="marker_pin" className="text-sm text-[#a3e635] shrink-0" />
                          <div className="flex items-center gap-2 flex-wrap min-w-0">
                            <p className="text-xs font-bold text-white leading-tight truncate">
                              {loc.label || loc.city || 'Branch'}
                            </p>
                            {loc.isPrimary && (
                              <span className="text-2xs font-bold px-1.5 py-0.2 rounded-full bg-[#a3e635]/20 text-[#a3e635] border border-[#a3e635]/30">
                                Primary
                              </span>
                            )}
                            {loc.city && loc.city !== loc.label && (
                              <span className="text-2xs font-medium text-gray-400">
                                • {loc.city}
                              </span>
                            )}
                          </div>
                        </div>

                        <a
                          href={`https://www.google.com/maps/search/?api=1&query=${loc.lat},${loc.lon}`}
                          target="_blank"
                          rel="noreferrer"
                          className="text-2xs font-bold text-[#a3e635] hover:underline inline-flex items-center gap-0.5 shrink-0 pt-0.5"
                        >
                          <span>Google Maps</span>
                          <Icon name="open_in_new" className="text-2xs" />
                        </a>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Recent Activity Ledger */}
              {merchantTransactions.length > 0 && (
                <div className="pt-4 border-t border-white/5 space-y-2.5">
                  <div className="flex items-center justify-between">
                    <p className="text-2xs font-bold text-gray-400 uppercase tracking-wider">
                      Recent Activity ({merchantTransactions.length})
                    </p>
                  </div>
                  <div className="space-y-1.5 bg-black/30 p-3 rounded-2xl border border-white/5">
                    {merchantTransactions.slice(0, 4).map(tx => (
                      <div key={tx.id} className="flex items-center justify-between py-1.5 border-b border-white/5 last:border-0 text-xs">
                        <div className="min-w-0 flex-1 pr-2">
                          <p className="font-semibold text-white truncate leading-tight">
                            {tx.description || tx.merchant}
                          </p>
                          <p className="text-2xs text-gray-400 font-mono mt-0.5">{tx.date}</p>
                        </div>
                        <span className={`font-mono font-bold shrink-0 ${tx.type === 'income' ? 'text-[#34d399]' : 'text-gray-200'}`}>
                          {tx.type === 'income' ? '+' : ''}
                          {formatCurrency(tx.amount, tx.currency)}
                        </span>
                      </div>
                    ))}
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

export default MerchantOverviewModal;
