import { describe, it, expect } from "vitest";
import { renderMarkdownToTerminal } from "../src/utils/markdown.js";
import { MrpackFileEntrySchema } from "../src/types/mrpack.js";
import { ProfileSnapshotManager } from "../src/core/profile/snapshotManager.js";

describe("Security Regressions Suite", () => {
  describe("SEC-001: Collision Prevention in Slug Matching", () => {
    it("tidak boleh mencocokkan companion mod seperti sodium-extra saat slug adalah sodium", () => {
      const slug = "sodium";
      const escapedSlug = slug.toLowerCase().replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      const versionRegex = new RegExp(`^${escapedSlug}[-_][0-9v]`, "i");

      expect(versionRegex.test("sodium-0.6.0.jar")).toBe(true);
      expect(versionRegex.test("sodium_v0.5.1.jar")).toBe(true);
      expect(versionRegex.test("sodium-extra-0.5.4.jar")).toBe(false);
      expect(versionRegex.test("sodiumextra-1.0.jar")).toBe(false);
    });

    it("tidak boleh mencocokkan fabric-api saat slug adalah fabric", () => {
      const slug = "fabric";
      const escapedSlug = slug.toLowerCase().replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      const versionRegex = new RegExp(`^${escapedSlug}[-_][0-9v]`, "i");

      expect(versionRegex.test("fabric-loader-0.16.jar")).toBe(false);
      expect(versionRegex.test("fabric-api-0.100.jar")).toBe(false);
      expect(versionRegex.test("fabric-0.15.jar")).toBe(true);
    });
  });

  describe("SEC-003: Terminal Escape & Control Code Sanitization", () => {
    it("harus membersihkan kode ANSI escape sequences dan OSC commands", () => {
      const maliciousInput = "\x1b[2J\x1b[31mBahaya!\x1b[0m\x1b]52;c;c3RlYWw=\x07Injeksi Terminal";
      const output = renderMarkdownToTerminal(maliciousInput);

      expect(output).not.toContain("\x1b[2J");
      expect(output).not.toContain("\x1b]52;");
      expect(output).not.toContain("\x07");
      expect(output).toContain("Bahaya!");
      expect(output).toContain("Injeksi Terminal");
    });
  });

  describe("SEC-004: SSRF & Safe URLs in Modpack Schema", () => {
    const validBase = {
      path: "mods/sodium.jar",
      hashes: {
        sha1: "da39a3ee5e6b4b0d3255bfef95601890afd80709",
        sha512: "cf83e1357eefb8bdf1542850d66d8007d620e4050b5715dc83f4a921d36ce9ce47d0d13c5d85f2b0ff8318d2877eec2f63b931bd47417a81a538327af927da3e",
      },
      fileSize: 1024,
    };

    it("harus mengizinkan URL publik HTTPS yang valid", () => {
      const result = MrpackFileEntrySchema.safeParse({
        ...validBase,
        downloads: ["https://cdn.modrinth.com/data/AANobbMI/versions/sodium-0.6.0.jar"],
      });
      expect(result.success).toBe(true);
    });

    it("harus menolak URL non-HTTPS", () => {
      const result = MrpackFileEntrySchema.safeParse({
        ...validBase,
        downloads: ["http://cdn.modrinth.com/data/AANobbMI/versions/sodium-0.6.0.jar"],
      });
      expect(result.success).toBe(false);
    });

    it("harus menolak URL loopback localhost dan 127.0.0.1", () => {
      const resultLocal = MrpackFileEntrySchema.safeParse({
        ...validBase,
        downloads: ["https://localhost/exploit.jar"],
      });
      expect(resultLocal.success).toBe(false);

      const resultIp = MrpackFileEntrySchema.safeParse({
        ...validBase,
        downloads: ["https://127.0.0.1/exploit.jar"],
      });
      expect(resultIp.success).toBe(false);
    });

    it("harus menolak AWS cloud metadata IP dan private LAN IP", () => {
      const resultMetadata = MrpackFileEntrySchema.safeParse({
        ...validBase,
        downloads: ["https://169.254.169.254/latest/meta-data/"],
      });
      expect(resultMetadata.success).toBe(false);

      const resultPrivate = MrpackFileEntrySchema.safeParse({
        ...validBase,
        downloads: ["https://192.168.1.100/internal.jar"],
      });
      expect(resultPrivate.success).toBe(false);
    });
  });

  describe("SEC-POT-002: Snapshot ID Sanitization", () => {
    it("harus mensterilkan sekuens .. untuk mencegah directory traversal", () => {
      const manager = new ProfileSnapshotManager();
      const id = manager.buildSnapshotId("../../fabric", "1.21.1");
      expect(id).not.toContain("..");
      expect(id).toBe("____fabric-1.21.1");
    });
  });
});
