import React, { useEffect, useMemo } from 'react';
import { CircleMarker, MapContainer, TileLayer, useMap } from 'react-leaflet';
import L from 'leaflet';
import type { TripSettings } from '../types';
import type { TripPlace } from '../utils/trips';
import { tileUrlProblem } from '../utils/trips';
import { useIsDark } from '../hooks/useIsDark';
import { cn } from '../lib/utils';
import { VectorBasemap } from './VectorBasemap';

const MapContainerAny = MapContainer as any;
const CircleMarkerAny = CircleMarker as any;
const TileLayerAny = TileLayer as any;

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
    const pad = 0.1;
    const minLat = Math.min(...lats), maxLat = Math.max(...lats), minLon = Math.min(...lons), maxLon = Math.max(...lons);
    const spanLat = Math.max(maxLat - minLat, 0.01), spanLon = Math.max(maxLon - minLon, 0.01);
    return { minLat, minLon, spanLat, spanLon, pad };
  }, [places]);
  return (
    <svg role="img" aria-label={label} viewBox="0 0 100 60" className={cn('w-full rounded-[var(--radius-lg)] bg-inset', className)}>
      {places.map(place => {
        const x = 8 + ((place.longitude - box.minLon) / box.spanLon) * 84;
        const y = 52 - ((place.latitude - box.minLat) / box.spanLat) * 44;
        return <circle key={`${place.latitude},${place.longitude}`} cx={x} cy={y} r={Math.min(3.5, 1.2 + place.count * 0.4)} className="fill-primary" opacity={0.85}><title>{place.label}</title></circle>;
      })}
    </svg>
  );
};

/** The stops of a trip. The tiles behind them are your choice: the app's map, your own tile server, or none. */
const TripMap: React.FC<{ places: TripPlace[]; label: string; settings?: TripSettings; className?: string }> = ({ places, label, settings, className }) => {
  const isDark = useIsDark();
  if (places.length === 0) return null;
  const mode = settings?.map ?? 'default';
  const custom = mode === 'custom' && settings?.tileUrl && !tileUrlProblem(settings.tileUrl) ? settings.tileUrl.trim() : null;
  if (mode === 'off' || (mode === 'custom' && !custom)) return <PlainMap places={places} label={label} className={className} />;

  return (
    <div role="img" aria-label={label} className={cn('isolate h-64 overflow-hidden rounded-[var(--radius-lg)] bg-inset', className)}>
      <MapContainerAny center={[places[0].latitude, places[0].longitude]} zoom={10} zoomControl={false} dragging={false} scrollWheelZoom={false} doubleClickZoom={false} touchZoom={false} boxZoom={false} keyboard={false} className="!z-0 h-full w-full">
        {custom ? <TileLayerAny url={custom} maxZoom={19} /> : <VectorBasemap dark={isDark} />}
        {places.map(place => <CircleMarkerAny key={`${place.latitude},${place.longitude}`} center={[place.latitude, place.longitude]} radius={Math.min(14, 6 + place.count)} pathOptions={{ color: '#ffffff', weight: 2, fillColor: '#2f6b4f', fillOpacity: 0.9 }} interactive={false} />)}
        <FitPlaces places={places} />
      </MapContainerAny>
    </div>
  );
};

export default TripMap;
