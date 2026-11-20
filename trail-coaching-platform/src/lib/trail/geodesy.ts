import type { GpxPoint, RoadbookWaypoint } from '@/types/domain';

export interface ElevationChartPoint {
  xKm: number;
  yEle: number;
  slopePct: number;
}

export interface TraceStats {
  distanceKm: number;
  elevationGainM: number;
  elevationLossM: number;
  minEleM: number;
  maxEleM: number;
}

/**
 * Calcule la distance entre deux coordonnées GPS (Haversine WGS-84).
 * Retourne la distance en kilomètres.
 */
export function calculateDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

/**
 * Trouve l'index du point GPS le plus proche d'une coordonnée donnée.
 */
export function findClosestPointIndex(lat: number, lon: number, points: GpxPoint[]): number {
  if (!points || points.length === 0) return -1;
  let minIndex = 0;
  let minDistSq = Infinity;

  for (let i = 0; i < points.length; i++) {
    const dLat = points[i].lat - lat;
    const dLon = points[i].lon - lon;
    const distSq = dLat * dLat + dLon * dLon;
    if (distSq < minDistSq) {
      minDistSq = distSq;
      minIndex = i;
    }
  }
  return minIndex;
}

/**
 * Trouve l'index GPS correspondant le mieux à une distance cumulée (km).
 */
export function findPointIndexByDistance(
  targetDistanceKm: number,
  points: GpxPoint[],
  distanceFactor: number = 1
): number {
  if (!points || points.length === 0) return 0;
  if (targetDistanceKm <= 0) return 0;

  let currentDist = 0;
  for (let i = 0; i < points.length - 1; i++) {
    const d = calculateDistance(points[i].lat, points[i].lon, points[i + 1].lat, points[i + 1].lon) * distanceFactor;
    if (currentDist + d >= targetDistanceKm) {
      return targetDistanceKm - currentDist < currentDist + d - targetDistanceKm ? i : i + 1;
    }
    currentDist += d;
  }
  return points.length - 1;
}

/**
 * Ajoute Départ et Arrivée s'ils sont absents et trie les ravitaillements le long de la trace.
 */
export function enrichWaypointsWithStartEnd(
  waypoints: RoadbookWaypoint[],
  points: GpxPoint[]
): RoadbookWaypoint[] {
  if (!points || points.length === 0) return waypoints;

  const enriched = waypoints
    .map((wp) => ({
      ...wp,
      pointIndex:
        wp.pointIndex >= 0 && wp.pointIndex < points.length
          ? wp.pointIndex
          : findClosestPointIndex(wp.lat, wp.lon, points),
    }))
    .sort((a, b) => a.pointIndex - b.pointIndex);

  if (enriched.length === 0 || enriched[0].pointIndex > 5) {
    enriched.unshift({
      id: 'wp-start',
      name: 'Départ',
      lat: points[0].lat,
      lon: points[0].lon,
      ele: points[0].ele,
      pointIndex: 0,
      type: 'start',
      pauseMinutes: 0,
      timeModifierPct: 100,
      technicality: 2,
    });
  } else {
    enriched[0].pointIndex = 0;
  }

  const lastIndex = points.length - 1;
  if (enriched[enriched.length - 1].pointIndex < lastIndex - 5) {
    enriched.push({
      id: 'wp-end',
      name: 'Arrivée',
      lat: points[lastIndex].lat,
      lon: points[lastIndex].lon,
      ele: points[lastIndex].ele,
      pointIndex: lastIndex,
      type: 'finish',
      pauseMinutes: 0,
      timeModifierPct: 100,
      technicality: 2,
    });
  } else {
    enriched[enriched.length - 1].pointIndex = lastIndex;
  }

  return enriched;
}

/**
 * Calcule Distance, D+, D-, Min/Max avec lissage anti-bruit GPS.
 */
