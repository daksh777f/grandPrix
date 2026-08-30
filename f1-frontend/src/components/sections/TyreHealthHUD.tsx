import { motion, AnimatePresence } from 'motion/react';
import { cn } from '@/lib/utils';
import { Activity, AlertTriangle, Disc3 } from 'lucide-react';
import type { LiveAnalysisSample } from '@/lib/api';
import type { TyreLapRecord, TyreIntelligenceData } from '@/lib/tyreApi';

export interface TyreHealthHUDProps {
  sample: LiveAnalysisSample;
  currentLap: number;
  tyreData?: TyreIntelligenceData | null;
  className?: string;
}

export function TyreHealthHUD({
  sample,
  currentLap,
  tyreData,
  className,
}: TyreHealthHUDProps) {
  // Retrieve corresponding per-lap tyre record from lookup or active sample
  const tyreRecord: TyreLapRecord | undefined = tyreData?.lap_lookup?.[currentLap] || 
    tyreData?.records?.find(r => r.lap_number === currentLap);

  const compound = (tyreRecord?.compound || (currentLap <= 40 ? 'HARD' : 'MEDIUM')).toUpperCase();
  const tyreAge = tyreRecord?.tyre_age ?? (currentLap <= 40 ? Math.max(1, currentLap) : Math.max(1, currentLap - 40));
  const stintNumber = tyreRecord?.stint_number ?? (currentLap <= 40 ? 1 : 2);
  
  // Calculate health percentage with physical fallback
  const tyreHealthPct = tyreRecord?.tyre_health_pct ?? Math.max(10, Math.round(100 - (tyreAge * 2.1)));
  
  // Wear rate from sample (shared clock) or tyre record
  const wearRate = sample.tyre_wear_rate ?? tyreRecord?.wear_rate_estimate ?? 0.0535;
  const wearInterval = tyreRecord?.wear_rate_90pct_interval;
  
  // Cliff probability from sample or tyre record
  const cliffProb = sample.cliff_probability ?? tyreRecord?.cliff_probability ?? 0.0;
  
  // Confidence state
  const confidence = tyreRecord?.confidence || (currentLap < 4 ? 'INSUFFICIENT_EVIDENCE' : 'HIGH_CONFIDENCE');
  
  // High tyre alert condition (visually agreeing with the communication gate)
  const isTyreAlert = Boolean(
    sample.tyre_alert_active ||
    cliffProb >= 0.50 ||
    sample.communication?.category === 'TYRE_ALERT'
  );
  
  const isCliffWarning = cliffProb >= 0.20 && !isTyreAlert;

  // Compound pill styling
  const compoundStyle = {
    HARD: 'bg-white/10 text-white border-white/30',
    MEDIUM: 'bg-[#FED100]/10 text-[#FED100] border-[#FED100]/30',
    SOFT: 'bg-brand-red/10 text-brand-red border-brand-red/30',
  }[compound] || 'bg-chrome/10 text-chrome/70 border-chrome/20';

  // Dynamic bar color mapping
  const getHealthBarColor = (pct: number, alert: boolean) => {
    if (alert) return 'bg-brand-red shadow-[0_0_8px_rgba(225,6,0,0.6)]';
    if (pct > 70) return 'bg-emerald-400';
    if (pct > 40) return 'bg-accent-amber';
    return 'bg-brand-red';
  };

  return (
    <div
      className={cn(
        'w-full bg-[#08090C]/95 backdrop-blur-md border-t border-chrome/10 py-2 px-3 sm:px-6 transition-colors duration-300 select-none',
        isTyreAlert && 'border-brand-red/30 bg-brand-red/[0.04]',
        className
      )}
    >
      <div className="max-w-7xl mx-auto flex flex-wrap items-center justify-between gap-y-2 gap-x-4">
        {/* LEFT: Compound & Stint Age */}
        <div className="flex items-center gap-2.5">
          <div className="flex items-center gap-1.5 font-mono text-[9px] text-chrome/50 uppercase tracking-[0.2em]">
            <Disc3 className="w-3.5 h-3.5 text-chrome/60 animate-spin-slow" />
            <span className="hidden sm:inline">TYRE</span>
          </div>

          <div
            className={cn(
              'font-mono text-[10px] font-bold px-2 py-0.5 rounded-sm border uppercase tracking-wider',
              compoundStyle
            )}
          >
            {compound}
          </div>

          <div className="font-mono text-[10px] text-chrome/80 tracking-wide">
            <span className="text-ink font-semibold">L{tyreAge}</span>
            <span className="text-chrome/40 text-[9px] ml-1">STINT {stintNumber}</span>
          </div>
        </div>

        {/* CENTER-LEFT: Latent Tyre Health Bar */}
        <div className="flex items-center gap-3">
          <div className="flex flex-col gap-0.5">
            <div className="flex justify-between items-center w-24 sm:w-32 md:w-44 font-mono text-[8px] text-chrome/50 uppercase tracking-widest">
              <span>HEALTH</span>
              <span
                className={cn(
                  'font-bold font-numeric text-[11px]',
                  isTyreAlert ? 'text-brand-red' : tyreHealthPct > 60 ? 'text-ink' : 'text-accent-amber'
                )}
              >
                {Math.round(tyreHealthPct)}%
              </span>
            </div>

            {/* Visual Health Gauge */}
            <div className="w-24 sm:w-32 md:w-44 h-1.5 rounded-full bg-white/5 border border-white/10 overflow-hidden relative">
              <motion.div
                className={cn('h-full rounded-full transition-all duration-200', getHealthBarColor(tyreHealthPct, isTyreAlert))}
                style={{ width: `${Math.min(100, Math.max(4, tyreHealthPct))}%` }}
                layout
              />
            </div>
          </div>
        </div>

        {/* CENTER-RIGHT: Latent Degradation Rate */}
        <div className="flex items-center gap-2">
          <div className="flex flex-col">
            <div className="font-mono text-[8px] text-chrome/50 uppercase tracking-widest flex items-center gap-1">
              <Activity className="w-2.5 h-2.5 text-chrome/40" />
              <span>WEAR RATE</span>
            </div>
            <div className="flex items-baseline gap-1">
              <span className="font-numeric text-base sm:text-lg font-bold text-ink leading-tight">
                {wearRate > 0 ? `+${wearRate.toFixed(3)}` : wearRate.toFixed(3)}
              </span>
              <span className="font-mono text-[9px] text-chrome/40">s/lap</span>
              {wearInterval && (
                <span className="hidden lg:inline font-mono text-[8px] text-chrome/40 ml-1">
                  [{wearInterval[0].toFixed(3)}..{wearInterval[1].toFixed(3)}]
                </span>
              )}
            </div>
          </div>
        </div>

        {/* RIGHT: Cliff Risk Indicator & Communication Gate Sync */}
        <div className="flex items-center gap-3 ml-auto sm:ml-0">
          <AnimatePresence mode="wait">
            {isTyreAlert && (
              <motion.div
                key="tyre-alert"
                initial={{ opacity: 0, scale: 0.9, x: 10 }}
                animate={{ opacity: 1, scale: 1, x: 0 }}
                exit={{ opacity: 0, scale: 0.9, x: 10 }}
                className="flex items-center gap-1.5 px-2.5 py-1 rounded-sm border border-brand-red/40 bg-brand-red/15 text-brand-red font-mono text-[9px] font-bold tracking-widest uppercase shadow-[0_0_12px_rgba(225,6,0,0.3)] animate-pulse"
              >
                <AlertTriangle className="w-3 h-3 text-brand-red" />
                <span>TYRE ALERT: CLIFF IMMINENT</span>
              </motion.div>
            )}

            {!isTyreAlert && isCliffWarning && (
              <motion.div
                key="cliff-warning"
                initial={{ opacity: 0, scale: 0.9, x: 10 }}
                animate={{ opacity: 1, scale: 1, x: 0 }}
                exit={{ opacity: 0, scale: 0.9, x: 10 }}
                className="flex items-center gap-1.5 px-2 py-0.5 rounded-sm border border-accent-amber/30 bg-accent-amber/10 text-accent-amber font-mono text-[9px] font-semibold tracking-widest uppercase"
              >
                <span>CLIFF RISK: {(cliffProb * 100).toFixed(0)}%</span>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Bayesian Confidence Pill */}
          <div className="hidden sm:flex items-center gap-1.5 font-mono text-[8px] text-chrome/50 uppercase tracking-widest border border-white/5 bg-white/[0.02] px-2 py-1 rounded-sm">
            <span
              className={cn(
                'w-1.5 h-1.5 rounded-full',
                confidence === 'HIGH_CONFIDENCE'
                  ? 'bg-emerald-400'
                  : confidence === 'LOW_CONFIDENCE'
                  ? 'bg-accent-amber'
                  : 'bg-chrome/40'
              )}
            />
            <span>
              {confidence === 'HIGH_CONFIDENCE'
                ? 'HIGH CONF'
                : confidence === 'LOW_CONFIDENCE'
                ? 'LOW CONF'
                : 'INIT STATE'}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
