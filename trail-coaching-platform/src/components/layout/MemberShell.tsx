'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import {
  Activity,
  BookOpen,
  ClipboardCheck,
  Compass,
  ExternalLink,
  Lock,
  LogOut,
  Menu,
  MessageSquare,
  Palette,
  Settings,
  ShieldCheck,
  Users,
  X,
} from 'lucide-react';
import BrandLogo from '@/components/brand/BrandLogo';
import { usePlatform } from '@/context/PlatformContext';

const PAGE_LABELS: Array<{ prefix: string; title: string }> = [
  { prefix: '/coach/brand', title: 'Charte Graphique & Vitrine' },
  { prefix: '/coach/athletes/', title: 'Dossier Individuel Athlète' },
  { prefix: '/coach', title: 'Cockpit Coach & Alertes' },
  { prefix: '/messages', title: 'Messagerie Coach & Groupes' },
  { prefix: '/athlete/check-in', title: 'Carnet de Retour (Check-in)' },
  { prefix: '/athlete/plans', title: 'Mes Programmes' },
  { prefix: '/athlete/roadbook', title: 'Mes Roadbooks GPX' },
  { prefix: '/athlete/settings', title: 'Paramètres & RGPD' },
  { prefix: '/athlete', title: 'Tableau de Bord Athlète' },
  { prefix: '/community', title: 'Communauté & Défis' },
];

