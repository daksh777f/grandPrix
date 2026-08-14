import { useEffect, useState } from 'react';
import { motion } from 'motion/react';
import { Gauge, Zap, Compass, Activity } from 'lucide-react';

export function TelemetryHUD() {
  const [speed, setSpeed] = useState(335);
  const [rpm, setRpm] = useState(12200);
  const [gear, setGear] = useState(7);
  const [sectorDelta] = useState('-0.184');

  // Dynamic Telemetry simulation ticker
  useEffect(() => {
    const interval = setInterval(() => {
      const spdDelta = (Math.random() - 0.45) * 6;
      setSpeed((prev) => Math.min(355, Math.max(280, Math.round(prev + spdDelta))));

      const rpmDelta = (Math.random() - 0.45) * 250;
      setRpm((prev) => {
        const next = Math.min(13500, Math.max(10500, Math.round(prev + rpmDelta)));
        if (next > 13200) setGear(8);
        else if (next < 11000) setGear(7);
        return next;
      });
    }, 150);

    return () => clearInterval(interval);
  }, []);

  // Calculate shift lights percentage (10500 to 13500 RPM)
  const shiftPct = Math.min(1, Math.max(0, (rpm - 10500) / 3000));
  const activeLights = Math.floor(shiftPct * 15);

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.8, delay: 0.5 }}
      className="w-full max-w-lg p-5 rounded-2xl bg-black/60 backdrop-blur-xl border border-white/15 shadow-2xl text-white font-mono flex flex-col gap-4 select-none"
    >
      {/* HUD Header */}
      <div className="flex items-center justify-between border-b border-white/10 pb-3 text-xs tracking-widest text-ink-muted">
        <div className="flex items-center gap-2">
          <Activity className="w-4 h-4 text-brand-red animate-pulse" />
          <span className="font-bold text-white uppercase">TELEMETRY PREVIEW</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-emerald-500 animate-ping" />
           <span className="text-[10px] text-emerald-400 font-bold">ARCHIVE SIGNAL</span>
        </div>
      </div>

      {/* RPM LED Shift Light Strip (15 LEDs) */}
      <div className="flex flex-col gap-1.5">
        <div className="flex justify-between text-[10px] text-ink-muted font-mono tracking-widest uppercase">
          <span>RPM 10,500</span>
          <span>MAX 13,500</span>
        </div>
        <div className="flex gap-1.5 h-3 w-full bg-asphalt/80 p-1 rounded-md border border-white/10">
          {Array.from({ length: 15 }).map((_, i) => {
            const isActive = i <= activeLights;
            let bgClass = 'bg-white/10';
            if (isActive) {
              if (i < 5) bgClass = 'bg-emerald-500 shadow-[0_0_8px_#10b981]';
              else if (i < 10) bgClass = 'bg-amber-400 shadow-[0_0_8px_#fbbf24]';
              else if (i < 13) bgClass = 'bg-brand-red shadow-[0_0_10px_#e10600]';
              else bgClass = 'bg-cyan-400 shadow-[0_0_12px_#22d3ee] animate-pulse';
            }
            return <div key={i} className={`flex-1 h-full rounded-sm transition-all duration-75 ${bgClass}`} />;
          })}
        </div>
      </div>

      {/* Main Gauges Grid */}
      <div className="grid grid-cols-3 gap-3 text-center">
        {/* Speedometer */}
        <div className="p-3 bg-white/5 rounded-xl border border-white/10 flex flex-col items-center justify-center">
          <Gauge className="w-4 h-4 text-brand-red mb-1" />
          <div className="text-3xl font-black font-display text-white tracking-tight leading-none">
            {speed}
          </div>
          <span className="text-[10px] uppercase text-ink-muted font-bold tracking-widest mt-1">KM/H</span>
        </div>

        {/* Current Gear */}
        <div className="p-3 bg-brand-red/10 rounded-xl border border-brand-red/30 flex flex-col items-center justify-center relative overflow-hidden">
          <Zap className="w-4 h-4 text-brand-red mb-1" />
          <div className="text-4xl font-black font-display text-brand-red leading-none">
            {gear}
          </div>
          <span className="text-[10px] uppercase text-brand-red font-bold tracking-widest mt-1">GEAR</span>
        </div>

        {/* Sector Delta */}
        <div className="p-3 bg-white/5 rounded-xl border border-white/10 flex flex-col items-center justify-center">
          <Compass className="w-4 h-4 text-emerald-400 mb-1" />
          <div className="text-2xl font-bold text-emerald-400 tracking-tight leading-none">
            {sectorDelta}s
          </div>
          <span className="text-[10px] uppercase text-ink-muted font-bold tracking-widest mt-1">S3 PACE</span>
        </div>
      </div>

      {/* Footer Metrics */}
      <div className="flex justify-between items-center text-[10px] text-ink-muted border-t border-white/10 pt-2 font-mono">
        <div>LATERAL G: <span className="text-white font-bold">4.8G</span></div>
        <div>DRS: <span className="text-emerald-400 font-bold">ENABLED</span></div>
        <div>TYRE TEMP: <span className="text-amber-400 font-bold">102°C</span></div>
      </div>
    </motion.div>
  );
}
