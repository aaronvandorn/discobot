import {
  Synthesizer,
  Sequencer,
  Pattern,
  SynthParameters,
  DrumState,
  DrumInstrument,
  DrumKitDefinition,
  DrumKitId,
  DrumKitModelVariant,
  DrumInstrumentDefaults,
  DrumSynthesizer,
  EffectsLoopState,
  FxSendLevels,
  SynthModelId,
  SynthModelParams,
  clamp,
  throttle,
  AUDIO_MIXING,
  AUDIO_CONTEXT,
} from '@discobot/engine';

// In-browser replacement for the old Express/WebSocket server. The UI talks to it
// through apiFetch() (same paths and JSON shapes the server used) and receives the
// same event messages the server used to broadcast over WebSocket.

type Listener = (message: { type: string; data: any }) => void;

interface SynthData {
  synth: Synthesizer;
  sequencer: Sequencer;
  pattern: Pattern;
  patterns: Pattern[];
  modelId: SynthModelId;
  modelParams: SynthModelParams;
}

interface SynthMixState {
  muted: boolean;
  solo: boolean;
}

interface DrumFxState {
  sends: FxSendLevels;
  returnLevel: number;
}

interface SavedStep {
  active: boolean;
  note?: string;
  velocity: number;
}

interface SavedPatternData {
  id: string;
  name: string;
  createdAt: number;
  updatedAt: number;
  steps: SavedStep[];
  synthParams: SynthParameters | null;
  synthModelId?: SynthModelId;
  synthModelParams?: SynthModelParams;
  tempo: number;
  drumState: DrumState;
  drumKitId?: DrumKitId;
  drumMasterVolume: number;
  drumFx?: DrumFxState;
  effectsLoop?: EffectsLoopState;
  synths?: Array<{
    id: number;
    steps: SavedStep[];
    synthParams: SynthParameters | null;
    synthModelId?: SynthModelId;
    synthModelParams?: SynthModelParams;
  }>;
}

interface PersistedSession {
  version: 1;
  synths: Array<{
    id: number;
    pattern: Pattern;
    patterns: Pattern[];
    synthParams: SynthParameters;
    modelId: SynthModelId;
    modelParams: SynthModelParams;
    muted: boolean;
    solo: boolean;
  }>;
  drumState: DrumState;
  selectedDrumKitId: DrumKitId;
  drumMasterVolume: number;
  drumSwing: number;
  drumFx: DrumFxState;
  effectsLoop: EffectsLoopState;
  globalTempo: number;
}

const SAVED_PATTERNS_KEY = 'discobot_saved_patterns';
const SESSION_KEY = 'discobot_session';

const DRUM_INSTRUMENTS: DrumInstrument[] = ['kick', 'snare', 'openHH', 'closedHH', 'ride', 'crash', 'snare2', 'clap'];
const DEFAULT_DRUM_KIT_ID: DrumKitId = 'clean-analog';
const SYNTH_MODEL_IDS: SynthModelId[] = ['generic', 'minimoog-model-d', 'juno-106', 'dx7', 'tb-303', 'prophet-5'];
const DEFAULT_SYNTH_MODEL_ID: SynthModelId = 'generic';

export const DRUM_KITS: DrumKitDefinition[] = [
  {
    id: 'clean-analog',
    name: 'Clean / Analog',
    description: 'Balanced vintage-inspired kit with round transients.',
    modelVariant: 'analog',
    instrumentDefaults: {
      kick: { volume: 0.62, tone: 0.48, extra: 0.52 },
      snare: { volume: 0.68, tone: 0.46, extra: 0.68 },
      openHH: { volume: 0.45, tone: 0.52, extra: 0.48 },
      closedHH: { volume: 0.48, tone: 0.55, extra: 0.58 },
      ride: { volume: 0.43, tone: 0.52, extra: 0.48 },
      crash: { volume: 0.44, tone: 0.5, extra: 0.45 },
      snare2: { volume: 0.52, tone: 0.45, extra: 0.5 },
      clap: { volume: 0.5, tone: 0.5, extra: 0.5 },
    },
  },
  {
    id: 'punchy-modern',
    name: 'Punchy / Modern',
    description: 'Sharper transient-focused kit with tighter low-end.',
    modelVariant: 'modern',
    instrumentDefaults: {
      kick: { volume: 0.7, tone: 0.6, extra: 0.68 },
      snare: { volume: 0.74, tone: 0.54, extra: 0.82 },
      openHH: { volume: 0.48, tone: 0.66, extra: 0.56 },
      closedHH: { volume: 0.54, tone: 0.7, extra: 0.72 },
      ride: { volume: 0.48, tone: 0.66, extra: 0.58 },
      crash: { volume: 0.5, tone: 0.62, extra: 0.62 },
      snare2: { volume: 0.6, tone: 0.62, extra: 0.62 },
      clap: { volume: 0.56, tone: 0.6, extra: 0.66 },
    },
  },
  {
    id: 'lofi-dirty',
    name: 'Lo-Fi / Dirty',
    description: 'Crunchier, noisier kit with darker body and gritty tails.',
    modelVariant: 'dirty',
    instrumentDefaults: {
      kick: { volume: 0.58, tone: 0.38, extra: 0.46 },
      snare: { volume: 0.66, tone: 0.4, extra: 0.78 },
      openHH: { volume: 0.42, tone: 0.4, extra: 0.66 },
      closedHH: { volume: 0.44, tone: 0.36, extra: 0.48 },
      ride: { volume: 0.4, tone: 0.34, extra: 0.5 },
      crash: { volume: 0.42, tone: 0.35, extra: 0.7 },
      snare2: { volume: 0.5, tone: 0.35, extra: 0.6 },
      clap: { volume: 0.48, tone: 0.38, extra: 0.58 },
    },
  },
  {
    id: 'tr-808',
    name: 'Roland TR-808',
    description: 'Deep sub-bass kick, crispy hats, snappy snare with long decay.',
    modelVariant: 'analog',
    instrumentDefaults: {
      kick: { volume: 0.75, tone: 0.25, extra: 0.72 },
      snare: { volume: 0.65, tone: 0.55, extra: 0.85 },
      openHH: { volume: 0.4, tone: 0.7, extra: 0.65 },
      closedHH: { volume: 0.45, tone: 0.75, extra: 0.5 },
      ride: { volume: 0.38, tone: 0.6, extra: 0.55 },
      crash: { volume: 0.42, tone: 0.55, extra: 0.8 },
      snare2: { volume: 0.55, tone: 0.5, extra: 0.7 },
      clap: { volume: 0.52, tone: 0.48, extra: 0.6 },
    },
  },
  {
    id: 'tr-909',
    name: 'Roland TR-909',
    description: 'Punchy mid-range kick, tight snare, metallic open hat.',
    modelVariant: 'modern',
    instrumentDefaults: {
      kick: { volume: 0.72, tone: 0.58, extra: 0.65 },
      snare: { volume: 0.7, tone: 0.62, extra: 0.78 },
      openHH: { volume: 0.46, tone: 0.72, extra: 0.52 },
      closedHH: { volume: 0.52, tone: 0.68, extra: 0.62 },
      ride: { volume: 0.44, tone: 0.65, extra: 0.48 },
      crash: { volume: 0.48, tone: 0.6, extra: 0.65 },
      snare2: { volume: 0.58, tone: 0.58, extra: 0.68 },
      clap: { volume: 0.54, tone: 0.55, extra: 0.62 },
    },
  },
  {
    id: 'linndrum',
    name: 'LinnDrum',
    description: 'Classic 80s sample-based kit with snappy snare and punchy toms.',
    modelVariant: 'modern',
    instrumentDefaults: {
      kick: { volume: 0.68, tone: 0.52, extra: 0.6 },
      snare: { volume: 0.72, tone: 0.58, extra: 0.82 },
      openHH: { volume: 0.44, tone: 0.65, extra: 0.55 },
      closedHH: { volume: 0.5, tone: 0.68, extra: 0.58 },
      ride: { volume: 0.42, tone: 0.62, extra: 0.52 },
      crash: { volume: 0.46, tone: 0.58, extra: 0.68 },
      snare2: { volume: 0.6, tone: 0.55, extra: 0.72 },
      clap: { volume: 0.52, tone: 0.52, extra: 0.65 },
    },
  },
  {
    id: 'oberheim-dmx',
    name: 'Oberheim DMX',
    description: 'Dry, tight kit with punchy kick and crisp hi-hats.',
    modelVariant: 'analog',
    instrumentDefaults: {
      kick: { volume: 0.7, tone: 0.55, extra: 0.58 },
      snare: { volume: 0.68, tone: 0.52, extra: 0.75 },
      openHH: { volume: 0.43, tone: 0.68, extra: 0.48 },
      closedHH: { volume: 0.48, tone: 0.72, extra: 0.55 },
      ride: { volume: 0.4, tone: 0.65, extra: 0.45 },
      crash: { volume: 0.44, tone: 0.6, extra: 0.62 },
      snare2: { volume: 0.55, tone: 0.5, extra: 0.65 },
      clap: { volume: 0.5, tone: 0.55, extra: 0.58 },
    },
  },
  {
    id: 'tr-707',
    name: 'Roland TR-707',
    description: 'Mid-range focused kit with tight decay and punchy attack.',
    modelVariant: 'modern',
    instrumentDefaults: {
      kick: { volume: 0.68, tone: 0.5, extra: 0.62 },
      snare: { volume: 0.66, tone: 0.55, extra: 0.72 },
      openHH: { volume: 0.42, tone: 0.62, extra: 0.52 },
      closedHH: { volume: 0.48, tone: 0.65, extra: 0.58 },
      ride: { volume: 0.4, tone: 0.58, extra: 0.48 },
      crash: { volume: 0.44, tone: 0.55, extra: 0.65 },
      snare2: { volume: 0.54, tone: 0.52, extra: 0.62 },
      clap: { volume: 0.5, tone: 0.52, extra: 0.6 },
    },
  },
];

