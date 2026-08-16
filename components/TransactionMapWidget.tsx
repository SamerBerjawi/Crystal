import React, { useMemo, useEffect, useState, useRef } from 'react';
import { MapContainer, TileLayer, CircleMarker, Tooltip, useMap } from 'react-leaflet';
import { DottedMap, type Marker } from '@/components/ui/dotted-map';
import { Globe } from '@/components/ui/globe';
import { countries, type TCountryCode } from 'countries-list';
import { Transaction, Currency } from '../types';
import { formatCurrency } from '../utils';
import L from 'leaflet';
import Icon from './ui/Icon';

type CountryCode = Lowercase<TCountryCode>;

export type MyMarker = Marker & {
  id: string;
  overlay: {
    countryCode: CountryCode;
    label: string;
    city: string;
    country: string;
    flagEmoji: string;
    count: number;
    amountTotal: number;
    currency: string;
    latestDescription?: string;
  };
};

// Convert 2-letter ISO country code to flag emoji
function getFlagEmoji(countryCode: string): string {
  if (!countryCode || countryCode.length !== 2) return '🌐';
  const uppercase = countryCode.toUpperCase();
  try {
    return String.fromCodePoint(127397 + uppercase.charCodeAt(0)) + String.fromCodePoint(127397 + uppercase.charCodeAt(1));
  } catch {
    return '🌐';
  }
}

// Map country names or codes to ISO 2-letter lowercase country codes
const countryNameToCodeMap: Record<string, CountryCode> = {};
Object.entries(countries).forEach(([code, data]) => {
  const lowerCode = code.toLowerCase() as CountryCode;
  countryNameToCodeMap[lowerCode] = lowerCode;
  countryNameToCodeMap[data.name.toLowerCase()] = lowerCode;
});

// Common country aliases
countryNameToCodeMap['usa'] = 'us';
countryNameToCodeMap['united states'] = 'us';
countryNameToCodeMap['united states of america'] = 'us';
countryNameToCodeMap['uk'] = 'gb';
countryNameToCodeMap['united kingdom'] = 'gb';
countryNameToCodeMap['great britain'] = 'gb';
countryNameToCodeMap['uae'] = 'ae';
countryNameToCodeMap['united arab emirates'] = 'ae';
countryNameToCodeMap['south korea'] = 'kr';
countryNameToCodeMap['korea'] = 'kr';
countryNameToCodeMap['republic of korea'] = 'kr';

function getCountryMeta(countryInput?: string): { countryCode: CountryCode; flagEmoji: string; countryName: string } {
  if (!countryInput) {
    return { countryCode: 'us', flagEmoji: '🌐', countryName: 'Unknown' };
  }
  const normalized = countryInput.trim().toLowerCase();
  const code = countryNameToCodeMap[normalized];
  if (code && countries[code.toUpperCase() as TCountryCode]) {
    const data = countries[code.toUpperCase() as TCountryCode];
    return {
      countryCode: code,
      flagEmoji: getFlagEmoji(code),
      countryName: data.name,
    };
  }

  if (normalized.length === 2) {
    const uppercaseCode = normalized.toUpperCase() as TCountryCode;
    const countryData = countries[uppercaseCode];
    return {
      countryCode: normalized as CountryCode,
      flagEmoji: getFlagEmoji(normalized),
      countryName: countryData ? countryData.name : countryInput,
    };
  }

  return { countryCode: 'us', flagEmoji: '🌐', countryName: countryInput };
}

interface TransactionMapWidgetProps {
  transactions: Transaction[];
}

// Component to auto-fit Leaflet map bounds around transaction coordinates
const BoundsFitter: React.FC<{ coords: [number, number][]; center: [number, number] }> = ({ coords, center }) => {
  const map = useMap();
  useEffect(() => {
    if (coords.length > 0) {
      if (coords.length === 1) {
        map.setView(coords[0], 12);
      } else {
        const bounds = L.latLngBounds(coords);
        map.fitBounds(bounds, { padding: [50, 50], maxZoom: 13 });
      }
      setTimeout(() => map.invalidateSize(), 100);
    } else {
      map.setView(center, 4);
    }
  }, [coords, center, map]);
  return null;
};

