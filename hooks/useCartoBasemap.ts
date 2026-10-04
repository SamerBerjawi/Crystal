import { useMemo } from 'react';
import { useLocalStorage } from './useLocalStorage';

interface CartoBasemapResult {
  tileUrl: string;
  attribution: string;
  isCarto: boolean;
  subdomains: string[];
}

/**
 * Returns the appropriate tile URL, attribution and subdomain list based on
 * whether a CARTO API key is configured and whether dark mode is active.
 *
 * If no key is provided, falls back to standard OpenStreetMap tiles which
 * require no authentication and display without watermarks.
 *
 * Automatically pulls the configured API key from 'crystal_carto_api_key' in localStorage
 * if not explicitly passed as an argument.
 *
 * IMPORTANT: Always pass `key={tileUrl}` to <TileLayer> so React-Leaflet
 * remounts the layer when the URL changes (e.g. on theme switch).
 */
export function useCartoBasemap(
  cartoApiKey?: string,
  darkMode: boolean = false,
  lightTheme: 'voyager' | 'light_all' = 'voyager',
): CartoBasemapResult {
  const [storedCartoKey] = useLocalStorage<string>('crystal_carto_api_key', '');
  const rawKey = cartoApiKey !== undefined && cartoApiKey !== '' ? cartoApiKey : storedCartoKey;
  const activeKey = (rawKey || '').replace(/^["']|["']$/g, '').trim();

  return useMemo(() => {
    const hasKey = activeKey.length > 0;

    if (hasKey) {
      const theme = darkMode ? 'dark_all' : lightTheme;
      return {
        tileUrl: `https://{s}.basemaps.cartocdn.com/rastertiles/${theme}/{z}/{x}/{y}{r}.png?key=${activeKey}`,
        attribution:
          '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>',
        isCarto: true,
        subdomains: ['a', 'b', 'c', 'd'],
      };
    }

    // Fallback — standard OpenStreetMap, no API key required
    return {
      tileUrl: 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',
      attribution:
        '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
      isCarto: false,
      subdomains: ['a', 'b', 'c'],
    };
  }, [activeKey, darkMode, lightTheme]);
}