function getDrumKit(kitId: DrumKitId): DrumKitDefinition | undefined {
  return DRUM_KITS.find((kit) => kit.id === kitId);
}

function normalizeDrumKitId(kitId: unknown): DrumKitId {
  if (typeof kitId !== 'string') return DEFAULT_DRUM_KIT_ID;
  return DRUM_KITS.find((kit) => kit.id === kitId)?.id ?? DEFAULT_DRUM_KIT_ID;
}

function getDrumKitDefaults(kitId: DrumKitId): DrumInstrumentDefaults {
  return (getDrumKit(normalizeDrumKitId(kitId)) || DRUM_KITS[0]).instrumentDefaults;
}

function getDrumKitModelVariant(kitId: DrumKitId): DrumKitModelVariant {
  return (getDrumKit(normalizeDrumKitId(kitId)) || DRUM_KITS[0]).modelVariant;
}

function createDefaultDrumState(): DrumState {
  const state = {} as DrumState;
  const defaults = getDrumKitDefaults(DEFAULT_DRUM_KIT_ID);
  for (const inst of DRUM_INSTRUMENTS) {
    state[inst] = {
      steps: new Array(16).fill(false),
      settings: {
        volume: defaults[inst].volume,
        tone: defaults[inst].tone,
        extra: defaults[inst].extra,
        tune: defaults[inst].tune ?? 0,
        humanize: defaults[inst].humanize ?? 0.35,
        pan: defaults[inst].pan ?? 0,
      },
      muted: false,
      solo: false,
    };
  }
  return state;
}

function normalizeDrumState(state: DrumState | undefined): DrumState {
  const base = createDefaultDrumState();
  for (const inst of DRUM_INSTRUMENTS) {
    const src = state?.[inst];
    if (!src) continue;
    base[inst] = {
      steps: Array.isArray(src.steps) ? src.steps.slice(0, 16) : base[inst].steps,
      stepVelocities: Array.isArray(src.stepVelocities) ? src.stepVelocities.slice(0, 16) : undefined,
      settings: {
        volume: clamp(src.settings?.volume ?? base[inst].settings.volume, 0, 1),
        tone: clamp(src.settings?.tone ?? base[inst].settings.tone, 0, 1),
        extra: clamp(src.settings?.extra ?? base[inst].settings.extra, 0, 1),
        tune: clamp(src.settings?.tune ?? base[inst].settings.tune ?? 0, -1, 1),
        humanize: clamp(src.settings?.humanize ?? base[inst].settings.humanize ?? 0.35, 0, 1),
        pan: clamp(src.settings?.pan ?? 0, -1, 1),
        cymbalType: (src.settings?.cymbalType === 'ride' || src.settings?.cymbalType === 'crash') ? src.settings.cymbalType : undefined,
      },
      muted: Boolean(src.muted),
      solo: Boolean(src.solo),
    };
    while (base[inst].steps.length < 16) base[inst].steps.push(false);
  }
  return base;
}

function applyKitDefaultsToDrumState(state: DrumState, kitId: DrumKitId): DrumState {
  const defaults = getDrumKitDefaults(kitId);
  const next = normalizeDrumState(state);
  for (const inst of DRUM_INSTRUMENTS) {
    next[inst] = {
      ...next[inst],
      settings: {
        volume: defaults[inst].volume,
        tone: defaults[inst].tone,
        extra: defaults[inst].extra,
        tune: defaults[inst].tune ?? next[inst].settings.tune ?? 0,
        humanize: defaults[inst].humanize ?? next[inst].settings.humanize ?? 0.35,
        pan: next[inst].settings.pan ?? 0,
      },
    };
  }
  return next;
}

