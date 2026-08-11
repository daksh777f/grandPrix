import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';

interface LoaderProps {
  onComplete: () => void;
}

export function Loader({ onComplete }: LoaderProps) {
  const [isVisible, setIsVisible] = useState(true);

  useEffect(() => {
    // Check if prefers reduced motion
    const prefersReduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const duration = prefersReduced ? 500 : 2500;

    const timer = setTimeout(() => {
      setIsVisible(false);
      setTimeout(onComplete, 500); // allow exit animation to finish
    }, duration);

    return () => clearTimeout(timer);
  }, [onComplete]);

  return (
    <AnimatePresence>
      {isVisible && (
        <motion.div
          key="loader"
          initial={{ opacity: 1 }}
          exit={{ opacity: 0, y: -50 }}
          transition={{ duration: 0.5, ease: 'easeInOut' }}
          className="fixed inset-0 z-50 flex items-center justify-center bg-asphalt"
        >
          <div className="relative flex flex-col items-center gap-8">
            {/* The Engine / Core Element */}
            <div className="relative w-24 h-32 rounded-xl border border-chrome/30 bg-black/50 overflow-hidden flex items-end justify-center">
              {/* Liquid fill */}
              <motion.div
                className="w-full bg-brand-red/90"
                initial={{ height: '0%' }}
                animate={{ height: '100%' }}
                transition={{ duration: 2, ease: 'easeInOut' }}
              />
              {/* Particles / Heat haze */}
              {[...Array(5)].map((_, i) => (
                <motion.div
                  key={i}
                  className="absolute bottom-0 w-1 h-1 bg-ink-muted/40 rounded-full"
                  initial={{ y: 0, x: (Math.random() - 0.5) * 40, opacity: 0, scale: 0 }}
                  animate={{ 
                    y: -100 - Math.random() * 50, 
                    x: (Math.random() - 0.5) * 60,
                    opacity: [0, 1, 0],
                    scale: [0, Math.random() * 2 + 1, 0]
                  }}
                  transition={{ 
                    duration: 1.5 + Math.random(), 
                    repeat: Infinity, 
                    delay: Math.random(),
                    ease: 'easeOut'
                  }}
                />
              ))}
            </div>

            {/* Bottom Bar / Base */}
            <div className="w-32 h-2 rounded-full bg-chrome/20 overflow-hidden">
              <motion.div
                className="h-full bg-brand-red"
                initial={{ x: '-100%' }}
                animate={{ x: '0%' }}
                transition={{ duration: 2, ease: 'easeInOut' }}
              />
            </div>

            {/* Status text */}
            <motion.div 
              className="font-mono text-xs text-ink-muted tracking-[0.2em] uppercase"
              animate={{ opacity: [0.3, 1, 0.3] }}
              transition={{ repeat: Infinity, duration: 1.5 }}
            >
              System Warming Up
            </motion.div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
