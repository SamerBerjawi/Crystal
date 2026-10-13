import { escapeHtml } from '../utils';

const DATA_IMAGE = /^data:image\/(png|jpe?g|gif|webp|avif|svg\+xml)[;,]/i;

/**
 * Returns `url` as an HTML-attribute-safe value if it is an http(s) or data:image URL, otherwise null.
 * Use for any URL interpolated into an HTML *string* (e.g. Leaflet divIcon markup), where React's
 * automatic escaping does not apply.
 */
export const safeImageSrcAttr = (url: unknown): string | null => {
  if (typeof url !== 'string') return null;
  const value = url.trim();
  if (!value) return null;
  if (DATA_IMAGE.test(value)) return escapeHtml(value);
  try {
    const parsed = new URL(value);
    if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') return null;
    return escapeHtml(parsed.toString());
  } catch {
    return null;
  }
};