function createDefaultFxSends(): FxSendLevels {
  return { reverb: 0.35, delay: 0.15, drive: 0.2, phaser: 0.1 };
}

function createDefaultDrumFx(): DrumFxState {
  return { sends: createDefaultFxSends(), returnLevel: 0.7 };
}

function createDefaultEffectsLoop(): EffectsLoopState {
  return {
    enabled: true,
    returns: { synth: 0.85, drums: 0.7 },
    drive: { enabled: true, amount: 0.18, tone: 0.65 },
    phaser: { enabled: false, rate: 0.45, depth: 0.45, feedback: 0.25, mix: 0.25 },
    delay: { enabled: true, time: 0.22, feedback: 0.35, mix: 0.3 },
    reverb: { enabled: true, decay: 2.1, mix: 0.38 },
  };
}

function normalizeFxSends(sends: Partial<FxSendLevels> | undefined, fallback?: FxSendLevels): FxSendLevels {
  const base = fallback ?? createDefaultFxSends();
  return {
    reverb: clamp(sends?.reverb ?? base.reverb, 0, 1),
    delay: clamp(sends?.delay ?? base.delay, 0, 1),
    drive: clamp(sends?.drive ?? base.drive, 0, 1),
    phaser: clamp(sends?.phaser ?? base.phaser, 0, 1),
  };
}

function normalizeDrumFx(drumFx: { sends?: Partial<FxSendLevels>; returnLevel?: number } | undefined): DrumFxState {
  const defaults = createDefaultDrumFx();
  return {
    sends: normalizeFxSends(drumFx?.sends, defaults.sends),
    returnLevel: clamp(drumFx?.returnLevel ?? defaults.returnLevel, 0, 1),
  };
}

function normalizeEffectsLoop(effectsLoop: Partial<EffectsLoopState> | undefined): EffectsLoopState {
  const d = createDefaultEffectsLoop();
  return {
    enabled: effectsLoop?.enabled ?? d.enabled,
    returns: {
      synth: clamp(effectsLoop?.returns?.synth ?? d.returns.synth, 0, 1),
      drums: clamp(effectsLoop?.returns?.drums ?? d.returns.drums, 0, 1),
    },
    drive: {
      enabled: effectsLoop?.drive?.enabled ?? d.drive.enabled,
      amount: clamp(effectsLoop?.drive?.amount ?? d.drive.amount, 0, 1),
      tone: clamp(effectsLoop?.drive?.tone ?? d.drive.tone, 0, 1),
    },
    phaser: {
      enabled: effectsLoop?.phaser?.enabled ?? d.phaser.enabled,
      rate: clamp(effectsLoop?.phaser?.rate ?? d.phaser.rate, 0.05, 8),
      depth: clamp(effectsLoop?.phaser?.depth ?? d.phaser.depth, 0, 1),
      feedback: clamp(effectsLoop?.phaser?.feedback ?? d.phaser.feedback, 0, 0.95),
      mix: clamp(effectsLoop?.phaser?.mix ?? d.phaser.mix, 0, 1),
    },
    delay: {
      enabled: effectsLoop?.delay?.enabled ?? d.delay.enabled,
      time: clamp(effectsLoop?.delay?.time ?? d.delay.time, 0.01, 1.5),
      feedback: clamp(effectsLoop?.delay?.feedback ?? d.delay.feedback, 0, 0.95),
      mix: clamp(effectsLoop?.delay?.mix ?? d.delay.mix, 0, 1),
    },
    reverb: {
      enabled: effectsLoop?.reverb?.enabled ?? d.reverb.enabled,
      decay: clamp(effectsLoop?.reverb?.decay ?? d.reverb.decay, 0.2, 8),
      mix: clamp(effectsLoop?.reverb?.mix ?? d.reverb.mix, 0, 1),
    },
  };
}

function createDefaultSynthModelParams(): SynthModelParams {
  return { macro1: 0.5, macro2: 0.5, macro3: 0.5, macro4: 0.5 };
}

function normalizeSynthModelId(modelId: unknown): SynthModelId {
  if (typeof modelId !== 'string') return DEFAULT_SYNTH_MODEL_ID;
  return SYNTH_MODEL_IDS.includes(modelId as SynthModelId) ? modelId as SynthModelId : DEFAULT_SYNTH_MODEL_ID;
}

function normalizeSynthModelParams(modelParams: unknown): SynthModelParams {
  const defaults = createDefaultSynthModelParams();
  if (!modelParams || typeof modelParams !== 'object') return defaults;
  const params = modelParams as Partial<SynthModelParams>;
  return {
    macro1: clamp(params.macro1 ?? defaults.macro1, 0, 1),
    macro2: clamp(params.macro2 ?? defaults.macro2, 0, 1),
    macro3: clamp(params.macro3 ?? defaults.macro3, 0, 1),
    macro4: clamp(params.macro4 ?? defaults.macro4, 0, 1),
  };
}

function sanitizePatternName(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const normalized = value.replace(/[\u0000-\u001F\u007F]/g, '').trim();
  if (normalized.length < 1 || normalized.length > 80) return null;
  return normalized;
}

function readStorage<T>(key: string): T | null {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) as T : null;
  } catch {
    return null;
  }
}

function writeStorage(key: string, value: unknown) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch (error) {
    console.error(`Failed to write ${key} to local storage:`, error);
  }
}

// ---- Offline mix rendering (used for WAV export) ----

function applyDrive(samples: Float32Array, amount: number, tone: number): Float32Array {
  const out = new Float32Array(samples.length);
  const preGain = 1 + amount * 18;
  const postGain = 1 / (1 + amount * 3.2);
  let toneState = 0;
  const toneAlpha = 0.015 + tone * 0.12;
  for (let i = 0; i < samples.length; i++) {
    const driven = Math.tanh(samples[i] * preGain) * postGain;
    toneState += toneAlpha * (driven - toneState);
    out[i] = driven * (0.35 + tone * 0.65) + toneState * (1 - tone * 0.45);
  }
  return out;
}

function applyDelay(samples: Float32Array, sampleRate: number, time: number, feedback: number, mix: number): Float32Array {
  const out = new Float32Array(samples.length);
  const delaySamples = Math.max(1, Math.floor(time * sampleRate));
  const delayBuffer = new Float32Array(delaySamples);
  let write = 0;
  const dry = 1 - mix;
  for (let i = 0; i < samples.length; i++) {
    const delayed = delayBuffer[write];
    delayBuffer[write] = samples[i] + delayed * feedback;
    write = (write + 1) % delaySamples;
    out[i] = samples[i] * dry + delayed * mix;
  }
  return out;
}

