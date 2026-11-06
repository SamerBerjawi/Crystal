import type { CSSProperties } from 'react';
import type { Account } from '../types';

export type CardShade = 'light' | 'dark';

export interface CardColor {
  id: string;
  label: string;
  light: string;
  dark: string;
}

/** Ten colours, each in a pastel light shade and a deep dark one. Dark shades take light text and light shades take dark text. */
export const CARD_COLORS: CardColor[] = [
  { id: 'forest', label: 'Forest', light: '#A8D5B5', dark: '#1F4D3A' },
  { id: 'teal', label: 'Teal', light: '#A6DCD8', dark: '#0F5A5E' },
  { id: 'ocean', label: 'Ocean', light: '#A9C9EE', dark: '#1F3F6E' },
  { id: 'indigo', label: 'Indigo', light: '#BCBEF0', dark: '#35348A' },
  { id: 'plum', label: 'Plum', light: '#D2B5EA', dark: '#4A2F7A' },
  { id: 'rose', label: 'Rose', light: '#F2B3C6', dark: '#8A2448' },
  { id: 'ember', label: 'Ember', light: '#F5B9A0', dark: '#9A3418' },
  { id: 'amber', label: 'Amber', light: '#F6D38A', dark: '#7A5200' },
  { id: 'olive', label: 'Olive', light: '#CBD99A', dark: '#4B5A1A' },
  { id: 'slate', label: 'Slate', light: '#BFC6D1', dark: '#2E3440' },
];

export const CARD_PATTERNS = [
  { id: 'none', label: 'Plain' },
  { id: 'lines', label: 'Lines' },
  { id: 'dots', label: 'Dots' },
  { id: 'grid', label: 'Grid' },
  { id: 'waves', label: 'Waves' },
  { id: 'rings', label: 'Rings' },
] as const;

export type CardPatternId = (typeof CARD_PATTERNS)[number]['id'];

export interface CardStyleChoice {
  color?: string;
  shade?: CardShade;
  pattern?: string;
}

export const cardStyleOf = (account: Pick<Account, 'cardColor' | 'cardShade' | 'cardPattern'>): CardStyleChoice => ({
  color: account.cardColor,
  shade: account.cardShade,
  pattern: account.cardPattern,
});

/** The pattern drawn over a card, in a faint ink that suits the shade underneath. */
export const patternStyle = (pattern: string | undefined, tone: CardShade): CSSProperties | undefined => {
  const ink = tone === 'dark' ? 'rgba(255,255,255,.14)' : 'rgba(27,24,19,.12)';
  switch (pattern) {
    case 'lines':
      return { backgroundImage: `repeating-linear-gradient(135deg, ${ink} 0 1px, transparent 1px 9px)` };
    case 'dots':
      return { backgroundImage: `radial-gradient(${ink} 1.6px, transparent 1.8px)`, backgroundSize: '13px 13px' };
    case 'grid':
      return { backgroundImage: `linear-gradient(${ink} 1px, transparent 1px), linear-gradient(90deg, ${ink} 1px, transparent 1px)`, backgroundSize: '18px 18px' };
    case 'waves':
      return { backgroundImage: `repeating-radial-gradient(circle at 0% 100%, transparent 0 16px, ${ink} 16px 17px)` };
    case 'rings':
      return { backgroundImage: `repeating-radial-gradient(circle at 82% 18%, transparent 0 20px, ${ink} 20px 21px)` };
    default:
      return undefined;
  }
};

/**
 * A card's own look, or `undefined` when nobody chose a colour (it then takes its account type's colour). The tone
 * says which text colour sits on it.
 */
export const cardLook = (choice: CardStyleChoice): { background: string; tone: CardShade } | undefined => {
  const color = CARD_COLORS.find(item => item.id === choice.color);
  if (!color) return undefined;
  const tone: CardShade = choice.shade === 'light' ? 'light' : 'dark';
  return { background: color[tone], tone };
};
