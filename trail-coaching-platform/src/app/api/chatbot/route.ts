import { NextResponse } from 'next/server';
import { z } from 'zod';
import { chatbotRequestSchema } from '@/lib/validation/schemas';
import { calculateKmEffort, estimateRaceTargetHours } from '@/lib/trail/pacing';
import { calculateHourlyNutritionTargets } from '@/lib/trail/nutrition';

interface SuggestedLink {
  label: string;
  href: string;
}

type ChatbotPayload = z.infer<typeof chatbotRequestSchema>;

function formatDecimalHours(hours: number): string {
  const h = Math.floor(hours);
  const m = Math.round((hours - h) * 60);
  if (m === 60) return `${h + 1}h00`;
  return `${h}h${String(m).padStart(2, '0')}`;
}

function buildSystemPrompt(params: ChatbotPayload): string {
  const salesRule = params.programSalesEnabled
    ? 'La boutique de programmes autonomes est OUVERTE sur /catalog.'
    : 'La vente de programmes autonomes est MASQUÉE au public pour le moment : ne pas proposer /catalog ni vendre de plan autonome, orienter plutôt vers le Coaching 1-to-1 ou le Pack Stratégie Jour J.';

  const memberNote =
    params.contextMode === 'member' && params.athleteSummary
      ? `Utilisateur connecté : ${params.athleteSummary.displayName || 'Athlète'} | CTL ${
          params.athleteSummary.ctl ?? '-'
        } | ATL ${params.athleteSummary.atl ?? '-'} | TSB ${
          params.athleteSummary.tsb ?? '-'
        } | Volume 7j ${params.athleteSummary.weeklyDistanceKm ?? 0} km / +${
          params.athleteSummary.weeklyElevationM ?? 0
        } m | Alerte douleur : ${params.athleteSummary.hasPainAlert ? 'oui' : 'non'}.`
      : 'Visiteur public.';

  return [
    "Tu es l'Assistant Trail myKairn Coach. Réponds en français clair, concis et pragmatique (4 à 8 lignes max).",
    'Offres commerciales (Stratégie A) :',
    '- Outils GPX, carte interactive avec pointage de ravitaillements, km-effort Minetti et simulateur nutrition : 100 % gratuits sur /tools sans compte.',
    '- Pack Stratégie Jour J & Roadbook Sur-Mesure (89 €) : 3 livrables (analyse écrite de l’historique multi-sources, roadbook GPX calibré + barrières horaires/nuit, plan nutrition ravito par ravito + briefing 45 min), avec 45 € déduits du 1er mois si poursuite en Coaching 1-to-1 sous 15 jours.',
    '- Coaching Individuel Trail & Ultra 1-to-1 (129 €/mois sans engagement) : démarre par un échange découverte visio gratuit de 15 min strictement dédié à la prise de contact (pas d’analyse de fichiers pendant cet échange gratuit).',
    'Sources de données : le coach analyse toutes sources (Garmin, Coros, Suunto, Polar, Wahoo, Apple Watch, Strava, exports FIT/GPX/TCX). Ne mentionne jamais Intervals.icu comme argument commercial public.',
    salesRule,
    'Sécurité santé : ne pose jamais de diagnostic médical. En cas de douleur ou blessure, recommande le repos/avis médical et le check-in + messagerie coach.',
    memberNote,
  ].join('\n');
}

