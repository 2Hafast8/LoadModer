import path from 'node:path';
import { readdir, rm } from 'node:fs/promises';
import { modrinthClient } from '../../api/client.js';
import { p, pc } from '../../ui/prompts.js';
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

  // 1. Deteksi tautan Modrinth: modrinth.com/mod/<slug>
  const urlRegex = /(?:https?:\/\/)?(?:www\.)?modrinth\.com\/mod\/([a-zA-Z0-9\-_]+)/gi;
  let urlMatch: RegExpExecArray | null;
  while ((urlMatch = urlRegex.exec(text)) !== null) {
    const slug = urlMatch[1]?.toLowerCase();
    if (slug) {
      // Cek apakah tautan ini berada dekat dengan kata kunci persyaratan
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

  // 2. Deteksi frasa teks eksplisit: "Requires <Library>" / "Dependencies: <Library>"
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

  // 1. Sumber Resmi: Modrinth Version Dependencies (required)
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

  // 2. Sumber Heuristik: Deskripsi & Body Mod
  const combinedDesc = `${project?.description || ''}\n${project?.body || ''}`;
  const textSlugs = extractDependenciesFromText(combinedDesc);

  for (const slug of textSlugs) {
    // Jangan tambahkan slug diri sendiri
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

  // 1. Dapatkan kandidat dependensi wajib
  const initialCandidates = await getRequiredLibraries(mainVersion, project);

  // Jika tidak ada library tambahan yang dibutuhkan:
  if (initialCandidates.length === 0) {
    p.log.message(pc.dim('  ℹ️  Mod ini mandiri (tidak memerlukan library tambahan).'));
    return result;
  }

  p.log.step(
    `Memeriksa mod library yang dibutuhkan untuk ${pc.bold(mainModSlug)} (${initialCandidates.length} terdeteksi)...`
  );

  // 2. Gunakan antrean (queue) untuk resolusi transitif dan set untuk menghindari siklus
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
          p.log.warn(
            pc.yellow(
              `⚠️  Tidak ditemukan rilis library "${depProj.title}" untuk ${loader.toUpperCase()} ${gameVersion}.`
            )
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

      // Cek apakah library sudah terpasang di folder mods
      const existingFiles = await readdir(modsDir).catch(() => [] as string[]);
      const exactFilePresent = existingFiles.some((f) => f === depFile.filename);

      // Cek apakah ada file jar lama dari mod library yang sama
      const existingSameMod = existingFiles.find(
        (f) =>
          f.toLowerCase().startsWith(depProj.slug.toLowerCase()) &&
          f.endsWith('.jar') &&
          !f.endsWith('.disabled') &&
          f !== depFile.filename
      );

      const reqDepsOfThis = (depBestVersion.dependencies || [])
        .filter((d): d is typeof d & { project_id: string } => d.dependency_type === 'required' && Boolean(d.project_id))
        .map((d) => d.project_id);

      if (exactFilePresent) {
        // Versi yang cocok sudah terpasang
        p.log.message(
          pc.green(`  ✔  Library [${depProj.title}] sudah terpasang (${pc.dim(depFile.filename)}) - dilewati.`)
        );
        result.skippedAlreadyInstalled.push({
          name: depProj.title,
          filename: depFile.filename,
        });

        // Daftarkan di dependency graph agar relasi tetap tercatat
        graph.registerMod(depProj.slug, {
          projectId: depProj.id,
          versionId: depBestVersion.id,
          versionNumber: depBestVersion.version_number,
          filename: depFile.filename,
          sha512: depFile.hashes.sha512,
          isRoot: false,
          dependencies: reqDepsOfThis,
        });
      } else {
        // Hapus file lama jika ada versi lama yang terpasang agar tidak crash duplikat
        if (existingSameMod) {
          try {
            await rm(path.join(modsDir, existingSameMod), { force: true });
            p.log.message(pc.dim(`  Menghapus versi library usang: ${existingSameMod}`));
          } catch {}
        }

        if (dryRun) {
          p.log.info(`  [dry-run] Akan memasang library: ${depFile.filename} (${formatBytes(depFile.size)})`);
        } else {
          p.log.info(
            `  ⬇️  Memasang library: ${pc.cyan(depProj.title)} (${pc.bold(depBestVersion.version_number)}) untuk ${pc.green(`${loader.toUpperCase()} ${gameVersion}`)}...`
          );

          const destPath = path.join(modsDir, depFile.filename);
          await modrinthClient.download(depFile.url, destPath, {
            sha512: depFile.hashes.sha512,
            size: depFile.size,
          });

          graph.registerMod(depProj.slug, {
            projectId: depProj.id,
            versionId: depBestVersion.id,
            versionNumber: depBestVersion.version_number,
            filename: depFile.filename,
            sha512: depFile.hashes.sha512,
            isRoot: false,
            dependencies: reqDepsOfThis,
          });

          result.installed.push({
            name: depProj.title,
            filename: depFile.filename,
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
      p.log.warn(`  ⚠️  Gagal memproses dependensi library "${targetIdOrSlug}": ${err.message}`);
    }
  }

  return result;
}
