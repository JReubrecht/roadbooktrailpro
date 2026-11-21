'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { ArrowLeft, RotateCcw, Upload } from 'lucide-react';
import BrandLogo from '@/components/brand/BrandLogo';
import { BRAND_CONFIG } from '@/config/brand';
import { usePlatform } from '@/context/PlatformContext';

export default function CoachBrandManagerPage() {
  const {
    currentUser,
    access,
    promoBanner,
    customLogoUrl,
    featureFlags,
    updatePromoBanner,
    setCustomLogoDataUrl,
    updateFeatureFlags,
  } = usePlatform();

  const [badge, setBadge] = useState(promoBanner.badge);
  const [message, setMessage] = useState(promoBanner.message);
  const [ctaLabel, setCtaLabel] = useState(promoBanner.ctaLabel);
  const [ctaHref, setCtaHref] = useState(promoBanner.ctaHref);
  const [enabled, setEnabled] = useState(promoBanner.enabled);
  const [savedMsg, setSavedMsg] = useState<string | null>(null);

  if (!currentUser || !access.isAdmin) {
    return (
      <div className="max-w-xl mx-auto px-4 py-16 text-center space-y-3">
        <h1 className="text-xl font-bold">Accès réservé à l’Administrateur principal</h1>
        <Link href="/coach" className="text-sm font-semibold text-[#FF5A36] underline">
          Retour
        </Link>
      </div>
    );
  }

  const handleLogoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === 'string') {
        setCustomLogoDataUrl(reader.result);
        window.dispatchEvent(new CustomEvent('mykairn:logo-updated'));
        setSavedMsg('Nouveau logo myKairn Coach appliqué en aperçu sur toute la plateforme.');
      }
    };
    reader.readAsDataURL(file);
  };

  const handleSaveBanner = (e: React.FormEvent) => {
    e.preventDefault();
    updatePromoBanner({
      enabled,
      badge,
      message,
      ctaLabel,
      ctaHref,
    });
    setSavedMsg('Bandeau d’annonce mis à jour.');
    setTimeout(() => setSavedMsg(null), 3500);
  };

  const paletteSwatches = [
    { name: 'Ardoise Alpine Profonde', hex: BRAND_CONFIG.palette.slateDeep, usage: 'Titres & Footer' },
    { name: 'Fond Clair Alpin', hex: BRAND_CONFIG.palette.alpineBg, usage: 'Surface générale' },
    { name: 'Orange Kairn', hex: BRAND_CONFIG.palette.kairnOrange, usage: 'CTA & Signaux actifs' },
    { name: 'Vert Sentier', hex: BRAND_CONFIG.palette.trailMint, usage: 'Validation & Progression' },
  ];

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 py-10 space-y-8">
      <Link
        href="/coach"
        className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-500 hover:text-[#0F172A]"
      >
        <ArrowLeft size={14} />
        <span>Retour au Cockpit Coach</span>
      </Link>

      <div className="pb-4 border-b border-slate-200">
        <p className="font-mono text-[10px] uppercase tracking-wider text-[#FF5A36] font-semibold">
          IDENTITÉ VISUELLE &amp; COMMUNICATION
        </p>
        <h1 className="text-3xl font-bold text-[#0F172A] mt-0.5">
          Charte Graphique, Logo &amp; Bandeau Vitrine
        </h1>
      </div>

      {savedMsg && (
        <div className="p-3 rounded-md bg-emerald-50 border-l-2 border-[#14C38E] text-xs font-semibold text-[#047857]">
          {savedMsg}
        </div>
      )}

      {/* Activation Boutique / Vente de Programmes */}
      <section className="bg-white rounded-lg border border-slate-200 p-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="space-y-1">
          <div className="flex items-center gap-2.5">
            <h2 className="text-base font-bold text-[#0F172A]">
              Vente de Programmes d&apos;Entraînement (Boutique &amp; Catalogue)
            </h2>
            <span
              className={`font-mono text-[10px] uppercase tracking-wider px-2 py-0.5 rounded font-bold ${
                featureFlags.programSalesEnabled
                  ? 'bg-emerald-50 text-[#047857] border border-emerald-200'
                  : 'bg-slate-100 text-slate-600 border border-slate-200'
              }`}
            >
              {featureFlags.programSalesEnabled ? 'ACTIVE EN LIGNE' : 'MASQUÉE AU PUBLIC'}
            </span>
          </div>
          <p className="text-xs text-slate-600 max-w-2xl">
            Lorsque cette option est masquée, la vitrine publique met uniquement en avant vos prestations Coaching 1-to-1, Audits de course et Outils gratuits. Vous pouvez continuer à préparer vos plans ou attribuer des accès pilotes depuis le Cockpit.
          </p>
        </div>

        <button
          type="button"
          onClick={() => {
            const nextVal = !featureFlags.programSalesEnabled;
            updateFeatureFlags({ programSalesEnabled: nextVal });
            setSavedMsg(
              nextVal
                ? 'Vente de programmes activée sur le site public.'
                : 'Vente de programmes masquée au public.'
            );
          }}
          className={`px-4 py-2 rounded-md text-xs font-semibold shrink-0 cursor-pointer transition-colors ${
            featureFlags.programSalesEnabled
              ? 'border border-slate-300 bg-white hover:bg-slate-50 text-[#0F172A]'
              : 'bg-[#FF5A36] hover:bg-[#E34A28] text-white'
          }`}
        >
          {featureFlags.programSalesEnabled
            ? 'Masquer la vente de programmes'
            : 'Activer la vente de programmes'}
        </button>
      </section>

      <section className="bg-white rounded-lg border border-slate-200 p-6 space-y-5">
        <h2 className="text-base font-bold text-[#0F172A]">Logo Officiel myKairn Coach</h2>

        <div className="grid grid-cols-1 md:grid-cols-2 border border-slate-200 rounded-md overflow-hidden divide-y md:divide-y-0 md:divide-x divide-slate-200">
          <div className="bg-[#F8FAFC] p-8 flex flex-col items-center justify-center gap-3">
            <span className="font-mono text-[10px] uppercase text-slate-400">Sur fond clair</span>
            <BrandLogo size="lg" theme="light" customSrc={customLogoUrl ?? undefined} />
          </div>
          <div className="bg-[#0F172A] p-8 flex flex-col items-center justify-center gap-3">
            <span className="font-mono text-[10px] uppercase text-slate-500">Sur fond sombre</span>
            <BrandLogo size="lg" theme="dark" customSrc={customLogoUrl ?? undefined} />
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <label className="inline-flex items-center gap-2 px-4 py-2 rounded-md bg-[#FF5A36] hover:bg-[#E34A28] text-white text-xs font-semibold cursor-pointer">
            <Upload size={14} />
            <span>Importer logo définitif (SVG / PNG)</span>
            <input type="file" accept="image/svg+xml,image/png,image/webp" onChange={handleLogoUpload} className="hidden" />
          </label>
          {customLogoUrl && (
            <button
              type="button"
              onClick={() => {
                setCustomLogoDataUrl(null);
                window.dispatchEvent(new CustomEvent('mykairn:logo-updated'));
              }}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-md border border-slate-300 text-xs font-semibold text-slate-700 cursor-pointer"
            >
              <RotateCcw size={14} />
              <span>Revenir au monogramme par défaut</span>
            </button>
          )}
        </div>

        <p className="text-xs text-slate-500 bg-[#F8FAFC] border border-slate-200 rounded-md p-3">
          <strong>Déploiement permanent :</strong> Copiez votre fichier définitif dans{' '}
          <code className="font-mono bg-white px-1.5 py-0.5 border border-slate-200 rounded">
            trail-coaching-platform/public/brand/mykairn-coach-logo.svg
          </code>{' '}
          (ou modifiez <code className="font-mono">customLogoPath</code> dans{' '}
          <code className="font-mono">src/config/brand.ts</code>).
        </p>
      </section>

      <section className="bg-white rounded-lg border border-slate-200 p-6 space-y-4">
        <h2 className="text-base font-bold text-[#0F172A]">Palette « {BRAND_CONFIG.palette.name} »</h2>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          {paletteSwatches.map((swatch) => (
            <div key={swatch.hex} className="rounded-md border border-slate-200 overflow-hidden">
              <div className="h-16 w-full" style={{ backgroundColor: swatch.hex }} />
              <div className="p-3">
                <p className="font-bold text-xs text-[#0F172A]">{swatch.name}</p>
                <p className="font-mono text-xs text-slate-500 mt-0.5">{swatch.hex}</p>
                <p className="text-[11px] text-slate-400 mt-0.5">{swatch.usage}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      <section className="bg-white rounded-lg border border-slate-200 p-6 space-y-4">
        <h2 className="text-base font-bold text-[#0F172A]">Bandeau d&apos;Annonce Vitrine</h2>

        <form onSubmit={handleSaveBanner} className="space-y-4 text-sm">
          <label className="flex items-center gap-2 text-xs font-semibold text-[#0F172A] cursor-pointer">
            <input
              type="checkbox"
              checked={enabled}
              onChange={(e) => setEnabled(e.target.checked)}
              className="h-4 w-4 accent-[#FF5A36]"
            />
            <span>Afficher le bandeau en haut du site</span>
          </label>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block font-mono text-[10px] uppercase text-slate-500 mb-1">Étiquette</label>
              <input
                type="text"
                value={badge}
                onChange={(e) => setBadge(e.target.value)}
                className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm font-mono"
              />
            </div>
            <div>
              <label className="block font-mono text-[10px] uppercase text-slate-500 mb-1">Lien CTA</label>
              <input
                type="text"
                value={ctaHref}
                onChange={(e) => setCtaHref(e.target.value)}
                className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm font-mono"
              />
            </div>
          </div>

          <div>
            <label className="block font-mono text-[10px] uppercase text-slate-500 mb-1">Message</label>
            <input
              type="text"
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
            />
          </div>

          <div>
            <label className="block font-mono text-[10px] uppercase text-slate-500 mb-1">Texte CTA</label>
            <input
              type="text"
              value={ctaLabel}
              onChange={(e) => setCtaLabel(e.target.value)}
              className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
            />
          </div>

          <button
            type="submit"
            className="px-4 py-2 rounded-md bg-[#0F172A] text-white text-xs font-semibold cursor-pointer"
          >
            Mettre à jour
          </button>
        </form>
      </section>
    </div>
  );
}
