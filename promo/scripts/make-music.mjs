/**
 * Generates the promo's music bed from scratch — no samples, no dependencies.
 *
 *   node scripts/make-music.mjs        → public/music.wav
 *   (the npm script then converts it to public/music.mp3 with ffmpeg)
 *
 * Written as a script rather than shipped as an opaque audio file so the track
 * can be retuned when the edit changes. The arrangement is keyed to the beats
 * in src/script.ts: at 120 BPM every scene boundary lands on a beat, so the
 * music changes section exactly when the video does.
 *
 * A minor, 120 BPM, i–VI–III–VII (Am–F–C–G).
 * All randomness comes from a seeded LCG, so re-running produces byte-identical
 * output — same guarantee the video render makes.
 */

import { writeFileSync, mkdirSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const HERE = dirname(fileURLToPath(import.meta.url))
const OUT = join(HERE, '..', 'public', 'music.wav')

const SR = 44100
const DUR = 60
const N = SR * DUR

const BPM = 120
const BEAT = 60 / BPM // 0.5s
const BAR = BEAT * 4 // 2s
const SIXTEENTH = BEAT / 4

/** Scene starts in seconds, mirrored from src/script.ts. */
const SCENE = {
  hook: 0,
  launcher: 6,
  customization: 19,
  limits: 30,
  memory: 38,
  dictation: 48,
  outro: 56,
}

// ─── deterministic noise ────────────────────────────────────────────────────

let seed = 0x9e3779b9
function noise() {
  seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0
  return (seed / 0x100000000) * 2 - 1
}

// ─── note table ─────────────────────────────────────────────────────────────

const A4 = 440
/** Semitones from A4; e.g. note('A', 2) → 110 Hz. */
const SEMI = { C: -9, D: -7, E: -5, F: -4, G: -2, A: 0, B: 2 }
const hz = (name, octave) => A4 * Math.pow(2, SEMI[name] / 12 + (octave - 4))

/** One chord per bar, cycling for the whole track. */
const PROGRESSION = [
  { root: hz('A', 2), notes: [hz('A', 3), hz('C', 4), hz('E', 4)] },
  { root: hz('F', 2), notes: [hz('F', 3), hz('A', 3), hz('C', 4)] },
  { root: hz('C', 3), notes: [hz('C', 4), hz('E', 4), hz('G', 4)] },
  { root: hz('G', 2), notes: [hz('G', 3), hz('B', 3), hz('D', 4)] },
]
const chordAt = (t) => PROGRESSION[Math.floor(t / BAR) % PROGRESSION.length]

// ─── buffer + helpers ───────────────────────────────────────────────────────

const buf = new Float32Array(N)

const add = (t, sample) => {
  const i = Math.round(t * SR)
  if (i >= 0 && i < N) buf[i] += sample
}

/** Chamberlin state-variable lowpass — cheap, and resonance gives it character. */
function makeLowpass(cutoff, q = 0.9) {
  let low = 0
  let band = 0
  return (x, fc = cutoff) => {
    const f = 2 * Math.sin((Math.PI * Math.min(fc, SR / 3)) / SR)
    const high = x - low - q * band
    band += f * high
    low += f * band
    return low
  }
}

const saw = (phase) => 2 * (phase - Math.floor(phase)) - 1
const square = (phase) => (phase - Math.floor(phase) < 0.5 ? 1 : -1)
const tri = (phase) => {
  const p = phase - Math.floor(phase)
  return 4 * Math.abs(p - 0.5) - 1
}

// ─── voices ─────────────────────────────────────────────────────────────────

/** Kick: pitch-swept sine with a click transient. */
function kick(t0, gain = 1) {
  const len = 0.42
  let phase = 0
  for (let i = 0; i < len * SR; i++) {
    const t = i / SR
    const f = 46 + 105 * Math.exp(-t * 42)
    phase += f / SR
    const body = Math.sin(2 * Math.PI * phase) * Math.exp(-t * 7.5)
    const click = noise() * Math.exp(-t * 320) * 0.28
    add(t0 + t, (body + click) * 0.9 * gain)
  }
}

/** Hi-hat: highpassed noise, short decay. */
function hat(t0, gain = 1, open = false) {
  const len = open ? 0.16 : 0.05
  let prev = 0
  for (let i = 0; i < len * SR; i++) {
    const t = i / SR
    const n = noise()
    const hp = n - prev // crude 6dB/oct highpass, plenty for a hat
    prev = n
    add(t0 + t, hp * Math.exp(-t * (open ? 26 : 95)) * 0.16 * gain)
  }
}

/** Clap: three quick noise bursts, then a short tail. */
function clap(t0, gain = 1) {
  const lp = makeLowpass(3800, 0.7)
  for (let burst = 0; burst < 3; burst++) {
    const off = burst * 0.011
    for (let i = 0; i < 0.02 * SR; i++) {
      const t = i / SR
      add(t0 + off + t, lp(noise()) * Math.exp(-t * 150) * 0.5 * gain)
    }
  }
  for (let i = 0; i < 0.19 * SR; i++) {
    const t = i / SR
    add(t0 + 0.022 + t, lp(noise()) * Math.exp(-t * 22) * 0.3 * gain)
  }
}

/** Bass: filtered saw+square, plucky envelope. */
function bass(t0, dur, freq, gain = 1, cutoff = 620) {
  const lp = makeLowpass(cutoff, 1.15)
  let phase = 0
  for (let i = 0; i < dur * SR; i++) {
    const t = i / SR
    phase += freq / SR
    const env = Math.min(1, t * 220) * Math.exp(-t * 4.2)
    const raw = saw(phase) * 0.6 + square(phase * 0.5) * 0.4
    // Envelope the cutoff too, so each note opens and closes.
    add(t0 + t, lp(raw, cutoff + 900 * Math.exp(-t * 11)) * env * 0.38 * gain)
  }
}

/** Crossfade between adjacent chord pads, in seconds. */
const PAD_XF = 0.5

/**
 * Pad: detuned saw stack with a moving cutoff.
 *
 * The envelope is an equal-power crossfade (sin/cos) rather than a plain
 * attack/release: each chord holds for a full bar then hands over to the next
 * across PAD_XF. With linear ramps the overlap dips in the middle and the pad
 * audibly pumps once per bar — sin²+cos²=1 keeps the level flat instead.
 */
function pad(t0, freqs, gain = 1, cutoffFn = () => 1400) {
  const dur = BAR + PAD_XF
  const lp = makeLowpass(1400, 0.6)
  const detune = [-0.09, 0.06, 0.13]
  const phases = []
  for (const f of freqs) for (const d of detune) phases.push({ f: f * (1 + d / 12), p: 0 })

  for (let i = 0; i < dur * SR; i++) {
    const t = i / SR
    let s = 0
    for (const v of phases) {
      v.p += v.f / SR
      s += saw(v.p)
    }
    s /= phases.length

    let env = 1
    if (t < PAD_XF) env = Math.sin((Math.PI / 2) * (t / PAD_XF))
    else if (t > BAR) env = Math.cos((Math.PI / 2) * ((t - BAR) / PAD_XF))

    add(t0 + t, lp(s, cutoffFn(t0 + t)) * env * 0.3 * gain)
  }
}

/** Arp pluck: triangle+square, fast decay. */
function pluck(t0, freq, gain = 1, cutoff = 2600) {
  const len = 0.22
  const lp = makeLowpass(cutoff, 1.0)
  let phase = 0
  for (let i = 0; i < len * SR; i++) {
    const t = i / SR
    phase += freq / SR
    const env = Math.min(1, t * 900) * Math.exp(-t * 15)
    const raw = tri(phase) * 0.7 + square(phase) * 0.3
    add(t0 + t, lp(raw, cutoff + 2200 * Math.exp(-t * 22)) * env * 0.18 * gain)
  }
}

/** Noise riser into a transition. */
function riser(t0, dur, gain = 1) {
  const lp = makeLowpass(400, 1.6)
  for (let i = 0; i < dur * SR; i++) {
    const t = i / SR
    const k = t / dur
    const cutoff = 300 + 5200 * k * k
    const env = k * k * (1 - Math.max(0, (t - dur + 0.08) / 0.08))
    add(t0 + t, lp(noise(), cutoff) * env * 0.22 * gain)
  }
}

/** Downbeat impact: sub boom + noise splash. */
function impact(t0, gain = 1) {
  let phase = 0
  for (let i = 0; i < 1.6 * SR; i++) {
    const t = i / SR
    const f = 60 + 90 * Math.exp(-t * 26)
    phase += f / SR
    const sub = Math.sin(2 * Math.PI * phase) * Math.exp(-t * 3.4)
    const splash = noise() * Math.exp(-t * 9) * 0.16
    add(t0 + t, (sub + splash) * 0.75 * gain)
  }
}

// ─── arrangement ────────────────────────────────────────────────────────────

/** Pad runs the whole track, its filter opening and closing by section. */
function padCutoff(t) {
  if (t < SCENE.launcher) return 500 + 900 * (t / SCENE.launcher)
  if (t < SCENE.customization) return 1500
  if (t < SCENE.limits) return 2600
  if (t < SCENE.memory) return 1200 // tension: close it down
  if (t < SCENE.dictation) return 2800
  if (t < SCENE.outro) return 1900
  return 2400
}

for (let bar = 0; bar * BAR < DUR; bar++) {
  const t = bar * BAR
  const chord = PROGRESSION[bar % PROGRESSION.length]
  pad(t, chord.notes, t >= SCENE.outro ? 1.15 : 0.95, padCutoff)
}

// Drums + bass, stepped through every 16th note of the track.
for (let step = 0; step * SIXTEENTH < DUR; step++) {
  const t = step * SIXTEENTH
  const inBar = step % 16
  const beat = inBar / 4
  const chord = chordAt(t)

  const hook = t < SCENE.launcher
  const breakdown = t >= SCENE.dictation && t < SCENE.dictation + 4
  const outro = t >= SCENE.outro
  const drums = !hook && !breakdown && !outro
  const full = t >= SCENE.customization && t < SCENE.dictation

  // Hook: a single soft kick per bar, so there's a pulse under the cold open.
  if (hook && inBar === 0 && t >= 2) kick(t, 0.55)

  if (drums) {
    if (inBar % 4 === 0) kick(t, 1)
    // Offbeat 8ths.
    if (inBar % 4 === 2) hat(t, full ? 1 : 0.7, inBar % 8 === 6)
    // Extra 16th ticks once the arp is in, for drive.
    if (full && (inBar === 3 || inBar === 11)) hat(t, 0.45)
    if (beat === 1 || beat === 3) clap(t, t >= SCENE.customization ? 0.9 : 0.6)
  }

  // Bass: root on the downbeat plus a syncopated push, octave up on the "and".
  if (drums || breakdown) {
    const g = breakdown ? 0.5 : 1
    if (inBar === 0) bass(t, BEAT * 1.5, chord.root, g)
    if (inBar === 6) bass(t, BEAT * 0.5, chord.root, 0.75 * g)
    if (inBar === 10) bass(t, BEAT * 0.5, chord.root * 2, 0.6 * g)
    if (inBar === 14 && full) bass(t, BEAT * 0.5, chord.root, 0.7 * g)
  }

  // Arp: 16ths from the customization beat onward, up-down over chord tones.
  const arpOn =
    (t >= SCENE.customization && t < SCENE.limits) ||
    (t >= SCENE.memory && t < SCENE.outro)
  if (arpOn && inBar % 2 === 0) {
    const pattern = [0, 1, 2, 1, 2, 0, 1, 2]
    const note = chord.notes[pattern[(step / 2) % 8 | 0] % chord.notes.length]
    const octave = t >= SCENE.memory && inBar % 8 === 4 ? 2 : 1
    pluck(t, note * octave, t >= SCENE.memory ? 1 : 0.75)
  }
}

// Transitions: a riser into each major section change, impact on the landing.
// The dictation breakdown at 48s is a hard drop on purpose — a riser into a
// breakdown fights it. Everything else gets a lead-in.
riser(SCENE.launcher - 1.5, 1.5, 0.9)
riser(SCENE.customization - 1, 1, 0.7)
riser(SCENE.limits - 1, 1, 0.6)
riser(SCENE.memory - 1, 1, 0.7)
riser(SCENE.outro - 2, 2, 1.1)

impact(SCENE.launcher, 0.8)
impact(SCENE.customization, 0.5)
impact(SCENE.outro, 1)

// ─── master ─────────────────────────────────────────────────────────────────

// Gentle high-shelf lift so it isn't muddy, then soft-clip and normalise.
let peak = 0
for (let i = 0; i < N; i++) {
  buf[i] = Math.tanh(buf[i] * 1.15) * 0.86
  // 2s fade in from silence, 1.5s fade out under the outro tail.
  const t = i / SR
  if (t < 0.6) buf[i] *= t / 0.6
  if (t > DUR - 1.5) buf[i] *= Math.max(0, (DUR - t) / 1.5)
  peak = Math.max(peak, Math.abs(buf[i]))
}
const norm = peak > 0 ? 0.89 / peak : 1
for (let i = 0; i < N; i++) buf[i] *= norm

// ─── write 16-bit stereo WAV ────────────────────────────────────────────────

const bytes = Buffer.alloc(44 + N * 4)
bytes.write('RIFF', 0)
bytes.writeUInt32LE(36 + N * 4, 4)
bytes.write('WAVE', 8)
bytes.write('fmt ', 12)
bytes.writeUInt32LE(16, 16)
bytes.writeUInt16LE(1, 20) // PCM
bytes.writeUInt16LE(2, 22) // stereo
bytes.writeUInt32LE(SR, 24)
bytes.writeUInt32LE(SR * 4, 28)
bytes.writeUInt16LE(4, 32)
bytes.writeUInt16LE(16, 34)
bytes.write('data', 36)
bytes.writeUInt32LE(N * 4, 40)

for (let i = 0; i < N; i++) {
  const v = Math.max(-1, Math.min(1, buf[i]))
  const s = Math.round(v * 32767)
  bytes.writeInt16LE(s, 44 + i * 4)
  bytes.writeInt16LE(s, 44 + i * 4 + 2)
}

mkdirSync(dirname(OUT), { recursive: true })
writeFileSync(OUT, bytes)
console.log(`wrote ${OUT} — ${DUR}s, ${BPM} BPM, peak ${peak.toFixed(3)}`)
