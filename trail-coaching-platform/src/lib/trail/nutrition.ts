import type { NutritionProduct, RoadbookSegment, WeatherCondition } from '@/types/domain';

export const NUTRITION_CATALOG: NutritionProduct[] = [
  {
    id: 'maurten_gel_100',
    brand: 'Maurten',
    name: 'Gel 100',
    type: 'Gel',
    carbsG: 25,
    caloriesKcal: 100,
    sodiumMg: 35,
    weightG: 40,
    description: 'Gel hydrogel haute tolérance digestive.',
  },
  {
    id: 'maurten_gel_100_caf',
    brand: 'Maurten',
    name: 'Gel 100 Caf 100',
    type: 'Gel',
    carbsG: 25,
    caloriesKcal: 100,
    sodiumMg: 35,
    caffeineMg: 100,
    weightG: 40,
    description: 'Gel hydrogel avec 100 mg de caféine pour les fins de course.',
  },
  {
    id: 'maurten_drink_320',
    brand: 'Maurten',
    name: 'Drink Mix 320',
    type: 'Drink',
    carbsG: 79,
    caloriesKcal: 320,
    sodiumMg: 500,
    waterMl: 500,
    weightG: 80,
    description: 'Boisson hydrogel concentrée pour apport glucidique élevé.',
  },
  {
    id: 'naak_bar',
    brand: 'Näak',
    name: 'Ultra Energy Bar',
    type: 'Bar',
    carbsG: 28,
    caloriesKcal: 200,
    sodiumMg: 180,
    weightG: 50,
    description: 'Barre énergétique longue distance avec protéines et BCAA.',
  },
  {
    id: 'naak_puree',
    brand: 'Näak',
    name: 'Ultra Energy Puree',
    type: 'Puree',
    carbsG: 26,
    caloriesKcal: 200,
    sodiumMg: 400,
    weightG: 90,
    description: 'Purée salée ou sucrée très digeste en ultra-trail.',
  },
  {
    id: 'naak_drink',
    brand: 'Näak',
    name: 'Ultra Energy Drink Mix',
    type: 'Drink',
    carbsG: 55,
    caloriesKcal: 250,
    sodiumMg: 400,
    waterMl: 500,
    weightG: 72,
    description: 'Boisson ultra complète glucides + électrolytes.',
  },
  {
    id: 'tailwind_endurance',
    brand: 'Tailwind',
    name: 'Endurance Fuel (2 doses)',
    type: 'Drink',
    carbsG: 50,
    caloriesKcal: 200,
    sodiumMg: 606,
    waterMl: 500,
    weightG: 54,
    description: 'Boisson tout-en-un hydratation, glucides et sodium.',
  },
  {
    id: 'precision_gel_30',
    brand: 'Precision',
    name: 'PF 30 Gel',
    type: 'Gel',
    carbsG: 30,
    caloriesKcal: 120,
    sodiumMg: 0,
    weightG: 51,
    description: 'Gel goût neutre calibré à 30 g de glucides.',
  },
  {
    id: 'precision_ph1000',
    brand: 'Precision',
    name: 'PH 1000 Électrolytes',
    type: 'Drink',
    carbsG: 17,
    caloriesKcal: 65,
    sodiumMg: 500,
    waterMl: 500,
    weightG: 20,
    description: 'Boisson fortement dosée en sodium pour conditions chaudes.',
  },
  {
    id: 'overstims_energix',
    brand: 'Overstim.s',
    name: 'Gel Energix',
    type: 'Gel',
    carbsG: 19,
    caloriesKcal: 76,
    sodiumMg: 20,
    weightG: 28,
    description: 'Gel longue distance progressif avec BCAA.',
  },
  {
    id: 'decathlon_gel_plus',
    brand: 'Decathlon',
    name: 'Energy Gel+',
    type: 'Gel',
    carbsG: 30,
    caloriesKcal: 120,
    sodiumMg: 70,
    weightG: 35,
    description: 'Gel optimisé pour efforts > 3h.',
  },
  {
    id: 'saltstick_caps',
    brand: 'SaltStick',
    name: 'Capsule Electrolyte',
    type: 'Pill',
    carbsG: 0,
    caloriesKcal: 0,
    sodiumMg: 215,
    weightG: 1,
    description: 'Gélule concentrée en électrolytes.',
  },
  {
    id: 'eau_pure_500',
    brand: 'Générique',
    name: 'Eau Plate 500 ml',
    type: 'Drink',
    carbsG: 0,
    caloriesKcal: 0,
    sodiumMg: 0,
    waterMl: 500,
    weightG: 500,
    description: 'Hydratation neutre.',
  },
];

