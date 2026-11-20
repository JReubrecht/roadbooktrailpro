import type { Metadata } from 'next';
import Image from 'next/image';
import Link from 'next/link';
import { ArrowRight, ArrowUpRight, Calendar, CheckCircle2 } from 'lucide-react';
import { BRAND_CONFIG } from '@/config/brand';
import HomeOffersSection from '@/components/public/HomeOffersSection';
import HomePilotsShowcase from '@/components/public/HomePilotsShowcase';
import HomeContactSection from '@/components/public/HomeContactSection';

export const metadata: Metadata = {
  title: `${BRAND_CONFIG.appName} — Coaching Trail & Ultra, Audits & Outils GPX`,
  description:
    'Coaching trail et ultra-endurance 1-to-1 basé sur l’analyse multi-sources de vos données (Garmin, Coros, Suunto, Polar, Strava, FIT/GPX), audits de course et calculateur km-effort Minetti gratuit.',
  alternates: {
    canonical: '/',
  },
  openGraph: {
    type: 'website',
    locale: 'fr_FR',
    url: `${BRAND_CONFIG.siteUrl}/`,
    siteName: BRAND_CONFIG.appName,
    title: `${BRAND_CONFIG.appName} — Coaching Trail & Ultra, Audits & Outils GPX`,
    description:
      'Préparation trail & ultra guidée par vos données physiologiques (CTL/ATL/TSB/HRV) quelle que soit votre source, avec outils scientifiques GPX/Nutrition en accès libre.',
    images: [
      {
        url: '/images/alpine-hero.jpg',
        alt: 'Traileur sur une crête alpine au lever du jour',
      },
    ],
  },
};

