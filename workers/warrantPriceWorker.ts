/* eslint-disable no-restricted-globals */
import { ScraperConfig } from '../types';

interface FetchRequest {
  type: 'FETCH_PRICES';
  configs: ScraperConfig[];
  proxies: string[];
}

interface FetchResponse {
  type: 'FETCH_PRICES_RESULT';
  prices: Record<string, number | null>;
  timestamp: number;
}

const parsePriceFromHtml = (html: string, select: string, index: number, attribute?: string): number | null => {
  const parser = new DOMParser();
  const doc = parser.parseFromString(html, 'text/html');
  const elements = doc.querySelectorAll(select);
  if (elements.length <= index) return null;
  const target = elements[index];
  const raw = attribute ? target.getAttribute(attribute) : target.textContent;
  if (!raw) return null;
  const priceString = raw.match(/[0-9.,\s]+/)?.[0]?.trim() || '';
  const normalized = priceString.replace(/\./g, '').replace(',', '.');
  const parsed = parseFloat(normalized);
  return Number.isFinite(parsed) ? parsed : null;
};

const fetchThroughProxies = async (config: ScraperConfig, proxies: string[]) => {
  for (const proxy of proxies) {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), (config.resource.timeout || 15) * 1000);
    try {
      const url = proxy.includes('?')
        ? `${proxy}${encodeURIComponent(config.resource.url)}`
        : `${proxy}${config.resource.url}`;
      const response = await fetch(url, { signal: controller.signal });
      clearTimeout(timeoutId);
      if (!response.ok) continue;
      const html = await response.text();
      const price = parsePriceFromHtml(html, config.options.select, config.options.index, config.options.attribute);
      if (price !== null) {
        return price;
      }
    } catch (err) {
      clearTimeout(timeoutId);
      // Ignore and try the next proxy
    }
  }
  return null;
};

self.addEventListener('message', async (event: MessageEvent<FetchRequest>) => {
  const { data } = event;
  if (data.type !== 'FETCH_PRICES') return;

  const prices: Record<string, number | null> = {};
  const proxies = [...data.proxies].sort(() => Math.random() - 0.5);

  for (const config of data.configs) {
    prices[config.id] = await fetchThroughProxies(config, proxies);
  }

  const response: FetchResponse = {
    type: 'FETCH_PRICES_RESULT',
    prices,
    timestamp: Date.now(),
  };

  (self as unknown as Worker).postMessage(response);
});
