import { useState, useEffect } from 'react';
import { motion } from 'motion/react';
import { cn } from '@/lib/utils';
import { Sliders, Compass, ShieldCheck, Flame, ArrowRight, RefreshCcw } from 'lucide-react';
import { fetchTyreStrategy, type TyreStrategyData } from '@/lib/tyreApi';

export interface StrategySimulatorSectionProps {
  sessionKey: number;
  driverNumber: number;
  className?: string;
}

export function StrategySimulatorSection({
  sessionKey,
  driverNumber,
  className,
}: StrategySimulatorSectionProps) {
  const [selectedLap, setSelectedLap] = useState<number>(38);
  const [strategyData, setStrategyData] = useState<TyreStrategyData | null>(null);
  const [loading, setLoading] = useState<boolean>(false);

  useEffect(() => {
    let cancelled = false;
    async function loadStrategy() {
      try {
        setLoading(true);
        const data = await fetchTyreStrategy(sessionKey, driverNumber, selectedLap);
        if (!cancelled) {
          setStrategyData(data);
        }
      } catch (err) {
        console.error('Failed to fetch strategy', err);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    loadStrategy();
    return () => {
      cancelled = true;
    };
  }, [sessionKey, driverNumber, selectedLap]);

  const scenarios = strategyData?.scenarios || [];

  // Strategy risk badge styling
  const getRiskTheme = (risk: 'LOW' | 'MEDIUM' | 'HIGH') => {
    switch (risk) {
      case 'LOW':
        return {
          icon: ShieldCheck,
          badge: 'bg-emerald-400/10 text-emerald-400 border-emerald-400/25',
          card: 'border-white/10 hover:border-emerald-400/30',
          accent: 'text-emerald-400',
        };
      case 'MEDIUM':
        return {
          icon: Compass,
          badge: 'bg-accent-amber/10 text-accent-amber border-accent-amber/25',
          card: 'border-accent-amber/30 bg-accent-amber/[0.02]',
          accent: 'text-accent-amber',
        };
      case 'HIGH':
        return {
          icon: Flame,
          badge: 'bg-brand-red/10 text-brand-red border-brand-red/25',
          card: 'border-white/10 hover:border-brand-red/30',
          accent: 'text-brand-red',
        };
    }
  };

  return (
    <div className={cn('w-full flex flex-col gap-5 bg-[#090A0E] border border-chrome/10 rounded-sm p-4 sm:p-6', className)}>
      {/* Section Header & Slider Controls */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-white/[0.06] pb-4">
        <div className="flex flex-col">
          <div className="flex items-center gap-2">
            <span className="font-display font-bold text-lg sm:text-xl text-ink uppercase tracking-wide">
              Live Monte Carlo Pit Strategy Simulator
            </span>
            <span className="font-mono text-[9px] uppercase px-2 py-0.5 rounded-sm bg-accent-amber/10 text-accent-amber border border-accent-amber/25">
              Probabilistic Optimization
            </span>
          </div>
          <span className="font-mono text-[10px] text-chrome/50 uppercase tracking-widest mt-0.5">
            Simulates Conservative, Nominal, and Overcut/Undercut extensions using real wear uncertainty
          </span>
        </div>

        {/* Interactive Lap Slider Control */}
        <div className="flex items-center gap-3 bg-[#121419] border border-white/10 px-4 py-2 rounded-sm">
          <Sliders className="w-4 h-4 text-accent-amber shrink-0" />
          <div className="flex flex-col gap-1">
            <div className="flex justify-between items-center font-mono text-[9px] text-chrome/60 uppercase gap-2">
              <div className="flex items-center gap-1.5">
                <span>Decision Lap:</span>
                {loading && <RefreshCcw className="w-2.5 h-2.5 animate-spin text-accent-amber" />}
              </div>
              <strong className="text-ink font-numeric text-sm">Lap {selectedLap}</strong>
            </div>
            <input
              type="range"
              min={1}
              max={60}
              value={selectedLap}
              onChange={(e) => setSelectedLap(Number(e.target.value))}
              className="w-32 sm:w-44 accent-brand-red h-1 bg-white/10 rounded-lg cursor-pointer"
            />
          </div>
        </div>
      </div>

      {/* Current Model Status Bar */}
      {strategyData && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 font-mono text-[9px] bg-white/[0.02] p-3 rounded-xs border border-white/[0.04]">
          <div className="flex flex-col">
            <span className="text-chrome/40 uppercase">Current Stint Tyre Age</span>
            <span className="font-numeric text-sm text-ink font-bold mt-0.5">
              L{strategyData.current_tyre_age} ({strategyData.current_compound})
            </span>
          </div>
          <div className="flex flex-col">
            <span className="text-chrome/40 uppercase">Current Wear Rate</span>
            <span className="font-numeric text-sm text-accent-amber font-bold mt-0.5">
              +{strategyData.current_wear_rate.toFixed(3)} s/lap
            </span>
          </div>
          <div className="flex flex-col">
            <span className="text-chrome/40 uppercase">Cliff Probability</span>
            <span className={cn('font-numeric text-sm font-bold mt-0.5', strategyData.cliff_probability > 0.5 ? 'text-brand-red' : 'text-ink')}>
              {(strategyData.cliff_probability * 100).toFixed(0)}%
            </span>
          </div>
          <div className="flex flex-col">
            <span className="text-chrome/40 uppercase">Model State Confidence</span>
            <span className="font-numeric text-sm text-emerald-400 font-bold mt-0.5">
              {strategyData.strategy_confidence}
            </span>
          </div>
        </div>
      )}

      {/* 3 Strategy Scenario Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {scenarios.map((scenario) => {
          const theme = getRiskTheme(scenario.risk_label);
          const Icon = theme.icon;
          const isRecommended = scenario.name === 'Nominal' || (strategyData && strategyData.cliff_probability > 0.6 && scenario.name === 'Conservative');

          return (
            <motion.div
              key={scenario.name}
              initial={{ opacity: 0, scale: 0.98 }}
              animate={{ opacity: 1, scale: 1 }}
              className={cn(
                'bg-[#0E1015] border rounded-sm p-4 sm:p-5 flex flex-col justify-between transition-all duration-200 relative',
                theme.card,
                isRecommended && 'ring-1 ring-accent-amber/40 shadow-[0_0_20px_rgba(217,142,74,0.06)]'
              )}
            >
              {/* Header */}
              <div>
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <Icon className={cn('w-4 h-4', theme.accent)} />
                    <span className="font-display font-bold text-base text-ink uppercase">
                      {scenario.name}
                    </span>
                  </div>

                  <span
                    className={cn(
                      'font-mono text-[8px] font-bold uppercase tracking-widest px-2 py-0.5 rounded-sm border',
                      theme.badge
                    )}
                  >
                    {scenario.risk_label} Risk
                  </span>
                </div>

                {/* Pit Window Decision */}
                <div className="bg-[#08090C] border border-white/[0.04] p-3 rounded-xs flex items-center justify-between mb-3 font-mono text-[10px]">
                  <div className="flex flex-col">
                    <span className="text-chrome/40 text-[8px] uppercase">Box Window</span>
                    <span className="font-numeric text-base font-bold text-ink">
                      Lap {scenario.pit_lap}
                    </span>
                  </div>

                  <ArrowRight className="w-3.5 h-3.5 text-chrome/30" />

                  <div className="flex flex-col items-end">
                    <span className="text-chrome/40 text-[8px] uppercase">Fit Compound</span>
                    <span className="font-bold text-ink">{scenario.new_compound}</span>
                  </div>
                </div>

                {/* Delta Output */}
                <div className="flex flex-col gap-1 my-3">
                  <span className="font-mono text-[8px] text-chrome/40 uppercase tracking-widest">
                    Net Race Time Delta (vs Nominal Baseline)
                  </span>
                  <div className="flex items-baseline gap-1.5">
                    <span
                      className={cn(
                        'font-numeric text-2xl font-bold leading-tight',
                        scenario.predicted_total_time_delta < 0
                          ? 'text-emerald-400'
                          : scenario.predicted_total_time_delta === 0
                          ? 'text-ink'
                          : 'text-brand-red'
                      )}
                    >
                      {scenario.predicted_total_time_delta > 0
                        ? `+${scenario.predicted_total_time_delta.toFixed(2)}`
                        : scenario.predicted_total_time_delta.toFixed(2)}s
                    </span>
                    <span className="font-mono text-[9px] text-chrome/40">
                      [{scenario.predicted_delta_range_90pct[0].toFixed(1)}s .. {scenario.predicted_delta_range_90pct[1].toFixed(1)}s]
                    </span>
                  </div>
                </div>

                {/* Scenario Strategy Narrative */}
                <p className="font-mono text-[9px] text-chrome/60 leading-relaxed mt-2">
                  {scenario.description}
                </p>
              </div>

              {/* Recommendation Footer */}
              <div className="mt-4 pt-3 border-t border-white/[0.04] flex items-center justify-between font-mono text-[8px]">
                <span className="text-chrome/40">
                  Cliff Exposure: {scenario.cliff_exposure_laps} Laps
                </span>
                {isRecommended && (
                  <span className="text-accent-amber font-semibold uppercase tracking-wider">
                    ★ Model Recommendation
                  </span>
                )}
              </div>
            </motion.div>
          );
        })}
      </div>
    </div>
  );
}

export default StrategySimulatorSection;