function applyReverb(samples: Float32Array, sampleRate: number, decay: number, mix: number): Float32Array {
  const out = new Float32Array(samples.length);
  const dry = 1 - mix;
  const combBuffers = [0.0297, 0.0371, 0.0411, 0.0437].map((sec) => new Float32Array(Math.max(1, Math.floor(sec * sampleRate))));
  const combIndices = new Array(combBuffers.length).fill(0);
  const feedback = clamp(0.55 + decay * 0.04, 0.5, 0.94);
  for (let i = 0; i < samples.length; i++) {
    let accum = 0;
    for (let c = 0; c < combBuffers.length; c++) {
      const buffer = combBuffers[c];
      const idx = combIndices[c];
      const delayed = buffer[idx];
      buffer[idx] = samples[i] + delayed * feedback;
      combIndices[c] = (idx + 1) % buffer.length;
      accum += delayed;
    }
    out[i] = samples[i] * dry + (accum / combBuffers.length) * mix;
  }
  return out;
}

function applyPhaser(samples: Float32Array, sampleRate: number, rate: number, depth: number, feedback: number, mix: number): Float32Array {
  const out = new Float32Array(samples.length);
  const dry = 1 - mix;
  let phase = 0;
  let fb = 0;
  const minDelay = 18;
  const maxDelay = Math.max(minDelay + 1, Math.floor(minDelay + depth * 320));
  const delayBuffer = new Float32Array(maxDelay + 2);
  let write = 0;
  for (let i = 0; i < samples.length; i++) {
    phase += rate / sampleRate;
    if (phase >= 1) phase -= 1;
    const lfo = 0.5 + 0.5 * Math.sin(phase * Math.PI * 2);
    const delay = minDelay + lfo * (maxDelay - minDelay);
    const read = (write - delay + delayBuffer.length) % delayBuffer.length;
    const idx0 = Math.floor(read);
    const idx1 = (idx0 + 1) % delayBuffer.length;
    const frac = read - idx0;
    const delayed = delayBuffer[idx0] * (1 - frac) + delayBuffer[idx1] * frac;
    delayBuffer[write] = samples[i] + fb * feedback;
    write = (write + 1) % delayBuffer.length;
    fb = delayed;
    out[i] = samples[i] * dry + delayed * mix;
  }
  return out;
}

function processEffectsLoopBus(input: Float32Array, sampleRate: number, loop: EffectsLoopState): Float32Array {
  if (!loop.enabled) return new Float32Array(input.length);
  let bus = input;
  if (loop.drive.enabled && loop.drive.amount > 0) bus = applyDrive(bus, loop.drive.amount, loop.drive.tone);
  if (loop.phaser.enabled && loop.phaser.mix > 0) bus = applyPhaser(bus, sampleRate, loop.phaser.rate, loop.phaser.depth, loop.phaser.feedback, loop.phaser.mix);
  if (loop.delay.enabled && loop.delay.mix > 0) bus = applyDelay(bus, sampleRate, loop.delay.time, loop.delay.feedback, loop.delay.mix);
  if (loop.reverb.enabled && loop.reverb.mix > 0) bus = applyReverb(bus, sampleRate, loop.reverb.decay, loop.reverb.mix);
  return bus;
}

function applyTransientShaper(samples: Float32Array, attack: number, sustain: number): Float32Array {
  const out = new Float32Array(samples.length);
  let env = 0;
  for (let i = 0; i < samples.length; i++) {
    const abs = Math.abs(samples[i]);
    env += (abs - env) * (abs > env ? 0.16 : 0.0008);
    const transient = samples[i] - Math.sign(samples[i]) * env;
    out[i] = samples[i] + transient * attack + Math.sign(samples[i]) * env * sustain;
  }
  return out;
}

function applyBusCompressor(samples: Float32Array, threshold: number, ratio: number, makeup: number): Float32Array {
  const out = new Float32Array(samples.length);
  let gain = 1;
  for (let i = 0; i < samples.length; i++) {
    const level = Math.abs(samples[i]);
    let targetGain = 1;
    if (level > threshold) {
      targetGain = (threshold + (level - threshold) / ratio) / (level + 1e-6);
    }
    gain += (targetGain - gain) * (targetGain < gain ? 0.08 : 0.002);
    out[i] = samples[i] * gain * makeup;
  }
  return out;
}

function processDrumBus(input: Float32Array, modelVariant: DrumKitModelVariant): Float32Array {
  const profile = modelVariant === 'modern'
    ? { satMix: 0.34, satAmount: 0.26, satTone: 0.62, attack: 0.35, sustain: -0.08, threshold: 0.4, ratio: 2.8, makeup: 1.14 }
    : modelVariant === 'dirty'
      ? { satMix: 0.46, satAmount: 0.4, satTone: 0.42, attack: 0.24, sustain: -0.16, threshold: 0.36, ratio: 2.2, makeup: 1.08 }
      : { satMix: 0.28, satAmount: 0.2, satTone: 0.55, attack: 0.2, sustain: -0.05, threshold: 0.42, ratio: 2.3, makeup: 1.1 };
  const saturated = applyDrive(input, profile.satAmount, profile.satTone);
  const parallel = new Float32Array(input.length);
  for (let i = 0; i < input.length; i++) {
    parallel[i] = input[i] * (1 - profile.satMix) + saturated[i] * profile.satMix;
  }
  return applyBusCompressor(applyTransientShaper(parallel, profile.attack, profile.sustain), profile.threshold, profile.ratio, profile.makeup);
}

function encodeWav(left: Float32Array, right: Float32Array, sampleRate: number): Blob {
  const totalSamples = left.length;
  const blockAlign = 4;
  const dataSize = totalSamples * blockAlign;
  const buffer = new ArrayBuffer(44 + dataSize);
  const view = new DataView(buffer);
  const writeStr = (off: number, str: string) => {
    for (let i = 0; i < str.length; i++) view.setUint8(off + i, str.charCodeAt(i));
  };
  writeStr(0, 'RIFF');
  view.setUint32(4, 36 + dataSize, true);
  writeStr(8, 'WAVE');
  writeStr(12, 'fmt ');
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, 2, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * blockAlign, true);
  view.setUint16(32, blockAlign, true);
  view.setUint16(34, 16, true);
  writeStr(36, 'data');
  view.setUint32(40, dataSize, true);
  for (let i = 0; i < totalSamples; i++) {
    view.setInt16(44 + i * 4, clamp(Math.round(left[i] * 32767), -32768, 32767), true);
    view.setInt16(44 + i * 4 + 2, clamp(Math.round(right[i] * 32767), -32768, 32767), true);
  }
  return new Blob([buffer], { type: 'audio/wav' });
}

// ---- Backend state ----

class LocalBackend {
  private synths = new Map<number, SynthData>();
  private synthMixState = new Map<number, SynthMixState>();
  private drumState: DrumState = createDefaultDrumState();
  private selectedDrumKitId: DrumKitId = DEFAULT_DRUM_KIT_ID;
  private drumMasterVolume = 1;
  private drumSwing = 0;
  private drumFx: DrumFxState = createDefaultDrumFx();
  private effectsLoop: EffectsLoopState = createDefaultEffectsLoop();
  private globalTempo = 120;
  private listeners = new Set<Listener>();
  private persistSession = throttle(() => this.writeSession(), 400);

