import os from "node:os";
import path from "node:path";
import {createHash} from "node:crypto";
import {access, readdir, stat} from "node:fs/promises";
import pLimit from "p-limit";

export const MINECRAFT_DIR_NAMES: ReadonlySet<string> = new Set([".minecraft", "minecraft"]);

// A folder named "minecraft" is only treated as a game directory if it contains at least one
// of these, otherwise unrelated folders (source trees, wallpapers, backups) would match.
export const GAME_DIR_MARKERS = [
  "versions",
  "mods",
  "saves",
  "options.txt",
  "launcher_profiles.json",
] as const;

const SKIPPED_DIR_NAMES: ReadonlySet<string> = new Set([
  "windows",
  "system volume information",
  "recovery",
  "perflogs",
  "programdata",
  "msocache",
  "config.msi",
  "node_modules",
]);

const UNIX_MOUNT_ROOTS = ["/mnt", "/media", "/run/media", "/Volumes"];
const DRIVE_PROBE_TIMEOUT_MS = 2_000;

export interface DriveScanOptions {
  maxDepth?: number;
  timeoutMs?: number;
  concurrency?: number;
  signal?: AbortSignal;
  onProgress?: (currentDir: string, visitedDirs: number) => void;
}

export interface DriveScanResult {
  found: string[];
  visitedDirs: number;
  timedOut: boolean;
  aborted: boolean;
}

export type ManualPathResult =
  | {ok: true; rootDir: string; adjusted: boolean}
  | {
      ok: false;
      code: "empty" | "not_found" | "not_directory" | "not_game_dir";
      resolvedPath: string;
      reason: string;
    };

async function pathExists(target: string): Promise<boolean> {
  try {
    await access(target);
    return true;
  } catch {
    return false;
  }
}

async function isDirectory(target: string): Promise<boolean> {
  try {
    return (await stat(target)).isDirectory();
  } catch {
    return false;
  }
}

export async function isMinecraftGameDir(dir: string): Promise<boolean> {
  if (!(await isDirectory(dir))) return false;
  const checks = await Promise.all(GAME_DIR_MARKERS.map((m) => pathExists(path.join(dir, m))));
  return checks.some(Boolean);
}

// Disconnected network drives can block stat() for tens of seconds on Windows.
async function probeWithTimeout(target: string): Promise<boolean> {
  let timer: NodeJS.Timeout | undefined;
  const timeout = new Promise<boolean>((resolve) => {
    timer = setTimeout(() => resolve(false), DRIVE_PROBE_TIMEOUT_MS);
  });
  try {
    return await Promise.race([isDirectory(target), timeout]);
  } finally {
    clearTimeout(timer);
  }
}

export async function listLocalDrives(
  opts: {includeSystemDrive?: boolean; platform?: NodeJS.Platform} = {},
): Promise<string[]> {
  const platform = opts.platform ?? process.platform;

  if (platform === "win32") {
    const systemDrive = (process.env.SystemDrive ?? "C:").toUpperCase();
    const letters = "CDEFGHIJKLMNOPQRSTUVWXYZ".split("");
    const candidates = letters
      .filter((l) => opts.includeSystemDrive || `${l}:` !== systemDrive)
      .map((l) => `${l}:\\`);
    const present = await Promise.all(candidates.map(probeWithTimeout));
    return candidates.filter((_, i) => present[i]);
  }

  const present = await Promise.all(UNIX_MOUNT_ROOTS.map(isDirectory));
  return UNIX_MOUNT_ROOTS.filter((_, i) => present[i]);
}

function shouldSkip(name: string): boolean {
  const lower = name.toLowerCase();
  if (SKIPPED_DIR_NAMES.has(lower)) return true;
  if (lower.startsWith("$")) return true;
  return lower.startsWith(".") && !MINECRAFT_DIR_NAMES.has(lower);
}

