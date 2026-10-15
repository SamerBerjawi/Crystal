/**
 * Privacy mode blurs elements carrying `.privacy-blur`. Most amounts are marked at their source, but there are
 * hundreds of formatCurrency() call sites (tables, chart labels, cards) and new ones appear all the time, so while
 * privacy mode is on this marks any element whose own text is a currency amount.
 */
const CODES = 'EUR|USD|GBP|CHF|JPY|CNY|CAD|AUD|NZD|SEK|NOK|DKK|PLN|CZK|HUF|RON|BGN|TRY|INR|BRL|MXN|ZAR|AED|SAR|HKD|SGD|KRW|BTC|ETH';
const AMOUNT = new RegExp(
  `(?:[€$£¥₹₩₺]\\s?[-+−]?\\s?\\d|\\d[\\d.,\\s]*\\s?(?:[€£¥₹₩₺]|(?:${CODES})\\b)|(?:${CODES})\\s?[-+−]?\\d|[-+−]\\s?[€$£¥₹₩₺]\\s?\\d)`
);

export const looksLikeAmount = (text: string) => text.length <= 60 && AMOUNT.test(text);

const markNode = (node: Node) => {
  const text = node.textContent || '';
  if (text.length > 60 || !AMOUNT.test(text)) return;
  const el = node.parentElement;
  if (el && !el.classList.contains('privacy-blur')) el.classList.add('privacy-blur');
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
  const flush = () => {
    scheduled = false;
    const batch = pending;
    pending = [];
    batch.forEach(scan);
  };
  const observer = new MutationObserver(mutations => {
    for (const m of mutations) {
      if (m.type === 'characterData') pending.push(m.target);
      else m.addedNodes.forEach(n => pending.push(n));
    }
    if (!scheduled) { scheduled = true; setTimeout(flush, 50); }
  });
  observer.observe(root, { childList: true, subtree: true, characterData: true });
  return () => observer.disconnect();
};
