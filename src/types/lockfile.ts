import { z } from 'zod';

export const LockModEntrySchema = z.object({
  projectId: z.string(),
  versionId: z.string(),
  versionNumber: z.string(),
  filename: z.string(),
  sha512: z.string(),
  isRoot: z.boolean(),
  dependencies: z.array(z.string()).default([]),
  dependedBy: z.array(z.string()).default([]),
  installedAt: z.string(),
});

export const AssetEntrySchema = z.object({
  filename: z.string(),
  sha512: z.string(),
});

export const LockfileDataSchema = z.object({
  $schema: z.string().optional(),
  version: z.literal(1),
  gameVersion: z.string().default(''),
  loader: z.string().default(''),
  environment: z.enum(['client', 'server']).default('client'),
  updatedAt: z.string(),
  mods: z.record(LockModEntrySchema).default({}),
  resourcepacks: z.record(AssetEntrySchema).optional().default({}),
  shaderpacks: z.record(AssetEntrySchema).optional().default({}),
});

export type LockModEntry = z.infer<typeof LockModEntrySchema>;
export type AssetEntry = z.infer<typeof AssetEntrySchema>;
export type LockfileData = z.infer<typeof LockfileDataSchema>;
