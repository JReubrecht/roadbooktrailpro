'use client';

import React, { useState } from 'react';
import TrailToolsWorkspace from '@/components/trail/TrailToolsWorkspace';
import { usePlatform } from '@/context/PlatformContext';

export default function MemberRoadbooksPage() {
  const { currentUser, store } = usePlatform();
  const [selectedRoadbookId, setSelectedRoadbookId] = useState<string>('default');

  if (!currentUser) return null;

  const memberRoadbooks = store.roadbooks.filter(
    (r) => r.userId === currentUser.id || r.isPublic
  );

  const activeRoadbook =
    selectedRoadbookId === 'default'
      ? memberRoadbooks[0]
      : memberRoadbooks.find((r) => r.id === selectedRoadbookId);

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 py-8 space-y-6">
      {/* Sélecteur des Roadbooks sauvegardés du membre */}
      <div className="bg-white border border-slate-200 rounded-lg p-4 flex flex-wrap items-center justify-between gap-4 no-print">
        <div>
          <p className="font-mono text-[10px] uppercase tracking-wider text-slate-400">
            MES ROADBOOKS ENREGISTRÉS ({memberRoadbooks.length})
          </p>
          <p className="text-xs text-slate-600 mt-0.5">
            Chargez un roadbook existant ou importez un nouveau fichier `.gpx`.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {memberRoadbooks.map((rb) => {
            const selected = activeRoadbook?.id === rb.id;
            return (
              <button
                key={rb.id}
                type="button"
                onClick={() => setSelectedRoadbookId(rb.id)}
                className={`px-3 py-1.5 rounded-md text-xs font-semibold border cursor-pointer transition-colors ${
                  selected
                    ? 'bg-[#0F172A] text-white border-[#0F172A]'
                    : 'bg-[#F8FAFC] text-[#0F172A] border-slate-200 hover:border-slate-400'
                }`}
              >
                {rb.name}
              </button>
            );
          })}
        </div>
      </div>

      <TrailToolsWorkspace
        key={activeRoadbook?.id || 'fresh'}
        mode="member"
        initialRoadbook={activeRoadbook}
      />
    </div>
  );
}
