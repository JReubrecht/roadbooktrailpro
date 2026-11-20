import type { GpxPoint, PacingConfig, RoadbookSegment, RoadbookWaypoint } from '@/types/domain';
import { calculateDistance, enrichWaypointsWithStartEnd } from './geodesy';
import {
  calculateKmEffort,
  computeFatigueIntegral,
  computeWalkThreshold,
  estimateBasePaces,
  estimateRaceTargetHours,
  getNightCoefficient,
  getNightIntensity,
  getTerrainFactor,
  getWeatherCoefficient,
} from './pacing';

export function formatDecimalHoursToHHMM(decimalHours: number | null | undefined): string {
  if (decimalHours == null || isNaN(decimalHours)) return '--h--';
  const h = Math.floor(decimalHours);
  const m = Math.round((decimalHours - h) * 60);
  if (m === 60) return `${h + 1}h00`;
  return `${h}h${m.toString().padStart(2, '0')}`;
}

export function formatDurationMs(ms: number | null | undefined): string {
  if (ms == null || isNaN(ms)) return '0h00';
  const totalMins = Math.floor(Math.max(0, ms) / 60000);
  const h = Math.floor(totalMins / 60);
  const m = totalMins % 60;
  return `${h}h${m.toString().padStart(2, '0')}`;
}

export function formatTimeIso(dateStr: string): string {
  try {
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return '--:--';
    return d.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
  } catch {
    return '--:--';
  }
}

function hasCalendarRollover(iso: string): boolean {
  const m = /^(\d{4})-(\d{2})-(\d{2})(?:$|T)/.exec(iso.trim());
  if (!m) return false;
  const year = Number(m[1]);
  const month = Number(m[2]);
  const day = Number(m[3]);
  const probe = new Date(Date.UTC(year, month - 1, day));
  return (
    probe.getUTCFullYear() !== year ||
    probe.getUTCMonth() !== month - 1 ||
    probe.getUTCDate() !== day
  );
}

