import {describe, it, expect, beforeEach, afterEach} from "vitest";
import path from "node:path";
import os from "node:os";
import {mkdtemp, rm, mkdir, writeFile} from "node:fs/promises";
import {InstalledAssetsIndex} from "../src/core/instance/installedIndex.js";
import type {SavedInstanceConfig} from "../src/types/instance.js";

describe("InstalledAssetsIndex", () => {
  let tmpDir: string;
  let modsDir: string;

  beforeEach(async () => {
    tmpDir = await mkdtemp(path.join(os.tmpdir(), "lm-inst-idx-test-"));
    modsDir = path.join(tmpDir, "mods");
    await mkdir(modsDir, {recursive: true});
  });

  afterEach(async () => {
    await rm(tmpDir, {recursive: true, force: true});
  });

  it("mengembalikan index kosong jika instance undefined atau tanpa modsDir", async () => {
    const idx = await InstalledAssetsIndex.load(undefined);
    expect(idx.isInstalled("sodium")).toBe(false);
    expect(idx.getStatus("sodium")).toBeUndefined();
  });

  it("mendeteksi mod dari loadmoder.lock.json via slug dan project ID", async () => {
    const lockfilePath = path.join(tmpDir, "loadmoder.lock.json");
    const lockData = {
      $schema: "https://loadmoder.dev/schema/v1/lock.json",
      version: 1,
      gameVersion: "1.20.1",
      loader: "fabric",
      updatedAt: new Date().toISOString(),
      mods: {
        sodium: {
          projectId: "AANobbMI",
          versionId: "v1",
          versionNumber: "0.5.8",
          filename: "sodium-fabric-0.5.8.jar",
          sha512: "abc",
          dependencies: [],
          dependedBy: [],
          isRoot: true,
          installedAt: new Date().toISOString(),
        },
      },
      resourcepacks: {
        "faithful-32x": {
          filename: "faithful.zip",
          sha512: "hash-faithful",
          installedAt: new Date().toISOString(),
        },
      },
      shaderpacks: {
        complementary: {
          filename: "complementary.zip",
          sha512: "hash-comp",
          installedAt: new Date().toISOString(),
        },
      },
    };

    await writeFile(lockfilePath, JSON.stringify(lockData), "utf8");

    const instance: SavedInstanceConfig = {
      name: "Test Inst",
      launcher: "Vanilla",
      rootDir: tmpDir,
      modsDir,
    };

    const idx = await InstalledAssetsIndex.load(instance);

    // Cek slug
    expect(idx.isInstalled("sodium")).toBe(true);
    expect(idx.getStatus("sodium")?.version).toBe("0.5.8");
    expect(idx.getStatus("sodium")?.assetType).toBe("mod");

    // Cek project ID
    expect(idx.isInstalled("AANobbMI")).toBe(true);
    expect(idx.getStatus("AANobbMI")?.isInstalled).toBe(true);

    // Cek resourcepack & shaderpack
    expect(idx.isInstalled("faithful-32x")).toBe(true);
    expect(idx.isInstalled("complementary")).toBe(true);

    // Cek yang belum terpasang
    expect(idx.isInstalled("iris")).toBe(false);
  });

  it("mendeteksi berkas .jar dan .jar.disabled langsung dari disk", async () => {
    await writeFile(path.join(modsDir, "lithium-fabric-0.11.2.jar"), "dummy");
    await writeFile(path.join(modsDir, "ferritecore-fabric.jar.disabled"), "dummy");

    const instance: SavedInstanceConfig = {
      name: "Test Disk",
      launcher: "Custom",
      rootDir: tmpDir,
      modsDir,
    };

    const idx = await InstalledAssetsIndex.load(instance);

    expect(idx.isInstalled("lithium")).toBe(true);
    expect(idx.getStatus("lithium")?.isDisabled).toBe(false);

    expect(idx.isInstalled("ferritecore")).toBe(true);
    expect(idx.getStatus("ferritecore")?.isDisabled).toBe(true);
  });

  it("mendeteksi slug multi-part dari nama berkas disk (misal fabric-api)", async () => {
    await writeFile(path.join(modsDir, "fabric-api-0.92.2+1.20.1.jar"), "dummy");

    const instance: SavedInstanceConfig = {
      name: "Test Multipart",
      launcher: "Custom",
      rootDir: tmpDir,
      modsDir,
    };

    const idx = await InstalledAssetsIndex.load(instance);

    expect(idx.isInstalled("fabric-api")).toBe(true);
    expect(idx.isInstalled("fabric-api-0.92.2+1.20.1")).toBe(true);
    expect(idx.getStatus("fabric-api")?.isInstalled).toBe(true);
  });

  it("menandai isDisabled = true jika berkas lockfile memiliki ekstensi .disabled pada disk", async () => {
    const lockfilePath = path.join(tmpDir, "loadmoder.lock.json");
    const lockData = {
      $schema: "https://loadmoder.dev/schema/v1/lock.json",
      version: 1,
      gameVersion: "1.20.1",
      loader: "fabric",
      updatedAt: new Date().toISOString(),
      mods: {
        sodium: {
          projectId: "AANobbMI",
          versionId: "v1",
          versionNumber: "0.5.8",
          filename: "sodium-fabric-0.5.8.jar",
          sha512: "abc",
          dependencies: [],
          dependedBy: [],
          isRoot: true,
          installedAt: new Date().toISOString(),
        },
      },
    };

    await writeFile(lockfilePath, JSON.stringify(lockData), "utf8");
    // Buat file sodium dengan suffix .disabled di disk
    await writeFile(path.join(modsDir, "sodium-fabric-0.5.8.jar.disabled"), "dummy");

    const instance: SavedInstanceConfig = {
      name: "Test Lockfile Disabled",
      launcher: "Vanilla",
      rootDir: tmpDir,
      modsDir,
    };

    const idx = await InstalledAssetsIndex.load(instance);

    expect(idx.isInstalled("sodium")).toBe(true);
    expect(idx.getStatus("sodium")?.isDisabled).toBe(true);
    expect(idx.getStatus("sodium")?.filename).toBe("sodium-fabric-0.5.8.jar.disabled");
  });
});
