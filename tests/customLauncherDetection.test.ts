import { describe, it, expect, beforeEach, afterEach } from "vitest";
import path from "node:path";
import { mkdtemp, rm, mkdir, writeFile } from "node:fs/promises";
import os from "node:os";
import { inspectFolderSignature, detectLauncherFromFolder } from "../src/core/instance/detector.js";
import { resolveManualMinecraftPath } from "../src/core/instance/driveScanner.js";
import { discoverTLauncherContainers } from "../src/core/modpack/tlauncher/tlauncherStrategy.js";
import { InstanceConfigManager } from "../src/core/instance/config.js";

describe("Custom Launcher Detection, Smart Paths & Profile Management Suite", () => {
  let tempDir: string;

  beforeEach(async () => {
    tempDir = await mkdtemp(path.join(os.tmpdir(), "lm-custom-detection-"));
  });

  afterEach(async () => {
    await rm(tempDir, { recursive: true, force: true });
  });

  it("harus mendeteksi custom folder sebagai TLauncher via file signature (tlauncher-2.0.properties)", async () => {
    const customMcDir = path.join(tempDir, "Games", "MyCustomMinecraft");
    await mkdir(customMcDir, { recursive: true });
    await writeFile(path.join(customMcDir, "tlauncher-2.0.properties"), "version=2.8");

    const sig = await inspectFolderSignature(customMcDir);
    expect(sig).toBe("TLauncher");

    const info = await detectLauncherFromFolder(customMcDir);
    expect(info.launcher).toBe("TLauncher");
    expect(info.name).toContain("TLauncher");
  });

  it("harus mendeteksi custom folder sebagai TLauncher jika versions/ berisi TLauncherAdditional.json", async () => {
    const customMcDir = path.join(tempDir, "CustomMC");
    const vDir = path.join(customMcDir, "versions", "CustomPack1");
    await mkdir(vDir, { recursive: true });
    await writeFile(
      path.join(vDir, "TLauncherAdditional.json"),
      JSON.stringify({ modpack: { name: "CustomPack1" } })
    );

    const sig = await inspectFolderSignature(customMcDir);
    expect(sig).toBe("TLauncher");

    const info = await detectLauncherFromFolder(customMcDir);
    expect(info.launcher).toBe("TLauncher");
  });

  it("harus mendeteksi wadah modpack TL-Mods di dalam versions/ meskipun format folder bebas asalkan ada folder mods/", async () => {
    const customMcDir = path.join(tempDir, "D_Games_Minecraft");
    const vDir = path.join(customMcDir, "versions", "RLCraft-TL");
    const modsDir = path.join(vDir, "mods");
    await mkdir(modsDir, { recursive: true });
    await writeFile(path.join(modsDir, "jei.jar"), "dummy-jar");
    await writeFile(
      path.join(vDir, "RLCraft-TL.json"),
      JSON.stringify({ inheritsFrom: "1.20.1", mainClass: "net.minecraftforge.client" })
    );

    const containers = await discoverTLauncherContainers(customMcDir);
    expect(containers.length).toBe(1);
    expect(containers[0].containerName).toBe("RLCraft-TL");
    expect(containers[0].isTLMods).toBe(true);
    expect(containers[0].loader).toBe("forge");
    expect(containers[0].gameVersion).toBe("1.20.1");
  });

  it("harus melakukan auto-resolve ke root parent jika user memilih folder versions atau versions/<pack>", async () => {
    const mcRoot = path.join(tempDir, "MyGames", "Minecraft");
    const vDir = path.join(mcRoot, "versions");
    const packDir = path.join(vDir, "MyPack");
    await mkdir(packDir, { recursive: true });
    await writeFile(path.join(mcRoot, "options.txt"), "fov:70");

    // 1. User memilih folder versions
    const resVersions = await resolveManualMinecraftPath(vDir);
    expect(resVersions.ok).toBe(true);
    if (resVersions.ok) {
      expect(resVersions.rootDir.toLowerCase()).toBe(path.resolve(mcRoot).toLowerCase());
      expect(resVersions.adjusted).toBe(true);
    }

    // 2. User memilih subfolder versions/MyPack
    const resPack = await resolveManualMinecraftPath(packDir);
    expect(resPack.ok).toBe(true);
    if (resPack.ok) {
      expect(resPack.rootDir.toLowerCase()).toBe(path.resolve(mcRoot).toLowerCase());
      expect(resPack.adjusted).toBe(true);
    }
  });

  it("harus mendukung penyimpanan dan pembaruan custom paths (modsDir, resourcepacksDir, shaderpacksDir, modpacksDir)", async () => {
    const cfgPath = path.join(tempDir, "config.json");
    const manager = new InstanceConfigManager(cfgPath);
    await manager.load();

    manager.saveInstance("custom-1", {
      name: "Custom One",
      launcher: "Custom",
      rootDir: "D:/MC",
      modsDir: "D:/MC/mods",
    });

    manager.updateCustomPaths("custom-1", {
      modsDir: "E:/FastSSD/mods",
      resourcepacksDir: "E:/FastSSD/resourcepacks",
      shaderpacksDir: "E:/FastSSD/shaderpacks",
      modpacksDir: "D:/MC/versions",
    });

    const active = manager.getActiveInstance();
    expect(active?.modsDir).toBe("E:/FastSSD/mods");
    expect(active?.resourcepacksDir).toBe("E:/FastSSD/resourcepacks");
    expect(active?.shaderpacksDir).toBe("E:/FastSSD/shaderpacks");
    expect(active?.modpacksDir).toBe("D:/MC/versions");

    await manager.save();

    // Reload from disk to verify atomic persistence
    const reloaded = new InstanceConfigManager(cfgPath);
    await reloaded.load();
    const inst = reloaded.get().instances["custom-1"];
    expect(inst.resourcepacksDir).toBe("E:/FastSSD/resourcepacks");
    expect(inst.shaderpacksDir).toBe("E:/FastSSD/shaderpacks");
  });

  it("harus mengizinkan penghapusan seluruh launcher tanpa terkecuali dan mencatatnya ke deletedInstances", async () => {
    const cfgPath = path.join(tempDir, "config.json");
    const manager = new InstanceConfigManager(cfgPath);
    await manager.load();

    manager.saveInstance("vanilla-default", {
      name: "Official Minecraft",
      launcher: "Vanilla",
      rootDir: "C:/Users/MC/.minecraft",
      modsDir: "C:/Users/MC/.minecraft/mods",
    });

    manager.saveInstance("tlauncher-custom", {
      name: "TLauncher D Drive",
      launcher: "TLauncher",
      rootDir: "D:/Games/Minecraft",
      modsDir: "D:/Games/Minecraft/mods",
    });

    expect(Object.keys(manager.get().instances).length).toBe(2);

    // Hapus tlauncher-custom
    manager.deleteInstance("tlauncher-custom");
    expect(Object.keys(manager.get().instances)).toEqual(["vanilla-default"]);
    expect(manager.get().activeInstance).toBe("vanilla-default");
    expect(manager.get().deletedInstances).toContain("tlauncher-custom");

    // Hapus vanilla-default (tanpa terkecuali)
    manager.deleteInstance("vanilla-default");
    expect(Object.keys(manager.get().instances).length).toBe(0);
    expect(manager.get().activeInstance).toBeUndefined();
    expect(manager.get().deletedInstances).toContain("vanilla-default");

    // Jika disimpan ulang, harus dihapus dari daftar deletedInstances
    manager.saveInstance("vanilla-default", {
      name: "Official Minecraft",
      launcher: "Vanilla",
      rootDir: "C:/Users/MC/.minecraft",
      modsDir: "C:/Users/MC/.minecraft/mods",
    });
    expect(manager.get().deletedInstances).not.toContain("vanilla-default");
    expect(manager.get().activeInstance).toBe("vanilla-default");
  });
});

