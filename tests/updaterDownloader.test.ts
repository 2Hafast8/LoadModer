import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import os from "node:os";
import path from "node:path";
import crypto from "node:crypto";
import { promises as fs } from "node:fs";
import { downloadReleaseAsset, MIN_EXE_BYTES } from "../src/core/updater/downloader.js";

function createMockStream(chunks: Buffer[]): ReadableStream<Uint8Array> {
  return new ReadableStream({
    start(controller) {
      for (const chunk of chunks) {
        controller.enqueue(chunk);
      }
      controller.close();
    },
  });
}

describe("Updater Downloader Multi-Layer Integrity Hardening", () => {
  const tempDir = path.join(os.tmpdir(), "loadmoder-update");

  beforeEach(async () => {
    await fs.mkdir(tempDir, { recursive: true });
    vi.restoreAllMocks();
  });

  afterEach(async () => {
    vi.restoreAllMocks();
  });

  it("should reject when downloaded bytes does not match content-length header (truncated stream)", async () => {
    const chunk = Buffer.from("MZ" + "X".repeat(500));
    const fakeTotal = 1500; // Header claims 1500 bytes, but only ~502 bytes are sent

    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        statusText: "OK",
        headers: new Headers({ "content-length": fakeTotal.toString() }),
        body: createMockStream([chunk]),
      })
    );

    const fileName = "test-truncated.exe";
    const result = await downloadReleaseAsset("https://fake.url/test.exe", fileName, {
      minBytes: 0, // Bypass 30MB guard to specifically test content-length matching
    });

    expect(result.success).toBe(false);
    expect(result.error).toContain("Unduhan terputus");

    const partPath = path.join(tempDir, `${fileName}.part`);
    const targetPath = path.join(tempDir, fileName);
    await expect(fs.access(partPath)).rejects.toThrow();
    await expect(fs.access(targetPath)).rejects.toThrow();
  });

  it("should reject when downloaded bytes does not match authoritative expectedSize", async () => {
    const chunk = Buffer.from("MZ" + "Y".repeat(800));

    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        statusText: "OK",
        headers: new Headers({ "content-length": chunk.length.toString() }),
        body: createMockStream([chunk]),
      })
    );

    const fileName = "test-size-mismatch.exe";
    const result = await downloadReleaseAsset("https://fake.url/test.exe", fileName, {
      expectedSize: 5000, // Metadata claims 5000 bytes
      minBytes: 0,
    });

    expect(result.success).toBe(false);
    expect(result.error).toContain("Ukuran berkas tidak sesuai");

    const partPath = path.join(tempDir, `${fileName}.part`);
    await expect(fs.access(partPath)).rejects.toThrow();
  });

  it("should reject when executable binary is below default MIN_EXE_BYTES (30 MB)", async () => {
    const chunk = Buffer.from("MZ" + "Z".repeat(1024)); // Only ~1 KB

    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        statusText: "OK",
        headers: new Headers({ "content-length": chunk.length.toString() }),
        body: createMockStream([chunk]),
      })
    );

    const fileName = "LoadModer-Setup-small.exe";
    const result = await downloadReleaseAsset("https://fake.url/setup.exe", fileName);

    expect(result.success).toBe(false);
    expect(result.error).toContain("Ukuran biner tidak valid");
    expect(result.error).toContain("minimum");

    const partPath = path.join(tempDir, `${fileName}.part`);
    await expect(fs.access(partPath)).rejects.toThrow();
  });

  it("should reject when Windows executable lacks MZ magic bytes", async () => {
    const textContent = Buffer.from("HTML ERROR: 404 Not Found or Corrupted Data");

    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        statusText: "OK",
        headers: new Headers({ "content-length": textContent.length.toString() }),
        body: createMockStream([textContent]),
      })
    );

    const fileName = "fake-binary.exe";
    const result = await downloadReleaseAsset("https://fake.url/fake.exe", fileName, {
      minBytes: 0,
    });

    expect(result.success).toBe(false);
    expect(result.error).toContain("MZ magic missing");

    const partPath = path.join(tempDir, `${fileName}.part`);
    await expect(fs.access(partPath)).rejects.toThrow();
  });

  it("should reject when SHA-256 checksum does not match expected hash", async () => {
    const chunk = Buffer.from("MZ" + "VALID_BYTES".repeat(50));

    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        statusText: "OK",
        headers: new Headers({ "content-length": chunk.length.toString() }),
        body: createMockStream([chunk]),
      })
    );

    const fileName = "test-hash-mismatch.exe";
    const result = await downloadReleaseAsset("https://fake.url/test.exe", fileName, {
      minBytes: 0,
      expectedSha256: "0000000000000000000000000000000000000000000000000000000000000000",
    });

    expect(result.success).toBe(false);
    expect(result.error).toContain("SHA-256 mismatch");

    const partPath = path.join(tempDir, `${fileName}.part`);
    await expect(fs.access(partPath)).rejects.toThrow();
  });

  it("should succeed and atomically rename when all multi-layer validations pass", async () => {
    const chunk = Buffer.from("MZ" + "VALID_RELEASE_CONTENT".repeat(40));
    const expectedSha256 = crypto.createHash("sha256").update(chunk).digest("hex");

    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        statusText: "OK",
        headers: new Headers({ "content-length": chunk.length.toString() }),
        body: createMockStream([chunk]),
      })
    );

    const fileName = "LoadModer-Valid-Update.exe";
    const progressList: number[] = [];

    const result = await downloadReleaseAsset("https://fake.url/valid.exe", fileName, {
      minBytes: 0,
      expectedSize: chunk.length,
      expectedSha256,
      onProgress: (p) => progressList.push(p.percent),
    });

    expect(result.success).toBe(true);
    expect(result.filePath).toBe(path.join(tempDir, fileName));
    expect(result.sha256).toBe(expectedSha256);

    // Verify file actually exists at target path and contains valid data
    const saved = await fs.readFile(result.filePath!);
    expect(saved.equals(chunk)).toBe(true);

    // Verify .part is cleaned up
    const partPath = path.join(tempDir, `${fileName}.part`);
    await expect(fs.access(partPath)).rejects.toThrow();

    // Verify progress hit 100%
    expect(progressList).toContain(100);

    // Cleanup test target file
    await fs.unlink(result.filePath!).catch(() => {});
  });

  it("should clean up pre-existing stale or damaged files before downloading fresh", async () => {
    const fileName = "stale-test.exe";
    const targetPath = path.join(tempDir, fileName);
    const partPath = `${targetPath}.part`;

    // Write stale files
    await fs.writeFile(targetPath, "OLD_STALE_TARGET");
    await fs.writeFile(partPath, "OLD_STALE_PART");

    const chunk = Buffer.from("MZ" + "FRESH_CONTENT".repeat(30));
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        statusText: "OK",
        headers: new Headers({ "content-length": chunk.length.toString() }),
        body: createMockStream([chunk]),
      })
    );

    const result = await downloadReleaseAsset("https://fake.url/stale.exe", fileName, {
      minBytes: 0,
    });

    expect(result.success).toBe(true);
    const saved = await fs.readFile(targetPath);
    expect(saved.equals(chunk)).toBe(true);

    // Cleanup
    await fs.unlink(targetPath).catch(() => {});
  });
});

