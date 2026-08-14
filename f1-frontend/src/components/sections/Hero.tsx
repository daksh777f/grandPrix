import { useState } from 'react';
import { motion } from 'motion/react';
import { Play, Volume2, VolumeX, ChevronDown, Sparkles } from 'lucide-react';
import { TelemetryHUD } from '@/components/ui/TelemetryHUD';
import { f1Audio } from '@/utils/f1Sound';

export function Hero() {
  const [audioMuted, setAudioMuted] = useState(true);
  const [mousePos, setMousePos] = useState({ x: 0, y: 0 });

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
    f1Audio.playRev();
  };

  return (
    <section
      onMouseMove={handleMouseMove}
      className="relative w-full min-h-screen bg-asphalt overflow-hidden flex flex-col justify-between items-center z-10 pt-20 pb-12"
    >
      {/* High-Resolution F1 Car Action Background Image with Dynamic Parallax Movement */}
      <div className="absolute inset-0 w-full h-full overflow-hidden pointer-events-none z-0">
        <img
          src="/hero_f1_car.png"
          alt="Formula 1 Racing Machine"
          style={{
            transform: `scale(1.1) translate(${mousePos.x * -0.8}px, ${mousePos.y * -0.8}px)`,
          }}
          className="w-full h-full object-cover object-center filter contrast-110 brightness-75 transition-transform duration-200 ease-out"
        />
        {/* Dark Red & Asphalt Radial Gradients for Contrast & Atmosphere */}
        <div className="absolute inset-0 bg-gradient-to-r from-asphalt/95 via-asphalt/70 to-asphalt/85" />
        <div className="absolute inset-0 bg-gradient-to-t from-asphalt via-transparent to-asphalt/90" />
      </div>

      {/* Top Floating Control Bar */}
      <div className="relative z-20 w-full max-w-7xl px-6 flex justify-between items-center">
        {/* Status Badge */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8 }}
          className="flex items-center gap-3 px-4 py-2 rounded-full bg-black/60 border border-white/10 backdrop-blur-xl"
        >
          <span className="w-2.5 h-2.5 rounded-full bg-brand-red" />
          <span className="text-xs font-mono font-bold tracking-widest text-white uppercase">
            SINGAPORE GP 2023 // ARCHIVE
          </span>
        </motion.div>

        {/* Audio Engine Roar Synthesizer Controls */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, delay: 0.2 }}
          className="flex items-center gap-3"
        >
          <button
            onClick={handleRevPulse}
            className="px-4 py-2 rounded-full bg-brand-red text-white font-mono text-xs font-bold uppercase tracking-wider hover:bg-brand-red/90 transition-all shadow-[0_0_15px_#e10600] flex items-center gap-2 active:scale-95"
          >
            <Play className="w-3.5 h-3.5 fill-white" />
            <span>REV V10 ENGINE</span>
          </button>

          <button
            onClick={handleAudioToggle}
            className="p-2.5 rounded-full bg-black/60 border border-white/10 text-white hover:bg-white/10 transition-colors backdrop-blur-xl"
            title="Toggle Ambient Idle Sound"
          >
            {audioMuted ? <VolumeX className="w-4 h-4 text-ink-muted" /> : <Volume2 className="w-4 h-4 text-emerald-400" />}
          </button>
        </motion.div>
      </div>

      {/* Hero Central Stage Grid */}
      <div className="relative z-20 w-full max-w-7xl px-6 my-auto grid grid-cols-1 lg:grid-cols-12 gap-12 items-center">
        {/* Left Column: Bold Gen Z Typography & Action Triggers */}
        <div className="lg:col-span-7 flex flex-col items-start text-left">
          {/* Subheading tag */}
          <motion.div
            initial={{ opacity: 0, x: -30 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.8, delay: 0.3 }}
            className="flex items-center gap-2 mb-4"
          >
            <Sparkles className="w-4 h-4 text-brand-red" />
            <span className="text-xs md:text-sm font-mono font-bold uppercase tracking-[0.3em] text-brand-red">
              NEXT-GEN F1 EXPERIENCE
            </span>
          </motion.div>

          {/* Main Giant Headline */}
          <motion.h1
            initial={{ opacity: 0, y: 40 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 1, delay: 0.4 }}
            className="text-6xl md:text-8xl xl:text-9xl font-display font-black uppercase tracking-tighter text-white leading-[0.88] mb-6 drop-shadow-2xl"
          >
            BEYOND <br />
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-brand-red via-red-500 to-amber-400">
              THE APEX
            </span>
          </motion.h1>

          {/* Subtitle */}
          <motion.p
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.6 }}
            className="text-base md:text-xl font-body text-ink-muted max-w-xl mb-8 leading-relaxed font-medium"
          >
            Step into a historical Formula 1 cockpit. Telemetry, team radio, and AI race-engineer context brought together for the next decision.
          </motion.p>

          {/* Action Pills */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.8 }}
            className="flex flex-wrap items-center gap-4"
          >
            <a
              href="/live"
              className="px-8 py-4 rounded-full bg-brand-red text-white font-body font-bold text-sm uppercase tracking-wider hover:scale-105 transition-transform shadow-[0_0_25px_#e10600]"
            >
              Live Intelligence
            </a>
            <a
              href="/voice"
              className="px-8 py-4 rounded-full bg-white/10 border border-white/20 text-white font-body font-bold text-sm uppercase tracking-wider hover:bg-white/20 transition-colors backdrop-blur-md"
            >
              Voice Intelligence
            </a>
            <a
              href="/timeline"
              className="px-8 py-4 rounded-full bg-white/10 border border-white/20 text-white font-body font-bold text-sm uppercase tracking-wider hover:bg-white/20 transition-colors backdrop-blur-md"
            >
              Race Timeline
            </a>
          </motion.div>
        </div>

        {/* Right Column: Live Telemetry HUD Card */}
        <div className="lg:col-span-5 flex justify-center">
          <TelemetryHUD />
        </div>
      </div>

      {/* Bottom Scroll Cue */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.8, delay: 1 }}
        className="relative z-20 flex flex-col items-center gap-2 cursor-pointer group"
      >
        <span className="text-[10px] font-mono tracking-[0.3em] uppercase text-ink-muted group-hover:text-white transition-colors">
          SCROLL TO INSPECT TELEMETRY
        </span>
        <ChevronDown className="w-4 h-4 text-brand-red animate-bounce" />
      </motion.div>
    </section>
  );
}
