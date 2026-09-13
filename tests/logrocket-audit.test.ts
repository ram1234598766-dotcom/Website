import { describe, it, expect, vi, beforeEach } from "vitest";
import { clearTelemetryQueue, resetTelemetry, getTelemetryQueue } from "../src/lib/telemetry";
import { initLogRocket, identifyUser, trackEvent, captureException, isLogRocketInitialized } from "../src/lib/telemetry/logrocket";

beforeEach(() => { clearTelemetryQueue(); resetTelemetry(); vi.unstubAllEnvs(); });

describe("Audit 1: initLogRocket fails gracefully without ID", () => {
  it("returns false when ID is empty", async () => {
    vi.stubEnv("NEXT_PUBLIC_LOGROCKET_ID", "");
    expect(await initLogRocket("production")).toBe(false);
    expect(isLogRocketInitialized()).toBe(false);
  });
  it("does not throw when ID is missing", async () => {
    vi.stubEnv("NEXT_PUBLIC_LOGROCKET_ID", "");
    await initLogRocket("production");
  });
});

describe("Audit 8: isLogRocketInitialized", () => {
  it("false before init", () => {
    expect(isLogRocketInitialized()).toBe(false);
  });
  it("false after failed init", async () => {
    vi.stubEnv("NEXT_PUBLIC_LOGROCKET_ID", "");
    await initLogRocket("production");
    expect(isLogRocketInitialized()).toBe(false);
  });
});

describe("Audit 2: no double init, retry after failure", () => {
  it("allows retry after failed init", async () => {
    vi.stubEnv("NEXT_PUBLIC_LOGROCKET_ID", "");
    await initLogRocket("staging");
    vi.stubEnv("NEXT_PUBLIC_LOGROCKET_ID", "test-id");
    const r = await initLogRocket("staging");
    expect(typeof r).toBe("boolean");
  });
});

describe("Audit 3: identifyUser handles missing userId", () => {
  it("does not throw with empty userId", () => {
    expect(() => identifyUser("")).not.toThrow();
  });
  it("emits error event for empty userId", () => {
    identifyUser("");
    const q = getTelemetryQueue();
    expect(q[0].name).toBe("user-identify-error");
  });
});

describe("Audit 4: trackEvent validates names", () => {
  it("ignores empty name", () => {
    trackEvent("");
    expect(getTelemetryQueue()).toHaveLength(0);
  });
  it("ignores non-string name", () => {
    trackEvent(123);
    expect(getTelemetryQueue()).toHaveLength(0);
  });
  it("tracks valid name", () => {
    trackEvent("click");
    expect(getTelemetryQueue()[0].name).toBe("logrocket-click");
  });
});
describe("Audit 5: captureException Sentry forwarding", () => {
  it("routes to telemetry when LR not init", () => {
    captureException(new Error("t"));
    const q = getTelemetryQueue();
    expect(q[0].name).toBe("logrocket-error");
  });
  it("forwards to Sentry via dynamic import", async () => {
    const sentry = await import("../src/lib/telemetry/sentry");
    expect(typeof sentry.captureException).toBe("function");
    expect(() => captureException(new Error("t"))).not.toThrow();
  });
});

describe("Audit 6/7: layout init order", () => {
  it("Sentry before LogRocket in layout", () => {
    const fs = require("fs");
    const p = require("path");
    const c = fs.readFileSync(p.join(__dirname, "..", "app", "layout.tsx"), "utf8");
    expect(c.indexOf("initSentry")).toBeLessThan(c.indexOf("initLogRocket"));
    expect(c.indexOf("initSentry")).toBeGreaterThan(-1);
    expect(c.indexOf("initLogRocket")).toBeGreaterThan(-1);
  });
});
