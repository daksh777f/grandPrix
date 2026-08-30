import { motion } from 'motion/react';
import { cn } from '@/lib/utils';
import { Disc3, Filter, Zap } from 'lucide-react';
import type { TyreLapRecord, StintMeta } from '@/lib/tyreApi';

export interface CompoundDNAStripProps {
  stints: Record<string, StintMeta>;
  records: TyreLapRecord[];
  selectedCompound: string | null;
  onSelectCompound: (compound: string | null) => void;
  className?: string;
  preview?: boolean;
}

export function CompoundDNAStrip({
  stints,
  records,
  selectedCompound,
  onSelectCompound,
  className,
  preview = false,
}: CompoundDNAStripProps) {
  // Extract distinct compounds genuinely present in stints
  const compoundEntries = Object.entries(stints || {}).reduce<
    Array<{
      compound: string;
      meta: StintMeta;
      records: TyreLapRecord[];
      stintKeys: string[];
    }>
  >((acc, [stintKey, meta]) => {
    const existing = acc.find((c) => c.compound.toUpperCase() === meta.compound.toUpperCase());
    if (existing) {
      existing.stintKeys.push(stintKey);
      return acc;
    }
    const compRecords = records.filter(
      (r) => r.compound.toUpperCase() === meta.compound.toUpperCase()
    );
    acc.push({
      compound: meta.compound.toUpperCase(),
      meta,
      records: compRecords,
      stintKeys: [stintKey],
    });
    return acc;
  }, []);

  if (compoundEntries.length === 0) {
    return null;
  }

  // Compound visual theme mapping
  const getCompoundTheme = (compound: string) => {
    switch (compound) {
      case 'HARD':
        return {
          pill: 'bg-white/10 text-white border-white/30',
          line: '#F4F1EC',
          gradient: 'rgba(255, 255, 255, 0.15)',
          glow: 'group-hover:border-white/40',
          activeBg: 'bg-white/[0.06] border-white/40 shadow-[0_0_20px_rgba(255,255,255,0.08)]',
        };
      case 'MEDIUM':
        return {
          pill: 'bg-[#FED100]/10 text-[#FED100] border-[#FED100]/30',
          line: '#FED100',
          gradient: 'rgba(254, 209, 0, 0.15)',
          glow: 'group-hover:border-[#FED100]/40',
          activeBg: 'bg-[#FED100]/[0.06] border-[#FED100]/40 shadow-[0_0_20px_rgba(254,209,0,0.08)]',
        };
      case 'SOFT':
        return {
          pill: 'bg-brand-red/10 text-brand-red border-brand-red/30',
          line: '#E10600',
          gradient: 'rgba(225, 6, 0, 0.15)',
          glow: 'group-hover:border-brand-red/40',
          activeBg: 'bg-brand-red/[0.06] border-brand-red/40 shadow-[0_0_20px_rgba(225,6,0,0.08)]',
        };
      default:
        return {
          pill: 'bg-chrome/10 text-chrome/80 border-chrome/20',
          line: '#C9CDD3',
          gradient: 'rgba(201, 205, 211, 0.15)',
          glow: 'group-hover:border-chrome/30',
          activeBg: 'bg-chrome/[0.06] border-chrome/30',
        };
    }
  };

  // Generate real SVG sparkline path for a compound's degradation curve
  const generateSparklinePath = (compRecords: TyreLapRecord[], width: number = 140, height: number = 36) => {
    if (!compRecords.length) return { path: '', area: '' };

    const sorted = [...compRecords].sort((a, b) => a.tyre_age - b.tyre_age);
    const maxAge = Math.max(...sorted.map((r) => r.tyre_age), 1);
    const maxWear = Math.max(...sorted.map((r) => r.tyre_wear_effect), 0.5);

    const points = sorted.map((r) => {
      const x = (r.tyre_age / maxAge) * (width - 8) + 4;
      const y = height - ((Math.max(0, r.tyre_wear_effect) / maxWear) * (height - 10) + 4);
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    });

    const path = `M ${points.join(' L ')}`;
    const area = `M 4,${height} L ${points.join(' L ')} L ${width - 4},${height} Z`;

    return { path, area };
  };

  return (
    <div className={cn('w-full flex flex-col gap-3', className)}>
      {!preview && (
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 font-mono text-[10px] uppercase tracking-[0.2em] text-chrome/60">
            <Zap className="w-3.5 h-3.5 text-accent-amber" />
            <span>Compound DNA Fingerprints</span>
            <span className="text-chrome/30">·</span>
            <span className="text-chrome/40 text-[9px]">Empirical degradation profiles</span>
          </div>

          {selectedCompound && (
            <button
              onClick={() => onSelectCompound(null)}
              className="flex items-center gap-1.5 font-mono text-[9px] uppercase tracking-wider text-accent-amber hover:text-ink transition-colors cursor-pointer bg-accent-amber/10 border border-accent-amber/20 px-2 py-0.5 rounded-sm"
            >
              <Filter className="w-3 h-3" />
              <span>Reset Filter (Show All)</span>
            </button>
          )}
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {compoundEntries.map(({ compound, meta, records: compRecords }) => {
          const isSelected = selectedCompound?.toUpperCase() === compound;
          const theme = getCompoundTheme(compound);
          const { path, area } = generateSparklinePath(compRecords);
          const repLaps = compRecords.filter((r) => r.is_representative).length;
          const maxWear = Math.max(...compRecords.map((r) => r.tyre_wear_effect), 0);

          return (
            <motion.div
              key={compound}
              whileHover={{ scale: 1.01 }}
              whileTap={{ scale: 0.99 }}
              onClick={() => onSelectCompound(isSelected ? null : compound)}
              className={cn(
                'group relative p-4 rounded-sm border transition-all duration-200 cursor-pointer overflow-hidden',
                'bg-[#0D0E12] border-chrome/10',
                theme.glow,
                isSelected ? theme.activeBg : 'hover:bg-[#121418]'
              )}
            >
              {/* Top Row: Compound Tag & Filter State */}
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <span
                    className={cn(
                      'font-mono text-[10px] font-bold px-2 py-0.5 rounded-sm border uppercase tracking-wider',
                      theme.pill
                    )}
                  >
                    {compound}
                  </span>
                  <span className="font-mono text-[9px] text-chrome/50 uppercase">
                    {repLaps} Rep Laps
                  </span>
                </div>

                {isSelected ? (
                  <span className="font-mono text-[8px] uppercase tracking-widest text-accent-amber bg-accent-amber/15 border border-accent-amber/30 px-1.5 py-0.5 rounded-sm">
                    Filtered
                  </span>
                ) : (
                  <span className="font-mono text-[8px] uppercase tracking-widest text-chrome/40 group-hover:text-chrome/70 transition-colors">
                    Click to filter
                  </span>
                )}
              </div>

              {/* Middle Row: Key Model Parameters */}
              <div className="flex items-end justify-between gap-4 mt-2">
                <div className="flex flex-col">
                  <span className="font-mono text-[8px] text-chrome/40 uppercase tracking-widest">
                    Linear Slope
                  </span>
                  <div className="flex items-baseline gap-1">
                    <span className="font-numeric text-xl sm:text-2xl font-bold text-ink leading-tight">
                      +{(meta.baseline_wear_rate ?? 0.05).toFixed(3)}
                    </span>
                    <span className="font-mono text-[9px] text-chrome/40">s/lap</span>
                  </div>
                  <span className="font-mono text-[8px] text-chrome/50 mt-0.5">
                    Peak wear: +{maxWear.toFixed(2)}s
                  </span>
                </div>

                {/* Right: Sparkline Fingerprint */}
                <div className="w-32 h-10 flex flex-col items-end justify-center">
                  {path ? (
                    <svg width="130" height="34" className="overflow-visible">
                      <defs>
                        <linearGradient id={`grad-${compound}`} x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor={theme.line} stopOpacity="0.25" />
                          <stop offset="100%" stopColor={theme.line} stopOpacity="0.0" />
                        </linearGradient>
                      </defs>
                      <path d={area} fill={`url(#grad-${compound})`} />
                      <path
                        d={path}
                        fill="none"
                        stroke={theme.line}
                        strokeWidth="1.75"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                    </svg>
                  ) : (
                    <div className="text-chrome/30 font-mono text-[8px]">No sparkline</div>
                  )}
                </div>
              </div>

              {/* Bottom Subtle Bar */}
              <div className="mt-3 pt-2 border-t border-white/[0.04] flex items-center justify-between font-mono text-[8px] text-chrome/40">
                <span>Base Pace: {(meta.fitted_base_pace ?? 96.5).toFixed(2)}s</span>
                <span className="flex items-center gap-1">
                  <Disc3 className="w-2.5 h-2.5" />
                  <span>Stint {meta.compound === 'HARD' ? '1 (L1-40)' : '2 (L41-62)'}</span>
                </span>
              </div>
            </motion.div>
          );
        })}
      </div>
    </div>
  );
}

export default CompoundDNAStrip;
