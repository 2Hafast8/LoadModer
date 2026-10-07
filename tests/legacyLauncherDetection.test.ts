import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import path from "node:path";
import os from "node:os";
import { mkdtemp, rm, mkdir, writeFile } from "node:fs/promises";
import { detectLauncherFromPath, InstanceDetector } from "../src/core/instance/detector.js";
import { resolveManualMinecraftPath } from "../src/core/instance/driveScanner.js";

describe("Legacy Launcher & Adaptive Path Detection", () => {
  let tmpDir: string;

  beforeEach(async () => {
    tmpDir = await mkdtemp(path.join(os.tmpdir(), "lm-legacy-test-"));
  });

  afterEach(async () => {
    vi.unstubAllEnvs();
    await rm(tmpDir, { recursive: true, force: true });
  });

  describe("detectLauncherFromPath() - Local Disk C (analisis setelah Roaming)", () => {
    it("harus mendeteksi Legacy Launcher pada path .tlauncher/legacy/Minecraft/game", () => {
      const p = "C:\\Users\\LENOVO\\AppData\\Roaming\\.tlauncher\\legacy\\Minecraft\\game";
      const res = detectLauncherFromPath(p);
      expect(res.launcher).toBe("Legacy");
      expect(res.name).toBe("Legacy Launcher (game)");
      expect(res.id).toBe("legacy-game");
    });

    it("harus mendeteksi Legacy Launcher pada path .tlauncher/legacy/Minecraft/files", () => {
      const p = "C:\\Users\\LENOVO\\AppData\\Roaming\\.tlauncher\\legacy\\Minecraft\\files";
      const res = detectLauncherFromPath(p);
      expect(res.launcher).toBe("Legacy");
      expect(res.name).toBe("Legacy Launcher (files)");
      expect(res.id).toBe("legacy-files");
    });

    it("harus mendeteksi Legacy Launcher pada path LegacyLauncher mandiri", () => {
      const p = "C:\\Users\\LENOVO\\AppData\\Roaming\\LegacyLauncher\\game";
      const res = detectLauncherFromPath(p);
      expect(res.launcher).toBe("Legacy");
    });

    it("harus mendeteksi TLauncher biasa jika di .tlauncher tanpa subdirektori legacy", () => {
      const p = "C:\\Users\\LENOVO\\AppData\\Roaming\\.tlauncher";
      const res = detectLauncherFromPath(p);
      expect(res.launcher).toBe("TLauncher");
    });

    it("harus mendeteksi SKLauncher jika di .sklauncher", () => {
      const p = "C:\\Users\\LENOVO\\AppData\\Roaming\\.sklauncher\\profiles\\vanilla";
      const res = detectLauncherFromPath(p);
      expect(res.launcher).toBe("SKLauncher");
    });

    it("harus mendeteksi Prism Launcher jika di PrismLauncher", () => {
      const p = "C:\\Users\\LENOVO\\AppData\\Roaming\\PrismLauncher\\instances\\TestPack";
      const res = detectLauncherFromPath(p);
      expect(res.launcher).toBe("Prism");
    });

    it("harus mendeteksi MultiMC jika di MultiMC", () => {
      const p = "C:\\Users\\LENOVO\\AppData\\Roaming\\MultiMC\\instances\\TestPack";
      const res = detectLauncherFromPath(p);
      expect(res.launcher).toBe("MultiMC");
    });

    it("harus mendeteksi Official Minecraft (Vanilla) jika di .minecraft standar", () => {
      const p = "C:\\Users\\LENOVO\\AppData\\Roaming\\.minecraft";
      const res = detectLauncherFromPath(p);
      expect(res.launcher).toBe("Vanilla");
      expect(res.name).toBe("Official Minecraft (Default)");
    });
  });

  describe("detectLauncherFromPath() - Non-Disk C (analisis dari path awal)", () => {
    it("harus mendeteksi Prism Launcher pada drive D:", () => {
      const p = "D:\\Games\\PrismLauncher\\instances\\MyPack";
      const res = detectLauncherFromPath(p);
      expect(res.launcher).toBe("Prism");
      expect(res.name).toBe("Prism (MyPack)");
    });

    it("harus mendeteksi MultiMC pada drive E:", () => {
      const p = "E:\\Portable\\MultiMC\\instances\\ForgePack";
      const res = detectLauncherFromPath(p);
      expect(res.launcher).toBe("MultiMC");
      expect(res.name).toBe("MultiMC (ForgePack)");
    });

    it("harus mendeteksi Legacy Launcher pada drive D:", () => {
      const p = "D:\\Games\\.tlauncher\\legacy\\Minecraft\\game";
      const res = detectLauncherFromPath(p);
      expect(res.launcher).toBe("Legacy");
      expect(res.name).toBe("Legacy Launcher (game)");
    });

    it("harus mendeteksi SKLauncher pada drive D:", () => {
      const p = "D:\\SKLauncher\\instances\\Fabric120";
      const res = detectLauncherFromPath(p);
      expect(res.launcher).toBe("SKLauncher");
    });

    it("harus mengembalikan Custom jika path tidak mencocokkan launcher mana pun", () => {
      const p = "D:\\Data\\RandomServer\\world";
      const res = detectLauncherFromPath(p);
      expect(res.launcher).toBe("Custom");
      expect(res.name).toBe("Custom (world)");
    });
  });

  describe("InstanceDetector.scanLegacyLauncher()", () => {
    it("harus otomatis mendeteksi Legacy Launcher di folder game", async () => {
      const legacyGameDir = path.join(tmpDir, ".tlauncher", "legacy", "Minecraft", "game");
      const versionsDir = path.join(legacyGameDir, "versions", "1.20.1-fabric");
      await mkdir(versionsDir, { recursive: true });
      await writeFile(
        path.join(versionsDir, "1.20.1-fabric.json"),
        JSON.stringify({
          mainClass: "net.fabricmc.loader.impl.launch.knot.KnotClient",
          inheritsFrom: "1.20.1",
        }),
      );
      await mkdir(path.join(legacyGameDir, "mods"), { recursive: true });

      vi.stubEnv("APPDATA", tmpDir);
      const detector = new InstanceDetector();
      const instances = await (detector as any).scanLegacyLauncher();

      expect(instances.length).toBe(1);
      const inst = instances[0];
      expect(inst.launcher).toBe("Legacy");
      expect(inst.name).toBe("Legacy Launcher");
      expect(inst.id).toBe("legacy-default");
      expect(inst.rootDir).toBe(legacyGameDir);
      expect(inst.gameVersion).toBe("1.20.1");
      expect(inst.loader).toBe("fabric");
    });

    it("harus otomatis mendeteksi Legacy Launcher di folder files jika folder files yang digunakan", async () => {
      const legacyFilesDir = path.join(tmpDir, ".tlauncher", "legacy", "Minecraft", "files");
      await mkdir(path.join(legacyFilesDir, "mods"), { recursive: true });

      vi.stubEnv("APPDATA", tmpDir);
      const detector = new InstanceDetector();
      const instances = await (detector as any).scanLegacyLauncher();

      expect(instances.length).toBe(1);
      const inst = instances[0];
      expect(inst.launcher).toBe("Legacy");
      expect(inst.name).toBe("Legacy Launcher");
      expect(inst.id).toBe("legacy-default");
    });
  });

  describe("Manual Path Resolution dengan resolveManualMinecraftPath", () => {
    it("harus memvalidasi path game Legacy Launcher dan mendeteksi metadata Legacy", async () => {
      const legacyGame = path.join(tmpDir, ".tlauncher", "legacy", "Minecraft", "game");
      await mkdir(path.join(legacyGame, "versions"), { recursive: true });
      await mkdir(path.join(legacyGame, "mods"), { recursive: true });

      const resolved = await resolveManualMinecraftPath(legacyGame);
      expect(resolved.ok).toBe(true);
      if (resolved.ok) {
        expect(resolved.rootDir).toBe(legacyGame);
        // Analisis dengan detectLauncherFromPath
        const meta = detectLauncherFromPath(resolved.rootDir);
        // Jika di folder sementara (bukan C:\Users\...\AppData\Roaming), fallback akan melihat keyword .tlauncher & legacy
        expect(meta.launcher).toBe("Legacy");
      }
    });
  });
});

