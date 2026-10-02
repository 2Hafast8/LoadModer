import path from 'node:path';
import { mkdir, readFile } from 'node:fs/promises';
import writeFileAtomic from 'write-file-atomic';
import { GLOBAL_CONFIG_PATH } from '../../constants.js';
import type { GlobalConfig, SavedInstanceConfig } from '../../types/instance.js';

export class InstanceConfigManager {
  private configPath: string;
  private config: GlobalConfig;

  constructor(customPath?: string) {
    this.configPath = customPath ?? GLOBAL_CONFIG_PATH;
    this.config = {
      defaultEnvironment: 'client',
      instances: {},
    };
  }

  async load(): Promise<GlobalConfig> {
    try {
      const data = await readFile(this.configPath, 'utf8');
      this.config = JSON.parse(data);
      if (!this.config.instances) this.config.instances = {};
    } catch (err: any) {
      if (err?.code === 'ENOENT') {
        this.config = {
          defaultEnvironment: 'client',
          instances: {},
        };
        return this.config;
      }
      try {
        const raw = await readFile(this.configPath);
        await writeFileAtomic(`${this.configPath}.corrupt.${Date.now()}.bak`, raw);
      } catch {}
      this.config = {
        defaultEnvironment: 'client',
        instances: {},
      };
    }
    return this.config;
  }

  async save(): Promise<void> {
    await mkdir(path.dirname(this.configPath), { recursive: true });
    await writeFileAtomic(this.configPath, JSON.stringify(this.config, null, 2) + '\n', 'utf8');
  }

  get(): GlobalConfig {
    return this.config;
  }

  getActiveInstance(): SavedInstanceConfig | undefined {
    if (!this.config.activeInstance) return undefined;
    return this.config.instances[this.config.activeInstance];
  }

  setActiveInstance(key: string): void {
    if (!this.config.instances[key]) {
      throw new Error(`Instance dengan id/nama "${key}" tidak ditemukan.`);
    }
    this.config.activeInstance = key;
  }

  saveInstance(key: string, instance: SavedInstanceConfig, makeActive = true): void {
    this.config.instances[key] = instance;
    if (makeActive || !this.config.activeInstance) {
      this.config.activeInstance = key;
    }
  }

  deleteInstance(key: string): void {
    delete this.config.instances[key];
    if (this.config.activeInstance === key) {
      delete this.config.activeInstance;
    }
  }

  set<K extends keyof GlobalConfig>(key: K, value: GlobalConfig[K]): void {
    this.config[key] = value;
  }
}

export const instanceConfig = new InstanceConfigManager();
