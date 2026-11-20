'use client';

import React, { useMemo, useRef, useState } from 'react';
import type { ElevationChartPoint } from '@/lib/trail/geodesy';
import type { RoadbookSegment } from '@/types/domain';

interface ElevationProfileSvgProps {
  chartPoints: ElevationChartPoint[];
  segments: RoadbookSegment[];
  height?: number;
  onHoverDistance?: (km: number | null) => void;
  onAddWaypointByDistance?: (km: number) => void;
}

/**
 * Profil altimétrique vectoriel sobre type feuille topographique :
 * - Grille altimétrique orthogonale fine
 * - Bandes nocturnes SunCalc
 * - Pastilles D / 1..N / A alignées avec la carte
 * - Survol synchronisé avec la carte et clic pour ajouter un ravitaillement au km exact
 */
export default function ElevationProfileSvg({
  chartPoints,
  segments,
  height = 240,
  onHoverDistance,
  onAddWaypointByDistance,
}: ElevationProfileSvgProps) {
  const width = 920;
  const padX = 46;
  const padY = 26;

  const svgRef = useRef<SVGSVGElement | null>(null);
  const [hoverIdx, setHoverIdx] = useState<number | null>(null);

  const { minEle, maxEle, maxDist, areaPath, coloredSegments, waypointMarkers, nightBands } =
    useMemo(() => {
      if (!chartPoints || chartPoints.length < 2) {
        return {
          minEle: 0,
          maxEle: 1000,
          maxDist: 10,
          areaPath: '',
          coloredSegments: [],
          waypointMarkers: [],
          nightBands: [],
        };
      }

      const eles = chartPoints.map((p) => p.yEle);
      const rawMin = Math.min(...eles);
      const rawMax = Math.max(...eles);
      const minE = Math.max(0, Math.floor((rawMin - 80) / 50) * 50);
      const maxE = Math.ceil((rawMax + 80) / 50) * 50;
      const distMax = Math.max(0.1, chartPoints[chartPoints.length - 1].xKm);

      const xScale = (km: number) => padX + (km / distMax) * (width - padX * 2);
      const yScale = (ele: number) =>
        height - padY - ((ele - minE) / Math.max(1, maxE - minE)) * (height - padY * 2);

      const lineCoords = chartPoints.map(
        (p) => `${xScale(p.xKm).toFixed(1)},${yScale(p.yEle).toFixed(1)}`
      );
      const area = `M ${xScale(chartPoints[0].xKm).toFixed(1)},${(height - padY).toFixed(
        1
      )} L ${lineCoords.join(' L ')} L ${xScale(distMax).toFixed(1)},${(height - padY).toFixed(
        1
      )} Z`;

      const segs = [];
      for (let i = 0; i < chartPoints.length - 1; i++) {
        const p1 = chartPoints[i];
        const p2 = chartPoints[i + 1];
        let stroke = '#14C38E';
        if (p1.slopePct > 12) stroke = '#B91C1C';
        else if (p1.slopePct > 4) stroke = '#FF5A36';
        else if (p1.slopePct > -4) stroke = '#D97706';
        else if (p1.slopePct > -12) stroke = '#14C38E';
        else stroke = '#047857';

        segs.push({
          key: i,
          x1: xScale(p1.xKm),
          y1: yScale(p1.yEle),
          x2: xScale(p2.xKm),
          y2: yScale(p2.yEle),
          stroke,
        });
      }

      const markers: Array<{
        id: string;
        badge: string;
        color: string;
        km: number;
        x: number;
        y: number;
      }> = [];

      if (segments.length > 0) {
        const startEle = segments[0].from.ele ?? chartPoints[0].yEle;
        markers.push({
          id: segments[0].from.id,
          badge: 'D',
          color: '#14C38E',
          km: 0,
          x: xScale(0),
          y: yScale(startEle),
        });
        segments.forEach((s, idx) => {
          const isLast = idx === segments.length - 1;
          const color = isLast
            ? '#DC2626'
            : s.to.type === 'life_base'
            ? '#FF5A36'
            : '#0F172A';
          markers.push({
            id: s.id,
            badge: isLast ? 'A' : String(idx + 1),
            color,
            km: s.cumulDistanceKm,
            x: xScale(s.cumulDistanceKm),
            y: yScale(s.to.ele || minE),
          });
        });
      }

      const nights = segments
        .filter((s) => s.nightIntensity > 0.25)
        .map((s) => {
          const prevKm = Math.max(0, s.cumulDistanceKm - s.distanceKm);
          return {
            id: `night-${s.id}`,
            x: xScale(prevKm),
            w: Math.max(2, xScale(s.cumulDistanceKm) - xScale(prevKm)),
            opacity: Math.min(0.18, s.nightIntensity * 0.18),
          };
        });

      return {
        minEle: minE,
        maxEle: maxE,
        maxDist: distMax,
        areaPath: area,
        coloredSegments: segs,
        waypointMarkers: markers,
        nightBands: nights,
      };
    }, [chartPoints, segments, height]);

  const findPointIndexFromClientX = (clientX: number): number | null => {
    const svg = svgRef.current;
    if (!svg || !chartPoints || chartPoints.length < 2) return null;
    const rect = svg.getBoundingClientRect();
    if (rect.width <= 0) return null;

    const svgX = ((clientX - rect.left) / rect.width) * width;
    const clampedX = Math.max(padX, Math.min(width - padX, svgX));
    const ratio = (clampedX - padX) / Math.max(1, width - padX * 2);
    const targetKm = ratio * maxDist;

    let bestIdx = 0;
    let bestDiff = Infinity;
    for (let i = 0; i < chartPoints.length; i++) {
      const diff = Math.abs(chartPoints[i].xKm - targetKm);
      if (diff < bestDiff) {
        bestDiff = diff;
        bestIdx = i;
      }
    }
    return bestIdx;
  };

  const handleMouseMove = (e: React.MouseEvent<SVGSVGElement>) => {
    const idx = findPointIndexFromClientX(e.clientX);
    if (idx === null) return;
    setHoverIdx(idx);
    onHoverDistance?.(chartPoints[idx].xKm);
  };

  const handleMouseLeave = () => {
    setHoverIdx(null);
    onHoverDistance?.(null);
  };

  const handleClick = (e: React.MouseEvent<SVGSVGElement>) => {
    if (!onAddWaypointByDistance) return;
    const idx = findPointIndexFromClientX(e.clientX);
    if (idx === null) return;
    onAddWaypointByDistance(chartPoints[idx].xKm);
  };

  if (!chartPoints || chartPoints.length < 2) {
    return (
      <div className="h-44 rounded-md border border-dashed border-slate-300 flex items-center justify-center text-xs font-mono text-slate-400">
        AUCUNE TRACE GPX CHARGÉE
      </div>
    );
  }

  const activePoint = hoverIdx !== null ? chartPoints[hoverIdx] : null;
  const hoverX = activePoint ? padX + (activePoint.xKm / maxDist) * (width - padX * 2) : 0;
  const hoverY = activePoint
    ? height - padY - ((activePoint.yEle - minEle) / Math.max(1, maxEle - minEle)) * (height - padY * 2)
    : 0;
  const tooltipWidth = 178;
  const tooltipX = Math.max(padX, Math.min(width - padX - tooltipWidth, hoverX - tooltipWidth / 2));

  return (
    <div className="w-full overflow-x-auto">
      <svg
        ref={svgRef}
        viewBox={`0 0 ${width} ${height}`}
        onMouseMove={handleMouseMove}
        onMouseLeave={handleMouseLeave}
        onClick={handleClick}
        className={`w-full h-auto min-w-[540px] select-none ${
          onAddWaypointByDistance ? 'cursor-crosshair' : ''
        }`}
        role="img"
        aria-label="Profil altimétrique interactif de la trace GPS"
      >
        <defs>
          <linearGradient id="mkEleAreaClean" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#0F172A" stopOpacity="0.09" />
            <stop offset="100%" stopColor="#0F172A" stopOpacity="0.01" />
          </linearGradient>
        </defs>

        {[0, 0.5, 1].map((ratio) => {
          const y = height - padY - ratio * (height - padY * 2);
          const eleVal = Math.round(minEle + ratio * (maxEle - minEle));
          return (
            <g key={ratio}>
              <line
                x1={padX}
                y1={y}
                x2={width - padX}
                y2={y}
                stroke="#E2E8F0"
                strokeDasharray="3 3"
                strokeWidth="1"
              />
              <text
                x={padX - 6}
                y={y + 3}
                textAnchor="end"
                fontSize="10"
                fontFamily="monospace"
                fill="#64748B"
              >
                {eleVal}m
              </text>
            </g>
          );
        })}

        {nightBands.map((nb) => (
          <rect
            key={nb.id}
            x={nb.x}
            y={padY}
            width={nb.w}
            height={height - padY * 2}
            fill="#0F172A"
            fillOpacity={nb.opacity}
          />
        ))}

        <path d={areaPath} fill="url(#mkEleAreaClean)" />

        {coloredSegments.map((s) => (
          <line
            key={s.key}
            x1={s.x1}
            y1={s.y1}
            x2={s.x2}
            y2={s.y2}
            stroke={s.stroke}
            strokeWidth="2.4"
            strokeLinecap="round"
          />
        ))}

        {waypointMarkers.map((m) => (
          <g key={m.id}>
            <line
              x1={m.x}
              y1={padY}
              x2={m.x}
              y2={height - padY}
              stroke="#CBD5E1"
              strokeDasharray="2 3"
              strokeWidth="1"
            />
            <circle cx={m.x} cy={height - padY} r="7.5" fill={m.color} stroke="#FFFFFF" strokeWidth="1.5" />
            <text
              x={m.x}
              y={height - padY + 3}
              textAnchor="middle"
              fontSize="8.5"
              fontFamily="monospace"
              fontWeight="700"
              fill="#FFFFFF"
            >
              {m.badge}
            </text>
          </g>
        ))}

        {/* Curseur interactif + info-bulle au survol */}
        {activePoint && (
          <g pointerEvents="none">
            <line
              x1={hoverX}
              y1={padY}
              x2={hoverX}
              y2={height - padY}
              stroke="#0F172A"
              strokeDasharray="3 3"
              strokeWidth="1.2"
            />
            <circle cx={hoverX} cy={hoverY} r="5" fill="#14C38E" stroke="#0F172A" strokeWidth="2" />
            <rect
              x={tooltipX}
              y={4}
              width={tooltipWidth}
              height={18}
              rx="3"
              fill="#0F172A"
            />
            <text
              x={tooltipX + tooltipWidth / 2}
              y={16}
              textAnchor="middle"
              fontSize="9.5"
              fontFamily="monospace"
              fontWeight="600"
              fill="#FFFFFF"
            >
              KM {activePoint.xKm.toFixed(1)} · {activePoint.yEle}m · {activePoint.slopePct > 0 ? '+' : ''}
              {activePoint.slopePct.toFixed(1)}%
            </text>
          </g>
        )}

        {!activePoint && (
          <text
            x={width - padX}
            y={14}
            textAnchor="end"
            fontSize="10"
            fontFamily="monospace"
            fill="#64748B"
          >
            DIST {maxDist.toFixed(1)} KM · ZONES SOMBRES = NUIT SUNCALC
          </text>
        )}
      </svg>
    </div>
  );
}
