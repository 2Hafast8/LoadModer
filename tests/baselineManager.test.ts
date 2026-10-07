import { describe, it, expect, beforeEach, afterEach } from "vitest";
import path from "node:path";
import os from "node:os";
import { mkdtemp, rm, mkdir, writeFile, readFile, stat } from "node:fs/promises";
import { BaselineManager } from "../src/core/modpack/baselineManager.js";

describe("BaselineManager (One-Time Golden Snapshot & Permanent Restore)", () => {
  let tmpDir: string;
  let containerDir: string;

  beforeEach(async () => {
    tmpDir = await mkdtemp(path.join(os.tmpdir(), "lm-baseline-test-"));
    containerDir = path.join(tmpDir, "container");
    await mkdir(containerDir, { recursive: true });
  });

  afterEach(async () => {
    await rm(tmpDir, { recursive: true, force: true });
  });

  it("harus membuat baseline snapshot satu kali dan mencatat manifest", async () => {
    // Siapkan file awal di container
    await writeFile(path.join(containerDir, "options.txt"), "fov:70\ngraphics:fancy\n");
    await writeFile(path.join(containerDir, "servers.dat"), "servers_data");
    await mkdir(path.join(containerDir, "config"), { recursive: true });
    await writeFile(path.join(containerDir, "config", "default.json"), "{\"clean\": true}");

    // Jangan backup saves/ dan logs/
    await mkdir(path.join(containerDir, "saves", "world1"), { recursive: true });
    await writeFile(path.join(containerDir, "saves", "world1", "level.dat"), "world");

    const created = await BaselineManager.createBaselineOnce(containerDir);
    expect(created).toBe(true);

    // Verifikasi manifest dan file tersalin di .loadmoder/baseline/
    const manifestPath = BaselineManager.getManifestPath(containerDir);
    const manifestRaw = await readFile(manifestPath, "utf8");
    const manifest = JSON.parse(manifestRaw);

    expect(manifest.filesCount).toBeGreaterThanOrEqual(3);
    expect(manifest.items).toContain("options.txt");

    const baseOpt = await readFile(
      path.join(BaselineManager.getBaselineDir(containerDir), "options.txt"),
      "utf8",
    );
    expect(baseOpt).toBe("fov:70\ngraphics:fancy\n");

    // Pastikan saves/ tidak dicadangkan ke baseline
    const savesInBaseline = await stat(
      path.join(BaselineManager.getBaselineDir(containerDir), "saves"),
    ).catch(() => null);
    expect(savesInBaseline).toBeNull();
  });

  it("TIDAK boleh menimpa baseline jika sudah pernah dibuat (One-Time Only)", async () => {
    await writeFile(path.join(containerDir, "options.txt"), "fov:70 (ORIGINAL)");
    await BaselineManager.createBaselineOnce(containerDir);

    // Sekarang modpack mengubah options.txt
    await writeFile(path.join(containerDir, "options.txt"), "fov:110 (MODPACK MODIFIED)");

    // Panggil lagi createBaselineOnce
    const createdSecondTime = await BaselineManager.createBaselineOnce(containerDir);
    expect(createdSecondTime).toBe(false);

    // Verifikasi: Baseline tetap menyimpan versi ORIGINAL, bukan versi yang diubah modpack
    const baseOpt = await readFile(
      path.join(BaselineManager.getBaselineDir(containerDir), "options.txt"),
      "utf8",
    );
    expect(baseOpt).toBe("fov:70 (ORIGINAL)");
  });

  it("harus memulihkan baseline tanpa menghapus direktori master baseline", async () => {
    await writeFile(path.join(containerDir, "options.txt"), "fov:70 (ORIGINAL)");
    await mkdir(path.join(containerDir, "config"), { recursive: true });
    await writeFile(path.join(containerDir, "config", "base.json"), "{}");

    await BaselineManager.createBaselineOnce(containerDir);

    // Simulasi pembersihan: hapus options.txt dan config/base.json di wadah live
    await rm(path.join(containerDir, "options.txt"), { force: true });
    await rm(path.join(containerDir, "config"), { recursive: true, force: true });

    // Pulihkan baseline
    const restoredCount = await BaselineManager.restoreBaseline(containerDir);
    expect(restoredCount).toBe(2);

    // Verifikasi: file live kembali
    const restoredOpt = await readFile(path.join(containerDir, "options.txt"), "utf8");
    expect(restoredOpt).toBe("fov:70 (ORIGINAL)");

    const restoredConfig = await readFile(path.join(containerDir, "config", "base.json"), "utf8");
    expect(restoredConfig).toBe("{}");

    // Verifikasi krusial: folder .loadmoder/baseline/ TIDAK DIHAPUS
    const hasBaseAfterRestore = await BaselineManager.hasBaseline(containerDir);
    expect(hasBaseAfterRestore).toBe(true);

    // Verifikasi: dapat dipulihkan berulang kali di masa depan
    await rm(path.join(containerDir, "options.txt"), { force: true });
    await BaselineManager.restoreBaseline(containerDir);
    expect(await readFile(path.join(containerDir, "options.txt"), "utf8")).toBe("fov:70 (ORIGINAL)");
  });
});

