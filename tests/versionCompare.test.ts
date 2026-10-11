import { describe, it, expect } from 'vitest';
import {
  extractVersionString,
  compareModVersions,
  isTrueUpdate,
} from '../src/utils/versionCompare.js';
import type { ModVersion } from '../src/types/modrinth.js';

describe('versionCompare utility', () => {
  it('extracts version strings correctly from filenames and build tags', () => {
    expect(extractVersionString('sodium-fabric-0.9.3-alpha.1+mc26.3.jar')).toBe('0.9.3-alpha.1');
    expect(extractVersionString('mc26.3-0.9.2-fabric.jar')).toBe('0.9.2');
    expect(extractVersionString('fabric-api-0.92.2+1.20.1.jar')).toBe('0.92.2');
    expect(extractVersionString('iris-1.7.0+1.20.1.jar')).toBe('1.7.0');
    expect(extractVersionString('lithium-fabric-mc1.20.1-0.11.2.jar')).toBe('0.11.2');
  });

  it('correctly compares version numbers and detects downgrades', () => {
    // 0.9.3-alpha.1 vs 0.9.2 -> 0.9.3 is newer, so 0.9.2 is older
    expect(compareModVersions('0.9.2', '0.9.3-alpha.1')).toBeLessThan(0);
    expect(compareModVersions('0.9.3-alpha.1', '0.9.2')).toBeGreaterThan(0);

    // 0.9.3 vs 0.9.3-alpha.1 -> full release is newer than alpha
    expect(compareModVersions('0.9.3', '0.9.3-alpha.1')).toBeGreaterThan(0);

    // 0.9.3-alpha.2 vs 0.9.3-alpha.1 -> alpha 2 is newer
    expect(compareModVersions('0.9.3-alpha.2', '0.9.3-alpha.1')).toBeGreaterThan(0);

    // Same versions
    expect(compareModVersions('1.2.0', '1.2.0')).toBe(0);
  });

  it('rejects older versions and prevents downgrades in isTrueUpdate (Sodium bug)', () => {
    const currentFile = {
      filename: 'sodium-fabric-0.9.3-alpha.1+mc26.3.jar',
      sha1: 'sha_installed',
    };

    const currentVer: ModVersion = {
      id: 'ver_installed',
      project_id: 'AANobbSp',
      version_number: 'sodium-fabric-0.9.3-alpha.1+mc26.3',
      version_type: 'alpha',
      date_published: '2025-01-20T12:00:00.000Z',
      downloads: 1000,
      files: [{
        hashes: { sha1: 'sha_installed', sha512: 'sha512_installed' },
        url: 'https://...',
        filename: 'sodium-fabric-0.9.3-alpha.1+mc26.3.jar',
        primary: true,
        size: 1800000,
        file_type: null,
      }],
      dependencies: [],
      game_versions: ['26.3'],
      loaders: ['fabric'],
      name: 'Sodium 0.9.3 Alpha 1',
      author_id: 'user_1',
      featured: false,
    };

    // Modrinth mistakenly returned older release 0.9.2
    const olderVer: ModVersion = {
      id: 'ver_old',
      project_id: 'AANobbSp',
      version_number: 'mc26.3-0.9.2-fabric',
      version_type: 'release',
      date_published: '2024-11-15T12:00:00.000Z', // Published earlier!
      downloads: 50000,
      files: [{
        hashes: { sha1: 'sha_old', sha512: 'sha512_old' },
        url: 'https://...',
        filename: 'mc26.3-0.9.2-fabric.jar',
        primary: true,
        size: 1800000,
        file_type: null,
      }],
      dependencies: [],
      game_versions: ['26.3'],
      loaders: ['fabric'],
      name: 'Sodium 0.9.2',
      author_id: 'user_1',
      featured: false,
    };

    // isTrueUpdate must return false! (Do not offer 0.9.2 when 0.9.3 is installed)
    expect(isTrueUpdate(currentFile, currentVer, olderVer)).toBe(false);

    // Now test if a real newer version 0.9.3 release or 0.9.3-alpha.2 is returned:
    const newerVer: ModVersion = {
      id: 'ver_new',
      project_id: 'AANobbSp',
      version_number: 'sodium-fabric-0.9.3+mc26.3',
      version_type: 'release',
      date_published: '2025-02-10T12:00:00.000Z', // Published later!
      downloads: 5000,
      files: [{
        hashes: { sha1: 'sha_new', sha512: 'sha512_new' },
        url: 'https://...',
        filename: 'sodium-fabric-0.9.3+mc26.3.jar',
        primary: true,
        size: 1850000,
        file_type: null,
      }],
      dependencies: [],
      game_versions: ['26.3'],
      loaders: ['fabric'],
      name: 'Sodium 0.9.3 Final',
      author_id: 'user_1',
      featured: false,
    };

    // isTrueUpdate must return true!
    expect(isTrueUpdate(currentFile, currentVer, newerVer)).toBe(true);
  });
});
