# Code map

The app is one React pedal today. Hardware components are independent of its audio behavior, so another pedal can compose the same controls with a different controller and display content.

```text
src/main.tsx                         Mounts the pedal and registers the PWA worker
src/hardware/                        Reusable physical controls and their CSS
src/pedals/bury-the-click/           This pedal's layout, dialogs, state, and CSS
src/audio/WebAudioEngine.ts          Browser audio clock, click, hum, microphone, worklet
src/audio/inputDevices.ts            Input discovery and selection
public/onset-worklet.js              Note attack detection on the audio thread
src/timing/grid.ts                   Beat matching and offset calculation
src/timing/metrics.ts                Session summary and calibration median
scripts/build-pwa.mjs                Production asset cache generator
```

## How a note reaches the display

1. `WebAudioEngine` schedules quarter-note clicks on the Web Audio clock. It also sends microphone samples to the onset worklet.
2. The worklet reports a detected attack with its audio timestamp. `TimingGrid.match` finds the nearest position on the selected note grid and applies the saved input delay.
3. `usePedalSession` accepts one result per grid position, stores up to 128 results, and updates the status. During calibration it collects eight raw offsets and saves their median for the selected input instead.
4. `LCDScreen` renders the latest offset and session metrics. Its `BeatTrack` reads the audio clock for the sweep and beat lamps without rerendering the whole pedal each frame.

`usePedalSession` owns the audio engine and all session transitions. `useInputPreview` owns the separate microphone preview used while the Input manual is open. Both stop their media tracks, timers, and audio contexts when closed or unmounted. Calibration stops practice before starting its own click; it never drives the main display.

## Change a control

- Adjust appearance in the matching file under `src/hardware/`. `Dial`, `Switch`, `Footswitch`, `Light`, `AudioJack`, `LCDScreen`, `Pedal`, and `Manual` receive typed props and do not know about practice state.
- Adjust this pedal's position or printed labels in `BuryTheClickPedal.tsx` and `pedal.css`.
- Change a value's effect on audio in `usePedalSession.ts`. Keep Web Audio resource management inside `src/audio/`.
- Change timing rules in `src/timing/`; they are pure functions covered by tests.

`Switch` accepts two or three named positions. Its `marks` prop controls the printed legends independently of accessible names. `Pedal` accepts `powder-coat`, `woodgrain`, or `plain` texture. `Light` accepts `off`, `red`, `blue`, `green`, or `warning`. These are presentation options; a new pedal decides what each state means.

## Add a pedal

Create a folder under `src/pedals/` with a component that composes hardware controls and a hook that owns its behavior. Reuse `src/audio/` or `src/timing/` only if its sound and timing rules match. Mount the new pedal from `src/main.tsx` or add a route there. Keep its product-specific images and layout styles in its own folder or in `public/` with distinct names.

Run `npm test` for timing, worklet, and component interactions, then `npm run build` for TypeScript, Vite, and the PWA asset manifest. Browser microphone behavior needs a manual check on localhost or HTTPS with an available input.
