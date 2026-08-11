# FRONTEND PRD — "The Silent Co-Driver" / Zero-Pit Showcase Site
**For: Antigravity (Gemini 3.1 Pro), frontend build agent**
**Scope: Landing page + frontend UI only. No backend, no auth, no signup, no DB.**

---

## 0. READ THIS FIRST (instructions for the build agent)

You are building a **marketing + product-showcase landing page** for an F1 hackathon project. There are two features this site exists to sell to judges:

1. **The Silent Co-Driver** — an AI system that reads driver stress from radio calls (voice → transcript → mood + a "silence detector" that flags when a driver goes quiet during trouble).
2. **Race Replay** — a real race replay engine (already built in a companion repo, `ZERO-PIT`) with GPS-driven car movement, lap telemetry, and event commentary.

This document is split into **10 phases**. Work through them **in order, one at a time**. Do not start Phase N+1 until Phase N is visually verified in the browser. At the end of each phase, re-read the "Acceptance Criteria" for that phase before moving on — do not carry unfinished work forward silently. If something in an earlier phase needs to change because of something you learned later, say so explicitly rather than quietly patching it.

Phase 9 (the last phase) is a **self-QA pass**: you will go back through the whole site, check the browser console for errors, check every section at mobile/tablet/desktop widths, and fix what's broken.

Do not invent new sections beyond what's specified without flagging it as a suggestion first.

---

## 1. Project Overview

A single-page (or lightly multi-route) marketing site for a national-level F1 hackathon submission. The site's job is to make a judge feel the thrill of F1 within the first 3 seconds, then walk them through two features: the voice/stress system, and the race replay engine, before closing on a branded manifesto moment.

