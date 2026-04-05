import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import path from "path";
import os from "os";
import runtimeErrorOverlay from "@replit/vite-plugin-runtime-error-modal";

const rawPort = process.env.PORT ?? "5173";
const port = Number(rawPort);

function getLanIp(): string {
  for (const addrs of Object.values(os.networkInterfaces())) {
    for (const a of addrs ?? []) {
      if (a.family === "IPv4" && !a.internal) return a.address;
    }
  }
  return "localhost";
}

if (Number.isNaN(port) || port <= 0) {
  throw new Error(`Invalid PORT value: "${rawPort}"`);
}

const basePath = process.env.BASE_PATH ?? "/";

const isReplit = process.env.REPL_ID !== undefined;

const LOCAL_API_PORT = process.env.VITE_API_PORT?.trim() || "3001";
/** Prefer 127.0.0.1 over localhost to avoid IPv6 (::1) vs IPv4 listen mismatches on Windows. */
const apiProxyTarget =
  process.env.VITE_API_PROXY_TARGET?.trim() || `http://127.0.0.1:${LOCAL_API_PORT}`;

const apiDevProxy: Record<string, import("vite").ProxyOptions> = {
  "/api": { target: apiProxyTarget, changeOrigin: true },
  "/socket.io": { target: apiProxyTarget, changeOrigin: true, ws: true },
};

/** Proxy /api to the Node server. Set VITE_DISABLE_API_PROXY=true only if another layer handles API (e.g. Replit). */
const useApiDevProxy = process.env.VITE_DISABLE_API_PROXY !== "true";

export default defineConfig({
  base: basePath,
  define: {
    "import.meta.env.VITE_LAN_IP": JSON.stringify(getLanIp()),
  },
  plugins: [
    react(),
    tailwindcss(),
    runtimeErrorOverlay(),
    ...(process.env.NODE_ENV !== "production" && isReplit
      ? [
          await import("@replit/vite-plugin-cartographer").then((m) =>
            m.cartographer({
              root: path.resolve(import.meta.dirname, ".."),
            }),
          ),
          await import("@replit/vite-plugin-dev-banner").then((m) =>
            m.devBanner(),
          ),
        ]
      : []),
  ],
  resolve: {
    alias: {
      "@": path.resolve(import.meta.dirname, "src"),
      "@assets": path.resolve(import.meta.dirname, "..", "..", "attached_assets"),
    },
    dedupe: ["react", "react-dom"],
  },
  root: path.resolve(import.meta.dirname),
  build: {
    outDir: path.resolve(import.meta.dirname, "dist/public"),
    emptyOutDir: true,
  },
  server: {
    port,
    host: "0.0.0.0",
    allowedHosts: true,
    fs: {
      strict: true,
      deny: ["**/.*"],
    },
    proxy: useApiDevProxy ? apiDevProxy : undefined,
  },
  preview: {
    port,
    host: "0.0.0.0",
    allowedHosts: true,
    // `vite preview` does not inherit `server.proxy` — without this, /api/* returns 404.
    proxy: useApiDevProxy ? { ...apiDevProxy } : undefined,
  },
});
