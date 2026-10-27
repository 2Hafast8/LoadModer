import path from 'node:path';
import { mkdir, readFile } from 'node:fs/promises';
import writeFileAtomic from 'write-file-atomic';
import { GLOBAL_CONFIG_PATH } from '../../constants.js';
import type { GlobalConfig, SavedInstanceConfig } from '../../types/instance.js';
import { InstanceNotFoundError } from '../../types/errors.js';

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
      throw new InstanceNotFoundError(key);
    }
    this.config.activeInstance = key;
  }

  saveInstance(key: string, instance: SavedInstanceConfig, makeActive = true): void {
    if (this.config.deletedInstances) {
      const normRoot = instance.rootDir ? path.resolve(instance.rootDir).toLowerCase() : undefined;
      this.config.deletedInstances = this.config.deletedInstances.filter(
        (id) => id.toLowerCase() !== key.toLowerCase() && id !== normRoot
      );
    }

    if (instance.rootDir) {
      const normRoot = path.resolve(instance.rootDir).toLowerCase();
      for (const [existingKey, existingCfg] of Object.entries(this.config.instances)) {
        if (existingKey !== key && existingCfg.rootDir && path.resolve(existingCfg.rootDir).toLowerCase() === normRoot) {
          delete this.config.instances[existingKey];
          if (this.config.activeInstance === existingKey) {
            this.config.activeInstance = key;
          }
        }
      }
    }
    this.config.instances[key] = instance;
    if (makeActive || !this.config.activeInstance) {
      this.config.activeInstance = key;
    }
  }

  deleteInstance(key: string): void {
    const existing = this.config.instances[key];
    const normRoot = existing?.rootDir ? path.resolve(existing.rootDir).toLowerCase() : undefined;

    delete this.config.instances[key];

    if (!this.config.deletedInstances) {
      this.config.deletedInstances = [];
    }
    const keyLower = key.toLowerCase();
    if (!this.config.deletedInstances.some((d) => d.toLowerCase() === keyLower)) {
      this.config.deletedInstances.push(key);
    }
    if (normRoot && !this.config.deletedInstances.includes(normRoot)) {
      this.config.deletedInstances.push(normRoot);
    }

    if (this.config.activeInstance === key) {
      const remainingKeys = Object.keys(this.config.instances);
      this.config.activeInstance = remainingKeys.length > 0 ? remainingKeys[0] : undefined;
    }
  }

  updateCustomPaths(
    key: string,
    paths: {
      modsDir?: string;
      resourcepacksDir?: string;
      shaderpacksDir?: string;
      modpacksDir?: string;
    }
  ): void {
    const inst = this.config.instances[key];
    if (!inst) {
      throw new InstanceNotFoundError(key);
    }
    if (paths.modsDir !== undefined) inst.modsDir = paths.modsDir;
    if (paths.resourcepacksDir !== undefined) inst.resourcepacksDir = paths.resourcepacksDir;
    if (paths.shaderpacksDir !== undefined) inst.shaderpacksDir = paths.shaderpacksDir;
    if (paths.modpacksDir !== undefined) inst.modpacksDir = paths.modpacksDir;
  }

  set<K extends keyof GlobalConfig>(key: K, value: GlobalConfig[K]): void {
    this.config[key] = value;
  }
}

export const instanceConfig = new InstanceConfigManager();
