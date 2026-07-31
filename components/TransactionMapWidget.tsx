import React, { useMemo, useEffect, useState } from 'react';
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
  return String.fromCodePoint(127397 + uppercase.charCodeAt(0)) + String.fromCodePoint(127397 + uppercase.charCodeAt(1));
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

  // If 2-letter ISO code
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

// Component to auto-fit Leaflet map bounds
const BoundsFitter: React.FC<{ coords: [number, number][] }> = ({ coords }) => {
  const map = useMap();
  useEffect(() => {
    if (coords.length > 0) {
      const bounds = L.latLngBounds(coords);
      map.fitBounds(bounds, { padding: [30, 30], maxZoom: 13 });
      map.invalidateSize();
    }
  }, [coords, map]);
  return null;
};

const MapContainerAny = MapContainer as any;
const TileLayerAny = TileLayer as any;
const CircleMarkerAny = CircleMarker as any;
const TooltipAny = Tooltip as any;

const TransactionMapWidget: React.FC<TransactionMapWidgetProps> = ({ transactions }) => {
  const [isDarkMode, setIsDarkMode] = useState(false);
  const [mapMode, setMapMode] = useState<'dotted' | 'globe' | 'tile'>('dotted');
  const [hoveredMarkerId, setHoveredMarkerId] = useState<string | null>(null);
  const [zoomLevel, setZoomLevel] = useState(1);

  useEffect(() => {
    const checkDarkMode = () => document.documentElement.classList.contains('dark');
    setIsDarkMode(checkDarkMode());

    const observer = new MutationObserver(checkDarkMode);
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] });
    return () => observer.disconnect();
  }, []);

  const handleZoomIn = () => setZoomLevel(prev => Math.min(Number((prev + 0.25).toFixed(2)), 3.0));
  const handleZoomOut = () => setZoomLevel(prev => Math.max(Number((prev - 0.25).toFixed(2)), 0.7));
  const handleZoomReset = () => setZoomLevel(1);

  const handleWheelZoom = (e: React.WheelEvent) => {
    e.preventDefault();
    const delta = e.deltaY < 0 ? 0.1 : -0.1;
    setZoomLevel(prev => Math.min(Math.max(Number((prev + delta).toFixed(2)), 0.7), 3.0));
  };

  const locations = useMemo(() => {
    type GroupedLocation = {
      lat: number;
      lon: number;
      count: number;
      amountTotal: number;
      transactions: Transaction[];
    };
    const grouped = transactions
      .filter(tx => tx.latitude !== undefined && tx.latitude !== null && tx.longitude !== undefined && tx.longitude !== null)
      .reduce((map: Map<string, GroupedLocation>, tx) => {
        const key = `${tx.latitude},${tx.longitude}`;
        const current = map.get(key);

        if (current) {
          current.count += 1;
          current.amountTotal += tx.amount;
          current.transactions.push(tx);
        } else {
          map.set(key, {
            lat: tx.latitude!,
            lon: tx.longitude!,
            count: 1,
            amountTotal: tx.amount,
            transactions: [tx],
          });
        }

        return map;
      }, new Map<string, GroupedLocation>());

    return Array.from(grouped.values()).map((group: GroupedLocation) => {
      const representative = group.transactions[0];

      return {
        id: `${group.lat}-${group.lon}`,
        lat: group.lat,
        lon: group.lon,
        count: group.count,
        amountTotal: group.amountTotal,
        currency: representative.currency,
        description: representative.description,
        date: representative.date,
        city: representative.city,
        country: representative.country,
        transactions: group.transactions,
      };
    });
  }, [transactions]);

  const maxCount = useMemo(() => {
    return locations.reduce((max, loc) => Math.max(max, loc.count), 0) || 1;
  }, [locations]);

  // Construct MyMarker array for MagicUI DottedMap (smaller size scale)
  const dottedMarkers: MyMarker[] = useMemo(() => {
    return locations.map(loc => {
      const cityName = loc.city || 'Unknown City';
      const countryName = loc.country || 'Unknown Country';
      const meta = getCountryMeta(loc.country);

      // Calculate marker size proportional to transaction volume
      const sizeRatio = Math.min(loc.count / maxCount, 1);
      const size = Number((0.6 + sizeRatio * 0.6).toFixed(2));

      return {
        id: loc.id,
        lat: loc.lat,
        lng: loc.lon,
        size,
        pulse: true,
        overlay: {
          countryCode: meta.countryCode,
          label: cityName,
          city: cityName,
          country: countryName,
          flagEmoji: meta.flagEmoji,
          count: loc.count,
          amountTotal: Math.abs(loc.amountTotal),
          currency: loc.currency,
          latestDescription: loc.description,
        },
      };
    });
  }, [locations, maxCount]);

