import { z } from 'zod';

export const intervalsConnectSchema = z.object({
  userId: z.string().min(1, 'Identifiant utilisateur requis'),
  intervalsAthleteId: z
    .string()
    .trim()
    .min(1, "L'ID Athlète Intervals.icu (ex: i123456 ou 0) est requis")
    .max(64),
  apiKey: z
    .string()
    .trim()
    .min(8, 'La clé API Intervals.icu semble trop courte')
    .max(256),
  authMode: z.enum(['api_key', 'oauth']).default('api_key'),
  healthDataConsent: z.literal(true, {
    errorMap: () => ({
      message:
        'Votre consentement explicite au traitement des données physiologiques (RGPD Art. 9) est obligatoire pour connecter Intervals.icu.',
    }),
  }),
});

export const intervalsSyncSchema = z.object({
  userId: z.string().min(1),
  intervalsAthleteId: z.string().min(1).optional(),
  demoMode: z.boolean().optional(),
});

export const checkInCreateSchema = z.object({
  userId: z.string().min(1, 'Utilisateur requis'),
  checkInDate: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, 'Format de date attendu : AAAA-MM-JJ'),
  intervalsActivityId: z.string().max(64).optional(),
  rpe: z.number().int().min(1).max(10).optional(),
  fatigueLevel: z.number().int().min(1).max(5).optional(),
  sorenessLevel: z.number().int().min(1).max(5).optional(),
  sensitiveArea: z.string().trim().max(120).optional(),
  painFlag: z.boolean(),
  comment: z.string().trim().max(1000).optional(),
});

export const athleteProfileUpdateSchema = z.object({
  weightKg: z.number().min(30).max(200).optional(),
  restingHr: z.number().int().min(25).max(130).optional(),
  maxHr: z.number().int().min(100).max(230).optional(),
  lthr: z.number().int().min(80).max(215).optional(),
  vmaKmh: z.number().min(6).max(30).optional(),
  trailIndex: z.number().int().min(200).max(1000).optional(),
  showcaseBio: z.string().trim().max(500).optional(),
  showcaseQuote: z.string().trim().max(400).optional(),
  notesCoach: z.string().trim().max(2000).optional(),
});

export const trainingPlanSchema = z.object({
  slug: z
    .string()
    .trim()
    .min(3)
    .max(80)
    .regex(/^[a-z0-9-]+$/, 'Slug en minuscules et tirets uniquement'),
  title: z.string().trim().min(4, 'Titre trop court').max(120),
  subtitle: z.string().trim().max(160).optional(),
  description: z.string().trim().min(10).max(2000),
  targetDistanceKm: z.number().min(5).max(400).optional(),
  targetElevationM: z.number().min(0).max(30000).optional(),
  durationWeeks: z.number().int().min(2).max(52),
  level: z.enum(['Découverte', 'Intermédiaire', 'Confirmé', 'Expert Ultra']).optional(),
  priceCents: z.number().int().min(0).max(500000),
  currency: z.literal('EUR').default('EUR'),
  status: z.enum(['draft', 'published', 'archived']).default('draft'),
});

export const entitlementGrantSchema = z.object({
  userId: z.string().min(1, 'Athlète cible requis'),
  grantType: z.enum(['plan_access', 'coaching_access', 'premium_tools']),
  trainingPlanId: z.string().optional(),
  source: z.enum(['manual_grant', 'pilot_showcase', 'order', 'subscription']).default('manual_grant'),
  durationDays: z.number().int().min(1).max(1095).optional(),
});

export const orderCheckoutSchema = z.object({
  userId: z.string().min(1),
  orderType: z.enum(['plan_purchase', 'coaching_subscription']),
  trainingPlanId: z.string().optional(),
  amountCents: z.number().int().min(0).max(500000),
  simulateImmediatePayment: z.boolean().default(true),
});

export const coachingInquirySchema = z.object({
  name: z.string().trim().min(2, 'Veuillez indiquer votre nom').max(100),
  email: z.string().trim().email('Adresse email invalide').max(160),
  offerInterest: z.enum(['coaching_1to1', 'race_audit', 'training_plan']),
  goal: z
    .string()
    .trim()
    .min(10, 'Décrivez brièvement votre objectif (course, distance, délai)')
    .max(1500),
  weeklyHours: z.number().min(1).max(40).optional(),
  rgpdConsent: z.literal(true, {
    errorMap: () => ({
      message: 'Veuillez accepter la politique de confidentialité pour envoyer votre demande.',
    }),
  }),
  marketingOptIn: z.boolean().default(false),
});

export const communityPostCreateSchema = z.object({
  userId: z.string().min(1),
  authorName: z.string().trim().min(2).max(80),
  type: z.enum(['outing', 'route', 'feedback']),
  title: z.string().trim().min(3, 'Titre requis').max(120),
  content: z.string().trim().min(5, 'Contenu requis').max(1500),
  distanceKm: z.number().min(0).max(500).optional(),
  elevationGainM: z.number().min(0).max(30000).optional(),
  locationLabel: z.string().trim().max(80).optional(),
});

