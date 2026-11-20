import { getTimes as getSunTimes } from 'suncalc';
import type { PaceProfile, WeatherCondition } from '@/types/domain';

export interface DerivedItraConfig {
  fatiguePercent: number;
  descentThresholdPct: number;
  walkThresholdPct: number;
  upCostDivider: number;
  downCostModifier: number;
  pacingStrategy: 'regular';
}

export interface RaceEstimateInput {
  distanceKm: number;
  elevationGainM: number;
  itraIndex: number;
  fatiguePercent?: number;
  upCostDivider?: number;
  downCostModifier?: number;
  pauseMinutesTotal?: number;
  paceProfile?: PaceProfile;
}

/**
 * Équivalent km-effort selon le modèle énergétique Minetti (2002) adapté aux standards ITRA/UTMB.
 */
export function calculateKmEffort(
  distanceKm: number,
  elePosM: number,
  eleNegM: number,
  descentThresholdPercent: number = 15,
  avgDescentSlopePct: number = 0,
  upCostDivider: number = 80,
  downCostModifier: number = 1.0
): number {
  const upCost = elePosM / Math.max(40, upCostDivider);
  const k = 0.8;
  const slope = avgDescentSlopePct || 0;
  const sigmoid = 1 / (1 + Math.exp(-k * (slope - descentThresholdPercent)));
  const downCoeff = 1 / 215 + sigmoid * (1 / 115 - 1 / 215);
  const downCost = eleNegM * downCoeff * downCostModifier;

  return distanceKm + upCost + downCost;
}

/**
 * Coefficient de vitesse lié à la météo (Périard et al. 2015).
 */
export function getWeatherCoefficient(weather: WeatherCondition | number): number {
  if (typeof weather === 'number') {
    if (weather <= 5) return 0.97;
    if (weather <= 15) return 0.97 + (weather - 5) * (0.03 / 10);
    if (weather <= 25) return 1.0 - (weather - 15) * (0.05 / 10);
    if (weather <= 35) return 0.95 - (weather - 25) * (0.07 / 10);
    return 0.88;
  }

  const coefficients: Record<WeatherCondition, number> = {
    froid: 0.97,
    modere: 1.0,
    chaud: 0.95,
    tres_chaud: 0.88,
  };
  return coefficients[weather] ?? 1.0;
}

/**
 * Calcule l'intensité nocturne (0 = jour, 1 = pleine nuit) à partir des heures solaires SunCalc.
 */
export function getNightIntensity(dateObj: Date, lat: number, lon: number): number {
  if (!dateObj || isNaN(dateObj.getTime()) || !lat || !lon) return 0;

  const times = getSunTimes(dateObj, lat, lon);
  const time = dateObj.getTime();
  const sunset = times.sunset.getTime();
  const sunrise = times.sunrise.getTime();

  if (time > sunset || time < sunrise) {
    let prevSunset: number;
    let nextSunrise: number;

    if (time > sunset) {
      prevSunset = sunset;
      const tomorrow = new Date(dateObj);
      tomorrow.setDate(tomorrow.getDate() + 1);
      nextSunrise = getSunTimes(tomorrow, lat, lon).sunrise.getTime();
    } else {
      nextSunrise = sunrise;
      const yesterday = new Date(dateObj);
      yesterday.setDate(yesterday.getDate() - 1);
      prevSunset = getSunTimes(yesterday, lat, lon).sunset.getTime();
    }

    const nadirTime = prevSunset + (nextSunrise - prevSunset) / 2;
    const maxDist = (nextSunrise - prevSunset) / 2;
    const distToNadir = Math.abs(time - nadirTime);

    return Math.min(1.0, Math.max(0, 1 - distToNadir / Math.max(1, maxDist)) * 2.0);
  }

  return 0;
}

export function getNightCoefficient(nightIntensity: number): number {
  return 1 - 0.1 * nightIntensity;
}

/**
 * Multiplicateur de temps selon la technicité du terrain (1: Roulant -> 5: Alpin extrême).
 */
export function getTerrainFactor(technicality: number = 2): number {
  switch (Math.round(technicality)) {
    case 1:
      return 0.95;
    case 2:
      return 1.0;
    case 3:
      return 1.1;
    case 4:
      return 1.25;
    case 5:
      return 1.4;
    default:
      return 1.0;
  }
}

/**
 * Intégrale analytique de la dérive de fatigue exponentielle sur un tronçon [x0, x0+dx].
 */
export function computeFatigueIntegral(
  x0: number,
  dx: number,
  totalEffort: number,
  fatiguePercent: number
): number {
  if (fatiguePercent <= 0 || totalEffort <= 0) return dx;
  const alpha = Math.log(1 + fatiguePercent / 100);
  return (
    (totalEffort / alpha) *
    (Math.exp((alpha * (x0 + dx)) / totalEffort) - Math.exp((alpha * x0) / totalEffort))
  );
}

/**
 * Seuil de pente critique (en décimal) de transition course -> marche, évolutif avec la fatigue.
 */
export function computeWalkThreshold(
  x: number,
  totalEffort: number,
  fatiguePercent: number,
  baseThresholdPercent: number = 12
): number {
  const F = fatiguePercent / 100;
  const effortProgress = totalEffort > 0 ? x / totalEffort : 0;

  let threshold = baseThresholdPercent / 100.0;
  const fatigueDrop = (F / 0.15) * 0.05;
  threshold -= effortProgress * fatigueDrop;

  if (effortProgress > 0.9) {
    const spurtBoost = ((effortProgress - 0.9) / 0.1) * 0.03;
    threshold += spurtBoost;
  }

  return Math.max(0.06, threshold);
}

