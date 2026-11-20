'use client';

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  MapContainer,
  TileLayer,
  Polyline,
  Marker,
  Popup,
  CircleMarker,
  useMap,
  useMapEvents,
} from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { Maximize2, Minimize2, Crosshair, MapPin, Layers } from 'lucide-react';
import { calculateDistance, findClosestPointIndex } from '@/lib/trail/geodesy';
import type { GpxPoint, RoadbookSegment, RoadbookWaypoint } from '@/types/domain';

export interface TrailMapProps {
  points: GpxPoint[];
  segments: RoadbookSegment[];
  hoveredPoint: GpxPoint | null;
  onAddWaypoint: (wp: RoadbookWaypoint) => void;
  onUpdateWaypoint: (id: string, updates: Partial<RoadbookWaypoint>) => void;
  onRemoveWaypoint: (id: string) => void;
  waypointCount: number;
}

type TileLayerMode = 'osm' | 'topo' | 'satellite';

const TILE_LAYERS: Record<
  TileLayerMode,
  { label: string; url: string; attribution: string; maxZoom: number }
> = {
  osm: {
    label: 'OSM',
    url: 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',
    attribution: '&copy; OpenStreetMap contributors',
    maxZoom: 19,
  },
  topo: {
    label: 'Topo',
    url: 'https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png',
    attribution: '&copy; OpenStreetMap, SRTM | &copy; OpenTopoMap (CC-BY-SA)',
    maxZoom: 17,
  },
  satellite: {
    label: 'Satellite',
    url: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
    attribution: '&copy; Esri World Imagery',
    maxZoom: 18,
  },
};

function createWaypointIcon(label: string, color: string): L.DivIcon {
  return L.divIcon({
    className: 'mk-waypoint-icon',
    html: `<div style="background-color:${color};color:#FFFFFF;border-radius:9999px;width:26px;height:26px;display:flex;align-items:center;justify-content:center;font-family:var(--font-mono),ui-monospace,monospace;font-weight:700;font-size:11px;border:2px solid #FFFFFF;box-shadow:0 2px 6px rgba(15,23,42,0.35);">${label}</div>`,
    iconSize: [26, 26],
    iconAnchor: [13, 13],
    popupAnchor: [0, -14],
  });
}

function MapBoundsSync({
  bounds,
  boundsKey,
  mapInstanceRef,
}: {
  bounds: L.LatLngBounds | null;
  boundsKey: string;
  mapInstanceRef: React.MutableRefObject<L.Map | null>;
}) {
  const map = useMap();

  useEffect(() => {
    mapInstanceRef.current = map;
  }, [map, mapInstanceRef]);

  useEffect(() => {
    if (bounds) {
      map.fitBounds(bounds, { padding: [28, 28] });
    }
  }, [map, bounds, boundsKey]);

  return null;
}

function MapClickHandler({
  onTraceClick,
}: {
  onTraceClick: (latlng: L.LatLng, map: L.Map, originalEvent: MouseEvent) => void;
}) {
  const map = useMapEvents({
    click(e) {
      onTraceClick(e.latlng, map, e.originalEvent);
    },
  });
  return null;
}

