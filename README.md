# Discobot

A browser-based synthesizer, step sequencer and drum machine. Up to 3 independent synths, a 16/32-step sequencer, piano roll editor, drum machine and shared effects loop — all running in your browser with the Web Audio API. There is no server, account or login: open the page and play.

## Features

- **Multi-Synth**: Up to 3 independent synthesizers, each with own sequencer, keyboard, and parameter controls
- **16/32-step Sequencer**: Step grid with note assignment via piano keyboard, monophonic mode, per-step velocity
- **Piano Roll Editor**: Per-synth keyboard/piano-roll toggle with click/drag note painting on the shared step pattern
- **Synthesizer**: 4 waveforms, detune, resonant filter, ADSR envelope, dual LFOs (pitch/filter targets, tempo sync), arpeggiator (7 modes), 6 vintage synth models, stereo pan/spread, portamento, presets (saved in the browser)
- **Shared Effects Loop**: Drive, phaser, delay, reverb — per-synth send levels, master on/off, per-effect toggles
- **Drum Machine**: 8 instruments, 16-step grid with per-step velocity, per-instrument volume/tone/extra/tune/pan, 8 kits (3 generic + TR-808, TR-909, LinnDrum, Oberheim DMX, TR-707), mute/solo, swing, drum FX sends
- **MIDI Input**: Web MIDI device selection with `live`, `record`, and `step` routing modes per synth (Chromium-based browsers)
- **MIDI Import/Export**: Load .mid files with track selection; export a Standard MIDI File with multi-synth lanes and drums on channel 10
- **WAV Export**: Render one bar of the full mix (synths, drums, effects) to a 48 kHz stereo WAV, entirely in the browser
- **Undo/Redo**: Per-pattern undo stack (Ctrl/Cmd+Z, Ctrl/Cmd+Shift+Z)
- **Saved Patterns**: Save/load/delete full patterns (all synths, drums, kit, effects, tempo) in the browser's local storage
- **Session Autosave**: The current session is kept in local storage, so a reload picks up where you left off

## Architecture

Monorepo using npm workspaces with 2 packages:

```
discobot/
├── engine/    # Pure-TypeScript audio math (no Node or DOM dependencies)
│   ├── Synthesizer           # Oscillator, filter, ADSR, dual LFOs, note rendering
│   ├── DrumSynthesizer       # 8 drum instruments, kit variants, pattern rendering
│   ├── Sequencer / SequencerV2  # Pattern step clocks
│   ├── StreamingSynth        # Chunked polyphonic renderer
│   ├── utils / constants / errors / types
└── ui/        # React + Vite app
    ├── src/localBackend.ts   # In-browser app state, "API" routes, saved patterns, WAV export
    ├── src/hooks/            # Web Audio playback, MIDI input, backend subscription
    └── src/components/       # Sequencer, keyboard, piano roll, synth controls, drums, FX, mixer
```

`ui/src/localBackend.ts` holds the app state that used to live on the server. Components call `apiFetch('/drum/step', …)` with the same paths and JSON the old REST API used, and receive the same event messages (`sequencerStep`, `patternUpdated`, …) the WebSocket used to deliver, so the UI code is unchanged apart from the transport.

## Quick Start

Prerequisites: Node.js 18+ and npm.

```bash
npm install
npm run dev        # http://localhost:3000
```

Production build:

```bash
npm run build      # outputs ui/dist — a static site
npm run preview    # serve the build locally
```

`ui/dist` is plain static files with relative paths, so it can be hosted anywhere (GitHub Pages, Netlify, any static host, or opened from a subfolder).

### GitHub Pages

`.github/workflows/deploy-pages.yml` builds and publishes the site on every push to `main`. Enable it once in the repo under **Settings → Pages → Build and deployment → Source: GitHub Actions**.

## Using it

1. Open the page and click once anywhere so the browser allows audio.
2. Click a step on a synth lane (it turns amber), then click a piano key to place a note — or switch to the piano roll and paint.
3. Program drum hits in the drum grid, choose a kit, and shape each lane.
4. Press **Play All** / **Stop All**. Set tempo by clicking the BPM display.
5. **+ Save** stores the whole pattern in this browser; **Load** recalls it.

Saved patterns and the autosaved session live in the browser's local storage: they're per browser and per device, and clearing site data removes them. Use **Export MIDI** or **Download WAV** to take work elsewhere.

## Tech Stack

| Layer | Technology |
|-------|------------|
| Engine | Custom math synthesis (TypeScript, no Tone.js) |
| UI | React 18, Vite 5, TypeScript |
| Audio | Web Audio API (AudioWorklet synth, buffer-rendered drums) |
| Storage | Browser local storage |

## Additional Documentation

- Guides: `/docs/guides` — setup, feature testing
- Plans, reports and reviews in `/docs` are historical records; several describe the earlier Discord-bot version.

## Known Limitations

