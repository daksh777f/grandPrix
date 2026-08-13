import { useState, useEffect, useRef, useMemo } from 'react';
import { Map as MapIcon, ArrowUpRight, ArrowDownRight, RefreshCcw, Cpu } from 'lucide-react';
import { fetchLiveAnalysis, type LiveAnalysisData } from '@/lib/api';
import { motion, AnimatePresence } from 'motion/react';
import { cn } from '@/lib/utils';

export function LiveIntelligencePage() {
  const [liveData, setLiveData] = useState<LiveAnalysisData | null>(null);
  const [playbackSpeed, setPlaybackSpeed] = useState<number>(1);
  const [currentTick, setCurrentTick] = useState(0);
  const currentTickRef = useRef(0);

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


  useEffect(() => {
    async function loadData() {
      try {
        const data = await fetchLiveAnalysis(9165, 1);
        setLiveData(data);
      } catch (err) {
        console.error("Failed to load live analysis data", err);
      }
    }
    loadData();
  }, []);

  useEffect(() => {
    currentTickRef.current = currentTick;
  }, [currentTick]);

  useEffect(() => {
    if (!liveData || !liveData.samples?.length) return;

    let animationFrameId: number;
    let lastTime = performance.now();
    let currentLogicalTime = liveData.samples[currentTickRef.current].elapsed;

    const tick = (now: number) => {
      const deltaMs = now - lastTime;
      lastTime = now;

      currentLogicalTime += (deltaMs / 1000) * playbackSpeed;

      const maxElapsed = liveData.samples[liveData.samples.length - 1].elapsed;
      if (currentLogicalTime > maxElapsed) {
        currentLogicalTime = liveData.samples[0].elapsed;
      }

      let newTick = currentTickRef.current;
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

  if (!currentSample && !liveData) {
    return (
      <div className="min-h-screen bg-[#070709] pt-24 pb-12 flex items-center justify-center">
        <div className="flex flex-col items-center gap-4 text-chrome/50">
          <RefreshCcw className="w-8 h-8 animate-spin" />
          <span className="font-mono text-xs uppercase tracking-widest">Establishing Telemetry Link...</span>
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
  const normalizedX = liveData ? (100 - safeSample.target.x) : 50;
  const normalizedY = liveData ? safeSample.target.y : 50;

  const ctx = safeSample.race_context || { position: 1, battle_active: false, is_defending: false, gap_behind: null, position_event: "NO_CHANGE" };
  const position = ctx.position !== null ? ctx.position : "--";
  const comm = safeSample.communication || { state: "MONITORING", should_speak: false, priority: null, reason: null, cooldown_remaining: 0 };

  const isStraight = safeSample.current_corner.name === "Straight";
  const isGood = safeSample.analysis.diagnosis === "GOOD" || safeSample.analysis.diagnosis === "None";

  // Semantic overrides for straight
  const displayDiagnosis = isStraight ? "CLEAR RUN" : (isGood ? "NO SIGNIFICANT DEFICIT" : safeSample.analysis.diagnosis.replace(/_/g, ' '));
  const isActionable = !isStraight && !isGood && safeSample.analysis.diagnosis !== "None";

  // Contextual Metrics for Middle Area
  const getContextualMetrics = () => {
    if (isStraight || isGood) return null;

    const diag = safeSample.analysis.diagnosis;
    if (diag === "EARLY_BRAKING") {
      return [
        { label: "BRAKE POINT", val: `${Math.abs(safeSample.comparison.braking_delta)}m EARLY` },
        { label: "ENTRY SPEED", val: `${safeSample.comparison.entry_speed_delta > 0 ? '+' : ''}${safeSample.comparison.entry_speed_delta} km/h` }
      ];
    }
    if (diag === "LATE_THROTTLE") {
      return [
        { label: "THROTTLE DELAY", val: `+${safeSample.comparison.throttle_delay}s LATE` },
        { label: "EXIT SPEED", val: `${safeSample.comparison.exit_speed_delta > 0 ? '+' : ''}${safeSample.comparison.exit_speed_delta} km/h` }
      ];
    }
    if (diag === "LOW_MIN_SPEED") {
      return [
        { label: "MIN SPEED", val: `${safeSample.comparison.minimum_speed_delta > 0 ? '+' : ''}${safeSample.comparison.minimum_speed_delta} km/h` },
        { label: "EXIT SPEED", val: `${safeSample.comparison.exit_speed_delta > 0 ? '+' : ''}${safeSample.comparison.exit_speed_delta} km/h` }
      ];
    }
    if (diag === "LOW_EXIT_SPEED") {
      return [
        { label: "EXIT SPEED", val: `${safeSample.comparison.exit_speed_delta > 0 ? '+' : ''}${safeSample.comparison.exit_speed_delta} km/h` },
        { label: "THROTTLE TIMING", val: `+${safeSample.comparison.throttle_delay}s` }
      ];
    }
    return null;
  };

  const metrics = getContextualMetrics();

  const observationMessage = safeSample.analysis.message || "Monitoring telemetry.";
  const instructionMessage = safeSample.analysis.advice || "Keep pushing.";
  const isRadioNow = comm.state === "RADIO_NOW";

  return (
    <div className="min-h-screen bg-[#0a0a0c] pt-20 flex flex-col font-body text-ink">

      {/* COMPACT TOP BAR */}
      <div className="w-full bg-[#111316] border-b border-chrome/10 px-6 py-2 flex items-center justify-between shrink-0 fixed top-20 left-0 right-0 z-30">
        <div className="flex items-center gap-4">
          <span className="font-display font-bold uppercase tracking-widest text-xs text-ink">LIVE INTELLIGENCE</span>
          <span className="hidden sm:inline font-mono text-[9px] text-chrome/50 tracking-[0.2em] uppercase">SINGAPORE GP · RACE · 2023</span>
        </div>

        <div className="flex items-center gap-4 font-mono text-[10px] uppercase tracking-widest">
          <div className="flex items-center gap-1.5 font-bold">
            <span className="text-[#3671C6]">VER</span>
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
            <span className="text-[9px] font-bold">LIVE</span>
          </div>
        </div>
      </div>

      {/* DENSE ENGINEERING MAIN AREA */}
      <div className="flex-1 w-full max-w-7xl mx-auto pt-16 pb-20 px-6 flex flex-col justify-center">

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
               {trackPath && (
                 <svg viewBox="-10 -10 120 120" className="w-full h-full overflow-visible">
                  <path d={trackPath} fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
                  {/* Optionally draw a closing line if start/finish line is separated */}
                  <path d={`${trackPath.split(' ')[0]} ${trackPath.split(' ')[1]} ${trackPath.split(' ')[2]} L ${trackPath.split(' ').slice(-2).join(' ')}`} fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth="3" strokeDasharray="2 2" />

                  {/* Other Drivers */}
                  {safeSample.others && Object.entries(safeSample.others).map(([drId, pos]) => (
                    <circle key={drId} cx={100 - pos.x} cy={pos.y} r="1.5" fill="rgba(255,255,255,0.3)" style={{ transition: 'all 50ms linear' }} />
                  ))}

                  {/* Target Driver */}
                  <circle cx={normalizedX} cy={normalizedY} r="3" fill="#3671C6" style={{ transition: 'all 50ms linear' }} />
                  <text x={normalizedX + 5} y={normalizedY + 1.5} className="font-mono text-[7px] font-bold" fill="#fff" style={{ transition: 'all 50ms linear' }}>VER</text>
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
                <div className="font-mono text-[9px] text-chrome/50 uppercase tracking-[0.2em] mb-1">BEST</div>
                <div className="font-numeric text-3xl text-ink">
                  {safeSample.benchmark.speed}
                  <span className="text-[10px] font-mono text-chrome/50 ml-1 uppercase">km/h</span>
                </div>
              </div>
            </div>

            <AnimatePresence mode="wait">
              <motion.div
                key={isStraight ? 'straight' : safeSample.analysis.diagnosis}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.2 }}
                className="flex flex-col flex-1"
              >
                {!isStraight && !isGood && metrics && (
                  <div className="grid grid-cols-2 gap-6 mb-6">
                    {metrics.map((m, i) => (
                      <div key={i} className="bg-[#0a0a0c] p-3 rounded border border-chrome/10">
                        <div className="font-mono text-[9px] text-chrome/50 uppercase tracking-[0.2em] mb-1">{m.label}</div>
                        <div className="font-mono text-lg text-ink font-bold">{m.val}</div>
                      </div>
                    ))}
                  </div>
                )}

                {(!isStraight && !isGood && metrics) ? (
                  <div className="mt-auto">
                    <div className="font-mono text-[9px] text-chrome/50 uppercase tracking-[0.2em] mb-2">TELEMETRY MATCH</div>
                    <div className="font-mono text-xs text-brand-red">EVIDENCE SUPPORTS DIAGNOSIS</div>
                  </div>
                ) : (
                  <div className="mt-auto flex items-center justify-center h-full">
                     <span className="font-mono text-xs text-chrome/40 uppercase tracking-widest">
                       {isStraight ? "WAITING FOR CORNER..." : "AWAITING ACTIONABLE DATA"}
                     </span>
                  </div>
                )}
              </motion.div>
            </AnimatePresence>
          </div>

          {/* COLUMN 3: CO-DRIVER BRIEFING */}
          <div className="bg-[#111316] border border-chrome/10 rounded p-5 flex flex-col relative overflow-hidden">
            {/* The flashing header is removed as requested by the user, we will just tint the border instead */}

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

            <AnimatePresence mode="wait">
              <motion.div
                key={comm.state + displayDiagnosis}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.2 }}
                className="flex flex-col flex-1"
              >
                {comm.state === "MONITORING" ? (
                  <div className="flex flex-col items-center justify-center h-full text-center mt-8">
                     <div className="font-display text-2xl font-bold uppercase text-chrome/40 mb-2">MONITORING</div>
                     <div className="font-mono text-xs text-chrome/30 uppercase tracking-widest">No instruction required</div>
                  </div>
                ) : (
                  <>
                    {/* ISSUE */}
                    <div className="mb-6">
                      <div className="font-mono text-[9px] text-chrome/50 uppercase tracking-[0.2em] mb-1">THE ISSUE</div>
                      <div className={cn(
                        "font-display text-3xl font-bold uppercase tracking-tight",
                        isRadioNow ? "text-brand-red" : "text-amber-400"
                      )}>
                        {displayDiagnosis}
                      </div>
                      <div className="font-mono text-[10px] text-chrome/60 uppercase tracking-widest mt-1">
                        {safeSample.current_corner.name} · {safeSample.current_corner.phase}
                      </div>
                    </div>

                    {/* COST & RACE CONTEXT ROW */}
                    <div className="flex flex-wrap gap-8 mb-6 pb-6 border-b border-chrome/10">
                      {/* COST */}
                      {isActionable && (
                        <div>
                          <div className="font-mono text-[9px] text-chrome/50 uppercase tracking-[0.2em] mb-2">THE COST</div>
                          {safeSample.analysis.confidence < 0.5 ? (
                            <div className="font-mono text-sm text-chrome/50 font-bold uppercase tracking-widest">UNRESOLVED</div>
                          ) : (
                            <div>
                              <div className={cn("font-numeric text-4xl font-bold leading-none", isRadioNow ? "text-brand-red" : "text-amber-400")}>
                                +{safeSample.analysis.estimated_time_delta?.toFixed(3)}s
                              </div>
                              <div className={cn("font-mono text-[9px] uppercase tracking-[0.2em] mt-1 font-bold", isRadioNow ? "text-brand-red/80" : "text-amber-400/80")}>TIME LOST</div>
                            </div>
                          )}
                        </div>
                      )}

                      {/* RACE CONTEXT */}
                      {ctx.battle_active && (
                        <div>
                          <div className="font-mono text-[9px] text-chrome/50 uppercase tracking-[0.2em] mb-2">RACE CONTEXT</div>
                          <div className="flex flex-col gap-1">
                            <div className={cn("font-mono text-[10px] font-bold uppercase tracking-[0.2em] border px-2 py-1 rounded-sm w-max", isRadioNow ? "border-brand-red/20 bg-brand-red/10 text-brand-red" : "border-amber-400/20 bg-amber-400/10 text-amber-400")}>
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
                    {isRadioNow && (
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
                            <div className="font-body text-xl font-bold text-white leading-tight border-l-2 border-brand-red/50 pl-3 py-1">
                              "{instructionMessage}"
                            </div>
                          </div>
                        </div>
                      </div>
                    )}
                  </>
                )}
              </motion.div>
            </AnimatePresence>

          </div>

        </div>
      </div>

      {/* BOTTOM: TELEMETRY STRIP */}
      <div className="w-full bg-[#070709] border-t border-chrome/10 py-2.5 px-6 fixed bottom-0 left-0 right-0 z-30">
        <div className="max-w-7xl mx-auto flex flex-wrap items-center justify-between font-mono text-[10px] text-chrome/50 uppercase tracking-widest">
          <div className="flex gap-6">
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
  );
}
