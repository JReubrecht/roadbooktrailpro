'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { ArrowUpRight, Calendar, Send } from 'lucide-react';
import { BRAND_CONFIG } from '@/config/brand';
import { usePlatform } from '@/context/PlatformContext';

export default function HomeContactSection() {
  const { featureFlags, submitCoachingInquiry } = usePlatform();

  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [offerInterest, setOfferInterest] = useState<
    'coaching_1to1' | 'race_audit' | 'training_plan'
  >('coaching_1to1');
  const [weeklyHours, setWeeklyHours] = useState('7');
  const [goal, setGoal] = useState('');
  const [rgpdConsent, setRgpdConsent] = useState(false);
  const [marketingOptIn, setMarketingOptIn] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [formSuccess, setFormSuccess] = useState<string | null>(null);

  useEffect(() => {
    const onSelectOffer = (event: Event) => {
      const detail = (event as CustomEvent<'coaching_1to1' | 'race_audit'>).detail;
      if (detail === 'coaching_1to1' || detail === 'race_audit') {
        setOfferInterest(detail);
      }
    };
    window.addEventListener('mykairn:select-offer', onSelectOffer);
    return () => window.removeEventListener('mykairn:select-offer', onSelectOffer);
  }, []);

  const handleInquirySubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);
    setFormSuccess(null);

    if (!rgpdConsent) {
      setFormError('Veuillez accepter la politique de confidentialité pour envoyer votre demande.');
      return;
    }

    setSubmitting(true);
    try {
      await submitCoachingInquiry({
        name,
        email,
        offerInterest,
        goal,
        weeklyHours: weeklyHours ? Number(weeklyHours) : undefined,
        rgpdConsent: true,
        marketingOptIn,
      });
      setFormSuccess(
        'Votre demande a bien été enregistrée. Réponse personnalisée et proposition de créneau sous 48h ouvrées.'
      );
      setName('');
      setEmail('');
      setGoal('');
      setRgpdConsent(false);
    } catch (err: unknown) {
      setFormError(err instanceof Error ? err.message : "Erreur lors de l'envoi.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <section id="contact-bilan" className="max-w-7xl mx-auto px-4 sm:px-6 pt-20">
      <div className="bg-white border border-slate-200 rounded-lg p-6 sm:p-10 grid grid-cols-1 lg:grid-cols-12 gap-10">
        <div className="lg:col-span-5 space-y-5">
          <div className="space-y-3">
            <p className="font-mono text-[11px] uppercase tracking-[0.14em] text-[#FF5A36] font-semibold">
              06 / Prise de Contact
            </p>
            <h2 className="text-2xl sm:text-3xl font-bold tracking-[-0.02em] text-[#0F172A]">
              Démarrer votre accompagnement
            </h2>
            <p className="text-sm text-slate-600 leading-relaxed">
              Présentez votre prochaine course, votre disponibilité hebdomadaire et la formule envisagée.{' '}
              <span className="font-semibold text-[#0F172A]">
                {BRAND_CONFIG.booking.responseSlaLabel}.
              </span>
            </p>
          </div>

          {/* Carte Échange Découverte Visio */}
          <div className="rounded-md bg-[#F8FAFC] border border-slate-200 border-l-2 border-l-[#14C38E] p-4 space-y-2.5">
            <div className="flex items-center justify-between gap-2">
              <span className="inline-flex items-center gap-1.5 font-mono text-[11px] uppercase tracking-wider text-[#0F172A] font-semibold">
                <Calendar size={14} className="text-[#14C38E]" />
                Échange Découverte Visio
              </span>
              <span className="font-mono text-[10px] uppercase tracking-wider px-2 py-0.5 rounded bg-emerald-50 text-[#047857] border border-emerald-200 font-semibold">
                {BRAND_CONFIG.booking.discoveryCallDurationMin} MIN · GRATUIT
              </span>
            </div>

            <p className="text-xs text-slate-600 leading-relaxed">
              Réservé aux candidats au <strong>Coaching 1-to-1</strong> pour faire connaissance et vérifier l&apos;adéquation mutuelle (sans analyse de fichiers ni planification pendant cet échange). Pour une étude complète sur une course unique, choisissez le <strong>Pack Stratégie Jour J (89 €)</strong>.
            </p>

            {BRAND_CONFIG.booking.discoveryCallUrl && (
              <a
                href={BRAND_CONFIG.booking.discoveryCallUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-md bg-[#0F172A] hover:bg-[#FF5A36] text-white text-xs font-semibold transition-colors"
              >
                <span>Choisir un créneau visio ({BRAND_CONFIG.booking.discoveryCallDurationMin} min)</span>
                <ArrowUpRight size={14} />
              </a>
            )}
          </div>

          <div className="pt-4 border-t border-slate-200 space-y-2 text-xs text-slate-500">
            <p className="font-mono uppercase tracking-wider text-slate-400">Engagements RGPD</p>
            <p>
              Vos coordonnées et objectifs sont exclusivement destinés au traitement de votre demande de coaching. Aucune cession commerciale ni prospection tiers.
            </p>
          </div>
        </div>

        <form onSubmit={handleInquirySubmit} className="lg:col-span-7 space-y-4">
          {formError && (
            <div className="p-3 rounded-md bg-red-50 border-l-2 border-red-600 text-xs font-semibold text-red-800">
              {formError}
            </div>
          )}
          {formSuccess && (
            <div className="p-3 rounded-md bg-emerald-50 border-l-2 border-[#14C38E] text-xs font-semibold text-[#047857]">
              {formSuccess}
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Nom complet *
              </label>
              <input
                type="text"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Marc Dupont"
                className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:border-[#0F172A]"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Email *</label>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="marc@exemple.fr"
                className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:border-[#0F172A]"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Prestation souhaitée
              </label>
              <select
                value={offerInterest}
                onChange={(e) =>
                  setOfferInterest(
                    e.target.value as 'coaching_1to1' | 'race_audit' | 'training_plan'
                  )
                }
                className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm bg-white focus:outline-none focus:border-[#0F172A]"
              >
                <option value="coaching_1to1">Coaching Individuel 1-to-1 (avec échange 15 min)</option>
                <option value="race_audit">
                  Pack Stratégie Jour J &amp; Roadbook (89 € — 45 € déduits si passage en 1-to-1)
                </option>
                {featureFlags.programSalesEnabled && (
                  <option value="training_plan">Conseil choix d&apos;un Programme</option>
                )}
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Volume hebdo disponible (h)
              </label>
              <input
                type="number"
                min="1"
                max="35"
                value={weeklyHours}
                onChange={(e) => setWeeklyHours(e.target.value)}
                className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm font-mono focus:outline-none focus:border-[#0F172A]"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Objectif, date et historique récent *
            </label>
            <textarea
              rows={4}
              required
              value={goal}
              onChange={(e) => setGoal(e.target.value)}
              placeholder="Ex: UTMB TDS fin août (145 km / 9 100 m D+), 4 à 5 sorties/semaine, montre Garmin / Coros."
              className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:border-[#0F172A]"
            />
          </div>

          <div className="space-y-2 pt-1">
            <label className="flex items-start gap-2 text-xs text-slate-600 cursor-pointer">
              <input
                type="checkbox"
                checked={rgpdConsent}
                onChange={(e) => setRgpdConsent(e.target.checked)}
                required
                className="mt-0.5 h-4 w-4 accent-[#FF5A36]"
              />
              <span>
                J&apos;accepte le traitement de mes données pour répondre à ma demande, selon la{' '}
                <Link href="/legal/confidentialite" className="text-[#0F172A] underline font-semibold">
                  Politique de Confidentialité (RGPD)
                </Link>
                . *
              </span>
            </label>
            <label className="flex items-start gap-2 text-xs text-slate-600 cursor-pointer">
              <input
                type="checkbox"
                checked={marketingOptIn}
                onChange={(e) => setMarketingOptIn(e.target.checked)}
                className="mt-0.5 h-4 w-4 accent-[#FF5A36]"
              />
              <span>
                M&apos;informer lors de l&apos;ouverture des prochaines places coaching.
              </span>
            </label>
          </div>

          <button
            type="submit"
            disabled={submitting}
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-md bg-[#0F172A] hover:bg-[#FF5A36] text-white text-sm font-semibold disabled:opacity-50 cursor-pointer transition-colors"
          >
            <Send size={15} />
            <span>{submitting ? 'Envoi...' : 'Envoyer la demande'}</span>
          </button>
        </form>
      </div>
    </section>
  );
}
