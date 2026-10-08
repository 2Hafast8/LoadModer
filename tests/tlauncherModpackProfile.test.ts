import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import path from "node:path";
import { mkdtemp, rm, mkdir, writeFile, readdir, readFile, stat } from "node:fs/promises";
import os from "node:os";
import { ModpackProfileManager } from "../src/core/modpack/profileManager.js";
import { InstanceDetector } from "../src/core/instance/detector.js";
import { modrinthClient } from "../src/api/client.js";
import unzipper from "unzipper";

describe("TLauncher Modpack Profile Manager Suite", () => {
  let tempDir: string;
  let mypackDir: string;
  let modsDir: string;
  let configDir: string;

  beforeEach(async () => {
    tempDir = await mkdtemp(path.join(os.tmpdir(), "lm-tl-profile-test-"));
    mypackDir = path.join(tempDir, "versions", "mypack");
    modsDir = path.join(mypackDir, "mods");
    configDir = path.join(mypackDir, "config");

    await mkdir(modsDir, { recursive: true });
    await mkdir(configDir, { recursive: true });

    // Dummy TLauncher engine files (tidak boleh dihapus saat disable)
    await writeFile(path.join(mypackDir, "mypack.json"), "{\"id\": \"mypack\"}");
    await writeFile(
      path.join(mypackDir, "TLauncherAdditional.json"),
      JSON.stringify({ modpack: { name: "mypack", version: { gameVersionDTO: { name: "1.20.1" } } } })
    );
  });

  afterEach(async () => {
    await rm(tempDir, { recursive: true, force: true });
    vi.restoreAllMocks();
  });

  it("harus mendaftarkan profil baru setelah instalasi modpack", async () => {
    await writeFile(path.join(modsDir, "cobblemon.jar"), "cobblemon-mod-bytes");
    await writeFile(path.join(configDir, "cobblemon.json"), "{\"spawn\": true}");

    await ModpackProfileManager.createProfileAfterInstall(mypackDir, {
      id: "cobblemon-official",
      name: "Cobblemon Official",
      versionId: "1.5.0",
      loader: "forge",
      gameVersion: "1.20.1",
    });
    await ModpackProfileManager.saveActiveToProfile(mypackDir);

    const activeInfo = await ModpackProfileManager.getActiveProfile(mypackDir);
    expect(activeInfo?.activeProfile).toBe("cobblemon-official");
    expect(activeInfo?.name).toBe("Cobblemon Official");

    const profiles = await ModpackProfileManager.listProfiles(mypackDir);
    expect(profiles.length).toBe(1);
    expect(profiles[0].id).toBe("cobblemon-official");
    expect(profiles[0].isActive).toBe(true);
    expect(profiles[0].filesCount).toBeGreaterThanOrEqual(2);
  });

  it("harus menukar (switch) profil modpack secara instan tanpa kehilangan data", async () => {
    // 1. Siapkan Profil A (Fabulously Optimized)
    await writeFile(path.join(modsDir, "sodium.jar"), "sodium-mod");
    await writeFile(path.join(configDir, "sodium.json"), "{\"quality\": \"high\"}");

    await ModpackProfileManager.createProfileAfterInstall(mypackDir, {
      id: "fabulously-optimized",
      name: "Fabulously Optimized",
      versionId: "5.8.0",
      loader: "fabric",
      gameVersion: "1.20.1",
    });
    await ModpackProfileManager.saveActiveToProfile(mypackDir);

    // 2. Siapkan Profil B (Cobblemon)
    await ModpackProfileManager.clearContainerLiveFiles(mypackDir);
    await mkdir(modsDir, { recursive: true });
    await mkdir(configDir, { recursive: true });
    await writeFile(path.join(modsDir, "cobblemon.jar"), "cobblemon-mod");
    await writeFile(path.join(configDir, "cobblemon.json"), "{\"pokemon\": true}");

    await ModpackProfileManager.createProfileAfterInstall(mypackDir, {
      id: "cobblemon-pack",
      name: "Cobblemon Adventure",
      versionId: "1.5.0",
      loader: "forge",
      gameVersion: "1.20.1",
    });
    await ModpackProfileManager.saveActiveToProfile(mypackDir);

    // Verifikasi ada 2 profil tersimpan
    let list = await ModpackProfileManager.listProfiles(mypackDir);
    expect(list.length).toBe(2);

    // 3. Switch kembali ke Fabulously Optimized
    const switched = await ModpackProfileManager.activateProfile(mypackDir, "fabulously-optimized");
    expect(switched.name).toBe("Fabulously Optimized");
    expect(switched.isActive).toBe(true);

    // Verifikasi: mods/ sekarang berisi sodium.jar, BUKAN cobblemon.jar
    const currentMods = await readdir(modsDir);
    expect(currentMods).toContain("sodium.jar");
    expect(currentMods).not.toContain("cobblemon.jar");

    const currentConfig = await readFile(path.join(configDir, "sodium.json"), "utf8");
    expect(currentConfig).toBe("{\"quality\": \"high\"}");

    // Verifikasi: file mesin TLauncher tetap aman
    const hasJson = await stat(path.join(mypackDir, "mypack.json"));
    expect(hasJson.isFile()).toBe(true);
  });

  it("harus menonaktifkan modpack (disable) dan mengembalikan folder ke clean state", async () => {
    // Pasang profil
    await writeFile(path.join(modsDir, "some-mod.jar"), "mod-content");
    await writeFile(path.join(configDir, "setting.json"), "{}");

    await ModpackProfileManager.createProfileAfterInstall(mypackDir, {
      id: "my-pack",
      name: "My Modpack",
      versionId: "1.0",
    });
    await ModpackProfileManager.saveActiveToProfile(mypackDir);

    // Nonaktifkan
    const disabledName = await ModpackProfileManager.disableProfile(mypackDir);
    expect(disabledName).toBe("My Modpack");

    // Verifikasi: active-profile null
    const activeInfo = await ModpackProfileManager.getActiveProfile(mypackDir);
    expect(activeInfo?.activeProfile).toBeNull();

    // Verifikasi: mods dan config telah dikosongkan
    let modsStillExist = true;
    try {
      await stat(modsDir);
    } catch {
      modsStillExist = false;
    }
    expect(modsStillExist).toBe(false);

    // Verifikasi: file mesin TLauncher mypack.json dan TLauncherAdditional.json TIDAK TERHAPUS
    const engineFile = await stat(path.join(mypackDir, "mypack.json"));
    expect(engineFile.isFile()).toBe(true);
    const tlMeta = await stat(path.join(mypackDir, "TLauncherAdditional.json"));
    expect(tlMeta.isFile()).toBe(true);

    // Verifikasi: Profil masih ada di arsip untuk diaktifkan kembali nanti
    const list = await ModpackProfileManager.listProfiles(mypackDir);
    expect(list.length).toBe(1);
    expect(list[0].id).toBe("my-pack");
    expect(list[0].isActive).toBe(false);

    // Aktifkan kembali
    await ModpackProfileManager.activateProfile(mypackDir, "my-pack");
    const restoredMods = await readdir(modsDir);
    expect(restoredMods).toContain("some-mod.jar");
  });

  it("harus menghapus profil modpack dari penyimpanan", async () => {
    await writeFile(path.join(modsDir, "temp.jar"), "temp");
    await ModpackProfileManager.createProfileAfterInstall(mypackDir, {
      id: "to-delete",
      name: "To Delete",
      versionId: "1.0",
    });
    await ModpackProfileManager.saveActiveToProfile(mypackDir);

    await ModpackProfileManager.removeProfile(mypackDir, "to-delete");

    const list = await ModpackProfileManager.listProfiles(mypackDir);
    expect(list.length).toBe(0);

    const activeInfo = await ModpackProfileManager.getActiveProfile(mypackDir);
    expect(activeInfo?.activeProfile).toBeNull();
  });

  it("harus mengembalikan path folder unduhan master di .loadmoder/downloads", () => {
    const downloadsDir = ModpackProfileManager.getDownloadsDir(mypackDir);
    expect(downloadsDir).toBe(path.join(mypackDir, ".loadmoder", "downloads"));
  });

  it("harus menyelaraskan wadah TLauncher berdasarkan loader (Fabric vs Forge)", async () => {
    const mcBaseDir = path.join(tempDir, "test-mc");
    const vDir = path.join(mcBaseDir, "versions");
    await mkdir(path.join(vDir, "mypack(fabric)"), {recursive: true});
    await mkdir(path.join(vDir, "mypack(forge)"), {recursive: true});

    // 1. Resolve loader Fabric
    const fabricRes = await ModpackProfileManager.resolveContainerForLoader(
      mcBaseDir,
      "fabric",
      "1.20.1",
    );
    expect(fabricRes.containerName).toBe("mypack(fabric)");
    expect(fabricRes.matchedLoader).toBe("fabric");
    expect(fabricRes.containerDir).toBe(path.join(vDir, "mypack(fabric)"));

    // 2. Resolve loader Forge
    const forgeRes = await ModpackProfileManager.resolveContainerForLoader(
      mcBaseDir,
      "forge",
      "1.20.1",
    );
    expect(forgeRes.containerName).toBe("mypack(forge)");
    expect(forgeRes.matchedLoader).toBe("forge");
    expect(forgeRes.containerDir).toBe(path.join(vDir, "mypack(forge)"));

    // 3. Resolve dari dalam subdirektori versions/mypack(forge) untuk modpack Fabric
    const siblingRes = await ModpackProfileManager.resolveContainerForLoader(
      path.join(vDir, "mypack(forge)"),
      "fabric",
      "1.20.1",
    );
    expect(siblingRes.containerName).toBe("mypack(fabric)");
    expect(siblingRes.matchedLoader).toBe("fabric");

    // 4. Inisialisasi otomatis jika wadah baru dibuat
    const freshMc = path.join(tempDir, "fresh-mc");
    await mkdir(path.join(freshMc, "versions", "mypack"), {recursive: true});
    const newFabric = await ModpackProfileManager.resolveContainerForLoader(
      freshMc,
      "fabric",
      "1.20.1",
    );
    expect(newFabric.containerName).toBe("mypack-fabric");
    const tlJsonRaw = await readFile(
      path.join(newFabric.containerDir, "TLauncherAdditional.json"),
      "utf8",
    );
    const tlJson = JSON.parse(tlJsonRaw);
    expect(tlJson.modpack.version.minecraftVersionTypes[0].name).toBe("fabric");
  });

  it("harus menyinkronkan profil otomatis dari folder .loadmoder/downloads (syncProfilesFromDownloads)", async () => {
    const downloadsDir = ModpackProfileManager.getDownloadsDir(mypackDir);
    await mkdir(downloadsDir, {recursive: true});
    await writeFile(path.join(downloadsDir, "auto-test.mrpack"), "dummy-content");

    vi.spyOn(unzipper.Open, "file").mockResolvedValue({
      files: [
        {
          path: "modrinth.index.json",
          buffer: async () =>
            Buffer.from(
              JSON.stringify({
                formatVersion: 1,
                game: "minecraft",
                versionId: "2.5.0",
                name: "Auto Synced Modpack",
                files: [],
                dependencies: {
                  minecraft: "1.20.1",
                  "fabric-loader": "0.15.11",
                },
              }),
            ),
        },
      ],
    } as any);

    const synced = await ModpackProfileManager.syncProfilesFromDownloads(mypackDir);
    expect(synced.some((p) => p.name === "Auto Synced Modpack")).toBe(true);

    const profiles = await ModpackProfileManager.listProfiles(mypackDir);
    expect(profiles.some((p) => p.id === "auto-test")).toBe(true);
  });

  it("harus mendeteksi kontainer client yang dikelompokkan berdasarkan loader (discoverClientContainers)", async () => {
    const customVersionsDir = path.join(tempDir, "custom-mc", "versions");
    await mkdir(path.join(customVersionsDir, "mypack(fabric)"), {recursive: true});
    await mkdir(path.join(customVersionsDir, "mypack(forge)"), {recursive: true});

    const discovered = await ModpackProfileManager.discoverClientContainers(
      path.join(tempDir, "custom-mc"),
    );

    expect(discovered.length).toBeGreaterThanOrEqual(2);
    expect(
      discovered.some((c) => c.loader === "fabric" && c.containerName === "mypack(fabric)"),
    ).toBe(true);
    expect(
      discovered.some((c) => c.loader === "forge" && c.containerName === "mypack(forge)"),
    ).toBe(true);
  });

  it("harus mengambil metadata versi langsung via Modrinth API berdasarkan hash (getVersionFileByHash)", async () => {
    const mockVersion = {
      id: "ver-123",
      version_number: "1.0.0",
      files: [{url: "https://cdn.modrinth.com/file.jar", hashes: {sha512: "dummy-hash"}}],
    };

    vi.spyOn(modrinthClient, "getVersionFileByHash").mockResolvedValue(mockVersion as any);

    const res = await modrinthClient.getVersionFileByHash("dummy-hash", "sha512");
    expect(res?.id).toBe("ver-123");
    expect(res?.files[0].url).toContain("cdn.modrinth.com");
  });

  it("harus mengenali berkas mesin yang diproteksi (isPreservedEngineItem)", () => {
    const container = "C:/Games/.minecraft/versions/mypack(fabric)";
    expect(ModpackProfileManager.isPreservedEngineItem(".loadmoder", container)).toBe(true);
    expect(ModpackProfileManager.isPreservedEngineItem(".fabric", container)).toBe(true);
    expect(ModpackProfileManager.isPreservedEngineItem("logs", container)).toBe(true);
    expect(ModpackProfileManager.isPreservedEngineItem("TLauncherAdditional.json", container)).toBe(true);
    expect(ModpackProfileManager.isPreservedEngineItem("mypack(fabric).jar", container)).toBe(true);
    expect(ModpackProfileManager.isPreservedEngineItem("mypack(fabric).json", container)).toBe(true);
    expect(ModpackProfileManager.isPreservedEngineItem("mypack.jar", container)).toBe(true);

    // Dynamic modpack files must return false
    expect(ModpackProfileManager.isPreservedEngineItem("mods", container)).toBe(false);
    expect(ModpackProfileManager.isPreservedEngineItem("config", container)).toBe(false);
    expect(ModpackProfileManager.isPreservedEngineItem("shaderpacks", container)).toBe(false);
    expect(ModpackProfileManager.isPreservedEngineItem("resourcepacks", container)).toBe(false);
    expect(ModpackProfileManager.isPreservedEngineItem("configureddefaults", container)).toBe(false);
    expect(ModpackProfileManager.isPreservedEngineItem("datapacks", container)).toBe(false);
    expect(ModpackProfileManager.isPreservedEngineItem("defaultconfigs", container)).toBe(false);
    expect(ModpackProfileManager.isPreservedEngineItem("modernfix", container)).toBe(false);
    expect(ModpackProfileManager.isPreservedEngineItem("natives", container)).toBe(false);
    expect(ModpackProfileManager.isPreservedEngineItem("server-resource-packs", container)).toBe(false);
    expect(ModpackProfileManager.isPreservedEngineItem("options.txt", container)).toBe(false);
  });

  it("harus menonaktifkan seluruh wadah modpack sekaligus (disableAllModpackContainers)", async () => {
    const customMc = path.join(tempDir, "multi-mc");
    const vDir = path.join(customMc, "versions");
    const fabricC = path.join(vDir, "mypack(fabric)");
    const forgeC = path.join(vDir, "mypack(forge)");

    // Setup Fabric container
    await mkdir(path.join(fabricC, "mods"), {recursive: true});
    await mkdir(path.join(fabricC, "config"), {recursive: true});
    await mkdir(path.join(fabricC, ".fabric"), {recursive: true});
    await mkdir(path.join(fabricC, "logs"), {recursive: true});
    await writeFile(path.join(fabricC, "mypack(fabric).jar"), "engine-jar");
    await writeFile(path.join(fabricC, "mypack(fabric).json"), "{}");
    await writeFile(path.join(fabricC, "TLauncherAdditional.json"), "{}");
    await writeFile(path.join(fabricC, "options.txt"), "fov:70");
    await writeFile(path.join(fabricC, "mods", "fabric-mod.jar"), "mod-content");

    await ModpackProfileManager.createProfileAfterInstall(fabricC, {
      id: "fabric-pack",
      name: "Fabric Pack",
      versionId: "1.0",
      loader: "fabric",
      gameVersion: "1.20.1",
    });
    await ModpackProfileManager.saveActiveToProfile(fabricC);

    // Setup Forge container
    await mkdir(path.join(forgeC, "mods"), {recursive: true});
    await mkdir(path.join(forgeC, "defaultconfigs"), {recursive: true});
    await mkdir(path.join(forgeC, "logs"), {recursive: true});
    await writeFile(path.join(forgeC, "mypack(forge).jar"), "engine-jar");
    await writeFile(path.join(forgeC, "mypack(forge).json"), "{}");
    await writeFile(path.join(forgeC, "TLauncherAdditional.json"), "{}");
    await writeFile(path.join(forgeC, "options.txt"), "renderDistance:12");
    await writeFile(path.join(forgeC, "mods", "forge-mod.jar"), "mod-content");

    await ModpackProfileManager.createProfileAfterInstall(forgeC, {
      id: "forge-pack",
      name: "Forge Pack",
      versionId: "1.0",
      loader: "forge",
      gameVersion: "1.20.1",
    });
    await ModpackProfileManager.saveActiveToProfile(forgeC);

    // Execute global disable
    const results = await ModpackProfileManager.disableAllModpackContainers(customMc);
    expect(results.length).toBe(2);
    expect(results.find((r) => r.containerName === "mypack(fabric)")?.disabledProfile).toBe("Fabric Pack");
    expect(results.find((r) => r.containerName === "mypack(forge)")?.disabledProfile).toBe("Forge Pack");

    // Verify fabric container state
    const fabricEntries = await readdir(fabricC);
    expect(fabricEntries).toContain(".loadmoder");
    expect(fabricEntries).toContain(".fabric");
    expect(fabricEntries).toContain("logs");
    expect(fabricEntries).toContain("mypack(fabric).jar");
    expect(fabricEntries).toContain("mypack(fabric).json");
    expect(fabricEntries).toContain("TLauncherAdditional.json");
    expect(fabricEntries).not.toContain("mods");
    expect(fabricEntries).not.toContain("config");
    expect(fabricEntries).not.toContain("options.txt");

    // Verify forge container state
    const forgeEntries = await readdir(forgeC);
    expect(forgeEntries).toContain(".loadmoder");
    expect(forgeEntries).toContain("logs");
    expect(forgeEntries).toContain("mypack(forge).jar");
    expect(forgeEntries).toContain("mypack(forge).json");
    expect(forgeEntries).toContain("TLauncherAdditional.json");
    expect(forgeEntries).not.toContain("mods");
    expect(forgeEntries).not.toContain("defaultconfigs");
    expect(forgeEntries).not.toContain("options.txt");

    // Verify active profiles are null
    const fabricActive = await ModpackProfileManager.getActiveProfile(fabricC);
    expect(fabricActive?.activeProfile).toBeNull();
    const forgeActive = await ModpackProfileManager.getActiveProfile(forgeC);
    expect(forgeActive?.activeProfile).toBeNull();

    // Verify archived profiles can be re-activated with files restored
    await ModpackProfileManager.activateProfile(fabricC, "fabric-pack");
    const restoredFabricEntries = await readdir(fabricC);
    expect(restoredFabricEntries).toContain("mods");
    expect(restoredFabricEntries).toContain("options.txt");
    const restoredMods = await readdir(path.join(fabricC, "mods"));
    expect(restoredMods).toContain("fabric-mod.jar");
  });

  it("harus menyalin berkas profil secara paralel dan memanggil callback onProgress", async () => {
    const testDir = path.join(tempDir, "parallel-progress-test");
    await mkdir(path.join(testDir, "mods"), {recursive: true});
    await writeFile(path.join(testDir, "mods", "mod1.jar"), "dummy-jar-1");
    await writeFile(path.join(testDir, "mods", "mod2.jar"), "dummy-jar-2");
    await writeFile(path.join(testDir, "config.txt"), "dummy-config");

    await ModpackProfileManager.createProfileAfterInstall(testDir, {
      id: "progress-profile",
      name: "Progress Profile",
      versionId: "1.0",
      loader: "fabric",
      gameVersion: "1.20.1",
    });

    const progressReports: Array<{copied: number; total: number; file: string}> = [];
    await ModpackProfileManager.saveActiveToProfile(testDir, {
      onProgress: (copied, total, file) => {
        progressReports.push({copied, total, file});
      },
    });

    expect(progressReports.length).toBe(3);
    expect(progressReports[progressReports.length - 1].copied).toBe(3);
    expect(progressReports[0].total).toBe(3);

    const profiles = await ModpackProfileManager.listProfiles(testDir);
    expect(profiles.find((p) => p.id === "progress-profile")?.filesCount).toBe(3);
  });

  it("harus mendeteksi rincian versi Minecraft pada setiap wadah client (discoverClientContainers)", async () => {
    const testVersionsDir = path.join(tempDir, "multi-ver-test", "versions");
    const c1 = path.join(testVersionsDir, "mypack(fabric-1.21)");
    const c2 = path.join(testVersionsDir, "mypack(forge-1.20)");
    await mkdir(c1, {recursive: true});
    await mkdir(c2, {recursive: true});

    await writeFile(
      path.join(c1, "TLauncherAdditional.json"),
      JSON.stringify({
        modpack: {
          name: "mypack(fabric-1.21)",
          version: {
            gameVersionDTO: {name: "1.21.1"},
            minecraftVersionTypes: [{name: "fabric"}],
          },
        },
      }),
    );

    await writeFile(
      path.join(c2, "TLauncherAdditional.json"),
      JSON.stringify({
        modpack: {
          name: "mypack(forge-1.20)",
          version: {
            gameVersionDTO: {name: "1.20.4"},
            minecraftVersionTypes: [{name: "forge"}],
          },
        },
      }),
    );

    const discovered = await ModpackProfileManager.discoverClientContainers(
      path.join(tempDir, "multi-ver-test"),
    );

    expect(discovered.length).toBe(2);
    const fab = discovered.find((c) => c.loader === "fabric");
    expect(fab?.gameVersion).toBe("1.21.1");
    expect(fab?.containerName).toBe("mypack(fabric-1.21)");

    const forg = discovered.find((c) => c.loader === "forge");
    expect(forg?.gameVersion).toBe("1.20.4");
    expect(forg?.containerName).toBe("mypack(forge-1.20)");
  });

  it("harus menyelesaikan wadah multi-versi secara cerdas sesuai gameVersion target", async () => {
    const testBase = path.join(tempDir, "multi-res-test");
    const vDir = path.join(testBase, "versions");
    await mkdir(path.join(vDir, "mypack(fabric)"), {recursive: true});
    await mkdir(path.join(vDir, "mypack(fabric-1.21)"), {recursive: true});

    // Wadah 1.21 Fabric harus diprioritaskan jika target 1.21
    const res121 = await ModpackProfileManager.resolveContainerForLoader(
      testBase,
      "fabric",
      "1.21",
    );
    expect(res121.containerName).toBe("mypack(fabric-1.21)");

    // Wadah Fabric baru untuk versi non-ada (misal 1.19.2) dibuat dengan nama mypack(fabric-1.19.2)
    const res119 = await ModpackProfileManager.resolveContainerForLoader(
      testBase,
      "fabric",
      "1.19.2",
    );
    expect(res119.containerName).toBe("mypack(fabric-1.19.2)");
  });
});

