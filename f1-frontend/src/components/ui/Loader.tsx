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
          exit={{ opacity: 0, scale: 0.95 }}
          transition={{ duration: 0.5, ease: 'easeInOut' }}
          className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-asphalt"
        >
          <div className="pl text-xs md:text-sm font-mono tracking-widest font-bold">
            <div className="pl__dot" />
            <div className="pl__dot" />
            <div className="pl__dot" />
            <div className="pl__dot" />
            <div className="pl__dot" />
            <div className="pl__dot" />
            <div className="pl__dot" />
            <div className="pl__dot" />
            <div className="pl__dot" />
            <div className="pl__dot" />
            <div className="pl__dot" />
            <div className="pl__dot" />
            <div className="pl__text font-mono text-[0.65rem] tracking-wider text-center text-white/90">
              WARMING UP
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

