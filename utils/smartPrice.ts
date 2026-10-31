import type { SmartPriceBinding } from '../types';
import { fetchWithTimeout } from './fetchWithTimeout';

export const normalizeDecimalString = (rawValue: string): string => {
  const cleaned = rawValue.replace(/\s+/g, '').replace(/ /g, '').replace(/[^0-9.,-]/g, '');
  const lastDot = cleaned.lastIndexOf('.');
  const lastComma = cleaned.lastIndexOf(',');
  const decimalSeparator = lastDot > lastComma ? '.' : lastComma > lastDot ? ',' : null;
  if (decimalSeparator) {
    const thousandsSeparator = decimalSeparator === '.' ? ',' : '.';
    return cleaned.split(thousandsSeparator).join('').replace(decimalSeparator, '.');
  }
  return cleaned.replace(/,/g, '.');
};

export const parsePriceFromText = (text: string): number | null => {
  const numericPart = text.match(/-?\d[\d.,-]*/);
  if (!numericPart) return null;
  const parsed = parseFloat(normalizeDecimalString(numericPart[0]));
  return isNaN(parsed) ? null : parsed;
};

/** Reads a price from a saved page and selector, for holdings no price feed covers. */
export const fetchSmartPrice = async (symbol: string, binding: Pick<SmartPriceBinding, 'url' | 'selector' | 'cookies'>) => {
  const cookieParam = binding.cookies ? `&cookies=${encodeURIComponent(binding.cookies)}` : '';
  const response = await fetchWithTimeout(`/api/smart-fetch?url=${encodeURIComponent(binding.url)}${cookieParam}`);
  if (!response.ok) throw new Error(`Request failed with status ${response.status}`);
  const element = new DOMParser().parseFromString(await response.text(), 'text/html').querySelector(binding.selector);
  if (!element) throw new Error(`Saved selector for ${symbol} no longer matches`);
  const price = parsePriceFromText(element.textContent || '');
  if (price === null) throw new Error(`Could not parse price for ${symbol}`);
  return price;
};
