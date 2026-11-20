'use client';

import React, { useState } from 'react';
import { usePlatform } from '@/context/PlatformContext';

export default function AthleteCheckInPage() {
  const { currentUser, store, submitCheckIn } = usePlatform();

  const [checkInDate, setCheckInDate] = useState(new Date().toISOString().split('T')[0]);
  const [rpe, setRpe] = useState<number>(6);
  const [fatigueLevel, setFatigueLevel] = useState<number>(2);
  const [sorenessLevel, setSorenessLevel] = useState<number>(2);
  const [painFlag, setPainFlag] = useState<boolean>(false);
  const [sensitiveArea, setSensitiveArea] = useState<string>('');
  const [comment, setComment] = useState<string>('');
  const [submitting, setSubmitting] = useState(false);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  if (!currentUser) return null;

  const myCheckIns = store.checkIns
    .filter((c) => c.userId === currentUser.id)
    .sort((a, b) => b.checkInDate.localeCompare(a.checkInDate));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setSuccessMsg(null);
    setSubmitting(true);

    try {
      await submitCheckIn({
        userId: currentUser.id,
        checkInDate,
        rpe,
        fatigueLevel,
        sorenessLevel,
        painFlag,
        sensitiveArea: painFlag ? sensitiveArea.trim() || undefined : undefined,
        comment: comment.trim() || undefined,
      });
      setSuccessMsg(
        painFlag
          ? 'Check-in enregistré avec alerte douleur transmise au coach.'
          : 'Check-in enregistré.'
      );
      setComment('');
      setSensitiveArea('');
      setPainFlag(false);
    } catch (err: unknown) {
      setErrorMsg(err instanceof Error ? err.message : 'Erreur enregistrement check-in.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 py-8 space-y-8">
      <div className="bg-white rounded-lg border border-slate-200 p-6 sm:p-8 space-y-6">
        <div className="pb-4 border-b border-slate-100">
          <p className="font-mono text-[10px] uppercase tracking-wider text-[#14C38E] font-semibold">
            CARNET DE RETOUR RAPIDE
          </p>
          <h1 className="text-2xl font-bold text-[#0F172A] mt-0.5">
            Nouveau Check-in Séance / Journée
          </h1>
        </div>

        {errorMsg && (
          <div className="p-3 rounded-md bg-red-50 border-l-2 border-red-600 text-xs font-semibold text-red-800">
            {errorMsg}
          </div>
        )}
        {successMsg && (
          <div className="p-3 rounded-md bg-emerald-50 border-l-2 border-[#14C38E] text-xs font-semibold text-[#047857]">
            {successMsg}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-5">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block font-mono text-[10px] uppercase text-slate-500 mb-1">
                Date
              </label>
              <input
                type="date"
                required
                value={checkInDate}
                onChange={(e) => setCheckInDate(e.target.value)}
                className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm font-mono"
              />
            </div>
            <div>
              <label className="block font-mono text-[10px] uppercase text-slate-500 mb-1">
                RPE Séance (1 à 10) : <strong className="text-[#FF5A36]">{rpe}/10</strong>
              </label>
              <input
                type="range"
                min={1}
                max={10}
                value={rpe}
                onChange={(e) => setRpe(Number(e.target.value))}
                className="w-full accent-[#FF5A36] mt-2"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
            <div>
              <label className="block font-mono text-[10px] uppercase text-slate-500 mb-2">
                Fatigue (1 Frais · 5 Épuisé)
              </label>
              <div className="grid grid-cols-5 border border-slate-300 rounded-md divide-x divide-slate-300 overflow-hidden">
                {[1, 2, 3, 4, 5].map((val) => (
                  <button
                    key={val}
                    type="button"
                    onClick={() => setFatigueLevel(val)}
                    className={`py-2 font-mono text-sm font-bold cursor-pointer ${
                      fatigueLevel === val
                        ? 'bg-[#0F172A] text-white'
                        : 'bg-white text-slate-600 hover:bg-slate-50'
                    }`}
                  >
                    {val}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="block font-mono text-[10px] uppercase text-slate-500 mb-2">
                Courbatures (1 Aucune · 5 Fortes)
              </label>
              <div className="grid grid-cols-5 border border-slate-300 rounded-md divide-x divide-slate-300 overflow-hidden">
                {[1, 2, 3, 4, 5].map((val) => (
                  <button
                    key={val}
                    type="button"
                    onClick={() => setSorenessLevel(val)}
                    className={`py-2 font-mono text-sm font-bold cursor-pointer ${
                      sorenessLevel === val
                        ? 'bg-[#0F172A] text-white'
                        : 'bg-white text-slate-600 hover:bg-slate-50'
                    }`}
                  >
                    {val}
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div
            className={`rounded-md border p-4 space-y-3 ${
              painFlag ? 'border-slate-300 border-l-2 border-l-red-600 bg-red-50/40' : 'border-slate-200 bg-[#F8FAFC]'
            }`}
          >
            <label className="flex items-center gap-2.5 cursor-pointer">
              <input
                type="checkbox"
                checked={painFlag}
                onChange={(e) => setPainFlag(e.target.checked)}
                className="h-4 w-4 accent-red-600"
              />
              <span className="text-sm font-semibold text-[#0F172A]">
                Signaler une douleur inhabituelle ou alerte tendineuse/articulaire
              </span>
            </label>

            {painFlag && (
              <div>
                <label className="block font-mono text-[10px] uppercase text-red-700 mb-1">
                  Localisation précise
                </label>
                <input
                  type="text"
                  value={sensitiveArea}
                  onChange={(e) => setSensitiveArea(e.target.value)}
                  placeholder="Ex: Genou externe gauche (TFL), Tendon d'Achille..."
                  className="w-full rounded-md border border-red-300 bg-white px-3 py-2 text-sm"
                />
              </div>
            )}
          </div>

          <div>
            <label className="block font-mono text-[10px] uppercase text-slate-500 mb-1">
              Commentaire terrain (sommeil, digestion, sensations)
            </label>
            <textarea
              rows={3}
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              placeholder="Ex: 65g glucides/h bien assimilés, bonne fluidité en descente."
              className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
            />
          </div>

          <button
            type="submit"
            disabled={submitting}
            className="px-5 py-2.5 rounded-md bg-[#FF5A36] hover:bg-[#E34A28] text-white font-semibold text-sm cursor-pointer disabled:opacity-50"
          >
            {submitting ? 'Enregistrement...' : 'Enregistrer'}
          </button>
        </form>
      </div>

      <div className="bg-white rounded-lg border border-slate-200 p-6 space-y-4">
        <h2 className="text-base font-bold text-[#0F172A]">Historique</h2>
        {myCheckIns.length === 0 ? (
          <p className="text-xs text-slate-500">Aucun check-in enregistré.</p>
        ) : (
          <div className="divide-y divide-slate-100">
            {myCheckIns.map((ci) => (
              <div
                key={ci.id}
                className={`py-3 text-xs ${ci.painFlag ? 'pl-3 border-l-2 border-red-600' : ''}`}
              >
                <div className="flex flex-wrap justify-between gap-2 font-mono font-semibold text-[#0F172A]">
                  <span>{ci.checkInDate}</span>
                  <span>
                    RPE {ci.rpe ?? '-'}/10 · FAT {ci.fatigueLevel ?? '-'}/5 · COURB{' '}
                    {ci.sorenessLevel ?? '-'}/5
                  </span>
                </div>
                {ci.painFlag && (
                  <p className="text-red-700 font-semibold mt-1">
                    Douleur : {ci.sensitiveArea || 'Signalée'}
                  </p>
                )}
                {ci.comment && <p className="text-slate-600 mt-1">{ci.comment}</p>}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
