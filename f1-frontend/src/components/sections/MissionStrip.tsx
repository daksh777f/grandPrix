import { useRef, useEffect } from 'react';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';

gsap.registerPlugin(ScrollTrigger);

export function MissionStrip() {
  const containerRef = useRef<HTMLDivElement>(null);
  const textRef = useRef<HTMLHeadingElement>(null);

  useEffect(() => {
    const mm = gsap.matchMedia();

    mm.add("(prefers-reduced-motion: no-preference)", () => {
      if (textRef.current && containerRef.current) {
        gsap.fromTo(textRef.current,
          { y: 50, opacity: 0 },
          {
            y: 0,
            opacity: 1,
            duration: 1,
            ease: "power3.out",
            scrollTrigger: {
              trigger: containerRef.current,
              start: "top 80%",
            }
          }
        );
      }
    });

    // Fallback for reduced motion
    mm.add("(prefers-reduced-motion: reduce)", () => {
      if (textRef.current) {
        gsap.set(textRef.current, { opacity: 1, y: 0 });
      }
    });

    return () => mm.revert();
  }, []);

  return (
    <section ref={containerRef} className="py-32 px-6 bg-asphalt flex flex-col items-center justify-center border-t border-chrome/10 relative z-10">
      <div className="max-w-4xl text-center">
        <h2 ref={textRef} className="font-display text-3xl md:text-5xl font-medium text-ink leading-tight">
          Driver voice signals go unheard. <br/>
          <span className="text-chrome">Engineers miss what matters.</span> <br/>
          <span className="text-brand-red font-bold uppercase tracking-wide text-2xl md:text-4xl mt-6 block">
            Until Now.
          </span>
        </h2>
      </div>
    </section>
  );
}