/**
 * Vitesse de référence 1000 ITRA (en km-effort / heure) selon la loi de puissance physiologique Riegel/ITRA.
 */
export function getReferenceSpeed1000Itra(kmEffort: number): number {
  const safeKe = Math.max(12, kmEffort || 40);
  return 24.0 * Math.pow(safeKe, -0.068) * 1.03;
}

/**
 * Calcule la cote ITRA empirique d'une course réalisée (distance, D+, temps total).
 */
export function calculateEmpiricalItraFromPerformance(
  distanceKm: number,
  elevationGainM: number,
  elapsedHours: number,
  isTrainingFallback: boolean = false
): number {
  if (!distanceKm || distanceKm < 3 || !elapsedHours || elapsedHours <= 0.15) return 500;
  const ke = distanceKm + (elevationGainM || 0) / 100;
  const vRef1000 = getReferenceSpeed1000Itra(ke);
  const actualSpeedKeH = ke / elapsedHours;

  const vertDensity = (elevationGainM || 0) / Math.max(1, distanceKm);
  const shortBonusDiscount = ke < 45 ? 0.93 + (ke / 45) * 0.05 : 0.98;
  const flatBonusDiscount = vertDensity < 25 ? 0.94 : vertDensity < 45 ? 0.97 : 1.0;
  const trainingFactor = isTrainingFallback ? 0.96 : 1.0;

  const rawItra = (actualSpeedKeH / vRef1000) * 1000 * shortBonusDiscount * flatBonusDiscount * trainingFactor;
  return Math.max(250, Math.min(940, Math.round(rawItra)));
}

/**
 * Estime le temps global de course (heures décimales) corrigé des biais 50K et ultra-distance.
 */
export function estimateRaceTargetHours({
  distanceKm,
  elevationGainM,
  itraIndex,
  fatiguePercent = 20,
  upCostDivider = 88,
  downCostModifier = 1.0,
  pauseMinutesTotal = 0,
  paceProfile = 'coach',
}: RaceEstimateInput): number {
  const safeDist = Math.max(1, distanceKm || 20);
  const safeEle = Math.max(0, elevationGainM || 0);
  const safeItra = Math.max(250, Math.min(950, itraIndex || 550));

  const standardKe = safeDist + safeEle / 100;
  const vRef1000 = getReferenceSpeed1000Itra(standardKe);
  let runnerKeSpeed = (safeItra / 1000) * vRef1000;

  const vertRatio = safeEle / safeDist;
  const upAptitudeRatio = (upCostDivider || 88) / 90;
  const downAptitudeRatio = 1.0 - ((downCostModifier || 0.95) - 0.95) * 0.18;
  const terrainWeight = Math.min(1, vertRatio / 60);
  const aptitudeMultiplier = 1 + terrainWeight * ((upAptitudeRatio - 1) * 0.45 + (downAptitudeRatio - 1) * 0.35);
  runnerKeSpeed *= Math.max(0.82, Math.min(1.18, aptitudeMultiplier));

  const expectedFatigueForItra = Math.round(45 - ((safeItra - 200) / 800) * 30);
  const fatigueDelta = (fatiguePercent || expectedFatigueForItra) - expectedFatigueForItra;
  const fatigueAdjustment = 1 + (fatigueDelta / 100) * 0.32;

  let ultraDriftMultiplier = 1.0;
  if (standardKe > 65) {
    const ultraExcess = (standardKe - 65) / 100;
    const amateurFactor = Math.max(0.25, Math.min(1.45, (820 - safeItra) / 350));
    ultraDriftMultiplier = 1 + Math.pow(ultraExcess, 1.15) * 0.24 * amateurFactor;
  }

  const profileFactor = paceProfile === 'aggressive' ? 0.96 : 1.0;
  const runningHours =
    (standardKe / Math.max(3.2, runnerKeSpeed)) * fatigueAdjustment * ultraDriftMultiplier * profileFactor;

  let effectivePauseHours = (pauseMinutesTotal || 0) / 60;
  if (effectivePauseHours < 0.05 && standardKe > 65) {
    effectivePauseHours = ((standardKe - 55) / 25) * 0.12;
  }

  return Number(Math.max(0.25, runningHours + effectivePauseHours).toFixed(2));
}

export function estimateBasePaces(itraIndex: number, totalKmEffort: number = 45) {
  const index = Math.max(200, Math.min(1000, itraIndex || 600));
  const vRef1000 = getReferenceSpeed1000Itra(totalKmEffort);
  const flatSpeedKmh = (index / 1000) * vRef1000 * 1.08;
  const flatPaceMinKm = 60 / flatSpeedKmh;
  const vam = flatSpeedKmh * 95;

  return { vam, flatPaceMinKm, flatSpeedKmh };
}

export function deriveConfigFromITRA(itraIndex: number): DerivedItraConfig {
  const index = Math.max(200, Math.min(1000, itraIndex || 600));
  const fatiguePercent = Math.round(45 - ((index - 200) / 800) * 30);
  const descentThresholdPct = Math.round(10 + ((index - 200) / 800) * 15);
  const walkThresholdPct = Math.round(8 + ((index - 200) / 800) * 12);
  const upCostDivider = Math.round(80 + ((index - 200) / 800) * 20);
  const downCostModifier = parseFloat((1.5 - ((index - 200) / 800) * 1.3).toFixed(2));

  return {
    fatiguePercent,
    descentThresholdPct,
    walkThresholdPct,
    upCostDivider,
    downCostModifier,
    pacingStrategy: 'regular',
  };
}
