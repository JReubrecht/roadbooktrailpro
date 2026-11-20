'use client';

import React, { useMemo, useState } from 'react';
import { ExternalLink, Minus, Plus, RotateCcw } from 'lucide-react';
import {
  NUTRITION_CATALOG,
  NUTRITION_PRODUCT_TYPE_LABELS,
  calculateHourlyNutritionTargets,
  calculateNutritionBagTotals,
  groupNutritionCatalogByBrand,
  resolveProductBrandId,
} from '@/lib/trail/nutrition';
import type { WeatherCondition } from '@/types/domain';

interface NutritionSimulatorProps {
  weightKg: number;
  onWeightChange: (weightKg: number) => void;
  gutLevel: 'standard' | 'trained';
  onGutLevelChange: (level: 'standard' | 'trained') => void;
}

const DEFAULT_SELECTED_QTY: Record<string, number> = {
  maurten_drink_320: 3,
  naak_bar: 4,
  maurten_gel_100: 4,
  saltstick_caps: 6,
};

export default function NutritionSimulator({
  weightKg,
  onWeightChange,
  gutLevel,
  onGutLevelChange,
}: NutritionSimulatorProps) {
  const [nutriHours, setNutriHours] = useState(6.5);
  const [nutriWeather, setNutriWeather] = useState<WeatherCondition>('modere');
  const [selectedQty, setSelectedQty] = useState<Record<string, number>>(DEFAULT_SELECTED_QTY);
  const [activeBrandFilter, setActiveBrandFilter] = useState<string>('all');

  const nutriTargets = useMemo(
    () =>
      calculateHourlyNutritionTargets({
        durationHours: nutriHours,
        weightKg,
        weather: nutriWeather,
        gutTrainedLevel: gutLevel,
      }),
    [nutriHours, weightKg, nutriWeather, gutLevel]
  );

  const packTotals = useMemo(
    () => calculateNutritionBagTotals(selectedQty, NUTRITION_CATALOG),
    [selectedQty]
  );

  const allBrandGroups = useMemo(
    () => groupNutritionCatalogByBrand(NUTRITION_CATALOG),
    []
  );

  const visibleBrandGroups = useMemo(() => {
    if (activeBrandFilter === 'all') {
      return allBrandGroups;
    }
    if (activeBrandFilter === 'selected') {
      const selectedProducts = NUTRITION_CATALOG.filter((p) => (selectedQty[p.id] || 0) > 0);
      return groupNutritionCatalogByBrand(selectedProducts);
    }
    return allBrandGroups.filter((group) => group.brand.id === activeBrandFilter);
  }, [activeBrandFilter, allBrandGroups, selectedQty]);

  const setProductQty = (productId: string, nextQty: number) => {
    const safeQty = Number.isFinite(nextQty) ? Math.max(0, Math.min(99, Math.floor(nextQty))) : 0;
    setSelectedQty((prev) => {
      if (safeQty === 0) {
        const rest = { ...prev };
        delete rest[productId];
        return rest;
      }
      return { ...prev, [productId]: safeQty };
    });
  };

  const handleReset = () => {
    setSelectedQty({});
    if (activeBrandFilter === 'selected') {
      setActiveBrandFilter('all');
    }
  };

  const carbsDelta = packTotals.carbsG - nutriTargets.totalCarbsG;
  const sodiumDelta = packTotals.sodiumMg - nutriTargets.totalSodiumMg;

  return (
    <section
      id="nutrition-sim"
      className="bg-white rounded-lg border border-slate-200 p-6 space-y-5"
    >
      <div className="border-b border-slate-100 pb-3 flex flex-wrap items-start justify-between gap-2">
        <div>
          <p className="font-mono text-[10px] uppercase tracking-wider text-slate-400">
            CALCULATEUR 02 · APPORTS &amp; ÉLECTROLYTES
          </p>
          <h3 className="text-lg font-bold text-[#0F172A] mt-0.5">
            Simulateur Nutritionnel Trail
          </h3>
        </div>
        <span className="font-mono text-[10px] uppercase tracking-wider px-2 py-1 rounded border border-slate-200 bg-[#F8FAFC] text-slate-600 tabular-nums">
          {NUTRITION_CATALOG.length} références · {allBrandGroups.length} marques
        </span>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div>
          <label className="block font-mono text-[10px] uppercase text-slate-500 mb-1">
            Durée (h)
          </label>
          <input
            type="number"
            step="0.5"
            min={0.5}
            max={48}
            value={nutriHours}
            onChange={(e) => setNutriHours(Math.max(0.5, Number(e.target.value) || 2))}
            className="w-full rounded-md border border-slate-300 px-2.5 py-1.5 text-sm font-mono font-semibold"
          />
        </div>
        <div>
          <label className="block font-mono text-[10px] uppercase text-slate-500 mb-1">
            Poids (kg)
          </label>
          <input
            type="number"
            min={40}
            max={130}
            value={weightKg}
            onChange={(e) => onWeightChange(Math.max(40, Math.min(130, Number(e.target.value) || 68)))}
            className="w-full rounded-md border border-slate-300 px-2.5 py-1.5 text-sm font-mono font-semibold"
          />
        </div>
        <div>
          <label className="block font-mono text-[10px] uppercase text-slate-500 mb-1">
            Météo
          </label>
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
          <label className="block font-mono text-[10px] uppercase text-slate-500 mb-1">
            Digestion
          </label>
          <select
            value={gutLevel}
            onChange={(e) => onGutLevelChange(e.target.value as 'standard' | 'trained')}
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
          <p className="font-mono text-[10px] text-slate-400 tabular-nums">
            Tot: {nutriTargets.totalCarbsG} g
          </p>
        </div>
        <div className="p-3">
          <p className="font-mono text-[10px] uppercase text-slate-500">Eau / h</p>
          <p className="font-mono text-lg font-bold text-[#0F172A] tabular-nums">
            {nutriTargets.waterMlPerHour} ml
          </p>
          <p className="font-mono text-[10px] text-slate-400 tabular-nums">
            Tot: {nutriTargets.totalWaterLiters} L
          </p>
        </div>
        <div className="p-3">
          <p className="font-mono text-[10px] uppercase text-slate-500">Sodium / h</p>
          <p className="font-mono text-lg font-bold text-[#14C38E] tabular-nums">
            {nutriTargets.sodiumMgPerHour} mg
          </p>
          <p className="font-mono text-[10px] text-slate-400 tabular-nums">
            Tot: {nutriTargets.totalSodiumMg} mg
          </p>
        </div>
      </div>

      {/* Filtres par marque + sélection active */}
      <div className="space-y-2">
        <div className="flex items-center justify-between gap-2">
          <p className="font-mono text-[10px] uppercase tracking-wider text-slate-500">
            Catalogue par marque
          </p>
          <div className="flex items-center gap-2">
            {activeBrandFilter !== 'all' && (
              <button
                type="button"
                onClick={() => setActiveBrandFilter('all')}
                className="font-mono text-[10px] uppercase text-slate-500 hover:text-[#0F172A] underline cursor-pointer"
              >
                Tout voir
              </button>
            )}
            {packTotals.totalUnits > 0 && (
              <button
                type="button"
                onClick={handleReset}
                className="inline-flex items-center gap-1 font-mono text-[10px] uppercase text-slate-500 hover:text-red-600 cursor-pointer"
              >
                <RotateCcw size={11} />
                <span>Réinitialiser</span>
              </button>
            )}
          </div>
        </div>

        <div className="flex flex-wrap gap-1.5">
          <button
            type="button"
            onClick={() => setActiveBrandFilter('all')}
            className={`px-2.5 py-1 rounded border text-[11px] font-mono tabular-nums cursor-pointer transition-colors ${
              activeBrandFilter === 'all'
                ? 'bg-[#0F172A] text-white border-[#0F172A]'
                : 'bg-[#F8FAFC] text-slate-700 border-slate-200 hover:border-slate-400'
            }`}
          >
            Toutes ({NUTRITION_CATALOG.length})
          </button>

          <button
            type="button"
            onClick={() => setActiveBrandFilter('selected')}
            className={`px-2.5 py-1 rounded border text-[11px] font-mono tabular-nums cursor-pointer transition-colors ${
              activeBrandFilter === 'selected'
                ? 'bg-[#FF5A36] text-white border-[#FF5A36]'
                : packTotals.totalUnits > 0
                ? 'bg-[#14C38E]/10 text-[#0F172A] border-[#14C38E]'
                : 'bg-[#F8FAFC] text-slate-500 border-slate-200 hover:border-slate-400'
            }`}
          >
            Sélection ({packTotals.totalUnits})
          </button>

          {allBrandGroups.map(({ brand, products }) => {
            const isActive = activeBrandFilter === brand.id;
            const selectedCount = packTotals.selectedByBrand[brand.id] || 0;
            return (
              <button
                key={brand.id}
                type="button"
                onClick={() => setActiveBrandFilter(brand.id)}
                className={`px-2.5 py-1 rounded border text-[11px] font-mono tabular-nums cursor-pointer transition-colors inline-flex items-center gap-1.5 ${
                  isActive
                    ? 'bg-[#0F172A] text-white border-[#0F172A]'
                    : selectedCount > 0
                    ? 'bg-white text-[#0F172A] border-[#14C38E] hover:bg-[#F8FAFC]'
                    : 'bg-white text-slate-600 border-slate-200 hover:border-slate-400'
                }`}
              >
                <span>
                  {brand.name} ({products.length})
                </span>
                {selectedCount > 0 && (
                  <span
                    className={`px-1 rounded text-[10px] font-bold ${
                      isActive ? 'bg-[#14C38E] text-[#0F172A]' : 'bg-[#14C38E]/15 text-[#047857]'
                    }`}
                  >
                    {selectedCount}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* Liste groupée par marque */}
      <div className="border border-slate-200 rounded-md divide-y divide-slate-200 max-h-[380px] overflow-y-auto bg-white">
        {visibleBrandGroups.length === 0 ? (
          <div className="p-6 text-center text-xs text-slate-500">
            Aucun produit sélectionné pour le moment.
          </div>
        ) : (
          visibleBrandGroups.map(({ brand, products }) => {
            const brandUrl = brand.partnerUrl || brand.websiteUrl;
            const brandSelectedCount = packTotals.selectedByBrand[brand.id] || 0;

            return (
              <div key={brand.id}>
                <div className="bg-[#F8FAFC] px-3 py-2 flex flex-wrap items-center justify-between gap-2 border-b border-slate-200">
                  <div className="flex flex-wrap items-baseline gap-2">
                    <span className="text-xs font-bold uppercase tracking-wider text-[#0F172A]">
                      {brand.name}
                    </span>
                    {brand.tagline && (
                      <span className="text-[11px] text-slate-500">{brand.tagline}</span>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    {brandSelectedCount > 0 && (
                      <span className="font-mono text-[10px] font-semibold px-1.5 py-0.5 rounded bg-[#14C38E]/15 text-[#047857] tabular-nums">
                        {brandSelectedCount} dans le sac
                      </span>
                    )}
                    {brandUrl && (
                      <a
                        href={brandUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 px-2 py-0.5 rounded border border-slate-200 bg-white text-[10px] font-mono uppercase text-[#0F172A] hover:border-[#FF5A36] hover:text-[#FF5A36]"
                      >
                        <span>{brand.partnerLabel || 'Fiche marque'}</span>
                        <ExternalLink size={10} />
                      </a>
                    )}
                  </div>
                </div>

                <div className="divide-y divide-slate-100">
                  {products.map((prod) => {
                    const qty = selectedQty[prod.id] || 0;
                    const brandKey = resolveProductBrandId(prod);
                    return (
                      <div
                        key={prod.id}
                        data-brand-id={brandKey}
                        className={`flex items-center justify-between gap-3 px-3 py-2.5 text-xs ${
                          qty > 0 ? 'border-l-2 border-l-[#FF5A36] bg-[#FF5A36]/[0.03]' : ''
                        }`}
                      >
                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-center gap-1.5">
                            <span className="font-mono text-[10px] uppercase px-1.5 py-0.5 rounded border border-slate-200 bg-[#F8FAFC] text-slate-600">
                              {NUTRITION_PRODUCT_TYPE_LABELS[prod.type]}
                            </span>
                            <span className="font-semibold text-[#0F172A]">{prod.name}</span>
                            {prod.productUrl && (
                              <a
                                href={prod.productUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="inline-flex items-center gap-0.5 text-[10px] font-mono text-slate-400 hover:text-[#FF5A36]"
                                title="Voir la fiche produit"
                              >
                                <ExternalLink size={10} />
                              </a>
                            )}
                          </div>
                          <p className="font-mono text-[11px] text-slate-500 tabular-nums mt-0.5">
                            {prod.carbsG}g glu · {prod.sodiumMg}mg Na · {prod.weightG}g
                            {prod.caffeineMg ? ` · ${prod.caffeineMg}mg caf` : ''}
                            {prod.waterMl ? ` · ${prod.waterMl}ml` : ''}
                          </p>
                        </div>

                        <div className="flex items-center gap-1 shrink-0">
                          <button
                            type="button"
                            onClick={() => setProductQty(prod.id, qty - 1)}
                            disabled={qty <= 0}
                            aria-label={`Retirer ${prod.name}`}
                            className="w-6 h-7 rounded border border-slate-300 bg-white hover:bg-slate-50 disabled:opacity-40 flex items-center justify-center text-[#0F172A] cursor-pointer disabled:cursor-default"
                          >
                            <Minus size={11} />
                          </button>
                          <input
                            type="number"
                            min={0}
                            max={99}
                            aria-label={`Quantité ${prod.brand} ${prod.name}`}
                            value={qty}
                            onChange={(e) => setProductQty(prod.id, Number(e.target.value) || 0)}
                            className="w-12 h-7 rounded border border-slate-300 px-1 text-center font-mono font-semibold tabular-nums bg-white text-[#0F172A]"
                          />
                          <button
                            type="button"
                            onClick={() => setProductQty(prod.id, qty + 1)}
                            aria-label={`Ajouter ${prod.name}`}
                            className="w-6 h-7 rounded border border-slate-300 bg-white hover:bg-slate-50 flex items-center justify-center text-[#0F172A] cursor-pointer"
                          >
                            <Plus size={11} />
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Bilan du sac (toujours calculé sur l'ensemble des sélections) */}
      <div className="rounded-md bg-[#0F172A] text-white px-4 py-3 flex flex-wrap items-center justify-between gap-2 font-mono text-xs tabular-nums">
        <div className="space-y-0.5">
          <div>
            SAC : <strong>{packTotals.carbsG}g</strong> glu (cible {nutriTargets.totalCarbsG}g ·{' '}
            <span className={carbsDelta >= 0 ? 'text-[#14C38E]' : 'text-[#FF5A36]'}>
              {carbsDelta >= 0 ? `+${carbsDelta}g` : `${carbsDelta}g`}
            </span>
            ) · <strong>{packTotals.sodiumMg}mg</strong> Na (cible {nutriTargets.totalSodiumMg}mg ·{' '}
            <span className={sodiumDelta >= 0 ? 'text-[#14C38E]' : 'text-[#FF5A36]'}>
              {sodiumDelta >= 0 ? `+${sodiumDelta}mg` : `${sodiumDelta}mg`}
            </span>
            )
          </div>
          <p className="text-[10px] text-slate-400">
            {packTotals.totalUnits} unité(s) · {packTotals.caloriesKcal} kcal ·{' '}
            {packTotals.waterMl} ml boisson
          </p>
        </div>
        <span className="text-[#14C38E] font-semibold">
          MASSE {(packTotals.weightG / 1000).toFixed(2)} KG
        </span>
      </div>
    </section>
  );
}
