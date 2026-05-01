import { defineConfig, devices } from "@playwright/test";
import { config as loadEnv } from "dotenv";
import path from "node:path";

loadEnv({ path: path.resolve(__dirname, ".env.local") });

// Playwright forces color for its reporter/web server output. If the parent
// shell exports NO_COLOR, Node warns in every spawned process, so drop it here.
delete process.env.NO_COLOR;

/**
 * Playwright smoke suite. Runs headless Chromium against the local dev
 * server. Authentication is handled by a setup step that signs in once
 * and stores the auth state for re-use across the suite.
 *
 * Run:  pnpm test
 * Run one file:  pnpm exec playwright test tests/smoke.spec.ts
 * Show report:  pnpm exec playwright show-report
 */

const STORAGE_STATE = path.join(__dirname, "tests/.auth/user.json");
const PLAYWRIGHT_PORT = process.env.PLAYWRIGHT_PORT ?? "3000";
const BASE_URL =
  process.env.PLAYWRIGHT_BASE_URL ?? `http://localhost:${PLAYWRIGHT_PORT}`;
const shouldStartWebServer = !process.env.PLAYWRIGHT_BASE_URL;
const baseUrl = new URL(BASE_URL);
const devServerPort =
  baseUrl.port || (baseUrl.protocol === "https:" ? "443" : "80");

export default defineConfig({
  testDir: "./tests",
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: 0,
  workers: 1,
  reporter: [["html", { open: "never" }], ["list"]],
  use: {
    baseURL: BASE_URL,
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
    video: "retain-on-failure",
  },
  projects: [
    {
      name: "setup",
      testMatch: /auth\.setup\.ts/,
    },
    {
      name: "chromium",
      use: {
        ...devices["Desktop Chrome"],
        storageState: STORAGE_STATE,
      },
      dependencies: ["setup"],
      testIgnore: /auth\.setup\.ts/,
    },
  ],
  webServer: shouldStartWebServer
    ? {
        command: `pnpm exec next dev -p ${devServerPort}`,
        // This endpoint only exists in Yenkoh. It prevents Playwright from
        // silently reusing another Next.js app that happens to own port 3000.
        url: `${BASE_URL}/api/public-airports?q=manchester`,
        reuseExistingServer: !process.env.CI,
        timeout: 60_000,
        stdout: "ignore",
        stderr: "pipe",
      }
    : undefined,
});
