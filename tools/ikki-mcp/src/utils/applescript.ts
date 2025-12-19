import { execSync } from "child_process";

export function runAppleScript(script: string): string {
  const escapedScript = script.replace(/'/g, "'\"'\"'");
  return execSync(`osascript -e '${escapedScript}'`, {
    encoding: "utf8",
    maxBuffer: 10 * 1024 * 1024,
  }).trim();
}

export function runAppleScriptMultiLine(lines: string[]): string {
  const args = lines.map((line) => `-e '${line.replace(/'/g, "'\"'\"'")}'`).join(" ");
  return execSync(`osascript ${args}`, {
    encoding: "utf8",
    maxBuffer: 10 * 1024 * 1024,
  }).trim();
}

export function bringAppToFront(appName: string): void {
  runAppleScriptMultiLine([
    `tell application "${appName}"`,
    "  activate",
    "end tell",
  ]);
}

export function clickAtPosition(
  x: number,
  y: number,
  clickType: "single" | "double" | "right" = "single"
): void {
  let clickCommand: string;
  switch (clickType) {
    case "double":
      clickCommand = `click at {${Math.round(x)}, ${Math.round(y)}}
      delay 0.1
      click at {${Math.round(x)}, ${Math.round(y)}}`;
      break;
    case "right":
      clickCommand = `click at {${Math.round(x)}, ${Math.round(y)}} with control down`;
      break;
    default:
      clickCommand = `click at {${Math.round(x)}, ${Math.round(y)}}`;
  }

  runAppleScriptMultiLine([
    'tell application "System Events"',
    `  ${clickCommand}`,
    "end tell",
  ]);
}

export function typeText(text: string): void {
  const escapedText = text.replace(/\\/g, "\\\\").replace(/"/g, '\\"');
  runAppleScriptMultiLine([
    'tell application "System Events"',
    `  keystroke "${escapedText}"`,
    "end tell",
  ]);
}

const KEY_CODES: Record<string, number> = {
  return: 36,
  tab: 48,
  escape: 53,
  delete: 51,
  backspace: 51,
  up: 126,
  down: 125,
  left: 123,
  right: 124,
};

export function pressKey(
  keyName: string,
  modifiers: string[] = []
): void {
  const keyCode = KEY_CODES[keyName];
  if (keyCode === undefined) {
    throw new Error(`Unknown key: ${keyName}`);
  }

  let modifierStr = "";
  if (modifiers.length > 0) {
    const modifierList = modifiers.map((m) => `${m} down`).join(", ");
    modifierStr = ` using {${modifierList}}`;
  }

  runAppleScriptMultiLine([
    'tell application "System Events"',
    `  key code ${keyCode}${modifierStr}`,
    "end tell",
  ]);
}

export function typeWithModifiers(
  text: string,
  modifiers: string[]
): void {
  const escapedText = text.replace(/\\/g, "\\\\").replace(/"/g, '\\"');
  const modifierList = modifiers.map((m) => `${m} down`).join(", ");

  runAppleScriptMultiLine([
    'tell application "System Events"',
    `  keystroke "${escapedText}" using {${modifierList}}`,
    "end tell",
  ]);
}
