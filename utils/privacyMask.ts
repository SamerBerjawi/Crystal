import { CURRENCY_CODES } from './currencies';

/**
 * Privacy mode blurs elements carrying `.privacy-blur`. Most amounts are marked at their source, but there are
 * hundreds of formatCurrency() call sites (tables, chart labels, cards) and new ones appear all the time, so while
 * privacy mode is on this marks any element whose own text is a currency amount.
 */
const CODES = [...new Set([...CURRENCY_CODES, 'BTC', 'ETH'])].join('|');
const SYMBOLS = '€$£¥₹₩₺₪₫฿₱₴₦₡₲₵₸₼₾₿';
const AMOUNT = new RegExp(
  `(?:[${SYMBOLS}]\\s?[-+−]?\\s?\\d|[-+−]?\\s?\\d[\\d.,\\s]*\\s?(?:[${SYMBOLS}]|(?:${CODES})\\b)|(?:${CODES})\\s?[-+−]?\\s?\\d|[-+−]\\s?[${SYMBOLS}]\\s?\\d)`
);

export const looksLikeAmount = (text: string) => text.length <= 60 && AMOUNT.test(text);

const markNode = (node: Node) => {
  const text = node.textContent || '';
  if (text.length > 60 || !AMOUNT.test(text)) return;
  const el = node.parentElement;
  if (el && !el.classList.contains('privacy-blur')) {
    el.classList.add('privacy-blur');
    el.setAttribute('data-privacy-auto', 'true');
  }
};

const scan = (root: Node) => {
  if (root.nodeType === Node.TEXT_NODE) { markNode(root); return; }
  if (root.nodeType !== Node.ELEMENT_NODE) return;
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  let current: Node | null;
  while ((current = walker.nextNode())) markNode(current);
};

export const startPrivacyMask = (root: HTMLElement = document.body): (() => void) => {
  scan(root);
  let pending: Node[] = [];
  let scheduled = false;
  let timer: ReturnType<typeof setTimeout> | null = null;
  const flush = () => {
    scheduled = false;
    timer = null;
    const batch = pending;
    pending = [];
    batch.forEach(scan);
  };
  const observer = new MutationObserver(mutations => {
    for (const m of mutations) {
      if (m.type === 'characterData') pending.push(m.target);
      else m.addedNodes.forEach(n => pending.push(n));
    }
    if (!scheduled) { scheduled = true; timer = setTimeout(flush, 50); }
  });
  observer.observe(root, { childList: true, subtree: true, characterData: true });
  return () => {
    observer.disconnect();
    if (timer) clearTimeout(timer);
    if (typeof root.querySelectorAll === 'function') {
      root.querySelectorAll('[data-privacy-auto="true"]').forEach(el => {
        el.classList.remove('privacy-blur');
        el.removeAttribute('data-privacy-auto');
      });
    }
  };
};
