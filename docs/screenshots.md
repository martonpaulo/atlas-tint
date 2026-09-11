# Screenshots

The published screenshots are captures of the **real application window**, taken on screen, so
they carry the shadow, the rounded corners, the material, and the elevation macOS draws around a
window. Rendering the page to an offscreen bitmap does not produce that, and raising the scale
factor does not put it back.

```bash
pnpm dev:web            # in one terminal
pnpm screenshots        # in another
```

The result lands in `docs/screenshots/` as near-lossless WebP at half the capture: every pixel
within a few levels of the original, alpha preserved for the shadow, about 170 KB each.

## How it works

`scripts/screenshots/capture.mjs` launches a **headed** Chromium through Playwright in **app mode**
(`--app`), so the window is a title bar and the page: no tab strip, and no address bar reading
`localhost`. The window frame is pinned to Light for the length of the run (the test browser's own
`NSRequiresAquaSystemAppearance` default, removed afterwards), so a light page is never framed by a
dark title bar on a Mac in Dark Mode. It seeds
progress through the `atlas-tint:state` key the application already owns — so the capture needs
no hook in production code and reproduces a state a user could really be in — waits for the map,
brings the window forward, and hands the window to `screencapture -l<id>`.

Two Swift helpers exist because macOS ships no command for either job:

- `window-id.swift` prints the CoreGraphics window id for a **process id**. The capture script
  launched the browser, so it knows the pid and never has to guess which window on the desktop
  belongs to the app.
- `display-scale.swift` prints the backing scale factor of the capture display.

## Rules the script enforces

- **Never `-o`.** That is the flag that removes the shadow.
- **Retina only.** A capture inherits the scale of its display, so a 1× monitor halves the
  resolution of every screenshot without saying so. The script refuses on a sub-2× display.
  `--allow-low-dpi` exists for a throwaway capture and prints a warning; do not publish its
  output.
- **The window must be active at the moment of capture.** An inactive window comes out with a
  grey traffic light and dimmed controls, so the script re-activates it after a few run loops and
  waits before firing.
- **Only this application's windows**, resolved from the browser process the script launched
  itself.
- **Fixed geometry.** Window size, viewport, theme, preset, and the seeded selections are all
  pinned, so the capture reproduces on another machine.

## Publishing

Limit the published width to **twice** the largest slot the image appears in. A capture at
display scale is only the right size if something renders it at half those pixels. The README
displays them at a maximum of 720 CSS pixels, so 1440 device pixels is the ceiling. The window is
1440 points wide and captured at 2x (2880 device pixels, 3104 with the shadow), and the script
publishes it at half that, 1552 pixels: the window's own width plus its shadow.

Do not add `border-radius` or `box-shadow` on top of these images. They already carry the
window's own corner and shadow; a second one crops the corner at a different radius and stacks
two shadows.
