import type { SmartPriceBinding } from '../types';
import { fetchWithTimeout } from './fetchWithTimeout';

export interface SmartPriceCandidate {
  id: string;
  value: number;
  selector: string;
  context: string;
  score: number;
}

export const normalizeDecimalString = (rawValue: string): string => {
  const cleaned = rawValue.replace(/\s+/g, '').replace(/\u00a0/g, '').replace(/[^0-9.,-]/g, '');
  const lastDot = cleaned.lastIndexOf('.');
  const lastComma = cleaned.lastIndexOf(',');
  if (lastDot !== -1 && lastComma !== -1) {
    const decimalSeparator = lastDot > lastComma ? '.' : ',';
    const thousandsSeparator = decimalSeparator === '.' ? ',' : '.';
    return cleaned.split(thousandsSeparator).join('').replace(decimalSeparator, '.');
  }
  if (lastComma !== -1) {
    const commaCount = cleaned.split(',').length - 1;
    return commaCount > 1 ? cleaned.split(',').join('') : cleaned.replace(',', '.');
  }
  if (lastDot !== -1) {
    const dotCount = cleaned.split('.').length - 1;
    return dotCount > 1 ? cleaned.split('.').join('') : cleaned;
  }
  return cleaned;
};

/** Strips common date/time tokens so a leading date like "2026-11-18: €128.45" doesn't shadow the price. */
const stripDatesAndTimes = (text: string): string =>
  text
    .replace(/\b\d{4}[-/]\d{1,2}[-/]\d{1,2}\b/g, ' ')
    .replace(/\b\d{1,2}[-/]\d{1,2}[-/]\d{2,4}\b/g, ' ')
    .replace(/\b\d{1,2}\.\d{1,2}\.(?:19|20)\d{2}\b/g, ' ')
    .replace(/\b\d{1,2}:\d{2}(?::\d{2})?\b/g, ' ');

export const parsePriceFromText = (text: string): number | null => {
  const withoutDates = stripDatesAndTimes(text);
  const numericPart = withoutDates.match(/-?\d[\d.,]*/);
  if (!numericPart) return null;
  const parsed = parseFloat(normalizeDecimalString(numericPart[0]));
  return Number.isFinite(parsed) ? parsed : null;
};

/** Reads the most likely price text from an element, supporting both attribute-based and text-based nodes. */
export const extractPriceText = (el: Element): string => {
  const attr =
    el.getAttribute('content') ||
    el.getAttribute('data-price') ||
    el.getAttribute('data-last') ||
    el.getAttribute('data-value');
  return (attr || el.textContent || '').trim();
};

const escapeCssIdent = (value: string): string => {
  if (typeof CSS !== 'undefined' && typeof CSS.escape === 'function') {
    return CSS.escape(value);
  }
  return value.replace(/([^\w-])/g, '\\$1');
};

/** Builds a CSS selector path for an element so a chosen price node can be re-queried later. */
export const buildCssSelector = (el: Element | null): string => {
  if (!el || el.nodeType !== 1) return '';
  const parts: string[] = [];
  let curr: Element | null = el;

  while (curr && curr.nodeType === 1) {
    const tag = curr.tagName.toLowerCase();
    if (tag === 'body' || tag === 'html') break;

    const id = curr.getAttribute('id');
    const dataTestId = curr.getAttribute('data-testid');

    if (id) {
      parts.unshift(`#${escapeCssIdent(id)}`);
      break;
    }
    if (dataTestId) {
      parts.unshift(`[data-testid="${dataTestId.replace(/"/g, '\\"')}"]`);
      break;
    }

    const classes = Array.from(curr.classList || [])
      .filter(cls => !cls.includes(':') && !cls.includes('/') && !cls.includes('[') && cls.length < 24)
      .slice(0, 2);

    let segment = tag;
    if (classes.length) {
      segment += `.${classes.map(escapeCssIdent).join('.')}`;
    }

    const parent = curr.parentElement;
    if (parent) {
      const siblings = Array.from(parent.children).filter(sibling => sibling.tagName === curr!.tagName);
      if (siblings.length > 1) {
        const idx = siblings.indexOf(curr) + 1;
        segment += `:nth-of-type(${idx})`;
      }
    }

    parts.unshift(segment);
    curr = curr.parentElement;
  }

  return parts.length ? parts.join(' > ') : '';
};

const NON_CONTENT_TAGS = new Set([
  'SCRIPT',
  'STYLE',
  'NOSCRIPT',
  'TEMPLATE',
  'SVG',
  'PATH',
  'G',
  'DEFS',
  'SYMBOL',
  'USE',
]);

const isInsideSkippedTag = (el: Element): boolean => {
  let curr: Element | null = el;
  while (curr) {
    if (NON_CONTENT_TAGS.has(curr.tagName.toUpperCase())) return true;
    curr = curr.parentElement;
  }
  return false;
};

