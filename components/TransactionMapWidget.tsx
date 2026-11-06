import React, { useMemo, useEffect, useState } from 'react';
import { MapContainer, CircleMarker, Tooltip, useMap } from 'react-leaflet';
import { countries, type TCountryCode } from 'countries-list';
import { Transaction } from '../types';
import { convertToMain, getMainCurrency, safeRound } from '../utils';
import L from 'leaflet';
import { useIsDark } from '../hooks/useIsDark';
import { IconButton } from './ui/Actions';
import Icon from './ui/Icon';
import { Amount } from './ui/Money';
import { EmptyState } from './ui/States';
import { useWidgetBox } from './ui/WidgetGrid';
import { VectorBasemap } from './VectorBasemap';

type CountryCode = Lowercase<TCountryCode>;

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

/** What the controls and the place chips ask of the map. They go through the map itself, so they work after it has been dragged or zoomed by hand. */
interface MapApi {
  zoomIn: () => void;
  zoomOut: () => void;
  fitAll: () => void;
  flyTo: (lat: number, lon: number) => void;
}

/** Fits the map around every place when it opens and whenever the places change, and hands its controls to the widget. */
const MapBridge: React.FC<{ coords: [number, number][]; center: [number, number]; apiRef: React.MutableRefObject<MapApi | null> }> = ({ coords, center, apiRef }) => {
  const map = useMap();
  const coordsRef = React.useRef(coords);
  coordsRef.current = coords;

  const fitAll = React.useCallback(() => {
    const points = coordsRef.current;
    if (points.length === 0) map.setView(center, 4);
    else if (points.length === 1) map.setView(points[0], 12);
    else map.fitBounds(L.latLngBounds(points), { padding: [50, 50], maxZoom: 13 });
  }, [map, center]);

  useEffect(() => {
    apiRef.current = {
      zoomIn: () => map.zoomIn(),
      zoomOut: () => map.zoomOut(),
      fitAll,
      flyTo: (lat, lon) => map.flyTo([lat, lon], Math.max(map.getZoom(), 11), { duration: 0.6 }),
    };
    return () => { apiRef.current = null; };
  }, [map, fitAll, apiRef]);

  useEffect(() => {
    fitAll();
    const timer = setTimeout(() => map.invalidateSize(), 100);
    return () => clearTimeout(timer);
  }, [coords, fitAll, map]);
  return null;
};

const MapContainerAny = MapContainer as any;
const CircleMarkerAny = CircleMarker as any;
const TooltipAny = Tooltip as any;

