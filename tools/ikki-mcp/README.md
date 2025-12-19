# ikki-mcp

MCP (Model Context Protocol) server for automating the Ikki Zcash Wallet app.

> **Note:** This MCP server is currently only implemented for macOS. It uses AppleScript and macOS-specific APIs for window management and automation.

## Features

- **screenshot** - Capture screenshots of the Ikki app window or full screen
- **click** - Click at coordinates within the app window
- **type** - Type text or press special keys in the app
- **get_window_info** - Get window position, size, and state

## Requirements

- macOS
- [Bun](https://bun.sh/) runtime
- Ikki app running (`bun run tauri dev` from the project root)

## macOS Security & Privacy Settings

This MCP server requires specific permissions to control the app and capture screenshots. You'll need to grant these permissions in **System Settings > Privacy & Security**:

### Accessibility

Required for: clicking, typing, and window management.

1. Go to **System Settings > Privacy & Security > Accessibility**
2. Click the **+** button
3. Add your terminal app (e.g., Terminal, iTerm2, Warp) or the app running the MCP server
4. Toggle the permission on

### Screen Recording

Required for: taking screenshots.

1. Go to **System Settings > Privacy & Security > Screen Recording**
2. Click the **+** button
3. Add your terminal app or the app running the MCP server
4. Toggle the permission on
5. You may need to restart the terminal app for changes to take effect

### Automation (optional)

If you see prompts about controlling other apps:

1. Go to **System Settings > Privacy & Security > Automation**
2. Allow your terminal app to control "System Events" and the target app

## Installation

```bash
cd tools/ikki-mcp
bun install
```

## Usage

### With Claude Code

Add to your `.mcp.json`:

```json
{
  "mcpServers": {
    "ikki-automation": {
      "command": "bun",
      "args": ["run", "start"],
      "cwd": "/path/to/ikki/tools/ikki-mcp"
    }
  }
}
```

### Standalone

```bash
bun run start
```

## Tools

### screenshot

Capture a screenshot of the Ikki app window.

Parameters:
- `fullScreen` (boolean, optional) - Capture full screen instead of just the app window
- `format` (string, optional) - Image format: "png" or "jpg" (default: "png")
- `includeCursor` (boolean, optional) - Include mouse cursor in screenshot

### click

Click at coordinates within the Ikki app window.

Parameters:
- `x` (number, required) - X coordinate relative to app window
- `y` (number, required) - Y coordinate relative to app window
- `clickType` (string, optional) - Type of click: "single", "double", or "right" (default: "single")
- `delay` (number, optional) - Delay in milliseconds before clicking

### type

Type text or press special keys in the Ikki app.

Parameters:
- `text` (string, optional) - Text to type
- `specialKey` (string, optional) - Special key to press: "return", "tab", "escape", "delete", "backspace", "up", "down", "left", "right"
- `modifiers` (array, optional) - Modifier keys: "command", "option", "control", "shift"
- `keystrokeDelay` (number, optional) - Delay between keystrokes in milliseconds

### get_window_info

Get information about the Ikki app window.

Returns:
- `appName` - Name of the app
- `appRunning` - Whether the app is running
- `position` - Window position (x, y)
- `size` - Window size (width, height)
- `isFullscreen` - Whether the window is fullscreen
- `isFrontmost` - Whether the app is frontmost

## Development

```bash
bun run dev  # Watch mode with auto-reload
```
