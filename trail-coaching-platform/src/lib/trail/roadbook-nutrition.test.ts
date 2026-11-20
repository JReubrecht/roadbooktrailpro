import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import {
  NUTRITION_BRANDS,
  NUTRITION_CATALOG,
  calculateNutritionBagTotals,
  calculateSegmentNutritionCaddie,
  groupNutritionCatalogByBrand,
} from './nutrition';
import { getNightIntensity, getRoadbookSolarSummary } from './pacing';
import {
  evaluateCutoffMargin,
  formatMarginMinutes,
  formatTimeIsoWithDayOffset,
  generateRoadbookSegments,
  getSampleAlpineTrailTrace,
  normalizeWaypointsForSave,
  toDateTimeLocalValue,
} from './roadbook';
import { roadbookSaveSchema } from '../validation/schemas';

describe('R2 — Catalogue Nutrition & Marques', () => {
  it('contient les 13 références et les regroupe sur les 8 marques sans perte', () => {
    assert.equal(NUTRITION_CATALOG.length, 13);
    assert.equal(NUTRITION_BRANDS.length, 8);

    const groups = groupNutritionCatalogByBrand(NUTRITION_CATALOG);
    assert.equal(groups.length, 8);
    const totalProducts = groups.reduce((sum, g) => sum + g.products.length, 0);
    assert.equal(totalProducts, 13);
  });

  it('calcule exactement les totaux du sac initial (y compris saltstick_caps)', () => {
    const totals = calculateNutritionBagTotals({
      maurten_drink_320: 3,
      naak_bar: 4,
      maurten_gel_100: 4,
      saltstick_caps: 6,
    });

    assert.equal(totals.carbsG, 449);
    assert.equal(totals.sodiumMg, 3650);
    assert.equal(totals.weightG, 606);
    assert.equal(totals.totalUnits, 17);
    assert.equal(totals.selectedByBrand.saltstick, 6);
  });

  it('ignore les quantités négatives, nulles ou non finies dans le calcul du sac', () => {
    const totals = calculateNutritionBagTotals({
      maurten_gel_100: 2,
      saltstick_caps: -3,
      naak_bar: Number.NaN,
      eau_pure_500: 0,
    });

    assert.equal(totals.carbsG, 50);
    assert.equal(totals.sodiumMg, 70);
    assert.equal(totals.weightG, 80);
    assert.equal(totals.totalUnits, 2);
  });
});

describe('R3 — Nutrition par Ravitaillement / Tronçon', () => {
  it('calcule cibles glucides/sodium, apports planifiés, écarts, eau et masse par tronçon', () => {
    const sample = getSampleAlpineTrailTrace();
    const waypoints = sample.waypoints.map((wp, idx) =>
      idx === 1
        ? {
            ...wp,
            plannedNutrition: {
              maurten_drink_320: 1,
              maurten_gel_100: 1,
              saltstick_caps: 1,
            },
          }
        : wp
    );

    const segments = generateRoadbookSegments(sample.points, waypoints, {
      itraIndex: 600,
      fatiguePercent: 20,
      startTimeIso: '2026-06-27T06:00',
      elevationThresholdM: 5,
      distanceFactor: 1,
      weather: 'modere',
      descentThresholdPct: 15,
      walkThresholdPct: 12,
      upCostDivider: 88,
      downCostModifier: 1,
      pacingStrategy: 'regular',
      paceProfile: 'coach',
    });

    const caddies = calculateSegmentNutritionCaddie(segments, 65, 450);
    assert.equal(caddies.length, segments.length);

    const first = caddies[0];
    const expectedTargetCarbs = Math.round((segments[0].durationFastMs / 3600000) * 65);
    const expectedTargetSodium = Math.round((segments[0].durationFastMs / 3600000) * 450);

    assert.equal(first.targetCarbsG, expectedTargetCarbs);
    assert.equal(first.targetSodiumMg, expectedTargetSodium);
    assert.equal(first.plannedCarbsG, 104);
    assert.equal(first.plannedSodiumMg, 750);
    assert.equal(first.deltaCarbsG, 104 - expectedTargetCarbs);
    assert.equal(first.deltaSodiumMg, 750 - expectedTargetSodium);
    assert.equal(first.plannedWaterMl, 500);
    assert.equal(first.plannedWeightG, 121);
  });
});

