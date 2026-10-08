# Discobot — AI Context / Restore Prompt

## Project Overview
Browser-only synth/sequencer/drum machine. Monorepo with 2 npm workspaces. Audio engine is custom math synthesis in TypeScript (no Tone.js). There is no server: app state lives in an in-browser backend module and persists to local storage. Builds to a static site (GitHub Pages).

## Architecture
```
discobot/
├── engine/    # Pure-TS audio math, no Node/DOM deps (aliased into the UI by Vite)
└── ui/        # React + Vite app (dev server port 3000)
```

### State Flow
UI calls `apiFetch(path, init)` (`ui/src/localBackend.ts`) using the old REST paths/JSON → `LocalBackend.handle()` mutates state → emits event messages to subscribers (`useLocalBackend`) → `App.tsx` `handleMessage` updates React state. Step timing comes from engine `Sequencer` instances running in the page, which emit `sequencerStep`; the UI plays notes/drums with Web Audio on each step.

### Event Messages
`init`, `synthCreated`, `synthRemoved`, `synthUpdate`, `synthModelUpdate`, `synthMix`, `sequencerStep`, `sequencerPlay`, `sequencerStop`, `patternUpdated`, `patternCreated`, `tempoChange`, `drumStep`, `drumStepVelocity`, `drumSettings`, `drumMix`, `drumSwing`, `drumReset`, `drumFullState`, `drumKitChanged`, `effectsLoopUpdate`, `drumFxUpdate`

### Persistence (localStorage)
- `discobot_session` — autosaved working session (synths, patterns, drums, kit, FX, tempo), throttled + on `pagehide`
- `discobot_saved_patterns` — named saved patterns
- synth presets — see `SYNTH_PRESETS_STORAGE_KEY` in `App.tsx`

## Key Files
| File | Purpose |
|------|---------|
| `ui/src/localBackend.ts` | In-browser backend: synth/drum/FX state, route handler, saved patterns, session autosave, offline mix render + WAV export (`downloadWav`) |
| `ui/src/hooks/useLocalBackend.ts` | Subscribes `App` to backend events (sends `init` on subscribe) |
| `ui/src/App.tsx` | Main React component, multi-synth state, header with tempo/save/undo, MIDI export/import |
| `ui/src/synthModels.ts` | 6 synth model definitions (generic, minimoog, juno-106, dx7, tb-303, prophet-5), macro mapping |
| `ui/src/components/SynthUnit.tsx` | Wrapper combining Sequencer + SynthControls + Keyboard per synth, add/remove, mix toggle |
| `ui/src/components/KeyboardPanel.tsx` | Toggle wrapper between Keyboard and PianoRoll modes |
| `ui/src/components/PianoRoll.tsx` | Grid editor: 3 octaves × 16 steps, click/drag paint/erase |
| `ui/src/components/Sequencer.tsx` | Step grid (16/32), velocity per step, pattern manager modal |
| `ui/src/components/Keyboard.tsx` | 3-octave keyboard with octave shift (-1 to +1), hold mode |
| `ui/src/components/SynthControls.tsx` | Oscillator, filter, envelope, dual LFOs, FX sends, arpeggiator, synth model selector, presets |
| `ui/src/components/EffectsPanel.tsx` | Shared effects loop UI: drive, phaser, delay, reverb |
| `ui/src/components/MixerPanel.tsx` | Mixer view |
| `ui/src/components/MidiPanel.tsx` | MIDI device selector, mode (live/record/step), channel, synth target routing |
| `ui/src/components/DrumMachine.tsx` | 8×16 grid, per-instrument knobs, kit selector, master volume, drum FX sends |
| `ui/src/hooks/useSynthAudio.ts` | Browser synth: AudioWorklet (`ui/public/synth-processor.js`, loaded via `BASE_URL`), shared FX bus |
| `ui/src/hooks/usePatternAudio.ts` | Plays a pre-rendered PCM loop buffer (legacy path; not fed by the local backend) |
| `ui/src/hooks/useMidiInput.ts` | Web MIDI API: device enumeration, channel filtering, noteOn/noteOff/CC parsing |
| `ui/src/hooks/useDrumAudio.ts` | Browser drum playback via `DrumSynthesizer.renderHit()` |
| `ui/src/utils/midiExport.ts` / `midiImport.ts` | Standard MIDI File export / import |
| `engine/src/types.ts` | All type definitions (single source of truth) |
| `engine/src/Synthesizer.ts` | Synth PCM generation: oscillator, filter, ADSR, dual LFOs |
| `engine/src/DrumSynthesizer.ts` | 8 drum instruments, kit variants, humanization |
| `engine/src/StreamingSynth.ts` | 8-voice poly chunk-based renderer |
| `engine/src/Sequencer.ts` | setTimeout-based pattern scheduler (drives `sequencerStep`) |
| `engine/src/SequencerV2.ts` | AudioContext-time scheduler with look-ahead (unused by UI) |
| `engine/src/AudioContextManager.ts` | Singleton AudioContext |
| `engine/src/errors.ts` / `constants.ts` / `utils.ts` | Result type + errors, named constants, helpers |

