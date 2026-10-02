import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  isMinecraftVersionAtLeast1_16,
  compareMinecraftVersionsDesc,
  getMinecraftReleaseVersions,
  FALLBACK_MINECRAFT_VERSIONS,
} from '../src/core/minecraft/versions.js';
import { getMinecraftVersionChoices, type InteractiveChoice } from '../src/ui/interactive.js';
import { modrinthClient } from '../src/api/client.js';

describe('Minecraft Versions Management', () => {
  describe('isMinecraftVersionAtLeast1_16', () => {
    it('harus menerima versi 1.16 ke atas (1.16, 1.16.5, 1.20.1, 1.21.1, dst)', () => {
      expect(isMinecraftVersionAtLeast1_16('1.16')).toBe(true);
      expect(isMinecraftVersionAtLeast1_16('1.16.1')).toBe(true);
      expect(isMinecraftVersionAtLeast1_16('1.16.5')).toBe(true);
      expect(isMinecraftVersionAtLeast1_16('1.18.2')).toBe(true);
      expect(isMinecraftVersionAtLeast1_16('1.20.1')).toBe(true);
      expect(isMinecraftVersionAtLeast1_16('1.21.1')).toBe(true);
      expect(isMinecraftVersionAtLeast1_16('1.21.4')).toBe(true);
    });

    it('harus menerima penomoran versi modern / tahun seperti 26.x ke atas', () => {
      expect(isMinecraftVersionAtLeast1_16('26.1')).toBe(true);
      expect(isMinecraftVersionAtLeast1_16('26.2')).toBe(true);
      expect(isMinecraftVersionAtLeast1_16('26.3')).toBe(true);
      expect(isMinecraftVersionAtLeast1_16('2.0')).toBe(true);
    });

    it('harus menolak versi di bawah 1.16 (1.15.2, 1.12.2, 1.8.9, 1.7.10, dst)', () => {
      expect(isMinecraftVersionAtLeast1_16('1.15.2')).toBe(false);
      expect(isMinecraftVersionAtLeast1_16('1.14.4')).toBe(false);
      expect(isMinecraftVersionAtLeast1_16('1.12.2')).toBe(false);
      expect(isMinecraftVersionAtLeast1_16('1.8.9')).toBe(false);
      expect(isMinecraftVersionAtLeast1_16('1.7.10')).toBe(false);
      expect(isMinecraftVersionAtLeast1_16('1.0')).toBe(false);
      expect(isMinecraftVersionAtLeast1_16('0.9.0')).toBe(false);
    });

    it('harus menangani string kosong, null, atau format aneh', () => {
      expect(isMinecraftVersionAtLeast1_16('')).toBe(false);
      expect(isMinecraftVersionAtLeast1_16('   ')).toBe(false);
      expect(isMinecraftVersionAtLeast1_16('snapshot-alpha')).toBe(false);
      expect(isMinecraftVersionAtLeast1_16(undefined as any)).toBe(false);
    });
  });

  describe('compareMinecraftVersionsDesc', () => {
    it('harus mengurutkan versi secara semantik dari yang terbaru ke terlama', () => {
      const unsorted = ['1.16.5', '26.2', '1.20.1', '1.21.1', '1.16', '1.21', '26.1'];
      const sorted = [...unsorted].sort(compareMinecraftVersionsDesc);

      expect(sorted).toEqual(['26.2', '26.1', '1.21.1', '1.21', '1.20.1', '1.16.5', '1.16']);
    });

    it('harus memposisikan patch version lebih tinggi dari base version', () => {
      expect(compareMinecraftVersionsDesc('1.21.1', '1.21')).toBeLessThan(0);
      expect(compareMinecraftVersionsDesc('1.20.4', '1.20.1')).toBeLessThan(0);
    });
  });

  describe('getMinecraftReleaseVersions', () => {
    beforeEach(() => {
      vi.spyOn(modrinthClient, 'getGameVersions').mockResolvedValue(
        FALLBACK_MINECRAFT_VERSIONS.map((v) => ({
          version: v,
          version_type: 'release' as const,
          date: '2026-01-01T00:00:00Z',
          major: true,
        }))
      );
    });

    it('seluruh versi fallback harus memenuhi kriteria >= 1.16', () => {
      for (const ver of FALLBACK_MINECRAFT_VERSIONS) {
        expect(isMinecraftVersionAtLeast1_16(ver)).toBe(true);
      }
    });

    it('harus mengembalikan daftar versi di mana tidak ada yang < 1.16', async () => {
      const versions = await getMinecraftReleaseVersions();
      expect(versions.length).toBeGreaterThanOrEqual(FALLBACK_MINECRAFT_VERSIONS.length);

      for (const ver of versions) {
        expect(isMinecraftVersionAtLeast1_16(ver)).toBe(true);
      }
    });
  });

  describe('getMinecraftVersionChoices', () => {
    beforeEach(() => {
      vi.spyOn(modrinthClient, 'getGameVersions').mockResolvedValue(
        FALLBACK_MINECRAFT_VERSIONS.map((v) => ({
          version: v,
          version_type: 'release' as const,
          date: '2026-01-01T00:00:00Z',
          major: true,
        }))
      );
    });

    it('harus menandai versi aktif saat ini dengan tag yang tepat', async () => {
      const choices = await getMinecraftVersionChoices('1.21.1');
      const activeChoice = choices.find((c: InteractiveChoice) => c.value === '1.21.1');

      expect(activeChoice).toBeDefined();
      expect(activeChoice?.name).toContain('● Minecraft 1.21.1');
      expect(activeChoice?.hint).toContain('Aktif Saat Ini');
    });

    it('harus menyertakan badge highlight untuk versi populer', async () => {
      const choices = await getMinecraftVersionChoices('1.16.5');
      const pop120 = choices.find((c: InteractiveChoice) => c.value === '1.20.1');

      expect(pop120).toBeDefined();
      expect(pop120?.hint).toBe('Koleksi Mod Terbesar');
    });
  });
});
