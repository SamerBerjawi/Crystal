import React, { useEffect, useMemo, useRef } from 'react';
import * as maplibregl from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import { cn } from '../../../lib/utils';
import type { Currency } from '../../../types';
import { formatCurrency } from '../../../utils';
import type { PlaceCluster } from '../../../utils/transactionsModel';
import { BASEMAP_ATTRIBUTION, loadBasemapStyle } from '../../../utils/mapStyle';

/*
 * Maps for the Transactions page (UI_UX_DESIGN_REFERENCE.md §17, R11). Loaded lazily, so MapLibre stays out of the
 * main bundle. The basemap is OSMF vector tiles styled by VersaTiles (`colorful` / `colorful-dark`), no API key.
 * Markers are plain DOM elements so they stay flat and survive a theme switch.
 */

type MapOptions = { dark: boolean; center: [number, number]; zoom: number; interactive: boolean };

/** Creates the map once and swaps the style when the theme flips. */
const useMap = (container: React.RefObject<HTMLDivElement>, { dark, center, zoom, interactive }: MapOptions) => {
  const mapRef = useRef<maplibregl.Map | null>(null);
  const [ready, setReady] = React.useState(false);
  const first = useRef({ dark, center, zoom, interactive });

  useEffect(() => {
    const el = container.current;
    if (!el) return;
    let cancelled = false;
    let map: maplibregl.Map | null = null;
    let observer: ResizeObserver | null = null;
    const o = first.current;
    loadBasemapStyle(o.dark).then(style => {
      if (cancelled) return;
      map = new maplibregl.Map({
        container: el,
        style: style as any,
        center: [o.center[1], o.center[0]],
        zoom: o.zoom,
        maxZoom: 16,
        interactive: o.interactive,
        cooperativeGestures: o.interactive,
        attributionControl: false,
        fadeDuration: 0,
      });
      const attribution = new maplibregl.AttributionControl({ compact: true, customAttribution: BASEMAP_ATTRIBUTION });
      map.addControl(attribution);
      // MapLibre opens a compact attribution on a wide map; start it as the "i" button and open it on click.
      const collapse = () => {
        const box = attribution._container as HTMLElement | undefined;
        box?.classList.remove('maplibregl-compact-show');
        box?.removeAttribute('open');
      };
      collapse();
      map.once('load', collapse);
      if (o.interactive) map.addControl(new maplibregl.NavigationControl({ showCompass: false }), 'top-right');
      mapRef.current = map;
      observer = new ResizeObserver(() => map?.resize());
      observer.observe(el);
      setReady(true);
    }).catch(() => { /* offline or blocked: the empty container stays, markers still list in the table */ });
    return () => {
      cancelled = true;
      observer?.disconnect();
      map?.remove();
      mapRef.current = null;
      setReady(false);
    };
  }, [container]);

  const applied = useRef(dark);
  useEffect(() => {
    const map = mapRef.current;
    if (!ready || !map || applied.current === dark) return;
    applied.current = dark;
    loadBasemapStyle(dark).then(style => map.setStyle(style as any)).catch(() => {});
  }, [dark, ready]);

  return { map: mapRef, ready };
};

const clusterEl = (
  c: PlaceCluster,
  selected: boolean,
  onSelect: (key: string) => void,
  metric: 'count' | 'spent' = 'count',
  currency: Currency = 'EUR'
) => {
  // Flat dot: size and count or spend carry the frequency, a soft same-colour halo marks it without a gradient or shadow.
  const isSpent = metric === 'spent';
  const label = isSpent ? formatCurrency(c.spent, currency, { compact: true }) : (c.count > 1 ? String(c.count) : '');
  const size = isSpent ? 36 : (c.count > 1 ? Math.round(20 + Math.min(24, Math.sqrt(c.count) * 4)) : 10);
  const el = document.createElement('button');
  el.type = 'button';
  el.className = cn(
    'flex items-center justify-center rounded-full text-[10px] font-semibold leading-none transition-colors px-1',
    selected ? 'bg-nv-violet text-nv-on-violet' : 'bg-nv-ink text-nv-on-ink',
  );
  el.style.width = el.style.height = `${size}px`;
  el.style.boxShadow = `0 0 0 ${c.count > 1 || isSpent ? 4 : 3}px color-mix(in srgb, ${selected ? 'var(--nv-violet)' : 'var(--nv-ink)'} 16%, transparent)`;
  el.textContent = label;
  el.setAttribute('aria-label', `${c.label}: ${c.count} transaction${c.count === 1 ? '' : 's'}${isSpent ? `, ${formatCurrency(c.spent, currency)}` : ''}`);
  el.setAttribute('aria-pressed', String(selected));
  el.addEventListener('click', e => { e.stopPropagation(); onSelect(c.key); });
  return el;
};

