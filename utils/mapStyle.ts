/**
 * The app's basemap: OpenStreetMap Foundation vector tiles (the Shortbread
 * schema) drawn client-side by MapLibre with VersaTiles' cartography, the same combination Home Assistant 2026.10
 * uses. Light is the `colorful` theme; dark is `colorful-dark` (the old `eclipse` palette). No API key, and no
 * CARTO. Neutral on purpose: the New maps and the classic ones both build their style here.
 *
 * `@versatiles/style` is imported on demand so it stays out of the main bundle.
 */

/** OSMF's public vector tiles. */
export const OSM_VECTOR_TILES = 'https://vector.openstreetmap.org/shortbread_v1/{z}/{x}/{y}.mvt';
/** Where VersaTiles publishes the fonts and the icon sprite its styles use. */
export const VERSATILES_ASSETS = 'https://tiles.versatiles.org';

/** Plain OpenStreetMap raster tiles, used only when the vector map cannot run (no WebGL, blocked worker or host). */
export const RASTER_TILES = 'https://tile.openstreetmap.org/{z}/{x}/{y}.png';
export const RASTER_ATTRIBUTION = '&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener noreferrer">OpenStreetMap</a> contributors';

/** Required attribution for the OSM data and the cartography. */
export const BASEMAP_ATTRIBUTION =
  '&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener noreferrer">OpenStreetMap</a> contributors · <a href="https://versatiles.org" target="_blank" rel="noopener noreferrer">VersaTiles</a>';

/**
 * Both are tuned to the app's own palette: the warm canvas, sage greens, a teal water and amber roads (R11 began from Home Assistant's).
 * They sit on top of `colorful` / `colorful-dark`, which supply every colour not named here.
 */
const LIGHT_COLORS = {
  background: '#EEEAE1', land: '#EEEAE1', water: '#BFD8D4',
  naturePark: '#D3E2C8', natureGrass: '#DBE6CF', natureWood: '#C9DABD', natureLeisure: '#D3E2C8',
  building: '#E3DED2', buildingBg: '#D5CFC0',
  roadStreet: '#FFFDF8', roadStreetBg: '#DDD7C9',
  roadSecondary: '#F6E2B6', roadSecondaryBg: '#E6CB8C',
  roadTrunk: '#F6E2B6', roadTrunkBg: '#E6CB8C', roadMotorway: '#F2D595', roadMotorwayBg: '#DDB566',
  label: '#1B1813', labelHalo: '#FFFDF8',
};
/** Dark follows the app's own palette (warm near-black like --canvas and --solid, forest greens, a teal water) rather than navy. */
const DARK_COLORS = {
  background: '#171510', land: '#171510', water: '#173137',
  naturePark: '#1D3328', natureGrass: '#1A2E24', natureWood: '#18291F', natureLeisure: '#1D3328',
  building: '#1F1D17', buildingBg: '#16140F',
  roadStreet: '#2A2820', roadStreetBg: '#171510',
  roadSecondary: '#36322A', roadSecondaryBg: '#171510',
  roadTrunk: '#403A2C', roadTrunkBg: '#171510', roadMotorway: '#4A4230', roadMotorwayBg: '#171510',
  label: '#E4DFD3', labelHalo: '#12110D',
};

export const basemapTheme = (dark: boolean) => (dark ? 'colorful-dark' : 'colorful') as 'colorful' | 'colorful-dark';

const cache = new Map<string, Promise<Record<string, unknown>>>();

/** The MapLibre style for a theme. Built once per theme. */
export const loadBasemapStyle = (dark: boolean): Promise<Record<string, unknown>> => {
  const theme = basemapTheme(dark);
  let style = cache.get(theme);
  if (!style) {
    style = import('@versatiles/style').then(({ osm }) =>
      // A flat map (a dashboard panel is no place for a globe), no sky, and the style's own light left off.
      osm({ theme, colors: dark ? DARK_COLORS : LIGHT_COLORS, urls: { base: VERSATILES_ASSETS, osm: OSM_VECTOR_TILES }, projection: 'mercator', sky: false, light: false }) as unknown as Record<string, unknown>,
    );
    cache.set(theme, style);
    style.catch(() => cache.delete(theme));
  }
  return style;
};

/** The old CARTO key lived in localStorage; it is gone, so remove what is left. */
export const forgetLegacyCartoKey = () => {
  try { localStorage.removeItem('crystal_carto_api_key'); } catch { /* storage may be unavailable */ }
};
