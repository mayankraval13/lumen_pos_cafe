import { unlinkSync } from "node:fs";

for (const f of ["package-lock.json", "yarn.lock"]) {
  try {
    unlinkSync(new URL(`../${f}`, import.meta.url));
  } catch {
    /* absent */
  }
}

const ua = process.env.npm_config_user_agent ?? "";
if (!ua.includes("pnpm")) {
  console.error("Use pnpm instead");
  process.exit(1);
}
