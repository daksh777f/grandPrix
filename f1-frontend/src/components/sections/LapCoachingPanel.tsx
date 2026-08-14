import { useEffect, useState } from 'react';
import { Target } from 'lucide-react';
import { cn } from '@/lib/utils';
import { fetchLapComparison, type CornerComparison, type Driver, type LapComparison, type RecentLapComparisons } from '@/lib/api';

interface Props {
  targetDriver: Driver | undefined;
  benchmarkDriver: Driver | undefined;
  recent: RecentLapComparisons | null;
  loading: boolean;
  error: string | null;
  communicationState: string;
  sessionKey: number;
  currentLiveLap: number | null;
  historyLaps: number[];
  historyLoading: boolean;
}

function driverLabel(driver: Driver | undefined) {
  return driver ? `${driver.name_acronym} · ${driver.team_name}` : 'SELECTING DRIVER';
}

function signed(value: number | null | undefined, suffix = '') {
  if (value === null || value === undefined) return '--';
  return `${value > 0 ? '+' : ''}${value}${suffix}`;
}

function LapDelta({ value, compact = false }: { value: number | null; compact?: boolean }) {
  if (value === null) return <span className="text-ink-muted">--</span>;
  if (value < 0) return <span className="text-emerald-400">{Math.abs(value).toFixed(2)}s{compact ? '' : ' FASTER'}</span>;
  if (value > 0) return <span className="text-brand-red">+{value.toFixed(2)}s{compact ? '' : ' SLOWER'}</span>;
  return <span className="text-chrome/70">ON PACE</span>;
}

function cornerDeltaClass(value: number) {
  if (value > 0) return 'text-brand-red';
  if (value < 0) return 'text-emerald-400';
  return 'text-chrome/70';
}

function CornerDetail({ comparison, corner, target, benchmark }: { comparison: LapComparison; corner: CornerComparison; target: Driver | undefined; benchmark: Driver | undefined }) {
  const metric = (value: number | null, suffix = '') => value === null ? '--' : `${value}${suffix}`;
  const diagnosisTone = corner.diagnosis === 'GOOD' ? 'text-emerald-400' : 'text-brand-red';
  return (
    <div className="mt-4 rounded border border-brand-red/20 bg-brand-red/5 p-4">
      <div className="flex flex-wrap items-center justify-between gap-2 mb-4">
        <div className="font-display text-xl font-bold uppercase">{corner.corner} · LAP {comparison.lap}</div>
        <div className={cn('font-mono text-[9px] uppercase tracking-widest', diagnosisTone)}>{corner.diagnosis.replace(/_/g, ' ')}</div>
      </div>
      <div className="grid grid-cols-3 gap-3 font-mono text-[10px] uppercase tracking-widest">
        <div className="text-ink-muted">Metric</div>
        <div className="text-ink">{target?.name_acronym || 'TARGET'}</div>
        <div className="text-ink">{benchmark?.name_acronym || 'BENCHMARK'}</div>
        <div className="text-ink-muted">Entry</div><div>{metric(corner.target.entry_speed, ' km/h')}</div><div>{metric(corner.benchmark.entry_speed, ' km/h')}</div>
        <div className="text-ink-muted">Minimum</div><div>{metric(corner.target.minimum_speed, ' km/h')}</div><div>{metric(corner.benchmark.minimum_speed, ' km/h')}</div>
        <div className="text-ink-muted">Exit</div><div>{metric(corner.target.exit_speed, ' km/h')}</div><div>{metric(corner.benchmark.exit_speed, ' km/h')}</div>
        <div className="text-ink-muted">Brake progress</div><div>{metric(corner.target.braking_progress)}</div><div>{metric(corner.benchmark.braking_progress)}</div>
        <div className="text-ink-muted">Throttle progress</div><div>{metric(corner.target.throttle_progress)}</div><div>{metric(corner.benchmark.throttle_progress)}</div>
      </div>
      <div className="mt-4 border-t border-white/10 pt-3 font-mono text-[10px] uppercase tracking-widest text-ink-muted">
        Local corner delta · Entry {signed(corner.delta.entry_speed, ' km/h')} · Min {signed(corner.delta.minimum_speed, ' km/h')} · Exit {signed(corner.delta.exit_speed, ' km/h')} · Est. deficit <span className={corner.estimated_time_delta === null ? 'text-chrome/70' : cornerDeltaClass(corner.estimated_time_delta)}>{signed(corner.estimated_time_delta, 's')}</span>
      </div>
    </div>
  );
}