## Features Complete
- Multi-synth (up to 3, Synth 1 cannot be removed), 16/32-step sequencer with per-step velocity, piano roll
- Synth: 4 waveforms, detune, filter, ADSR, dual LFOs with tempo sync, arpeggiator (7 modes), 6 synth models, presets, pan/spread, portamento
- Shared effects loop: drive, phaser, delay, reverb, per-synth sends
- Drum machine: 8 instruments, 8 kits (3 generic + TR-808, TR-909, LinnDrum, Oberheim DMX, TR-707), per-step velocity, swing, mute/solo, FX sends
- MIDI input (live/record/step), MIDI import + export, WAV export (browser-rendered, includes FX)
- Undo/redo, global tempo, saved patterns + session autosave in local storage

## Drum Instrument Details
| Instrument | Tone range | Extra knob | Engine function |
|------------|-----------|------------|-----------------|
| Kick | Start freq 60-240Hz | Decay 80-500ms | `renderKick` |
| Snare | Body freq 150-300Hz | Snappy 0-1 | `renderSnare` |
| Open HH | Brightness 0.3-1.0 | Decay 50-500ms | `renderOpenHH` |
| Closed HH | Brightness 0.4-1.0 | Tight 0-1 (durations 100-15ms) | `renderClosedHH` |
| Ride | Fund freq 800-4000Hz | Bright 0-1 | `renderRide` |
| Crash | Brightness 0.2-1.0 | Decay 0.2-1.2s | `renderCrash` |
| Snare 2 | Body freq 200-400Hz | Snappy 0-1 | `renderSnare2` |
| Clap | (not used) | Room 10-90ms | `renderClap` |

## Commands
```bash
npm run dev          # Vite dev server on http://localhost:3000
npm run build        # Build engine (types) then UI → ui/dist (static site)
npm run preview      # Serve ui/dist locally
```
GitHub Pages deploy: `.github/workflows/deploy-pages.yml` (push to `main`). Vite `base` is `./` so the build works from any subpath.

## Conventions
- No comments in code unless explaining non-obvious logic
- `DrumState` always initialized with `createDefaultDrumState()` (never null)
- Backend state in `LocalBackend` (`ui/src/localBackend.ts`); client mirror in React state + refs
- Mutations go through `apiFetch` routes; new features add a route + event in `LocalBackend.handle()` rather than mutating backend state directly from components
- Browser gen* functions in App.tsx match engine DrumSynthesizer methods
- Engine types are single source of truth (`engine/src/types.ts`), UI re-exports via `ui/src/types.ts`; engine must stay free of Node APIs (no `Buffer`, `fs`, `require`)
- Synth models defined in `ui/src/synthModels.ts`, mapped to engine params via `mapSynthModelToEngineParams`

## Known Issues
- `SamplePlayer` is stubbed (not functional)
- Serial effects chain causes cumulative dry attenuation
- Drum sends carry post-processed signal (potential double-saturation)
- Step clock is `setTimeout`-based on the main thread; heavy UI work or background tabs can cause jitter
- Firefox/Safari lack Web MIDI API support
- No multi-user/multi-tab sync; each tab has its own backend instance (last tab to write wins in local storage)

## Potential Next Steps
- SamplePlayer implementation
- Song mode / pattern chaining
- Voice polyphony

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
