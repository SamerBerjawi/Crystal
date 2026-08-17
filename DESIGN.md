---
version: 2.0
name: Crystal
description: Personal Finance Dashboard visual identity & Apple HIG Design System
colors:
  primary: "#fa9a1d"
  primary-50: "#fef8f0"
  primary-100: "#fdeed9"
  primary-200: "#fbddb1"
  primary-300: "#faca89"
  primary-400: "#fcb045"
  primary-500: "#fa9a1d"
  primary-600: "#e78310"
  primary-700: "#c1670e"
  primary-800: "#995111"
  primary-900: "#7d4312"
  semantic-red: "#FF3B30"
  semantic-green: "#34C759"
  semantic-yellow: "#FFCC00"
  semantic-blue: "#007AFF"
  light-bg: "#FAFAFA"
  light-text: "#2D2D2D"
  dark-bg: "#050505"
  dark-text: "#FFFFFF"
typography:
  sans:
    fontFamily: "var(--app-font), 'Plus Jakarta Sans', 'Inter', -apple-system, BlinkMacSystemFont, sans-serif"
geometry:
  badges: "rounded-md (6px) or rounded-lg (8px)"
  controls: "rounded-xl (12px)"
  cards_modals: "rounded-2xl (16px) or rounded-3xl (24px)"
  capsules: "rounded-full"
spacing_grid:
  micro: "gap-1.5 to gap-2, px-2.5 py-0.5 (6px-8px)"
  controls: "px-4 py-2.5 (12px-14px), min 44x44px touch targets"
  cards: "p-4 sm:p-6 (16px-24px)"
  sections: "space-y-6 sm:space-y-8, py-6 sm:py-8 (24px-48px)"
---

## Overview

The Crystal Personal Finance Dashboard offers a sleek, modern, and data-dense UI for managing financial metrics. It utilizes high contrast between vibrant primary accents and sleek dark/light themes, heavily employing an authentic Apple HIG frosted Glassmorphism interface.

## Colors & Surface Architecture

- **Primary (#FA9A1D):** An energetic warm gold/amber driving interaction points, representing growth and capital flow.
- **Light Theme Canvas:** `#FAFAFA` with dark charcoal text (`#2D2D2D`) conveying clean elegance for daylight usage.
- **Dark Theme Canvas:** `#050505` with high-contrast bright text (`#FFFFFF`), tailored specifically for power-user financial reviews.
- **Semantic Signals:** Red (`#FF3B30`), Green (`#34C759`), Yellow (`#FFCC00`), Blue (`#007AFF`).

## Typography (Apple HIG Hierarchy)

Crystal supports dynamic switching between **Plus Jakarta Sans** and **Inter** with clean system fallbacks:
- **Large Title / Title 1 (H1):** `text-2xl md:text-4xl font-bold tracking-tight leading-tight` (Page headers)
- **Title 2 (H2):** `text-xl md:text-2xl font-semibold tracking-tight leading-snug` (Section headers, modal titles)
- **Title 3 (H3):** `text-lg font-semibold leading-snug` (Card titles, widget headers)
- **Headline / Subsection (H4):** `text-base font-semibold leading-snug` (Subsection headers)
- **Subhead / Subtitle:** `text-sm md:text-base font-normal leading-normal text-light-text-secondary dark:text-dark-text-secondary`
- **Body:** `text-base font-normal leading-relaxed text-light-text dark:text-dark-text` (or `text-sm` for compact UI data)
- **Footnote / Caption:** `text-xs font-medium text-light-text-secondary dark:text-dark-text-secondary`
- **Kicker / Eyebrow:** `text-xs font-semibold uppercase tracking-wider text-light-text-secondary dark:text-dark-text-secondary`

## Spatial Rhythm & Geometry (8pt / 4pt Scale)

- **Corner Radii Hierarchy:**
  - `rounded-md` / `rounded-lg`: Micro-badges, indicators, inner icons.
  - `rounded-xl`: Buttons, inputs, dropdown menus, search triggers.
  - `rounded-2xl` / `rounded-3xl`: Primary cards, widget containers, sheet dialogues (`rounded-t-[28px] md:rounded-3xl`).
  - `rounded-full`: Action pills, status chips, floating action capsules.
- **Touch Targets:** Minimum `44x44px` (`min-h-[44px] min-w-[44px]`) on interactive buttons and mobile elements.

## Frosted Glassmorphism Surfaces

- **Canvas & Navigation Bars:** `bg-white/75 dark:bg-dark-card/85 backdrop-blur-xl border-b border-black/5 dark:border-white/10`
- **Glass Cards (`ios-regular` / `glass-card`):** `bg-white/60 dark:bg-dark-card/70 backdrop-blur-xl border border-black/5 dark:border-white/10 shadow-card`
- **Elevated Overlays & Modals:** `bg-white/90 dark:bg-dark-card/90 backdrop-blur-2xl border border-black/10 dark:border-white/10 shadow-modal`
- **Backdrops:** `bg-gray-900/50 dark:bg-black/80 backdrop-blur-md`
- **Hairline Reflex Highlights:** `shadow-[inset_0_1px_0_0_rgba(255,255,255,0.1)]` in dark mode to simulate real glass edge reflection.
