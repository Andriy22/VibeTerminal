# VibeTerminal promo video

A 60-second, 1080p promo rendered entirely in code with [Remotion](https://remotion.dev).
The app UI is *recreated* as React components styled from the real design tokens —
nothing here is a screen recording, so the video can be re-rendered at any time
and always matches whatever `theme.ts` says.

This project is isolated from the app: its own `package.json` and `node_modules`,
and `electron-builder` only packages `out/**` and `resources/**`, so `promo/`
can never end up inside a shipped build.

## Commands

```bash
cd promo
npm install

npm run studio     # scrub and edit live in the browser
npm run render     # → out/vibeterminal-promo.mp4
npm run typecheck
```

`npm run studio` also exposes one composition per beat (`beat-hook`,
`beat-launcher`, …) so a single scene can be worked on without playing the
whole minute.

## Music

The music bed is **synthesised from scratch** by `scripts/make-music.mjs` — no
samples, no dependencies, no licensing to worry about. It's a script rather than
a committed audio blob so the track can be retuned when the edit changes.

```bash
npm run music     # → public/music.mp3 (regenerates from the script)
```

A minor, 120 BPM, i–VI–III–VII. The arrangement is keyed to `src/script.ts`:

| Section | What the music does |
| --- | --- |
| Hook | pad only, filter closed, one soft kick per bar |
| Launcher | riser → impact, beat drops in: kick, bass, offbeat hats |
| Customization | arpeggio enters, filter opens, claps get louder |
| Limits | arp drops out and the pad filter closes — tension under the meters |
| Memory | everything, arp an octave up on the turnaround |
| Dictation | hard breakdown for 4 s under the voice HUD, then builds back |
| Outro | impact, drums stop, pad resolves and fades |

**120 BPM is not arbitrary** — at that tempo every scene boundary in
`script.ts` lands exactly on a beat, so the music changes section precisely when
the video does. If you retime the beats, keep their frame counts multiples of
15 (one beat) or the arrangement will drift out of sync with the cuts.

Playback volume is `0.55`, set in `src/Promo.tsx`. The master is normalised to
−1.3 dBFS true peak, so it sits around −6 dB in the final mux.

To use your own track instead, drop it at `public/music.mp3` and skip
`npm run music`. Render silent with `--props='{"music":false}'`.

## Retiming

`src/script.ts` is the single source of truth for the edit — every beat's start
frame, duration, and caption timing lives there and nothing else hardcodes an
absolute frame. To make the memory beat two seconds longer, change its `dur` and
push the later beats' `from` values; the scenes lay themselves out relative to
their own beat and follow along.

Captions are burned in, since the video autoplays muted nearly everywhere.
`hi` marks words rendered in the accent colour, `mono` marks technical tokens
rendered in the mono font.

## Structure

```
scripts/
  make-music.mjs  synthesises the music bed → public/music.mp3
src/
  script.ts     the edit: beats, frame ranges, caption text
  theme.ts      design tokens mirrored from src/shared/themes.ts
  data.ts       the fictional workspace/notes/usage content
  Promo.tsx     mounts each beat + the caption track + optional music
  ui/           presentational components — pure, prop-driven
  scenes/       one file per beat, owns its internal timing
  lib/          camera, typing, easing helpers
```

**The rule that keeps this maintainable:** components in `ui/` never call
`useCurrentFrame()`. Scenes read the frame and pass plain numbers down, so every
UI component is a pure function of its props — reusable for generating still
screenshots, and checkable in isolation.

Nothing uses `Date.now()` or `Math.random()`; every render is byte-identical.

## Fidelity notes

Values pulled from the real source rather than invented:

| Detail | Source |
| --- | --- |
| Theme palettes, glass levels | `src/shared/themes.ts` |
| Agent glyphs `✳ ⬡ ❯` and hues | `src/renderer/src/kinds.ts`, `styles.css:24-26` |
| Callsigns `alpha bravo charlie` | `src/shared/callsigns.ts` |
| Pane header layout | `src/renderer/src/components/TerminalPane.tsx` |
| Meter thresholds (50% warn, 80% danger) | `src/renderer/src/components/WorkspaceView.tsx:71` |
| Icon paths | `src/renderer/src/components/Icon.tsx` |
| Memory graph force layout | `src/renderer/src/components/MemoryModal.tsx:12-67` |

Two deliberate deviations, both for video legibility:

- **Scale.** The app runs a 13 px body; the promo redraws the same design at
  `SCALE = 1.4` with lower density, because 13 px is unreadable at 1080p.
- **Graph spread.** The memory graph's force constants are tuned for the app's
  470×400 panel. The promo renders it much larger, so repulsion and link length
  scale by `spread` — otherwise the nodes stay balled up in the middle.
