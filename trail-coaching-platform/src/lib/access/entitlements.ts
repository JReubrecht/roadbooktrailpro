import type {
  AthleteProfile,
  CheckIn,
  CoachAlert,
  Entitlement,
  IntervalsSnapshot,
  TierStatus,
  UserDoc,
} from '@/types/domain';

export interface EvaluatedAccess {
  canAccessCoachDashboard: boolean;
  canAccessAthleteSpace: boolean;
  canAccessFullCoaching: boolean;
  canSyncIntervals: boolean;
  canSaveCloudRoadbooks: boolean;
  canUseFreeTools: boolean;
  unlockedPlanIds: string[];
  tierStatus: TierStatus;
  tierBadgeLabel: string;
}

const TIER_LABELS: Record<TierStatus, string> = {
  pilot_showcase: 'Athlète Pilote Vitrine',
  coaching_paid: 'Coaching Premium 1-to-1',
  plan_only: 'Accès Programme Trail',
  free: 'Compte Gratuit',
};

/**
 * Vérifie si un entitlement est actif à l'instant T (isActive === true et expiresAt non expiré).
 */
export function isEntitlementCurrentlyValid(entitlement: Entitlement, now: Date = new Date()): boolean {
  if (!entitlement.isActive) return false;
  if (entitlement.expiresAt) {
    const exp = new Date(entitlement.expiresAt);
    if (!isNaN(exp.getTime()) && exp.getTime() < now.getTime()) {
      return false;
    }
  }
  return true;
}

/**
 * Helper centralisé et pur évaluant l'ensemble des droits d'un utilisateur
 * à partir de son rôle, son profil athlète (`tierStatus`) et ses `entitlements` actifs.
 */
export function evaluateAccess(
  user: UserDoc | null,
  profile: AthleteProfile | null,
  entitlements: Entitlement[] = []
): EvaluatedAccess {
  if (!user) {
    return {
      canAccessCoachDashboard: false,
      canAccessAthleteSpace: false,
      canAccessFullCoaching: false,
      canSyncIntervals: false,
      canSaveCloudRoadbooks: false,
      canUseFreeTools: true, // Outils gratuits accessibles sans compte
      unlockedPlanIds: [],
      tierStatus: 'free',
      tierBadgeLabel: 'Visiteur',
    };
  }

  const isCoachOrAdmin = user.role === 'coach' || user.role === 'admin';
  const tierStatus: TierStatus = profile?.tierStatus || 'free';
  const validEntitlements = entitlements.filter((e) => e.userId === user.id && isEntitlementCurrentlyValid(e));

  const hasCoachingGrant =
    isCoachOrAdmin ||
    tierStatus === 'pilot_showcase' ||
    tierStatus === 'coaching_paid' ||
    validEntitlements.some((e) => e.grantType === 'coaching_access');

  const hasPremiumToolsGrant =
    hasCoachingGrant || validEntitlements.some((e) => e.grantType === 'premium_tools');

  const unlockedPlanIds = Array.from(
    new Set(
      validEntitlements
        .filter((e) => e.grantType === 'plan_access' && Boolean(e.trainingPlanId))
        .map((e) => e.trainingPlanId as string)
    )
  );

  return {
    canAccessCoachDashboard: isCoachOrAdmin,
    canAccessAthleteSpace: true,
    canAccessFullCoaching: hasCoachingGrant,
    canSyncIntervals: hasCoachingGrant,
    canSaveCloudRoadbooks: hasPremiumToolsGrant || unlockedPlanIds.length > 0,
    canUseFreeTools: true,
    unlockedPlanIds,
    tierStatus,
    tierBadgeLabel: isCoachOrAdmin ? 'Coach / Admin' : TIER_LABELS[tierStatus],
  };
}

/**
 * Vérifie si l'utilisateur a débloqué un plan d'entraînement spécifique.
 */
export function canAccessTrainingPlan(
  planId: string,
  user: UserDoc | null,
  profile: AthleteProfile | null,
  entitlements: Entitlement[]
): boolean {
  if (!user) return false;
  const access = evaluateAccess(user, profile, entitlements);
  if (access.canAccessCoachDashboard || access.canAccessFullCoaching) return true;
  return access.unlockedPlanIds.includes(planId);
}

/**
 * Calcule les alertes simples à afficher dans le Centre Coach pour un athlète
 * (painFlag, fatigue élevée, surcharge TSB bas, baisse HRV).
 */
export function computeCoachAlertsForAthlete(
  athleteName: string,
  userId: string,
  latestSnapshot: IntervalsSnapshot | null | undefined,
  recentCheckIns: CheckIn[]
): CoachAlert[] {
  const alerts: CoachAlert[] = [];
  const sortedCheckIns = [...recentCheckIns]
    .filter((c) => c.userId === userId)
    .sort((a, b) => b.checkInDate.localeCompare(a.checkInDate));

  const latestCheckIn = sortedCheckIns[0];
  if (latestCheckIn?.painFlag) {
    alerts.push({
      id: `alert-pain-${latestCheckIn.id}`,
      userId,
      athleteName,
      severity: 'critical',
      title: `Douleur signalée${latestCheckIn.sensitiveArea ? ` (${latestCheckIn.sensitiveArea})` : ''}`,
      detail:
        latestCheckIn.comment ||
        `Check-in du ${latestCheckIn.checkInDate} avec drapeau douleur actif.`,
      date: latestCheckIn.checkInDate,
    });
  }

  if (latestCheckIn && ((latestCheckIn.fatigueLevel ?? 0) >= 4 || (latestCheckIn.rpe ?? 0) >= 9)) {
    alerts.push({
      id: `alert-fatigue-${latestCheckIn.id}`,
      userId,
      athleteName,
      severity: 'warning',
      title: `Fatigue élevée ou RPE maximal (${latestCheckIn.fatigueLevel ?? '-'}/5 · RPE ${latestCheckIn.rpe ?? '-'}/10)`,
      detail: `Surveiller la récupération avant la prochaine séance clé (${latestCheckIn.checkInDate}).`,
      date: latestCheckIn.checkInDate,
    });
  }

  if (latestSnapshot && latestSnapshot.tsb !== undefined && latestSnapshot.tsb <= -25) {
    alerts.push({
      id: `alert-tsb-${latestSnapshot.id}`,
      userId,
      athleteName,
      severity: 'warning',
      title: `Forme Intervals.icu très sollicitée (TSB ${latestSnapshot.tsb})`,
      detail: `CTL ${latestSnapshot.ctl ?? '-'} / ATL ${latestSnapshot.atl ?? '-'} au ${latestSnapshot.snapshotDate}. Envisager une décharge ou un check-in.`,
      date: latestSnapshot.snapshotDate,
    });
  }

  if (
    latestSnapshot &&
    latestSnapshot.wellnessReadiness !== undefined &&
    latestSnapshot.wellnessReadiness <= 55
  ) {
    alerts.push({
      id: `alert-wellness-${latestSnapshot.id}`,
      userId,
      athleteName,
      severity: 'info',
      title: `Baisse de fraîcheur / bien-être (${latestSnapshot.wellnessReadiness}/100)`,
      detail: `HRV observée : ${latestSnapshot.hrvRmssd ?? '-'} ms · FC repos : ${latestSnapshot.restingHrObserved ?? '-'} bpm.`,
      date: latestSnapshot.snapshotDate,
    });
  }

  return alerts;
}