const hasDirectNumericText = (el: Element): boolean =>
  Array.from(el.childNodes || []).some(
    node => node.nodeType === 3 && /\d/.test(node.textContent || ''),
  );

/** Scans a parsed HTML document for ranked, deduplicated candidate holding prices. */
export const extractPriceCandidates = (doc: Document): SmartPriceCandidate[] => {
  const candidates: SmartPriceCandidate[] = [];

  const scoreText = (text: string, el: Element) => {
    let score = 0;
    const attrHints = `${el.getAttribute('id') || ''} ${el.getAttribute('class') || ''} ${el.getAttribute('aria-label') || ''}`;
    const hasCurrency = /[€$£¥₹]|\b(eur|usd|gbp|chf|cad|aud|sek|nok|dkk|jpy)\b/i.test(text);
    const hasPriceWord = /(last|aktuell|nav|kurs|quote|bid|ask|preis|price|close|spot|wert|value)/i.test(`${text} ${attrHints}`);

    if (hasCurrency) score += 3;
    if (hasPriceWord) score += 2;
    if (/[.,]\d{1,4}\b/.test(stripDatesAndTimes(text))) score += 2;
    if (text.length <= 24) score += 1;
    if (['strong', 'b', 'h1', 'h2', 'h3', 'h4'].includes(el.tagName.toLowerCase())) score += 1;
    if (/%/.test(text) && !hasCurrency && !hasPriceWord) score -= 2;
    return score;
  };

  const registerCandidate = (el: Element, rawText: string, scoreBoost = 0) => {
    const text = rawText.replace(/\s+/g, ' ').trim();
    if (!text) return;
    if (/^[+-]?\s*\d[\d.,]*\s*%$/.test(text)) return;
    if (/^(19|20)\d{2}$/.test(text)) return;

    const price = parsePriceFromText(text);
    if (price === null || price <= 0) return;

    const selector = buildCssSelector(el);
    if (!selector) return;

    const context = text.length > 80 ? `${text.slice(0, 77)}…` : text;
    candidates.push({
      id: `${candidates.length}-${selector}`,
      value: price,
      selector,
      context,
      score: scoreText(text, el) + scoreBoost,
    });
  };

  const attributeSelectors = ['[data-price]', '[data-last]', '[data-value]', '[itemprop="price"]'];
  attributeSelectors.forEach(sel => {
    doc.querySelectorAll(sel).forEach(el => {
      if (isInsideSkippedTag(el)) return;
      const text = extractPriceText(el);
      if (text) registerCandidate(el, text, 3);
    });
  });

  doc.querySelectorAll('meta[itemprop="price"], meta[property="product:price:amount"], meta[name="price"]').forEach(el => {
    const content = el.getAttribute('content') || '';
    if (content) registerCandidate(el, content, 3);
  });

  const bodyElements = Array.from(doc.querySelectorAll('body *'));
  let inspected = 0;
  for (const el of bodyElements) {
    if (inspected >= 10_000) break;
    if (isInsideSkippedTag(el)) continue;
    inspected++;

    const text = (el.textContent || '').trim();
    if (!text || text.length > 120 || !/\d/.test(text)) continue;

    // Skip outer container wrappers when a child element already holds the same text or price.
    if (el.children.length > 0 && !hasDirectNumericText(el)) {
      const childHasNumber = Array.from(el.children).some(child => {
        const childText = (child.textContent || '').trim();
        return childText.length > 0 && parsePriceFromText(childText) !== null;
      });
      if (childHasNumber) continue;
    }

    registerCandidate(el, text);
  }

  const deduped = new Map<string, SmartPriceCandidate>();
  for (const candidate of candidates) {
    const key = `${candidate.value}|${candidate.context.toLowerCase()}`;
    const existing = deduped.get(key);
    if (!existing || candidate.score > existing.score) {
      deduped.set(key, candidate);
    }
  }

  return Array.from(deduped.values())
    .sort((a, b) => b.score - a.score || a.context.length - b.context.length)
    .slice(0, 15);
};

/** Reads a price from a saved page and selector, for holdings no price feed covers. */
export const fetchSmartPrice = async (symbol: string, binding: Pick<SmartPriceBinding, 'url' | 'selector' | 'cookies'>) => {
  const cookieParam = binding.cookies ? `&cookies=${encodeURIComponent(binding.cookies)}` : '';
  const response = await fetchWithTimeout(`/api/smart-fetch?url=${encodeURIComponent(binding.url)}${cookieParam}`);
  if (!response.ok) throw new Error(`Request failed with status ${response.status}`);
  const element = new DOMParser().parseFromString(await response.text(), 'text/html').querySelector(binding.selector);
  if (!element) throw new Error(`Saved selector for ${symbol} no longer matches`);
  const price = parsePriceFromText(extractPriceText(element));
  if (price === null) throw new Error(`Could not parse price for ${symbol}`);
  return price;
};
