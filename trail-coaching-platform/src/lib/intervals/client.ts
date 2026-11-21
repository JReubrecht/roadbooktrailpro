import type { IntervalsCoachedAthlete, IntervalsSnapshot } from '@/types/domain';

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

interface IntervalsRawRosterEntry {
  id?: string | number;
  athlete_id?: string | number;
  name?: string;
  athlete_name?: string;
  firstname?: string;
  lastname?: string;
  email?: string;
  ctl?: number;
  fitness?: number;
  atl?: number;
  fatigue?: number;
  icu_permission?: string;
  permission?: string;
}

function normalizeRosterEntries(raw: unknown): IntervalsCoachedAthlete[] {
  const arr: IntervalsRawRosterEntry[] = Array.isArray(raw)
    ? raw
    : raw && typeof raw === 'object' && Array.isArray((raw as { athletes?: unknown[] }).athletes)
      ? ((raw as { athletes: IntervalsRawRosterEntry[] }).athletes)
      : [];

  const byId = new Map<string, IntervalsCoachedAthlete>();
  for (const item of arr) {
    if (!item || typeof item !== 'object') continue;
    const rawId = item.id ?? item.athlete_id;
    if (rawId === undefined || rawId === null) continue;
    const idStr = String(rawId).trim();
    if (!idStr || idStr === '0') continue;

    const fullName =
      item.name ||
      item.athlete_name ||
      `${item.firstname || ''} ${item.lastname || ''}`.trim() ||
      idStr;

    const ctlRaw = item.ctl ?? item.fitness;
    const atlRaw = item.atl ?? item.fatigue;

    byId.set(idStr.toLowerCase(), {
      intervalsAthleteId: idStr,
      name: fullName.trim(),
      ...(typeof item.email === 'string' && item.email.trim()
        ? { email: item.email.trim() }
        : {}),
      ...(ctlRaw !== undefined && Number.isFinite(Number(ctlRaw))
        ? { ctl: Math.round(Number(ctlRaw)) }
        : {}),
      ...(atlRaw !== undefined && Number.isFinite(Number(atlRaw))
        ? { atl: Math.round(Number(atlRaw)) }
        : {}),
      ...(typeof (item.icu_permission ?? item.permission) === 'string'
        ? { permission: String(item.icu_permission ?? item.permission) }
        : {}),
    });
  }

  return Array.from(byId.values()).sort((a, b) =>
    a.name.localeCompare(b.name, 'fr')
  );
}

/**
 * Récupère la liste des athlètes coachés/suivis directement depuis le compte Coach Intervals.icu.
 */
export async function fetchCoachIntervalsRosterServer(
  rawApiKey: string,
  coachAthleteId = '0'
): Promise<IntervalsCoachedAthlete[]> {
  const cleanKey = normalizeIntervalsApiKey(rawApiKey);
  if (!cleanKey) {
    throw new Error('Clé API Coach Intervals.icu manquante.');
  }

  const headers = {
    Authorization: buildBasicAuthHeader(cleanKey),
    'Content-Type': 'application/json',
  };

  let primaryOk = false;
  let primaryRoster: IntervalsCoachedAthlete[] = [];

  try {
    const res = await fetch(`${INTERVALS_BASE_URL}/athletes`, {
      headers,
      signal: AbortSignal.timeout(10000),
      cache: 'no-store',
    });

    if (res.status === 401 || res.status === 403) {
      throw new Error(
        "Accès Coach Intervals.icu refusé (401/403) : vérifiez la clé API du coach."
      );
    }

    if (res.ok) {
      primaryOk = true;
      const json = (await res.json()) as unknown;
      primaryRoster = normalizeRosterEntries(json);
    }
  } catch (err) {
    if (err instanceof Error && err.message.includes('401/403')) {
      throw err;
    }
  }

  if (primaryOk && primaryRoster.length > 0) {
    return primaryRoster;
  }

  const normalizedCoachId = normalizeIntervalsAthleteId(coachAthleteId);
  const summaryRes = await fetch(
    `${INTERVALS_BASE_URL}/athlete/${normalizedCoachId}/athlete-summary`,
    {
      headers,
      signal: AbortSignal.timeout(10000),
      cache: 'no-store',
    }
  );

  if (summaryRes.status === 401 || summaryRes.status === 403) {
    throw new Error(
      "Accès Coach Intervals.icu refusé (401/403) : vérifiez la clé API du coach."
    );
  }

  if (!summaryRes.ok) {
    if (primaryOk) {
      return [];
    }
    throw new Error(
      `Impossible de lister les athlètes Intervals.icu (HTTP ${summaryRes.status}).`
    );
  }

  const summaryJson = (await summaryRes.json()) as unknown;
  return normalizeRosterEntries(summaryJson);
}
