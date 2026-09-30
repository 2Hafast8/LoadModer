import path from 'node:path';
import { createWriteStream } from 'node:fs';
import { mkdir, rename, rm } from 'node:fs/promises';
import { Readable, Transform } from 'node:stream';
import { pipeline } from 'node:stream/promises';
import type { ReadableStream as WebReadableStream } from 'node:stream/web';
import { API_BASE_URL, USER_AGENT } from '../constants.js';
import { hashFile } from '../utils/crypto.js';
import { apiCache } from './cache.js';
import type {
  FilterOptions,
  ModProject,
  ModVersion,
  SearchResponse,
  VersionType,
  ModrinthGameVersionTag,
} from '../types/modrinth.js';

export class ModrinthError extends Error {
  constructor(message: string, public readonly status: number) {
    super(message);
    this.name = 'ModrinthError';
  }
}

interface RequestOptions {
  method?: 'GET' | 'POST';
  query?: Record<string, string | number>;
  body?: unknown;
  skipCache?: boolean;
}

export type SearchIndex = 'relevance' | 'downloads' | 'follows' | 'newest' | 'updated';

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

export class ModrinthClient {
  constructor(
    public readonly userAgent: string = USER_AGENT,
    private readonly baseUrl: string = API_BASE_URL
  ) {}

  private async request<T>(endpoint: string, opts: RequestOptions = {}, attempt = 0): Promise<T> {
    const url = new URL(this.baseUrl + endpoint);
    for (const [k, v] of Object.entries(opts.query ?? {})) {
      url.searchParams.set(k, String(v));
    }

    const cacheKey = `${opts.method ?? 'GET'}:${url.toString()}`;
    if (opts.method !== 'POST' && !opts.skipCache) {
      const cached = apiCache.get<T>(cacheKey);
      if (cached) return cached;
    }

    const res = await fetch(url, {
      method: opts.method ?? 'GET',
      headers: {
        'User-Agent': this.userAgent,
        Accept: 'application/json',
        ...(opts.body !== undefined ? { 'Content-Type': 'application/json' } : {}),
      },
      body: opts.body !== undefined ? JSON.stringify(opts.body) : undefined,
      signal: AbortSignal.timeout(15000),
    });

    // 429 Rate Limit (kuota 300 req/min): baca X-Ratelimit-Reset lalu ulangi
    if (res.status === 429 && attempt < 3) {
      const reset = Number(res.headers.get('x-ratelimit-reset'));
      const waitSeconds = Number.isFinite(reset) && reset > 0 ? reset : 2;
      await sleep(waitSeconds * 1000 + 250);
      return this.request<T>(endpoint, opts, attempt + 1);
    }

    if (!res.ok) {
      if (res.status === 410) {
        throw new ModrinthError(
          'API versi ini sudah dihentikan (410 Gone). Silakan perbarui LoadModer.',
          410
        );
      }
      const detail = await res.text().catch(() => '');
      throw new ModrinthError(
        `Modrinth API error ${res.status} ${res.statusText} pada ${endpoint} ${detail}`.trim(),
        res.status
      );
    }

    const data = (await res.json()) as T;
    if (opts.method !== 'POST' && !opts.skipCache) {
      apiCache.set(cacheKey, data);
    }
    return data;
  }

  // ---------- Projects & Search ----------
  async search(
    query: string,
    filter: FilterOptions = {},
    limit = 10,
    index: SearchIndex = 'relevance',
    offset = 0
  ): Promise<SearchResponse> {
    const facets: string[][] = [];

    const pType = filter.projectType ?? 'mod';
    facets.push([`project_type:${pType}`]);

    if (filter.gameVersion && filter.gameVersion !== 'all') {
      facets.push([`versions:${filter.gameVersion}`]);
    }
    if (filter.loader && filter.loader !== 'all') {
      facets.push([`categories:${filter.loader.toLowerCase()}`]);
    }
    if (filter.category && filter.category !== 'all') {
      facets.push([`categories:${filter.category.toLowerCase()}`]);
    }
    if (filter.categories && filter.categories.length > 0) {
      for (const cat of filter.categories) {
        if (cat && cat !== 'all') {
          facets.push([`categories:${cat.toLowerCase()}`]);
        }
      }
    }
    if (filter.environment === 'client') {
      facets.push(['client_side:required', 'client_side:optional']);
    } else if (filter.environment === 'server') {
      facets.push(['server_side:required', 'server_side:optional']);
    }

    return this.request('/search', {
      query: {
        query,
        facets: JSON.stringify(facets),
        limit,
        index,
        offset,
      },
    });
  }

