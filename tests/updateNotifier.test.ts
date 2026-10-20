import { describe, it, expect, vi, beforeEach } from "vitest";
import { checkCliUpdate } from "../src/utils/updateNotifier.js";

describe("CLI Update Notifier", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("should return null if npm returns the same or older version", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ version: "2.8.0" }),
      })
    );

    const result = await checkCliUpdate();
    expect(result).toBeNull();
  });

  it("should return newer version string if npm returns a higher version", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ version: "2.9.0" }),
      })
    );

    const result = await checkCliUpdate();
    if (result) {
      expect(result).toBe("2.9.0");
    }
  });

  it("should gracefully handle network failure without throwing", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockRejectedValue(new Error("Network timeout"))
    );

    await expect(checkCliUpdate()).resolves.not.toThrow();
  });
});

