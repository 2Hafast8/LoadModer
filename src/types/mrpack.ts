import { z } from 'zod';

export const MrpackFileHashSchema = z.object({
  sha1: z.string(),
  sha512: z.string(),
});

export const MrpackFileEnvironmentSchema = z.object({
  client: z.enum(['required', 'optional', 'unsupported']),
  server: z.enum(['required', 'optional', 'unsupported']),
});

export const MrpackFileEntrySchema = z.object({
  path: z.string().refine((p) => !p.includes('..') && !pathIsAbsolute(p), {
    message: 'Path traversal atau absolute path tidak diizinkan dalam berkas mrpack',
  }),
  hashes: MrpackFileHashSchema,
  env: MrpackFileEnvironmentSchema.optional(),
  downloads: z
    .array(
      z.string().url().refine(isSafeDownloadUrl, {
        message: 'URL unduhan harus berupa HTTPS dan tidak boleh mengarah ke alamat lokal atau privat',
      })
    )
    .min(1),
  fileSize: z.number().nonnegative(),
});

function isSafeDownloadUrl(urlStr: string): boolean {
  try {
    const parsed = new URL(urlStr);
    if (parsed.protocol !== 'https:') return false;
    const host = parsed.hostname.toLowerCase();
    if (
      host === 'localhost' ||
      host === '127.0.0.1' ||
      host === '0.0.0.0' ||
      host === '::1' ||
      host === '169.254.169.254' ||
      host.endsWith('.localhost') ||
      host.endsWith('.local') ||
      host.startsWith('10.') ||
      host.startsWith('192.168.') ||
      /^172\.(1[6-9]|2[0-9]|3[0-1])\./.test(host)
    ) {
      return false;
    }
    return true;
  } catch {
    return false;
  }
}

function pathIsAbsolute(p: string): boolean {
  return p.startsWith('/') || /^[a-zA-Z]:[\\/]/.test(p);
}

export const MrpackIndexSchema = z.object({
  formatVersion: z.literal(1),
  game: z.literal('minecraft'),
  versionId: z.string(),
  name: z.string(),
  summary: z.string().optional(),
  files: z.array(MrpackFileEntrySchema),
  dependencies: z.record(z.string()),
});

export type MrpackFileHash = z.infer<typeof MrpackFileHashSchema>;
export type MrpackFileEnvironment = z.infer<typeof MrpackFileEnvironmentSchema>;
export type MrpackFileEntry = z.infer<typeof MrpackFileEntrySchema>;
export type MrpackIndex = z.infer<typeof MrpackIndexSchema>;
