import { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { RefreshCcw, Disc3, ShieldAlert } from 'lucide-react';
import { fetchGrid, type Driver } from '@/lib/api';
import {
  fetchTyreIntelligence,
  fetchTyreCounterfactual,
  fetchTyreValidation,
  type TyreIntelligenceData,
  type TyreCounterfactualData,
  type TyreValidationData,
} from '@/lib/tyreApi';
import { CompoundDNAStrip } from '@/components/sections/CompoundDNAStrip';
import { TyreDegradationCurve } from '@/components/sections/TyreDegradationCurve';
import { CounterfactualCardsSection } from '@/components/sections/CounterfactualCardsSection';
import { ValidationScorecardSection } from '@/components/sections/ValidationScorecardSection';
import { StrategySimulatorSection } from '@/components/sections/StrategySimulatorSection';

export function TyrePage() {
  const [searchParams] = useSearchParams();
  const sessionKey = Number(searchParams.get('session')) || 9165;
  const initialDriver = Number(searchParams.get('driver')) || 1;

  const [drivers, setDrivers] = useState<Driver[]>([]);
  const [selectedDriver, setSelectedDriver] = useState<number>(initialDriver);
  const [selectedCompound, setSelectedCompound] = useState<string | null>(null);

  const [tyreData, setTyreData] = useState<TyreIntelligenceData | null>(null);
  const [counterfactualData, setCounterfactualData] = useState<TyreCounterfactualData | null>(null);
  const [validationData, setValidationData] = useState<TyreValidationData | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  // Load grid drivers
  useEffect(() => {
    fetchGrid()
      .then(setDrivers)
      .catch((err) => console.warn('Failed to load drivers grid', err));
  }, []);

  // Fetch full TDI data streams on driver change
  useEffect(() => {
    let cancelled = false;
    async function loadAllTyreIntelligence() {
      try {
        setLoading(true);
        setError(null);

        const [intelligence, counterfactuals, validation] = await Promise.all([
          fetchTyreIntelligence(sessionKey, selectedDriver),
          fetchTyreCounterfactual(sessionKey, selectedDriver),
          fetchTyreValidation(sessionKey, selectedDriver),
        ]);

        if (!cancelled) {
          setTyreData(intelligence);
          setCounterfactualData(counterfactuals);
          setValidationData(validation);
        }
      } catch (err) {
        console.error('Failed to load tyre intelligence', err);
        if (!cancelled) {
          setError('Tyre degradation data is currently unavailable for this driver.');
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    loadAllTyreIntelligence();
    return () => {
      cancelled = true;
    };
  }, [sessionKey, selectedDriver]);

  const activeDriverMeta = drivers.find((d) => d.driver_number === selectedDriver);

  return (
    <div className="min-h-screen bg-[#07080B] text-ink font-body pt-24 pb-20 px-4 sm:px-6 lg:px-8 selection:bg-brand-red/30">
      <div className="max-w-7xl mx-auto flex flex-col gap-10">
        {/* 1. EDITORIAL PAGE HEADER */}
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 border-b border-chrome/10 pb-6">
          <div className="flex flex-col gap-2">
            <div className="flex items-center gap-2 font-mono text-[10px] uppercase tracking-[0.25em] text-chrome/50">
              <Disc3 className="w-3.5 h-3.5 text-brand-red animate-spin-slow" />
              <span>Singapore GP 2023 · Marina Bay Circuit · Session {sessionKey}</span>
              {activeDriverMeta && (
                <>
                  <span className="text-chrome/30">·</span>
                  <span className="text-accent-amber">{activeDriverMeta.full_name} ({activeDriverMeta.team_name})</span>
                </>
              )}
            </div>

            <h1 className="font-display font-bold text-3xl sm:text-4xl lg:text-5xl text-ink uppercase tracking-tight">
              Tyre Degradation <span className="text-brand-red">Intelligence</span>
            </h1>

            <p className="font-mono text-xs sm:text-sm text-chrome/70 max-w-2xl leading-relaxed">
              Post-race causal decomposition & Bayesian latent state estimation. Isolates pure tyre wear from fuel burn and track grip evolution to expose hidden cliff dynamics.
            </p>
          </div>

          {/* Driver Selector Pills */}
          <div className="flex flex-col items-start md:items-end gap-2">
            <span className="font-mono text-[9px] text-chrome/40 uppercase tracking-widest">
              Select Telemetry Stream
            </span>
            <div className="flex flex-wrap items-center gap-1.5">
              {(drivers.length > 0 ? drivers.map((d) => d.driver_number) : [1, 55, 4, 44, 16, 63]).map((num) => {
                const isSelected = selectedDriver === num;
                const dMeta = drivers.find((d) => d.driver_number === num);
                const code = dMeta?.name_acronym || `#${num}`;

                return (
                  <button
                    key={num}
                    onClick={() => setSelectedDriver(num)}
                    className={`font-mono text-[10px] uppercase font-bold px-3 py-1.5 rounded-sm border transition-all cursor-pointer ${
                      isSelected
                        ? 'bg-brand-red/15 text-ink border-brand-red/50 shadow-[0_0_12px_rgba(225,6,0,0.25)]'
                        : 'bg-white/[0.03] text-chrome/60 border-chrome/10 hover:border-chrome/30 hover:text-ink'
                    }`}
                  >
                    {code} ({num})
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        {/* Loading / Error States */}
        {loading && (
          <div className="w-full py-20 flex flex-col items-center justify-center gap-3 font-mono text-xs uppercase tracking-widest text-chrome/50">
            <RefreshCcw className="w-6 h-6 animate-spin text-brand-red" />
            <span>Assembling Causal Decomposition & Kalman State Filter...</span>
          </div>
        )}

        {error && !loading && (
          <div className="w-full p-6 bg-brand-red/10 border border-brand-red/30 rounded-sm font-mono text-xs text-brand-red flex items-center gap-3">
            <ShieldAlert className="w-5 h-5 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {/* DATA LOADED CONTENT */}
        {!loading && tyreData && (
          <div className="flex flex-col gap-10">
            {/* 2. COMPOUND DNA STRIP */}
            <CompoundDNAStrip
              stints={tyreData.stints}
              records={tyreData.records}
              selectedCompound={selectedCompound}
              onSelectCompound={setSelectedCompound}
            />

            {/* 3. MAIN DEGRADATION CURVE & TOOLTIP */}
            <TyreDegradationCurve
              records={tyreData.records}
              selectedCompound={selectedCompound}
            />

            {/* 4. COUNTERFACTUAL LAP CARDS */}
            {counterfactualData && (
              <CounterfactualCardsSection
                cards={counterfactualData.interesting_laps}
                selectedCompound={selectedCompound}
              />
            )}

            {/* 5. POST-RACE VALIDATION SCORECARD */}
            <ValidationScorecardSection validationData={validationData} />

            {/* 6. STRATEGY SIMULATOR */}
            <StrategySimulatorSection
              sessionKey={sessionKey}
              driverNumber={selectedDriver}
            />
          </div>
        )}
      </div>
    </div>
  );
}

export default TyrePage;
