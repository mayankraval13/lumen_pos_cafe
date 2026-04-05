import { createRoot } from "react-dom/client";
import { setBaseUrl } from "@workspace/api-client-react";
import App from "./App";
import "./index.css";

/** When set, API calls go here instead of same-origin /api (bypasses Vite proxy). Use for LAN devices if proxy fails. */
const viteApiBase = import.meta.env.VITE_API_BASE as string | undefined;
if (viteApiBase?.trim()) {
  setBaseUrl(viteApiBase.trim().replace(/\/+$/, ""));
}

createRoot(document.getElementById("root")!).render(<App />);
