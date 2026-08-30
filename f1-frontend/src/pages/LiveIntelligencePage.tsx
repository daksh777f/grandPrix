import { useState, useEffect, useRef, useMemo } from 'react';
import { Map as MapIcon, ArrowUpRight, ArrowDownRight, RefreshCcw, Cpu } from 'lucide-react';
import { fetchCompletedComparisonLaps, fetchDefaultBenchmark, fetchGrid, fetchLiveAnalysis, fetchRecentComparisons, type Driver, type LiveAnalysisData, type RecentLapComparisons } from '@/lib/api';
import { fetchTyreIntelligence, type TyreIntelligenceData } from '@/lib/tyreApi';
import { motion, AnimatePresence } from 'motion/react';
import { cn } from '@/lib/utils';
import { CornerHistoryPanel } from '@/components/sections/CornerHistoryPanel';
import { LapCoachingPanel } from '@/components/sections/LapCoachingPanel';
import { TyreHealthHUD } from '@/components/sections/TyreHealthHUD';
import { useSearchParams } from 'react-router-dom';

interface CoDriverFinding {
  eventId: string;
  lap: number;
  corner: string;
  phase: string;
  diagnosis: string;
  severity: string;
  estimatedTimeDelta: number | null;
  message: string;
  advice: string;
  elapsed: number;
  communicationState: "ATTENTION" | "RADIO_NOW";
  targetDriver: number;
  benchmarkDriver: number | null;
}

