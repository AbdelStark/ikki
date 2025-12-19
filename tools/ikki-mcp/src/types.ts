export interface WindowInfo {
  x: number;
  y: number;
  width: number;
  height: number;
  windowId?: number;
  isFullscreen: boolean;
  isFrontmost: boolean;
}

export interface ScreenshotOptions {
  fullScreen?: boolean;
  format?: "png" | "jpg";
  includeCursor?: boolean;
}

export interface ScreenshotResult {
  success: boolean;
  imageBase64?: string;
  mimeType?: string;
  windowBounds?: { x: number; y: number; width: number; height: number };
  error?: string;
}

export interface ClickOptions {
  x: number;
  y: number;
  clickType?: "single" | "double" | "right";
  delay?: number;
}

export interface ClickResult {
  success: boolean;
  screenX?: number;
  screenY?: number;
  error?: string;
}

export interface TypeOptions {
  text?: string;
  keystrokeDelay?: number;
  modifiers?: ("command" | "option" | "control" | "shift")[];
  specialKey?:
    | "return"
    | "tab"
    | "escape"
    | "delete"
    | "backspace"
    | "up"
    | "down"
    | "left"
    | "right";
}

export interface TypeResult {
  success: boolean;
  error?: string;
}

export interface WindowInfoResult {
  success: boolean;
  appRunning?: boolean;
  windowInfo?: WindowInfo;
  error?: string;
}

// In dev mode, Tauri uses "app" as the process name; in production it's "ikki"
// The getAppName() function in window-manager.ts auto-detects which is running
export const APP_NAMES = ["ikki", "app"] as const;
export const APP_BUNDLE_ID = "com.radiantcommons.ikki";
