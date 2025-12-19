import { getWindowBounds, isAppRunning } from "../utils/window-manager.js";
import type { WindowInfoResult } from "../types.js";

export async function getWindowInfo(appName: string): Promise<WindowInfoResult> {
  const appRunning = isAppRunning(appName);

  if (!appRunning) {
    return {
      success: true,
      appRunning: false,
      error: `App "${appName}" is not running`,
    };
  }

  const windowInfo = getWindowBounds(appName);

  if (!windowInfo) {
    return {
      success: false,
      appRunning: true,
      error: `Could not get window info for "${appName}"`,
    };
  }

  return {
    success: true,
    appRunning: true,
    windowInfo,
  };
}
