// Prints the backing scale factor of the display a capture would land on.
//
// A capture inherits the scale of its display, so a 1x monitor halves the resolution of every
// screenshot without saying so. The capture script refuses rather than shipping that quietly.
import AppKit

let scale = NSScreen.screens.map(\.backingScaleFactor).max() ?? 1
print(scale)
