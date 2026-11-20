export interface BrandThemePalette {
  id: string;
  name: string;
  description: string;
  slateDeep: string;
  slateMuted: string;
  alpineBg: string;
  surfaceCard: string;
  kairnOrange: string;
  kairnOrangeLight: string;
  trailMint: string;
  trailMintLight: string;
  amberAlert: string;
  dangerRed: string;
}

export interface PromoBannerConfig {
  enabled: boolean;
  badge: string;
  message: string;
  ctaLabel: string;
  ctaHref: string;
}

export interface LegalEntityConfig {
  businessName: string;
  ownerName: string;
  legalStatus: string;
  siret: string;
  professionalCard: string;
  address: string;
  contactEmail: string;
  hostName: string;
  hostAddress: string;
}

export interface BookingConfig {
  discoveryCallUrl: string;
  discoveryCallDurationMin: number;
  responseSlaLabel: string;
}

export interface CoachMethodologyPillar {
  code: string;
  title: string;
  description: string;
}

export interface CoachProfileConfig {
  name: string;
  title: string;
  locationLabel: string;
  bio: string[];
  credentials: Array<{ label: string; value: string }>;
  methodologyPillars: CoachMethodologyPillar[];
}

export interface FaqItem {
  question: string;
  answer: string;
}

export interface PlatformFeatureFlags {
  programSalesEnabled: boolean;
}

export const DEFAULT_FEATURE_FLAGS: PlatformFeatureFlags = {
  programSalesEnabled: process.env.NEXT_PUBLIC_ENABLE_PROGRAM_SALES === 'true',
};

export const ALPINE_PERFORMANCE_PALETTE: BrandThemePalette = {
  id: 'alpine-performance',
  name: 'Alpine Performance',
  description:
    'Charte lumineuse & contrastée : Ardoise alpine profonde, fond clair haute lisibilité, Orange Kairn énergétique et Vert Sentier.',
  slateDeep: '#0F172A',
  slateMuted: '#475569',
  alpineBg: '#F8FAFC',
  surfaceCard: '#FFFFFF',
  kairnOrange: '#FF5A36',
  kairnOrangeLight: '#FF7A59',
  trailMint: '#14C38E',
  trailMintLight: '#34D399',
  amberAlert: '#F59E0B',
  dangerRed: '#EF4444',
};

