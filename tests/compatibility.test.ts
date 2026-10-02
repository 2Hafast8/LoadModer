import {describe, it, expect} from "vitest";
import {computeModCompatibility} from "../src/core/minecraft/compatibility.js";
import type {ModVersion} from "../src/types/modrinth.js";

describe("computeModCompatibility", () => {
  const mockVersions: ModVersion[] = [
    {
      id: "ver-1",
      project_id: "proj-1",
      author_id: "user-1",
      featured: true,
      name: "Release 1.0.0 for Fabric 1.21.1",
      version_number: "1.0.0",
      game_versions: ["1.21.1", "1.21"],
      loaders: ["fabric", "quilt"],
      version_type: "release",
      date_published: "2026-01-01T00:00:00Z",
      downloads: 5000,
      files: [
        {
          hashes: {sha1: "abc1", sha512: "def1"},
          url: "https://example.com/mod.jar",
          filename: "mod-1.0.0.jar",
          primary: true,
          size: 1024,
        },
      ],
      dependencies: [],
    },
    {
      id: "ver-2",
      project_id: "proj-1",
      author_id: "user-1",
      featured: false,
      name: "Beta 1.1.0 for Forge 1.20.1",
      version_number: "1.1.0-beta",
      game_versions: ["1.20.1"],
      loaders: ["forge", "neoforge"],
      version_type: "beta",
      date_published: "2026-02-01T00:00:00Z",
      downloads: 1200,
      files: [],
      dependencies: [],
    },
    {
      id: "ver-3",
      project_id: "proj-1",
      author_id: "user-1",
      featured: true,
      name: "Release 0.9.0 for Vanilla 1.21.1",
      version_number: "0.9.0",
      game_versions: ["1.21.1"],
      loaders: ["minecraft"],
      version_type: "release",
      date_published: "2025-12-01T00:00:00Z",
      downloads: 800,
      files: [],
      dependencies: [],
    },
  ];

  it("harus mengidentifikasi kecocokan persis untuk loader dan versi game", () => {
    const result = computeModCompatibility(mockVersions, "fabric", "1.21.1");

    expect(result.isCompatible).toBe(true);
    expect(result.userLoader).toBe("fabric");
    expect(result.userGameVersion).toBe("1.21.1");
    expect(result.bestCompatibleVersion).toBeDefined();
    expect(result.bestCompatibleVersion?.version_number).toBe("1.0.0");
    expect(result.compatibleVersionCount).toBeGreaterThanOrEqual(1);
  });

  it("harus menerima loader universal seperti minecraft atau vanilla", () => {
    const result = computeModCompatibility(mockVersions, "quilt", "1.21.1");

    expect(result.isCompatible).toBe(true);
    expect(result.compatibleVersionCount).toBe(2);
  });

  it("harus mengembalikan isCompatible false jika versi game tidak didukung", () => {
    const result = computeModCompatibility(mockVersions, "fabric", "1.18.2");

    expect(result.isCompatible).toBe(false);
    expect(result.compatibleVersionCount).toBe(0);
    expect(result.bestCompatibleVersion).toBeUndefined();
  });

  it("harus mengembalikan isCompatible false jika loader tidak didukung", () => {
    const result = computeModCompatibility(mockVersions, "rift", "1.20.1");

    expect(result.isCompatible).toBe(false);
    expect(result.compatibleVersionCount).toBe(0);
  });

  it("harus menghimpun daftar seluruh loader dan versi game yang tersedia", () => {
    const result = computeModCompatibility(mockVersions, "fabric", "1.21.1");

    expect(result.availableLoaders).toContain("fabric");
    expect(result.availableLoaders).toContain("forge");
    expect(result.availableGameVersions).toContain("1.21.1");
    expect(result.availableGameVersions).toContain("1.20.1");
  });
});
