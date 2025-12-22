import { defineConfig } from "vite";
import { svelte } from "@sveltejs/vite-plugin-svelte";

// https://vite.dev/config/
export default defineConfig({
  plugins: [svelte()],
  clearScreen: false,
  server: {
    port: 5173,
    strictPort: true,
    // Use TAURI_DEV_HOST for mobile development
    // This allows the dev server to be accessible from iOS/Android devices
    host: process.env.TAURI_DEV_HOST || "localhost",
    watch: {
      ignored: ["**/src-tauri/**"],
    },
  },
});