// Component to dynamically sync zoom controls with Leaflet interactive map
const LeafletZoomController: React.FC<{ zoomLevel: number }> = ({ zoomLevel }) => {
  const map = useMap();
  const isFirstRun = React.useRef(true);
  useEffect(() => {
    if (isFirstRun.current) {
      isFirstRun.current = false;
      return;
    }
    const currentCenter = map.getCenter();
    const targetZoom = Math.max(1, Math.min(18, Math.round(zoomLevel)));
    map.setZoomAround(currentCenter, targetZoom);
  }, [zoomLevel, map]);
  return null;
};

const MapContainerAny = MapContainer as any;
const TileLayerAny = TileLayer as any;
const CircleMarkerAny = CircleMarker as any;
const TooltipAny = Tooltip as any;

const TransactionMapWidget: React.FC<TransactionMapWidgetProps> = ({ transactions }) => {
  const [isDarkMode, setIsDarkMode] = useState(false);
  const [mapMode, setMapMode] = useState<'dotted' | 'globe' | 'tile'>('dotted');
  const [selectedLocationId, setSelectedLocationId] = useState<string | null>(null);
  const [hoveredLocationId, setHoveredLocationId] = useState<string | null>(null);

  useEffect(() => {
    const checkDarkMode = () => document.documentElement.classList.contains('dark');
    setIsDarkMode(checkDarkMode());

    const observer = new MutationObserver(checkDarkMode);
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] });
    return () => observer.disconnect();
  }, []);

  // Consolidate transactions by unique city & coordinates
  const locations = useMemo(() => {
    type GroupedLocation = {
      key: string;
      lat: number;
      lon: number;
      count: number;
      amountTotal: number;
      transactions: Transaction[];
    };

    const grouped = transactions
      .filter(tx => tx.latitude !== undefined && tx.latitude !== null && tx.longitude !== undefined && tx.longitude !== null)
      .reduce((map: Map<string, GroupedLocation>, tx) => {
        const key = tx.city && tx.country
          ? `${tx.city.trim().toLowerCase()}|${tx.country.trim().toLowerCase()}`
          : `${Number(tx.latitude!.toFixed(2))},${Number(tx.longitude!.toFixed(2))}`;

        const current = map.get(key);
        if (current) {
          current.count += 1;
          current.amountTotal += tx.amount;
          current.transactions.push(tx);
        } else {
          map.set(key, {
            key,
            lat: Number(tx.latitude!.toFixed(4)),
            lon: Number(tx.longitude!.toFixed(4)),
            count: 1,
            amountTotal: tx.amount,
            transactions: [tx],
          });
        }
        return map;
      }, new Map<string, GroupedLocation>());

    return Array.from(grouped.values())
      .map((group: GroupedLocation) => {
        const representative = group.transactions[0];
        const meta = getCountryMeta(representative.country);
        const cityName = representative.city || 'Unknown City';
        const label = representative.locationLabel || representative.placeName || cityName;
        const countryName = meta.countryName || representative.country || '';

        // Equirectangular projection for percentage positioning
        const projectedX = ((group.lon + 180) / 360) * 100;
        const projectedY = ((90 - group.lat) / 180) * 100;

        return {
          id: group.key,
          lat: group.lat,
          lon: group.lon,
          projectedX,
          projectedY,
          count: group.count,
          amountTotal: group.amountTotal,
          currency: representative.currency,
          description: representative.description,
          date: representative.date,
          label,
          address: representative.address,
          city: cityName,
          country: countryName,
          flagEmoji: meta.flagEmoji,
          transactions: group.transactions,
        };
      })
      .sort((a, b) => b.count - a.count);
  }, [transactions]);

  const maxCount = useMemo(() => {
    return locations.reduce((max, loc) => Math.max(max, loc.count), 0) || 1;
  }, [locations]);

  // Center coordinate calculation
  const { focalCenter, globeFocusAngles } = useMemo(() => {
    if (locations.length === 0) {
      return {
        focalCenter: [20, 0] as [number, number],
        globeFocusAngles: [0, 0] as [number, number],
      };
    }

    const centerLat = locations[0].lat;
    const centerLon = locations[0].lon;

    const phi = Math.PI - ((centerLon * Math.PI) / 180 - Math.PI / 2);
    const theta = Math.sin((centerLat * Math.PI) / 180) * 0.22;

    return {
      focalCenter: [centerLat, centerLon] as [number, number],
      globeFocusAngles: [phi, theta] as [number, number],
    };
  }, [locations]);

  // Zoom levels
  const [dottedZoom, setDottedZoom] = useState<number>(1);
  const [tileZoom, setTileZoom] = useState<number>(3);

  const handleZoomIn = () => {
    if (mapMode === 'tile') setTileZoom(prev => Math.min(prev + 1, 18));
    else setDottedZoom(prev => Math.min(Number((prev + 0.25).toFixed(2)), 2.5));
  };

  const handleZoomOut = () => {
    if (mapMode === 'tile') setTileZoom(prev => Math.max(prev - 1, 1));
    else setDottedZoom(prev => Math.max(Number((prev - 0.25).toFixed(2)), 0.8));
  };

  const handleResetZoom = () => {
    setDottedZoom(1);
    setTileZoom(3);
    setSelectedLocationId(null);
  };

  // Construct DottedMap markers with refined, proportional sizing
  const dottedMarkers: MyMarker[] = useMemo(() => {
    return locations.map(loc => {
      const sizeRatio = Math.min(loc.count / maxCount, 1);
      const size = Number((0.65 + sizeRatio * 0.45).toFixed(2));

      return {
        id: loc.id,
        lat: loc.lat,
        lng: loc.lon,
        size,
        pulse: true,
        overlay: {
          countryCode: 'us',
          label: loc.city,
          city: loc.city,
          country: loc.country,
          flagEmoji: loc.flagEmoji,
          count: loc.count,
          amountTotal: Math.abs(loc.amountTotal),
          currency: loc.currency,
          latestDescription: loc.description,
        },
      };
    });
  }, [locations, maxCount]);

  // High-contrast COBE Configuration for 3D Globe
  const globeConfig = useMemo(() => {
    return {
      width: 800,
      height: 800,
      onRender: () => {},
      devicePixelRatio: 2,
      phi: globeFocusAngles[0],
      theta: globeFocusAngles[1],
      dark: isDarkMode ? 1 : 0,
      diffuse: isDarkMode ? 1.4 : 1.2,
      mapSamples: 16000,
      mapBrightness: isDarkMode ? 2.4 : 1.8,
      baseColor: (isDarkMode ? [0.18, 0.24, 0.36] : [0.84, 0.88, 0.94]) as [number, number, number],
      markerColor: (isDarkMode ? [0.35, 0.75, 1.0] : [0.12, 0.45, 0.95]) as [number, number, number],
      glowColor: (isDarkMode ? [0.12, 0.24, 0.5] : [0.92, 0.95, 1.0]) as [number, number, number],
      markers: locations.map(loc => ({
        location: [loc.lat, loc.lon] as [number, number],
        size: Number((0.04 + Math.min(loc.count / maxCount, 1) * 0.05).toFixed(3)),
      })),
    };
  }, [isDarkMode, locations, maxCount, globeFocusAngles]);

  const coords: [number, number][] = useMemo(() => locations.map(l => [l.lat, l.lon]), [locations]);

  // CartoDB Tile Layer URL based on theme
  const tileLayerUrl = isDarkMode
    ? 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png'
    : 'https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png';

  const attribution = '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>';

  if (locations.length === 0) {
    return (
      <div className="h-full flex flex-col items-center justify-center text-light-text-secondary dark:text-dark-text-secondary min-h-[320px] p-6 text-center">
        <div className="size-12 rounded-2xl bg-black/5 dark:bg-white/5 flex items-center justify-center mb-3">
          <Icon name="public_off" className="text-2xl opacity-50" />
        </div>
        <p className="text-sm font-semibold text-primary">No Geotagged Transactions</p>
        <p className="text-xs text-tertiary mt-1 max-w-xs">Add a geographic location to transactions to view spending hotspots across the world.</p>
      </div>
    );
  }

  const activeHoveredLocation = locations.find(l => l.id === (hoveredLocationId || selectedLocationId));
  const totalTransactionsCount = locations.reduce((sum, l) => sum + l.count, 0);

  return (
    <div className="h-full w-full overflow-hidden relative z-0 rounded-2xl border border-black/5 dark:border-white/10 group min-h-[360px] bg-slate-50/50 dark:bg-gray-950/40 flex flex-col justify-between">

      {/* Top Header Controls Bar */}
      <div className="absolute top-3 left-3 right-3 z-[1000] flex items-center justify-between pointer-events-none">
        {/* Active Locations Summary Badge */}
        <div className="pointer-events-auto flex items-center gap-2 px-3 py-1.5 rounded-xl bg-white/85 dark:bg-black/70 backdrop-blur-md border border-black/5 dark:border-white/10 shadow-xs">
          <span className="flex h-2 w-2 relative">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
            <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
          </span>
          <span className="text-xs font-semibold text-primary">
            {locations.length} {locations.length === 1 ? 'City' : 'Cities'}
          </span>
          <span className="text-xs text-tertiary">•</span>
          <span className="text-xs text-secondary font-medium">
            {totalTransactionsCount} {totalTransactionsCount === 1 ? 'transaction' : 'transactions'}
          </span>
        </div>

        {/* Map View Switcher */}
        <div className="pointer-events-auto flex items-center p-1 rounded-xl bg-white/85 dark:bg-black/70 backdrop-blur-md border border-black/5 dark:border-white/10 shadow-xs gap-0.5">
          <button
            type="button"
            onClick={() => setMapMode('dotted')}
            title="Dotted Matrix Map"
            aria-label="Dotted Matrix Map"
            className={`w-7 h-7 flex items-center justify-center rounded-lg transition-all cursor-pointer ${
              mapMode === 'dotted'
                ? 'bg-primary-500 text-white shadow-xs'
                : 'text-tertiary hover:text-primary hover:bg-black/5 dark:hover:bg-white/10'
            }`}
          >
            <Icon name="grid_view" className="text-base" />
          </button>
          <button
            type="button"
            onClick={() => setMapMode('globe')}
            title="3D Globe"
            aria-label="3D Globe"
            className={`w-7 h-7 flex items-center justify-center rounded-lg transition-all cursor-pointer ${
              mapMode === 'globe'
                ? 'bg-primary-500 text-white shadow-xs'
                : 'text-tertiary hover:text-primary hover:bg-black/5 dark:hover:bg-white/10'
            }`}
          >
            <Icon name="public" className="text-base" />
          </button>
          <button
            type="button"
            onClick={() => setMapMode('tile')}
            title="Street Map"
            aria-label="Street Map"
            className={`w-7 h-7 flex items-center justify-center rounded-lg transition-all cursor-pointer ${
              mapMode === 'tile'
                ? 'bg-primary-500 text-white shadow-xs'
                : 'text-tertiary hover:text-primary hover:bg-black/5 dark:hover:bg-white/10'
            }`}
          >
            <Icon name="map" className="text-base" />
          </button>
        </div>
      </div>

      {/* Main Map Canvas / Visual Area */}
      <div className="relative flex-1 w-full h-full min-h-[260px] overflow-hidden flex items-center justify-center">
        {mapMode === 'dotted' ? (
          <div className="relative w-full h-full flex items-center justify-center p-3">
            <div
              style={{
                transform: `scale(${dottedZoom})`,
                transformOrigin: 'center center',
                transition: 'transform 0.25s cubic-bezier(0.2, 0, 0.2, 1)',
              }}
              className="w-full h-full max-h-[460px] flex items-center justify-center relative"
            >
              <DottedMap<MyMarker>
                viewBox="0 0 150 75"
                markers={dottedMarkers}
                dotColor={isDarkMode ? 'rgba(255, 255, 255, 0.18)' : 'rgba(0, 0, 0, 0.16)'}
                markerColor="#3b82f6"
                dotRadius={0.22}
                pulse={true}
                className="w-full h-full"
              />

              {/* Clean HTML overlay chips positioned over markers */}
              {locations.map(loc => {
                const isSelected = selectedLocationId === loc.id;
                const isHovered = hoveredLocationId === loc.id;

                return (
                  <div
                    key={loc.id}
                    style={{
                      left: `${loc.projectedX}%`,
                      top: `${loc.projectedY}%`,
                      transform: 'translate(-50%, -100%) translateY(-6px)',
                    }}
                    onMouseEnter={() => setHoveredLocationId(loc.id)}
                    onMouseLeave={() => setHoveredLocationId(null)}
                    onClick={() => setSelectedLocationId(prev => prev === loc.id ? null : loc.id)}
                    className="absolute z-20 cursor-pointer pointer-events-auto"
                  >
                    <div
                      className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-bold shadow-md transition-all select-none whitespace-nowrap ${
                        isSelected || isHovered
                          ? 'bg-primary-500 text-white scale-110 ring-2 ring-primary-400/50 shadow-primary-500/30'
                          : 'bg-white/90 dark:bg-gray-900/90 text-primary border border-black/10 dark:border-white/15 hover:scale-105'
                      }`}
                    >
                      <span className="text-xs leading-none">{loc.flagEmoji}</span>
                      <span>{loc.city}</span>
                      <span className={`text-[9px] font-mono px-1 py-0.2 rounded-full ${
                        isSelected || isHovered ? 'bg-white/20 text-white' : 'bg-black/5 dark:bg-white/10 text-secondary'
                      }`}>
                        {loc.count}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        ) : mapMode === 'globe' ? (
          <div className="relative w-full h-full flex items-center justify-center p-2">
            <div className="w-full h-full max-w-[360px] max-h-[360px] aspect-square flex items-center justify-center">
              <Globe config={globeConfig} className="w-full h-full" />
            </div>
          </div>
        ) : (
          <MapContainerAny
            center={focalCenter}
            zoom={tileZoom}
            style={{ height: '100%', width: '100%' }}
            className="z-0 bg-light-bg dark:bg-dark-bg"
            zoomControl={false}
          >
            <TileLayerAny
              attribution={attribution}
              url={tileLayerUrl}
            />
            <BoundsFitter coords={coords} center={focalCenter} />
            <LeafletZoomController zoomLevel={tileZoom} />
            {locations.map(loc => {
              const radius = Math.min(Math.max(6 + Math.log1p(loc.count) * 2.5, 7), 16);
              const locationLabel = [loc.city, loc.country].filter(Boolean).join(', ') || 'Unknown location';

              return (
                <CircleMarkerAny
                  key={loc.id}
                  center={[loc.lat, loc.lon]}
                  radius={radius}
                  pathOptions={{
                    color: '#3b82f6',
                    weight: 2,
                    fillColor: '#60a5fa',
                    fillOpacity: 0.85,
                  }}
                >
                  <TooltipAny direction="top" offset={[0, -8]} opacity={1} className="custom-map-tooltip">
                    <div className="p-1 space-y-0.5 min-w-[120px] text-center">
                      <p className="font-bold text-xs flex items-center justify-center gap-1">
                        <span>{loc.flagEmoji}</span>
                        <span>{locationLabel}</span>
                      </p>
                      <p className="text-[11px] text-tertiary">{loc.count} transactions</p>
                      <p className="font-mono font-semibold text-xs text-green-600 dark:text-green-400">
                        {formatCurrency(Math.abs(loc.amountTotal), loc.currency as Currency)}
                      </p>
                    </div>
                  </TooltipAny>
                </CircleMarkerAny>
              );
            })}
          </MapContainerAny>
        )}
      </div>

      {/* Floating Detail Card for Active / Hovered City */}
      {activeHoveredLocation && (
        <div className="absolute top-14 left-3 z-[1000] bg-white/95 dark:bg-gray-900/95 backdrop-blur-md p-3 rounded-xl shadow-xl border border-black/10 dark:border-white/10 flex flex-col gap-1 min-w-[190px] animate-fade-in-up">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-1.5 min-w-0">
              <span className="text-lg leading-none">{activeHoveredLocation.flagEmoji}</span>
              <div className="min-w-0">
                <h4 className="font-bold text-xs leading-tight text-primary truncate">
                  {activeHoveredLocation.label || activeHoveredLocation.city}
                </h4>
                <p className="text-[10px] text-tertiary truncate">
                  {activeHoveredLocation.address || [activeHoveredLocation.city, activeHoveredLocation.country].filter(Boolean).join(', ')}
                </p>
              </div>
            </div>
            {selectedLocationId === activeHoveredLocation.id && (
              <button
                type="button"
                onClick={() => setSelectedLocationId(null)}
                className="text-tertiary hover:text-primary p-0.5 rounded-full cursor-pointer"
                title="Close"
              >
                <Icon name="close" className="text-xs" />
              </button>
            )}
          </div>
          <div className="border-t border-black/5 dark:border-white/5 my-0.5 pt-1 flex justify-between items-center text-[11px]">
            <span className="text-tertiary">Transactions</span>
            <span className="font-bold font-mono text-primary">{activeHoveredLocation.count}</span>
          </div>
          <div className="flex justify-between items-center text-[11px]">
            <span className="text-tertiary">Total Spend</span>
            <span className="font-bold font-mono text-green-600 dark:text-green-400">
              {formatCurrency(Math.abs(activeHoveredLocation.amountTotal), activeHoveredLocation.currency as Currency)}
            </span>
          </div>
        </div>
      )}

      {/* Bottom Locations Carousel / Chips Bar */}
      <div className="relative z-10 px-3 pb-3 pt-1 flex items-center gap-1.5 overflow-x-auto custom-scrollbar no-scrollbar">
        {locations.map(loc => {
          const isSelected = selectedLocationId === loc.id;
          const isHovered = hoveredLocationId === loc.id;

          return (
            <button
              key={loc.id}
              type="button"
              onMouseEnter={() => setHoveredLocationId(loc.id)}
              onMouseLeave={() => setHoveredLocationId(null)}
              onClick={() => setSelectedLocationId(prev => prev === loc.id ? null : loc.id)}
              className={`shrink-0 inline-flex items-center gap-1.5 px-2.5 py-1 rounded-xl text-xs font-semibold transition-all cursor-pointer border shadow-2xs ${
                isSelected || isHovered
                  ? 'bg-primary-500 text-white border-primary-400/40 shadow-xs'
                  : 'bg-white/80 dark:bg-black/60 text-primary border-black/5 dark:border-white/10 hover:bg-black/5 dark:hover:bg-white/10'
              }`}
              title={loc.address || `${loc.city}, ${loc.country}`}
            >
              <span>{loc.flagEmoji}</span>
              <span className="max-w-[130px] truncate">{loc.label || loc.city}</span>
              <span className={`text-[10px] font-mono font-medium ${
                isSelected || isHovered ? 'text-white/90' : 'text-tertiary'
              }`}>
                {formatCurrency(Math.abs(loc.amountTotal), loc.currency as Currency, { compact: true })}
              </span>
            </button>
          );
        })}
      </div>

      {/* Bottom-Right Zoom Controls */}
      <div className="absolute bottom-3 right-3 z-[1000] flex items-center gap-0.5 p-1 rounded-xl bg-white/85 dark:bg-black/70 backdrop-blur-md border border-black/5 dark:border-white/10 shadow-xs">
        <button
          type="button"
          onClick={handleZoomIn}
          className="w-6 h-6 flex items-center justify-center rounded-lg hover:bg-black/5 dark:hover:bg-white/10 text-primary transition-colors cursor-pointer"
          title="Zoom In"
        >
          <Icon name="add" className="text-sm" />
        </button>
        <button
          type="button"
          onClick={handleZoomOut}
          className="w-6 h-6 flex items-center justify-center rounded-lg hover:bg-black/5 dark:hover:bg-white/10 text-primary transition-colors cursor-pointer"
          title="Zoom Out"
        >
          <Icon name="remove" className="text-sm" />
        </button>
        <div className="w-[1px] h-3.5 bg-black/10 dark:bg-white/10 mx-0.5" />
        <button
          type="button"
          onClick={handleResetZoom}
          className="px-1.5 h-6 flex items-center justify-center rounded-lg hover:bg-black/5 dark:hover:bg-white/10 text-[10px] font-mono text-tertiary hover:text-primary transition-colors cursor-pointer"
          title="Reset Zoom"
        >
          {mapMode === 'tile' ? `${Math.round((tileZoom / 3) * 100)}%` : `${Math.round(dottedZoom * 100)}%`}
        </button>
      </div>
    </div>
  );
};

export default TransactionMapWidget;