describe('R4 — Barrières Horaires & Datetime Helpers', () => {
  it('convertit des ISO complets et locaux pour <input type="datetime-local">', () => {
    assert.equal(toDateTimeLocalValue('2026-06-27T06:00'), '2026-06-27T06:00');
    assert.equal(toDateTimeLocalValue(''), '');
    assert.equal(toDateTimeLocalValue('invalide'), '');

    const d = new Date(2026, 5, 27, 14, 35);
    assert.equal(toDateTimeLocalValue(d.toISOString()), '2026-06-27T14:35');
  });

  it('évalue les marges face aux passages cible et prudent (ok / warning / exceeded / none)', () => {
    const fast = '2026-06-27T10:00:00.000Z';
    const slow = '2026-06-27T10:45:00.000Z';

    assert.deepEqual(evaluateCutoffMargin(undefined, fast, slow), {
      status: 'none',
      marginFastMin: null,
      marginSlowMin: null,
    });

    const ok = evaluateCutoffMargin('2026-06-27T11:15:00.000Z', fast, slow);
    assert.equal(ok.status, 'ok');
    assert.equal(ok.marginFastMin, 75);
    assert.equal(ok.marginSlowMin, 30);

    const warnPrudent = evaluateCutoffMargin('2026-06-27T10:25:00.000Z', fast, slow);
    assert.equal(warnPrudent.status, 'warning');
    assert.equal(warnPrudent.marginFastMin, 25);
    assert.equal(warnPrudent.marginSlowMin, -20);

    const warnTight = evaluateCutoffMargin('2026-06-27T10:10:00.000Z', fast, '2026-06-27T10:05:00.000Z');
    assert.equal(warnTight.status, 'warning');
    assert.equal(warnTight.marginFastMin, 10);

    const exceeded = evaluateCutoffMargin('2026-06-27T09:50:00.000Z', fast, slow);
    assert.equal(exceeded.status, 'exceeded');
    assert.equal(exceeded.marginFastMin, -10);
    assert.equal(exceeded.marginSlowMin, -55);
  });

  it('classe les retards sous la minute (-29s) en dépassement sans jamais produire -0 ni +0 min', () => {
    const lateFast = evaluateCutoffMargin(
      '2026-06-27T10:00:00.000Z',
      '2026-06-27T10:00:29.000Z',
      '2026-06-27T10:30:29.000Z'
    );
    assert.equal(lateFast.status, 'exceeded');
    assert.equal(lateFast.marginFastMin, -1);
    assert.equal(formatMarginMinutes(lateFast.marginFastMin!), '-1 min');

    const lateSlow = evaluateCutoffMargin(
      '2026-06-27T10:20:00.000Z',
      '2026-06-27T10:00:00.000Z',
      '2026-06-27T10:20:29.000Z'
    );
    assert.equal(lateSlow.status, 'warning');
    assert.equal(lateSlow.marginFastMin, 20);
    assert.equal(lateSlow.marginSlowMin, -1);
    assert.equal(formatMarginMinutes(lateSlow.marginSlowMin!), '-1 min');

    // Vérification stricte des bornes et absence de -0
    const exactZero = evaluateCutoffMargin(
      '2026-06-27T10:00:00.000Z',
      '2026-06-27T10:00:00.000Z',
      '2026-06-27T10:00:00.000Z'
    );
    assert.equal(exactZero.status, 'warning');
    assert.equal(Object.is(exactZero.marginFastMin, 0), true);
    assert.equal(formatMarginMinutes(exactZero.marginFastMin!), '+0 min');
    assert.equal(formatMarginMinutes(-0), '+0 min');
    assert.equal(formatMarginMinutes(-0.2), '+0 min');

    const tight14 = evaluateCutoffMargin(
      '2026-06-27T10:14:00.000Z',
      '2026-06-27T10:00:00.000Z',
      '2026-06-27T10:14:00.000Z'
    );
    assert.equal(tight14.status, 'warning');
    assert.equal(tight14.marginFastMin, 14);

    const ok15 = evaluateCutoffMargin(
      '2026-06-27T10:15:00.000Z',
      '2026-06-27T10:00:00.000Z',
      '2026-06-27T10:15:00.000Z'
    );
    assert.equal(ok15.status, 'ok');
    assert.equal(ok15.marginFastMin, 15);

    const minus1 = evaluateCutoffMargin(
      '2026-06-27T09:59:00.000Z',
      '2026-06-27T10:00:00.000Z',
      '2026-06-27T10:15:00.000Z'
    );
    assert.equal(minus1.status, 'exceeded');
    assert.equal(minus1.marginFastMin, -1);
    assert.equal(formatMarginMinutes(minus1.marginFastMin!), '-1 min');

    assert.equal(toDateTimeLocalValue('2026-02-30T12:00'), '');
    assert.equal(
      evaluateCutoffMargin('2026-02-30T12:00', '2026-02-28T10:00:00.000Z', '2026-02-28T10:30:00.000Z')
        .status,
      'invalid'
    );
  });

  it('affiche un décalage +1j lorsque le passage franchit minuit', () => {
    const start = new Date(2026, 5, 27, 20, 0).toISOString();
    const nextDay = new Date(2026, 5, 28, 2, 15).toISOString();
    const formatted = formatTimeIsoWithDayOffset(nextDay, start);
    assert.ok(formatted.includes('(+1j)'));
  });
});