  constructor() {
    this.restoreSession();
    if (!this.synths.has(1)) this.initSynth(1);
    if (typeof window !== 'undefined') {
      window.addEventListener('pagehide', () => this.writeSession());
    }
  }

  subscribe(listener: Listener): () => void {
    this.listeners.add(listener);
    listener({ type: 'init', data: this.getInitData() });
    return () => {
      this.listeners.delete(listener);
    };
  }

  private emit(type: string, data: Record<string, unknown>) {
    const message = { type, data };
    for (const listener of this.listeners) {
      try {
        listener(message);
      } catch (error) {
        console.error(`Listener failed for ${type}:`, error);
      }
    }
  }

  private changed() {
    this.persistSession();
  }

  private getInitData() {
    return {
      synths: Array.from(this.synths.entries())
        .sort(([a], [b]) => a - b)
        .map(([id, data]) => ({
          synthId: id,
          pattern: data.pattern,
          patterns: data.patterns,
          synthParams: data.synth.getParameters(),
          synthModelId: data.modelId,
          synthModelParams: data.modelParams,
          isPlaying: data.sequencer.getIsPlaying(),
          muted: this.synthMixState.get(id)?.muted ?? false,
          solo: this.synthMixState.get(id)?.solo ?? false,
        })),
      drumState: this.drumState,
      drumKits: DRUM_KITS,
      selectedDrumKitId: this.selectedDrumKitId,
      drumMasterVolume: this.drumMasterVolume,
      drumSwing: this.drumSwing,
      drumFx: this.drumFx,
      effectsLoop: this.effectsLoop,
      tempo: this.globalTempo,
    };
  }

  private initSynth(synthId: number, restore?: PersistedSession['synths'][number]) {
    if (this.synths.has(synthId)) return;
    const synth = new Synthesizer();
    synth.updateParameters({ fxSends: createDefaultFxSends() });
    if (restore?.synthParams) synth.updateParameters(restore.synthParams);
    const sequencer = new Sequencer(synth);
    sequencer.setTempo(this.globalTempo);
    const pattern = restore?.pattern ?? sequencer.createEmptyPattern(`Synth ${synthId}`);
    if (!restore) pattern.id = `pattern-${Date.now()}-${synthId}`;
    pattern.tempo = this.globalTempo;
    const patterns = restore?.patterns?.length
      ? restore.patterns.map((p) => (p.id === pattern.id ? pattern : p))
      : [pattern];
    sequencer.onStep((step: number) => {
      this.emit('sequencerStep', { synthId, step });
    });
    this.synths.set(synthId, {
      synth,
      sequencer,
      pattern,
      patterns,
      modelId: normalizeSynthModelId(restore?.modelId),
      modelParams: normalizeSynthModelParams(restore?.modelParams),
    });
    this.synthMixState.set(synthId, { muted: Boolean(restore?.muted), solo: Boolean(restore?.solo) });
  }

  private restoreSession() {
    const saved = readStorage<PersistedSession>(SESSION_KEY);
    if (!saved || saved.version !== 1) return;
    try {
      this.globalTempo = clamp(saved.globalTempo || 120, 20, 400);
      this.drumState = normalizeDrumState(saved.drumState);
      this.selectedDrumKitId = normalizeDrumKitId(saved.selectedDrumKitId);
      this.drumMasterVolume = clamp(saved.drumMasterVolume ?? 1, 0, 2);
      this.drumSwing = clamp(saved.drumSwing ?? 0, 0, 0.75);
      this.drumFx = normalizeDrumFx(saved.drumFx);
      this.effectsLoop = normalizeEffectsLoop(saved.effectsLoop);
      for (const entry of saved.synths || []) {
        if (entry.id >= 1 && entry.id <= 3 && entry.pattern?.steps) this.initSynth(entry.id, entry);
      }
    } catch (error) {
      console.error('Failed to restore saved session, starting fresh:', error);
      this.synths.clear();
      this.synthMixState.clear();
    }
  }

  private writeSession() {
    const session: PersistedSession = {
      version: 1,
      synths: Array.from(this.synths.entries()).map(([id, data]) => ({
        id,
        pattern: data.pattern,
        patterns: data.patterns,
        synthParams: data.synth.getParameters(),
        modelId: data.modelId,
        modelParams: data.modelParams,
        muted: this.synthMixState.get(id)?.muted ?? false,
        solo: this.synthMixState.get(id)?.solo ?? false,
      })),
      drumState: this.drumState,
      selectedDrumKitId: this.selectedDrumKitId,
      drumMasterVolume: this.drumMasterVolume,
      drumSwing: this.drumSwing,
      drumFx: this.drumFx,
      effectsLoop: this.effectsLoop,
      globalTempo: this.globalTempo,
    };
    writeStorage(SESSION_KEY, session);
  }

  private readSavedPatterns(): SavedPatternData[] {
    const saved = readStorage<SavedPatternData[]>(SAVED_PATTERNS_KEY);
    return Array.isArray(saved) ? saved : [];
  }

  private writeSavedPatterns(patterns: SavedPatternData[]) {
    writeStorage(SAVED_PATTERNS_KEY, patterns);
  }

  private setTempo(tempo: number) {
    this.globalTempo = tempo;
    for (const data of this.synths.values()) {
      data.sequencer.setTempo(tempo);
      data.pattern = { ...data.pattern, tempo };
    }
    this.emit('tempoChange', { tempo });
    this.changed();
  }