export default function HomePage() {
  const { booking, coachProfile, faqItems, legal, siteUrl, appName } = BRAND_CONFIG;
  const discoveryHref = booking.discoveryCallUrl || '#contact-bilan';
  const hasExternalBooking = Boolean(booking.discoveryCallUrl);

  const jsonLd = {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'WebSite',
        '@id': `${siteUrl}/#website`,
        url: siteUrl,
        name: appName,
        inLanguage: 'fr-FR',
        description: BRAND_CONFIG.tagline,
      },
      {
        '@type': 'ProfessionalService',
        '@id': `${siteUrl}/#service`,
        name: appName,
        url: siteUrl,
        image: `${siteUrl}/images/alpine-hero.jpg`,
        email: legal.contactEmail,
        areaServed: ['FR', 'CH', 'BE'],
        serviceType: 'Coaching Trail & Ultra-Endurance en ligne',
        hasOfferCatalog: {
          '@type': 'OfferCatalog',
          name: 'Offres de coaching trail myKairn Coach',
          itemListElement: [
            {
              '@type': 'Offer',
              name: 'Coaching Individuel Trail & Ultra 1-to-1',
              price: '129',
              priceCurrency: 'EUR',
              availability: 'https://schema.org/InStock',
              url: `${siteUrl}/#offres-coaching`,
            },
            {
              '@type': 'Offer',
              name: 'Pack Stratégie Jour J & Roadbook Sur-Mesure',
              price: '89',
              priceCurrency: 'EUR',
              availability: 'https://schema.org/InStock',
              url: `${siteUrl}/#offres-coaching`,
            },
          ],
        },
      },
      {
        '@type': 'FAQPage',
        '@id': `${siteUrl}/#faq`,
        mainEntity: faqItems.map((item) => ({
          '@type': 'Question',
          name: item.question,
          acceptedAnswer: {
            '@type': 'Answer',
            text: item.answer,
          },
        })),
      },
    ],
  };

  return (
    <div className="pb-12">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify(jsonLd).replace(/</g, '\\u003c'),
        }}
      />

      {/* HERO ÉDITORIAL LUMINEUX */}
      <section className="bg-[#F8FAFC] bg-topo-lines border-b border-slate-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-14 sm:py-20 grid grid-cols-1 lg:grid-cols-12 gap-10 lg:gap-12 items-center">
          <div className="lg:col-span-6 space-y-6">
            <p className="font-mono text-[11px] uppercase tracking-[0.16em] text-slate-500">
              45°55&apos;N 06°52&apos;E &mdash; COACHING TRAIL &amp; ULTRA · ANALYSE MULTI-SOURCES
            </p>

            <h1 className="text-4xl sm:text-5xl font-bold tracking-[-0.03em] text-[#0F172A] leading-[1.06]">
              Préparation Trail &amp; Ultra guidée par la donnée terrain.
            </h1>

            <p className="text-base text-slate-600 max-w-xl leading-relaxed">
              Accompagnement individuel basé sur l&apos;analyse de vos données d&apos;entraînement (toutes montres et plateformes), modélisation scientifique de vos roadbooks (Minetti 2002, SunCalc, seuils marche/course) et outils gratuits en accès libre.
            </p>

            <div className="space-y-3 pt-1">
              <div className="flex flex-wrap items-center gap-3">
                <a
                  href="#offres-coaching"
                  className="inline-flex items-center gap-2 px-5 py-3 rounded-md bg-[#FF5A36] hover:bg-[#E34A28] text-white font-semibold text-sm transition-colors"
                >
                  <span>Découvrir les formules</span>
                  <ArrowRight size={16} />
                </a>
                <Link
                  href="/tools"
                  className="inline-flex items-center gap-2 px-5 py-3 rounded-md bg-white hover:bg-slate-50 border border-slate-300 text-[#0F172A] font-semibold text-sm transition-colors"
                >
                  <span>Outils Trail Gratuits</span>
                  <ArrowUpRight size={16} className="text-slate-400" />
                </Link>
              </div>

              <div>
                <a
                  href={discoveryHref}
                  target={hasExternalBooking ? '_blank' : undefined}
                  rel={hasExternalBooking ? 'noopener noreferrer' : undefined}
                  className="inline-flex items-center gap-2 text-xs font-semibold text-[#0F172A] hover:text-[#FF5A36] transition-colors"
                >
                  <Calendar size={13} className="text-[#14C38E]" />
                  <span>
                    Échange découverte {booking.discoveryCallDurationMin} min (Coaching 1-to-1) &rarr;
                  </span>
                </a>
              </div>
            </div>

            {/* Barre télémétrique sobre */}
            <div className="pt-6 border-t border-slate-200 grid grid-cols-3 gap-6 max-w-lg">
              <div>
                <p className="font-mono text-lg font-bold text-[#0F172A] tabular-nums">CTL · TSB</p>
                <p className="text-xs text-slate-500 mt-0.5">Analyse charge &amp; données multi-sources</p>
              </div>
              <div>
                <p className="font-mono text-lg font-bold text-[#0F172A] tabular-nums">KM-EFFORT</p>
                <p className="text-xs text-slate-500 mt-0.5">Minetti &amp; dérive ultra</p>
              </div>
              <div>
                <p className="font-mono text-lg font-bold text-[#0F172A] tabular-nums">AES-256</p>
                <p className="text-xs text-slate-500 mt-0.5">Clés API chiffrées serveur</p>
              </div>
            </div>
          </div>

          {/* Photographie éditoriale + cartouche technique */}
          <div className="lg:col-span-6">
            <div className="bg-white border border-slate-200 rounded-lg overflow-hidden">
              <div className="relative aspect-video bg-[#0F172A]">
                <Image
                  src="/images/alpine-hero.jpg"
                  alt="Traileur sur une crête alpine au lever du jour"
                  fill
                  sizes="(max-width: 1024px) 100vw, 50vw"
                  preload
                  className="object-cover"
                />
              </div>
              <div className="px-4 py-3 border-t border-slate-200 bg-white flex flex-wrap items-center justify-between gap-2 font-mono text-[11px] text-slate-500">
                <span>CHAMONIX — VALLORCINE · 42 KM / +2 650 M</span>
                <span className="text-[#0F172A] font-semibold">
                  MINETTI · SUNCALC · MULTI-SOURCES
                </span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* 01 / OUTILS SCIENTIFIQUES EN ACCÈS LIBRE */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 pt-16">
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 pb-6 border-b border-slate-200">
          <div>
            <p className="font-mono text-[11px] uppercase tracking-[0.14em] text-[#FF5A36] font-semibold">
              01 / Accès Libre Sans Compte
            </p>
            <h2 className="text-2xl sm:text-3xl font-bold tracking-[-0.02em] text-[#0F172A] mt-1.5">
              Boîte à outils Trail scientifique
            </h2>
          </div>
          <Link
            href="/tools"
            className="inline-flex items-center gap-1.5 text-sm font-semibold text-[#0F172A] hover:text-[#FF5A36] transition-colors"
          >
            <span>Ouvrir les calculateurs</span>
            <ArrowRight size={15} />
          </Link>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 bg-white border-x border-b border-slate-200 rounded-b-lg divide-y md:divide-y-0 md:divide-x divide-slate-200">
          <Link href="/tools" className="group p-6 sm:p-8 hover:bg-[#F8FAFC] transition-colors block">
            <div className="flex items-center justify-between font-mono text-xs text-slate-400">
              <span>TOOL 01</span>
              <ArrowUpRight size={15} className="group-hover:text-[#FF5A36] transition-colors" />
            </div>
            <h3 className="text-lg font-bold text-[#0F172A] mt-4 group-hover:text-[#FF5A36] transition-colors">
              Roadbook GPX Express
            </h3>
            <p className="text-sm text-slate-600 mt-2 leading-relaxed">
              Importez un fichier `.gpx` ou testez la trace alpine 42 km : profil altimétrique par pente, horaires rapides/prudents, passage nocturne SunCalc et export GPX.
            </p>
          </Link>

          <Link
            href="/tools#pacing-calc"
            className="group p-6 sm:p-8 hover:bg-[#F8FAFC] transition-colors block"
          >
            <div className="flex items-center justify-between font-mono text-xs text-slate-400">
              <span>TOOL 02</span>
              <ArrowUpRight size={15} className="group-hover:text-[#14C38E] transition-colors" />
            </div>
            <h3 className="text-lg font-bold text-[#0F172A] mt-4 group-hover:text-[#14C38E] transition-colors">
              Calculateur Km-Effort &amp; Chrono
            </h3>
            <p className="text-sm text-slate-600 mt-2 leading-relaxed">
              Estimez votre chrono réaliste de 25 km au 100 Miles selon votre cote ITRA, les pauses aux bases de vie et la dérive musculaire.
            </p>
          </Link>

          <Link
            href="/tools#nutrition-sim"
            className="group p-6 sm:p-8 hover:bg-[#F8FAFC] transition-colors block"
          >
            <div className="flex items-center justify-between font-mono text-xs text-slate-400">
              <span>TOOL 03</span>
              <ArrowUpRight size={15} className="group-hover:text-[#FF5A36] transition-colors" />
            </div>
            <h3 className="text-lg font-bold text-[#0F172A] mt-4 group-hover:text-[#FF5A36] transition-colors">
              Simulateur Nutrition &amp; Sodium
            </h3>
            <p className="text-sm text-slate-600 mt-2 leading-relaxed">
              Calculez vos cibles horaires glucides/eau/électrolytes selon la météo et composez votre sac avec des références trail réelles.
            </p>
          </Link>
        </div>
      </section>

      {/* 02 / ACCOMPAGNEMENT & OFFRES */}
      <HomeOffersSection />

      {/* 03 / LE COACH & LA MÉTHODE */}
      <section id="methode-coach" className="max-w-7xl mx-auto px-4 sm:px-6 pt-20">
        <div className="pb-6 border-b border-slate-200 flex flex-col md:flex-row md:items-end justify-between gap-4">
          <div>
            <p className="font-mono text-[11px] uppercase tracking-[0.14em] text-[#FF5A36] font-semibold">
              03 / Approche &amp; Légitimité
            </p>
            <h2 className="text-2xl sm:text-3xl font-bold tracking-[-0.02em] text-[#0F172A] mt-1.5">
              Le Coach &amp; la Méthode myKairn
            </h2>
          </div>
          <p className="font-mono text-[11px] uppercase tracking-wider text-slate-500">
            {coachProfile.locationLabel}
          </p>
        </div>

        <div className="mt-8 grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
          {/* Identité & Crédentials */}
          <div className="lg:col-span-5 bg-white border border-slate-200 rounded-lg p-7 space-y-6">
            <div className="space-y-1 border-b border-slate-100 pb-4">
              <p className="font-mono text-[11px] uppercase tracking-wider text-[#14C38E] font-semibold">
                ENTRAÎNEMENT INDIVIDUEL
              </p>
              <h3 className="text-xl font-bold text-[#0F172A]">{coachProfile.name}</h3>
              <p className="text-xs font-medium text-slate-500">{coachProfile.title}</p>
            </div>

            <div className="space-y-3 text-sm text-slate-600 leading-relaxed">
              {coachProfile.bio.map((paragraph, index) => (
                <p key={index}>{paragraph}</p>
              ))}
            </div>

            <dl className="pt-4 border-t border-slate-100 space-y-3 text-xs">
              {coachProfile.credentials.map((cred) => (
                <div key={cred.label} className="flex items-start gap-2.5">
                  <CheckCircle2 size={14} className="text-[#14C38E] shrink-0 mt-0.5" />
                  <div>
                    <dt className="font-mono text-[10px] uppercase tracking-wider text-slate-400">
                      {cred.label}
                    </dt>
                    <dd className="text-[#0F172A] font-medium mt-0.5 leading-relaxed">
                      {cred.value}
                    </dd>
                  </div>
                </div>
              ))}
            </dl>

            <div className="pt-2">
              <a
                href={discoveryHref}
                target={hasExternalBooking ? '_blank' : undefined}
                rel={hasExternalBooking ? 'noopener noreferrer' : undefined}
                className="w-full inline-flex items-center justify-center gap-2 py-2.5 px-4 rounded-md bg-[#0F172A] hover:bg-[#FF5A36] text-white text-xs font-semibold transition-colors"
              >
                <Calendar size={14} />
                <span>
                  {hasExternalBooking
                    ? `Échange découverte ${booking.discoveryCallDurationMin} min (Coaching 1-to-1)`
                    : 'Échange découverte 15 min (Coaching 1-to-1)'}
                </span>
              </a>
            </div>
          </div>

          {/* 4 Piliers Méthodologiques */}
          <div className="lg:col-span-7 grid grid-cols-1 sm:grid-cols-2 gap-4">
            {coachProfile.methodologyPillars.map((pillar) => (
              <div
                key={pillar.code}
                className="bg-white border border-slate-200 rounded-lg p-6 space-y-3"
              >
                <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                  <span className="font-mono text-xs font-bold text-[#FF5A36] tabular-nums">
                    PILIER {pillar.code}
                  </span>
                  <span className="font-mono text-[10px] uppercase tracking-wider text-slate-400">
                    MÉTHODE
                  </span>
                </div>
                <h3 className="text-base font-bold text-[#0F172A]">{pillar.title}</h3>
                <p className="text-sm text-slate-600 leading-relaxed">{pillar.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* 04 / TERRAIN — ATHLÈTES PILOTES */}
      <HomePilotsShowcase />

      {/* 05 / QUESTIONS FRÉQUENTES */}
      <section id="faq" className="max-w-7xl mx-auto px-4 sm:px-6 pt-20">
        <div className="pb-6 border-b border-slate-200 flex flex-col md:flex-row md:items-end justify-between gap-4">
          <div>
            <p className="font-mono text-[11px] uppercase tracking-[0.14em] text-[#FF5A36] font-semibold">
              05 / Questions Fréquentes
            </p>
            <h2 className="text-2xl sm:text-3xl font-bold tracking-[-0.02em] text-[#0F172A] mt-1.5">
              Fonctionnement, montres &amp; suivi trail
            </h2>
          </div>
          <p className="text-sm text-slate-500 max-w-md">
            Réponses pratiques avant de démarrer un suivi ou d&apos;importer votre trace GPX.
          </p>
        </div>

        <div className="mt-8 grid grid-cols-1 lg:grid-cols-2 gap-4">
          {faqItems.map((item, idx) => (
            <details
              key={item.question}
              className="group bg-white border border-slate-200 rounded-lg open:border-slate-300 transition-colors"
            >
              <summary className="list-none cursor-pointer px-6 py-5 flex items-start justify-between gap-4 select-none">
                <div className="space-y-1">
                  <span className="font-mono text-[10px] uppercase tracking-wider text-slate-400">
                    FAQ {String(idx + 1).padStart(2, '0')}
                  </span>
                  <h3 className="text-sm sm:text-base font-bold text-[#0F172A]">
                    {item.question}
                  </h3>
                </div>
                <span className="font-mono text-lg font-bold text-[#FF5A36] shrink-0 leading-none mt-1">
                  <span className="group-open:hidden">+</span>
                  <span className="hidden group-open:inline">&minus;</span>
                </span>
              </summary>
              <div className="px-6 pb-5 pt-2 border-t border-slate-100 text-sm text-slate-600 leading-relaxed">
                {item.answer}
              </div>
            </details>
          ))}
        </div>
      </section>

      {/* 06 / PREMIER BILAN & CONTACT */}
      <HomeContactSection />
    </div>
  );
}
