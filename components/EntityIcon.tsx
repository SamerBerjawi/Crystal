import React, { useMemo, useState } from 'react';
import { cn } from '../lib/utils';
import Icon from './ui/Icon';
import { useIsDark } from '../hooks/useIsDark';
import { usePreferencesSelector } from '../contexts/DomainProviders';
import { buildEffectiveMerchantLogoOverrides, getMerchantLogoUrl } from '../utils/brandfetch';
import { Account } from '../types';
import { accountIcon } from './AccountCard';

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
  const [loaded, setLoaded] = useState(false);
  const [failed, setFailed] = useState(false);
  const shape = rounded === 'full' ? 'rounded-full' : rounded === 'md' ? 'rounded-[6px]' : 'rounded-[7px]';
  const style = { width: size, height: size };
  const hasImage = Boolean(url && !failed);

  const initial = useMemo(() => {
    const clean = (label || '')
      .replace(/^(Transfer\s+(to|from)|To|From)\s+/i, '')
      .replace(/^[0-9\s#*_\/.\-\\:]+/, '')
      .trim() || label.trim();
    return (clean[0] || label.trim()[0] || '?').toUpperCase();
  }, [label]);

  return (
    <span
      className={cn(
        'relative flex shrink-0 items-center justify-center overflow-hidden bg-inset border border-line shadow-2xs font-bold select-none text-muted',
        shape,
        className,
      )}
      style={style}
      aria-hidden
    >
      {(!hasImage || !loaded) && (
        fallbackIcon ? (
          <Icon name={fallbackIcon} size={Math.round(size * 0.55)} className="text-muted" />
        ) : (
          <span className="text-ink font-bold leading-none" style={{ fontSize: Math.round(size * 0.44) }}>
            {initial}
          </span>
        )
      )}
      {hasImage && (
        <img
          src={url!}
          alt=""
          loading="lazy"
          referrerPolicy="no-referrer"
          onLoad={(e) => {
            const img = e.currentTarget;
            if (img.naturalWidth <= 1 && img.naturalHeight <= 1) {
              setFailed(true);
            } else {
              setLoaded(true);
            }
          }}
          onError={() => setFailed(true)}
          className={cn(
            'size-full object-cover transition-opacity duration-150',
            loaded ? 'opacity-100' : 'opacity-0'
          )}
        />
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

/**
 * A merchant logo on a rounded tile for transaction lists.
 * Shows the Brandfetch / override logo if available.
 * If not configured in merchants, falls back to the account icon.
 * Transfers show an exchange / transfer icon.
 */
export const MerchantLogo: React.FC<{
  merchant?: string | null;
  description?: string | null;
  name?: string | null;
  isTransfer?: boolean;
  size?: number;
  className?: string;
  account?: Account | null;
  fallbackIcon?: string;
}> = ({ merchant, description, name, isTransfer, size = 36, className, account, fallbackIcon }) => {
  const brandfetchClientId = usePreferencesSelector(p => (p.brandfetchClientId || '').trim());
  const merchantLogoOverrides = usePreferencesSelector(p => p.merchantLogoOverrides || {});
  const merchantRules = usePreferencesSelector(p => p.merchantRules || {}) as Record<string, { logo?: string }>;

  const effectiveOverrides = useMemo(() => {
    return buildEffectiveMerchantLogoOverrides(merchantLogoOverrides, merchantRules);
  }, [merchantLogoOverrides, merchantRules]);

  const rawName = (merchant && merchant.toLowerCase() !== 'internal transfer' ? merchant : '')
    || (name && name.toLowerCase() !== 'internal transfer' ? name : '')
    || merchant
    || description
    || name
    || 'Transaction';
  const merchantName = rawName.replace(/^Transfer\s+(to|from)\s+/i, '').trim();

  const logoUrl = useMemo(() => {
    return getMerchantLogoUrl(merchantName, brandfetchClientId, effectiveOverrides, {
      fallback: 'lettermark',
      type: 'icon',
      width: Math.max(size * 2, 80),
      height: Math.max(size * 2, 80),
    });
  }, [merchantName, brandfetchClientId, effectiveOverrides, size]);

  const isTransferTx = isTransfer || /^Transfer\s+(to|from)\s+/i.test(rawName);
  const resolvedFallbackIcon = isTransferTx
    ? 'arrow-data-transfer-horizontal'
    : (fallbackIcon || (rawName === 'Transaction' && account ? accountIcon(account) : undefined));

  return (
    <LogoTile
      url={logoUrl}
      label={merchantName}
      size={size}
      rounded="lg"
      fallbackIcon={resolvedFallbackIcon}
      className={className}
    />
  );
};

