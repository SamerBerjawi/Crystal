---
version: alpha
name: Crystal
description: Personal Finance Dashboard visual identity
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
    fontFamily: "-apple-system, BlinkMacSystemFont, 'SF Pro Text', 'SF Pro Display', 'SF Pro', system-ui, sans-serif"
rounded:
  xl: 16px
spacing:
  sm: 8px
  md: 16px
---

## Overview

The Crystal Personal Finance Dashboard offers a sleek, modern, and data-dense UI for managing financial metrics. It utilizes a striking contrast between vibrant primary accents and dark mode backgrounds, heavily employing an elegant frosted Glassmorphism interface. 

## Colors

The application relies on highly visible interaction endpoints and crystal clear status signals.

- **Primary (#FA9A1D):** An energetic orange driving interaction points, representing growth and the flow of capital.
- **Light Theme Framework:** A soft background (`#FAFAFA`) with dark charcoal text (`#2D2D2D`) conveying quiet elegance for daylight usage.
- **Dark Theme Framework:** Near-absolute darkness (`#050505`) with high-contrast bright text (`#FFFFFF`), tailored specifically for power-user financial reviews.
- **Semantic Suite:** Core status reflections (Red: `#FF3B30`, Green: `#34C759`) directly model real-world financial signals and accounting practices.

## Typography (Apple HIG Hierarchy)

Crystal adheres to **Apple's Human Interface Guidelines (HIG)** typography hierarchy, leveraging Apple's native San Francisco system font stack (`-apple-system`, `SF Pro Display`, `SF Pro Text`):
- **Large Title / Title 1 (H1):** `text-2xl md:text-4xl font-bold tracking-tight leading-tight` (Page headers)
- **Title 2 (H2):** `text-xl md:text-2xl font-semibold tracking-tight leading-snug` (Section headers, modal titles)
- **Title 3 (H3):** `text-lg font-semibold leading-snug` (Card titles, widget headers)
- **Headline / Subsection (H4):** `text-base font-semibold leading-snug` (Subsection headers)
- **Subhead / Subtitle:** `text-sm md:text-base font-normal leading-normal text-light-text-secondary dark:text-dark-text-secondary`
- **Body:** `text-base font-normal leading-relaxed text-light-text dark:text-dark-text` (or `text-sm` for compact UI data)
- **Footnote / Caption:** `text-xs font-medium text-light-text-secondary dark:text-dark-text-secondary`
- **Kicker / Eyebrow:** `text-xs font-semibold uppercase tracking-wider text-light-text-secondary dark:text-dark-text-secondary`

## Structure and Geometry

Structure leans away from severe technical layouts, favoring organic material imitations.

- Heavy usage of rounded corners (16px standard limit) and fluid drop-shadows soften the dashboard structure.
- Depth is achieved via clean `backdrop-filter: blur(16px)` glassmorphism panels, translucent card bases, subtle borders, and soft ambient drop shadows.
