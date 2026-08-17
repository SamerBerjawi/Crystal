import { useState, useEffect, useCallback } from 'react';
import { AppFont, AppFontCategory } from '../types';

export const FONT_STORAGE_KEY = 'crystal_font';

export interface FontDefinition {
  id: AppFont;
  label: string;
  fontName: string;
  fontFamily: string;
  category: AppFontCategory;
  categoryLabel: string;
  description: string;
  previewClass?: string;
  sampleText?: string;
}

export const FONT_DEFINITIONS: Record<string, FontDefinition> = {
  'plus-jakarta': {
    id: 'plus-jakarta',
    label: 'Plus Jakarta Sans',
    fontName: '"Plus Jakarta Sans"',
    fontFamily: '"Plus Jakarta Sans", sans-serif',
    category: 'sans',
    categoryLabel: 'Sans-Serif',
    description: 'Modern geometric sans-serif with friendly curves and high legibility',
    previewClass: 'font-["Plus_Jakarta_Sans",sans-serif]',
    sampleText: 'The quick brown fox jumps over the lazy dog. 1234567890',
  },
  'inter': {
    id: 'inter',
    label: 'Inter',
    fontName: '"Inter"',
    fontFamily: '"Inter", sans-serif',
    category: 'sans',
    categoryLabel: 'Sans-Serif',
    description: 'Precise, neutral Swiss-style neo-grotesque optimized for data & interfaces',
    previewClass: 'font-["Inter",sans-serif]',
    sampleText: 'The quick brown fox jumps over the lazy dog. 1234567890',
  },
  'open-sans': {
    id: 'open-sans',
    label: 'Open Sans',
    fontName: '"Open Sans"',
    fontFamily: '"Open Sans", sans-serif',
    category: 'sans',
    categoryLabel: 'Sans-Serif',
    description: 'Highly legible, friendly humanist sans-serif with open letterforms',
    previewClass: 'font-["Open_Sans",sans-serif]',
    sampleText: 'The quick brown fox jumps over the lazy dog. 1234567890',
  },
  'montserrat': {
    id: 'montserrat',
    label: 'Montserrat',
    fontName: '"Montserrat"',
    fontFamily: '"Montserrat", sans-serif',
    category: 'sans',
    categoryLabel: 'Sans-Serif',
    description: 'Geometric urban aesthetic inspired by traditional Buenos Aires posters',
    previewClass: 'font-["Montserrat",sans-serif]',
    sampleText: 'The quick brown fox jumps over the lazy dog. 1234567890',
  },
  'ubuntu': {
    id: 'ubuntu',
    label: 'Ubuntu',
    fontName: '"Ubuntu"',
    fontFamily: '"Ubuntu", sans-serif',
    category: 'sans',
    categoryLabel: 'Sans-Serif',
    description: 'Contemporary humanist sans-serif with distinctive curved terminals',
    previewClass: 'font-["Ubuntu",sans-serif]',
    sampleText: 'The quick brown fox jumps over the lazy dog. 1234567890',
  },
  'delius': {
    id: 'delius',
    label: 'Delius',
    fontName: '"Delius"',
    fontFamily: '"Delius", cursive, sans-serif',
    category: 'display',
    categoryLabel: 'Display / Casual',
    description: 'High-quality comic book lettering font with playful casual strokes',
    previewClass: 'font-["Delius",cursive,sans-serif]',
    sampleText: 'The quick brown fox jumps over the lazy dog. 1234567890',
  },
  'crimson-pro': {
    id: 'crimson-pro',
    label: 'Crimson Pro',
    fontName: '"Crimson Pro"',
    fontFamily: '"Crimson Pro", Georgia, serif',
    category: 'serif',
    categoryLabel: 'Serif',
    description: 'Refined, elegant book typeface tailored for editorial clarity and warmth',
    previewClass: 'font-["Crimson_Pro",Georgia,serif]',
    sampleText: 'The quick brown fox jumps over the lazy dog. 1234567890',
  },
  'neuton': {
    id: 'neuton',
    label: 'Neuton',
    fontName: '"Neuton"',
    fontFamily: '"Neuton", Georgia, serif',
    category: 'serif',
    categoryLabel: 'Serif',
    description: 'Clean Dutch-flavored serif with compact proportions and large x-height',
    previewClass: 'font-["Neuton",Georgia,serif]',
    sampleText: 'The quick brown fox jumps over the lazy dog. 1234567890',
  },
  'dm-serif-display': {
    id: 'dm-serif-display',
    label: 'DM Serif Display',
    fontName: '"DM Serif Display"',
    fontFamily: '"DM Serif Display", Georgia, serif',
    category: 'serif',
    categoryLabel: 'Serif',
    description: 'High-contrast transitional serif designed for commanding titles & luxury',
    previewClass: 'font-["DM_Serif_Display",Georgia,serif]',
    sampleText: 'The quick brown fox jumps over the lazy dog. 1234567890',
  },
  'noto-serif': {
    id: 'noto-serif',
    label: 'Noto Serif',
    fontName: '"Noto Serif"',
    fontFamily: '"Noto Serif", Georgia, serif',
    category: 'serif',
    categoryLabel: 'Serif',
    description: 'Universal typographic harmony with classic, balanced proportions',
    previewClass: 'font-["Noto_Serif",Georgia,serif]',
    sampleText: 'The quick brown fox jumps over the lazy dog. 1234567890',
  },
  'crete-round': {
    id: 'crete-round',
    label: 'Crete Round',
    fontName: '"Crete Round"',
    fontFamily: '"Crete Round", Georgia, serif',
    category: 'serif',
    categoryLabel: 'Serif',
    description: 'Contemporary slab serif with rounded serifs and generous proportions',
    previewClass: 'font-["Crete_Round",Georgia,serif]',
    sampleText: 'The quick brown fox jumps over the lazy dog. 1234567890',
  },
};

