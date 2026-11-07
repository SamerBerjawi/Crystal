import { useEffect } from 'react';
import { useMap } from 'react-leaflet';
import L from 'leaflet';
import '@maplibre/maplibre-gl-leaflet';
import 'maplibre-gl/dist/maplibre-gl.css';
import { BASEMAP_ATTRIBUTION, RASTER_ATTRIBUTION, RASTER_TILES, loadBasemapStyle } from '../utils/mapStyle';

/** How long the vector map gets to draw something before the raster fallback takes over. */
const VECTOR_DRAW_TIMEOUT_MS = 8000;

const hasWebGL = (): boolean => {
  try {
    const canvas = document.createElement('canvas');
    return !!(canvas.getContext('webgl2') || canvas.getContext('webgl'));
  } catch {
    return false;
  }
};

/**
 * Basemap for the classic Leaflet maps: OSMF vector tiles with VersaTiles' cartography, drawn by MapLibre through
 * the Leaflet bridge. Style from utils/mapStyle.ts.
 *
 * The vector map needs WebGL, a worker and three hosts. When any of that fails (no WebGL, a blocked worker or host,
 * nothing drawn in time) the map falls back to plain OpenStreetMap raster tiles instead of staying blank, and the
 * reason is logged to the console.
 */
export const VectorBasemap = ({ dark }: { dark: boolean }) => {
  const map = useMap();
  useEffect(() => {
    let cancelled = false;
    let vector: any = null;
    let raster: L.TileLayer | null = null;
    let timer: ReturnType<typeof setTimeout> | undefined;

    const useRaster = (reason: unknown) => {
      if (cancelled || raster) return;
      console.warn('Vector basemap unavailable, using raster tiles:', reason);
      if (timer) clearTimeout(timer);
      if (vector) { try { map.removeLayer(vector); } catch { /* already gone */ } vector = null; }
      raster = L.tileLayer(RASTER_TILES, { attribution: RASTER_ATTRIBUTION, maxZoom: 19, className: dark ? 'crystal-raster-dark' : '' });
      raster.addTo(map);
    };

    if (!hasWebGL()) {
      useRaster('WebGL is not available in this browser');
    } else {
      loadBasemapStyle(dark).then(style => {
        if (cancelled) return;
        vector = (L as any).maplibreGL({ style, attribution: BASEMAP_ATTRIBUTION });
        vector.addTo(map);
        const ml = vector.getMaplibreMap?.();
        ml?.on('error', (event: any) => {
          const message = String(event?.error?.message ?? event?.error ?? '');
          if (/worker|webgl|context/i.test(message)) useRaster(message);
        });
        timer = setTimeout(() => {
          if (cancelled || raster) return;
          let drew = false;
          try { drew = !!ml && ml.isStyleLoaded() && ml.queryRenderedFeatures().length > 0; } catch { drew = false; }
          if (!drew) useRaster('the vector map drew nothing within 8 seconds');
        }, VECTOR_DRAW_TIMEOUT_MS);
      }).catch(error => useRaster(error));
    }

    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
      if (vector) map.removeLayer(vector);
      if (raster) map.removeLayer(raster);
    };
  }, [map, dark]);
  return null;
};
