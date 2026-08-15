import { useState, useEffect } from 'react';
import { motion } from 'motion/react';
import { Volume2, VolumeX, ChevronDown, Zap, Activity, Radio, ShieldAlert, Flag, Flame, ArrowUpRight } from 'lucide-react';
import { f1Audio } from '@/utils/f1Sound';
import { F1SpeedCanvas } from '@/components/ui/F1SpeedCanvas';


interface DriverHeroProfile {
  number: number;
  code: string;
  name: string;
  team: string;
  teamColor: string;
  topSpeed: number;
  gear: number;
  delta: string;
  radioMsg: string;
}

const DRIVER_PROFILES: DriverHeroProfile[] = [
  {
    number: 1,
    code: 'VER',
    name: 'Max Verstappen',
    team: 'Red Bull Racing',
    teamColor: '#3671C6',
    topSpeed: 344,
    gear: 7,
    delta: '-0.184s',
    radioMsg: 'Box confirm, pushing flat out through Sector 3.'
  },
  {
    number: 4,
    code: 'NOR',
    name: 'Lando Norris',
    team: 'McLaren F1 Team',
    teamColor: '#FF8000',
    topSpeed: 338,
    gear: 7,
    delta: '+0.042s',
    radioMsg: 'Gap to car ahead is 0.4s, DRS enabled.'
  },
  {
    number: 16,
    code: 'LEC',
    name: 'Charles Leclerc',
    team: 'Scuderia Ferrari',
    teamColor: '#E8002D',
    topSpeed: 342,
    gear: 8,
    delta: '-0.095s',
    radioMsg: 'Braking 10m deeper into Turn 14, car feels sharp.'
  },
  {
    number: 44,
    code: 'HAM',
    name: 'Lewis Hamilton',
    team: 'Mercedes-AMG',
    teamColor: '#27F4D2',
    topSpeed: 339,
    gear: 7,
    delta: '+0.112s',
    radioMsg: 'Tyres are switching on, attacking on exit.'
  }
];

