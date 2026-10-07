import path from "node:path";
import { readdir, mkdir, copyFile, stat, readFile } from "node:fs/promises";
import writeFileAtomic from "write-file-atomic";
import pLimit from "p-limit";

export interface BaselineManifest {
  createdAt: string;
  filesCount: number;
  items: string[];
}

export class BaselineManager {
  static getBaselineDir(containerDir: string): string {
    return path.join(containerDir, ".loadmoder", "baseline");
  }

  static getManifestPath(containerDir: string): string {
    return path.join(this.getBaselineDir(containerDir), "manifest.json");
  }

  static isIgnoredBaselineItem(name: string): boolean {
    const lower = name.toLowerCase();
    return (
      lower === ".loadmoder" ||
      lower === "mods" ||
      lower === "saves" ||
      lower === "logs" ||
      lower === "crash-reports" ||
      lower.endsWith(".part") ||
      lower.endsWith(".tmp")
    );
  }

  static async hasBaseline(containerDir: string): Promise<boolean> {
    try {
      const manifestPath = this.getManifestPath(containerDir);
      const s = await stat(manifestPath);
      return s.isFile();
    } catch {
      return false;
    }
  }

  static async createBaselineOnce(containerDir: string): Promise<boolean> {
    if (await this.hasBaseline(containerDir)) {
      return false;
    }

    const baselineDir = this.getBaselineDir(containerDir);
    await mkdir(baselineDir, { recursive: true });

    const allFiles: Array<{ src: string; dest: string; relative: string }> = [];

    try {
      const entries = await readdir(containerDir, { withFileTypes: true });
      for (const entry of entries) {
        if (this.isIgnoredBaselineItem(entry.name)) continue;

        const srcPath = path.join(containerDir, entry.name);
        const destPath = path.join(baselineDir, entry.name);

        if (entry.isDirectory()) {
          const subFiles = await this.collectFiles(srcPath, destPath, entry.name);
          allFiles.push(...subFiles);
        } else if (entry.isFile()) {
          allFiles.push({ src: srcPath, dest: destPath, relative: entry.name });
        }
      }
    } catch {
      return false;
    }

    if (allFiles.length > 0) {
      const limit = pLimit(8);
      await Promise.all(
        allFiles.map((item) =>
          limit(async () => {
            await mkdir(path.dirname(item.dest), { recursive: true });
            await copyFile(item.src, item.dest);
          }),
        ),
      );
    }

    const manifest: BaselineManifest = {
      createdAt: new Date().toISOString(),
      filesCount: allFiles.length,
      items: allFiles.map((f) => f.relative),
    };

    await writeFileAtomic(
      this.getManifestPath(containerDir),
      JSON.stringify(manifest, null, 2),
      "utf8",
    );

    return true;
  }

  static async restoreBaseline(containerDir: string): Promise<number> {
    if (!(await this.hasBaseline(containerDir))) {
      return 0;
    }

    const baselineDir = this.getBaselineDir(containerDir);
    const filesToRestore: Array<{ src: string; dest: string }> = [];

    try {
      const entries = await readdir(baselineDir, { withFileTypes: true });
      for (const entry of entries) {
        if (entry.name === "manifest.json") continue;

        const srcPath = path.join(baselineDir, entry.name);
        const destPath = path.join(containerDir, entry.name);

        if (entry.isDirectory()) {
          const subFiles = await this.collectFiles(srcPath, destPath, entry.name);
          filesToRestore.push(...subFiles);
        } else if (entry.isFile()) {
          filesToRestore.push({ src: srcPath, dest: destPath });
        }
      }
    } catch {
      return 0;
    }

    if (filesToRestore.length > 0) {
      const limit = pLimit(8);
      await Promise.all(
        filesToRestore.map((item) =>
          limit(async () => {
            await mkdir(path.dirname(item.dest), { recursive: true });
            await copyFile(item.src, item.dest);
          }),
        ),
      );
    }

    return filesToRestore.length;
  }

  private static async collectFiles(
    srcDir: string,
    destDir: string,
    prefix: string,
  ): Promise<Array<{ src: string; dest: string; relative: string }>> {
    const list: Array<{ src: string; dest: string; relative: string }> = [];
    try {
      const entries = await readdir(srcDir, { withFileTypes: true });
      for (const entry of entries) {
        const srcItem = path.join(srcDir, entry.name);
        const destItem = path.join(destDir, entry.name);
        const relPath = path.join(prefix, entry.name);

        if (entry.isDirectory()) {
          const sub = await this.collectFiles(srcItem, destItem, relPath);
          list.push(...sub);
        } else if (entry.isFile()) {
          list.push({ src: srcItem, dest: destItem, relative: relPath });
        }
      }
    } catch {}
    return list;
  }
}
