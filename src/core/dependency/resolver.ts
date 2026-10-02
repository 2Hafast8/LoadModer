import path from 'node:path';
import { readdir, rm } from 'node:fs/promises';
import { modrinthClient } from '../../api/client.js';
import { formatBytes } from '../../utils/format.js';
import type { ModVersion, ModProject } from '../../types/modrinth.js';
import type { DependencyGraph } from './graph.js';

/**
 * Daftar library populer Minecraft beserta slug resminya di Modrinth
 */
export const KNOWN_LIBRARIES: Record<string, { slug: string; name: string }> = {
  'fabric api': { slug: 'fabric-api', name: 'Fabric API' },
  'fabric-api': { slug: 'fabric-api', name: 'Fabric API' },
  'cloth config': { slug: 'cloth-config', name: 'Cloth Config' },
  'cloth config api': { slug: 'cloth-config', name: 'Cloth Config API' },
  'cloth-config': { slug: 'cloth-config', name: 'Cloth Config' },
  'architectury': { slug: 'architectury-api', name: 'Architectury API' },
  'architectury api': { slug: 'architectury-api', name: 'Architectury API' },
  'architectury-api': { slug: 'architectury-api', name: 'Architectury API' },
  'yacl': { slug: 'yacl', name: 'YetAnotherConfigLib' },
  'yetanotherconfiglib': { slug: 'yacl', name: 'YetAnotherConfigLib' },
  'indium': { slug: 'indium', name: 'Indium' },
  'curios': { slug: 'curios', name: 'Curios API' },
  'curios api': { slug: 'curios', name: 'Curios API' },
  'geckolib': { slug: 'geckolib', name: 'GeckoLib' },
  'pehkui': { slug: 'pehkui', name: 'Pehkui' },
  'forge config api port': { slug: 'forge-config-api-port', name: 'Forge Config API Port' },
  'fabric language kotlin': { slug: 'fabric-language-kotlin', name: 'Fabric Language Kotlin' },
  'kotlin for forge': { slug: 'kotlin-for-forge', name: 'Kotlin for Forge' },
  'qsl': { slug: 'qsl', name: 'Quilted Fabric API / QSL' },
};

export interface RequiredLibraryCandidate {
  identifier: string; // project_id, slug, atau version_id
  source: 'api' | 'description';
  hintName?: string;
}

export interface DependencyResolutionOptions {
  mainModSlug: string;
  mainVersion: ModVersion;
  project?: ModProject;
  modsDir: string;
  gameVersion: string;
  loader: string;
  graph: DependencyGraph;
  dryRun?: boolean;
  onLog?: (level: 'info' | 'step' | 'warn' | 'dim' | 'success', message: string) => void;
}

export interface DependencyInstallResult {
  installed: Array<{ name: string; filename: string; version: string }>;
  skippedAlreadyInstalled: Array<{ name: string; filename: string }>;
  errors: Array<{ name: string; error: string }>;
}

/**
 * Memindai teks deskripsi atau body mod untuk menemukan referensi dependensi/library wajib.
 * Mendeteksi tautan Modrinth (modrinth.com/mod/<slug>) dan kata kunci seperti "Requires <Library>".
 */
