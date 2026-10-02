import {describe, it, expect, beforeEach, afterEach} from "vitest";
import path from "node:path";
import os from "node:os";
import {mkdtemp, rm, writeFile} from "node:fs/promises";
import {ModsWatcher} from "../src/core/watcher/modsWatcher.js";

describe("ModsWatcher", () => {
  let tmpDir: string;
  let modsDir: string;
  let watcher: ModsWatcher;

  beforeEach(async () => {
    tmpDir = await mkdtemp(path.join(os.tmpdir(), "lm-watcher-test-"));
    modsDir = path.join(tmpDir, "mods");
    await writeFile(path.join(tmpDir, "dummy"), "");
    const {mkdir} = await import("node:fs/promises");
    await mkdir(modsDir, {recursive: true});
    watcher = new ModsWatcher(modsDir, tmpDir);
  });

  afterEach(async () => {
    watcher.stop();
    await rm(tmpDir, {recursive: true, force: true});
  });

  it("harus dapat memulai dan menghentikan watcher", () => {
    expect(watcher.running).toBe(false);

    watcher.start();
    expect(watcher.running).toBe(true);

    watcher.stop();
    expect(watcher.running).toBe(false);
  });

  it("harus merekonsiliasi dan unregister mod yang dihapus dari disk", async () => {
    const {DependencyGraph} = await import("../src/core/dependency/graph.js");
    const graph = new DependencyGraph(tmpDir);
    await graph.load();
    graph.registerMod("deleted-mod", {
      projectId: "proj-del",
      versionId: "ver-del",
      versionNumber: "1.0.0",
      filename: "deleted-mod.jar",
      sha512: "fake-hash",
      dependencies: [],
      isRoot: true,
    });
    await graph.save();

    const syncEvent = await watcher.sync();

    expect(syncEvent.unregistered).toContain("deleted-mod");
    expect(syncEvent.orphanedSlugs).toEqual([]);
  });
});
