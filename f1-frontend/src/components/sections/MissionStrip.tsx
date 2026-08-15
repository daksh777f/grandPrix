import { useRef, useEffect } from 'react';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { Flame } from 'lucide-react';

gsap.registerPlugin(ScrollTrigger);

export function MissionStrip() {
  const containerRef = useRef<HTMLDivElement>(null);
  const textRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const mm = gsap.matchMedia();

    mm.add("(prefers-reduced-motion: no-preference)", () => {
      if (textRef.current && containerRef.current) {
        gsap.fromTo(textRef.current,
          { y: 60, opacity: 0 },
          {
            y: 0,
            opacity: 1,
            duration: 1.1,
            ease: "power3.out",
            scrollTrigger: {
              trigger: containerRef.current,
              start: "top 75%",
            }
          }
        );
      }
    });

    mm.add("(prefers-reduced-motion: reduce)", () => {
      if (textRef.current) {
        gsap.set(textRef.current, { opacity: 1, y: 0 });
      }
    });

    return () => mm.revert();
  }, []);

  return (
    <section ref={containerRef} className="py-28 px-6 bg-asphalt flex flex-col items-center justify-center border-t border-chrome/10 relative z-10 overflow-hidden">
      {/* Subtle race track line decor */}
      <div className="absolute inset-0 bg-[linear-gradient(to_right,#e1060010_1px,transparent_1px),linear-gradient(to_bottom,#e1060010_1px,transparent_1px)] bg-[size:4rem_4rem] [mask-image:radial-gradient(ellipse_60%_50%_at_50%_50%,#000_70%,transparent_100%)] pointer-events-none" />

      <div ref={textRef} className="max-w-5xl text-center flex flex-col items-center gap-6 relative z-10">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-brand-red/10 border border-brand-red/30">
          <Flame className="w-3.5 h-3.5 text-brand-red animate-pulse" />
          <span className="text-[11px] font-mono font-bold tracking-[0.25em] text-brand-red uppercase">
            // ZERO-PIT INTELLIGENCE PHILOSOPHY
          </span>
        </div>

        <h2 className="font-display text-3xl sm:text-5xl md:text-6xl font-extrabold uppercase tracking-wide text-white leading-snug md:leading-[1.2] max-w-4xl">
          IN FORMULA 1, A TENTH OF A SECOND
          <span className="block mt-2 text-transparent bg-clip-text bg-gradient-to-r from-brand-red via-red-500 to-amber-400 font-black">
            IS AN ETERNITY.
          </span>
        </h2>

        <p className="font-body text-ink-muted text-base sm:text-lg md:text-xl max-w-2xl leading-relaxed mt-2">
          Traditional telemetry tells you what happened. The Silent Co-Driver tells you <strong className="text-white font-semibold">what to do next</strong> before the apex arrives.
        </p>

        {/* Live Stat Badges */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mt-6 w-full max-w-4xl">
          <div className="p-4 rounded-2xl bg-black/40 border border-white/10 backdrop-blur-md text-center">
            <span className="font-display text-3xl sm:text-4xl font-black text-white">0.001s</span>
            <span className="text-[10px] font-mono text-ink-muted uppercase block mt-1">Telemetry Precision</span>
          </div>
          <div className="p-4 rounded-2xl bg-black/40 border border-white/10 backdrop-blur-md text-center">
            <span className="font-display text-3xl sm:text-4xl font-black text-brand-red">19</span>
            <span className="text-[10px] font-mono text-ink-muted uppercase block mt-1">Corners Calibrated</span>
          </div>
          <div className="p-4 rounded-2xl bg-black/40 border border-white/10 backdrop-blur-md text-center">
            <span className="font-display text-3xl sm:text-4xl font-black text-emerald-400">100%</span>
            <span className="text-[10px] font-mono text-ink-muted uppercase block mt-1">Offline Deterministic</span>
          </div>
          <div className="p-4 rounded-2xl bg-black/40 border border-white/10 backdrop-blur-md text-center">
            <span className="font-display text-3xl sm:text-4xl font-black text-amber-400">&lt; 15ms</span>
            <span className="text-[10px] font-mono text-ink-muted uppercase block mt-1">Inference Latency</span>
          </div>
        </div>
      </div>
    </section>
  );
}
