import type { LockfileData } from './lockfile.js';

export interface SnapshotModItem {
  filename: string;
  slug?: string;
  projectId?: string;
  versionId?: string;
  versionNumber?: string;
  sha512?: string;
  isRoot?: boolean;
  disabled: boolean;
  dependencies?: string[];
  installedAt?: string;
  fileSizeBytes?: number;
}

export interface ProfileSnapshot {
  snapshotId: string;
  instanceKey: string;
  instanceName: string;
  gameVersion: string;
  loader: string;
  createdAt: string;
  updatedAt: string;
  modsCount: number;
  activeCount: number;
  lockfileData?: LockfileData;
  mods: SnapshotModItem[];
}

export interface SwitchProfileResult {
  previousSnapshot?: ProfileSnapshot;
  restoredSnapshot?: ProfileSnapshot;
  savedCount: number;
  restoredCount: number;
  isNewProfile: boolean;
}
