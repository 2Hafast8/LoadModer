import {describe, it, expect, beforeEach} from "vitest";
import {MemoryCache} from "../src/api/cache.js";

describe("Performance Improvements & Regression Suite", () => {
  describe("PERF-006: Bounded In-Memory Cache with LRU Eviction", () => {
    it("harus menghormati batas maxSize dan mengusir entri tertua (LRU)", () => {
      const cache = new MemoryCache(60000, 3);

      cache.set("a", 1);
      cache.set("b", 2);
      cache.set("c", 3);

      expect(cache.size()).toBe(3);
      expect(cache.get("a")).toBe(1);
      expect(cache.get("b")).toBe(2);
      expect(cache.get("c")).toBe(3);

      cache.get("a");
      cache.get("b");

      cache.set("d", 4);
      expect(cache.size()).toBe(3);
      expect(cache.get("c")).toBeUndefined();
      expect(cache.get("a")).toBe(1);
      expect(cache.get("b")).toBe(2);
      expect(cache.get("d")).toBe(4);
    });

    it("harus menghapus entri yang telah kedaluwarsa (TTL)", async () => {
      const cache = new MemoryCache(10, 10);
      cache.set("short-lived", "halo");

      expect(cache.get("short-lived")).toBe("halo");

      await new Promise((resolve) => setTimeout(resolve, 25));

      expect(cache.get("short-lived")).toBeUndefined();
    });
  });
});