**Primary audience:** Hackathon judges (quick attention, evaluating polish + technical depth) and Gen Z viewers/teammates (the site should feel like something they'd screenshot and post, not a corporate template).

## 2. Goals

- Make the site feel expensive, kinetic, and confident — not like a stock hackathon template.
- Voice/stress detection is the hero feature. It should appear early, get a dedicated deep section, and be referenced again at the close.
- Race Replay gets its own strong section, visually distinct from the voice section.
- Every animation should feel intentional (tied to scroll or interaction), never decorative-for-its-own-sake to the point of hurting load time or usability.
- Fully responsive: this will very likely be judged on a laptop, but Gen Z reviewers/teammates will pull it up on phones — do not treat mobile as an afterthought.

## 3. Non-Goals (explicitly out of scope right now)

- No authentication, login, signup, or user profiles.
- No real backend integration — all data-driven sections (replay, stress events, driver wall) run on **mock/sample JSON** that matches the real data contracts (defined in Section 8), so backend swap-in later is a drop-in, not a rebuild.
- No CMS. Content is hardcoded/config-driven in the codebase.
- No e-commerce, no payment, no "Shop" style sections carried over from reference templates.

## 4. Tech Stack

- **React 18/19 + TypeScript + Vite**
- **Tailwind CSS** (v4 if using the `@tailwindcss/vite` plugin pattern from the reference assets, otherwise standard Tailwind config — pick one and stay consistent)
- **GSAP** (core) **+ ScrollTrigger** for all scroll-driven animation. GSAP is 100% free now, including every formerly-paid plugin (SplitText, MorphSVG, ScrollSmoother, DrawSVG) since the Webflow acquisition — use `SplitText` for kinetic headline reveals where it's a better fit than WarpText, and `ScrollSmoother` if you want inertia-scroll on desktop.
- **motion** (the `motion/react` library, formerly Framer Motion) for component-level micro-interactions (hover states, pill buttons, mount/unmount transitions) — GSAP owns scroll choreography, `motion` owns discrete UI-state transitions. Don't fight between the two on the same element.
- **shadcn registry components (React Bits):**
  - `npx shadcn@latest add @react-bits/WarpText-TS-TW` — for kinetic headline text
  - `npx shadcn@latest add @react-bits/DriftWall-TS-TW` — for the drivers section
- **lucide-react** for iconography (already available, keep icon use minimal and functional — not decorative clutter).

## 5. Design Language

### 5.1 Emotional target
Think: the 3 seconds before lights-out. Tense, controlled, fast. Not cartoonish "racing game" energy — more editorial motorsport photography (think F1's own broadcast graphics package, or a well-shot Red Bull/McLaren campaign) crossed with a modern SaaS product site's confidence.

### 5.2 Color System

Do **not** use the raw `#FF0000` from the reference component as the primary brand red — swap it for F1's own official brand red, which reads more premium and is more "correct" for the domain. Reserve neon-adjacent color entirely for two small, meaningful data accents (see below) — never for general UI chrome.

| Token | Hex | Usage |
|---|---|---|
| `bg-asphalt` | `#0D0D0F` | Primary site background (dark sections — hero, features, drivers) |
| `bg-cream` | `#F4EEE6` | Editorial/montage section background — the one deliberate light "breather" moment on the page |
| `brand-red` | `#E10600` | Primary accent — CTAs, active states, key underlines/highlights |
| `brand-red-deep` | `#8C0000` | Hover/pressed states, shadows, gradient-darken |
| `accent-amber` | `#D98E4A` | "Stressed / elevated" data state (voice feature only) — muted, not glowing |
| `accent-teal` | `#3FA9A0` | "Calm / composed" data state (voice feature only) — muted, not glowing |
| `chrome` | `#C9CDD3` | Borders, dividers, metallic UI accents |
| `ink` | `#F4F1EC` | Primary text on dark backgrounds |
| `ink-muted` | `#A8A6A3` | Secondary/caption text on dark backgrounds |
| `ink-on-cream` | `#17191C` | Text on the cream section |

**Rule of thumb:** amber and teal exist *only* to encode calm-vs-stressed data. If you find yourself reaching for them as generic "pop of color" UI accents outside the voice-feature context, use `brand-red` or `chrome` instead — keeping amber/teal semantically tied to the stress data is what makes them feel purposeful instead of decorative.

### 5.3 Typography

- **Display/Headings:** `Clash Display` (free, Fontshare) — bold, geometric, contemporary. This is what WarpText/SplitText should animate.
- **Telemetry/Numeric (lap times, big stats):** `Bebas Neue` or `Oswald` — condensed, motorsport-livery feel, used only for numbers/timing displays, not paragraph text.
- **Body:** `Manrope` (matches the reference hero asset — keep continuity).
- **Mono (transcripts, JSON-like data, stress scores):** `JetBrains Mono` or `Space Mono` — gives the voice-feature section a "this is real data" texture.

Load all via Google Fonts / Fontshare `<link>` tags in `index.html`, define as Tailwind theme tokens (`font-display`, `font-numeric`, `font-body`, `font-mono`), same pattern as the reference Mainframe asset.

### 5.4 Motion principles

- Scroll-triggered reveals should feel like they're "arriving," not fading in lazily — favor short, snappy eases (`power3.out`, `back.out(1.2)`) over long linear fades.
- Respect `prefers-reduced-motion`: wrap GSAP ScrollTrigger setups in `gsap.matchMedia()` and provide a reduced/no-parallax fallback. This is a real accessibility requirement, not optional polish.
- Nothing should animate purely on page-load below the fold — trigger on scroll-into-view so first paint stays fast.

---

## 6. Reference Assets — What They're For and How They Map

| Asset given | What it's actually for in THIS project |
|---|---|
| `ZERO-PIT` repo (`daksh777f/ZERO-PIT`) | Source of truth for the **Race Replay** section's visual language (map/radar/replay UI) and the **event data shape** (Section 8). You are not rebuilding the replay engine here — you are building a showcase section whose UI matches it and can later be wired to it. |
| `br-g/openf1` | Confirms the real field names/shape for drivers, laps, radio, location — use these exact field names in your mock JSON so backend swap-in is painless. |
| `palomacdev/openf1-transcribe` | Confirms the transcript pipeline shape (Whisper output + metadata) — informs the transcript card UI in the voice section. |
| Red-background hero component (`S.P.D`, logo + mission statement + bottom video w/ gradient blend) | **Repurpose as the CLOSING section**, not the hero. Swap the generic logo for the project wordmark, swap the mission copy for F1/team-manifesto copy, and reuse the literal `track-video_2` asset (it's already a track video — perfect fit) with the same top gradient-blend technique. |
| "Mainframe" hero spec (motionsites.ai reference — mouse-scrub video, typewriter line, pill CTAs, hamburger nav) | **This is your HERO section structure.** Keep the mechanic (scrub-on-mousemove, typewriter reveal, pill buttons, navbar behavior) but re-skin every piece of copy, color, and the video source for F1 (see Phase 2, and the open question in Section 10 about hero video sourcing). |
| Uiverse "strong-gecko" loader (coffee-maker CSS) | Keep the **mechanic** (build-up animation + looping "steam"/particle detail + bottom bar), but **recolor** everything to the brand palette and reframe the "steam" as light smoke/heat-haze rather than literal coffee steam. Do not spend a full phase redesigning the SVG shapes from scratch — recolor first, reshape only if time allows (see Phase 1). |
| WarpText (`@react-bits/WarpText-TS-TW`) | Kinetic headline effect for the hero headline and 1–2 section headers max. Overusing it dilutes the impact — pick 2–3 moments, not every heading. |
| DriftWall (`@react-bits/DriftWall-TS-TW`) | Driver roster section — driver headshots in a drifting/parallax wall layout. |
| ESPN feature-story , https://www.espn.com/espn/feature/story?id=43832710 | **Use it as it as,make sure it stands out** — do scrape or reproduce ESPN's actual article text or images. do not Build an original scroll-paced gallery moment . Make sure that you will take it as it is and then put it in an seprate section so that users can get info about F1 history , it will more of an informatic thing and fun section. |
| collectui.com | General micro-interaction inspiration (hover states, loading states, empty states). Browse it directly during Phase 1 and Phase 4–6 for small interaction details — no specific pattern is mandated here, use judgment. |

---

## 7. Information Architecture (section order, top to bottom)

1. **Loader** (first paint, plays once per session/refresh)
2. **Navbar** (fixed, appears after loader)
3. **Hero** — mouse-scrub video/parallax, typewriter tagline, WarpText headline, CTA pills, parallax F1 car element
4. **Mission strip** — short, punchy "why this exists" statement (bridges hero → features)
5. **Feature Section A: The Silent Co-Driver (Voice)** — the headline feature, deep treatment
6. **Feature Section B: Race Replay** — replay showcase
7. **Drivers** — DriftWall roster
8. **Montage** — cream-background editorial scroll section (ESPN-inspired pacing)
9. **Closing manifesto** — repurposed red-bg component, track video, mission copy, restates the voice feature one more time
10. **Footer**

This order is deliberate: voice feature opens strong (section 5) and gets referenced again at the close (section 9), mirroring your own demo narrative of "open with voice → show everything else → close with voice."

---

## PHASE 0 — Project Setup & Design System Foundation

**Objective:** Scaffolding only. No visual sections yet.

**Do:**
- Init Vite + React + TS project.
- Install Tailwind, GSAP (`npm install gsap @gsap/react`), `motion`, `lucide-react`.
- Run the two shadcn registry install commands (Section 4).
- Load fonts (Section 5.3) via `index.html` + Fontshare/Google Fonts links.
- Create a `theme.css` or Tailwind config block defining every color token from Section 5.2 as CSS variables / Tailwind theme colors, plus font tokens.
- Set up folder structure: `/components/sections/`, `/components/ui/`, `/data/` (for mock JSON), `/lib/` (helpers).
- Set up a base `gsap.matchMedia()` utility respecting `prefers-reduced-motion`.

**Acceptance criteria:** Blank page renders with correct background color, correct fonts loading (verify in devtools computed styles), no console errors, both shadcn components installed and importable.

---

## PHASE 1 — Global Shell: Loader + Navbar

**Objective:** The site's first-impression chrome.

**Loader:**
- Port the Uiverse "strong-gecko" CSS mechanic as-is structurally.
- Recolor: replace the tan/brown/teal coffee-maker palette with `bg-asphalt`, `chrome`, `brand-red` for the "liquid fill" element, and a soft `ink-muted` smoke/particle color instead of literal steam-grey.
- Change any implied labeling/copy conceptually from "coffee brewing" to something like a system/engine "warming up" feel — keep it abstract (an animated fill + particles reads fine without needing literal text).
- Loader plays once on load, then fades/wipes out to reveal the navbar + hero. Should resolve in under ~2.5s so it never feels like a real loading bottleneck.
- Respect reduced-motion: show a simple static brand mark + fade instead.

**Navbar:**
- Fixed, top, same structural behavior as the Mainframe reference (logo left, links center on desktop, CTA right, hamburger + fullscreen overlay menu on mobile).
- Recolor for dark hero background (light text/logo, not black-on-white like the reference).
- Nav links: reflect this site's actual sections — e.g. "Voice", "Replay", "Drivers", "Contact" (adjust to taste, keep to 3–4 max).

**Acceptance criteria:** Loader plays once, resolves cleanly, no layout shift after it disappears. Navbar sticks on scroll, mobile menu opens/closes with the rotate/fade hamburger animation, all links scroll to the correct section anchors.

---

## PHASE 2 — Hero Section

**Objective:** The 3-second thrill moment.

**Structure (adapted from the Mainframe reference):**
- Full-screen fixed background video/visual, `object-fit: cover`, mouse-scrub controlled exactly per the reference mechanic (mousemove listener, delta → time offset, clamped, `onSeeked` queuing to prevent seek-flooding).
- **⚠️ Open question you must resolve before this phase, not during it:** the reference used a licensed creative-agency video. You do not have real F1 broadcast footage rights. Use one of: (a) an official asset provided by the hackathon/organizer brand kit if one exists, (b) a procedural/motion-graphic visual (animated track lines, particle speed-streaks, an abstract car silhouette) built in code instead of video, or (c) a legally-sourced stock/motion clip (e.g. generic asphalt/motion-blur footage, not F1-branded). Do not fabricate or hotlink a video URL that isn't actually yours to use.
- Blurred intro label (small, top of content block) — reframe copy to something like introducing the system, e.g. two lines building anticipation for what the site is about.
- **WarpText or SplitText headline** — the main kinetic moment. Keep the actual headline short (3–6 words) since kinetic text effects lose impact on long strings.
- Typewriter subline (reuse the `useTypewriter` hook pattern from the reference) — one sentence, sets up the site's premise.
- 3–4 pill CTA buttons (white pill style + one outline pill), fade/slide in ~400ms after load, independent of the typewriter finishing. Route them to the relevant sections (Voice, Replay, Drivers) rather than generic agency CTAs.
- **Parallax F1 car element:** a car silhouette/cutout (SVG or PNG with transparency) positioned in the hero, animated via GSAP ScrollTrigger so it shifts position/scale/rotation as the user scrolls past the hero into the mission strip — this is the one explicitly-requested parallax car moment; it doesn't need to appear anywhere else on the page.

**Acceptance criteria:** Video/visual scrubs smoothly on mouse movement with no jank or seek-flooding. Headline kinetic effect fires once, cleanly. Pills are keyboard-focusable and have visible hover/focus states. Parallax car moves convincingly on scroll and does not overlap/clip content awkwardly at any breakpoint.

---

## PHASE 3 — Mission Strip

**Objective:** A short bridge section between hero and features. Not a hero-level moment — keep it compact (one viewport height max, likely less).

- Centered, punchy statement about the problem this project solves (driver stress goes unheard, engineers miss what matters).
- Optional: a single stat or line of supporting copy underneath.
- Light GSAP fade/rise on scroll-into-view. Nothing elaborate here — this section's job is pacing, not spectacle.

**Acceptance criteria:** Section reads in under 5 seconds, transitions cleanly from the hero's energy without feeling like a dead stop.

---

## PHASE 4 — Feature Section A: The Silent Co-Driver (Voice)

**Objective:** The headline feature. This is the section judges should remember.

**Content blocks:**
1. Section headline (WarpText or SplitText, one of your 2–3 total uses).
2. A **radio transcript card**: shows a sample driver radio message being "played," with a waveform visual, transcribed text appearing (typewriter or line-by-line reveal timed to a mock "audio progress"), and a mood/stress label (`Calm` / `Focused` / `Stressed`) that resolves in with a colored badge using `accent-teal` (calm) or `accent-amber` (stressed) — never both at once, never neon-bright.
3. A **stress-vs-laptime mini chart**: simple line/area chart showing a stress trend against lap-time delta over a session, built from mock data (Section 8). Keep this readable at a glance — this is the "judge sanity-checks it instantly" moment.
4. **The differentiator callout: the Silence Detector.** A distinct visual moment (not just another card) explaining "sometimes the most important warning sign is that the driver said nothing at all" — show a timeline with radio-call markers and a highlighted gap where a bad lap/incident occurred with no radio contact, labeled something like "Quiet during incident — flagged." This is your most original idea; give it real visual weight, not a small footnote card.

**Acceptance criteria:** All three sub-moments (transcript card, trend chart, silence detector) are visually distinct from each other, none of them look like generic dashboard widgets copy-pasted from a template. Colors follow the calm/stressed semantic rule strictly.

---

## PHASE 5 — Feature Section B: Race Replay

**Objective:** Showcase the replay engine's visual language (matching `ZERO-PIT`'s existing UI direction) as a preview/teaser.

- A track-map visual with an animated driver dot moving along a path (looping demo animation, driven by mock GPS/location data — see Section 8).
- A telemetry side-panel (lap number, gap to leader, current lap time) updating in sync with the dot's position, same "one shared clock" principle described for the replay engine itself.
- Optional: a small radar/stat visual echoing `ZERO-PIT`'s existing radar chart concept, if time allows — treat as stretch, not required for this phase's completion.
- CTA or scroll-hint suggesting this is a live, interactive replay in the full product (even though this section itself is a curated demo loop, not the full replay tool).

**Acceptance criteria:** The dot animates smoothly along a defined path without stutter, telemetry numbers update in sync with dot position (not on a separate, unsynced timer), section visually reads as "data-dense but calm," contrasting with the more emotional Voice section before it.

---

## PHASE 6 — Drivers (DriftWall)

**Objective:** A roster moment using the DriftWall component.

- Populate with mock driver data (Section 8 shape: number, name, team, team color, headshot).
- Each driver card/tile should show name, team, and use `team_colour` as a subtle accent (border, glow-free underline, or badge) — this is a nice place to let each tile feel distinct without introducing new brand colors.
- Keep interaction light — hover/focus state per tile, no need for click-through detail pages (non-goal: no profile pages).

**Acceptance criteria:** Wall renders cleanly at all breakpoints (DriftWall's drift/parallax behavior should degrade gracefully to a simple grid on mobile if the component doesn't handle small viewports natively — verify this, don't assume it).

---

## PHASE 7 — Montage (Editorial / Cream Section)

**Objective:** The one deliberate light-background moment on the page, `#F4EEE6`.

- We will scrape the ESPN one directly and will show it on our website , make sure that it will stand out and it should cover the page and should be adjusted rightfully and should be perfectly settled down and should match with overall product .
- Text color switches to `ink-on-cream` for this section only — don't carry dark-mode text styles into this block.
- This section should feel like a breath after the data-dense Voice/Replay sections .

**Acceptance criteria:** Section is visually and tonally distinct from the rest of the (dark) site without feeling like it belongs to a different website — typography and spacing rhythm should still feel like the same brand.

---

## PHASE 8 — Closing Manifesto + Footer

**Objective:** Repurpose the red-background reference component as your closing statement, and restate the voice feature one last time.

- `bg-asphalt` or `brand-red` full-bleed section (test both, pick whichever reads stronger against the cream section right before it — likely `brand-red` for contrast).
- Centered project wordmark/logo (swap the generic SVG mark in the reference for your actual project mark).
- Short manifesto copy (2 short paragraphs, title-case, matching the reference's rhythm) — reframe around the actual project mission, and work in one more explicit callback to the Silent Co-Driver feature (e.g., closing line about "no warning sign goes unheard").
- Bottom-of-section looping video using the given `track-video_2` Cloudinary asset, with the same top gradient-blend-into-background technique from the reference.
- Footer below: minimal — team name/hackathon name, links to the GitHub repos (ZERO-PIT, this repo), no auth/contact-form since non-goal.

**Acceptance criteria:** Gradient blend between section background and video reads seamlessly (no visible hard edge), video loops without a visible restart jump, section closes the page with clear intentional weight (this should feel like a deliberate final beat, not a leftover template section).

---

## PHASE 9 — Self-QA Pass (mandatory final phase)

**Objective:** You (the build agent) verify the whole site, not just the last section you touched.

Go through this checklist explicitly and fix anything that fails:

- [ ] Open browser console on every section — zero errors, zero warnings you introduced.
- [ ] Check every section at three widths: ~375px (mobile), ~768px (tablet), ~1440px (desktop). Nothing overlaps, clips, or overflows horizontally.
- [ ] Confirm loader plays once per fresh load/refresh and doesn't re-trigger on route/section navigation.
- [ ] Confirm every GSAP ScrollTrigger animation fires once as expected on first scroll-through, and doesn't re-fire janky on scroll-up/down toggling unless intentionally designed to.
- [ ] Confirm `prefers-reduced-motion` fallback actually suppresses parallax/scrub effects when toggled in OS/browser settings.
- [ ] Confirm all interactive elements (pills, nav links, hamburger) are keyboard-focusable with visible focus states.
- [ ] Confirm color usage matches Section 5.2 — specifically, that amber/teal only ever appear inside the Voice feature section, nowhere else.
- [ ] Confirm section order matches Section 7 exactly.
- [ ] Confirm no leftover reference-template copy ("Mainframe", "S.P.D", "hello@mainframe.co", agency-speak like "Labs / Studio / Openings / Shop") survived anywhere in the final build.
- [ ] Note any remaining known issues or deliberate simplifications in a short summary at the end of your work — don't silently leave something broken without flagging it.

---

## 8. Data Contracts (mock JSON — build the UI against these shapes now, real backend swaps in later)

**Driver (from OpenF1 `/drivers`, used in DriftWall + Replay panel):**
```json
{
  "driver_number": 1,
  "full_name": "Max VERSTAPPEN",
  "team_name": "Red Bull Racing",
  "team_colour": "3671C6",
  "headshot_url": "https://media.formula1.com/.../maxver01.png",
  "country_code": "NED"
}
```

**Stress/Voice event (extends ZERO-PIT's existing commentary event shape — `{eventId, event_type, event_meta}`):**
```json
{
  "eventId": "evt_0001",
  "event_type": "stress_alert",
  "event_meta": {
    "driver_number": 1,
    "lap_number": 29,
    "elapsed_race_time": 2847.6,
    "transcript": "Box this lap, box this lap, confirm.",
    "mood_label": "Stressed",
    "arousal_score": 0.78,
    "message": "Elevated stress detected during pit call"
  }
}
```

**Silence flag (same shape, different `event_type`):**
```json
{
  "eventId": "evt_0002",
  "event_type": "silence_flag",
  "event_meta": {
    "driver_number": 11,
    "lap_number": 34,
    "elapsed_race_time": 3390.1,
    "message": "No radio contact for 4m12s during position loss"
  }
}
```

**Location sample (from OpenF1 `/location`, for the Replay dot):**
```json
{ "date": "2024-09-22T12:47:51.842Z", "driver_number": 1, "x": -6689, "y": -1445, "z": 199 }
```

Keep field names identical to these when writing mock data — this is what makes the eventual backend hookup fast instead of a rewrite.

---

## 9. Content & Copy Guidelines

- Short lines. Punchy. No corporate hackathon-speak ("leveraging cutting-edge AI to synergize...").
- It's fine to sound a little cocky/confident — this is a competitive demo, not a B2B SaaS site.
- Racing/motorsport vocabulary is welcome (box, box; lights out; the wall; the gap) but should stay legible to someone with zero F1 context (the Outsider perspective from the council) — don't bury the point in jargon.
- Never claim this is "live" or "real-time race data" anywhere the underlying section is actually a pre-baked/looped demo — say "replay" and "session data," not "live."

## 10. Open Questions / Assumptions (resolve before or during build, don't silently guess)

1. **Hero background media** — no real F1 broadcast footage is licensed for this project as far as this document knows. Confirm with the team whether the hackathon/organizer provided any official brand-kit footage; otherwise default to a procedural/motion-graphic hero background instead of video.
2. **Driver headshots** — the existing `ZERO-PIT` app already pulls `headshot_url` directly from OpenF1 (which itself hotlinks official F1 media). This PRD assumes continuing that same existing approach for consistency; if the team wants to swap to original illustrations instead, that's a scope change to flag, not something to silently decide.
3. **Loader reshape (stretch)** — full SVG reshape of the Uiverse loader into something more literally F1-themed (tire/checkered-flag motif) is a nice-to-have if time allows after Phase 9, not a blocker.

---

## 11. Self-Critique of This PRD

- This document assumes a single build agent working sequentially through phases; if multiple people/agents work in parallel, phase boundaries will need explicit merge checkpoints not covered here.
- The color system deliberately under-specifies gradients/shadows — that's intentional (leaves room for Antigravity's own polish instincts) but means visual consistency across sections depends on it actually reading Section 5 once and applying it everywhere, not re-deriving colors per phase.
- No performance budget (target Lighthouse score, max video file size, etc.) was set — for a hackathon demo shown live, a hard rule like "no single video asset over ~8MB, lazy-load everything below the fold" would be worth adding if load time becomes an issue during testing.