export async function findMinecraftDirs(
  roots: string[],
  opts: DriveScanOptions = {},
): Promise<DriveScanResult> {
  const maxDepth = opts.maxDepth ?? 5;
  const deadline = Date.now() + (opts.timeoutMs ?? 60_000);
  const limit = pLimit(opts.concurrency ?? 16);
  const found = new Set<string>();
  let visitedDirs = 0;
  let timedOut = false;
  let aborted = false;

  const shouldStop = (): boolean => {
    if (opts.signal?.aborted) aborted = true;
    else if (Date.now() >= deadline) timedOut = true;
    return aborted || timedOut;
  };

  let frontier = roots.map((dir) => ({dir, depth: 0}));

  while (frontier.length > 0 && !shouldStop()) {
    const next: Array<{dir: string; depth: number}> = [];

    await Promise.all(
      frontier.map(({dir, depth}) =>
        limit(async () => {
          if (shouldStop()) return;

          let entries;
          try {
            entries = await readdir(dir, {withFileTypes: true});
          } catch {
            return;
          }
          visitedDirs++;
          opts.onProgress?.(dir, visitedDirs);

          for (const entry of entries) {
            // Dirent.isDirectory() is false for symlinks and junctions, so they are never
            // followed; this prevents cycles such as "Application Data" junction loops.
            if (!entry.isDirectory()) continue;
            const full = path.join(dir, entry.name);

            if (MINECRAFT_DIR_NAMES.has(entry.name.toLowerCase()) && (await isMinecraftGameDir(full))) {
              found.add(full);
              continue;
            }
            if (shouldSkip(entry.name)) continue;
            if (depth + 1 < maxDepth) next.push({dir: full, depth: depth + 1});
          }
        }),
      ),
    );

    frontier = next;
  }

  return {
    found: [...found].sort((a, b) => a.localeCompare(b)),
    visitedDirs,
    timedOut,
    aborted,
  };
}

function lookupEnv(env: NodeJS.ProcessEnv, name: string): string | undefined {
  if (env[name] !== undefined) return env[name];
  const key = Object.keys(env).find((k) => k.toLowerCase() === name.toLowerCase());
  return key ? env[key] : undefined;
}

export function normalizeUserPath(
  input: string,
  env: NodeJS.ProcessEnv = process.env,
  home: string = os.homedir(),
): string {
  // Windows Explorer's "Copy as path" wraps the value in double quotes.
  let p = input.trim().replace(/^["']+|["']+$/g, "").trim();
  if (!p) return "";

  if (p === "~" || p.startsWith("~/") || p.startsWith("~\\")) {
    p = path.join(home, p.slice(1));
  }
  p = p.replace(/%([^%]+)%/g, (match, name: string) => lookupEnv(env, name) ?? match);

  // path.resolve("D:") yields the process cwd on drive D, not the drive root.
  if (/^[a-zA-Z]:$/.test(p)) p += path.sep;

  return path.resolve(p);
}

export async function resolveManualMinecraftPath(
  input: string,
  env: NodeJS.ProcessEnv = process.env,
  home: string = os.homedir(),
): Promise<ManualPathResult> {
  const resolved = normalizeUserPath(input, env, home);
  if (!resolved) {
    return {ok: false, code: "empty", resolvedPath: "", reason: "Path tidak boleh kosong."};
  }

  let info;
  try {
    info = await stat(resolved);
  } catch {
    return {
      ok: false,
      code: "not_found",
      resolvedPath: resolved,
      reason: `Folder tidak ditemukan: ${resolved}`,
    };
  }
  if (!info.isDirectory()) {
    return {
      ok: false,
      code: "not_directory",
      resolvedPath: resolved,
      reason: `Path ini adalah berkas, bukan folder: ${resolved}`,
    };
  }

  if (path.basename(resolved).toLowerCase() === "mods") {
    const parent = path.dirname(resolved);
    if (await isMinecraftGameDir(parent)) return {ok: true, rootDir: parent, adjusted: true};
  }

  if (await isMinecraftGameDir(resolved)) return {ok: true, rootDir: resolved, adjusted: false};

  try {
    const entries = await readdir(resolved, {withFileTypes: true});
    for (const entry of entries) {
      if (!entry.isDirectory() || !MINECRAFT_DIR_NAMES.has(entry.name.toLowerCase())) continue;
      const child = path.join(resolved, entry.name);
      if (await isMinecraftGameDir(child)) return {ok: true, rootDir: child, adjusted: true};
    }
  } catch {}

  return {
    ok: false,
    code: "not_game_dir",
    resolvedPath: resolved,
    reason: `Folder ini tidak berisi ${GAME_DIR_MARKERS.join(", ")}: ${resolved}`,
  };
}

export function normalizeForCompare(dir: string): string {
  const resolved = path.resolve(dir);
  return process.platform === "win32" ? resolved.toLowerCase() : resolved;
}

export function instanceIdFromPath(dir: string): string {
  const hash = createHash("sha1").update(normalizeForCompare(dir)).digest("hex").slice(0, 10);
  return `local-${hash}`;
}
