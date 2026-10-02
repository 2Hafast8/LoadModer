import {describe, it, expect, vi, beforeEach} from "vitest";
import {modrinthClient} from "../src/api/client.js";
import {CATEGORIES_BY_TYPE, CONTENT_TYPE_LABELS} from "../src/ui/dashboard/browser.js";

describe("Search Filters & Multi-Content Support", () => {
  describe("CATEGORIES_BY_TYPE & CONTENT_TYPE_LABELS", () => {
    it("harus menyediakan label manusiawi untuk semua tipe konten", () => {
      expect(CONTENT_TYPE_LABELS.mod).toContain("Mod");
      expect(CONTENT_TYPE_LABELS.modpack).toContain("Modpack");
      expect(CONTENT_TYPE_LABELS.shader).toContain("Shader");
      expect(CONTENT_TYPE_LABELS.resourcepack).toContain("Resource Pack");
    });

    it("harus memiliki kategori resmi untuk masing-masing tipe konten", () => {
      const modCats = CATEGORIES_BY_TYPE.mod.map((c) => c.slug);
      expect(modCats).toContain("optimization");
      expect(modCats).toContain("adventure");
      expect(modCats).toContain("technology");
      expect(modCats).toContain("magic");

      const shaderCats = CATEGORIES_BY_TYPE.shader.map((c) => c.slug);
      expect(shaderCats).toContain("low");
      expect(shaderCats).toContain("medium");
      expect(shaderCats).toContain("path-tracing");

      const packCats = CATEGORIES_BY_TYPE.resourcepack.map((c) => c.slug);
      expect(packCats).toContain("combat");
      expect(packCats).toContain("faith-vanilla");

      const modpackCats = CATEGORIES_BY_TYPE.modpack.map((c) => c.slug);
      expect(modpackCats).toContain("optimization");
      expect(modpackCats).toContain("quests");
    });
  });

  describe("modrinthClient.search query facet generation", () => {
    let mockFetch: any;

    beforeEach(() => {
      mockFetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({hits: [], offset: 0, limit: 10, total_hits: 0}),
      });
      vi.stubGlobal("fetch", mockFetch);
    });

    it("harus menyertakan project_type, versions, loader, category, dan client_side facets", async () => {
      await modrinthClient.search(
        "sodium",
        {
          projectType: "mod",
          gameVersion: "1.21.1",
          loader: "fabric",
          category: "optimization",
          environment: "client",
        },
        10,
        "downloads",
        0,
      );

      expect(mockFetch).toHaveBeenCalledTimes(1);
      const calledUrl = new URL(mockFetch.mock.calls[0][0]);
      const facetsParam = JSON.parse(calledUrl.searchParams.get("facets") || "[]");

      expect(facetsParam).toContainEqual(["project_type:mod"]);
      expect(facetsParam).toContainEqual(["versions:1.21.1"]);
      expect(facetsParam).toContainEqual(["categories:fabric"]);
      expect(facetsParam).toContainEqual(["categories:optimization"]);
      expect(facetsParam).toContainEqual(["client_side:required", "client_side:optional"]);
    });

    it("harus mendukung pencarian shader tanpa memaksakan loader", async () => {
      await modrinthClient.search(
        "complementary",
        {
          projectType: "shader",
          category: "medium",
        },
        10,
        "downloads",
        0,
      );

      const calledUrl = new URL(mockFetch.mock.calls[0][0]);
      const facetsParam = JSON.parse(calledUrl.searchParams.get("facets") || "[]");

      expect(facetsParam).toContainEqual(["project_type:shader"]);
      expect(facetsParam).toContainEqual(["categories:medium"]);
      // Tidak boleh ada categories:loader
      const hasLoaderCategory = facetsParam.some((f: string[]) =>
        f.some((val: string) => val === "categories:fabric" || val === "categories:forge"),
      );
      expect(hasLoaderCategory).toBe(false);
    });

    it('harus mengabaikan nilai "all" pada gameVersion, loader, dan category', async () => {
      await modrinthClient.search(
        "",
        {
          projectType: "resourcepack",
          gameVersion: "all",
          loader: "all",
          category: "all",
        },
        10,
        "relevance",
        0,
      );

      const calledUrl = new URL(mockFetch.mock.calls[0][0]);
      const facetsParam = JSON.parse(calledUrl.searchParams.get("facets") || "[]");

      expect(facetsParam).toContainEqual(["project_type:resourcepack"]);
      const hasAll = facetsParam.some((f: string[]) =>
        f.some((val: string) => val.endsWith(":all")),
      );
      expect(hasAll).toBe(false);
    });

    it("harus menyertakan server_side facets untuk environment server", async () => {
      await modrinthClient.search(
        "geyser",
        {
          projectType: "mod",
          environment: "server",
        },
        10,
        "relevance",
        0,
      );

      const calledUrl = new URL(mockFetch.mock.calls[0][0]);
      const facetsParam = JSON.parse(calledUrl.searchParams.get("facets") || "[]");

      expect(facetsParam).toContainEqual(["server_side:required", "server_side:optional"]);
    });
  });
});