export function toDateTimeLocalValue(iso?: string): string {
  if (!iso || !iso.trim()) return '';
  const trimmed = iso.trim();
  if (hasCalendarRollover(trimmed)) return '';
  if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(trimmed)) {
    return trimmed;
  }
  const d = new Date(trimmed);
  if (isNaN(d.getTime())) return '';
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(
    d.getHours()
  )}:${pad(d.getMinutes())}`;
}

export function formatTimeIsoWithDayOffset(
  dateStr: string,
  referenceStartIso?: string
): string {
  try {
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return '--:--';
    const baseTime = d.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
    if (!referenceStartIso) return baseTime;
    const ref = new Date(referenceStartIso);
    if (isNaN(ref.getTime())) return baseTime;
    const startDayMs = new Date(ref.getFullYear(), ref.getMonth(), ref.getDate()).getTime();
    const targetDayMs = new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
    const dayDiff = Math.round((targetDayMs - startDayMs) / 86400000);
    return dayDiff > 0 ? `${baseTime} (+${dayDiff}j)` : baseTime;
  } catch {
    return '--:--';
  }
}

export interface CutoffEvaluation {
  status: 'none' | 'invalid' | 'ok' | 'warning' | 'exceeded';
  marginFastMin: number | null;
  marginSlowMin: number | null;
}

export function evaluateCutoffMargin(
  cutoffTimeIso: string | undefined,
  arrivalFastIso: string,
  arrivalSlowIso: string
): CutoffEvaluation {
  if (!cutoffTimeIso || !cutoffTimeIso.trim()) {
    return { status: 'none', marginFastMin: null, marginSlowMin: null };
  }
  if (hasCalendarRollover(cutoffTimeIso)) {
    return { status: 'invalid', marginFastMin: null, marginSlowMin: null };
  }
  const cutoffMs = new Date(cutoffTimeIso).getTime();
  const fastMs = new Date(arrivalFastIso).getTime();
  const slowMs = new Date(arrivalSlowIso).getTime();
  if (isNaN(cutoffMs) || isNaN(fastMs) || isNaN(slowMs)) {
    return { status: 'invalid', marginFastMin: null, marginSlowMin: null };
  }
  const rawFastMs = cutoffMs - fastMs;
  const rawSlowMs = cutoffMs - slowMs;
  const flooredFast = Math.floor(rawFastMs / 60000);
  const flooredSlow = Math.floor(rawSlowMs / 60000);
  const marginFastMin = flooredFast === 0 ? 0 : flooredFast;
  const marginSlowMin = flooredSlow === 0 ? 0 : flooredSlow;

  let status: CutoffEvaluation['status'] = 'ok';
  if (rawFastMs < 0) {
    status = 'exceeded';
  } else if (rawSlowMs < 0 || rawFastMs < 15 * 60000) {
    status = 'warning';
  }

  return { status, marginFastMin, marginSlowMin };
}

export function formatMarginMinutes(marginMin: number): string {
  const rounded = Math.round(marginMin);
  const normalized = rounded === 0 ? 0 : rounded;
  const sign = normalized >= 0 ? '+' : '-';
  const abs = Math.abs(normalized);
  if (abs < 60) return `${sign}${abs} min`;
  const h = Math.floor(abs / 60);
  const m = abs % 60;
  return `${sign}${h}h${m.toString().padStart(2, '0')}`;
}

export function normalizeWaypointsForSave(waypoints: RoadbookWaypoint[]): RoadbookWaypoint[] {
  return waypoints.map((wp) => {
    const cleaned: RoadbookWaypoint = { ...wp };
    if (!cleaned.cutoffTimeIso || !cleaned.cutoffTimeIso.trim()) {
      delete cleaned.cutoffTimeIso;
    } else {
      cleaned.cutoffTimeIso = cleaned.cutoffTimeIso.trim();
    }

    if (cleaned.plannedNutrition) {
      const nextNutrition: Record<string, number> = {};
      for (const [prodId, rawQty] of Object.entries(cleaned.plannedNutrition)) {
        const qty = Number.isFinite(rawQty) ? Math.floor(rawQty) : 0;
        if (qty > 0) {
          nextNutrition[prodId] = qty;
        }
      }
      if (Object.keys(nextNutrition).length > 0) {
        cleaned.plannedNutrition = nextNutrition;
      } else {
        delete cleaned.plannedNutrition;
      }
    }

    return cleaned;
  });
}

export function formatPace(minPerKm: number): string {
  if (!minPerKm || !isFinite(minPerKm) || minPerKm <= 0) return "--'--\"";
  const mins = Math.floor(minPerKm);
  const secs = Math.round((minPerKm - mins) * 60);
  if (secs === 60) {
    return `${mins + 1}'00"/km`;
  }
  return `${mins}'${secs.toString().padStart(2, '0')}"/km`;
}

interface RawSegmentGeom {
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
  climbKmEffort: number;
  climbElePosM: number;
}

/**
 * Génère les segments complets du Roadbook (temps rapide/lent, VAM, seuil marche, nuit SunCalc).
 */