const TransactionMapWidget: React.FC<TransactionMapWidgetProps> = ({ transactions }) => {
  const isDarkMode = useIsDark();
  const [selectedLocationId, setSelectedLocationId] = useState<string | null>(null);
  const [hoveredLocationId, setHoveredLocationId] = useState<string | null>(null);
  const currency = getMainCurrency();

  const locations = useMemo(() => {
    type GroupedLocation = { key: string; lat: number; lon: number; count: number; total: number; transactions: Transaction[] };

    // Totals convert each transaction to the main currency, so places with mixed currencies add up (D-109).
    const grouped = transactions
      .filter(tx => tx.latitude !== undefined && tx.latitude !== null && tx.longitude !== undefined && tx.longitude !== null)
      .reduce((map: Map<string, GroupedLocation>, tx) => {
        const key = tx.city && tx.country
          ? `${tx.city.trim().toLowerCase()}|${tx.country.trim().toLowerCase()}`
          : `${Number(tx.latitude!.toFixed(2))},${Number(tx.longitude!.toFixed(2))}`;
        const amount = convertToMain(tx.amount, tx.currency);
        const current = map.get(key);
        if (current) {
          current.count += 1;
          current.total = safeRound(current.total + amount, 2);
          current.transactions.push(tx);
        } else {
          map.set(key, { key, lat: Number(tx.latitude!.toFixed(4)), lon: Number(tx.longitude!.toFixed(4)), count: 1, total: safeRound(amount, 2), transactions: [tx] });
        }
        return map;
      }, new Map<string, GroupedLocation>());

    return Array.from(grouped.values())
      .map(group => {
        const first = group.transactions[0];
        const meta = getCountryMeta(first.country);
        const city = first.city || 'Unknown city';
        return {
          id: group.key,
          lat: group.lat,
          lon: group.lon,
          count: group.count,
          total: group.total,
          label: first.locationLabel || first.placeName || city,
          address: first.address,
          city,
          country: meta.countryName || first.country || '',
          flagEmoji: meta.flagEmoji,
        };
      })
      .sort((a, b) => b.count - a.count);
  }, [transactions]);

  const focalCenter = useMemo((): [number, number] => (locations.length === 0 ? [20, 0] : [locations[0].lat, locations[0].lon]), [locations]);
  const coords: [number, number][] = useMemo(() => locations.map(l => [l.lat, l.lon]), [locations]);
  const mapApi = React.useRef<MapApi | null>(null);
  const box = useWidgetBox();
  // Place chips need a row of 48px under the map and the detail card needs 260px by 420px; the map itself fills the rest.
  const showRail = box.height === 0 || box.height >= 300;
  const showDetail = box.height === 0 || (box.height >= 260 && box.width >= 420);

  if (locations.length === 0) {
    return <EmptyState icon="location-01" title="No places yet" description="Transactions with a location show up on this map." className="h-full py-6" />;
  }

  // Picking a place flies the map to it; picking it again, or "All", brings every place back into view.
  const choose = (loc: { id: string; lat: number; lon: number } | null) => {
    if (!loc || selectedLocationId === loc.id) {
      setSelectedLocationId(null);
      mapApi.current?.fitAll();
    } else {
      setSelectedLocationId(loc.id);
      mapApi.current?.flyTo(loc.lat, loc.lon);
    }
  };
  const focusId = hoveredLocationId || selectedLocationId;
  const active = locations.find(l => l.id === (hoveredLocationId || selectedLocationId));
  const totalCount = locations.reduce((sum, l) => sum + l.count, 0);
  const floating = 'border border-line bg-solid/90 backdrop-blur-md';
  const placeLine = (loc: { city: string; country: string }) => [loc.city, loc.country].filter(Boolean).join(', ') || 'Unknown place';

  return (
    <div className="relative isolate flex h-full min-h-[160px] w-full flex-col overflow-hidden rounded-[var(--radius-lg)] bg-inset">
      <div className={`type-caption absolute left-3 top-3 z-[1000] rounded-full px-3 py-1 text-ink ${floating}`}>
        {locations.length} {locations.length === 1 ? 'place' : 'places'} · {totalCount} {totalCount === 1 ? 'transaction' : 'transactions'}
      </div>

      <div className="relative min-h-[100px] w-full flex-1 overflow-hidden">
        <MapContainerAny center={focalCenter} zoom={3} style={{ height: '100%', width: '100%' }} className="!z-0" zoomControl={false}>
          <VectorBasemap dark={isDarkMode} />
          <MapBridge coords={coords} center={focalCenter} apiRef={mapApi} />
          {locations.map(loc => (
            <CircleMarkerAny
              key={loc.id}
              center={[loc.lat, loc.lon]}
              radius={Math.min(Math.max(6 + Math.log1p(loc.count) * 2.5, 7), 16) + (loc.id === focusId ? 2 : 0)}
              pathOptions={{ color: 'var(--solid)', weight: loc.id === focusId ? 3 : 2, fillColor: loc.id === focusId ? 'var(--amber)' : 'var(--primary)', fillOpacity: focusId && loc.id !== focusId ? 0.4 : 0.9 }}
              eventHandlers={{ click: () => choose(loc), mouseover: () => setHoveredLocationId(loc.id), mouseout: () => setHoveredLocationId(null) }}
            >
              <TooltipAny direction="top" offset={[0, -8]} opacity={1} className="custom-map-tooltip">
                <span className="type-caption block text-center">
                  <span className="type-body-strong block">{loc.flagEmoji} {placeLine(loc)}</span>
                  {loc.count} {loc.count === 1 ? 'transaction' : 'transactions'} · <Amount value={loc.total} currency={currency} tone="flow" />
                </span>
              </TooltipAny>
            </CircleMarkerAny>
          ))}
        </MapContainerAny>
      </div>

      {active && showDetail && (
        <div className={`absolute left-3 top-12 z-[1000] w-[220px] rounded-[var(--radius-lg)] p-3 ${floating}`}>
          <div className="flex items-start justify-between gap-2">
            <div className="flex min-w-0 gap-2">
              <span aria-hidden>{active.flagEmoji}</span>
              <div className="min-w-0">
                <h4 className="type-body-strong truncate text-ink">{active.label}</h4>
                <p className="type-caption truncate text-muted">{active.address || placeLine(active)}</p>
              </div>
            </div>
            {selectedLocationId === active.id && <IconButton icon="cancel-01" label="Close" iconSize={16} className="size-8" onPress={() => setSelectedLocationId(null)} />}
          </div>
          <dl className="type-caption mt-2 space-y-1 border-t border-line pt-2">
            <div className="flex justify-between"><dt className="text-muted">Transactions</dt><dd className="tabular-nums text-ink">{active.count}</dd></div>
            <div className="flex justify-between"><dt className="text-muted">Total</dt><dd className="text-ink"><Amount value={active.total} currency={currency} tone="flow" /></dd></div>
          </dl>
        </div>
      )}

      {showRail && <div className="no-scrollbar relative z-10 flex items-center gap-1.5 overflow-x-auto px-3 pb-3 pt-2">
        <button
          type="button"
          onClick={() => choose(null)}
          aria-pressed={selectedLocationId === null}
          className={`type-caption inline-flex h-8 shrink-0 items-center gap-1.5 rounded-full border px-3 transition-colors focus-visible:outline-2 focus-visible:outline-[var(--focus)] ${selectedLocationId === null ? 'border-pill bg-pill text-on-pill' : 'border-line bg-solid text-ink hover:bg-inset'}`}
        >
          <Icon name="globe-02" size={14} />
          All
        </button>
        {locations.map(loc => {
          const isOn = selectedLocationId === loc.id;
          return (
            <button
              key={loc.id}
              type="button"
              onMouseEnter={() => setHoveredLocationId(loc.id)}
              onMouseLeave={() => setHoveredLocationId(null)}
              onClick={() => choose(loc)}
              aria-pressed={selectedLocationId === loc.id}
              className={`type-caption inline-flex h-8 shrink-0 items-center gap-1.5 rounded-full border px-3 transition-colors focus-visible:outline-2 focus-visible:outline-[var(--focus)] ${isOn ? 'border-pill bg-pill text-on-pill' : 'border-line bg-solid text-ink hover:bg-inset'}`}
            >
              <span aria-hidden>{loc.flagEmoji}</span>
              <span className="max-w-[130px] truncate">{loc.label}</span>
            </button>
          );
        })}
      </div>}

      <div className={`absolute ${showRail ? 'bottom-14' : 'bottom-3'} right-3 z-[1000] flex items-center gap-0.5 rounded-full p-1 ${floating}`}>
        <IconButton icon="add-01" label="Zoom in" iconSize={16} className="size-8" onPress={() => mapApi.current?.zoomIn()} />
        <IconButton icon="minus-sign" label="Zoom out" iconSize={16} className="size-8" onPress={() => mapApi.current?.zoomOut()} />
        <IconButton icon="globe-02" label="Show every place" iconSize={16} className="size-8" onPress={() => choose(null)} />
      </div>
    </div>
  );
};

export default TransactionMapWidget;
