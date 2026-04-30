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
    // Three.js is intentionally isolated as a large 3D engine chunk.
    chunkSizeWarningLimit: 700,
    rollupOptions: {
      output: {
        manualChunks(id) {
          const normalizedId = id.split(path.sep).join("/");
          if (!normalizedId.includes("/node_modules/")) return;

          if (
            normalizedId.includes("/node_modules/react/") ||
            normalizedId.includes("/node_modules/react-dom/") ||
            normalizedId.includes("/node_modules/scheduler/")
          ) {
            return "vendor-react";
          }

          if (normalizedId.includes("/node_modules/three/examples/jsm/")) {
            return "vendor-three-addons";
          }

          if (normalizedId.includes("/node_modules/three-stdlib/")) {
            return "vendor-three-stdlib";
          }

          if (normalizedId.includes("/node_modules/three/")) {
            return "vendor-three";
          }

          if (normalizedId.includes("/node_modules/@react-three/fiber/")) {
            return "vendor-r3f";
          }

          if (
            normalizedId.includes("/node_modules/@react-three/drei/") ||
            normalizedId.includes("/node_modules/maath/") ||
            normalizedId.includes("/node_modules/troika") ||
            normalizedId.includes("/node_modules/meshline/") ||
            normalizedId.includes("/node_modules/camera-controls/") ||
            normalizedId.includes("/node_modules/postprocessing/")
          ) {
            return "vendor-r3f-extras";
          }

          if (normalizedId.includes("/node_modules/@radix-ui/")) {
            return "vendor-radix";
          }

          if (normalizedId.includes("/node_modules/framer-motion/")) {
            return "vendor-motion";
          }

          if (normalizedId.includes("/node_modules/lucide-react/")) {
            return "vendor-icons";
          }

          if (normalizedId.includes("/node_modules/gsap/")) {
            return "vendor-gsap";
          }

          if (normalizedId.includes("/node_modules/react-icons/")) {
            return "vendor-react-icons";
          }

          if (
            normalizedId.includes("/node_modules/@use-gesture/") ||
            normalizedId.includes("/node_modules/react-use-gesture/")
          ) {
            return "vendor-gesture";
          }

          if (
            normalizedId.includes("/node_modules/@headlessui/") ||
            normalizedId.includes("/node_modules/sonner/") ||
            normalizedId.includes("/node_modules/next-themes/") ||
            normalizedId.includes("/node_modules/react-resizable-panels/") ||
            normalizedId.includes("/node_modules/class-variance-authority/") ||
            normalizedId.includes("/node_modules/clsx/") ||
            normalizedId.includes("/node_modules/tailwind-merge/") ||
            normalizedId.includes("/node_modules/tailwindcss-animate/")
          ) {
            return "vendor-ui-misc";
          }

          if (
            normalizedId.includes("/node_modules/react-hook-form/") ||
            normalizedId.includes("/node_modules/@hookform/")
          ) {
            return "vendor-forms";
          }

          if (normalizedId.includes("/node_modules/date-fns/")) {
            return "vendor-date";
          }

          if (
            normalizedId.includes("/node_modules/@tanstack/") ||
            normalizedId.includes("/node_modules/zustand/") ||
            normalizedId.includes("/node_modules/react-router/") ||
            normalizedId.includes("/node_modules/wouter/")
          ) {
            return "vendor-state";
          }

          if (normalizedId.includes("/node_modules/howler/")) {
            return "vendor-audio";
          }

          if (
            normalizedId.includes("/node_modules/@sentry/") ||
            normalizedId.includes("/node_modules/posthog-js/") ||
            normalizedId.includes("/node_modules/web-vitals/")
          ) {
            return "vendor-observability";
          }

          if (
            normalizedId.includes("/node_modules/zod/") ||
            normalizedId.includes("/node_modules/zod-validation-error/") ||
            normalizedId.includes("/node_modules/drizzle") ||
            normalizedId.includes("/node_modules/drizzle-zod/") ||
            normalizedId.includes("/node_modules/idb-keyval/") ||
            normalizedId.includes("/node_modules/lz-string/")
          ) {
            return "vendor-data";
          }

          return "vendor";
        },
      },
    },
  },
  // Add support for large models and audio files
  assetsInclude: ["**/*.gltf", "**/*.glb", "**/*.mp3", "**/*.ogg", "**/*.wav"],
});