- Web MIDI isn't available in Firefox or Safari
- `SamplePlayer` in the engine is a stub
- No multi-user sync: each browser has its own session
- Song mode / pattern chaining not implemented

---

## Changelog

### 2.0 — Browser-only
Removed the Discord bot, Discord login, voice streaming and the Express/WebSocket server. The app now runs entirely in the browser: state and endpoints moved into `ui/src/localBackend.ts`, saved patterns and the working session persist in local storage, and WAV export renders in the browser. The build is a static site deployable to GitHub Pages.

### PR #47 — Auto-update documentation on PR create
CI workflow added to automatically stage and commit updated markdown docs when PRs are opened. Ensures documentation stays in sync with code changes.

### PR #46 — Fix 32-step change issue
Improved browser play fallback handling. Fixed a bug where switching between 16 and 32 step counts caused playback issues.

### PR #45 — Investigate sound problems
Restored loop-active gating for step preview audio. Fixed an issue where browser preview audio played incorrectly during sequencer playback.

### PR #44 — Fix synth/drum sequence issue
Fixed hard clipping in rendered pattern loop. The master mix was clipping when synth and drum signals combined at high levels.

### PR #43 — Fix playback sound issue
Fixed browser audio playback to prefer rendered loop audio over step preview during playback. Previously both would play simultaneously, causing phasing and volume issues.

### PR #42 — Implement synth clone plan
Added synth model state and UI scaffolding for 6 vintage synth models (Minimoog, Juno-106, DX7, TB-303, Prophet-5, plus generic). Implemented browser rendered-pattern audio loop playback.

### PR #41 — Expand help section UI
Expanded help modal content with quick start, header controls, keyboard shortcuts, synth/drum workflow, and FX return notes. Added planning doc for sample-based drum migration. Updated drum return controls.

### PR #40 — Fix phaser and velocity issues
Implemented synth timing, velocity, and preset/effects updates. Fixed save overwrite typing. Finalized synth model parameter updates and velocity sensitivity.

### PR #39 — Undo/redo, MIDI export, arpeggiator, presets
Added per-pattern undo/redo stack with keyboard shortcuts (Ctrl+Z / Ctrl+Shift+Z). Implemented Standard MIDI File export (multi-synth lanes, drums on channel 10). Added arpeggiator (7 modes: up, down, updown, random, chord, upchord, downchord) with BPM-synced rate and gate control. Added synth preset system with save/load/delete and built-in presets (Pad, Bass, Lead, Pluck).

### PR #38 — Piano roll and MIDI panel
Added piano roll editor component with 3-octave × 16-step grid, click/drag note painting. Added MIDI input panel with device selector, mode toggle (live/record/step), channel routing, and synth target selection. Added saved pattern name display in header.

### PR #37 — Keyboard layout, LFO filter, effects loop, scrolling
Moved keyboard to column 2 below sequencer. Changed default filter cutoff to 5000Hz (was 20000, LFO modulation was inaudible). Enabled effects loop by default. Fixed `processEffectsLoopBus` returning raw send signal when disabled. Added shared effects bus to browser synth preview (delay, reverb via ConvolverNode, drive via WaveShaperNode). Added overflow scrolling to main layout panels.

### PR #36 — Fix/keyboard layout, LFO filter, effects loop, scrolling (initial)
Fixed keyboard layout alignment with synth controls panel. Moved Add Synth button inside synth-units-container. Fixed default `EffectsLoopState.enabled` to `true` in both server and UI.

### PR #35 — Review deploy and HTTP logs
Fixed WebSocket auth fallback for stale tokens. Prevented compatibility fallback on invalid bearer auth headers.

### PR #34 — Railway WebSocket handling
Fixed Railway WebSocket upgrade handling. Hardened URL configuration for production deployment behind Railway's reverse proxy.

### PR #33 — Fix synth 1 display issue
Ensured Synth 1 is always initialized in guild runtime. Previously Synth 1 could be missing from state if the bot hadn't received a command yet.

### PR #32 — Add help button and cleanup
Added help modal with usage instructions. Fixed right-side panel scrolling behavior. Refreshed README and key documentation.

### PR #31 — Fix drum kit sound issues
Fixed drum kit apply behavior — kit changes now correctly update all instrument parameters. Fixed effects knob editing and timing issues.

### PR #30 — Fix interaction crash
Fixed bot crash on expired Discord interactions (error code 10062). Wrapped error handler reply in try-catch. Fixed `handleLogin` to check `interaction.deferred` before calling `editReply`.

### PR #29 — Drum machine FX loop
Implemented shared FX loop for drum machine: reverb, delay, drive, phaser sends per instrument, global loop return level. Added drum FX panel in UI. Implemented responsive UI overhaul. Added drum kit types, server plumbing, UI wiring, and note release lifecycle fixes.

### PR #28 — Add synth controls and effects loop
Added step toggle hold mode for sequencer. Added editable knob value inputs (click to type exact values). Implemented shared effects loop migration: moved per-synth delay/reverb to send/return bus architecture. Added `EffectsLoopState` with drive, phaser, delay, reverb sections and per-effect on/off toggles.

