import { fileURLToPath, URL } from "node:url";

import { defineConfig, loadEnv } from "vite";
import vue from "@vitejs/plugin-vue";
import vueDevTools from "vite-plugin-vue-devtools";
import tailwindcss from "@tailwindcss/vite";
import viteCompression from "vite-plugin-compression";
import { visualizer } from "rollup-plugin-visualizer";
import AutoImport from "unplugin-auto-import/vite";
import { NaiveUiResolver } from "unplugin-vue-components/resolvers";
import Components from "unplugin-vue-components/vite";

// https://vite.dev/config/
export default defineConfig(({ command, mode }) => {
  const isDevServer = command === "serve";
  const envDir = fileURLToPath(new URL(".", import.meta.url));
  const env = loadEnv(mode, envDir);

  const compressionThresholdBytesRaw = env.VITE_BUILD_COMPRESSION_THRESHOLD_BYTES;
  const compressionThresholdBytes = Number(compressionThresholdBytesRaw ?? "10240");
  if (!Number.isFinite(compressionThresholdBytes) || compressionThresholdBytes < 0) {
    throw new Error(`[vite] Invalid VITE_BUILD_COMPRESSION_THRESHOLD_BYTES: "${compressionThresholdBytesRaw}".`);
  }

  const apiProxyTarget = env.VITE_DEV_API_PROXY_TARGET || "http://localhost:3000";

  return {
    plugins: [
      vue(),
      ...(isDevServer ? [vueDevTools()] : []),
      tailwindcss(),
      AutoImport({
        imports: [
          "vue",
          {
            "naive-ui": ["useDialog", "useMessage", "useNotification", "useLoadingBar"]
          }
        ],
        dts: "src/auto-imports.d.ts",
        vueTemplate: true
      }),
      Components({
        resolvers: [NaiveUiResolver()],
        dts: "src/components.d.ts"
      }),
      visualizer({
        filename: "stats.json",
        template: "raw-data",
        gzipSize: true,
        brotliSize: false
      }),
      viteCompression({
        verbose: true,
        disable: false,
        threshold: compressionThresholdBytes,
        algorithm: "gzip",
        ext: ".gz"
      }),
      viteCompression({
        verbose: true,
        disable: false,
        threshold: compressionThresholdBytes,
        algorithm: "brotliCompress",
        ext: ".br"
      })
    ],
    resolve: {
      alias: {
        "@": fileURLToPath(new URL("./src", import.meta.url))
      }
    },
    esbuild: {
      drop: isDevServer ? [] : ["console", "debugger"]
    },
    build: {
      rollupOptions: {
        output: {
          entryFileNames: "assets/[name]-[hash].js",
          chunkFileNames: "assets/[name]-[hash].js",
          assetFileNames: "assets/[name]-[hash][extname]",
          manualChunks(id) {
            if (!id.includes("node_modules")) return;
            const normalizedId = id.replace(/\\/g, "/");

            if (normalizedId.includes("/leaflet/") || normalizedId.includes("/proj4/")) {
              return "vendor-map";
            }
            if (
              normalizedId.includes("/markstream-vue/") ||
              normalizedId.includes("/stream-markdown-parser/") ||
              normalizedId.includes("/katex/") ||
              normalizedId.includes("/mermaid/")
            ) {
              return "vendor-markdown";
            }
            if (
              normalizedId.includes("/naive-ui/") ||
              normalizedId.includes("/css-render/") ||
              normalizedId.includes("/@css-render/") ||
              normalizedId.includes("/vooks/") ||
              normalizedId.includes("/vueuc/") ||
              normalizedId.includes("/seemly/") ||
              normalizedId.includes("/@emotion/")
            ) {
              return "vendor-ui";
            }
            if (
              normalizedId.includes("/@vue/") ||
              normalizedId.includes("/vue-router/") ||
              normalizedId.includes("/vue/") ||
              normalizedId.includes("/pinia/")
            ) {
              return "vendor-vue";
            }
            if (
              normalizedId.includes("/uuid/") ||
              normalizedId.includes("/zod/") ||
              normalizedId.includes("/file-saver/")
            ) {
              return "vendor-utils";
            }
          }
        }
      }
    },
    server: {
      proxy: {
        "/api": {
          target: apiProxyTarget,
          changeOrigin: true
        }
      }
    },
    assetsInclude: ["**/*.tif"]
  };
});
