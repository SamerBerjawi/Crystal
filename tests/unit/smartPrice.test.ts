import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  buildCssSelector,
  extractPriceCandidates,
  extractPriceText,
  normalizeDecimalString,
  parsePriceFromText,
} from '../../utils/smartPrice';

interface FakeNode {
  nodeType: number;
  textContent: string;
}

class FakeElement {
  nodeType = 1;
  tagName: string;
  attributes: Record<string, string>;
  classList: string[];
  children: FakeElement[] = [];
  childNodes: FakeNode[] = [];
  parentElement: FakeElement | null = null;
  private ownText = '';

  constructor(tag: string, attrs: Record<string, string> = {}, ownText = '') {
    this.tagName = tag.toUpperCase();
    this.attributes = attrs;
    this.classList = attrs.class ? attrs.class.split(/\s+/).filter(Boolean) : [];
    this.ownText = ownText;
    if (ownText) this.childNodes.push({ nodeType: 3, textContent: ownText });
  }

  append(child: FakeElement): FakeElement {
    child.parentElement = this;
    this.children.push(child);
    return child;
  }

  get textContent(): string {
    if (this.children.length === 0) return this.ownText;
    return [this.ownText, ...this.children.map(c => c.textContent)].filter(Boolean).join(' ');
  }

  getAttribute(name: string): string | null {
    return this.attributes[name] ?? null;
  }
}

const flatten = (root: FakeElement): FakeElement[] => {
  const out: FakeElement[] = [];
  for (const child of root.children) {
    out.push(child, ...flatten(child));
  }
  return out;
};

const makeDoc = (headChildren: FakeElement[], bodyChildren: FakeElement[]): Document => {
  const html = new FakeElement('html');
  const head = html.append(new FakeElement('head'));
  headChildren.forEach(c => head.append(c));
  const body = html.append(new FakeElement('body'));
  bodyChildren.forEach(c => body.append(c));
  const all = [head, ...flatten(head), body, ...flatten(body)];
  const bodyAll = flatten(body);

  const matchesSimple = (el: FakeElement, sel: string): boolean => {
    if (sel === 'body *') return bodyAll.includes(el);
    if (sel.startsWith('[') && sel.endsWith(']')) {
      const inner = sel.slice(1, -1);
      const eq = inner.indexOf('=');
      if (eq === -1) return el.getAttribute(inner) !== null;
      const key = inner.slice(0, eq);
      const val = inner.slice(eq + 1).replace(/^"|"$/g, '');
      return el.getAttribute(key) === val;
    }
    const metaMatch = sel.match(/^meta\[([^=]+)="([^"]+)"\]$/);
    if (metaMatch) {
      return el.tagName === 'META' && el.getAttribute(metaMatch[1]) === metaMatch[2];
    }
    return false;
  };

  return {
    querySelectorAll: (selector: string) => {
      if (selector === 'body *') return bodyAll as unknown as NodeListOf<Element>;
      const parts = selector.split(',').map(s => s.trim());
      return all.filter(el => parts.some(p => matchesSimple(el, p))) as unknown as NodeListOf<Element>;
    },
  } as unknown as Document;
};

test('normalizeDecimalString handles US, European, and multi-thousand formats', () => {
  assert.equal(normalizeDecimalString('1,234.56'), '1234.56');
  assert.equal(normalizeDecimalString('1.234,56'), '1234.56');
  assert.equal(normalizeDecimalString('1,234,567'), '1234567');
  assert.equal(normalizeDecimalString('1.234.567'), '1234567');
  assert.equal(normalizeDecimalString('€ 42,50'), '42.50');
});

test('parsePriceFromText ignores leading dates and times to extract the price', () => {
  assert.equal(parsePriceFromText('2026-11-18: €128.45'), 128.45);
  assert.equal(parsePriceFromText('As of 18.11.2026 09:55:15 — 42,75 EUR'), 42.75);
  assert.equal(parsePriceFromText('2026-11-18'), null);
  assert.equal(parsePriceFromText('09:55:15'), null);
});

test('extractPriceText reads attribute-based prices as well as textContent', () => {
  const meta = new FakeElement('meta', { itemprop: 'price', content: '99.25' });
  const span = new FakeElement('span', { 'data-price': '104.50' }, '104,50 EUR');
  const plain = new FakeElement('strong', {}, '€ 55.10');

  assert.equal(extractPriceText(meta as unknown as Element), '99.25');
  assert.equal(extractPriceText(span as unknown as Element), '104.50');
  assert.equal(extractPriceText(plain as unknown as Element), '€ 55.10');
});

test('buildCssSelector escapes special characters and stops at body/html', () => {
  const html = new FakeElement('html');
  const head = html.append(new FakeElement('head'));
  const meta = head.append(new FakeElement('meta', { itemprop: 'price', content: '12.34' }));
  const body = html.append(new FakeElement('body'));
  const reactNode = body.append(new FakeElement('span', { id: ':r1:' }, '12.34'));

  assert.equal(buildCssSelector(reactNode as unknown as Element), '#\\:r1\\:');
  assert.equal(buildCssSelector(meta as unknown as Element), 'head > meta');
});

test('extractPriceCandidates skips scripts/svgs/wrappers and finds prices beyond 2000 nav nodes', () => {
  const navNodes = Array.from({ length: 2100 }, (_, i) => new FakeElement('div', { class: 'nav' }, `Menu ${i}`));
  const script = new FakeElement('script', {}, 'window.build = 2026;');
  const svg = new FakeElement('svg');
  svg.append(new FakeElement('path', {}, '12345'));

  const wrapper = new FakeElement('div', { class: 'quote-box' });
  const outer = wrapper.append(new FakeElement('div', { class: 'quote-inner' }));
  outer.append(new FakeElement('strong', { id: 'last-price' }, '€ 148.92'));

  const pct = new FakeElement('span', { class: 'change' }, '+2.45%');
  const meta = new FakeElement('meta', { itemprop: 'price', content: '148.95' });

  const doc = makeDoc([meta], [script, svg, ...navNodes, wrapper, pct]);
  const results = extractPriceCandidates(doc);

  assert.ok(results.some(c => c.value === 148.92), 'should find price past 2000 nav nodes');
  assert.ok(results.some(c => c.value === 148.95), 'should include meta price');
  assert.ok(!results.some(c => c.value === 2026), 'should skip script contents');
  assert.ok(!results.some(c => c.value === 12345), 'should skip svg contents');
  assert.ok(!results.some(c => c.value === 2.45), 'should skip pure percentage changes');
  assert.equal(results.filter(c => c.value === 148.92).length, 1, 'should deduplicate wrapper ancestors');
});
