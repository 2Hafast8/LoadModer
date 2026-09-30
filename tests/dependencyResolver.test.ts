import { describe, it, expect, vi, beforeEach } from 'vitest';
import path from 'node:path';
import {
  extractDependenciesFromText,
  getRequiredLibraries,
  resolveAndInstallDependencies,
  getRequiredDependencyTitles,
  KNOWN_LIBRARIES,
} from '../src/core/dependency/resolver.js';
import type { ModVersion, ModProject } from '../src/types/modrinth.js';
import { DependencyGraph } from '../src/core/dependency/graph.js';
import { modrinthClient } from '../src/api/client.js';

describe('Dependency Resolver & Auto-Install System', () => {
  describe('extractDependenciesFromText', () => {
    it('harus mendeteksi library dari frasa "Requires <Library>"', () => {
      const text = 'This amazing mod requires Fabric API to function properly.';
      const deps = extractDependenciesFromText(text);

      expect(deps).toContain('fabric-api');
    });

    it('harus mendeteksi beberapa library dari kalimat bahasa Indonesia dan Inggris', () => {
      const text = `
        Fitur mod ini sangat lengkap!
        Dependencies:
        - Membutuhkan Cloth Config API untuk menu setting
        - Requires Architectury API
      `;
      const deps = extractDependenciesFromText(text);

      expect(deps).toContain('cloth-config');
      expect(deps).toContain('architectury-api');
    });

    it('harus mendeteksi tautan Modrinth yang berada di bagian requirements', () => {
      const text = `
        ## Requirements
        Please install [Fabric API](https://modrinth.com/mod/fabric-api) before launching.
      `;
      const deps = extractDependenciesFromText(text);

      expect(deps).toContain('fabric-api');
    });

    it('tidak boleh mendeteksi mod rekomendasi atau inkompatibilitas sebagai dependensi wajib', () => {
      const text = `
        This mod is incompatible with Optifine.
        Recommended mods: Sodium, Iris Shaders.
        Credits to the Minecraft community!
      `;
      const deps = extractDependenciesFromText(text);

      expect(deps).toEqual([]);
    });

    it('harus mengembalikan array kosong untuk deskripsi tanpa persyaratan library', () => {
      const text = 'Just a simple standalone mod that adds apples to trees. Enjoy!';
      const deps = extractDependenciesFromText(text);

      expect(deps).toEqual([]);
    });
  });

  describe('getRequiredLibraries', () => {
    it('harus mengambil dependensi berstatus "required" dari metadata API versi', async () => {
      const mockVersion: ModVersion = {
        id: 'ver-123',
        project_id: 'proj-abc',
        author_id: 'auth-1',
        featured: false,
        name: 'Mod v1.0',
        version_number: '1.0.0',
        dependencies: [
          {
            version_id: null,
            project_id: 'P7dR8mBk', // Fabric API ID
            dependency_type: 'required',
          },
          {
            version_id: null,
            project_id: 'optional-lib',
            dependency_type: 'optional',
          },
        ],
        game_versions: ['1.21.1'],
        version_type: 'release',
        loaders: ['fabric'],
        files: [],
        date_published: '2026-01-01T00:00:00Z',
        downloads: 0,
      };

      const candidates = await getRequiredLibraries(mockVersion);

      expect(candidates).toHaveLength(1);
      expect(candidates[0].identifier).toBe('P7dR8mBk');
      expect(candidates[0].source).toBe('api');
    });

    it('harus menggabungkan dependensi API resmi dengan library dari deskripsi tanpa duplikasi', async () => {
      const mockVersion: ModVersion = {
        id: 'ver-123',
        project_id: 'proj-abc',
        author_id: 'auth-1',
        featured: false,
        name: 'Mod v1.0',
        version_number: '1.0.0',
        dependencies: [
          {
            version_id: null,
            project_id: 'fabric-api',
            dependency_type: 'required',
          },
        ],
        game_versions: ['1.21.1'],
        version_type: 'release',
        loaders: ['fabric'],
        files: [],
        date_published: '2026-01-01T00:00:00Z',
        downloads: 0,
      };

      const mockProject: ModProject = {
        id: 'proj-abc',
        slug: 'super-mod',
        project_type: 'mod',
        title: 'Super Mod',
        description: 'Requires Cloth Config for in-game configuration.',
        categories: [],
        client_side: 'required',
        server_side: 'optional',
        body: 'Also requires Fabric API',
        downloads: 100,
        followers: 10,
        versions: ['1.0.0'],
      };

      const candidates = await getRequiredLibraries(mockVersion, mockProject);

      const identifiers = candidates.map((c) => c.identifier);
      expect(identifiers).toContain('fabric-api');
      expect(identifiers).toContain('cloth-config');
      expect(identifiers.filter((id) => id === 'fabric-api')).toHaveLength(1);
    });
  });

  describe('getRequiredDependencyTitles', () => {
    it('harus mengembalikan nama manusiawi untuk library populer yang terdeteksi', async () => {
      const mockProject: ModProject = {
        id: 'proj-1',
        slug: 'my-mod',
        project_type: 'mod',
        title: 'My Mod',
        description: 'Requires Fabric API and Cloth Config',
        categories: [],
        client_side: 'required',
        server_side: 'optional',
        downloads: 0,
        followers: 0,
        versions: ['1.0.0'],
      };

      const titles = await getRequiredDependencyTitles(undefined, mockProject);
      expect(titles).toContain('Fabric API');
      expect(titles).toContain('Cloth Config');
    });

    it('harus mengembalikan array kosong jika tidak ada dependensi', async () => {
      const titles = await getRequiredDependencyTitles();
      expect(titles).toEqual([]);
    });
  });

  describe('resolveAndInstallDependencies', () => {
    it('harus mengembalikan hasil kosong jika mod mandiri (tidak butuh library tambahan)', async () => {
      const mockGraph = new DependencyGraph('/fake/instance');
      const mockVersion: ModVersion = {
        id: 'ver-simple',
        project_id: 'proj-simple',
        author_id: 'auth-1',
        featured: false,
        name: 'Simple Mod',
        version_number: '1.0.0',
        dependencies: [],
        game_versions: ['1.21.1'],
        version_type: 'release',
        loaders: ['fabric'],
        files: [],
        date_published: '2026-01-01T00:00:00Z',
        downloads: 0,
      };

      const result = await resolveAndInstallDependencies({
        mainModSlug: 'simple-mod',
        mainVersion: mockVersion,
        modsDir: '/fake/mods',
        gameVersion: '1.21.1',
        loader: 'fabric',
        graph: mockGraph,
      });

      expect(result.installed).toHaveLength(0);
      expect(result.skippedAlreadyInstalled).toHaveLength(0);
      expect(result.errors).toHaveLength(0);
    });

    it('harus melewati pengunduhan jika file library yang cocok sudah ada di folder mods', async () => {
      const fs = await import('node:fs/promises');
      const os = await import('node:os');
      const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'loadmoder-dep-test-'));
      const modsDir = path.join(tempDir, 'mods');
      await fs.mkdir(modsDir, { recursive: true });

      // Simulasikan file fabric-api-0.100.0.jar sudah ada di modsDir
      await fs.writeFile(path.join(modsDir, 'fabric-api-0.100.0.jar'), 'dummy');

      vi.spyOn(modrinthClient, 'getProject').mockResolvedValue({
        id: 'P7dR8mBk',
        slug: 'fabric-api',
        title: 'Fabric API',
      } as any);

      vi.spyOn(modrinthClient, 'getProjectVersions').mockResolvedValue([
        {
          id: 'ver-fapi',
          project_id: 'P7dR8mBk',
          version_number: '0.100.0',
          version_type: 'release',
          dependencies: [],
          files: [
            {
              primary: true,
              filename: 'fabric-api-0.100.0.jar',
              url: 'https://cdn.modrinth.com/fake.jar',
              hashes: { sha512: 'fake512', sha1: 'fake1' },
              size: 1024,
            },
          ],
        } as any,
      ]);

      const mockGraph = new DependencyGraph(tempDir);
      const mockVersion: ModVersion = {
        id: 'ver-mod',
        project_id: 'proj-mod',
        author_id: 'auth-1',
        featured: false,
        name: 'Mod with Dep',
        version_number: '1.0.0',
        dependencies: [
          {
            version_id: null,
            project_id: 'P7dR8mBk',
            dependency_type: 'required',
          },
        ],
        game_versions: ['1.21.1'],
        version_type: 'release',
        loaders: ['fabric'],
        files: [],
        date_published: '2026-01-01T00:00:00Z',
        downloads: 0,
      };

      try {
        const result = await resolveAndInstallDependencies({
          mainModSlug: 'my-mod',
          mainVersion: mockVersion,
          modsDir,
          gameVersion: '1.21.1',
          loader: 'fabric',
          graph: mockGraph,
        });

        expect(result.skippedAlreadyInstalled.length).toBe(1);
        expect(result.skippedAlreadyInstalled[0].name).toBe('Fabric API');
        expect(result.installed.length).toBe(0);
      } finally {
        await fs.rm(tempDir, { recursive: true, force: true });
      }
    });
  });
});
