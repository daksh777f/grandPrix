import { motion } from 'motion/react';
import { cn } from '@/lib/utils';
import { Sparkles } from 'lucide-react';
import type { CounterfactualLapCard } from '@/lib/tyreApi';

export interface CounterfactualCardsSectionProps {
  cards: CounterfactualLapCard[];
  selectedCompound?: string | null;
  className?: string;
}

export function CounterfactualCardsSection({
  cards,
  selectedCompound: _selectedCompound,
  className,
}: CounterfactualCardsSectionProps) {
  // If compound filter is set, check if cards match or show all showcase cards
  const displayCards = cards || [];

  if (displayCards.length === 0) {
    return null;
  }

  // Tag styling map
  const getTagBadge = (tag: string) => {
    switch (tag) {
      case 'EARLY_STINT_BASELINE':
        return {
          label: 'Early Stint Baseline',
          color: 'bg-emerald-400/10 text-emerald-400 border-emerald-400/25',
        };
      case 'PRE_CLIFF_PEAK_WEAR':
        return {
          label: 'Pre-Cliff Peak Wear',
          color: 'bg-accent-amber/10 text-accent-amber border-accent-amber/25',
        };
      case 'POST_CLIFF_ANOMALY':
        return {
          label: 'Post-Cliff Anomaly',
          color: 'bg-brand-red/10 text-brand-red border-brand-red/25',
        };
      case 'FUEL_MASKED_DEGRADATION':
        return {
          label: 'Fuel-Masked Degradation',
          color: 'bg-accent-teal/10 text-accent-teal border-accent-teal/25',
        };
      default:
        return {
          label: tag.replace(/_/g, ' '),
          color: 'bg-chrome/10 text-chrome/80 border-chrome/20',
        };
    }
  };

  return (
    <div className={cn('w-full flex flex-col gap-4', className)}>
      <div className="flex items-center justify-between">
        <div className="flex flex-col">
          <div className="flex items-center gap-2">
            <span className="font-display font-bold text-lg sm:text-xl text-ink uppercase tracking-wide">
              Counterfactual Lap Breakdowns
            </span>
            <span className="font-mono text-[9px] uppercase px-2 py-0.5 rounded-sm bg-brand-red/10 text-brand-red border border-brand-red/25">
              Causal Decomposition
            </span>
          </div>
          <span className="font-mono text-[10px] text-chrome/50 uppercase tracking-widest mt-0.5">
            Synthetic reconstruction isolating exact time lost strictly to tyre degradation
          </span>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {displayCards.map((card, idx) => {
          const badge = getTagBadge(card.tag);
          const c = card.components;

          return (
            <motion.div
              key={card.lap_number}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: idx * 0.08 }}
              className="bg-[#0D0E12] border border-chrome/10 rounded-sm p-4 sm:p-5 flex flex-col justify-between hover:border-chrome/25 transition-all duration-200"
            >
              {/* Card Header */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-xs font-bold text-ink bg-white/10 px-2 py-0.5 rounded-sm">
                      LAP {card.lap_number}
                    </span>
                    <span className="font-mono text-[9px] text-chrome/50 uppercase">
                      STINT {card.stint_number} · AGE {card.tyre_age}L
                    </span>
                  </div>

                  <span
                    className={cn(
                      'font-mono text-[8px] font-bold uppercase tracking-widest px-2 py-0.5 rounded-sm border',
                      badge.color
                    )}
                  >
                    {badge.label}
                  </span>
                </div>

                {/* Counterfactual Headline Banner */}
                <div className="bg-emerald-400/[0.06] border border-emerald-400/20 p-3 rounded-xs my-3 flex items-start gap-2.5">
                  <Sparkles className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                  <div className="flex flex-col">
                    <p className="font-mono text-xs text-ink font-semibold leading-relaxed">
                      "{card.counterfactual_text}"
                    </p>
                    <span className="font-mono text-[9px] text-emerald-400/80 mt-1">
                      Time saved on fresh rubber: +{card.time_saved_on_fresh.toFixed(3)}s
                    </span>
                  </div>
                </div>

                {/* Stacked Waterfall Breakdown Component */}
                <div className="flex flex-col gap-1.5 mt-4">
                  <div className="flex justify-between font-mono text-[9px] text-chrome/40 uppercase tracking-widest">
                    <span>Component Breakdown</span>
                    <span>Observed: {card.observed.toFixed(3)}s</span>
                  </div>

                  {/* Horizontal visual breakdown proportions */}
                  <div className="w-full h-3 rounded-xs bg-white/5 border border-white/10 flex overflow-hidden">
                    <div
                      style={{ width: '65%' }}
                      className="bg-chrome/30 h-full border-r border-asphalt"
                      title={`Base Pace: ${c.base_pace.toFixed(2)}s`}
                    />
                    <div
                      style={{ width: '12%' }}
                      className="bg-accent-amber/60 h-full border-r border-asphalt"
                      title={`Fuel Penalty: +${c.fuel_effect.toFixed(2)}s`}
                    />
                    <div
                      style={{ width: '8%' }}
                      className="bg-accent-teal/60 h-full border-r border-asphalt"
                      title={`Track Evo: ${c.track_evolution_effect.toFixed(2)}s`}
                    />
                    <div
                      style={{ width: '15%' }}
                      className="bg-brand-red/80 h-full"
                      title={`Tyre Wear: +${c.tyre_wear_effect.toFixed(2)}s`}
                    />
                  </div>

                  {/* Component Table */}
                  <div className="grid grid-cols-2 gap-x-3 gap-y-1 font-mono text-[9px] mt-2 pt-2 border-t border-white/[0.04]">
                    <div className="flex justify-between text-chrome/60">
                      <span>Base Pace:</span>
                      <span className="text-ink">{c.base_pace.toFixed(3)}s</span>
                    </div>
                    <div className="flex justify-between text-accent-amber">
                      <span>Fuel Mass:</span>
                      <span>+{c.fuel_effect.toFixed(3)}s</span>
                    </div>
                    <div className="flex justify-between text-accent-teal">
                      <span>Track Grip:</span>
                      <span>{c.track_evolution_effect.toFixed(3)}s</span>
                    </div>
                    <div className="flex justify-between text-brand-red font-bold">
                      <span>Tyre Wear:</span>
                      <span>+{c.tyre_wear_effect.toFixed(3)}s</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Tag Description Footer */}
              <div className="mt-4 pt-2.5 border-t border-white/[0.04] font-mono text-[8px] text-chrome/40 leading-normal">
                {card.tag_description}
              </div>
            </motion.div>
          );
        })}
      </div>
    </div>
  );
}

export default CounterfactualCardsSection;
