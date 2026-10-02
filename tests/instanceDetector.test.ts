import { describe, it, expect } from "vitest";

describe("InstanceDetector Regex & Version Extraction", () => {
  const versionRegex =
    /(?:mc|minecraft)[-_ ]?((?:1\.(?:1[2-9]|2[0-9])(?:\.[0-9]+)?)|26\.\d+)|[-_+](1\.(?:1[2-9]|2[0-9])(?:\.[0-9]+)?|26\.\d+)/i;

  function extractMinecraftVersion(filename: string): string | null {
    const m = filename.match(versionRegex);
    return m ? (m[1] || m[2]) : null;
  }

  it("harus mengekstrak versi Minecraft yang benar dari nama berkas dengan pola umum", () => {
    expect(extractMinecraftVersion("sodium-fabric-0.5.8+mc1.20.1.jar")).toBe("1.20.1");
    expect(extractMinecraftVersion("fabric-api-0.100.0+1.21.1.jar")).toBe("1.21.1");
    expect(extractMinecraftVersion("jei-1.20.1-fabric-15.3.0.4.jar")).toBe("1.20.1");
    expect(extractMinecraftVersion("iris-mc1.21-1.7.0.jar")).toBe("1.21");
    expect(extractMinecraftVersion("mod-minecraft_1.19.4.jar")).toBe("1.19.4");
    expect(extractMinecraftVersion("test-26.2.jar")).toBe("26.2");
  });

  it("tidak boleh salah menangkap nomor versi internal mod sebagai versi Minecraft (BUG-001)", () => {
    expect(extractMinecraftVersion("architectury-9.2.14-fabric.jar")).toBeNull();
    expect(extractMinecraftVersion("cloth-config-11.1.118-fabric.jar")).toBeNull();
    expect(extractMinecraftVersion("ferritecore-6.0.1-fabric.jar")).toBeNull();
    expect(extractMinecraftVersion("sodium-0.6.0.jar")).toBeNull();
  });
});