describe('R5 — SunCalc Nuit & Résumé Solaire', () => {
  it('gère correctement lon = 0 (méridien de Greenwich / Pyrénées) sans court-circuit falsy', () => {
    const midnightPyrenees = new Date('2026-06-27T00:00:00.000Z');
    const intensity = getNightIntensity(midnightPyrenees, 42.7, 0);
    assert.ok(intensity > 0.5, `Intensité attendue > 0.5 à minuit pour lon=0, reçu ${intensity}`);

    const noonPyrenees = new Date('2026-06-27T12:00:00.000Z');
    assert.equal(getNightIntensity(noonPyrenees, 42.7, 0), 0);
  });

  it('gère les latitudes polaires (jour/nuit polaires) sans exception sur Date | null', () => {
    const summerSolstice = new Date('2026-06-21T12:00:00.000Z');
    const winterSolstice = new Date('2026-12-21T12:00:00.000Z');
    assert.equal(getNightIntensity(summerSolstice, 78.22, 15.65), 0);
    assert.equal(getNightIntensity(winterSolstice, 78.22, 15.65), 1);
  });

  it('calcule getRoadbookSolarSummary et détecte le changement diurne vs nocturne', () => {
    const sample = getSampleAlpineTrailTrace();
    const daySegments = generateRoadbookSegments(sample.points, sample.waypoints, {
      itraIndex: 600,
      fatiguePercent: 20,
      startTimeIso: '2026-06-27T08:00',
      elevationThresholdM: 5,
      distanceFactor: 1,
      weather: 'modere',
      descentThresholdPct: 15,
      walkThresholdPct: 12,
      upCostDivider: 88,
      downCostModifier: 1,
      pacingStrategy: 'regular',
      paceProfile: 'coach',
    });
    const nightSegments = generateRoadbookSegments(sample.points, sample.waypoints, {
      itraIndex: 600,
      fatiguePercent: 20,
      startTimeIso: '2026-06-27T21:30',
      elevationThresholdM: 5,
      distanceFactor: 1,
      weather: 'modere',
      descentThresholdPct: 15,
      walkThresholdPct: 12,
      upCostDivider: 88,
      downCostModifier: 1,
      pacingStrategy: 'regular',
      paceProfile: 'coach',
    });

    const daySolar = getRoadbookSolarSummary({
      startTimeIso: '2026-06-27T08:00',
      endTimeIso: daySegments[daySegments.length - 1].arrivalSlowIso,
      lat: sample.points[0].lat,
      lon: sample.points[0].lon,
      segments: daySegments,
    });
    const nightSolar = getRoadbookSolarSummary({
      startTimeIso: '2026-06-27T21:30',
      endTimeIso: nightSegments[nightSegments.length - 1].arrivalSlowIso,
      lat: sample.points[0].lat,
      lon: sample.points[0].lon,
      segments: nightSegments,
    });

    assert.equal(daySolar.hasValidDate, true);
    assert.equal(daySolar.hasValidCoords, true);
    assert.ok(daySolar.sunriseIso !== null);
    assert.ok(daySolar.sunsetIso !== null);
    assert.equal(daySolar.nightSegmentsCount, 0);

    assert.ok(nightSolar.nightSegmentsCount > 0);
    assert.ok(nightSolar.nightDistanceKm > 0);
    assert.ok(nightSolar.nightDurationFastMs > 0);
    assert.equal(nightSolar.spansMultipleDays, true);
  });

  it('évalue nightIntensity au véritable point médian mis à l’échelle sous targetTimeHours = 16', () => {
    const sample = getSampleAlpineTrailTrace();
    const baseLat = sample.points[0].lat;
    const baseLon = sample.points[0].lon;

    for (const startTimeIso of ['2026-06-27T18:00', '2026-06-27T12:00']) {
      const scaledSegments = generateRoadbookSegments(sample.points, sample.waypoints, {
        itraIndex: 600,
        fatiguePercent: 20,
        startTimeIso,
        targetTimeHours: 16,
        elevationThresholdM: 5,
        distanceFactor: 1,
        weather: 'modere',
        descentThresholdPct: 15,
        walkThresholdPct: 12,
        upCostDivider: 88,
        downCostModifier: 1,
        pacingStrategy: 'regular',
        paceProfile: 'coach',
      });

      for (const seg of scaledSegments) {
        const trueMidDate = new Date(
          new Date(seg.arrivalFastIso).getTime() - seg.durationFastMs / 2
        );
        const trueMidIntensity = getNightIntensity(trueMidDate, baseLat, baseLon);
        const diff = Math.abs(seg.nightIntensity - trueMidIntensity);
        assert.ok(
          diff < 0.02,
          `Divergence nightIntensity sur ${seg.id} (${startTimeIso}): segment=${seg.nightIntensity}, vrai médian=${trueMidIntensity}`
        );
      }
    }
  });
});

