import { createHash } from 'node:crypto';
import { createReadStream } from 'node:fs';

export async function hashFile(filePath: string, algorithm: 'sha1' | 'sha512'): Promise<string> {
  const hash = createHash(algorithm);
  for await (const chunk of createReadStream(filePath)) {
    hash.update(chunk);
  }
  return hash.digest('hex');
}

export function hashBuffer(buffer: Buffer, algorithm: 'sha1' | 'sha512'): string {
  return createHash(algorithm).update(buffer).digest('hex');
}
