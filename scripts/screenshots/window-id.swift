// Prints the CoreGraphics window id of the frontmost on-screen window owned by a given PID.
//
// `screencapture -l<id>` needs a CGWindowID, and macOS ships no command that prints one. This is
// deliberately keyed on the process id of the browser the capture script launched itself, so it
// never has to guess which window on the desktop belongs to the app.
import CoreGraphics
import Foundation

guard CommandLine.arguments.count > 1, let target = Int(CommandLine.arguments[1]) else {
    FileHandle.standardError.write("usage: window-id <pid>\n".data(using: .utf8)!)
    exit(2)
}

let options: CGWindowListOption = [.optionOnScreenOnly, .excludeDesktopElements]
guard let windows = CGWindowListCopyWindowInfo(options, kCGNullWindowID) as? [[String: Any]] else {
    FileHandle.standardError.write("could not read the window list\n".data(using: .utf8)!)
    exit(1)
}

// On-screen order is front to back, and a browser owns several windows; the largest one that
// belongs to the target process is the document window rather than a helper or a tooltip.
let candidates = windows.filter { window in
    guard let pid = window[kCGWindowOwnerPID as String] as? Int, pid == target else { return false }
    guard let bounds = window[kCGWindowBounds as String] as? [String: Any],
          let width = bounds["Width"] as? Double, let height = bounds["Height"] as? Double
    else { return false }
    return width > 200 && height > 200
}

guard let window = candidates.max(by: { left, right in
    func area(_ window: [String: Any]) -> Double {
        guard let bounds = window[kCGWindowBounds as String] as? [String: Any],
              let width = bounds["Width"] as? Double, let height = bounds["Height"] as? Double
        else { return 0 }
        return width * height
    }
    return area(left) < area(right)
}), let id = window[kCGWindowNumber as String] as? Int else {
    FileHandle.standardError.write("no on-screen window for pid \(target)\n".data(using: .utf8)!)
    exit(1)
}

print(id)
