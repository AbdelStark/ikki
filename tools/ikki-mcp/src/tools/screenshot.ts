import { execSync } from "child_process";
import { readFileSync, unlinkSync, mkdirSync, existsSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";
import { getWindowBounds, isAppRunning } from "../utils/window-manager.js";
import type { ScreenshotOptions, ScreenshotResult } from "../types.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const TMP_DIR = join(__dirname, "..", "..", "tmp");

export async function screenshot(
  appName: string,
  options: ScreenshotOptions
): Promise<ScreenshotResult> {
  const { fullScreen = false, format = "png", includeCursor = false } = options;

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

  if (!existsSync(TMP_DIR)) {
    mkdirSync(TMP_DIR, { recursive: true });
  }

  const tmpPath = join(TMP_DIR, `screenshot-${Date.now()}.${format}`);

  try {
    const formatFlag = format === "jpg" ? "-t jpg" : "-t png";
    const cursorFlag = includeCursor ? "-C" : "";

    let cmd: string;

    if (fullScreen) {
      cmd = `screencapture -x ${formatFlag} ${cursorFlag} "${tmpPath}"`;
    } else if (bounds.windowId) {
      cmd = `screencapture -l ${bounds.windowId} -x -o ${formatFlag} ${cursorFlag} "${tmpPath}"`;
    } else {
      cmd = `screencapture -R ${bounds.x},${bounds.y},${bounds.width},${bounds.height} -x ${formatFlag} ${cursorFlag} "${tmpPath}"`;
    }

    execSync(cmd);

    const imageBuffer = readFileSync(tmpPath);
    const imageBase64 = imageBuffer.toString("base64");

    try {
      unlinkSync(tmpPath);
    } catch {
      // Ignore cleanup errors
    }

    return {
      success: true,
      imageBase64,
      mimeType: format === "jpg" ? "image/jpeg" : "image/png",
      windowBounds: {
        x: bounds.x,
        y: bounds.y,
        width: bounds.width,
        height: bounds.height,
      },
    };
  } catch (err) {
    try {
      unlinkSync(tmpPath);
    } catch {
      // Ignore cleanup errors
    }
    return {
      success: false,
      error: `Screenshot failed: ${err instanceof Error ? err.message : String(err)}`,
    };
  }
}