function locationToAngles(lat: number, lng: number): [number, number] {
  return [
    Math.PI - ((lng * Math.PI) / 180 - Math.PI / 2),
    0,
  ];
}

  // Calculate starting focus angles for 3D Globe based on the most recent transaction location (equator centered)
  const initialGlobeAngles = useMemo(() => {
    if (locations.length > 0) {
      return locationToAngles(locations[0].lat, locations[0].lon);
    }
    return [0, 0] as [number, number];
  }, [locations]);

  // Simple COBE Configuration for MagicUI Globe
  const globeConfig = useMemo(() => {
    return {
      width: 800,
      height: 800,
      onRender: () => {},
      devicePixelRatio: 2,
      phi: initialGlobeAngles[0],
      theta: initialGlobeAngles[1],
      dark: isDarkMode ? 1 : 0,
      diffuse: 1.2,
      mapSamples: 16000,
      mapBrightness: 1.2,
      baseColor: (isDarkMode ? [0.15, 0.2, 0.28] : [0.92, 0.94, 0.98]) as [number, number, number],
      markerColor: [59 / 255, 130 / 255, 246 / 255] as [number, number, number],
      glowColor: (isDarkMode ? [0.1, 0.15, 0.3] : [0.9, 0.93, 1]) as [number, number, number],
      markers: locations.map(loc => ({
        location: [loc.lat, loc.lon] as [number, number],
        size: Number((0.03 + Math.min(loc.count / maxCount, 1) * 0.05).toFixed(3)),
      })),
    };
  }, [isDarkMode, locations, maxCount, initialGlobeAngles]);

  const coords: [number, number][] = useMemo(() => locations.map(l => [l.lat, l.lon]), [locations]);

  const maxDensity = useMemo(() => {
    return locations.reduce((max, loc) => Math.max(max, loc.count), 0) || 1;
  }, [locations]);

  const getDensityColor = (count: number) => {
    const ratio = Math.min(count / maxDensity, 1);
    const hue = 210 + ratio * 60;
    return `hsl(${hue}, 90%, 60%)`;
  };

  // Tile Layer URL based on theme
  const tileLayerUrl = isDarkMode
    ? 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png'
    : 'https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png';

  const attribution = '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>';

  if (locations.length === 0) {
    return (
      <div className="h-full flex items-center justify-center text-light-text-secondary dark:text-dark-text-secondary min-h-[300px]">
        <div className="text-center">
          <Icon name="public_off" className="text-4xl mb-2 opacity-50" />
          <p>No location data found in recent transactions.</p>
        </div>
      </div>
    );
  }

  const activeHoveredMarker = dottedMarkers.find(m => m.id === hoveredMarkerId);

  return (
    <div className="h-full w-full overflow-hidden relative z-0 rounded-xl border border-black/5 dark:border-white/10 group min-h-[350px] bg-slate-50/50 dark:bg-gray-950/40">

      {/* Map View Switcher */}
      <div className="absolute top-4 right-4 z-[1000] flex items-center p-1 rounded-xl bg-white/80 dark:bg-black/60 backdrop-blur-md border border-black/5 dark:border-white/10 shadow-lg text-xs font-semibold">
        <button
          type="button"
          onClick={() => setMapMode('dotted')}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg transition-all ${mapMode === 'dotted'
              ? 'bg-primary-500 text-white shadow-md shadow-primary-500/20 font-bold'
              : 'text-light-text-secondary dark:text-dark-text-secondary hover:text-light-text dark:hover:text-dark-text'
            }`}
        >
          <Icon name="grid_view" className="text-base" />
          <span>Dotted Map</span>
        </button>
        <button
          type="button"
          onClick={() => setMapMode('globe')}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg transition-all ${mapMode === 'globe'
              ? 'bg-primary-500 text-white shadow-md shadow-primary-500/20 font-bold'
              : 'text-light-text-secondary dark:text-dark-text-secondary hover:text-light-text dark:hover:text-dark-text'
            }`}
        >
          <Icon name="public" className="text-base" />
          <span>3D Globe</span>
        </button>
        <button
          type="button"
          onClick={() => setMapMode('tile')}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg transition-all ${mapMode === 'tile'
              ? 'bg-primary-500 text-white shadow-md shadow-primary-500/20 font-bold'
              : 'text-light-text-secondary dark:text-dark-text-secondary hover:text-light-text dark:hover:text-dark-text'
            }`}
        >
          <Icon name="map" className="text-base" />
          <span>Interactive Map</span>
        </button>
      </div>

      {mapMode === 'dotted' ? (
        <div
          className="relative h-full w-full overflow-hidden rounded-xl flex items-center justify-center p-2"
          onWheel={handleWheelZoom}
        >
          <div
            style={{ transform: `scale(${zoomLevel})`, transformOrigin: 'center center' }}
            className="w-full h-full flex items-center justify-center transition-transform duration-150 ease-out"
          >
            <DottedMap<MyMarker>
              markers={dottedMarkers}
              dotColor={isDarkMode ? 'rgba(255, 255, 255, 0.16)' : 'rgba(0, 0, 0, 0.14)'}
              markerColor="#3b82f6"
              dotRadius={0.15}
              pulse={true}
              className="w-full h-full max-h-[500px]"
              renderMarkerOverlay={({ marker, x, y }) => {
                const isHovered = hoveredMarkerId === marker.id;
                const flagEmoji = marker.overlay.flagEmoji;
                const city = marker.overlay.city;
                const labelText = `${flagEmoji} ${city}`;

                // SVG dimensions & positioning for badge
                const pillWidth = Math.max(labelText.length * 1.1 + 2, 9);
                const pillHeight = 3.2;
                const badgeY = y - 4.5;

                return (
                  <g
                    className="cursor-pointer transition-transform duration-200"
                    onMouseEnter={() => setHoveredMarkerId(marker.id)}
                    onMouseLeave={() => setHoveredMarkerId(null)}
                  >
                    {/* Badge shadow/border background */}
                    <rect
                      x={x - pillWidth / 2}
                      y={badgeY}
                      width={pillWidth}
                      height={pillHeight}
                      rx={1.6}
                      fill={isHovered ? (isDarkMode ? '#3b82f6' : '#2563eb') : (isDarkMode ? '#1e293b' : '#ffffff')}
                      stroke={isHovered ? '#60a5fa' : (isDarkMode ? '#334155' : '#cbd5e1')}
                      strokeWidth={0.25}
                      className="transition-colors duration-200"
                    />

                    {/* Connecting pin indicator */}
                    <polygon
                      points={`${x - 0.5},${badgeY + pillHeight} ${x + 0.5},${badgeY + pillHeight} ${x},${badgeY + pillHeight + 0.8}`}
                      fill={isHovered ? (isDarkMode ? '#3b82f6' : '#2563eb') : (isDarkMode ? '#1e293b' : '#ffffff')}
                    />

                    {/* Flag and City Text */}
                    <text
                      x={x}
                      y={badgeY + pillHeight / 2 + 0.08}
                      textAnchor="middle"
                      dominantBaseline="middle"
                      fontSize={1.4}
                      fontWeight={isHovered ? 'bold' : '600'}
                      fill={isHovered ? '#ffffff' : (isDarkMode ? '#f8fafc' : '#0f172a')}
                      style={{ userSelect: 'none' }}
                    >
                      <tspan fontSize={1.7}>{flagEmoji} </tspan>
                      <tspan>{city}</tspan>
                    </text>
                  </g>
                );
              }}
            />
          </div>

          {/* Hovered Marker Details Card */}
          {activeHoveredMarker && (
            <div className="absolute top-16 left-4 z-[1000] bg-white/95 dark:bg-gray-900/95 backdrop-blur-md p-3.5 rounded-xl shadow-xl border border-black/10 dark:border-white/10 flex flex-col gap-1 min-w-[180px] animate-fade-in-up">
              <div className="flex items-center gap-2">
                <span className="text-xl">{activeHoveredMarker.overlay.flagEmoji}</span>
                <div>
                  <h4 className="font-bold text-sm leading-tight text-light-text dark:text-dark-text">
                    {activeHoveredMarker.overlay.city}
                  </h4>
                  <p className="text-[10px] text-light-text-secondary dark:text-dark-text-secondary opacity-80">
                    {activeHoveredMarker.overlay.country}
                  </p>
                </div>
              </div>
              <div className="border-t border-gray-100 dark:border-gray-800 my-1 pt-1 flex justify-between items-center text-xs">
                <span className="text-light-text-secondary dark:text-dark-text-secondary">Transactions</span>
                <span className="font-bold font-mono">{activeHoveredMarker.overlay.count}</span>
              </div>
              <div className="flex justify-between items-center text-xs">
                <span className="text-light-text-secondary dark:text-dark-text-secondary">Total Spend</span>
                <span className="font-bold font-mono text-green-600 dark:text-green-400">
                  {formatCurrency(activeHoveredMarker.overlay.amountTotal, activeHoveredMarker.overlay.currency as Currency)}
                </span>
              </div>
              {activeHoveredMarker.overlay.latestDescription && (
                <p className="text-[10px] opacity-60 border-t border-gray-100 dark:border-gray-800 pt-1 mt-1 truncate max-w-[200px]">
                  Latest: {activeHoveredMarker.overlay.latestDescription}
                </p>
              )}
            </div>
          )}
        </div>
      ) : mapMode === 'globe' ? (
        <div
          className="relative h-full w-full overflow-hidden rounded-xl flex items-center justify-center p-4"
          onWheel={handleWheelZoom}
        >
          <div
            style={{ transform: `scale(${zoomLevel})`, transformOrigin: 'center center' }}
            className="w-full h-full max-w-[440px] flex items-center justify-center transition-transform duration-150 ease-out"
          >
            <Globe config={globeConfig} className="w-full h-full" />
          </div>
        </div>
      ) : (
        <MapContainerAny center={[20, 0]} zoom={2} style={{ height: '100%', width: '100%' }} className="z-0 bg-light-bg dark:bg-dark-bg" zoomControl={false}>
          <TileLayerAny
            attribution={attribution}
            url={tileLayerUrl}
          />
          <BoundsFitter coords={coords} />
          {locations.map(loc => {
            const color = getDensityColor(loc.count);
            const radius = Math.min(Math.max(6 + Math.log1p(loc.count) * 2, 6), 16);
            const locationLabel = [loc.city, loc.country].filter(Boolean).join(', ') || 'Unknown location';

            return (
              <CircleMarkerAny
                key={loc.id}
                center={[loc.lat, loc.lon]}
                radius={radius}
                pathOptions={{
                  color: '#fff',
                  weight: 1,
                  fillColor: color,
                  fillOpacity: 0.8,
                }}
              >
                <TooltipAny direction="top" offset={[0, -8]} opacity={1} className="custom-map-tooltip">
                  <div className="text-center space-y-1 min-w-[120px]">
                    <p className="font-bold text-sm">{locationLabel}</p>
                    <p className="text-xs opacity-70">{loc.count} transactions</p>
                    <p className="font-mono font-semibold text-green-600 dark:text-green-400">{formatCurrency(Math.abs(loc.amountTotal), loc.currency as Currency)}</p>
                    <p className="text-[10px] opacity-60 mt-1 border-t border-gray-200 dark:border-gray-700 pt-1">Latest: {loc.description}</p>
                  </div>
                </TooltipAny>
              </CircleMarkerAny>
            );
          })}
        </MapContainerAny>
      )}

      {/* Zoom Controls Overlay */}
      {(mapMode === 'dotted' || mapMode === 'globe') && (
        <div className="absolute bottom-4 right-4 z-[1000] flex items-center gap-1 p-1 rounded-xl bg-white/80 dark:bg-black/60 backdrop-blur-md border border-black/5 dark:border-white/10 shadow-lg text-xs font-semibold">
          <button
            type="button"
            onClick={handleZoomIn}
            className="w-7 h-7 flex items-center justify-center rounded-lg hover:bg-black/5 dark:hover:bg-white/10 text-light-text dark:text-dark-text transition-colors"
            title="Zoom In"
          >
            <Icon name="add" className="text-base" />
          </button>
          <button
            type="button"
            onClick={handleZoomOut}
            className="w-7 h-7 flex items-center justify-center rounded-lg hover:bg-black/5 dark:hover:bg-white/10 text-light-text dark:text-dark-text transition-colors"
            title="Zoom Out"
          >
            <Icon name="remove" className="text-base" />
          </button>
          <div className="w-[1px] h-4 bg-gray-200 dark:bg-gray-700 mx-0.5" />
          <button
            type="button"
            onClick={handleZoomReset}
            className="px-2 h-7 flex items-center justify-center rounded-lg hover:bg-black/5 dark:hover:bg-white/10 text-[10px] font-mono text-light-text-secondary dark:text-dark-text-secondary transition-colors"
            title="Reset Zoom"
          >
            {Math.round(zoomLevel * 100)}%
          </button>
        </div>
      )}
    </div>
  );
};

export default TransactionMapWidget;
