import { defineConfig } from "vite";
import type { Plugin, ResolvedConfig } from "vite";
import react from "@vitejs/plugin-react";
import path, { dirname } from "path";
import fs from "fs";
import runtimeErrorOverlay from "@replit/vite-plugin-runtime-error-modal";
import { fileURLToPath } from "url";
import glsl from "vite-plugin-glsl";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const disableRuntimeOverlay =
  process.env.DISABLE_VITE_RUNTIME_ERROR_OVERLAY === "true" ||
  process.env.NODE_ENV === "test";
const ORPHAN_MODELS_PUBLIC_PATH = "models/_orphans";

export function shouldCopyPublicAsset(publicDir: string, candidatePath: string): boolean {
  const relativePath = path.relative(publicDir, candidatePath).split(path.sep).join("/");
  return (
    relativePath === "" ||
    (
      relativePath !== ORPHAN_MODELS_PUBLIC_PATH &&
      !relativePath.startsWith(`${ORPHAN_MODELS_PUBLIC_PATH}/`)
    )
  );
}

function copyPublicDirWithoutOrphanModels(): Plugin {
  let publicDir = "";
  let outDir = "";

  return {
    name: "copy-public-dir-without-orphan-models",
    apply: "build" as const,
    configResolved(config: ResolvedConfig) {
      publicDir = config.publicDir;
      outDir = config.build.outDir;
    },
    closeBundle() {
      if (!publicDir || !outDir || !fs.existsSync(publicDir)) return;

      fs.cpSync(publicDir, outDir, {
        recursive: true,
        force: true,
        filter: (candidatePath) => shouldCopyPublicAsset(publicDir, candidatePath),
      });
    },
  };
}

export default defineConfig({
  plugins: [
    react(),
    ...(disableRuntimeOverlay ? [] : [runtimeErrorOverlay()]),
    glsl(), // Add GLSL shader support
    copyPublicDirWithoutOrphanModels(),
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
    // Production artifacts must be self-contained.
    copyPublicDir: false,
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
