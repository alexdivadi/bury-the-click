# Bury the Click

A single-screen bass timing trainer. It listens to an audio input, plays a metronome, and shows each detected note's offset from the selected beat grid.

## Run

```sh
npm install
npm run dev
```

Open the local URL shown by Vite. Live audio requires **HTTPS or localhost** and microphone permission. Use headphones when playing through a microphone so the click does not trigger the onset detector. For a USB interface, select its input through the pedal's **Input** jack.

## Controls

- Drag the tempo or input gain knob left and right, or use arrow keys when focused. Double-click a knob to reset it (80 BPM or 55% gain).
- Tap the Note Grid switch to cycle through quarter, eighth, and sixteenth notes, or drag it left and right to choose a position. Arrow keys also work when the switch is focused. The audible click stays on quarter notes while the timing grid follows the selected subdivision.
- Tap the footswitch to start or stop. The pedal reports timing against the nearest grid position.
- Press the **Input** jack to cycle through available audio sources with the arrow buttons, calibrate delay while the metronome is running, or reset the offset. Calibration is saved locally for each selected device.

The LCD uses [DSEG7 and DSEG14 Classic](https://github.com/keshikan/DSEG) by keshikan under the SIL Open Font License 1.1; the license is included in `public/fonts/DSEG-LICENSE.txt`.

## Verify

```sh
npm test
npm run build
```

The timing engine uses `AudioContext.currentTime` as its clock. Clicks are scheduled ahead on that clock, and the AudioWorklet timestamps attacks from `currentFrame`. The UI only displays the resulting events. The onset detector is intentionally energy based; actual bass recordings across instruments, interfaces, and rooms are still needed to validate its accuracy and tune its thresholds.