export function Hero() {
  const [audioMuted, setAudioMuted] = useState(true);
  const [selectedDriver, setSelectedDriver] = useState<DriverHeroProfile>(DRIVER_PROFILES[0]);
  const [speed, setSpeed] = useState(selectedDriver.topSpeed);
  const [rpm, setRpm] = useState(12400);
  const [gear, setGear] = useState(selectedDriver.gear);
  const [mousePos, setMousePos] = useState({ x: 0, y: 0 });
  const [isRevving, setIsRevving] = useState(false);

  // Sync state with selected driver
  useEffect(() => {
    setSpeed(selectedDriver.topSpeed);
    setGear(selectedDriver.gear);
  }, [selectedDriver]);

  // Dynamic Live Cockpit Telemetry Ticker
  useEffect(() => {
    const interval = setInterval(() => {
      const spdJitter = (Math.random() - 0.48) * (isRevving ? 14 : 5);
      setSpeed((prev) => Math.min(358, Math.max(285, Math.round(prev + spdJitter))));

      const rpmJitter = (Math.random() - 0.48) * (isRevving ? 600 : 220);
      setRpm((prev) => {
        const next = Math.min(13500, Math.max(10400, Math.round(prev + rpmJitter)));
        if (next > 13150) setGear(8);
        else if (next < 11200) setGear(7);
        return next;
      });
    }, 120);

    return () => clearInterval(interval);
  }, [isRevving]);

  const handleMouseMove = (e: React.MouseEvent) => {
    const { clientX, clientY } = e;
    const x = (clientX / window.innerWidth - 0.5) * 30;
    const y = (clientY / window.innerHeight - 0.5) * 20;
    setMousePos({ x, y });
  };

  const handleAudioToggle = () => {
    const nextState = !audioMuted;
    setAudioMuted(nextState);
    f1Audio.toggleContinuous(!nextState);
  };

  const handleRevPulse = () => {
    setIsRevving(true);
    setSpeed(355);
    setRpm(13400);
    setGear(8);
    f1Audio.playRev();
    setTimeout(() => setIsRevving(false), 1400);
  };

  // 15-LED Shift Lights calculation
  const shiftPct = Math.min(1, Math.max(0, (rpm - 10500) / 3000));
  const activeLights = Math.floor(shiftPct * 15);

  return (
    <section
      onMouseMove={handleMouseMove}
      className="relative w-full min-h-screen bg-asphalt overflow-hidden flex flex-col justify-between items-center z-10 pt-24 pb-12 select-none"
    >
      {/* 3D WebGL Speed Particle Starfield Grid */}
      <F1SpeedCanvas />

      {/* High-Resolution F1 Car Action Background Image with Dynamic Parallax Movement */}
      <div className="absolute inset-0 w-full h-full overflow-hidden pointer-events-none z-0">
        <img
          src="/hero_f1_car.png"
          alt="Formula 1 Racing Machine"
          style={{
            transform: `scale(1.12) translate(${mousePos.x * -0.6}px, ${mousePos.y * -0.6}px)`,
          }}
          className="w-full h-full object-cover object-center filter contrast-125 brightness-60 transition-transform duration-150 ease-out opacity-75"
        />
        {/* Cinematic Cyber Red & Carbon Gradients */}
        <div className="absolute inset-0 bg-gradient-to-r from-asphalt/95 via-asphalt/75 to-asphalt/90" />
        <div className="absolute inset-0 bg-gradient-to-t from-asphalt via-transparent to-asphalt/85" />
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-brand-red/20 via-transparent to-transparent pointer-events-none" />
      </div>

      {/* Top Floating Control HUD */}
      <div className="relative z-20 w-full max-w-7xl px-6 flex flex-wrap justify-between items-center gap-4">
        {/* Status Pill Badge */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          className="flex items-center gap-3 px-4 py-2 rounded-full bg-black/70 border border-white/15 backdrop-blur-2xl shadow-[0_0_20px_rgba(0,0,0,0.8)]"
        >
          <span className="relative flex h-2.5 w-2.5">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-brand-red opacity-75" />
            <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-brand-red" />
          </span>
          <span className="text-[11px] font-mono font-bold tracking-widest text-white uppercase flex items-center gap-2">
            SINGAPORE GP 2023 // MARINA BAY STREET CIRCUIT
          </span>
        </motion.div>

        {/* Audio Engine Roar & Sound FX */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.15 }}
          className="flex items-center gap-3"
        >
          <button
            onClick={handleRevPulse}
            className={`px-5 py-2.5 rounded-full font-mono text-xs font-black uppercase tracking-wider transition-all duration-200 flex items-center gap-2.5 active:scale-95 cursor-pointer ${isRevving
                ? 'bg-amber-400 text-black shadow-[0_0_30px_#fbbf24] scale-105'
                : 'bg-brand-red text-white hover:bg-red-600 shadow-[0_0_20px_#e10600]'
              }`}
          >
            <Flame className={`w-4 h-4 ${isRevving ? 'animate-bounce text-black' : 'fill-white'}`} />
            <span>{isRevving ? 'RPM PEAKING // 13.5K' : 'REV V10 ENGINE'}</span>
          </button>

          <button
            onClick={handleAudioToggle}
            className="p-2.5 rounded-full bg-black/70 border border-white/15 text-white hover:bg-white/10 transition-colors backdrop-blur-2xl shadow-lg cursor-pointer"
            title="Toggle Ambient Track Sound"
          >
            {audioMuted ? (
              <VolumeX className="w-4 h-4 text-ink-muted" />
            ) : (
              <Volume2 className="w-4 h-4 text-emerald-400 animate-pulse" />
            )}
          </button>
        </motion.div>
      </div>

      {/* Hero Stage Grid */}
      <div className="relative z-20 w-full max-w-7xl px-6 my-auto grid grid-cols-1 lg:grid-cols-12 gap-10 items-center">
        {/* Left Column: Bold Kinetic Typography, Driver Selector & CTAs */}
        <div className="lg:col-span-7 flex flex-col items-start text-left">
          {/* Neon Tag Header */}
          <motion.div
            initial={{ opacity: 0, x: -30 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.7, delay: 0.2 }}
            className="inline-flex items-center gap-2 px-3 py-1 rounded-md bg-brand-red/10 border border-brand-red/30 mb-5"
          >
            <Zap className="w-3.5 h-3.5 text-brand-red animate-pulse" />
            <span className="text-[11px] font-mono font-bold uppercase tracking-[0.25em] text-brand-red">
              NEXT-GEN F1 COCKPIT INTELLIGENCE
            </span>
          </motion.div>

          {/* Main Giant Kinetic Title */}
          <motion.h1
            initial={{ opacity: 0, y: 35 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.3 }}
            className="text-6xl sm:text-7xl md:text-8xl xl:text-9xl font-display font-black uppercase tracking-tighter text-white leading-[0.86] mb-6 drop-shadow-[0_15px_30px_rgba(0,0,0,0.9)]"
          >
            BEYOND <br />
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-brand-red via-red-500 to-amber-400">
              THE APEX
            </span>
          </motion.h1>

          {/* Subtitle / Cockpit Description */}
          <motion.p
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, delay: 0.45 }}
            className="text-base sm:text-lg md:text-xl font-body text-ink-muted max-w-xl mb-7 leading-relaxed font-normal"
          >
            Step into the simulator cockpit at 340+ km/h. Live telemetry alignment, acoustic radio intelligence, and instant AI race-engineer decision support.
          </motion.p>

          {/* Interactive Driver Selector Tabs */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, delay: 0.55 }}
            className="mb-8 flex flex-col gap-2 w-full max-w-lg"
          >
            <span className="text-[10px] font-mono tracking-widest text-ink-muted uppercase">
              SELECT ACTIVE DRIVER PROFILE:
            </span>
            <div className="grid grid-cols-4 gap-2">
              {DRIVER_PROFILES.map((driver) => {
                const isSelected = selectedDriver.number === driver.number;
                return (
                  <button
                    key={driver.number}
                    onClick={() => setSelectedDriver(driver)}
                    className={`py-2 px-2.5 rounded-xl border text-left transition-all duration-200 flex flex-col gap-0.5 cursor-pointer ${isSelected
                        ? 'bg-white/15 border-brand-red shadow-[0_0_15px_rgba(225,6,0,0.4)] scale-102'
                        : 'bg-black/40 border-white/10 hover:bg-white/5 hover:border-white/25 text-ink-muted'
                      }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-mono text-xs font-black text-white">#{driver.number}</span>
                      <span
                        className="w-2 h-2 rounded-full"
                        style={{ backgroundColor: driver.teamColor }}
                      />
                    </div>
                    <span className="text-[11px] font-display font-bold text-white uppercase truncate">
                      {driver.code}
                    </span>
                  </button>
                );
              })}
            </div>
          </motion.div>

          {/* Quick Action Navigation CTAs */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, delay: 0.65 }}
            className="flex flex-wrap items-center gap-3.5"
          >
            <a
              href="/live"
              className="px-8 py-4 rounded-full bg-brand-red text-white font-body font-bold text-sm uppercase tracking-wider hover:bg-red-600 hover:scale-105 transition-all shadow-[0_0_30px_rgba(225,6,0,0.6)] flex items-center gap-2 group"
            >
              <span>LIVE INTELLIGENCE</span>
              <ArrowUpRight className="w-4 h-4 group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-transform" />
            </a>

            <a
              href="/voice"
              className="px-6 py-4 rounded-full bg-black/60 border border-white/20 text-white font-body font-bold text-sm uppercase tracking-wider hover:bg-white/15 hover:border-white/40 transition-all backdrop-blur-xl flex items-center gap-2"
            >
              <Radio className="w-4 h-4 text-brand-red" />
              <span>VOICE INTELLIGENCE</span>
            </a>

            <a
              href="/timeline"
              className="px-6 py-4 rounded-full bg-black/60 border border-white/20 text-white font-body font-bold text-sm uppercase tracking-wider hover:bg-white/15 hover:border-white/40 transition-all backdrop-blur-xl flex items-center gap-2"
            >
              <Activity className="w-4 h-4 text-emerald-400" />
              <span>TIMELINE</span>
            </a>
          </motion.div>
        </div>

        {/* Right Column: High-Tech Cockpit Telemetry HUD */}
        <div className="lg:col-span-5 flex justify-center">
          <motion.div
            initial={{ opacity: 0, scale: 0.92, y: 30 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.4 }}
            className="w-full max-w-lg p-6 rounded-3xl bg-black/75 backdrop-blur-2xl border border-white/20 shadow-[0_20px_50px_rgba(0,0,0,0.9)] text-white font-mono flex flex-col gap-4 relative overflow-hidden"
          >
            {/* Top Gloss Edge */}
            <div className="absolute top-0 left-0 right-0 h-[1px] bg-gradient-to-r from-transparent via-white/40 to-transparent" />

            {/* Cockpit HUD Header */}
            <div className="flex items-center justify-between border-b border-white/10 pb-3 text-xs">
              <div className="flex items-center gap-2">
                <div
                  className="w-2.5 h-2.5 rounded-full"
                  style={{ backgroundColor: selectedDriver.teamColor }}
                />
                <span className="font-bold text-white uppercase tracking-wider">
                  {selectedDriver.name} #{selectedDriver.number}
                </span>
              </div>
              <div className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-ping" />
                <span className="text-[10px] text-emerald-400 font-bold uppercase tracking-widest">
                  TELEMETRY LIVE
                </span>
              </div>
            </div>

            {/* 15-LED Shift Lights Strip */}
            <div className="flex flex-col gap-1.5">
              <div className="flex justify-between text-[10px] text-ink-muted font-mono tracking-widest uppercase">
                <span>RPM {rpm.toLocaleString()}</span>
                <span>MAX 13,500</span>
              </div>
              <div className="flex gap-1.5 h-3.5 w-full bg-asphalt p-1 rounded-lg border border-white/15">
                {Array.from({ length: 15 }).map((_, i) => {
                  const isActive = i <= activeLights;
                  let bgClass = 'bg-white/10';
                  if (isActive) {
                    if (i < 5) bgClass = 'bg-emerald-500 shadow-[0_0_10px_#10b981]';
                    else if (i < 10) bgClass = 'bg-amber-400 shadow-[0_0_10px_#fbbf24]';
                    else if (i < 13) bgClass = 'bg-brand-red shadow-[0_0_12px_#e10600]';
                    else bgClass = 'bg-cyan-400 shadow-[0_0_15px_#22d3ee] animate-pulse';
                  }
                  return (
                    <div
                      key={i}
                      className={`flex-1 h-full rounded-sm transition-all duration-75 ${bgClass}`}
                    />
                  );
                })}
              </div>
            </div>

            {/* Gauges Grid */}
            <div className="grid grid-cols-3 gap-3 text-center">
              {/* Speedometer */}
              <div className="p-3.5 bg-white/5 rounded-2xl border border-white/10 flex flex-col items-center justify-center">
                <span className="text-[10px] uppercase text-ink-muted font-bold tracking-widest mb-1">
                  SPEED
                </span>
                <div className="text-4xl font-black font-display text-white tracking-tight leading-none">
                  {speed}
                </div>
                <span className="text-[10px] uppercase text-brand-red font-mono font-bold mt-1">
                  KM/H
                </span>
              </div>

              {/* Current Gear */}
              <div className="p-3.5 bg-brand-red/15 rounded-2xl border border-brand-red/40 flex flex-col items-center justify-center relative overflow-hidden">
                <span className="text-[10px] uppercase text-brand-red font-bold tracking-widest mb-1">
                  GEAR
                </span>
                <div className="text-4xl font-black font-display text-white leading-none">
                  {gear}
                </div>
                <span className="text-[10px] uppercase text-brand-red/80 font-mono font-bold mt-1">
                  SEAMLESS
                </span>
              </div>

              {/* Pace Delta */}
              <div className="p-3.5 bg-white/5 rounded-2xl border border-white/10 flex flex-col items-center justify-center">
                <span className="text-[10px] uppercase text-ink-muted font-bold tracking-widest mb-1">
                  DELTA
                </span>
                <div className="text-3xl font-black font-display text-emerald-400 tracking-tight leading-none">
                  {selectedDriver.delta}
                </div>
                <span className="text-[10px] uppercase text-emerald-400/80 font-mono font-bold mt-1">
                  VS BENCHMARK
                </span>
              </div>
            </div>

            {/* Radio Transcript Audio Wave Box */}
            <div className="p-3.5 rounded-2xl bg-white/5 border border-white/10 flex flex-col gap-2">
              <div className="flex items-center justify-between text-[11px]">
                <div className="flex items-center gap-2 text-brand-red font-bold">
                  <Radio className="w-3.5 h-3.5 animate-pulse" />
                  <span>TEAM RADIO AUDIO FEED</span>
                </div>
                <div className="flex items-center gap-1">
                  {[...Array(6)].map((_, i) => (
                    <span
                      key={i}
                      className="w-1 bg-brand-red rounded-full animate-pulse"
                      style={{
                        height: `${8 + Math.sin(i * 1.5) * 8}px`,
                        animationDelay: `${i * 0.15}s`
                      }}
                    />
                  ))}
                </div>
              </div>
              <p className="text-xs text-white/90 font-mono italic">
                "{selectedDriver.radioMsg}"
              </p>
            </div>

            {/* Reactive Lateral G-Force & DRS Bar */}
            <div className="flex justify-between items-center text-[10px] text-ink-muted border-t border-white/10 pt-3 font-mono">
              <div className="flex items-center gap-1.5">
                <ShieldAlert className="w-3.5 h-3.5 text-amber-400" />
                <span>
                  LATERAL G:{' '}
                  <strong className="text-white">
                    {(4.2 + (Math.abs(mousePos.x) / 10)).toFixed(1)}G
                  </strong>
                </span>
              </div>
              <div className="flex items-center gap-1.5">
                <Flag className="w-3.5 h-3.5 text-emerald-400" />
                <span>
                  DRS: <strong className="text-emerald-400">ENABLED</strong>
                </span>
              </div>
              <div>
                TYRE TEMP:{' '}
                <strong className="text-amber-400">104°C</strong>
              </div>
            </div>
          </motion.div>
        </div>
      </div>

      {/* Bottom Scroll Cue */}
      <motion.div
        initial={{ opacity: 0, y: 15 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.8, delay: 0.9 }}
        className="relative z-20 flex flex-col items-center gap-2 cursor-pointer group mt-4"
        onClick={() => {
          window.scrollTo({ top: window.innerHeight * 0.85, behavior: 'smooth' });
        }}
      >
        <span className="text-[10px] font-mono tracking-[0.3em] uppercase text-ink-muted group-hover:text-white transition-colors">
          SCROLL TO EXPLORE RACE MATRIX
        </span>
        <ChevronDown className="w-4 h-4 text-brand-red animate-bounce" />
      </motion.div>
    </section>
  );
}

