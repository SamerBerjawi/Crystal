import { useState, useEffect, useCallback } from 'react';
import { AppFont } from '../types';

export const FONT_STORAGE_KEY = 'crystal_font';

export const FONT_FAMILY_DEFINITIONS: Record<AppFont, { label: string; fontName: string; description: string; previewClass: string }> = {
  'plus-jakarta-sans': {
    label: 'Plus Jakarta Sans',
    fontName: '"Plus Jakarta Sans"',
    description: 'Modern geometric sans-serif with friendly curves and high legibility',
    previewClass: 'font-["Plus_Jakarta_Sans",sans-serif]',
  },
  'inter': {
    label: 'Inter',
    fontName: '"Inter"',
    description: 'Precise, neutral Swiss-style neo-grotesque optimized for data & interfaces',
    previewClass: 'font-["Inter",sans-serif]',
  },
};

/**
 * Applies the font data-attribute and CSS custom property to document.documentElement
 */
export function applyAppFont(font: AppFont) {
  if (typeof document === 'undefined') return;
  const root = document.documentElement;
  root.setAttribute('data-font', font);
  if (font === 'inter') {
    root.style.setProperty(
      '--app-font',
      '"Inter", -apple-system, BlinkMacSystemFont, "SF Pro Text", "SF Pro Display", "SF Pro", sans-serif'
    );
  } else {
    root.style.setProperty(
      '--app-font',
      '"Plus Jakarta Sans", -apple-system, BlinkMacSystemFont, "SF Pro Text", "SF Pro Display", "SF Pro", sans-serif'
    );
  }
}

/**
 * Retrieves the currently active font from localStorage or defaults to Plus Jakarta Sans
 */
export function getStoredAppFont(): AppFont {
  if (typeof window === 'undefined') return 'plus-jakarta-sans';
  try {
    const saved = localStorage.getItem(FONT_STORAGE_KEY) as AppFont | null;
    if (saved === 'inter' || saved === 'plus-jakarta-sans') {
      return saved;
    }
  } catch (e) {
    console.warn('Failed to read font preference from localStorage', e);
  }
  return 'plus-jakarta-sans';
}

/**
 * Hook to manage app font selection with reactive sync
 */
export function useFont(initialFont?: AppFont) {
  const [font, setFontState] = useState<AppFont>(() => {
    return initialFont || getStoredAppFont();
  });

  const setFont = useCallback((nextFont: AppFont) => {
    setFontState(nextFont);
    applyAppFont(nextFont);
    try {
      localStorage.setItem(FONT_STORAGE_KEY, nextFont);
    } catch (e) {
      console.warn('Failed to save font preference to localStorage', e);
    }
  }, []);

  useEffect(() => {
    if (initialFont && initialFont !== font) {
      setFont(initialFont);
    } else {
      applyAppFont(font);
    }
  }, [initialFont]);

  return { font, setFont, availableFonts: FONT_FAMILY_DEFINITIONS };
}

export default useFont;
