import React, { useContext, useEffect, useMemo } from 'react';
import { CircleMarker, MapContainer, Polyline, TileLayer, Tooltip, useMap } from 'react-leaflet';
import L from 'leaflet';
import type { TripSettings } from '../types';
import type { TripPlace } from '../utils/trips';
import { tileUrlProblem } from '../utils/trips';
import { formatCurrency } from '../utils';
import { useIsDark } from '../hooks/useIsDark';
import { cn } from '../lib/utils';
import { PrivacyContext } from './ui/Money';
import { VectorBasemap } from './VectorBasemap';

const MapContainerAny = MapContainer as any;
const CircleMarkerAny = CircleMarker as any;
const TileLayerAny = TileLayer as any;
const PolylineAny = Polyline as any;
const TooltipAny = Tooltip as any;

const FitPlaces: React.FC<{ places: TripPlace[] }> = ({ places }) => {
  const map = useMap();
  useEffect(() => {
    if (places.length === 1) map.setView([places[0].latitude, places[0].longitude], 12, { animate: false });
    else map.fitBounds(L.latLngBounds(places.map(place => [place.latitude, place.longitude])), { padding: [40, 40], maxZoom: 13, animate: false });
    map.invalidateSize();
  }, [map, places]);
  return null;
};

/** The same stops with no map behind them: dots placed by their coordinates. Nothing is fetched. */
const PlainMap: React.FC<{ places: TripPlace[]; label: string; className?: string }> = ({ places, label, className }) => {
  const box = useMemo(() => {
    const lats = places.map(place => place.latitude);
    const lons = places.map(place => place.longitude);
    const minLat = Math.min(...lats);
    const maxLat = Math.max(...lats);
    const minLon = Math.min(...lons);
    const maxLon = Math.max(...lons);
    const spanLat = Math.max(maxLat - minLat, 0.01);
    const spanLon = Math.max(maxLon - minLon, 0.01);
    return { minLat, minLon, spanLat, spanLon };
  }, [places]);
  return (
    <svg role="img" aria-label={label} viewBox="0 0 100 60" className={cn('w-full rounded-[var(--radius-lg)] bg-inset', className)}>
      {places.map(place => {
        const x = 8 + ((place.longitude - box.minLon) / box.spanLon) * 84;
        const y = 52 - ((place.latitude - box.minLat) / box.spanLat) * 44;
        return (
          <circle key={`${place.latitude},${place.longitude}`} cx={x} cy={y} r={Math.min(3.5, 1.2 + place.count * 0.4)} className="fill-primary" opacity={0.85}>
            <title>{place.label}</title>
          </circle>
        );
      })}
    </svg>
  );
};

/** The stops of a trip. Interactive map with chronological route line and hover stop details. */
const TripMap: React.FC<{ places: TripPlace[]; label: string; settings?: TripSettings; currency?: string; className?: string }> = ({
  places,
  label,
  settings,
  currency = 'EUR',
  className,
}) => {
  const isDark = useIsDark();
  const isPrivate = useContext(PrivacyContext);
  const route = useMemo(
    () =>
      [...places]
        .sort((a, b) => (a.firstDate ?? '').localeCompare(b.firstDate ?? ''))
        .map(p => [p.latitude, p.longitude] as [number, number]),
    [places],
  );

  if (places.length === 0) return null;
  const mode = settings?.map ?? 'default';
  const custom = mode === 'custom' && settings?.tileUrl && !tileUrlProblem(settings.tileUrl) ? settings.tileUrl.trim() : null;
  if (mode === 'off' || (mode === 'custom' && !custom)) return <PlainMap places={places} label={label} className={className} />;

  return (
    <div role="img" aria-label={label} className={cn('isolate h-72 overflow-hidden rounded-[var(--radius-lg)] border border-line bg-inset', className)}>
      <MapContainerAny
        center={[places[0].latitude, places[0].longitude]}
        zoom={10}
        zoomControl={true}
        dragging={true}
        scrollWheelZoom={false}
        doubleClickZoom={true}
        touchZoom={true}
        boxZoom={true}
        keyboard={true}
        className="!z-0 h-full w-full"
      >
        {custom ? <TileLayerAny url={custom} maxZoom={19} /> : <VectorBasemap dark={isDark} />}
        {route.length > 1 && (
          <PolylineAny
            positions={route}
            pathOptions={{ color: 'var(--primary)', weight: 2, opacity: 0.55, dashArray: '5 6' }}
            interactive={false}
          />
        )}
        {places.map(place => (
          <CircleMarkerAny
            key={`${place.latitude},${place.longitude}`}
            center={[place.latitude, place.longitude]}
            radius={Math.min(15, 7 + place.count * 1.2)}
            pathOptions={{ color: 'var(--solid)', weight: 2, fillColor: 'var(--primary)', fillOpacity: 0.92 }}
          >
            <TooltipAny direction="top" offset={[0, -8]}>
              <span className="font-sans text-xs">
                <strong>{place.label}</strong>
                {place.count > 1 ? ` · ${place.count} visits` : ''}
                {place.spend > 0 ? ` · ${isPrivate ? '•••' : formatCurrency(place.spend, currency)}` : ''}
              </span>
            </TooltipAny>
          </CircleMarkerAny>
        ))}
        <FitPlaces places={places} />
      </MapContainerAny>
    </div>
  );
};

export default TripMap;
