export interface LockModEntry {
  projectId: string;
  versionId: string;
  versionNumber: string;
  filename: string;
  sha512: string;
  isRoot: boolean;
  dependencies: string[];
  dependedBy: string[];
  installedAt: string;
}

export interface LockfileData {
  $schema?: string;
  version: 1;
  gameVersion: string;
  loader: string;
  environment: 'client' | 'server';
  updatedAt: string;
  mods: Record<string, LockModEntry>;
  resourcepacks?: Record<string, { filename: string; sha512: string }>;
  shaderpacks?: Record<string, { filename: string; sha512: string }>;
}
