import { useEffect, useState, useMemo } from 'react';
import { Activity, AlertTriangle, ArrowUpRight, Car, Cpu, Disc3, Layers, MessageSquare, Radio, ShieldAlert } from 'lucide-react';
import { Link, useSearchParams } from 'react-router-dom';
import { fetchRaceTimeline, type RaceTimelineData, type RaceTimelineEvent } from '@/lib/api';
import { cn } from '@/lib/utils';

const eventStyles: Record<RaceTimelineEvent['kind'], { icon: typeof Activity; accent: string; label: string }> = {
  TELEMETRY: { icon: Car, accent: 'text-brand-red border-brand-red/30 bg-brand-red/5', label: 'TELEMETRY' },
  RADIO: { icon: Radio, accent: 'text-accent-teal border-accent-teal/30 bg-accent-teal/5', label: 'RADIO' },
  RACE_CONTEXT: { icon: ShieldAlert, accent: 'text-accent-amber border-accent-amber/30 bg-accent-amber/5', label: 'RACE CONTEXT' },
  COMMUNICATION: { icon: MessageSquare, accent: 'text-brand-red border-brand-red/30 bg-brand-red/5', label: 'COMMUNICATION' },
  CO_DRIVER: { icon: Cpu, accent: 'text-ink border-chrome/30 bg-white/5', label: 'CO-DRIVER' },
  TYRE_CLIFF_ONSET: { icon: AlertTriangle, accent: 'text-brand-red border-brand-red/50 bg-brand-red/10 shadow-[0_0_20px_rgba(225,6,0,0.15)]', label: 'TYRE CLIFF ONSET' },
  TYRE_ALERT_ESCALATION: { icon: ShieldAlert, accent: 'text-accent-amber border-accent-amber/40 bg-accent-amber/10', label: 'TYRE ALERT ESCALATION' },
  PIT_WINDOW_OPENED: { icon: Disc3, accent: 'text-accent-teal border-accent-teal/40 bg-accent-teal/10 shadow-[0_0_15px_rgba(0,229,187,0.1)]', label: 'PIT STRATEGY' },
};

