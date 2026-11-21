import { normalizeFirestoreDoc } from '@/lib/firebase/admin';
import { findClosestPointIndex } from '@/lib/trail/geodesy';
import type {
  GpxPoint,
  PacingStrategy,
  RoadbookDoc,
  RoadbookWaypoint,
  WeatherCondition,
} from '@/types/domain';

const DEFAULT_START_TIME_ISO = '2026-08-28T06:00';
const VALID_PACING: PacingStrategy[] = ['regular', 'prudent', 'aggressive'];
const VALID_WEATHER: WeatherCondition[] = ['froid', 'modere', 'chaud', 'tres_chaud'];
const VALID_WP_TYPES = new Set<RoadbookWaypoint['type']>([
  'start',
  'aid_station',
  'life_base',
  'pass',
  'finish',
]);

function parseJsonArrayIfString(raw: unknown): unknown[] {
  if (Array.isArray(raw)) return raw;
  if (typeof raw === 'string') {
    const trimmed = raw.trim();
    if (!trimmed) return [];
    try {
      const parsed = JSON.parse(trimmed);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }
  return [];
}

function toFiniteNumber(val: unknown): number | undefined {
  if (typeof val === 'number' && Number.isFinite(val)) return val;
  if (typeof val === 'string' && val.trim() !== '') {
    const n = Number(val);
    if (Number.isFinite(n)) return n;
  }
  return undefined;
}

/**
 * Sous-échantillonne uniformément une trace GPX en conservant strictement le départ et l'arrivée.
 */
export function downsampleGpxPoints(
  points: GpxPoint[],
  maxPoints: number
): GpxPoint[] {
  if (maxPoints < 2 || points.length <= maxPoints) {
    return points;
  }

  const sampled: GpxPoint[] = [];
  const lastIdx = points.length - 1;
  let prevIdx = -1;

  for (let i = 0; i < maxPoints; i++) {
    const idx =
      i === maxPoints - 1
        ? lastIdx
        : Math.round((i * lastIdx) / (maxPoints - 1));
    if (idx !== prevIdx && points[idx]) {
      sampled.push(points[idx]);
      prevIdx = idx;
    }
  }

  return sampled;
}

function normalizeWaypointType(
  rawType: unknown,
  rawName: string
): RoadbookWaypoint['type'] {
  if (
    typeof rawType === 'string' &&
    VALID_WP_TYPES.has(rawType as RoadbookWaypoint['type'])
  ) {
    return rawType as RoadbookWaypoint['type'];
  }

  const lowerName = rawName.toLowerCase();
  if (rawType === 'full') {
    if (lowerName.includes('base de vie') || lowerName.includes('life base')) {
      return 'life_base';
    }
    return 'aid_station';
  }
  if (rawType === 'point') {
    if (lowerName.includes('départ') || lowerName.includes('depart') || lowerName === 'start') {
      return 'start';
    }
    if (lowerName.includes('arrivée') || lowerName.includes('arrivee') || lowerName === 'finish') {
      return 'finish';
    }
    return 'pass';
  }

  return undefined;
}

function normalizePlannedNutrition(
  rawNutrition: unknown
): Record<string, number> | undefined {
  if (!rawNutrition || typeof rawNutrition !== 'object' || Array.isArray(rawNutrition)) {
    return undefined;
  }

  const cleaned: Record<string, number> = {};
  for (const [k, v] of Object.entries(rawNutrition as Record<string, unknown>)) {
    const qty = toFiniteNumber(v);
    if (qty !== undefined && qty > 0) {
      cleaned[k] = Math.floor(qty);
    }
  }
  return Object.keys(cleaned).length > 0 ? cleaned : undefined;
}

/**
 * Normalise un document Firestore `roadbooks` (compatible schémas V1 et V2) en `RoadbookDoc`.
 */
export function normalizeRoadbookFromFirestore(
  rawData: Record<string, unknown>,
  docId: string,
  maxPoints = 450
): RoadbookDoc {
  const doc = normalizeFirestoreDoc<Record<string, unknown>>(rawData, docId);
  const nowIso = new Date().toISOString();

  const rawPoints = parseJsonArrayIfString(doc.points);
  const normalizedPoints: GpxPoint[] = [];
  for (const pt of rawPoints) {
    if (!pt || typeof pt !== 'object') continue;
    const p = pt as Record<string, unknown>;
    const lat = toFiniteNumber(p.lat);
    const lon = toFiniteNumber(p.lon ?? p.lng);
    const ele = toFiniteNumber(p.ele) ?? 0;
    if (lat !== undefined && lon !== undefined) {
      normalizedPoints.push({ lat, lon, ele });
    }
  }

  const wasDownsampled =
    maxPoints >= 2 && normalizedPoints.length > maxPoints;
  const finalPoints = downsampleGpxPoints(normalizedPoints, maxPoints);

  const rawWaypoints = parseJsonArrayIfString(doc.waypoints);
  const normalizedWaypoints: RoadbookWaypoint[] = [];
  rawWaypoints.forEach((entry, idx) => {
    if (!entry || typeof entry !== 'object') return;
    const w = entry as Record<string, unknown>;
    const name =
      typeof w.name === 'string' && w.name.trim()
        ? w.name.trim()
        : `Point ${idx + 1}`;
    const lat = toFiniteNumber(w.lat);
    const lon = toFiniteNumber(w.lon ?? w.lng);
    const ele = toFiniteNumber(w.ele) ?? 0;
    if (lat === undefined || lon === undefined) return;

    const existingIdx = toFiniteNumber(w.pointIndex);
    const needsReindex =
      wasDownsampled ||
      existingIdx === undefined ||
      existingIdx < 0 ||
      existingIdx >= finalPoints.length;

    const pointIndex =
      finalPoints.length === 0
        ? 0
        : needsReindex
        ? Math.max(0, findClosestPointIndex(lat, lon, finalPoints))
        : Math.round(existingIdx);

    const pauseMinutes = toFiniteNumber(w.pauseMinutes ?? w.pause);
    const timeModifierPct = toFiniteNumber(w.timeModifierPct ?? w.time_modifier);
    const technicalityRaw = toFiniteNumber(w.technicality);
    const technicality =
      technicalityRaw !== undefined &&
      technicalityRaw >= 1 &&
      technicalityRaw <= 5
        ? (Math.round(technicalityRaw) as 1 | 2 | 3 | 4 | 5)
        : undefined;
    const cutoffTimeIso =
      typeof w.cutoffTimeIso === 'string' && w.cutoffTimeIso.trim()
        ? w.cutoffTimeIso.trim()
        : undefined;
    const desc = typeof w.desc === 'string' && w.desc.trim() ? w.desc : undefined;
    const type = normalizeWaypointType(w.type, name);
    const plannedNutrition = normalizePlannedNutrition(
      w.plannedNutrition ?? w.planned_nutrition
    );

    normalizedWaypoints.push({
      id: typeof w.id === 'string' && w.id.trim() ? w.id.trim() : `wp-${idx}`,
      name,
      lat,
      lon,
      ele,
      pointIndex,
      ...(pauseMinutes !== undefined && pauseMinutes >= 0
        ? { pauseMinutes }
        : {}),
      ...(timeModifierPct !== undefined && timeModifierPct > 0
        ? { timeModifierPct }
        : {}),
      ...(cutoffTimeIso ? { cutoffTimeIso } : {}),
      ...(technicality ? { technicality } : {}),
      ...(type ? { type } : {}),
      ...(desc ? { desc } : {}),
      ...(plannedNutrition ? { plannedNutrition } : {}),
    });
  });

  normalizedWaypoints.sort((a, b) => a.pointIndex - b.pointIndex);

  const rawStart =
    typeof doc.startTimeIso === 'string' && doc.startTimeIso.trim()
      ? doc.startTimeIso.trim()
      : typeof doc.startTime === 'string' && doc.startTime.trim()
      ? doc.startTime.trim()
      : DEFAULT_START_TIME_ISO;

  const officialDistanceKm = toFiniteNumber(
    doc.officialDistanceKm ?? doc.officialDistance
  );
  const officialElevationM = toFiniteNumber(
    doc.officialElevationM ?? doc.officialElevation
  );
  const itraIndex = toFiniteNumber(doc.itraIndex) ?? 550;
  const fatiguePercent = toFiniteNumber(doc.fatiguePercent) ?? 8;

  const pacingStrategy = VALID_PACING.includes(doc.pacingStrategy as PacingStrategy)
    ? (doc.pacingStrategy as PacingStrategy)
    : 'regular';
  const weather = VALID_WEATHER.includes(doc.weather as WeatherCondition)
    ? (doc.weather as WeatherCondition)
    : 'modere';

  const updatedAt =
    typeof doc.updatedAt === 'string' && doc.updatedAt
      ? doc.updatedAt
      : typeof doc.createdAt === 'string' && doc.createdAt
      ? doc.createdAt
      : nowIso;

  return {
    id: String(doc.id || docId),
    userId: typeof doc.userId === 'string' ? doc.userId : '',
    name:
      typeof doc.name === 'string' && doc.name.trim()
        ? doc.name.trim()
        : 'Roadbook sans titre',
    ...(officialDistanceKm !== undefined && officialDistanceKm > 0
      ? { officialDistanceKm }
      : {}),
    ...(officialElevationM !== undefined && officialElevationM >= 0
      ? { officialElevationM }
      : {}),
    itraIndex,
    fatiguePercent,
    pacingStrategy,
    weather,
    startTimeIso: rawStart,
    isPublic: Boolean(doc.isPublic ?? doc.isPublicTemplate),
    points: finalPoints,
    waypoints: normalizedWaypoints,
    updatedAt,
  };
}
