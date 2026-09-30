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
  downloads: z.array(z.string().url()).min(1),
  fileSize: z.number().nonnegative(),
});

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
