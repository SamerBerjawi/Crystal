import React, { useMemo, useState } from 'react';
import { cn } from '../lib/utils';
import Icon from './ui/Icon';
import { useIsDark } from '../hooks/useIsDark';

/**
 * Adapts hex colors for optimal contrast in dark and light modes.
 * Ensures dark colors are readable against dark backgrounds,
 * and pale pastel colors are readable against light backgrounds.
 */
export const adaptColorForTheme = (hexColor: string | undefined, isDark: boolean): string | undefined => {
  if (!hexColor || typeof hexColor !== 'string' || !hexColor.startsWith('#')) return hexColor;
  let hex = hexColor.slice(1);
  if (hex.length === 3) hex = hex.split('').map(c => c + c).join('');
  if (hex.length !== 6) return hexColor;

  const r = parseInt(hex.slice(0, 2), 16);
  const g = parseInt(hex.slice(2, 4), 16);
  const b = parseInt(hex.slice(4, 6), 16);

  // sRGB relative luminance
  const lum = (0.299 * r + 0.587 * g + 0.114 * b) / 255;

  if (isDark && lum < 0.35) {
    // Lift dark colors so they stand out crisply on dark backgrounds
    const factor = (0.48 - lum) / (1 - lum);
    const newR = Math.min(255, Math.round(r + (255 - r) * factor));
    const newG = Math.min(255, Math.round(g + (255 - g) * factor));
    const newB = Math.min(255, Math.round(b + (255 - b) * factor));
    return `#${newR.toString(16).padStart(2, '0')}${newG.toString(16).padStart(2, '0')}${newB.toString(16).padStart(2, '0')}`;
  }

  if (!isDark && lum > 0.78) {
    // Deepen very light colors so they are clearly legible on light backgrounds
    const factor = 0.65 / lum;
    const newR = Math.round(r * factor);
    const newG = Math.round(g * factor);
    const newB = Math.round(b * factor);
    return `#${newR.toString(16).padStart(2, '0')}${newG.toString(16).padStart(2, '0')}${newB.toString(16).padStart(2, '0')}`;
  }

  return hexColor;
};

/**
 * A logo on a rounded tile. The image completely fills the tile (object-cover)
 * with no empty space around it.
 */
export const LogoTile: React.FC<{
  url?: string | null;
  label: string;
  size?: number;
  rounded?: 'full' | 'lg' | 'md';
  fallbackIcon?: string;
  className?: string;
}> = ({ url, label, size = 26, rounded = 'lg', fallbackIcon, className }) => {
  const [failed, setFailed] = useState(false);
  const isDark = useIsDark();
  const shape = rounded === 'full' ? 'rounded-full' : rounded === 'md' ? 'rounded-[6px]' : 'rounded-[7px]';
  const style = { width: size, height: size };

  if (url && !failed) {
    return (
      <span
        className={cn('flex shrink-0 items-center justify-center overflow-hidden bg-white shadow-2xs', shape, className)}
        style={style}
        aria-hidden
      >
        <img
          src={url}
          alt=""
          loading="lazy"
          onError={() => setFailed(true)}
          className="size-full object-cover"
        />
      </span>
    );
  }

  return (
    <span
      className={cn(
        'flex shrink-0 items-center justify-center border font-bold select-none',
        isDark ? 'bg-white/10 border-white/10 text-muted' : 'bg-black/5 border-black/10 text-muted',
        shape,
        className,
      )}
      style={style}
      aria-hidden
    >
      {fallbackIcon ? (
        <Icon name={fallbackIcon} size={Math.round(size * 0.55)} />
      ) : (
        <span className="text-ink" style={{ fontSize: Math.round(size * 0.44) }}>
          {(label.trim()[0] || '?').toUpperCase()}
        </span>
      )}
    </span>
  );
};

/**
 * A category icon or tag glyph:
 * - Outline icon in the entity's adapted color (no background box), or
 * - Bold single letter in the entity's adapted color if no icon is specified.
 */
export const EntityGlyph: React.FC<{
  icon?: string;
  label: string;
  color?: string;
  size?: number;
  className?: string;
}> = ({ icon, label, color, size = 18, className }) => {
  const isDark = useIsDark();
  const adaptedColor = useMemo(() => adaptColorForTheme(color, isDark), [color, isDark]);

  if (icon && icon !== 'tag' && icon !== 'category') {
    return (
      <span className={cn('flex shrink-0 items-center justify-center', className)} style={{ width: size, height: size }} aria-hidden>
        <Icon name={icon} size={size} style={{ color: adaptedColor || 'currentColor' }} />
      </span>
    );
  }

  const letter = (label.trim()[0] || '?').toUpperCase();
  return (
    <span
      className={cn('flex shrink-0 items-center justify-center font-bold leading-none select-none', className)}
      style={{
        width: size,
        height: size,
        fontSize: Math.round(size * 0.8),
        color: adaptedColor || 'currentColor',
      }}
      aria-hidden
    >
      {letter}
    </span>
  );
};

