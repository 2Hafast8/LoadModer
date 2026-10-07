import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import path from "node:path";
import os from "node:os";
import { mkdtemp, rm, mkdir, writeFile } from "node:fs/promises";
import {
  discoverLegacyContainers,
  resolveLegacyContainerForLoader,
  getLegacyActiveVersion,
  isLegacyPreservedItem,
} from "../src/core/modpack/legacy/legacyStrategy.js";
import { ModpackProfileManager } from "../src/core/modpack/profileManager.js";
import { InstanceDetector } from "../src/core/instance/detector.js";

describe("Legacy Launcher Dual-Path Strategy (versions engine & home containers)", () => {
  let tmpDir: string;
  let legacyRoot: string;
  let gameDir: string;
  let versionsDir: string;
  let homeDir: string;

  beforeEach(async () => {
    tmpDir = await mkdtemp(path.join(os.tmpdir(), "lm-legacy-strategy-"));
    legacyRoot = path.join(tmpDir, ".tlauncher", "legacy", "Minecraft");
    gameDir = path.join(legacyRoot, "game");
    versionsDir = path.join(gameDir, "versions");
    homeDir = path.join(gameDir, "home");

    await mkdir(versionsDir, { recursive: true });
    await mkdir(homeDir, { recursive: true });
  });

  afterEach(async () => {
    vi.unstubAllEnvs();
    await rm(tmpDir, { recursive: true, force: true });
  });

  describe("getLegacyActiveVersion()", () => {
    it("harus membaca login.version dari tl.properties", async () => {
      await writeFile(
        path.join(legacyRoot, "tl.properties"),
        "login.version=Fabric 26.2\nminecraft.gamedir.separate=family\n",
      );

      const activeVer = await getLegacyActiveVersion(gameDir);
      expect(activeVer).toBe("Fabric 26.2");
    });

    it("harus mengembalikan null jika tl.properties tidak ada", async () => {
      const activeVer = await getLegacyActiveVersion(gameDir);
      expect(activeVer).toBeNull();
    });
  });

  describe("discoverLegacyContainers()", () => {
    it("harus mendeteksi wadah profil di folder home/ dan membaca metadata engine dari versions/", async () => {
      // 1. Setup Engine di versions/
      const vFabricDir = path.join(versionsDir, "Fabric 26.2");
      await mkdir(vFabricDir, { recursive: true });
      await writeFile(
        path.join(vFabricDir, "Fabric 26.2.json"),
        JSON.stringify({
          id: "Fabric 26.2",
          inheritsFrom: "1.20.1",
          mainClass: "net.fabricmc.loader.impl.launch.knot.KnotClient",
        }),
      );

      // 2. Setup Wadah di home/
      const hFabricDir = path.join(homeDir, "Fabric-26.2");
      await mkdir(path.join(hFabricDir, "mods"), { recursive: true });
      await writeFile(path.join(hFabricDir, "options.txt"), "sound:1.0");

      // 3. Setup tl.properties
      await writeFile(
        path.join(legacyRoot, "tl.properties"),
        "login.version=Fabric 26.2\n",
      );

      const containers = await discoverLegacyContainers(gameDir);
      expect(containers.length).toBe(1);

      const c = containers[0];
      expect(c.containerName).toBe("Fabric-26.2");
      expect(c.containerDir).toBe(hFabricDir);
      expect(c.loader).toBe("fabric");
      expect(c.gameVersion).toBe("1.20.1");
      expect(c.activeProfileName).toBe("Legacy Active");
    });
  });

  describe("resolveLegacyContainerForLoader()", () => {
    it("harus memilih wadah home yang cocok dengan loader fabric", async () => {
      const hFabricDir = path.join(homeDir, "Fabric-26.2");
      await mkdir(path.join(hFabricDir, "mods"), { recursive: true });

      const resolved = await resolveLegacyContainerForLoader(gameDir, "fabric");
      expect(resolved).not.toBeNull();
      expect(resolved?.containerName).toBe("Fabric-26.2");
      expect(resolved?.containerDir).toBe(hFabricDir);
      expect(resolved?.matchedLoader).toBe("fabric");
    });

    it("harus membuat wadah baru di home/ jika loader belum ada", async () => {
      const resolved = await resolveLegacyContainerForLoader(gameDir, "forge", "1.20.1");
      expect(resolved).not.toBeNull();
      expect(resolved?.containerName).toBe("Forge-1.20.1");
      expect(resolved?.containerDir).toBe(path.join(homeDir, "Forge-1.20.1"));
      expect(resolved?.matchedLoader).toBe("forge");
    });
  });

  describe("isLegacyPreservedItem()", () => {
    it("harus mempertahankan berkas penting Legacy Launcher", () => {
      expect(isLegacyPreservedItem("servers.dat")).toBe(true);
      expect(isLegacyPreservedItem("servers.dat.bak")).toBe(true);
      expect(isLegacyPreservedItem("saves")).toBe(true);
      expect(isLegacyPreservedItem(".fabric")).toBe(true);
      expect(isLegacyPreservedItem(".loadmoder")).toBe(true);

      // options.txt dan mod jar bukan preserved engine item (dikelola dinamis via baseline & profil)
      expect(isLegacyPreservedItem("options.txt")).toBe(false);
      expect(isLegacyPreservedItem("sodium.jar")).toBe(false);
      expect(isLegacyPreservedItem("iris.jar")).toBe(false);
    });
  });

  describe("ModpackProfileManager Anti-Collision Routing", () => {
    it("harus merutekan penemuan wadah ke strategi Legacy saat launcher adalah Legacy", async () => {
      const hFabricDir = path.join(homeDir, "Fabric-26.2");
      await mkdir(path.join(hFabricDir, "mods"), { recursive: true });

      const containers = await ModpackProfileManager.discoverClientContainers(gameDir, "Legacy");
      expect(containers.length).toBe(1);
      expect(containers[0].containerName).toBe("Fabric-26.2");
    });

    it("harus merutekan penemuan wadah ke strategi TLauncher saat launcher adalah TLauncher", async () => {
      const tlauncherMc = path.join(tmpDir, ".minecraft");
      const mypack = path.join(tlauncherMc, "versions", "mypack(fabric)");
      await mkdir(path.join(mypack, "mods"), { recursive: true });

      const containers = await ModpackProfileManager.discoverClientContainers(tlauncherMc, "TLauncher");
      expect(containers.length).toBe(1);
      expect(containers[0].containerName).toBe("mypack(fabric)");
    });
  });

  describe("InstanceDetector.scanLegacyLauncher() dengan active home profile", () => {
    it("harus mengarahkan modsDir ke home/<profile>/mods saat tl.properties aktif", async () => {
      const hFabricDir = path.join(homeDir, "Fabric-26.2");
      const hModsDir = path.join(hFabricDir, "mods");
      await mkdir(hModsDir, { recursive: true });

      await writeFile(
        path.join(legacyRoot, "tl.properties"),
        "login.version=Fabric 26.2\n",
      );

      vi.stubEnv("APPDATA", tmpDir);
      const detector = new InstanceDetector();
      const instances = await (detector as any).scanLegacyLauncher();

      expect(instances.length).toBe(1);
      const inst = instances[0];
      expect(inst.launcher).toBe("Legacy");
      expect(inst.modsDir).toBe(hModsDir);
    });
  });
});

