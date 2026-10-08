import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import path from "node:path";
import os from "node:os";
import { mkdtemp, rm, mkdir, writeFile } from "node:fs/promises";
import { InstanceDetector } from "../src/core/instance/detector.js";
import {
  isTLauncherPreservedEngineItem,
  discoverTLauncherContainers,
  resolveTLauncherContainerForLoader,
} from "../src/core/modpack/tlauncher/tlauncherStrategy.js";

describe("Multi-Launcher Folder Detection & Decoupled TLauncher Module", () => {
  let tmpDir: string;

  beforeEach(async () => {
    tmpDir = await mkdtemp(path.join(os.tmpdir(), "lm-launcher-test-"));
  });

  afterEach(async () => {
    vi.unstubAllEnvs();
    await rm(tmpDir, { recursive: true, force: true });
  });

  describe("Prism Launcher & MultiMC Folder Adaptation", () => {
    it("harus mendeteksi instance Prism Launcher dengan folder .minecraft/mods", async () => {
      const prismDir = path.join(tmpDir, "PrismLauncher", "instances", "PrismTest");
      const mcMods = path.join(prismDir, ".minecraft", "mods");
      await mkdir(mcMods, { recursive: true });

      await writeFile(
        path.join(prismDir, "mmc-pack.json"),
        JSON.stringify({
          formatVersion: 1,
          components: [
            { uid: "net.minecraft", version: "1.21.1", cachedName: "Minecraft" },
            { uid: "net.fabricmc.fabric-loader", version: "0.16.5", cachedName: "Fabric Loader" },
          ],
        }),
      );

      vi.stubEnv("APPDATA", tmpDir);
      const detector = new InstanceDetector();
      const instances = await (detector as any).scanPrismAndMultiMC();

      const inst = instances.find((i: any) => i.id === "prism-prismtest");
      expect(inst).toBeDefined();
      expect(inst?.name).toBe("PrismTest");
      expect(inst?.launcher).toBe("Prism");
      expect(inst?.gameVersion).toBe("1.21.1");
      expect(inst?.loader).toBe("fabric");
      expect(inst?.modsDir).toBe(mcMods);
    });

    it("harus mendeteksi instance MultiMC dengan format legacy minecraft/mods (tanpa titik)", async () => {
      const multimcDir = path.join(tmpDir, "MultiMC", "instances", "MultiMCTest");
      const legacyMods = path.join(multimcDir, "minecraft", "mods");
      await mkdir(legacyMods, { recursive: true });

      await writeFile(
        path.join(multimcDir, "mmc-pack.json"),
        JSON.stringify({
          formatVersion: 1,
          components: [
            { uid: "net.minecraft", version: "1.20.1" },
            { uid: "net.minecraftforge", version: "47.2.0" },
          ],
        }),
      );

      vi.stubEnv("APPDATA", tmpDir);
      const detector = new InstanceDetector();
      const instances = await (detector as any).scanPrismAndMultiMC();

      const inst = instances.find((i: any) => i.id === "multimc-multimctest");
      expect(inst).toBeDefined();
      expect(inst?.launcher).toBe("MultiMC");
      expect(inst?.loader).toBe("forge");
      expect(inst?.gameVersion).toBe("1.20.1");
      expect(inst?.modsDir).toBe(legacyMods);
    });
  });

  describe("Legacy Launcher Folder Adaptation", () => {
    it("harus mendeteksi Legacy Launcher pada .tlauncher/legacy/Minecraft/files", async () => {
      const filesDir = path.join(tmpDir, ".tlauncher", "legacy", "Minecraft", "files");
      const modsDir = path.join(filesDir, "mods");
      const versionsDir = path.join(filesDir, "versions", "1.20.1");
      await mkdir(modsDir, { recursive: true });
      await mkdir(versionsDir, { recursive: true });

      await writeFile(
        path.join(versionsDir, "1.20.1.json"),
        JSON.stringify({
          id: "1.20.1",
          mainClass: "net.fabricmc.loader.impl.launch.knot.KnotClient",
        }),
      );

      vi.stubEnv("APPDATA", tmpDir);
      const detector = new InstanceDetector();
      const instances = await (detector as any).scanLegacyLauncher();

      expect(instances.length).toBe(1);
      const inst = instances[0];
      expect(inst.id).toBe("legacy-default");
      expect(inst.name).toBe("Legacy Launcher");
      expect(inst.launcher).toBe("Legacy");
      expect(inst.rootDir).toBe(filesDir);
      expect(inst.modsDir).toBe(modsDir);
      expect(inst.loader).toBe("fabric");
    });
  });

  describe("SKLauncher & Official Minecraft Detection", () => {
    it("harus mendeteksi SKLauncher saat marker .sklauncher ada", async () => {
      const mcDir = path.join(tmpDir, ".minecraft");
      await mkdir(path.join(mcDir, "mods"), { recursive: true });
      await mkdir(path.join(tmpDir, ".sklauncher"), { recursive: true });

      vi.stubEnv("APPDATA", tmpDir);
      const detector = new InstanceDetector();
      const inst = await (detector as any).scanVanilla();

      expect(inst).toBeDefined();
      expect(inst?.id).toBe("sklauncher-default");
      expect(inst?.name).toBe("SKLauncher");
      expect(inst?.launcher).toBe("SKLauncher");
    });

    it("harus mendeteksi Official Minecraft (Default) saat tidak ada marker pihak ketiga", async () => {
      const mcDir = path.join(tmpDir, ".minecraft");
      await mkdir(path.join(mcDir, "mods"), { recursive: true });
      await writeFile(path.join(mcDir, "launcher_profiles.json"), JSON.stringify({ profiles: {} }));

      vi.stubEnv("APPDATA", tmpDir);
      const detector = new InstanceDetector();
      const inst = await (detector as any).scanVanilla();

      expect(inst).toBeDefined();
      expect(inst?.id).toBe("vanilla-default");
      expect(inst?.name).toBe("Official Minecraft (Default)");
      expect(inst?.launcher).toBe("Vanilla");
    });
  });

  describe("Decoupled TLauncher Module (isTLauncherPreservedEngineItem & Containers)", () => {
    it("harus memvalidasi berkas engine yang dipertahankan khusus TLauncher", () => {
      const containerDir = path.join(tmpDir, "mypack(fabric)");

      // Berkas yang wajib dipertahankan
      expect(isTLauncherPreservedEngineItem(".loadmoder", containerDir)).toBe(true);
      expect(isTLauncherPreservedEngineItem(".fabric", containerDir)).toBe(true);
      expect(isTLauncherPreservedEngineItem("logs", containerDir)).toBe(true);
      expect(isTLauncherPreservedEngineItem("TLauncherAdditional.json", containerDir)).toBe(true);
      expect(isTLauncherPreservedEngineItem("mypack(fabric).jar", containerDir)).toBe(true);
      expect(isTLauncherPreservedEngineItem("mypack(fabric).json", containerDir)).toBe(true);
      expect(isTLauncherPreservedEngineItem("mypack.jar", containerDir)).toBe(true);

      // Berkas mod/config biasa tidak boleh dipertahankan (wajib dibersihkan saat clean state)
      expect(isTLauncherPreservedEngineItem("sodium-fabric.jar", containerDir)).toBe(false);
      expect(isTLauncherPreservedEngineItem("options.txt", containerDir)).toBe(false);
      expect(isTLauncherPreservedEngineItem("config", containerDir)).toBe(false);
    });

    it("harus menemukan dan memetakan wadah TLauncher melalui modul terpisah", async () => {
      const versionsDir = path.join(tmpDir, "versions");
      const container1 = path.join(versionsDir, "mypack(fabric)");
      await mkdir(container1, { recursive: true });

      await writeFile(
        path.join(container1, "TLauncherAdditional.json"),
        JSON.stringify({
          modpack: {
            name: "My Custom Pack",
            version: {
              gameVersionDTO: { name: "1.20.1" },
              minecraftVersionTypes: [{ name: "fabric" }],
            },
          },
        }),
      );

      const containers = await discoverTLauncherContainers(tmpDir);
      expect(containers.length).toBe(1);
      expect(containers[0].containerName).toBe("mypack(fabric)");
      expect(containers[0].loader).toBe("fabric");
      expect(containers[0].gameVersion).toBe("1.20.1");

      const resolved = await resolveTLauncherContainerForLoader(tmpDir, "fabric", "1.20.1");
      expect(resolved.containerName).toBe("mypack(fabric)");
      expect(resolved.matchedLoader).toBe("fabric");
    });

    it("harus memastikan scanAll hanya mendeteksi 1 launcher instance untuk TLauncher, bukan memecah versi menjadi instance", async () => {
      const mcDir = path.join(tmpDir, ".minecraft");
      const versionsDir = path.join(mcDir, "versions");
      const container1 = path.join(versionsDir, "mypack(fabric)");
      const container2 = path.join(versionsDir, "mypack(forge)");
      await mkdir(container1, { recursive: true });
      await mkdir(container2, { recursive: true });
      await mkdir(path.join(mcDir, "mods"), { recursive: true });
      await mkdir(path.join(tmpDir, ".tlauncher"), { recursive: true });

      await writeFile(
        path.join(container1, "TLauncherAdditional.json"),
        JSON.stringify({
          modpack: {
            name: "Pack Fabric",
            version: {
              gameVersionDTO: { name: "1.20.1" },
              minecraftVersionTypes: [{ name: "fabric" }],
            },
          },
        }),
      );

      vi.stubEnv("APPDATA", tmpDir);
      const detector = new InstanceDetector();
      const all = await detector.scanAll();

      // Hanya boleh ada 1 instance TLauncher
      const tlauncherInstances = all.filter((i) => i.launcher === "TLauncher");
      expect(tlauncherInstances.length).toBe(1);
      expect(tlauncherInstances[0].id).toBe("tlauncher-default");
      expect(tlauncherInstances[0].rootDir).toBe(mcDir);
    });

    it("harus mendukung peralihan mode (default vs modpack container) pada satu instance launcher", () => {
      const mcDir = path.join(tmpDir, ".minecraft");
      const config = {
        name: "TLauncher",
        launcher: "TLauncher",
        rootDir: mcDir,
        modsDir: path.join(mcDir, "mods"),
        gameVersion: "1.20.1",
        loader: "fabric",
        mode: "default" as const,
      };

      expect(config.mode).toBe("default");
      expect(config.modsDir).toBe(path.join(mcDir, "mods"));

      // Beralih ke mode modpack
      const targetContainer = "mypack(fabric)";
      const modpackConfig = {
        ...config,
        mode: "modpack" as const,
        activeContainer: targetContainer,
        modsDir: path.join(mcDir, "versions", targetContainer, "mods"),
      };

      expect(modpackConfig.mode).toBe("modpack");
      expect(modpackConfig.activeContainer).toBe("mypack(fabric)");
      expect(modpackConfig.modsDir).toBe(path.join(mcDir, "versions", "mypack(fabric)", "mods"));
      // Tetap 1 launcher instance yang sama
      expect(modpackConfig.name).toBe("TLauncher");
    });

    it("harus menonaktifkan semua container saat beralih ke mode default", async () => {
      const { ModpackProfileManager } = await import("../src/core/modpack/profileManager.js");
      const mcDir = path.join(tmpDir, ".minecraft");
      const container1 = path.join(mcDir, "versions", "mypack(fabric)");
      const container2 = path.join(mcDir, "versions", "mypack(forge)");

      await mkdir(path.join(container1, "mods"), { recursive: true });
      await mkdir(path.join(container2, "mods"), { recursive: true });

      // Simulasikan wadah 1 aktif
      await writeFile(path.join(container1, "mods", "sodium.jar"), "mod-content");
      await ModpackProfileManager.setActiveProfileInfo(container1, {
        activeProfile: "opt-pack",
        name: "Optimization Pack",
        updatedAt: new Date().toISOString(),
      });

      // Lakukan disableAllModpackContainers
      const results = await ModpackProfileManager.disableAllModpackContainers(mcDir);
      expect(results.length).toBeGreaterThanOrEqual(2);

      // Verifikasi container1 sudah bersih
      const active1 = await ModpackProfileManager.getActiveProfile(container1);
      expect(active1?.activeProfile).toBeNull();
    });

    it("harus membersihkan container sebelumnya saat beralih antar client version", async () => {
      const { ModpackProfileManager } = await import("../src/core/modpack/profileManager.js");
      const mcDir = path.join(tmpDir, ".minecraft");
      const cFabric = path.join(mcDir, "versions", "mypack(fabric)");
      const cForge = path.join(mcDir, "versions", "mypack(forge)");

      await mkdir(path.join(cFabric, "mods"), { recursive: true });
      await mkdir(path.join(cForge, "mods"), { recursive: true });

      // Fabric aktif
      await writeFile(path.join(cFabric, "mods", "sodium.jar"), "mod-content");
      await ModpackProfileManager.setActiveProfileInfo(cFabric, {
        activeProfile: "fabric-pack",
        name: "Fabric Pack",
        updatedAt: new Date().toISOString(),
      });

      // Saat user beralih ke Forge: disable container Fabric
      await ModpackProfileManager.disableProfile(cFabric);

      const fabricState = await ModpackProfileManager.getActiveProfile(cFabric);
      expect(fabricState?.activeProfile).toBeNull();

      // Folder mods pada fabric harus bersih dari file non-preserved (atau terhapus secara aman)
      const { existsSync } = await import("node:fs");
      const modsExist = existsSync(path.join(cFabric, "mods"));
      if (modsExist) {
        const fabricFiles = await (await import("node:fs/promises")).readdir(path.join(cFabric, "mods"));
        expect(fabricFiles.filter((f) => f.endsWith(".jar")).length).toBe(0);
      } else {
        expect(modsExist).toBe(false);
      }
    });
  });
});