export function extractDependenciesFromText(text: string): string[] {
  if (!text || typeof text !== 'string') return [];

  const foundSlugs = new Set<string>();
  const lowerText = text.toLowerCase();

  const urlRegex = /(?:https?:\/\/)?(?:www\.)?modrinth\.com\/mod\/([a-zA-Z0-9\-_]+)/gi;
  let urlMatch: RegExpExecArray | null;
  while ((urlMatch = urlRegex.exec(text)) !== null) {
    const slug = urlMatch[1]?.toLowerCase();
    if (slug) {
      const matchIndex = urlMatch.index;
      const start = Math.max(0, matchIndex - 120);
      const end = Math.min(text.length, matchIndex + urlMatch[0].length + 120);
      const snippet = text.slice(start, end).toLowerCase();

      const isRequirement =
        snippet.includes('require') ||
        snippet.includes('depend') ||
        snippet.includes('need') ||
        snippet.includes('butuh') ||
        snippet.includes('wajib') ||
        snippet.includes('prerequisite');

      if (isRequirement) {
        foundSlugs.add(slug);
      }
    }
  }

  const requirementPhraseRegex =
    /(?:requires?|dependencies|dependency|depends on|needs?|butuh|membutuhkan|wajib)[\s:*-]+(?:the\s+)?\[?([a-zA-Z0-9\-_ ]{2,35})/gi;
  let phraseMatch: RegExpExecArray | null;
  while ((phraseMatch = requirementPhraseRegex.exec(lowerText)) !== null) {
    const candidatePhrase = phraseMatch[1]?.trim();
    if (!candidatePhrase) continue;

    // Periksa apakah frasa mengandung nama library yang kita kenali
    for (const [key, lib] of Object.entries(KNOWN_LIBRARIES)) {
      if (candidatePhrase.includes(key)) {
        foundSlugs.add(lib.slug);
      }
    }
  }

  // 3. Deteksi bagian heading Markdown "## Requirements" atau "## Dependencies"
  const sectionRegex = /#{1,4}\s*(?:requirements|dependencies|required mods?|library)[\s\S]*?(?=(?:#{1,4}\s|\Z))/gi;
  let sectionMatch: RegExpExecArray | null;
  while ((sectionMatch = sectionRegex.exec(lowerText)) !== null) {
    const sectionBody = sectionMatch[0];
    for (const [key, lib] of Object.entries(KNOWN_LIBRARIES)) {
      if (sectionBody.includes(key)) {
        foundSlugs.add(lib.slug);
      }
    }
  }

  return Array.from(foundSlugs);
}

/**
 * Mengumpulkan seluruh kandidat library yang wajib dipasang:
 * Menggabungkan metadata API resmi (`version.dependencies` berstatus `required`)
 * dengan pemindaian cerdas deskripsi mod.
 */
export async function getRequiredLibraries(
  version?: ModVersion,
  project?: ModProject
): Promise<RequiredLibraryCandidate[]> {
  const candidates: RequiredLibraryCandidate[] = [];
  const registeredIdentifiers = new Set<string>();

  if (version?.dependencies && Array.isArray(version.dependencies)) {
    for (const dep of version.dependencies) {
      if (dep.dependency_type === 'required') {
        const id = dep.project_id || dep.version_id;
        if (id && !registeredIdentifiers.has(id.toLowerCase())) {
          registeredIdentifiers.add(id.toLowerCase());
          candidates.push({
            identifier: id,
            source: 'api',
          });
        }
      }
    }
  }

  const combinedDesc = `${project?.description || ''}\n${project?.body || ''}`;
  const textSlugs = extractDependenciesFromText(combinedDesc);

  for (const slug of textSlugs) {
    if (project && (project.slug === slug || project.id === slug)) continue;

    if (!registeredIdentifiers.has(slug.toLowerCase())) {
      registeredIdentifiers.add(slug.toLowerCase());
      candidates.push({
        identifier: slug,
        source: 'description',
        hintName: KNOWN_LIBRARIES[slug]?.name,
      });
    }
  }

  return candidates;
}

/**
 * Mengambil nama/judul manusiawi untuk daftar dependensi wajib
 * agar dapat ditampilkan secara elegan di kartu detail UI.
 */
export async function getRequiredDependencyTitles(
  version?: ModVersion,
  project?: ModProject
): Promise<string[]> {
  const candidates = await getRequiredLibraries(version, project);
  if (candidates.length === 0) return [];

  const titles: string[] = [];
  const projectIdsToFetch: string[] = [];

  for (const c of candidates) {
    if (c.hintName) {
      titles.push(c.hintName);
    } else if (KNOWN_LIBRARIES[c.identifier.toLowerCase()]) {
      titles.push(KNOWN_LIBRARIES[c.identifier.toLowerCase()].name);
    } else {
      projectIdsToFetch.push(c.identifier);
    }
  }

  if (projectIdsToFetch.length > 0) {
    try {
      const fetchedProjects = await modrinthClient.getProjects(projectIdsToFetch);
      for (const p of fetchedProjects) {
        titles.push(p.title);
      }
    } catch {
      // Jika batch gagal, gunakan identifier mentah
      for (const id of projectIdsToFetch) {
        titles.push(id);
      }
    }
  }

  return Array.from(new Set(titles));
}

/**
 * Eksekutor utama: Mengunduh dan memasang seluruh mod library tambahan
 * yang disesuaikan secara otomatis dengan Minecraft version dan mod loader pengguna.
 * Jika mod tidak butuh library tambahan, sistem tidak melakukan unduhan ekstra.
 */
export async function resolveAndInstallDependencies(
  opts: DependencyResolutionOptions
): Promise<DependencyInstallResult> {
  const result: DependencyInstallResult = {
    installed: [],
    skippedAlreadyInstalled: [],
    errors: [],
  };

  const { mainModSlug, mainVersion, project, modsDir, gameVersion, loader, graph, dryRun } = opts;
  const log = opts.onLog ?? (() => {});

  const initialCandidates = await getRequiredLibraries(mainVersion, project);

  if (initialCandidates.length === 0) {
    log('dim', '  ℹ️  Mod ini mandiri (tidak memerlukan library tambahan).');
    return result;
  }

  log(
    'step',
    `Memeriksa mod library yang dibutuhkan untuk ${mainModSlug} (${initialCandidates.length} terdeteksi)...`
  );

  const queue: string[] = initialCandidates.map((c) => c.identifier);
  const visited = new Set<string>();

  visited.add(mainModSlug.toLowerCase());
  if (project?.id) visited.add(project.id.toLowerCase());
  if (project?.slug) visited.add(project.slug.toLowerCase());

  while (queue.length > 0) {
    const targetIdOrSlug = queue.shift()!;
    const cleanKey = targetIdOrSlug.toLowerCase();
    if (visited.has(cleanKey)) continue;
    visited.add(cleanKey);

    try {
      // Dapatkan data proyek Modrinth
      let depProj: ModProject;
      let depBestVersion: ModVersion | undefined;

      try {
        depProj = await modrinthClient.getProject(targetIdOrSlug);
      } catch {
        // Jika gagal sebagai project, coba ambil sebagai version_id
        const ver = await modrinthClient.getVersion(targetIdOrSlug);
        depProj = await modrinthClient.getProject(ver.project_id);
        depBestVersion = ver;
      }

      visited.add(depProj.id.toLowerCase());
      visited.add(depProj.slug.toLowerCase());

      // Jika versi belum ditentukan langsung, cari versi yang cocok untuk gameVersion & loader
      if (!depBestVersion) {
        const versions = await modrinthClient.getProjectVersions(depProj.slug, {
          gameVersion,
          loader,
        });

        if (versions.length === 0) {
          log(
            'warn',
            `⚠️  Tidak ditemukan rilis library "${depProj.title}" untuk ${loader.toUpperCase()} ${gameVersion}.`
          );
          result.errors.push({
            name: depProj.title,
            error: `Tidak ada versi untuk ${loader} ${gameVersion}`,
          });
          continue;
        }

        depBestVersion = versions.find((v) => v.version_type === 'release') ?? versions[0];
      }

      const depFile = depBestVersion.files.find((f) => f.primary) ?? depBestVersion.files[0];
      if (!depFile) {
        result.errors.push({ name: depProj.title, error: 'Tidak ada berkas unduhan' });
        continue;
      }

      const safeFilename = path.basename(depFile.filename);
      const rootModsDir = path.resolve(modsDir);
      const destPath = path.resolve(modsDir, safeFilename);
      if (!destPath.startsWith(rootModsDir + path.sep) && destPath !== rootModsDir) {
        result.errors.push({ name: depProj.title, error: `Nama berkas tidak aman (path traversal): ${depFile.filename}` });
        continue;
      }

      if (!depFile.hashes?.sha512) {
        result.errors.push({ name: depProj.title, error: `Berkas ${depFile.filename} tidak memiliki hash integritas SHA-512` });
        continue;
      }

      // Cek apakah library sudah terpasang di folder mods
      const existingFiles = await readdir(modsDir).catch(() => [] as string[]);
      const exactFilePresent = existingFiles.some((f) => f === safeFilename);

      // Cek apakah ada file jar lama dari mod library yang sama
      const oldModEntry = graph.getMod(depProj.slug);
      const escapedSlug = depProj.slug.toLowerCase().replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const versionRegex = new RegExp(`^${escapedSlug}[-_][0-9v]`, 'i');

      const existingSameMod = existingFiles.find(
        (f) =>
          f !== safeFilename &&
          ((oldModEntry && f === oldModEntry.filename) || versionRegex.test(f)) &&
          f.endsWith('.jar') &&
          !f.endsWith('.disabled')
      );

      const reqDepsOfThis = (depBestVersion.dependencies || [])
        .filter((d): d is typeof d & { project_id: string } => d.dependency_type === 'required' && Boolean(d.project_id))
        .map((d) => d.project_id);

      if (exactFilePresent) {
        // Versi yang cocok sudah terpasang
        log('success', `  ✔  Library [${depProj.title}] sudah terpasang (${safeFilename}) - dilewati.`);
        result.skippedAlreadyInstalled.push({
          name: depProj.title,
          filename: safeFilename,
        });

        // Daftarkan di dependency graph agar relasi tetap tercatat
        graph.registerMod(depProj.slug, {
          projectId: depProj.id,
          versionId: depBestVersion.id,
          versionNumber: depBestVersion.version_number,
          filename: safeFilename,
          sha512: depFile.hashes.sha512,
          isRoot: false,
          dependencies: reqDepsOfThis,
        });
      } else {
        // Hapus file lama jika ada versi lama yang terpasang agar tidak crash duplikat
        if (existingSameMod) {
          try {
            await rm(path.join(modsDir, existingSameMod), { force: true });
            log('dim', `  Menghapus versi library usang: ${existingSameMod}`);
          } catch {}
        }

        if (dryRun) {
          log('info', `  [dry-run] Akan memasang library: ${safeFilename} (${formatBytes(depFile.size)})`);
        } else {
          log(
            'info',
            `  ⬇️  Memasang library: ${depProj.title} (${depBestVersion.version_number}) untuk ${loader.toUpperCase()} ${gameVersion}...`
          );

          await modrinthClient.download(depFile.url, destPath, {
            sha512: depFile.hashes.sha512,
            size: depFile.size,
          });

          graph.registerMod(depProj.slug, {
            projectId: depProj.id,
            versionId: depBestVersion.id,
            versionNumber: depBestVersion.version_number,
            filename: safeFilename,
            sha512: depFile.hashes.sha512,
            isRoot: false,
            dependencies: reqDepsOfThis,
          });

          result.installed.push({
            name: depProj.title,
            filename: safeFilename,
            version: depBestVersion.version_number,
          });
        }
      }

      // Resolusi Transitif: cek apakah library ini membutuhkan library lain
      for (const childDep of depBestVersion.dependencies || []) {
        if (childDep.dependency_type === 'required') {
          const childId = childDep.project_id || childDep.version_id;
          if (childId && !visited.has(childId.toLowerCase())) {
            queue.push(childId);
          }
        }
      }
    } catch (err: any) {
      result.errors.push({
        name: targetIdOrSlug,
        error: err.message || 'Gagal memproses library',
      });
      log('warn', `  ⚠️  Gagal memproses dependensi library "${targetIdOrSlug}": ${err.message}`);
    }
  }

  return result;
}