function buildLinksForIntent(
  text: string,
  contextMode: 'public' | 'member',
  programSalesEnabled: boolean
): SuggestedLink[] {
  const lower = text.toLowerCase();
  const links: SuggestedLink[] = [];

  if (/(gpx|carte|roadbook|ravito|allure|chrono|km|d\+|temps|itra|pente)/.test(lower)) {
    links.push({ label: 'Ouvrir Roadbook & Carte GPX', href: contextMode === 'member' ? '/athlete/roadbook' : '/tools' });
  }
  if (/(nutri|glucid|gel|boisson|sodium|sel|eau|hydrat|crampe|estomac)/.test(lower)) {
    links.push({ label: 'Simulateur Nutrition Trail', href: '/tools#nutrition-sim' });
  }
  if (/(tarif|prix|offre|coach|pack|appel|15 min|contact|inscri|audit|rdv)/.test(lower)) {
    links.push({ label: 'Voir les offres', href: '/#offres-coaching' });
    links.push({ label: 'Échange 15 min / Contact', href: '/#contact-bilan' });
  }
  if (programSalesEnabled && /(programme|plan)/.test(lower)) {
    links.push({ label: 'Catalogue Programmes', href: '/catalog' });
  }
  if (contextMode === 'member' && /(douleur|fatigue|blessure|check|charge|tsb|ctl|message|coach|groupe)/.test(lower)) {
    links.push({ label: 'Messagerie Coach & Groupes', href: '/messages' });
    links.push({ label: 'Faire un Check-in (30s)', href: '/athlete/check-in' });
  }

  if (links.length === 0) {
    links.push({ label: 'Outils GPX & Carte gratuits', href: '/tools' });
    links.push(
      contextMode === 'member'
        ? { label: 'Messagerie Coach', href: '/messages' }
        : { label: 'Découvrir les offres', href: '/#offres-coaching' }
    );
  }

  return links.slice(0, 3);
}