  renderMix(): { left: Float32Array; right: Float32Array; sampleRate: number } {
    const sampleRate = AUDIO_CONTEXT.RENDER_SAMPLE_RATE;
    const tempo = clamp(this.globalTempo || 120, 20, 400);
    const barDuration = (60 / tempo) * 4;
    const totalSamples = Math.floor(barDuration * sampleRate);
    const dryL = new Float32Array(totalSamples);
    const dryR = new Float32Array(totalSamples);
    const synthWetIn = new Float32Array(totalSamples);
    const drumWetIn = new Float32Array(totalSamples);
    const hasSolo = Array.from(this.synthMixState.values()).some((m) => m.solo);

    for (const [id, synthData] of this.synths.entries()) {
      const mix = this.synthMixState.get(id) || { muted: false, solo: false };
      if (mix.muted || (hasSolo && !mix.solo)) continue;
      const params = synthData.synth.getParameters();
      const renderParams = { ...params };
      if (renderParams.lfo1.sync) renderParams.lfo1 = { ...renderParams.lfo1, rate: tempo * 4 / Math.max(1, Math.round(renderParams.lfo1.rate)) };
      if (renderParams.lfo2.sync) renderParams.lfo2 = { ...renderParams.lfo2, rate: tempo * 4 / Math.max(1, Math.round(renderParams.lfo2.rate)) };
      const renderer = new Synthesizer();
      renderer.updateParameters(renderParams);
      const panAngle = (clamp(params.pan ?? 0, -1, 1) + 1) * Math.PI / 4;
      const panL = Math.cos(panAngle);
      const panR = Math.sin(panAngle);
      const sends = normalizeFxSends(params.fxSends);
      const sendTotal = (sends.reverb + sends.delay + sends.drive + sends.phaser) * clamp(params.fxReturn ?? 0.85, 0, 1);
      const steps = synthData.pattern.steps;
      const stepDuration = barDuration / Math.max(1, steps.length);
      for (let i = 0; i < steps.length; i++) {
        const step = steps[i];
        if (!step.active || !step.note) continue;
        const notePCM = renderer.renderNote(step.note, Math.max(stepDuration - 0.01, 0.05), step.velocity, sampleRate, { applyInsertEffects: false });
        const offset = Math.floor(i * stepDuration * sampleRate);
        for (let j = 0; j < notePCM.length && offset + j < totalSamples; j++) {
          const sample = notePCM[j];
          dryL[offset + j] += sample * panL;
          dryR[offset + j] += sample * panR;
          synthWetIn[offset + j] += sample * sendTotal;
        }
      }
    }

    const kitVariant = getDrumKitModelVariant(this.selectedDrumKitId);
    const drumPCM = DrumSynthesizer.renderPattern(this.drumState, tempo, sampleRate, {
      modelVariant: kitVariant,
      humanizeAmount: kitVariant === 'modern' ? 0.35 : kitVariant === 'dirty' ? 0.8 : 0.55,
      swing: this.drumSwing,
    });
    const drumBus = new Float32Array(totalSamples);
    for (let i = 0; i < totalSamples; i++) {
      drumBus[i] = drumPCM[i % drumPCM.length] * AUDIO_MIXING.DRUM_BOOST_FACTOR * this.drumMasterVolume;
    }
    const processedDrums = processDrumBus(drumBus, kitVariant);
    const drumFx = normalizeDrumFx(this.drumFx);
    const drumSendTotal = drumFx.sends.reverb + drumFx.sends.delay + drumFx.sends.drive + drumFx.sends.phaser;
    for (let i = 0; i < totalSamples; i++) {
      dryL[i] += processedDrums[i];
      dryR[i] += processedDrums[i];
      drumWetIn[i] = processedDrums[i] * drumSendTotal;
    }

    const loop = normalizeEffectsLoop(this.effectsLoop);
    const synthWet = processEffectsLoopBus(synthWetIn, sampleRate, loop);
    const drumWet = processEffectsLoopBus(drumWetIn, sampleRate, loop);
    const left = new Float32Array(totalSamples);
    const right = new Float32Array(totalSamples);
    const threshold = AUDIO_MIXING.SOFT_CLIP_THRESHOLD;
    const factor = AUDIO_MIXING.SOFT_CLIP_FACTOR;
    const softClip = (v: number) => (v > threshold ? threshold + (v - threshold) * factor : v < -threshold ? -threshold + (v + threshold) * factor : v);
    let peak = 0;
    for (let i = 0; i < totalSamples; i++) {
      const wet = synthWet[i] * loop.returns.synth + drumWet[i] * loop.returns.drums * drumFx.returnLevel;
      left[i] = softClip(dryL[i] + wet);
      right[i] = softClip(dryR[i] + wet);
      peak = Math.max(peak, Math.abs(left[i]), Math.abs(right[i]));
    }
    if (peak > 1) {
      for (let i = 0; i < totalSamples; i++) {
        left[i] /= peak;
        right[i] /= peak;
      }
    }
    return { left, right, sampleRate };
  }

  exportWav(): Blob {
    const { left, right, sampleRate } = this.renderMix();
    return encodeWav(left, right, sampleRate);
  }

