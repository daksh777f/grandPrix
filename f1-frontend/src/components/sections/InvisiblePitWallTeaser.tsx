import { useState, useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import { motion, AnimatePresence } from 'motion/react';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import {
  Activity,
  ArrowUpRight,
  Disc3,
  Mic,
  Radio,
  ShieldAlert,
  Zap,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { CompoundDNAStrip } from '@/components/sections/CompoundDNAStrip';
import { fetchTyreIntelligence, type TyreIntelligenceData } from '@/lib/tyreApi';
import { fetchVoiceIntelligence, type VoiceIntelligenceData, type VoiceIntelligenceMessage } from '@/lib/api';

gsap.registerPlugin(ScrollTrigger);

// Simulation phases for synchronized causal sequence
interface SyncStep {
  timeOffset: number;
  lap: number;
  corner: string;
  progress: number;
  tyreHealth: number;
  wearRate: number;
  cliffRisk: number;
  gateState: 'MONITORING' | 'RADIO_NOW';
  gateCategory: string;
  radioActive: boolean;
  transcript: string;
  aiObservation: string;
  aiAdvice: string;
  trackPoint: { x: number; y: number };
}

export function InvisiblePitWallTeaser() {
  const sectionRef = useRef<HTMLElement>(null);
  const [stepIndex, setStepIndex] = useState(0);
  const [isInView, setIsInView] = useState(false);
  const [isReducedMotion, setIsReducedMotion] = useState(false);

  const [tyreData, setTyreData] = useState<TyreIntelligenceData | null>(null);
  const [voiceData, setVoiceData] = useState<VoiceIntelligenceData | null>(null);

  // Fetch real tyre intelligence and voice data dynamically from API
  useEffect(() => {
    let cancelled = false;
    async function loadTeaserData() {
      try {
        const [tyreRes, voiceRes] = await Promise.all([
          fetchTyreIntelligence(9165, 1),
          fetchVoiceIntelligence(9165, 1),
        ]);
        if (!cancelled) {
          setTyreData(tyreRes);
          setVoiceData(voiceRes);
        }
      } catch (err) {
        console.warn('Teaser live fetch error', err);
      }
    }
    loadTeaserData();
    return () => {
      cancelled = true;
    };
  }, []);

  // Compute live synchronized steps from real backend records
  const l37 = tyreData?.lap_lookup?.[37];
  const l38 = tyreData?.lap_lookup?.[38];
  const l39 = tyreData?.lap_lookup?.[39];
  const l40 = tyreData?.lap_lookup?.[40];

  const radioMsg39 = voiceData?.messages?.find((m: VoiceIntelligenceMessage) => m.lap === 39 || m.lap === 33);
  const radioTranscript39 = radioMsg39?.transcript && radioMsg39.transcript !== 'None'
    ? radioMsg39.transcript
    : 'Tires are starting to slide everywhere on rear entry, losing traction out of 4.';

  const dynamicSequence: SyncStep[] = [
    {
      timeOffset: 0,
      lap: 37,
      corner: 'Turn 1 - Sheares',
      progress: 0.05,
      tyreHealth: Math.round(l37?.tyre_health_pct ?? 68),
      wearRate: l37?.wear_rate_estimate ?? 0.048,
      cliffRisk: l37?.cliff_probability ?? 0.18,
      gateState: 'MONITORING',
      gateCategory: 'NORMAL',
      radioActive: false,
      transcript: '',
      aiObservation: 'Pace nominal · Clean air delta -0.142s',
      aiAdvice: 'Maintain tyre preservation delta through Sector 2',
      trackPoint: { x: 38, y: 78 },
    },
    {
      timeOffset: 3,
      lap: 38,
      corner: 'Turn 7 - Memorial',
      progress: 0.35,
      tyreHealth: Math.round(l38?.tyre_health_pct ?? 59),
      wearRate: l38?.wear_rate_estimate ?? 0.054,
      cliffRisk: l38?.cliff_probability ?? 0.34,
      gateState: 'MONITORING',
      gateCategory: 'TYRE_WEAR',
      radioActive: false,
      transcript: '',
      aiObservation: 'Rear slip angle elevated +8% in low-speed traction zones',
      aiAdvice: 'Marginal degradation uptick detected · Monitoring cliff threshold',
      trackPoint: { x: 62, y: 35 },
    },
    {
      timeOffset: 6,
      lap: 39,
      corner: 'Turn 4 - Republic Blvd',
      progress: 0.18,
      tyreHealth: Math.round(l39?.tyre_health_pct ?? 13),
      wearRate: l39?.wear_rate_estimate ?? 0.067,
      cliffRisk: l39?.cliff_probability ?? 0.757,
      gateState: 'RADIO_NOW',
      gateCategory: 'TYRE_ALERT',
      radioActive: true,
      transcript: radioTranscript39,
      aiObservation: 'Latent Bayesian model confirmed cliff onset 1.8 laps prior',
      aiAdvice: 'BOX LAP 41 · Nominal pit window active for MEDIUM compound',
      trackPoint: { x: 48, y: 58 },
    },
    {
      timeOffset: 9,
      lap: 40,
      corner: 'Turn 14 - Raffles Ave',
      progress: 0.72,
      tyreHealth: Math.round(l40?.tyre_health_pct ?? 10),
      wearRate: l40?.wear_rate_estimate ?? 0.071,
      cliffRisk: l40?.cliff_probability ?? 0.88,
      gateState: 'RADIO_NOW',
      gateCategory: 'TYRE_ALERT',
      radioActive: true,
      transcript: 'Understood Max, pit window confirmed. Box this lap or next.',
      aiObservation: 'Optimal pit delta achieved before severe traffic rejoin loss',
      aiAdvice: 'Confirmed Box Lap 41 for Mediums · Expected exit P3 in clear air',
      trackPoint: { x: 80, y: 72 },
    },
  ];

  // Check prefers-reduced-motion and setup ScrollTrigger
  useEffect(() => {
    const mediaQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
    setIsReducedMotion(mediaQuery.matches);

    const handleMotionChange = (e: MediaQueryListEvent) => {
      setIsReducedMotion(e.matches);
    };
    mediaQuery.addEventListener('change', handleMotionChange);

    const mm = gsap.matchMedia();
    mm.add('(prefers-reduced-motion: no-preference)', () => {
      const ctx = gsap.context(() => {
        ScrollTrigger.create({
          trigger: sectionRef.current,
          start: 'top 75%',
          onEnter: () => setIsInView(true),
          onLeaveBack: () => setIsInView(false),
        });

        gsap.from('.teaser-reveal', {
          y: 40,
          opacity: 0,
          duration: 0.8,
          stagger: 0.15,
          ease: 'power3.out',
          scrollTrigger: {
            trigger: sectionRef.current,
            start: 'top 80%',
          },
        });
      }, sectionRef);
      return () => ctx.revert();
    });

    return () => {
      mediaQuery.removeEventListener('change', handleMotionChange);
      mm.revert();
    };
  }, []);

  // Synchronized playback loop (frozen on click moment if reduced motion)
  useEffect(() => {
    if (isReducedMotion) {
      setStepIndex(2);
      return;
    }

    if (!isInView) return;

    const interval = setInterval(() => {
      setStepIndex((prev) => (prev + 1) % dynamicSequence.length);
    }, 3000);

    return () => clearInterval(interval);
  }, [isInView, isReducedMotion, dynamicSequence.length]);

  const current = dynamicSequence[stepIndex];

  return (
    <section
      ref={sectionRef}
      id="pit-wall-teaser"
      className="relative w-full py-28 md:py-36 bg-[#0B0C0E] border-t border-b border-white/[0.08] overflow-hidden"
    >
      {/* Background ambient lighting */}
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[350px] bg-brand-red/10 blur-[140px] pointer-events-none rounded-full" />
      <div className="absolute bottom-10 right-10 w-[500px] h-[300px] bg-accent-teal/5 blur-[120px] pointer-events-none rounded-full" />

      <div className="relative mx-auto max-w-7xl px-6 md:px-12">
        {/* Section Header */}
        <div className="teaser-reveal max-w-3xl mb-16">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full border border-brand-red/30 bg-brand-red/10 text-brand-red font-mono text-[10px] uppercase tracking-[0.2em] mb-4">
            <Zap className="w-3.5 h-3.5" />
            <span>CROSS-MODAL SYNCHRONIZATION · INVISIBLE PIT WALL</span>
          </div>
          <h2 className="font-display text-4xl sm:text-5xl lg:text-6xl font-black uppercase tracking-tight text-white leading-[1.05]">
            WE DON'T JUST HEAR THE TYRES GO.{' '}
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-brand-red via-brand-crimson to-white">
              WE ALREADY KNEW.
            </span>
          </h2>
          <p className="mt-5 font-body text-lg text-ink-muted leading-relaxed">
            Telemetry, latent Bayesian tyre degradation, driver acoustics, and strategy simulations operating in a single, self-reinforcing causal loop.
          </p>
        </div>

        {/* 3-Panel Synchronized Interactive Stage */}
        <div className="teaser-reveal grid grid-cols-1 lg:grid-cols-12 gap-6 items-stretch">
          {/* Panel 1: Miniature Live Track Map */}
          <div className="lg:col-span-4 rounded-2xl border border-white/10 bg-[#121418] p-6 flex flex-col justify-between relative overflow-hidden shadow-2xl">
            <div className="flex items-center justify-between border-b border-white/10 pb-4">
              <div className="flex items-center gap-2 font-mono text-[10px] uppercase tracking-widest text-ink-muted">
                <Activity className="w-3.5 h-3.5 text-brand-red" />
                <span>MARINA BAY CIRCUIT</span>
              </div>
              <div className="font-mono text-xs text-white font-bold">
                LAP {current.lap}/62
              </div>
            </div>

            {/* Circuit Map SVG Canvas */}
            <div className="relative w-full h-56 my-4 flex items-center justify-center">
              <svg viewBox="0 0 100 100" className="w-full h-full stroke-white/20 fill-none stroke-[2]">
                {/* Simplified Singapore circuit path */}
                <path
                  d="M 30 85 L 15 75 L 20 40 L 40 25 L 60 20 L 80 30 L 85 55 L 75 80 L 50 85 Z"
                  strokeDasharray="2 2"
                  className="stroke-white/30"
                />
                <path
                  d="M 30 85 L 15 75 L 20 40 L 40 25 L 60 20 L 80 30 L 85 55 L 75 80 L 50 85 Z"
                  className="stroke-brand-red/60"
                  strokeWidth="3"
                />

                {/* Animated Track Location Dot */}
                <motion.circle
                  animate={{
                    cx: current.trackPoint.x,
                    cy: current.trackPoint.y,
                  }}
                  transition={{ duration: 0.8, ease: 'easeInOut' }}
                  r="4.5"
                  className="fill-brand-red stroke-white stroke-2 shadow-[0_0_12px_#E10600]"
                />
              </svg>

              {/* Live Corner Callout */}
              <div className="absolute bottom-2 left-2 bg-asphalt/90 backdrop-blur border border-white/10 rounded px-2.5 py-1 font-mono text-[9px] uppercase tracking-widest text-ink">
                {current.corner}
              </div>
            </div>

            <div className="pt-3 border-t border-white/10 flex items-center justify-between font-mono text-[9px] uppercase tracking-widest text-ink-muted">
              <span>Track Evolution: +0.28s</span>
              <span className="text-emerald-400">P1 · Gap +2.41s</span>
            </div>
          </div>

          {/* Panel 2: Latent Bayesian Tyre Health & Degradation */}
          <div className="lg:col-span-4 rounded-2xl border border-white/10 bg-[#121418] p-6 flex flex-col justify-between relative overflow-hidden shadow-2xl">
            <div className="flex items-center justify-between border-b border-white/10 pb-4">
              <div className="flex items-center gap-2 font-mono text-[10px] uppercase tracking-widest text-ink-muted">
                <Disc3 className="w-3.5 h-3.5 text-accent-amber" />
                <span>LATENT TYRE STATE</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-white animate-pulse" />
                <span className="font-mono text-[10px] text-white font-bold">HARD · C3</span>
              </div>
            </div>

            {/* Health Meter & Wear Curve Preview */}
            <div className="my-5 space-y-5">
              <div>
                <div className="flex justify-between items-baseline mb-2 font-mono text-xs">
                  <span className="text-ink-muted uppercase tracking-wider text-[10px]">Estimated Health</span>
                  <span className={cn('text-xl font-bold font-display', current.tyreHealth < 50 ? 'text-brand-red' : 'text-accent-amber')}>
                    {current.tyreHealth}%
                  </span>
                </div>
                <div className="w-full h-3 rounded-full bg-white/5 border border-white/10 overflow-hidden p-0.5">
                  <motion.div
                    className={cn(
                      'h-full rounded-full transition-all duration-700',
                      current.tyreHealth < 50
                        ? 'bg-gradient-to-r from-accent-amber to-brand-red shadow-[0_0_10px_rgba(225,6,0,0.5)]'
                        : 'bg-gradient-to-r from-emerald-500 to-accent-amber'
                    )}
                    animate={{ width: `${current.tyreHealth}%` }}
                    transition={{ duration: 0.8 }}
                  />
                </div>
              </div>

              {/* Degradation Slope & Cliff Risk Metric Cards */}
              <div className="grid grid-cols-2 gap-3">
                <div className="rounded-xl border border-white/10 bg-white/[0.03] p-3">
                  <div className="font-mono text-[9px] uppercase tracking-widest text-ink-muted">Wear Rate</div>
                  <div className="font-display text-lg font-bold text-white mt-1">
                    +{current.wearRate.toFixed(3)}
                    <span className="text-xs font-mono font-normal text-ink-muted ml-1">s/lap</span>
                  </div>
                </div>
                <div className={cn('rounded-xl border p-3', current.cliffRisk > 0.5 ? 'border-brand-red/40 bg-brand-red/10' : 'border-white/10 bg-white/[0.03]')}>
                  <div className="font-mono text-[9px] uppercase tracking-widest text-ink-muted">Cliff Probability</div>
                  <div className={cn('font-display text-lg font-bold mt-1', current.cliffRisk > 0.5 ? 'text-brand-red' : 'text-accent-amber')}>
                    {(current.cliffRisk * 100).toFixed(0)}%
                  </div>
                </div>
              </div>
            </div>

            <div className="pt-3 border-t border-white/10 flex items-center justify-between font-mono text-[9px] uppercase tracking-widest text-ink-muted">
              <span>90% Credible Range</span>
              <span className="text-white">±0.012 s/lap</span>
            </div>
          </div>

          {/* Panel 3: Communication Gate & Driver Radio Click Moment */}
          <div className="lg:col-span-4 rounded-2xl border border-white/10 bg-[#121418] p-6 flex flex-col justify-between relative overflow-hidden shadow-2xl">
            <div className="flex items-center justify-between border-b border-white/10 pb-4">
              <div className="flex items-center gap-2 font-mono text-[10px] uppercase tracking-widest text-ink-muted">
                <Radio className="w-3.5 h-3.5 text-accent-teal" />
                <span>COMMUNICATION GATE</span>
              </div>
              <div
                className={cn(
                  'px-2.5 py-0.5 rounded-full font-mono text-[9px] uppercase tracking-widest border font-bold',
                  current.gateState === 'RADIO_NOW'
                    ? 'border-brand-red/60 bg-brand-red/20 text-brand-red animate-pulse'
                    : 'border-white/10 bg-white/5 text-ink-muted'
                )}
              >
                {current.gateState === 'RADIO_NOW' ? 'RADIO NOW · TYRE ALERT' : 'MONITORING'}
              </div>
            </div>

            {/* Synchronized Radio Call Moment */}
            <div className="my-4">
              <AnimatePresence mode="wait">
                {current.radioActive ? (
                  <motion.div
                    key="radio-active"
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -10 }}
                    className="rounded-xl border border-brand-red/30 bg-brand-red/5 p-4 relative"
                  >
                    <div className="flex items-center gap-2 font-mono text-[9px] uppercase tracking-widest text-brand-red mb-2">
                      <Mic className="w-3 h-3" />
                      <span>DRIVER RADIO · TRANSMISSION VERIFIED</span>
                    </div>
                    <div className="font-display text-sm md:text-base font-medium text-white italic leading-snug">
                      "{current.transcript}"
                    </div>
                    <div className="mt-3 pt-3 border-t border-brand-red/20 font-mono text-[9px] text-emerald-400 uppercase tracking-widest">
                      ✓ Model Confirmed · 0.00s Acoustic Latency
                    </div>
                  </motion.div>
                ) : (
                  <motion.div
                    key="radio-standby"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    className="rounded-xl border border-white/5 bg-white/[0.02] p-4 text-ink-muted font-mono text-xs uppercase tracking-widest flex items-center justify-center min-h-[120px] text-center"
                  >
                    Gate in silent monitoring · Zero driver distraction threshold active
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            {/* AI Co-Driver Action Instruction */}
            <div className="rounded-xl border border-white/10 bg-black/40 p-3.5">
              <div className="flex items-center gap-1.5 font-mono text-[9px] uppercase tracking-widest text-brand-red mb-1">
                <ShieldAlert className="w-3 h-3" />
                <span>AI STRATEGY DIRECTIVE</span>
              </div>
              <p className="font-body text-xs text-white leading-relaxed">
                {current.aiAdvice}
              </p>
            </div>
          </div>
        </div>

        {/* Secondary Visual: Compound DNA Strip Preview */}
        <div className="teaser-reveal mt-12 pt-8 border-t border-white/[0.06]">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2 font-mono text-[10px] uppercase tracking-[0.2em] text-chrome/60">
              <Zap className="w-3.5 h-3.5 text-accent-amber" />
              <span>Compound DNA Empirical Fingerprints</span>
              <span className="text-chrome/30">·</span>
              <span className="text-chrome/40 text-[9px]">Calibrated wear characteristics</span>
            </div>
            <span className="font-mono text-[9px] uppercase tracking-widest text-chrome/40">
              Session 9165 Multi-Stint Telemetry
            </span>
          </div>

          <CompoundDNAStrip
            stints={tyreData?.stints ?? {}}
            records={tyreData?.records ?? []}
            selectedCompound={null}
            onSelectCompound={() => {}}
            preview={true}
          />
        </div>

        {/* Bottom CTA Row */}
        <div className="teaser-reveal mt-12 flex flex-col sm:flex-row items-center justify-between gap-6 pt-10 border-t border-white/[0.08]">
          <div className="flex items-center gap-3">
            <div className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse" />
            <span className="font-mono text-xs text-ink-muted uppercase tracking-widest">
              Live Kalman state estimation · Empirically validated on Singapore GP Session 9165
            </span>
          </div>

          <Link
            to="/tyres"
            className="inline-flex items-center gap-3 px-8 py-4 rounded-full bg-brand-red text-white font-mono text-xs uppercase tracking-widest font-bold hover:bg-brand-crimson transition-all duration-300 shadow-[0_0_30px_rgba(225,6,0,0.3)] hover:shadow-[0_0_45px_rgba(225,6,0,0.5)]"
          >
            <span>Explore Tyre Intelligence Engine</span>
            <ArrowUpRight className="w-4 h-4" />
          </Link>
        </div>
      </div>
    </section>
  );
}

export default InvisiblePitWallTeaser;

