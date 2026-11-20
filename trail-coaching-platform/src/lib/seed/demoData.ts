import type {
  AthleteProfile,
  ChatMessage,
  ChatRoom,
  CheckIn,
  CoachingInquiry,
  CommunityChallenge,
  CommunityPost,
  Entitlement,
  IntervalsConnectionPublic,
  IntervalsSnapshot,
  Order,
  RoadbookDoc,
  TrainingPlan,
  UserDoc,
} from '@/types/domain';
import { getSampleAlpineTrailTrace } from '@/lib/trail/roadbook';

export interface PlatformStoreState {
  users: UserDoc[];
  athleteProfiles: AthleteProfile[];
  intervalsConnections: IntervalsConnectionPublic[];
  intervalsSnapshots: IntervalsSnapshot[];
  checkIns: CheckIn[];
  trainingPlans: TrainingPlan[];
  orders: Order[];
  entitlements: Entitlement[];
  communityChallenges: CommunityChallenge[];
  communityPosts: CommunityPost[];
  roadbooks: RoadbookDoc[];
  coachingInquiries: CoachingInquiry[];
  chatRooms: ChatRoom[];
  chatMessages: ChatMessage[];
}

function isoDaysAgo(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() - days);
  return d.toISOString().split('T')[0];
}

export function createInitialDemoState(): PlatformStoreState {
  const sampleTrace = getSampleAlpineTrailTrace();
  const today = isoDaysAgo(0);
  const yesterday = isoDaysAgo(1);
  const twoDaysAgo = isoDaysAgo(2);

  const users: UserDoc[] = [
    {
      id: 'coach-admin-1',
      email: 'coach@mykairn.fr',
      displayName: 'Coach myKairn',
      role: 'coach',
      createdAt: '2026-01-10T09:00:00.000Z',
      updatedAt: new Date().toISOString(),
    },
    {
      id: 'pilot-claire',
      email: 'claire.morel@exemple.fr',
      displayName: 'Claire Morel',
      role: 'athlete',
      consents: {
        termsAcceptedAt: '2026-09-01T10:00:00.000Z',
        privacyAcceptedAt: '2026-09-01T10:00:00.000Z',
        healthDataConsentAt: '2026-09-01T10:05:00.000Z',
        marketingOptIn: true,
      },
      createdAt: '2026-09-01T10:00:00.000Z',
      updatedAt: new Date().toISOString(),
    },
    {
      id: 'pilot-thomas',
      email: 'thomas.garnier@exemple.fr',
      displayName: 'Thomas Garnier',
      role: 'athlete',
      consents: {
        termsAcceptedAt: '2026-09-05T14:00:00.000Z',
        privacyAcceptedAt: '2026-09-05T14:00:00.000Z',
        healthDataConsentAt: '2026-09-05T14:10:00.000Z',
        marketingOptIn: false,
      },
      createdAt: '2026-09-05T14:00:00.000Z',
      updatedAt: new Date().toISOString(),
    },
    {
      id: 'pilot-lucie',
      email: 'lucie.bertrand@exemple.fr',
      displayName: 'Lucie Bertrand',
      role: 'athlete',
      consents: {
        termsAcceptedAt: '2026-09-12T08:30:00.000Z',
        privacyAcceptedAt: '2026-09-12T08:30:00.000Z',
        healthDataConsentAt: '2026-09-12T08:35:00.000Z',
        marketingOptIn: true,
      },
      createdAt: '2026-09-12T08:30:00.000Z',
      updatedAt: new Date().toISOString(),
    },
    {
      id: 'athlete-free-demo',
      email: 'decouverte@exemple.fr',
      displayName: 'Camille Laurent',
      role: 'athlete',
      consents: {
        termsAcceptedAt: '2026-11-01T12:00:00.000Z',
        privacyAcceptedAt: '2026-11-01T12:00:00.000Z',
        marketingOptIn: false,
      },
      createdAt: '2026-11-01T12:00:00.000Z',
      updatedAt: new Date().toISOString(),
    },
  ];

  const athleteProfiles: AthleteProfile[] = [
    {
      userId: 'pilot-claire',
      tierStatus: 'pilot_showcase',
      isShowcaseFeatured: true,
      showcaseGoalRace: 'SaintéLyon 82 km · Objectif Top 15 F',
      showcaseOutcome: '7h42 réalisées (-28 min vs roadbook initial) · 0 problème digestif',
      showcaseBio:
        'Traileuse semi-alpine, 7 à 9h d’entraînement hebdo. Suivi charge/HRV multi-sources + gestion glucidique 75 g/h.',
      showcaseQuote:
        'La double calibration charge physiologique + Roadbook m’a évité de partir trop vite dans les 30 premiers kilomètres. Mon pacing était chirurgical.',
      weightKg: 57,
      restingHr: 46,
      maxHr: 186,
      lthr: 169,
      vmaKmh: 16.4,
      trailIndex: 635,
      notesCoach:
        'Très bonne assimilation du bloc seuil en côte. Attention au mollet droit après les séances techniques en descente.',
      updatedAt: new Date().toISOString(),
    },
    {
      userId: 'pilot-thomas',
      tierStatus: 'pilot_showcase',
      isShowcaseFeatured: true,
      showcaseGoalRace: 'CCC Mont-Blanc 101 km / 6 100 m D+',
      showcaseOutcome: 'Finisher en 16h18 · Transitions ravitos optimisées (-22 min)',
      showcaseBio:
        'Coureur d’ultra-endurance avec contraintes familiales fortes (4 séances ciblées + rando-course weekend).',
      showcaseQuote:
        'Avoir mes alertes de fatigue et mon carnet de retour reliés au coach permet d’ajuster la charge dès qu’une gêne apparaît.',
      weightKg: 73,
      restingHr: 49,
      maxHr: 181,
      lthr: 162,
      vmaKmh: 15.6,
      trailIndex: 590,
      notesCoach:
        'Surveiller le TSB (-28 aujourd’hui) et la douleur signalée au tendon d’Achille gauche -> basculer la séance du jeudi sur vélo/home-trainer.',
      updatedAt: new Date().toISOString(),
    },
    {
      userId: 'pilot-lucie',
      tierStatus: 'pilot_showcase',
      isShowcaseFeatured: true,
      showcaseGoalRace: 'Marathon du Mont-Blanc 42 km / 2 540 m D+',
      showcaseOutcome: 'Progression +42 pts ITRA en 12 semaines · Record VAM 1 180 m/h',
      showcaseBio:
        'Ancienne marathonienne route en transition vers le trail technique alpin.',
      showcaseQuote:
        'J’ai appris à gérer mes transitions marche/course sur les pentes >14 % et à me ravitailler toutes les 20 minutes.',
      weightKg: 54,
      restingHr: 44,
      maxHr: 190,
      lthr: 173,
      vmaKmh: 17.1,
      trailIndex: 660,
      notesCoach:
        'Excellente fraîcheur (TSB +4) à l’approche du bloc d’affûtage. Conserver 2 rappels de VAM courte.',
      updatedAt: new Date().toISOString(),
    },
    {
      userId: 'athlete-free-demo',
      tierStatus: 'free',
      isShowcaseFeatured: false,
      weightKg: 66,
      restingHr: 54,
      maxHr: 184,
      trailIndex: 515,
      updatedAt: new Date().toISOString(),
    },
  ];

  const intervalsConnections: IntervalsConnectionPublic[] = [
    {
      userId: 'pilot-claire',
      intervalsAthleteId: 'i412890',
      authMode: 'api_key',
      hasSecret: true,
      syncStatus: 'ok',
      lastSyncedAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    },
    {
      userId: 'pilot-thomas',
      intervalsAthleteId: 'i508231',
      authMode: 'api_key',
      hasSecret: true,
      syncStatus: 'ok',
      lastSyncedAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    },
    {
      userId: 'pilot-lucie',
      intervalsAthleteId: 'i619442',
      authMode: 'api_key',
      hasSecret: true,
      syncStatus: 'ok',
      lastSyncedAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    },
  ];

  const intervalsSnapshots: IntervalsSnapshot[] = [
    {
      id: `pilot-claire_${today}`,
      userId: 'pilot-claire',
      snapshotDate: today,
      ctl: 68,
      atl: 74,
      tsb: -6,
      rampRate: 3.2,
      weeklyDistanceKm: 64.5,
      weeklyElevationM: 2850,
      weeklyDurationMin: 465,
      wellnessReadiness: 78,
      restingHrObserved: 46,
      hrvRmssd: 74,
      compliancePct: 96,
      fetchedAt: new Date().toISOString(),
    },
    {
      id: `pilot-claire_${twoDaysAgo}`,
      userId: 'pilot-claire',
      snapshotDate: twoDaysAgo,
      ctl: 66,
      atl: 70,
      tsb: -4,
      rampRate: 2.8,
      weeklyDistanceKm: 58.2,
      weeklyElevationM: 2410,
      weeklyDurationMin: 420,
      wellnessReadiness: 81,
      restingHrObserved: 45,
      hrvRmssd: 78,
      compliancePct: 94,
      fetchedAt: new Date().toISOString(),
    },
    {
      id: `pilot-thomas_${today}`,
      userId: 'pilot-thomas',
      snapshotDate: today,
      ctl: 74,
      atl: 102,
      tsb: -28,
      rampRate: 6.4,
      weeklyDistanceKm: 82.0,
      weeklyElevationM: 4320,
      weeklyDurationMin: 615,
      wellnessReadiness: 49,
      restingHrObserved: 54,
      hrvRmssd: 42,
      compliancePct: 89,
      fetchedAt: new Date().toISOString(),
    },
    {
      id: `pilot-lucie_${today}`,
      userId: 'pilot-lucie',
      snapshotDate: today,
      ctl: 62,
      atl: 58,
      tsb: 4,
      rampRate: 1.1,
      weeklyDistanceKm: 54.0,
      weeklyElevationM: 2150,
      weeklyDurationMin: 390,
      wellnessReadiness: 86,
      restingHrObserved: 44,
      hrvRmssd: 88,
      compliancePct: 100,
      fetchedAt: new Date().toISOString(),
    },
  ];

  const checkIns: CheckIn[] = [
    {
      id: 'ci-thomas-1',
      userId: 'pilot-thomas',
      checkInDate: today,
      rpe: 9,
      fatigueLevel: 4,
      sorenessLevel: 4,
      sensitiveArea: "Tendon d'Achille gauche",
      painFlag: true,
      comment:
        'Sortie longue 26 km / 1 500 m D+ bien passée jusqu’au km 20, tiraillement au tendon d’Achille sur les dernières descentes.',
      createdAt: new Date().toISOString(),
    },
    {
      id: 'ci-claire-1',
      userId: 'pilot-claire',
      checkInDate: yesterday,
      rpe: 7,
      fatigueLevel: 2,
      sorenessLevel: 2,
      painFlag: false,
      comment:
        'Séance seuil en côte 6 x 4 min à 15 % validée dans la cible FC. Très bonnes sensations digestives avec 70 g glucides/h.',
      createdAt: new Date().toISOString(),
    },
    {
      id: 'ci-lucie-1',
      userId: 'pilot-lucie',
      checkInDate: yesterday,
      rpe: 6,
      fatigueLevel: 2,
      sorenessLevel: 1,
      painFlag: false,
      comment: 'Footing de récupération fluide, jambes légères en montée.',
      createdAt: new Date().toISOString(),
    },
  ];

  const trainingPlans: TrainingPlan[] = [
    {
      id: 'plan-trail-42k',
      slug: 'plan-trail-42k-montagne-12-semaines',
      title: 'Préparation Trail 42 km & Marathon Alpin',
      subtitle: '12 semaines · 4 à 5 séances/semaine · Pacing & VAM en côte',
      description:
        'Programme complet conçu pour performer sur un format 35–50 km exigeant (2 000 à 3 000 m D+). Inclut le développement VMA en côte, la résistance excentrique en descente, les week-ends chocs ciblés et le calibrage complet de votre Roadbook.',
      targetDistanceKm: 42,
      targetElevationM: 2500,
      durationWeeks: 12,
      level: 'Intermédiaire',
      priceCents: 6900,
      currency: 'EUR',
      status: 'published',
      content: {
        summary:
          'Progression polarisée sur 3 mésocycles : développement aérobie & économie de marche en côte, seuil spécifique trail et affûtage.',
        prerequisites:
          'Courir régulièrement 3 fois/semaine depuis au moins 6 mois et valider 15 km / 600 m D+ sans gêne.',
        nutritionGuidelines:
          'Viser 60 à 75 g de glucides/heure dès 1h30 d’effort avec entraînement gastrique (Gut Training) intégré aux sorties longues S5 à S10.',
        roadbookAdvice:
          'Utilisez un profil de pacing régulier sur les 20 premiers kilomètres et maintenez la marche active dès 12–14 % de pente.',
        weeklyStructure: [
          {
            weekNumber: 1,
            phase: 'Base',
            focus: 'Endurance fondamentale & proprioception cheville',
            targetHours: 5.5,
            targetElevationM: 1100,
            keySessions: ['45 min EF vallonnée + gammes', 'Côtes courtes 10 x 45s @ Z5', 'Sortie longue 1h45 Z2'],
          },
          {
            weekNumber: 5,
            phase: 'Build',
            focus: 'Puissance ascensionnelle & transitions marche/course',
            targetHours: 7.0,
            targetElevationM: 1900,
            keySessions: ['Seuil en côte 4 x 6 min @ 12–16%', 'Travail excentrique quadriceps', 'Sortie longue 2h45 test nutrition'],
          },
          {
            weekNumber: 9,
            phase: 'Peak',
            focus: 'Week-end choc montagne & enchaînement fatigue',
            targetHours: 9.0,
            targetElevationM: 2800,
            keySessions: ['Rappel VMA 2 x (8 x 30/30)', 'Enchaînement Samedi 2h30 + Dimanche 3h15 D+'],
          },
          {
            weekNumber: 12,
            phase: 'Taper',
            focus: 'Surcompensation, fraîcheur neuromusculaire & stratégie Roadbook',
            targetHours: 3.5,
            targetElevationM: 500,
            keySessions: ['40 min EF + 4 x 1 min allure course', 'Validation finale du caddie ravitos'],
          },
        ],
      },
      createdAt: '2026-10-01T10:00:00.000Z',
      updatedAt: new Date().toISOString(),
    },
    {
      id: 'plan-ultra-80k',
      slug: 'plan-ultra-80k-ccc-16-semaines',
      title: 'Objectif Ultra-Trail 80–100 km (Format CCC)',
      subtitle: '16 semaines · Endurance lipidique, nuit & rando-course',
      description:
        'Plan structuré pour passer la barre des 80 à 110 km en montagne tout en préservant l’intégrité musculaire et digestive jusqu’à l’arrivée.',
      targetDistanceKm: 90,
      targetElevationM: 5200,
      durationWeeks: 16,
      level: 'Confirmé',
      priceCents: 9900,
      currency: 'EUR',
      status: 'published',
      content: {
        summary:
          'Structuration de la durabilité musculaire : sortie longue progressive, entraînement croisé vélo, gestion nocturne et stratégie de ravitaillements.',
        prerequisites: 'Avoir déjà bouclé un trail de 45 km ou plus sur les 12 derniers mois.',
        nutritionGuidelines:
          '60 à 70 g/h en début de course, bascule progressive vers apports semi-solides et salés après 6h d’effort (450 à 700 mg sodium/h).',
        roadbookAdvice:
          'Planifier les pauses en base de vie (6–10 min max) et appliquer un facteur prudent sur le dernier tiers pour limiter la dérive cardiaque.',
        weeklyStructure: [
          {
            weekNumber: 1,
            phase: 'Base',
            focus: 'Volume aérobie basse intensité & renforcement excentrique',
            targetHours: 7.0,
            targetElevationM: 1600,
            keySessions: ['Vélo récupération active 1h15', 'Côte tempo 3 x 10 min', 'Sortie longue 2h30 bâtons'],
          },
          {
            weekNumber: 8,
            phase: 'Build',
            focus: 'Spécifique dénivelé & gestion de pente raide',
            targetHours: 9.5,
            targetElevationM: 3100,
            keySessions: ['Seuil D+ 1 000 m continu', 'Rando-course 4h en terrain technique'],
          },
          {
            weekNumber: 13,
            phase: 'Peak',
            focus: 'Simulation nocturne & validation équipement/nutrition',
            targetHours: 11.0,
            targetElevationM: 3800,
            keySessions: ['Sortie crépuscule/nuit 3h avec frontale', 'Test complet Roadbook + flasques'],
          },
          {
            weekNumber: 16,
            phase: 'Taper',
            focus: 'Affûtage complet & charge glycogénique douce',
            targetHours: 4.0,
            targetElevationM: 600,
            keySessions: ['35 min déblocage léger + lignes droites', 'Check-list matériel & barrières horaires'],
          },
        ],
      },
      createdAt: '2026-10-05T10:00:00.000Z',
      updatedAt: new Date().toISOString(),
    },
    {
      id: 'plan-ultra-100m',
      slug: 'plan-100-miles-utmb-20-semaines',
      title: 'Préparation 100 Miles / UTMB (160–175 km)',
      subtitle: '20 semaines · Durabilité extrême, sommeil & double nuit',
      description:
        'Plan expert pensé pour les coureurs visant un 100 Miles montagnard. Met l’accent sur la tolérance gastrique longue durée, l’enchaînement de blocs week-end et la gestion des micro-siestes.',
      targetDistanceKm: 170,
      targetElevationM: 10000,
      durationWeeks: 20,
      level: 'Expert Ultra',
      priceCents: 13900,
      currency: 'EUR',
      status: 'published',
      content: {
        summary:
          'Micro-périodisation compatible avec une vie active grâce au croisement vélo/trail et aux week-ends chocs millimétrés.',
        prerequisites: 'Expérience validée sur un ultra de 80 à 110 km.',
        nutritionGuidelines:
          '55–65 g/h réguliers, bouillons salés et purées aux bases de vie pour prévenir l’écoeurement sucré.',
        roadbookAdvice:
          'Découpage prioritaire entre grandes bases de vie avec marge de sécurité de 45 min minimum avant les barrières horaires tardives.',
        weeklyStructure: [
          {
            weekNumber: 1,
            phase: 'Base',
            focus: 'Reconstruction foncière & économie gestuelle bâtons',
            targetHours: 8.5,
            targetElevationM: 2200,
            keySessions: ['Home-trainer vélocité Z2', 'Sortie longue 3h avec bâtons'],
          },
          {
            weekNumber: 11,
            phase: 'Build',
            focus: 'Blocs D+ cumulés & entraînement croisé',
            targetHours: 12.0,
            targetElevationM: 4800,
            keySessions: ['Sortie vélo 3h Z2 + enchaînement CAP 45 min', 'Montée/descente répétée 2 000 m D+'],
          },
          {
            weekNumber: 17,
            phase: 'Peak',
            focus: 'Ultra week-end de répétition générale (nuit incluse)',
            targetHours: 14.0,
            targetElevationM: 5800,
            keySessions: ['Sortie nuit/aube 5h en autonomie', 'Récupération active + mobilité'],
          },
          {
            weekNumber: 20,
            phase: 'Taper',
            focus: 'Repos complet & sérénité mentale',
            targetHours: 4.0,
            targetElevationM: 400,
            keySessions: ['2 x 30 min souples', 'Validation des temps de passage'],
          },
        ],
      },
      createdAt: '2026-10-12T10:00:00.000Z',
      updatedAt: new Date().toISOString(),
    },
    {
      id: 'plan-decouverte-25k',
      slug: 'plan-premier-trail-25k-8-semaines',
      title: 'Mon Premier Trail 20–25 km',
      subtitle: '8 semaines · 3 séances/semaine · Découverte & plaisir en sentier',
      description:
        'Idéal pour passer de la route ou de la course loisir au trail nature en toute sécurité, sans blessure ni coup de pompe.',
      targetDistanceKm: 24,
      targetElevationM: 900,
      durationWeeks: 8,
      level: 'Découverte',
      priceCents: 3900,
      currency: 'EUR',
      status: 'published',
      content: {
        summary:
          '3 séances lisibles par semaine avec apprentissage de la pose de pied en descente et gestion de l’effort en côte.',
        prerequisites: 'Pouvoir courir 45 minutes en aisance respiratoire sur terrain plat.',
        nutritionGuidelines:
          '500 ml d’eau/boisson isotonique par heure + 1 gel ou pâte de fruits toutes les 45 minutes.',
        roadbookAdvice:
          'Placez 1 à 2 ravitaillements intermédiaires et adoptez un rythme prudent dans le premier tiers.',
        weeklyStructure: [
          {
            weekNumber: 1,
            phase: 'Base',
            focus: 'Prise de repères en nature & travail de pied',
            targetHours: 3.5,
            targetElevationM: 450,
            keySessions: ['40 min EF souple', '8 x 30s côte facile', 'Sortie 1h15 en forêt'],
          },
          {
            weekNumber: 5,
            phase: 'Build',
            focus: 'Allonger la sortie et gérer les relances',
            targetHours: 4.5,
            targetElevationM: 750,
            keySessions: ['Fartlek nature 5 x 3 min', 'Sortie vallonnée 1h45'],
          },
        ],
      },
      createdAt: '2026-10-18T10:00:00.000Z',
      updatedAt: new Date().toISOString(),
    },
  ];

  const entitlements: Entitlement[] = [
    {
      id: 'ent-pilot-claire',
      userId: 'pilot-claire',
      grantType: 'coaching_access',
      source: 'pilot_showcase',
      startsAt: '2026-09-01T00:00:00.000Z',
      isActive: true,
      createdAt: '2026-09-01T00:00:00.000Z',
    },
    {
      id: 'ent-pilot-claire-plan',
      userId: 'pilot-claire',
      grantType: 'plan_access',
      trainingPlanId: 'plan-ultra-80k',
      source: 'pilot_showcase',
      startsAt: '2026-09-01T00:00:00.000Z',
      isActive: true,
      createdAt: '2026-09-01T00:00:00.000Z',
    },
    {
      id: 'ent-pilot-thomas',
      userId: 'pilot-thomas',
      grantType: 'coaching_access',
      source: 'pilot_showcase',
      startsAt: '2026-09-05T00:00:00.000Z',
      isActive: true,
      createdAt: '2026-09-05T00:00:00.000Z',
    },
    {
      id: 'ent-pilot-lucie',
      userId: 'pilot-lucie',
      grantType: 'coaching_access',
      source: 'pilot_showcase',
      startsAt: '2026-09-12T00:00:00.000Z',
      isActive: true,
      createdAt: '2026-09-12T00:00:00.000Z',
    },
  ];

  const communityChallenges: CommunityChallenge[] = [
    {
      id: 'chal-dplus-nov',
      title: 'Défi Collectif Ascension — 50 000 m D+',
      description:
        'Cumulons ensemble 50 000 mètres de dénivelé positif sur nos sorties sentier du mois avant les grands blocs hivernaux.',
      metric: 'elevation_m',
      targetValue: 50000,
      currentValue: 34850,
      participantsCount: 18,
      startDate: isoDaysAgo(20),
      endDate: isoDaysAgo(-10),
      isActive: true,
    },
    {
      id: 'chal-volume-km',
      title: 'Endurance Automnale — 1 500 km de groupe',
      description:
        'Construire la cylindrée aérobie en Zone 2 sans brûler les cartouches avant la reprise spécifique.',
      metric: 'distance_km',
      targetValue: 1500,
      currentValue: 1120,
      participantsCount: 24,
      startDate: isoDaysAgo(15),
      endDate: isoDaysAgo(-15),
      isActive: true,
    },
  ];

  const communityPosts: CommunityPost[] = [
    {
      id: 'post-1',
      userId: 'pilot-claire',
      authorName: 'Claire Morel',
      authorTier: 'pilot_showcase',
      type: 'feedback',
      title: 'Validation protocole 75 g glucides/h sur sortie 3h10',
      content:
        'Zéro inconfort gastrique malgré 1 650 m D+. Le fractionnement toutes les 20 min avec Maurten Drink Mix + 1 gel fonctionne nettement mieux que d’attendre les ravitos.',
      distanceKm: 29.4,
      elevationGainM: 1650,
      locationLabel: 'Chartreuse',
      likesCount: 9,
      createdAt: yesterday + 'T17:30:00.000Z',
    },
    {
      id: 'post-2',
      userId: 'pilot-lucie',
      authorName: 'Lucie Bertrand',
      authorTier: 'pilot_showcase',
      type: 'route',
      title: 'Trace propre autour des Aiguilles Rouges (18 km / 1 150 m D+)',
      content:
        'Sentier sec jusqu’à 2 100 m ce matin, parfait pour caler du seuil en côte à 12–15 % puis travail d’appuis rapides en descente.',
      distanceKm: 18.2,
      elevationGainM: 1150,
      locationLabel: 'Chamonix',
      likesCount: 7,
      createdAt: twoDaysAgo + 'T11:15:00.000Z',
    },
  ];

  const roadbooks: RoadbookDoc[] = [
    {
      id: 'rb-demo-alpine',
      userId: 'pilot-claire',
      name: sampleTrace.name,
      officialDistanceKm: 42,
      officialElevationM: 2650,
      itraIndex: 635,
      fatiguePercent: 18,
      pacingStrategy: 'regular',
      weather: 'modere',
      startTimeIso: `${today}T06:00`,
      isPublic: true,
      points: sampleTrace.points,
      waypoints: sampleTrace.waypoints,
      updatedAt: new Date().toISOString(),
    },
  ];

  const chatRooms: ChatRoom[] = [
    {
      id: 'room-dm-claire',
      type: 'direct',
      name: 'Claire Morel',
      memberIds: ['coach-admin-1', 'pilot-claire'],
      createdBy: 'coach-admin-1',
      pinnedMessage: 'Objectif SaintéLyon 82 km : priorité tolérance digestive à 75 g/h sur bloc 3h.',
      lastMessageAt: `${yesterday}T19:10:00.000Z`,
      lastMessagePreview: 'Parfait pour le fractionné en côte jeudi matin, je valide le roadbook.',
      unreadBy: { 'coach-admin-1': 0, 'pilot-claire': 0 },
      createdAt: '2026-10-01T09:00:00.000Z',
    },
    {
      id: 'room-dm-thomas',
      type: 'direct',
      name: 'Thomas Garnier',
      memberIds: ['coach-admin-1', 'pilot-thomas'],
      createdBy: 'coach-admin-1',
      pinnedMessage: 'Semaine de récupération : pas de descentes rapides tant que le TFL reste sensible.',
      lastMessageAt: `${today}T08:15:00.000Z`,
      lastMessagePreview: 'Sensibilité latérale du genou sur les 20 dernières minutes de descente.',
      unreadBy: { 'coach-admin-1': 1, 'pilot-thomas': 0 },
      createdAt: '2026-10-03T10:00:00.000Z',
    },
    {
      id: 'room-group-pilots',
      type: 'group',
      name: 'Groupe Pilotes myKairn',
      description: 'Échanges terrain, tests matériel, nutrition & retours de reconnaissance.',
      memberIds: ['coach-admin-1', 'pilot-claire', 'pilot-thomas', 'pilot-lucie'],
      createdBy: 'coach-admin-1',
      pinnedMessage: 'Pensez à déposer votre check-in sous 24h après chaque week-end choc.',
      lastMessageAt: `${yesterday}T17:45:00.000Z`,
      lastMessagePreview: 'Lucie Bertrand : Sentier sec autour des Aiguilles Rouges jusqu’à 2 100 m !',
      unreadBy: { 'coach-admin-1': 0, 'pilot-claire': 1, 'pilot-thomas': 1, 'pilot-lucie': 0 },
      createdAt: '2026-09-20T08:00:00.000Z',
    },
    {
      id: 'room-ann-saison',
      type: 'announcement',
      name: 'Annonces & Consignes Coach',
      description: 'Notes méthodologiques hebdomadaires et consignes générales du coach.',
      memberIds: [
        'coach-admin-1',
        'pilot-claire',
        'pilot-thomas',
        'pilot-lucie',
        'athlete-free-demo',
      ],
      createdBy: 'coach-admin-1',
      isCoachOnlyPost: true,
      pinnedMessage: 'Canal officiel lecture seule : vos questions restent sur votre fil direct.',
      lastMessageAt: `${twoDaysAgo}T09:30:00.000Z`,
      lastMessagePreview: 'Rappel bloc automne : priorisez la régularité et le travail d’appuis en descente.',
      unreadBy: {
        'coach-admin-1': 0,
        'pilot-claire': 0,
        'pilot-thomas': 0,
        'pilot-lucie': 0,
        'athlete-free-demo': 1,
      },
      createdAt: '2026-09-15T08:00:00.000Z',
    },
  ];

  const chatMessages: ChatMessage[] = [
    {
      id: 'msg-1',
      roomId: 'room-dm-claire',
      senderId: 'coach-admin-1',
      senderName: 'Coach myKairn',
      senderRole: 'coach',
      content:
        'Bravo pour la sortie 3h10 en Chartreuse Claire ! Je t’ai calé le roadbook de référence avec les marges horaires pour ajuster ton tempo jusqu’au km 30.',
      attachment: {
        type: 'roadbook',
        label: 'Roadbook : Tour des Aiguilles — Trail 42 km (Démo)',
        href: '/athlete/roadbook',
      },
      createdAt: `${yesterday}T18:20:00.000Z`,
    },
    {
      id: 'msg-2',
      roomId: 'room-dm-claire',
      senderId: 'pilot-claire',
      senderName: 'Claire Morel',
      senderRole: 'athlete',
      content: 'Parfait pour le fractionné en côte jeudi matin, je valide le roadbook.',
      createdAt: `${yesterday}T19:10:00.000Z`,
    },
    {
      id: 'msg-3',
      roomId: 'room-dm-thomas',
      senderId: 'coach-admin-1',
      senderName: 'Coach myKairn',
      senderRole: 'coach',
      content:
        'Thomas, ta charge (TSB -29) est très sollicitée en cette fin de cycle. Remplace la sortie longue par 1h15 de home-trainer souple si le genou tire.',
      createdAt: `${yesterday}T20:05:00.000Z`,
    },
    {
      id: 'msg-4',
      roomId: 'room-dm-thomas',
      senderId: 'pilot-thomas',
      senderName: 'Thomas Garnier',
      senderRole: 'athlete',
      content:
        'Bien reçu, je sens encore une sensibilité latérale du genou sur les 20 dernières minutes de descente. Je bascule sur vélo récup demain.',
      attachment: {
        type: 'checkin_ref',
        label: 'Check-in douleur signalée (RPE 8/10)',
        href: '/athlete/check-in',
      },
      createdAt: `${today}T08:15:00.000Z`,
    },
    {
      id: 'msg-5',
      roomId: 'room-group-pilots',
      senderId: 'pilot-claire',
      senderName: 'Claire Morel',
      senderRole: 'athlete',
      content:
        'Le protocole 75 g/h testé hier en Chartreuse est passé sans aucun souci digestif !',
      createdAt: `${yesterday}T16:15:00.000Z`,
    },
    {
      id: 'msg-6',
      roomId: 'room-group-pilots',
      senderId: 'pilot-lucie',
      senderName: 'Lucie Bertrand',
      senderRole: 'athlete',
      content:
        'Sentier sec autour des Aiguilles Rouges jusqu’à 2 100 m ! Conditions idéales pour placer du seuil en côte.',
      createdAt: `${yesterday}T17:45:00.000Z`,
    },
    {
      id: 'msg-7',
      roomId: 'room-ann-saison',
      senderId: 'coach-admin-1',
      senderName: 'Coach myKairn',
      senderRole: 'coach',
      content:
        'Rappel bloc automne : priorisez la régularité et le travail d’appuis en descente technique plutôt que l’accumulation de km à plat.',
      createdAt: `${twoDaysAgo}T09:30:00.000Z`,
    },
  ];

  return {
    users,
    athleteProfiles,
    intervalsConnections,
    intervalsSnapshots,
    checkIns,
    trainingPlans,
    orders: [],
    entitlements,
    communityChallenges,
    communityPosts,
    roadbooks,
    coachingInquiries: [],
    chatRooms,
    chatMessages,
  };
}