export default function TrailMap({
  points,
  segments,
  hoveredPoint,
  onAddWaypoint,
  onUpdateWaypoint,
  onRemoveWaypoint,
  waypointCount,
}: TrailMapProps) {
  const mapInstanceRef = useRef<L.Map | null>(null);
  const noticeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [layerMode, setLayerMode] = useState<TileLayerMode>('osm');
  const [isExpanded, setIsExpanded] = useState(false);
  const [mapNotice, setMapNotice] = useState<{
    kind: 'info' | 'warn';
    text: string;
  } | null>(null);

  useEffect(() => {
    return () => {
      if (noticeTimerRef.current) clearTimeout(noticeTimerRef.current);
    };
  }, []);

  const showNotice = useCallback((kind: 'info' | 'warn', text: string) => {
    if (noticeTimerRef.current) clearTimeout(noticeTimerRef.current);
    setMapNotice({ kind, text });
    noticeTimerRef.current = setTimeout(() => {
      setMapNotice(null);
    }, 3500);
  }, []);

  const polylinePositions = useMemo<[number, number][]>(
    () => points.map((p) => [p.lat, p.lon]),
    [points]
  );

  const bounds = useMemo(() => {
    if (polylinePositions.length === 0) return null;
    return L.latLngBounds(polylinePositions);
  }, [polylinePositions]);

  const boundsKey = useMemo(() => {
    if (points.length === 0) return 'empty';
    const first = points[0];
    const last = points[points.length - 1];
    return `${points.length}:${first.lat.toFixed(4)}:${first.lon.toFixed(4)}:${last.lat.toFixed(4)}:${last.lon.toFixed(4)}`;
  }, [points]);

  const markerList = useMemo(() => {
    if (!segments || segments.length === 0) return [];
    const items: Array<{ wp: RoadbookWaypoint; cumulKm: number }> = [
      { wp: segments[0].from, cumulKm: 0 },
    ];
    for (const seg of segments) {
      items.push({ wp: seg.to, cumulKm: seg.cumulDistanceKm });
    }
    return items;
  }, [segments]);

  const handleTraceClick = useCallback(
    (latlng: L.LatLng, map: L.Map, originalEvent: MouseEvent) => {
      const targetEl = originalEvent?.target as HTMLElement | null;
      if (
        targetEl &&
        (targetEl.closest('.leaflet-popup') ||
          targetEl.closest('.leaflet-control') ||
          targetEl.closest('.mk-map-ui'))
      ) {
        return;
      }
      if (points.length === 0) return;

      const closestIdx = findClosestPointIndex(latlng.lat, latlng.lng, points);
      const closest = points[closestIdx];
      if (!closest) return;

      const clickPx = map.latLngToContainerPoint(latlng);
      const closestPx = map.latLngToContainerPoint([closest.lat, closest.lon]);
      const pixelDist = clickPx.distanceTo(closestPx);
      const geoDistKm = calculateDistance(latlng.lat, latlng.lng, closest.lat, closest.lon);

      if (pixelDist <= 32 || geoDistKm <= 0.5) {
        const intermediateCount = markerList.filter(
          ({ wp }, idx) =>
            idx !== 0 &&
            idx !== markerList.length - 1 &&
            wp.type !== 'start' &&
            wp.type !== 'finish'
        ).length;
        const name = `R${intermediateCount + 1}`;
        onAddWaypoint({
          id: `wp-map-${Date.now()}`,
          name,
          lat: closest.lat,
          lon: closest.lon,
          ele: closest.ele,
          pointIndex: closestIdx,
          pauseMinutes: 3,
          timeModifierPct: 100,
          technicality: 2,
          type: 'aid_station',
        });
        showNotice('info', `Point ${name} ajouté sur la trace (alt. ${Math.round(closest.ele)} m).`);
      } else {
        showNotice(
          'warn',
          'Cliquez directement sur la trace orange pour ajouter un ravitaillement.'
        );
      }
    },
    [points, markerList, onAddWaypoint, showNotice]
  );

  const handleRecenter = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (mapInstanceRef.current && bounds) {
      mapInstanceRef.current.fitBounds(bounds, { padding: [28, 28] });
    }
  };

  const handleToggleExpand = (e: React.MouseEvent) => {
    e.stopPropagation();
    setIsExpanded((prev) => !prev);
    setTimeout(() => {
      mapInstanceRef.current?.invalidateSize();
    }, 280);
  };

  if (!bounds) {
    return (
      <div className="h-[360px] rounded-md border border-dashed border-slate-300 flex items-center justify-center font-mono text-xs text-slate-400">
        AUCUNE TRACE GPS CHARGÉE POUR LA CARTE
      </div>
    );
  }

  const tile = TILE_LAYERS[layerMode];

  return (
    <div className="space-y-2.5">
      <div
        className={`relative isolate z-0 w-full rounded-md overflow-hidden border border-slate-200 bg-slate-100 transition-all duration-200 ${
          isExpanded ? 'h-[72vh] min-h-[520px]' : 'h-[400px]'
        }`}
      >
        {/* Contrôles flottants */}
        <div className="mk-map-ui absolute top-3 right-3 z-[500] flex flex-wrap items-center justify-end gap-1.5 no-print">
          <div className="inline-flex items-center bg-white/95 backdrop-blur border border-slate-300 rounded-md overflow-hidden shadow-sm">
            <span className="px-2 text-slate-400 hidden sm:inline-flex items-center">
              <Layers size={12} />
            </span>
            {(Object.keys(TILE_LAYERS) as TileLayerMode[]).map((mode) => (
              <button
                key={mode}
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  setLayerMode(mode);
                }}
                className={`px-2.5 py-1.5 font-mono text-[11px] font-semibold cursor-pointer transition-colors ${
                  layerMode === mode
                    ? 'bg-[#0F172A] text-white'
                    : 'text-slate-600 hover:bg-slate-100'
                }`}
              >
                {TILE_LAYERS[mode].label}
              </button>
            ))}
          </div>

          <button
            type="button"
            onClick={handleRecenter}
            className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-md bg-white/95 backdrop-blur border border-slate-300 hover:border-[#0F172A] text-[#0F172A] text-xs font-semibold shadow-sm cursor-pointer transition-colors"
            title="Recentrer sur la trace"
            aria-label="Recentrer la carte"
          >
            <Crosshair size={13} className="text-[#FF5A36]" />
            <span className="hidden sm:inline">Recentrer</span>
          </button>

          <button
            type="button"
            onClick={handleToggleExpand}
            className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-md bg-white/95 backdrop-blur border border-slate-300 hover:border-[#0F172A] text-[#0F172A] text-xs font-semibold shadow-sm cursor-pointer transition-colors"
            title={isExpanded ? 'Réduire la carte' : 'Agrandir la carte'}
            aria-label={isExpanded ? 'Réduire la carte' : 'Agrandir la carte'}
          >
            {isExpanded ? <Minimize2 size={13} /> : <Maximize2 size={13} />}
            <span className="hidden sm:inline">{isExpanded ? 'Réduire' : 'Agrandir'}</span>
          </button>
        </div>

        {/* Badge télémétrique bas gauche */}
        <div className="mk-map-ui absolute bottom-3 left-3 z-[500] pointer-events-none no-print">
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded bg-[#0F172A]/90 text-white font-mono text-[11px] shadow-sm">
            <MapPin size={12} className="text-[#FF5A36] shrink-0" />
            <span>
              {waypointCount} point{waypointCount > 1 ? 's' : ''} · Cliquez sur la trace pour poser un ravito
            </span>
          </div>
        </div>

        <MapContainer
          bounds={bounds}
          boundsOptions={{ padding: [28, 28] }}
          className="h-full w-full"
        >
          <TileLayer url={tile.url} attribution={tile.attribution} maxZoom={tile.maxZoom} />

          <MapBoundsSync bounds={bounds} boundsKey={boundsKey} mapInstanceRef={mapInstanceRef} />
          <MapClickHandler onTraceClick={handleTraceClick} />

          {/* Trace GPX (halo sombre + ligne Orange Kairn) */}
          <Polyline
            positions={polylinePositions}
            pathOptions={{ color: '#0F172A', weight: 6, opacity: 0.3 }}
          />
          <Polyline
            positions={polylinePositions}
            pathOptions={{ color: '#FF5A36', weight: 3.5, opacity: 0.95 }}
          />

          {/* Marqueurs D, 1..N, A avec Popup d'édition */}
          {markerList.map(({ wp, cumulKm }, index) => {
            const isStart = index === 0;
            const isFinish = index === markerList.length - 1;
            const isLocked =
              isStart ||
              isFinish ||
              wp.type === 'start' ||
              wp.type === 'finish' ||
              wp.id === 'wp-start' ||
              wp.id === 'wp-end';

            const label = isStart ? 'D' : isFinish ? 'A' : String(index);
            const color = isStart
              ? '#14C38E'
              : isFinish
              ? '#DC2626'
              : wp.type === 'life_base'
              ? '#FF5A36'
              : '#0F172A';

            return (
              <Marker
                key={wp.id}
                position={[wp.lat, wp.lon]}
                icon={createWaypointIcon(label, color)}
              >
                <Popup>
                  <div
                    onClick={(e) => e.stopPropagation()}
                    className="min-w-[205px] space-y-2.5 py-0.5 font-sans text-xs"
                  >
                    <div>
                      <label className="block font-mono text-[10px] uppercase text-slate-400 mb-1">
                        Nom du point
                      </label>
                      <input
                        type="text"
                        value={wp.name || ''}
                        onChange={(e) => onUpdateWaypoint(wp.id, { name: e.target.value })}
                        className="w-full rounded border border-slate-300 px-2 py-1 text-xs font-semibold text-[#0F172A] focus:outline-none focus:border-[#0F172A]"
                      />
                    </div>

                    <div className="font-mono text-[11px] text-slate-500 tabular-nums">
                      KM {cumulKm.toFixed(1)} · ALT {Math.round(wp.ele || 0)} M
                    </div>

                    {!isLocked && (
                      <>
                        <div className="grid grid-cols-2 gap-2">
                          <div>
                            <label className="block font-mono text-[10px] uppercase text-slate-400 mb-1">
                              Type
                            </label>
                            <select
                              value={wp.type || 'aid_station'}
                              onChange={(e) =>
                                onUpdateWaypoint(wp.id, {
                                  type: e.target.value as RoadbookWaypoint['type'],
                                })
                              }
                              className="w-full rounded border border-slate-300 px-1.5 py-1 text-[11px] bg-white text-[#0F172A]"
                            >
                              <option value="aid_station">Ravitaillement</option>
                              <option value="life_base">Base de vie</option>
                              <option value="pass">Col / Point clé</option>
                            </select>
                          </div>
                          <div>
                            <label className="block font-mono text-[10px] uppercase text-slate-400 mb-1">
                              Pause (min)
                            </label>
                            <input
                              type="number"
                              min={0}
                              max={180}
                              value={wp.pauseMinutes ?? 0}
                              onChange={(e) =>
                                onUpdateWaypoint(wp.id, {
                                  pauseMinutes: Math.max(0, parseInt(e.target.value || '0', 10)),
                                })
                              }
                              className="w-full rounded border border-slate-300 px-2 py-1 text-[11px] font-mono text-[#0F172A]"
                            />
                          </div>
                        </div>

                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            onRemoveWaypoint(wp.id);
                          }}
                          className="w-full py-1.5 px-2.5 rounded bg-red-600 hover:bg-red-700 text-white text-[11px] font-semibold cursor-pointer transition-colors"
                        >
                          Supprimer ce point
                        </button>
                      </>
                    )}
                  </div>
                </Popup>
              </Marker>
            );
          })}

          {/* Curseur synchronisé avec le profil altimétrique */}
          {hoveredPoint && (
            <CircleMarker
              center={[hoveredPoint.lat, hoveredPoint.lon]}
              radius={7}
              pathOptions={{
                color: '#0F172A',
                fillColor: '#14C38E',
                fillOpacity: 1,
                weight: 2.5,
              }}
            />
          )}
        </MapContainer>
      </div>

      {mapNotice && (
        <div
          className={`px-3 py-2 rounded-md text-xs font-semibold border-l-2 ${
            mapNotice.kind === 'warn'
              ? 'bg-amber-50 border-amber-500 text-amber-800'
              : 'bg-emerald-50 border-[#14C38E] text-[#047857]'
          }`}
        >
          {mapNotice.text}
        </div>
      )}
    </div>
  );
}
