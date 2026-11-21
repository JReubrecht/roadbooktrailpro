// ============================================================================
// Types Domaine Stricts — Plateforme Coaching Trail myKairn Coach
// ============================================================================

export type UserRole = 'athlete' | 'coach' | 'admin';

export type TierStatus = 'pilot_showcase' | 'coaching_paid' | 'plan_only' | 'free';

export interface UserConsents {
  termsAcceptedAt?: string;
  privacyAcceptedAt?: string;
  healthDataConsentAt?: string;
  marketingOptIn: boolean;
}

export interface UserDoc {
  id: string;
  email: string;
  displayName: string;
  role: UserRole;
  coachSpecialty?: string;
  coachBio?: string;
  coachActive?: boolean;
  consents?: UserConsents;
  createdAt: string;
  updatedAt: string;
}

export interface AthleteProfile {
  userId: string;
  tierStatus: TierStatus;
  assignedCoachId?: string;
  intervalsAthleteId?: string;
  isShowcaseFeatured: boolean;
  showcaseBio?: string;
  showcaseQuote?: string;
  showcaseGoalRace?: string;
  showcaseOutcome?: string;
  weightKg?: number;
  restingHr?: number;
  maxHr?: number;
  lthr?: number;
  vmaKmh?: number;
  trailIndex?: number;
  notesCoach?: string;
  updatedAt: string;
}

export type IntervalsAuthMode = 'api_key' | 'oauth';
export type IntervalsSyncStatus = 'ok' | 'error' | 'pending';

export interface IntervalsConnectionPublic {
  userId: string;
  intervalsAthleteId: string;
  authMode: IntervalsAuthMode;
  connectionScope?: 'coach' | 'athlete';
  coachedAthletesCount?: number;
  hasSecret: boolean;
  syncStatus: IntervalsSyncStatus;
  lastSyncedAt?: string;
  lastErrorMessage?: string;
  updatedAt: string;
}

export interface IntervalsCoachedAthlete {
  intervalsAthleteId: string;
  name: string;
  email?: string;
  ctl?: number;
  atl?: number;
  permission?: string;
}

export interface IntervalsConnectionServer extends IntervalsConnectionPublic {
  secretEncrypted: string;
}

export interface IntervalsSnapshot {
  id: string; // `${userId}_${YYYY-MM-DD}`
  userId: string;
  snapshotDate: string; // YYYY-MM-DD
  ctl?: number;
  atl?: number;
  tsb?: number;
  rampRate?: number;
  weeklyDistanceKm?: number;
  weeklyElevationM?: number;
  weeklyDurationMin?: number;
  wellnessReadiness?: number;
  restingHrObserved?: number;
  hrvRmssd?: number;
  compliancePct?: number;
  fetchedAt: string;
}

export interface CheckIn {
  id: string;
  userId: string;
  checkInDate: string; // YYYY-MM-DD
  intervalsActivityId?: string;
  rpe?: number; // 1..10
  fatigueLevel?: number; // 1..5
  sorenessLevel?: number; // 1..5
  sensitiveArea?: string;
  painFlag: boolean;
  comment?: string;
  createdAt: string;
}

export interface PlanWeekBlock {
  weekNumber: number;
  phase: 'Base' | 'Build' | 'Peak' | 'Taper';
  focus: string;
  targetHours: number;
  targetElevationM: number;
  keySessions: string[];
}

export interface TrainingPlanContent {
  summary: string;
  prerequisites: string;
  nutritionGuidelines: string;
  roadbookAdvice: string;
  weeklyStructure: PlanWeekBlock[];
}

export type TrainingPlanStatus = 'draft' | 'published' | 'archived';

export interface TrainingPlan {
  id: string;
  slug: string;
  title: string;
  subtitle?: string;
  description: string;
  targetDistanceKm?: number;
  targetElevationM?: number;
  durationWeeks: number;
  level?: 'Découverte' | 'Intermédiaire' | 'Confirmé' | 'Expert Ultra';
  priceCents: number;
  currency: 'EUR';
  status: TrainingPlanStatus;
  content: TrainingPlanContent;
  createdAt: string;
  updatedAt: string;
}

export type OrderType = 'plan_purchase' | 'coaching_subscription';
export type OrderStatus = 'pending' | 'paid' | 'refunded' | 'canceled';

export interface Order {
  id: string;
  userId: string;
  orderType: OrderType;
  trainingPlanId?: string;
  amountCents: number;
  currency: 'EUR';
  status: OrderStatus;
  provider?: 'stripe' | 'manual_demo';
  providerCheckoutId?: string;
  providerPaymentId?: string;
  paidAt?: string;
  createdAt: string;
}

export type GrantType = 'plan_access' | 'coaching_access' | 'premium_tools';
export type EntitlementSource = 'manual_grant' | 'pilot_showcase' | 'order' | 'subscription';

export interface Entitlement {
  id: string;
  userId: string;
  grantType: GrantType;
  trainingPlanId?: string;
  source: EntitlementSource;
  orderId?: string;
  startsAt: string;
  expiresAt?: string;
  isActive: boolean;
  createdAt: string;
}

export type ChallengeMetric = 'elevation_m' | 'distance_km' | 'duration_min' | 'sessions_count';

