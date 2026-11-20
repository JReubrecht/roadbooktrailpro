'use client';

import React, { useMemo, useState } from 'react';
import { Minus, Package, Plus, RotateCcw } from 'lucide-react';
import {
  NUTRITION_CATALOG,
  NUTRITION_PRODUCT_TYPE_LABELS,
  groupNutritionCatalogByBrand,
  type NutritionTargetPlan,
  type SegmentCaddieSummary,
} from '@/lib/trail/nutrition';
import type { RoadbookSegment } from '@/types/domain';

interface RoadbookNutritionPanelProps {
  segments: RoadbookSegment[];
  caddies: SegmentCaddieSummary[];
  hourlyTargets: NutritionTargetPlan;
  selectedSegmentId: string | null;
  onSelectSegment: (segmentId: string) => void;
  onUpdateWaypointNutrition: (
    waypointId: string,
    plannedNutrition: Record<string, number> | undefined
  ) => void;
}

export default function RoadbookNutritionPanel({
  segments,
  caddies,
  hourlyTargets,
  selectedSegmentId,
  onSelectSegment,
  onUpdateWaypointNutrition,
}: RoadbookNutritionPanelProps) {
  const [brandFilter, setBrandFilter] = useState<string>('all');

  const activeSegment = useMemo(() => {
    if (segments.length === 0) return null;
    return segments.find((s) => s.id === selectedSegmentId) || segments[0];
  }, [segments, selectedSegmentId]);

  const activeCaddie = useMemo(() => {
    if (!activeSegment) return null;
    return caddies.find((c) => c.segmentId === activeSegment.id) || null;
  }, [activeSegment, caddies]);

  const totals = useMemo(() => {
    return caddies.reduce(
      (acc, c) => ({
        targetCarbsG: acc.targetCarbsG + c.targetCarbsG,
        targetSodiumMg: acc.targetSodiumMg + c.targetSodiumMg,
        plannedCarbsG: acc.plannedCarbsG + c.plannedCarbsG,
        plannedSodiumMg: acc.plannedSodiumMg + c.plannedSodiumMg,
        plannedWaterMl: acc.plannedWaterMl + c.plannedWaterMl,
        plannedWeightG: acc.plannedWeightG + c.plannedWeightG,
      }),
      {
        targetCarbsG: 0,
        targetSodiumMg: 0,
        plannedCarbsG: 0,
        plannedSodiumMg: 0,
        plannedWaterMl: 0,
        plannedWeightG: 0,
      }
    );
  }, [caddies]);

  const allBrandGroups = useMemo(
    () => groupNutritionCatalogByBrand(NUTRITION_CATALOG),
    []
  );

  const activePlanned = useMemo(
    () => activeSegment?.to.plannedNutrition || {},
    [activeSegment]
  );

  const visibleBrandGroups = useMemo(() => {
    if (brandFilter === 'all') return allBrandGroups;
    if (brandFilter === 'selected') {
      const selectedProducts = NUTRITION_CATALOG.filter((p) => (activePlanned[p.id] || 0) > 0);
      return groupNutritionCatalogByBrand(selectedProducts);
    }
    return allBrandGroups.filter((g) => g.brand.id === brandFilter);
  }, [brandFilter, allBrandGroups, activePlanned]);

  const setSegmentProductQty = (productId: string, nextQty: number) => {
    if (!activeSegment) return;
    const safeQty = Number.isFinite(nextQty) ? Math.max(0, Math.min(99, Math.floor(nextQty))) : 0;
    const current = { ...(activeSegment.to.plannedNutrition || {}) };
    if (safeQty === 0) {
      delete current[productId];
    } else {
      current[productId] = safeQty;
    }
    onUpdateWaypointNutrition(
      activeSegment.to.id,
      Object.keys(current).length > 0 ? current : undefined
    );
  };

  if (segments.length === 0 || !activeSegment || !activeCaddie) {
    return (
      <section
        id="roadbook-nutrition-panel"
        className="bg-white rounded-lg border border-slate-200 p-6 text-xs text-slate-500"
      >
        Chargez une trace GPX pour planifier la nutrition par ravitaillement et tronçon.
      </section>
    );
  }

  const totalCarbsDelta = totals.plannedCarbsG - totals.targetCarbsG;
  const totalSodiumDelta = totals.plannedSodiumMg - totals.targetSodiumMg;
  const activeUnitsCount = Object.values(activePlanned).reduce(
    (sum, q) => sum + (Number.isFinite(q) && q > 0 ? Math.floor(q) : 0),
    0
  );

  return (
    <section
      id="roadbook-nutrition-panel"
      className="bg-white rounded-lg border border-slate-200 overflow-hidden"
    >
      {/* En-tête + bilan global course */}
      <div className="p-5 border-b border-slate-200 flex flex-wrap items-center justify-between gap-4">
        <div>
          <p className="font-mono text-[10px] uppercase tracking-wider text-slate-400">
            CADDIE COURSE · NUTRITION PAR RAVITAILLEMENT
          </p>
          <h3 className="text-base font-bold text-[#0F172A] mt-0.5 flex items-center gap-2">
            <Package size={16} className="text-[#FF5A36]" />
            <span>Plan Nutrition par Tronçon</span>
          </h3>
          <p className="text-xs text-slate-500 mt-0.5">
            Cibles calculées sur votre météo course ({hourlyTargets.carbsGPerHour} g glu/h ·{' '}
            {hourlyTargets.sodiumMgPerHour} mg Na/h). Les quantités sont enregistrées sur le point d&apos;arrivée de chaque tronçon.
          </p>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 border border-slate-200 rounded-md divide-x divide-slate-200 bg-[#F8FAFC] font-mono text-xs tabular-nums">
          <div className="px-3 py-2">
            <p className="text-[10px] uppercase text-slate-400">Glucides course</p>
            <p className="font-bold text-[#0F172A]">
              {totals.plannedCarbsG} / {totals.targetCarbsG} g
            </p>
            <p
              className={`text-[10px] font-semibold ${
                totalCarbsDelta >= 0 ? 'text-[#047857]' : 'text-[#FF5A36]'
              }`}
            >
              {totalCarbsDelta >= 0 ? `+${totalCarbsDelta} g` : `${totalCarbsDelta} g`}
            </p>
          </div>
          <div className="px-3 py-2">
            <p className="text-[10px] uppercase text-slate-400">Sodium course</p>
            <p className="font-bold text-[#0F172A]">
              {totals.plannedSodiumMg} / {totals.targetSodiumMg} mg
            </p>
            <p
              className={`text-[10px] font-semibold ${
                totalSodiumDelta >= 0 ? 'text-[#047857]' : 'text-[#FF5A36]'
              }`}
            >
              {totalSodiumDelta >= 0 ? `+${totalSodiumDelta} mg` : `${totalSodiumDelta} mg`}
            </p>
          </div>
          <div className="px-3 py-2">
            <p className="text-[10px] uppercase text-slate-400">Liquide embarqué</p>
            <p className="font-bold text-[#0F172A]">{totals.plannedWaterMl} ml</p>
            <p className="text-[10px] text-slate-400">Boissons planifiées</p>
          </div>
          <div className="px-3 py-2">
            <p className="text-[10px] uppercase text-slate-400">Masse totale</p>
            <p className="font-bold text-[#14C38E]">
              {(totals.plannedWeightG / 1000).toFixed(2)} kg
            </p>
            <p className="text-[10px] text-slate-400">{totals.plannedWeightG} g</p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 divide-y lg:divide-y-0 lg:divide-x divide-slate-200">
        {/* Sélecteur de tronçon / ravitaillement */}
        <div className="lg:col-span-5 divide-y divide-slate-100 max-h-[420px] overflow-y-auto">
          {segments.map((seg, idx) => {
            const caddie = caddies[idx];
            if (!caddie) return null;
            const isSelected = seg.id === activeSegment.id;
            const carbsOk = caddie.plannedCarbsG >= caddie.targetCarbsG * 0.9;
            const sodiumOk = caddie.plannedSodiumMg >= caddie.targetSodiumMg * 0.9;

            return (
              <button
                key={seg.id}
                type="button"
                onClick={() => onSelectSegment(seg.id)}
                className={`w-full text-left px-4 py-3 transition-colors cursor-pointer ${
                  isSelected
                    ? 'bg-[#0F172A] text-white'
                    : 'bg-white hover:bg-[#F8FAFC] text-[#0F172A]'
                }`}
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs font-bold truncate">
                    {idx + 1}. {seg.from.name} &rarr; {seg.to.name}
                  </span>
                  <span
                    className={`font-mono text-[10px] px-1.5 py-0.5 rounded tabular-nums shrink-0 ${
                      isSelected
                        ? 'bg-white/15 text-white'
                        : 'bg-slate-100 text-slate-600'
                    }`}
                  >
                    {caddie.durationHours.toFixed(2)} h
                  </span>
                </div>
                <div className="mt-1.5 flex flex-wrap items-center gap-3 font-mono text-[11px] tabular-nums">
                  <span
                    className={
                      isSelected
                        ? carbsOk
                          ? 'text-[#14C38E]'
                          : 'text-[#FF5A36]'
                        : carbsOk
                        ? 'text-[#047857]'
                        : 'text-slate-600'
                    }
                  >
                    Glu {caddie.plannedCarbsG}/{caddie.targetCarbsG}g (
                    {caddie.deltaCarbsG >= 0 ? `+${caddie.deltaCarbsG}` : caddie.deltaCarbsG}g)
                  </span>
                  <span
                    className={
                      isSelected
                        ? sodiumOk
                          ? 'text-[#14C38E]'
                          : 'text-amber-300'
                        : sodiumOk
                        ? 'text-[#047857]'
                        : 'text-slate-500'
                    }
                  >
                    Na {caddie.plannedSodiumMg}/{caddie.targetSodiumMg}mg (
                    {caddie.deltaSodiumMg >= 0 ? `+${caddie.deltaSodiumMg}` : caddie.deltaSodiumMg}mg)
                  </span>
                </div>
              </button>
            );
          })}
        </div>

        {/* Éditeur du tronçon actif */}
        <div className="lg:col-span-7 p-5 space-y-4">
          <div className="flex flex-wrap items-start justify-between gap-2">
            <div>
              <p className="font-mono text-[10px] uppercase tracking-wider text-slate-400">
                RAVITAILLEMENT / POINT D&apos;ARRIVÉE DU TRONÇON
              </p>
              <h4 className="text-sm font-bold text-[#0F172A] mt-0.5">
                {activeSegment.from.name} &rarr; {activeSegment.to.name}
              </h4>
            </div>
            {activeUnitsCount > 0 && (
              <button
                type="button"
                onClick={() => onUpdateWaypointNutrition(activeSegment.to.id, undefined)}
                className="inline-flex items-center gap-1 px-2.5 py-1 rounded border border-slate-200 text-[11px] font-mono text-slate-600 hover:text-red-600 hover:border-red-300 cursor-pointer"
              >
                <RotateCcw size={11} />
                <span>Vider ce tronçon</span>
              </button>
            )}
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 border border-slate-200 rounded-md p-3 bg-[#F8FAFC] font-mono text-xs tabular-nums">
            <div>
              <span className="block text-[10px] uppercase text-slate-400">Glucides</span>
              <span className="font-bold text-[#0F172A]">
                {activeCaddie.plannedCarbsG} / {activeCaddie.targetCarbsG} g
              </span>
              <span
                className={`block text-[10px] font-semibold ${
                  activeCaddie.deltaCarbsG >= 0 ? 'text-[#047857]' : 'text-[#FF5A36]'
                }`}
              >
                Écart {activeCaddie.deltaCarbsG >= 0 ? `+${activeCaddie.deltaCarbsG}` : activeCaddie.deltaCarbsG} g
              </span>
            </div>
            <div>
              <span className="block text-[10px] uppercase text-slate-400">Sodium</span>
              <span className="font-bold text-[#0F172A]">
                {activeCaddie.plannedSodiumMg} / {activeCaddie.targetSodiumMg} mg
              </span>
              <span
                className={`block text-[10px] font-semibold ${
                  activeCaddie.deltaSodiumMg >= 0 ? 'text-[#047857]' : 'text-[#FF5A36]'
                }`}
              >
                Écart {activeCaddie.deltaSodiumMg >= 0 ? `+${activeCaddie.deltaSodiumMg}` : activeCaddie.deltaSodiumMg} mg
              </span>
            </div>
            <div>
              <span className="block text-[10px] uppercase text-slate-400">Eau boisson</span>
              <span className="font-bold text-[#0F172A]">{activeCaddie.plannedWaterMl} ml</span>
              <span className="block text-[10px] text-slate-400">
                Durée {activeCaddie.durationHours.toFixed(2)} h
              </span>
            </div>
            <div>
              <span className="block text-[10px] uppercase text-slate-400">Masse</span>
              <span className="font-bold text-[#14C38E]">{activeCaddie.plannedWeightG} g</span>
              <span className="block text-[10px] text-slate-400">{activeUnitsCount} unité(s)</span>
            </div>
          </div>

          {/* Filtres marque */}
          <div className="flex flex-wrap gap-1.5">
            <button
              type="button"
              onClick={() => setBrandFilter('all')}
              className={`px-2 py-1 rounded border text-[10px] font-mono tabular-nums cursor-pointer ${
                brandFilter === 'all'
                  ? 'bg-[#0F172A] text-white border-[#0F172A]'
                  : 'bg-[#F8FAFC] text-slate-600 border-slate-200 hover:border-slate-400'
              }`}
            >
              Toutes ({NUTRITION_CATALOG.length})
            </button>
            <button
              type="button"
              onClick={() => setBrandFilter('selected')}
              className={`px-2 py-1 rounded border text-[10px] font-mono tabular-nums cursor-pointer ${
                brandFilter === 'selected'
                  ? 'bg-[#FF5A36] text-white border-[#FF5A36]'
                  : activeUnitsCount > 0
                  ? 'bg-[#14C38E]/10 text-[#0F172A] border-[#14C38E]'
                  : 'bg-[#F8FAFC] text-slate-400 border-slate-200'
              }`}
            >
              Planifiés ({activeUnitsCount})
            </button>
            {allBrandGroups.map(({ brand, products }) => (
              <button
                key={brand.id}
                type="button"
                onClick={() => setBrandFilter(brand.id)}
                className={`px-2 py-1 rounded border text-[10px] font-mono tabular-nums cursor-pointer ${
                  brandFilter === brand.id
                    ? 'bg-[#0F172A] text-white border-[#0F172A]'
                    : 'bg-white text-slate-600 border-slate-200 hover:border-slate-400'
                }`}
              >
                {brand.name} ({products.length})
              </button>
            ))}
          </div>

          {/* Produits du tronçon */}
          <div className="border border-slate-200 rounded-md divide-y divide-slate-200 max-h-[260px] overflow-y-auto bg-white">
            {visibleBrandGroups.length === 0 ? (
              <div className="p-4 text-center text-xs text-slate-500">
                Aucun produit planifié sur ce tronçon.
              </div>
            ) : (
              visibleBrandGroups.map(({ brand, products }) => (
                <div key={brand.id}>
                  <div className="bg-[#F8FAFC] px-3 py-1.5 border-b border-slate-200 flex items-center justify-between">
                    <span className="text-[11px] font-bold uppercase tracking-wider text-[#0F172A]">
                      {brand.name}
                    </span>
                    {brand.tagline && (
                      <span className="text-[10px] text-slate-400">{brand.tagline}</span>
                    )}
                  </div>
                  <div className="divide-y divide-slate-100">
                    {products.map((prod) => {
                      const qty = activePlanned[prod.id] || 0;
                      return (
                        <div
                          key={prod.id}
                          className={`flex items-center justify-between gap-2 px-3 py-2 text-xs ${
                            qty > 0 ? 'border-l-2 border-l-[#14C38E] bg-[#14C38E]/[0.04]' : ''
                          }`}
                        >
                          <div className="min-w-0">
                            <div className="flex items-center gap-1.5">
                              <span className="font-mono text-[10px] uppercase px-1 py-0.5 rounded border border-slate-200 bg-[#F8FAFC] text-slate-600">
                                {NUTRITION_PRODUCT_TYPE_LABELS[prod.type]}
                              </span>
                              <span className="font-semibold text-[#0F172A] truncate">
                                {prod.name}
                              </span>
                            </div>
                            <span className="font-mono text-[10px] text-slate-500 tabular-nums">
                              {prod.carbsG}g glu · {prod.sodiumMg}mg Na · {prod.weightG}g
                            </span>
                          </div>

                          <div className="flex items-center gap-1 shrink-0">
                            <button
                              type="button"
                              onClick={() => setSegmentProductQty(prod.id, qty - 1)}
                              disabled={qty <= 0}
                              aria-label={`Retirer ${prod.name} du tronçon`}
                              className="w-6 h-6 rounded border border-slate-300 bg-white hover:bg-slate-50 disabled:opacity-40 flex items-center justify-center text-[#0F172A] cursor-pointer disabled:cursor-default"
                            >
                              <Minus size={11} />
                            </button>
                            <input
                              type="number"
                              min={0}
                              max={99}
                              aria-label={`Quantité ${prod.name} sur ${activeSegment.to.name}`}
                              value={qty}
                              onChange={(e) =>
                                setSegmentProductQty(prod.id, Number(e.target.value) || 0)
                              }
                              className="w-11 h-6 rounded border border-slate-300 px-1 text-center font-mono font-semibold tabular-nums bg-white text-[#0F172A]"
                            />
                            <button
                              type="button"
                              onClick={() => setSegmentProductQty(prod.id, qty + 1)}
                              aria-label={`Ajouter ${prod.name} au tronçon`}
                              className="w-6 h-6 rounded border border-slate-300 bg-white hover:bg-slate-50 flex items-center justify-center text-[#0F172A] cursor-pointer"
                            >
                              <Plus size={11} />
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </section>
  );
}
