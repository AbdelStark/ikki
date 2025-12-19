import { execSync } from "child_process";
import { runAppleScriptMultiLine } from "./applescript.js";
import type { WindowInfo } from "../types.js";
import { APP_NAMES } from "../types.js";

export function getRunningAppName(): string | null {
  for (const name of APP_NAMES) {
    if (isAppRunning(name)) {
      return name;
    }
  }
  return null;
}

export function isAppRunning(appName: string): boolean {
  try {
    const result = runAppleScriptMultiLine([
      'tell application "System Events"',
      "  set appList to name of every process",
      `  return "${appName}" is in appList`,
      "end tell",
    ]);
    return result === "true";
  } catch {
    return false;
  }
}

export function getWindowBounds(appName: string): WindowInfo | null {
  try {
    const posResult = runAppleScriptMultiLine([
      'tell application "System Events"',
      `  tell process "${appName}"`,
      "    set winPos to position of window 1",
      "    set winSize to size of window 1",
      '    return (item 1 of winPos) & "," & (item 2 of winPos) & "," & (item 1 of winSize) & "," & (item 2 of winSize)',
      "  end tell",
      "end tell",
    ]);

    const [x, y, width, height] = posResult.split(",").map(Number);

    const frontmost = runAppleScriptMultiLine([
      'tell application "System Events"',
      `  return frontmost of process "${appName}"`,
      "end tell",
    ]);

    let windowId: number | undefined;
    try {
      const windowIdResult = execSync(
        `python3 -c "
from Quartz import CGWindowListCopyWindowInfo, kCGWindowListOptionAll, kCGNullWindowID
windows = CGWindowListCopyWindowInfo(kCGWindowListOptionAll, kCGNullWindowID)
for w in windows:
    if w.get('kCGWindowOwnerName') == '${appName}':
        print(w['kCGWindowNumber'])
        break
"`,
        { encoding: "utf8" }
      ).trim();
      if (windowIdResult) {
        windowId = parseInt(windowIdResult, 10);
      }
    } catch {
      // Window ID not available, will use rectangle capture
    }

    const screenWidth = parseInt(
      execSync("system_profiler SPDisplaysDataType | grep Resolution | head -1 | awk '{print $2}'", {
        encoding: "utf8",
      }).trim(),
      10
    ) || 1920;

    const screenHeight = parseInt(
      execSync("system_profiler SPDisplaysDataType | grep Resolution | head -1 | awk '{print $4}'", {
        encoding: "utf8",
      }).trim(),
      10
    ) || 1080;

    const isFullscreen = width >= screenWidth * 0.95 && height >= screenHeight * 0.9;

    return {
      x,
      y,
      width,
      height,
      windowId,
      isFullscreen,
      isFrontmost: frontmost === "true",
    };
  } catch (err) {
    console.error("Error getting window bounds:", err);
    return null;
  }
}

export function translateToScreenCoords(
  windowX: number,
  windowY: number,
  bounds: WindowInfo
): { screenX: number; screenY: number } {
  return {
    screenX: bounds.x + windowX,
    screenY: bounds.y + windowY,
  };
}