export function generateRoadbookSegments(
  points: GpxPoint[],
  waypoints: RoadbookWaypoint[],
  config: PacingConfig
): RoadbookSegment[] {
  if (!points || points.length === 0) return [];
  const orderedWaypoints = enrichWaypointsWithStartEnd(waypoints, points);
  if (orderedWaypoints.length < 2) return [];

  const weatherCoeff = getWeatherCoefficient(config.weather);
  const rawSegments: RawSegmentGeom[] = [];
  let cumulDistanceKm = 0;
  let cumulElevationM = 0;

  for (let i = 0; i < orderedWaypoints.length - 1; i++) {
    const startWp = orderedWaypoints[i];
    const endWp = orderedWaypoints[i + 1];

    let segmentDistKm = 0;
    let segmentElePosM = 0;
    let segmentEleNegM = 0;
    let climbDistKm = 0;
    let climbElePosM = 0;
    let descendDistKm = 0;
    let descendEleNegM = 0;

    let currentRefEle = points[startWp.pointIndex]?.ele || 0;
    let lastRefDistKm = 0;

    for (let j = startWp.pointIndex; j < endWp.pointIndex; j++) {
      const p1 = points[j];
      const p2 = points[j + 1];
      const d = calculateDistance(p1.lat, p1.lon, p2.lat, p2.lon) * config.distanceFactor;
      segmentDistKm += d;

      const diff = p2.ele - currentRefEle;
      if (diff >= config.elevationThresholdM) {
        segmentElePosM += diff;
        climbElePosM += diff;
        climbDistKm += segmentDistKm - lastRefDistKm;
        currentRefEle = p2.ele;
        lastRefDistKm = segmentDistKm;
      } else if (diff <= -config.elevationThresholdM) {
        segmentEleNegM += Math.abs(diff);
        descendEleNegM += Math.abs(diff);
        descendDistKm += segmentDistKm - lastRefDistKm;
        currentRefEle = p2.ele;
        lastRefDistKm = segmentDistKm;
      }
    }

    const avgDescentSlopePct =
      descendDistKm > 0 && descendEleNegM > 0
        ? (descendEleNegM / (descendDistKm * 1000)) * 100
        : 0;

    const kmEffort = calculateKmEffort(
      segmentDistKm,
      segmentElePosM,
      segmentEleNegM,
      config.descentThresholdPct,
      avgDescentSlopePct,
      config.upCostDivider,
      config.downCostModifier
    );

    cumulDistanceKm += segmentDistKm;
    cumulElevationM += segmentElePosM;

    rawSegments.push({
      id: `seg-${i}`,
      index: i,
      from: startWp,
      to: endWp,
      distanceKm: segmentDistKm,
      cumulDistanceKm,
      elevationPosM: segmentElePosM,
      elevationNegM: segmentEleNegM,
      cumulElevationM,
      kmEffort,
      climbKmEffort: calculateKmEffort(
        climbDistKm,
        climbElePosM,
        0,
        config.descentThresholdPct,
        0,
        config.upCostDivider,
        config.downCostModifier
      ),
      climbElePosM,
    });
  }

  const parsedStart = config.startTimeIso ? new Date(config.startTimeIso).getTime() : NaN;
  const startTimeMs = isNaN(parsedStart) ? new Date().setHours(6, 0, 0, 0) : parsedStart;

  const E = rawSegments.reduce((acc, seg) => acc + seg.kmEffort, 0.001);
  const totalStandardKe = rawSegments.reduce(
    (acc, seg) => acc + seg.distanceKm + seg.elevationPosM / 100,
    0.001
  );

  const ultraFatigueScale =
    totalStandardKe > 65 ? 1 + Math.min(0.65, (totalStandardKe - 65) / 180) : 1.0;
  const F = Math.min(60, (config.fatiguePercent || 0) * ultraFatigueScale);
  const { flatSpeedKmh } = estimateBasePaces(config.itraIndex, totalStandardKe);

  let currentX = 0;
  const segmentsBase = rawSegments.map((seg) => {
    const standardKmEffort = seg.distanceKm + seg.elevationPosM / 100;
    const blendedSegEffort = standardKmEffort * 0.45 + seg.kmEffort * 0.55;
    const terrainFactor = getTerrainFactor(seg.to.technicality || 2);
    const paceProfileFactor = config.paceProfile === 'aggressive' ? 0.95 : 1.0;
    const freshHours = blendedSegEffort / flatSpeedKmh;
    const freshMs = freshHours * 3600000 * terrainFactor * paceProfileFactor;

    const baseFatigueFactor =
      seg.kmEffort > 0 ? computeFatigueIntegral(currentX, seg.kmEffort, E, F) / seg.kmEffort : 1;

    const progress = E > 0 ? (currentX + seg.kmEffort / 2) / E : 0;
    let pacingMultiplier = 1.0;
    if (config.pacingStrategy === 'prudent') {
      pacingMultiplier = 1.05 - 0.1 * progress;
    } else if (config.pacingStrategy === 'aggressive') {
      pacingMultiplier = 0.95 + 0.15 * progress;
    }

    currentX += seg.kmEffort;
    return {
      ...seg,
      fatiguedMs: freshMs * baseFatigueFactor * pacingMultiplier,
    };
  });

  const baseLat = points[0] && Number.isFinite(points[0].lat) ? points[0].lat : 45.92;
  const baseLon = points[0] && Number.isFinite(points[0].lon) ? points[0].lon : 6.87;

  let cumulMsPass1 = startTimeMs;
  let totalPredictedMs = 0;
  let totalPauseMs = 0;

  for (const seg of segmentsBase) {
    const modifier = (seg.to.timeModifierPct || 100) / 100.0;
    const basePass1Ms = seg.fatiguedMs / modifier / weatherCoeff;
    const nightIntens0 = getNightIntensity(
      new Date(cumulMsPass1 + basePass1Ms / 2),
      baseLat,
      baseLon
    );
    const estPass1Ms = basePass1Ms / getNightCoefficient(nightIntens0);
    const nightIntens = getNightIntensity(
      new Date(cumulMsPass1 + estPass1Ms / 2),
      baseLat,
      baseLon
    );
    const nightCoeff = getNightCoefficient(nightIntens);
    const segFinalMs = basePass1Ms / nightCoeff;
    totalPredictedMs += segFinalMs;

    const pauseMs = (seg.to.pauseMinutes || 0) * 60000;
    totalPauseMs += pauseMs;
    cumulMsPass1 += segFinalMs + pauseMs;
  }

  const totalDistCalc = rawSegments.reduce((acc, s) => acc + s.distanceKm, 0);
  const totalEleCalc = rawSegments.reduce((acc, s) => acc + s.elevationPosM, 0);
  const effectiveTargetHours =
    config.targetTimeHours && config.targetTimeHours > 0
      ? config.targetTimeHours
      : estimateRaceTargetHours({
          distanceKm: totalDistCalc,
          elevationGainM: totalEleCalc,
          itraIndex: config.itraIndex,
          fatiguePercent: config.fatiguePercent,
          upCostDivider: config.upCostDivider,
          downCostModifier: config.downCostModifier,
          pauseMinutesTotal: totalPauseMs / 60000,
          paceProfile: config.paceProfile,
        });

  const targetFastMs = effectiveTargetHours * 3600000;
  const remainingTargetFastMs = targetFastMs - totalPauseMs;
  const fastRatio =
    totalPredictedMs > 0 ? Math.max(0.15, remainingTargetFastMs / totalPredictedMs) : 1.0;

  const slowSpread =
    totalStandardKe <= 65 ? 1.1 : Math.min(1.17, 1.1 + ((totalStandardKe - 65) / 150) * 0.07);
  const slowRatio = fastRatio * slowSpread;

  let cumulMsFast = startTimeMs;
  let cumulMsSlow = startTimeMs;

  return segmentsBase.map((seg, i) => {
    const modifier = (seg.to.timeModifierPct || 100) / 100.0;
    const baseFastMs = (seg.fatiguedMs * fastRatio) / modifier / weatherCoeff;
    const nightIntensFast0 = getNightIntensity(
      new Date(cumulMsFast + baseFastMs / 2),
      baseLat,
      baseLon
    );
    const estFastMs = baseFastMs / getNightCoefficient(nightIntensFast0);
    const nightIntensFast = getNightIntensity(
      new Date(cumulMsFast + estFastMs / 2),
      baseLat,
      baseLon
    );
    const nightCoeffFast = getNightCoefficient(nightIntensFast);

    const baseSlowMs = (seg.fatiguedMs * slowRatio) / modifier / weatherCoeff;
    const nightIntensSlow0 = getNightIntensity(
      new Date(cumulMsSlow + baseSlowMs / 2),
      baseLat,
      baseLon
    );
    const estSlowMs = baseSlowMs / getNightCoefficient(nightIntensSlow0);
    const nightIntensSlow = getNightIntensity(
      new Date(cumulMsSlow + estSlowMs / 2),
      baseLat,
      baseLon
    );
    const nightCoeffSlow = getNightCoefficient(nightIntensSlow);

    const durationFastMs = baseFastMs / nightCoeffFast;
    const durationSlowMs = baseSlowMs / nightCoeffSlow;

    cumulMsFast += durationFastMs;
    cumulMsSlow += durationSlowMs;

    const arrivalFastIso = new Date(cumulMsFast).toISOString();
    const arrivalSlowIso = new Date(cumulMsSlow).toISOString();

    const pauseMs = (seg.to.pauseMinutes || 0) * 60000;
    cumulMsFast += pauseMs;
    cumulMsSlow += pauseMs;

    const localX = segmentsBase.slice(0, i).reduce((a, b) => a + b.kmEffort, 0);
    const walkThresholdDecimal = computeWalkThreshold(localX, E, F, config.walkThresholdPct);

    let walkDistKm = 0;
    let runUphillDistKm = 0;
    let tempRefEle = points[seg.from.pointIndex]?.ele || 0;
    let tempRefDistKm = 0;
    let tempSegDistKm = 0;

    for (let j = seg.from.pointIndex; j < seg.to.pointIndex; j++) {
      const p1 = points[j];
      const p2 = points[j + 1];
      const d = calculateDistance(p1.lat, p1.lon, p2.lat, p2.lon) * config.distanceFactor;
      tempSegDistKm += d;

      const diff = p2.ele - tempRefEle;
      if (diff >= config.elevationThresholdM) {
        const dSinceRef = tempSegDistKm - tempRefDistKm;
        const slope = dSinceRef > 0 ? diff / (dSinceRef * 1000) : 0;
        if (slope >= walkThresholdDecimal) {
          walkDistKm += dSinceRef;
        } else {
          runUphillDistKm += dSinceRef;
        }
        tempRefEle = p2.ele;
        tempRefDistKm = tempSegDistKm;
      } else if (diff <= -config.elevationThresholdM) {
        tempRefEle = p2.ele;
        tempRefDistKm = tempSegDistKm;
      }
    }

    const downFlatDistKm = Math.max(0, seg.distanceKm - walkDistKm - runUphillDistKm);
    const timeOnClimbsHours =
      (durationFastMs / 3600000) * (seg.climbKmEffort / (seg.kmEffort || 1)) || 0;
    const vamEstimate =
      timeOnClimbsHours > 0 && seg.climbElePosM > 0
        ? Math.round(seg.climbElePosM / timeOnClimbsHours)
        : 0;

    const paceTargetMinPerKm = seg.distanceKm > 0 ? durationFastMs / 60000 / seg.distanceKm : 0;
    const paceSlowMinPerKm = seg.distanceKm > 0 ? durationSlowMs / 60000 / seg.distanceKm : 0;

    return {
      id: seg.id,
      index: seg.index,
      from: seg.from,
      to: seg.to,
      distanceKm: Number(seg.distanceKm.toFixed(2)),
      cumulDistanceKm: Number(seg.cumulDistanceKm.toFixed(2)),
      elevationPosM: Math.round(seg.elevationPosM),
      elevationNegM: Math.round(seg.elevationNegM),
      cumulElevationM: Math.round(seg.cumulElevationM),
      kmEffort: Number(seg.kmEffort.toFixed(1)),
      durationFastMs,
      durationSlowMs,
      arrivalFastIso,
      arrivalSlowIso,
      paceTargetMinPerKm,
      paceSlowMinPerKm,
      vamEstimate,
      walkDistKm: Number(walkDistKm.toFixed(2)),
      runUphillDistKm: Number(runUphillDistKm.toFixed(2)),
      downFlatDistKm: Number(downFlatDistKm.toFixed(2)),
      walkThresholdPct: Math.round(walkThresholdDecimal * 100),
      nightIntensity: nightIntensFast,
      weatherCoeff,
    };
  });
}

