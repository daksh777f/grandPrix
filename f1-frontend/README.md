# F1 Frontend

This package contains the React application that presents the Grand Prix racing intelligence experience. It focuses on a polished visual shell, live telemetry views, radio-driven storytelling, and route-based experiences for analysis and voice interaction.

## What this app provides

- A home experience that stitches together the hero, mission, voice, replay, driver, montage, and closing sections.
- A live intelligence page that visualizes telemetry-driven race analysis.
- A voice page that presents radio intelligence and transcript-led interaction.
- A local proxy to the Python backend so the frontend can call `/api` routes during development.

## Technology stack

- React 19
- TypeScript
- Vite
- Tailwind CSS v4
- React Router
- GSAP and Motion for animation
- Three.js and OGL for visual effects

## Development scripts

From this directory:

```bash
npm install
npm run dev
```

Other available scripts:

```bash
npm run build
npm run lint
npm run preview
```

## Local backend proxy

The Vite dev server forwards requests from `/api` to `http://localhost:8000`.

That means the typical local workflow is:

1. Start the backend server from `backend/`.
2. Start the frontend from `f1-frontend/`.
3. Open the Vite development URL in the browser.

## Routes

The application routes are defined in `src/App.tsx`:

- `/` home page.
- `/live` live intelligence page.
- `/voice` voice intelligence page.

## Directory overview

- `src/App.tsx` configures routing and loader state.
- `src/pages/` contains route-level views.
- `src/components/sections/` contains narrative page sections.
- `src/components/ui/` contains shared UI primitives.
- `src/lib/` contains API helpers and shared utilities.
- `src/utils/` contains small application-specific helpers.

## Build notes

The production build runs TypeScript compilation first and then Vite bundling:

```bash
npm run build
```

If you change shared UI primitives or route-level pages, run the build before committing to catch type or bundling issues early.

## Styling and layout

- The app uses a dark racing theme with custom typography and motion.
- Page-level sections are assembled in `src/pages/Home.tsx`.
- The shell is intentionally minimal so the content sections and visual treatments remain prominent.

## Frontend-backend integration

The frontend consumes the backend endpoints documented in the repository root README and exposed by `backend/main.py`. The most important calls are for grid data, replay data, live analysis, radio intelligence, and race-engineer advice.

## Notes

- This package is intended to be run alongside the Python backend.
- The frontend does not manage persistent application data on its own.
- Large data assets live in the repository-level `data/` directory and are served indirectly through the backend.
