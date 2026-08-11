import { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { ShieldAlert, Zap, Wind, Disc, X, Sparkles } from 'lucide-react';

interface Hotspot {
  id: string;
  title: string;
  sub: string;
  x: number; // percentage
  y: number; // percentage
  icon: typeof Wind;
  specs: { label: string; value: string }[];
  description: string;
}

const HOTSPOTS: Hotspot[] = [
  {
    id: 'aero',
    title: 'GROUND EFFECT AERO',
    sub: 'Underfloor Venturi Tunnels',
    x: 18,
    y: 75,
    icon: Wind,
    specs: [
      { label: 'Downforce', value: '2,800 kg @ 250km/h' },
      { label: 'Airflow Speed', value: 'Mach 0.35' },
      { label: 'Material', value: 'Honeycombed Carbon-Kevlar' },
    ],
    description: 'Generates up to 60% of total vehicle downforce using negative pressure channels beneath the chassis.',
  },
  {
    id: 'halo',
    title: 'TITANIUM HALO COCKPIT',
    sub: 'Grade 5 Titanium Alloy',
    x: 52,
    y: 35,
    icon: ShieldAlert,
    specs: [
      { label: 'Impact Load', value: '125 kN (12.5 Tonnes)' },
      { label: 'Structure Weight', value: 'Only 9.0 kg' },
      { label: 'Testing Standard', value: 'FIA Spec 8869-2018' },
    ],
    description: 'Capable of sustaining the weight of two double-decker buses to safeguard the driver in high-G impacts.',
  },
  {
    id: 'engine',
    title: '1.6L V6 TURBO HYBRID + MGU-K',
    sub: '1,050+ Horsepower Unit',
    x: 65,
    y: 50,
    icon: Zap,
    specs: [
      { label: 'Thermal Efficiency', value: 'Over 50%' },
      { label: 'RPM Ceiling', value: '15,000 RPM' },
      { label: 'Hybrid Output', value: '120 kW (160 hp) E-boost' },
    ],
    description: 'The most efficient internal combustion engine on Earth, harvesting braking kinetic energy in milliseconds.',
  },
  {
    id: 'tires',
    title: 'PIRELLI C5 SOFT COMPOUND',
    sub: 'Ultra-High Thermal Grip Slicks',
    x: 82,
    y: 72,
    icon: Disc,
    specs: [
      { label: 'Operating Temp', value: '100°C - 110°C' },
      { label: 'Peak Lateral Grip', value: '5.2 G' },
      { label: 'Stint Lifespan', value: '15-20 Laps' },
    ],
    description: 'Specially engineered polymer matrix providing maximum mechanical traction through high-speed corners.',
  },
];

export function CarHotspotInspector() {
  const [activeHotspot, setActiveHotspot] = useState<Hotspot | null>(null);

  return (
    <section className="relative w-full min-h-screen bg-asphalt text-white py-24 px-6 overflow-hidden flex flex-col justify-center items-center">
      {/* Background Grid Pattern */}
      <div className="absolute inset-0 bg-[radial-gradient(#e10600_1px,transparent_1px)] [background-size:32px_32px] opacity-10 pointer-events-none" />

      {/* Header */}
      <div className="text-center z-10 max-w-3xl mb-12">
        <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-brand-red/10 border border-brand-red/30 mb-4">
          <Sparkles className="w-4 h-4 text-brand-red animate-pulse" />
          <span className="text-xs font-mono uppercase font-bold tracking-widest text-brand-red">
            3D Chassis Breakdown
          </span>
        </div>
        <h2 className="text-4xl md:text-6xl font-display font-black uppercase tracking-tight leading-none mb-4">
          INSPECT THE <span className="text-brand-red">WARMACHINE</span>
        </h2>
        <p className="text-ink-muted font-body text-sm md:text-base tracking-wide">
          Tap any telemetry node to inspect the cutting-edge aerospace engineering beneath the carbon bodywork.
        </p>
      </div>

      {/* Main Interactive Stage */}
      <div className="relative w-full max-w-6xl aspect-[16/9] min-h-[450px] bg-black/60 rounded-3xl border border-brand-red/10 overflow-hidden shadow-[0_0_50px_rgba(225,6,0,0.1)] backdrop-blur-md flex items-center justify-center">
        {/* F1 Silhouette Chassis Graphic */}
        <img
          src="/f1_wireframe.png"
          alt="F1 Machine Spec"
          className="w-full h-full object-cover opacity-90 drop-shadow-[0_0_15px_rgba(225,6,0,0.5)]"
        />

        {/* Dark Vignette Overlay */}
        <div className="absolute inset-0 bg-gradient-to-t from-asphalt via-transparent to-asphalt/80" />

        {/* Hotspot Target Markers */}
        {HOTSPOTS.map((spot) => {
          const Icon = spot.icon;
          const isSelected = activeHotspot?.id === spot.id;

          return (
            <div
              key={spot.id}
              style={{ left: `${spot.x}%`, top: `${spot.y}%` }}
              className="absolute -translate-x-1/2 -translate-y-1/2 z-30"
            >
              <button
                onClick={() => setActiveHotspot(spot)}
                className="relative group focus:outline-none"
              >
                {/* Target Pulsing Outer Rings */}
                <div className={`absolute -inset-4 rounded-full border border-brand-red transition-all duration-500 ${isSelected ? 'scale-150 opacity-100 animate-ping' : 'opacity-40 group-hover:scale-125'}`} />
                <div className="absolute -inset-2 rounded-full border border-white/40" />

                {/* Center Target Point */}
                <div className={`w-10 h-10 rounded-full flex items-center justify-center backdrop-blur-md transition-all duration-300 ${isSelected ? 'bg-brand-red text-white shadow-[0_0_20px_#e10600]' : 'bg-black/70 text-white border border-white/30 group-hover:bg-brand-red group-hover:border-brand-red'}`}>
                  <Icon className="w-5 h-5" />
                </div>

                {/* Floating Hotspot Title Tag */}
                <div className="absolute left-1/2 -translate-x-1/2 top-12 whitespace-nowrap px-3 py-1 bg-black/80 border border-white/20 rounded-md backdrop-blur-md text-[10px] font-mono tracking-widest uppercase font-bold text-white opacity-80 group-hover:opacity-100 transition-opacity">
                  {spot.title}
                </div>
              </button>
            </div>
          );
        })}

        {/* Active Hotspot Modal Card Drawer */}
        <AnimatePresence>
          {activeHotspot && (
            <motion.div
              initial={{ opacity: 0, y: 30, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 30, scale: 0.95 }}
              transition={{ duration: 0.3 }}
              className="absolute bottom-6 left-6 right-6 md:left-auto md:right-6 md:w-[420px] z-40 p-6 rounded-2xl bg-black/85 backdrop-blur-2xl border border-brand-red/40 shadow-2xl text-white font-body"
            >
              {/* Modal Header */}
              <div className="flex items-start justify-between border-b border-white/10 pb-4 mb-4">
                <div>
                  <span className="text-[10px] font-mono uppercase tracking-widest text-brand-red font-bold">
                    {activeHotspot.sub}
                  </span>
                  <h3 className="text-xl font-display font-black uppercase text-white mt-1">
                    {activeHotspot.title}
                  </h3>
                </div>
                <button
                  onClick={() => setActiveHotspot(null)}
                  className="p-1 rounded-full bg-white/10 hover:bg-white/20 text-white transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Description */}
              <p className="text-xs text-ink-muted leading-relaxed mb-5">
                {activeHotspot.description}
              </p>

              {/* Specs Table */}
              <div className="space-y-2 font-mono text-xs">
                {activeHotspot.specs.map((spec, i) => (
                  <div key={i} className="flex justify-between p-2 rounded-lg bg-white/5 border border-white/5">
                    <span className="text-ink-muted uppercase">{spec.label}</span>
                    <span className="font-bold text-white">{spec.value}</span>
                  </div>
                ))}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </section>
  );
}