export function calculateTraceStats(
  points: GpxPoint[],
  elevationThresholdM: number = 5,
  distanceFactor: number = 1
): TraceStats {
  if (!points || points.length === 0) {
    return { distanceKm: 0, elevationGainM: 0, elevationLossM: 0, minEleM: 0, maxEleM: 0 };
  }

  let distanceKm = 0;
  let elevationGainM = 0;
  let elevationLossM = 0;
  let currentRefEle = points[0].ele || 0;
  let minEleM = points[0].ele || 0;
  let maxEleM = points[0].ele || 0;

  for (let i = 0; i < points.length - 1; i++) {
    const p1 = points[i];
    const p2 = points[i + 1];
    distanceKm += calculateDistance(p1.lat, p1.lon, p2.lat, p2.lon) * distanceFactor;

    if (p2.ele < minEleM) minEleM = p2.ele;
    if (p2.ele > maxEleM) maxEleM = p2.ele;

    const diff = p2.ele - currentRefEle;
    if (diff >= elevationThresholdM) {
      elevationGainM += diff;
      currentRefEle = p2.ele;
    } else if (diff <= -elevationThresholdM) {
      elevationLossM += Math.abs(diff);
      currentRefEle = p2.ele;
    }
  }

  return {
    distanceKm: Number(distanceKm.toFixed(2)),
    elevationGainM: Math.round(elevationGainM),
    elevationLossM: Math.round(elevationLossM),
    minEleM: Math.round(minEleM),
    maxEleM: Math.round(maxEleM),
  };
}

/**
 * Recherche dichotomique du seuil de lissage correspondant au D+ officiel organisateur.
 */
export function findOptimalElevationThreshold(points: GpxPoint[], targetElevationM: number): number {
  if (!points || points.length === 0 || !targetElevationM || targetElevationM <= 0) return 5;
  let low = 0;
  let high = 50;
  let bestThreshold = 5;

  for (let iter = 0; iter < 15; iter++) {
    const mid = (low + high) / 2;
    const stats = calculateTraceStats(points, mid, 1);

    if (Math.abs(stats.elevationGainM - targetElevationM) < 5) return mid;

    if (stats.elevationGainM > targetElevationM) {
      low = mid;
    } else {
      high = mid;
    }
    bestThreshold = mid;
  }

  return bestThreshold;
}

/**
 * Génère la série lissée (pente sur fenêtre de 250 m) pour le graphe de profil altimétrique.
 */
export function generateElevationChartPoints(
  points: GpxPoint[],
  distanceFactor: number = 1,
  maxPoints: number = 320
): ElevationChartPoint[] {
  if (!points || points.length === 0) return [];

  let currentDist = 0;
  const raw: ElevationChartPoint[] = [];

  for (let i = 0; i < points.length; i++) {
    if (i > 0) {
      currentDist +=
        calculateDistance(points[i - 1].lat, points[i - 1].lon, points[i].lat, points[i].lon) * distanceFactor;
    }

    let slopePct = 0;
    let distNext = 0;
    let nextIdx = i;
    while (nextIdx < points.length - 1 && distNext < 0.25) {
      distNext +=
        calculateDistance(
          points[nextIdx].lat,
          points[nextIdx].lon,
          points[nextIdx + 1].lat,
          points[nextIdx + 1].lon
        ) * distanceFactor;
      nextIdx++;
    }

    if (distNext > 0) {
      slopePct = ((points[nextIdx].ele - points[i].ele) / (distNext * 1000)) * 100;
    }

    raw.push({
      xKm: Number(currentDist.toFixed(2)),
      yEle: Math.round(points[i].ele),
      slopePct: Number(slopePct.toFixed(1)),
    });
  }

  if (raw.length <= maxPoints) return raw;

  const step = Math.ceil(raw.length / maxPoints);
  const sampled: ElevationChartPoint[] = [];
  for (let i = 0; i < raw.length; i += step) {
    sampled.push(raw[i]);
  }
  if (sampled[sampled.length - 1] !== raw[raw.length - 1]) {
    sampled.push(raw[raw.length - 1]);
  }
  return sampled;
}
