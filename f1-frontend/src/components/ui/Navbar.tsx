import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Menu, X } from 'lucide-react';
import { Link, useLocation } from 'react-router-dom';
import { cn } from '@/lib/utils';

export function Navbar() {
  const [isScrolled, setIsScrolled] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const location = useLocation();

  useEffect(() => {
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 50);
    };
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const navLinks = [
    { name: 'LIVE INTELLIGENCE', href: '/live' },
    { name: 'VOICE INTELLIGENCE', href: '/voice' },
    { name: 'RACE TIMELINE', href: '/timeline' },
    { name: 'HISTORY', href: '/history' }
  ];


  const handleNavClick = (href: string) => {
    setMobileMenuOpen(false);

    // If it's a hash link and we're on the homepage, smooth scroll
    if (href.startsWith('/#')) {
      const id = href.replace('/#', '');
      if (location.pathname === '/') {
        const el = document.getElementById(id);
        if (el) {
          el.scrollIntoView({ behavior: 'smooth', block: 'start' });
          return;
        }
      }
    }
  };

  return (
    <>
      <motion.nav
        initial={{ y: -100 }}
        animate={{ y: 0 }}
        transition={{ duration: 0.8, ease: 'easeOut', delay: 2.5 }}
        className={cn(
          'fixed top-0 left-0 right-0 z-40 transition-colors duration-300',
          isScrolled ? 'bg-asphalt/80 backdrop-blur-md border-b border-chrome/10' : 'bg-transparent'
        )}
      >
        <div className="max-w-7xl mx-auto px-6 h-20 flex items-center justify-between">
          {/* Logo */}
          <Link to="/" className="flex items-center gap-2 relative z-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-red rounded-sm">
            <span className="font-display font-bold text-xl tracking-wide uppercase text-ink">
              The Silent <span className="text-brand-red">Co-Driver</span>
            </span>
          </Link>

          {/* Desktop Links */}
          <div className="hidden lg:flex items-center gap-6">
            {navLinks.map((link) => (
              <Link
                key={link.name}
                to={link.href}
                onClick={() => handleNavClick(link.href)}
                aria-current={location.pathname === link.href ? 'page' : undefined}
                className={cn(
                  'text-sm font-body font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-red rounded-sm px-2 py-1',
                  location.pathname === link.href ? 'text-ink' : 'text-ink-muted hover:text-ink',
                )}
              >
                {link.name}
              </Link>
            ))}
          </div>

          {/* Mobile Hamburger Toggle */}
          <button
            className="lg:hidden relative z-50 p-2 text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-red rounded-sm ml-auto"
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            aria-label="Toggle menu"
          >
            {mobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
          </button>
        </div>
      </motion.nav>

      {/* Mobile Menu Overlay */}
      <AnimatePresence>
        {mobileMenuOpen && (
          <motion.div
            initial={{ opacity: 0, y: '-100%' }}
            animate={{ opacity: 1, y: '0%' }}
            exit={{ opacity: 0, y: '-100%' }}
            transition={{ duration: 0.4, ease: 'easeInOut' }}
            className="fixed inset-0 z-30 bg-asphalt flex flex-col items-center justify-center gap-8 lg:hidden"
          >
            {navLinks.map((link) => (
              <Link
                key={link.name}
                to={link.href}
                onClick={() => handleNavClick(link.href)}
                aria-current={location.pathname === link.href ? 'page' : undefined}
                className={cn(
                  'font-display text-3xl md:text-4xl font-semibold uppercase tracking-wider text-center transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-red rounded-sm px-4 py-2',
                  location.pathname === link.href ? 'text-brand-red' : 'text-ink hover:text-brand-red',
                )}
              >
                {link.name}
              </Link>
            ))}
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
