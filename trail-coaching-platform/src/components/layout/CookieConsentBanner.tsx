'use client';

import React, { useEffect, useState, useSyncExternalStore } from 'react';
import Link from 'next/link';
import { X } from 'lucide-react';

const COOKIE_PREF_KEY = 'mykairn_rgpd_cookie_consent_v1';

interface CookiePrefs {
  essential: true;
  analytics: boolean;
  decidedAt: string;
}

function subscribeCookieStorage(callback: () => void) {
  window.addEventListener('storage', callback);
  window.addEventListener('mykairn:cookie-saved', callback);
  return () => {
    window.removeEventListener('storage', callback);
    window.removeEventListener('mykairn:cookie-saved', callback);
  };
}

function getCookiePrefSnapshot(): string | null {
  try {
    return window.localStorage.getItem(COOKIE_PREF_KEY);
  } catch {
    return null;
  }
}

export default function CookieConsentBanner() {
  const savedRaw = useSyncExternalStore(
    subscribeCookieStorage,
    getCookiePrefSnapshot,
    () => 'SSR_PENDING'
  );

  const [forceOpen, setForceOpen] = useState(false);
  const [showCustomize, setShowCustomize] = useState(false);
  const [analyticsEnabled, setAnalyticsEnabled] = useState(false);

  useEffect(() => {
    const handleReopen = () => {
      try {
        const current = window.localStorage.getItem(COOKIE_PREF_KEY);
        if (current) {
          const parsed = JSON.parse(current) as CookiePrefs;
          setAnalyticsEnabled(Boolean(parsed.analytics));
        }
      } catch {
        // ignore
      }
      setForceOpen(true);
      setShowCustomize(true);
    };
    window.addEventListener('mykairn:open-cookie-preferences', handleReopen);
    return () => window.removeEventListener('mykairn:open-cookie-preferences', handleReopen);
  }, []);

  const savePreferences = (analytics: boolean) => {
    const prefs: CookiePrefs = {
      essential: true,
      analytics,
      decidedAt: new Date().toISOString(),
    };
    try {
      window.localStorage.setItem(COOKIE_PREF_KEY, JSON.stringify(prefs));
      window.dispatchEvent(new CustomEvent('mykairn:cookie-saved'));
    } catch {
      // ignore
    }
    setAnalyticsEnabled(analytics);
    setForceOpen(false);
    setShowCustomize(false);
  };

  const visible = forceOpen || savedRaw === null;
  if (!visible) return null;

  return (
    <div
      role="dialog"
      aria-label="Gestion des cookies et vie privée"
      className="fixed bottom-4 right-4 left-4 sm:left-auto z-50 max-w-md bg-white rounded-lg shadow-xl border border-slate-300 p-5 no-print"
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="font-mono text-[10px] uppercase tracking-wider text-slate-400">
            Conformité RGPD / CNIL
          </p>
          <h4 className="text-sm font-bold text-[#0F172A] mt-0.5">
            Gestion des traceurs &amp; confidentialité
          </h4>
        </div>
        <button
          type="button"
          onClick={() => savePreferences(false)}
          className="text-slate-400 hover:text-slate-700 p-0.5 cursor-pointer"
          aria-label="Continuer sans accepter"
        >
          <X size={15} />
        </button>
      </div>

      <p className="text-xs text-slate-600 mt-2 leading-relaxed">
        Seuls les traceurs techniques indispensables aux roadbooks et à la session sont actifs par défaut. Vos données physiologiques et clés de connexion sont chiffrées en AES-256-GCM.{' '}
        <Link href="/legal/confidentialite" className="text-[#0F172A] underline font-semibold">
          Politique de confidentialité
        </Link>
        .
      </p>

      {showCustomize && (
        <div className="mt-3 pt-3 border-t border-slate-200 space-y-2 text-xs">
          <div className="flex items-center justify-between py-1">
            <span className="font-semibold text-[#0F172A]">Traceurs essentiels</span>
            <span className="font-mono text-[11px] text-[#14C38E] font-semibold">REQUIS</span>
          </div>
          <label className="flex items-center justify-between py-1 cursor-pointer">
            <span className="font-semibold text-[#0F172A]">Statistiques anonymes</span>
            <input
              type="checkbox"
              checked={analyticsEnabled}
              onChange={(e) => setAnalyticsEnabled(e.target.checked)}
              className="h-4 w-4 accent-[#FF5A36] cursor-pointer"
            />
          </label>
        </div>
      )}

      <div className="mt-4 flex flex-wrap items-center justify-end gap-2">
        <button
          type="button"
          onClick={() => savePreferences(false)}
          className="px-3 py-1.5 rounded-md border border-slate-300 text-xs font-semibold text-slate-700 hover:bg-slate-50 cursor-pointer"
        >
          Refuser
        </button>
        {showCustomize ? (
          <button
            type="button"
            onClick={() => savePreferences(analyticsEnabled)}
            className="px-3.5 py-1.5 rounded-md bg-[#0F172A] text-white text-xs font-semibold hover:bg-slate-800 cursor-pointer"
          >
            Enregistrer
          </button>
        ) : (
          <button
            type="button"
            onClick={() => setShowCustomize(true)}
            className="px-3 py-1.5 rounded-md border border-slate-300 text-xs font-semibold text-slate-700 hover:bg-slate-50 cursor-pointer"
          >
            Personnaliser
          </button>
        )}
        <button
          type="button"
          onClick={() => savePreferences(true)}
          className="px-3.5 py-1.5 rounded-md bg-[#FF5A36] text-white text-xs font-semibold hover:bg-[#E34A28] cursor-pointer"
        >
          Accepter
        </button>
      </div>
    </div>
  );
}
