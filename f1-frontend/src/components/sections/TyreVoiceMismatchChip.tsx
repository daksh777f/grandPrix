import { useState } from 'react';
import { Link } from 'react-router-dom';
import { cn } from '@/lib/utils';
import { CheckCircle2, AlertCircle, ArrowUpRight, ChevronDown, ChevronUp, Disc3 } from 'lucide-react';

export interface TyreVoiceMismatchChipProps {
  alignment?: 'CONFIRMED' | 'MISMATCH' | null;
  description?: string | null;
  wearRate?: number | null;
  cliffProbability?: number | null;
  tyreHealthPct?: number | null;
  lap?: number | null;
  sessionKey?: number;
  driverNumber?: number;
  className?: string;
  variant?: 'full' | 'compact';
}

export function TyreVoiceMismatchChip({
  alignment,
  description,
  wearRate,
  cliffProbability,
  tyreHealthPct,
  lap,
  sessionKey = 9165,
  driverNumber = 1,
  className,
  variant = 'full',
}: TyreVoiceMismatchChipProps) {
  const [expanded, setExpanded] = useState(false);

  if (!alignment) {
    return null;
  }

  const isConfirmed = alignment === 'CONFIRMED';

  const wearDisplay = wearRate !== null && wearRate !== undefined ? `+${wearRate.toFixed(3)}s/lap` : null;
  const cliffDisplay = cliffProbability !== null && cliffProbability !== undefined ? `${(cliffProbability * 100).toFixed(0)}% cliff risk` : null;
  const healthDisplay = tyreHealthPct !== null && tyreHealthPct !== undefined ? `${Math.round(tyreHealthPct)}% health` : null;

  // Evidence summary string
  const evidenceStr = [wearDisplay, cliffDisplay, healthDisplay].filter(Boolean).join(' · ');

  if (variant === 'compact') {
    return (
      <span
        className={cn(
          'inline-flex items-center gap-1 font-mono text-[8px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded-sm border',
          isConfirmed
            ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/25'
            : 'bg-accent-amber/15 text-accent-amber border-accent-amber/35',
          className
        )}
      >
        {isConfirmed ? (
          <>
            <CheckCircle2 className="w-2.5 h-2.5 text-emerald-400 shrink-0" />
            <span>Tyre Aligned</span>
          </>
        ) : (
          <>
            <AlertCircle className="w-2.5 h-2.5 text-accent-amber shrink-0" />
            <span>Tyre Divergence</span>
          </>
        )}
      </span>
    );
  }

  return (
    <div
      className={cn(
        'rounded-xl border transition-all duration-200 p-3 flex flex-col gap-2 relative overflow-hidden',
        isConfirmed
          ? 'bg-emerald-500/[0.04] border-emerald-500/20'
          : 'bg-accent-amber/[0.06] border-accent-amber/35 shadow-[0_0_16px_rgba(217,142,74,0.08)]',
        className
      )}
    >
      {/* Top Main Chip Row */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          {isConfirmed ? (
            <div className="flex items-center gap-1.5 font-mono text-[10px] font-bold text-emerald-400 uppercase tracking-widest">
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
              <span>Tyre Model Confirmed</span>
            </div>
          ) : (
            <div className="flex items-center gap-1.5 font-mono text-[10px] font-bold text-accent-amber uppercase tracking-widest">
              <AlertCircle className="w-3.5 h-3.5 text-accent-amber shrink-0" />
              <span>
                {tyreHealthPct !== null && tyreHealthPct !== undefined
                  ? `Model Shows ${Math.round(tyreHealthPct)}% Health — Driver Reports Differently`
                  : 'Telemetry / Voice Divergence'}
              </span>
            </div>
          )}
        </div>

        {/* Evidence Pill / Toggle */}
        <div className="flex items-center gap-2">
          {evidenceStr && (
            <span className="hidden sm:inline font-mono text-[9px] text-chrome/60 bg-white/[0.04] px-2 py-0.5 rounded-sm border border-white/5">
              {evidenceStr}
            </span>
          )}

          <button
            type="button"
            onClick={() => setExpanded(!expanded)}
            className="text-chrome/50 hover:text-ink transition-colors p-0.5 cursor-pointer"
            aria-label="Toggle evidence breakdown"
          >
            {expanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
          </button>
        </div>
      </div>

      {/* Description / Explanation Text */}
      {description && (
        <p className="font-mono text-[10px] text-chrome/70 leading-relaxed">
          {description}
        </p>
      )}

      {/* Expanded Cross-Reference Details and Link to /tyres */}
      {expanded && (
        <div className="pt-2 border-t border-white/[0.06] flex flex-wrap items-center justify-between gap-2 mt-1">
          <div className="flex items-center gap-3 font-mono text-[9px] text-chrome/60">
            {wearDisplay && <span>Wear: <strong className="text-ink">{wearDisplay}</strong></span>}
            {cliffDisplay && <span>Cliff: <strong className="text-ink">{cliffDisplay}</strong></span>}
            {healthDisplay && <span>Health: <strong className="text-ink">{healthDisplay}</strong></span>}
          </div>

          <Link
            to={`/tyres?session=${sessionKey}&driver=${driverNumber}${lap ? `&lap=${lap}` : ''}`}
            className="inline-flex items-center gap-1 font-mono text-[9px] font-bold uppercase tracking-wider text-accent-amber hover:text-ink transition-colors border border-accent-amber/30 bg-accent-amber/10 px-2.5 py-1 rounded-sm"
          >
            <Disc3 className="w-3 h-3" />
            <span>Cross-Check on Tyre Curve {lap ? `(Lap ${lap})` : ''}</span>
            <ArrowUpRight className="w-3 h-3" />
          </Link>
        </div>
      )}
    </div>
  );
}

export default TyreVoiceMismatchChip;
