import { z } from 'zod';

export const intervalsConnectSchema = z
  .object({
    userId: z.string().min(1, 'Identifiant utilisateur requis'),
    intervalsAthleteId: z
      .string()
      .trim()
      .min(1, "L'ID Intervals.icu (ex: i123456 ou 0) est requis")
      .max(64),
    apiKey: z
      .string()
      .trim()
      .min(8, 'La clé API Intervals.icu semble trop courte')
      .max(256),
    authMode: z.enum(['api_key', 'oauth']).default('api_key'),
    connectionScope: z.enum(['coach', 'athlete']).default('athlete'),
    healthDataConsent: z.boolean().optional(),
  })
  .superRefine((data, ctx) => {
    if (data.connectionScope !== 'coach' && data.healthDataConsent !== true) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['healthDataConsent'],
        message:
          'Votre consentement explicite au traitement des données physiologiques (RGPD Art. 9) est obligatoire pour connecter Intervals.icu.',
      });
    }
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
  action: z.enum(['update']).default('update'),
  name: z.string().trim().min(2).max(80).optional(),
  description: z.string().trim().max(300).optional(),
  pinnedMessage: z.string().trim().max(500).optional(),
  memberIds: z.array(z.string().min(1)).max(100).optional(),
});

const ISO_DATE_TIME_REGEX =
  /^(\d{4})-(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])(?:T([01]\d|2[0-3]):([0-5]\d)(?::([0-5]\d)(?:\.\d{1,9})?)?(Z|[+-](?:[01]\d|2[0-3]):?[0-5]\d)?)?$/;

function isValidIsoCalendarDateTime(value: string): boolean {
  const match = ISO_DATE_TIME_REGEX.exec(value);
  if (!match) return false;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const probe = new Date(Date.UTC(year, month - 1, day));
  if (
    probe.getUTCFullYear() !== year ||
    probe.getUTCMonth() !== month - 1 ||
    probe.getUTCDate() !== day
  ) {
    return false;
  }
  return !isNaN(new Date(value).getTime());
}

export const roadbookWaypointSchema = z
  .object({
    id: z.string().min(1).max(120),
    name: z.string().trim().min(1).max(160),
    lat: z.number().finite().min(-90).max(90),
    lon: z.number().finite().min(-180).max(180),
    ele: z.number().finite().min(-500).max(9000),
    pointIndex: z.number().int().min(0),
    pauseMinutes: z.number().min(0).max(1440).optional(),
    timeModifierPct: z.number().min(10).max(300).optional(),
    cutoffTimeIso: z
      .string()
      .trim()
      .max(40)
      .refine((v) => v === '' || isValidIsoCalendarDateTime(v), 'Barrière horaire invalide')
      .optional(),
    technicality: z
      .union([z.literal(1), z.literal(2), z.literal(3), z.literal(4), z.literal(5)])
      .optional(),
    type: z.enum(['start', 'aid_station', 'life_base', 'pass', 'finish']).optional(),
    desc: z.string().max(1000).optional(),
    plannedNutrition: z
      .record(z.string().min(1).max(80), z.number().int().min(0).max(200))
      .optional(),
  })
  .passthrough();

export const roadbookSaveSchema = z
  .object({
    id: z.string().min(1).max(120),
    userId: z.string().min(1).optional(),
    name: z.string().trim().min(1).max(160),
    officialDistanceKm: z.number().min(0).max(2000).optional(),
    officialElevationM: z.number().min(0).max(50000).optional(),
    startTimeIso: z
      .string()
      .trim()
      .min(10, 'Heure de départ invalide')
      .max(40)
      .refine(isValidIsoCalendarDateTime, 'Heure de départ invalide')
      .optional(),
    isPublic: z.boolean().optional(),
    points: z.array(z.record(z.string(), z.unknown())).max(15000),
    waypoints: z.array(roadbookWaypointSchema).max(200),
  })
  .passthrough();

export const athleteProfilePatchSchema = z
  .object({
    userId: z.string().min(1),
    assignedCoachId: z.string().trim().min(1).max(128).nullable().optional(),
    intervalsAthleteId: z.string().trim().max(64).nullable().optional(),
    notesCoach: z.string().max(5000).optional(),
    tierStatus: z
      .enum(['free', 'plan_only', 'coaching_paid', 'pilot_showcase'])
      .optional(),
    isShowcaseFeatured: z.boolean().optional(),
    showcaseQuote: z.string().max(500).optional(),
    showcaseBio: z.string().max(1000).optional(),
    restingHr: z.number().int().min(25).max(130).optional(),
    maxHr: z.number().int().min(100).max(230).optional(),
    lthr: z.number().int().min(80).max(215).optional(),
    vmaKmh: z.number().min(5).max(30).optional(),
    weightKg: z.number().min(30).max(200).optional(),
    trailIndex: z.number().int().min(200).max(1200).optional(),
  })
  .passthrough();

export const trainingPlanUpsertSchema = z
  .object({
    id: z.string().min(1).max(120).optional(),
    title: z.string().trim().min(2).max(160),
    slug: z.string().trim().min(2).max(160).optional(),
    subtitle: z.string().max(240).optional(),
    description: z.string().max(4000),
    level: z
      .enum(['Découverte', 'Intermédiaire', 'Confirmé', 'Expert Ultra'])
      .optional(),
    durationWeeks: z.number().int().min(1).max(52),
    priceCents: z.number().int().min(0).max(500000),
    currency: z.literal('EUR').optional(),
    status: z.enum(['draft', 'published', 'archived']).optional(),
  })
  .passthrough();

export const communityLikeSchema = z.object({
  postId: z.string().min(1).max(120),
});

export const coachCreateSchema = z.object({
  email: z.string().trim().email('Adresse email invalide').max(160),
  displayName: z.string().trim().min(2, 'Nom requis').max(100),
  role: z.enum(['coach', 'admin']).default('coach'),
  coachSpecialty: z.string().trim().max(160).optional(),
  coachBio: z.string().trim().max(600).optional(),
});

export const coachUpdateSchema = z.object({
  userId: z.string().min(1, 'Identifiant coach requis'),
  displayName: z.string().trim().min(2).max(100).optional(),
  role: z.enum(['athlete', 'coach', 'admin']).optional(),
  coachSpecialty: z.string().trim().max(160).optional(),
  coachBio: z.string().trim().max(600).optional(),
  coachActive: z.boolean().optional(),
});
