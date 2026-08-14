import { useState, useEffect, useMemo, useRef } from 'react';
import { Play, Map as MapIcon, Crosshair } from 'lucide-react';
import { fetchLiveAnalysis, type LiveAnalysisData } from '@/lib/api';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';

gsap.registerPlugin(ScrollTrigger);

export function RaceReplay() {
  const [liveData, setLiveData] = useState<LiveAnalysisData | null>(null);
  const [loadError, setLoadError] = useState(false);
  const [currentTick, setCurrentTick] = useState(0);
  const sectionRef = useRef<HTMLElement>(null);

  // Scroll-triggered reveal animations
  useEffect(() => {
    const mm = gsap.matchMedia();
    mm.add("(prefers-reduced-motion: no-preference)", () => {
      const ctx = gsap.context(() => {
        gsap.from('.replay-heading', {
          y: 60, opacity: 0, duration: 0.8, ease: 'power3.out',
          scrollTrigger: { trigger: '.replay-heading', start: 'top 85%' }
        });
        gsap.from('.replay-grid', {
          y: 40, opacity: 0, duration: 0.8, ease: 'power3.out',
          scrollTrigger: { trigger: '.replay-grid', start: 'top 80%' }
        });
      }, sectionRef);
      return () => ctx.revert();
    });
    return () => mm.revert();
  }, []);

  useEffect(() => {
    async function loadData() {
      try {
        const data = await fetchLiveAnalysis(9165, 1);
        setLiveData(data);
      } catch (err) {
        console.error("Failed to load live analysis data", err);
        setLoadError(true);
      }
    }
    loadData();
  }, []);

  // Animate through location samples
  useEffect(() => {
    if (!liveData || !liveData.samples?.length) return;

    const interval = setInterval(() => {
      setCurrentTick((prev) => (prev + 1) % liveData.samples.length);
    }, 50);

    return () => clearInterval(interval);
  }, [liveData]);

  // Provide a safe fallback for initial load so we don't break layout
  const currentSample = liveData?.samples?.[currentTick] || ({
    elapsed: 0,
    lap_number: 0,
    progress: 0,
    target: { x: 50, y: 50, speed: 0, gear: 0, brake: 0, throttle: 0 },
    benchmark: { speed: 0, gear: 0, brake: 0, throttle: 0 },
    current_corner: { name: "Straight", phase: "STRAIGHT" },
    comparison: { entry_speed_delta: 0, minimum_speed_delta: 0, exit_speed_delta: 0, braking_delta: 0, throttle_delay: 0 },
    analysis: { diagnosis: "None", severity: "low", advice: "Connecting...", estimated_time_delta: 0, confidence: 1 },
    race_context: { position: null, gap_behind: null, driver_behind: null, battle_active: false, is_defending: false, position_event: "NO_CHANGE" }
  } as unknown as import("@/lib/api").LiveAnalysisSample);
  const lapNum = liveData?.lap_number || "--";

  const normalizedX = liveData ? (100 - currentSample.target.x) : 50;
  const normalizedY = liveData ? currentSample.target.y : 50;

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

  const formatTime = (secs: number) => {
    if (!secs) return "0:00.000";
    const m = Math.floor(secs / 60);
    const s = Math.floor(secs % 60);
    const ms = Math.floor((secs % 1) * 1000);
    return `${m}:${s.toString().padStart(2, '0')}.${ms.toString().padStart(3, '0')}`;
  };

  return (
    <section id="replay" ref={sectionRef} className="py-32 px-6 bg-[#0a0a0c] relative border-t border-chrome/10">
      <div className="max-w-7xl mx-auto">
        <div className="mb-12 replay-heading">
          <h2 className="font-display text-3xl md:text-5xl font-bold uppercase tracking-tight text-ink mb-4 flex items-center gap-4">
            <Crosshair className="w-8 h-8 text-chrome" />
            Live Intelligence Preview
          </h2>
          <p className="font-body text-xl text-ink-muted max-w-2xl">
            Historical track progress and race-engineer recommendations.
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 h-[500px] replay-grid">
          {/* Telemetry Side Panel */}
          <div className="lg:col-span-1 bg-[#17191C] rounded-2xl border border-chrome/10 p-6 flex flex-col justify-between">
            <div>
              <div className="flex justify-between items-center mb-8">
                <span className="font-mono text-sm text-ink-muted uppercase tracking-wider">Live Analysis</span>
                <span className="flex items-center gap-2 px-2 py-1 rounded bg-brand-red/10 text-brand-red font-mono text-xs animate-pulse">
                  <Play className="w-3 h-3" /> ARCHIVE
                </span>
              </div>

              <div className="space-y-6">
                <div>
                  <div className="font-mono text-xs text-chrome/50 uppercase tracking-widest mb-1">Driver</div>
                  <div className="font-display text-2xl text-ink flex items-center gap-3">
                    <span className="text-[#3671C6] font-bold">VER</span>
                    <span className="text-chrome/30">|</span>
                    <span>{liveData ? `P${currentSample.race_context?.position || 1}` : '--'}</span>
                    {currentSample.race_context?.battle_active && currentSample.race_context?.is_defending && (
                      <>
                        <span className="text-chrome/30">|</span>
                        <span className="text-sm font-mono text-brand-red animate-pulse uppercase tracking-wider">
                          DEFENDING · {currentSample.race_context.gap_behind}s
                        </span>
                      </>
                    )}
                  </div>
                </div>

                <div>
                  <div className="font-mono text-xs text-chrome/50 uppercase tracking-widest mb-1">Lap Time</div>
                   <div className="font-numeric text-5xl text-ink">{liveData ? formatTime(currentSample.elapsed) : '--'}</div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <div className="font-mono text-xs text-chrome/50 uppercase tracking-widest mb-1">Speed</div>
                     <div className="font-numeric text-3xl text-ink">{liveData ? currentSample.target.speed : '--'} <span className="text-sm text-chrome/50">KM/H</span></div>
                    {liveData && (
                      <div className="font-mono text-xs text-brand-red mt-1">Δ {currentSample.target.speed - currentSample.benchmark.speed} <span className="text-chrome/50">(vs BMK {currentSample.benchmark.speed})</span></div>
                    )}
                  </div>
                  <div>
                    <div className="font-mono text-xs text-chrome/50 uppercase tracking-widest mb-1">Gear</div>
                     <div className="font-numeric text-3xl text-ink">{liveData ? currentSample.target.gear : '--'}</div>
                  </div>
                </div>
              </div>
            </div>

            <div className="pt-6 border-t border-chrome/10">
              <div className="mb-2 flex items-center justify-between">
                 <span className="font-mono text-xs text-chrome/50 uppercase tracking-widest">
                   Race Engineer • {currentSample.current_corner.name} • {currentSample.current_corner.phase}
                 </span>
                 {currentSample.analysis.severity === "high" && <span className="w-2 h-2 rounded-full bg-brand-red animate-ping" />}
              </div>
              <div className="font-body text-sm text-ink mb-1">{currentSample.analysis.advice}</div>
              {currentSample.analysis.diagnosis !== "GOOD" && currentSample.analysis.diagnosis !== "None" && (
                 <div className="flex items-center gap-4 mt-2">
                   <div className="font-mono text-[10px] text-brand-red uppercase tracking-wider">
                     Detected: {currentSample.analysis.diagnosis}
                   </div>
                   {currentSample.analysis.estimated_time_delta !== null && (
                     <div className="font-mono text-[10px] text-chrome/50 uppercase tracking-wider">
                       Time Loss: {currentSample.analysis.estimated_time_delta > 0 ? "+" : ""}{currentSample.analysis.estimated_time_delta.toFixed(3)}s
                     </div>
                   )}
                 </div>
              )}
            </div>
          </div>

          {/* Track Map Visual */}
          <div className="lg:col-span-2 bg-[#0D0D0F] rounded-2xl border border-chrome/10 p-6 relative overflow-hidden flex items-center justify-center">
            {/* Background grid */}
            <div className="absolute inset-0 bg-[linear-gradient(to_right,#80808012_1px,transparent_1px),linear-gradient(to_bottom,#80808012_1px,transparent_1px)] bg-[size:24px_24px]" />

            <div className="absolute top-6 left-6 flex items-center gap-2 text-chrome/50 font-mono text-xs">
              <MapIcon className="w-4 h-4" />
              <span>SECTOR 2 - TRACKING (LAP {lapNum})</span>
            </div>

            {/* SVG Track Map */}
            <div className="relative w-full max-w-lg aspect-video z-10">
              {trackPath ? (
                <svg viewBox="-10 -10 120 120" className="w-full h-full overflow-visible">
                  {/* Track Path */}
                  <path
                    d={trackPath}
                    fill="none"
                    stroke="rgba(201,205,211,0.2)"
                    strokeWidth="3"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />

                  {/* Optionally draw a closing line if start/finish line is separated */}
                  <path d={`${trackPath.split(' ')[0]} ${trackPath.split(' ')[1]} ${trackPath.split(' ')[2]} L ${trackPath.split(' ').slice(-2).join(' ')}`} fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth="3" strokeDasharray="2 2" />

                  {/* Other Drivers */}
                  {currentSample?.others && Object.entries(currentSample.others).map(([drId, pos]) => (
                    <circle key={drId} cx={pos.x} cy={pos.y} r="1.5" fill="rgba(255,255,255,0.3)" style={{ transition: 'all 50ms linear' }} />
                  ))}

                  {/* Animated Target Driver Dot */}
                  <circle cx={normalizedX} cy={normalizedY} r="3" fill="#3671C6" style={{ transition: 'all 50ms linear' }} />
                  <circle cx={normalizedX} cy={normalizedY} r="6" fill="none" stroke="#3671C6" strokeWidth="1" className="animate-ping" style={{ transition: 'all 50ms linear' }} />
                  <text x={normalizedX + 5} y={normalizedY + 1.5} className="font-mono text-[8px]" fill="#F4F1EC" style={{ transition: 'all 50ms linear' }}>VER</text>
                </svg>
              ) : (
                 <div className="w-full h-full flex items-center justify-center text-chrome/50 font-mono text-sm uppercase tracking-widest text-center">
                   {loadError ? 'Live Intelligence preview unavailable' : 'Loading historical track map...'}
                 </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