export const BRAND_CONFIG = {
  appName: process.env.NEXT_PUBLIC_APP_NAME || 'myKairn Coach',
  siteUrl: (process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3005').replace(/\/+$/, ''),
  tagline: 'Coaching Trail, Ultra-Endurance & Performance Scientifique',
  /**
   * Pour activer votre logo définitif :
   * 1. Déposez votre fichier dans `public/brand/mykairn-coach-logo.svg` (ou `.png`)
   * 2. Ou utilisez le gestionnaire de charte graphique dans `/coach/brand` pour prévisualiser et exporter la config.
   */
  customLogoPath: '/brand/mykairn-coach-logo.svg',
  palette: ALPINE_PERFORMANCE_PALETTE,
  booking: {
    discoveryCallUrl: process.env.NEXT_PUBLIC_BOOKING_URL || '',
    discoveryCallDurationMin: 15,
    responseSlaLabel: 'Réponse personnalisée sous 48h ouvrées',
  } satisfies BookingConfig,
  coachProfile: {
    name: process.env.NEXT_PUBLIC_COACH_NAME || 'Coach Fondateur — myKairn Coach',
    title:
      process.env.NEXT_PUBLIC_COACH_TITLE ||
      'Entraîneur Trail & Ultra-Endurance · Data & Physiologie',
    locationLabel:
      process.env.NEXT_PUBLIC_COACH_LOCATION || 'Alpes françaises · Suivi à distance (FR / CH / BE)',
    bio: [
      "Un suivi construit pour les contraintes réelles du trail : conciliation entre vie professionnelle, sorties longues en montagne et progression mesurable sans surentraînement.",
      "Chaque semaine d'entraînement s'appuie sur vos données objectives (CTL, ATL, TSB, variabilité cardiaque) et sur une modélisation rigoureuse du coût énergétique en montée et en descente (Minetti, Riegel).",
    ],
    credentials: [
      {
        label: 'Qualification',
        value:
          process.env.NEXT_PUBLIC_LEGAL_CARD_PRO ||
          'Carte professionnelle éducateur sportif EAPS (à renseigner via NEXT_PUBLIC_LEGAL_CARD_PRO)',
      },
      {
        label: 'Spécialité terrain',
        value: 'Formats 25 km à 100 Miles · Préparation D+/D-, gestion musculaire & nuits en course',
      },
      {
        label: 'Sources de données',
        value: 'Analyse de toutes sources de données : Garmin, Coros, Suunto, Polar, Strava, exports FIT / GPX',
      },
    ],
    methodologyPillars: [
      {
        code: '01',
        title: 'Calibration physiologique',
        description:
          'Lecture hebdomadaire de votre charge (CTL / ATL / TSB), fréquence cardiaque, seuils et HRV quelle que soit votre montre ou plateforme.',
      },
      {
        code: '02',
        title: 'Spécificité montagne D+/D-',
        description:
          'Travail ciblé en VAM, gestion excentrique des descentes et structuration progressive des week-ends chocs sans surcharge articulaire.',
      },
      {
        code: '03',
        title: 'Veille fatigue & alertes',
        description:
          'Check-in terrain en 30 secondes (RPE, courbatures, zone sensible) avec déclenchement d’alerte immédiate et adaptation du plan.',
      },
      {
        code: '04',
        title: 'Stratégie Jour J complète',
        description:
          'Roadbook GPX segmenté (Minetti 2002, cycle solaire SunCalc), marges barrières horaires et protocole glucides / sodium par tronçon.',
      },
    ],
  } satisfies CoachProfileConfig,
  faqItems: [
    {
      question: 'Quelles montres GPS et plateformes sont compatibles ?',
      answer:
        'Toutes les montres et plateformes principales sont compatibles (Garmin, Coros, Suunto, Polar, Wahoo, Apple Watch, Strava, exports FIT/GPX/TCX). Nous analysons vos données directement depuis votre écosystème habituel.',
    },
    {
      question: 'Faut-il changer de montre ou souscrire à un outil payant supplémentaire ?',
      answer:
        'Non. Vous conservez votre montre et votre application habituelles (Garmin Connect, Coros, Suunto, Polar Flow, Strava...). Aucun abonnement tiers payant n’est requis pour le suivi et l’analyse de vos données.',
    },
    {
      question: 'Quel niveau ou volume minimum faut-il pour démarrer un suivi ?',
      answer:
        "Le coaching s'adapte du coureur préparant son premier trail court (20–30 km) à l'ultra-traileur (100 km à 100 Miles). L'essentiel est de pouvoir dégager au moins 3 à 4 créneaux hebdomadaires réguliers.",
    },
    {
      question: 'Comment se déroule une semaine type de coaching 1-to-1 ?',
      answer:
        'Votre semaine est planifiée selon vos disponibilités et exportable sur votre montre. Après vos séances clés, vous remplissez un check-in de 30 secondes ; en cas de fatigue, douleur ou imprévu pro, la charge est ajustée.',
    },
    {
      question: "Y a-t-il un engagement de durée et comment fonctionne l'échange découverte ?",
      answer:
        "Le suivi mensuel est sans engagement contraignant (résiliable avant l'échéance mensuelle suivante). Avant tout démarrage en Coaching 1-to-1, un échange découverte visio gratuit de 15 minutes permet de faire connaissance et de valider vos attentes (sans analyse de données pendant cet appel). Si vous démarrez par un Pack Stratégie Jour J (89 €), 45 € sont déduits de votre 1er mois si vous poursuivez en 1-to-1 sous 15 jours.",
    },
    {
      question: 'Faut-il un certificat médical ou le Parcours Prévention Santé (PPS) ?',
      answer:
        "Le coaching s'adresse aux pratiquants aptes à l'effort en montagne. Conformément à la réglementation FFA, chaque athlète doit disposer d'un PPS valide (ou justificatif médical requis) avant toute compétition.",
    },
  ] satisfies FaqItem[],
  promoBanner: {
    enabled: true,
    badge: 'Saison 2026/2027',
    message:
      'Ouverture de 3 places en Coaching Trail & Ultra 1-to-1 + accès libre 100 % gratuit aux calculateurs GPX & Nutrition.',
    ctaLabel: 'Réserver un échange 15 min',
    ctaHref: '/#contact-bilan',
  } satisfies PromoBannerConfig,
  legal: {
    businessName: process.env.NEXT_PUBLIC_LEGAL_BUSINESS_NAME || 'myKairn Coach',
    ownerName: process.env.NEXT_PUBLIC_LEGAL_OWNER_NAME || 'Responsable Éditorial & Coach Trail (à compléter)',
    legalStatus:
      process.env.NEXT_PUBLIC_LEGAL_STATUS || 'Entreprise Individuelle — Coaching Sportif & Préparation Physique',
    siret: process.env.NEXT_PUBLIC_LEGAL_SIRET || 'SIRET en cours / à renseigner via NEXT_PUBLIC_LEGAL_SIRET',
    professionalCard:
      process.env.NEXT_PUBLIC_LEGAL_CARD_PRO ||
      'Carte professionnelle éducateur sportif EAPS (à renseigner via NEXT_PUBLIC_LEGAL_CARD_PRO)',
    address: process.env.NEXT_PUBLIC_LEGAL_ADDRESS || 'France (Alpes / En ligne)',
    contactEmail: process.env.NEXT_PUBLIC_LEGAL_EMAIL || 'contact@mykairn.fr',
    hostName: process.env.NEXT_PUBLIC_LEGAL_HOST_NAME || 'Vercel Inc. & Google Cloud Platform / Firebase (Région UE)',
    hostAddress:
      process.env.NEXT_PUBLIC_LEGAL_HOST_ADDRESS || '440 N Barranca Ave #4133, Covina, CA 91723, USA',
  } satisfies LegalEntityConfig,
};

export const IS_DEMO_SANDBOX_ENABLED =
  process.env.NODE_ENV !== 'production' &&
  process.env.NEXT_PUBLIC_ENABLE_DEMO_DOCK !== 'false';
