'use client';

import React, { useState } from 'react';
import { Heart, Send } from 'lucide-react';
import { usePlatform } from '@/context/PlatformContext';
import type { CommunityPostType } from '@/types/domain';

export default function CommunityPage() {
  const { currentUser, currentProfile, store, addCommunityPost, likeCommunityPost } = usePlatform();

  const [type, setType] = useState<CommunityPostType>('outing');
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [distanceKm, setDistanceKm] = useState('');
  const [elevationGainM, setElevationGainM] = useState('');
  const [locationLabel, setLocationLabel] = useState('');

  const handlePost = (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentUser || !title.trim() || !content.trim()) return;
    addCommunityPost({
      userId: currentUser.id,
      authorName: currentUser.displayName,
      authorTier: currentProfile?.tierStatus || 'free',
      type,
      title: title.trim(),
      content: content.trim(),
      distanceKm: distanceKm ? Number(distanceKm) : undefined,
      elevationGainM: elevationGainM ? Number(elevationGainM) : undefined,
      locationLabel: locationLabel.trim() || undefined,
    });
    setTitle('');
    setContent('');
    setDistanceKm('');
    setElevationGainM('');
    setLocationLabel('');
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 py-10 space-y-10">
      <div className="pb-6 border-b border-slate-200">
        <p className="font-mono text-[11px] uppercase tracking-[0.14em] text-[#FF5A36] font-semibold">
          COMMUNAUTÉ GROUPE TRAIL
        </p>
        <h1 className="text-3xl font-bold tracking-tight text-[#0F172A] mt-1">
          Défis Collectifs &amp; Retours Terrain
        </h1>
      </div>

      {/* Défis Collectifs */}
      <section className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {store.communityChallenges
          .filter((c) => c.isActive)
          .map((chal) => {
            const pct = Math.min(100, Math.round((chal.currentValue / chal.targetValue) * 100));
            return (
              <div
                key={chal.id}
                className="bg-white border border-slate-200 border-t-2 border-t-[#14C38E] rounded-lg p-6 space-y-4"
              >
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <p className="font-mono text-[10px] uppercase tracking-wider text-slate-400">
                      DÉFI ACTIF · {chal.participantsCount} PARTICIPANTS
                    </p>
                    <h2 className="text-lg font-bold text-[#0F172A] mt-1">{chal.title}</h2>
                  </div>
                  <span className="font-mono text-2xl font-bold text-[#FF5A36] tabular-nums">
                    {pct}%
                  </span>
                </div>

                <p className="text-xs text-slate-600 leading-relaxed">{chal.description}</p>

                <div className="space-y-1.5">
                  <div className="h-1.5 rounded-full bg-slate-100 overflow-hidden">
                    <div
                      className="h-full bg-[#14C38E]"
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                  <div className="flex justify-between font-mono text-[11px] text-slate-500 tabular-nums">
                    <span>
                      CUMULÉ : <strong className="text-[#0F172A]">{chal.currentValue.toLocaleString('fr-FR')}</strong>
                    </span>
                    <span>
                      CIBLE : {chal.targetValue.toLocaleString('fr-FR')}{' '}
                      {chal.metric === 'elevation_m' ? 'M D+' : 'KM'}
                    </span>
                  </div>
                </div>
              </div>
            );
          })}
      </section>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        <div className="lg:col-span-5">
          <div className="bg-white rounded-lg border border-slate-200 p-6 space-y-4 sticky top-24">
            <h2 className="text-base font-bold text-[#0F172A] border-b border-slate-100 pb-3">
              Partager une sortie ou trace
            </h2>

            {!currentUser ? (
              <p className="text-xs text-slate-500">
                Connectez-vous pour publier un compte-rendu de sortie.
              </p>
            ) : (
              <form onSubmit={handlePost} className="space-y-3 text-xs">
                <select
                  value={type}
                  onChange={(e) => setType(e.target.value as CommunityPostType)}
                  className="w-full rounded-md border border-slate-300 px-3 py-2 font-semibold bg-white"
                >
                  <option value="outing">Compte-rendu de sortie</option>
                  <option value="route">Partage de trace / itinéraire</option>
                  <option value="feedback">Retour nutrition / matériel</option>
                </select>
                <input
                  type="text"
                  required
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="Titre (ex: Traversée Belledonne 32 km)"
                  className="w-full rounded-md border border-slate-300 px-3 py-2"
                />
                <div className="grid grid-cols-3 gap-2 font-mono">
                  <input
                    type="number"
                    step="0.1"
                    value={distanceKm}
                    onChange={(e) => setDistanceKm(e.target.value)}
                    placeholder="km"
                    className="rounded-md border border-slate-300 px-2.5 py-2"
                  />
                  <input
                    type="number"
                    value={elevationGainM}
                    onChange={(e) => setElevationGainM(e.target.value)}
                    placeholder="D+ m"
                    className="rounded-md border border-slate-300 px-2.5 py-2"
                  />
                  <input
                    type="text"
                    value={locationLabel}
                    onChange={(e) => setLocationLabel(e.target.value)}
                    placeholder="Massif"
                    className="rounded-md border border-slate-300 px-2.5 py-2 font-sans"
                  />
                </div>
                <textarea
                  rows={3}
                  required
                  value={content}
                  onChange={(e) => setContent(e.target.value)}
                  placeholder="État du sentier, pacing, ravitaillement..."
                  className="w-full rounded-md border border-slate-300 px-3 py-2"
                />
                <button
                  type="submit"
                  className="inline-flex items-center gap-1.5 px-4 py-2 rounded-md bg-[#0F172A] hover:bg-[#FF5A36] text-white font-semibold cursor-pointer transition-colors"
                >
                  <Send size={13} /> Publier
                </button>
              </form>
            )}
          </div>
        </div>

        <div className="lg:col-span-7 divide-y divide-slate-200 bg-white border border-slate-200 rounded-lg">
          {store.communityPosts.map((post) => (
            <article key={post.id} className="p-6 space-y-3">
              <div className="flex items-center justify-between gap-2">
                <div>
                  <span className="font-bold text-sm text-[#0F172A]">{post.authorName}</span>
                  <span className="ml-2.5 font-mono text-[10px] uppercase tracking-wider text-slate-400">
                    {post.type === 'route'
                      ? 'PARCOURS'
                      : post.type === 'feedback'
                      ? 'RETOUR TERRAIN'
                      : 'SORTIE'}
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => likeCommunityPost(post.id)}
                  className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md border border-slate-200 hover:border-[#FF5A36] text-[#0F172A] font-mono text-xs font-semibold cursor-pointer"
                >
                  <Heart size={12} className="text-[#FF5A36]" /> {post.likesCount}
                </button>
              </div>

              <h3 className="text-base font-bold text-[#0F172A]">{post.title}</h3>
              <p className="text-sm text-slate-600 leading-relaxed">{post.content}</p>

              {(post.distanceKm || post.elevationGainM || post.locationLabel) && (
                <div className="flex flex-wrap gap-4 pt-1 font-mono text-xs text-slate-500 tabular-nums">
                  {post.distanceKm && <span>DIST {post.distanceKm} KM</span>}
                  {post.elevationGainM && (
                    <span className="text-[#14C38E] font-semibold">+{post.elevationGainM} M D+</span>
                  )}
                  {post.locationLabel && <span className="uppercase">{post.locationLabel}</span>}
                </div>
              )}
            </article>
          ))}
        </div>
      </div>
    </div>
  );
}
