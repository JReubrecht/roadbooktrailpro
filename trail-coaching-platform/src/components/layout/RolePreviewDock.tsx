'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { ChevronUp, ChevronDown, SlidersHorizontal } from 'lucide-react';
import { IS_DEMO_SANDBOX_ENABLED } from '@/config/brand';
import { usePlatform, type DemoPersonaId } from '@/context/PlatformContext';

const PERSONAS: Array<{ id: DemoPersonaId; label: string; short: string }> = [
  { id: 'visitor', label: 'Visiteur public (non connecté)', short: 'Visiteur public' },
  { id: 'pilot-claire', label: 'Pilote : Claire Morel (Showcase)', short: 'Pilote : Claire' },
  { id: 'pilot-thomas', label: 'Pilote : Thomas Garnier (Alerte)', short: 'Pilote : Thomas' },
  { id: 'athlete-free-demo', label: 'Athlète Free : Camille', short: 'Athlète Free' },
  { id: 'coach-admin-1', label: 'Coach / Admin (accès complet)', short: 'Coach / Admin' },
];

export default function RolePreviewDock() {
  const { activePersonaId, switchPersona, isReady, isFirebaseLive } = usePlatform();
  const [open, setOpen] = useState(false);

  if (!isReady || isFirebaseLive || !IS_DEMO_SANDBOX_ENABLED) return null;

  const active = PERSONAS.find((p) => p.id === activePersonaId) || {
    id: activePersonaId,
    label: 'Compte connecté',
    short: 'Compte actif',
  };

  return (
    <div className="fixed bottom-4 left-4 z-40 no-print font-sans">
      {open && (
        <div className="mb-2 w-72 rounded-lg bg-[#0F172A] text-white border border-slate-700 shadow-lg overflow-hidden">
          <div className="px-3 py-2 border-b border-slate-800 flex items-center justify-between">
            <span className="font-mono text-[10px] uppercase tracking-wider text-slate-400">
              Simulateur Rôles &amp; Mondes
            </span>
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="text-slate-400 hover:text-white cursor-pointer"
              aria-label="Replier le sélecteur"
            >
              <ChevronDown size={14} />
            </button>
          </div>

          <div className="p-1.5 space-y-0.5">
            {PERSONAS.map((p) => {
              const selected = p.id === activePersonaId;
              return (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => {
                    switchPersona(p.id);
                    setOpen(false);
                  }}
                  className={`w-full text-left px-2.5 py-1.5 rounded-md text-xs font-medium flex items-center justify-between cursor-pointer transition-colors ${
                    selected
                      ? 'bg-[#FF5A36] text-white font-semibold'
                      : 'text-slate-300 hover:bg-slate-800'
                  }`}
                >
                  <span>{p.label}</span>
                  {selected && <span className="font-mono text-[10px]">ACTIF</span>}
                </button>
              );
            })}
          </div>

          <div className="px-3 py-2 border-t border-slate-800 bg-slate-900/60 flex items-center justify-between gap-2 font-mono text-[10px]">
            <Link href="/" onClick={() => setOpen(false)} className="text-slate-300 hover:text-white underline">
              Public /
            </Link>
            <Link href="/athlete" onClick={() => setOpen(false)} className="text-[#14C38E] hover:underline">
              Membre /athlete
            </Link>
            <Link href="/coach" onClick={() => setOpen(false)} className="text-[#FF7A59] hover:underline">
              Coach /coach
            </Link>
          </div>
        </div>
      )}

      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="inline-flex items-center gap-2 px-3 py-1.5 rounded-md bg-white/95 backdrop-blur border border-slate-300 text-xs font-semibold text-[#0F172A] shadow-sm hover:border-[#0F172A] cursor-pointer transition-colors"
        title="Basculer entre Visiteur Public, Athlète et Coach"
      >
        <SlidersHorizontal size={12} className="text-[#FF5A36]" />
        <span className="font-mono text-[11px] uppercase tracking-wider text-slate-500">
          Aperçu :
        </span>
        <span>{active.short}</span>
        {open ? <ChevronDown size={12} /> : <ChevronUp size={12} />}
      </button>
    </div>
  );
}