  handle(method: string, path: string, body: any): { status: number; body: unknown } {
    const ok = (payload: unknown = { success: true }) => ({ status: 200, body: payload });
    const fail = (status: number, error: string) => ({ status, body: { error } });
    const segments = path.split('?')[0].split('/').filter(Boolean);
    const route = `${method} /${segments.map((s, i) => (/^\d+$/.test(s) && segments[i - 1] === 'synth' ? ':id' : s)).join('/')}`;
    const synthId = segments[0] === 'synth' ? parseInt(segments[1], 10) : NaN;
    const synthData = Number.isFinite(synthId) ? this.synths.get(synthId) : undefined;

    if (segments[0] === 'synth' && Number.isFinite(synthId) && !synthData && !route.startsWith('DELETE')) {
      return fail(404, 'Synth not found');
    }

    switch (true) {
      case route === 'POST /synth/create': {
        const id = Number(body?.synthId);
        if (!id || id < 1 || id > 3 || this.synths.has(id)) return fail(400, 'Invalid synthId');
        this.initSynth(id);
        const created = this.synths.get(id)!;
        const reference = Array.from(this.synths.entries()).find(([otherId, data]) => otherId !== id && data.sequencer.getIsPlaying());
        if (reference) {
          const [, ref] = reference;
          created.sequencer.loadPattern(created.pattern);
          created.sequencer.play(ref.sequencer.getCurrentStep(), ref.sequencer.getNextStepTime() ?? undefined);
        }
        const payload = {
          synthId: id,
          pattern: created.pattern,
          patterns: created.patterns,
          synthParams: created.synth.getParameters(),
          synthModelId: created.modelId,
          synthModelParams: created.modelParams,
          muted: false,
          solo: false,
          isPlaying: Boolean(reference),
        };
        this.emit('synthCreated', payload);
        if (reference) this.emit('sequencerPlay', { synthId: id, patternId: created.pattern.id });
        this.changed();
        return ok(payload);
      }

      case route === 'DELETE /synth/:id': {
        if (synthId === 1) return fail(400, 'Cannot remove synth 1');
        if (synthData) {
          synthData.sequencer.stop();
          this.synths.delete(synthId);
          this.synthMixState.delete(synthId);
        }
        this.emit('synthRemoved', { synthId });
        this.changed();
        return ok();
      }

      case route === 'GET /synth/:id/parameters':
        return ok(synthData!.synth.getParameters());

      case route === 'POST /synth/:id/parameters': {
        const incoming = (body || {}) as Partial<SynthParameters>;
        synthData!.synth.updateParameters({
          ...incoming,
          fxReturn: incoming.fxReturn !== undefined ? clamp(incoming.fxReturn, 0, 1) : undefined,
          fxSends: incoming.fxSends ? normalizeFxSends(incoming.fxSends, synthData!.synth.getParameters().fxSends) : undefined,
        } as Partial<SynthParameters>);
        this.emit('synthUpdate', { synthId, parameters: synthData!.synth.getParameters() });
        this.changed();
        return ok();
      }

      case route === 'GET /synth/:id/model':
        return ok({ modelId: synthData!.modelId, modelParams: synthData!.modelParams });

      case route === 'POST /synth/:id/model': {
        synthData!.modelId = normalizeSynthModelId(body?.modelId);
        synthData!.modelParams = normalizeSynthModelParams({ ...synthData!.modelParams, ...body?.modelParams });
        const data = { synthId, modelId: synthData!.modelId, modelParams: synthData!.modelParams };
        this.emit('synthModelUpdate', data);
        this.changed();
        return ok({ success: true, ...data });
      }

      case route === 'POST /synth/:id/mix': {
        const current = this.synthMixState.get(synthId) || { muted: false, solo: false };
        const next: SynthMixState = {
          muted: typeof body?.muted === 'boolean' ? body.muted : current.muted,
          solo: typeof body?.solo === 'boolean' ? body.solo : current.solo,
        };
        this.synthMixState.set(synthId, next);
        this.emit('synthMix', { synthId, ...next });
        this.changed();
        return ok({ success: true, synthId, ...next });
      }

      case route === 'POST /synth/:id/tempo':
      case route === 'POST /tempo': {
        const tempo = body?.tempo;
        if (typeof tempo !== 'number' || Number.isNaN(tempo) || tempo < 20 || tempo > 400) {
          return fail(400, 'Tempo must be between 20 and 400 BPM');
        }
        this.setTempo(tempo);
        return ok();
      }

      case route === 'GET /tempo':
        return ok({ tempo: this.globalTempo });

      case route === 'GET /synth/:id/patterns':
        return ok(synthData!.patterns);

      case route.startsWith('PUT /synth/:id/patterns/'): {
        const pattern = body as Pattern;
        if (!pattern || !Array.isArray(pattern.steps)) return fail(400, 'Invalid pattern');
        synthData!.pattern = pattern;
        synthData!.patterns = synthData!.patterns.some((p) => p.id === pattern.id)
          ? synthData!.patterns.map((p) => (p.id === pattern.id ? pattern : p))
          : [...synthData!.patterns, pattern];
        if (synthData!.sequencer.getIsPlaying()) synthData!.sequencer.loadPattern(pattern);
        this.emit('patternUpdated', { synthId, pattern });
        this.changed();
        return ok(pattern);
      }

      case route === 'POST /synth/:id/patterns': {
        const pattern = synthData!.sequencer.createEmptyPattern(body?.name || 'New Pattern');
        synthData!.patterns.push(pattern);
        this.emit('patternCreated', { synthId, pattern });
        this.changed();
        return ok(pattern);
      }

      case route === 'POST /sequencer/play': {
        const id = Number(body?.synthId ?? 1);
        const data = this.synths.get(id);
        if (!data) return fail(404, 'Synth not found');
        const pattern = body?.patternId ? data.patterns.find((p) => p.id === body.patternId) : data.pattern;
        if (!pattern) return fail(404, 'Pattern not found');
        data.sequencer.loadPattern(pattern);
        data.sequencer.play();
        data.pattern = pattern;
        this.emit('sequencerPlay', { synthId: id, patternId: pattern.id });
        return ok();
      }

      case route === 'POST /sequencer/stop': {
        const id = Number(body?.synthId ?? 1);
        const data = this.synths.get(id);
        if (!data) return fail(404, 'Synth not found');
        data.sequencer.stop();
        this.emit('sequencerStop', { synthId: id });
        return ok();
      }

      case route === 'GET /drum/state':
        return ok(this.drumState);

      case route === 'PUT /drum/state': {
        if (!body?.state) return fail(400, 'state is required');
        this.drumState = normalizeDrumState(body.state);
        this.emit('drumFullState', { drumState: this.drumState });
        this.changed();
        return ok();
      }

      case route === 'GET /drum/kits':
        return ok({ kits: DRUM_KITS, defaultKitId: DEFAULT_DRUM_KIT_ID });

      case route === 'POST /drum/kit': {
        this.selectedDrumKitId = normalizeDrumKitId(body?.kitId);
        const applyDefaults = Boolean(body?.applyDefaults);
        if (applyDefaults) this.drumState = applyKitDefaultsToDrumState(this.drumState, this.selectedDrumKitId);
        this.emit('drumKitChanged', {
          selectedDrumKitId: this.selectedDrumKitId,
          applyDefaults,
          drumState: applyDefaults ? this.drumState : undefined,
        });
        this.changed();
        return ok({ success: true, selectedDrumKitId: this.selectedDrumKitId, drumState: this.drumState });
      }

      case route === 'POST /drum/step': {
        const { instrument, step, active } = body || {};
        if (!DRUM_INSTRUMENTS.includes(instrument) || step < 0 || step > 15) return fail(400, 'Invalid instrument or step');
        this.drumState[instrument as DrumInstrument].steps[step] = Boolean(active);
        this.emit('drumStep', { instrument, step, active: Boolean(active) });
        this.changed();
        return ok();
      }

      case route === 'POST /drum/step-velocity': {
        const { instrument, step, velocity } = body || {};
        if (!DRUM_INSTRUMENTS.includes(instrument) || step < 0 || step > 15) return fail(400, 'Invalid instrument or step');
        const track = this.drumState[instrument as DrumInstrument];
        if (!track.stepVelocities) track.stepVelocities = new Array(16).fill(1);
        track.stepVelocities[step] = clamp(velocity, 0.1, 1);
        this.emit('drumStepVelocity', { instrument, step, velocity });
        this.changed();
        return ok();
      }

      case route === 'POST /drum/settings': {
        const { instrument, settings } = body || {};
        if (!DRUM_INSTRUMENTS.includes(instrument) || !settings) return fail(400, 'Invalid instrument');
        const s = this.drumState[instrument as DrumInstrument].settings;
        if (settings.volume !== undefined) s.volume = clamp(settings.volume, 0, 1);
        if (settings.tone !== undefined) s.tone = clamp(settings.tone, 0, 1);
        if (settings.extra !== undefined) s.extra = clamp(settings.extra, 0, 1);
        if (settings.tune !== undefined) s.tune = clamp(settings.tune, -1, 1);
        if (settings.humanize !== undefined) s.humanize = clamp(settings.humanize, 0, 1);
        if (settings.pan !== undefined) s.pan = clamp(settings.pan, -1, 1);
        if (settings.cymbalType !== undefined) s.cymbalType = settings.cymbalType;
        this.emit('drumSettings', { instrument, settings: { ...s } });
        this.changed();
        return ok();
      }

      case route === 'POST /drum/mix': {
        const { instrument, muted, solo } = body || {};
        if (!DRUM_INSTRUMENTS.includes(instrument)) return fail(400, 'Invalid instrument');
        const track = this.drumState[instrument as DrumInstrument];
        if (typeof muted === 'boolean') track.muted = muted;
        if (typeof solo === 'boolean') track.solo = solo;
        this.emit('drumMix', { instrument, muted: Boolean(track.muted), solo: Boolean(track.solo) });
        this.changed();
        return ok();
      }

      case route === 'POST /drum/swing': {
        const swing = body?.swing;
        if (typeof swing !== 'number' || swing < 0 || swing > 0.75) return fail(400, 'Invalid swing value (0-0.75)');
        this.drumSwing = swing;
        this.emit('drumSwing', { swing });
        this.changed();
        return ok();
      }

      case route === 'POST /drum/reset': {
        this.drumState = applyKitDefaultsToDrumState(createDefaultDrumState(), this.selectedDrumKitId);
        this.emit('drumReset', {});
        this.changed();
        return ok();
      }

      case route === 'POST /drum/master-volume': {
        this.drumMasterVolume = clamp(Number(body?.volume ?? 1), 0, 2);
        this.changed();
        return ok();
      }

      case route === 'GET /drum/fx':
        return ok(this.drumFx);

      case route === 'POST /drum/fx': {
        this.drumFx = normalizeDrumFx({
          sends: { ...this.drumFx.sends, ...body?.sends },
          returnLevel: body?.returnLevel ?? this.drumFx.returnLevel,
        });
        this.emit('drumFxUpdate', { drumFx: this.drumFx });
        this.changed();
        return ok({ success: true, drumFx: this.drumFx });
      }

      case route === 'GET /effects-loop':
        return ok(this.effectsLoop);

      case route === 'POST /effects-loop': {
        this.effectsLoop = normalizeEffectsLoop({ ...this.effectsLoop, ...body });
        this.emit('effectsLoopUpdate', { effectsLoop: this.effectsLoop });
        this.changed();
        return ok({ success: true, effectsLoop: this.effectsLoop });
      }

      case route === 'POST /patterns/save':
        return this.savePattern(body);

      case route === 'GET /patterns/saved':
        return ok(this.readSavedPatterns()
          .sort((a, b) => b.updatedAt - a.updatedAt)
          .map(({ id, name, updatedAt }) => ({ id, name, updatedAt })));

      case route.startsWith('GET /patterns/saved/'): {
        const entry = this.readSavedPatterns().find((p) => p.id === segments[2]);
        if (!entry) return fail(404, 'Saved pattern not found');
        return ok({
          ...entry,
          synthModelId: normalizeSynthModelId(entry.synthModelId),
          synthModelParams: normalizeSynthModelParams(entry.synthModelParams),
          drumKitId: normalizeDrumKitId(entry.drumKitId),
          drumState: normalizeDrumState(entry.drumState),
          drumFx: normalizeDrumFx(entry.drumFx),
          effectsLoop: normalizeEffectsLoop(entry.effectsLoop),
          synths: entry.synths?.map((s) => ({
            ...s,
            synthModelId: normalizeSynthModelId(s.synthModelId),
            synthModelParams: normalizeSynthModelParams(s.synthModelParams),
          })),
        });
      }

      case route.startsWith('DELETE /patterns/saved/'): {
        const patterns = this.readSavedPatterns();
        const idx = patterns.findIndex((p) => p.id === segments[2]);
        if (idx === -1) return fail(404, 'Saved pattern not found');
        patterns.splice(idx, 1);
        this.writeSavedPatterns(patterns);
        return ok();
      }

      default:
        console.warn(`Unhandled local API route: ${method} ${path}`);
        return fail(404, 'Not found');
    }
  }

