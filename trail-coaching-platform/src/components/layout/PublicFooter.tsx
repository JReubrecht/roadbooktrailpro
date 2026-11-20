'use client';

import React from 'react';
import Link from 'next/link';
import BrandLogo from '@/components/brand/BrandLogo';
import { BRAND_CONFIG } from '@/config/brand';
import { usePlatform } from '@/context/PlatformContext';

/**
 * Footer du site public vitrine & outils gratuits.
 */
export default function PublicFooter() {
  const { customLogoUrl, featureFlags } = usePlatform();

  const reopenCookieModal = () => {
    window.dispatchEvent(new CustomEvent('mykairn:open-cookie-preferences'));
  };

  return (
    <footer className="bg-[#0F172A] text-slate-400 border-t border-slate-800 no-print mt-20">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-14 grid grid-cols-1 md:grid-cols-12 gap-10">
        <div className="md:col-span-5 space-y-4">
          <BrandLogo theme="dark" size="sm" customSrc={customLogoUrl ?? undefined} />
          <p className="text-xs text-slate-400 leading-relaxed max-w-sm">
            Coaching trail &amp; ultra-endurance fondé sur l&apos;analyse physiologique multi-sources, la modélisation métabolique du dénivelé et l&apos;individualisation de terrain.
          </p>
          <p className="font-mono text-[11px] text-slate-500">
            {BRAND_CONFIG.legal.businessName} · {BRAND_CONFIG.legal.professionalCard}
          </p>
        </div>

        <div className="md:col-span-2">
          <h3 className="font-mono text-[11px] uppercase tracking-wider text-white mb-4">
            Outils Gratuits
          </h3>
          <ul className="space-y-2.5 text-xs">
            <li>
              <Link href="/tools" className="hover:text-white transition-colors">
                Roadbook GPX Express
              </Link>
            </li>
            <li>
              <Link href="/tools#pacing-calc" className="hover:text-white transition-colors">
                Calculateur Km-Effort
              </Link>
            </li>
            <li>
              <Link href="/tools#nutrition-sim" className="hover:text-white transition-colors">
                Simulateur Nutrition
              </Link>
            </li>
          </ul>
        </div>

        <div className="md:col-span-2">
          <h3 className="font-mono text-[11px] uppercase tracking-wider text-white mb-4">
            Offres &amp; Accès
          </h3>
          <ul className="space-y-2.5 text-xs">
            <li>
              <Link href="/#offres-coaching" className="hover:text-white transition-colors">
                Coaching &amp; Pack Jour J
              </Link>
            </li>
            <li>
              <Link href="/#methode-coach" className="hover:text-white transition-colors">
                Le Coach &amp; la Méthode
              </Link>
            </li>
            <li>
              <Link href="/#faq" className="hover:text-white transition-colors">
                Questions Fréquentes (FAQ)
              </Link>
            </li>
            {featureFlags.programSalesEnabled && (
              <li>
                <Link href="/catalog" className="hover:text-white transition-colors">
                  Plans d&apos;Entraînement
                </Link>
              </li>
            )}
            <li>
              <Link href="/login" className="hover:text-[#14C38E] transition-colors">
                Portail Abonnés
              </Link>
            </li>
          </ul>
        </div>

        <div className="md:col-span-3">
          <h3 className="font-mono text-[11px] uppercase tracking-wider text-white mb-4">
            Conformité &amp; RGPD
          </h3>
          <ul className="space-y-2.5 text-xs">
            <li>
              <Link href="/legal/mentions-legales" className="hover:text-white transition-colors">
                Mentions Légales (LCEN)
              </Link>
            </li>
            <li>
              <Link href="/legal/confidentialite" className="hover:text-white transition-colors">
                Confidentialité &amp; Données Physio
              </Link>
            </li>
            <li>
              <Link href="/legal/cgv-cgu" className="hover:text-white transition-colors">
                CGV / CGU
              </Link>
            </li>
            <li>
              <button
                type="button"
                onClick={reopenCookieModal}
                className="text-left text-slate-400 hover:text-white underline underline-offset-4 cursor-pointer"
              >
                Préférences cookies
              </button>
            </li>
          </ul>
        </div>
      </div>

      <div className="border-t border-slate-800 py-5 px-4 sm:px-6">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 text-[11px] text-slate-500">
          <span className="font-mono">
            &copy; {new Date().getFullYear()} {BRAND_CONFIG.appName} · {BRAND_CONFIG.legal.siret}
          </span>
          <span>
            Pratique sportive en montagne : vérifiez votre aptitude médicale (PPS / certificat) avant toute compétition.
          </span>
        </div>
      </div>
    </footer>
  );
}