### PR #27 — Redo drum machine instruments
Fixed knob direction (vertical drag), improved LFO depth scaling, retuned drum voices across all 3 kit variants. Updated drum instrument parameters for better sonic character.

### PR#26 — Standardize knob values and edit patterns
Implemented live-edit sequencing sync (pattern changes push to server immediately). Updated knob direction and value display. Fixed App load control and synth effect processing updates.

### PR #25 — Fix application not responding error
Deferred `/login` Discord interaction to prevent timeout. Added deferred interaction response handling with 15-minute token expiry.

### PR #24 — Synth redesign vertical controls
Implemented synth column layout (controls left, sequencer/keyboard right). Added guild-scoped auth/session foundation with HMAC-signed bot requests. Fixed bot WebSocket auth timestamp and signature validation. Implemented security hardening updates.

### PR #23 — Redesign synth controls and drum sounds
Implemented synth layout with dual LFOs (pitch/filter targets), 3rd synth support (max 3). Added synth model selector with 6 vintage models (Minimoog, Juno-106, DX7, TB-303, Prophet-5). Finalized synth LFO rendering updates.

### PR #22 — Redo drum sounds and fix pause
Improved drum synthesis for all 8 instruments. Fixed selected step note clearing behavior. Smoothed Discord audio loop transitions.

### PR #21 — Make UI updates
Added global transport controls (Play All / Stop All). Added synth and drum mute/solo controls in header.

### PR #20 — Modify synth sequencer and controls
Fixed browser playback and note-off interference. Refined synth unit layout and relocated octave controls below sequencer.

### PR #19 — Update synth controls layout
Fixed type narrowing in audio readiness checks. Added explicit browser audio context unlock on first user interaction. Fixed synth keyboard container fill behavior.

### PR #18 — Fix synth playback error
Fixed synth envelope timing (attack/decay/sustain/release math). Fixed synth unit keyboard layout alignment.

### PR #17 — Synth refactor
Multi-synth refactor: SynthUnit wrapper component, backend Map-based synth storage, add/remove synth endpoints. Added Keyboard octave shift with range display. Backend synthId routing for all REST + WebSocket messages. Discord bot synthId option on /play, /stop, /note, /tempo. Global tempo: single BPM shared across all synths. Header UI: "Discobot" title, TempoDisplay LED, SavePattern inline save.

### PR #15 — WebSocket play button issue
Added `/api` route compatibility for production deployments behind reverse proxies. Made save confirmation reliable.

### PR #14 — WebSocket issue fix
Fixed WebSocket upgrade handling on `/ws` and `/ws/` paths explicitly. Resolved connection issues with trailing slashes.

### PR #12–13 — WebSocket connection issues
Unified WebSocket endpoint on web server. Repositioned drum controls above instruments. Resolved multiple WebSocket connection failures.

### PR #10–11 — Traffic capture and WebSocket fixes
Redesigned ride cymbal and single-hit clap synthesis. Initial WebSocket traffic capture for debugging connection issues.

<!-- AUTO_PR_CHANGELOG_START -->
### PR #56: Add LFO tempo sync, stereo spread, drum velocity per step, envelope v…

Source branch: `feat/effects-mixer-improvements`
Last sync: 2026-07-18T19:08:07.568Z

#### Changed files
- `engine/src/DrumSynthesizer.ts` — MODIFIED (+9/-2)
- `engine/src/StreamingSynth.ts` — MODIFIED (+47/-11)
- `engine/src/Synthesizer.ts` — MODIFIED (+52/-4)
- `engine/src/types.ts` — MODIFIED (+5/-0)
- `ui/public/synth-processor.js` — MODIFIED (+17/-7)
- `ui/src/App.css` — MODIFIED (+40/-0)
- `ui/src/App.tsx` — MODIFIED (+146/-6)
- `ui/src/components/DrumMachine.css` — MODIFIED (+41/-0)
- `ui/src/components/DrumMachine.tsx` — MODIFIED (+91/-8)
- `ui/src/components/EffectsPanel.tsx` — MODIFIED (+0/-8)
- `ui/src/components/MixerPanel.css` — ADDED (+248/-0)
- `ui/src/components/MixerPanel.tsx` — ADDED (+196/-0)
- `ui/src/components/Sequencer.css` — MODIFIED (+12/-0)
- `ui/src/components/Sequencer.tsx` — MODIFIED (+6/-0)
- `ui/src/components/SynthControls.css` — MODIFIED (+48/-0)
- `ui/src/components/SynthControls.tsx` — MODIFIED (+92/-24)
- `ui/src/hooks/useDrumAudio.ts` — MODIFIED (+4/-2)
- `ui/src/hooks/useSynthAudio.ts` — MODIFIED (+16/-6)
- `web/src/index.ts` — MODIFIED (+174/-11)
<!-- AUTO_PR_CHANGELOG_END -->
