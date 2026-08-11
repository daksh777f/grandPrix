import { useRef, useEffect } from 'react';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';

gsap.registerPlugin(ScrollTrigger);

const HISTORY_ARTICLES = [
  {
    year: "1950",
    title: "The Birth of a Championship",
    description: "Inaugurated at Silverstone, the first F1 cars were largely pre-war designs. Front-engined, heavy, and raw. The Alfa Romeo 158 dominated, producing around 350 bhp from a 1.5-litre supercharged straight-8. No downforce. No seatbelts. Just pure mechanical grip.",
    image: "https://images.unsplash.com/photo-1541348263662-e06836264be8?auto=format&fit=crop&q=80"
  },
  {
    year: "1980s",
    title: "The Turbo Era & Ground Effect",
    description: "Aerodynamics took over. Engineers discovered ground effect, sucking cars to the track for cornering speeds previously unimaginable. Engines shrank to 1.5 litres but strapped on massive turbos, peaking at over 1,000 bhp in qualifying. The cars became wider, lower, and terrifyingly fast.",
    image: "https://images.unsplash.com/photo-1502877338535-766e1452684a?auto=format&fit=crop&q=80"
  },
  {
    year: "2026",
    title: "The Next Generation",
    description: "Agility returns. The 2026 regulations aim to create smaller, lighter, and more nimble cars. Active aerodynamics will reduce drag on the straights and increase downforce in the corners. Power units will shift to a 50/50 split between internal combustion and electric power, running on 100% sustainable fuels.",
    image: "https://images.unsplash.com/photo-1532598375990-2da8de4cc7fc?auto=format&fit=crop&q=80"
  }
];

export function Montage() {
  const sectionRef = useRef<HTMLDivElement>(null);
  
  useEffect(() => {
    const mm = gsap.matchMedia();
    
    mm.add("(prefers-reduced-motion: no-preference)", () => {
      const items = gsap.utils.toArray('.history-item') as HTMLElement[];
      
      items.forEach((item) => {
        const image = item.querySelector('.history-image');
        const textWrapper = item.querySelector('.history-text');
        
        if (image) {
          gsap.fromTo(image, 
            { y: -30, scale: 1.1 },
            { 
              y: 30, 
              scale: 1,
              ease: "none",
              scrollTrigger: {
                trigger: item,
                start: "top bottom",
                end: "bottom top",
                scrub: true
              }
            }
          );
        }

        if (textWrapper) {
          gsap.fromTo(textWrapper,
            { opacity: 0, x: -30 },
            {
              opacity: 1,
              x: 0,
              duration: 1,
              ease: "power2.out",
              scrollTrigger: {
                trigger: item,
                start: "top 75%",
              }
            }
          );
        }
      });
    });

    return () => mm.revert();
  }, []);

  return (
    <section ref={sectionRef} className="py-32 bg-cream text-ink-on-cream relative">
      <div className="max-w-6xl mx-auto px-6">
        <div className="mb-24 text-center max-w-3xl mx-auto">
          <h2 className="font-display text-5xl md:text-7xl font-bold uppercase tracking-tight mb-6">
            75 Years of <span className="text-brand-red">Innovation</span>
          </h2>
          <p className="font-body text-xl leading-relaxed text-ink-on-cream/80">
            From the cigar-shaped roadsters of 1950 to the hyper-efficient active-aero machines of 2026, Formula 1 has always been a ruthless engineering war. Here is how the F1 car evolved.
          </p>
        </div>

        <div className="flex flex-col gap-32">
          {HISTORY_ARTICLES.map((article, idx) => (
            <div 
              key={idx} 
              className={`history-item flex flex-col ${idx % 2 !== 0 ? 'md:flex-row-reverse' : 'md:flex-row'} items-center gap-12 md:gap-20`}
            >
              <div className="w-full md:w-1/2">
                <div className="aspect-[4/3] overflow-hidden rounded-xl bg-chrome/20 relative shadow-2xl">
                  <img 
                    src={article.image} 
                    alt={article.title} 
                    className="history-image w-full h-full object-cover origin-center"
                  />
                  {/* Subtle year overlay */}
                  <div className="absolute bottom-4 left-4 bg-cream/90 backdrop-blur text-ink-on-cream font-numeric text-6xl px-4 py-2 rounded shadow-lg">
                    {article.year}
                  </div>
                </div>
              </div>
              <div className="w-full md:w-1/2 history-text">
                <h3 className="font-display text-3xl md:text-5xl font-medium leading-tight mb-6">
                  {article.title}
                </h3>
                <p className="font-body text-lg md:text-xl leading-relaxed text-ink-on-cream/80">
                  {article.description}
                </p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