// Aliases for backward compatibility
FONT_DEFINITIONS['plus-jakarta-sans'] = {
  ...FONT_DEFINITIONS['plus-jakarta'],
  id: 'plus-jakarta-sans' as AppFont,
};

export const FONT_FAMILY_DEFINITIONS = FONT_DEFINITIONS;

export const FONT_CATEGORIES: { id: 'all' | AppFontCategory; label: string; icon: string }[] = [
  { id: 'all', label: 'All Fonts', icon: 'grid_view' },
  { id: 'sans', label: 'Sans-Serif', icon: 'edit' },
  { id: 'serif', label: 'Serif', icon: 'auto_stories' },
  { id: 'display', label: 'Display / Casual', icon: 'brush-01' },
];

/**
 * Normalizes any font key to a valid AppFont key
 */
export function normalizeFontKey(font: string | undefined): AppFont {
  if (!font) return 'plus-jakarta';
  if (font === 'plus-jakarta-sans') return 'plus-jakarta';
  if (FONT_DEFINITIONS[font]) return font as AppFont;
  return 'plus-jakarta';
}

/**
 * Applies the font data-attribute and CSS custom property to document.documentElement
 */
export function applyAppFont(font: AppFont | string) {
  if (typeof document === 'undefined') return;
  const canonicalKey = normalizeFontKey(font);
  const def = FONT_DEFINITIONS[canonicalKey] || FONT_DEFINITIONS['plus-jakarta'];
  
  const root = document.documentElement;
  root.setAttribute('data-font', canonicalKey);
  root.style.setProperty('--app-font-family', def.fontFamily);
  root.style.setProperty('--app-font', def.fontFamily);
}

/**
 * Retrieves the currently active font from localStorage or defaults to Plus Jakarta Sans
 */
export function getStoredAppFont(): AppFont {
  if (typeof window === 'undefined') return 'plus-jakarta';
  try {
    const saved = localStorage.getItem(FONT_STORAGE_KEY);
    if (saved && (FONT_DEFINITIONS[saved] || saved === 'plus-jakarta-sans')) {
      return normalizeFontKey(saved);
    }
  } catch (e) {
    console.warn('Failed to read font preference from localStorage', e);
  }
  return 'plus-jakarta';
}

/**
 * Hook to manage app font selection with reactive sync
 */
export function useFont(initialFont?: AppFont) {
  const [font, setFontState] = useState<AppFont>(() => {
    return initialFont ? normalizeFontKey(initialFont) : getStoredAppFont();
  });

  const setFont = useCallback((nextFont: AppFont) => {
    const normalized = normalizeFontKey(nextFont);
    setFontState(normalized);
    applyAppFont(normalized);
    try {
      localStorage.setItem(FONT_STORAGE_KEY, normalized);
    } catch (e) {
      console.warn('Failed to save font preference to localStorage', e);
    }
  }, []);

  useEffect(() => {
    if (initialFont && normalizeFontKey(initialFont) !== font) {
      setFont(initialFont);
    } else {
      applyAppFont(font);
    }
  }, [initialFont]);

  return { font, setFont, availableFonts: FONT_DEFINITIONS };
}

export default useFont;
