import { describe, it, expect, beforeEach } from "vitest";
import {
  isMinecraftRunning,
  assertMinecraftNotRunning,
  setProcessCheckerForTest,
} from "../src/core/instance/processGuard.js";

describe("ProcessGuard - Minecraft Running Detection", () => {
  beforeEach(() => {
    setProcessCheckerForTest(null);
  });

  it("should return false when tasklist output contains no javaw", async () => {
    const mockExecutor = async () => 'INFO: No tasks are running which match the specified criteria.';
    const running = await isMinecraftRunning(mockExecutor);
    expect(running).toBe(false);
  });

  it("should return true when tasklist output contains javaw.exe", async () => {
    const mockExecutor = async () => '"javaw.exe","12345","Console","1","1,234,567 K"';
    const running = await isMinecraftRunning(mockExecutor);
    expect(running).toBe(true);
  });

  it("should fail-safe to false when executor throws an unexpected error", async () => {
    const mockExecutor = async () => {
      throw new Error("Access denied");
    };
    const running = await isMinecraftRunning(mockExecutor);
    expect(running).toBe(false);
  });

  it("assertMinecraftNotRunning should throw descriptive error when running", async () => {
    setProcessCheckerForTest(async () => true);

    await expect(
      assertMinecraftNotRunning("mengganti profil modpack")
    ).rejects.toThrowError(/Minecraft sedang berjalan.*mengganti profil modpack/);
  });

  it("assertMinecraftNotRunning should not throw when not running", async () => {
    setProcessCheckerForTest(async () => false);

    await expect(
      assertMinecraftNotRunning("mengganti profil modpack")
    ).resolves.not.toThrow();
  });
});

