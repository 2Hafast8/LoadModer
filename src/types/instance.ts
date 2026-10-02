export type LauncherType = 'Prism' | 'MultiMC' | 'Modrinth' | 'CurseForge' | 'Vanilla' | 'Custom';
export type LoaderType = 'fabric' | 'forge' | 'neoforge' | 'quilt';

export interface MinecraftInstance {
  id: string;
  name: string;
  launcher: LauncherType;
  rootDir: string;
  modsDir: string;
  gameVersion?: string;
  loader?: LoaderType;
}

export interface SavedInstanceConfig {
  name: string;
  launcher: string;
  rootDir: string;
  modsDir: string;
  gameVersion?: string;
  loader?: LoaderType | string;
}

export interface GlobalConfig {
  activeInstance?: string;
  defaultGameVersion?: string;
  defaultLoader?: string;
  defaultEnvironment?: 'client' | 'server';
  instances: Record<string, SavedInstanceConfig>;
}