export function LapCoachingPanel({ targetDriver, benchmarkDriver, recent, loading, error, communicationState, sessionKey, currentLiveLap, historyLaps, historyLoading }: Props) {
  const [selectedCorner, setSelectedCorner] = useState<{ comparison: LapComparison; corner: CornerComparison } | null>(null);
  const [selectedLap, setSelectedLap] = useState<number | null>(null);
  const [comparisonCache, setComparisonCache] = useState<Record<number, LapComparison>>({});
  const [selectedLoading, setSelectedLoading] = useState(false);
  const latest = recent?.laps[recent.laps.length - 1];
  const activeComparison = selectedLap === null ? latest : comparisonCache[selectedLap];

  useEffect(() => {
    setSelectedLap(null);
    setSelectedCorner(null);
    setComparisonCache({});
  }, [targetDriver?.driver_number, benchmarkDriver?.driver_number]);

  useEffect(() => {
    if (recent?.laps.length) {
      setComparisonCache((previous) => ({
        ...previous,
        ...Object.fromEntries(recent.laps.map((comparison) => [comparison.lap, comparison])),
      }));
    }
  }, [recent]);

  useEffect(() => {
    if (selectedLap !== null && !historyLaps.includes(selectedLap)) {
      setSelectedLap(null);
      setSelectedCorner(null);
    }
  }, [historyLaps, selectedLap]);

  const selectLap = async (lap: number) => {
    setSelectedCorner(null);
    setSelectedLap(lap);
    if (comparisonCache[lap] || !targetDriver || !benchmarkDriver) return;
    setSelectedLoading(true);
    try {
      const comparison = await fetchLapComparison(sessionKey, targetDriver.driver_number, benchmarkDriver.driver_number, lap);
      setComparisonCache((previous) => ({ ...previous, [lap]: comparison }));
    } catch (loadError) {
      console.warn('Selected lap coaching unavailable', loadError);
      setSelectedLap(null);
    } finally {
      setSelectedLoading(false);
    }
  };

  const historyIndex = selectedLap === null ? -1 : historyLaps.indexOf(selectedLap);
  const viewing = selectedLap !== null;
  const canGoPrevious = historyIndex > 0;
  const canGoNext = historyIndex >= 0 && historyIndex < historyLaps.length - 1;

  return (
    <section className="mb-6 rounded-xl border border-chrome/10 bg-[#111316] p-5 md:p-6">
      <div className="flex flex-wrap items-start justify-between gap-5 border-b border-white/10 pb-5">
        <div>
          <div className="mb-2 flex items-center gap-2 font-mono text-[9px] uppercase tracking-[0.2em] text-brand-red"><Target className="h-3.5 w-3.5" /> Lap coaching</div>
          <div className="font-display text-2xl font-bold uppercase text-ink">Completed-lap evidence</div>
          <div className="mt-1 font-mono text-[10px] uppercase tracking-widest text-ink-muted">{driverLabel(targetDriver)} <span className="text-chrome/40">vs</span> {driverLabel(benchmarkDriver)}</div>
        </div>
        <div className="text-right font-mono text-[9px] uppercase tracking-widest text-chrome/50">
          <div>LIVE LAP {currentLiveLap ?? '--'}</div>
          <div className={cn('mt-1', viewing ? 'text-brand-red' : 'text-ink')}>{viewing ? `VIEWING LAP ${selectedLap}` : `COMMUNICATION · ${communicationState.replace(/_/g, ' ')}`}</div>
        </div>
      </div>

      {loading && <div className="py-8 text-center font-mono text-[10px] uppercase tracking-widest text-ink-muted">Analyzing completed laps...</div>}
      {!loading && error && <div className="py-8 text-center font-mono text-[10px] uppercase tracking-widest text-ink-muted">Lap coaching unavailable for this comparison.</div>}
      {!loading && !error && selectedLoading && <div className="py-8 text-center font-mono text-[10px] uppercase tracking-widest text-ink-muted">Loading selected lap coaching...</div>}
      {!loading && !error && !selectedLoading && !activeComparison && <div className="py-8 text-center font-mono text-[10px] uppercase tracking-widest text-ink-muted">Complete a lap to generate coaching evidence.</div>}

      {!loading && !error && activeComparison && (
        <>
          <div className="grid grid-cols-1 gap-5 py-5 lg:grid-cols-[1.1fr_1fr_1fr]">
            <div>
              <div className="font-mono text-[9px] uppercase tracking-[0.2em] text-ink-muted">{viewing ? 'Historical lap inspection' : 'Last completed lap'}</div>
              <div className="mt-1 flex flex-wrap items-baseline gap-3"><span className="font-display text-4xl font-black text-ink">LAP {activeComparison.lap}</span><span className="font-mono text-sm"><LapDelta value={activeComparison.lap_delta} /></span></div>
              <div className="mt-1 font-mono text-[10px] uppercase tracking-widest text-ink-muted">{targetDriver?.name_acronym || 'TARGET'} vs {benchmarkDriver?.name_acronym || 'BENCHMARK'}</div>
              <div className="mt-2 font-mono text-[9px] uppercase tracking-widest text-chrome/40">Lap delta = target lap time − benchmark lap time</div>
              {viewing ? <div className="mt-4 flex flex-wrap gap-3 font-mono text-[9px] uppercase tracking-widest"><button type="button" disabled={!canGoPrevious} onClick={() => selectLap(historyLaps[historyIndex - 1])} className="text-chrome/70 hover:text-ink disabled:opacity-30">← Previous</button><button type="button" disabled={!canGoNext} onClick={() => selectLap(historyLaps[historyIndex + 1])} className="text-chrome/70 hover:text-ink disabled:opacity-30">Next →</button><button type="button" onClick={() => { setSelectedLap(null); setSelectedCorner(null); }} className="text-brand-red hover:text-ink">Return to latest</button></div> : <div className="mt-4 font-mono text-[9px] uppercase tracking-widest text-chrome/50">Completed evidence</div>}
            </div>
            <div>
              <div className="font-mono text-[9px] uppercase tracking-[0.2em] text-ink-muted">Top corner deficits</div>
              <div className="mt-1 font-mono text-[8px] uppercase tracking-widest text-chrome/40">Local estimates · not additive to total lap delta</div>
              <div className="mt-3 space-y-2">
                {activeComparison.top_losses.slice(0, 3).map((loss) => {
                  const corner = activeComparison.corners.find((item) => item.corner === loss.corner);
                  const isGood = loss.diagnosis === 'GOOD';
                  return <button key={loss.corner} type="button" onClick={() => corner && setSelectedCorner({ comparison: activeComparison, corner })} className="flex w-full items-center justify-between gap-3 text-left font-mono text-[10px] uppercase tracking-widest hover:text-ink"><span className={cn(isGood ? 'text-chrome/70' : 'text-ink')}>{loss.corner} · {loss.diagnosis.replace(/_/g, ' ')}</span>{!isGood && <span className={cornerDeltaClass(loss.time_loss)}>{signed(loss.time_loss, 's')}</span>}</button>;
                })}
                {!activeComparison.top_losses.length && <span className="font-mono text-[10px] uppercase tracking-widest text-ink-muted">No reliable loss isolated</span>}
              </div>
            </div>
            <div>
              <div className="font-mono text-[9px] uppercase tracking-[0.2em] text-ink-muted">Next lap</div>
              <div className="mt-3 border-l-2 border-brand-red/60 pl-3 font-body text-base leading-snug text-ink">{activeComparison.coaching.advice}</div>
              <div className="mt-3 font-mono text-[9px] uppercase tracking-widest text-chrome/50">{activeComparison.coaching.status === 'FALLBACK' ? 'Deterministic coaching' : 'Ollama coaching'}</div>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-5 border-t border-white/10 pt-5 md:grid-cols-2">
            <div>
              <div className="font-mono text-[9px] uppercase tracking-[0.2em] text-ink-muted">What benchmark did better</div>
              <div className="mt-3 space-y-2 font-body text-sm text-ink-muted">{activeComparison.benchmark_strengths.length ? activeComparison.benchmark_strengths.slice(0, 3).map((strength) => <div key={strength}>· {strength}</div>) : <div>Insufficient measured advantage to state a benchmark strength.</div>}</div>
            </div>
            <div>
              <div className="font-mono text-[9px] uppercase tracking-[0.2em] text-ink-muted">Co-driver observation</div>
              <div className="mt-3 font-body text-sm leading-relaxed text-ink-muted">{activeComparison.coaching.message}</div>
            </div>
          </div>

          {selectedCorner && <CornerDetail comparison={selectedCorner.comparison} corner={selectedCorner.corner} target={targetDriver} benchmark={benchmarkDriver} />}

          <div className="mt-5 border-t border-white/10 pt-5">
            <div className="mb-3 font-mono text-[9px] uppercase tracking-[0.2em] text-ink-muted">Recent completed laps</div>
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
              {recent?.laps.map((comparison) => {
                const loss = comparison.top_losses[0];
                return <button key={comparison.lap} type="button" onClick={() => selectLap(comparison.lap)} className={cn('rounded border border-white/10 bg-white/[0.03] p-3 text-left transition-colors hover:border-chrome/40', comparison.lap === activeComparison.lap && 'border-brand-red/40 bg-brand-red/5')}><div className="font-mono text-[9px] uppercase tracking-widest text-ink-muted">LAP {comparison.lap} · {targetDriver?.name_acronym} vs {benchmarkDriver?.name_acronym}</div><div className="mt-2 font-display text-xl"><LapDelta value={comparison.lap_delta} compact /></div><div className="mt-1 font-mono text-[9px] uppercase tracking-widest text-chrome/60">{loss ? `${loss.corner} · ${loss.diagnosis.replace(/_/g, ' ')}` : 'NO RELIABLE LOSS'}</div></button>;
              })}
            </div>
            {recent?.trend && <div className="mt-4 font-mono text-[10px] uppercase tracking-widest text-accent-amber">Recent trend · {recent.trend}</div>}
          </div>

          <div className="mt-5 flex flex-wrap items-center gap-3 border-t border-white/10 pt-5">
            <span className="font-mono text-[9px] uppercase tracking-[0.2em] text-ink-muted">Lap coaching history</span>
            <select value={selectedLap ?? ''} onChange={(event) => event.target.value && selectLap(Number(event.target.value))} disabled={historyLoading || !historyLaps.length} className="rounded border border-chrome/20 bg-[#0a0a0c] px-3 py-2 font-mono text-[10px] uppercase tracking-widest text-ink disabled:opacity-40">
              <option value="">{historyLoading ? 'Loading completed laps...' : 'Select completed lap'}</option>
              {historyLaps.map((lap) => <option key={lap} value={lap}>LAP {lap}</option>)}
            </select>
            <span className="font-mono text-[9px] uppercase tracking-widest text-chrome/40">{historyLaps.length} valid laps available</span>
          </div>
        </>
      )}
    </section>
  );
}
