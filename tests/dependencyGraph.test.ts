import {describe, it, expect, beforeEach, afterEach} from "vitest";
import path from "node:path";
import {mkdtemp, rm} from "node:fs/promises";
import os from "node:os";
import {DependencyGraph} from "../src/core/dependency/graph.js";

describe("DependencyGraph", () => {
  let tempDir: string;
  let graph: DependencyGraph;

  beforeEach(async () => {
    tempDir = await mkdtemp(path.join(os.tmpdir(), "loadmoder-test-"));
    graph = new DependencyGraph(tempDir, "1.21.1", "fabric");
    await graph.load();
  });

  afterEach(async () => {
    await rm(tempDir, {recursive: true, force: true});
  });

  it("harus dapat meregistrasi mod root dan dependensinya", async () => {
    graph.registerMod("sodium", {
      projectId: "AANobbMI",
      versionId: "ver1",
      versionNumber: "0.6.0",
      filename: "sodium-0.6.0.jar",
      sha512: "hash1",
      isRoot: true,
      dependencies: ["fabric-api"],
    });

    graph.registerMod("fabric-api", {
      projectId: "P7dR8mSH",
      versionId: "ver2",
      versionNumber: "0.102.0",
      filename: "fabric-api-0.102.0.jar",
      sha512: "hash2",
      isRoot: false,
      dependencies: [],
    });

    const sodium = graph.getMod("sodium");
    const fabricApi = graph.getMod("fabric-api");

    expect(sodium).toBeDefined();
    expect(sodium?.isRoot).toBe(true);
    expect(fabricApi?.isRoot).toBe(false);
    expect(fabricApi?.dependedBy).toContain("sodium");
  });

  it("harus mendeteksi dependensi yatim (orphan) ketika mod root dihapus", async () => {
    graph.registerMod("sodium", {
      projectId: "AANobbMI",
      versionId: "ver1",
      versionNumber: "0.6.0",
      filename: "sodium-0.6.0.jar",
      sha512: "hash1",
      isRoot: true,
      dependencies: ["fabric-api"],
    });

    graph.registerMod("fabric-api", {
      projectId: "P7dR8mSH",
      versionId: "ver2",
      versionNumber: "0.102.0",
      filename: "fabric-api-0.102.0.jar",
      sha512: "hash2",
      isRoot: false,
      dependencies: [],
    });

    const {removedMod, orphanedSlugs} = graph.removeMod("sodium");
    expect(removedMod).toBeDefined();
    expect(orphanedSlugs).toContain("fabric-api");
  });

  it("harus merekonsiliasi data lockfile jika berkas mod dihapus secara manual dari disk", async () => {
    const fs = await import("node:fs/promises");
    const modsDir = path.join(tempDir, "mods");
    await fs.mkdir(modsDir, {recursive: true});

    graph.registerMod("sodium", {
      projectId: "AANobbMI",
      versionId: "ver1",
      versionNumber: "0.6.0",
      filename: "sodium-0.6.0.jar",
      sha512: "hash1",
      isRoot: true,
      dependencies: ["fabric-api"],
    });

    graph.registerMod("fabric-api", {
      projectId: "P7dR8mSH",
      versionId: "ver2",
      versionNumber: "0.102.0",
      filename: "fabric-api-0.102.0.jar",
      sha512: "hash2",
      isRoot: false,
      dependencies: [],
    });

    await graph.save();

    await fs.writeFile(path.join(modsDir, "fabric-api-0.102.0.jar"), "dummy");

    const result = await graph.reconcileWithDisk(modsDir);

    expect(result.unregistered).toContain("sodium");
    expect(result.orphanedSlugs).toContain("fabric-api");
    expect(graph.getMod("sodium")).toBeUndefined();
  });

  it("harus menghubungkan dependensi dan mendeteksi orphan ketika dependensi direferensikan via projectId (DATA-001)", async () => {
    graph.registerMod("sodium", {
      projectId: "AANobbMI",
      versionId: "ver1",
      versionNumber: "0.6.0",
      filename: "sodium-0.6.0.jar",
      sha512: "hash1",
      isRoot: true,
      dependencies: ["P7dR8mSH"],
    });

    graph.registerMod("fabric-api", {
      projectId: "P7dR8mSH",
      versionId: "ver2",
      versionNumber: "0.102.0",
      filename: "fabric-api-0.102.0.jar",
      sha512: "hash2",
      isRoot: false,
      dependencies: [],
    });

    const fabricApi = graph.getMod("fabric-api");
    expect(fabricApi?.dependedBy).toContain("sodium");

    const { removedMod, orphanedSlugs } = graph.removeMod("sodium");
    expect(removedMod).toBeDefined();
    expect(orphanedSlugs).toContain("fabric-api");
  });

  it("harus membuat file backup ketika lockfile rusak / corrupt (DATA-002)", async () => {
    const fs = await import("node:fs/promises");
    await fs.writeFile(graph.lockfilePath, "{ unparseable invalid json !@#$", "utf8");

    await graph.load();

    expect(graph.data.mods).toEqual({});
    const files = await fs.readdir(tempDir);
    const backupFile = files.find((f) => f.includes(".corrupt."));
    expect(backupFile).toBeDefined();
  });

  it("harus dapat meregistrasi dan menghapus aset non-jar (shaderpack dan resourcepack)", async () => {
    graph.registerAsset("shader", "complementary-reimagined", {
      filename: "ComplementaryReimagined_r5.2.2.zip",
      sha512: "sha512_shader_hash",
    });

    graph.registerAsset("resourcepack", "stay-true", {
      filename: "Stay_True_v1.21.zip",
      sha512: "sha512_rp_hash",
    });

    expect(graph.data.shaderpacks?.["complementary-reimagined"]).toBeDefined();
    expect(graph.data.resourcepacks?.["stay-true"]).toBeDefined();

    const shader = graph.findAsset("shader", "complementary-reimagined");
    expect(shader?.entry.filename).toBe("ComplementaryReimagined_r5.2.2.zip");

    const removed = graph.removeAsset("shader", "complementary-reimagined");
    expect(removed).toBe(true);
    expect(graph.data.shaderpacks?.["complementary-reimagined"]).toBeUndefined();
  });

  it("tidak boleh menghapus shader atau resourcepack saat reconcileWithDisk dijalankan", async () => {
    const fs = await import("node:fs/promises");
    const modsDir = path.join(tempDir, "mods");
    const shaderDir = path.join(tempDir, "shaderpacks");
    const rpDir = path.join(tempDir, "resourcepacks");

    await fs.mkdir(modsDir, { recursive: true });
    await fs.mkdir(shaderDir, { recursive: true });
    await fs.mkdir(rpDir, { recursive: true });

    await fs.writeFile(path.join(modsDir, "sodium-0.6.0.jar"), "dummy");
    await fs.writeFile(path.join(shaderDir, "BSL_v8.2.zip"), "dummy");
    await fs.writeFile(path.join(rpDir, "Bare_Bones.zip"), "dummy");

    graph.registerMod("sodium", {
      projectId: "AANobbMI",
      versionId: "ver1",
      versionNumber: "0.6.0",
      filename: "sodium-0.6.0.jar",
      sha512: "hash1",
      isRoot: true,
      dependencies: [],
    });

    graph.registerAsset("shader", "bsl", {
      filename: "BSL_v8.2.zip",
      sha512: "shader_hash",
    });

    graph.registerAsset("resourcepack", "bare-bones", {
      filename: "Bare_Bones.zip",
      sha512: "rp_hash",
    });

    await graph.save();

    const result = await graph.reconcileWithDisk(modsDir, tempDir);

    expect(result.unregistered).toHaveLength(0);
    expect(graph.data.mods["sodium"]).toBeDefined();
    expect(graph.data.shaderpacks?.["bsl"]).toBeDefined();
    expect(graph.data.resourcepacks?.["bare-bones"]).toBeDefined();
  });

  it("harus dapat menemukan dan menghapus mod menggunakan nama berkas (filename) dan filename.disabled", async () => {
    graph.registerMod("sodium", {
      projectId: "AANobbMI",
      versionId: "ver1",
      versionNumber: "0.6.0",
      filename: "sodium-fabric-0.6.0+mc1.21.1.jar",
      sha512: "hash1",
      isRoot: true,
      dependencies: [],
    });

    const matchByFilename = graph.findMod("sodium-fabric-0.6.0+mc1.21.1.jar");
    expect(matchByFilename).toBeDefined();
    expect(matchByFilename?.slug).toBe("sodium");

    const matchByDisabled = graph.findMod("sodium-fabric-0.6.0+mc1.21.1.jar.disabled");
    expect(matchByDisabled).toBeDefined();
    expect(matchByDisabled?.slug).toBe("sodium");

    const removeRes = graph.removeMod("sodium-fabric-0.6.0+mc1.21.1.jar");
    expect(removeRes.removedMod).toBeDefined();
    expect(graph.data.mods["sodium"]).toBeUndefined();
  });
});