describe('Persistence & Validation — roadbookSaveSchema', () => {
  it('valide cutoffTimeIso et plannedNutrition et rejette les valeurs invalides', () => {
    const valid = roadbookSaveSchema.safeParse({
      id: 'rb-test-1',
      name: 'Test UTMB',
      startTimeIso: '2026-08-28T18:00',
      points: [{ lat: 45.92, lon: 6.87, ele: 1040 }],
      waypoints: [
        {
          id: 'wp-1',
          name: 'Les Contamines',
          lat: 45.82,
          lon: 6.72,
          ele: 1164,
          pointIndex: 10,
          cutoffTimeIso: '2026-08-28T22:30',
          plannedNutrition: { maurten_drink_320: 2, saltstick_caps: 3 },
        },
      ],
    });
    assert.equal(valid.success, true);

    const invalidCutoff = roadbookSaveSchema.safeParse({
      id: 'rb-test-2',
      name: 'Test invalide',
      points: [],
      waypoints: [
        {
          id: 'wp-1',
          name: 'Ravito',
          lat: 45.8,
          lon: 6.7,
          ele: 1100,
          pointIndex: 1,
          cutoffTimeIso: 'pas-une-date',
        },
      ],
    });
    assert.equal(invalidCutoff.success, false);

    const invalidQty = roadbookSaveSchema.safeParse({
      id: 'rb-test-3',
      name: 'Test qty négative',
      points: [],
      waypoints: [
        {
          id: 'wp-1',
          name: 'Ravito',
          lat: 45.8,
          lon: 6.7,
          ele: 1100,
          pointIndex: 1,
          plannedNutrition: { maurten_gel_100: -1 },
        },
      ],
    });
    assert.equal(invalidQty.success, false);
  });

  it('rejette les dates calendaires inexistantes (2026-02-30) et startTimeIso vide', () => {
    const emptyStart = roadbookSaveSchema.safeParse({
      id: 'rb-test-empty-start',
      name: 'Test start vide',
      startTimeIso: '',
      points: [],
      waypoints: [],
    });
    assert.equal(emptyStart.success, false);

    const feb30Cutoff = roadbookSaveSchema.safeParse({
      id: 'rb-test-feb30-cutoff',
      name: 'Test 30 février BH',
      startTimeIso: '2026-02-28T06:00',
      points: [],
      waypoints: [
        {
          id: 'wp-1',
          name: 'Ravito',
          lat: 45.8,
          lon: 6.7,
          ele: 1100,
          pointIndex: 1,
          cutoffTimeIso: '2026-02-30T12:00',
        },
      ],
    });
    assert.equal(feb30Cutoff.success, false);

    const feb30Start = roadbookSaveSchema.safeParse({
      id: 'rb-test-feb30-start',
      name: 'Test 30 février départ',
      startTimeIso: '2026-02-30T12:00',
      points: [],
      waypoints: [],
    });
    assert.equal(feb30Start.success, false);

    const feb29NonLeap = roadbookSaveSchema.safeParse({
      id: 'rb-test-feb29-2026',
      name: 'Test 29 février non bissextile',
      startTimeIso: '2026-02-29T06:00',
      points: [],
      waypoints: [],
    });
    assert.equal(feb29NonLeap.success, false);

    for (const validStart of [
      '2024-02-29',
      '2024-02-29T06:00',
      '2026-06-27T06:00:00.000Z',
    ]) {
      const ok = roadbookSaveSchema.safeParse({
        id: 'rb-test-valid-start',
        name: 'Test format départ valide',
        startTimeIso: validStart,
        points: [],
        waypoints: [],
      });
      assert.equal(ok.success, true, `Format attendu valide: ${validStart}`);
    }
  });

  it('normalise cutoffTimeIso vide et quantités nulles avant sauvegarde', () => {
    const cleaned = normalizeWaypointsForSave([
      {
        id: 'wp-1',
        name: 'Ravito',
        lat: 45.8,
        lon: 6.7,
        ele: 1100,
        pointIndex: 1,
        cutoffTimeIso: '   ',
        plannedNutrition: { maurten_gel_100: 0, saltstick_caps: 2 },
      },
    ]);

    assert.equal('cutoffTimeIso' in cleaned[0], false);
    assert.deepEqual(cleaned[0].plannedNutrition, { saltstick_caps: 2 });
  });
});
