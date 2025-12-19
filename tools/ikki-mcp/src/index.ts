#!/usr/bin/env bun
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";

import { screenshot } from "./tools/screenshot.js";
import { click } from "./tools/click.js";
import { type as typeAction } from "./tools/type.js";
import { getWindowInfo } from "./tools/window.js";
import { getRunningAppName } from "./utils/window-manager.js";

const server = new McpServer({
  name: "ikki-automation",
  version: "0.1.0",
});

// Screenshot tool - capture the Ikki app window
server.tool(
  "screenshot",
  "Capture a screenshot of the Ikki Zcash Wallet app window. Returns base64-encoded image.",
  {
    fullScreen: z
      .boolean()
      .optional()
      .default(false)
      .describe("Capture full screen instead of just the app window"),
    format: z
      .enum(["png", "jpg"])
      .optional()
      .default("png")
      .describe("Image format"),
    includeCursor: z
      .boolean()
      .optional()
      .default(false)
      .describe("Include mouse cursor in screenshot"),
  },
  async (args) => {
    const appName = getRunningAppName();
    if (!appName) {
      return {
        content: [{ type: "text" as const, text: 'Error: App "ikki" is not running. Start it with: bun run tauri dev' }],
        isError: true,
      };
    }
    const result = await screenshot(appName, args);

    if (result.success && result.imageBase64) {
      return {
        content: [
          {
            type: "image" as const,
            data: result.imageBase64,
            mimeType: result.mimeType || "image/png",
          },
          {
            type: "text" as const,
            text: `Screenshot captured successfully.\nWindow bounds: x=${result.windowBounds?.x}, y=${result.windowBounds?.y}, width=${result.windowBounds?.width}, height=${result.windowBounds?.height}`,
          },
        ],
      };
    }

    return {
      content: [{ type: "text" as const, text: `Error: ${result.error}` }],
      isError: true,
    };
  }
);

// Click tool - click at coordinates within the app window
server.tool(
  "click",
  "Click at coordinates within the Ikki app window. Coordinates are relative to the app window (0,0 = top-left of window content).",
  {
    x: z.number().describe("X coordinate relative to app window"),
    y: z.number().describe("Y coordinate relative to app window"),
    clickType: z
      .enum(["single", "double", "right"])
      .optional()
      .default("single")
      .describe("Type of click"),
    delay: z
      .number()
      .optional()
      .default(0)
      .describe("Delay in milliseconds before clicking"),
  },
  async (args) => {
    const appName = getRunningAppName();
    if (!appName) {
      return {
        content: [{ type: "text" as const, text: 'Error: App "ikki" is not running. Start it with: bun run tauri dev' }],
        isError: true,
      };
    }
    const result = await click(appName, args);

    if (result.success) {
      return {
        content: [
          {
            type: "text" as const,
            text: `Clicked at window coordinates (${args.x}, ${args.y}) → screen coordinates (${result.screenX}, ${result.screenY})`,
          },
        ],
      };
    }

    return {
      content: [{ type: "text" as const, text: `Error: ${result.error}` }],
      isError: true,
    };
  }
);

// Type tool - type text or press special keys
server.tool(
  "type",
  "Type text or press special keys in the Ikki app. The app must be focused (tool will bring it to front).",
  {
    text: z.string().optional().describe("Text to type"),
    keystrokeDelay: z
      .number()
      .optional()
      .default(0)
      .describe("Delay between keystrokes in milliseconds"),
    modifiers: z
      .array(z.enum(["command", "option", "control", "shift"]))
      .optional()
      .describe("Modifier keys to hold while typing"),
    specialKey: z
      .enum([
        "return",
        "tab",
        "escape",
        "delete",
        "backspace",
        "up",
        "down",
        "left",
        "right",
      ])
      .optional()
      .describe("Special key to press instead of typing text"),
  },
  async (args) => {
    const appName = getRunningAppName();
    if (!appName) {
      return {
        content: [{ type: "text" as const, text: 'Error: App "ikki" is not running. Start it with: bun run tauri dev' }],
        isError: true,
      };
    }
    const result = await typeAction(appName, args);

    if (result.success) {
      const action = args.specialKey
        ? `Pressed ${args.specialKey}`
        : `Typed "${args.text}"`;
      const modifierInfo =
        args.modifiers && args.modifiers.length > 0
          ? ` with ${args.modifiers.join("+")} modifier(s)`
          : "";
      return {
        content: [
          {
            type: "text" as const,
            text: `${action}${modifierInfo}`,
          },
        ],
      };
    }

    return {
      content: [{ type: "text" as const, text: `Error: ${result.error}` }],
      isError: true,
    };
  }
);

// Get window info tool - get window position and dimensions
server.tool(
  "get_window_info",
  "Get information about the Ikki app window including position, size, and state.",
  {},
  async () => {
    const appName = getRunningAppName();
    if (!appName) {
      return {
        content: [
          {
            type: "text" as const,
            text: 'App "ikki" is not running. Start it with: bun run tauri dev',
          },
        ],
        isError: true,
      };
    }
    const result = await getWindowInfo(appName);

    if (result.success && result.windowInfo) {
      const info = result.windowInfo;
      return {
        content: [
          {
            type: "text" as const,
            text: JSON.stringify(
              {
                appName,
                appRunning: result.appRunning,
                position: { x: info.x, y: info.y },
                size: { width: info.width, height: info.height },
                windowId: info.windowId,
                isFullscreen: info.isFullscreen,
                isFrontmost: info.isFrontmost,
              },
              null,
              2
            ),
          },
        ],
      };
    }

    return {
      content: [{ type: "text" as const, text: `Error: ${result.error}` }],
      isError: true,
    };
  }
);

// Start the server
async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error("Ikki Automation MCP Server running on stdio");
}

main().catch((err) => {
  console.error("Failed to start server:", err);
  process.exit(1);
});
