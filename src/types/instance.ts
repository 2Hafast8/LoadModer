export type LauncherType =
  | 'Official'
  | 'Prism'
  | 'MultiMC'
  | 'TLauncher'
  | 'Legacy'
  | 'SKLauncher'
  | 'Modrinth'
  | 'CurseForge'
  | 'Custom'
  | 'Vanilla';
export type LoaderType = 'fabric' | 'forge' | 'neoforge' | 'quilt';

export interface MinecraftInstance {
  id: string;
  name: string;
  launcher: LauncherType;
  rootDir: string;
  modsDir: string;
  gameVersion?: string;
  loader?: LoaderType;
  mode?: 'default' | 'modpack';
  activeContainer?: string;
}

export interface SavedInstanceConfig {
  name: string;
  launcher: string;
  rootDir: string;
  modsDir: string;
  gameVersion?: string;
  loader?: LoaderType | string;
  mode?: 'default' | 'modpack';
  activeContainer?: string;
}

export interface GlobalConfig {
  activeInstance?: string;
  defaultGameVersion?: string;
  defaultLoader?: string;
  defaultEnvironment?: 'client' | 'server';
  instances: Record<string, SavedInstanceConfig>;
}
