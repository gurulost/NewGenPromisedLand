import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path, { dirname } from "path";
import runtimeErrorOverlay from "@replit/vite-plugin-runtime-error-modal";
import { fileURLToPath } from "url";
import glsl from "vite-plugin-glsl";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

export default defineConfig({
  plugins: [
    react(),
    runtimeErrorOverlay(),
    glsl(), // Add GLSL shader support
  ],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "client", "src"),
      "@shared": path.resolve(__dirname, "shared"),
    },
  },
  root: path.resolve(__dirname, "client"),
  build: {
    outDir: path.resolve(__dirname, "dist/public"),
    emptyOutDir: true,
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (!id.includes("node_modules")) return;

          if (
            id.includes("three") ||
            id.includes("@react-three") ||
            id.includes("postprocessing")
          ) {
            return "vendor-3d";
          }

          if (
            id.includes("@radix-ui") ||
            id.includes("@headlessui") ||
            id.includes("framer-motion") ||
            id.includes("lucide-react")
          ) {
            return "vendor-ui";
          }

          if (
            id.includes("@tanstack") ||
            id.includes("zustand") ||
            id.includes("react-router") ||
            id.includes("wouter")
          ) {
            return "vendor-state";
          }

          if (id.includes("howler")) {
            return "vendor-audio";
          }

          return "vendor";
        },
      },
    },
  },
  // Add support for large models and audio files
  assetsInclude: ["**/*.gltf", "**/*.glb", "**/*.mp3", "**/*.ogg", "**/*.wav"],
});
