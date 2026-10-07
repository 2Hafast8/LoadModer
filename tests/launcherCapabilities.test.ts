import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import path from "node:path";
import os from "node:os";
import { mkdtemp, rm, mkdir, writeFile } from "node:fs/promises";
import { getLauncherCapabilities } from "../src/core/instance/capabilities.js";
import { InstanceDetector } from "../src/core/instance/detector.js";

describe("Launcher Capabilities & Indicator Verification", () => {
  let tmpDir: string;

  beforeEach(async () => {
    tmpDir = await mkdtemp(path.join(os.tmpdir(), "lm-caps-test-"));
  });

  afterEach(async () => {
    vi.unstubAllEnvs();
    await rm(tmpDir, { recursive: true, force: true });
  });

  describe("getLauncherCapabilities() matrix verification", () => {
    it("harus memberikan kapabilitas penuh untuk TLauncher", () => {
      const caps = getLauncherCapabilities("TLauncher");
      expect(caps.launcher).toBe("TLauncher");
      expect(caps.supportsModpack).toBe(true);
      expect(caps.supportsContainers).toBe(true);
      expect(caps.supportsModeSwitch).toBe(true);
      expect(caps.modpackStrategy).toBe("tlauncher");
      expect(caps.notes).toBeDefined();
    });

    it("harus menonaktifkan modpack dan wadah untuk Official Minecraft (Vanilla)", () => {
      const caps = getLauncherCapabilities("Official Minecraft (Default)");
      expect(caps.launcher).toBe("Official Minecraft");
      expect(caps.supportsModpack).toBe(false);
      expect(caps.supportsContainers).toBe(false);
      expect(caps.supportsModeSwitch).toBe(false);
      expect(caps.modpackStrategy).toBe("none");
      expect(caps.incompatibilityReason).toBeDefined();

      const vanillaCaps = getLauncherCapabilities("Vanilla");
      expect(vanillaCaps.supportsModpack).toBe(false);
      expect(vanillaCaps.supportsContainers).toBe(false);
    });

    it("harus mengisolasi kapabilitas Prism Launcher per instance tanpa wadah TLauncher", () => {
      const caps = getLauncherCapabilities("Prism");
      expect(caps.launcher).toBe("Prism");
      expect(caps.supportsModpack).toBe(false);
      expect(caps.supportsContainers).toBe(false);
      expect(caps.supportsModeSwitch).toBe(false);
      expect(caps.modpackStrategy).toBe("instance");
    });

    it("harus mengisolasi kapabilitas MultiMC per instance tanpa wadah TLauncher", () => {
      const caps = getLauncherCapabilities("MultiMC");
      expect(caps.launcher).toBe("MultiMC");
      expect(caps.supportsModpack).toBe(false);
      expect(caps.supportsContainers).toBe(false);
      expect(caps.supportsModeSwitch).toBe(false);
      expect(caps.modpackStrategy).toBe("instance");
    });

    it("harus menetapkan kapabilitas SKLauncher sebagai folder standar", () => {
      const caps = getLauncherCapabilities("SKLauncher");
      expect(caps.launcher).toBe("SKLauncher");
      expect(caps.supportsModpack).toBe(false);
      expect(caps.supportsContainers).toBe(false);
      expect(caps.supportsModeSwitch).toBe(false);
      expect(caps.modpackStrategy).toBe("none");
    });

    it("harus menetapkan kapabilitas Legacy Launcher", () => {
      const caps = getLauncherCapabilities("Legacy");
      expect(caps.launcher).toBe("Legacy");
      expect(caps.supportsModpack).toBe(true);
      expect(caps.supportsContainers).toBe(true);
      expect(caps.supportsModeSwitch).toBe(true);
      expect(caps.modpackStrategy).toBe("legacy");
    });

    it("harus mengembalikan default aman untuk instance kustom / tidak dikenal", () => {
      const caps = getLauncherCapabilities("UnknownLauncher");
      expect(caps.supportsModpack).toBe(false);
      expect(caps.supportsContainers).toBe(false);
      expect(caps.supportsModeSwitch).toBe(false);
      expect(caps.modpackStrategy).toBe("none");
    });
  });

  describe("Deteksi Indikator Terverifikasi (struktur-folder-launcaher-minecraft.md)", () => {
    it("harus mendeteksi TLauncher jika tlauncher-2.0.properties ada di .minecraft", async () => {
      const mcDir = path.join(tmpDir, ".minecraft");
      await mkdir(mcDir, { recursive: true });
      await writeFile(path.join(mcDir, "tlauncher-2.0.properties"), "version=2.89");

      vi.stubEnv("APPDATA", tmpDir);
      const detector = new InstanceDetector();
      const instance = await (detector as any).scanVanilla();

      expect(instance).not.toBeNull();
      expect(instance?.launcher).toBe("TLauncher");
      expect(instance?.id).toBe("tlauncher-default");
    });

    it("harus mendeteksi TLauncher jika folder logs/tlauncher ada di .minecraft", async () => {
      const mcDir = path.join(tmpDir, ".minecraft");
      const tlLogs = path.join(mcDir, "logs", "tlauncher");
      await mkdir(tlLogs, { recursive: true });

      vi.stubEnv("APPDATA", tmpDir);
      const detector = new InstanceDetector();
      const instance = await (detector as any).scanVanilla();

      expect(instance).not.toBeNull();
      expect(instance?.launcher).toBe("TLauncher");
      expect(instance?.id).toBe("tlauncher-default");
    });

    it("harus mendeteksi Official Minecraft (Vanilla) jika tidak ada satupun indikator TLauncher/SKLauncher", async () => {
      const mcDir = path.join(tmpDir, ".minecraft");
      await mkdir(mcDir, { recursive: true });
      await writeFile(
        path.join(mcDir, "launcher_profiles.json"),
        JSON.stringify({ profiles: {} }),
      );

      vi.stubEnv("APPDATA", tmpDir);
      const detector = new InstanceDetector();
      const instance = await (detector as any).scanVanilla();

      expect(instance).not.toBeNull();
      expect(instance?.launcher).toBe("Vanilla");
      expect(instance?.id).toBe("vanilla-default");
      expect(instance?.name).toContain("Official Minecraft");
    });
  });
});

