import { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { cn } from '@/lib/utils';
import { AlertTriangle, Sparkles } from 'lucide-react';
import type { TyreLapRecord } from '@/lib/tyreApi';

export interface TyreDegradationCurveProps {
  records: TyreLapRecord[];
  selectedCompound: string | null;
  className?: string;
}

export function TyreDegradationCurve({
  records,
  selectedCompound,
  className,
}: TyreDegradationCurveProps) {
  const [hoveredLap, setHoveredLap] = useState<TyreLapRecord | null>(null);

  // Filter records by compound if selected, keeping sorted by lap_number
  const filteredRecords = (records || [])
    .filter((r) => !selectedCompound || r.compound.toUpperCase() === selectedCompound.toUpperCase())
    .sort((a, b) => a.lap_number - b.lap_number);

  if (filteredRecords.length === 0) {
    return (
      <div className="w-full bg-[#0D0E12] border border-chrome/10 p-8 rounded-sm text-center font-mono text-xs text-chrome/50">
        No representative telemetry laps available for this filter.
      </div>
    );
  }

  // Dimensions for responsive SVG coordinate mapping
  const width = 960;
  const height = 340;
  const padding = { top: 30, right: 30, bottom: 45, left: 55 };

  const plotWidth = width - padding.left - padding.right;
  const plotHeight = height - padding.top - padding.bottom;

  const minLap = Math.min(...filteredRecords.map((r) => r.lap_number));
  const maxLap = Math.max(...filteredRecords.map((r) => r.lap_number));

  const getWear = (r: TyreLapRecord) => {
    if (typeof r.tyre_wear_effect === 'number' && !isNaN(r.tyre_wear_effect)) {
      return r.tyre_wear_effect;
    }
    if (typeof r.cumulative_wear_estimate === 'number' && !isNaN(r.cumulative_wear_estimate)) {
      return r.cumulative_wear_estimate;
    }
    return 0;
  };

  const wearValues = filteredRecords.map(getWear).filter((v) => typeof v === 'number' && !isNaN(v));
  const maxWear = wearValues.length > 0 ? Math.max(2.5, ...wearValues) : 2.5;

  const getX = (lap: number) => {
    if (maxLap === minLap || isNaN(lap)) return padding.left + plotWidth / 2;
    return padding.left + ((lap - minLap) / (maxLap - minLap)) * plotWidth;
  };

  const getY = (wearSec: number) => {
    const validWear = typeof wearSec === 'number' && !isNaN(wearSec) ? wearSec : 0;
    const clamped = Math.max(0, Math.min(maxWear * 1.15, validWear));
    return padding.top + plotHeight - (clamped / (maxWear * 1.15)) * plotHeight;
  };

  // Find detected cliff onset laps
  const cliffLaps = filteredRecords.filter((r) => r.cliff_detected || (r.cliff_probability >= 0.5 && r.cliff_onset_lap === r.lap_number));

  // Construct SVG paths for latent wear line and 90% confidence uncertainty ribbon
  const linePoints = filteredRecords.map((r) => {
    const wear = typeof r.cumulative_wear_estimate === 'number' && !isNaN(r.cumulative_wear_estimate) ? r.cumulative_wear_estimate : getWear(r);
    return `${getX(r.lap_number).toFixed(1)},${getY(wear).toFixed(1)}`;
  });
  const latentLinePath = linePoints.length > 0 ? `M ${linePoints.join(' L ')}` : '';

  // 90% uncertainty polygon band (upper and lower bounds)
  const upperPoints = filteredRecords.map((r) => {
    const baseWear = typeof r.cumulative_wear_estimate === 'number' && !isNaN(r.cumulative_wear_estimate) ? r.cumulative_wear_estimate : getWear(r);
    const upperWear = baseWear + Math.max(0.04, (r.wear_rate_90pct_interval && typeof r.wear_rate_90pct_interval[1] === 'number' && typeof r.wear_rate_estimate === 'number' ? (r.wear_rate_90pct_interval[1] - r.wear_rate_estimate) * (r.tyre_age || 1) : 0.08));
    return `${getX(r.lap_number).toFixed(1)},${getY(upperWear).toFixed(1)}`;
  });

  const lowerPoints = [...filteredRecords].reverse().map((r) => {
    const baseWear = typeof r.cumulative_wear_estimate === 'number' && !isNaN(r.cumulative_wear_estimate) ? r.cumulative_wear_estimate : getWear(r);
    const lowerWear = Math.max(0, baseWear - Math.max(0.04, (r.wear_rate_90pct_interval && typeof r.wear_rate_90pct_interval[0] === 'number' && typeof r.wear_rate_estimate === 'number' ? (r.wear_rate_estimate - r.wear_rate_90pct_interval[0]) * (r.tyre_age || 1) : 0.08)));
    return `${getX(r.lap_number).toFixed(1)},${getY(lowerWear).toFixed(1)}`;
  });

  const uncertaintyBandPath = upperPoints.length > 0 ? `M ${upperPoints.join(' L ')} L ${lowerPoints.join(' L ')} Z` : '';

  // Grid ticks
  const yTicks = [0, 0.5, 1.0, 1.5, 2.0, 2.5].filter((v) => v <= maxWear * 1.1);
  const xTicks = [1, 10, 20, 30, 40, 50, 60].filter((v) => v >= minLap && v <= maxLap);

  const activeLapData = hoveredLap || filteredRecords[Math.floor(filteredRecords.length / 2)];

  return (
    <div className={cn('w-full flex flex-col gap-4 bg-[#0B0C10] border border-chrome/10 rounded-sm p-4 sm:p-6 relative', className)}>
      {/* Header with Title & Live Readout Switcher */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-white/[0.06] pb-4">
        <div className="flex flex-col">
          <div className="flex items-center gap-2">
            <span className="font-display font-bold text-lg sm:text-xl text-ink uppercase tracking-wide">
              Causal Degradation Curve & Latent Tyre State
            </span>
            <span className="font-mono text-[9px] uppercase px-2 py-0.5 rounded-sm bg-accent-teal/15 text-accent-teal border border-accent-teal/30">
              Bayesian Filter
            </span>
          </div>
          <span className="font-mono text-[10px] text-chrome/50 uppercase tracking-widest mt-0.5">
            Isolated physical tyre loss with 90% credible uncertainty band
          </span>
        </div>

        {/* Legend */}
        <div className="flex items-center gap-4 font-mono text-[9px] uppercase text-chrome/60 tracking-wider">
          <div className="flex items-center gap-1.5">
            <div className="w-3 h-0.5 bg-accent-amber" />
            <span>Latent State</span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="w-3 h-2 bg-accent-amber/15 border border-accent-amber/30 rounded-xs" />
            <span>90% Credible Band</span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="w-2 h-2 rounded-full bg-brand-red" />
            <span>Cliff Onset</span>
          </div>
        </div>
      </div>

      {/* Main SVG Plot Viewport */}
      <div className="relative w-full aspect-[16/7] min-h-[260px] max-h-[380px] select-none">
        <svg
          viewBox={`0 0 ${width} ${height}`}
          className="w-full h-full overflow-visible"
          onMouseLeave={() => setHoveredLap(null)}
        >
          <defs>
            {/* Grid line pattern */}
            <linearGradient id="curveGradient" x1="0" y1="0" x2="1" y2="0">
              <stop offset="0%" stopColor="#D98E4A" />
              <stop offset="70%" stopColor="#FED100" />
              <stop offset="100%" stopColor="#E10600" />
            </linearGradient>

            <linearGradient id="bandGradient" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#D98E4A" stopOpacity="0.22" />
              <stop offset="100%" stopColor="#D98E4A" stopOpacity="0.04" />
            </linearGradient>
          </defs>

          {/* Horizontal grid lines & Y labels */}
          {yTicks.map((tick) => {
            const y = getY(tick);
            return (
              <g key={`y-${tick}`}>
                <line
                  x1={padding.left}
                  y1={y}
                  x2={width - padding.right}
                  y2={y}
                  stroke="rgba(255, 255, 255, 0.05)"
                  strokeDasharray="4 4"
                />
                <text
                  x={padding.left - 8}
                  y={y + 3}
                  textAnchor="end"
                  fill="rgba(201, 205, 211, 0.4)"
                  fontSize="9"
                  fontFamily="JetBrains Mono, monospace"
                >
                  +{tick.toFixed(1)}s
                </text>
              </g>
            );
          })}

          {/* Vertical grid lines & X labels */}
          {xTicks.map((lap) => {
            const x = getX(lap);
            return (
              <g key={`x-${lap}`}>
                <line
                  x1={x}
                  y1={padding.top}
                  x2={x}
                  y2={height - padding.bottom}
                  stroke="rgba(255, 255, 255, 0.05)"
                />
                <text
                  x={x}
                  y={height - padding.bottom + 16}
                  textAnchor="middle"
                  fill="rgba(201, 205, 211, 0.4)"
                  fontSize="9"
                  fontFamily="JetBrains Mono, monospace"
                >
                  L{lap}
                </text>
              </g>
            );
          })}

          {/* Shaded 90% uncertainty polygon */}
          {uncertaintyBandPath && <path d={uncertaintyBandPath} fill="url(#bandGradient)" />}

          {/* Latent wear trajectory curve */}
          {latentLinePath && (
            <path
              d={latentLinePath}
              fill="none"
              stroke="url(#curveGradient)"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          )}

          {/* Cliff Markers */}
          {cliffLaps.map((cliff) => {
            const cx = getX(cliff.lap_number);
            const cy = getY(cliff.cumulative_wear_estimate ?? getWear(cliff));
            return (
              <g key={`cliff-${cliff.lap_number}`}>
                <line
                  x1={cx}
                  y1={padding.top}
                  x2={cx}
                  y2={height - padding.bottom}
                  stroke="#E10600"
                  strokeWidth="1.5"
                  strokeDasharray="3 3"
                />
                <circle cx={cx} cy={cy} r="4.5" fill="#E10600" />
                <circle cx={cx} cy={cy} r="9" fill="none" stroke="#E10600" strokeWidth="1" opacity="0.6" className="animate-ping" />
              </g>
            );
          })}

          {/* Scatter Data Points & Hover Targets */}
          {filteredRecords.map((record) => {
            const cx = getX(record.lap_number);
            const cy = getY(getWear(record));
            const isHovered = hoveredLap?.lap_number === record.lap_number;

            return (
              <g
                key={record.lap_number}
                className="cursor-pointer"
                onMouseEnter={() => setHoveredLap(record)}
                onClick={() => setHoveredLap(record)}
              >
                {/* Invisible larger hover hit area */}
                <circle cx={cx} cy={cy} r="14" fill="transparent" />

                {/* Visible Data Dot */}
                <circle
                  cx={cx}
                  cy={cy}
                  r={isHovered ? 5.5 : record.is_representative ? 3 : 2}
                  fill={isHovered ? '#FFFFFF' : record.is_representative ? '#D98E4A' : '#555860'}
                  stroke={isHovered ? '#D98E4A' : 'transparent'}
                  strokeWidth="2"
                  className="transition-all duration-150"
                />
              </g>
            );
          })}

          {/* Hover Crosshair */}
          {hoveredLap && (
            <g>
              <line
                x1={getX(hoveredLap.lap_number)}
                y1={padding.top}
                x2={getX(hoveredLap.lap_number)}
                y2={height - padding.bottom}
                stroke="#FFFFFF"
                strokeWidth="1"
                strokeDasharray="2 2"
                opacity="0.4"
              />
            </g>
          )}
        </svg>
      </div>

      {/* Interactive Decomposition Breakdown Drawer */}
      <AnimatePresence mode="wait">
        {activeLapData && (
          <motion.div
            key={activeLapData.lap_number}
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 6 }}
            className="w-full bg-[#121419] border border-chrome/15 p-4 rounded-sm flex flex-col gap-3"
          >
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-white/[0.05] pb-2">
              <div className="flex items-center gap-2">
                <span className="font-mono text-xs font-bold text-ink bg-white/10 px-2 py-0.5 rounded-sm">
                  LAP {activeLapData.lap_number}
                </span>
                <span className="font-mono text-[10px] text-chrome/60 uppercase">
                  {activeLapData.compound} · STINT {activeLapData.stint_number} (AGE: L{activeLapData.tyre_age})
                </span>
                {activeLapData.cliff_detected && (
                  <span className="font-mono text-[9px] font-bold text-brand-red bg-brand-red/15 border border-brand-red/30 px-2 py-0.5 rounded-sm flex items-center gap-1">
                    <AlertTriangle className="w-3 h-3" />
                    CLIFF ONSET
                  </span>
                )}
              </div>

              <div className="flex items-center gap-4 font-mono text-[10px]">
                <span className="text-chrome/50">
                  Observed Time: <strong className="text-ink font-numeric text-sm">{(activeLapData.observed_lap_time ?? 0).toFixed(3)}s</strong>
                </span>
                <span className="text-emerald-400 font-semibold flex items-center gap-1">
                  <Sparkles className="w-3 h-3" />
                  Saved on Fresh: +{(activeLapData.tyre_wear_effect ?? activeLapData.cumulative_wear_estimate ?? 0).toFixed(3)}s
                </span>
              </div>
            </div>

            {/* Decomposition Waterfall Components Grid */}
            <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 font-mono text-[9px]">
              <div className="bg-[#090A0D] p-2 rounded-xs border border-white/[0.04] flex flex-col">
                <span className="text-chrome/40 uppercase">1. Base Pace</span>
                <span className="font-numeric text-sm font-bold text-ink mt-0.5">
                  {(activeLapData.base_pace ?? 0).toFixed(3)}s
                </span>
                <span className="text-[8px] text-chrome/30">Circuit Baseline</span>
              </div>

              <div className="bg-[#090A0D] p-2 rounded-xs border border-white/[0.04] flex flex-col">
                <span className="text-chrome/40 uppercase">2. Fuel Correction</span>
                <span className="font-numeric text-sm font-bold text-accent-amber mt-0.5">
                  +{(activeLapData.fuel_effect ?? 0).toFixed(3)}s
                </span>
                <span className="text-[8px] text-chrome/30">Mass penalty</span>
              </div>

              <div className="bg-[#090A0D] p-2 rounded-xs border border-white/[0.04] flex flex-col">
                <span className="text-chrome/40 uppercase">3. Track Evolution</span>
                <span className="font-numeric text-sm font-bold text-accent-teal mt-0.5">
                  {(activeLapData.track_evolution_effect ?? 0).toFixed(3)}s
                </span>
                <span className="text-[8px] text-chrome/30">Grip buildup</span>
              </div>

              <div className="bg-[#090A0D] p-2 rounded-xs border border-accent-amber/30 bg-accent-amber/[0.03] flex flex-col">
                <span className="text-accent-amber uppercase font-semibold">4. Tyre Wear</span>
                <span className="font-numeric text-sm font-bold text-accent-amber mt-0.5">
                  +{((activeLapData.tyre_wear_effect ?? activeLapData.cumulative_wear_estimate) ?? 0).toFixed(3)}s
                </span>
                <span className="text-[8px] text-accent-amber/70">Pure degradation</span>
              </div>

              <div className="bg-[#090A0D] p-2 rounded-xs border border-white/[0.04] flex flex-col">
                <span className="text-chrome/40 uppercase">5. Residual Noise</span>
                <span className="font-numeric text-sm font-bold text-chrome/70 mt-0.5">
                  {(activeLapData.residual_noise ?? 0) > 0 ? `+${(activeLapData.residual_noise ?? 0).toFixed(3)}` : (activeLapData.residual_noise ?? 0).toFixed(3)}s
                </span>
                <span className="text-[8px] text-chrome/30">Driver variance</span>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

export default TyreDegradationCurve;
