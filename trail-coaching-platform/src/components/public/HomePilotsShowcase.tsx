'use client';

import React from 'react';
import { usePlatform } from '@/context/PlatformContext';

export default function HomePilotsShowcase() {
  const { store } = usePlatform();
  const featuredPilots = store.athleteProfiles.filter((p) => p.isShowcaseFeatured);

  return (
    <section className="max-w-7xl mx-auto px-4 sm:px-6 pt-20">
      <div className="pb-6 border-b border-slate-200">
        <p className="font-mono text-[11px] uppercase tracking-[0.14em] text-[#14C38E] font-semibold">
          04 / Validation Terrain
        </p>
        <h2 className="text-2xl sm:text-3xl font-bold tracking-[-0.02em] text-[#0F172A] mt-1.5">
          Retours de nos athlètes pilotes
        </h2>
      </div>

      <div className="mt-8 grid grid-cols-1 md:grid-cols-3 gap-6">
        {featuredPilots.map((pilot) => {
          const user = store.users.find((u) => u.id === pilot.userId);
          const snap = store.intervalsSnapshots
            .filter((s) => s.userId === pilot.userId)
            .sort((a, b) => b.snapshotDate.localeCompare(a.snapshotDate))[0];

          return (
            <article
              key={pilot.userId}
              className="bg-white border border-slate-200 rounded-lg p-6 flex flex-col justify-between space-y-5"
            >
              <div className="space-y-4">
                <div>
                  <div className="flex items-center justify-between gap-2">
                    <h3 className="font-bold text-base text-[#0F172A]">
                      {user?.displayName || 'Athlète Pilote'}
                    </h3>
                    <span className="font-mono text-[10px] uppercase tracking-wider px-2 py-0.5 rounded-sm bg-slate-100 text-slate-600">
                      PILOTE
                    </span>
                  </div>
                  <p className="text-xs font-medium text-[#FF5A36] mt-0.5">
                    {pilot.showcaseGoalRace || 'Suivi pilote Trail'}
                  </p>
                </div>

                {pilot.showcaseOutcome && (
                  <p className="text-xs font-semibold text-[#0F172A] bg-[#F8FAFC] border border-slate-200 rounded-md px-3 py-2">
                    {pilot.showcaseOutcome}
                  </p>
                )}

                {pilot.showcaseQuote && (
                  <blockquote className="text-sm text-slate-600 leading-relaxed border-l-2 border-[#FF5A36] pl-3.5">
                    &ldquo;{pilot.showcaseQuote}&rdquo;
                  </blockquote>
                )}
              </div>

              <div className="pt-4 border-t border-slate-100 grid grid-cols-3 gap-2 font-mono text-xs tabular-nums">
                <div>
                  <span className="block text-[10px] text-slate-400">ITRA</span>
                  <span className="font-bold text-[#0F172A]">{pilot.trailIndex ?? '-'}</span>
                </div>
                <div>
                  <span className="block text-[10px] text-slate-400">CTL</span>
                  <span className="font-bold text-[#0F172A]">{snap?.ctl ?? '-'}</span>
                </div>
                <div>
                  <span className="block text-[10px] text-slate-400">VOL 7J</span>
                  <span className="font-bold text-[#14C38E]">
                    {snap?.weeklyElevationM ? `+${snap.weeklyElevationM}m` : '-'}
                  </span>
                </div>
              </div>
            </article>
          );
        })}
      </div>
    </section>
  );
}
