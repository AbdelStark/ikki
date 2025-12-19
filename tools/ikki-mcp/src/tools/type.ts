import { isAppRunning } from "../utils/window-manager.js";
import {
  bringAppToFront,
  typeText,
  pressKey,
  typeWithModifiers,
} from "../utils/applescript.js";
import type { TypeOptions, TypeResult } from "../types.js";

export async function type(
  appName: string,
  options: TypeOptions
): Promise<TypeResult> {
  const { text, keystrokeDelay = 0, modifiers = [], specialKey } = options;

  if (!isAppRunning(appName)) {
    return { success: false, error: `App "${appName}" is not running` };
  }

  try {
    bringAppToFront(appName);

    // Small delay to ensure app is focused
    await new Promise((resolve) => setTimeout(resolve, 50));

    if (specialKey) {
      pressKey(specialKey, modifiers);
    } else if (text) {
      if (modifiers.length > 0) {
        typeWithModifiers(text, modifiers);
      } else if (keystrokeDelay > 0) {
        // Type character by character with delay
        for (const char of text) {
          typeText(char);
          await new Promise((resolve) => setTimeout(resolve, keystrokeDelay));
        }
      } else {
        typeText(text);
      }
    } else {
      return { success: false, error: "Either text or specialKey must be provided" };
    }

    return { success: true };
  } catch (err) {
    return {
      success: false,
      error: `Type failed: ${err instanceof Error ? err.message : String(err)}`,
    };
  }
}
