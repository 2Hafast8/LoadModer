import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { mkdtemp, rm } from "node:fs/promises";
import path from "node:path";
import os from "node:os";
import { listCommand } from "../src/commands/list.js";
import { searchCommand } from "../src/commands/search.js";
import { modrinthClient } from "../src/api/client.js";

describe("CLI JSON Output Purity (BUG-005)", () => {
  let tempDir: string;
  let consoleSpy: any;
  let loggedOutput: string[];

  beforeEach(async () => {
    tempDir = await mkdtemp(path.join(os.tmpdir(), "lm-json-test-"));
    loggedOutput = [];
    consoleSpy = vi.spyOn(console, "log").mockImplementation((...args) => {
      loggedOutput.push(args.join(" "));
    });
  });

  afterEach(async () => {
    consoleSpy.mockRestore();
    await rm(tempDir, { recursive: true, force: true });
  });

  it("listCommand dengan flag json pada folder kosong harus menghasilkan JSON array murni tanpa ANSI escape", async () => {
    await listCommand({ dir: tempDir, json: true });

    expect(loggedOutput.length).toBeGreaterThan(0);
    const rawOut = loggedOutput[0];
    expect(rawOut).not.toContain("\u001b");
    const parsed = JSON.parse(rawOut);
    expect(Array.isArray(parsed)).toBe(true);
    expect(parsed).toHaveLength(0);
  });

  it("searchCommand dengan flag json harus menghasilkan JSON array murni tanpa ANSI escape", async () => {
    vi.spyOn(modrinthClient, "search").mockResolvedValueOnce({
      hits: [
        {
          project_id: "AANobbMI",
          project_type: "mod",
          slug: "sodium",
          author: "jellysquid3",
          title: "Sodium",
          description: "Modern rendering engine",
          categories: ["optimization"],
          display_categories: ["optimization"],
          versions: ["1.21.1"],
          downloads: 1000000,
          follows: 50000,
          icon_url: "",
          date_created: "",
          date_modified: "",
          latest_version: "0.6.0",
          license: "LGPL-3.0",
          client_side: "required",
          server_side: "unsupported",
          gallery: [],
          featured_gallery: "",
          color: 0,
        },
      ],
      offset: 0,
      limit: 10,
      total_hits: 1,
    } as any);

    await searchCommand("sodium", { json: true });

    expect(loggedOutput.length).toBeGreaterThan(0);
    const rawOut = loggedOutput[0];
    expect(rawOut).not.toContain("\u001b");
    const parsed = JSON.parse(rawOut);
    expect(Array.isArray(parsed)).toBe(true);
    expect(parsed[0].slug).toBe("sodium");
  });
});