  private savePattern(body: any): { status: number; body: unknown } {
    const name = sanitizePatternName(body?.name);
    const steps = body?.steps;
    if (!name || !Array.isArray(steps) || steps.length === 0 || steps.length > 64) {
      return { status: 400, body: { error: 'Invalid pattern payload' } };
    }
    const patterns = this.readSavedPatterns();
    const overwriteId = typeof body.overwriteId === 'string' ? body.overwriteId : null;
    const existingByName = patterns.find((entry) => entry.name.toLowerCase() === name.toLowerCase());
    if (existingByName && existingByName.id !== overwriteId) {
      return { status: 409, body: { error: 'Pattern name already exists', id: existingByName.id, name: existingByName.name } };
    }
    const overwriteTarget = overwriteId ? patterns.find((entry) => entry.id === overwriteId) : null;
    if (overwriteId && !overwriteTarget) {
      return { status: 404, body: { error: 'Pattern to overwrite not found' } };
    }
    const now = Date.now();
    const entry: SavedPatternData = {
      id: overwriteTarget?.id || `saved-${now}`,
      name,
      createdAt: overwriteTarget?.createdAt || now,
      updatedAt: now,
      steps,
      synthParams: body.synthParams || null,
      synthModelId: normalizeSynthModelId(body.synthModelId),
      synthModelParams: normalizeSynthModelParams(body.synthModelParams),
      tempo: body.tempo || this.globalTempo,
      drumState: body.drumState || this.drumState,
      drumKitId: normalizeDrumKitId(body.drumKitId ?? this.selectedDrumKitId),
      drumMasterVolume: body.drumMasterVolume !== undefined ? body.drumMasterVolume : this.drumMasterVolume,
      drumFx: normalizeDrumFx(body.drumFx || this.drumFx),
      effectsLoop: normalizeEffectsLoop(body.effectsLoop || this.effectsLoop),
      synths: Array.isArray(body.synths)
        ? body.synths
            .filter((s: any) => s && typeof s.id === 'number' && Array.isArray(s.steps) && s.steps.length > 0 && s.steps.length <= 64)
            .map((s: any) => ({
              id: s.id,
              steps: s.steps,
              synthParams: s.synthParams || null,
              synthModelId: normalizeSynthModelId(s.synthModelId),
              synthModelParams: normalizeSynthModelParams(s.synthModelParams),
            }))
        : undefined,
    };
    if (overwriteTarget) {
      patterns[patterns.findIndex((p) => p.id === overwriteTarget.id)] = entry;
    } else {
      patterns.push(entry);
    }
    this.writeSavedPatterns(patterns);
    return { status: 200, body: { id: entry.id, name: entry.name, updatedAt: entry.updatedAt } };
  }
}

export const localBackend = new LocalBackend();

export async function apiFetch(path: string, init: RequestInit = {}): Promise<Response> {
  const method = (init.method || 'GET').toUpperCase();
  let body: unknown = undefined;
  if (typeof init.body === 'string' && init.body.length > 0) {
    try {
      body = JSON.parse(init.body);
    } catch {
      return new Response(JSON.stringify({ error: 'Invalid JSON body' }), { status: 400, headers: { 'Content-Type': 'application/json' } });
    }
  }
  const result = localBackend.handle(method, path, body);
  return new Response(JSON.stringify(result.body), {
    status: result.status,
    headers: { 'Content-Type': 'application/json' },
  });
}

export function downloadWav(filename = 'discobot-export.wav') {
  const blob = localBackend.exportWav();
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
