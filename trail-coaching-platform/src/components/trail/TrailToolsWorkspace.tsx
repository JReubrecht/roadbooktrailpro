'use client';

import React, { useMemo, useState } from 'react';
import dynamic from 'next/dynamic';
import Link from 'next/link';
import { Upload, Plus, Trash2, Download, Printer, Save, Lock } from 'lucide-react';
import ElevationProfileSvg from '@/components/trail/ElevationProfileSvg';

const TrailMap = dynamic(() => import('@/components/trail/TrailMap'), {
  ssr: false,
  loading: () => (
    <div className="h-[400px] rounded-md border border-slate-200 bg-[#F8FAFC] flex items-center justify-center font-mono text-xs text-slate-400">
      CHARGEMENT DE LA CARTE TOPOGRAPHIQUE...
    </div>
  ),
});
import {
  calculateTraceStats,
  findOptimalElevationThreshold,
  findPointIndexByDistance,
  generateElevationChartPoints,
} from '@/lib/trail/geodesy';
import {
  calculateKmEffort,
  deriveConfigFromITRA,
  estimateRaceTargetHours,
} from '@/lib/trail/pacing';
import {
  formatDecimalHoursToHHMM,
  formatDurationMs,
  formatPace,
  formatTimeIso,
  generateRoadbookSegments,
  getSampleAlpineTrailTrace,
} from '@/lib/trail/roadbook';
import { exportRoadbookToGpx, parseGpxXml } from '@/lib/trail/gpx';
import { NUTRITION_CATALOG, calculateHourlyNutritionTargets } from '@/lib/trail/nutrition';
import { usePlatform } from '@/context/PlatformContext';
import type {
  GpxPoint,
  PacingStrategy,
  RoadbookDoc,
  RoadbookWaypoint,
  WeatherCondition,
} from '@/types/domain';

interface TrailToolsWorkspaceProps {
  mode: 'public' | 'member';
  initialRoadbook?: RoadbookDoc;
}

