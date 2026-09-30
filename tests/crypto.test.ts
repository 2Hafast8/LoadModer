import { describe, it, expect } from 'vitest';
import path from 'node:path';
import os from 'node:os';
import { writeFile, rm } from 'node:fs/promises';
import { hashBuffer, hashFile } from '../src/utils/crypto.js';

describe('crypto utils', () => {
  it('harus menghitung hash SHA-1 yang benar', () => {
    const input = Buffer.from('loadmoder-test');
    const hash = hashBuffer(input, 'sha1');
    expect(hash).toBe('ea65f9ff44e7dad359fb95a98ff4763e3f51f5ab');
  });

  it('harus menghitung hash SHA-512 yang benar', () => {
    const input = Buffer.from('loadmoder-test');
    const hash = hashBuffer(input, 'sha512');
    expect(hash.length).toBe(128); // 128 karakter heksadesimal
  });

  it('harus menghitung hash berkas nyata dengan hashFile', async () => {
    const tempFilePath = path.join(os.tmpdir(), `test-hash-${Date.now()}.txt`);
    await writeFile(tempFilePath, 'loadmoder-test', 'utf8');

    try {
      const sha1 = await hashFile(tempFilePath, 'sha1');
      const sha512 = await hashFile(tempFilePath, 'sha512');

      expect(sha1).toBe('ea65f9ff44e7dad359fb95a98ff4763e3f51f5ab');
      expect(sha512.length).toBe(128);
    } finally {
      await rm(tempFilePath, { force: true });
    }
  });
});
