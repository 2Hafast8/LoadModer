import { describe, it, expect, beforeEach, afterEach, afterAll } from "vitest";
import {
  isMinecraftRunning,
  assertMinecraftNotRunning,
  setProcessCheckerForTest,
} from "../src/core/instance/processGuard.js";

describe("ProcessGuard - Minecraft Running Detection", () => {
  beforeEach(() => {
    setProcessCheckerForTest(null);
  });

  afterEach(() => {
    setProcessCheckerForTest(null);
  });

  afterAll(() => {
    setProcessCheckerForTest(null);
  });

  it("should return false when tasklist output contains no javaw on Windows", async () => {
    const mockExecutor = async () => 'INFO: No tasks are running which match the specified criteria.';
    const running = await isMinecraftRunning(mockExecutor, "win32");
    expect(running).toBe(false);
  });

  it("should return true when tasklist output contains javaw.exe on Windows", async () => {
    const mockExecutor = async () => '"javaw.exe","12345","Console","1","1,234,567 K"';
    const running = await isMinecraftRunning(mockExecutor, "win32");
    expect(running).toBe(true);
  });

  it("should return false on Unix when pgrep output matches test runner or node", async () => {
    const mockExecutor = async () => '12345 node /workspace/tests/defaultOfficialMinecraft.test.ts';
    const running = await isMinecraftRunning(mockExecutor, "linux");
    expect(running).toBe(false);
  });

  it("should return true on Unix when pgrep output contains actual Minecraft client", async () => {
    const mockExecutor = async () => '54321 /usr/bin/java -Xmx4G net.minecraft.client.main.Main';
    const running = await isMinecraftRunning(mockExecutor, "linux");
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

