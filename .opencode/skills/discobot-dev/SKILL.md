---
name: discobot-dev
description: Provides guidance for developing, testing, and enhancing Discobot, the browser-based synth/sequencer/drum machine.
---

# Discobot Development Skill

Discobot is a browser-only music app: synths, step sequencer, piano roll, drum machine and effects loop, with no server.

## Project Overview

Monorepo with 2 npm workspaces:
- **engine/**: Custom math-based audio synthesis (no Tone.js, no Node APIs)
- **ui/**: React web interface with Vite (port 3000), including the in-browser backend

## Architecture

- `ui/src/localBackend.ts` holds synth/drum/FX state, handles `apiFetch(path, init)` calls using REST-style paths, emits event messages, and persists to local storage (`discobot_session`, `discobot_saved_patterns`)
- `ui/src/hooks/useLocalBackend.ts` subscribes `App.tsx` to those events
- Engine `Sequencer` instances run in the page and emit `sequencerStep`; the UI plays notes/drums with Web Audio on each step
- WAV export renders one bar offline in `localBackend.ts` (`downloadWav`)

## Commands

```bash
npm run dev       # Vite dev server
npm run build     # engine types + UI → ui/dist (static)
npm run preview   # serve the build
```

## Key Files

| File | Purpose |
|------|---------|
| `ui/src/localBackend.ts` | App state, routes, events, persistence, WAV export |
| `ui/src/App.tsx` | Main React component, multi-synth state, header, MIDI import/export |
| `ui/src/synthModels.ts` | 6 synth model definitions |
| `ui/src/components/SynthUnit.tsx` | Sequencer + SynthControls + Keyboard per synth |
| `ui/src/components/DrumMachine.tsx` | 8×16 grid, per-instrument knobs, kit selector (8 kits), drum FX |
| `ui/src/hooks/useSynthAudio.ts` | AudioWorklet synth, shared FX bus, pan/portamento |
| `engine/src/DrumSynthesizer.ts` | 8 drum instruments, kit variants, humanization |
| `engine/src/types.ts` | Shared types (single source of truth) |

## Conventions

- No comments in code unless explaining non-obvious logic
- `DrumState` always initialized with `createDefaultDrumState()` (never null)
- New state changes: add a route + event in `LocalBackend.handle()` and handle the event in `App.tsx`
- Engine stays free of Node APIs (`Buffer`, `fs`, `require`)

## Known Issues

- `SamplePlayer` is stubbed (not functional)
- Serial effects chain causes cumulative dry attenuation
- Firefox/Safari lack Web MIDI API support
- No multi-tab sync

## Testing Checklist

- [ ] Page loads with no console errors (dev and built site under a subpath)
- [ ] Clicking sequencer grid selects steps; keyboard assigns notes
- [ ] Play All / Stop All works and the step light advances
- [ ] Synth controls and drum knobs change the sound in real time
- [ ] Drum kit selector shows all 8 kits
- [ ] Save, reload the page, Load restores the pattern
- [ ] Reload keeps the working session
- [ ] Download WAV produces an audible file; Export MIDI downloads a .mid

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