  async getProject(idOrSlug: string): Promise<ModProject> {
    return this.request(`/project/${encodeURIComponent(idOrSlug)}`);
  }

  async getProjects(ids: string[]): Promise<ModProject[]> {
    if (ids.length === 0) return [];
    return this.request('/projects', {
      query: { ids: JSON.stringify(ids) },
    });
  }

  // ---------- Versions ----------
  async getProjectVersions(idOrSlug: string, filter: FilterOptions = {}): Promise<ModVersion[]> {
    const query: Record<string, string> = {};
    if (filter.gameVersion) {
      query.game_versions = JSON.stringify([filter.gameVersion]);
    }
    if (filter.loader) {
      query.loaders = JSON.stringify([filter.loader]);
    }

    const versions = await this.request<ModVersion[]>(
      `/project/${encodeURIComponent(idOrSlug)}/version`,
      { query }
    );
    return versions.sort((a, b) => b.date_published.localeCompare(a.date_published));
  }

  async getVersion(versionId: string): Promise<ModVersion> {
    return this.request(`/version/${encodeURIComponent(versionId)}`);
  }

  // ---------- Version Files (Hash lookup) ----------
  async getVersionsByHashes(sha1Hashes: string[]): Promise<Record<string, ModVersion>> {
    if (sha1Hashes.length === 0) return {};
    return this.request('/version_files', {
      method: 'POST',
      body: { hashes: sha1Hashes, algorithm: 'sha1' },
    });
  }

  async getLatestByHashes(
    sha1Hashes: string[],
    filter: Required<Pick<FilterOptions, 'gameVersion' | 'loader'>>,
    versionTypes: VersionType[] = ['release']
  ): Promise<Record<string, ModVersion>> {
    if (sha1Hashes.length === 0) return {};
    return this.request('/version_files/update', {
      method: 'POST',
      body: {
        hashes: sha1Hashes,
        algorithm: 'sha1',
        loaders: [filter.loader],
        game_versions: [filter.gameVersion],
        version_types: versionTypes,
      },
    });
  }

  // ---------- Tags & Metadata ----------
  async getGameVersions(): Promise<ModrinthGameVersionTag[]> {
    return this.request<ModrinthGameVersionTag[]>('/tag/game_version');
  }

  // ---------- Download Pipeline ----------
  async download(
    url: string,
    dest: string,
    opts: {
      sha512?: string;
      size?: number;
      onProgress?: (received: number, total: number) => void;
    } = {}
  ): Promise<void> {
    await mkdir(path.dirname(dest), { recursive: true });

    const res = await fetch(url, {
      headers: { 'User-Agent': this.userAgent },
      signal: AbortSignal.timeout(60000), // 60 detik timeout unduhan
    });
    if (!res.ok || !res.body) {
      throw new ModrinthError(`Gagal mengunduh (${res.status}): ${url}`, res.status);
    }

    const total = Number(res.headers.get('content-length')) || opts.size || 0;
    const tmp = `${dest}.part`;
    let received = 0;

    const counter = new Transform({
      transform(chunk: Buffer, _enc, cb) {
        received += chunk.length;
        opts.onProgress?.(received, total);
        cb(null, chunk);
      },
    });

    try {
      await pipeline(
        Readable.fromWeb(res.body as unknown as WebReadableStream),
        counter,
        createWriteStream(tmp)
      );

      if (opts.sha512) {
        const actualSha512 = await hashFile(tmp, 'sha512');
        if (actualSha512.toLowerCase() !== opts.sha512.toLowerCase()) {
          throw new Error('Checksum SHA-512 tidak cocok, berkas dibatalkan (korup).');
        }
      }

      await rename(tmp, dest);
    } catch (err) {
      await rm(tmp, { force: true });
      throw err;
    }
  }
}

export const modrinthClient = new ModrinthClient();
