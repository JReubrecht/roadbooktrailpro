'use client';

import React, { useState, useSyncExternalStore } from 'react';
import { BRAND_CONFIG } from '@/config/brand';

interface BrandLogoProps {
  variant?: 'full' | 'mark';
  theme?: 'light' | 'dark';
  size?: 'sm' | 'md' | 'lg';
  customSrc?: string | null;
  className?: string;
}

const SIZE_MAP = {
  sm: { icon: 26, title: 'text-[17px]', sub: 'text-[9px]' },
  md: { icon: 34, title: 'text-xl', sub: 'text-[10px]' },
  lg: { icon: 44, title: 'text-2xl', sub: 'text-[11px]' },
};

function subscribeLogoStorage(callback: () => void) {
  window.addEventListener('storage', callback);
  window.addEventListener('mykairn:logo-updated', callback);
  return () => {
    window.removeEventListener('storage', callback);
    window.removeEventListener('mykairn:logo-updated', callback);
  };
}

function getClientStoredLogo(): string | null {
  try {
    return window.localStorage.getItem('mykairn_custom_logo_dataurl') || BRAND_CONFIG.customLogoPath;
  } catch {
    return BRAND_CONFIG.customLogoPath;
  }
}

/**
 * Logo officiel myKairn Coach — Esthétique géométrique suisse / alpine.
 * Affiche automatiquement `/public/brand/mykairn-coach-logo.svg` ou l'aperçu importé dans `/coach/brand`,
 * sinon un monogramme anguleux à 3 pierres de cairn + courbe de crête topographique.
 */
export default function BrandLogo({
  variant = 'full',
  theme = 'light',
  size = 'md',
  customSrc,
  className = '',
}: BrandLogoProps) {
  const [failedSrc, setFailedSrc] = useState<string | null>(null);
  const storedLogo = useSyncExternalStore(
    subscribeLogoStorage,
    getClientStoredLogo,
    () => null
  );

  const activeCustomUrl = customSrc !== undefined ? customSrc : storedLogo;
  const metrics = SIZE_MAP[size];
  const primaryTextColor = theme === 'dark' ? 'text-white' : 'text-[#0F172A]';
  const showCustomImage = Boolean(activeCustomUrl) && failedSrc !== activeCustomUrl;

  return (
    <div className={`inline-flex items-center gap-2.5 select-none ${className}`}>
      {showCustomImage && activeCustomUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={activeCustomUrl}
          alt={BRAND_CONFIG.appName}
          width={metrics.icon}
          height={metrics.icon}
          onError={() => setFailedSrc(activeCustomUrl)}
          className="rounded-md object-contain shrink-0"
          style={{ width: metrics.icon, height: metrics.icon }}
        />
      ) : (
        <svg
          width={metrics.icon}
          height={metrics.icon}
          viewBox="0 0 64 64"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
          className="shrink-0"
          aria-hidden="true"
        >
          <rect
            width="64"
            height="64"
            rx="8"
            fill={theme === 'dark' ? '#1E293B' : '#0F172A'}
          />
          {/* Ligne de crête fine */}
          <path
            d="M8 48 L22 28 L31 37 L44 17 L56 48"
            stroke="#334155"
            strokeWidth="1.75"
            strokeLinejoin="miter"
          />
          {/* Trois pierres anguleuses du Cairn */}
          <polygon points="27,13 37,13 39,20 25,20" fill="#FF5A36" />
          <polygon points="21,23 43,23 46,32 18,32" fill="#FFFFFF" />
          <polygon points="15,35 49,35 52,45 12,45" fill="#FF5A36" />
          {/* Trace d'altitude sentier */}
          <path
            d="M12 52 L28 52 L36 49 L52 49"
            stroke="#14C38E"
            strokeWidth="2.5"
            strokeLinecap="square"
          />
        </svg>
      )}

      {variant === 'full' && (
        <div className="flex flex-col leading-none">
          <div className="flex items-baseline gap-1.5">
            <span className={`font-bold tracking-[-0.03em] ${metrics.title} ${primaryTextColor}`}>
              my<span className="text-[#FF5A36]">Kairn</span>
            </span>
            <span
              className={`font-mono ${metrics.sub} font-semibold uppercase tracking-[0.18em] ${
                theme === 'dark' ? 'text-slate-300' : 'text-slate-500'
              }`}
            >
              COACH
            </span>
          </div>
          <span
            className={`font-mono text-[9px] uppercase tracking-[0.14em] ${
              theme === 'dark' ? 'text-slate-400' : 'text-slate-400'
            } mt-0.5`}
          >
            Endurance Lab
          </span>
        </div>
      )}
    </div>
  );
}
