import { describe, it, expect } from 'vitest';
import { hashBuffer } from '../src/utils/crypto.js';

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
});
