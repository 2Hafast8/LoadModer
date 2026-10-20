import { describe, it, expect } from "vitest";
import { parseSemver, compareSemver, isNewerVersion } from "../src/core/updater/semver.js";

describe("Semver Updater Utils", () => {
  it("should correctly parse semantic version strings", () => {
    expect(parseSemver("2.7.0")).toEqual({ major: 2, minor: 7, patch: 0, prerelease: undefined });
    expect(parseSemver("v2.8.1")).toEqual({ major: 2, minor: 8, patch: 1, prerelease: undefined });
    expect(parseSemver("V3.0.0-beta.2")).toEqual({ major: 3, minor: 0, patch: 0, prerelease: "beta.2" });
    expect(parseSemver("invalid")).toBeNull();
  });

  it("should compare major, minor, and patch correctly", () => {
    expect(compareSemver("2.7.0", "2.7.0")).toBe(0);
    expect(compareSemver("2.7.0", "2.7.1")).toBeLessThan(0);
    expect(compareSemver("2.8.0", "2.7.9")).toBeGreaterThan(0);
    expect(compareSemver("3.0.0", "2.9.9")).toBeGreaterThan(0);
    expect(compareSemver("v2.7.0", "2.8.0")).toBeLessThan(0);
  });

  it("should correctly evaluate isNewerVersion", () => {
    expect(isNewerVersion("2.7.0", "2.8.0")).toBe(true);
    expect(isNewerVersion("2.7.0", "2.7.1")).toBe(true);
    expect(isNewerVersion("2.7.0", "v2.7.1")).toBe(true);
    expect(isNewerVersion("2.7.0", "2.7.0")).toBe(false);
    expect(isNewerVersion("2.7.1", "2.7.0")).toBe(false);
    expect(isNewerVersion("3.0.0", "2.9.9")).toBe(false);
  });

  it("should handle prerelease comparison", () => {
    expect(isNewerVersion("2.8.0-beta.1", "2.8.0")).toBe(true);
    expect(isNewerVersion("2.8.0", "2.8.0-beta.1")).toBe(false);
  });
});