export default function MemberShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const {
    currentUser,
    access,
    customLogoUrl,
    featureFlags,
    totalUnreadMessages,
    logoutUser,
    isReady,
  } = usePlatform();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const showProgramsEntry =
    featureFlags.programSalesEnabled ||
    access.unlockedPlanIds.length > 0 ||
    access.canAccessCoachDashboard;

  const memberLinks = [
    { href: '/athlete', label: 'Tableau de bord', icon: Activity, exact: true },
    { href: '/messages', label: 'Messagerie & Groupes', icon: MessageSquare },
    { href: '/athlete/check-in', label: 'Carnet Check-in', icon: ClipboardCheck },
    ...(showProgramsEntry
      ? [{ href: '/athlete/plans', label: 'Mes Programmes', icon: BookOpen }]
      : []),
    { href: '/athlete/roadbook', label: 'Mes Roadbooks GPX', icon: Compass },
    { href: '/community', label: 'Communauté & Défis', icon: Users },
    { href: '/athlete/settings', label: 'Paramètres & RGPD', icon: Settings },
  ];

  const coachLinks = [
    { href: '/coach', label: 'Cockpit & Alertes', icon: ShieldCheck, exact: false },
    { href: '/coach/brand', label: 'Charte, Logo & Vitrine', icon: Palette, exact: true },
  ];

  const isLinkActive = (href: string, exact?: boolean) => {
    if (!pathname) return false;
    if (exact) return pathname === href;
    if (href === '/coach') {
      return pathname === '/coach' || pathname.startsWith('/coach/athletes');
    }
    return pathname === href || pathname.startsWith(`${href}/`);
  };

  const activeTitle =
    PAGE_LABELS.find((p) => pathname?.startsWith(p.prefix))?.title || 'Espace Membre';

  if (!isReady) {
    return (
      <div className="min-h-screen bg-[#F8FAFC] flex items-center justify-center font-mono text-xs text-slate-400">
        CHARGEMENT ESPACE MEMBRE...
      </div>
    );
  }

  // Barrière d'authentification stricte : l'application membre est isolée des visiteurs publics
  if (!currentUser) {
    return (
      <div className="min-h-screen bg-[#F8FAFC] bg-topo-lines flex items-center justify-center px-4 py-12">
        <div className="max-w-md w-full bg-white border border-slate-200 rounded-lg p-8 space-y-6">
          <div className="flex items-center justify-between">
            <BrandLogo size="sm" customSrc={customLogoUrl ?? undefined} />
            <span className="font-mono text-[10px] uppercase tracking-wider px-2 py-1 rounded bg-slate-100 text-slate-600">
              ACCÈS MEMBRE
            </span>
          </div>

          <div className="space-y-2 border-t border-slate-100 pt-5">
            <div className="inline-flex items-center gap-2 text-xs font-bold text-[#FF5A36] uppercase font-mono">
              <Lock size={14} />
              <span>Espace réservé aux membres &amp; abonnés</span>
            </div>
            <h1 className="text-xl font-bold text-[#0F172A]">
              Connectez-vous pour accéder à votre espace personnel
            </h1>
            <p className="text-sm text-slate-600 leading-relaxed">
              Cet espace privé regroupe votre suivi physiologique, vos plans d&apos;entraînement débloqués, vos check-ins et la communauté du groupe.
            </p>
          </div>

          <div className="space-y-2.5 pt-2">
            <Link
              href="/login"
              className="w-full inline-flex items-center justify-center py-2.5 px-4 rounded-md bg-[#0F172A] hover:bg-[#FF5A36] text-white text-sm font-semibold transition-colors"
            >
              Se connecter / Créer un compte
            </Link>
            <Link
              href="/"
              className="w-full inline-flex items-center justify-center py-2.5 px-4 rounded-md border border-slate-300 hover:border-[#0F172A] text-[#0F172A] text-sm font-semibold transition-colors"
            >
              Retourner sur le site public
            </Link>
          </div>
        </div>
      </div>
    );
  }

  const handleLogout = async () => {
    await logoutUser();
    router.push('/');
  };

  return (
    <div className="min-h-screen bg-[#F8FAFC] flex flex-col lg:flex-row">
      {/* Sidebar Desktop Fixe */}
      <aside className="hidden lg:flex lg:flex-col lg:w-64 lg:fixed lg:inset-y-0 bg-white border-r border-slate-200 z-30 no-print">
        <div className="h-14 px-5 border-b border-slate-200 flex items-center justify-between">
          <Link href="/athlete">
            <BrandLogo size="sm" customSrc={customLogoUrl ?? undefined} />
          </Link>
        </div>

        <div className="flex-1 overflow-y-auto px-3 py-5 space-y-6">
          <div>
            <p className="px-3 mb-2 font-mono text-[10px] uppercase tracking-[0.14em] text-slate-400">
              Mon Suivi
            </p>
            <nav className="space-y-0.5">
              {memberLinks.map((item) => {
                const Icon = item.icon;
                const active = isLinkActive(item.href, item.exact);
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={`flex items-center justify-between gap-2.5 px-3 py-2 rounded-md text-xs font-semibold transition-colors ${
                      active
                        ? 'bg-[#0F172A] text-white'
                        : 'text-slate-600 hover:bg-slate-100 hover:text-[#0F172A]'
                    }`}
                  >
                    <span className="flex items-center gap-2.5 min-w-0">
                      <Icon size={15} className={active ? 'text-[#FF5A36]' : 'text-slate-400'} />
                      <span className="truncate">{item.label}</span>
                    </span>
                    {item.href === '/messages' && totalUnreadMessages > 0 && (
                      <span className="px-1.5 py-0.5 rounded bg-[#FF5A36] text-white font-mono text-[10px] font-bold tabular-nums">
                        {totalUnreadMessages}
                      </span>
                    )}
                  </Link>
                );
              })}
            </nav>
          </div>

          {access.canAccessCoachDashboard && (
            <div className="pt-4 border-t border-slate-200">
              <p className="px-3 mb-2 font-mono text-[10px] uppercase tracking-[0.14em] text-[#FF5A36] font-semibold">
                Supervision Coach
              </p>
              <nav className="space-y-0.5">
                {coachLinks.map((item) => {
                  const Icon = item.icon;
                  const active = isLinkActive(item.href, item.exact);
                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      className={`flex items-center gap-2.5 px-3 py-2 rounded-md text-xs font-semibold transition-colors ${
                        active
                          ? 'bg-[#0F172A] text-white'
                          : 'text-slate-600 hover:bg-slate-100 hover:text-[#0F172A]'
                      }`}
                    >
                      <Icon size={15} className={active ? 'text-[#14C38E]' : 'text-slate-400'} />
                      <span>{item.label}</span>
                    </Link>
                  );
                })}
              </nav>
            </div>
          )}
        </div>

        {/* Pied de Sidebar : Compte + Lien Site Public */}
        <div className="p-3 border-t border-slate-200 bg-[#F8FAFC] space-y-2">
          <div className="px-2 py-1.5">
            <p className="text-xs font-bold text-[#0F172A] truncate">{currentUser.displayName}</p>
            <p className="font-mono text-[10px] uppercase tracking-wider text-[#14C38E] font-semibold">
              {access.tierBadgeLabel}
            </p>
          </div>
          <div className="flex items-center justify-between gap-2 pt-1 border-t border-slate-200">
            <Link
              href="/"
              className="inline-flex items-center gap-1 px-2 py-1.5 rounded text-xs font-semibold text-slate-600 hover:text-[#0F172A]"
            >
              <ExternalLink size={12} />
              <span>Site public</span>
            </Link>
            <button
              type="button"
              onClick={handleLogout}
              className="inline-flex items-center gap-1 px-2 py-1.5 rounded text-xs font-semibold text-slate-500 hover:text-red-600 cursor-pointer"
              title="Se déconnecter"
            >
              <LogOut size={13} />
              <span>Quitter</span>
            </button>
          </div>
        </div>
      </aside>

      {/* Conteneur Principal avec Topbar applicative */}
      <div className="flex-1 lg:pl-64 flex flex-col min-w-0">
        <header className="sticky top-0 z-20 h-14 bg-white/95 backdrop-blur-sm border-b border-slate-200 px-4 sm:px-6 flex items-center justify-between gap-4 no-print">
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="lg:hidden p-1.5 rounded-md border border-slate-200 text-slate-700"
              aria-label="Menu membre"
            >
              {mobileMenuOpen ? <X size={18} /> : <Menu size={18} />}
            </button>
            <div className="flex items-center gap-2 text-xs">
              <span className="font-mono uppercase tracking-wider text-slate-400 hidden sm:inline">
                ESPACE MEMBRE /
              </span>
              <span className="font-bold text-[#0F172A]">{activeTitle}</span>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <span className="hidden sm:inline-block font-mono text-[10px] uppercase tracking-wider px-2.5 py-1 rounded bg-slate-100 text-slate-700 border border-slate-200">
              {access.tierBadgeLabel}
            </span>
            <Link
              href="/athlete/check-in"
              className="px-3 py-1.5 rounded-md bg-[#FF5A36] hover:bg-[#E34A28] text-white text-xs font-semibold transition-colors"
            >
              + Check-in
            </Link>
          </div>
        </header>

        {/* Tiroir Navigation Mobile */}
        {mobileMenuOpen && (
          <div className="lg:hidden bg-white border-b border-slate-200 px-4 py-3 space-y-3 no-print">
            <nav className="space-y-1">
              {memberLinks.map((item) => {
                const Icon = item.icon;
                const active = isLinkActive(item.href, item.exact);
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    onClick={() => setMobileMenuOpen(false)}
                    className={`flex items-center justify-between gap-2.5 px-3 py-2 rounded-md text-xs font-semibold ${
                      active ? 'bg-[#0F172A] text-white' : 'text-slate-700'
                    }`}
                  >
                    <span className="flex items-center gap-2.5">
                      <Icon size={14} />
                      <span>{item.label}</span>
                    </span>
                    {item.href === '/messages' && totalUnreadMessages > 0 && (
                      <span className="px-1.5 py-0.5 rounded bg-[#FF5A36] text-white font-mono text-[10px] font-bold tabular-nums">
                        {totalUnreadMessages}
                      </span>
                    )}
                  </Link>
                );
              })}
              {access.canAccessCoachDashboard &&
                coachLinks.map((item) => {
                  const Icon = item.icon;
                  const active = isLinkActive(item.href, item.exact);
                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      onClick={() => setMobileMenuOpen(false)}
                      className={`flex items-center gap-2.5 px-3 py-2 rounded-md text-xs font-semibold ${
                        active ? 'bg-[#0F172A] text-white' : 'text-[#FF5A36]'
                      }`}
                    >
                      <Icon size={14} />
                      <span>{item.label}</span>
                    </Link>
                  );
                })}
            </nav>
            <div className="pt-2 border-t border-slate-100 flex items-center justify-between text-xs">
              <Link href="/" onClick={() => setMobileMenuOpen(false)} className="text-slate-600 underline">
                Site public
              </Link>
              <button type="button" onClick={handleLogout} className="text-red-600 font-semibold">
                Se déconnecter
              </button>
            </div>
          </div>
        )}

        <main className="flex-1">{children}</main>
      </div>
    </div>
  );
}
