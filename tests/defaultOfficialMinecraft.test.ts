import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import path from "node:path";
import os from "node:os";
import { mkdtemp, rm, mkdir, writeFile } from "node:fs/promises";
import { InstanceDetector } from "../src/core/instance/detector.js";
import { getLauncherCapabilities } from "../src/core/instance/capabilities.js";
import { renderCommandCenterHeader } from "../src/ui/theme.js";

describe("Official Minecraft (Default Launcher) & Pure Vanilla Navigation", () => {
  let tmpDir: string;

  beforeEach(async () => {
    tmpDir = await mkdtemp(path.join(os.tmpdir(), "lm-official-mc-test-"));
  });

  afterEach(async () => {
    vi.unstubAllEnvs();
    await rm(tmpDir, { recursive: true, force: true });
  });

  describe("Prioritas Deteksi Official Minecraft", () => {
    it("getDefaultVanillaInstance() harus menghasilkan instance Official Minecraft resmi", async () => {
      vi.stubEnv("APPDATA", tmpDir);
      const detector = new InstanceDetector();
      const inst = await detector.getDefaultVanillaInstance();

      expect(inst.id).toBe("vanilla-default");
      expect(inst.name).toBe("Official Minecraft (Default)");
      expect(inst.launcher).toBe("Vanilla");
      expect(inst.rootDir).toBe(path.join(tmpDir, ".minecraft"));
      expect(inst.modsDir).toBe(path.join(tmpDir, ".minecraft", "mods"));
    });

    it("harus mendeteksi Official Minecraft (Default) meskipun folder .tlauncher ada di AppData", async () => {
      const mcDir = path.join(tmpDir, ".minecraft");
      await mkdir(mcDir, { recursive: true });
      // Simulasi folder .tlauncher dibuat oleh Legacy Launcher atau installer pihak ketiga
      await mkdir(path.join(tmpDir, ".tlauncher"), { recursive: true });

      vi.stubEnv("APPDATA", tmpDir);
      const detector = new InstanceDetector();
      const inst = await (detector as any).scanVanilla();

      expect(inst).not.toBeNull();
      expect(inst?.id).toBe("vanilla-default");
      expect(inst?.name).toBe("Official Minecraft (Default)");
      expect(inst?.launcher).toBe("Vanilla");
    });

    it("harus memprioritaskan Official Minecraft jika launcher_profiles.json ada di .minecraft dan tidak ada marker third-party", async () => {
      const mcDir = path.join(tmpDir, ".minecraft");
      await mkdir(mcDir, { recursive: true });
      await writeFile(
        path.join(mcDir, "launcher_profiles.json"),
        JSON.stringify({ profiles: { "1.21.1": { name: "1.21.1" } } }),
      );

      vi.stubEnv("APPDATA", tmpDir);
      const detector = new InstanceDetector();
      const inst = await (detector as any).scanVanilla();

      expect(inst).not.toBeNull();
      expect(inst?.id).toBe("vanilla-default");
      expect(inst?.name).toBe("Official Minecraft (Default)");
      expect(inst?.launcher).toBe("Vanilla");
    });

    it("harus mendeteksi TLauncher jika marker TLauncher (TLauncher.exe / TlauncherProfiles.json) ada di .minecraft", async () => {
      const mcDir = path.join(tmpDir, ".minecraft");
      await mkdir(mcDir, { recursive: true });
      // Simulasi folder .minecraft milik TLauncher yang juga memiliki launcher_profiles.json
      await writeFile(path.join(mcDir, "launcher_profiles.json"), "{}");
      await writeFile(path.join(mcDir, "TLauncher.exe"), "dummy-binary");
      await writeFile(path.join(mcDir, "TlauncherProfiles.json"), "{}");

      vi.stubEnv("APPDATA", tmpDir);
      const detector = new InstanceDetector();
      const inst = await (detector as any).scanVanilla();

      expect(inst).not.toBeNull();
      expect(inst?.id).toBe("tlauncher-default");
      expect(inst?.name).toBe("TLauncher");
      expect(inst?.launcher).toBe("TLauncher");
    });

    it("harus menempatkan Official Minecraft pada urutan teratas dalam scanAll()", async () => {
      const mcDir = path.join(tmpDir, ".minecraft");
      await mkdir(mcDir, { recursive: true });
      await writeFile(path.join(mcDir, "launcher_profiles.json"), "{}");

      // Tambahkan folder Legacy Launcher
      const legacyDir = path.join(tmpDir, ".tlauncher", "legacy", "Minecraft", "game");
      await mkdir(path.join(legacyDir, "mods"), { recursive: true });

      vi.stubEnv("APPDATA", tmpDir);
      const detector = new InstanceDetector();
      const all = await detector.scanAll();

      expect(all.length).toBeGreaterThanOrEqual(2);
      expect(all[0].id).toBe("vanilla-default");
      expect(all[0].name).toBe("Official Minecraft (Default)");
      expect(all[0].launcher).toBe("Vanilla");
    });
  });

  describe("Kapabilitas & Navigasi Murni Vanilla", () => {
    it("Official Minecraft harus memiliki kapabilitas murni tanpa dukungan modpack dan wadah", () => {
      const caps = getLauncherCapabilities("Vanilla");

      expect(caps.launcher).toBe("Official Minecraft");
      expect(caps.supportsModpack).toBe(false);
      expect(caps.supportsContainers).toBe(false);
      expect(caps.supportsModeSwitch).toBe(false);
      expect(caps.modpackStrategy).toBe("none");
      expect(caps.notes).toContain("mod individual (.jar)");
    });

    it("renderCommandCenterHeader tidak boleh mencetak label 'Mode : default' jika supportsModeSwitch bernilai false", () => {
      const consoleSpy = vi.spyOn(console, "log").mockImplementation(() => {});

      renderCommandCenterHeader({
        instanceName: "Official Minecraft (Default)",
        gameVersion: "1.21.1",
        loader: "fabric",
        supportsModeSwitch: false,
        modsCount: 5,
        activeCount: 5,
        storageUsage: "12 MB",
        statusText: "● Siap",
      });

      const output = consoleSpy.mock.calls.map((c) => c.join(" ")).join("\n");
      consoleSpy.mockRestore();

      expect(output).toContain("Official Minecraft (Default)");
      expect(output).toContain("fabric 1.21.1");
      expect(output).toContain("● Siap");
      // Label Mode tidak boleh muncul untuk Official Minecraft
      expect(output).not.toContain("Mode : default");
      expect(output).not.toContain("Mode: default");
    });

    it("renderCommandCenterHeader harus tetap mencetak mode jika launcher mendukung mode (misal: Legacy)", () => {
      const consoleSpy = vi.spyOn(console, "log").mockImplementation(() => {});

      renderCommandCenterHeader({
        instanceName: "Legacy Launcher (game)",
        gameVersion: "1.20.1",
        loader: "forge",
        mode: "modpack",
        activeContainer: "Forge-1.20",
        supportsModeSwitch: true,
        modsCount: 20,
        activeCount: 20,
        storageUsage: "45 MB",
        statusText: "● Modpack: Forge-1.20",
      });

      const output = consoleSpy.mock.calls.map((c) => c.join(" ")).join("\n");
      consoleSpy.mockRestore();

      expect(output).toContain("Legacy Launcher (game)");
      expect(output).toContain("modpack (Forge-1.20)");
      expect(output).toContain("Forge-1.20");
    });
  });
});

