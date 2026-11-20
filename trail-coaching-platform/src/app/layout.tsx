import type { Metadata } from 'next';
import { Instrument_Sans, JetBrains_Mono } from 'next/font/google';
import './globals.css';
import { PlatformProvider } from '@/context/PlatformContext';
import CookieConsentBanner from '@/components/layout/CookieConsentBanner';
import RolePreviewDock from '@/components/layout/RolePreviewDock';
import TrailChatbotWidget from '@/components/chat/TrailChatbotWidget';
import { BRAND_CONFIG } from '@/config/brand';

const instrumentSans = Instrument_Sans({
  subsets: ['latin'],
  variable: '--font-instrument-sans',
  display: 'swap',
});

const jetbrainsMono = JetBrains_Mono({
  subsets: ['latin'],
  variable: '--font-jetbrains-mono',
  display: 'swap',
});

export const metadata: Metadata = {
  metadataBase: new URL(BRAND_CONFIG.siteUrl),
  title: {
    default: `${BRAND_CONFIG.appName} — Coaching Trail, Ultra-Endurance & Outils GPX`,
    template: `%s | ${BRAND_CONFIG.appName}`,
  },
  description:
    'Coaching trail & ultra-endurance 1-to-1 fondé sur l’analyse multi-sources de vos données (Garmin, Coros, Suunto, Strava, FIT/GPX), audits de course, calculateur km-effort Minetti et générateur de roadbook GPX gratuit.',
  keywords: [
    'coaching trail',
    'coach ultra trail',
    'roadbook GPX trail',
    'calculateur km-effort',
    'nutrition trail',
    'analyse données trail',
    'préparation trail montagne',
  ],
  authors: [{ name: BRAND_CONFIG.coachProfile.name }],
  creator: BRAND_CONFIG.appName,
  publisher: BRAND_CONFIG.legal.businessName,
  openGraph: {
    type: 'website',
    locale: 'fr_FR',
    url: BRAND_CONFIG.siteUrl,
    siteName: BRAND_CONFIG.appName,
    title: `${BRAND_CONFIG.appName} — Coaching Trail, Ultra-Endurance & Outils GPX`,
    description:
      'Analyse physiologique multi-sources (toutes montres & plateformes), modélisation scientifique de roadbooks GPX (Minetti 2002, SunCalc) et préparation trail personnalisée.',
    images: [
      {
        url: '/images/alpine-hero.jpg',
        alt: 'Traileur sur une crête alpine au lever du jour — myKairn Coach',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: `${BRAND_CONFIG.appName} — Coaching Trail & Outils GPX`,
    description:
      'Coaching trail individuel avec analyse multi-sources (Garmin, Coros, Suunto, Strava, FIT/GPX), audits de course et calculateurs roadbook/nutrition gratuits.',
    images: ['/images/alpine-hero.jpg'],
  },
  robots: {
    index: true,
    follow: true,
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="fr" className={`${instrumentSans.variable} ${jetbrainsMono.variable}`}>
      <body className="min-h-screen bg-[#F8FAFC] text-[#0F172A]">
        <PlatformProvider>
          {children}
          <CookieConsentBanner />
          <RolePreviewDock />
          <TrailChatbotWidget />
        </PlatformProvider>
      </body>
    </html>
  );
}