export default function TrailToolsWorkspace({ mode, initialRoadbook }: TrailToolsWorkspaceProps) {
  const { currentUser, access, featureFlags, saveRoadbook } = usePlatform();

  const initialSample = useMemo(() => getSampleAlpineTrailTrace(), []);
  const [raceName, setRaceName] = useState(initialRoadbook?.name || initialSample.name);
  const [points, setPoints] = useState<GpxPoint[]>(initialRoadbook?.points || initialSample.points);
  const [waypoints, setWaypoints] = useState<RoadbookWaypoint[]>(
    initialRoadbook?.waypoints || initialSample.waypoints
  );
  const [officialDistKm, setOfficialDistKm] = useState<string>(
    initialRoadbook?.officialDistanceKm ? String(initialRoadbook.officialDistanceKm) : '42'
  );
  const [officialEleM, setOfficialEleM] = useState<string>(
    initialRoadbook?.officialElevationM ? String(initialRoadbook.officialElevationM) : '2650'
  );
  const [itraIndex, setItraIndex] = useState<number>(initialRoadbook?.itraIndex || 600);
  const [fatiguePercent, setFatiguePercent] = useState<number>(initialRoadbook?.fatiguePercent ?? 20);
  const [weather, setWeather] = useState<WeatherCondition>(initialRoadbook?.weather || 'modere');
  const [pacingStrategy, setPacingStrategy] = useState<PacingStrategy>(
    initialRoadbook?.pacingStrategy || 'regular'
  );
  const [startTimeIso, setStartTimeIso] = useState<string>(
    initialRoadbook?.startTimeIso || '2026-06-27T06:00'
  );
  const [newWpName, setNewWpName] = useState('');
  const [newWpKm, setNewWpKm] = useState('15');
  const [newWpPause, setNewWpPause] = useState('4');
  const [gpxError, setGpxError] = useState<string | null>(null);
  const [saveSuccess, setSaveSuccess] = useState<string | null>(null);
  const [hoveredPoint, setHoveredPoint] = useState<GpxPoint | null>(null);

  const rawStats = useMemo(() => calculateTraceStats(points, 5, 1), [points]);
  const distFactor = useMemo(() => {
    const offD = parseFloat(officialDistKm);
    return offD > 0 && rawStats.distanceKm > 0 ? offD / rawStats.distanceKm : 1;
  }, [officialDistKm, rawStats.distanceKm]);

  const optThresholdM = useMemo(() => {
    const offE = parseFloat(officialEleM);
    return offE > 0 ? findOptimalElevationThreshold(points, offE) : 5;
  }, [points, officialEleM]);

  const calibratedStats = useMemo(
    () => calculateTraceStats(points, optThresholdM, distFactor),
    [points, optThresholdM, distFactor]
  );

  const derived = useMemo(() => deriveConfigFromITRA(itraIndex), [itraIndex]);

  const segments = useMemo(
    () =>
      generateRoadbookSegments(points, waypoints, {
        itraIndex,
        fatiguePercent,
        startTimeIso,
        elevationThresholdM: optThresholdM,
        distanceFactor: distFactor,
        weather,
        descentThresholdPct: derived.descentThresholdPct,
        walkThresholdPct: derived.walkThresholdPct,
        upCostDivider: derived.upCostDivider,
        downCostModifier: derived.downCostModifier,
        pacingStrategy,
        paceProfile: 'coach',
      }),
    [points, waypoints, itraIndex, fatiguePercent, startTimeIso, optThresholdM, distFactor, weather, derived, pacingStrategy]
  );

  const chartPoints = useMemo(
    () => generateElevationChartPoints(points, distFactor, 300),
    [points, distFactor]
  );

  const totalRaceMs = useMemo(
    () => segments.reduce((acc, s) => acc + s.durationFastMs + (s.to.pauseMinutes || 0) * 60000, 0),
    [segments]
  );

  const totalKmEffort = useMemo(
    () => Number(segments.reduce((acc, s) => acc + s.kmEffort, 0).toFixed(1)),
    [segments]
  );

  // Calculateur Rapide Km-Effort
  const [calcDistKm, setCalcDistKm] = useState(50);
  const [calcElePosM, setCalcElePosM] = useState(3000);
  const [calcEleNegM, setCalcEleNegM] = useState(3000);
  const [calcItra, setCalcItra] = useState(600);
  const [calcPausesMin, setCalcPausesMin] = useState(20);

  const quickKmEffort = useMemo(
    () => Number(calculateKmEffort(calcDistKm, calcElePosM, calcEleNegM).toFixed(1)),
    [calcDistKm, calcElePosM, calcEleNegM]
  );
  const quickTargetH = useMemo(
    () =>
      estimateRaceTargetHours({
        distanceKm: calcDistKm,
        elevationGainM: calcElePosM,
        itraIndex: calcItra,
        pauseMinutesTotal: calcPausesMin,
      }),
    [calcDistKm, calcElePosM, calcItra, calcPausesMin]
  );

  // Simulateur Nutrition
  const [nutriHours, setNutriHours] = useState(6.5);
  const [nutriWeight, setNutriWeight] = useState(68);
  const [nutriWeather, setNutriWeather] = useState<WeatherCondition>('modere');
  const [nutriGutLevel, setNutriGutLevel] = useState<'standard' | 'trained'>('standard');
  const [selectedQty, setSelectedQty] = useState<Record<string, number>>({
    maurten_drink_320: 3,
    naak_bar: 4,
    maurten_gel_100: 4,
    saltstick_caps: 6,
  });

  const nutriTargets = useMemo(
    () =>
      calculateHourlyNutritionTargets({
        durationHours: nutriHours,
        weightKg: nutriWeight,
        weather: nutriWeather,
        gutTrainedLevel: nutriGutLevel,
      }),
    [nutriHours, nutriWeight, nutriWeather, nutriGutLevel]
  );

  const nutriPackTotals = useMemo(() => {
    let carbsG = 0;
    let sodiumMg = 0;
    let weightG = 0;
    for (const [id, qty] of Object.entries(selectedQty)) {
      if (qty > 0) {
        const prod = NUTRITION_CATALOG.find((p) => p.id === id);
        if (prod) {
          carbsG += prod.carbsG * qty;
          sodiumMg += prod.sodiumMg * qty;
          weightG += prod.weightG * qty;
        }
      }
    }
    return { carbsG, sodiumMg, weightG };
  }, [selectedQty]);

  const handleUploadGpx = async (e: React.ChangeEvent<HTMLInputElement>) => {
    setGpxError(null);
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const text = await file.text();
      const parsed = parseGpxXml(text, file.name.replace(/\.gpx$/i, ''));
      setRaceName(parsed.name);
      setPoints(parsed.points);
      setWaypoints(parsed.waypoints);
      setOfficialDistKm(String(parsed.distanceKm));
      setOfficialEleM(String(parsed.elevationGainM));
    } catch (err: unknown) {
      setGpxError(err instanceof Error ? err.message : 'Erreur lecture GPX.');
    }
  };

  const handleAddWaypoint = (e: React.FormEvent) => {
    e.preventDefault();
    const km = parseFloat(newWpKm);
    if (!newWpName.trim() || isNaN(km)) return;
    const idx = findPointIndexByDistance(km, points, distFactor);
    const pt = points[idx];
    if (!pt) return;

    setWaypoints((prev) => [
      ...prev,
      {
        id: `wp-custom-${Date.now()}`,
        name: newWpName.trim(),
        lat: pt.lat,
        lon: pt.lon,
        ele: pt.ele,
        pointIndex: idx,
        pauseMinutes: Math.max(0, parseInt(newWpPause || '0', 10)),
        timeModifierPct: 100,
        technicality: 2,
        type: 'aid_station',
      },
    ]);
    setNewWpName('');
  };

  const handleAddWaypointFromMap = (wp: RoadbookWaypoint) => {
    setWaypoints((prev) => [...prev, wp]);
  };

  const handleAddWaypointByDistance = (km: number) => {
    if (points.length === 0) return;
    const idx = findPointIndexByDistance(km, points, distFactor);
    const pt = points[idx];
    if (!pt) return;

    const intermediateCount =
      segments.length > 0
        ? Math.max(0, segments.length - 1)
        : waypoints.filter((w) => w.type !== 'start' && w.type !== 'finish').length;

    setWaypoints((prev) => [
      ...prev,
      {
        id: `wp-prof-${Date.now()}`,
        name: `R${intermediateCount + 1}`,
        lat: pt.lat,
        lon: pt.lon,
        ele: pt.ele,
        pointIndex: idx,
        pauseMinutes: 3,
        timeModifierPct: 100,
        technicality: 2,
        type: 'aid_station',
      },
    ]);
  };

  const handleUpdateWaypoint = (id: string, updates: Partial<RoadbookWaypoint>) => {
    setWaypoints((prev) => {
      if (prev.some((w) => w.id === id)) {
        return prev.map((w) => (w.id === id ? { ...w, ...updates } : w));
      }
      const synthetic =
        segments[0]?.from.id === id
          ? segments[0].from
          : segments[segments.length - 1]?.to.id === id
          ? segments[segments.length - 1].to
          : null;
      return synthetic ? [...prev, { ...synthetic, ...updates }] : prev;
    });
  };

  const handleRemoveWaypoint = (id: string) => {
    setWaypoints((prev) =>
      prev.filter((w) => w.id !== id || w.type === 'start' || w.type === 'finish')
    );
  };

  const handleHoverDistance = (km: number | null) => {
    if (km === null || points.length === 0) {
      setHoveredPoint(null);
      return;
    }
    const idx = findPointIndexByDistance(km, points, distFactor);
    setHoveredPoint(points[idx] || null);
  };

  const handleDownloadGpx = () => {
    const xml = exportRoadbookToGpx(raceName, points, waypoints);
    const blob = new Blob([xml], { type: 'application/gpx+xml;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${raceName.toLowerCase().replace(/[^a-z0-9]+/gi, '-')}.gpx`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleSaveToAccount = () => {
    if (!currentUser) return;
    saveRoadbook({
      id: initialRoadbook?.id || `rb-${Date.now()}`,
      userId: currentUser.id,
      name: raceName,
      officialDistanceKm: calibratedStats.distanceKm,
      officialElevationM: calibratedStats.elevationGainM,
      itraIndex,
      fatiguePercent,
      pacingStrategy,
      weather,
      startTimeIso,
      points,
      waypoints,
      updatedAt: new Date().toISOString(),
    });
    setSaveSuccess('Roadbook enregistré dans votre espace membre.');
    setTimeout(() => setSaveSuccess(null), 4000);
  };

  return (
    <div className="space-y-8">
      {/* Barre d'actions studio GPX */}
      <div className="flex flex-wrap items-center justify-between gap-3 no-print">
        <div>
          {mode === 'member' ? (
            <p className="font-mono text-[11px] uppercase tracking-wider text-slate-500">
              ÉDITEUR ROADBOOK · MEMBRE
            </p>
          ) : (
            <p className="font-mono text-[11px] uppercase tracking-wider text-[#14C38E] font-semibold">
              ACCÈS LIBRE SANS COMPTE
            </p>
          )}
          <h2 className="text-xl font-bold text-[#0F172A] mt-0.5">{raceName}</h2>
        </div>

        <div className="flex flex-wrap gap-2">
          <label className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-md bg-[#FF5A36] hover:bg-[#E34A28] text-white text-xs font-semibold cursor-pointer transition-colors">
            <Upload size={14} />
            <span>Importer .GPX</span>
            <input type="file" accept=".gpx" onChange={handleUploadGpx} className="hidden" />
          </label>
          <button
            type="button"
            onClick={handleDownloadGpx}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-md border border-slate-300 bg-white hover:bg-slate-50 text-xs font-semibold text-[#0F172A] cursor-pointer"
          >
            <Download size={14} />
            <span>Exporter GPX</span>
          </button>
          <button
            type="button"
            onClick={() => window.print()}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-md border border-slate-300 bg-white hover:bg-slate-50 text-xs font-semibold text-[#0F172A] cursor-pointer"
          >
            <Printer size={14} />
            <span>Imprimer</span>
          </button>
          {mode === 'member' && currentUser && access.canSaveCloudRoadbooks && (
            <button
              type="button"
              onClick={handleSaveToAccount}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-md bg-[#0F172A] hover:bg-slate-800 text-white text-xs font-semibold cursor-pointer"
            >
              <Save size={14} />
              <span>Sauvegarder cloud</span>
            </button>
          )}
        </div>
      </div>

      {/* Invitation discrète espace membre en mode public */}
      {mode === 'public' && (
        <div className="bg-white border border-slate-200 border-l-2 border-l-[#0F172A] rounded-md px-4 py-3 flex flex-wrap items-center justify-between gap-3 text-xs no-print">
          <span className="text-slate-600">
            Calculateur utilisable librement sans compte. Connectez-vous pour archiver vos roadbooks et centraliser le suivi de vos données d&apos;entraînement.
          </span>
          <Link href="/login" className="font-semibold text-[#0F172A] underline hover:text-[#FF5A36]">
            Accéder à l&apos;Espace Membre &rarr;
          </Link>
        </div>
      )}

      {mode === 'member' && currentUser && !access.canSaveCloudRoadbooks && (
        <div className="bg-white border border-slate-200 border-l-2 border-l-amber-500 rounded-md px-4 py-3 flex flex-wrap items-center justify-between gap-3 text-xs no-print">
          <span className="text-slate-700 flex items-center gap-1.5">
            <Lock size={13} className="text-amber-600" />
            {featureFlags.programSalesEnabled
              ? 'La sauvegarde cloud illimitée des roadbooks est réservée aux abonnés Programme ou Coaching. L’export .gpx reste actif.'
              : 'La sauvegarde cloud illimitée des roadbooks est réservée aux membres Coaching. L’export .gpx reste actif.'}
          </span>
          <Link
            href={featureFlags.programSalesEnabled ? '/catalog' : '/#offres-coaching'}
            className="font-semibold text-[#FF5A36] underline"
          >
            {featureFlags.programSalesEnabled ? 'Voir les offres →' : 'Découvrir le coaching →'}
          </Link>
        </div>
      )}

      {gpxError && (
        <div className="p-3 rounded-md bg-red-50 border-l-2 border-red-600 text-xs font-semibold text-red-800">
          {gpxError}
        </div>
      )}
      {saveSuccess && (
        <div className="p-3 rounded-md bg-emerald-50 border-l-2 border-[#14C38E] text-xs font-semibold text-[#047857]">
          {saveSuccess}
        </div>
      )}

      {/* Bandeau télémétrique */}
      <div className="bg-white border border-slate-200 rounded-lg grid grid-cols-2 md:grid-cols-4 divide-y md:divide-y-0 md:divide-x divide-slate-200">
        <div className="p-4">
          <p className="font-mono text-[10px] uppercase tracking-wider text-slate-400">Parcours</p>
          <p className="font-bold text-sm text-[#0F172A] truncate mt-1">{raceName}</p>
          <p className="font-mono text-xs text-slate-500 tabular-nums mt-0.5">
            {calibratedStats.distanceKm} km
          </p>
        </div>
        <div className="p-4">
          <p className="font-mono text-[10px] uppercase tracking-wider text-slate-400">Dénivelé · Effort</p>
          <p className="font-mono text-xl font-bold text-[#FF5A36] tabular-nums mt-1">
            +{calibratedStats.elevationGainM} m
          </p>
          <p className="font-mono text-xs text-slate-500 tabular-nums">{totalKmEffort} km-effort</p>
        </div>
        <div className="p-4">
          <p className="font-mono text-[10px] uppercase tracking-wider text-slate-400">Chrono Cible</p>
          <p className="font-mono text-xl font-bold text-[#0F172A] tabular-nums mt-1">
            {formatDurationMs(totalRaceMs)}
          </p>
          <p className="font-mono text-xs text-slate-500">ITRA {itraIndex}</p>
        </div>
        <div className="p-4">
          <p className="font-mono text-[10px] uppercase tracking-wider text-slate-400">Arrivée Prévue</p>
          <p className="font-mono text-xl font-bold text-[#14C38E] tabular-nums mt-1">
            {segments.length > 0 ? formatTimeIso(segments[segments.length - 1].arrivalFastIso) : '--:--'}
          </p>
          <p className="font-mono text-xs text-slate-500">{waypoints.length} points</p>
        </div>
      </div>

      {/* Paramètres Roadbook */}
      <div className="bg-white rounded-lg border border-slate-200 p-5 space-y-4 no-print">
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
          <div>
            <label className="block font-mono text-[10px] uppercase text-slate-500 mb-1">Index ITRA</label>
            <input
              type="number"
              min={250}
              max={950}
              value={itraIndex}
              onChange={(e) => {
                const val = Math.max(250, Math.min(950, Number(e.target.value) || 550));
                setItraIndex(val);
                setFatiguePercent(deriveConfigFromITRA(val).fatiguePercent);
              }}
              className="w-full rounded-md border border-slate-300 px-2.5 py-1.5 text-sm font-mono font-semibold"
            />
          </div>
          <div>
            <label className="block font-mono text-[10px] uppercase text-slate-500 mb-1">Dist. off. (km)</label>
            <input
              type="number"
              value={officialDistKm}
              onChange={(e) => setOfficialDistKm(e.target.value)}
              className="w-full rounded-md border border-slate-300 px-2.5 py-1.5 text-sm font-mono font-semibold"
            />
          </div>
          <div>
            <label className="block font-mono text-[10px] uppercase text-slate-500 mb-1">D+ off. (m)</label>
            <input
              type="number"
              value={officialEleM}
              onChange={(e) => setOfficialEleM(e.target.value)}
              className="w-full rounded-md border border-slate-300 px-2.5 py-1.5 text-sm font-mono font-semibold"
            />
          </div>
          <div>
            <label className="block font-mono text-[10px] uppercase text-slate-500 mb-1">Fatigue fin (%)</label>
            <input
              type="number"
              min={0}
              max={55}
              value={fatiguePercent}
              onChange={(e) => setFatiguePercent(Number(e.target.value) || 0)}
              className="w-full rounded-md border border-slate-300 px-2.5 py-1.5 text-sm font-mono font-semibold"
            />
          </div>
          <div>
            <label className="block font-mono text-[10px] uppercase text-slate-500 mb-1">Météo</label>
            <select
              value={weather}
              onChange={(e) => setWeather(e.target.value as WeatherCondition)}
              className="w-full rounded-md border border-slate-300 px-2.5 py-1.5 text-sm bg-white"
            >
              <option value="froid">Froid (-3%)</option>
              <option value="modere">Modérée</option>
              <option value="chaud">Chaud (-5%)</option>
              <option value="tres_chaud">Canicule (-12%)</option>
            </select>
          </div>
          <div>
            <label className="block font-mono text-[10px] uppercase text-slate-500 mb-1">Départ</label>
            <input
              type="datetime-local"
              value={startTimeIso}
              onChange={(e) => setStartTimeIso(e.target.value)}
              className="w-full rounded-md border border-slate-300 px-2 py-1.5 text-xs font-mono"
            />
          </div>
        </div>

        <form
          onSubmit={handleAddWaypoint}
          className="pt-3 border-t border-slate-100 flex flex-wrap items-end gap-3"
        >
          <div className="flex-1 min-w-[180px]">
            <label className="block font-mono text-[10px] uppercase text-slate-500 mb-1">
              Nouveau ravitaillement / point clé
            </label>
            <input
              type="text"
              value={newWpName}
              onChange={(e) => setNewWpName(e.target.value)}
              placeholder="Ex: Refuge du Col"
              className="w-full rounded-md border border-slate-300 px-3 py-1.5 text-sm"
            />
          </div>
          <div className="w-24">
            <label className="block font-mono text-[10px] uppercase text-slate-500 mb-1">Km</label>
            <input
              type="number"
              step="0.5"
              value={newWpKm}
              onChange={(e) => setNewWpKm(e.target.value)}
              className="w-full rounded-md border border-slate-300 px-2.5 py-1.5 text-sm font-mono"
            />
          </div>
          <div className="w-24">
            <label className="block font-mono text-[10px] uppercase text-slate-500 mb-1">Pause (min)</label>
            <input
              type="number"
              min={0}
              value={newWpPause}
              onChange={(e) => setNewWpPause(e.target.value)}
              className="w-full rounded-md border border-slate-300 px-2.5 py-1.5 text-sm font-mono"
            />
          </div>
          <div className="w-36">
            <label className="block font-mono text-[10px] uppercase text-slate-500 mb-1">Pacing</label>
            <select
              value={pacingStrategy}
              onChange={(e) => setPacingStrategy(e.target.value as PacingStrategy)}
              className="w-full rounded-md border border-slate-300 px-2.5 py-1.5 text-sm bg-white"
            >
              <option value="regular">Régulier</option>
              <option value="prudent">Negative split</option>
              <option value="aggressive">Départ rapide</option>
            </select>
          </div>
          <button
            type="submit"
            className="inline-flex items-center gap-1.5 px-4 py-1.5 rounded-md bg-[#0F172A] hover:bg-slate-800 text-white text-sm font-semibold cursor-pointer"
          >
            <Plus size={15} />
            <span>Ajouter</span>
          </button>
        </form>
      </div>

      {/* Carte Interactive & Pointage des Ravitaillements */}
      <div className="bg-white rounded-lg border border-slate-200 p-5 space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div>
            <h3 className="text-sm font-bold text-[#0F172A]">
              Carte &amp; Pointage des Ravitaillements
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">
              Cliquez directement sur la trace orange (ou sur le profil altimétrique ci-dessous) pour poser un ravitaillement, puis cliquez sur un marqueur pour le renommer, régler sa pause ou le supprimer.
            </p>
          </div>
          <span className="font-mono text-[10px] uppercase tracking-wider text-slate-400 shrink-0">
            OSM · TOPO · SATELLITE
          </span>
        </div>

        <TrailMap
          points={points}
          segments={segments}
          hoveredPoint={hoveredPoint}
          onAddWaypoint={handleAddWaypointFromMap}
          onUpdateWaypoint={handleUpdateWaypoint}
          onRemoveWaypoint={handleRemoveWaypoint}
          waypointCount={segments.length > 0 ? segments.length + 1 : waypoints.length}
        />
      </div>

      {/* Profil Altimétrique */}
      <div className="bg-white rounded-lg border border-slate-200 p-5">
        <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
          <div>
            <h3 className="text-sm font-bold text-[#0F172A]">
              Profil Altimétrique &amp; Inclinaisons
            </h3>
            <p className="text-[11px] text-slate-500 mt-0.5 no-print">
              Survol synchronisé avec la carte · Clic = ajout ravitaillement au km exact
            </p>
          </div>
          <div className="hidden sm:flex items-center gap-4 font-mono text-[10px] uppercase text-slate-500">
            <span>
              <span className="inline-block w-2.5 h-0.5 bg-[#FF5A36] align-middle mr-1" /> Montée
            </span>
            <span>
              <span className="inline-block w-2.5 h-0.5 bg-[#D97706] align-middle mr-1" /> Plat
            </span>
            <span>
              <span className="inline-block w-2.5 h-0.5 bg-[#14C38E] align-middle mr-1" /> Descente
            </span>
          </div>
        </div>
        <ElevationProfileSvg
          chartPoints={chartPoints}
          segments={segments}
          onHoverDistance={handleHoverDistance}
          onAddWaypointByDistance={handleAddWaypointByDistance}
        />
      </div>

      {/* Feuille de Temps */}
      <div className="bg-white rounded-lg border border-slate-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs sm:text-sm">
            <thead className="bg-slate-100 border-b border-slate-200 font-mono text-[11px] uppercase tracking-wider text-slate-600">
              <tr>
                <th className="px-4 py-3 font-semibold">Tronçon</th>
                <th className="px-4 py-3 font-semibold text-right">Dist / Cumul</th>
                <th className="px-4 py-3 font-semibold text-right">D+ / D-</th>
                <th className="px-4 py-3 font-semibold text-right">Km-Eff</th>
                <th className="px-4 py-3 font-semibold text-right">Durée</th>
                <th className="px-4 py-3 font-semibold text-right">Passage (Cible / Prud.)</th>
                <th className="px-4 py-3 font-semibold text-right">Allure · VAM</th>
                <th className="px-4 py-3 font-semibold text-right">Pause</th>
                <th className="px-3 py-3 no-print" />
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {segments.map((seg) => (
                <tr key={seg.id} className="hover:bg-[#F8FAFC]">
                  <td className="px-4 py-2.5 font-semibold text-[#0F172A]">
                    {seg.from.name} &rarr; {seg.to.name}
                  </td>
                  <td className="px-4 py-2.5 text-right font-mono text-xs tabular-nums">
                    <span className="font-semibold text-[#0F172A]">{seg.distanceKm} km</span>{' '}
                    <span className="text-slate-400">({seg.cumulDistanceKm})</span>
                  </td>
                  <td className="px-4 py-2.5 text-right font-mono text-xs tabular-nums">
                    <span className="text-[#FF5A36] font-semibold">+{seg.elevationPosM}</span>{' '}
                    <span className="text-slate-400">-{seg.elevationNegM}</span>
                  </td>
                  <td className="px-4 py-2.5 text-right font-mono text-xs tabular-nums text-slate-700">
                    {seg.kmEffort}
                  </td>
                  <td className="px-4 py-2.5 text-right font-mono text-xs font-semibold tabular-nums text-[#0F172A]">
                    {formatDurationMs(seg.durationFastMs)}
                  </td>
                  <td className="px-4 py-2.5 text-right font-mono text-xs tabular-nums">
                    <span className="font-bold text-[#0F172A]">
                      {formatTimeIso(seg.arrivalFastIso)}
                    </span>{' '}
                    <span className="text-slate-400">/ {formatTimeIso(seg.arrivalSlowIso)}</span>
                  </td>
                  <td className="px-4 py-2.5 text-right font-mono text-xs tabular-nums text-slate-600">
                    <span>{formatPace(seg.paceTargetMinPerKm)}</span>
                    <span className="block text-[10px] text-slate-400">
                      {seg.vamEstimate > 0 ? `VAM ${seg.vamEstimate} m/h` : 'Plat / desc.'}
                    </span>
                  </td>
                  <td className="px-4 py-2.5 text-right font-mono text-xs tabular-nums text-slate-500">
                    {seg.to.pauseMinutes ? `${seg.to.pauseMinutes}m` : '-'}
                  </td>
                  <td className="px-3 py-2.5 text-right no-print">
                    {seg.to.type !== 'finish' && (
                      <button
                        type="button"
                        onClick={() =>
                          setWaypoints((prev) => prev.filter((w) => w.id !== seg.to.id))
                        }
                        className="p-1 rounded text-slate-400 hover:text-red-600 cursor-pointer"
                        title="Supprimer"
                      >
                        <Trash2 size={13} />
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Calculateurs Km-Effort & Nutrition */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 no-print">
        <section
          id="pacing-calc"
          className="bg-white rounded-lg border border-slate-200 p-6 space-y-5"
        >
          <div className="border-b border-slate-100 pb-3">
            <p className="font-mono text-[10px] uppercase tracking-wider text-slate-400">
              CALCULATEUR 01 · RIEGEL &amp; MINETTI
            </p>
            <h3 className="text-lg font-bold text-[#0F172A] mt-0.5">
              Km-Effort &amp; Prédiction Chrono
            </h3>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block font-mono text-[10px] uppercase text-slate-500 mb-1">Distance (km)</label>
              <input
                type="number"
                value={calcDistKm}
                onChange={(e) => setCalcDistKm(Number(e.target.value) || 1)}
                className="w-full rounded-md border border-slate-300 px-3 py-1.5 text-sm font-mono font-semibold"
              />
            </div>
            <div>
              <label className="block font-mono text-[10px] uppercase text-slate-500 mb-1">D+ (m)</label>
              <input
                type="number"
                value={calcElePosM}
                onChange={(e) => setCalcElePosM(Number(e.target.value) || 0)}
                className="w-full rounded-md border border-slate-300 px-3 py-1.5 text-sm font-mono font-semibold"
              />
            </div>
            <div>
              <label className="block font-mono text-[10px] uppercase text-slate-500 mb-1">D- (m)</label>
              <input
                type="number"
                value={calcEleNegM}
                onChange={(e) => setCalcEleNegM(Number(e.target.value) || 0)}
                className="w-full rounded-md border border-slate-300 px-3 py-1.5 text-sm font-mono font-semibold"
              />
            </div>
            <div>
              <label className="block font-mono text-[10px] uppercase text-slate-500 mb-1">Index ITRA</label>
              <input
                type="number"
                min={250}
                max={950}
                value={calcItra}
                onChange={(e) => setCalcItra(Number(e.target.value) || 550)}
                className="w-full rounded-md border border-slate-300 px-3 py-1.5 text-sm font-mono font-semibold"
              />
            </div>
          </div>

          <div>
            <div className="flex justify-between font-mono text-[11px] text-slate-500 mb-1">
              <span>PAUSES RAVITAILLEMENTS</span>
              <span className="font-bold text-[#0F172A]">{calcPausesMin} min</span>
            </div>
            <input
              type="range"
              min={0}
              max={120}
              value={calcPausesMin}
              onChange={(e) => setCalcPausesMin(Number(e.target.value))}
              className="w-full accent-[#FF5A36]"
            />
          </div>

          <div className="grid grid-cols-2 border border-slate-200 rounded-md divide-x divide-slate-200 bg-[#F8FAFC]">
            <div className="p-4">
              <p className="font-mono text-[10px] uppercase text-slate-400">Km-Effort Minetti</p>
              <p className="font-mono text-2xl font-bold text-[#0F172A] tabular-nums mt-1">
                {quickKmEffort} ke
              </p>
            </div>
            <div className="p-4 bg-[#0F172A] text-white rounded-r-md">
              <p className="font-mono text-[10px] uppercase text-slate-400">Temps Prédit</p>
              <p className="font-mono text-2xl font-bold text-[#14C38E] tabular-nums mt-1">
                {formatDecimalHoursToHHMM(quickTargetH)}
              </p>
            </div>
          </div>
        </section>

        <section
          id="nutrition-sim"
          className="bg-white rounded-lg border border-slate-200 p-6 space-y-5"
        >
          <div className="border-b border-slate-100 pb-3">
            <p className="font-mono text-[10px] uppercase tracking-wider text-slate-400">
              CALCULATEUR 02 · APPORTS &amp; ÉLECTROLYTES
            </p>
            <h3 className="text-lg font-bold text-[#0F172A] mt-0.5">
              Simulateur Nutritionnel Trail
            </h3>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div>
              <label className="block font-mono text-[10px] uppercase text-slate-500 mb-1">Durée (h)</label>
              <input
                type="number"
                step="0.5"
                min={1}
                max={48}
                value={nutriHours}
                onChange={(e) => setNutriHours(Number(e.target.value) || 2)}
                className="w-full rounded-md border border-slate-300 px-2.5 py-1.5 text-sm font-mono font-semibold"
              />
            </div>
            <div>
              <label className="block font-mono text-[10px] uppercase text-slate-500 mb-1">Poids (kg)</label>
              <input
                type="number"
                min={40}
                max={130}
                value={nutriWeight}
                onChange={(e) => setNutriWeight(Number(e.target.value) || 68)}
                className="w-full rounded-md border border-slate-300 px-2.5 py-1.5 text-sm font-mono font-semibold"
              />
            </div>
            <div>
              <label className="block font-mono text-[10px] uppercase text-slate-500 mb-1">Météo</label>
              <select
                value={nutriWeather}
                onChange={(e) => setNutriWeather(e.target.value as WeatherCondition)}
                className="w-full rounded-md border border-slate-300 px-2 py-1.5 text-xs bg-white"
              >
                <option value="froid">Froid</option>
                <option value="modere">Modérée</option>
                <option value="chaud">Chaud</option>
                <option value="tres_chaud">Canicule</option>
              </select>
            </div>
            <div>
              <label className="block font-mono text-[10px] uppercase text-slate-500 mb-1">Digestion</label>
              <select
                value={nutriGutLevel}
                onChange={(e) => setNutriGutLevel(e.target.value as 'standard' | 'trained')}
                className="w-full rounded-md border border-slate-300 px-2 py-1.5 text-xs bg-white"
              >
                <option value="standard">Standard</option>
                <option value="trained">Entraîné</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-3 border border-slate-200 rounded-md divide-x divide-slate-200 text-center bg-[#F8FAFC]">
            <div className="p-3">
              <p className="font-mono text-[10px] uppercase text-slate-500">Glucides / h</p>
              <p className="font-mono text-lg font-bold text-[#FF5A36] tabular-nums">
                {nutriTargets.carbsGPerHour} g
              </p>
              <p className="font-mono text-[10px] text-slate-400">Tot: {nutriTargets.totalCarbsG} g</p>
            </div>
            <div className="p-3">
              <p className="font-mono text-[10px] uppercase text-slate-500">Eau / h</p>
              <p className="font-mono text-lg font-bold text-[#0F172A] tabular-nums">
                {nutriTargets.waterMlPerHour} ml
              </p>
              <p className="font-mono text-[10px] text-slate-400">Tot: {nutriTargets.totalWaterLiters} L</p>
            </div>
            <div className="p-3">
              <p className="font-mono text-[10px] uppercase text-slate-500">Sodium / h</p>
              <p className="font-mono text-lg font-bold text-[#14C38E] tabular-nums">
                {nutriTargets.sodiumMgPerHour} mg
              </p>
              <p className="font-mono text-[10px] text-slate-400">Tot: {nutriTargets.totalSodiumMg} mg</p>
            </div>
          </div>

          <div className="border border-slate-200 rounded-md divide-y divide-slate-100 max-h-48 overflow-y-auto">
            {NUTRITION_CATALOG.slice(0, 7).map((prod) => (
              <div
                key={prod.id}
                className="flex items-center justify-between gap-2 px-3 py-2 text-xs"
              >
                <div>
                  <span className="font-semibold text-[#0F172A]">
                    {prod.brand} — {prod.name}
                  </span>
                  <span className="ml-2 font-mono text-[11px] text-slate-400">
                    {prod.carbsG}g / {prod.sodiumMg}mg Na
                  </span>
                </div>
                <input
                  type="number"
                  min={0}
                  max={50}
                  value={selectedQty[prod.id] || 0}
                  onChange={(e) =>
                    setSelectedQty((prev) => ({
                      ...prev,
                      [prod.id]: Math.max(0, Number(e.target.value) || 0),
                    }))
                  }
                  className="w-14 rounded border border-slate-300 px-1.5 py-1 text-center font-mono font-semibold bg-white"
                />
              </div>
            ))}
          </div>

          <div className="rounded-md bg-[#0F172A] text-white px-4 py-2.5 flex flex-wrap items-center justify-between gap-2 font-mono text-xs tabular-nums">
            <span>
              SAC : <strong>{nutriPackTotals.carbsG}g</strong> glu (cible {nutriTargets.totalCarbsG}g) ·{' '}
              <strong>{nutriPackTotals.sodiumMg}mg</strong> Na
            </span>
            <span className="text-[#14C38E] font-semibold">
              MASSE {(nutriPackTotals.weightG / 1000).toFixed(2)} KG
            </span>
          </div>
        </section>
      </div>
    </div>
  );
}
