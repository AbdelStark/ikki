import {
  getWindowBounds,
  isAppRunning,
  translateToScreenCoords,
} from "../utils/window-manager.js";
import { bringAppToFront, clickAtPosition } from "../utils/applescript.js";
import type { ClickOptions, ClickResult } from "../types.js";

export async function click(
  appName: string,
  options: ClickOptions
): Promise<ClickResult> {
  const { x, y, clickType = "single", delay = 0 } = options;

  if (!isAppRunning(appName)) {
    return { success: false, error: `App "${appName}" is not running` };
  }

  const bounds = getWindowBounds(appName);
  if (!bounds) {
    return {
      success: false,
      error: `Could not get window bounds for "${appName}"`,
    };
  }

  const { screenX, screenY } = translateToScreenCoords(x, y, bounds);

  try {
    bringAppToFront(appName);

    if (delay > 0) {
      await new Promise((resolve) => setTimeout(resolve, delay));
    }

    clickAtPosition(screenX, screenY, clickType);

    return {
      success: true,
      screenX,
      screenY,
    };
  } catch (err) {
    return {
      success: false,
      error: `Click failed: ${err instanceof Error ? err.message : String(err)}`,
    };
  }
}
