import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import WarpText from '@/components/ui/WarpText';
import { cn } from '@/lib/utils';
import { Mic, Activity, AlertTriangle } from 'lucide-react';

function RadioTranscriptCard() {
  const [isPlaying, setIsPlaying] = useState(false);
  const [text, setText] = useState("");
  const fullText = "Box this lap, box this lap, confirm.";
  
  // Animation logic to simulate audio playback
  useEffect(() => {
    let timeout: ReturnType<typeof setTimeout>;
    let interval: ReturnType<typeof setInterval>;
    if (isPlaying) {
      let i = 0;
      setText("");
      interval = setInterval(() => {
        setText(fullText.substring(0, i + 1));
        i++;
        if (i >= fullText.length) {
          clearInterval(interval);
          timeout = setTimeout(() => setIsPlaying(false), 2000);
        }
      }, 50);
      return () => {
        clearInterval(interval);
        clearTimeout(timeout);
      };
    } else {
      setText("");
    }
  }, [isPlaying]);

  return (
    <div className="bg-[#17191C] rounded-2xl border border-chrome/10 p-6 flex flex-col gap-6 relative overflow-hidden group">
      {/* Top Header */}
      <div className="flex justify-between items-center">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-asphalt flex items-center justify-center border border-chrome/20">
            <Mic className="w-5 h-5 text-chrome" />
          </div>
          <div>
            <div className="font-mono text-xs text-ink-muted uppercase tracking-wider">Driver 1 Radio</div>
            <div className="font-display font-medium text-ink">LAP 29</div>
          </div>
        </div>
        
        {/* Mood Badge */}
        <AnimatePresence mode="wait">
          <motion.div 
            key={isPlaying ? "stressed" : "calm"}
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.8 }}
            className={cn(
              "px-3 py-1 rounded-full font-mono text-xs tracking-wider border",
              isPlaying 
                ? "bg-accent-amber/10 border-accent-amber/50 text-accent-amber" 
                : "bg-accent-teal/10 border-accent-teal/50 text-accent-teal"
            )}
          >
            {isPlaying ? "STRESSED" : "CALM"}
          </motion.div>
        </AnimatePresence>
      </div>

      {/* Waveform */}
      <div 
        className="h-16 flex items-end gap-1 cursor-pointer"
        onClick={() => !isPlaying && setIsPlaying(true)}
      >
        {[...Array(40)].map((_, i) => {
          const height = isPlaying 
            ? Math.random() * 80 + 20 
            : Math.random() * 20 + 10;
          return (
            <motion.div
              key={i}
              className={cn(
                "w-full rounded-t-sm transition-colors duration-300",
                isPlaying ? "bg-accent-amber" : "bg-chrome/30"
              )}
              animate={{ height: `${height}%` }}
              transition={{ duration: 0.1, repeat: isPlaying ? Infinity : 0, repeatType: 'reverse' }}
            />
          );
        })}
      </div>

      {/* Transcript Text */}
      <div className="h-12">
        {isPlaying ? (
          <p className="font-mono text-lg text-ink">
            {text}<span className="animate-pulse">_</span>
          </p>
        ) : (
          <p className="font-mono text-lg text-chrome/40 hover:text-chrome/60 transition-colors cursor-pointer" onClick={() => setIsPlaying(true)}>
            Click waveform to play transmission...
          </p>
        )}
      </div>
    </div>
  );
}

