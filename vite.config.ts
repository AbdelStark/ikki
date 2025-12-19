import { defineConfig } from "vite";
import { svelte } from "@sveltejs/vite-plugin-svelte";
import { nodePolyfills } from "vite-plugin-node-polyfills";

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    svelte(),
    nodePolyfills({
      // Enable polyfills for crypto, buffer, stream (required by SwapKit SDK)
      include: ["crypto", "buffer", "stream", "util", "process"],
      globals: {
        Buffer: true,
        global: true,
        process: true,
      },
    }),
  ],
  clearScreen: false,
  server: {
    port: 5173,
    strictPort: true,
    watch: {
      ignored: ["**/src-tauri/**"],
    },
  },
  // Optimize SwapKit SDK dependencies
  optimizeDeps: {
    include: ["@swapkit/sdk"],
    esbuildOptions: {
      define: {
        global: "globalThis",
      },
    },
  },
  build: {
    commonjsOptions: {
      transformMixedEsModules: true,
    },
  },
});
