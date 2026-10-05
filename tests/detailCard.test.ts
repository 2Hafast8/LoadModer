import {describe, it, expect, vi} from "vitest";
import {
  renderComprehensiveModDetailCard,
  type ComprehensiveModDetail,
} from "../src/ui/dashboard/detailCard.js";
import {buildRemoteModDetail} from "../src/ui/dashboard/detailLoader.js";
import {InstalledAssetsIndex} from "../src/core/instance/installedIndex.js";
import {modrinthClient} from "../src/api/client.js";
import type {SavedInstanceConfig} from "../src/types/instance.js";

describe("renderComprehensiveModDetailCard", () => {
  it("menampilkan badge ✔ Terpasang (Aktif) saat mod terpasang dan aktif", () => {
    const consoleSpy = vi.spyOn(console, "log").mockImplementation(() => {});

    const detail: ComprehensiveModDetail = {
      title: "Sodium",
      slug: "sodium",
      projectType: "mod",
      status: "active",
      isInstalled: true,
      installedVersion: "0.5.8",
      latestVersion: "0.5.8",
    };

    renderComprehensiveModDetailCard(detail);
    expect(consoleSpy).toHaveBeenCalled();
    const output = consoleSpy.mock.calls[0][0];
    expect(output).toContain("Terpasang (Aktif)");
    expect(output).toContain("v0.5.8");
    expect(output).toContain("Terkini");

    consoleSpy.mockRestore();
  });

  it("menampilkan badge ○ Terpasang (Nonaktif) saat mod terpasang berstatus disabled", () => {
    const consoleSpy = vi.spyOn(console, "log").mockImplementation(() => {});

    const detail: ComprehensiveModDetail = {
      title: "Iris Shaders",
      slug: "iris",
      projectType: "mod",
      status: "disabled",
      isInstalled: true,
      installedVersion: "1.6.4",
      latestVersion: "1.7.0",
    };

    renderComprehensiveModDetailCard(detail);
    expect(consoleSpy).toHaveBeenCalled();
    const output = consoleSpy.mock.calls[0][0];
    expect(output).toContain("Terpasang (Nonaktif)");
    expect(output).toContain("Pembaruan:");
    expect(output).toContain("v1.7.0");

    consoleSpy.mockRestore();
  });

  it("menampilkan badge 🌐 Belum Terpasang (Modrinth) saat mod belum terpasang", () => {
    const consoleSpy = vi.spyOn(console, "log").mockImplementation(() => {});

    const detail: ComprehensiveModDetail = {
      title: "FerriteCore",
      slug: "ferrite-core",
      projectType: "mod",
      status: "not_installed",
      isInstalled: false,
      latestVersion: "6.0.1",
    };

    renderComprehensiveModDetailCard(detail);
    expect(consoleSpy).toHaveBeenCalled();
    const output = consoleSpy.mock.calls[0][0];
    expect(output).toContain("Belum Terpasang");

    consoleSpy.mockRestore();
  });
});

describe("buildRemoteModDetail", () => {
  it("mengidentifikasi mod sebagai terpasang saat ditemukan di InstalledAssetsIndex", async () => {
    vi.spyOn(modrinthClient, "getProject").mockResolvedValue({
      id: "AANobbMI",
      slug: "sodium",
      title: "Sodium",
      project_type: "mod",
      downloads: 1000000,
      followers: 50000,
    } as any);

    vi.spyOn(modrinthClient, "getProjectVersions").mockResolvedValue([
      {
        id: "ver-1",
        project_id: "AANobbMI",
        version_number: "0.5.8",
        game_versions: ["1.20.1"],
        loaders: ["fabric"],
        files: [{primary: true, filename: "sodium-0.5.8.jar", size: 123456, hashes: {}}],
        dependencies: [],
      } as any,
    ]);

    const fakeIndex = new InstalledAssetsIndex();
    // Simulate indexed mod
    (fakeIndex as any).slugMap.set("sodium", {
      isInstalled: true,
      version: "0.5.8",
      filename: "sodium-fabric-0.5.8.jar",
      isDisabled: false,
      assetType: "mod",
    });

    const instance: SavedInstanceConfig = {
      name: "Test Inst",
      launcher: "Vanilla",
      rootDir: "/mock/dir",
      modsDir: "/mock/dir/mods",
    };

    const {detail} = await buildRemoteModDetail(
      "sodium",
      "fabric",
      "1.20.1",
      instance,
      fakeIndex,
    );

    expect(detail.isInstalled).toBe(true);
    expect(detail.status).toBe("active");
    expect(detail.installedVersion).toBe("0.5.8");
    expect(detail.title).toBe("Sodium");

    vi.restoreAllMocks();
  });

  it("mengidentifikasi mod sebagai not_installed saat tidak ada di InstalledAssetsIndex", async () => {
    vi.spyOn(modrinthClient, "getProject").mockResolvedValue({
      id: "UNKNOWN123",
      slug: "unknown-mod",
      title: "Unknown Mod",
      project_type: "mod",
    } as any);

    vi.spyOn(modrinthClient, "getProjectVersions").mockResolvedValue([
      {
        id: "ver-2",
        project_id: "UNKNOWN123",
        version_number: "1.0.0",
        game_versions: ["1.20.1"],
        loaders: ["fabric"],
        files: [{primary: true, filename: "unknown-1.0.0.jar", size: 5000, hashes: {}}],
        dependencies: [],
      } as any,
    ]);

    const fakeIndex = new InstalledAssetsIndex();

    const {detail} = await buildRemoteModDetail(
      "unknown-mod",
      "fabric",
      "1.20.1",
      undefined,
      fakeIndex,
    );

    expect(detail.isInstalled).toBe(false);
    expect(detail.status).toBe("not_installed");
    expect(detail.installedVersion).toBeUndefined();

    vi.restoreAllMocks();
  });
});
