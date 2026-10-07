import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import path from "node:path";
import os from "node:os";
import { mkdtemp, rm, mkdir, writeFile, readFile, readdir } from "node:fs/promises";
import { ModpackProfileManager, BaselineManager } from "../src/core/modpack/profileManager.js";
import { isLegacyPreservedItem } from "../src/core/modpack/legacy/legacyStrategy.js";

describe("Legacy Launcher Modpack Integration (Clean Install, Archiving, Zero Overwrite)", () => {
  let tmpDir: string;
  let legacyRoot: string;
  let gameDir: string;
  let versionsDir: string;
  let homeDir: string;
  let fabricContainerDir: string;

  beforeEach(async () => {
    tmpDir = await mkdtemp(path.join(os.tmpdir(), "lm-legacy-integ-"));
    legacyRoot = path.join(tmpDir, ".tlauncher", "legacy", "Minecraft");
    gameDir = path.join(legacyRoot, "game");
    versionsDir = path.join(gameDir, "versions");
    homeDir = path.join(gameDir, "home");
    fabricContainerDir = path.join(homeDir, "Fabric-26.2");

    await mkdir(versionsDir, { recursive: true });
    await mkdir(homeDir, { recursive: true });
    await mkdir(path.join(fabricContainerDir, "mods"), { recursive: true });
    await mkdir(path.join(fabricContainerDir, "config"), { recursive: true });

    // Setup tl.properties
    await writeFile(
      path.join(legacyRoot, "tl.properties"),
      "login.version=Fabric 26.2\nminecraft.gamedir.separate=family\n",
    );

    // Setup engine file di versions/
    const vFabricDir = path.join(versionsDir, "Fabric 26.2");
    await mkdir(vFabricDir, { recursive: true });
    await writeFile(
      path.join(vFabricDir, "Fabric 26.2.json"),
      JSON.stringify({ id: "Fabric 26.2", inheritsFrom: "1.20.1" }),
    );
  });

  afterEach(async () => {
    vi.unstubAllEnvs();
    await rm(tmpDir, { recursive: true, force: true });
  });

  it("harus meresolusi wadah home/<profile> untuk Legacy Launcher", async () => {
    const container = await ModpackProfileManager.resolveContainerForLoader(
      gameDir,
      "fabric",
      "1.20.1",
      "Legacy",
    );

    expect(container.containerName).toBe("Fabric-26.2");
    expect(container.containerDir).toBe(fabricContainerDir);
    expect(container.matchedLoader).toBe("fabric");
  });

  it("harus menerapkan alur Clean Install: mengarsipkan modpack lama dan membersihkan wadah tanpa menyentuh file sistem", async () => {
    // 1. Setup Modpack Pertama (A) yang sedang aktif
    const packAId = "pack-a-optimizations";
    await writeFile(path.join(fabricContainerDir, "mods", "sodium.jar"), "dummy sodium jar");
    await writeFile(path.join(fabricContainerDir, "mods", "iris.jar"), "dummy iris jar");
    await writeFile(path.join(fabricContainerDir, "config", "sodium.json"), "{}");
    
    // File sistem/engine Legacy Launcher yang harus dipertahankan
    await writeFile(path.join(fabricContainerDir, "options.txt"), "fov:90\n");
    await writeFile(path.join(fabricContainerDir, "servers.dat"), "dummy servers data");
    await mkdir(path.join(fabricContainerDir, ".fabric"), { recursive: true });
    await writeFile(path.join(fabricContainerDir, ".fabric", "cache.dat"), "cache");

    // Daftarkan pack A sebagai profil aktif
    await ModpackProfileManager.createProfileAfterInstall(fabricContainerDir, {
      id: packAId,
      name: "Pack A Optimization",
      versionId: "1.0.0",
      loader: "fabric",
      gameVersion: "1.20.1",
    });

    const activeBefore = await ModpackProfileManager.getActiveProfile(fabricContainerDir);
    expect(activeBefore?.activeProfile).toBe(packAId);

    // 2. Simulasi Alur Clean Install (seperti di install.ts)
    // Arsipkan modpack lama ke brankas profil
    await ModpackProfileManager.saveActiveToProfile(fabricContainerDir);
    // Bersihkan file live dari wadah
    await ModpackProfileManager.clearContainerLiveFiles(fabricContainerDir);

    // Verifikasi: Modpack A berhasil diamankan di .loadmoder/profiles/pack-a-optimizations/files/mods/sodium.jar
    const archivedMod = path.join(
      ModpackProfileManager.getProfilesDir(fabricContainerDir),
      packAId,
      "files",
      "mods",
      "sodium.jar",
    );
    const archivedModExists = await readFile(archivedMod, "utf8").then(() => true).catch(() => false);
    expect(archivedModExists).toBe(true);

    // Verifikasi: Folder live mods/ sudah bersih (dihapus/kosong)
    let modsStillExist = true;
    try {
      await readdir(path.join(fabricContainerDir, "mods"));
    } catch {
      modsStillExist = false;
    }
    expect(modsStillExist).toBe(false);

    // Verifikasi: Berkas sistem Legacy tetap utuh terlindungi
    expect(await readFile(path.join(fabricContainerDir, "servers.dat"), "utf8")).toBe("dummy servers data");
    expect(await readFile(path.join(fabricContainerDir, ".fabric", "cache.dat"), "utf8")).toBe("cache");

    // options.txt milik pack A aman di brankas profil
    const archivedOpt = path.join(
      ModpackProfileManager.getProfilesDir(fabricContainerDir),
      packAId,
      "files",
      "options.txt",
    );
    expect(await readFile(archivedOpt, "utf8")).toBe("fov:90\n");

    // 3. Pasang Modpack Baru (B) secara bersih
    const packBId = "pack-b-rpg";
    await mkdir(path.join(fabricContainerDir, "mods"), { recursive: true });
    await writeFile(path.join(fabricContainerDir, "mods", "rpg-quest.jar"), "dummy rpg mod");
    await ModpackProfileManager.createProfileAfterInstall(fabricContainerDir, {
      id: packBId,
      name: "Pack B RPG Adventure",
      versionId: "2.0.0",
      loader: "fabric",
      gameVersion: "1.20.1",
    });

    const activeAfter = await ModpackProfileManager.getActiveProfile(fabricContainerDir);
    expect(activeAfter?.activeProfile).toBe(packBId);

    const liveModsAfterB = await readdir(path.join(fabricContainerDir, "mods"));
    expect(liveModsAfterB).toEqual(["rpg-quest.jar"]);
    // Tidak ada sisa sodium.jar atau iris.jar dari pack A (zero collision / clean install)
    expect(liveModsAfterB).not.toContain("sodium.jar");
  });

  it("harus dapat beralih (switch) antar profil modpack di wadah Legacy Launcher", async () => {
    // Siapkan Pack A
    const packAId = "pack-a";
    await writeFile(path.join(fabricContainerDir, "mods", "mod-a.jar"), "mod a content");
    await ModpackProfileManager.createProfileAfterInstall(fabricContainerDir, {
      id: packAId,
      name: "Pack A",
      versionId: "1.0",
      loader: "fabric",
      gameVersion: "1.20.1",
    });
    await ModpackProfileManager.saveActiveToProfile(fabricContainerDir);
    await ModpackProfileManager.clearContainerLiveFiles(fabricContainerDir);

    // Siapkan Pack B
    const packBId = "pack-b";
    await mkdir(path.join(fabricContainerDir, "mods"), { recursive: true });
    await writeFile(path.join(fabricContainerDir, "mods", "mod-b.jar"), "mod b content");
    await ModpackProfileManager.createProfileAfterInstall(fabricContainerDir, {
      id: packBId,
      name: "Pack B",
      versionId: "2.0",
      loader: "fabric",
      gameVersion: "1.20.1",
    });
    await ModpackProfileManager.saveActiveToProfile(fabricContainerDir);

    // Sekarang aktifkan kembali Pack A via activateProfile
    await ModpackProfileManager.activateProfile(fabricContainerDir, packAId);

    const activeNow = await ModpackProfileManager.getActiveProfile(fabricContainerDir);
    expect(activeNow?.activeProfile).toBe(packAId);

    const liveMods = await readdir(path.join(fabricContainerDir, "mods"));
    expect(liveMods).toContain("mod-a.jar");
    expect(liveMods).not.toContain("mod-b.jar");
  });

  it("harus menonaktifkan seluruh wadah Legacy Launcher secara bersih via disableAllModpackContainers", async () => {
    // Buat wadah kedua di home/
    const forgeContainerDir = path.join(homeDir, "Forge-1.20.1");
    await mkdir(path.join(forgeContainerDir, "mods"), { recursive: true });
    await writeFile(path.join(forgeContainerDir, "mods", "forge-mod.jar"), "forge mod");
    await writeFile(path.join(forgeContainerDir, "options.txt"), "sound:0.5");
    await BaselineManager.createBaselineOnce(forgeContainerDir);

    await ModpackProfileManager.createProfileAfterInstall(forgeContainerDir, {
      id: "forge-pack",
      name: "Forge Pack",
      versionId: "1.0",
      loader: "forge",
      gameVersion: "1.20.1",
    });

    // Panggil disableAllModpackContainers dengan launcher "Legacy"
    const results = await ModpackProfileManager.disableAllModpackContainers(gameDir, "Legacy");
    expect(results.length).toBeGreaterThanOrEqual(1);

    // Verifikasi file mod dibersihkan tapi options.txt tetap dipertahankan
    let forgeModsExist = true;
    try {
      await readdir(path.join(forgeContainerDir, "mods"));
    } catch {
      forgeModsExist = false;
    }
    expect(forgeModsExist).toBe(false);
    expect(await readFile(path.join(forgeContainerDir, "options.txt"), "utf8")).toBe("sound:0.5");

    const forgeActive = await ModpackProfileManager.getActiveProfile(forgeContainerDir);
    expect(forgeActive?.activeProfile).toBeNull();
  });

  it("harus mencadangkan baseline satu kali, membersihkan wadah, dan memulihkan baseline tanpa menghapus masternya", async () => {
    // 1. Kondisi awal vanilla / baseline
    const testContainer = path.join(homeDir, "Fabric-Baseline-Test");
    await mkdir(testContainer, { recursive: true });
    await writeFile(path.join(testContainer, "options.txt"), "fov:70\noriginal_vanilla:true\n");
    await writeFile(path.join(testContainer, "servers.dat"), "my_servers");
    await BaselineManager.createBaselineOnce(testContainer);

    // 2. Pasang Modpack yang mengubah options.txt
    await ModpackProfileManager.createProfileAfterInstall(testContainer, {
      id: "pack-heavy",
      name: "Pack Heavy",
      versionId: "1.0",
      loader: "fabric",
      gameVersion: "1.20.1",
    });

    // Simulasi modpack mengubah options.txt dan menambah mod
    await mkdir(path.join(testContainer, "mods"), { recursive: true });
    await writeFile(path.join(testContainer, "mods", "heavy.jar"), "mod jar");
    await writeFile(path.join(testContainer, "options.txt"), "fov:110\nmodpack_setting:true\n");

    // 3. Nonaktifkan modpack (Clean State)
    await ModpackProfileManager.disableProfile(testContainer);

    // 4. Verifikasi live files: mods sudah hilang, options.txt kembali ke versi baseline awal!
    let modsExist = true;
    try {
      await readdir(path.join(testContainer, "mods"));
    } catch {
      modsExist = false;
    }
    expect(modsExist).toBe(false);

    const restoredOpt = await readFile(path.join(testContainer, "options.txt"), "utf8");
    expect(restoredOpt).toBe("fov:70\noriginal_vanilla:true\n");

    // 5. Verifikasi master baseline tetap ada dan utuh (Zero-Delete Policy)
    const baseDir = BaselineManager.getBaselineDir(testContainer);
    expect(await readFile(path.join(baseDir, "options.txt"), "utf8")).toBe("fov:70\noriginal_vanilla:true\n");

    // 6. Pembersihan kedua kali tetap dapat memulihkan baseline
    await writeFile(path.join(testContainer, "options.txt"), "fov:80 (modified again)");
    await ModpackProfileManager.disableProfile(testContainer);
    expect(await readFile(path.join(testContainer, "options.txt"), "utf8")).toBe("fov:70\noriginal_vanilla:true\n");
  });
});
