import { useState, useEffect } from 'react';
import { LOCATION_SAMPLES } from '@/data/mockData';
import { Play, Map as MapIcon, Crosshair } from 'lucide-react';

export function RaceReplay() {
  const [currentTick, setCurrentTick] = useState(0);

  // Animate through location samples
  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentTick((prev) => (prev + 1) % LOCATION_SAMPLES.length);
    }, 1000); // 1 second per tick for demo
    
    return () => clearInterval(interval);
  }, []);

  const currentSample = LOCATION_SAMPLES[currentTick];
  
  // Normalize coordinates for the SVG (very simple mapping just for demo)
  // X ranges roughly -7000 to -6600
  // Y ranges roughly -1650 to -1400
  const normalizedX = ((currentSample.x + 7000) / 400) * 100;
  const normalizedY = ((currentSample.y + 1700) / 300) * 100;

  return (
    <section id="replay" className="py-32 px-6 bg-[#0a0a0c] relative border-t border-chrome/10">
      <div className="max-w-7xl mx-auto">
        <div className="mb-12">
          <h2 className="font-display text-3xl md:text-5xl font-bold uppercase tracking-tight text-ink mb-4 flex items-center gap-4">
            <Crosshair className="w-8 h-8 text-chrome" />
            Race Replay Engine
          </h2>
          <p className="font-body text-xl text-ink-muted max-w-2xl">
            High-fidelity synchronized playback of telemetry, GPS, and radio.
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 h-[500px]">
          {/* Telemetry Side Panel */}
          <div className="lg:col-span-1 bg-[#17191C] rounded-2xl border border-chrome/10 p-6 flex flex-col justify-between">
            <div>
              <div className="flex justify-between items-center mb-8">
                <span className="font-mono text-sm text-ink-muted uppercase tracking-wider">Live Telemetry</span>
                <span className="flex items-center gap-2 px-2 py-1 rounded bg-brand-red/10 text-brand-red font-mono text-xs animate-pulse">
                  <Play className="w-3 h-3" /> REPLAY
                </span>
              </div>
              
              <div className="space-y-6">
                <div>
                  <div className="font-mono text-xs text-chrome/50 uppercase tracking-widest mb-1">Driver</div>
                  <div className="font-display text-2xl text-ink flex items-center gap-3">
                    <span className="text-[#3671C6] font-bold">VER</span>
                    <span className="text-chrome/30">|</span>
                    <span>P1</span>
                  </div>
                </div>
                
                <div>
                  <div className="font-mono text-xs text-chrome/50 uppercase tracking-widest mb-1">Lap Time</div>
                  <div className="font-numeric text-5xl text-ink">1:24.30{currentTick}</div>
                </div>
                
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <div className="font-mono text-xs text-chrome/50 uppercase tracking-widest mb-1">Speed</div>
                    <div className="font-numeric text-3xl text-ink">{280 + currentTick * 5} <span className="text-sm text-chrome/50">KM/H</span></div>
                  </div>
                  <div>
                    <div className="font-mono text-xs text-chrome/50 uppercase tracking-widest mb-1">Gear</div>
                    <div className="font-numeric text-3xl text-ink">{7 - (currentTick % 2)}</div>
                  </div>
                </div>
              </div>
            </div>
            
            <div className="pt-6 border-t border-chrome/10">
              <button className="w-full py-3 rounded-lg border border-brand-red/50 text-brand-red font-body font-bold hover:bg-brand-red/10 transition-colors">
                Launch Full Engine
              </button>
            </div>
          </div>

          {/* Track Map Visual */}
          <div className="lg:col-span-2 bg-[#0D0D0F] rounded-2xl border border-chrome/10 p-6 relative overflow-hidden flex items-center justify-center">
            {/* Background grid */}
            <div className="absolute inset-0 bg-[linear-gradient(to_right,#80808012_1px,transparent_1px),linear-gradient(to_bottom,#80808012_1px,transparent_1px)] bg-[size:24px_24px]" />
            
            <div className="absolute top-6 left-6 flex items-center gap-2 text-chrome/50 font-mono text-xs">
              <MapIcon className="w-4 h-4" />
              <span>SECTOR 2 - TRACKING</span>
            </div>

            {/* SVG Track Map */}
            <div className="relative w-full max-w-lg aspect-video z-10">
              <svg viewBox="0 0 100 100" className="w-full h-full overflow-visible">
                {/* Track Path (Abstract corner) */}
                <path 
                  d="M100,20 C70,20 40,40 20,80 L0,100" 
                  fill="none" 
                  stroke="rgba(201,205,211,0.2)" 
                  strokeWidth="8" 
                  strokeLinecap="round"
                />
                
                {/* Racing Line */}
                <path 
                  d="M100,22 C72,22 43,40 23,78" 
                  fill="none" 
                  stroke="rgba(63,169,160,0.5)" 
                  strokeWidth="2" 
                  strokeDasharray="4 4"
                />

                {/* Animated Driver Dot */}
                {/* Simulating motion along the path using the mock data normalized coords */}
                <g style={{ transform: `translate(${normalizedX}%, ${normalizedY}%)`, transition: 'transform 1s linear' }}>
                  <circle cx="0" cy="0" r="3" fill="#3671C6" />
                  <circle cx="0" cy="0" r="6" fill="none" stroke="#3671C6" strokeWidth="1" className="animate-ping" />
                  <text x="8" y="3" className="font-mono text-[8px]" fill="#F4F1EC">VER</text>
                </g>
              </svg>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
