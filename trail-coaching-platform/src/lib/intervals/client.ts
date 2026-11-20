import type { IntervalsSnapshot } from '@/types/domain';

const INTERVALS_BASE_URL = 'https://intervals.icu/api/v1';

interface IntervalsAthleteDto {
  id?: string | number;
  name?: string;
  firstname?: string;
  lastname?: string;
  ctl?: number;
  atl?: number;
  weight?: number;
  restingHR?: number;
  icu?: {
    ctl?: number;
    atl?: number;
    weight?: number;
    restingHR?: number;
  };
}

interface IntervalsWellnessDto {
  ctl?: number;
  atl?: number;
  tsb?: number;
  rampRate?: number;
  readiness?: number;
  restingHR?: number;
  hrv?: number;
  compliance?: number;
}

interface IntervalsActivityDto {
  distance?: number;
  total_elevation_gain?: number;
  moving_time?: number;
  elapsed_time?: number;
}

/**
 * Nettoie la clé API Intervals.icu pour éviter les erreurs 401 (espaces, guillemets, préfixes Basic/Bearer/API_KEY:).
 */
export function normalizeIntervalsApiKey(rawKey?: string | null): string {
  if (!rawKey) return '';
  let k = String(rawKey).trim().replace(/^["']|["']$/g, '').trim();

  if (/^basic\s+/i.test(k)) {
    k = k.replace(/^basic\s+/i, '').trim();
    try {
      const decoded = Buffer.from(k, 'base64').toString('utf-8');
      if (decoded.startsWith('API_KEY:')) {
        k = decoded.slice('API_KEY:'.length).trim();
      }
    } catch {
      // ignore invalid base64
    }
  }
  if (/^bearer\s+/i.test(k)) {
    k = k.replace(/^bearer\s+/i, '').trim();
  }
  if (/^api_key:/i.test(k)) {
    k = k.replace(/^api_key:/i, '').trim();
  }
  return k.replace(/\s+/g, '');
}

/**
 * Normalise l'ID athlète (`i123456` ou `0` par défaut).
 */
export function normalizeIntervalsAthleteId(rawId?: string | null): string {
  if (!rawId) return '0';
  const id = String(rawId).trim();
  if (!id || id.includes('@')) return '0';

  const urlMatch = id.match(/\b(i\d{3,10})\b/i);
  if (urlMatch) return urlMatch[1].toLowerCase();
  if (/^\d{3,10}$/.test(id)) return `i${id}`;
  if (/^i\d+$/i.test(id)) return id.toLowerCase();
  if (id === '0') return '0';
  return id;
}

function buildBasicAuthHeader(apiKey: string): string {
  const cleanKey = normalizeIntervalsApiKey(apiKey);
  return `Basic ${Buffer.from(`API_KEY:${cleanKey}`).toString('base64')}`;
}

async function fetchIntervalsJson<T>(
  athleteId: string,
  apiKey: string,
  subPath: string
): Promise<{ data: T; resolvedAthleteId: string }> {
  const normalizedId = normalizeIntervalsAthleteId(athleteId);
  const headers = {
    Authorization: buildBasicAuthHeader(apiKey),
    'Content-Type': 'application/json',
  };

  let response = await fetch(`${INTERVALS_BASE_URL}/athlete/${normalizedId}${subPath}`, {
    headers,
    signal: AbortSignal.timeout(10000),
    cache: 'no-store',
  });

  let resolvedId = normalizedId;
  if (
    !response.ok &&
    (response.status === 401 || response.status === 403 || response.status === 404) &&
    normalizedId !== '0'
  ) {
    const fallbackRes = await fetch(`${INTERVALS_BASE_URL}/athlete/0${subPath}`, {
      headers,
      signal: AbortSignal.timeout(10000),
      cache: 'no-store',
    });
    if (fallbackRes.ok) {
      response = fallbackRes;
      resolvedId = '0';
    } else {
      response = fallbackRes;
    }
  }

  if (!response.ok) {
    if (response.status === 401 || response.status === 403) {
      throw new Error(
        "Accès Intervals.icu refusé (401) : vérifiez votre clé API (Developer Settings sur intervals.icu/settings)."
      );
    }
    throw new Error(`Erreur API Intervals.icu (${response.status}).`);
  }

  const data = (await response.json()) as T;
  return { data, resolvedAthleteId: resolvedId };
}

export interface IntervalsVerificationResult {
  resolvedAthleteId: string;
  athleteName: string;
  ctl?: number;
  atl?: number;
  weightKg?: number;
  restingHr?: number;
}

/**
 * Vérifie côté serveur la connexion Intervals.icu et récupère l'identité réelle de l'athlète.
 */
export async function verifyIntervalsConnectionServer(
  rawAthleteId: string,
  rawApiKey: string
): Promise<IntervalsVerificationResult> {
  const cleanKey = normalizeIntervalsApiKey(rawApiKey);
  if (!cleanKey) {
    throw new Error('Clé API Intervals.icu manquante.');
  }

  const { data, resolvedAthleteId } = await fetchIntervalsJson<IntervalsAthleteDto>(
    rawAthleteId,
    cleanKey,
    ''
  );

  const realId = data.id ? String(data.id) : resolvedAthleteId;
  const athleteName =
    data.name || `${data.firstname || ''} ${data.lastname || ''}`.trim() || realId;
  const icu = data.icu || {};

  const ctlVal = icu.ctl ?? data.ctl;
  const atlVal = icu.atl ?? data.atl;
  const weightVal = icu.weight ?? data.weight;
  const rhrVal = icu.restingHR ?? data.restingHR;

  return {
    resolvedAthleteId: realId,
    athleteName,
    ctl: ctlVal !== undefined ? Math.round(Number(ctlVal)) : undefined,
    atl: atlVal !== undefined ? Math.round(Number(atlVal)) : undefined,
    weightKg: weightVal !== undefined ? Number(weightVal) : undefined,
    restingHr: rhrVal !== undefined ? Math.round(Number(rhrVal)) : undefined,
  };
}

/**
 * Agrège côté serveur les métriques récentes Intervals.icu (7 derniers jours : CTL, ATL, TSB, HRV, volume).
 */
export async function fetchIntervalsSnapshotServer(
  userId: string,
  intervalsAthleteId: string,
  rawApiKey: string
): Promise<IntervalsSnapshot> {
  const cleanKey = normalizeIntervalsApiKey(rawApiKey);
  const today = new Date();
  const todayIso = today.toISOString().split('T')[0];

  const sevenDaysAgo = new Date(today);
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
  const oldestIso = sevenDaysAgo.toISOString().split('T')[0];

  const [profileRes, wellnessRes, activitiesRes] = await Promise.all([
    fetchIntervalsJson<IntervalsAthleteDto>(intervalsAthleteId, cleanKey, ''),
    fetchIntervalsJson<IntervalsWellnessDto[]>(
      intervalsAthleteId,
      cleanKey,
      `/wellness?oldest=${oldestIso}&newest=${todayIso}`
    ).catch(() => ({ data: [] as IntervalsWellnessDto[], resolvedAthleteId: intervalsAthleteId })),
    fetchIntervalsJson<IntervalsActivityDto[]>(
      intervalsAthleteId,
      cleanKey,
      `/activities?oldest=${oldestIso}&newest=${todayIso}`
    ).catch(() => ({ data: [] as IntervalsActivityDto[], resolvedAthleteId: intervalsAthleteId })),
  ]);

  const icu = profileRes.data.icu || {};
  const wellnessList = Array.isArray(wellnessRes.data) ? wellnessRes.data : [];
  const latestWellness: IntervalsWellnessDto = wellnessList[wellnessList.length - 1] || {};

  const ctlRaw = latestWellness.ctl ?? icu.ctl ?? profileRes.data.ctl;
  const atlRaw = latestWellness.atl ?? icu.atl ?? profileRes.data.atl;
  const ctl = ctlRaw !== undefined ? Math.round(Number(ctlRaw)) : undefined;
  const atl = atlRaw !== undefined ? Math.round(Number(atlRaw)) : undefined;
  const tsb =
    ctl !== undefined && atl !== undefined
      ? Math.round(ctl - atl)
      : latestWellness.tsb !== undefined
      ? Math.round(Number(latestWellness.tsb))
      : undefined;

  const rampRate =
    latestWellness.rampRate !== undefined
      ? Number(Number(latestWellness.rampRate).toFixed(1))
      : undefined;

  const activities = Array.isArray(activitiesRes.data) ? activitiesRes.data : [];
  let weeklyDistanceKm = 0;
  let weeklyElevationM = 0;
  let weeklyDurationMin = 0;

  for (const act of activities) {
    weeklyDistanceKm += Number(act.distance || 0) / 1000;
    weeklyElevationM += Number(act.total_elevation_gain || 0);
    weeklyDurationMin += Number(act.moving_time || act.elapsed_time || 0) / 60;
  }

  return {
    id: `${userId}_${todayIso}`,
    userId,
    snapshotDate: todayIso,
    ctl,
    atl,
    tsb,
    rampRate,
    weeklyDistanceKm: Number(weeklyDistanceKm.toFixed(1)),
    weeklyElevationM: Math.round(weeklyElevationM),
    weeklyDurationMin: Math.round(weeklyDurationMin),
    wellnessReadiness:
      latestWellness.readiness !== undefined ? Math.round(Number(latestWellness.readiness)) : undefined,
    restingHrObserved:
      latestWellness.restingHR !== undefined
        ? Math.round(Number(latestWellness.restingHR))
        : undefined,
    hrvRmssd:
      latestWellness.hrv !== undefined ? Math.round(Number(latestWellness.hrv)) : undefined,
    compliancePct:
      latestWellness.compliance !== undefined ? Math.round(Number(latestWellness.compliance)) : undefined,
    fetchedAt: new Date().toISOString(),
  };
}
