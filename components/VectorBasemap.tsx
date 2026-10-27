import { useEffect } from 'react';
import { useMap } from 'react-leaflet';
import L from 'leaflet';
import '@maplibre/maplibre-gl-leaflet';
import 'maplibre-gl/dist/maplibre-gl.css';
import { BASEMAP_ATTRIBUTION, loadBasemapStyle } from '../utils/mapStyle';

/**
 * Basemap for the classic Leaflet maps: OSMF vector tiles with VersaTiles' cartography, drawn by MapLibre through
 * the Leaflet bridge. Same style as the New UI maps (utils/mapStyle.ts). Replaces the CARTO raster tiles.
 */
export const VectorBasemap = ({ dark }: { dark: boolean }) => {
  const map = useMap();
  useEffect(() => {
    let cancelled = false;
    let layer: any = null;
    loadBasemapStyle(dark).then(style => {
      if (cancelled) return;
      layer = (L as any).maplibreGL({ style, attribution: BASEMAP_ATTRIBUTION });
      layer.addTo(map);
    }).catch(() => { /* offline or blocked: the map stays blank */ });
    return () => {
      cancelled = true;
      if (layer) map.removeLayer(layer);
    };
  }, [map, dark]);
  return null;
};
