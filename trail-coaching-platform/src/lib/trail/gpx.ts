import type { GpxPoint, RoadbookWaypoint } from '@/types/domain';
import { calculateTraceStats, findClosestPointIndex } from './geodesy';

export interface ParsedGpxResult {
  name: string;
  points: GpxPoint[];
  waypoints: RoadbookWaypoint[];
  distanceKm: number;
  elevationGainM: number;
  elevationLossM: number;
}

/**
 * Parseur GPX XML côté navigateur pur (sans dépendance fragile).
 * Extrait `<trkpt>`, `<rtept>` et `<wpt>` avec coordonnées, altitudes et noms.
 */
export function parseGpxXml(xmlText: string, fallbackName: string = 'Parcours Trail'): ParsedGpxResult {
  if (typeof DOMParser === 'undefined') {
    throw new Error('Le parseur GPX XML nécessite un environnement navigateur.');
  }

  const parser = new DOMParser();
  const doc = parser.parseFromString(xmlText, 'application/xml');
  const parserError = doc.querySelector('parsererror');
  if (parserError) {
    throw new Error('Le fichier GPX est mal formé ou corrompu.');
  }

  const trackNameNode =
    doc.querySelector('trk > name') ||
    doc.querySelector('metadata > name') ||
    doc.querySelector('rte > name');
  const name = trackNameNode?.textContent?.trim() || fallbackName;

  const pointNodes = Array.from(doc.querySelectorAll('trkpt'));
  const routeNodes = pointNodes.length > 0 ? pointNodes : Array.from(doc.querySelectorAll('rtept'));

  if (routeNodes.length < 2) {
    throw new Error('Le fichier GPX ne contient pas suffisamment de points GPS (<trkpt> ou <rtept>).');
  }

  const points: GpxPoint[] = [];
  for (const node of routeNodes) {
    const lat = parseFloat(node.getAttribute('lat') || '');
    const lon = parseFloat(node.getAttribute('lon') || '');
    const eleText = node.querySelector('ele')?.textContent;
    const ele = eleText ? parseFloat(eleText) : 0;

    if (!isNaN(lat) && !isNaN(lon)) {
      points.push({
        lat,
        lon,
        ele: isNaN(ele) ? 0 : ele,
      });
    }
  }

  if (points.length < 2) {
    throw new Error('Coordonnées GPS invalides dans le fichier GPX.');
  }

  const wptNodes = Array.from(doc.querySelectorAll('wpt'));
  const waypoints: RoadbookWaypoint[] = wptNodes
    .map((wpt, idx) => {
      const lat = parseFloat(wpt.getAttribute('lat') || '');
      const lon = parseFloat(wpt.getAttribute('lon') || '');
      if (isNaN(lat) || isNaN(lon)) return null;
      const eleText = wpt.querySelector('ele')?.textContent;
      const eleVal = eleText ? parseFloat(eleText) : NaN;
      const closestIdx = findClosestPointIndex(lat, lon, points);
      return {
        id: `wp-gpx-${idx}-${Date.now()}`,
        name: wpt.querySelector('name')?.textContent?.trim() || `Point ${idx + 1}`,
        lat,
        lon,
        ele: isNaN(eleVal) ? points[closestIdx]?.ele || 0 : eleVal,
        pointIndex: closestIdx >= 0 ? closestIdx : 0,
        pauseMinutes: 3,
        timeModifierPct: 100,
        technicality: 2 as const,
        type: 'aid_station' as const,
        desc: wpt.querySelector('desc')?.textContent?.trim() || '',
      };
    })
    .filter((w): w is NonNullable<typeof w> => w !== null);

  const stats = calculateTraceStats(points, 5, 1);

  return {
    name,
    points,
    waypoints,
    distanceKm: stats.distanceKm,
    elevationGainM: stats.elevationGainM,
    elevationLossM: stats.elevationLossM,
  };
}

function escapeXml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

/**
 * Exporte un roadbook complet (trace + waypoints enrichis) en fichier GPX 1.1 valide.
 */
export function exportRoadbookToGpx(
  name: string,
  points: GpxPoint[],
  waypoints: RoadbookWaypoint[]
): string {
  const wptXml = waypoints
    .map(
      (wp) => `  <wpt lat="${wp.lat.toFixed(6)}" lon="${wp.lon.toFixed(6)}">
    <ele>${Math.round(wp.ele || 0)}</ele>
    <name>${escapeXml(wp.name)}</name>${
      wp.desc ? `\n    <desc>${escapeXml(wp.desc)}</desc>` : ''
    }
  </wpt>`
    )
    .join('\n');

  const trkptsXml = points
    .map(
      (pt) => `      <trkpt lat="${pt.lat.toFixed(6)}" lon="${pt.lon.toFixed(6)}">
        <ele>${Math.round(pt.ele || 0)}</ele>
      </trkpt>`
    )
    .join('\n');

  return `<?xml version="1.0" encoding="UTF-8"?>
<gpx version="1.1" creator="myKairn Coach" xmlns="http://www.topografix.com/GPX/1/1">
  <metadata>
    <name>${escapeXml(name)}</name>
    <time>${new Date().toISOString()}</time>
  </metadata>
${wptXml}
  <trk>
    <name>${escapeXml(name)}</name>
    <trkseg>
${trkptsXml}
    </trkseg>
  </trk>
</gpx>`;
}