function MiniChart() {
  return (
    <div className="bg-[#17191C] rounded-2xl border border-chrome/10 p-6 flex flex-col gap-6">
      <div className="flex justify-between items-center mb-2">
        <h3 className="font-mono text-xs text-ink-muted uppercase tracking-wider flex items-center gap-2">
          <Activity className="w-4 h-4" />
          Stress vs Lap Time
        </h3>
      </div>
      
      {/* Simple SVG Line Chart */}
      <div className="relative h-40 w-full">
        <svg viewBox="0 0 100 100" preserveAspectRatio="none" className="w-full h-full overflow-visible">
          {/* Grid lines */}
          <line x1="0" y1="25" x2="100" y2="25" stroke="rgba(201, 205, 211, 0.1)" strokeWidth="0.5" />
          <line x1="0" y1="50" x2="100" y2="50" stroke="rgba(201, 205, 211, 0.1)" strokeWidth="0.5" />
          <line x1="0" y1="75" x2="100" y2="75" stroke="rgba(201, 205, 211, 0.1)" strokeWidth="0.5" />
          
          {/* Area under stress curve */}
          <polygon 
            points="0,100 0,60 20,65 40,30 60,80 80,40 100,50 100,100" 
            fill="rgba(217, 142, 74, 0.1)" 
          />
          {/* Stress Line (Amber) */}
          <polyline 
            points="0,60 20,65 40,30 60,80 80,40 100,50" 
            fill="none" 
            stroke="#D98E4A" 
            strokeWidth="2" 
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          {/* Lap Time Delta Line (Chrome) */}
          <polyline 
            points="0,70 20,60 40,40 60,50 80,30 100,20" 
            fill="none" 
            stroke="#C9CDD3" 
            strokeWidth="1.5" 
            strokeDasharray="4 4"
          />
          
          {/* Highlight Point */}
          <circle cx="40" cy="30" r="3" fill="#D98E4A" className="animate-pulse" />
        </svg>
        
        {/* Labels */}
        <div className="absolute inset-0 flex justify-between items-end pointer-events-none mt-2">
          <span className="font-numeric text-xs text-ink-muted">L15</span>
          <span className="font-numeric text-xs text-ink-muted">L20</span>
          <span className="font-numeric text-xs text-brand-red">L29 (BOX)</span>
          <span className="font-numeric text-xs text-ink-muted">L35</span>
        </div>
      </div>
    </div>
  );
}

function SilenceDetector() {
  return (
    <div className="mt-12 bg-brand-red-deep/20 rounded-2xl border border-brand-red/30 p-8 flex flex-col md:flex-row items-center gap-8">
      <div className="flex-shrink-0 bg-asphalt p-4 rounded-full border border-brand-red/50">
        <AlertTriangle className="w-8 h-8 text-brand-red" />
      </div>
      <div className="flex-grow">
        <h3 className="font-display text-2xl font-semibold text-ink mb-2">The Silence Detector</h3>
        <p className="font-body text-ink-muted mb-6 max-w-2xl">
          Sometimes the most important warning sign is that the driver said nothing at all. 
          Our system flags extended radio silence during critical track events (like position loss or sudden deceleration).
        </p>
        
        {/* Timeline Visual */}
        <div className="relative h-12 flex items-center">
          <div className="absolute left-0 right-0 h-1 bg-chrome/20 rounded-full" />
          
          <div className="absolute left-[10%] w-3 h-3 rounded-full bg-accent-teal shadow-[0_0_10px_rgba(63,169,160,0.5)]" />
          <div className="absolute left-[30%] w-3 h-3 rounded-full bg-accent-teal shadow-[0_0_10px_rgba(63,169,160,0.5)]" />
          
          {/* Silence Gap */}
          <div className="absolute left-[40%] right-[20%] h-1 bg-brand-red shadow-[0_0_15px_rgba(225,6,0,0.5)] animate-pulse" />
          
          <div className="absolute left-[80%] w-3 h-3 rounded-full bg-accent-amber shadow-[0_0_10px_rgba(217,142,74,0.5)]" />
          
          {/* Callouts */}
          <div className="absolute left-[40%] -top-8 font-mono text-[10px] text-brand-red uppercase tracking-wider">
            Incident
          </div>
          <div className="absolute left-[60%] -bottom-8 font-mono text-[10px] text-brand-red uppercase tracking-wider">
            4m12s Silence
          </div>
        </div>
      </div>
    </div>
  );
}

export function VoiceFeature() {
  return (
    <section id="voice" className="py-32 px-6 bg-asphalt relative">
      <div className="max-w-7xl mx-auto">
        <div className="mb-16">
          <h2 className="font-display text-4xl md:text-6xl font-bold uppercase tracking-tight text-ink mb-4">
            <WarpText text="THE SILENT" />
            <WarpText text="CO-DRIVER" />
          </h2>
          <p className="font-body text-xl text-ink-muted max-w-2xl">
            Real-time vocal stress analysis transforms radio chatter into actionable engineering intelligence.
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          <RadioTranscriptCard />
          <MiniChart />
        </div>

        <SilenceDetector />
      </div>
    </section>
  );
}