function formatTimestamp(timestamp: string | null) {
  if (!timestamp) return null;
  return new Date(timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
}

function EventCard({ event }: { event: RaceTimelineEvent }) {
  const style = eventStyles[event.kind] || eventStyles.TELEMETRY;
  const Icon = style.icon;
  const race = event.race_context as Record<string, unknown>;
  const performance = event.performance;

  return (
    <article className="relative grid grid-cols-[72px_1fr] gap-5 md:grid-cols-[100px_1fr] md:gap-8">
      <div className="pt-1 text-right font-mono text-[10px] uppercase tracking-widest text-ink-muted">
        <div>{event.timecode}</div>
        <div className="mt-1 text-[9px] text-chrome/40">{formatTimestamp(event.timestamp) || `L${event.lap ?? '--'}`}</div>
      </div>
      <div className={cn('relative rounded-xl border p-5 md:p-6 transition-all duration-200 hover:border-white/20', style.accent)}>
        <div className="absolute -left-[30px] top-5 h-3 w-3 rounded-full border-2 border-asphalt bg-current md:-left-[38px]" />
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="flex items-center gap-2 font-mono text-[10px] uppercase tracking-[0.2em]">
            <Icon className="h-4 w-4" />
            <span>{style.label}</span>
            {event.lap !== null && <span className="text-chrome/40">· L{event.lap}</span>}
            {event.corner && <span className="text-chrome/40">· {event.corner}</span>}
            {event.phase && <span className="text-chrome/40">· {event.phase}</span>}
          </div>
          {event.progress !== null && event.progress !== undefined && (
            <span className="font-mono text-[9px] uppercase tracking-widest text-chrome/40">{(event.progress * 100).toFixed(1)}%</span>
          )}
        </div>

        <h2 className="mt-4 font-display text-2xl font-bold uppercase tracking-tight text-ink">{event.title}</h2>
        <p className="mt-2 max-w-2xl font-body text-base leading-relaxed text-ink-muted">{event.summary}</p>

        {event.radio && (
          <div className="mt-4 border-l-2 border-accent-teal/50 pl-3 font-body text-ink">
            <div className="text-lg">{event.radio.transcript ? `"${event.radio.transcript}"` : 'Transcript unavailable'}</div>
            <div className="mt-2 font-mono text-[9px] uppercase tracking-widest text-ink-muted">
              Voice state · {event.radio.voice_state?.replace(/_/g, ' ') || 'UNAVAILABLE'}
              {event.radio.emotion ? ` · ${event.radio.emotion}` : ''}
            </div>
          </div>
        )}

        {(performance.diagnosis || performance.entry_speed_delta !== undefined || performance.estimated_time_delta !== undefined) && (
          <div className="mt-5 flex flex-wrap gap-x-6 gap-y-2 font-mono text-[10px] uppercase tracking-widest text-ink-muted">
            {performance.diagnosis && <span>Diagnosis · <b className="text-ink">{performance.diagnosis}</b></span>}
            {performance.entry_speed_delta !== null && performance.entry_speed_delta !== undefined && <span>Entry · <b className="text-ink">{performance.entry_speed_delta > 0 ? '+' : ''}{performance.entry_speed_delta} km/h</b></span>}
            {performance.estimated_time_delta !== null && performance.estimated_time_delta !== undefined && performance.estimated_time_delta !== 0 && <span>Cost · <b className="text-ink">{performance.estimated_time_delta > 0 ? '+' : ''}{performance.estimated_time_delta.toFixed(3)}s</b></span>}
          </div>
        )}

        {race?.battle_active ? (
          <div className="mt-4 font-mono text-[10px] uppercase tracking-widest text-accent-amber">
            P{String(race.position ?? '--')} · {race.is_defending ? 'DEFENDING' : 'BATTLE ACTIVE'}{race.gap_behind !== null && race.gap_behind !== undefined ? ` · ${race.gap_behind}s` : ''}
          </div>
        ) : null}

        {event.details?.advice && (
          <div className="mt-4 border-t border-white/10 pt-4 font-body text-sm text-ink-muted">
            <span className="font-mono text-[9px] uppercase tracking-widest text-brand-red">Instruction · </span>{event.details.advice}
          </div>
        )}

        {(event.links.live || event.links.voice || event.links.tyre) && (
          <div className="mt-5 flex flex-wrap gap-4 border-t border-white/10 pt-4">
            {event.links.live && (
              <Link to={event.links.live} className="inline-flex items-center gap-1 font-mono text-[9px] uppercase tracking-widest text-chrome/70 transition-colors hover:text-ink">
                View live context <ArrowUpRight className="h-3 w-3" />
              </Link>
            )}
            {event.links.voice && (
              <Link to={event.links.voice} className="inline-flex items-center gap-1 font-mono text-[9px] uppercase tracking-widest text-accent-teal/80 transition-colors hover:text-accent-teal">
                View transmission <ArrowUpRight className="h-3 w-3" />
              </Link>
            )}
            {event.links.tyre && (
              <Link to={event.links.tyre} className="inline-flex items-center gap-1 font-mono text-[9px] uppercase tracking-widest text-accent-amber/90 transition-colors hover:text-accent-amber">
                View tyre analysis <ArrowUpRight className="h-3 w-3" />
              </Link>
            )}
          </div>
        )}
      </div>
    </article>
  );
}

type FilterCategory = 'ALL' | 'TYRES' | 'RADIO' | 'TELEMETRY' | 'CO_DRIVER';

export function RaceTimelinePage() {
  const [searchParams] = useSearchParams();
  const [data, setData] = useState<RaceTimelineData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<FilterCategory>('ALL');

  const sessionParam = searchParams.get('session');
  const driverParam = searchParams.get('driver');
  const sessionKey = sessionParam ? Number(sessionParam) : 9165;
  const driverNumber = driverParam ? Number(driverParam) : 1;

  useEffect(() => {
    let active = true;
    setError(null);
    fetchRaceTimeline(sessionKey, driverNumber)
      .then((response) => {
        if (active) setData(response);
      })
      .catch((loadError) => {
        console.error(loadError);
        if (active) setError('Failed to load the race timeline.');
      });
    return () => {
      active = false;
    };
  }, [sessionKey, driverNumber]);

  const filteredEvents = useMemo(() => {
    if (!data?.events) return [];
    if (filter === 'ALL') return data.events;
    if (filter === 'TYRES') {
      return data.events.filter(
        (e) =>
          e.kind === 'TYRE_CLIFF_ONSET' ||
          e.kind === 'TYRE_ALERT_ESCALATION' ||
          e.kind === 'PIT_WINDOW_OPENED'
      );
    }
    if (filter === 'RADIO') return data.events.filter((e) => e.kind === 'RADIO');
    if (filter === 'TELEMETRY') return data.events.filter((e) => e.kind === 'TELEMETRY');
    if (filter === 'CO_DRIVER') return data.events.filter((e) => e.kind === 'CO_DRIVER' || e.kind === 'COMMUNICATION');
    return data.events;
  }, [data?.events, filter]);

  const tyreEventCount = useMemo(() => {
    if (!data?.events) return 0;
    return data.events.filter(
      (e) =>
        e.kind === 'TYRE_CLIFF_ONSET' ||
        e.kind === 'TYRE_ALERT_ESCALATION' ||
        e.kind === 'PIT_WINDOW_OPENED'
    ).length;
  }, [data?.events]);

  return (
    <div className="min-h-screen bg-asphalt px-6 pb-24 pt-28 text-ink">
      <div className="mx-auto max-w-5xl">
        <header className="mb-8 border-b border-white/10 pb-8">
          <div className="flex flex-wrap items-end justify-between gap-6">
            <div>
              <div className="mb-4 flex items-center gap-2 font-mono text-[10px] uppercase tracking-[0.2em] text-brand-red">
                <Activity className="h-4 w-4" /> Shared event context
              </div>
              <h1 className="font-display text-5xl font-black uppercase tracking-tight md:text-7xl">Race Timeline</h1>
              <p className="mt-4 max-w-xl font-body text-lg text-ink-muted">
                One chronological view of what the car did, what the driver said, when tyres hit degradation cliffs, and when the co-driver intervened.
              </p>
            </div>
            <div className="font-mono text-right text-[10px] uppercase tracking-widest text-ink-muted">
              <div>Singapore GP · Race · 2023</div>
              <div className="mt-2 text-ink">VER · Session {sessionKey}</div>
            </div>
          </div>

          {/* Interactive Event Filter Bar */}
          <div className="mt-8 flex flex-wrap items-center gap-2 pt-4 border-t border-white/5">
            <button
              onClick={() => setFilter('ALL')}
              className={cn(
                'px-3 py-1.5 rounded-lg font-mono text-[10px] uppercase tracking-widest transition-colors flex items-center gap-1.5',
                filter === 'ALL' ? 'bg-white text-asphalt font-bold' : 'bg-white/5 text-ink-muted hover:bg-white/10 hover:text-ink'
              )}
            >
              <Layers className="w-3 h-3" /> All Events ({data?.events.length || 0})
            </button>
            <button
              onClick={() => setFilter('TYRES')}
              className={cn(
                'px-3 py-1.5 rounded-lg font-mono text-[10px] uppercase tracking-widest transition-colors flex items-center gap-1.5',
                filter === 'TYRES'
                  ? 'bg-accent-amber text-asphalt font-bold'
                  : 'bg-accent-amber/10 text-accent-amber hover:bg-accent-amber/20'
              )}
            >
              <AlertTriangle className="w-3 h-3" /> Tyres & Strategy ({tyreEventCount})
            </button>
            <button
              onClick={() => setFilter('RADIO')}
              className={cn(
                'px-3 py-1.5 rounded-lg font-mono text-[10px] uppercase tracking-widest transition-colors flex items-center gap-1.5',
                filter === 'RADIO' ? 'bg-accent-teal text-asphalt font-bold' : 'bg-accent-teal/10 text-accent-teal hover:bg-accent-teal/20'
              )}
            >
              <Radio className="w-3 h-3" /> Radio (5)
            </button>
            <button
              onClick={() => setFilter('CO_DRIVER')}
              className={cn(
                'px-3 py-1.5 rounded-lg font-mono text-[10px] uppercase tracking-widest transition-colors flex items-center gap-1.5',
                filter === 'CO_DRIVER' ? 'bg-brand-red text-white font-bold' : 'bg-brand-red/10 text-brand-red hover:bg-brand-red/20'
              )}
            >
              <Cpu className="w-3 h-3" /> Co-Driver
            </button>
            <button
              onClick={() => setFilter('TELEMETRY')}
              className={cn(
                'px-3 py-1.5 rounded-lg font-mono text-[10px] uppercase tracking-widest transition-colors flex items-center gap-1.5',
                filter === 'TELEMETRY' ? 'bg-white text-asphalt font-bold' : 'bg-white/5 text-ink-muted hover:bg-white/10 hover:text-ink'
              )}
            >
              <Car className="w-3 h-3" /> Telemetry
            </button>
          </div>
        </header>

        {error && <div className="rounded-xl border border-brand-red/30 bg-brand-red/5 p-6 font-mono text-xs uppercase tracking-widest text-brand-red">{error}</div>}
        {!data && !error && <div className="py-24 text-center font-mono text-xs uppercase tracking-widest text-ink-muted">Assembling shared race context...</div>}
        {data && (
          <div className="relative space-y-6 before:absolute before:bottom-0 before:left-[68px] before:top-0 before:w-px before:bg-white/10 md:before:left-[100px]">
            {filteredEvents.map((event) => <EventCard key={event.event_id} event={event} />)}
            {!filteredEvents.length && (
              <div className="py-24 text-center font-mono text-xs uppercase tracking-widest text-ink-muted">
                No events match current filter.
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
