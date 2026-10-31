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

/** Required attribution for the OSM data and the cartography. */
export const BASEMAP_ATTRIBUTION =
  '&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener noreferrer">OpenStreetMap</a> contributors · <a href="https://versatiles.org" target="_blank" rel="noopener noreferrer">VersaTiles</a>';

/**
 * Home Assistant's palettes (R11): navy with teal parks and blue streets in dark, cream with golden roads in light.
 * They sit on top of `colorful` / `colorful-dark`, which supply every colour not named here.
 */
const LIGHT_COLORS = {
  background: '#f1e9d9', land: '#f1e9d9', water: '#a9d4ee',
  naturePark: '#d3e5bd', natureGrass: '#dbe8c6', natureWood: '#cde0b4', natureLeisure: '#dbe8c6',
  building: '#e7dccb', buildingBg: '#ddd1be',
  roadStreet: '#ffffff', roadStreetBg: '#e4d9c6',
  roadSecondary: '#fddba3', roadSecondaryBg: '#f1c986',
  roadTrunk: '#fddba3', roadTrunkBg: '#f1c986', roadMotorway: '#fdd392', roadMotorwayBg: '#eebd72',
  label: '#3b3a37', labelHalo: '#f6f0e4',
};
const DARK_COLORS = {
  background: '#191d36', land: '#191d36', water: '#2a3f94',
  naturePark: '#1f4a45', natureGrass: '#1d423f', natureWood: '#1c443f', natureLeisure: '#1f4a45',
  building: '#151932', buildingBg: '#111428',
  roadStreet: '#2c3262', roadStreetBg: '#191d36',
  roadSecondary: '#363c78', roadSecondaryBg: '#191d36',
  roadTrunk: '#3a4180', roadTrunkBg: '#191d36', roadMotorway: '#3a4180', roadMotorwayBg: '#191d36',
  label: '#e6e8f6', labelHalo: '#13162b',
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
