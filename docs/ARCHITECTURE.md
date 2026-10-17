# Code map

The app is one React pedal today. Hardware components are independent of its audio behavior, so another pedal can compose the same controls with a different controller and display content.

```text
src/main.tsx                         Mounts the pedal and registers the PWA worker
src/text.ts                          All app labels, status messages, and dynamic copy
src/hardware/                        Reusable physical controls and their CSS
src/pedals/bury-the-click/           This pedal's layout, dialogs, state, and CSS
src/audio/WebAudioEngine.ts          Browser audio clock, click, hum, microphone, worklet
src/audio/inputDevices.ts            Input discovery and selection
public/onset-worklet.js              Note attack detection on the audio thread
src/timing/grid.ts                   Beat matching and offset calculation
src/timing/metrics.ts                Session summary and calibration median
src/timing/pocket.ts                 Two-measure pocket assessment and tuning values
scripts/build-pwa.mjs                Production asset cache generator
```

## How a note reaches the display

1. `WebAudioEngine` schedules quarter-note clicks on the Web Audio clock and accents the first beat of each measure in the selected 3/4, 4/4, or 5/4 meter. It also sends microphone samples to the onset worklet.
2. The worklet reports a detected attack with its audio timestamp. `TimingGrid.match` records both the nearest audible click and the nearest sixteenth-note target. It applies the saved input delay before choosing the subdivision.
3. `usePedalSession` accepts one result per subdivision and stores up to 128 results for the trace, signed average offset, and pocket score. Every accepted hit flashes the LCD timeline. Only hits assigned to the quarter-note subdivision update its timing offset and marker position. The LCD footer reports pocket assessment progress and changes after completed two-measure windows; it does not repeat the early/late readout. During calibration the session collects eight raw offsets from quarter-note clicks and saves their median for the selected input instead.
4. `BuryTheClickDisplay` supplies this pedal's labels, readouts, timeline, and beat lamps to the shared `LCDScreen` housing. Its beat animation reads the audio clock without rerendering the whole pedal each frame.

The **IN POCKET %** readout starts at `--`. After each complete two-measure window, `advancePocketState` in `src/timing/pocket.ts` waits 200 ms for late note detections, then assesses the window. Fewer than six distinct played notes leave the last score visible. Each note gets full credit near its nearest sixteenth target, then gradually less credit as its error grows; the scoring range narrows at higher tempos. Missing subdivisions are not counted as misses. This is a straight-sixteenth grid-fit score, so a precise 3:2 cross-rhythm can score poorly; it is not a general measure of groove. **BIAS MS** is the signed average sixteenth offset, which distinguishes a consistent early/late tendency from scattered timing. Tempo or time-signature changes start a fresh pocket assessment.

`usePedalSession` owns the audio engine and all session transitions. `useInputPreview` owns the separate microphone preview used while the Input manual is open. Both stop their media tracks, timers, and audio contexts when closed or unmounted. Calibration stops practice before starting its own click; it never drives the main display.

`DebugOverlay` shows the most recent 100 detector events, including attacks ignored as click bleed, duplicates, or below the confidence floor. The engine requests browser echo cancellation and adds 3000 Hz and 3750 Hz tones to each click. It sends scheduled click times to the worklet, which checks for both tones in a 12 ms attack sample; timing alone never rejects an attack. The worklet measures confidence over that window, and `src/audio/onsetPolicy.ts` sets the minimum accepted confidence. Trace timestamps come from the same AudioContext clock as the click and remain relative to the session's first scheduled click, even if tempo or meter is changed.

## Change a control

- Adjust appearance in the matching file under `src/hardware/`. `Dial`, `Switch`, `Footswitch`, `Light`, `AudioJack`, `LCDScreen`, `Pedal`, and `Manual` receive typed props and do not know about practice state. `LCDScreen` owns only the physical display housing; `BuryTheClickDisplay` owns its contents.
- Edit user-facing wording in `src/text.ts`. Its sections cover the pedal, LCD, manuals, trace, signal states, and errors. Change this pedal's layout in `BuryTheClickPedal.tsx` and `pedal.css`.
- Change a value's effect on audio in `usePedalSession.ts`. Keep Web Audio resource management inside `src/audio/`.
- Change timing rules in `src/timing/`; they are pure functions covered by tests.

`Switch` accepts two or three named positions. Its `marks` prop controls the printed legends independently of accessible names. `Pedal` accepts `powder-coat`, `woodgrain`, or `plain` texture. `Light` accepts `off`, `red`, `blue`, `green`, or `warning`. These are presentation options; a new pedal decides what each state means.

## Add a pedal

Create a folder under `src/pedals/` with a component that composes hardware controls and a hook that owns its behavior. Reuse `src/audio/` or `src/timing/` only if its sound and timing rules match. Mount the new pedal from `src/main.tsx` or add a route there. Keep its product-specific images and layout styles in its own folder or in `public/` with distinct names.

Run `npm test` for timing, worklet, and component interactions, then `npm run build` for TypeScript, Vite, and the PWA asset manifest. Browser microphone behavior needs a manual check on localhost or HTTPS with an available input.