export const chatbotRequestSchema = z.object({
  message: z.string().trim().min(1).max(600),
  history: z
    .array(
      z.object({
        role: z.enum(['user', 'assistant']),
        content: z.string().max(1500),
      })
    )
    .max(10)
    .default([]),
  contextMode: z.enum(['public', 'member']).default('public'),
  programSalesEnabled: z.boolean().default(false),
  athleteSummary: z
    .object({
      displayName: z.string().max(100).optional(),
      ctl: z.number().optional(),
      atl: z.number().optional(),
      tsb: z.number().optional(),
      weeklyDistanceKm: z.number().optional(),
      weeklyElevationM: z.number().optional(),
      hasPainAlert: z.boolean().optional(),
    })
    .optional(),
});

export const chatRoomCreateSchema = z.object({
  type: z.enum(['direct', 'group', 'announcement']),
  name: z.string().trim().min(2, 'Nom du salon requis').max(80),
  description: z.string().trim().max(300).optional(),
  memberIds: z
    .array(z.string().min(1))
    .min(2, 'Sélectionnez au moins 2 participants')
    .max(100),
  createdBy: z.string().min(1),
  isCoachOnlyPost: z.boolean().optional(),
});

export const chatMessageCreateSchema = z.object({
  roomId: z.string().min(1),
  senderId: z.string().min(1),
  senderName: z.string().trim().min(2).max(80),
  senderRole: z.enum(['athlete', 'coach', 'admin']),
  content: z.string().trim().min(1, 'Message vide').max(2000),
  attachment: z
    .object({
      type: z.enum(['roadbook', 'checkin_ref', 'session_note']),
      label: z.string().trim().min(1).max(160),
      href: z.string().trim().max(300).optional(),
    })
    .optional(),
});

export const adminConfigUpdateSchema = z.object({
  promoBanner: z
    .object({
      enabled: z.boolean(),
      eyebrow: z.string().max(80),
      message: z.string().max(240),
      ctaLabel: z.string().max(60),
      ctaHref: z.string().max(240),
      accentHex: z.string().max(20).optional(),
    })
    .optional(),
  featureFlags: z
    .object({
      programSalesEnabled: z.boolean(),
    })
    .optional(),
  customLogoUrl: z.string().max(250000).nullable().optional(),
});

export const chatRoomUpdateSchema = z.object({
  roomId: z.string().min(1),
  action: z.enum(['update', 'archive']),
  name: z.string().trim().min(2).max(100).optional(),
  description: z.string().max(300).optional(),
  memberIds: z.array(z.string().min(1)).max(100).optional(),
  isArchived: z.boolean().optional(),
  isCoachOnlyPost: z.boolean().optional(),
});

export const roadbookSaveSchema = z
  .object({
    id: z.string().min(1).max(120),
    userId: z.string().min(1).optional(),
    title: z.string().trim().min(1).max(160),
    raceName: z.string().max(160).optional(),
    raceDate: z.string().max(40).optional(),
    startTimeIso: z.string().max(60).optional(),
    distanceKm: z.number().min(0).max(2000),
    elevationGainM: z.number().min(0).max(50000),
    elevationLossM: z.number().min(0).max(50000).optional(),
    gpxFileName: z.string().max(200).optional(),
    gpxTrackPoints: z.array(z.record(z.string(), z.unknown())).max(15000).optional(),
    waypoints: z.array(z.record(z.string(), z.unknown())).max(200),
    nutritionItems: z.array(z.record(z.string(), z.unknown())).max(200).optional(),
    nutritionIntakeIntervalMin: z.number().min(5).max(240).optional(),
    paceConfig: z.record(z.string(), z.unknown()).optional(),
    splits: z.array(z.record(z.string(), z.unknown())).max(200).optional(),
    notes: z.string().max(5000).optional(),
    isPublicTemplate: z.boolean().optional(),
  })
  .passthrough();

export const athleteProfilePatchSchema = z
  .object({
    userId: z.string().min(1),
    notesCoach: z.string().max(5000).optional(),
    tierStatus: z.enum(['free', 'plan_buyer', 'coached', 'pilot_free']).optional(),
    isShowcaseFeatured: z.boolean().optional(),
    showcaseQuote: z.string().max(500).optional(),
    primaryGoalRace: z.string().max(160).optional(),
    primaryGoalDate: z.string().max(40).optional(),
    weeklyAvailabilityHours: z.number().min(0).max(60).optional(),
    itraScore: z.number().min(0).max(1200).optional(),
    utmbIndex: z.number().min(0).max(1200).optional(),
    vmaKmH: z.number().min(5).max(30).optional(),
    restingHr: z.number().int().min(25).max(120).optional(),
    maxHr: z.number().int().min(100).max(230).optional(),
    weightKg: z.number().min(30).max(200).optional(),
    bio: z.string().max(1000).optional(),
  })
  .passthrough();

export const trainingPlanUpsertSchema = z
  .object({
    id: z.string().min(1).max(120).optional(),
    title: z.string().trim().min(2).max(160),
    slug: z.string().trim().min(2).max(160).optional(),
    subtitle: z.string().max(240).optional(),
    description: z.string().max(4000),
    level: z.enum(['debutant', 'intermediaire', 'confirme', 'expert']),
    durationWeeks: z.number().int().min(1).max(52),
    distanceCategory: z.string().max(80),
    priceEur: z.number().min(0).max(5000),
    isPublished: z.boolean().optional(),
    isFreePreview: z.boolean().optional(),
  })
  .passthrough();

export const communityLikeSchema = z.object({
  postId: z.string().min(1).max(120),
});
