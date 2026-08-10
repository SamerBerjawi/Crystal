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
  const [hoveredMarkerId, setHoveredMarkerId] = useState<string | null>(null);

  useEffect(() => {
    const checkDarkMode = () => document.documentElement.classList.contains('dark');
    setIsDarkMode(checkDarkMode());

    const observer = new MutationObserver(checkDarkMode);
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] });
    return () => observer.disconnect();
  }, []);
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
        // Group by City+Country if present, otherwise round coordinates to ~1.1km (~0.01 deg)
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

    return Array.from(grouped.values()).map((group: GroupedLocation) => {
      const representative = group.transactions[0];

      return {
        id: group.key,
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

  // Calculate focal center and optimal SVG viewBox & Leaflet center
  const { dottedDefaultZoom, globeDefaultZoom, tileDefaultZoom, defaultDottedViewBox, focalCenter, globeFocusAngles } = useMemo(() => {
    if (locations.length === 0) {
      return {
        dottedDefaultZoom: 1,
        globeDefaultZoom: 1,
        tileDefaultZoom: 2,
        defaultDottedViewBox: '0 0 150 75',
        focalCenter: [20, 0] as [number, number],
        globeFocusAngles: [0, 0] as [number, number],
      };
    }

    // Convert lat/lon to Equirectangular SVG coordinates (x: 0..150, y: 0..75)
    const projected = locations.map(l => ({
      x: ((l.lon + 180) / 360) * 150,
      y: ((90 - l.lat) / 180) * 75,
      lat: l.lat,
      lon: l.lon,
    }));

    let minX = projected[0].x, maxX = projected[0].x;
    let minY = projected[0].y, maxY = projected[0].y;
    let minLat = locations[0].lat, maxLat = locations[0].lat;
    let minLon = locations[0].lon, maxLon = locations[0].lon;

    projected.forEach(p => {
      minX = Math.min(minX, p.x);
      maxX = Math.max(maxX, p.x);
      minY = Math.min(minY, p.y);
      maxY = Math.max(maxY, p.y);
      minLat = Math.min(minLat, p.lat);
      maxLat = Math.max(maxLat, p.lat);
      minLon = Math.min(minLon, p.lon);
      maxLon = Math.max(maxLon, p.lon);
    });

    const cx = (minX + maxX) / 2;
    const cy = (minY + maxY) / 2;
    const spanX = Math.max(maxX - minX, 2);
    const spanY = Math.max(maxY - minY, 2);

    // Target SVG view width with padding around markers
    const targetW = Math.min(150, Math.max(24, Math.max(spanX * 2.8, spanY * 2.8 * 2)));
    const targetH = targetW / 2;

    let vx = cx - targetW / 2;
    let vy = cy - targetH / 2;
    vx = Math.max(0, Math.min(150 - targetW, vx));
    vy = Math.max(0, Math.min(75 - targetH, vy));

    const initialViewBox = `${vx.toFixed(2)} ${vy.toFixed(2)} ${targetW.toFixed(2)} ${targetH.toFixed(2)}`;
    const calcDottedZoom = Number((150 / targetW).toFixed(2));

    const latSpan = Math.abs(maxLat - minLat);
    const lonSpan = Math.abs(maxLon - minLon);
    const maxSpan = Math.max(latSpan, lonSpan);

    let calcGlobeZoom = 1.8;
    if (maxSpan < 3) calcGlobeZoom = 2.4;
    else if (maxSpan < 15) calcGlobeZoom = 2.0;
    else if (maxSpan < 45) calcGlobeZoom = 1.7;

    let calcTileZoom = 6;
    if (maxSpan < 1) calcTileZoom = 13;
    else if (maxSpan < 5) calcTileZoom = 10;
    else if (maxSpan < 20) calcTileZoom = 7;
    else if (maxSpan < 60) calcTileZoom = 5;

    const centerLat = (minLat + maxLat) / 2;
    const centerLon = (minLon + maxLon) / 2;

    // COBE spherical angles: phi (longitude), theta (subtle tilt near 0.17 for north hemisphere, centered)
    const phi = Math.PI - ((centerLon * Math.PI) / 180 - Math.PI / 2);
    const theta = Math.sin((centerLat * Math.PI) / 180) * 0.22;

    return {
      dottedDefaultZoom: calcDottedZoom,
      globeDefaultZoom: calcGlobeZoom,
      tileDefaultZoom: calcTileZoom,
      defaultDottedViewBox: initialViewBox,
      focalCenter: [centerLat, centerLon] as [number, number],
      globeFocusAngles: [phi, theta] as [number, number],
    };
  }, [locations]);

  // Independent zoom state for each map view
  const [dottedZoom, setDottedZoom] = useState<number>(1);
  const [globeZoom, setGlobeZoom] = useState<number>(1);
  const [tileZoom, setTileZoom] = useState<number>(2);

  useEffect(() => {
    setDottedZoom(dottedDefaultZoom);
    setGlobeZoom(globeDefaultZoom);
    setTileZoom(tileDefaultZoom);
  }, [dottedDefaultZoom, globeDefaultZoom, tileDefaultZoom]);

  const currentZoom = mapMode === 'dotted' ? dottedZoom : mapMode === 'globe' ? globeZoom : tileZoom;
  const currentDefaultZoom = mapMode === 'dotted' ? dottedDefaultZoom : mapMode === 'globe' ? globeDefaultZoom : tileDefaultZoom;

  const setCurrentZoom = (valOrFn: number | ((prev: number) => number)) => {
    if (mapMode === 'dotted') setDottedZoom(valOrFn);
    else if (mapMode === 'globe') setGlobeZoom(valOrFn);
    else setTileZoom(valOrFn);
  };

  const handleZoomIn = () => {
    const maxZoom = mapMode === 'tile' ? 18 : 12;
    const step = mapMode === 'tile' ? 1 : 0.25;
    setCurrentZoom(prev => Math.min(Number((prev + step).toFixed(2)), maxZoom));
  };

  const handleZoomOut = () => {
    const minZoom = mapMode === 'tile' ? 1 : 0.7;
    const step = mapMode === 'tile' ? 1 : 0.25;
    setCurrentZoom(prev => Math.max(Number((prev - step).toFixed(2)), minZoom));
  };

  // Toggle between 100% and location framing zoom level
  const handleToggleZoom = () => {
    const base100 = mapMode === 'tile' ? 2 : 1;
    const isAt100 = mapMode === 'tile' ? currentZoom <= 3 : Math.abs(currentZoom - 1) < 0.1;
    if (isAt100) {
      setCurrentZoom(currentDefaultZoom);
    } else {
      setCurrentZoom(base100);
    }
  };

  const handleWheelZoom = (e: React.WheelEvent) => {
    e.preventDefault();
    const step = mapMode === 'tile' ? 0.5 : 0.2;
    const minZoom = mapMode === 'tile' ? 1 : 0.7;
    const maxZoom = mapMode === 'tile' ? 18 : 12;
    const delta = e.deltaY < 0 ? step : -step;
    setCurrentZoom(prev => Math.min(Math.max(Number((prev + delta).toFixed(2)), minZoom), maxZoom));
  };

  // Dynamically compute SVG viewBox based on dottedZoom
  const currentDottedViewBox = useMemo(() => {
    const w = Math.min(150, 150 / dottedZoom);
    const h = w / 2;

    const parts = defaultDottedViewBox.split(' ').map(Number);
    const cx = parts[0] + parts[2] / 2;
    const cy = parts[1] + parts[3] / 2;

    let x = cx - w / 2;
    let y = cy - h / 2;
    x = Math.max(0, Math.min(150 - w, x));
    y = Math.max(0, Math.min(75 - h, y));

    return `${x.toFixed(2)} ${y.toFixed(2)} ${w.toFixed(2)} ${h.toFixed(2)}`;
  }, [dottedZoom, defaultDottedViewBox]);

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

  // Simple COBE Configuration for MagicUI Globe
  const globeConfig = useMemo(() => {
    return {
      width: 800,
      height: 800,
      onRender: () => {},
      devicePixelRatio: 2,
      phi: globeFocusAngles[0],
      theta: globeFocusAngles[1],
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
  }, [isDarkMode, locations, maxCount, globeFocusAngles]);

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
      <div className="absolute top-4 right-4 z-[1000] flex items-center p-1 rounded-xl bg-white/80 dark:bg-black/60 backdrop-blur-md border border-black/5 dark:border-white/10 shadow-lg text-xs font-semibold gap-1">
        <button
          type="button"
          onClick={() => setMapMode('dotted')}
          title="Dotted Map"
          aria-label="Dotted Map"
          className={`w-8 h-8 flex items-center justify-center rounded-lg transition-all ${mapMode === 'dotted'
              ? 'bg-primary-500 text-white shadow-md shadow-primary-500/20'
              : 'text-light-text-secondary dark:text-dark-text-secondary hover:text-light-text dark:hover:text-dark-text hover:bg-black/5 dark:hover:bg-white/10'
            }`}
        >
          <Icon name="grid_view" className="text-lg" />
        </button>
        <button
          type="button"
          onClick={() => setMapMode('globe')}
          title="3D Globe"
          aria-label="3D Globe"
          className={`w-8 h-8 flex items-center justify-center rounded-lg transition-all ${mapMode === 'globe'
              ? 'bg-primary-500 text-white shadow-md shadow-primary-500/20'
              : 'text-light-text-secondary dark:text-dark-text-secondary hover:text-light-text dark:hover:text-dark-text hover:bg-black/5 dark:hover:bg-white/10'
            }`}
        >
          <Icon name="public" className="text-lg" />
        </button>
        <button
          type="button"
          onClick={() => setMapMode('tile')}
          title="Interactive Map"
          aria-label="Interactive Map"
          className={`w-8 h-8 flex items-center justify-center rounded-lg transition-all ${mapMode === 'tile'
              ? 'bg-primary-500 text-white shadow-md shadow-primary-500/20'
              : 'text-light-text-secondary dark:text-dark-text-secondary hover:text-light-text dark:hover:text-dark-text hover:bg-black/5 dark:hover:bg-white/10'
            }`}
        >
          <Icon name="map" className="text-lg" />
        </button>
      </div>

      {mapMode === 'dotted' ? (
        <div
          className="relative h-full w-full overflow-hidden rounded-xl flex items-center justify-center p-2"
          onWheel={handleWheelZoom}
        >
          <div className="w-full h-full flex items-center justify-center">
            <DottedMap<MyMarker>
              viewBox={currentDottedViewBox}
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
            style={{ transform: `scale(${Number(globeZoom.toFixed(2))})`, transformOrigin: 'center center' }}
            className="w-full h-full max-w-[340px] max-h-[340px] aspect-square flex items-center justify-center transition-transform duration-150 ease-out shrink-0"
          >
            <Globe config={globeConfig} className="w-full h-full" />
          </div>
        </div>
      ) : (
        <MapContainerAny center={focalCenter} zoom={tileZoom} style={{ height: '100%', width: '100%' }} className="z-0 bg-light-bg dark:bg-dark-bg" zoomControl={false}>
          <TileLayerAny
            attribution={attribution}
            url={tileLayerUrl}
          />
          <BoundsFitter coords={coords} center={focalCenter} />
          <LeafletZoomController zoomLevel={tileZoom} />
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
            onClick={handleToggleZoom}
            className="px-2 h-7 flex items-center justify-center rounded-lg hover:bg-black/5 dark:hover:bg-white/10 text-[10px] font-mono text-light-text-secondary dark:text-dark-text-secondary transition-colors"
            title={(mapMode === 'tile' ? currentZoom <= 3 : Math.abs(currentZoom - 1) < 0.1) ? "Zoom to locations" : "Toggle 100% view"}
          >
            {mapMode === 'tile' ? `${Math.round((tileZoom / 2) * 100)}%` : `${Math.round(currentZoom * 100)}%`}
          </button>
        </div>
    </div>
  );
};

export default TransactionMapWidget;
