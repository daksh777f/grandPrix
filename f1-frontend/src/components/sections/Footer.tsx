import { GitBranch } from 'lucide-react';

export function Footer() {
  return (
    <footer className="bg-asphalt border-t border-chrome/10 py-12 px-6">
      <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-center justify-between gap-6">
        <div className="flex flex-col items-center md:items-start gap-2">
          <span className="font-display font-bold text-xl uppercase tracking-wide text-ink">
            The Silent <span className="text-brand-red">Co-Driver</span>
          </span>
          <span className="font-body text-sm text-ink-muted">
            F1 Hackathon Submission &bull; Zero-Pit Team
          </span>
        </div>

        <div className="flex items-center gap-6">
          <a
            href="https://github.com/daksh777f/ZERO-PIT"
            target="_blank"
            rel="noreferrer"
            className="flex items-center gap-2 text-ink-muted hover:text-ink transition-colors font-body text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-red rounded-sm px-2 py-1"
          >
            <GitBranch className="w-4 h-4" />
            ZERO-PIT Replay Engine
          </a>
          <a
            href="https://github.com/your-repo/f1-frontend"
            target="_blank"
            rel="noreferrer"
            className="flex items-center gap-2 text-ink-muted hover:text-ink transition-colors font-body text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-red rounded-sm px-2 py-1"
          >
            <GitBranch className="w-4 h-4" />
            Frontend Showcase
          </a>
        </div>
      </div>
    </footer>
  );
}
