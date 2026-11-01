import React, { useEffect, useMemo } from 'react';
import { MapContainer, Marker, useMap } from 'react-leaflet';
import L from 'leaflet';
import { useIsDark } from '../hooks/useIsDark';
import { cn } from '../lib/utils';
import { safeImageSrcAttr } from '../utils/safeImageUrl';
import { VectorBasemap } from './VectorBasemap';

const MapContainerAny = MapContainer as any;
const MarkerAny = Marker as any;

const ZOOM = 15;

export interface MapPlace {
  latitude: number;
  longitude: number;
}

const KeepInView: React.FC<{ places: MapPlace[] }> = ({ places }) => {
  const map = useMap();
  useEffect(() => {
    if (places.length === 1) map.setView([places[0].latitude, places[0].longitude], ZOOM, { animate: false });
    else map.fitBounds(L.latLngBounds(places.map(place => [place.latitude, place.longitude])), { padding: [40, 40], maxZoom: ZOOM + 1, animate: false });
    map.invalidateSize();
  }, [map, places]);
  return null;
};

const pinFor = (logoUrl?: string | null) => {
  const src = safeImageSrcAttr(logoUrl);
  const size = src ? 40 : 20;
  return L.divIcon({
    className: '',
    html: src
      ? `<img src="${src}" alt="" class="size-10 rounded-full bg-solid object-cover shadow-[0_0_0_2px_var(--solid)]" />`
      : '<div class="size-5 rounded-full bg-primary shadow-[0_0_0_2px_var(--solid)]"></div>',
    iconSize: [size, size],
    iconAnchor: [size / 2, size / 2],
  });
};

/** A fixed map of one or more places. It doesn't pan or zoom, so it never traps a scroll or the keyboard. */
const PlaceMap: React.FC<{ places: MapPlace[]; label: string; logoUrl?: string | null; className?: string }> = ({ places, label, logoUrl, className }) => {
  const isDark = useIsDark();
  const pin = useMemo(() => pinFor(logoUrl), [logoUrl]);

  return (
    <div role="img" aria-label={`Map showing ${label}`} className={cn('isolate overflow-hidden rounded-[var(--radius-lg)] bg-inset', className)}>
      <MapContainerAny
        center={[places[0].latitude, places[0].longitude]}
        zoom={ZOOM}
        zoomControl={false}
        dragging={false}
        scrollWheelZoom={false}
        doubleClickZoom={false}
        touchZoom={false}
        boxZoom={false}
        keyboard={false}
        className="!z-0 h-full w-full"
      >
        <VectorBasemap dark={isDark} />
        {places.map(place => <MarkerAny key={`${place.latitude},${place.longitude}`} position={[place.latitude, place.longitude]} icon={pin} interactive={false} keyboard={false} />)}
        <KeepInView places={places} />
      </MapContainerAny>
    </div>
  );
};

export default PlaceMap;
