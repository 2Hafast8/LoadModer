import {describe, it, expect, beforeEach, afterEach} from "vitest";
import path from "node:path";
import os from "node:os";
import {mkdir, writeFile, readFile, rm, stat} from "node:fs/promises";
import {ModpackProfileManager} from "../src/core/modpack/profileManager.js";
import {discoverTLauncherContainers} from "../src/core/modpack/tlauncher/tlauncherStrategy.js";
import {getLauncherCapabilities, isLoadModerModpackContainerName} from "../src/core/instance/capabilities.js";

describe("TL-Mods Automatic Profile Creation & Complete File Preservation", () => {
  let tempDir: string;
  let versionsDir: string;
  let tlModpackDir: string;
  let mypackDir: string;

  beforeEach(async () => {
    tempDir = path.join(os.tmpdir(), `lm-tlmods-test-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`);
    versionsDir = path.join(tempDir, "versions");
    tlModpackDir = path.join(versionsDir, "Better Adventures 1.20.1");
    mypackDir = path.join(versionsDir, "mypack(fabric)");

    await mkdir(tlModpackDir, {recursive: true});
    await mkdir(mypackDir, {recursive: true});

    // 1. Setup wadah modpack TL-Mods (dibuat langsung oleh fitur TL-Mods TLauncher)
    const tlAdditional = {
      modpack: {
        id: 9999,
        name: "Better Adventures",
        version: {
          id: 8888,
          name: "v1.2.0",
          gameVersionDTO: {
            name: "1.20.1",
          },
          minecraftVersionTypes: [{name: "Fabric"}],
        },
      },
    };
    await writeFile(
      path.join(tlModpackDir, "TLauncherAdditional.json"),
      JSON.stringify(tlAdditional, null, 2),
      "utf8",
    );

    // Berkas-berkas modpack TL-Mods yang terpasang
    await mkdir(path.join(tlModpackDir, "mods"), {recursive: true});
    await writeFile(path.join(tlModpackDir, "mods", "fabric-api.jar"), "api-jar-content");
    await writeFile(path.join(tlModpackDir, "mods", "sodium.jar"), "sodium-jar-content");

    await mkdir(path.join(tlModpackDir, "config"), {recursive: true});
    await writeFile(path.join(tlModpackDir, "config", "sodium-options.json"), JSON.stringify({threads: 4}));

    await mkdir(path.join(tlModpackDir, "shaderpacks"), {recursive: true});
    await writeFile(path.join(tlModpackDir, "shaderpacks", "complementary.zip"), "zip-content");

    await mkdir(path.join(tlModpackDir, "resourcepacks"), {recursive: true});
    await writeFile(path.join(tlModpackDir, "resourcepacks", "stay_true.zip"), "resource-zip-content");

    await writeFile(path.join(tlModpackDir, "options.txt"), "fov:70.0\ngamma:1.0");

    // 2. Setup wadah modpack standar LoadModer (mypack)
    await writeFile(
      path.join(mypackDir, "TLauncherAdditional.json"),
      JSON.stringify({modpack: {name: "mypack", version: {gameVersionDTO: {name: "1.20.1"}}}}, null, 2),
      "utf8",
    );
  });

  afterEach(async () => {
    await rm(tempDir, {recursive: true, force: true});
  });

  it("harus mendeteksi container TL-Mods dan mengidentifikasi status isTLMods serta isLoadModerContainer", async () => {
    const containers = await ModpackProfileManager.discoverClientContainers(tempDir, "TLauncher");
    expect(containers.length).toBe(2);

    const tlContainer = containers.find((c) => c.containerName === "Better Adventures 1.20.1");
    const mypackContainer = containers.find((c) => c.containerName === "mypack(fabric)");

    expect(tlContainer).toBeDefined();
    expect(tlContainer?.isTLMods).toBe(true);
    expect(tlContainer?.isLoadModerContainer).toBe(false);
    expect(tlContainer?.loader).toBe("fabric");
    expect(tlContainer?.gameVersion).toBe("1.20.1");

    expect(mypackContainer).toBeDefined();
    expect(mypackContainer?.isTLMods).toBe(false);
    expect(mypackContainer?.isLoadModerContainer).toBe(true);
  });

  it("harus otomatis membuat profil dan menyimpan seluruh isi modpack TL-Mods tanpa terkecuali", async () => {
    // Jalankan ensureTLModsProfile
    const profile = await ModpackProfileManager.ensureTLModsProfile(tlModpackDir);
    expect(profile).not.toBeNull();
    expect(profile?.name).toBe("Better Adventures");
    expect(profile?.loader).toBe("fabric");
    expect(profile?.gameVersion).toBe("1.20.1");

    // Pastikan active-profile.json terisi
    const activeInfo = await ModpackProfileManager.getActiveProfile(tlModpackDir);
    expect(activeInfo).not.toBeNull();
    expect(activeInfo?.activeProfile).toBe(profile?.id);
    expect(activeInfo?.name).toBe("Better Adventures");

    // Verifikasi arsip profil menyimpan seluruh berkas modpack tanpa terkecuali
    const profileDir = path.join(ModpackProfileManager.getProfilesDir(tlModpackDir), profile!.id);
    const filesDir = path.join(profileDir, "files");

    const savedTlAdditional = await readFile(path.join(filesDir, "TLauncherAdditional.json"), "utf8");
    expect(JSON.parse(savedTlAdditional).modpack.name).toBe("Better Adventures");

    const savedModApi = await readFile(path.join(filesDir, "mods", "fabric-api.jar"), "utf8");
    expect(savedModApi).toBe("api-jar-content");

    const savedSodium = await readFile(path.join(filesDir, "mods", "sodium.jar"), "utf8");
    expect(savedSodium).toBe("sodium-jar-content");

    const savedConfig = await readFile(path.join(filesDir, "config", "sodium-options.json"), "utf8");
    expect(JSON.parse(savedConfig).threads).toBe(4);

    const savedShader = await readFile(path.join(filesDir, "shaderpacks", "complementary.zip"), "utf8");
    expect(savedShader).toBe("zip-content");

    const savedResource = await readFile(path.join(filesDir, "resourcepacks", "stay_true.zip"), "utf8");
    expect(savedResource).toBe("resource-zip-content");

    const savedOptions = await readFile(path.join(filesDir, "options.txt"), "utf8");
    expect(savedOptions).toContain("fov:70.0");
  });

  it("harus memangkas (orphan pruning) file yang dihapus pengguna saat profil diperbarui", async () => {
    await ModpackProfileManager.ensureTLModsProfile(tlModpackDir);
    const activeInfo = await ModpackProfileManager.getActiveProfile(tlModpackDir);
    const filesDir = path.join(ModpackProfileManager.getProfilesDir(tlModpackDir), activeInfo!.activeProfile!, "files");

    // Pastikan sodium.jar ada di arsip
    expect(await stat(path.join(filesDir, "mods", "sodium.jar"))).toBeDefined();

    // Simulasi: Pengguna menghapus sodium.jar di wadah aktif
    await rm(path.join(tlModpackDir, "mods", "sodium.jar"), {force: true});

    // Jalankan sinkronisasi simpanan profil
    await ModpackProfileManager.saveActiveToProfile(tlModpackDir);

    // Verifikasi: sodium.jar di files/ wajib terhapus (pruned), tidak boleh bangkit kembali
    let sodiumInArchiveExists = true;
    try {
      await stat(path.join(filesDir, "mods", "sodium.jar"));
    } catch {
      sodiumInArchiveExists = false;
    }
    expect(sodiumInArchiveExists).toBe(false);

    // Mod fabric-api.jar dan TLauncherAdditional.json harus tetap ada
    expect(await stat(path.join(filesDir, "mods", "fabric-api.jar"))).toBeDefined();
    expect(await stat(path.join(filesDir, "TLauncherAdditional.json"))).toBeDefined();
  });

  it("harus mengekstrak/memulihkan seluruh berkas profil dengan sempurna saat diaktifkan kembali", async () => {
    const profile = await ModpackProfileManager.ensureTLModsProfile(tlModpackDir);

    // Bersihkan live files (simulasi profil dinonaktifkan atau wadah dibersihkan)
    await ModpackProfileManager.clearContainerLiveFiles(tlModpackDir);

    // Pastikan folder mods kosong
    let liveModsDirExists = false;
    try {
      await stat(path.join(tlModpackDir, "mods", "fabric-api.jar"));
      liveModsDirExists = true;
    } catch {}
    expect(liveModsDirExists).toBe(false);

    // Aktifkan kembali profil TL-Mods
    await ModpackProfileManager.activateProfile(tlModpackDir, profile!.id);

    // Seluruh berkas modpack harus terekstrak kembali sesuai yang disimpan
    const restoredModApi = await readFile(path.join(tlModpackDir, "mods", "fabric-api.jar"), "utf8");
    expect(restoredModApi).toBe("api-jar-content");

    const restoredConfig = await readFile(path.join(tlModpackDir, "config", "sodium-options.json"), "utf8");
    expect(JSON.parse(restoredConfig).threads).toBe(4);

    const restoredOptions = await readFile(path.join(tlModpackDir, "options.txt"), "utf8");
    expect(restoredOptions).toContain("fov:70.0");

    const restoredTlAdditional = await readFile(path.join(tlModpackDir, "TLauncherAdditional.json"), "utf8");
    expect(JSON.parse(restoredTlAdditional).modpack.name).toBe("Better Adventures");
  });

  it("harus menonaktifkan download modpack jika folder terdeteksi sebagai TL-Mods", () => {
    // 1. Kasus wadah aktif adalah modpack TL-Mods
    const tlCaps = getLauncherCapabilities("TLauncher", {
      rootDir: tempDir,
      mode: "modpack",
      activeContainer: "Better Adventures 1.20.1",
    });

    expect(tlCaps.supportsModpack).toBe(false);
    expect(tlCaps.isTLMods).toBe(true);
    expect(tlCaps.isLoadModerContainer).toBe(false);
    expect(tlCaps.incompatibilityReason).toContain("TL-Mods");

    // 2. Kasus wadah aktif adalah wadah LoadModer (mypack)
    const mypackCaps = getLauncherCapabilities("TLauncher", {
      rootDir: tempDir,
      mode: "modpack",
      activeContainer: "mypack(fabric)",
    });

    expect(mypackCaps.supportsModpack).toBe(true);
    expect(mypackCaps.isTLMods).toBe(false);
    expect(mypackCaps.isLoadModerContainer).toBe(true);

    // 3. Kasus root instance langsung diarahkan ke folder TL-Mods
    const directRootCaps = getLauncherCapabilities("TLauncher", {
      rootDir: tlModpackDir,
      mode: "default",
    });

    expect(directRootCaps.supportsModpack).toBe(false);
    expect(directRootCaps.isTLMods).toBe(true);
  });

  it("harus berhasil melakukan simpan profil manual khusus untuk modpack TL-Mods", async () => {
    // Jalankan manualSaveTLModsProfile
    const result = await ModpackProfileManager.manualSaveTLModsProfile(tlModpackDir);
    expect(result).toBeDefined();
    expect(result.profile.name).toBe("Better Adventures");
    expect(result.profile.loader).toBe("fabric");
    expect(result.filesCount).toBeGreaterThanOrEqual(6);

    // Verifikasi arsip profil hasil simpan manual
    const profileDir = path.join(ModpackProfileManager.getProfilesDir(tlModpackDir), result.profile.id);
    const filesDir = path.join(profileDir, "files");

    expect(await stat(path.join(filesDir, "mods", "fabric-api.jar"))).toBeDefined();
    expect(await stat(path.join(filesDir, "mods", "sodium.jar"))).toBeDefined();
    expect(await stat(path.join(filesDir, "config", "sodium-options.json"))).toBeDefined();
    expect(await stat(path.join(filesDir, "shaderpacks", "complementary.zip"))).toBeDefined();
    expect(await stat(path.join(filesDir, "resourcepacks", "stay_true.zip"))).toBeDefined();
    expect(await stat(path.join(filesDir, "options.txt"))).toBeDefined();
    expect(await stat(path.join(filesDir, "TLauncherAdditional.json"))).toBeDefined();
  });

  it("harus menolak simpan manual jika dipanggil pada wadah mypack LoadModer atau folder non-TL-Mods", async () => {
    // 1. Uji pada wadah LoadModer standar (mypack)
    await expect(ModpackProfileManager.manualSaveTLModsProfile(mypackDir)).rejects.toThrow(
      /hanya diperuntukkan bagi modpack bawaan TL-Mods/,
    );

    // 2. Uji pada folder kosong tanpa TLauncherAdditional.json
    const nonTLModsDir = path.join(tempDir, "vanilla-profile");
    await mkdir(nonTLModsDir, {recursive: true});

    await expect(ModpackProfileManager.manualSaveTLModsProfile(nonTLModsDir)).rejects.toThrow(
      /hanya diperuntukkan bagi modpack bawaan TL-Mods/,
    );
  });

  it("tidak boleh menandai profil aktif jika wadah TL-Mods dalam kondisi bersih (clean state) dan dapat diaktifkan kembali", async () => {
    // 1. Buat profil TL-Mods terlebih dahulu
    const profile = await ModpackProfileManager.ensureTLModsProfile(tlModpackDir);
    expect(profile).not.toBeNull();

    // 2. Bersihkan wadah (simulasi pengguna berpindah ke default mode)
    await ModpackProfileManager.clearContainerLiveFiles(tlModpackDir);
    await ModpackProfileManager.setActiveProfileInfo(tlModpackDir, {
      activeProfile: null,
      updatedAt: new Date().toISOString(),
    });

    // 3. Jalankan ensureTLModsProfile lagi saat wadah bersih
    await ModpackProfileManager.ensureTLModsProfile(tlModpackDir);

    // 4. Pastikan status activeProfile tetap NULL (tidak aktif palsu)
    const activeInfoClean = await ModpackProfileManager.getActiveProfile(tlModpackDir);
    expect(activeInfoClean?.activeProfile).toBeNull();

    const profilesClean = await ModpackProfileManager.listProfiles(tlModpackDir);
    const matchedClean = profilesClean.find((p) => p.id === profile!.id);
    expect(matchedClean?.isActive).toBe(false);

    // 5. Uji auto-healing: jika active-profile.json sempat mencatat aktif saat folder kosong
    await ModpackProfileManager.setActiveProfileInfo(tlModpackDir, {
      activeProfile: profile!.id,
      name: profile!.name,
      updatedAt: new Date().toISOString(),
    });
    // Saat ensureTLModsProfile dipanggil, harus auto-heal menjadi null
    await ModpackProfileManager.ensureTLModsProfile(tlModpackDir);
    const healedInfo = await ModpackProfileManager.getActiveProfile(tlModpackDir);
    expect(healedInfo?.activeProfile).toBeNull();

    // 6. Uji bahwa profil dapat diaktifkan / di-restore kembali dengan sempurna
    await ModpackProfileManager.activateProfile(tlModpackDir, profile!.id);
    const restoredInfo = await ModpackProfileManager.getActiveProfile(tlModpackDir);
    expect(restoredInfo?.activeProfile).toBe(profile!.id);

    const restoredMod = await readFile(path.join(tlModpackDir, "mods", "fabric-api.jar"), "utf8");
    expect(restoredMod).toBe("api-jar-content");
  });
});