/**
 * Trace alpine synthétique réaliste (42 km / 2 650 m D+) pour essai libre du Roadbook Express.
 */
export function getSampleAlpineTrailTrace(): {
  name: string;
  points: GpxPoint[];
  waypoints: RoadbookWaypoint[];
} {
  const totalSamples = 210; // ~200m par point -> ~42 km
  const points: GpxPoint[] = [];
  const startLat = 45.9237; // Chamonix
  const startLon = 6.8694;

  // Profil réaliste à 3 bosses (Départ 1040m -> Col 1 2150m -> Vallée 1400m -> Col 2 2480m -> Vallée 1250m -> Col 3 1950m -> Arrivée 1040m)
  const anchors = [
    { idx: 0, ele: 1040 },
    { idx: 42, ele: 2150 },
    { idx: 78, ele: 1380 },
    { idx: 122, ele: 2480 },
    { idx: 158, ele: 1250 },
    { idx: 184, ele: 1940 },
    { idx: 209, ele: 1040 },
  ];

  const interpolateEle = (idx: number): number => {
    for (let i = 0; i < anchors.length - 1; i++) {
      const a = anchors[i];
      const b = anchors[i + 1];
      if (idx >= a.idx && idx <= b.idx) {
        const t = (idx - a.idx) / (b.idx - a.idx);
        const smoothT = t * t * (3 - 2 * t);
        return Math.round(a.ele + (b.ele - a.ele) * smoothT);
      }
    }
    return 1040;
  };

  for (let i = 0; i < totalSamples; i++) {
    const angle = (i / totalSamples) * Math.PI * 1.85;
    const lat = startLat + Math.sin(angle) * 0.055 + i * 0.0002;
    const lon = startLon + (1 - Math.cos(angle)) * 0.045;
    points.push({
      lat: Number(lat.toFixed(6)),
      lon: Number(lon.toFixed(6)),
      ele: interpolateEle(i),
    });
  }

  const waypoints: RoadbookWaypoint[] = [
    {
      id: 'wp-0',
      name: 'Départ — Place du Mont-Blanc',
      lat: points[0].lat,
      lon: points[0].lon,
      ele: points[0].ele,
      pointIndex: 0,
      type: 'start',
      pauseMinutes: 0,
      technicality: 2,
    },
    {
      id: 'wp-1',
      name: 'Ravito 1 — Chalets d’Alpage',
      lat: points[42].lat,
      lon: points[42].lon,
      ele: points[42].ele,
      pointIndex: 42,
      type: 'aid_station',
      pauseMinutes: 4,
      technicality: 3,
    },
    {
      id: 'wp-2',
      name: 'Base de Vie — Vallorcine',
      lat: points[78].lat,
      lon: points[78].lon,
      ele: points[78].ele,
      pointIndex: 78,
      type: 'life_base',
      pauseMinutes: 8,
      technicality: 2,
    },
    {
      id: 'wp-3',
      name: 'Ravito 2 — Col des Aiguilles',
      lat: points[122].lat,
      lon: points[122].lon,
      ele: points[122].ele,
      pointIndex: 122,
      type: 'pass',
      pauseMinutes: 5,
      technicality: 4,
    },
    {
      id: 'wp-4',
      name: 'Ravito 3 — Refuge du Tour',
      lat: points[158].lat,
      lon: points[158].lon,
      ele: points[158].ele,
      pointIndex: 158,
      type: 'aid_station',
      pauseMinutes: 5,
      technicality: 3,
    },
    {
      id: 'wp-5',
      name: 'Arrivée — Chamonix',
      lat: points[209].lat,
      lon: points[209].lon,
      ele: points[209].ele,
      pointIndex: 209,
      type: 'finish',
      pauseMinutes: 0,
      technicality: 2,
    },
  ];

  return {
    name: 'Tour des Aiguilles — Trail 42 km (Démo)',
    points,
    waypoints,
  };
}
