import {describe, it, expect, beforeEach, afterEach} from "vitest";
import path from "node:path";
import os from "node:os";
import {mkdtemp, rm} from "node:fs/promises";
import {InstanceConfigManager} from "../src/core/instance/config.js";
import type {SavedInstanceConfig} from "../src/types/instance.js";

describe("InstanceConfigManager", () => {
  let tmpDir: string;
  let configPath: string;
  let manager: InstanceConfigManager;

  beforeEach(async () => {
    tmpDir = await mkdtemp(path.join(os.tmpdir(), "lm-cfg-test-"));
    configPath = path.join(tmpDir, "config.json");
    manager = new InstanceConfigManager(configPath);
  });

  afterEach(async () => {
    await rm(tmpDir, {recursive: true, force: true});
  });

  it("harus memuat konfigurasi default jika file belum ada", async () => {
    const cfg = await manager.load();

    expect(cfg.defaultEnvironment).toBe("client");
    expect(cfg.instances).toEqual({});
    expect(manager.getActiveInstance()).toBeUndefined();
  });

  it("harus dapat menyimpan dan membaca kembali instance baru", async () => {
    const mockInst: SavedInstanceConfig = {
      name: "Fabric 1.21.1",
      launcher: "Prism",
      rootDir: "/fake/mc",
      modsDir: "/fake/mc/mods",
      loader: "fabric",
      gameVersion: "1.21.1",
    };

    manager.saveInstance("inst-1", mockInst, true);
    await manager.save();

    const reader = new InstanceConfigManager(configPath);
    await reader.load();

    expect(reader.getActiveInstance()).toBeDefined();
    expect(reader.getActiveInstance()?.name).toBe("Fabric 1.21.1");
    expect(reader.getActiveInstance()?.loader).toBe("fabric");
  });

  it("harus melempar error saat mengaktifkan instance yang tidak terdaftar", async () => {
    expect(() => manager.setActiveInstance("non-existent")).toThrow(/tidak ditemukan/i);
  });

  it("harus dapat menghapus instance", async () => {
    const mockInst: SavedInstanceConfig = {
      name: "To Delete",
      launcher: "Custom",
      rootDir: "/fake",
      modsDir: "/fake/mods",
      loader: "forge",
      gameVersion: "1.20.1",
    };

    manager.saveInstance("inst-del", mockInst, true);
    expect(manager.getActiveInstance()?.name).toBe("To Delete");

    manager.deleteInstance("inst-del");
    expect(manager.getActiveInstance()).toBeUndefined();
    expect(manager.get().instances["inst-del"]).toBeUndefined();
  });
});