export const PlacesMap: React.FC<{
  clusters: PlaceCluster[];
  selected: string[];
  onSelect: (key: string) => void;
  dark: boolean;
  metric?: 'count' | 'spent';
  currency?: Currency;
  className?: string;
}> = ({ clusters, selected, onSelect, dark, metric = 'count', currency = 'EUR', className }) => {
  const box = useRef<HTMLDivElement>(null);
  const first = clusters[0];
  const { map, ready } = useMap(box, { dark, center: first ? [first.lat, first.lng] : [30, 0], zoom: first ? 4 : 1.5, interactive: true });
  const touched = useRef(false);
  const onSelectRef = useRef(onSelect);
  onSelectRef.current = onSelect;
  const key = clusters.map(c => `${c.key}:${c.lat},${c.lng}`).join('|');

  // Frames the places, again whenever they change or the box resizes, until the user pans or zooms.
  const fit = useRef<() => void>(() => {});
  fit.current = () => {
    const m = map.current;
    if (!m || !clusters.length) return;
    if (clusters.length === 1) { m.jumpTo({ center: [clusters[0].lng, clusters[0].lat], zoom: 11 }); return; }
    const b = new maplibregl.LngLatBounds();
    clusters.forEach(c => b.extend([c.lng, c.lat]));
    m.fitBounds(b, { padding: 28, maxZoom: 12, duration: 0 });
  };

  useEffect(() => {
    const m = map.current;
    if (!ready || !m) return;
    const mark = (e: any) => { if (e.originalEvent) touched.current = true; };
    const onResize = () => { if (!touched.current) fit.current(); };
    m.on('dragstart', mark); m.on('zoomstart', mark); m.on('resize', onResize);
    return () => { m.off('dragstart', mark); m.off('zoomstart', mark); m.off('resize', onResize); };
  }, [ready, map]);

  useEffect(() => { if (ready) { touched.current = false; fit.current(); } }, [ready, key]);

  const selectedKey = selected.join('|');
  useEffect(() => {
    const m = map.current;
    if (!ready || !m) return;
    const markers = clusters.map(c =>
      new maplibregl.Marker({ element: clusterEl(c, selected.includes(c.key), k => onSelectRef.current(k), metric, currency) })
        .setLngLat([c.lng, c.lat]).addTo(m));
    return () => markers.forEach(mk => mk.remove());
    // `key` and `selectedKey` identify the clusters and the selection.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready, key, selectedKey, metric, currency, map]);

  return <div ref={box} role="region" aria-label="Map of where transactions happened" className={cn('nv-map z-0 h-full w-full overflow-hidden rounded-nv-tile bg-nv-inset', className)} />;
};

/** One fixed place, for the detail sheet. */
export const SinglePlaceMap: React.FC<{ lat: number; lng: number; dark: boolean; className?: string }> = ({ lat, lng, dark, className }) => {
  const box = useRef<HTMLDivElement>(null);
  const { map, ready } = useMap(box, { dark, center: [lat, lng], zoom: 14, interactive: false });
  const dot = useMemo(() => {
    const el = document.createElement('div');
    el.className = 'h-[10px] w-[10px] rounded-full bg-nv-ink';
    el.style.boxShadow = '0 0 0 3px color-mix(in srgb, var(--nv-ink) 16%, transparent)';
    return el;
  }, []);
  useEffect(() => {
    const m = map.current;
    if (!ready || !m) return;
    m.jumpTo({ center: [lng, lat], zoom: 14 });
    const mk = new maplibregl.Marker({ element: dot }).setLngLat([lng, lat]).addTo(m);
    return () => { mk.remove(); };
  }, [ready, lat, lng, dot, map]);
  return <div ref={box} role="img" aria-label="Map of the transaction's location" className={cn('nv-map z-0 h-full w-full overflow-hidden rounded-nv-tile bg-nv-inset', className)} />;
};