export interface NutritionTargetPlan {
  carbsGPerHour: number;
  waterMlPerHour: number;
  sodiumMgPerHour: number;
  totalCarbsG: number;
  totalWaterLiters: number;
  totalSodiumMg: number;
  recommendationNote: string;
}

/**
 * Calcule les cibles horaires scientifiques (glucides g/h, eau ml/h, sodium mg/h)
 * en fonction de la durée prévue, de la météo et du gabarit.
 */
export function calculateHourlyNutritionTargets(params: {
  durationHours: number;
  weightKg?: number;
  weather: WeatherCondition;
  gutTrainedLevel?: 'standard' | 'trained';
}): NutritionTargetPlan {
  const duration = Math.max(0.5, params.durationHours);
  const weight = params.weightKg || 68;
  const isTrained = params.gutTrainedLevel === 'trained';

  // Apport glucidique cible selon durée et entraînement digestif (Jeukendrup / recommandations ultra)
  let carbsGPerHour = 45;
  if (duration >= 1.5 && duration < 3) carbsGPerHour = isTrained ? 70 : 55;
  else if (duration >= 3 && duration < 8) carbsGPerHour = isTrained ? 85 : 65;
  else if (duration >= 8) carbsGPerHour = isTrained ? 75 : 60; // Au-delà de 8h, tolérance gastrique prioritaire

  // Hydratation et sodium selon la météo et le poids
  const weatherWaterMap: Record<WeatherCondition, number> = {
    froid: 420,
    modere: 550,
    chaud: 720,
    tres_chaud: 880,
  };
  const weatherSodiumMap: Record<WeatherCondition, number> = {
    froid: 300,
    modere: 450,
    chaud: 650,
    tres_chaud: 850,
  };

  const weightAdjust = Math.max(0.85, Math.min(1.2, weight / 68));
  const waterMlPerHour = Math.round(weatherWaterMap[params.weather] * weightAdjust);
  const sodiumMgPerHour = Math.round(weatherSodiumMap[params.weather]);

  const totalCarbsG = Math.round(carbsGPerHour * duration);
  const totalWaterLiters = Number(((waterMlPerHour * duration) / 1000).toFixed(1));
  const totalSodiumMg = Math.round(sodiumMgPerHour * duration);

  let recommendationNote =
    'Fractionnez vos prises toutes les 20–25 minutes par petites gorgées plutôt qu’en bloc aux ravitaillements.';
  if (duration >= 8) {
    recommendationNote +=
      ' Sur format ultra (>8h), alternez glucides liquides et textures salées/semi-solides pour éviter la saturation sucrée.';
  }
  if (params.weather === 'chaud' || params.weather === 'tres_chaud') {
    recommendationNote +=
      ' Chaleur marquée : maintenez un apport constant en sodium et refroidissez nuque/avant-bras aux points d’eau.';
  }

  return {
    carbsGPerHour,
    waterMlPerHour,
    sodiumMgPerHour,
    totalCarbsG,
    totalWaterLiters,
    totalSodiumMg,
    recommendationNote,
  };
}

export interface SegmentCaddieSummary {
  segmentId: string;
  segmentTitle: string;
  durationHours: number;
  targetCarbsG: number;
  plannedCarbsG: number;
  plannedSodiumMg: number;
  items: Array<{ product: NutritionProduct; qty: number }>;
}

export function calculateSegmentNutritionCaddie(
  segments: RoadbookSegment[],
  carbsGPerHour: number
): SegmentCaddieSummary[] {
  return segments.map((seg) => {
    const durationHours = seg.durationFastMs / 3600000;
    const targetCarbsG = Math.round(durationHours * carbsGPerHour);
    const planned = seg.to.plannedNutrition || {};

    const items: Array<{ product: NutritionProduct; qty: number }> = [];
    let plannedCarbsG = 0;
    let plannedSodiumMg = 0;

    for (const [productId, qty] of Object.entries(planned)) {
      if (qty > 0) {
        const product = NUTRITION_CATALOG.find((p) => p.id === productId);
        if (product) {
          items.push({ product, qty });
          plannedCarbsG += product.carbsG * qty;
          plannedSodiumMg += product.sodiumMg * qty;
        }
      }
    }

    return {
      segmentId: seg.id,
      segmentTitle: `${seg.from.name} → ${seg.to.name}`,
      durationHours: Number(durationHours.toFixed(2)),
      targetCarbsG,
      plannedCarbsG,
      plannedSodiumMg,
      items,
    };
  });
}
