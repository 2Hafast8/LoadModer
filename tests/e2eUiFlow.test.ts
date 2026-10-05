import {describe, it, expect, beforeEach, afterEach, vi} from "vitest";
import path from "node:path";
import os from "node:os";
import {mkdtemp, rm, mkdir, writeFile} from "node:fs/promises";
import {InstalledAssetsIndex} from "../src/core/instance/installedIndex.js";
import {toggleModFile} from "../src/core/instance/modToggle.js";
import {buildRemoteModDetail} from "../src/ui/dashboard/detailLoader.js";
import {renderComprehensiveModDetailCard} from "../src/ui/dashboard/detailCard.js";
import {modrinthClient} from "../src/api/client.js";
import type {SavedInstanceConfig} from "../src/types/instance.js";

describe("E2E UI & Life-Cycle Flow", () => {
  let tmpDir: string;
  let modsDir: string;
  let testInstance: SavedInstanceConfig;

  beforeEach(async () => {
    tmpDir = await mkdtemp(path.join(os.tmpdir(), "lm-e2e-ui-"));
    modsDir = path.join(tmpDir, "mods");
    await mkdir(modsDir, {recursive: true});

    testInstance = {
      name: "E2E Test Instance",
      launcher: "Vanilla",
      rootDir: tmpDir,
      modsDir,
      loader: "fabric",
      gameVersion: "1.20.1",
    };

    // Setup mock lockfile with sodium installed
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
          versionId: "ver-sodium-1",
          versionNumber: "0.5.8",
          filename: "sodium-fabric-0.5.8.jar",
          sha512: "dummy-hash",
          dependencies: [],
          dependedBy: [],
          isRoot: true,
          installedAt: new Date().toISOString(),
        },
      },
    };
    await writeFile(lockfilePath, JSON.stringify(lockData), "utf8");

    // Write physical file on disk
    await writeFile(path.join(modsDir, "sodium-fabric-0.5.8.jar"), "dummy jar bytes");
    // Write physical disabled file on disk
    await writeFile(path.join(modsDir, "iris-mc1.20.1-1.6.4.jar.disabled"), "dummy jar bytes");
  });

  afterEach(async () => {
    await rm(tmpDir, {recursive: true, force: true});
    vi.restoreAllMocks();
  });

  it("berhasil memuat status terpasang secara paralel saat pencarian dan menampilkan detail card", async () => {
    // 1. Mock remote Modrinth API response
    vi.spyOn(modrinthClient, "getProject").mockImplementation(async (slugOrId) => {
      if (slugOrId === "sodium" || slugOrId === "AANobbMI") {
        return {
          id: "AANobbMI",
          slug: "sodium",
          title: "Sodium",
          project_type: "mod",
          downloads: 12000000,
          followers: 45000,
        } as any;
      }
      return {
        id: "iris-id",
        slug: "iris",
        title: "Iris Shaders",
        project_type: "mod",
        downloads: 8000000,
        followers: 30000,
      } as any;
    });

    vi.spyOn(modrinthClient, "getProjectVersions").mockImplementation(async (slugOrId) => {
      if (slugOrId === "sodium" || slugOrId === "AANobbMI") {
        return [
          {
            id: "ver-sodium-2",
            project_id: "AANobbMI",
            version_number: "0.5.9",
            game_versions: ["1.20.1"],
            loaders: ["fabric"],
            files: [{primary: true, filename: "sodium-fabric-0.5.9.jar", size: 1048576, hashes: {}}],
            dependencies: [],
          } as any,
        ];
      }
      return [
        {
          id: "ver-iris-1",
          project_id: "iris-id",
          version_number: "1.6.4",
          game_versions: ["1.20.1"],
          loaders: ["fabric"],
          files: [{primary: true, filename: "iris-mc1.20.1-1.6.4.jar", size: 2097152, hashes: {}}],
          dependencies: [],
        } as any,
      ];
    });

    // 2. Jalankan buildRemoteModDetail untuk mod yang terpasang (Sodium)
    const {detail: sodiumDetail} = await buildRemoteModDetail(
      "sodium",
      testInstance.loader!,
      testInstance.gameVersion!,
      testInstance,
    );

    expect(sodiumDetail.isInstalled).toBe(true);
    expect(sodiumDetail.status).toBe("active");
    expect(sodiumDetail.installedVersion).toBe("0.5.8");
    expect(sodiumDetail.latestVersion).toBe("0.5.9");

    // 3. Render kartu detail Sodium dan verifikasi output terminal
    const consoleSpy = vi.spyOn(console, "log").mockImplementation(() => {});
    renderComprehensiveModDetailCard(sodiumDetail);
    const sodiumCardOutput = consoleSpy.mock.calls.map((c) => c.join(" ")).join("\n");

    expect(sodiumCardOutput).toContain("Terpasang (Aktif)");
    expect(sodiumCardOutput).toContain("v0.5.8");
    expect(sodiumCardOutput).toContain("Pembaruan:");
    expect(sodiumCardOutput).toContain("v0.5.9");

    consoleSpy.mockClear();

    // 4. Ubah status berkas (Toggle mod) dari aktif ke nonaktif
    const newFilename = await toggleModFile(modsDir, "sodium", false);
    expect(newFilename).toContain(".disabled");

    // 5. Verifikasi bahwa InstalledAssetsIndex secara instan mendeteksi status disabled
    const updatedIndex = await InstalledAssetsIndex.load(testInstance);
    expect(updatedIndex.isInstalled("sodium")).toBe(true);
    expect(updatedIndex.getStatus("sodium")?.isDisabled).toBe(true);

    // 6. Jalankan buildRemoteModDetail ulang setelah ditoggle
    const {detail: toggledDetail} = await buildRemoteModDetail(
      "sodium",
      testInstance.loader!,
      testInstance.gameVersion!,
      testInstance,
      updatedIndex,
    );

    expect(toggledDetail.isInstalled).toBe(true);
    expect(toggledDetail.status).toBe("disabled");

    // 7. Render kartu detail yang sudah ditoggle
    renderComprehensiveModDetailCard(toggledDetail);
    const toggledCardOutput = consoleSpy.mock.calls.map((c) => c.join(" ")).join("\n");
    expect(toggledCardOutput).toContain("Terpasang (Nonaktif)");

    consoleSpy.mockRestore();
  });

  it("menangani mod yang belum terpasang dengan benar pada seluruh siklus", async () => {
    vi.spyOn(modrinthClient, "getProject").mockResolvedValue({
      id: "uninstalled-id",
      slug: "fabric-language-kotlin",
      title: "Fabric Language Kotlin",
      project_type: "mod",
      downloads: 5000000,
      followers: 12000,
    } as any);

    vi.spyOn(modrinthClient, "getProjectVersions").mockResolvedValue([
      {
        id: "flk-1",
        project_id: "uninstalled-id",
        version_number: "1.10.19",
        game_versions: ["1.20.1"],
        loaders: ["fabric"],
        files: [{primary: true, filename: "fabric-language-kotlin-1.10.19.jar", size: 3145728, hashes: {}}],
        dependencies: [],
      } as any,
    ]);

    const {detail} = await buildRemoteModDetail(
      "fabric-language-kotlin",
      testInstance.loader!,
      testInstance.gameVersion!,
      testInstance,
    );

    expect(detail.isInstalled).toBe(false);
    expect(detail.status).toBe("not_installed");
    expect(detail.installedVersion).toBeUndefined();

    const consoleSpy = vi.spyOn(console, "log").mockImplementation(() => {});
    renderComprehensiveModDetailCard(detail);
    const output = consoleSpy.mock.calls.map((c) => c.join(" ")).join("\n");
    expect(output).toContain("Belum Terpasang");

    consoleSpy.mockRestore();
  });
});