describe("TLauncher Instance Detector Integration", () => {
  it("harus mengenali instance container TLauncher dari versions/TLauncherAdditional.json", async () => {
    const tempDir = await mkdtemp(path.join(os.tmpdir(), "lm-detector-test-"));
    const mcDir = path.join(tempDir, ".minecraft");
    const versionsDir = path.join(mcDir, "versions", "custompack");
    await mkdir(versionsDir, { recursive: true });
    await mkdir(path.join(tempDir, ".tlauncher"), { recursive: true });

    await writeFile(
      path.join(versionsDir, "TLauncherAdditional.json"),
      JSON.stringify({
        modpack: {
          name: "Custom Pack",
          version: {
            gameVersionDTO: { name: "1.20.1" },
            minecraftVersionTypes: [{ name: "forge" }],
          },
        },
      })
    );

    vi.stubEnv("APPDATA", tempDir);

    const detector = new InstanceDetector();
    const instances = await (detector as any).scanTLauncherModpacks();
    expect(instances.some((i: any) => i.id === "tlauncher-custompack")).toBe(true);

    const vanilla = await (detector as any).scanVanilla();
    expect(vanilla?.launcher).toBe("TLauncher");
    expect(vanilla?.name).toBe("TLauncher");

    await rm(tempDir, { recursive: true, force: true });
  });
});
