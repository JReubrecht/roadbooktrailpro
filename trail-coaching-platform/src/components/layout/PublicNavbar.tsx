'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { ArrowRight, Menu, X } from 'lucide-react';
import BrandLogo from '@/components/brand/BrandLogo';
import { usePlatform } from '@/context/PlatformContext';

/**
 * Barre de navigation strictement réservée au site public (Vitrine, Outils Gratuits, Catalogue).
 * Aucun lien ou onglet interne Coach / Abonné n'y est exposé aux visiteurs.
 */
export default function PublicNavbar() {
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [bannerDismissed, setBannerDismissed] = useState(false);
  const { currentUser, access, promoBanner, customLogoUrl, featureFlags } = usePlatform();

  const publicLinks = [
    { href: '/', label: 'Coaching & Offres' },
    { href: '/tools', label: 'Outils Gratuits' },
    { href: '/#methode-coach', label: 'Méthode' },
    { href: '/#faq', label: 'FAQ' },
    ...(featureFlags.programSalesEnabled ? [{ href: '/catalog', label: 'Plans Trail' }] : []),
  ];

  const isActive = (href: string) => {
    if (href.includes('#')) return false;
    return href === '/' ? pathname === '/' : pathname?.startsWith(href);
  };

  const memberDestination = access.canAccessCoachDashboard ? '/coach' : '/athlete';

  return (
    <div className="sticky top-0 z-40 no-print">
      {/* Bandeau promotionnel vitrine (site public uniquement) */}
      {promoBanner.enabled && !bannerDismissed && (
        <div className="bg-[#0F172A] text-slate-200 px-4 py-2 text-xs border-b border-slate-800">
          <div className="max-w-7xl mx-auto flex items-center justify-between gap-4">
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mx-auto text-center">
              <span className="font-mono text-[10px] uppercase tracking-[0.14em] text-[#FF5A36] font-semibold">
                [{promoBanner.badge}]
              </span>
              <span>{promoBanner.message}</span>
              <Link
                href={promoBanner.ctaHref}
                className="font-semibold text-white underline decoration-[#14C38E] underline-offset-4 hover:text-[#34D399] whitespace-nowrap"
              >
                {promoBanner.ctaLabel}
              </Link>
            </div>
            <button
              type="button"
              onClick={() => setBannerDismissed(true)}
              className="text-slate-500 hover:text-slate-200 p-0.5 shrink-0 cursor-pointer"
              aria-label="Masquer l'annonce"
            >
              <X size={14} />
            </button>
          </div>
        </div>
      )}

      {/* Header Public */}
      <header className="bg-white/95 backdrop-blur-sm border-b border-slate-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between gap-6">
          <div className="flex items-center gap-8">
            <Link href="/" className="shrink-0">
              <BrandLogo size="sm" customSrc={customLogoUrl ?? undefined} />
            </Link>

            <nav className="hidden md:flex items-center gap-6 h-16">
              {publicLinks.map((item) => {
                const active = isActive(item.href);
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={`relative h-full inline-flex items-center text-[13px] font-semibold tracking-tight transition-colors ${
                      active
                        ? 'text-[#0F172A] border-b-2 border-[#FF5A36]'
                        : 'text-slate-500 hover:text-[#0F172A] border-b-2 border-transparent'
                    }`}
                  >
                    {item.label}
                  </Link>
                );
              })}
            </nav>
          </div>

          <div className="hidden md:flex items-center gap-3">
            {currentUser ? (
              <Link
                href={memberDestination}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-md bg-[#0F172A] hover:bg-[#FF5A36] text-white text-xs font-semibold transition-colors"
              >
                <span>Mon espace</span>
                <ArrowRight size={14} />
              </Link>
            ) : (
              <>
                <Link
                  href="/login"
                  className="px-3.5 py-2 rounded-md text-xs font-semibold text-slate-600 hover:text-[#0F172A] transition-colors"
                >
                  Espace Membre
                </Link>
                <Link
                  href="/#contact-bilan"
                  className="px-4 py-2 rounded-md bg-[#0F172A] hover:bg-[#FF5A36] text-white text-xs font-semibold transition-colors"
                >
                  Échange 15 min
                </Link>
              </>
            )}
          </div>

          <button
            type="button"
            onClick={() => setMobileOpen(!mobileOpen)}
            className="md:hidden p-2 rounded-md border border-slate-200 text-slate-700"
            aria-label="Menu"
          >
            {mobileOpen ? <X size={18} /> : <Menu size={18} />}
          </button>
        </div>

        {/* Menu Mobile Public */}
        {mobileOpen && (
          <div className="md:hidden border-t border-slate-200 bg-white px-4 py-4 space-y-2">
            {publicLinks.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                onClick={() => setMobileOpen(false)}
                className={`block px-3 py-2 rounded-md text-sm font-semibold ${
                  isActive(item.href)
                    ? 'bg-slate-100 text-[#0F172A] border-l-2 border-[#FF5A36]'
                    : 'text-slate-600 hover:bg-slate-50'
                }`}
              >
                {item.label}
              </Link>
            ))}
            <div className="pt-2 border-t border-slate-100 flex flex-col gap-2">
              <Link
                href={currentUser ? memberDestination : '/login'}
                onClick={() => setMobileOpen(false)}
                className="block text-center py-2.5 rounded-md bg-[#0F172A] text-white text-sm font-semibold"
              >
                {currentUser ? 'Accéder à Mon Espace' : 'Connexion Espace Membre'}
              </Link>
            </div>
          </div>
        )}
      </header>
    </div>
  );
}