export function LiveIntelligencePage() {
  const [searchParams] = useSearchParams();
  const [liveData, setLiveData] = useState<LiveAnalysisData | null>(null);
  const [tyreData, setTyreData] = useState<TyreIntelligenceData | null>(null);
  const [liveError, setLiveError] = useState<string | null>(null);
  const [drivers, setDrivers] = useState<Driver[]>([]);
  const [targetDriver, setTargetDriver] = useState(1);
  const [benchmarkDriver, setBenchmarkDriver] = useState<number | null>(null);
  const [recentComparisons, setRecentComparisons] = useState<RecentLapComparisons | null>(null);
  const [historyLaps, setHistoryLaps] = useState<number[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [coachingLoading, setCoachingLoading] = useState(false);
  const [coachingError, setCoachingError] = useState<string | null>(null);
  const [latestFinding, setLatestFinding] = useState<CoDriverFinding | null>(null);
  const [_recentFindings, setRecentFindings] = useState<CoDriverFinding[]>([]);
  const lastFindingKeyRef = useRef<string | null>(null);
  const [playbackSpeed, setPlaybackSpeed] = useState<number>(1);
  const [currentTick, setCurrentTick] = useState(0);
  const currentTickRef = useRef(0);
  const [selectedCorner, setSelectedCorner] = useState<string | null>(null);
  const [hoverCorner, setHoverCorner] = useState<string | null>(null);
  const requestedContext = useMemo(() => {
    const sessionParam = searchParams.get('session');
    const driverParam = searchParams.get('driver');
    const lapParam = searchParams.get('lap');
    const progressParam = searchParams.get('progress');
    const elapsedParam = searchParams.get('elapsed');
    return {
      sessionKey: sessionParam ? Number(sessionParam) : 9165,
      driverNumber: driverParam ? Number(driverParam) : 1,
      lap: lapParam ? Number(lapParam) : null,
      corner: searchParams.get('corner'),
      progress: progressParam ? Number(progressParam) : null,
      elapsed: elapsedParam ? Number(elapsedParam) : null,
      hasContext: Boolean(searchParams.get('event_id') || searchParams.get('lap') || searchParams.get('corner') || searchParams.get('progress') || searchParams.get('elapsed')),
    };
  }, [searchParams]);

  useEffect(() => {
    setTargetDriver(requestedContext.driverNumber);
  }, [requestedContext.driverNumber]);

  useEffect(() => {
    fetchGrid()
      .then(setDrivers)
      .catch((err) => console.warn('Driver selector data unavailable', err));
  }, []);

  useEffect(() => {
    if (!drivers.length || !drivers.some((driver) => driver.driver_number === targetDriver)) return;
    setBenchmarkDriver(null);
    fetchDefaultBenchmark(requestedContext.sessionKey, targetDriver)
      .then((result) => {
        if (result.benchmark_driver !== targetDriver) setBenchmarkDriver(result.benchmark_driver);
      })
      .catch((err) => console.warn('Default benchmark unavailable', err));
  }, [drivers, requestedContext.sessionKey, targetDriver]);

  const trackPath = useMemo(() => {
    if (!liveData || !liveData.samples || liveData.samples.length === 0) return '';
    const firstLap = liveData.samples[0].lap_number;
    const lapSamples = liveData.samples.filter(s => s.lap_number === firstLap);

    // Downsample slightly to keep SVG size manageable
    const downsampled = lapSamples.filter((_, i) => i % 3 === 0);

    return downsampled.map((s, i) => {
        const nx = 100 - s.target.x;
        const ny = s.target.y;
        return `${i === 0 ? 'M' : 'L'} ${nx.toFixed(1)} ${ny.toFixed(1)}`;
    }).join(' ');
  }, [liveData]);

  const cornerPaths = useMemo(() => {
    if (!liveData || !liveData.samples || liveData.samples.length === 0) return [];
    const lapSamples = liveData.samples.filter(s => s.lap_number === liveData.samples[0].lap_number);
    const paths = new Map<string, string>();
    
    let currentCorner = "";
    let currentPath = "";
    
    lapSamples.forEach(s => {
        const cName = s.current_corner.name;
        if (cName !== "Straight") {
            const nx = 100 - s.target.x;
            const ny = s.target.y;
            if (currentCorner !== cName) {
                if (currentCorner) paths.set(currentCorner, currentPath);
                currentCorner = cName;
                currentPath = `M ${nx.toFixed(1)} ${ny.toFixed(1)}`;
            } else {
                currentPath += ` L ${nx.toFixed(1)} ${ny.toFixed(1)}`;
            }
        } else {
            if (currentCorner) {
                paths.set(currentCorner, currentPath);
                currentCorner = "";
                currentPath = "";
            }
        }
    });
    if (currentCorner) paths.set(currentCorner, currentPath);
    return Array.from(paths.entries());
  }, [liveData]);


  useEffect(() => {
    async function loadData() {
      try {
        setLiveError(null);
        const [data, tyreResult] = await Promise.all([
          fetchLiveAnalysis(requestedContext.sessionKey, targetDriver),
          fetchTyreIntelligence(requestedContext.sessionKey, targetDriver).catch((err) => {
            console.warn("Tyre intelligence stream unavailable", err);
            return null;
          }),
        ]);
        setLiveData(data);
        setTyreData(tyreResult);
        const nextTick = Math.min(currentTickRef.current, Math.max(0, data.samples.length - 1));
        currentTickRef.current = nextTick;
        setCurrentTick(nextTick);
      } catch (err) {
        console.error("Failed to load live analysis data", err);
        setLiveError("Live Intelligence is unavailable for this session.");
      }
    }
    loadData();
  }, [requestedContext.sessionKey, targetDriver]);

  useEffect(() => {
    currentTickRef.current = currentTick;
  }, [currentTick]);

  useEffect(() => {
    if (!liveData?.samples?.length || !requestedContext.hasContext) return;

    const lapSamples = liveData.samples
      .map((sample, index) => ({ sample, index }))
      .filter(({ sample }) => requestedContext.lap === null || sample.lap_number === requestedContext.lap);
    const cornerSamples = requestedContext.corner
      ? lapSamples.filter(({ sample }) => sample.current_corner.name === requestedContext.corner)
      : lapSamples;
    const candidates = cornerSamples.length ? cornerSamples : lapSamples.length ? lapSamples : liveData.samples.map((sample, index) => ({ sample, index }));

    let closest = candidates[0];
    if (requestedContext.progress !== null) {
      closest = candidates.reduce((best, candidate) => {
        const distance = Math.abs(candidate.sample.progress - requestedContext.progress!);
        const bestDistance = Math.abs(best.sample.progress - requestedContext.progress!);
        return distance < bestDistance ? candidate : best;
      });
    } else if (requestedContext.elapsed !== null) {
      closest = candidates.reduce((best, candidate) => {
        const distance = Math.abs(candidate.sample.elapsed - requestedContext.elapsed!);
        const bestDistance = Math.abs(best.sample.elapsed - requestedContext.elapsed!);
        return distance < bestDistance ? candidate : best;
      });
    }

    currentTickRef.current = closest.index;
    setCurrentTick(closest.index);
  }, [liveData, requestedContext]);

  useEffect(() => {
    if (!liveData || !liveData.samples?.length) return;

    let animationFrameId: number;
    let lastTime: number | null = null;
    let currentLogicalTime = liveData.samples[currentTickRef.current].elapsed;

    const tick = (now: number) => {
      if (lastTime === null) {
        lastTime = now;
        animationFrameId = requestAnimationFrame(tick);
        return;
      }

      const deltaMs = now - lastTime;
      lastTime = now;

      // Cap delta time to prevent massive jumps when tab is inactive
      if (deltaMs > 1000) {
        animationFrameId = requestAnimationFrame(tick);
        return;
      }

      currentLogicalTime += (deltaMs / 1000) * playbackSpeed;

      const maxElapsed = liveData.samples[liveData.samples.length - 1].elapsed;
      // Stop cleanly at the end of the race
      if (currentLogicalTime >= maxElapsed) {
        currentLogicalTime = maxElapsed;
        const lastTick = liveData.samples.length - 1;
        if (currentTickRef.current !== lastTick) {
          currentTickRef.current = lastTick;
          setCurrentTick(lastTick);
        }
        return; // End playback
      }

      let newTick = currentTickRef.current;
      
      // Safety if logical time went backwards (shouldn't happen, but just in case)
      if (currentLogicalTime < liveData.samples[newTick].elapsed) {
        newTick = 0;
      }

      while (newTick < liveData.samples.length - 1 && liveData.samples[newTick + 1].elapsed <= currentLogicalTime) {
        newTick++;
      }

      if (newTick !== currentTickRef.current) {
         currentTickRef.current = newTick;
         setCurrentTick(newTick);
      }

      animationFrameId = requestAnimationFrame(tick);
    };

    animationFrameId = requestAnimationFrame(tick);

    return () => cancelAnimationFrame(animationFrameId);
  }, [liveData, playbackSpeed]);

  const currentSample = liveData?.samples?.[currentTick];

  useEffect(() => {
    setLatestFinding(null);
    setRecentFindings([]);
    lastFindingKeyRef.current = null;
  }, [targetDriver, benchmarkDriver]);

  useEffect(() => {
    const sample = currentSample;
    const communication = sample?.communication;
    if (!sample || !communication || communication.state !== 'RADIO_NOW') return;

    const diagnosis = sample.analysis.diagnosis;
    const corner = sample.current_corner.name;
    const eventKey = `${sample.lap_number}|${corner}|${diagnosis}|${communication.state}`;
    if (lastFindingKeyRef.current === eventKey) return;
    lastFindingKeyRef.current = eventKey;

    const finding: CoDriverFinding = {
      eventId: `co-driver-${eventKey}`,
      lap: sample.lap_number,
      corner,
      phase: sample.current_corner.phase,
      diagnosis,
      severity: sample.analysis.severity,
      estimatedTimeDelta: sample.analysis.estimated_time_delta,
      message: sample.analysis.message || sample.analysis.advice || 'Observation logged.',
      advice: sample.analysis.advice || 'Keep pushing.',
      elapsed: sample.elapsed,
      communicationState: communication.state,
      targetDriver,
      benchmarkDriver,
    };
    setLatestFinding(finding);
    setRecentFindings((previous) => [finding, ...previous.filter((item) => item.eventId !== finding.eventId)].slice(0, 3));
  }, [benchmarkDriver, currentSample, targetDriver]);

  const completedThroughLap = currentSample ? Math.max(0, currentSample.lap_number - 1) : null;

  useEffect(() => {
    if (!benchmarkDriver || benchmarkDriver === targetDriver || completedThroughLap === null || completedThroughLap < 1) {
      setRecentComparisons(null);
      return;
    }
    let active = true;
    setCoachingLoading(true);
    setCoachingError(null);
    fetchRecentComparisons(requestedContext.sessionKey, targetDriver, benchmarkDriver, completedThroughLap, 3)
      .then((result) => {
        if (active) setRecentComparisons(result);
      })
      .catch((err) => {
        console.warn('Lap coaching unavailable', err);
        if (active) {
          setRecentComparisons(null);
          setCoachingError('Completed-lap coaching is unavailable.');
        }
      })
      .finally(() => {
        if (active) setCoachingLoading(false);
      });
    return () => {
      active = false;
    };
  }, [benchmarkDriver, completedThroughLap, requestedContext.sessionKey, targetDriver]);

  useEffect(() => {
    if (!benchmarkDriver || benchmarkDriver === targetDriver || completedThroughLap === null || completedThroughLap < 1) {
      setHistoryLaps([]);
      setHistoryLoading(false);
      return;
    }
    let active = true;
    setHistoryLoading(true);
    fetchCompletedComparisonLaps(requestedContext.sessionKey, targetDriver, benchmarkDriver, completedThroughLap)
      .then((result) => {
        if (active) setHistoryLaps(result.laps);
      })
      .catch((err) => {
        console.warn('Completed lap history unavailable', err);
        if (active) setHistoryLaps([]);
      })
      .finally(() => {
        if (active) setHistoryLoading(false);
      });
    return () => {
      active = false;
    };
  }, [benchmarkDriver, completedThroughLap, requestedContext.sessionKey, targetDriver]);

  if (liveData && !liveData.samples?.length) {
    return (
      <div className="min-h-screen bg-[#070709] pt-24 pb-12 flex items-center justify-center px-6">
        <div className="w-full max-w-md rounded-xl border border-chrome/10 bg-[#111316] p-8 text-center font-mono text-xs uppercase tracking-widest text-ink-muted">No historical telemetry is available for this session.</div>
      </div>
    );
  }

  if (!currentSample && !liveData) {
    return (
      <div className="min-h-screen bg-[#070709] pt-24 pb-12 flex items-center justify-center px-6">
        <div className="w-full max-w-md rounded-xl border border-chrome/10 bg-[#111316] p-8 text-center text-chrome/60">
          {liveError ? (
            <span className="font-mono text-xs uppercase tracking-widest">{liveError}</span>
          ) : (
            <>
              <RefreshCcw className="mx-auto mb-4 h-8 w-8 animate-spin" />
              <span className="font-mono text-xs uppercase tracking-widest">Establishing Telemetry Link...</span>
            </>
          )}
        </div>
      </div>
    );
  }

  // Fallback if data is not fully loaded but we have the shell
  const safeSample = currentSample || ({
    elapsed: 0,
    lap_number: 0,
    progress: 0,
    target: { x: 50, y: 50, speed: 0, gear: 0, brake: 0, throttle: 0 },
    benchmark: { speed: 0, gear: 0, brake: 0, throttle: 0 },
    current_corner: { name: "--", phase: "--" },
    comparison: { entry_speed_delta: 0, minimum_speed_delta: 0, exit_speed_delta: 0, braking_delta: 0, throttle_delay: 0 },
    analysis: { diagnosis: "None", severity: "low", advice: "Waiting for telemetry...", message: "Monitoring telemetry.", estimated_time_delta: 0, confidence: 1 },
    race_context: { position: null, gap_behind: null, driver_behind: null, battle_active: false, is_defending: false, position_event: "NO_CHANGE" },
    communication: { state: "MONITORING", should_speak: false, priority: null, reason: null, cooldown_remaining: 0 }
  } as unknown as import("@/lib/api").LiveAnalysisSample);

  const lapNum = safeSample.lap_number || "--";
  const targetMeta = drivers.find((driver) => driver.driver_number === targetDriver);
  const benchmarkMeta = drivers.find((driver) => driver.driver_number === benchmarkDriver);
  const targetAcronym = targetMeta?.name_acronym || `#${targetDriver}`;
  const benchmarkAcronym = benchmarkMeta?.name_acronym || (benchmarkDriver ? `#${benchmarkDriver}` : '--');
  const targetX = (typeof safeSample?.target?.x === 'number' && !isNaN(safeSample.target.x)) ? safeSample.target.x : 50;
  const targetY = (typeof safeSample?.target?.y === 'number' && !isNaN(safeSample.target.y)) ? safeSample.target.y : 50;
  const normalizedX = 100 - targetX;
  const normalizedY = targetY;

  const isStraight = safeSample.current_corner.name === "Straight";

  const getLastCornerSample = () => {
    if (!liveData || !liveData.samples || liveData.samples.length === 0) return null;
    const startIdx = Math.min(currentTick, liveData.samples.length - 1);
    for (let i = startIdx; i >= 0; i--) {
      const s = liveData.samples[i];
      if (s && s.current_corner && s.current_corner.name !== "Straight") {
        return s;
      }
    }
    return null;
  };

  const effectiveSample = (isStraight && safeSample.communication.state !== "RADIO_NOW") 
    ? (getLastCornerSample() || safeSample) 
    : safeSample;

  const ctx = effectiveSample.race_context || { position: 1, battle_active: false, is_defending: false, gap_behind: null, position_event: "NO_CHANGE" };
  const position = ctx.position !== null ? ctx.position : "--";
  const comm = effectiveSample.communication || { state: "MONITORING", should_speak: false, priority: null, reason: null, cooldown_remaining: 0 };

  const effectiveIsStraight = effectiveSample.current_corner.name === "Straight";
  const effectiveIsGood = effectiveSample.analysis.diagnosis === "GOOD" || effectiveSample.analysis.diagnosis === "None";

  // Semantic overrides for straight
  const displayDiagnosis = effectiveIsStraight ? "CLEAR RUN" : (effectiveIsGood ? "NO SIGNIFICANT DEFICIT" : effectiveSample.analysis.diagnosis.replace(/_/g, ' '));
  const isActionable = !effectiveIsStraight && !effectiveIsGood && effectiveSample.analysis.diagnosis !== "None";

  // Contextual Metrics for Middle Area
  const getContextualMetrics = () => {
    if (effectiveIsStraight || effectiveIsGood) return null;

    const diag = effectiveSample.analysis.diagnosis;
    if (diag === "EARLY_BRAKING") {
      return [
        { label: "BRAKE POINT", val: `${Math.abs(effectiveSample.comparison.braking_delta)}m EARLY` },
        { label: "ENTRY SPEED", val: `${effectiveSample.comparison.entry_speed_delta > 0 ? '+' : ''}${effectiveSample.comparison.entry_speed_delta} km/h` }
      ];
    }
    if (diag === "LATE_THROTTLE") {
      return [
        { label: "THROTTLE DELAY", val: `+${effectiveSample.comparison.throttle_delay}s LATE` },
        { label: "EXIT SPEED", val: `${effectiveSample.comparison.exit_speed_delta > 0 ? '+' : ''}${effectiveSample.comparison.exit_speed_delta} km/h` }
      ];
    }
    if (diag === "LOW_MIN_SPEED") {
      return [
        { label: "MIN SPEED", val: `${effectiveSample.comparison.minimum_speed_delta > 0 ? '+' : ''}${effectiveSample.comparison.minimum_speed_delta} km/h` },
        { label: "EXIT SPEED", val: `${effectiveSample.comparison.exit_speed_delta > 0 ? '+' : ''}${effectiveSample.comparison.exit_speed_delta} km/h` }
      ];
    }
    if (diag === "LOW_EXIT_SPEED") {
      return [
        { label: "EXIT SPEED", val: `${effectiveSample.comparison.exit_speed_delta > 0 ? '+' : ''}${effectiveSample.comparison.exit_speed_delta} km/h` },
        { label: "THROTTLE TIMING", val: `+${effectiveSample.comparison.throttle_delay}s` }
      ];
    }
    return null;
  };

  const metrics = getContextualMetrics();

  const observationMessage = effectiveSample.analysis.message || "Monitoring telemetry.";
  const instructionMessage = effectiveSample.analysis.advice || "Keep pushing.";

  const nearbyRadio = effectiveSample.voice_context || null;

  return (
    <div className="min-h-screen bg-[#0a0a0c] pt-20 pb-32 flex flex-col font-body text-ink">

      {/* COMPACT TOP BAR */}
      <div className="w-full bg-[#111316] border-b border-chrome/10 px-6 py-2 flex flex-wrap items-center justify-between gap-y-2 shrink-0 fixed top-20 left-0 right-0 z-30">
        <div className="flex items-center gap-4">
          <span className="font-display font-bold uppercase tracking-widest text-xs text-ink"><span className="hidden sm:inline">LIVE INTELLIGENCE</span><span className="sm:hidden">LIVE</span></span>
          <span className="hidden sm:inline font-mono text-[9px] text-chrome/50 tracking-[0.2em] uppercase">SINGAPORE GP · RACE · 2023</span>
        </div>

        <div className="flex flex-wrap items-center justify-end gap-2 sm:gap-4 font-mono text-[10px] uppercase tracking-widest">
          <div className="flex items-center gap-1.5 font-bold">
            <span className="text-[#3671C6]">{targetAcronym}</span>
            <span className="text-ink flex items-center">
              P{position}
              {ctx.position_event === "POSITION_GAIN" && <ArrowUpRight className="w-3 h-3 text-emerald-400 ml-0.5" />}
              {ctx.position_event === "POSITION_LOSS" && <ArrowDownRight className="w-3 h-3 text-brand-red ml-0.5" />}
            </span>
            <span className="text-chrome/30 mx-1">|</span>
            <span className="text-chrome/60">LAP {lapNum}/62</span>
          </div>
          <div className="flex items-center gap-1 ml-2 mr-2">
            {[1, 2, 5, 10, 20].map(s => (
              <button
                key={s}
                onClick={() => setPlaybackSpeed(s)}
                className={cn(
                  "px-1.5 py-0.5 rounded font-mono text-[9px] border transition-colors",
                  playbackSpeed === s ? "bg-chrome/80 text-ink font-bold border-chrome/80" : "bg-transparent text-chrome/50 border-chrome/20 hover:text-chrome/80"
                )}
              >
                {s}x
              </button>
            ))}
          </div>
          <div className="flex items-center gap-2 text-brand-red animate-pulse border border-brand-red/20 bg-brand-red/10 px-2 py-0.5 rounded-sm">
            <span className="w-1.5 h-1.5 rounded-full bg-brand-red" />
            <span className="text-[9px] font-bold">ARCHIVE</span>
          </div>
        </div>
      </div>

      {/* DENSE ENGINEERING MAIN AREA */}
      <div className="flex-1 w-full max-w-7xl mx-auto pt-16 pb-20 px-6 flex flex-col justify-center">

        <div className="mb-6 rounded-xl border border-chrome/10 bg-[#111316] p-4 md:p-5">
          <div className="flex flex-wrap items-end gap-4">
            <label className="flex min-w-[190px] flex-1 flex-col gap-2">
              <span className="font-mono text-[9px] uppercase tracking-[0.2em] text-ink-muted">MY DRIVER</span>
              <select
                value={targetDriver}
                onChange={(event) => {
                  const nextDriver = Number(event.target.value);
                  setTargetDriver(nextDriver);
                  setBenchmarkDriver(null);
                  setLiveData(null);
                }}
                className="rounded border border-chrome/20 bg-[#0a0a0c] px-3 py-2 font-mono text-xs uppercase tracking-widest text-ink outline-none focus:border-brand-red"
              >
                {drivers.map((driver) => <option key={driver.driver_number} value={driver.driver_number}>{driver.name_acronym} · {driver.team_name} · #{driver.driver_number}</option>)}
              </select>
            </label>
            <div className="hidden pb-2 font-display text-xl text-chrome/30 sm:block">VS</div>
            <label className="flex min-w-[190px] flex-1 flex-col gap-2">
              <span className="font-mono text-[9px] uppercase tracking-[0.2em] text-ink-muted">COMPARE AGAINST</span>
              <select
                value={benchmarkDriver ?? ''}
                onChange={(event) => setBenchmarkDriver(Number(event.target.value))}
                disabled={!drivers.length}
                className="rounded border border-chrome/20 bg-[#0a0a0c] px-3 py-2 font-mono text-xs uppercase tracking-widest text-ink outline-none focus:border-brand-red disabled:opacity-50"
              >
                {benchmarkDriver === null && <option value="">SELECTING BENCHMARK...</option>}
                {drivers.filter((driver) => driver.driver_number !== targetDriver).map((driver) => <option key={driver.driver_number} value={driver.driver_number}>{driver.name_acronym} · {driver.team_name} · #{driver.driver_number}</option>)}
              </select>
            </label>
            <div className="pb-2 font-mono text-[9px] uppercase tracking-widest text-chrome/50">{targetAcronym} vs {benchmarkAcronym}</div>
          </div>
        </div>

        <LapCoachingPanel
          targetDriver={targetMeta}
          benchmarkDriver={benchmarkMeta}
          recent={recentComparisons}
          loading={coachingLoading || benchmarkDriver === null}
          error={coachingError}
          communicationState={String(comm.state)}
          sessionKey={requestedContext.sessionKey}
          currentLiveLap={safeSample.lap_number || null}
          historyLaps={historyLaps}
          historyLoading={historyLoading}
        />

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-stretch">

          {/* COLUMN 1: CURRENT CORNER & TRACK */}
          <div className="bg-[#111316] border border-chrome/10 rounded flex flex-col overflow-hidden">
            <div className="p-5 border-b border-chrome/10 flex-1">
              <div className="font-mono text-[9px] text-chrome/50 uppercase tracking-[0.2em] mb-4">
                CURRENT SECTION
              </div>
              <AnimatePresence mode="wait">
                <motion.div
                  key={safeSample.current_corner.name}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.2 }}
                >
                  <div className="font-display text-5xl font-black uppercase tracking-tighter text-ink mb-1">
                    {safeSample.current_corner.name}
                  </div>
                  <div className={cn(
                    "font-mono text-sm font-bold uppercase tracking-widest",
                    isStraight ? "text-chrome/50" : "text-brand-red"
                  )}>
                    {isStraight ? "STRAIGHT" : safeSample.current_corner.phase}
                  </div>
                </motion.div>
              </AnimatePresence>
            </div>

            {/* SUPPORTING TRACK MAP */}
            <div className="h-80 bg-[#0a0a0c] relative overflow-hidden flex items-center justify-center p-4">
               <div className="absolute top-2 left-2 flex items-center gap-1.5 font-mono text-[8px] text-chrome/40 uppercase tracking-widest z-10">
                  <MapIcon className="w-2.5 h-2.5" />
                  TRACK POS
               </div>
               
               <AnimatePresence>
                 {hoverCorner && !selectedCorner && (
                    <motion.div 
                      initial={{ opacity: 0, y: -5 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -5 }}
                      className="absolute top-2 right-2 bg-[#111316] border border-chrome/10 px-3 py-1.5 rounded z-20 text-center shadow-lg"
                    >
                      <div className="font-display font-black text-xl text-ink leading-none">{hoverCorner}</div>
                      <div className="font-mono text-[8px] text-brand-red uppercase tracking-widest mt-0.5">Click for History</div>
                    </motion.div>
                 )}
               </AnimatePresence>

               {trackPath && (
                 <svg viewBox="-10 -10 120 120" className="w-full h-full overflow-visible">
                  <path d={trackPath} fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
                  {/* Optionally draw a closing line if start/finish line is separated */}
                  {trackPath.split(' ').length >= 3 && (
                    <path d={`${trackPath.split(' ')[0]} ${trackPath.split(' ')[1]} ${trackPath.split(' ')[2]} L ${trackPath.split(' ').slice(-2).join(' ')}`} fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth="3" strokeDasharray="2 2" />
                  )}

                  {/* Corner Hitboxes */}
                  {cornerPaths.map(([cName, path]) => (
                    <path
                      key={cName}
                      d={path}
                      fill="none"
                      stroke={selectedCorner === cName ? "#E10600" : "transparent"}
                      strokeWidth={selectedCorner === cName ? "4" : "10"}
                      strokeLinecap="round"
                      className={cn("cursor-pointer transition-colors", selectedCorner !== cName && "hover:stroke-chrome/20")}
                      onClick={() => setSelectedCorner(cName)}
                      onMouseEnter={() => setHoverCorner(cName)}
                      onMouseLeave={() => setHoverCorner(null)}
                    />
                  ))}

                  {/* Other Drivers */}
                  {safeSample.others && Object.entries(safeSample.others).map(([drId, pos]) => {
                    if (Number(drId) === benchmarkDriver) return null;
                    if (!pos || typeof pos.x !== 'number' || typeof pos.y !== 'number' || isNaN(pos.x) || isNaN(pos.y)) return null;
                    return <circle key={drId} cx={100 - pos.x} cy={pos.y} r="1.5" fill="rgba(255,255,255,0.3)" style={{ transition: 'all 50ms linear' }} />;
                  })}

                  {/* Benchmark Driver (offset slightly since distance-aligned telemetry means X,Y matches exactly) */}
                  {benchmarkDriver && benchmarkAcronym !== '--' && (
                    <>
                      <circle cx={normalizedX - 2.5} cy={normalizedY + 2.5} r="2.5" fill="#FFFFFF" style={{ transition: 'all 50ms linear' }} />
                      <text x={normalizedX - 16} y={normalizedY + 4} className="font-mono text-[6px] font-bold" fill="#fff" style={{ transition: 'all 50ms linear' }}>{benchmarkAcronym}</text>
                    </>
                  )}

                  {/* Target Driver */}
                  <circle cx={normalizedX} cy={normalizedY} r="3" fill="#3671C6" style={{ transition: 'all 50ms linear' }} />
                   <text x={normalizedX + 5} y={normalizedY + 1.5} className="font-mono text-[7px] font-bold" fill="#fff" style={{ transition: 'all 50ms linear' }}>{targetAcronym}</text>
                 </svg>
               )}
            </div>
          </div>

          {/* COLUMN 2: CONTEXTUAL TELEMETRY */}
          <div className="bg-[#111316] border border-chrome/10 rounded p-5 flex flex-col">
            <div className="font-mono text-[9px] text-chrome/50 uppercase tracking-[0.2em] mb-4">
              CONTEXTUAL TELEMETRY
            </div>

            <div className="flex items-center gap-8 mb-6 border-b border-chrome/10 pb-6">
              <div>
                <div className="font-mono text-[9px] text-chrome/50 uppercase tracking-[0.2em] mb-1">YOU</div>
                <div className="font-numeric text-3xl text-ink">
                  {safeSample.target.speed}
                  <span className="text-[10px] font-mono text-chrome/50 ml-1 uppercase">km/h</span>
                </div>
              </div>
              <div>
                <div className="font-mono text-[9px] text-chrome/50 uppercase tracking-[0.2em] mb-1">COMPARE AGAINST</div>
                <div className="font-display text-2xl font-bold text-ink">{benchmarkAcronym}</div>
                <span className="text-[10px] font-mono text-chrome/50 uppercase">completed-lap coaching</span>
              </div>
            </div>

            <AnimatePresence mode="wait">
              <motion.div
                key={effectiveIsStraight ? 'straight' : effectiveSample.analysis.diagnosis}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.2 }}
                className="flex flex-col flex-1"
              >
                {!effectiveIsStraight && !effectiveIsGood && metrics && (
                  <div className="grid grid-cols-2 gap-6 mb-6">
                    {metrics.map((m, i) => (
                      <div key={i} className="bg-[#0a0a0c] p-3 rounded border border-chrome/10">
                        <div className="font-mono text-[9px] text-chrome/50 uppercase tracking-[0.2em] mb-1">{m.label}</div>
                        <div className="font-mono text-lg text-ink font-bold">{m.val}</div>
                      </div>
                    ))}
                  </div>
                )}

                {(!effectiveIsStraight && !effectiveIsGood && metrics) ? (
                  <div className="mt-auto">
                    <div className="font-mono text-[9px] text-chrome/50 uppercase tracking-[0.2em] mb-2">TELEMETRY MATCH</div>
                    <div className="font-mono text-xs text-brand-red">EVIDENCE SUPPORTS DIAGNOSIS</div>
                  </div>
                ) : (
                  <div className="mt-auto flex items-center justify-center h-full">
                     <span className="font-mono text-xs text-chrome/40 uppercase tracking-widest">
                       {effectiveIsStraight ? "WAITING FOR CORNER..." : "AWAITING ACTIONABLE DATA"}
                     </span>
                  </div>
                )}
              </motion.div>
            </AnimatePresence>
          </div>

          {/* COLUMN 3: CO-DRIVER BRIEFING */}
           <div className="bg-[#111316] border border-chrome/10 rounded p-5 flex flex-col relative overflow-hidden">

             <div className="flex items-start justify-between mb-8">
               <div className={cn(
                "font-mono text-[9px] uppercase tracking-[0.2em] flex items-center gap-1.5 transition-colors",
                comm.state === "RADIO_NOW" ? "text-brand-red font-bold" : (comm.state === "ATTENTION" ? "text-amber-400" : "text-chrome/50")
              )}>
                <Cpu className="w-3 h-3" />
                 CO-DRIVER
                <span className="ml-1 border-l border-current pl-2">
                  {comm.state === "RADIO_NOW" ? "RADIO NOW" : comm.state}
                </span>
               </div>
             </div>

             <div className="font-mono text-[9px] text-chrome/40 uppercase tracking-[0.2em] mb-3">CURRENT LIVE STATE</div>

             <AnimatePresence mode="wait">
              <motion.div
                key={comm.state + displayDiagnosis}
                initial={{ opacity: 0, y: comm.state === "RADIO_NOW" ? 5 : 0 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: comm.state === "RADIO_NOW" ? -5 : 0 }}
                transition={{ duration: 0.2 }}
                 className={cn("flex flex-col", comm.state === "RADIO_NOW" && "border-l-2 border-brand-red/50 pl-3")}
               >
               {comm.state === "MONITORING" ? (
                   <div className="flex flex-col items-center justify-center py-8 text-center">
                     <div className="font-display text-2xl font-bold uppercase text-chrome/40 mb-2">MONITORING</div>
                     <div className="font-mono text-xs text-chrome/30 uppercase tracking-widest mb-4">No instruction required</div>
                     {latestFinding && (
                       <div className="font-mono text-[10px] text-chrome/50 uppercase tracking-widest border border-chrome/10 rounded px-3 py-1 bg-white/[0.02]">
                         Last instruction · {latestFinding.corner} · {Math.max(0, Math.round(safeSample.elapsed - latestFinding.elapsed))}s ago
                       </div>
                     )}
                   </div>
                ) : comm.state === "ATTENTION" ? (
                    <div className="flex flex-col py-6">
                      <div className="font-display text-2xl font-bold uppercase text-amber-400 mb-2">ATTENTION</div>
                      <div className="font-mono text-xs text-amber-400 uppercase tracking-widest">{effectiveSample.current_corner.name} · {effectiveSample.analysis.diagnosis.replace(/_/g, ' ')}</div>
                    </div>
                ) : (
                  <>
                    {/* ISSUE */}
                    <div className="mb-6">
                      <div className="font-mono text-[9px] text-chrome/50 uppercase tracking-[0.2em] mb-1">THE ISSUE</div>
                      <div className={cn(
                        "font-display text-3xl font-bold uppercase tracking-tight text-brand-red"
                      )}>
                        {effectiveIsStraight && ctx.battle_active ? "STRATEGIC RACE CONTEXT" : displayDiagnosis}
                      </div>
                      {!effectiveIsStraight && (
                        <div className="font-mono text-[10px] text-chrome/60 uppercase tracking-widest mt-1">
                          {effectiveSample.current_corner.name} · {effectiveSample.current_corner.phase}
                        </div>
                      )}
                    </div>

                    {/* COST & RACE CONTEXT ROW */}
                    <div className="flex flex-wrap gap-8 mb-6 pb-6 border-b border-chrome/10">
                      {/* COST */}
                      {isActionable && !effectiveIsStraight && (
                        <div>
                          <div className="font-mono text-[9px] text-chrome/50 uppercase tracking-[0.2em] mb-2">THE COST</div>
                          {effectiveSample.analysis.confidence < 0.5 ? (
                            <div className="font-mono text-sm text-chrome/50 font-bold uppercase tracking-widest">UNRESOLVED</div>
                          ) : (
                            <div>
                              <div className="font-numeric text-4xl font-bold leading-none text-brand-red">
                                +{effectiveSample.analysis.estimated_time_delta?.toFixed(3)}s
                              </div>
                              <div className="font-mono text-[9px] uppercase tracking-[0.2em] mt-1 font-bold text-brand-red/80">TIME LOST</div>
                            </div>
                          )}
                        </div>
                      )}

                      {/* RACE CONTEXT */}
                      {ctx.battle_active && (
                        <div>
                          <div className="font-mono text-[9px] text-chrome/50 uppercase tracking-[0.2em] mb-2">RACE CONTEXT</div>
                          <div className="flex flex-col gap-1">
                            <div className="font-mono text-[10px] font-bold uppercase tracking-[0.2em] border px-2 py-1 rounded-sm w-max border-brand-red/20 bg-brand-red/10 text-brand-red">
                              {ctx.is_defending ? "DEFENDING" : "ATTACKING"} · {ctx.gap_behind}s {ctx.is_defending ? "BEHIND" : "AHEAD"}
                            </div>
                            <div className="font-mono text-[10px] text-chrome/80 uppercase tracking-widest">
                              P{position}
                            </div>
                          </div>
                        </div>
                      )}
                    </div>

                    {/* RADIO PROMPTER */}
                    <div className="mt-auto">
                      <div className="font-mono text-[9px] text-chrome/50 uppercase tracking-[0.2em] mb-4">RADIO PROMPTER</div>
                      <div className="flex flex-col gap-5">
                        <div>
                          <div className="font-mono text-[9px] text-chrome/40 uppercase tracking-widest mb-1">OBSERVATION:</div>
                          <div className="font-body text-white/80 text-lg leading-snug">
                            "{observationMessage}"
                          </div>
                        </div>
                        <div>
                          <div className="font-mono text-[9px] text-brand-red/80 font-bold uppercase tracking-widest mb-1">INSTRUCTION:</div>
                          <div className="font-body text-xl font-bold text-white leading-tight">
                            "{instructionMessage}"
                          </div>
                        </div>
                        {nearbyRadio && (
                          <div className="pt-4 border-t border-chrome/10">
                            <div className="font-mono text-[9px] text-chrome/40 uppercase tracking-widest mb-1">RECENT RADIO:</div>
                            <div className="font-body text-sm text-chrome/70 italic">
                              "{nearbyRadio.transcript}"
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  </>
                )}
              </motion.div>
             </AnimatePresence>



           </div>

        </div>
      </div>

      {/* BOTTOM DOCKED STRIP: TYRE HEALTH HUD & TELEMETRY GAUGES */}
      <div className="fixed bottom-0 left-0 right-0 z-30 flex flex-col shadow-[0_-8px_24px_rgba(0,0,0,0.6)]">
        <TyreHealthHUD
          sample={safeSample}
          currentLap={typeof lapNum === 'number' ? lapNum : Number(safeSample.lap_number || 1)}
          tyreData={tyreData}
        />

        {/* TELEMETRY STRIP */}
        <div className="w-full bg-[#070709] border-t border-chrome/10 py-2 px-4 sm:px-6">
          <div className="max-w-7xl mx-auto flex flex-wrap items-center justify-between font-mono text-[10px] text-chrome/50 uppercase tracking-widest gap-2">
            <div className="flex gap-4 sm:gap-6">
              <div className="flex items-center gap-2">
                <span>SPD</span>
                <span className="text-ink font-bold">{safeSample.target.speed}</span>
              </div>
              <div className="flex items-center gap-2">
                <span>GEAR</span>
                <span className="text-ink font-bold">{safeSample.target.gear}</span>
              </div>
              <div className="flex items-center gap-2">
                <span>THR</span>
                <span className="text-ink font-bold">{safeSample.target.throttle}%</span>
              </div>
              <div className="flex items-center gap-2">
                <span>BRK</span>
                <span className="text-ink font-bold">{safeSample.target.brake}%</span>
              </div>
              <div className="hidden sm:flex items-center gap-2">
                <span>RPM</span>
                <span className="text-ink font-bold">{(() => {
                  const speed = safeSample.target.speed || 0;
                  const gear = safeSample.target.gear || 1;
                  const rpm = Math.min(15000, Math.max(4000, Math.round(speed * 45 + gear * 800)));
                  return rpm >= 1000 ? `${(rpm / 1000).toFixed(1)}K` : rpm;
                })()}</span>
              </div>
            </div>
            <div className="hidden md:flex gap-6">
              <div className="flex items-center gap-2">
                <span>LAP</span>
                <span className="text-ink font-bold">{lapNum}</span>
              </div>
              <div className="flex items-center gap-2">
                <span>PROGRESS</span>
                <span className="text-ink font-bold">{(safeSample.progress * 100).toFixed(1)}%</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      <CornerHistoryPanel 
        sessionKey={requestedContext.sessionKey} 
        driverNumber={targetDriver} 
        corner={selectedCorner} 
        liveCorner={safeSample.current_corner.name}
        onClose={() => setSelectedCorner(null)} 
      />

    </div>
  );
}