export interface CommunityChallenge {
  id: string;
  title: string;
  description: string;
  metric: ChallengeMetric;
  targetValue: number;
  currentValue: number;
  participantsCount: number;
  startDate: string;
  endDate: string;
  isActive: boolean;
}

export type CommunityPostType = 'outing' | 'route' | 'feedback';

export interface CommunityPost {
  id: string;
  userId: string;
  authorName: string;
  authorTier: TierStatus;
  type: CommunityPostType;
  title: string;
  content: string;
  distanceKm?: number;
  elevationGainM?: number;
  locationLabel?: string;
  likesCount: number;
  createdAt: string;
}

export interface CoachingInquiry {
  id: string;
  name: string;
  email: string;
  offerInterest: 'coaching_1to1' | 'race_audit' | 'training_plan';
  goal: string;
  weeklyHours?: number;
  assignedCoachId?: string;
  rgpdConsent: boolean;
  marketingOptIn: boolean;
  createdAt: string;
}

// ── Types Domaine Scientifique Trail & Roadbook ─────────────────────────────

export interface GpxPoint {
  lat: number;
  lon: number;
  ele: number;
}

export interface RoadbookWaypoint {
  id: string;
  name: string;
  lat: number;
  lon: number;
  ele: number;
  pointIndex: number;
  pauseMinutes?: number;
  timeModifierPct?: number; // 100 = neutre, >100 = plus rapide, <100 = plus lent
  cutoffTimeIso?: string;
  technicality?: 1 | 2 | 3 | 4 | 5;
  type?: 'start' | 'aid_station' | 'life_base' | 'pass' | 'finish';
  desc?: string;
  plannedNutrition?: Record<string, number>;
}

export type WeatherCondition = 'froid' | 'modere' | 'chaud' | 'tres_chaud';
export type PacingStrategy = 'regular' | 'prudent' | 'aggressive';
export type PaceProfile = 'coach' | 'aggressive';

export interface PacingConfig {
  itraIndex: number;
  fatiguePercent: number;
  startTimeIso: string;
  elevationThresholdM: number;
  distanceFactor: number;
  weather: WeatherCondition;
  descentThresholdPct: number;
  walkThresholdPct: number;
  targetTimeHours?: number | null;
  upCostDivider: number;
  downCostModifier: number;
  pacingStrategy: PacingStrategy;
  paceProfile: PaceProfile;
}

export interface RoadbookSegment {
  id: string;
  index: number;
  from: RoadbookWaypoint;
  to: RoadbookWaypoint;
  distanceKm: number;
  cumulDistanceKm: number;
  elevationPosM: number;
  elevationNegM: number;
  cumulElevationM: number;
  kmEffort: number;
  durationFastMs: number;
  durationSlowMs: number;
  arrivalFastIso: string;
  arrivalSlowIso: string;
  paceTargetMinPerKm: number;
  paceSlowMinPerKm: number;
  vamEstimate: number;
  walkDistKm: number;
  runUphillDistKm: number;
  downFlatDistKm: number;
  walkThresholdPct: number;
  nightIntensity: number;
  weatherCoeff: number;
}

export interface RoadbookDoc {
  id: string;
  userId: string;
  name: string;
  officialDistanceKm?: number;
  officialElevationM?: number;
  itraIndex: number;
  fatiguePercent: number;
  pacingStrategy: PacingStrategy;
  weather: WeatherCondition;
  startTimeIso: string;
  isPublic?: boolean;
  points: GpxPoint[];
  waypoints: RoadbookWaypoint[];
  updatedAt: string;
}

export interface NutritionBrand {
  id: string;
  name: string;
  tagline?: string;
  websiteUrl?: string;
  partnerUrl?: string;
  partnerLabel?: string;
  isPartner?: boolean;
}

export interface NutritionProduct {
  id: string;
  brand: string;
  brandId?: string;
  name: string;
  type: 'Gel' | 'Drink' | 'Bar' | 'Puree' | 'Pill' | 'Solid';
  carbsG: number;
  caloriesKcal: number;
  sodiumMg: number;
  caffeineMg?: number;
  waterMl?: number;
  weightG: number;
  description: string;
  productUrl?: string;
}

export interface CoachAlert {
  id: string;
  userId: string;
  athleteName: string;
  severity: 'critical' | 'warning' | 'info';
  title: string;
  detail: string;
  date: string;
}

// ── Types Domaine Messagerie Coach ↔ Athlètes & Groupes ──────────────────────

export type ChatRoomType = 'direct' | 'group' | 'announcement';

export interface ChatMessageAttachment {
  type: 'roadbook' | 'checkin_ref' | 'session_note';
  label: string;
  href?: string;
}

export interface ChatRoom {
  id: string;
  type: ChatRoomType;
  name: string;
  description?: string;
  memberIds: string[];
  createdBy: string;
  isCoachOnlyPost?: boolean;
  pinnedMessage?: string;
  lastMessageAt: string;
  lastMessagePreview?: string;
  unreadBy?: Record<string, number>;
  createdAt: string;
}

export interface ChatMessage {
  id: string;
  roomId: string;
  senderId: string;
  senderName: string;
  senderRole: UserRole;
  content: string;
  attachment?: ChatMessageAttachment;
  createdAt: string;
}