function runLocalTrailEngine(params: ChatbotPayload): {
  reply: string;
  suggestedLinks: SuggestedLink[];
} {
  const raw = params.message.trim();
  const lower = raw.toLowerCase();
  const isMember = params.contextMode === 'member';

  // 1. Calcul chrono / km-effort à la volée si chiffres détectés (ex: "55 km et 3200 d+")
  const distMatch = lower.match(/(\d+(?:[.,]\d+)?)\s*km/);
  const eleMatch =
    lower.match(/(?:d\+\s*[:=]?\s*)(\d{2,5})/) || lower.match(/(\d{3,5})\s*(?:m\s*d\+|m\b|d\+)/);
  const itraMatch = lower.match(/itra\s*[:=]?\s*(\d{3})/);

  if (distMatch) {
    const distKm = parseFloat(distMatch[1].replace(',', '.'));
    const elePosM = eleMatch ? parseInt(eleMatch[1], 10) : Math.round(distKm * 45);
    const itra = itraMatch ? Math.max(250, Math.min(950, parseInt(itraMatch[1], 10))) : 550;

    if (distKm >= 3 && distKm <= 400) {
      const kmEffort = calculateKmEffort(distKm, elePosM, elePosM);
      const targetH = estimateRaceTargetHours({
        distanceKm: distKm,
        elevationGainM: elePosM,
        itraIndex: itra,
      });

      const reply = [
        `Estimation rapide pour ${distKm} km / +${elePosM} m D+ (base ITRA ${itra}${itraMatch ? '' : ' par défaut'}) :`,
        `• Charge équivalente Minetti : ${kmEffort.toFixed(1)} km-effort`,
        `• Chrono indicatif (pauses incluses sur ultra) : environ ${formatDecimalHours(targetH)}`,
        `Importez votre trace .gpx dans le studio pour intégrer vos ravitaillements par pointage sur la carte, la nuit SunCalc et la météo.`,
      ].join('\n');

      return {
        reply,
        suggestedLinks: [
          {
            label: 'Simuler avec votre .GPX sur la carte',
            href: isMember ? '/athlete/roadbook' : '/tools',
          },
          { label: 'Simulateur Nutrition', href: '/tools#nutrition-sim' },
        ],
      };
    }
  }

  // 2. Nutrition / Hydratation / Sodium
  if (/(nutri|glucid|gel|boisson|sodium|sel|eau|hydrat|crampe|estomac|manger)/.test(lower)) {
    const hot = /(chaud|canicule|chaleur|été)/.test(lower);
    const cold = /(froid|hiver|neige)/.test(lower);
    const plan = calculateHourlyNutritionTargets({
      durationHours: 6,
      weather: hot ? 'chaud' : cold ? 'froid' : 'modere',
      gutTrainedLevel: 'standard',
    });

    const reply = [
      `Repères scientifiques trail (conditions ${hot ? 'chaudes' : cold ? 'froides' : 'modérées'}) :`,
      `• Glucides : ${plan.carbsGPerHour} g/h (jusqu'à 75–85 g/h avec entraînement digestif)`,
      `• Hydratation : ~${plan.waterMlPerHour} ml/h · Sodium : ~${plan.sodiumMgPerHour} mg/h`,
      plan.recommendationNote,
    ].join('\n');

    return {
      reply,
      suggestedLinks: [
        { label: 'Composer mon sac nutrition', href: '/tools#nutrition-sim' },
        { label: 'Outils Roadbook GPX', href: isMember ? '/athlete/roadbook' : '/tools' },
      ],
    };
  }

  // 3. Carte & pointage ravitaillements / GPX
  if (/(carte|map|gpx|roadbook|ravito|pointage|marqueur|barri[eè]re)/.test(lower)) {
    return {
      reply:
        "Dans l'outil Roadbook GPX (/tools ou Espace Membre > Mes Roadbooks), importez votre .gpx (ou testez la trace alpine 42 km), basculez entre fond OSM, Topo ou Satellite, puis cliquez directement sur la trace orange ou sur le profil altimétrique pour poser vos ravitaillements et régler chaque pause.",
      suggestedLinks: [
        {
          label: 'Ouvrir Carte & Roadbook GPX',
          href: isMember ? '/athlete/roadbook' : '/tools',
        },
      ],
    };
  }

  // 4. Montres & sources de données (Multi-sources)
  if (/(montre|garmin|coros|suunto|polar|wahoo|apple|strava|fit|donn[eé]e|source)/.test(lower)) {
    return {
      reply:
        'Toutes les montres et plateformes principales sont compatibles : Garmin, Coros, Suunto, Polar, Wahoo, Apple Watch, Strava et exports FIT/GPX/TCX. Vous conservez votre équipement et votre application habituels, sans aucun abonnement tiers payant requis.',
      suggestedLinks: [
        { label: 'Voir la méthode', href: '/#methode-coach' },
        { label: 'FAQ Compatibilité', href: '/#faq' },
      ],
    };
  }

  // 5. Tarifs, Stratégie A, Pack Jour J & Échange 15 min
  if (/(tarif|prix|co[uû]t|offre|coaching|pack|audit|appel|visio|15 min|rdv|contacter)/.test(lower)) {
    return {
      reply: [
        'Deux formules simples adaptées à votre besoin :',
        '• Coaching Individuel 1-to-1 (129 €/mois sans engagement) : suivi continu ajusté chaque semaine, démarrant par un échange découverte visio gratuit de 15 min (prise de contact & compatibilité, sans analyse de données).',
        '• Pack Stratégie Jour J & Roadbook Sur-Mesure (89 €) : analyse écrite de votre historique, roadbook GPX calibré, plan nutrition ravito par ravito + briefing 45 min — avec 45 € déduits du 1er mois si vous passez en 1-to-1 sous 15 jours.',
      ].join('\n'),
      suggestedLinks: [
        { label: 'Comparer les 2 formules', href: '/#offres-coaching' },
        { label: 'Prendre contact / Échange 15 min', href: '/#contact-bilan' },
      ],
    };
  }

  // 6. Programmes autonomes (respect feature flag)
  if (/(programme|plan|catalogue)/.test(lower)) {
    if (params.programSalesEnabled) {
      return {
        reply:
          'Des plans d’entraînement structurés (8 à 20 semaines, du 25 km au 100 Miles) sont disponibles au catalogue avec déblocage immédiat dans votre espace membre.',
        suggestedLinks: [{ label: 'Consulter le catalogue', href: '/catalog' }],
      };
    }
    return {
      reply:
        'La vente directe de programmes autonomes ouvrira prochainement. Pour préparer une course dès maintenant, vous pouvez opter pour le Coaching Individuel 1-to-1 (129 €/mois) ou le Pack Stratégie Jour J (89 €).',
      suggestedLinks: [
        { label: 'Voir Coaching & Pack Jour J', href: '/#offres-coaching' },
        { label: 'Prendre contact', href: '/#contact-bilan' },
      ],
    };
  }

  // 7. Santé / Douleur / Fatigue / Télémetrie membre
  if (/(douleur|blessure|mal|genou|mollet|tendon|fatigue|forme|ctl|tsb|hrv|check)/.test(lower)) {
    if (isMember && params.athleteSummary) {
      const s = params.athleteSummary;
      return {
        reply: [
          `Aperçu de votre suivi (${s.displayName || 'Athlète'}) : CTL ${s.ctl ?? '-'} · ATL ${s.atl ?? '-'} · TSB ${s.tsb ?? '-'} (${s.weeklyDistanceKm ?? 0} km / +${s.weeklyElevationM ?? 0} m sur 7j).`,
          'En cas de douleur persistante ou atypique, levez le pied et consultez un professionnel de santé. En parallèle, enregistrez un Check-in terrain (30s) et prévenez directement votre coach dans la messagerie pour adapter la charge.',
        ].join('\n'),
        suggestedLinks: [
          { label: 'Écrire au coach (/messages)', href: '/messages' },
          { label: 'Remplir un Check-in (30s)', href: '/athlete/check-in' },
        ],
      };
    }

    return {
      reply:
        "Attention : cet assistant ne fournit aucun avis médical. En cas de douleur aiguë ou persistante, interrompez l'effort et consultez un médecin du sport. Pour la pratique en compétition en France, un Parcours Prévention Santé (PPS) valide est requis.",
      suggestedLinks: [
        isMember
          ? { label: 'Signaler dans Check-in', href: '/athlete/check-in' }
          : { label: 'FAQ Santé & PPS', href: '/#faq' },
      ],
    };
  }

  // 8. Messagerie & Groupes (membre)
  if (/(message|chat|groupe|coach|communaut)/.test(lower) && isMember) {
    return {
      reply:
        'Votre espace Messagerie & Groupes (/messages) permet d’échanger en direct 1-to-1 avec votre coach, de participer aux groupes pilotes ou défis, et de partager vos roadbooks GPX directement dans la conversation.',
      suggestedLinks: [
        { label: 'Ouvrir Messagerie & Groupes', href: '/messages' },
        { label: 'Communauté & Défis', href: '/community' },
      ],
    };
  }

  // Réponse d'accueil / guidage générique
  return {
    reply: isMember
      ? "Je peux estimer un chrono sur une distance/D+ (ex: « 65 km 3800 d+ »), donner vos cibles glucides/sodium, ou vous guider vers votre messagerie coach, vos check-ins et vos roadbooks."
      : "Je peux calculer un chrono indicatif (ex: « 50 km 3000 d+ itra 580 »), préciser les repères nutrition trail, vérifier la compatibilité de votre montre ou vous présenter le Pack Stratégie Jour J (89 €) et le Coaching 1-to-1.",
    suggestedLinks: buildLinksForIntent(lower, params.contextMode, params.programSalesEnabled),
  };
}

export async function POST(request: Request) {
  try {
    const rawBody = await request.json().catch(() => null);
    const parsed = chatbotRequestSchema.safeParse(rawBody);

    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Requête assistant invalide.', details: parsed.error.flatten().fieldErrors },
        { status: 400 }
      );
    }

    const payload = parsed.data;
    const apiKey = process.env.GEMINI_API_KEY?.trim();

    if (apiKey) {
      try {
        const contents = [
          ...payload.history.slice(-6).map((h) => ({
            role: h.role === 'assistant' ? 'model' : 'user',
            parts: [{ text: h.content }],
          })),
          { role: 'user', parts: [{ text: payload.message }] },
        ];

        const geminiRes = await fetch(
          'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent',
          {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'x-goog-api-key': apiKey,
            },
            body: JSON.stringify({
              systemInstruction: {
                parts: [{ text: buildSystemPrompt(payload) }],
              },
              contents,
              generationConfig: {
                temperature: 0.35,
                maxOutputTokens: 450,
              },
            }),
            signal: AbortSignal.timeout(10000),
          }
        );

        if (geminiRes.ok) {
          const geminiData = (await geminiRes.json()) as {
            candidates?: Array<{
              content?: { parts?: Array<{ text?: string }> };
            }>;
          };
          const replyText = geminiData.candidates?.[0]?.content?.parts?.[0]?.text?.trim();
          if (replyText) {
            return NextResponse.json({
              reply: replyText,
              suggestedLinks: buildLinksForIntent(
                `${payload.message} ${replyText}`,
                payload.contextMode,
                payload.programSalesEnabled
              ),
              mode: 'gemini',
            });
          }
        }
      } catch (geminiErr) {
        console.warn('[API chatbot] Bascule moteur trail local:', geminiErr);
      }
    }

    const fallbackResult = runLocalTrailEngine(payload);
    return NextResponse.json({
      ...fallbackResult,
      mode: 'trail_engine',
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Erreur serveur chatbot.';
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
